import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { flowLayout } from '../skills/i-cant-draw/scripts/templates/flow.mjs';
import { SpecError } from '../skills/i-cant-draw/scripts/templates/cards.mjs';
import { assertLayout } from '../skills/i-cant-draw/scripts/layout-contract.mjs';
import { loadStyle } from '../skills/i-cant-draw/scripts/styles/index.mjs';
import { draw } from '../skills/i-cant-draw/scripts/render/draw.mjs';

const quiet = loadStyle('quiet');
const spec = JSON.parse(readFileSync(new URL('./fixtures/flow-components.json', import.meta.url)));
const layout = flowLayout(spec, quiet);
const node = id => layout.nodes.find(n => n.id === id);
const group = id => layout.groups.find(g => g.id === id);
const inCol = c => spec.nodes.filter(n => n.col === c).map(n => node(n.id));
const inRow = r => spec.nodes.filter(n => n.row === r).map(n => node(n.id));
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
function membersOf(id) {
  const g = spec.groups.find(x => x.id === id);
  return g ? g.contains.flatMap(membersOf) : [id];
}

describe('flowLayout: cells and positions', () => {
  it('meets the Layout contract', () => {
    expect(() => assertLayout(layout)).not.toThrow();
  });
  it('gives each labelled group a title box where draw puts a title without one', () => {
    const titles = l => draw(l, spec, quiet).geometry.filter(g => g.kind === 'group-label');
    const bare = { ...layout, groups: layout.groups.map(({ titleBox, ...rest }) => rest) };
    expect(layout.groups.filter(g => g.titleBox).length).toBe(spec.groups.filter(g => g.label).length);
    expect(titles(layout)).toEqual(titles(bare));
  });
  it('gives each column one x and one width', () => {
    for (const c of [4, 5]) {
      const cards = inCol(c);
      expect(new Set(cards.map(n => n.x)).size, `col ${c} x`).toBe(1);
      expect(new Set(cards.map(n => n.width)).size, `col ${c} width`).toBe(1);
    }
  });
  it('gives every card in the diagram one width', () => {
    const cards = spec.nodes.filter(n => (n.kind || 'card') === 'card').map(n => node(n.id));
    expect(new Set(cards.map(n => n.width)).size).toBe(1);
  });
  it('gives each row one centre line, actors included', () => {
    const centres = inRow(1).map(n => n.y + n.height / 2);
    for (const y of centres) expect(Math.abs(y - centres[0])).toBeLessThanOrEqual(1);
  });
  it('wraps groups around exactly their members', () => {
    for (const g of layout.groups) {
      const members = new Set(membersOf(g.id));
      for (const n of layout.nodes) {
        const covered = overlaps(g, n);
        expect(covered, `${g.id} / ${n.id}`).toBe(members.has(n.id));
      }
    }
  });
  it('leaves room for the label between columns 1 and 2', () => {
    const gap = node('api').x - (node('app').x + node('app').width);
    expect(gap).toBeGreaterThanOrEqual(quiet.measure('upload, pause, resume', 13) + 58);
  });
  it('places a chain without cells by longest path', () => {
    const chain = { template: 'flow', nodes: ['a', 'b', 'c'].map(id => ({ id, label: id.toUpperCase() })),
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }] };
    const l = flowLayout(chain, quiet);
    const x = id => l.nodes.find(n => n.id === id).x;
    expect(x('a')).toBeLessThan(x('b'));
    expect(x('b')).toBeLessThan(x('c'));
    const ys = l.nodes.map(n => n.y + n.height / 2);
    expect(new Set(ys).size).toBe(1);
  });
  it('rejects a group that covers a foreign card', () => {
    const bad = { template: 'flow',
      nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }, { id: 'c', label: 'C', row: 0, col: 2 }],
      edges: [], groups: [{ id: 'g', label: 'G', contains: ['a', 'c'] }] };
    expect(() => flowLayout(bad, quiet)).toThrow(SpecError);
    expect(() => flowLayout(bad, quiet)).toThrow(/group "g" covers cell \(0,1\) holding non-member "b"/);
  });
});

import { boxDistanceToSection } from '../skills/i-cant-draw/scripts/templates/route.mjs';
import { draw } from '../skills/i-cant-draw/scripts/render/draw.mjs';
import { checkCollisions } from '../skills/i-cant-draw/scripts/collision-check.mjs';

