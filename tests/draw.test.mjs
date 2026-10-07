import { describe, it, expect } from 'vitest';
import { draw } from '../scripts/render/draw.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';
import { checkCollisions } from '../scripts/collision-check.mjs';

const quiet = loadStyle('quiet');

const spec = {
  template: 'flow',
  nodes: [
    { id: 'a', label: 'Source card', subtitle: 'two lines of subtitle text here', icon: 'database' },
    { id: 'b', label: 'Target card' },
  ],
  edges: [{ from: 'a', to: 'b', label: 'rows' }],
  groups: [{ id: 'g', label: 'Group', contains: ['a', 'b'] }],
};

const layout = () => ({
  width: 700, height: 200,
  nodes: [
    { id: 'a', x: 30, y: 60, width: 240, height: 90, lines: ['two lines of subtitle', 'text here'] },
    { id: 'b', x: 430, y: 60, width: 240, height: 90, lines: [] },
  ],
  groups: [{ id: 'g', x: 0, y: 0, width: 700, height: 200, depth: 1, spec: spec.groups[0] }],
  edges: [{
    index: 0,
    sections: [{ startPoint: { x: 270, y: 105 }, endPoint: { x: 430, y: 105 }, bendPoints: [] }],
    labels: [{ text: 'rows', x: 330, y: 81, width: 40, height: 18 }],
  }],
});

describe('draw', () => {
  const { svg, geometry } = draw(layout(), spec, quiet);
  const offsetX = (1920 - 700) / 2;

  it('pads the canvas to 1920 units', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1920"');
  });
  it('emits one node entry per card and the label box shifted by the canvas offset', () => {
    expect(geometry.filter(g => g.kind === 'node')).toHaveLength(2);
    const labels = geometry.filter(g => g.kind === 'edge-label');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toMatchObject({ x: 330 + offsetX, y: 81 + 40, width: 40, height: 18 });
  });
  it('produces no collisions for a clean layout', () => {
    expect(checkCollisions(geometry)).toEqual([]);
  });
  it('is deterministic', () => {
    expect(draw(layout(), spec, quiet).svg).toBe(svg);
  });
  it('keeps every title, subtitle and icon inside its own card', () => {
    const nodes = new Map(geometry.filter(g => g.kind === 'node').map(g => [g.owner, g]));
    const texts = geometry.filter(g => g.kind === 'text' || g.kind === 'subtitle');
    expect(texts.length).toBeGreaterThanOrEqual(3);
    for (const t of texts) {
      const n = nodes.get(t.owner);
      expect(t.x, t.owner).toBeGreaterThanOrEqual(n.x);
      expect(t.x + t.width, t.owner).toBeLessThanOrEqual(n.x + n.width);
      expect(t.y, t.owner).toBeGreaterThanOrEqual(n.y);
      expect(t.y + t.height, t.owner).toBeLessThanOrEqual(n.y + n.height);
    }
    expect(svg).not.toContain('NaN');
  });
  it('knocks the label out with the group fill', () => {
    expect(svg).toMatch(/<rect x="330" y="81" width="40" height="18" fill="#F8FAFC"/);
  });
});

describe('draw: end labels', () => {
  const withEndLabel = (box) => { const l = layout(); l.edges[0].endLabels = [{ text: '1..*', end: 'end', ...box }]; return l; };
  it('draws an end label and gives it its own owner', () => {
    const { svg, geometry } = draw(withEndLabel({ x: 395, y: 117, width: 28, height: 18 }), spec, quiet);
    expect(svg).toContain('>1..*</text>');
    expect(geometry.find(g => g.kind === 'end-label').owner).toBe('e0:end');
  });
  it('fails the collision gate when an end label sits on a card', () => {
    const { geometry } = draw(withEndLabel({ x: 440, y: 100, width: 28, height: 18 }), spec, quiet);
    expect(checkCollisions(geometry).some(c => c.a.startsWith('end-label') || c.b.startsWith('end-label'))).toBe(true);
  });
});

