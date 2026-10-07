import { readFileSync, mkdtempSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { runPipeline } from './pipeline.mjs';
import { lintLayout } from './layout-lint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVALS = join(__dirname, '..', 'evals');
const config = JSON.parse(readFileSync(join(EVALS, 'cases.json'), 'utf-8'));

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let failures = 0;
const fail = (caseName, style, msg) => { failures++; console.error(`FAIL ${caseName} [${style}] ${msg}`); };
const ok = (caseName, style, msg) => console.log(`  ok ${caseName} [${style}] ${msg}`);

for (const c of config.cases) {
  const spec = JSON.parse(readFileSync(join(EVALS, c.dir, 'spec.json'), 'utf-8'));
  for (const style of config.styles) {
    const outDir = mkdtempSync(join(tmpdir(), `eval-${c.dir}-${style}-`));
    let result;
    try {
      result = await runPipeline({ ...spec, style }, { outputDir: outDir, baseName: c.dir });
    } catch (err) {
      fail(c.dir, style, `pipeline threw: ${err.message}`);
      continue;
    }
    // 1. structural: every label appears in the SVG
    const missing = [];
    const isSequence = spec.template === 'sequence';
    const labelNodes = isSequence ? spec.actors : spec.nodes;
    const labelEdges = isSequence ? spec.messages : spec.edges;
    const labelGroups = isSequence
      ? (spec.fragments || []).flatMap(f => f.regions).filter(x => x.guard).map((x, i) => ({ id: `guard${i}`, label: x.guard }))
      : (spec.groups || []);
    for (const n of labelNodes.filter(x => x.label)) {
      const firstLine = n.label.split('\n')[0];
      if (!result.svg.includes(escapeXml(firstLine))) missing.push(n.id);
    }
    for (const g of labelGroups) {
      const esc = escapeXml(g.label);
      const escUpper = escapeXml(g.label.toUpperCase());
      const label = result.svg.includes(esc) || result.svg.includes(escUpper);
      if (!label) missing.push(`group:${g.id}`);
    }
    for (const m of labelEdges) {
      if (m.label && !result.svg.includes(escapeXml(m.label.split('\n')[0]))) missing.push(`message: '${m.label}'`);
    }
    if (missing.length) fail(c.dir, style, `missing labels: ${missing.join(', ')}`);
    else ok(c.dir, style, 'structure');
    // 2. collision gate
    if (result.collisions.length) fail(c.dir, style, `${result.collisions.length} collision(s): ${JSON.stringify(result.collisions[0])}`);
    else ok(c.dir, style, 'zero collisions');
    // 3. layout lint: reading-effort rules for every template but sequence
    if (spec.template !== 'sequence') {
      const findings = lintLayout(result.layout, spec);
      for (const f of findings) fail(c.dir, style, `lint ${f.rule} ${f.owner} ${f.detail}`);
      if (!findings.length) ok(c.dir, style, 'layout lint clean');
    }
  }
}

console.log(failures ? `\n${failures} failure(s)` : '\nall eval checks passed');
process.exit(failures ? 1 : 0);
