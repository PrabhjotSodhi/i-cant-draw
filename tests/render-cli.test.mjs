import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

const renderScript = fileURLToPath(new URL('../skills/i-cant-draw/scripts/render.mjs', import.meta.url));
const fixturePath = fileURLToPath(new URL('./fixtures/flow-components.json', import.meta.url));
const render = (...args) => spawnSync(process.execPath, [renderScript, ...args], { encoding: 'utf-8' });

describe('render.mjs', () => {
  it('renders a spec to a PNG and an SVG and exits 0', () => {
    // GIVEN a valid spec and an empty output folder
    const outputDir = mkdtempSync(join(tmpdir(), 'render-cli-'));
    // WHEN node runs the render entry directly
    const result = render(fixturePath, '-o', outputDir, '-n', 'flow', '--style', 'quiet');
    // THEN it exits 0 and writes both files
    expect(result.status, result.stderr).toBe(0);
    const png = readFileSync(join(outputDir, 'flow.png'));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(readFileSync(join(outputDir, 'flow.svg'), 'utf-8')).toMatch(/^<svg /);
  });
  it('exits 2 on an invalid spec and names the problem', () => {
    // GIVEN a spec with two nodes sharing one id
    const outputDir = mkdtempSync(join(tmpdir(), 'render-cli-'));
    const spec = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    spec.nodes[1].id = spec.nodes[0].id;
    const specPath = join(outputDir, 'bad.json');
    writeFileSync(specPath, JSON.stringify(spec));
    // WHEN node runs the render entry on it
    const result = render(specPath, '-o', outputDir, '-n', 'bad');
    // THEN it exits 2 with an invalid spec message and writes no PNG
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/Invalid spec/);
    expect(existsSync(join(outputDir, 'bad.png'))).toBe(false);
  });
});
