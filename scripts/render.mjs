import { readFileSync } from 'fs';
import { runPipeline } from './pipeline.mjs';

const HELP = `Usage: render.mjs <spec.json> [options]

Render a diagram spec to SVG + PNG.

Options:
  -o, --out <dir>       Output directory (default: .)
  -n, --name <base>     Output base filename (default: diagram)
      --style <name>    Style override: crayon, riso, whiteboard, notebook, watercolour or quiet (default: spec.style or crayon)
  -s, --scale <n>       PNG pixel scale (default: 2)
  -h, --help            Show this help

Outputs:
  <out>/<name>.svg
  <out>/<name>.png

Exit codes:
  0 success, 1 bad args, 2 invalid spec (message names the field), 3 pipeline error, 4 collision gate failure
  Layout lint findings print as warnings and land in <out>/<name>.lint.json; they do not change the exit code.
`;

function parseArgs(argv) {
  const opts = { outputDir: '.', baseName: 'diagram', scale: 2 };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-o' || a === '--out') opts.outputDir = argv[++i];
    else if (a === '-n' || a === '--name') opts.baseName = argv[++i];
    else if (a === '--style') opts.style = argv[++i];
    else if (a === '-s' || a === '--scale') opts.scale = Number(argv[++i]);
    else if (a.startsWith('-')) { opts.badArg = a; }
    else rest.push(a);
  }
  opts.specPath = rest[0];
  // Back-compat: positional [outputDir] [baseName]
  if (rest[1]) opts.outputDir = rest[1];
  if (rest[2]) opts.baseName = rest[2];
  return opts;
}

const opts = parseArgs(process.argv.slice(2));

if (opts.help) { process.stdout.write(HELP); process.exit(0); }
if (opts.badArg) { console.error(`Unknown option: ${opts.badArg}\n\n${HELP}`); process.exit(1); }
if (!opts.specPath) { console.error(HELP); process.exit(1); }

let spec;
try {
  spec = JSON.parse(readFileSync(opts.specPath, 'utf-8'));
} catch (err) {
  console.error(`Failed to read spec "${opts.specPath}": ${err.message}`);
  process.exit(2);
}

if (opts.style) spec.style = opts.style;

runPipeline(spec, opts).then(result => {
  console.log(`SVG: ${result.svgPath}`);
  console.log(`PNG: ${result.pngPath}`);
  if (result.lint?.length) {
    console.error(`Layout lint: ${result.lint.length} finding(s), see ${result.lintPath}`);
    for (const f of result.lint) console.error(`  ${f.rule} ${f.owner}: ${f.detail}`);
  }
  if (result.collisions.length > 0) {
    console.error(`Collision gate: ${result.collisions.length} overlap(s) — see ${result.collisionsPath}`);
    process.exit(4);
  }
}).catch(err => {
  if (err.name === 'SpecError') {
    console.error(`Invalid spec:\n${err.message}`);
    process.exit(2);
  }
  console.error('Pipeline failed:', err.message);
  process.exit(3);
});
