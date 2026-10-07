// Drawing helpers shared by the hand-made styles.
export const pts = (p) => p.map(q => `${q.x},${q.y}`).join(' ');
export const pathOf = (p) => p.map((q, i) => `${i ? 'L' : 'M'}${q.x},${q.y}`).join(' ');
export const rectPts = ({ x, y, width: w, height: h }) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
export const diamondPts = ({ x, y, width: w, height: h }) => [{ x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 }];

/** Points around a rounded rectangle, six per corner. */
export function roundedPts({ x, y, width: w, height: h }, r) {
  const out = [];
  const arc = (cx, cy, from) => { for (let i = 0; i <= 5; i++) { const a = (from + i * 18) * Math.PI / 180; out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); } };
  arc(x + w - r, y + r, -90); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, 90); arc(x + r, y + r, 180);
  return out;
}

/** One straight run drawn by hand: points along it pushed off the line by seeded noise, ends kept exact. */
export function handPath(a, b, random, wobble = 1, step = 30) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, n = Math.max(2, Math.round(len / step));
  const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  let d = `M${a.x},${a.y}`;
  for (let i = 1; i <= n; i++) {
    const t = i / n, o = i === n ? 0 : (random() - 0.5) * 2 * wobble;
    d += ` L${a.x + (b.x - a.x) * t + nx * o},${a.y + (b.y - a.y) * t + ny * o}`;
  }
  return d;
}

export const handPoly = (p, random, wobble, step) => [...p, p[0]].slice(1).map((q, i) => handPath(p[i], q, random, wobble, step)).join(' ');
export const handLine = (p, random, wobble, step) => p.slice(1).map((q, i) => handPath(p[i], q, random, wobble, step)).join(' ');

/** Two strokes from an arrow tip, as a path fragment. */
export function vHead(tip, from, length, spread) {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1, ux = (tip.x - from.x) / len, uy = (tip.y - from.y) / len;
  const wing = (s) => `M${tip.x - ux * length - s * uy * spread},${tip.y - uy * length + s * ux * spread} L${tip.x},${tip.y}`;
  return `${wing(1)} ${wing(-1)}`;
}
