import { makeStyle, pointKind } from './base.mjs';
import { pts, handPath, handPoly, handLine, diamondPts, roundedPts, vHead } from './hand.mjs';
import { markerShape } from '../render/markers.mjs';

const MARKER = { black: '#22252B', blue: '#1D4ED8', red: '#D3302F', green: '#13834A', purple: '#7A3BC7', orange: '#E06A10', grey: '#6B7280' };
const OVERSHOOT = 6;

const palette = {
  background: '#FAFAF8', ink: MARKER.black, sub: '#4B5563', line: MARKER.black, main: MARKER.blue, label: MARKER.blue, border: MARKER.black, accent: MARKER.blue,
  tones: Object.fromEntries(['blue', 'green', 'red', 'purple', 'orange', 'grey'].map(k => [k, { fill: MARKER[k], border: MARKER[k], text: MARKER[k] }])),
};

// Each side runs a little past the corner, the way a marker box is drawn in four strokes.
function markerBox({ x, y, width: w, height: h }, random, wobble) {
  const o = OVERSHOOT;
  return [[{ x: x - o, y }, { x: x + w + o, y }], [{ x: x + w, y: y - o }, { x: x + w, y: y + h + o }],
    [{ x: x + w + o, y: y + h }, { x: x - o, y: y + h }], [{ x, y: y + h + o }, { x, y: y - o }]]
    .map(([a, b]) => handPath(a, b, random, wobble, 70)).join(' ');
}

const stroke = (d, color, width, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;

export default makeStyle({
  name: 'whiteboard',
  font: { family: 'Noteworthy', regular: { file: '/System/Library/Fonts/Noteworthy.ttc', name: 'Noteworthy-Light' }, bold: { file: '/System/Library/Fonts/Noteworthy.ttc', name: 'Noteworthy-Bold' } },
  typeScale: { title: 18, titleWeight: 600, sub: 14, edgeLabel: 14, groupLabel: 16, lineHeight: 1.25 },
  palette,

  group({ box, tone }, { random }) {
    return stroke(markerBox(box, random, 1.6), MARKER[tone] || MARKER.grey, 3.4, ' opacity="0.9"');
  },

  card({ box, kind = 'card', emphasis, tone, dividers = [] }, { random }) {
    const point = pointKind(kind, box, MARKER.black, 3);
    if (point) return point;
    const { x, y, width: w, height: h } = box;
    const fill = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFFFFF"/>`;
    if (kind === 'table') {
      const header = dividers[0];
      return fill + `<rect x="${x}" y="${y}" width="${w}" height="${header}" fill="${MARKER[tone] || MARKER.grey}" fill-opacity="0.16"/>`
        + stroke(handPath({ x, y: y + header }, { x: x + w, y: y + header }, random, 0.8, 70), MARKER.black, 2.2)
        + stroke(markerBox(box, random, 1.2), MARKER.black, 3);
    }
    if (kind === 'class') {
      const tint = tone ? `<rect x="${x}" y="${y}" width="${w}" height="${dividers[0] ?? h}" fill="${MARKER[tone]}" fill-opacity="0.16"/>` : '';
      const rules = dividers.map(d => handPath({ x, y: y + d }, { x: x + w, y: y + d }, random, 0.8, 70)).join(' ');
      return fill + tint + (rules ? stroke(rules, MARKER.black, 2.2) : '') + stroke(markerBox(box, random, 1.2), MARKER.black, 3);
    }
    if (kind === 'bar') return fill + stroke(handPoly([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }], random, 0.4), MARKER.black, 1.8);
    if (kind === 'decision') return `<polygon points="${pts(diamondPts(box))}" fill="#FFFFFF"/>` + stroke(handPoly(diamondPts(box), random, 1.4), MARKER.orange, 3);
    if (kind === 'state') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFFFF"/>` + stroke(handPoly(roundedPts(box, 18), random, 0.8, 40), MARKER[tone] || MARKER.black, 3);
    return fill + stroke(markerBox(box, random, 1.2), emphasis ? MARKER.blue : MARKER.black, emphasis ? 3.6 : 3);
  },

  line(points, { dashed, main, endMarker, startMarker, faint } = {}, { random }) {
    const c = faint ? '#9CA3AF' : main ? MARKER.blue : MARKER.black, w = faint ? 1.5 : main ? 3.4 : 2.8;
    const end = (kind, tip, from) => {
      if (kind === 'arrow') return vHead(tip, from, 15, 9);
      const s = kind && kind !== 'none' ? markerShape(kind, tip, from) : null;
      if (!s) return '';
      return s.segments ? s.segments.map(([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`).join(' ') : `${handPoly(s.polygon, random, 0.3)}`;
    };
    const heads = end(endMarker, points.at(-1), points.at(-2)) + ' ' + end(startMarker, points[0], points[1]);
    return stroke(`${handLine(points, random, 1.1, 80)}`, c, w, dashed || faint ? ' stroke-dasharray="10,9"' : '') + stroke(heads, c, w);
  },
});
