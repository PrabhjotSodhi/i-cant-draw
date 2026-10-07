import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { classLayout } from '../scripts/templates/class.mjs';
import { assertLayout } from '../scripts/layout-contract.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';
import { runPipeline } from '../scripts/pipeline.mjs';
import { lintLayout } from '../scripts/layout-lint.mjs';

const quiet = loadStyle('quiet');
const cls = (id, row, col, extra = {}) => ({ id, kind: 'class', label: id[0].toUpperCase() + id.slice(1), row, col, attributes: ['id: string'], methods: ['save()'], ...extra });

const shop = () => ({
  template: 'class',
  nodes: [
    cls('order', 0, 0, { attributes: ['id: string', 'total: Money', 'placedAt: Date'] }),
    cls('payment', 0, 2, { stereotype: 'abstract', attributes: [] }),
    cls('card', 1, 1), cls('bank', 1, 2), cls('wallet', 1, 3),
  ],
  edges: [
    { from: 'order', to: 'payment', label: 'pays with', multiplicity: ['1', '1..*'] },
    { from: 'card', to: 'payment', relation: 'inherits', label: 'is a kind of' },
    { from: 'bank', to: 'payment', relation: 'inherits', label: 'is a kind of' },
    { from: 'wallet', to: 'payment', relation: 'inherits', label: 'is a kind of' },
  ],
  groups: [
    { id: 'orders', label: 'Orders', contains: ['order'], tone: 'blue' },
    { id: 'payments', label: 'Payments', contains: ['payment', 'card', 'bank', 'wallet'], tone: 'orange' },
  ],
});

const layoutOf = (spec) => classLayout(spec, quiet);
const at = (l, id) => l.nodes.find(n => n.id === id);
const edgeOf = (l, spec, from) => l.edges.find(e => spec.edges[e.index].from === from);
const sectionsOf = (l) => l.edges.flatMap(e => e.sections);

describe('classLayout: inheritance', () => {
  const spec = shop(), l = layoutOf(spec);
  it('meets the Layout contract and keeps every edge index', () => {
    expect(() => assertLayout(l)).not.toThrow();
    expect(l.edges.map(e => e.index).sort()).toEqual([0, 1, 2, 3]);
  });
  it('aligns every card in a row on its top edge', () => {
    expect(at(l, 'order').y).toBe(at(l, 'payment').y);
    expect(new Set(['card', 'bank', 'wallet'].map(id => at(l, id).y)).size).toBe(1);
  });
  it('draws one hollow triangle, at the bottom centre of the parent', () => {
    const triangles = sectionsOf(l).filter(s => s.endMarker === 'triangle');
    const parent = at(l, 'payment');
    expect(triangles).toHaveLength(1);
    expect(triangles[0].endPoint).toEqual({ x: parent.x + parent.width / 2, y: parent.y + parent.height });
  });
  it('joins every child to one bar from the top centre of the child', () => {
    const branches = ['card', 'bank', 'wallet'].map(id => edgeOf(l, spec, id).sections[0]);
    const barY = branches[0].endPoint.y;
    for (const [k, id] of ['card', 'bank', 'wallet'].entries()) {
      const child = at(l, id);
      expect(branches[k].startPoint).toEqual({ x: child.x + child.width / 2, y: child.y });
      expect(branches[k].endPoint.y).toBe(barY);
      expect(branches[k].endMarker).toBe('none');
    }
    const bars = sectionsOf(l).filter(s => s.startPoint.y === barY && s.endPoint.y === barY && s.startPoint.x !== s.endPoint.x);
    expect(bars).toHaveLength(1);
    expect(bars[0].startPoint.x).toBe(at(l, 'card').x + at(l, 'card').width / 2);
    expect(bars[0].endPoint.x).toBe(at(l, 'wallet').x + at(l, 'wallet').width / 2);
  });
  it('labels the stem once, beside it', () => {
    const labels = l.edges.flatMap(e => e.labels).filter(x => x.text === 'is a kind of');
    const parent = at(l, 'payment');
    expect(labels).toHaveLength(1);
    expect(labels[0].x).toBeGreaterThan(parent.x + parent.width / 2);
    expect(labels[0].y).toBeGreaterThan(parent.y + parent.height);
  });
  it('draws a single child in the same column as one straight line with the triangle', () => {
    const one = shop();
    one.nodes = one.nodes.filter(n => !['card', 'wallet'].includes(n.id));
    one.edges = one.edges.filter(e => !['card', 'wallet'].includes(e.from));
    one.groups[1].contains = ['payment', 'bank'];
    const single = layoutOf(one);
    const sections = edgeOf(single, one, 'bank').sections, parent = at(single, 'payment'), child = at(single, 'bank');
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ startPoint: { x: child.x + child.width / 2, y: child.y }, endPoint: { x: parent.x + parent.width / 2, y: parent.y + parent.height }, bendPoints: [], endMarker: 'triangle' });
  });
  it('asks for every child in one row below the parent', () => {
    const split = shop(); split.nodes.find(n => n.id === 'wallet').row = 2;
    expect(() => layoutOf(split)).toThrow(/children of "payment" sit in different rows/);
    const above = shop(); above.nodes.find(n => n.id === 'payment').row = 2;
    expect(() => layoutOf(above)).toThrow(/put the children of "payment" in a row below it/);
  });
});

