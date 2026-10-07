import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { schemaLayout } from '../scripts/templates/schema.mjs';
import { assertLayout } from '../scripts/layout-contract.mjs';
import { lintLayout } from '../scripts/layout-lint.mjs';
import { straight, boxDistanceToSection } from '../scripts/templates/route.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';

const quiet = loadStyle('quiet');
const column = (name, type, key) => ({ name, type, ...(key ? { key } : {}) });
const shop = () => ({
  template: 'schema',
  nodes: [
    { id: 'users', kind: 'table', label: 'users', row: 0, col: 0, columns: [column('id', 'bigint', 'PK'), column('email', 'text'), column('name', 'text')] },
    { id: 'orders', kind: 'table', label: 'orders', row: 0, col: 1, columns: [column('id', 'bigint', 'PK'), column('user_id', 'bigint', 'FK'), column('billing_address_id', 'bigint', 'FK'), column('shipping_address_id', 'bigint', 'FK')] },
    { id: 'addresses', kind: 'table', label: 'addresses', row: 0, col: 2, columns: [column('id', 'bigint', 'PK'), column('street', 'text')] },
    { id: 'profiles', kind: 'table', label: 'profiles', row: 1, col: 0, columns: [column('user_id', 'bigint', 'PK'), column('bio', 'text')] },
    { id: 'categories', kind: 'table', label: 'categories', row: 1, col: 2, columns: [column('id', 'bigint', 'PK'), column('parent_id', 'bigint', 'FK')] },
  ],
  edges: [
    { from: 'orders', fromColumn: 'user_id', to: 'users', toColumn: 'id', ends: ['many', 'one'], label: 'places' },
    { from: 'orders', fromColumn: 'billing_address_id', to: 'addresses', toColumn: 'id', ends: ['many', 'one'], label: 'billed to' },
    { from: 'orders', fromColumn: 'shipping_address_id', to: 'addresses', toColumn: 'id', ends: ['many', 'one'], label: 'shipped to' },
    { from: 'profiles', fromColumn: 'user_id', to: 'users', toColumn: 'id', ends: ['one', 'one'] },
    { from: 'categories', fromColumn: 'parent_id', to: 'categories', toColumn: 'id', ends: ['many', 'one'], label: 'parent' },
  ],
  groups: [{ id: 'sales', label: 'Sales', contains: ['orders', 'addresses'], tone: 'blue' }],
});
const portY = (layout, id, name, spec) => {
  const node = layout.nodes.find(n => n.id === id);
  const index = spec.nodes.find(n => n.id === id).columns.findIndex(c => c.name === name);
  return node.y + node.rows[index].y;
};

