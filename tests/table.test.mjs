import { describe, it, expect } from 'vitest';
import { loadStyle, STYLE_NAMES } from '../skills/i-cant-draw/scripts/styles/index.mjs';
import { flowLayout } from '../skills/i-cant-draw/scripts/templates/flow.mjs';
import { draw } from '../skills/i-cant-draw/scripts/render/draw.mjs';
import { checkCollisions } from '../skills/i-cant-draw/scripts/collision-check.mjs';

const spec = {
  template: 'flow',
  nodes: [
    { id: 'users', kind: 'table', label: 'users', row: 0, col: 0, columns: [{ name: 'id', type: 'bigint', key: 'PK' }, { name: 'email', type: 'text' }] },
    { id: 'orders', kind: 'table', label: 'orders', row: 0, col: 1, columns: [{ name: 'id', type: 'bigint', key: 'PK' }, { name: 'user_id', type: 'bigint', key: 'FK' }, { name: 'placed_at', type: 'timestamptz' }] },
  ],
  edges: [],
  groups: [{ id: 'shop', label: 'Shop', contains: ['users', 'orders'], tone: 'blue' }],
};
const ctx = () => ({ random: (() => { let i = 0; return () => ((i++ * 0.37) % 1); })() });

describe('table cards in every style', () => {
  for (const name of STYLE_NAMES) {
    const style = loadStyle(name);
    const tint = name === 'quiet' ? style.palette.tones.blue.text : style.palette.tones.blue.fill;
    it(`${name}: tints the header 16% with the zone's tone`, () => {
      const svg = style.card({ box: { x: 0, y: 0, width: 240, height: 108 }, kind: 'table', tone: 'blue', dividers: [42] }, ctx());
      expect(svg).toContain(`fill="${tint}" fill-opacity="0.16"`);
    });
    it(`${name}: draws every column with its key in the accent and its type right-aligned`, () => {
      const layout = flowLayout(spec, style);
      const { svg, geometry } = draw(layout, spec, style);
      for (const word of ['users', 'orders', 'email', 'user_id', 'placed_at', 'timestamptz']) expect(svg, word).toContain(`>${word}</text>`);
      expect(svg).toMatch(new RegExp(`fill="${style.palette.accent}">PK</text>`));
      expect(svg).toMatch(new RegExp(`fill="${style.palette.accent}">FK</text>`));
      expect(svg).toMatch(new RegExp(`text-anchor="end"[^>]*fill="${style.palette.sub}">timestamptz</text>`));
      expect(checkCollisions(geometry)).toEqual([]);
    });
    it(`${name}: gives the collision gate a box for each row's key, name and type`, () => {
      const layout = flowLayout(spec, style);
      const { geometry } = draw(layout, spec, style);
      const card = geometry.find(g => g.owner === 'orders' && g.kind === 'node');
      const texts = geometry.filter(g => g.owner === 'orders' && g.kind === 'text');
      expect(texts.length).toBe(1 + 2 + 3 + 3);
      const node = layout.nodes.find(n => n.id === 'orders');
      for (const row of node.rows) {
        const centre = card.y + row.y;
        expect(texts.filter(t => Math.abs(t.y + t.height / 2 - centre) < 0.5).length, `row ${row.text}`).toBeGreaterThanOrEqual(2);
      }
      const type = texts.find(t => Math.abs(t.y + t.height / 2 - (card.y + node.rows[2].y)) < 0.5 && t.x > card.x + card.width / 2);
      expect(type.x + type.width).toBeCloseTo(card.x + card.width - 16, 5);
    });
  }
});
