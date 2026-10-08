// Hard gate: any text or box overlapping a foreign element fails the render (PRD R3).
const EPSILON = 0.5;

function overlap(a, b) {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.width, b.x + b.width) - x;
  const h = Math.min(a.y + a.height, b.y + b.height) - y;
  if (w > EPSILON && h > EPSILON) return { x, y, width: w, height: h };
  return null;
}

function allowed(a, b) {
  if (a.owner === b.owner) return true;                        // element vs its own parts
  return false;
}

export function checkCollisions(geometry) {
  const out = [];
  for (let i = 0; i < geometry.length; i++) {
    for (let j = i + 1; j < geometry.length; j++) {
      const a = geometry[i], b = geometry[j];
      if (allowed(a, b)) continue;
      const ov = overlap(a, b);
      if (ov) out.push({ a: `${a.kind}:${a.owner}`, b: `${b.kind}:${b.owner}`, overlap: ov });
    }
  }
  return out;
}
