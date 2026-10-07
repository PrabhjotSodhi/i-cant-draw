import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { loadStyle } from '../scripts/styles/index.mjs';
import { flowLayout } from '../scripts/templates/flow.mjs';
import { hubLayout } from '../scripts/templates/hub.mjs';
import { draw } from '../scripts/render/draw.mjs';
import { checkCollisions } from '../scripts/collision-check.mjs';
import { convertToPng } from '../scripts/convert-png.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const box = { x: 10, y: 10, width: 200, height: 60 };
const ctx = () => ({ random: (() => { let i = 0; return () => ((i++ * 0.37) % 1); })() });

for (const name of ['riso', 'whiteboard', 'notebook', 'watercolour']) {
  describe(`${name} style`, () => {
    const style = loadStyle(name);
    it('has a font family, font files and a measure', () => {
      expect(style.fontFamily).toBeTruthy();
      expect(style.fonts.length).toBeGreaterThan(0);
      expect(style.measure('Hello', 16)).toBeGreaterThan(0);
    });
    it('draws every card kind', () => {
      for (const kind of ['card', 'decision', 'note', 'state', 'start', 'end', 'bar']) {
        expect(style.card({ box, kind, tone: 'blue' }, ctx()), kind).toMatch(/<(rect|polygon|path|circle)/);
      }
    });
    it('draws every line ending', () => {
      for (const endMarker of ['none', 'arrow', 'one', 'many', 'triangle']) {
        expect(style.line([{ x: 0, y: 0 }, { x: 200, y: 0 }], { endMarker }, ctx()), endMarker).toMatch(/<(path|polygon)/);
      }
    });
    it('renders the flow and hub fixtures with zero collisions', () => {
      for (const [spec, layoutOf] of [[fixture('flow-components'), flowLayout], [fixture('hub-deployment'), hubLayout]]) {
        const { geometry } = draw(layoutOf(spec, style), spec, style);
        expect(checkCollisions(geometry)).toEqual([]);
      }
    });
  });
}

describe('PNG size in every style', () => {
  const spec = JSON.parse(readFileSync(new URL('../evals/netflix-encoding/spec.json', import.meta.url)));
  for (const name of ['quiet', 'crayon', 'riso', 'whiteboard', 'notebook', 'watercolour']) {
    it(`${name} keeps the largest eval PNG at 1.5 MB or less`, () => {
      const style = loadStyle(name);
      const { svg } = draw(flowLayout(spec, style), spec, style);
      expect(convertToPng(svg, { scale: 2, fonts: style.fonts }).length).toBeLessThanOrEqual(1.5 * 1024 * 1024);
    }, 30000);
  }
});
