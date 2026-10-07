const TEMPLATES = ['flow', 'hub', 'sequence', 'state', 'schema', 'class'];
const STYLES = ['crayon', 'quiet', 'riso', 'whiteboard', 'notebook', 'watercolour'];
const KINDS = ['card', 'decision', 'note', 'actor', 'state', 'start', 'end', 'table', 'class'];
const KEYS = ['PK', 'FK'];
const MAX_COLUMNS = 12;
const ENDS = ['one', 'many'];
const CLASS_ROWS = 8;
const RELATIONS = ['uses', 'inherits'];
const TONES = ['grey', 'blue', 'green', 'orange', 'red', 'purple'];
const BOUNDARIES = ['solid', 'dashed'];
const EDGE_STYLES = ['solid', 'dashed'];
const SIDES = ['left', 'right', 'top', 'bottom'];
const ID = /^[a-z0-9][a-z0-9-]*$/;
const notInSpec = (name) => `field "${name}" is not part of the spec. See references/planner-prompt.md.`;

function checkEnum(errors, value, allowed, what) {
  if (value !== undefined && !allowed.includes(value)) errors.push(`${what} "${value}" is not one of ${allowed.join(', ')}`);
}

function checkGroups(spec, errors, nodeIds) {
  const groups = spec.groups || [];
  const groupIds = new Set();
  for (const g of groups) {
    if (groupIds.has(g.id)) errors.push(`duplicate group id "${g.id}"`);
    if (nodeIds.has(g.id)) errors.push(`id "${g.id}" is used by a node and a group`);
    if (!Array.isArray(g.contains) || g.contains.length === 0) errors.push(`group "${g.id}" contains nothing`);
    groupIds.add(g.id);
  }
  const owner = new Map();
  for (const g of groups) {
    checkEnum(errors, g.tone, TONES, `group "${g.id}": tone`);
    checkEnum(errors, g.boundary, BOUNDARIES, `group "${g.id}": boundary`);
    if (g.direction !== undefined) errors.push(`group "${g.id}": ${notInSpec('direction')}`);
    for (const member of Array.isArray(g.contains) ? g.contains : []) {
      if (!nodeIds.has(member) && !groupIds.has(member)) errors.push(`group "${g.id}": unknown member "${member}"`);
      if (owner.has(member)) errors.push(`"${member}" is in two groups: "${owner.get(member)}" and "${g.id}"`);
      else owner.set(member, g.id);
    }
  }
  for (const g of groups) {
    const seen = new Set([g.id]);
    let parent = owner.get(g.id);
    while (parent) {
      if (seen.has(parent)) { errors.push(`group cycle through "${g.id}"`); break; }
      seen.add(parent);
      parent = owner.get(parent);
    }
  }
}

function checkColumns(n, errors) {
  const columns = Array.isArray(n.columns) ? n.columns : [];
  if (columns.length === 0) { errors.push(`node "${n.id}": a table needs columns`); return; }
  if (columns.length > MAX_COLUMNS) {
    errors.push(`node "${n.id}": ${columns.length} columns is more than ${MAX_COLUMNS}. List the key columns, then end with a column named "+ N more" and type "" for the rest.`);
  }
  const names = new Set();
  columns.forEach((c, i) => {
    if (typeof c.name !== 'string' || !c.name) { errors.push(`node "${n.id}": column ${i} needs a name`); return; }
    if (typeof c.type !== 'string') errors.push(`node "${n.id}": column "${c.name}" needs a type`);
    checkEnum(errors, c.key, KEYS, `node "${n.id}": column "${c.name}": key`);
    if (names.has(c.name)) errors.push(`node "${n.id}": column "${c.name}" appears twice`);
    names.add(c.name);
  });
}

function checkRelation(e, nodes, errors) {
  const name = `edge ${e.from}${e.fromColumn ? `.${e.fromColumn}` : ''}→${e.to}${e.toColumn ? `.${e.toColumn}` : ''}`;
  if (!e.fromColumn || !e.toColumn) { errors.push(`${name}: needs fromColumn and toColumn`); return; }
  for (const [id, columnName] of [[e.from, e.fromColumn], [e.to, e.toColumn]]) {
    const node = nodes.find(n => n.id === id);
    if (!node) continue;
    if (node.kind !== 'table') errors.push(`${name}: "${id}" is not a table`);
    else if (!(node.columns || []).some(c => c.name === columnName)) errors.push(`${name}: table "${id}" has no column "${columnName}"`);
  }
  if (!Array.isArray(e.ends) || e.ends.length !== 2 || !e.ends.every(end => ENDS.includes(end))) errors.push(`${name}: ends needs two of one, many, such as ["many", "one"]`);
  else if (e.ends[0] === 'many' && e.ends[1] === 'many') errors.push(`${name}: many-to-many is not allowed. Add a junction table with a foreign key to each side.`);
}

