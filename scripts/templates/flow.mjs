import { sizeCards, SpecError, titleBox } from './cards.mjs';
import { side, straight, elbow, zRoute, uRoute, selfLoop, trunkRoute, spreadPorts, labelFor } from './route.mjs';

const LABEL_ROOM = 58;
const LANE = 12;
const LANE_LABEL_ROOM = 28;
const FAN_OUT = 3;
const FAN_IN_INSET = 28;
const SHARED_TARGET_OFFSET = 8;
const LOOP_ROOM = 60;
const OPPOSING_APART = { vertical: 30, horizontal: 14 };

const bounds = (boxes) => {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x, height: Math.max(...boxes.map(b => b.y + b.height)) - y };
};
const wrap = (box, pad, band) => ({ x: box.x - pad, y: box.y - pad - band, width: box.width + 2 * pad, height: box.height + 2 * pad + band });

// Nodes without a cell take the longest path rank as their column, then the next free row in it.
export function assignCells(spec) {
  const cells = new Map();
  for (const n of spec.nodes) if (n.row !== undefined) cells.set(n.id, { row: n.row, col: n.col });
  const missing = spec.nodes.filter(n => !cells.has(n.id));
  if (!missing.length) return cells;

  const edges = acyclicEdges(spec);

  const rank = new Map();
  const rankOf = (id) => {
    if (rank.has(id)) return rank.get(id);
    const incoming = edges.filter(([, b]) => b === id).map(([a]) => a);
    const value = incoming.length ? 1 + Math.max(...incoming.map(rankOf)) : 0;
    rank.set(id, value);
    return value;
  };
  const nextRow = new Map();
  for (const { row, col } of cells.values()) nextRow.set(col, Math.max(nextRow.get(col) ?? 0, row + 1));
  for (const n of missing) {
    const col = rankOf(n.id);
    const row = nextRow.get(col) ?? 0;
    cells.set(n.id, { row, col });
    nextRow.set(col, row + 1);
  }
  return cells;
}

// Depth-first from each node in declaration order; an edge back to a node still on the stack closes a cycle and is dropped.
function acyclicEdges(spec) {
  const all = (spec.edges || []).filter(e => !e.annotation).map(e => [e.from, e.to]);
  const out = new Map();
  all.forEach((edge, i) => out.set(edge[0], [...(out.get(edge[0]) || []), i]));
  const state = new Map(), back = new Set();
  const visit = (id) => {
    state.set(id, 1);
    for (const i of out.get(id) || []) {
      const next = all[i][1];
      if (state.get(next) === 1) back.add(i);
      else if (!state.has(next)) visit(next);
    }
    state.set(id, 2);
  };
  for (const n of spec.nodes) if (!state.has(n.id)) visit(n.id);
  return all.filter((_, i) => !back.has(i));
}

function groupExtents(spec, cells) {
  const groups = spec.groups || [];
  const byId = new Map(groups.map(g => [g.id, g]));
  const leaves = (id) => (byId.has(id) ? byId.get(id).contains.flatMap(leaves) : [id]);
  const extents = new Map();
  for (const g of groups) {
    const members = leaves(g.id);
    const rows = members.map(id => cells.get(id).row), cols = members.map(id => cells.get(id).col);
    extents.set(g.id, { members: new Set(members), minRow: Math.min(...rows), maxRow: Math.max(...rows), minCol: Math.min(...cols), maxCol: Math.max(...cols) });
  }
  for (const [id, x] of extents) {
    for (const [nodeId, cell] of cells) {
      if (x.members.has(nodeId)) continue;
      if (cell.row >= x.minRow && cell.row <= x.maxRow && cell.col >= x.minCol && cell.col <= x.maxCol) {
        throw new SpecError(`group "${id}" covers cell (${cell.row},${cell.col}) holding non-member "${nodeId}"`);
      }
    }
  }
  return extents;
}

function groupDepths(spec) {
  const parent = new Map();
  for (const g of spec.groups || []) for (const member of g.contains) parent.set(member, g.id);
  const depth = (id) => (parent.has(id) ? 1 + depth(parent.get(id)) : 0);
  return new Map((spec.groups || []).map(g => [g.id, depth(g.id)]));
}

