import { measureText } from '../text-metrics.mjs';
import { ICONS, ICON_BOX } from '../render/icons.mjs';
import { escapeXml } from '../render/xml.mjs';
import { markerShape } from '../render/markers.mjs';

const HATCH_GAP = 9;
const HATCH_ANGLE = -41;
const NOTE_FOLD = 14;
const STATE_RADIUS = 18;

const palette = {
  background: '#FFFDF6', ink: '#27272A', sub: '#57534E', line: '#3A3A40', main: '#27272A',
  label: '#57534E', border: '#3A3A40', accent: '#2563EB',
  tones: {
    grey: { fill: '#A8A29E', border: '#A8A29E', text: '#78716C' },
    blue: { fill: '#2563EB', border: '#2563EB', text: '#2563EB' },
    green: { fill: '#15964A', border: '#15964A', text: '#15964A' },
    orange: { fill: '#E07B12', border: '#E07B12', text: '#C2410C' },
    red: { fill: '#D23B3B', border: '#D23B3B', text: '#D23B3B' },
    purple: { fill: '#7C3AED', border: '#7C3AED', text: '#7C3AED' },
  },
};

// rough.js line model: two bowed bezier strokes with jittered ends, damped on long lines.
function roughSegment(x1, y1, x2, y2, random, { roughness = 1, bowing = 1, maxOffset = 2, double = true } = {}) {
  const lengthSq = (x1 - x2) ** 2 + (y1 - y2) ** 2, length = Math.sqrt(lengthSq);
  const gain = length < 200 ? 1 : length > 500 ? 0.4 : -0.0016668 * length + 1.233334;
  let offset = maxOffset;
  if (offset * offset * 100 > lengthSq) offset = length / 10;
  const jitter = (x) => roughness * gain * (random() * 2 * x - x);
  const stroke = (overlay) => {
    const amount = overlay ? offset / 2 : offset;
    const diverge = 0.2 + random() * 0.2;
    const midX = jitter(bowing * maxOffset * (y2 - y1) / 200), midY = jitter(bowing * maxOffset * (x1 - x2) / 200);
    const r = () => jitter(amount);
    return `M${x1 + r()},${y1 + r()} C${midX + x1 + (x2 - x1) * diverge + r()},${midY + y1 + (y2 - y1) * diverge + r()} `
      + `${midX + x1 + 2 * (x2 - x1) * diverge + r()},${midY + y1 + 2 * (y2 - y1) * diverge + r()} ${x2 + r()},${y2 + r()}`;
  };
  return double ? `${stroke(false)} ${stroke(true)}` : stroke(false);
}

function roughPolygon(points, random, options) {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length];
    return roughSegment(p.x, p.y, q.x, q.y, random, options);
  }).join(' ');
}

const corners = ({ x, y, width: w, height: h }) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];

// Points around a rounded rectangle, six per corner, closed.
function roundedOutline({ x, y, width: w, height: h }, r) {
  const points = [];
  const arc = (cx, cy, from) => { for (let i = 0; i <= 5; i++) { const a = (from + i * 18) * Math.PI / 180; points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }); } };
  arc(x + w - r, y + r, -90); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, 90); arc(x + r, y + r, 180);
  return [...points, points[0]];
}

export function hachureLines({ x, y, width, height }, gap = HATCH_GAP, angle = HATCH_ANGLE) {
  const a = angle * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const projections = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(([px, py]) => px * nx + py * ny);
  const lines = [];
  for (let c = Math.min(...projections) + gap / 2; c < Math.max(...projections); c += gap) {
    let t0 = -Infinity, t1 = Infinity;
    for (const [origin, direction, lo, hi] of [[c * nx, dx, x, x + width], [c * ny, dy, y, y + height]]) {
      const ta = (lo - origin) / direction, tb = (hi - origin) / direction;
      t0 = Math.max(t0, Math.min(ta, tb));
      t1 = Math.min(t1, Math.max(ta, tb));
    }
    if (t1 - t0 > 6) lines.push([c * nx + t0 * dx, c * ny + t0 * dy, c * nx + t1 * dx, c * ny + t1 * dy]);
  }
  return lines;
}

