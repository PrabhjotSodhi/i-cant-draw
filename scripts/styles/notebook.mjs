import { makeStyle, pointKind } from './base.mjs';
import { pts, handPoly, handLine, rectPts, diamondPts, roundedPts } from './hand.mjs';
import { markerShape } from '../render/markers.mjs';

const INK = '#1E1E1E', RED = '#B8322A', PAPER = '#FBF8F0', CARD = '#FFFDF7';
const TONE = { blue: '#2F5DA8', green: '#3C7A4A', orange: '#B5651D', purple: '#6A4C9C', red: RED, grey: '#6B6B6B' };

const palette = {
  background: PAPER, ink: INK, sub: '#55524A', line: INK, main: RED, label: '#3A3833', border: INK, accent: INK,
  tones: Object.fromEntries(Object.entries(TONE).map(([k, c]) => [k, { fill: c, border: c, text: c }])),
};

const ink = (d, color, width, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
// Every shape casts a cross-hatched shadow down and to the right, like a pen drawing.
const shaded = (shape, outline) => `<polygon points="${pts(shape.map(q => ({ x: q.x + 7, y: q.y + 7 })))}" fill="url(#nb-hatch)"/><polygon points="${pts(shape)}" fill="${CARD}"/>${outline}`;

export default makeStyle({
  name: 'notebook',
  font: { family: 'American Typewriter', regular: { file: '/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc', name: 'AmericanTypewriter' }, bold: { file: '/System/Library/Fonts/Supplemental/AmericanTypewriter.ttc', name: 'AmericanTypewriter-Semibold' } },
  typeScale: { title: 15, titleWeight: 600, sub: 13, edgeLabel: 13, groupLabel: 13, lineHeight: 1.3 },
  palette,

  defs() {
    return '<pattern id="nb-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.1" fill="#CFC8B8"/></pattern>'
      + '<pattern id="nb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#3A3833" stroke-width="0.9"/></pattern>';
  },
  underlay(width, height) { return `<rect width="${width}" height="${height}" fill="url(#nb-dots)"/>`; },

  group({ box, tone }, { random }) {
    return ink(handPoly(rectPts(box), random, 0.8), TONE[tone] || TONE.grey, 1.4, ' stroke-dasharray="2,5"');
  },

  card({ box, kind = 'card', emphasis, tone, dividers = [] }, { random }) {
    const point = pointKind(kind, box, INK, 1.6);
    if (point) return point;
    if (kind === 'table') {
      const header = dividers[0];
      const { x, y, width: w } = box;
      return shaded(rectPts(box), `<rect x="${x}" y="${y}" width="${w}" height="${header}" fill="${TONE[tone] || TONE.grey}" fill-opacity="0.16"/>`
        + ink(handLine([{ x, y: y + header }, { x: x + w, y: y + header }], random, 0.5), INK, 1.1)
        + ink(handPoly(rectPts(box), random, 0.7), INK, 1.4));
    }
    if (kind === 'class') {
      const { x, y, width: w, height: h } = box;
      const tint = TONE[tone] ? `<rect x="${x}" y="${y}" width="${w}" height="${dividers[0] ?? h}" fill="${TONE[tone]}" fill-opacity="0.16"/>` : '';
      const rules = dividers.map(d => handLine([{ x, y: y + d }, { x: x + w, y: y + d }], random, 0.5, 40)).join(' ');
      return shaded(rectPts(box), tint + (rules ? ink(rules, INK, 1.1) : '') + ink(handPoly(rectPts(box), random, 0.7), INK, 1.4));
    }
    if (kind === 'bar') return `<polygon points="${pts(rectPts(box))}" fill="${CARD}"/>` + ink(handPoly(rectPts(box), random, 0.3), INK, 1.1);
    const shape = kind === 'decision' ? diamondPts(box) : kind === 'state' ? roundedPts(box, 18) : rectPts(box);
    const color = emphasis ? RED : kind === 'state' && TONE[tone] ? TONE[tone] : INK;
    return shaded(shape, ink(handPoly(shape, random, 0.7, kind === 'state' ? 40 : 30), color, emphasis ? 1.9 : 1.4));
  },

  line(points, { dashed, main, endMarker, startMarker, faint } = {}, { random }) {
    const c = faint ? '#A8A296' : main ? RED : INK, w = faint ? 0.9 : main ? 1.8 : 1.3;
    const end = (kind, tip, from) => {
      if (kind === 'arrow') { const s = markerShape('triangle', tip, from); return `<polygon points="${pts(s.polygon)}" fill="${c}"/>`; }
      const s = kind && kind !== 'none' ? markerShape(kind, tip, from) : null;
      if (!s) return '';
      return s.segments ? ink(s.segments.map(([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`).join(' '), c, w) : `<polygon points="${pts(s.polygon)}" fill="${CARD}" stroke="${c}" stroke-width="${w}"/>`;
    };
    return ink(handLine(points, random, 0.7, 40), c, w, dashed || faint ? ' stroke-dasharray="4,5"' : '')
      + end(endMarker, points.at(-1), points.at(-2)) + end(startMarker, points[0], points[1]);
  },
});
