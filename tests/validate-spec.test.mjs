import { describe, it, expect } from 'vitest';
import { validateSpec } from '../skills/i-cant-draw/scripts/validate-spec.mjs';

const flow = () => ({
  template: 'flow',
  nodes: [{ id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }],
  edges: [{ from: 'a', to: 'b' }],
  groups: [{ id: 'g', label: 'G', contains: ['a', 'b'], tone: 'blue' }],
});

const hub = () => ({
  template: 'hub',
  slots: { center: 'outer', left: ['l1', 'l2'], right: ['r1'] },
  nodes: [
    { id: 'core', label: 'Core' }, { id: 'l1', label: 'L1' }, { id: 'l2', label: 'L2' }, { id: 'r1', label: 'R1' },
  ],
  edges: [{ from: 'core', to: 'l1' }, { from: 'core', to: 'r1' }, { from: 'l1', to: 'l2' }],
  groups: [
    { id: 'outer', label: 'Outer', contains: ['inner'] },
    { id: 'inner', label: 'Inner', contains: ['core'] },
    { id: 'left', label: 'Left', contains: ['l1', 'l2'] },
  ],
});

const errorsOf = (spec) => validateSpec(spec).errors.join('\n');

describe('validateSpec', () => {
  it('accepts valid flow and hub specs', () => {
    expect(validateSpec(flow())).toEqual({ ok: true, errors: [] });
    expect(validateSpec(hub())).toEqual({ ok: true, errors: [] });
  });
  it('rejects an unknown template', () => {
    expect(errorsOf({ ...flow(), template: 'radial' })).toMatch(/template "radial"/);
  });
  it('rejects fields that are not part of the spec', () => {
    expect(errorsOf({ ...flow(), theme: 'pastel' })).toMatch(/field "theme" is not part of the spec/);
    expect(errorsOf({ ...flow(), type: 'flow' })).toMatch(/field "type" is not part of the spec/);
    const s = flow(); s.nodes[0].shape = 'rect';
    expect(errorsOf(s)).toMatch(/field "shape" is not part of the spec/);
  });
  it('rejects duplicate ids', () => {
    const s = flow(); s.nodes[1].id = 'a';
    expect(errorsOf(s)).toMatch(/duplicate node id "a"/);
  });
  it('rejects edges to unknown nodes', () => {
    const s = flow(); s.edges.push({ from: 'a', to: 'ghost' });
    expect(errorsOf(s)).toMatch(/edge a→ghost: unknown node "ghost"/);
  });
  it('rejects a node in two groups', () => {
    const s = flow(); s.groups.push({ id: 'h', label: 'H', contains: ['a'] });
    expect(errorsOf(s)).toMatch(/"a" is in two groups/);
  });
  it('rejects a group cycle', () => {
    const s = flow(); s.groups = [{ id: 'x', label: 'X', contains: ['y'] }, { id: 'y', label: 'Y', contains: ['x'] }];
    expect(errorsOf(s)).toMatch(/group cycle/);
  });
  it('rejects a bad tone', () => {
    const s = flow(); s.groups[0].tone = 'teal';
    expect(errorsOf(s)).toMatch(/tone "teal"/);
  });
  it('needs row and col together in flow', () => {
    const s = flow(); delete s.nodes[0].col;
    expect(errorsOf(s)).toMatch(/node "a": set both row and col, or neither/);
  });
  it('rejects two flow nodes in one cell', () => {
    const s = flow(); s.nodes[1].col = 0;
    expect(errorsOf(s)).toMatch(/cell \(0,0\) holds "a" and "b"/);
  });
  it('rejects a hub node in no slot', () => {
    const s = hub(); s.nodes.push({ id: 'stray', label: 'Stray' });
    expect(errorsOf(s)).toMatch(/node "stray" is in no slot/);
  });
  it('rejects a hub edge between slots', () => {
    const s = hub(); s.edges.push({ from: 'l1', to: 'r1' });
    expect(errorsOf(s)).toMatch(/edge l1→r1: hub edges must touch "core" or join neighbours in one slot/);
  });
  it('rejects a hub group that splits a slot', () => {
    const s = hub(); s.groups[2].contains = ['l1'];
    expect(errorsOf(s)).toMatch(/group "left" splits the left slot/);
  });
  it('rejects a sequence message to an unknown actor', () => {
    const s = { template: 'sequence', actors: [{ id: 'a', label: 'A' }], messages: [{ from: 'a', to: 'ghost' }] };
    expect(errorsOf(s)).toMatch(/message 0: unknown actor "ghost"/);
  });
});