describe('schemaLayout', () => {
  const spec = shop();
  const layout = schemaLayout(spec, quiet);
  const node = (id) => layout.nodes.find(n => n.id === id);
  const section = (i) => layout.edges.find(e => e.index === i).sections[0];

  it('meets the Layout contract and aligns each row on its top edge', () => {
    expect(() => assertLayout(layout)).not.toThrow();
    expect(node('users').y).toBe(node('orders').y);
    expect(node('orders').y).toBe(node('addresses').y);
    expect(node('profiles').y).toBe(node('categories').y);
  });
  it('starts and ends each line at its column rows on facing sides', () => {
    const s = section(0);
    expect(s.startPoint).toEqual({ x: node('orders').x, y: portY(layout, 'orders', 'user_id', spec) });
    expect(s.endPoint).toEqual({ x: node('users').x + node('users').width, y: portY(layout, 'users', 'id', spec) });
  });
  it('bends a Z in the middle of the column gap', () => {
    const s = section(0);
    const middle = (node('users').x + node('users').width + node('orders').x) / 2;
    expect(s.bendPoints).toHaveLength(2);
    expect(s.bendPoints[0].x).toBe(s.bendPoints[1].x);
    expect(Math.abs(s.bendPoints[0].x - middle)).toBeLessThanOrEqual(16);
  });
  it('maps ends to markers: the first end at the from table', () => {
    expect([section(0).startMarker, section(0).endMarker]).toEqual(['many', 'one']);
    expect([section(3).startMarker, section(3).endMarker]).toEqual(['one', 'one']);
  });
  it('merges two lines that end at one column into one vertical run', () => {
    expect(section(1).startPoint.y).not.toBe(section(2).startPoint.y);
    expect(section(1).bendPoints[0].x).toBe(section(2).bendPoints[0].x);
    expect(section(1).endPoint).toEqual(section(2).endPoint);
  });
  it('draws a self-relation as a U on the right side, from the FK row to the PK row', () => {
    const s = section(4), box = node('categories');
    expect(s.startPoint).toEqual({ x: box.x + box.width, y: portY(layout, 'categories', 'parent_id', spec) });
    expect(s.endPoint).toEqual({ x: box.x + box.width, y: portY(layout, 'categories', 'id', spec) });
    expect(s.bendPoints.map(p => p.x)).toEqual([s.bendPoints[0].x, s.bendPoints[0].x]);
    expect(s.bendPoints[0].x).toBeGreaterThan(box.x + box.width);
  });
  it('runs a relation between stacked tables on one side, merging with a line that ends at the same column', () => {
    const s = section(3);
    expect(s.startPoint.x).toBe(s.endPoint.x);
    expect(s.bendPoints).toHaveLength(2);
    expect(s.endPoint).toEqual(section(0).endPoint);
    expect(s.bendPoints[1]).toEqual(section(0).bendPoints[1]);
  });
  it('keeps every label clear of the other lines', async () => {
    const { readFileSync } = await import('fs');
    const { boxDistanceToSection } = await import('../scripts/templates/route.mjs');
    const shopSpec = JSON.parse(readFileSync(new URL('../evals/shop-schema/spec.json', import.meta.url)));
    for (const [name, result] of [['fixture', layout], ['shop-schema', schemaLayout(shopSpec, quiet)]]) {
      for (const e of result.edges) {
        for (const label of e.labels) {
          for (const other of result.edges.filter(o => o !== e)) {
            expect(boxDistanceToSection(label, other.sections[0]), `${name} "${label.text}" near edge ${other.index}`).toBeGreaterThanOrEqual(8);
          }
        }
      }
    }
  });
  it('draws a straight line when both column rows sit level', () => {
    const level = { template: 'schema', nodes: [
      { id: 'users', kind: 'table', label: 'users', row: 0, col: 0, columns: [column('id', 'bigint', 'PK')] },
      { id: 'settings', kind: 'table', label: 'settings', row: 0, col: 1, columns: [column('user_id', 'bigint', 'PK'), column('theme', 'text')] }],
      edges: [{ from: 'settings', fromColumn: 'user_id', to: 'users', toColumn: 'id', ends: ['one', 'one'], label: 'belongs to' }] };
    const result = schemaLayout(level, quiet);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0].sections[0].bendPoints).toEqual([]);
    expect(lintLayout(result, level)).toEqual([]);
  });
  it('never lines up two lines end to end on one track', () => {
    const near = { template: 'schema', nodes: [
      { id: 'users', kind: 'table', label: 'users', row: 0, col: 0, columns: [column('id', 'bigint', 'PK'), column('email', 'text')] },
      { id: 'orders', kind: 'table', label: 'orders', row: 0, col: 1, columns: [column('id', 'bigint', 'PK'), column('user_id', 'bigint', 'FK')] },
      { id: 'receipts', kind: 'table', label: 'receipts', row: 0, col: 2, columns: [column('order_id', 'bigint', 'PK'), column('sent_at', 'timestamptz')] },
      { id: 'payments', kind: 'table', label: 'payments', row: 1, col: 1, columns: [column('id', 'bigint', 'PK'), column('order_id', 'bigint', 'FK')] }],
      edges: [
        { from: 'orders', fromColumn: 'user_id', to: 'users', toColumn: 'id', ends: ['many', 'one'], label: 'places' },
        { from: 'receipts', fromColumn: 'order_id', to: 'orders', toColumn: 'id', ends: ['one', 'one'] },
        { from: 'payments', fromColumn: 'order_id', to: 'orders', toColumn: 'id', ends: ['many', 'one'], label: 'pays for' }] };
    const result = schemaLayout(near, quiet);
    const runs = result.edges.flatMap(e => {
      const s = e.sections[0], points = [s.startPoint, ...s.bendPoints, s.endPoint];
      return points.slice(1).map((q, i) => ({ edge: e.index, a: points[i], b: q })).filter(r => r.a.y === r.b.y);
    });
    for (const r of runs) {
      for (const q of runs.filter(o => o.edge !== r.edge && o.a.y === r.a.y)) {
        const gap = Math.max(Math.min(r.a.x, r.b.x), Math.min(q.a.x, q.b.x)) - Math.min(Math.max(r.a.x, r.b.x), Math.max(q.a.x, q.b.x));
        expect(gap, `edges ${r.edge} and ${q.edge}`).toBeGreaterThanOrEqual(40);
      }
    }
  });
  it('passes the layout lint', () => {
    expect(lintLayout(layout, spec)).toEqual([]);
  });
});