function checkClassNode(n, errors) {
  for (const field of ['attributes', 'methods', 'stereotype']) {
    if (n[field] !== undefined && n.kind !== 'class') errors.push(`node "${n.id}": only a class takes ${field}`);
  }
  if (n.kind !== 'class') return;
  for (const field of ['attributes', 'methods']) {
    const list = n[field];
    if (list === undefined) continue;
    if (!Array.isArray(list) || list.some(item => typeof item !== 'string')) errors.push(`node "${n.id}": ${field} must be a list of strings`);
    else if (list.length > CLASS_ROWS) errors.push(`node "${n.id}": ${list.length} ${field}, at most ${CLASS_ROWS}. Keep the ones the diagram is about.`);
  }
  if (n.stereotype !== undefined && typeof n.stereotype !== 'string') errors.push(`node "${n.id}": stereotype must be a string`);
}

function checkClassEdge(e, template, errors) {
  const name = `edge ${e.from}→${e.to}`;
  for (const field of ['relation', 'multiplicity']) {
    if (e[field] !== undefined && template !== 'class') errors.push(`${name}: only the class template takes ${field}`);
  }
  checkEnum(errors, e.relation, RELATIONS, `${name}: relation`);
  const m = e.multiplicity;
  if (m !== undefined && !(Array.isArray(m) && m.length === 2 && m.every(t => typeof t === 'string'))) errors.push(`${name}: multiplicity must be two strings, such as ["1", "0..*"]`);
}

function nodesUnder(spec, id, depth = 0) {
  const group = (spec.groups || []).find(g => g.id === id);
  if (!group || depth > 20) return [id];
  return (group.contains || []).flatMap(member => nodesUnder(spec, member, depth + 1));
}

function checkFlow(spec, errors) {
  const cells = new Map();
  for (const n of spec.nodes) {
    const hasRow = n.row !== undefined, hasCol = n.col !== undefined;
    if (hasRow !== hasCol) { errors.push(`node "${n.id}": set both row and col, or neither`); continue; }
    if (!hasRow) continue;
    if (!Number.isInteger(n.row) || n.row < 0 || !Number.isInteger(n.col) || n.col < 0) {
      errors.push(`node "${n.id}": row and col must be integers of 0 or more`);
      continue;
    }
    const key = `(${n.row},${n.col})`;
    if (cells.has(key)) errors.push(`cell ${key} holds "${cells.get(key)}" and "${n.id}"`);
    else cells.set(key, n.id);
  }
}

function checkHub(spec, errors, nodeIds) {
  const slots = spec.slots || {};
  if (!slots.center) { errors.push('hub needs slots.center'); return; }
  let current = slots.center;
  const chain = [];
  for (;;) {
    const group = (spec.groups || []).find(g => g.id === current);
    if (!group) break;
    chain.push(group.id);
    if (!Array.isArray(group.contains) || group.contains.length !== 1) { errors.push(`slots.center: group "${group.id}" must hold exactly one member`); return; }
    current = group.contains[0];
  }
  if (!nodeIds.has(current)) { errors.push(`slots.center "${slots.center}" does not end in a node`); return; }
  const hubCard = current;
  const slotOf = new Map();
  for (const side of SIDES) {
    for (const id of slots[side] || []) {
      if (id === hubCard) { errors.push(`"${hubCard}" is the hub card and cannot sit in a slot`); continue; }
      if (!nodeIds.has(id)) errors.push(`slots.${side}: unknown node "${id}"`);
      else if (slotOf.has(id)) errors.push(`node "${id}" is in two slots`);
      else slotOf.set(id, side);
    }
  }
  for (const n of spec.nodes) {
    if (n.id !== hubCard && !slotOf.has(n.id)) errors.push(`node "${n.id}" is in no slot`);
  }
  for (const e of spec.edges || []) {
    if (e.from === hubCard || e.to === hubCard) continue;
    const side = slotOf.get(e.from);
    const list = slots[side] || [];
    const neighbours = side && side === slotOf.get(e.to) && Math.abs(list.indexOf(e.from) - list.indexOf(e.to)) === 1;
    if (!neighbours) errors.push(`edge ${e.from}→${e.to}: hub edges must touch "${hubCard}" or join neighbours in one slot`);
  }
  for (const g of spec.groups || []) {
    if (chain.includes(g.id)) continue;
    const members = new Set(nodesUnder(spec, g.id));
    let slotsHeld = 0;
    for (const side of SIDES) {
      const list = slots[side] || [];
      const held = list.filter(id => members.has(id)).length;
      if (held > 0) slotsHeld++;
      if (held > 0 && held < list.length) errors.push(`group "${g.id}" splits the ${side} slot`);
    }
    if (slotsHeld > 1 && !members.has(hubCard)) errors.push(`group "${g.id}" spans several slots without the centre, so it would cover the hub card`);
  }
}