const card = (id, row, col, extra = {}) => ({ id, label: id.toUpperCase(), row, col, ...extra });
const edgeTo = (l, s, from, to) => l.edges.find(e => s.edges[e.index].from === from && s.edges[e.index].to === to);
const pts = s => [s.startPoint, ...s.bendPoints, s.endPoint];
function passesThrough(section, box) {
  const inner = { x: box.x + 1, y: box.y + 1, width: box.width - 2, height: box.height - 2 };
  const p = pts(section);
  for (let i = 1; i < p.length; i++) {
    const [a, b] = [p[i - 1], p[i]];
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    if (x1 > inner.x && x0 < inner.x + inner.width && y1 > inner.y && y0 < inner.y + inner.height) return true;
  }
  return false;
}

describe('flowLayout: routes', () => {
  it('routes the fixture with one bend where the mockup has one, none elsewhere', () => {
    const oneBend = new Set(['workers→limiter', 'storage→thumbnails', 'api→moderation']);
    expect(layout.edges).toHaveLength(spec.edges.length);
    for (const e of layout.edges) {
      const se = spec.edges[e.index];
      expect(e.sections[0].bendPoints.length, `${se.from}→${se.to}`).toBe(oneBend.has(`${se.from}→${se.to}`) ? 1 : 0);
    }
  });
  it('keeps labels beside their lines and draws with zero collisions', () => {
    for (const e of layout.edges) for (const l of e.labels) expect(boxDistanceToSection(l, e.sections[0]), l.text).toBeLessThanOrEqual(24);
    expect(checkCollisions(draw(layout, spec, quiet).geometry)).toEqual([]);
  });
  it('never routes through a card that is not an end', () => {
    for (const e of layout.edges) {
      const se = spec.edges[e.index];
      for (const n of layout.nodes) {
        if (n.id === se.from || n.id === se.to) continue;
        expect(passesThrough(e.sections[0], n), `${se.from}→${se.to} through ${n.id}`).toBe(false);
      }
    }
  });
  it('uses a Z when the source column is blocked', () => {
    const s = { template: 'flow', nodes: [card('a', 0, 0), card('block', 1, 0), card('t', 2, 1)], edges: [{ from: 'a', to: 't' }, { from: 'a', to: 'block' }] };
    const l = flowLayout(s, quiet);
    const bends = edgeTo(l, s, 'a', 't').sections[0].bendPoints;
    expect(bends).toHaveLength(2);
    expect(bends[0].x).toBe(bends[1].x);
    const a = l.nodes.find(n => n.id === 'a'), t = l.nodes.find(n => n.id === 't');
    expect(bends[0].x).toBeGreaterThan(a.x + a.width);
    expect(bends[0].x).toBeLessThan(t.x);
  });
  it('routes feedback under the row and leaves the bottom of its source', () => {
    const s = { template: 'flow', nodes: [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2)], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a', label: 'retry' }] };
    const l = flowLayout(s, quiet);
    const sec = edgeTo(l, s, 'c', 'a').sections[0];
    const c = l.nodes.find(n => n.id === 'c');
    expect(sec.bendPoints).toHaveLength(2);
    expect(sec.bendPoints[0].y).toBe(sec.bendPoints[1].y);
    expect(sec.bendPoints[0].y).toBeGreaterThan(c.y + c.height);
    expect(sec.startPoint.y).toBeCloseTo(c.y + c.height, 6);
    expect(checkCollisions(draw(l, s, quiet).geometry)).toEqual([]);
  });
  it('draws an edge into the next column on the left as a straight line', () => {
    const s = { template: 'flow', nodes: [card('uc', 0, 1), card('actor', 0, 2, { kind: 'actor' })], edges: [{ from: 'actor', to: 'uc', label: 'approves' }] };
    const l = flowLayout(s, quiet);
    const sec = l.edges[0].sections[0];
    expect(sec.bendPoints).toEqual([]);
    const uc = l.nodes.find(n => n.id === 'uc');
    expect(sec.endPoint.x).toBeCloseTo(uc.x + uc.width, 6);
  });
  it('routes a same-row skip over the card in between', () => {
    const s = { template: 'flow', nodes: [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2)], edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }] };
    const l = flowLayout(s, quiet);
    const sec = edgeTo(l, s, 'a', 'c').sections[0];
    const b = l.nodes.find(n => n.id === 'b');
    expect(passesThrough(sec, b)).toBe(false);
    expect(sec.bendPoints.length).toBeLessThanOrEqual(2);
  });
  it('builds one trunk for three targets in one column', () => {
    const s = { template: 'flow', nodes: [card('s', 1, 0), card('t1', 0, 1), card('t2', 1, 1), card('t3', 2, 1)],
      edges: ['t1', 't2', 't3'].map(t => ({ from: 's', to: t })) };
    const l = flowLayout(s, quiet);
    expect(l.trunks).toHaveLength(2);
    for (const e of l.edges) expect(e.sections[0].bendPoints).toEqual([]);
    for (const t of l.trunks) expect(t.main).toBe(false);
  });
  it('merges three sources in one column into one trunk', () => {
    const s = { template: 'flow', nodes: [card('s1', 0, 0), card('s2', 1, 0), card('s3', 2, 0), card('t', 1, 1)],
      edges: ['s1', 's2', 's3'].map(f => ({ from: f, to: 't', style: 'dashed' })) };
    const l = flowLayout(s, quiet);
    expect(l.trunks).toHaveLength(2);
    for (const e of l.edges) expect(e.sections[0].bendPoints).toEqual([]);
    const t = l.nodes.find(n => n.id === 't');
    const trunkX = l.edges[0].sections[0].endPoint.x;
    for (const e of l.edges) {
      expect(e.sections[0].endPoint.x).toBe(trunkX);
      expect(e.arrow).toBe(false);
    }
    expect(trunkX).toBeLessThan(t.x);
    const stem = l.trunks.find(s => s.endMarker === 'arrow');
    expect(stem.endPoint).toEqual({ x: t.x, y: t.y + t.height / 2 });
    expect(stem.dashed).toBe(true);
  });
  it('spreads two edges leaving one side 12 units apart', () => {
    const s = { template: 'flow', nodes: [card('s', 1, 0), card('a', 1, 1), card('block', 2, 0), card('b', 2, 2)],
      edges: [{ from: 's', to: 'a' }, { from: 's', to: 'b' }, { from: 'block', to: 'b' }] };
    const l = flowLayout(s, quiet);
    const ys = [edgeTo(l, s, 's', 'a'), edgeTo(l, s, 's', 'b')].map(e => e.sections[0].startPoint.y).sort((m, n) => m - n);
    expect(ys[1] - ys[0]).toBeCloseTo(12, 6);
  });
});

