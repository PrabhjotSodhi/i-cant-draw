import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runPipeline } from '../scripts/pipeline.mjs';

const fixtureFrom = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));

describe('runPipeline', () => {
  it('renders the hub fixture with zero collisions and returns its layout', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diag-'));
    const r = await runPipeline(fixture('hub-deployment'), { outputDir: dir, baseName: 'hub' });
    expect(r.collisions).toEqual([]);
    expect(r.layout.hubId).toBe('shortener');
    expect(existsSync(r.pngPath)).toBe(true);
  });
  it('renders the flow fixture with zero collisions', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diag-'));
    const r = await runPipeline(fixture('flow-components'), { outputDir: dir, baseName: 'flow' });
    expect(r.collisions).toEqual([]);
  });
  it('rejects a spec with a theme field as a SpecError', async () => {
    const themed = { theme: 'pastel', nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [{ from: 'a', to: 'b' }] };
    await expect(runPipeline(themed, {})).rejects.toMatchObject({ name: 'SpecError', message: expect.stringMatching(/field "theme" is not part of the spec/) });
  });
  it('rejects an invalid spec as a SpecError', async () => {
    const bad = fixture('flow-components');
    bad.nodes[1].id = bad.nodes[0].id;
    await expect(runPipeline(bad, {})).rejects.toMatchObject({ name: 'SpecError' });
  });
  it('turns a sizing failure into a SpecError', async () => {
    const bad = fixture('flow-components');
    bad.nodes[1].subtitle = 'word '.repeat(60).trim();
    await expect(runPipeline(bad, {})).rejects.toMatchObject({ name: 'SpecError' });
  });
});

describe('runPipeline sequence', () => {
  it('draws kind: actor as a person in a sequence', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diag-'));
    const spec = { template: 'sequence', actors: [{ id: 'op', label: 'Operator', kind: 'actor' }, { id: 'svc', label: 'Service' }],
      messages: [{ from: 'op', to: 'svc', label: 'run' }, { from: 'svc', to: 'op', label: 'done', kind: 'return' }] };
    const r = await runPipeline(spec, { outputDir: dir, baseName: 'seq' });
    expect(r.collisions).toEqual([]);
    expect(r.layout.nodes.find(n => n.id === 'op').height).toBeGreaterThan(r.layout.nodes.find(n => n.id === 'svc').height);
  });
});

describe('runPipeline default style', () => {
  it('draws in crayon when a spec names no style', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diag-'));
    const spec = fixture('flow-components');
    delete spec.style;
    const r = await runPipeline(spec, { outputDir: dir, baseName: 'default' });
    expect(r.svg).toContain('#FFFDF6');
  });
});

describe('runPipeline lint warnings', () => {
  it('returns layout lint findings and writes them next to the outputs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diag-'));
    const card = (id, row, col) => ({ id, label: id.toUpperCase(), row, col });
    const spec = { template: 'flow', nodes: [card('s', 0, 0), card('b1', 1, 0), card('b2', 2, 0), card('b3', 3, 0), card('t1', 1, 1), card('t2', 2, 1), card('t3', 3, 1)],
      edges: [...['t1', 't2', 't3'].map(t => ({ from: 's', to: t })), ...['b1', 'b2', 'b3'].map(b => ({ from: b, to: 't1' }))] };
    const r = await runPipeline(spec, { outputDir: dir, baseName: 'fan' });
    expect(r.lint.some(f => f.rule === 'edge-overlap')).toBe(true);
    expect(existsSync(r.lintPath)).toBe(true);
  });
  it('reports no findings for a clean diagram', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'diag-'));
    const r = await runPipeline(fixture('flow-components'), { outputDir: dir, baseName: 'clean' });
    expect(r.lint).toEqual([]);
    expect(r.lintPath).toBeNull();
  });
});

describe('runPipeline state template', () => {
  for (const style of ['quiet', 'crayon']) {
    it(`renders the state-build eval in ${style} with zero collisions and a clean lint`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'diag-'));
      const r = await runPipeline({ ...fixtureFrom('../evals/state-build/spec.json'), style }, { outputDir: dir, baseName: 'state' });
      expect(r.collisions).toEqual([]);
      expect(r.lint).toEqual([]);
    });
  }
});