describe('validateSpec hardening', () => {
  it('rejects missing or empty nodes', () => {
    expect(errorsOf({ template: 'flow' })).toMatch(/needs at least one node/);
    expect(errorsOf({ template: 'flow', nodes: [] })).toMatch(/needs at least one node/);
  });
  it('rejects an empty group', () => {
    const s = flow(); s.groups[0].contains = [];
    expect(errorsOf(s)).toMatch(/group "g" contains nothing/);
    const t = flow(); delete t.groups[0].contains;
    expect(errorsOf(t)).toMatch(/group "g" contains nothing/);
  });
  it('rejects a group id that repeats a node id or a group id', () => {
    const s = flow(); s.groups[0].id = 'a'; s.groups[0].contains = ['b'];
    expect(errorsOf(s)).toMatch(/id "a" is used by a node and a group/);
    const t = flow(); t.groups.push({ id: 'g', label: 'Again', contains: ['a'] });
    expect(errorsOf(t)).toMatch(/duplicate group id "g"/);
  });
  it('rejects self edges and opposing pairs', () => {
    const s = flow(); s.edges.push({ from: 'a', to: 'a' });
    expect(errorsOf(s)).toMatch(/edge a→a: an edge needs two different nodes/);
    const t = flow(); t.edges.push({ from: 'b', to: 'a' });
    expect(errorsOf(t)).toMatch(/edges a→b and b→a: use one edge with "both": true/);
  });
  it('rejects the hub card in a side slot and groups that span stacks without the centre', () => {
    const s = hub(); s.slots.left.push('core');
    expect(errorsOf(s)).toMatch(/"core" is the hub card and cannot sit in a slot/);
    const t = hub(); t.groups[2].contains = ['l1', 'l2', 'r1'];
    expect(errorsOf(t)).toMatch(/group "left" spans several slots without the centre/);
  });
  it('rejects duplicate actors and empty fragment regions', () => {
    const s = { template: 'sequence', actors: [{ id: 'a', label: 'A' }, { id: 'a', label: 'B' }], messages: [{ from: 'a', to: 'a' }] };
    expect(errorsOf(s)).toMatch(/duplicate actor id "a"/);
    const t = { template: 'sequence', actors: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], messages: [{ from: 'a', to: 'b' }],
      fragments: [{ kind: 'opt', regions: [{ messages: [] }] }, { kind: 'loop' }] };
    expect(errorsOf(t)).toMatch(/fragment opt: region 0 holds no messages/);
    expect(errorsOf(t)).toMatch(/fragment loop: needs one or two regions/);
  });
  it('accepts a hub spec with no edges', () => {
    const s = hub(); delete s.edges;
    expect(validateSpec(s).ok).toBe(true);
  });
});

describe('validateSpec duplicates', () => {
  it('rejects the same edge twice', () => {
    const s = flow(); s.edges.push({ from: 'a', to: 'b' });
    expect(errorsOf(s)).toMatch(/duplicate edge a→b/);
  });
  it('allows two edges between one pair when their columns differ', () => {
    const s = flow(); s.edges = [{ from: 'a', fromColumn: 'billing_id', to: 'b', toColumn: 'id' }, { from: 'a', fromColumn: 'shipping_id', to: 'b', toColumn: 'id' }];
    expect(errorsOf(s)).not.toMatch(/duplicate edge/);
  });
  it('rejects two edges with the same pair and columns', () => {
    const s = flow(); s.edges = [{ from: 'a', fromColumn: 'b_id', to: 'b', toColumn: 'id' }, { from: 'a', fromColumn: 'b_id', to: 'b', toColumn: 'id' }];
    expect(errorsOf(s)).toMatch(/duplicate edge a\.b_id→b\.id/);
  });
});

