import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const skillFolder = fileURLToPath(new URL('../skills/i-cant-draw/', import.meta.url));
const json = (path) => JSON.parse(readFileSync(path, 'utf-8'));
const scripts = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap(entry =>
  entry.isDirectory() ? scripts(join(folder, entry.name)) : entry.name.endsWith('.mjs') ? [join(folder, entry.name)] : []);

describe('skill folder', () => {
  it('names no agent-specific variables in SKILL.md', () => {
    expect(readFileSync(join(skillFolder, 'SKILL.md'), 'utf-8')).not.toContain('${');
  });
  it('lists the same packages as the repo, so tests run what users install', () => {
    expect(json(join(skillFolder, 'package.json')).dependencies).toEqual(json(new URL('../package.json', import.meta.url)).dependencies);
  });
  it('imports nothing from outside its own folder', () => {
    for (const file of scripts(join(skillFolder, 'scripts'))) {
      for (const [, path] of readFileSync(file, 'utf-8').matchAll(/from '(\.[^']+)'/g)) {
        expect(resolve(dirname(file), path).startsWith(resolve(skillFolder)), `${file}: ${path}`).toBe(true);
      }
    }
  });
});
