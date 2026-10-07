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

describe('draw: state kinds', () => {
  const stateSpec = { template: 'flow', nodes: [{ id: 'go', kind: 'start' }, { id: 'run', kind: 'state', label: 'Running' }],
    edges: [], groups: [{ id: 'z', label: 'Working', contains: ['run'], tone: 'blue' }] };
  const stateLayout = { width: 400, height: 140, edges: [],
    nodes: [{ id: 'go', x: 10, y: 60, width: 20, height: 20, lines: [] }, { id: 'run', x: 120, y: 42, width: 200, height: 56, lines: [] }],
    groups: [{ id: 'z', x: 96, y: 0, width: 248, height: 122, depth: 0, spec: stateSpec.groups[0] }] };
  const crayon = loadStyle('crayon');
  const { svg, geometry } = draw(stateLayout, stateSpec, crayon);
  it('centres a state title and tints the state with its zone tone', () => {
    expect(svg).toMatch(/text-anchor="middle"[^>]*>Running</);
    expect(svg).toContain(`fill="${crayon.palette.tones.blue.fill}" fill-opacity="0.16"`);
  });
  it('draws no text for a start node, and still gives it geometry', () => {
    expect(geometry.filter(g => g.owner === 'go').map(g => g.kind)).toEqual(['node']);
  });
});

describe('draw: crayon label outline', () => {
  const crayon = loadStyle('crayon');
  it('outlines crayon labels in paper colour instead of boxing them', () => {
    const { svg } = draw(layout(), spec, crayon);
    expect(svg).toMatch(/<text[^>]*paint-order="stroke"[^>]*>rows</);
    expect(svg).not.toContain('<rect x="330" y="81" width="40" height="18"');
  });
  it('keeps the box behind quiet labels', () => {
    const { svg } = draw(layout(), spec, quiet);
    expect(svg).toContain('<rect x="330" y="81" width="40" height="18"');
  });
});

describe('draw: class kind', () => {
  const classSpec = { template: 'flow', nodes: [
    { id: 'tool', kind: 'class', label: 'QueryTool', stereotype: 'abstract', attributes: ['rowCap: number', 'items: List<Stage>'], methods: ['execute(sql)'] }],
    edges: [], groups: [{ id: 'z', label: 'Tools', contains: ['tool'], tone: 'orange' }] };
  const node = { id: 'tool', x: 40, y: 50, width: 240, height: 60 + 64 + 38, lines: [],
    rows: [{ y: 79, text: 'rowCap: number', part: 'attribute' }, { y: 105, text: 'items: List<Stage>', part: 'attribute' }, { y: 143, text: 'execute(sql)', part: 'method' }],
    dividers: [60, 124] };
  const classLayout = () => ({ width: 400, height: 260, edges: [], nodes: [{ ...node }],
    groups: [{ id: 'z', x: 0, y: 0, width: 320, height: 240, depth: 0, spec: classSpec.groups[0] }] });
  const offsetX = (1920 - 400) / 2;
  for (const name of ['quiet', 'crayon', 'riso', 'whiteboard', 'notebook', 'watercolour']) {
    const style = loadStyle(name);
    const { svg, geometry } = draw(classLayout(), classSpec, style);
    it(`${name}: centres the name and stereotype in the header and left-aligns each row`, () => {
      expect(svg).toMatch(/x="160" y="90"[^>]*text-anchor="middle"[^>]*>QueryTool</);
      expect(svg).toMatch(/x="160" y="69"[^>]*text-anchor="middle"[^>]*>«abstract»</);
      expect(svg).toMatch(/x="56" y="129"[^>]*text-anchor="start"[^>]*>rowCap: number</);
      expect(svg).toContain('>items: List&lt;Stage&gt;</text>');
      expect(svg).toMatch(/x="56" y="193"[^>]*text-anchor="start"[^>]*>execute\(sql\)</);
    });
    it(`${name}: gives every row its own text geometry inside the card`, () => {
      const texts = geometry.filter(g => g.owner === 'tool' && g.kind === 'text');
      expect(texts).toHaveLength(5);
      const row = texts.find(t => Math.abs(t.y + t.height / 2 - (129 + 40)) < 0.01);
      expect(row.x).toBe(56 + offsetX);
      for (const t of texts) {
        expect(t.x).toBeGreaterThanOrEqual(40 + offsetX);
        expect(t.x + t.width).toBeLessThanOrEqual(280 + offsetX);
      }
    });
  }
  it('fails the collision gate when an edge label sits on a row', () => {
    const l = classLayout();
    l.edges = [{ index: 0, sections: [{ startPoint: { x: 0, y: 0 }, endPoint: { x: 0, y: 10 }, bendPoints: [] }], labels: [{ text: 'uses', x: 60, y: 138, width: 40, height: 18 }] }];
    const { geometry } = draw(l, { ...classSpec, edges: [{ from: 'tool', to: 'tool' }] }, quiet);
    expect(checkCollisions(geometry).some(c => c.a.startsWith('text:tool') || c.b.startsWith('text:tool'))).toBe(true);
  });
});