describe('validateSpec: state kinds', () => {
  const states = () => ({ template: 'flow', nodes: [
    { id: 'go', kind: 'start', row: 0, col: 0 }, { id: 'run', kind: 'state', label: 'Running', row: 0, col: 1 }, { id: 'stop', kind: 'end', row: 0, col: 2 }],
    edges: [{ from: 'go', to: 'run' }, { from: 'run', to: 'stop' }] });
  it('accepts state, start and end nodes', () => {
    expect(validateSpec(states()).errors).toEqual([]);
  });
  it('rejects a label on a start or end node', () => {
    const spec = states(); spec.nodes[0].label = 'Begin';
    expect(validateSpec(spec).errors.join('\n')).toMatch(/node "go": a start node takes no label/);
  });
});

describe('validateSpec: state template', () => {
  const machine = () => ({ template: 'state', nodes: [
    { id: 'a', kind: 'state', label: 'A', row: 0, col: 0 }, { id: 'b', kind: 'state', label: 'B', row: 0, col: 1 }],
    edges: [{ from: 'a', to: 'a', label: 'again' }, { from: 'a', to: 'b', label: 'go' }, { from: 'b', to: 'a', label: 'back' }] });
  it('allows self-loops and a transition each way between two states', () => {
    expect(validateSpec(machine()).errors).toEqual([]);
  });
  it('still rejects both in a flow', () => {
    const errors = validateSpec({ ...machine(), template: 'flow' }).errors.join('\n');
    expect(errors).toMatch(/an edge needs two different nodes/);
    expect(errors).toMatch(/use one edge with "both": true/);
  });
  it('runs the flow cell checks for a state machine', () => {
    const spec = machine(); spec.nodes[1].col = 0;
    expect(validateSpec(spec).errors.join('\n')).toMatch(/cell \(0,0\) holds "a" and "b"/);
  });
});

describe('validateSpec: table kind', () => {
  const column = (name, key) => ({ name, type: 'bigint', ...(key ? { key } : {}) });
  const tables = () => ({ template: 'flow', nodes: [
    { id: 'users', kind: 'table', label: 'users', row: 0, col: 0, columns: [column('id', 'PK'), column('email')] },
    { id: 'orders', kind: 'table', label: 'orders', row: 0, col: 1, columns: [column('id', 'PK'), column('user_id', 'FK')] }] });
  const errorsOfTables = (change) => { const spec = tables(); change(spec.nodes[0]); return validateSpec(spec).errors.join('\n'); };
  it('accepts tables with typed columns and PK and FK keys', () => {
    expect(validateSpec(tables()).errors).toEqual([]);
  });
  it('needs at least one column', () => {
    expect(errorsOfTables(n => { n.columns = []; })).toMatch(/node "users": a table needs columns/);
    expect(errorsOfTables(n => { delete n.columns; })).toMatch(/node "users": a table needs columns/);
  });
  it('needs a name and a type on every column', () => {
    expect(errorsOfTables(n => { n.columns[1] = { type: 'text' }; })).toMatch(/node "users": column 1 needs a name/);
    expect(errorsOfTables(n => { delete n.columns[1].type; })).toMatch(/node "users": column "email" needs a type/);
  });
  it('allows only PK and FK as a key', () => {
    expect(errorsOfTables(n => { n.columns[1].key = 'UK'; })).toMatch(/node "users": column "email": key "UK" is not one of PK, FK/);
  });
  it('rejects a column name used twice in one table', () => {
    expect(errorsOfTables(n => { n.columns.push(column('email')); })).toMatch(/node "users": column "email" appears twice/);
  });
  it('rejects more than 12 columns and says how to cut them', () => {
    const errors = errorsOfTables(n => { n.columns = Array.from({ length: 15 }, (_, i) => column(`c${i}`)); });
    expect(errors).toMatch(/node "users": 15 columns is more than 12\. List the key columns, then end with a column named "\+ N more"/);
    expect(errorsOfTables(n => { n.columns = Array.from({ length: 12 }, (_, i) => column(`c${i}`)); })).toBe('');
  });
});

