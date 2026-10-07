import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { hubLayout } from '../scripts/templates/hub.mjs';
import { assertLayout } from '../scripts/layout-contract.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';
import { draw } from '../scripts/render/draw.mjs';

const quiet = loadStyle('quiet');
const spec = JSON.parse(readFileSync(new URL('./fixtures/hub-deployment.json', import.meta.url)));
const layout = hubLayout(spec, quiet);
const node = id => layout.nodes.find(n => n.id === id);
const group = id => layout.groups.find(g => g.id === id);
const cy = b => b.y + b.height / 2;
const cx = b => b.x + b.width / 2;
const contains = (outer, inner, pad = 0) => inner.x >= outer.x + pad && inner.y >= outer.y + pad
  && inner.x + inner.width <= outer.x + outer.width - pad && inner.y + inner.height <= outer.y + outer.height - pad;
const overlaps = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

function membersOf(id) {
  const g = spec.groups.find(x => x.id === id);
  return g ? g.contains.flatMap(membersOf) : [id];
}

describe('hubLayout: centre and stacks', () => {
  it('meets the Layout contract', () => {
    expect(() => assertLayout(layout)).not.toThrow();
  });
  it('gives each labelled group a title box where draw puts a title without one', () => {
    const titles = l => draw(l, spec, quiet).geometry.filter(g => g.kind === 'group-label');
    const bare = { ...layout, groups: layout.groups.map(({ titleBox, ...rest }) => rest) };
    expect(layout.groups.filter(g => g.titleBox).length).toBe(spec.groups.filter(g => g.label).length);
    expect(titles(layout)).toEqual(titles(bare));
  });
  it('stacks the left side at one width and x, centred on the hub', () => {
    const left = spec.slots.left.map(node);
    expect(new Set(left.map(n => n.width)).size).toBe(1);
    expect(new Set(left.map(n => n.x)).size).toBe(1);
    const gaps = left.slice(1).map((n, i) => cy(n) - cy(left[i]));
    expect(gaps[0]).toBeCloseTo(gaps[1], 6);
    expect(cy(left[1])).toBeCloseTo(cy(node('shortener')), 6);
  });
  it('gives every side card one width', () => {
    const sideCards = ['left', 'right', 'top'].flatMap(side => spec.slots[side]).map(node);
    expect(new Set(sideCards.map(n => n.width)).size).toBe(1);
  });
  it('centres the right stack on the hub', () => {
    const right = spec.slots.right.map(node);
    expect((cy(right[0]) + cy(right[1])) / 2).toBeCloseTo(cy(node('shortener')), 6);
  });
  it('puts the bucket above the VM box on the hub centre line', () => {
    expect(cx(node('bucket'))).toBeCloseTo(cx(node('shortener')), 6);
    expect(node('bucket').y + node('bucket').height).toBeLessThan(group('vm').y);
  });
  it('nests the container in the VM with padding, and the account holds its members', () => {
    expect(contains(group('vm'), group('container'), quiet.spacing.groupPad)).toBe(true);
    expect(contains(group('container'), node('shortener'), quiet.spacing.groupPad)).toBe(true);
    for (const id of ['managed', 'data', 'vm']) expect(contains(group('account'), group(id)), id).toBe(true);
    expect(contains(group('account'), node('bucket'))).toBe(true);
  });
  it('never lets a group box cover a card outside it', () => {
    for (const g of layout.groups) {
      const members = new Set(membersOf(g.id));
      for (const n of layout.nodes) if (!members.has(n.id)) expect(overlaps(g, n), `${g.id} covers ${n.id}`).toBe(false);
    }
  });
  it('names the hub card', () => {
    expect(layout.hubId).toBe('shortener');
  });
});

import { boxDistanceToSection } from '../scripts/templates/route.mjs';
import { draw } from '../scripts/render/draw.mjs';
import { checkCollisions } from '../scripts/collision-check.mjs';

