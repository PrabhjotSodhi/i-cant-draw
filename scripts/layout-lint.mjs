import { boxDistanceToSection } from './templates/route.mjs';

const MAX_BENDS = 2;
const MAX_LABEL_DISTANCE = 24;
const TRUNK_CLEARANCE = 8;
const MIN_OVERLAP = 4;
const BORDER_TOLERANCE = 2;
const TITLE_END_ROOM = 8;
const SIDES = ['left', 'right', 'top', 'bottom'];
const BORDER_NEAR = 4;
const BORDER_RUN = 20;

const pointsOf = (s) => [s.startPoint, ...s.bendPoints, s.endPoint];
const borderOf = (g) => ({ startPoint: { x: g.x, y: g.y }, endPoint: { x: g.x, y: g.y },
  bendPoints: [{ x: g.x + g.width, y: g.y }, { x: g.x + g.width, y: g.y + g.height }, { x: g.x, y: g.y + g.height }] });

// Routes are orthogonal, so a segment's bounding box is the segment.
function crosses(section, box, inset = 1) {
  const inner = { x: box.x + inset, y: box.y + inset, right: box.x + box.width - inset, bottom: box.y + box.height - inset };
  const p = pointsOf(section);
  for (let i = 1; i < p.length; i++) {
    const x0 = Math.min(p[i - 1].x, p[i].x), x1 = Math.max(p[i - 1].x, p[i].x);
    const y0 = Math.min(p[i - 1].y, p[i].y), y1 = Math.max(p[i - 1].y, p[i].y);
    if (x1 > inner.x && x0 < inner.right && y1 > inner.y && y0 < inner.bottom) return true;
  }
  return false;
}