function checkSequence(spec, errors) {
  const actors = spec.actors || [];
  const messages = spec.messages || [];
  if (actors.length === 0) errors.push('sequence needs actors');
  if (messages.length === 0) errors.push('sequence needs messages');
  const ids = new Set();
  for (const a of actors) {
    if (ids.has(a.id)) errors.push(`duplicate actor id "${a.id}"`);
    ids.add(a.id);
  }
  messages.forEach((m, i) => {
    for (const end of [m.from, m.to]) if (!ids.has(end)) errors.push(`message ${i}: unknown actor "${end}"`);
  });
  for (const f of spec.fragments || []) {
    if (!Array.isArray(f.regions) || f.regions.length < 1 || f.regions.length > 2) { errors.push(`fragment ${f.kind}: needs one or two regions`); continue; }
    f.regions.forEach((region, r) => {
      if (!Array.isArray(region.messages) || region.messages.length === 0) errors.push(`fragment ${f.kind}: region ${r} holds no messages`);
    });
    for (const region of f.regions) {
      for (const index of region.messages || []) {
        if (!Number.isInteger(index) || index < 0 || index >= messages.length) errors.push(`fragment ${f.kind}: message index ${index} is out of range`);
      }
    }
  }
}

/** Collects every problem with a spec. The messages name the field so the planner can fix it. */
export function validateSpec(spec) {
  const errors = [];
  const template = spec.template ?? 'flow';
  checkEnum(errors, template, TEMPLATES, 'template');
  checkEnum(errors, spec.style, STYLES, 'style');
  for (const field of ['theme', 'direction', 'type']) if (spec[field] !== undefined) errors.push(notInSpec(field));

  if (template === 'sequence') {
    checkSequence(spec, errors);
    return { ok: errors.length === 0, errors };
  }

  const nodes = Array.isArray(spec.nodes) ? spec.nodes : [];
  if (nodes.length === 0) {
    errors.push(`a ${template} spec needs at least one node`);
    return { ok: false, errors };
  }
  const nodeIds = new Set();
  for (const n of nodes) {
    if (!ID.test(n.id || '')) errors.push(`node id "${n.id}" must match ${ID}`);
    if (nodeIds.has(n.id)) errors.push(`duplicate node id "${n.id}"`);
    nodeIds.add(n.id);
    for (const field of ['shape', 'category']) if (n[field] !== undefined) errors.push(`node "${n.id}": ${notInSpec(field)}`);
    checkEnum(errors, n.kind, KINDS, `node "${n.id}": kind`);
    if ((n.kind === 'start' || n.kind === 'end') && n.label) errors.push(`node "${n.id}": a ${n.kind} node takes no label`);
    if (n.kind === 'table') checkColumns(n, errors);
    checkClassNode(n, errors);
  }
  const pairs = new Set(), relations = new Set();
  for (const e of spec.edges || []) {
    for (const end of [e.from, e.to]) if (!nodeIds.has(end)) errors.push(`edge ${e.from}→${e.to}: unknown node "${end}"`);
    checkEnum(errors, e.style, EDGE_STYLES, `edge ${e.from}→${e.to}: style`);
    checkClassEdge(e, template, errors);
    if (e.from === e.to && template !== 'state' && template !== 'schema') errors.push(`edge ${e.from}→${e.to}: an edge needs two different nodes`);
    const relation = `${e.from}${e.fromColumn ? `.${e.fromColumn}` : ''}→${e.to}${e.toColumn ? `.${e.toColumn}` : ''}`;
    if (relations.has(relation)) errors.push(`duplicate edge ${relation}`);
    relations.add(relation);
    if (pairs.has(`${e.to}>${e.from}`) && template !== 'state' && template !== 'schema') errors.push(`edges ${e.to}→${e.from} and ${e.from}→${e.to}: use one edge with "both": true`);
    pairs.add(`${e.from}>${e.to}`);
    if (template === 'schema') checkRelation(e, nodes, errors);
  }
  checkGroups(spec, errors, nodeIds);
  if (['flow', 'state', 'schema', 'class'].includes(template)) checkFlow(spec, errors);
  if (template === 'hub') checkHub(spec, errors, nodeIds);
  return { ok: errors.length === 0, errors };
}