describe('schemaLayout: a relation between stacked tables near zone borders', () => {
  const stacked = (groups) => ({
    template: 'schema',
    nodes: [
      { id: 'books', kind: 'table', label: 'books', row: 0, col: 0, columns: [column('id', 'bigint', 'PK')] },
      { id: 'copies', kind: 'table', label: 'copies', row: 0, col: 1, columns: [column('id', 'bigint', 'PK'), column('book_id', 'bigint', 'FK')] },
      { id: 'loans', kind: 'table', label: 'loans', row: 1, col: 1, columns: [column('id', 'bigint', 'PK'), column('copy_id', 'bigint', 'FK')] },
    ],
    edges: [
      { from: 'copies', fromColumn: 'book_id', to: 'books', toColumn: 'id', ends: ['many', 'one'], label: 'has' },
      { from: 'loans', fromColumn: 'copy_id', to: 'copies', toColumn: 'id', ends: ['many', 'one'], label: 'goes out in' },
    ],
    groups,
  });
  const laneOf = (layout) => layout.edges.find(e => e.index === 1).sections[0].bendPoints[0].x;
  it('runs the lane outside both zones, at least 16 units clear', () => {
    const spec = stacked([
      { id: 'catalogue', label: 'Catalogue', contains: ['books', 'copies'], tone: 'green' },
      { id: 'lending', label: 'Lending', contains: ['loans'], tone: 'blue' },
    ]);
    const layout = schemaLayout(spec, quiet);
    for (const g of layout.groups) expect(laneOf(layout) - (g.x + g.width), g.id).toBeGreaterThanOrEqual(16);
    expect(lintLayout(layout, spec)).toEqual([]);
  });
  it('keeps the lane inside a zone that holds both tables, at least 16 units clear', () => {
    const spec = stacked([{ id: 'catalogue', label: 'Catalogue', contains: ['books', 'copies', 'loans'], tone: 'green' }]);
    const layout = schemaLayout(spec, quiet), zone = layout.groups[0];
    expect(zone.x + zone.width - laneOf(layout)).toBeGreaterThanOrEqual(16);
    expect(lintLayout(layout, spec)).toEqual([]);
  });
});

describe('schemaLayout: labels on two close parallel lines', () => {
  const library = () => ({
    template: 'schema',
    nodes: [
      { id: 'authors', kind: 'table', label: 'authors', row: 0, col: 0, columns: [column('id', 'bigint', 'PK'), column('name', 'text'), column('birth_year', 'int')] },
      { id: 'book_authors', kind: 'table', label: 'book_authors', row: 0, col: 1, columns: [column('id', 'bigint', 'PK'), column('book_id', 'bigint', 'FK'), column('author_id', 'bigint', 'FK')] },
      { id: 'books', kind: 'table', label: 'books', row: 1, col: 0, columns: [column('id', 'bigint', 'PK'), column('title', 'text')] },
    ],
    edges: [
      { from: 'book_authors', fromColumn: 'author_id', to: 'authors', toColumn: 'id', ends: ['many', 'one'], label: 'writes' },
      { from: 'book_authors', fromColumn: 'book_id', to: 'books', toColumn: 'id', ends: ['many', 'one'], label: 'credits' },
    ],
  });
  const runBeside = (label, section) => {
    const points = [section.startPoint, ...section.bendPoints, section.endPoint];
    const runs = points.slice(1).map((q, i) => straight(points[i], q));
    return runs.reduce((best, r) => (boxDistanceToSection(label, r) < boxDistanceToSection(label, best) ? r : best));
  };
  it('puts at most one label beside a pair of parallel runs closer than 40 units', () => {
    const spec = library(), layout = schemaLayout(spec, quiet);
    const [a, b] = layout.edges.map(e => runBeside(e.labels[0], e.sections[0]));
    const horizontal = (r) => r.startPoint.y === r.endPoint.y;
    const overlap = Math.min(Math.max(a.startPoint.x, a.endPoint.x), Math.max(b.startPoint.x, b.endPoint.x)) - Math.max(Math.min(a.startPoint.x, a.endPoint.x), Math.min(b.startPoint.x, b.endPoint.x));
    const close = horizontal(a) && horizontal(b) && Math.abs(a.startPoint.y - b.startPoint.y) < 40 && overlap > 0;
    expect(close).toBe(false);
    expect(lintLayout(layout, spec)).toEqual([]);
  });
  it('moves a label with no free run of its own beside its first corner', () => {
    const spec = JSON.parse(readFileSync(new URL('./fixtures/schema-library.json', import.meta.url)));
    const layout = schemaLayout(spec, quiet);
    const receives = layout.edges.find(e => spec.edges[e.index].label === 'receives');
    const corner = receives.sections[0].bendPoints[0];
    expect(boxDistanceToSection(receives.labels[0], straight(corner, corner))).toBeLessThan(24);
    expect(lintLayout(layout, spec)).toEqual([]);
  });
});