describe('classLayout: uses and multiplicity', () => {
  const spec = shop(), l = layoutOf(spec);
  const uses = edgeOf(l, spec, 'order'), line = uses.sections[0];
  it('keeps a line between cards of different heights in one row straight, inside both cards', () => {
    const order = at(l, 'order'), payment = at(l, 'payment');
    expect(order.height).not.toBe(payment.height);
    expect(line.bendPoints).toEqual([]);
    expect(line.startPoint.y).toBe(line.endPoint.y);
    for (const card of [order, payment]) expect(line.startPoint.y).toBeLessThan(card.y + card.height);
  });
  it('leaves the arrowhead to the default marker', () => {
    expect(line.endMarker).toBeUndefined();
  });
  it('puts the multiplicities below the line at each end and the label above', () => {
    const [start, end] = uses.endLabels;
    expect(start).toMatchObject({ text: '1', end: 'start' });
    expect(end).toMatchObject({ text: '1..*', end: 'end' });
    expect(start.x).toBeGreaterThan(line.startPoint.x);
    expect(end.x + end.width).toBeLessThan(line.endPoint.x);
    for (const m of [start, end]) expect(m.y).toBeGreaterThan(line.startPoint.y);
    expect(uses.labels[0].y + uses.labels[0].height).toBeLessThan(line.startPoint.y);
  });
  it('keeps each multiplicity inside the zone its end sits in', () => {
    const [start, end] = uses.endLabels;
    const orders = l.groups.find(g => g.id === 'orders'), payments = l.groups.find(g => g.id === 'payments');
    expect(start.x + start.width).toBeLessThan(orders.x + orders.width);
    expect(end.x).toBeGreaterThan(payments.x);
  });
});

describe('classLayout: a uses line into a parent', () => {
  const pieces = (extra) => ({
    template: 'class',
    nodes: [cls('game', 0, 0), cls('piece', 1, 1, { stereotype: 'abstract' }), ...extra.children.map((id, k) => cls(id, 2, 2 * k)), ...extra.nodes],
    edges: [
      { from: 'game', to: 'piece', label: 'holds' },
      ...extra.children.map(id => ({ from: id, to: 'piece', relation: 'inherits' })),
      ...extra.edges,
    ],
  });
  const cases = {
    'up and to the right': { children: ['king', 'pawn'], nodes: [cls('move', 0, 2)], edges: [{ from: 'move', to: 'piece', label: 'moves', multiplicity: ['0..*', '1'] }] },
    'in its row, two columns right': { children: ['king', 'pawn'], nodes: [cls('square', 1, 3)], edges: [{ from: 'square', to: 'piece', label: 'holds' }] },
    'below and to the right': { children: ['king', 'pawn'], nodes: [cls('capture', 3, 3)], edges: [{ from: 'capture', to: 'piece', label: 'takes' }] },
    'directly below, between its children': { children: ['king', 'pawn'], nodes: [cls('square', 2, 1)], edges: [{ from: 'square', to: 'piece', label: 'rests on' }] },
  };
  for (const [name, extra] of Object.entries(cases)) {
    it(`enters the parent's right side from a class ${name}, never its bottom`, () => {
      const spec = pieces(extra), l = layoutOf(spec), parent = at(l, 'piece');
      const uses = edgeOf(l, spec, extra.nodes[0].id).sections;
      const end = uses[uses.length - 1].endPoint;
      expect(end.x).toBe(parent.x + parent.width);
      expect(end.y).toBeGreaterThan(parent.y);
      expect(end.y).toBeLessThan(parent.y + parent.height);
      expect(lintLayout(l, spec)).toEqual([]);
    });
  }
  it('goes over the top into a parent in its row when a class sits between them', () => {
    const spec = pieces({ children: ['king', 'pawn'], nodes: [cls('board', 1, 2), cls('square', 1, 3)], edges: [{ from: 'square', to: 'piece', label: 'holds' }] });
    const l = layoutOf(spec), parent = at(l, 'piece');
    const end = edgeOf(l, spec, 'square').sections[0].endPoint;
    expect(end.y).toBe(parent.y);
    expect(lintLayout(l, spec)).toEqual([]);
  });
});

describe('runPipeline class template', () => {
  for (const style of ['quiet', 'crayon', 'riso', 'whiteboard', 'notebook', 'watercolour']) {
    it(`renders in ${style} with zero collisions and a clean lint`, async () => {
      const dir = mkdtempSync(join(tmpdir(), 'diag-'));
      const r = await runPipeline({ ...shop(), style }, { outputDir: dir, baseName: 'class' });
      expect(r.collisions).toEqual([]);
      expect(r.lint).toEqual([]);
    });
  }
});