/** Mechanical reading-effort checks. Each finding is { rule, owner, detail }. */
export function lintLayout(layout, spec) {
  const findings = [];
  const add = (rule, owner, detail) => findings.push({ rule, owner, detail });
  const template = spec.template ?? 'flow';
  const box = new Map(layout.nodes.map(n => [n.id, n]));
  const specNodes = spec.nodes || [];
  const edges = spec.edges || [];

  const titled = layout.groups.filter(g => g.titleBox);
  const throughTitles = (section, owner) => {
    for (const g of titled) if (crosses(section, g.titleBox)) add('line-through-title', owner, `crosses the title of ${g.id}`);
  };
  for (const g of titled) {
    const room = g.x + g.width - g.titleBox.x - g.titleBox.width;
    if (room < TITLE_END_ROOM) add('title-overflow', g.id, room >= 0 ? `title ends ${Math.round(room)} units from the right edge` : `title runs ${Math.round(-room)} units past the right edge`);
  }
  for (const e of layout.edges) {
    const se = edges[e.index] || {};
    const name = `${se.from}→${se.to}`;
    for (const s of e.sections) {
      if (s.bendPoints.length > MAX_BENDS) add('bends', name, `${s.bendPoints.length} bends`);
      for (const n of layout.nodes) {
        if (n.id !== se.from && n.id !== se.to && crosses(s, n)) add('through-card', name, `passes through ${n.id}`);
      }
      throughTitles(s, name);
    }
    for (const l of [...(e.labels || []), ...(e.endLabels || [])]) {
      for (const g of layout.groups) if (crosses(borderOf(g), l, BORDER_TOLERANCE)) add('label-on-border', name, `"${l.text}" sits on the border of ${g.id}`);
      for (const other of layout.edges) {
        if (other.index === e.index) continue;
        const otherSpec = edges[other.index] || {};
        if (other.sections.some(s => crosses(s, l, BORDER_TOLERANCE))) add('label-on-line', name, `"${l.text}" sits on ${otherSpec.from}→${otherSpec.to}`);
      }
      (layout.trunks || []).forEach((t, i) => { if (crosses(t, l, BORDER_TOLERANCE)) add('label-on-line', name, `"${l.text}" sits on trunk ${i}`); });
    }
    for (const l of e.labels || []) {
      const distance = Math.min(...e.sections.map(s => boxDistanceToSection(l, s)));
      if (distance > MAX_LABEL_DISTANCE) add('label-distance', name, `"${l.text}" is ${Math.round(distance)} units from its line`);
    }
  }
  const trunks = layout.trunks || [];
  trunks.forEach((t, i) => {
    for (const n of layout.nodes) if (crosses(t, n)) add('through-card', `trunk ${i}`, `passes through ${n.id}`);
    throughTitles(t, `trunk ${i}`);
    const vertical = t.startPoint.x === t.endPoint.x;
    const span = (s, axis) => [Math.min(s.startPoint[axis], s.endPoint[axis]), Math.max(s.startPoint[axis], s.endPoint[axis])];
    for (let j = i + 1; j < trunks.length; j++) {
      const u = trunks[j];
      if ((u.startPoint.x === u.endPoint.x) !== vertical) continue;
      const across = vertical ? Math.abs(t.startPoint.x - u.startPoint.x) : Math.abs(t.startPoint.y - u.startPoint.y);
      const [a0, a1] = span(t, vertical ? 'y' : 'x'), [b0, b1] = span(u, vertical ? 'y' : 'x');
      if (across < TRUNK_CLEARANCE && Math.min(a1, b1) - Math.max(a0, b0) > 0) add('trunk-overlap', `trunks ${i} and ${j}`, `${Math.round(across)} units apart`);
    }
  });

  // Two different edges on one line read as one edge; touching end to end is fine.
  const runs = [];
  const addRuns = (owner, section) => {
    const p = pointsOf(section);
    for (let i = 1; i < p.length; i++) runs.push({ owner, a: p[i - 1], b: p[i] });
  };
  for (const e of layout.edges) for (const s of e.sections) addRuns(`e${e.index}`, s);
  // Schema relations that end at one column merge into one line on purpose.
  const endOf = new Map(layout.edges.map(e => [`e${e.index}`, e.sections[e.sections.length - 1].endPoint]));
  const merged = (r, q) => template === 'schema' && endOf.has(r.owner) && endOf.has(q.owner)
    && endOf.get(r.owner).x === endOf.get(q.owner).x && endOf.get(r.owner).y === endOf.get(q.owner).y;
  trunks.forEach((t, i) => addRuns(`t${i}`, t));
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const r = runs[i], q = runs[j];
      if (r.owner === q.owner || merged(r, q)) continue;
      const rVertical = r.a.x === r.b.x, qVertical = q.a.x === q.b.x;
      if (rVertical !== qVertical) continue;
      const across = rVertical ? Math.abs(r.a.x - q.a.x) : Math.abs(r.a.y - q.a.y);
      if (across > 1) continue;
      const axis = rVertical ? 'y' : 'x';
      const overlap = Math.min(Math.max(r.a[axis], r.b[axis]), Math.max(q.a[axis], q.b[axis])) - Math.max(Math.min(r.a[axis], r.b[axis]), Math.min(q.a[axis], q.b[axis]));
      if (overlap > MIN_OVERLAP) add('edge-overlap', `${r.owner} and ${q.owner}`, `${Math.round(overlap)} units on one line`);
    }
  }

  // A line running along a zone border reads as part of the border.
  const ownerName = (owner) => (owner[0] === 't' ? `trunk ${owner.slice(1)}` : `${edges[+owner.slice(1)]?.from}→${edges[+owner.slice(1)]?.to}`);
  const sidesOf = (g) => [
    { vertical: false, at: g.y, from: g.x, to: g.x + g.width }, { vertical: false, at: g.y + g.height, from: g.x, to: g.x + g.width },
    { vertical: true, at: g.x, from: g.y, to: g.y + g.height }, { vertical: true, at: g.x + g.width, from: g.y, to: g.y + g.height },
  ];
  for (const r of runs) {
    const vertical = r.a.x === r.b.x, axis = vertical ? 'y' : 'x';
    const lo = Math.min(r.a[axis], r.b[axis]), hi = Math.max(r.a[axis], r.b[axis]);
    for (const g of layout.groups) {
      const along = Math.max(0, ...sidesOf(g).filter(b => b.vertical === vertical && Math.abs(b.at - (vertical ? r.a.x : r.a.y)) <= BORDER_NEAR)
        .map(b => Math.min(hi, b.to) - Math.max(lo, b.from)));
      if (along > BORDER_RUN) add('line-on-border', ownerName(r.owner), `runs ${Math.round(along)} units along the border of ${g.id}`);
    }
  }

  const cards = specNodes.filter(n => (n.kind || 'card') === 'card' && box.has(n.id));
  const sameWidth = (ids, rule, owner) => {
    const widths = new Set(ids.map(id => box.get(id).width));
    if (widths.size > 1) add(rule, owner, `widths ${[...widths].map(Math.round).join(', ')}`);
  };
  if (template === 'flow' || template === 'state' || template === 'schema') {
    const byCol = new Map(), byRow = new Map();
    for (const n of specNodes) {
      if (n.col === undefined || !box.has(n.id)) continue;
      if (['card', 'state', 'table'].includes(n.kind || 'card')) byCol.set(n.col, [...(byCol.get(n.col) || []), n.id]);
      byRow.set(n.row, [...(byRow.get(n.row) || []), n.id]);
    }
    for (const [col, ids] of byCol) sameWidth(ids, 'column-width', `col ${col}`);
    for (const [row, ids] of byRow) {
      if (template === 'schema') {
        const tops = ids.map(id => box.get(id).y);
        if (Math.max(...tops) - Math.min(...tops) > 1) add('row-top', `row ${row}`, `tops ${tops.map(Math.round).join(', ')}`);
        continue;
      }
      const centres = ids.map(id => box.get(id).y + box.get(id).height / 2);
      if (Math.max(...centres) - Math.min(...centres) > 1) add('row-centre', `row ${row}`, `centres ${centres.map(Math.round).join(', ')}`);
    }
  }
  if (template === 'hub') {
    const inStacks = new Set(cards.map(n => n.id));
    for (const sideName of SIDES) {
      const ids = (spec.slots?.[sideName] || []).filter(id => inStacks.has(id));
      if (ids.length > 1) sameWidth(ids, 'stack-width', sideName);
    }
  }
  return findings;
}
