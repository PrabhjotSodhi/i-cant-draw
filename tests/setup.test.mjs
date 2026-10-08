import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HOSTS, skillFor, skillsFolder, install, detectHosts } from '../scripts/setup.mjs';

const root = 'D:\\tools\\i-cant-draw';
const freshHome = () => mkdtempSync(join(tmpdir(), 'home-'));

describe('skillFor', () => {
  const skill = skillFor(readFileSync(new URL('../skills/draw/SKILL.md', import.meta.url), 'utf-8'), root, 'riso');
  it('writes in the install path with forward slashes and the chosen style', () => {
    expect(skill).not.toContain('${');
    expect(skill).toContain('node "D:/tools/i-cant-draw/scripts/render.mjs"');
    expect(skill).toContain('--style riso');
  });
  it('names the skill after the plugin, so it cannot clash with another draw skill', () => {
    expect(skill).toMatch(/^---\nname: i-cant-draw\n/);
  });
  it('drops the Claude Code plugin command from troubleshooting', () => {
    expect(skill).not.toContain('/plugin');
    expect(skill).toContain('cd "D:/tools/i-cant-draw" && npm ci');
  });
});

describe('install', () => {
  it('puts the skill in each agent\'s skills folder', () => {
    const home = freshHome();
    const expected = {
      codex: '.codex/skills', opencode: '.config/opencode/skills', cursor: '.cursor/skills',
      factory: '.factory/skills', kiro: '.kiro/skills', copilot: '.copilot/skills',
    };
    expect(Object.keys(HOSTS).sort()).toEqual(Object.keys(expected).sort());
    for (const [host, folder] of Object.entries(expected)) {
      const path = install({ host, root, style: 'crayon', home, env: {} });
      expect(path).toBe(join(home, folder, 'i-cant-draw', 'SKILL.md'));
      expect(readFileSync(path, 'utf-8')).toContain('name: i-cant-draw');
    }
  });
  it('follows CODEX_HOME', () => {
    const home = freshHome(), codexHome = join(home, 'custom-codex');
    expect(skillsFolder('codex', home, { CODEX_HOME: codexHome })).toBe(join(codexHome, 'skills'));
  });
  it('rejects an unknown agent and an unknown style', () => {
    expect(() => install({ host: 'notepad', root, style: 'crayon', home: freshHome(), env: {} })).toThrow(/unknown agent "notepad"; valid: /);
    expect(() => install({ host: 'codex', root, style: 'neon', home: freshHome(), env: {} })).toThrow(/unknown style "neon"/);
  });
});

describe('detectHosts', () => {
  it('finds only the agents whose home folder exists', () => {
    const home = freshHome();
    mkdirSync(join(home, '.codex'));
    mkdirSync(join(home, '.config', 'opencode'), { recursive: true });
    expect(detectHosts(home, {})).toEqual(['codex', 'opencode']);
    expect(existsSync(join(home, '.cursor'))).toBe(false);
  });
});