/** Places cards on a grid: one width per column, one centre line per row, groups as cell rectangles. */
export function flowLayout(spec, style, { rowAlign = 'centre', router = null, bottomTaken = new Set() } = {}) {
  const { colGap, rowGap, groupPad, groupLabelBand } = style.spacing;
  const cells = assignCells(spec);
  // A router sizes gaps and routes the edges itself, so the flow lanes, loops and label gaps see no edges.
  const flowEdges = router ? [] : spec.edges || [];
  const sizes = sizeCards(spec, style, () => 'cards');
  const extents = groupExtents(spec, cells);
  const colCount = 1 + Math.max(...[...cells.values()].map(c => c.col));
  const rowCount = 1 + Math.max(...[...cells.values()].map(c => c.row));

  const colWidth = Array(colCount).fill(0), rowHeight = Array(rowCount).fill(0);
  for (const n of spec.nodes) {
    const { row, col } = cells.get(n.id), size = sizes.get(n.id);
    colWidth[col] = Math.max(colWidth[col], size.width);
    rowHeight[row] = Math.max(rowHeight[row], size.height);
  }

  const colGaps = Array(Math.max(colCount - 1, 0)).fill(colGap);
  for (const e of flowEdges) {
    if (!e.label) continue;
    const a = cells.get(e.from).col, b = cells.get(e.to).col;
    const need = style.measure(e.label, style.typeScale.edgeLabel) + LABEL_ROOM;
    if (b > a) colGaps[b - 1] = Math.max(colGaps[b - 1], need);
    else if ((a - b === 1 && cells.get(e.from).row === cells.get(e.to).row) || (b < a && bottomTaken.has(e.to))) colGaps[b] = Math.max(colGaps[b], need);
  }
  if (router) router.gaps(colGaps, cells, style);
  const rowGaps = Array(Math.max(rowCount - 1, 0)).fill(rowGap);
  for (const x of extents.values()) {
    if (x.maxCol < colCount - 1) colGaps[x.maxCol] += groupPad;
    if (x.minCol > 0) colGaps[x.minCol - 1] += groupPad;
    if (x.maxRow < rowCount - 1) rowGaps[x.maxRow] += groupPad;
    if (x.minRow > 0) rowGaps[x.minRow - 1] += groupPad + groupLabelBand;
  }

  const lanes = feedbackLanes({ ...spec, edges: flowEdges }, cells, bottomTaken);
  const lanesBelow = new Map();
  for (const { row, labelled } of lanes.values()) {
    const entry = lanesBelow.get(row) || { count: 0, labelled: false };
    lanesBelow.set(row, { count: entry.count + 1, labelled: entry.labelled || labelled });
  }
  const overLanes = overTheTopLanes({ ...spec, edges: flowEdges }, cells, bottomTaken);
  let topRoom = 0;
  for (const [row, { count, labelled }] of overLanes.perRow) {
    const need = LANE * (count + 1) + 6 + (labelled ? LANE_LABEL_ROOM : 0);
    if (row > 0) rowGaps[row - 1] = Math.max(rowGaps[row - 1], need + groupPad);
    else topRoom = Math.max(topRoom, need);
  }
  let bottomRoom = 0;
  for (const [row, { count, labelled }] of lanesBelow) {
    const need = LANE * (count + 1) + (labelled ? LANE_LABEL_ROOM : 0);
    if (row < rowCount - 1) rowGaps[row] = Math.max(rowGaps[row], need + groupPad);
    else bottomRoom = Math.max(bottomRoom, need);
  }

  const loopNodes = new Set(flowEdges.filter(e => e.from === e.to).map(e => e.from));
  for (const row of new Set([...loopNodes].map(id => cells.get(id).row))) if (row > 0) rowGaps[row - 1] += LOOP_ROOM;

  const colX = [0], rowY = [0];
  for (let c = 1; c < colCount; c++) colX.push(colX[c - 1] + colWidth[c - 1] + colGaps[c - 1]);
  for (let r = 1; r < rowCount; r++) rowY.push(rowY[r - 1] + rowHeight[r - 1] + rowGaps[r - 1]);

  const boxes = new Map();
  for (const n of spec.nodes) {
    const { row, col } = cells.get(n.id), size = sizes.get(n.id);
    boxes.set(n.id, {
      x: colX[col] + (colWidth[col] - size.width) / 2,
      y: rowAlign === 'top' ? rowY[row] : rowY[row] + (rowHeight[row] - size.height) / 2,
      width: size.width, height: size.height,
    });
  }
  const loopExtent = new Map();
  for (const e of flowEdges) {
    if (e.from !== e.to) continue;
    const loop = selfLoop(boxes.get(e.from));
    const points = [loop.startPoint, ...loop.bendPoints, loop.endPoint].map(p => ({ x: p.x, y: p.y, width: 1, height: 1 }));
    const label = e.label ? [labelFor(loop, e.label, style)] : [];
    loopExtent.set(e.from, bounds([...points, ...label]));
  }
  // A router extent keyed by a node id grows that node's zone; any other key grows only the page.
  if (router) for (const [id, extent] of router.extents(boxes, sizes, cells, style)) loopExtent.set(id, extent);
  const withLoop = (id) => (loopExtent.has(id) ? [boxes.get(id), loopExtent.get(id)] : [boxes.get(id)]);
  const depths = groupDepths(spec);
  // A loop-back line runs under its row; a zone ending on that row grows to hold the line and its label.
  const laneReach = [];
  flowEdges.forEach((e, index) => {
    const lane = lanes.get(index);
    if (!lane) return;
    const [p, q] = [boxes.get(e.from), boxes.get(e.to)];
    const xs = [p.x + p.width / 2, q.x + q.width / 2];
    const bottom = rowY[lane.row] + rowHeight[lane.row] + LANE * (lane.lane + 1) + (lane.labelled ? LANE_LABEL_ROOM : 0);
    laneReach.push({ row: lane.row, x0: Math.min(...xs), x1: Math.max(...xs), bottom });
  });
  for (const g of [...(spec.groups || [])].sort((a, b) => depths.get(b.id) - depths.get(a.id))) {
    const box = wrap(bounds(g.contains.flatMap(withLoop)), groupPad, groupLabelBand);
    const lastRow = extents.get(g.id)?.maxRow;
    for (const r of laneReach) {
      if (r.row === lastRow && r.x0 < box.x + box.width && r.x1 > box.x) box.height = Math.max(box.height, r.bottom + groupPad / 2 - box.y);
    }
    boxes.set(g.id, box);
  }

  const lastRow = rowY[rowCount - 1] + rowHeight[rowCount - 1];
  const all = bounds([...boxes.values(), ...loopExtent.values(), { x: 0, y: -topRoom, width: 1, height: lastRow + bottomRoom + topRoom }]);
  const shift = (b) => ({ x: b.x - all.x, y: b.y - all.y, width: b.width, height: b.height });
  const nodes = spec.nodes.map(n => {
    const size = sizes.get(n.id);
    return { id: n.id, ...shift(boxes.get(n.id)), lines: size.lines, ...(size.rows ? { rows: size.rows, dividers: size.dividers } : {}) };
  });
  const groups = (spec.groups || []).map(g => {
    const box = shift(boxes.get(g.id));
    return { id: g.id, ...box, depth: depths.get(g.id), spec: g, ...(g.label ? { titleBox: titleBox(box, g.label, style) } : {}) };
  });
  const grid = { colX: colX.map(x => x - all.x), rowY: rowY.map(y => y - all.y), colWidth, rowHeight, colGaps, rowGaps };
  const layout = { width: all.width, height: all.height, nodes, groups, edges: [], trunks: [] };
  if (router) router.route(layout, spec, style, cells, grid);
  else routeFlow(layout, spec, style, cells, grid, lanes, overLanes.byEdge, rowAlign, bottomTaken);
  return layout;
}

