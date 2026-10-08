import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { sequenceLayout, sequenceRenderSpec } from '../skills/i-cant-draw/scripts/sequence-layout.mjs';
import { draw, styleAsTheme } from '../skills/i-cant-draw/scripts/render/draw.mjs';
import { loadStyle } from '../skills/i-cant-draw/scripts/styles/index.mjs';
import { checkCollisions } from '../skills/i-cant-draw/scripts/collision-check.mjs';

const quiet = loadStyle('quiet');
const spec = { ...JSON.parse(readFileSync(new URL('../evals/upload-sequence/spec.json', import.meta.url))), template: 'sequence' };
delete spec.theme;

describe('sequence through styles', () => {
  const layout = sequenceLayout(spec, styleAsTheme(quiet));
  const { svg, geometry } = draw(layout, sequenceRenderSpec(spec), quiet);
  it('draws with zero collisions', () => {
    expect(checkCollisions(geometry)).toEqual([]);
  });
  it('shows every message label and lifeline', () => {
    for (const m of spec.messages) if (m.label) expect(svg, m.label).toContain(m.label.replace(/&/g, '&amp;'));
    expect((svg.match(/stroke-dasharray/g) || []).length).toBeGreaterThanOrEqual(spec.actors.length);
  });
  it('draws async messages with an open head and lifelines fainter than messages', () => {
    expect(svg).toContain('url(#quiet-open-main)');
    expect(svg).toMatch(/stroke="#CBD5E1" stroke-width="1" stroke-dasharray="4,4"/);
    expect(svg).toContain('marker-end="url(#quiet-head-main)"');
  });
  it('draws activation bars as bars', () => {
    expect(geometry.filter(g => g.kind === 'activation').length).toBe(layout.activations.length);
  });
});

describe('sequence actor subtitles', () => {
  it('draws a plain actor subtitle', () => {
    const s = { template: 'sequence', actors: [{ id: 'db', label: 'Database', subtitle: 'read replica' }, { id: 'app', label: 'App' }],
      messages: [{ from: 'app', to: 'db', label: 'query' }] };
    const l = sequenceLayout(s, styleAsTheme(quiet));
    expect(draw(l, sequenceRenderSpec(s), quiet).svg).toContain('read replica');
  });
});
