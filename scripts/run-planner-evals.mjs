// Each run costs model tokens, so this runs by hand before a release, never in npm test or npm run eval.
import { readFileSync, readdirSync, existsSync, mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, tmpdir, userInfo } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { validateSpec } from './validate-spec.mjs';
import { runPipeline } from './pipeline.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const outRoot = option('--out') || mkdtempSync(join(tmpdir(), 'planner-evals-'));
const model = option('--model');
const claude = [process.env.CLAUDE_BIN, join(homedir(), '.local/bin/claude')].find(p => p && existsSync(p)) || 'claude';

const templateDir = join(root, 'references/templates');
// One call cannot pick a template and then read its file, so every template file follows the core prompt.
const planner = [join(root, 'references/planner-prompt.md'), ...readdirSync(templateDir).sort().map(f => join(templateDir, f))]
  .map(path => readFileSync(path, 'utf-8')).join('\n\n');
const schema = readFileSync(join(root, 'references/spec-schema.json'), 'utf-8');

function ask(prompt) {
  const flags = ['-p', '--tools', '', '--no-session-persistence', '--output-format', 'text', ...(model ? ['--model', model] : [])];
  // The login keychain lookup needs USER and LOGNAME, which render.sh's clean shell drops.
  const env = { ...process.env, USER: userInfo().username, LOGNAME: userInfo().username };
  const run = spawnSync(claude, flags, { input: prompt, encoding: 'utf-8', env, timeout: 600000, maxBuffer: 1 << 24 });
  if (run.status !== 0) throw new Error(`claude exited ${run.status}: ${(run.stderr || run.stdout || run.error?.message || '').trim()}`);
  return run.stdout;
}

function firstJson(text) {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(body);
}

async function check(spec, dir) {
  const { ok, errors } = validateSpec(spec);
  if (!ok) return errors;
  const problems = [];
  for (const style of ['quiet', 'crayon']) {
    try {
      const r = await runPipeline({ ...spec, style }, { outputDir: dir, baseName: `spec-${style}` });
      for (const c of r.collisions) problems.push(`${style}: collision ${c.a} with ${c.b}`);
      for (const f of r.lint) problems.push(`${style}: lint ${f.rule} ${f.owner}: ${f.detail}`);
    } catch (err) {
      problems.push(`${style}: ${err.message}`);
    }
  }
  return problems;
}

const cases = readdirSync(join(root, 'evals/planner')).filter(d => existsSync(join(root, 'evals/planner', d, 'requirements.md')));
let failures = 0;
for (const name of cases) {
  const request = readFileSync(join(root, 'evals/planner', name, 'requirements.md'), 'utf-8').trim();
  const dir = join(outRoot, name);
  mkdirSync(dir, { recursive: true });
  const base = `${planner}\n\n## Spec schema\n\n\`\`\`json\n${schema}\n\`\`\`\n\n## Request\n\n${request}\n\nReturn only the JSON spec.`;
  let prompt = base, problems = ['no attempt'], spec = null;
  for (let attempt = 1; attempt <= 2 && problems.length; attempt++) {
    try {
      spec = firstJson(ask(prompt));
      writeFileSync(join(dir, `spec-attempt-${attempt}.json`), JSON.stringify(spec, null, 2));
      problems = await check(spec, dir);
    } catch (err) {
      problems = [err.message];
    }
    if (problems.length) prompt = `${base}\n\nYour last spec was:\n\n\`\`\`json\n${JSON.stringify(spec, null, 2)}\n\`\`\`\n\nIt failed with:\n${problems.map(p => `- ${p}`).join('\n')}\n\nReturn a corrected JSON spec only.`;
    console.log(`${problems.length ? 'FAIL' : 'pass'} ${name} attempt ${attempt}${problems.length ? `: ${problems.join('; ')}` : ''}`);
  }
  if (problems.length) failures++;
}
console.log(`${cases.length - failures} of ${cases.length} planner cases passed. Renders in ${outRoot}`);
process.exit(failures ? 1 : 0);