// A line leftward into a card whose bottom is taken goes over the top like a rightward one.
function blockedSameRow(e, cells, bottomTaken) {
  const a = cells.get(e.from), b = cells.get(e.to);
  const lo = Math.min(a.col, b.col), hi = Math.max(a.col, b.col);
  if (e.annotation || a.row !== b.row || hi <= lo + 1 || (b.col < a.col && !bottomTaken.has(e.to))) return false;
  const taken = new Set([...cells.values()].map(c => `${c.row},${c.col}`));
  for (let c = lo + 1; c < hi; c++) if (taken.has(`${a.row},${c}`)) return true;
  return false;
}

function overTheTopLanes(spec, cells, bottomTaken) {
  const perRow = new Map(), byEdge = new Map();
  (spec.edges || []).forEach((e, index) => {
    if (!blockedSameRow(e, cells, bottomTaken)) return;
    const row = cells.get(e.from).row;
    const entry = perRow.get(row) || { count: 0, labelled: false };
    byEdge.set(index, entry.count);
    perRow.set(row, { count: entry.count + 1, labelled: entry.labelled || !!e.label });
  });
  return { perRow, byEdge };
}

function feedbackLanes(spec, cells, bottomTaken) {
  const lanes = new Map();
  const perRow = new Map();
  (spec.edges || []).forEach((e, index) => {
    if (e.annotation || bottomTaken.has(e.to)) return;
    const a = cells.get(e.from), b = cells.get(e.to);
    if (b.col >= a.col || (a.row === b.row && a.col - b.col === 1)) return;
    const row = Math.max(a.row, b.row);
    const lane = perRow.get(row) || 0;
    perRow.set(row, lane + 1);
    lanes.set(index, { row, lane, labelled: !!e.label });
  });
  return lanes;
}

