const LABEL_HEIGHT = 18;
const LABEL_PAD = 10;
const LABEL_LIFT = 6;
const LABEL_SIDE = 12;
const END_LABEL_BACK = 10;
const END_LABEL_CLEAR = 12;

export const side = (box, which, y = box.y + box.height / 2) => ({
  left: { x: box.x, y },
  right: { x: box.x + box.width, y },
  top: { x: box.x + box.width / 2, y: box.y },
  bottom: { x: box.x + box.width / 2, y: box.y + box.height },
}[which]);

const LOOP_RISE = 32;

/** A state's transition to itself: a loop on the top edge's left part, so the centre stays free for edges over the top. */
export function selfLoop(box) {
  const out = box.x + box.width * 0.1, back = box.x + box.width * 0.4, top = box.y - LOOP_RISE;
  return { startPoint: { x: out, y: box.y }, endPoint: { x: back, y: box.y }, bendPoints: [{ x: out, y: top }, { x: back, y: top }] };
}

export const straight = (from, to) => ({ startPoint: from, endPoint: to, bendPoints: [] });
export const elbow = (from, to) => ({ startPoint: from, endPoint: to, bendPoints: [{ x: from.x, y: to.y }] });
export const zRoute = (from, to, turnX) => ({ startPoint: from, endPoint: to, bendPoints: [{ x: turnX, y: from.y }, { x: turnX, y: to.y }] });
export const uRoute = (from, to, laneY) => ({ startPoint: from, endPoint: to, bendPoints: [{ x: from.x, y: laneY }, { x: to.x, y: laneY }] });

export function trunkRoute(stemFrom, trunkX, targets) {
  const ys = [stemFrom.y, ...targets.map(t => t.y)];
  return {
    stem: straight(stemFrom, { x: trunkX, y: stemFrom.y }),
    trunk: straight({ x: trunkX, y: Math.min(...ys) }, { x: trunkX, y: Math.max(...ys) }),
    branches: targets.map(t => straight({ x: trunkX, y: t.y }, t)),
  };
}

export function spreadPorts(box, which, count, gap = 12) {
  const mid = side(box, which);
  const vertical = which === 'left' || which === 'right';
  return Array.from({ length: count }, (_, i) => {
    const offset = (i - (count - 1) / 2) * gap;
    return vertical ? { x: mid.x, y: mid.y + offset } : { x: mid.x + offset, y: mid.y };
  });
}


const segmentsOf = (section) => {
  const pts = [section.startPoint, ...section.bendPoints, section.endPoint];
  return pts.slice(1).map((p, i) => [pts[i], p]);
};

// Splits a segment at every group border it crosses and returns the longest clear piece.
function clearPiece([a, b], groups) {
  const horizontal = a.y === b.y;
  const lo = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y);
  const hi = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y);
  const cuts = [lo, hi];
  for (const g of groups) {
    const spans = horizontal ? a.y >= g.y && a.y <= g.y + g.height : a.x >= g.x && a.x <= g.x + g.width;
    if (!spans) continue;
    for (const edge of horizontal ? [g.x, g.x + g.width] : [g.y, g.y + g.height]) if (edge > lo && edge < hi) cuts.push(edge);
  }
  cuts.sort((m, n) => m - n);
  let best = [lo, hi], bestLength = -1;
  for (let i = 1; i < cuts.length; i++) if (cuts[i] - cuts[i - 1] > bestLength) { best = [cuts[i - 1], cuts[i]]; bestLength = cuts[i] - cuts[i - 1]; }
  return horizontal ? [{ x: best[0], y: a.y }, { x: best[1], y: a.y }] : [{ x: a.x, y: best[0] }, { x: a.x, y: best[1] }];
}

/** Puts a label beside the longest horizontal segment, else the longest vertical one, clear of group borders. */
export function labelFor(section, text, style, groups = [], { below = false, left = false } = {}) {
  const width = Math.ceil(style.measure(text, style.typeScale.edgeLabel, 400)) + LABEL_PAD;
  const segments = segmentsOf(section);
  const length = ([a, b]) => Math.hypot(b.x - a.x, b.y - a.y);
  const longest = (list) => list.reduce((best, s) => (length(s) > length(best) ? s : best));
  const horizontal = segments.filter(([a, b]) => a.y === b.y && a.x !== b.x);
  if (horizontal.length) {
    const [a, b] = clearPiece(longest(horizontal), groups);
    const y = below ? a.y + LABEL_LIFT : a.y - LABEL_LIFT - LABEL_HEIGHT;
    return { text, x: (a.x + b.x) / 2 - width / 2, y, width, height: LABEL_HEIGHT };
  }
  const [a, b] = clearPiece(longest(segments), groups);
  return { text, x: left ? a.x - LABEL_SIDE - width : a.x + LABEL_SIDE, y: (a.y + b.y) / 2 - LABEL_HEIGHT / 2, width, height: LABEL_HEIGHT };
}

/** Puts short text beside one end of a route: below a horizontal end segment, right of a vertical one. */
export function endLabelFor(section, text, end, style) {
  const width = Math.ceil(style.measure(text, style.typeScale.edgeLabel, 400)) + LABEL_PAD;
  const points = [section.startPoint, ...section.bendPoints, section.endPoint];
  const [tip, from] = end === 'end' ? [points[points.length - 1], points[points.length - 2]] : [points[0], points[1]];
  if (tip.y === from.y) {
    const x = from.x < tip.x ? tip.x - END_LABEL_BACK - width : tip.x + END_LABEL_BACK;
    return { text, end, x, y: tip.y + END_LABEL_CLEAR, width, height: LABEL_HEIGHT };
  }
  const y = from.y < tip.y ? tip.y - END_LABEL_BACK - LABEL_HEIGHT : tip.y + END_LABEL_BACK;
  return { text, end, x: tip.x + END_LABEL_CLEAR, y, width, height: LABEL_HEIGHT };
}

/** Shortest distance from a label box to a route. 0 when they touch. */
export function boxDistanceToSection(box, section) {
  let best = Infinity;
  for (const [a, b] of segmentsOf(section)) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps, y = a.y + ((b.y - a.y) * i) / steps;
      const dx = Math.max(box.x - x, 0, x - (box.x + box.width));
      const dy = Math.max(box.y - y, 0, y - (box.y + box.height));
      best = Math.min(best, Math.hypot(dx, dy));
    }
  }
  return best;
}
