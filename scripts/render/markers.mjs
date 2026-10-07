export const MARKERS = ['none', 'arrow', 'one', 'many', 'triangle'];

/** Shape of a line-end marker at `tip`, for a line arriving from `from`. Units run back along the line (t) and across it (s). */
export function markerShape(kind, tip, from) {
  const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
  const ux = (tip.x - from.x) / length, uy = (tip.y - from.y) / length;
  const at = (t, s) => ({ x: tip.x - ux * t - uy * s, y: tip.y - uy * t + ux * s });
  if (kind === 'one') return { segments: [[at(10, -8), at(10, 8)], [at(17, -8), at(17, 8)]] };
  if (kind === 'many') return { segments: [[at(17, 0), at(0, -9)], [at(17, 0), at(0, 0)], [at(17, 0), at(0, 9)], [at(25, -8), at(25, 8)]] };
  if (kind === 'triangle') return { polygon: [tip, at(18, -11), at(18, 11)] };
  return null;
}
