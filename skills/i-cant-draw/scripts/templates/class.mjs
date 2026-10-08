import { flowLayout, assignCells } from './flow.mjs';
import { SpecError } from './cards.mjs';
import { straight, labelFor, endLabelFor } from './route.mjs';

const ROW_GAP = 110;
const BRANCH = 30;
const END_LABEL_BACK = 10;
const END_LABEL_PAD = 10;
const END_LABEL_MARGIN = 8;

/** The flow grid with top-aligned rows; inheritance lines share one trunk and one triangle per parent. */
export function classLayout(spec, style) {
  const edges = spec.edges || [];
  const cells = assignCells(spec);
  const nodes = spec.nodes.map(n => ({ ...n, ...cells.get(n.id) }));
  const kept = edges.map((_, i) => i).filter(i => edges[i].relation !== 'inherits');
  const spacing = { ...style.spacing, rowGap: Math.max(style.spacing.rowGap, ROW_GAP), groupPad: groupPad(spec, style) };
  const bottomTaken = new Set(edges.filter(e => e.relation === 'inherits').map(e => e.to));
  const layout = flowLayout({ ...spec, nodes, edges: kept.map(i => edges[i]) }, { ...style, spacing }, { rowAlign: 'top', bottomTaken });
  for (const e of layout.edges) {
    e.index = kept[e.index];
    const m = edges[e.index].multiplicity;
    if (m) e.endLabels = [endLabelFor(e.sections[0], m[0], 'start', style), endLabelFor(e.sections[e.sections.length - 1], m[1], 'end', style)];
  }
  layout.edges.push(...inheritance(layout, spec, cells, style));
  layout.edges.sort((a, b) => a.index - b.index);
  return layout;
}

// A multiplicity at a line end that crosses a zone border must fit between the card and the border.
function groupPad(spec, style) {
  const zoneOf = new Map();
  for (const g of spec.groups || []) for (const member of g.contains) zoneOf.set(member, g.id);
  const crossing = (spec.edges || []).filter(e => e.multiplicity && zoneOf.get(e.from) !== zoneOf.get(e.to));
  const widest = Math.max(0, ...crossing.flatMap(e => e.multiplicity).map(t => Math.ceil(style.measure(t, style.typeScale.edgeLabel, 400)) + END_LABEL_PAD));
  return Math.max(style.spacing.groupPad, widest ? END_LABEL_BACK + widest + END_LABEL_MARGIN : 0);
}

function inheritance(layout, spec, cells, style) {
  const edges = spec.edges || [];
  const box = new Map(layout.nodes.map(n => [n.id, n]));
  const byParent = new Map();
  edges.forEach((e, i) => { if (e.relation === 'inherits') byParent.set(e.to, [...(byParent.get(e.to) || []), i]); });
  const out = [];
  for (const [parentId, list] of byParent) {
    const rows = new Set(list.map(i => cells.get(edges[i].from).row));
    if (rows.size > 1) throw new SpecError(`children of "${parentId}" sit in different rows. Put every child of "${parentId}" in one row.`);
    if ([...rows][0] <= cells.get(parentId).row) throw new SpecError(`put the children of "${parentId}" in a row below it`);
    const parent = box.get(parentId);
    const tip = { x: parent.x + parent.width / 2, y: parent.y + parent.height };
    const tops = list.map(i => { const child = box.get(edges[i].from); return { x: child.x + child.width / 2, y: child.y }; });
    const carrier = list.find(i => edges[i].label) ?? list[0];
    const labelled = (i, section) => (i === carrier && edges[i].label ? [labelFor(section, edges[i].label, style, layout.groups)] : []);
    if (list.length === 1 && tops[0].x === tip.x) {
      const line = { ...straight(tops[0], tip), endMarker: 'triangle' };
      out.push({ index: list[0], sections: [line], labels: labelled(list[0], line) });
      continue;
    }
    const barY = tops[0].y - BRANCH;
    const xs = [tip.x, ...tops.map(t => t.x)];
    const stem = { ...straight({ x: tip.x, y: barY }, tip), endMarker: 'triangle' };
    const bar = { ...straight({ x: Math.min(...xs), y: barY }, { x: Math.max(...xs), y: barY }), endMarker: 'none' };
    list.forEach((i, k) => {
      const branch = { ...straight(tops[k], { x: tops[k].x, y: barY }), endMarker: 'none' };
      out.push({ index: i, sections: i === carrier ? [branch, bar, stem] : [branch], labels: labelled(i, stem) });
    });
  }
  return out;
}