import { lintLayout } from '../skills/i-cant-draw/scripts/layout-lint.mjs';
const rules = findings => [...new Set(findings.map(f => f.rule))];

describe('flowLayout: review fixes', () => {
  it('breaks a cycle without dropping edges outside it', () => {
    const s = { template: 'flow', nodes: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, label: id.toUpperCase() })),
      edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'd', to: 'e' }] };
    const l = flowLayout(s, quiet);
    const n = id => l.nodes.find(x => x.id === id);
    expect(n('e').x).toBeGreaterThan(n('d').x);
    expect(n('d').y + n('d').height / 2).toBeCloseTo(n('e').y + n('e').height / 2, 6);
  });
  it('routes a same-column skip around the card in between', () => {
    const s = { template: 'flow', nodes: [card('a', 0, 0), card('x', 1, 0), card('b', 2, 0)], edges: [{ from: 'a', to: 'b' }] };
    const l = flowLayout(s, quiet);
    expect(lintLayout(l, s)).toEqual([]);
  });
  it('spreads a same-column edge with the other edges on its side', () => {
    const s = { template: 'flow', nodes: [card('s', 0, 0), card('t', 1, 1), card('d', 3, 0)], edges: [{ from: 's', to: 't' }, { from: 's', to: 'd' }] };
    const l = flowLayout(s, quiet);
    const xs = [edgeTo(l, s, 's', 't'), edgeTo(l, s, 's', 'd')].map(e => e.sections[0].startPoint.x).sort((m, n) => m - n);
    expect(xs[1] - xs[0]).toBeCloseTo(12, 6);
  });
  it('reserves room above a row for an over-the-top detour and its label', () => {
    for (const row of [0, 1]) {
      const nodes = [card('a', row, 0), card('b', row, 1), card('c', row, 2)];
      if (row === 1) nodes.push(card('q', 0, 1));
      const s = { template: 'flow', nodes, edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c', label: 'skip ahead' }] };
      const l = flowLayout(s, quiet);
      const label = edgeTo(l, s, 'a', 'c').labels[0];
      expect(label.y, `row ${row}`).toBeGreaterThanOrEqual(0);
      expect(checkCollisions(draw(l, s, quiet).geometry), `row ${row}`).toEqual([]);
    }
  });
  it('flags fan-in stubs that run in line with fan-out branches', () => {
    const s = { template: 'flow', nodes: [card('s', 0, 0), card('b1', 1, 0), card('b2', 2, 0), card('b3', 3, 0), card('t1', 1, 1), card('t2', 2, 1), card('t3', 3, 1)],
      edges: [...['t1', 't2', 't3'].map(t => ({ from: 's', to: t })), ...['b1', 'b2', 'b3'].map(b => ({ from: b, to: 't1' }))] };
    expect(rules(lintLayout(flowLayout(s, quiet), s))).toContain('edge-overlap');
  });
  it('keeps fan-in and fan-out trunks into one column apart', () => {
    const s = { template: 'flow', nodes: [card('s', 3, 0), card('b1', 0, 0), card('b2', 1, 0), card('b3', 2, 0), card('t1', 0, 1), card('t2', 1, 1), card('t3', 2, 1)],
      edges: [...['t1', 't2', 't3'].map(t => ({ from: 's', to: t })), ...['b1', 'b2', 'b3'].map(b => ({ from: b, to: 't1' }))] };
    const l = flowLayout(s, quiet);
    expect(lintLayout(l, s).filter(f => f.rule === 'trunk-overlap')).toEqual([]);
    expect(checkCollisions(draw(l, s, quiet).geometry)).toEqual([]);
  });
  it('gives fan branch labels room', () => {
    const s = { template: 'flow', nodes: [card('s', 1, 0), card('t1', 0, 1), card('t2', 1, 1), card('t3', 2, 1)],
      edges: [{ from: 's', to: 't1', label: 'high priority work' }, { from: 's', to: 't2' }, { from: 's', to: 't3' }] };
    const l = flowLayout(s, quiet);
    expect(checkCollisions(draw(l, s, quiet).geometry)).toEqual([]);
  });
});