function routeFlow(layout, spec, style, cells, grid, lanes, overLaneOf, rowAlign, bottomTaken) {
  const { trunkInset } = style.spacing;
  const box = new Map(layout.nodes.map(n => [n.id, n]));
  // Top-aligned cards differ in height, so a row's straight lines share the middle of its shortest card.
  const rowPort = (row) => (rowAlign === 'top' ? grid.rowY[row] + Math.min(...layout.nodes.filter(n => cells.get(n.id).row === row).map(n => n.height)) / 2 : undefined);
  const occupied = new Map([...cells].map(([id, c]) => [`${c.row},${c.col}`, id]));
  const free = (row, col) => !occupied.has(`${row},${col}`);
  const between = (lo, hi) => Array.from({ length: Math.max(hi - lo - 1, 0) }, (_, i) => lo + 1 + i);
  const edges = spec.edges || [];
  const routes = new Map();
  const uses = [];
  const use = (index, id, which, end) => uses.push({ index, id, which, end });

  // Mirrors the rightward routes, so a line from the right enters the target's right side.
  const intoRightSide = (S, T, a, b, index) => {
    if (a.row === b.row) {
      if (between(b.col, a.col).every(c => free(a.row, c))) {
        use(index, S.id, 'left', 'start'); use(index, T.id, 'right', 'end');
        return straight(side(S, 'left', rowPort(a.row)), side(T, 'right', rowPort(a.row)));
      }
      use(index, S.id, 'top', 'start'); use(index, T.id, 'top', 'end');
      return uRoute(side(S, 'top'), side(T, 'top'), grid.rowY[a.row] - LANE * ((overLaneOf.get(index) ?? 0) + 1) - 6);
    }
    const up = b.row < a.row;
    const columnClear = [...between(Math.min(a.row, b.row), Math.max(a.row, b.row)), b.row].every(r => free(r, a.col));
    if (columnClear && between(b.col, a.col).every(c => free(b.row, c))) {
      use(index, S.id, up ? 'top' : 'bottom', 'start'); use(index, T.id, 'right', 'end');
      return elbow(side(S, up ? 'top' : 'bottom'), side(T, 'right'));
    }
    use(index, S.id, 'left', 'start'); use(index, T.id, 'right', 'end');
    return zRoute(side(S, 'left'), side(T, 'right'), grid.colX[b.col] + grid.colWidth[b.col] + grid.colGaps[b.col] / 2);
  };

  // Fan-outs of three or more into one column share a trunk.
  const fans = new Map();
  edges.forEach((e, index) => {
    if (e.annotation) return;
    const a = cells.get(e.from), b = cells.get(e.to);
    if (b.col <= a.col) return;
    const key = `${e.from}>${b.col}`;
    fans.set(key, [...(fans.get(key) || []), index]);
  });
  const trunked = new Set();
  const fanInTargets = new Set();
  const countByTarget = new Map();
  edges.forEach(e => {
    if (e.annotation) return;
    const a = cells.get(e.from), b = cells.get(e.to);
    if (b.col > a.col) countByTarget.set(`${e.to}<${a.col}`, (countByTarget.get(`${e.to}<${a.col}`) || 0) + 1);
  });
  for (const [key, count] of countByTarget) if (count >= FAN_OUT) fanInTargets.add(key.split('<')[0]);
  const labelWidth = (i) => (edges[i].label ? style.measure(edges[i].label, style.typeScale.edgeLabel) + 20 : 0);
  for (const [key, list] of fans) {
    if (list.length < FAN_OUT) continue;
    const source = box.get(key.split('>')[0]);
    const col = cells.get(edges[list[0]].to).col;
    const trunkX = grid.colX[col] - Math.max(trunkInset, ...list.map(labelWidth));
    const targets = list.map(i => {
      const entry = side(box.get(edges[i].to), 'left');
      return fanInTargets.has(edges[i].to) ? { x: entry.x, y: entry.y - SHARED_TARGET_OFFSET } : entry;
    });
    const { stem, trunk, branches } = trunkRoute(side(source, 'right'), trunkX, targets);
    const main = list.some(i => edges[i].main), dashed = list.every(i => edges[i].style === 'dashed');
    layout.trunks.push({ ...stem, main, dashed }, { ...trunk, main, dashed });
    list.forEach((i, k) => { routes.set(i, branches[k]); trunked.add(i); });
  }

  // Fan-ins of three or more from one column share a trunk too; one stem carries the arrow in.
  const fanIns = new Map();
  edges.forEach((e, index) => {
    if (e.annotation || trunked.has(index)) return;
    const a = cells.get(e.from), b = cells.get(e.to);
    if (b.col <= a.col) return;
    const key = `${e.to}<${a.col}`;
    fanIns.set(key, [...(fanIns.get(key) || []), index]);
  });
  const arrowless = new Set();
  for (const [key, list] of fanIns) {
    if (list.length < FAN_OUT) continue;
    const target = box.get(key.split('<')[0]);
    const trunkX = grid.colX[cells.get(target.id).col] - FAN_IN_INSET;
    const left = side(target, 'left');
    const sharesTarget = [...fans.values()].some(l => l.length >= FAN_OUT && l.some(i => edges[i].to === target.id));
    const entry = sharesTarget ? { x: left.x, y: left.y + SHARED_TARGET_OFFSET } : left;
    const starts = list.map(i => side(box.get(edges[i].from), 'right'));
    const ys = [entry.y, ...starts.map(p => p.y)];
    const dashed = list.every(i => edges[i].style === 'dashed');
    const main = list.some(i => edges[i].main);
    layout.trunks.push({ ...straight({ x: trunkX, y: Math.min(...ys) }, { x: trunkX, y: Math.max(...ys) }), dashed, main });
    layout.trunks.push({ ...straight({ x: trunkX, y: entry.y }, entry), dashed, main, endMarker: 'arrow' });
    list.forEach((i, k) => { routes.set(i, straight(starts[k], { x: trunkX, y: starts[k].y })); trunked.add(i); arrowless.add(i); });
  }

  edges.forEach((e, index) => {
    if (trunked.has(index)) return;
    const S = box.get(e.from), T = box.get(e.to);
    const a = cells.get(e.from), b = cells.get(e.to);
    let section;
    if (e.from === e.to) {
      section = selfLoop(S);
    } else if (e.annotation) {
      if (Math.abs(a.row - b.row) + Math.abs(a.col - b.col) !== 1) throw new SpecError(`annotation edge ${e.from}→${e.to} needs adjacent cells`);
      const [fromSide, toSide] = a.row === b.row ? (b.col > a.col ? ['right', 'left'] : ['left', 'right']) : (b.row > a.row ? ['bottom', 'top'] : ['top', 'bottom']);
      section = straight(side(S, fromSide), side(T, toSide));
    } else if (a.row === b.row && b.col > a.col) {
      if (between(a.col, b.col).every(c => free(a.row, c))) {
        section = straight(side(S, 'right', rowPort(a.row)), side(T, 'left', rowPort(a.row)));
        use(index, e.from, 'right', 'start'); use(index, e.to, 'left', 'end');
      } else {
        const lane = overLaneOf.get(index) ?? 0;
        section = uRoute(side(S, 'top'), side(T, 'top'), grid.rowY[a.row] - LANE * (lane + 1) - 6);
        use(index, e.from, 'top', 'start'); use(index, e.to, 'top', 'end');
      }
    } else if (a.row === b.row && a.col - b.col === 1) {
      section = straight(side(S, 'left', rowPort(a.row)), side(T, 'right', rowPort(a.row)));
      use(index, e.from, 'left', 'start'); use(index, e.to, 'right', 'end');
    } else if (a.col === b.col) {
      const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row);
      if (between(lo, hi).every(r => free(r, a.col)) && !(bottomTaken.has(e.to) && b.row < a.row)) {
        const down = b.row > a.row;
        section = down ? straight(side(S, 'bottom'), side(T, 'top')) : straight(side(S, 'top'), side(T, 'bottom'));
        use(index, e.from, down ? 'bottom' : 'top', 'start'); use(index, e.to, down ? 'top' : 'bottom', 'end');
      } else {
        const gap = a.col < grid.colGaps.length ? grid.colGaps[a.col] : 2 * trunkInset;
        const turnX = grid.colX[a.col] + grid.colWidth[a.col] + gap / 2;
        section = zRoute(side(S, 'right'), side(T, 'right'), turnX);
        use(index, e.from, 'right', 'start'); use(index, e.to, 'right', 'end');
      }
    } else if (b.col > a.col) {
      const up = b.row < a.row;
      const lo = Math.min(a.row, b.row), hi = Math.max(a.row, b.row);
      const columnClear = [...between(lo, hi), b.row].every(r => free(r, a.col));
      const rowClear = between(a.col, b.col).every(c => free(b.row, c));
      if (columnClear && rowClear) {
        section = elbow(side(S, up ? 'top' : 'bottom'), side(T, 'left'));
        use(index, e.from, up ? 'top' : 'bottom', 'start'); use(index, e.to, 'left', 'end');
      } else {
        const turnX = grid.colX[b.col] - grid.colGaps[b.col - 1] / 2;
        section = zRoute(side(S, 'right'), side(T, 'left'), turnX);
        use(index, e.from, 'right', 'start'); use(index, e.to, 'left', 'end');
      }
    } else if (bottomTaken.has(e.to)) {
      section = intoRightSide(S, T, a, b, index);
    } else {
      const { row, lane } = lanes.get(index);
      const laneY = grid.rowY[row] + grid.rowHeight[row] + LANE * (lane + 1);
      section = uRoute(side(S, 'bottom'), side(T, 'bottom'), laneY);
      use(index, e.from, 'bottom', 'start'); use(index, e.to, 'bottom', 'end');
    }
    routes.set(index, section);
  });

  spreadSharedPorts(routes, uses, box, edges, cells);
  const labelSide = separateOpposing(routes, edges, box);

  edges.forEach((e, index) => {
    const section = routes.get(index);
    const below = lanes.has(index) || !!labelSide.get(index)?.below;
    const labels = e.label ? [labelFor(section, e.label, style, layout.groups, { below, left: !!labelSide.get(index)?.left })] : [];
    layout.edges.push(arrowless.has(index) ? { index, sections: [section], labels, arrow: false } : { index, sections: [section], labels });
  });
}