describe('validateSpec: class kind', () => {
  const classes = () => ({ template: 'flow', nodes: [
    { id: 'tool', kind: 'class', label: 'QueryTool', stereotype: 'abstract', attributes: ['rowCap: number'], methods: ['execute(sql)'], row: 0, col: 0 }] });
  it('accepts a class with attributes, methods and a stereotype', () => {
    expect(validateSpec(classes()).errors).toEqual([]);
  });
  it('rejects more than 8 attributes or methods and says to keep the ones the diagram is about', () => {
    const spec = classes(); spec.nodes[0].attributes = Array.from({ length: 9 }, (_, i) => `field${i}: number`);
    expect(errorsOf(spec)).toMatch(/node "tool": 9 attributes, at most 8\. Keep the ones the diagram is about/);
    const other = classes(); other.nodes[0].methods = Array.from({ length: 10 }, (_, i) => `step${i}()`);
    expect(errorsOf(other)).toMatch(/node "tool": 10 methods, at most 8/);
  });
  it('rejects attributes, methods or a stereotype that are not text', () => {
    const spec = classes(); spec.nodes[0].attributes = 'rowCap: number'; spec.nodes[0].methods = [42]; spec.nodes[0].stereotype = ['abstract'];
    const errors = errorsOf(spec);
    expect(errors).toMatch(/node "tool": attributes must be a list of strings/);
    expect(errors).toMatch(/node "tool": methods must be a list of strings/);
    expect(errors).toMatch(/node "tool": stereotype must be a string/);
  });
  it('rejects class fields on a node that is not a class', () => {
    const spec = flow(); spec.nodes[0].attributes = ['x: number']; spec.nodes[1].stereotype = 'abstract';
    const errors = errorsOf(spec);
    expect(errors).toMatch(/node "a": only a class takes attributes/);
    expect(errors).toMatch(/node "b": only a class takes stereotype/);
  });
});

describe('validateSpec: class template', () => {
  const diagram = () => ({ template: 'class', nodes: [
    { id: 'base', kind: 'class', label: 'Base', row: 0, col: 0 }, { id: 'child', kind: 'class', label: 'Child', row: 1, col: 0 }, { id: 'user', kind: 'class', label: 'User', row: 0, col: 1 }],
    edges: [{ from: 'child', to: 'base', relation: 'inherits' }, { from: 'user', to: 'base', relation: 'uses', multiplicity: ['1', '0..*'] }] });
  it('accepts inherits and uses relations with a multiplicity', () => {
    expect(validateSpec(diagram()).errors).toEqual([]);
  });
  it('rejects an unknown relation and a malformed multiplicity', () => {
    const spec = diagram(); spec.edges[0].relation = 'owns'; spec.edges[1].multiplicity = ['1'];
    const errors = errorsOf(spec);
    expect(errors).toMatch(/edge child→base: relation "owns" is not one of uses, inherits/);
    expect(errors).toMatch(/edge user→base: multiplicity must be two strings, such as \["1", "0\.\.\*"\]/);
  });
  it('rejects a relation or multiplicity outside the class template', () => {
    const errors = errorsOf({ ...diagram(), template: 'flow' });
    expect(errors).toMatch(/edge child→base: only the class template takes relation/);
    expect(errors).toMatch(/edge user→base: only the class template takes multiplicity/);
  });
  it('runs the flow cell checks for a class diagram', () => {
    const spec = diagram(); spec.nodes[1].row = 0;
    expect(errorsOf(spec)).toMatch(/cell \(0,0\) holds "base" and "child"/);
  });
});