describe('flowLayout: leftward labels', () => {
  it('sizes the gap for a labelled edge into the next column on the left', () => {
    const s = { template: 'flow', nodes: [card('uc', 0, 0), card('actor', 0, 1, { kind: 'actor' })],
      edges: [{ from: 'actor', to: 'uc', label: 'reads, then approves' }] };
    const l = flowLayout(s, quiet);
    const uc = l.nodes.find(n => n.id === 'uc'), actor = l.nodes.find(n => n.id === 'actor');
    expect(actor.x - (uc.x + uc.width)).toBeGreaterThanOrEqual(quiet.measure('reads, then approves', 13) + 58);
  });
});

describe('flowLayout: row alignment', () => {
  const table = (id, n, c) => ({ id, kind: 'table', label: id, row: 0, col: c, columns: Array.from({ length: n }, (_, i) => ({ name: `c${i}`, type: 'text' })) });
  const twoTables = { template: 'flow', nodes: [table('a', 2, 0), table('b', 6, 1)], edges: [] };
  it('centres cards of different heights in a row by default', () => {
    const l = flowLayout(twoTables, quiet), a = l.nodes[0], b = l.nodes[1];
    expect(a.y + a.height / 2).toBe(b.y + b.height / 2);
  });
  it('aligns their tops with rowAlign top, and carries each card\'s rows', () => {
    const l = flowLayout(twoTables, quiet, { rowAlign: 'top' }), a = l.nodes[0], b = l.nodes[1];
    expect(a.y).toBe(b.y);
    expect(b.rows).toHaveLength(6);
  });
});