describe('hubLayout: routes and labels', () => {
  const routed = hubLayout(spec, quiet);
  const card = id => routed.nodes.find(n => n.id === id);
  it('routes every edge with no bends', () => {
    expect(routed.edges).toHaveLength(spec.edges.length);
    for (const e of routed.edges) for (const s of e.sections) expect(s.bendPoints, spec.edges[e.index].to).toEqual([]);
  });
  it('adds a stem and a trunk for each side with two or more cards', () => {
    expect(routed.trunks).toHaveLength(4);
    for (const t of routed.trunks) expect(typeof t.main).toBe('boolean');
    expect(routed.trunks.some(t => t.main)).toBe(true);
  });
  it('ends every left branch on the right side of its card', () => {
    for (const e of routed.edges) {
      const se = spec.edges[e.index];
      if (!spec.slots.left.includes(se.to)) continue;
      const n = card(se.to);
      expect(e.sections[0].endPoint.x).toBeCloseTo(n.x + n.width, 6);
    }
  });
  it('keeps every label within 24 units of its own line', () => {
    for (const e of routed.edges) for (const l of e.labels) {
      expect(boxDistanceToSection(l, e.sections[0]), l.text).toBeLessThanOrEqual(24);
    }
  });
  it('never puts a label across a group border', () => {
    for (const e of routed.edges) for (const l of e.labels) for (const g of routed.groups) {
      const straddlesX = (l.x < g.x && l.x + l.width > g.x) || (l.x < g.x + g.width && l.x + l.width > g.x + g.width);
      const straddlesY = (l.y < g.y && l.y + l.height > g.y) || (l.y < g.y + g.height && l.y + l.height > g.y + g.height);
      const withinY = l.y + l.height > g.y && l.y < g.y + g.height;
      const withinX = l.x + l.width > g.x && l.x < g.x + g.width;
      expect((straddlesX && withinY) || (straddlesY && withinX), `${l.text} on ${g.id}`).toBe(false);
    }
  });
  it('draws with zero collisions', () => {
    expect(checkCollisions(draw(routed, spec, quiet).geometry)).toEqual([]);
  });
});

describe('hubLayout edge cases', () => {
  it('lays out a hub with no edges', () => {
    const bare = { template: 'hub', slots: { center: 'core', left: ['l'] }, nodes: [{ id: 'core', label: 'Core' }, { id: 'l', label: 'L' }] };
    expect(() => assertLayout(hubLayout(bare, quiet))).not.toThrow();
  });
});

import { lintLayout } from '../scripts/layout-lint.mjs';

