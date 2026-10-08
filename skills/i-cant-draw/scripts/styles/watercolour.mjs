import { makeStyle, pointKind } from './base.mjs';
import { pts, handPoly, handLine, rectPts, diamondPts, roundedPts, vHead } from './hand.mjs';
import { markerShape } from '../render/markers.mjs';

const PAINT = { blue: '#4F82C4', green: '#5C9E6B', orange: '#E39A48', purple: '#8E6CB8', red: '#CF5A54', grey: '#9A968E' };
const GRAPHITE = '#4A4743', DARK = '#2E2C29', CARD = '#FFFEFA';

const palette = {
  background: '#FBF9F3', ink: DARK, sub: '#5E5A53', line: GRAPHITE, main: DARK, label: GRAPHITE, border: GRAPHITE, accent: '#3F6FB0',
  tones: Object.fromEntries(Object.entries(PAINT).map(([k, c]) => [k, { fill: c, border: c, text: c }])),
};

const pencil = (d, color, width, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" opacity="0.85"${extra}/>`;

export default makeStyle({
  name: 'watercolour',
  font: { family: 'Avenir Next', regular: { file: '/System/Library/Fonts/Avenir Next.ttc', name: 'AvenirNext-Regular' }, bold: { file: '/System/Library/Fonts/Avenir Next.ttc', name: 'AvenirNext-DemiBold' } },
  palette,

  defs() {
    // The wash filter pushes a zone's edges around with low-frequency noise, so the paint looks like it bled.
    return '<filter id="wc-wash" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="8" result="n"/>'
      + '<feDisplacementMap in="SourceGraphic" in2="n" scale="22" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="1.4"/></filter>'
      + '<filter id="wc-bloom" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="2" result="n"/>'
      + '<feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.35" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>';
  },

  group({ box, tone }) {
    const c = PAINT[tone] || PAINT.grey, { x, y, width: w, height: h } = box;
    return `<g filter="url(#wc-wash)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${c}" opacity="0.22"/>`
      + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${c}" stroke-width="5" opacity="0.32"/></g>`;
  },

  card({ box, kind = 'card', emphasis, tone, dividers = [] }, { random }) {
    const point = pointKind(kind, box, DARK, 1.6);
    if (point) return point;
    if (kind === 'table') {
      const header = dividers[0];
      const { x, y, width: w } = box, shape = rectPts(box);
      return `<polygon points="${pts(shape)}" fill="${CARD}"/>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${header}" fill="${PAINT[tone] || PAINT.grey}" fill-opacity="0.16"/>`
        + pencil(handLine([{ x, y: y + header }, { x: x + w, y: y + header }], random, 0.5), GRAPHITE, 1)
        + pencil(`${handPoly(shape, random, 0.8)} ${handPoly(shape, random, 0.9)}`, GRAPHITE, 1.1);
    }
    if (kind === 'class') {
      const { x, y, width: w, height: h } = box;
      const tint = PAINT[tone] ? `<rect x="${x}" y="${y}" width="${w}" height="${dividers[0] ?? h}" fill="${PAINT[tone]}" fill-opacity="0.16"/>` : '';
      const rules = dividers.map(d => handLine([{ x, y: y + d }, { x: x + w, y: y + d }], random, 0.6, 50)).join(' ');
      return `<polygon points="${pts(rectPts(box))}" fill="${CARD}"/>` + tint
        + pencil(`${handPoly(rectPts(box), random, 0.8)} ${handPoly(rectPts(box), random, 0.9)} ${rules}`, GRAPHITE, 1.1);
    }
    const shape = kind === 'decision' ? diamondPts(box) : kind === 'state' ? roundedPts(box, 18) : rectPts(box);
    const color = emphasis ? '#2F5F9E' : kind === 'state' && PAINT[tone] ? PAINT[tone] : GRAPHITE;
    const width = kind === 'bar' ? 0.9 : emphasis ? 1.6 : 1.1;
    // Two light passes of the pencil, as a hand drawing would have.
    return `<polygon points="${pts(shape)}" fill="${CARD}"/>` + pencil(`${handPoly(shape, random, 0.8)} ${handPoly(shape, random, 0.9)}`, color, width);
  },

  line(points, { dashed, main, endMarker, startMarker, faint } = {}, { random }) {
    const c = faint ? '#B4AFA5' : main ? DARK : '#5E5A53', w = faint ? 0.9 : main ? 1.7 : 1.2;
    const end = (kind, tip, from) => {
      if (kind === 'arrow') return vHead(tip, from, 12, 6);
      const s = kind && kind !== 'none' ? markerShape(kind, tip, from) : null;
      if (!s) return '';
      return s.segments ? s.segments.map(([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`).join(' ') : handPoly(s.polygon, random, 0.2);
    };
    return pencil(handLine(points, random, 0.6, 50), c, w, dashed || faint ? ' stroke-dasharray="5,6"' : '')
      + pencil(`${end(endMarker, points.at(-1), points.at(-2))} ${end(startMarker, points[0], points[1])}`, c, w);
  },
});
