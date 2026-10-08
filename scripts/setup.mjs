import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { homedir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STYLES = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf-8')).userConfig.style.options;

/** Each agent's home folder, which holds its skills folder. */
export const HOSTS = {
  codex: (home, env) => env.CODEX_HOME || join(home, '.codex'),
  opencode: (home) => join(home, '.config', 'opencode'),
  cursor: (home) => join(home, '.cursor'),
  factory: (home) => join(home, '.factory'),
  kiro: (home) => join(home, '.kiro'),
  copilot: (home) => join(home, '.copilot'),
};

export function skillsFolder(host, home, env) {
  if (!HOSTS[host]) throw new Error(`unknown agent "${host}"; valid: ${Object.keys(HOSTS).join(', ')}, auto`);
  return join(HOSTS[host](home, env), 'skills');
}

/** The draw skill with the Claude Code plugin variables written in, for agents that do not fill them. */
export function skillFor(skill, root, style) {
  const rootPath = root.replace(/\\/g, '/');
  return skill
    .replace(/^name: draw$/m, 'name: i-cant-draw')
    .replace('Run `/plugin` and read the note on i-cant-draw, or run', 'Run')
    .replaceAll('${CLAUDE_PLUGIN_ROOT}', rootPath)
    .replaceAll('${user_config.style}', style);
}

export function install({ host, root = ROOT, style = 'crayon', home = homedir(), env = process.env }) {
  if (!STYLES.includes(style)) throw new Error(`unknown style "${style}"; valid: ${STYLES.join(', ')}`);
  const folder = join(skillsFolder(host, home, env), 'i-cant-draw');
  mkdirSync(folder, { recursive: true });
  const path = join(folder, 'SKILL.md');
  writeFileSync(path, skillFor(readFileSync(join(ROOT, 'skills', 'draw', 'SKILL.md'), 'utf-8'), root, style));
  return path;
}

export function detectHosts(home = homedir(), env = process.env) {
  return Object.keys(HOSTS).filter(host => existsSync(HOSTS[host](home, env)));
}

function main(args) {
  const option = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const host = option('--host');
  const style = option('--style') || 'crayon';
  if (!host) {
    console.error(`Usage: node scripts/setup.mjs --host <${Object.keys(HOSTS).join('|')}|auto> [--style <${STYLES.join('|')}>]`);
    return 1;
  }
  const hosts = host === 'auto' ? detectHosts() : [host];
  if (!hosts.length) {
    console.error('setup: no supported agent found on this machine.');
    return 1;
  }
  if (!STYLES.includes(style)) throw new Error(`unknown style "${style}"; valid: ${STYLES.join(', ')}`);
  for (const name of hosts) skillsFolder(name, homedir(), process.env);
  const npm = spawnSync('npm ci --omit=dev', { cwd: ROOT, stdio: 'inherit', shell: true });
  if (npm.status !== 0) {
    console.error('setup: npm ci failed, so the engine cannot run.');
    return 1;
  }
  for (const name of hosts) console.log(`${name}: ${install({ host: name, style })}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (err) {
    console.error(`setup: ${err.message}`);
    process.exit(1);
  }
}