describe('hubLayout: review fixes', () => {
  const hubSpec = (slots, extraEdges = []) => {
    const ids = Object.values(slots).flat();
    return { template: 'hub', slots: { center: 'core', ...slots },
      nodes: [{ id: 'core', label: 'Core system' }, ...ids.map(id => ({ id, label: `Service ${id}` }))],
      edges: [...ids.map(id => ({ from: 'core', to: id })), ...extraEdges] };
  };
  it('keeps top and bottom stacks clear of tall side stacks', () => {
    const s = hubSpec({ left: ['l0', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6'], right: ['r0', 'r1'], top: ['t0', 't1', 't2', 't3', 't4'], bottom: ['b0', 'b1', 'b2'] });
    const l = hubLayout(s, quiet);
    expect(checkCollisions(draw(l, s, quiet).geometry)).toEqual([]);
    expect(lintLayout(l, s)).toEqual([]);
    const lowestSide = Math.max(...s.slots.left.map(id => l.nodes.find(n => n.id === id)).map(n => n.y + n.height));
    for (const id of s.slots.bottom) expect(l.nodes.find(n => n.id === id).y, id).toBeGreaterThan(lowestSide);
  });
  it('gives a labelled neighbour edge room in its stack', () => {
    const s = hubSpec({ top: ['t1', 't2'] }, [{ from: 't1', to: 't2', label: 'sync' }]);
    const l = hubLayout(s, quiet);
    expect(checkCollisions(draw(l, s, quiet).geometry)).toEqual([]);
  });
});

describe('hubLayout: one edge on a side', () => {
  const spec = { template: 'hub', slots: { center: 'core', left: ['user', 'front'], right: ['store'] },
    nodes: [{ id: 'core', label: 'Core' }, { id: 'user', label: 'User app' }, { id: 'front', label: 'Front service' }, { id: 'store', label: 'Store' }],
    edges: [{ from: 'user', to: 'front' }, { from: 'front', to: 'core', label: 'requests' }, { from: 'core', to: 'store' }] };
  const l = hubLayout(spec, quiet);
  const core = l.nodes.find(n => n.id === 'core');
  it('draws a lone incoming edge as one path that ends at the hub, with no trunk on that side', () => {
    const e = l.edges.find(x => spec.edges[x.index].from === 'front');
    const s = e.sections[0];
    expect(e.sections).toHaveLength(1);
    expect(s.endPoint).toEqual({ x: core.x, y: core.y + core.height / 2 });
    expect(s.bendPoints.length).toBeLessThanOrEqual(2);
    expect(l.trunks.filter(t => Math.max(t.startPoint.x, t.endPoint.x) <= core.x)).toEqual([]);
  });
});

describe('hubLayout: several edges into the hub from one side', () => {
  const spec = { template: 'hub', slots: { center: 'core', left: ['web', 'mobile'], right: ['store'] },
    nodes: [{ id: 'core', label: 'Core' }, { id: 'web', label: 'Web app' }, { id: 'mobile', label: 'Mobile app' }, { id: 'store', label: 'Store' }],
    edges: [{ from: 'web', to: 'core', label: 'HTTPS' }, { from: 'mobile', to: 'core', label: 'HTTPS' }, { from: 'core', to: 'store' }] };
  const l = hubLayout(spec, quiet);
  const core = l.nodes.find(n => n.id === 'core');
  it('puts one arrow on the stem into the hub, and none on the branches', () => {
    for (const e of l.edges.filter(x => spec.edges[x.index].to === 'core')) expect(e.arrow).toBe(false);
    const stem = l.trunks.find(t => t.endMarker === 'arrow');
    expect(stem.endPoint).toEqual({ x: core.x, y: core.y + core.height / 2 });
  });
});

describe('hubLayout: two-way edges on a trunked side', () => {
  const spec = { template: 'hub', slots: { center: 'core', right: ['a', 'b'] },
    nodes: [{ id: 'core', label: 'Core' }, { id: 'a', label: 'Index A' }, { id: 'b', label: 'Index B' }],
    edges: [{ from: 'core', to: 'a', both: true }, { from: 'core', to: 'b' }] };
  const l = hubLayout(spec, quiet);
  it('keeps the arrow at the card, drops the one at the trunk, and arrows the stem into the hub', () => {
    const e = l.edges.find(x => spec.edges[x.index].to === 'a');
    expect(e.sections[0].startMarker).toBe('none');
    expect(l.trunks.some(t => t.endMarker === 'arrow')).toBe(true);
  });
});

describe('hubLayout: centre group titles and the top stem', () => {
  const centred = (groups, top) => ({ template: 'hub', slots: { center: groups[0].id, top, left: ['l'] },
    nodes: [{ id: 'core', label: 'Core' }, { id: 'l', label: 'Left' }, ...top.map(id => ({ id, label: `Service ${id}` }))],
    edges: [{ from: 'core', to: 'l' }, ...top.map(id => ({ from: 'core', to: id }))], groups });
  const shards = { id: 'shards', label: 'Ringpop: sharded across workers', contains: ['core'] };
  it('widens a centre group until its title ends short of the stem', () => {
    for (const s of [centred([shards], ['t0']), centred([{ id: 'cluster', label: 'Kubernetes cluster in the private subnet', contains: ['shards'] }, shards], ['t0', 't1'])]) {
      const l = hubLayout(s, quiet);
      const core = l.nodes.find(n => n.id === 'core');
      for (const g of l.groups) expect(g.titleBox.x + g.titleBox.width, g.id).toBeLessThan(cx(core));
      expect(lintLayout(l, s)).toEqual([]);
      expect(checkCollisions(draw(l, s, quiet).geometry)).toEqual([]);
    }
  });
  it('keeps the usual group width when no stem leaves the top', () => {
    const l = hubLayout(centred([shards], []), quiet);
    expect(l.groups[0].width).toBe(l.nodes.find(n => n.id === 'core').width + 2 * quiet.spacing.groupPad);
  });
});
