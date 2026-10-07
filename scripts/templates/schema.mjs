import { flowLayout } from './flow.mjs';
import { side, straight, zRoute, labelFor, boxDistanceToSection } from './route.mjs';

const LANE = 16;
const MARKER_CLEAR = 30;
const LABEL_PAD = 10;
const LABEL_SIDE = 12;
const LOOP_OUT = 44;
const OUTER_LANE = 40;
const MAX_ORDERED_LANES = 6;
const NEAR_GAP = 40;
const LABEL_CLEAR = 8;
// Lanes this far apart keep two runs on one track from reading as one line.
const WIDE_LANE = LANE + NEAR_GAP;
// A zone keeps the one and many markers off its border.
const ZONE_PAD = 40;
const BORDER_CLEAR = 16;
const LABEL_HEIGHT = 18;
const CORNER_CLEAR = 10;

const portKey = (id, which, column) => `${id}:${which}:${column}`;
const labelWidth = (text, style) => (text ? Math.ceil(style.measure(text, style.typeScale.edgeLabel, 400)) + LABEL_PAD : 0);

/** Decides each relation's shape, sides and lane gap from the grid cells alone. */
function planEdges(spec, cells) {
  const edges = spec.edges || [];
  const columnIndex = (id, name) => spec.nodes.find(n => n.id === id).columns.findIndex(c => c.name === name);
  const colCount = 1 + Math.max(...[...cells.values()].map(c => c.col));
  const plans = edges.map((e, index) => {
    const a = cells.get(e.from), b = cells.get(e.to);
    if (e.from === e.to) return { index, kind: 'self', fromSide: 'right', toSide: 'right' };
    if (a.col === b.col) return { index, kind: 'c' };
    const right = b.col > a.col;
    const level = a.row === b.row && columnIndex(e.from, e.fromColumn) === columnIndex(e.to, e.toColumn);
    return { index, kind: level ? 'straight' : 'z', fromSide: right ? 'right' : 'left', toSide: right ? 'left' : 'right', gap: right ? b.col - 1 : b.col };
  });
  // A laned line may end where another laned line ends, since the two merge; every other shared port is taken.
  const starts = new Set(), lanedEnds = new Set(), fixedEnds = new Set();
  const claim = (p) => {
    const e = edges[p.index];
    starts.add(portKey(e.from, p.fromSide, e.fromColumn));
    (p.kind === 'z' || p.kind === 'c' ? lanedEnds : fixedEnds).add(portKey(e.to, p.toSide, e.toColumn));
  };
  plans.filter(p => p.kind !== 'c').forEach(claim);
  for (const p of plans.filter(q => q.kind === 'c')) {
    const e = edges[p.index], col = cells.get(e.from).col;
    const free = (which) => {
      const start = portKey(e.from, which, e.fromColumn), end = portKey(e.to, which, e.toColumn);
      return ![starts, lanedEnds, fixedEnds].some(set => set.has(start)) && !starts.has(end) && !fixedEnds.has(end);
    };
    const which = free('right') || !free('left') ? 'right' : 'left';
    const gap = which === 'right' ? (col < colCount - 1 ? col : 'right') : (col > 0 ? col - 1 : 'left');
    Object.assign(p, { fromSide: which, toSide: which, gap });
    claim(p);
  }
  for (const p of plans) {
    const e = edges[p.index];
    p.colIndex = { from: columnIndex(e.from, e.fromColumn), to: columnIndex(e.to, e.toColumn) };
    // Relations that end at one column on one side share a lane, so they merge into one line at that column.
    p.merge = portKey(e.to, p.toSide, e.toColumn);
  }
  return plans;
}

// Room a self-relation takes on its table's right: the loop, then its label.
function loopReserve(spec, plans, cells, col, style) {
  const reach = plans.filter(p => p.kind === 'self' && cells.get(spec.edges[p.index].from).col === col)
    .map(p => LOOP_OUT + LABEL_SIDE + labelWidth(spec.edges[p.index].label, style) + LABEL_SIDE);
  return Math.max(0, ...reach);
}