describe('flowLayout: state machines', () => {
  const spec = JSON.parse(readFileSync(new URL('../evals/state-build/spec.json', import.meta.url)));
  const l = flowLayout(spec, quiet);
  const at = id => l.nodes.find(n => n.id === id);
  const edgeOf = (from, to) => l.edges.find(e => spec.edges[e.index].from === from && spec.edges[e.index].to === to);
  it('routes a self-loop on the top edge, with its label inside the zone', () => {
    const run = at('running'), loop = edgeOf('running', 'running').sections[0];
    expect(loop.startPoint).toEqual({ x: run.x + run.width * 0.1, y: run.y });
    expect(loop.endPoint).toEqual({ x: run.x + run.width * 0.4, y: run.y });
    const zone = l.groups.find(g => g.id === 'working');
    expect(zone.y + 30).toBeLessThan(edgeOf('running', 'running').labels[0].y);
  });
  it('sets a transition each way 60 apart, with labels on their outer sides', () => {
    const down = edgeOf('running', 'blocked'), up = edgeOf('blocked', 'running');
    const dx = down.sections[0].startPoint.x, ux = up.sections[0].startPoint.x;
    expect(ux - dx).toBe(60);
    expect(down.labels[0].x + down.labels[0].width).toBeLessThan(dx);
    expect(up.labels[0].x).toBeGreaterThan(ux);
  });
  it('passes the contract', () => {
    expect(() => assertLayout(l)).not.toThrow();
  });
});

describe('flowLayout: loop-back lines under a zone', () => {
  const card = (id, row, col) => ({ id, label: id.toUpperCase(), row, col });
  const inside = { template: 'flow', nodes: [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2)],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a', label: 'one more round' }],
    groups: [{ id: 'z', label: 'Zone', contains: ['a', 'b', 'c'], tone: 'blue' }] };
  const across = { template: 'flow', nodes: [card('a', 0, 0), card('b', 0, 1), card('c', 0, 2), card('d', 0, 3)],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd' }, { from: 'd', to: 'a', label: 'fix it once' }],
    groups: [{ id: 'z', label: 'Zone', contains: ['b', 'c'], tone: 'blue' }] };
  for (const [name, spec] of [['inside the zone', inside], ['passing through the zone', across]]) {
    it(`keeps the label clear of the zone border, ${name}`, () => {
      const l = flowLayout(spec, quiet);
      const z = l.groups.find(g => g.id === 'z');
      const label = l.edges.find(e => spec.edges[e.index].label).labels[0];
      expect(z.y + z.height - (label.y + label.height)).toBeGreaterThanOrEqual(8);
    });
  }
});


describe('flowLayout: straight lines between top-aligned cards', () => {
  const table = (id, n, c) => ({ id, kind: 'table', label: id, row: 0, col: c, columns: Array.from({ length: n }, (_, i) => ({ name: `c${i}`, type: 'text' })) });
  const spec = { template: 'flow', nodes: [table('a', 2, 0), table('b', 6, 1), table('c', 4, 2)], edges: [{ from: 'a', to: 'b' }, { from: 'c', to: 'b' }] };
  it('runs every same-row line at one height inside the shortest card', () => {
    const l = flowLayout(spec, quiet, { rowAlign: 'top' }), a = l.nodes[0];
    const ys = l.edges.flatMap(e => [e.sections[0].startPoint.y, e.sections[0].endPoint.y]);
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBe(a.y + a.height / 2);
  });
});

describe('flowLayout decisions', () => {
  const evalSpec = name => JSON.parse(readFileSync(new URL(`../evals/${name}/spec.json`, import.meta.url)));
  for (const name of ['ci-pipeline', 'research-agents']) {
    for (const styleName of ['quiet', 'crayon']) {
      it(`centres each diamond in its cell and meets its points in ${name} (${styleName})`, () => {
        const decisionSpec = evalSpec(name);
        const decisionLayout = flowLayout(decisionSpec, loadStyle(styleName));
        const box = id => decisionLayout.nodes.find(n => n.id === id);
        for (const d of decisionSpec.nodes.filter(n => n.kind === 'decision')) {
          const diamond = box(d.id);
          const neighbours = decisionSpec.nodes.filter(n => n.col === d.col && n.id !== d.id).map(n => box(n.id));
          for (const n of neighbours) expect(diamond.x + diamond.width / 2).toBeCloseTo(n.x + n.width / 2, 5);
          const cx = diamond.x + diamond.width / 2, cy = diamond.y + diamond.height / 2;
          const points = [{ x: cx, y: diamond.y }, { x: diamond.x + diamond.width, y: cy }, { x: cx, y: diamond.y + diamond.height }, { x: diamond.x, y: cy }];
          decisionSpec.edges.forEach((e, index) => {
            const section = decisionLayout.edges.find(x => x.index === index).sections[0];
            const ends = [...(e.from === d.id ? [section.startPoint] : []), ...(e.to === d.id ? [section.endPoint] : [])];
            for (const end of ends) expect(points, `${e.from}→${e.to}`).toContainEqual(end);
          });
        }
      });
    }
  }
});
