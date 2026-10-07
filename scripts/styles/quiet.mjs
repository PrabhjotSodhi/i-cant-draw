import { measureText } from '../text-metrics.mjs';
import { ICONS, ICON_BOX } from '../render/icons.mjs';
import { escapeXml } from '../render/xml.mjs';
import { markerShape } from '../render/markers.mjs';

const NOTE_FOLD = 14;

const palette = {
  background: '#FFFFFF', ink: '#0F172A', sub: '#64748B', line: '#94A3B8', main: '#334155',
  label: '#475569', border: '#CBD5E1', accent: '#2563EB',
  tones: {
    grey: { fill: '#F8FAFC', border: '#E2E8F0', text: '#64748B' },
    blue: { fill: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8' },
    green: { fill: '#F0FDF4', border: '#BBF7D0', text: '#15803D' },
    orange: { fill: '#FFF7ED', border: '#FED7AA', text: '#C2410C' },
    red: { fill: '#FEF2F2', border: '#FECACA', text: '#B91C1C' },
    purple: { fill: '#FAF5FF', border: '#E9D5FF', text: '#7E22CE' },
  },
};

const openMarker = (id, size, color) =>
  `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="${size}" markerHeight="${size}" refX="${size}" refY="${size / 2}" orient="auto"><path d="M 0 0 L ${size} ${size / 2} L 0 ${size}" fill="none" stroke="${color}" stroke-width="1.5"/></marker>`;

const marker = (id, size, color, reverse) => {
  const path = reverse ? `M ${size} 0 L 0 ${size / 2} L ${size} ${size} Z` : `M 0 0 L ${size} ${size / 2} L 0 ${size} Z`;
  return `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="${size}" markerHeight="${size}" refX="${reverse ? 0 : size}" refY="${size / 2}" orient="auto"><path d="${path}" fill="${color}"/></marker>`;
};

export default {
  name: 'quiet',
  fonts: ['Inter-Regular.ttf', 'Inter-SemiBold.ttf'],
  fontFamily: "Inter, 'Helvetica Neue', Arial, sans-serif",
  typeScale: { title: 15, titleWeight: 600, sub: 13, edgeLabel: 13, groupLabel: 13, lineHeight: 1.3 },
  cardSize: { padX: 16, padY: 14, iconSize: 24, iconGap: 10, minWidth: 200, maxWidth: 340, radius: 8 },
  spacing: { colGap: 128, rowGap: 36, stackGap: 30, groupPad: 24, groupLabelBand: 30, sideGap: 300, trunkInset: 70 },
  palette,

  measure(text, size, weight = 400) {
    return measureText(text, size, weight);
  },

  groupFill(group) {
    if (group.depth === 0 && !group.tone) return 'none';
    return (palette.tones[group.tone] || palette.tones.grey).fill;
  },

  defs() {
    return marker('quiet-head', 9, palette.line) + marker('quiet-head-main', 10, palette.main)
      + marker('quiet-tail', 9, palette.line, true) + marker('quiet-tail-main', 10, palette.main, true)
      + openMarker('quiet-open', 9, palette.line) + openMarker('quiet-open-main', 10, palette.main);
  },

  group({ box, depth, tone, boundary }) {
    const dash = boundary === 'dashed' ? ' stroke-dasharray="5,4"' : '';
    if (depth === 0 && !tone) {
      return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="10" fill="none" stroke="${palette.border}" stroke-width="1"${dash}/>`;
    }
    const t = palette.tones[tone] || palette.tones.grey;
    return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="10" fill="${t.fill}" stroke="${t.border}" stroke-width="1"${dash}/>`;
  },

  card({ box, kind = 'card', emphasis, tone, dividers = [] }) {
    const { x, y, width: w, height: h } = box;
    if (kind === 'table') {
      const header = dividers[0];
      const r = 8, tint = (palette.tones[tone] || palette.tones.grey).text;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#FFFFFF"/>`
        + `<path d="M ${x} ${y + header} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + header} Z" fill="${tint}" fill-opacity="0.16"/>`
        + `<path d="M ${x} ${y + header} H ${x + w}" stroke="${palette.border}" stroke-width="1"/>`
        + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${palette.border}" stroke-width="1"/>`;
    }
    if (kind === 'class') {
      const t = palette.tones[tone], head = dividers[0] ?? h, r = 8;
      const tint = t ? `<path d="M${x},${y + head} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + head} Z" fill="${t.text}" fill-opacity="0.16"/>` : '';
      const rules = dividers.map(d => `<path d="M${x},${y + d} H${x + w}" fill="none" stroke="${palette.border}" stroke-width="1"/>`).join('');
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#FFFFFF"/>` + tint + rules
        + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${palette.border}" stroke-width="1"/>`;
    }
    if (kind === 'start') return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="10" fill="${palette.main}"/>`;
    if (kind === 'end') {
      return `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="13" fill="none" stroke="${palette.main}" stroke-width="1.5"/>`
        + `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="7" fill="${palette.main}"/>`;
    }
    if (kind === 'state') {
      const t = palette.tones[tone];
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFFFF" stroke="${t ? t.text : palette.border}" stroke-width="1" stroke-opacity="${t ? 0.55 : 1}"/>`;
    }
    if (kind === 'decision') {
      const cx = x + w / 2, cy = y + h / 2;
      return `<polygon points="${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}" fill="#FFFFFF" stroke="#D97706" stroke-width="1.5"/>`;
    }
    if (kind === 'bar') {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#FFFFFF" stroke="${palette.line}" stroke-width="1.25"/>`;
    }
    if (kind === 'note') {
      return `<path d="M ${x} ${y} H ${x + w - NOTE_FOLD} L ${x + w} ${y + NOTE_FOLD} V ${y + h} H ${x} Z" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1.25"/>`
        + `<path d="M ${x + w - NOTE_FOLD} ${y} V ${y + NOTE_FOLD} H ${x + w}" fill="none" stroke="#94A3B8" stroke-width="1.25"/>`;
    }
    const stroke = emphasis ? palette.accent : palette.border;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#FFFFFF" stroke="${stroke}" stroke-width="${emphasis ? 1.5 : 1}"/>`;
  },

  line(points, { dashed, main, startMarker, endMarker, open, faint } = {}) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    if (faint) return `<path d="${d}" fill="none" stroke="${palette.border}" stroke-width="1" stroke-dasharray="4,4"/>`;
    const color = main ? palette.main : palette.line;
    const suffix = main ? '-main' : '';
    const head = open ? 'quiet-open' : 'quiet-head';
    const markers = (endMarker === 'arrow' ? ` marker-end="url(#${head}${suffix})"` : '') + (startMarker === 'arrow' ? ` marker-start="url(#quiet-tail${suffix})"` : '');
    const width = main ? 2 : 1.5;
    const shape = (kind, tip, from) => {
      const s = markerShape(kind, tip, from);
      if (!s) return '';
      if (s.segments) return `<path d="${s.segments.map(([a, b]) => `M${a.x},${a.y} L${b.x},${b.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`;
      return `<polygon points="${s.polygon.map(p => `${p.x},${p.y}`).join(' ')}" fill="#FFFFFF" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
    };
    const ends = (endMarker && endMarker !== 'arrow' ? shape(endMarker, points[points.length - 1], points[points.length - 2]) : '')
      + (startMarker && startMarker !== 'arrow' ? shape(startMarker, points[0], points[1]) : '');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}"${dashed ? ' stroke-dasharray="6,4"' : ''}${markers}/>` + ends;
  },

  text({ x, y, text, size, weight = 400, color, anchor = 'start' }) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${this.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(text)}</text>`;
  },

  icon(name, x, y, size) {
    return `<g transform="translate(${x},${y}) scale(${size / ICON_BOX})" color="${palette.accent}">${ICONS[name] || ''}</g>`;
  },

  actor(x, y, size) {
    return `<g transform="translate(${x},${y}) scale(${size / ICON_BOX})" color="${palette.accent}">${ICONS.person}</g>`;
  },

  overlay() {
    return '';
  },
};