const segmentsOf = (s) => {
  const points = [s.startPoint, ...s.bendPoints, s.endPoint];
  return points.slice(1).map((q, i) => [points[i], q]);
};

// Lines on one track, or close enough end to end to read as one line, cost the most; then crossings.
function pairCost(s, t) {
  let cost = 0;
  for (const [a, b] of segmentsOf(s)) {
    for (const [c, d] of segmentsOf(t)) {
      const sVertical = a.x === b.x, tVertical = c.x === d.x;
      if (sVertical === tVertical) {
        const axis = sVertical ? 'y' : 'x', across = sVertical ? Math.abs(a.x - c.x) : Math.abs(a.y - c.y);
        if (across > 1) continue;
        const overlap = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) - Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
        if (overlap > 4 || (overlap <= 0 && -overlap < NEAR_GAP)) cost += 1000;
        continue;
      }
      const [h, v] = sVertical ? [[c, d], [a, b]] : [[a, b], [c, d]];
      const x = v[0].x, y = h[0].y;
      if (x > Math.min(h[0].x, h[1].x) && x < Math.max(h[0].x, h[1].x) && y > Math.min(v[0].y, v[1].y) && y < Math.max(v[0].y, v[1].y)) cost += 1;
    }
  }
  return cost;
}

function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(rest => [item, ...rest]));
}

const touches = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Label above the first run, beside the FK, else below it, else beside the vertical run: the first spot clear of other lines and labels. */
function relationLabel(section, text, style, groups, outward, others, placed, { crowded = false, ownLast = false, neighbourOnFirst = false } = {}) {
  const first = straight(section.startPoint, section.bendPoints[0] ?? section.endPoint);
  const last = straight(section.bendPoints[section.bendPoints.length - 1] ?? section.startPoint, section.endPoint);
  const vertical = section.bendPoints.length ? [{ run: 'vertical', box: labelFor(straight(section.bendPoints[0], section.bendPoints[1]), text, style, groups, { left: outward === 'left' }) }] : [];
  const beside = (run, name) => (Math.abs(run.endPoint.x - run.startPoint.x) >= labelWidth(text, style) + 2 * MARKER_CLEAR
    ? [labelFor(run, text, style, groups), labelFor(run, text, style, groups, { below: true })].map(box => ({ run: name, box })) : []);
  const usual = [...beside(first, 'first'), ...vertical];
  const corner = () => {
    const [bend, next] = section.bendPoints, width = labelWidth(text, style);
    const y = next.y < bend.y ? bend.y - CORNER_CLEAR - LABEL_HEIGHT : bend.y + CORNER_CLEAR;
    return [{ run: 'vertical', box: { text, x: outward === 'left' ? bend.x - LABEL_SIDE - width : bend.x + LABEL_SIDE, y, width, height: LABEL_HEIGHT } }];
  };
  // Two labels beside close parallel runs read as labelling either line, so one moves to its own last run or beside its first corner.
  const preferred = crowded ? [...(ownLast && section.bendPoints.length ? beside(last, 'last') : []), ...(neighbourOnFirst ? [] : beside(first, 'first')), ...(section.bendPoints.length ? corner() : []), ...vertical] : usual;
  const clear = ({ box }) => others.every(o => boxDistanceToSection(box, o) >= LABEL_CLEAR) && placed.every(l => !touches(box, l));
  return [...preferred, ...usual].find(clear) ?? usual[0] ?? { run: 'first', box: labelFor(section, text, style, groups) };
}

// Labelled relations whose first runs lie parallel and closer than NEAR_GAP over a shared stretch.
function closeFirstRuns(edges, plans, routed) {
  const firstOf = (i) => { const s = routed.get(i); return [s.startPoint, s.bendPoints[0] ?? s.endPoint]; };
  const close = new Map(edges.map((_, i) => [i, []]));
  edges.forEach((e, i) => edges.forEach((f, j) => {
    if (i === j || !e.label || !f.label || plans[i].merge === plans[j].merge) return;
    const [a, b] = firstOf(i), [c, d] = firstOf(j);
    if (a.y !== b.y || c.y !== d.y || Math.abs(a.y - c.y) >= NEAR_GAP) return;
    if (Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) > Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x))) close.get(i).push(j);
  }));
  return close;
}

