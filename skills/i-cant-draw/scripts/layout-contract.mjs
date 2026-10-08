/** @typedef {{ x:number, y:number }} Point */
/** @typedef {{ y:number, text:string, part?:'attribute'|'method' }} CardRow */
/** @typedef {{ id:string, x:number, y:number, width:number, height:number, lines?:string[], rows?:CardRow[], dividers?:number[] }} LayoutNode */
/** @typedef {{ x:number, y:number, width:number, height:number }} Box */
/** @typedef {{ id:string, x:number, y:number, width:number, height:number, depth:number, spec:object, titleBox?:Box }} LayoutGroup */
/** @typedef {{ text:string, x:number, y:number, width:number, height:number }} LayoutLabel */
/** @typedef {'none'|'arrow'|'one'|'many'|'triangle'} Marker */
/** @typedef {{ startPoint:Point, endPoint:Point, bendPoints:Point[], startMarker?:Marker, endMarker?:Marker, dashed?:boolean, main?:boolean }} Section */
/** @typedef {LayoutLabel & { end:'start'|'end' }} EndLabel */
/** @typedef {{ index:number, sections:Section[], labels:LayoutLabel[], endLabels?:EndLabel[], arrow?:boolean }} LayoutEdge */
/** @typedef {{ width:number, height:number, nodes:LayoutNode[], groups:LayoutGroup[], edges:LayoutEdge[], trunks?:Section[], hubId?:string }} Layout */

import { MARKERS } from './render/markers.mjs';

function fail(path, problem) {
  throw new Error(`${path} ${problem}`);
}

function finite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path, 'is not a finite number');
}

function box(item, path) {
  for (const key of ['x', 'y', 'width', 'height']) finite(item[key], `${path}.${key}`);
  if (item.width <= 0) fail(`${path}.width`, 'must be above 0');
  if (item.height <= 0) fail(`${path}.height`, 'must be above 0');
}

function point(p, path) {
  if (!p) fail(path, 'is missing');
  finite(p.x, `${path}.x`);
  finite(p.y, `${path}.y`);
}

function section(s, path) {
  point(s.startPoint, `${path}.startPoint`);
  point(s.endPoint, `${path}.endPoint`);
  if (!Array.isArray(s.bendPoints)) fail(`${path}.bendPoints`, 'is not an array');
  s.bendPoints.forEach((p, i) => point(p, `${path}.bendPoints[${i}]`));
  for (const end of ['startMarker', 'endMarker']) {
    if (s[end] !== undefined && !MARKERS.includes(s[end])) fail(`${path}.${end}`, `is not one of ${MARKERS.join(', ')}`);
  }
}

/** Throws on the first field that breaks the Layout contract; returns the layout unchanged. */
export function assertLayout(layout) {
  finite(layout.width, 'width');
  finite(layout.height, 'height');
  if (layout.width <= 0) fail('width', 'must be above 0');
  if (layout.height <= 0) fail('height', 'must be above 0');
  layout.nodes.forEach((n, i) => {
    if (typeof n.id !== 'string') fail(`nodes[${i}].id`, 'is not a string');
    box(n, `nodes[${i}]`);
  });
  layout.groups.forEach((g, i) => {
    if (typeof g.id !== 'string') fail(`groups[${i}].id`, 'is not a string');
    box(g, `groups[${i}]`);
    if (!Number.isInteger(g.depth) || g.depth < 0) fail(`groups[${i}].depth`, 'is not an integer of 0 or more');
    if (g.titleBox !== undefined) box(g.titleBox, `groups[${i}].titleBox`);
  });
  layout.edges.forEach((e, i) => {
    if (!Number.isInteger(e.index)) fail(`edges[${i}].index`, 'is not an integer');
    if (!Array.isArray(e.sections) || e.sections.length === 0) fail(`edges[${i}].sections`, 'needs at least one section');
    e.sections.forEach((s, j) => section(s, `edges[${i}].sections[${j}]`));
    (e.labels || []).forEach((l, j) => box(l, `edges[${i}].labels[${j}]`));
    (e.endLabels || []).forEach((l, j) => {
      box(l, `edges[${i}].endLabels[${j}]`);
      if (l.end !== 'start' && l.end !== 'end') fail(`edges[${i}].endLabels[${j}].end`, 'is not start or end');
    });
  });
  (layout.trunks || []).forEach((s, i) => section(s, `trunks[${i}]`));
  return layout;
}
