import { makeStyle, pointKind } from './base.mjs';
import { pts, pathOf, rectPts, diamondPts, roundedPts } from './hand.mjs';
import { markerShape } from '../render/markers.mjs';

const INK = { pink: '#FF48B0', blue: '#0078BF', yellow: '#FFE800', navy: '#24366B' };
const PAPER = '#F5EFE2', CARD = '#FBF7EE';
const ZONE_INK = { blue: INK.blue, green: INK.yellow, orange: INK.pink, purple: INK.pink, red: INK.pink, grey: INK.blue };
const DOT = { [INK.pink]: 'riso-dot-pink', [INK.blue]: 'riso-dot-blue', [INK.yellow]: 'riso-dot-yellow' };
// Multiply blending is what makes two overlapping inks read as print.
const MULTIPLY = ' style="mix-blend-mode:multiply"';

const palette = {
  background: PAPER, ink: INK.navy, sub: '#4A5A8C', line: INK.blue, main: INK.pink, label: INK.navy, border: INK.blue, accent: INK.pink,
  tones: Object.fromEntries(Object.entries(ZONE_INK).map(([k, c]) => [k, { fill: c, border: c, text: k === 'green' ? '#7D6E00' : c }])),
};

const triangle = (tip, from, color) => { const s = markerShape('triangle', tip, from); return `<polygon points="${pts(s.polygon)}" fill="${color}"/>`; };

export default makeStyle({
  name: 'riso',
  font: { family: 'Avenir Next', regular: { file: '/System/Library/Fonts/Avenir Next.ttc', name: 'AvenirNext-Regular' }, bold: { file: '/System/Library/Fonts/Avenir Next.ttc', name: 'AvenirNext-DemiBold' } },
  palette,

  defs() {
    const dots = (id, c, r) => `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="${r}" fill="${c}"/></pattern>`;
    return dots(DOT[INK.pink], INK.pink, 1.5) + dots(DOT[INK.blue], INK.blue, 1.3) + dots(DOT[INK.yellow], INK.yellow, 1.9);
  },

  group({ box, tone }) {
    const c = ZONE_INK[tone] || INK.blue, { x, y, width: w, height: h } = box;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${DOT[c]})" opacity="0.55"${MULTIPLY}/>`
      + `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${c}" stroke-width="3"${MULTIPLY}/>`;
  },

  card({ box, kind = 'card', emphasis, tone, dividers = [] }) {
    const point = pointKind(kind, box, INK.navy);
    if (point) return point;
    const { x, y, width: w, height: h } = box;
    if (kind === 'table') {
      const header = dividers[0];
      const tint = (palette.tones[tone] || palette.tones.grey).fill;
      return `<polygon points="${pts(rectPts({ ...box, x: x + 5, y: y + 5 }))}" fill="${INK.blue}" opacity="0.85"${MULTIPLY}/>`
        + `<polygon points="${pts(rectPts(box))}" fill="${CARD}"/>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${header}" fill="${tint}" fill-opacity="0.16"${MULTIPLY}/>`
        + `<path d="M${x},${y + header} L${x + w},${y + header}" stroke="${INK.navy}" stroke-width="1.5"/>`
        + `<polygon points="${pts(rectPts(box))}" fill="none" stroke="${INK.navy}" stroke-width="2"/>`;
    }
    if (kind === 'class') {
      const ink = ZONE_INK[tone];
      const tint = ink ? `<rect x="${x}" y="${y}" width="${w}" height="${dividers[0] ?? h}" fill="${ink}" fill-opacity="0.16"${MULTIPLY}/>` : '';
      const rules = dividers.map(d => `M${x},${y + d} H${x + w}`).join(' ');
      return `<polygon points="${pts(rectPts({ ...box, x: x + 5, y: y + 5 }))}" fill="${ink || INK.blue}" opacity="0.85"${MULTIPLY}/>`
        + `<polygon points="${pts(rectPts(box))}" fill="${CARD}"/>` + tint
        + (rules ? `<path d="${rules}" fill="none" stroke="${INK.navy}" stroke-width="1.5"/>` : '')
        + `<polygon points="${pts(rectPts(box))}" fill="none" stroke="${INK.navy}" stroke-width="2"/>`;
    }
    if (kind === 'bar') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${CARD}" stroke="${INK.blue}" stroke-width="1.5"/>`;
    if (kind === 'decision') {
      const p = diamondPts(box);
      return `<polygon points="${pts(p.map(q => ({ x: q.x + 4, y: q.y + 4 })))}" fill="${INK.pink}" opacity="0.85"${MULTIPLY}/>`
        + `<polygon points="${pts(p)}" fill="${CARD}" stroke="${INK.navy}" stroke-width="2"/>`;
    }
    const shape = kind === 'state' ? pts(roundedPts(box, 18)) : pts(rectPts(box));
    const offset = kind === 'state' ? pts(roundedPts({ ...box, x: x + 5, y: y + 5 }, 18)) : pts(rectPts({ ...box, x: x + 5, y: y + 5 }));
    const shadow = emphasis ? INK.pink : (kind === 'state' && ZONE_INK[tone]) || INK.blue;
    return `<polygon points="${offset}" fill="${shadow}" opacity="0.85"${MULTIPLY}/>`
      + `<polygon points="${shape}" fill="${CARD}" stroke="${INK.navy}" stroke-width="2"/>`;
  },

  line(points, { dashed, main, endMarker, startMarker, faint } = {}) {
    const c = faint ? '#9AA6C8' : main ? INK.pink : INK.blue, w = faint ? 1 : main ? 3.2 : 2.4;
    const ends = (endMarker === 'arrow' ? triangle(points.at(-1), points.at(-2), c) : '') + (startMarker === 'arrow' ? triangle(points[0], points[1], c) : '');
    const other = (kind, tip, from) => { const s = kind && kind !== 'arrow' && kind !== 'none' ? markerShape(kind, tip, from) : null;
      if (!s) return ''; return s.polygon ? `<polygon points="${pts(s.polygon)}" fill="${CARD}" stroke="${c}" stroke-width="${w}"/>` : `<path d="${s.segments.map(([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`).join(' ')}" stroke="${c}" stroke-width="${w}"/>`; };
    return `<path d="${pathOf(points)}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="square"${dashed || faint ? ' stroke-dasharray="7,6"' : ''}${MULTIPLY}/>`
      + ends + other(endMarker, points.at(-1), points.at(-2)) + other(startMarker, points[0], points[1]);
  },
});