// A transition each way between two states: straight pairs move apart, and each label goes on its line's outer side.
function separateOpposing(routes, edges, box) {
  const labelSide = new Map();
  edges.forEach((e, i) => {
    const j = edges.findIndex(f => f.from === e.to && f.to === e.from);
    if (e.from === e.to || j <= i) return;
    const first = routes.get(i), second = routes.get(j);
    if (first.bendPoints.length || second.bendPoints.length) return;
    const S = box.get(e.from);
    const move = (section, axis, value) => { section.startPoint[axis] = value; section.endPoint[axis] = value; };
    if (first.startPoint.x === first.endPoint.x) {
      const centre = S.x + S.width / 2;
      move(first, 'x', centre - OPPOSING_APART.vertical); move(second, 'x', centre + OPPOSING_APART.vertical);
      labelSide.set(i, { left: true });
    } else {
      const centre = S.y + S.height / 2;
      move(first, 'y', centre - OPPOSING_APART.horizontal); move(second, 'y', centre + OPPOSING_APART.horizontal);
      labelSide.set(j, { below: true });
    }
  });
  return labelSide;
}

// Several ends on one side of a card move apart 12 units, ordered by where the other end lies.
function spreadSharedPorts(routes, uses, box, edges, cells) {
  const bySide = new Map();
  for (const u of uses) {
    const key = `${u.id}:${u.which}`;
    bySide.set(key, [...(bySide.get(key) || []), u]);
  }
  for (const list of bySide.values()) {
    if (list.length < 2) continue;
    const { id, which } = list[0];
    const vertical = which === 'left' || which === 'right';
    const otherEnd = (u) => {
      const s = routes.get(u.index);
      return u.end === 'start' ? s.endPoint : s.startPoint;
    };
    list.sort((m, n) => (vertical ? otherEnd(m).y - otherEnd(n).y : otherEnd(m).x - otherEnd(n).x));
    const ports = spreadPorts(box.get(id), which, list.length);
    list.forEach((u, k) => movePort(routes.get(u.index), u.end, ports[k], vertical));
  }
}

function movePort(section, end, port, vertical) {
  const key = end === 'start' ? 'startPoint' : 'endPoint';
  const point = section[key];
  const delta = vertical ? port.y - point.y : port.x - point.x;
  const axis = vertical ? 'y' : 'x';
  const neighbour = section.bendPoints.length
    ? section.bendPoints[end === 'start' ? 0 : section.bendPoints.length - 1]
    : section[end === 'start' ? 'endPoint' : 'startPoint'];
  if (neighbour[axis] === point[axis]) neighbour[axis] += delta;
  point[axis] += delta;
}
