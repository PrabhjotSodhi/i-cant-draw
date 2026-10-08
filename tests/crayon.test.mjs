import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { loadStyle } from '../skills/i-cant-draw/scripts/styles/index.mjs';
import { hachureLines } from '../skills/i-cant-draw/scripts/styles/crayon.mjs';
import { hubLayout } from '../skills/i-cant-draw/scripts/templates/hub.mjs';
import { draw } from '../skills/i-cant-draw/scripts/render/draw.mjs';
import { checkCollisions } from '../skills/i-cant-draw/scripts/collision-check.mjs';
import { flowLayout } from '../skills/i-cant-draw/scripts/templates/flow.mjs';
import { convertToPng } from '../skills/i-cant-draw/scripts/convert-png.mjs';

const crayon = loadStyle('crayon');
const spec = JSON.parse(readFileSync(new URL('./fixtures/hub-deployment.json', import.meta.url)));
const render = (s) => draw(hubLayout(s, crayon), s, crayon);

describe('crayon style', () => {
  it('renders the same bytes twice for one spec', () => {
    expect(render(spec).svg).toBe(render(spec).svg);
  });
  it('seeds its randomness from the spec', () => {
    const changed = structuredClone(spec);
    changed.nodes[0].label = 'Link services';
    expect(render(changed).svg).not.toBe(render(spec).svg);
  });
  it('draws hachure at -41 degrees, clipped to the box', () => {
    const box = { x: 0, y: 0, width: 100, height: 100 };
    const lines = hachureLines(box);
    expect(lines.length).toBeGreaterThan(5);
    for (const [x1, y1, x2, y2] of lines) {
      const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      expect(Math.min(Math.abs(angle + 41), Math.abs(angle - 139))).toBeLessThan(0.5);
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        expect(x).toBeGreaterThanOrEqual(-0.001); expect(x).toBeLessThanOrEqual(100.001);
        expect(y).toBeGreaterThanOrEqual(-0.001); expect(y).toBeLessThanOrEqual(100.001);
      }
    }
  });
  it('grains the edge layer only, so hatching stays cheap to compress', () => {
    expect((render(spec).svg.match(/filter="url\(#grain\)"/g) || []).length).toBe(1);
  });
  it('keeps a crayon PNG at 1.5 MB or less', () => {
    const flow = JSON.parse(readFileSync(new URL('../evals/components-grid/spec.json', import.meta.url)));
    const { svg } = draw(flowLayout(flow, crayon), flow, crayon);
    expect(convertToPng(svg).length).toBeLessThanOrEqual(1.5e6);
  });
  it('draws the hub fixture with zero collisions', () => {
    expect(checkCollisions(render(spec).geometry)).toEqual([]);
  });
});