// Zones holding each table, its own and every zone around it.
function zonesOf(spec) {
  const parent = new Map();
  for (const g of spec.groups || []) for (const member of g.contains) parent.set(member, g.id);
  const chain = (id) => (parent.has(id) ? [parent.get(id), ...chain(parent.get(id))] : []);
  return new Map(spec.nodes.map(n => [n.id, new Set(chain(n.id))]));
}

const union = (a, b) => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

function makeRouter(spec) {
  const edges = spec.edges || [];
  const zones = zonesOf(spec);
  // Zones holding one end only; an outer lane runs outside their borders.
  const zonesLeft = (p) => {
    const a = zones.get(edges[p.index].from), b = zones.get(edges[p.index].to);
    return Math.max([...a].filter(z => !b.has(z)).length, [...b].filter(z => !a.has(z)).length);
  };
  const outerLane = (gap, style) => Math.max(OUTER_LANE, ...plans.filter(p => p.gap === gap).map(p => zonesLeft(p) * style.spacing.groupPad + BORDER_CLEAR));
  let plans = [];
  return {
    gaps(colGaps, cells, style) {
      plans = planEdges(spec, cells);
      colGaps.forEach((gap, g) => {
        const lanes = plans.filter(p => (p.kind === 'z' || p.kind === 'c') && p.gap === g);
        const laneCount = new Set(lanes.map(p => p.merge)).size;
        const laneNeed = lanes.length ? Math.max(...lanes.map(p => 2 * (labelWidth(edges[p.index].label, style) + 2 * MARKER_CLEAR))) + (laneCount - 1) * WIDE_LANE : 0;
        const level = plans.filter(p => p.kind === 'straight' && Math.min(cells.get(edges[p.index].from).col, cells.get(edges[p.index].to).col) === g);
        const levelNeed = Math.max(0, ...level.map(p => labelWidth(edges[p.index].label, style) + 2 * MARKER_CLEAR));
        colGaps[g] = Math.max(gap, loopReserve(spec, plans, cells, g, style) + Math.max(laneNeed, levelNeed));
      });
    },

    extents(boxes, sizes, cells, style) {
      const extents = new Map();
      const portY = (id, row) => boxes.get(id).y + sizes.get(id).rows[row].y;
      for (const p of plans) {
        const e = edges[p.index];
        const ys = [portY(e.from, p.colIndex.from), portY(e.to, p.colIndex.to)];
        const top = Math.min(...ys) - LANE, height = Math.max(...ys) - top + LANE;
        const box = boxes.get(e.from);
        if (p.kind === 'self') {
          const reach = LOOP_OUT + LABEL_SIDE + labelWidth(e.label, style);
          const extent = { x: box.x + box.width, y: top, width: reach, height };
          extents.set(e.from, extents.has(e.from) ? union(extents.get(e.from), extent) : extent);
        } else if (p.gap === 'left' || p.gap === 'right') {
          const laneCount = new Set(plans.filter(q => q.gap === p.gap).map(q => q.merge)).size;
          const reserve = p.gap === 'right' ? loopReserve(spec, plans, cells, cells.get(e.from).col, style) : 0;
          const reach = reserve + outerLane(p.gap, style) + (laneCount - 1) * WIDE_LANE + LABEL_SIDE + labelWidth(e.label, style);
          const x = p.gap === 'right' ? box.x + box.width : box.x - reach;
          const extent = { x, y: top, width: reach, height };
          // A lane between two tables of one zone grows that zone, so it runs inside it.
          if (zonesLeft(p) === 0 && zones.get(e.from).size) extents.set(e.from, extents.has(e.from) ? union(extents.get(e.from), extent) : extent);
          else extents.set(`edge:${p.index}`, extent);
        }
      }
      return extents;
    },

    route(layout, _spec, style, cells, grid) {
      const box = new Map(layout.nodes.map(n => [n.id, n]));
      const port = (id, which, row) => { const n = box.get(id); return side(n, which, n.y + n.rows[row].y); };
      const ends = (p) => { const e = edges[p.index]; return [port(e.from, p.fromSide, p.colIndex.from), port(e.to, p.toSide, p.colIndex.to)]; };
      const sectionFor = (p, laneX) => {
        const [from, to] = ends(p);
        if (p.kind === 'straight') return straight(from, to);
        if (p.kind === 'self') return zRoute(from, to, from.x + LOOP_OUT);
        return zRoute(from, to, laneX);
      };
      const fixed = plans.filter(p => p.kind === 'straight' || p.kind === 'self').map(p => ({ p, section: sectionFor(p) }));
      const placed = [];
      const laned = plans.filter(p => p.kind === 'z' || p.kind === 'c');
      for (const gap of new Set(laned.map(p => p.gap))) {
        const lanes = laned.filter(p => p.gap === gap);
        const keys = [...new Set(lanes.map(p => p.merge))];
        const positionsAt = (spacing) => {
          if (gap === 'left' || gap === 'right') {
            const sample = box.get(edges[lanes[0].index].from);
            const reserve = gap === 'right' ? loopReserve(spec, plans, cells, cells.get(sample.id).col, style) : 0;
            const out = outerLane(gap, style);
            return keys.map((_, i) => (gap === 'right' ? sample.x + sample.width + reserve + out + i * spacing : sample.x - out - i * spacing));
          }
          const left = grid.colX[gap] + grid.colWidth[gap] + loopReserve(spec, plans, cells, gap, style), right = grid.colX[gap + 1];
          return keys.map((_, i) => (left + right) / 2 + (i - (keys.length - 1) / 2) * spacing);
        };
        const orders = keys.length <= MAX_ORDERED_LANES ? permutations(keys) : [keys];
        let best = null;
        for (const [positions, order] of [LANE, WIDE_LANE].flatMap(spacing => orders.map(order => [positionsAt(spacing), order]))) {
          const trial = lanes.map(p => ({ p, section: sectionFor(p, positions[order.indexOf(p.merge)]) }));
          let cost = 0;
          for (let i = 0; i < trial.length; i++) {
            for (const other of [...trial.slice(i + 1), ...fixed, ...placed]) if (other.p.merge !== trial[i].p.merge) cost += pairCost(trial[i].section, other.section);
          }
          if (!best || cost < best.cost) best = { cost, trial };
        }
        placed.push(...best.trial);
      }
      const routed = new Map([...fixed, ...placed].map(({ p, section }) => [p.index, section]));
      const placedLabels = [];
      const close = closeFirstRuns(edges, plans, routed);
      const runOf = new Map();
      edges.forEach((e, index) => {
        const plan = plans[index], section = routed.get(index);
        const others = [...routed].filter(([i]) => i !== index).map(([, other]) => other);
        const options = {
          crowded: close.get(index).some(j => !runOf.has(j) || runOf.get(j) === 'first'),
          ownLast: plans.filter(p => p.merge === plan.merge).length === 1,
          neighbourOnFirst: close.get(index).some(j => runOf.get(j) === 'first'),
        };
        const chosen = e.label ? relationLabel(section, e.label, style, layout.groups, plan.fromSide, others, placedLabels, options) : null;
        if (chosen) runOf.set(index, chosen.run);
        const labels = chosen ? [chosen.box] : [];
        placedLabels.push(...labels);
        layout.edges.push({ index, sections: [{ ...section, startMarker: e.ends[0], endMarker: e.ends[1] }], labels });
      });
    },
  };
}

/** Tables on a flow grid with rows aligned on their top edge; relations run from column row to column row. */
export function schemaLayout(spec, style) {
  const roomy = { ...style, spacing: { ...style.spacing, groupPad: Math.max(style.spacing.groupPad, ZONE_PAD) } };
  return flowLayout(spec, roomy, { rowAlign: 'top', router: makeRouter(spec) });
}