const stroked = (d, color, width, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

export default {
  name: 'crayon',
  fonts: ['Inter-Regular.ttf', 'Inter-SemiBold.ttf'],
  fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
  typeScale: { title: 16, titleWeight: 600, sub: 13, edgeLabel: 13, groupLabel: 14, lineHeight: 1.3 },
  cardSize: { padX: 16, padY: 14, iconSize: 24, iconGap: 10, minWidth: 200, maxWidth: 360, radius: 0 },
  spacing: { colGap: 128, rowGap: 36, stackGap: 30, groupPad: 24, groupLabelBand: 30, sideGap: 300, trunkInset: 70 },
  palette,
  layerFilter: 'grain',
  labelHalo: true,

  measure(text, size, weight = 400) {
    return measureText(text, size, weight);
  },

  groupFill() {
    return palette.background;
  },

  // draw.mjs applies the grain to the whole edge layer; a filter on one zero-area line would clip it in resvg.
  defs() {
    return '<filter id="grain" x="-2%" y="-2%" width="104%" height="104%">'
      + '<feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="7" result="noise"/>'
      + '<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.4 2.05" result="mask"/>'
      + '<feComposite in="SourceGraphic" in2="mask" operator="in"/></filter>';
  },

  group({ box, depth, tone, boundary }, { random }) {
    const t = palette.tones[tone] || palette.tones.grey;
    const plainPaper = depth > 0 && boundary === 'dashed';
    const outlineOnly = depth === 0 && !tone;
    const hatch = plainPaper || outlineOnly ? '' : stroked(
      hachureLines({ x: box.x + 4, y: box.y + 4, width: box.width - 8, height: box.height - 8 })
        .map(([x1, y1, x2, y2]) => roughSegment(x1, y1, x2, y2, random, { maxOffset: 1.2, double: false })).join(' '),
      t.fill, 1.5, ' stroke-opacity="0.4"');
    const paper = plainPaper ? `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="${palette.background}"/>` : '';
    return paper + hatch + stroked(roughPolygon(corners(box), random, { maxOffset: 2.2 }), t.border, outlineOnly ? 1.6 : 2);
  },

  card({ box, kind = 'card', emphasis, tone, dividers = [] }, { random }) {
    const { x, y, width: w, height: h } = box;
    if (kind === 'table') {
      const header = dividers[0];
      const tint = (palette.tones[tone] || palette.tones.grey).fill;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF"/>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${header}" fill="${tint}" fill-opacity="0.16"/>`
        + stroked(roughSegment(x, y + header, x + w, y + header, random, { maxOffset: 1.2 }), palette.line, 1.5)
        + stroked(roughPolygon(corners(box), random, { maxOffset: 2 }), palette.line, 1.9);
    }
    if (kind === 'class') {
      const t = palette.tones[tone];
      const tint = t ? `<rect x="${x}" y="${y}" width="${w}" height="${dividers[0] ?? h}" fill="${t.fill}" fill-opacity="0.16"/>` : '';
      const rules = dividers.map(d => roughSegment(x, y + d, x + w, y + d, random, { maxOffset: 1.2 })).join(' ');
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF"/>` + tint
        + stroked(`${roughPolygon(corners(box), random, { maxOffset: 2 })} ${rules}`, palette.line, 1.9);
    }
    if (kind === 'start') return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="10" fill="${palette.ink}"/>`;
    if (kind === 'end') {
      return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="13" fill="none" stroke="${palette.ink}" stroke-width="2"/>`
        + `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="7" fill="${palette.ink}"/>`;
    }
    if (kind === 'state') {
      const t = palette.tones[tone];
      const tint = t ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${STATE_RADIUS}" fill="${t.fill}" fill-opacity="0.16"/>` : '';
      const outline = roundedOutline(box, STATE_RADIUS);
      const strokes = outline.slice(1).map((p, i) => roughSegment(outline[i].x, outline[i].y, p.x, p.y, random, { maxOffset: 1.2 })).join(' ');
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${STATE_RADIUS}" fill="#FFFFFF"/>` + tint + stroked(strokes, palette.line, 1.9);
    }
    if (kind === 'bar') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF"/>` + stroked(roughPolygon(corners(box), random, { maxOffset: 0.8 }), palette.line, 1.4);
    if (kind === 'decision') {
      const points = [{ x: x + w / 2, y }, { x: x + w, y: y + h / 2 }, { x: x + w / 2, y: y + h }, { x, y: y + h / 2 }];
      return `<polygon points="${points.map(p => `${p.x},${p.y}`).join(' ')}" fill="#FFFFFF"/>` + stroked(roughPolygon(points, random, { maxOffset: 2 }), '#D97706', 2);
    }
    if (kind === 'note') {
      const points = [{ x, y }, { x: x + w - NOTE_FOLD, y }, { x: x + w, y: y + NOTE_FOLD }, { x: x + w, y: y + h }, { x, y: y + h }];
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF"/>` + stroked(roughPolygon(points, random, { maxOffset: 1.5 }), palette.sub, 1.6);
    }
    const color = emphasis ? palette.accent : palette.line;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF"/>` + stroked(roughPolygon(corners(box), random, { maxOffset: 2 }), color, emphasis ? 2.4 : 1.9);
  },

  line(points, { dashed, main, startMarker, endMarker, faint } = {}, { random }) {
    const segments = points.slice(1).map((p, i) => [points[i], p]);
    let body = '';
    for (const [a, b] of segments) {
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ux = (b.x - a.x) / length, uy = (b.y - a.y) / length;
      if (dashed || faint) {
        const [dash, gap] = faint ? [5, 6] : [8, 7];
        for (let t = 0; t < length - 2; t += dash + gap) {
          const t2 = Math.min(t + dash, length);
          body += roughSegment(a.x + ux * t, a.y + uy * t, a.x + ux * t2, a.y + uy * t2, random, { maxOffset: 0.8, double: false }) + ' ';
        }
      } else {
        body += roughSegment(a.x, a.y, b.x, b.y, random, { maxOffset: 1.6 }) + ' ';
      }
    }
    const head = (tip, from) => {
      const length = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
      const ux = (tip.x - from.x) / length, uy = (tip.y - from.y) / length;
      const back = { x: tip.x - ux * 14, y: tip.y - uy * 14 };
      const wing = (sign) => roughSegment(back.x - sign * uy * 7, back.y + sign * ux * 7, tip.x, tip.y, random, { maxOffset: 1 });
      return `${wing(1)} ${wing(-1)}`;
    };
    const covers = [];
    const marker = (kind, tip, from) => {
      if (kind === 'arrow') return head(tip, from);
      const shape = markerShape(kind, tip, from);
      if (!shape) return '';
      if (shape.segments) return shape.segments.map(([a, b]) => roughSegment(a.x, a.y, b.x, b.y, random, { maxOffset: 1 })).join(' ');
      covers.push(shape.polygon);
      return '';
    };
    const heads = marker(endMarker, points[points.length - 1], points[points.length - 2])
      + ' ' + marker(startMarker, points[0], points[1]);
    const color = faint ? palette.tones.grey.border : dashed ? palette.sub : palette.line;
    const width = faint ? 1.1 : main ? 2.4 : 2;
    const triangles = covers.map(pts => `<polygon points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" fill="#FFFFFF"/>`
      + stroked(roughPolygon(pts, random, { maxOffset: 1 }), color, width)).join('');
    return stroked(`${body} ${heads}`, color, width) + triangles;
  },

  text({ x, y, text, size, weight = 400, color, anchor = 'start', halo = false }) {
    const outline = halo ? ` stroke="${palette.background}" stroke-width="6" stroke-linejoin="round" paint-order="stroke"` : '';
    return `<text x="${x}" y="${y}"${outline} text-anchor="${anchor}" dominant-baseline="central" font-family="${this.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(text)}</text>`;
  },

  icon(name, x, y, size) {
    return `<g transform="translate(${x},${y}) scale(${size / ICON_BOX})" color="${palette.accent}">${ICONS[name] || ''}</g>`;
  },

  actor(x, y, size) {
    return `<g transform="translate(${x},${y}) scale(${size / ICON_BOX})" color="#7C3AED">${ICONS.person}</g>`;
  },

  overlay() {
    return '';
  },
};
