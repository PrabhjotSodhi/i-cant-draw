import { ICONS, ICON_BOX } from '../render/icons.mjs';
import { escapeXml } from '../render/xml.mjs';

/** Shared defaults for the hand-made styles. A style overrides what makes it different. */
export function makeStyle(own) {
  return {
    typeScale: { title: 16, titleWeight: 600, sub: 13, edgeLabel: 13, groupLabel: 14, lineHeight: 1.3 },
    cardSize: { padX: 16, padY: 14, iconSize: 24, iconGap: 10, minWidth: 200, maxWidth: 360, radius: 0 },
    spacing: { colGap: 128, rowGap: 36, stackGap: 30, groupPad: 24, groupLabelBand: 30, sideGap: 300, trunkInset: 70 },
    labelHalo: true,
    groupFill() { return this.palette.background; },
    defs() { return ''; },
    underlay() { return ''; },
    overlay() { return ''; },
    text({ x, y, text, size, weight = 400, color, anchor = 'start', halo = false }) {
      const outline = halo ? ` stroke="${this.palette.background}" stroke-width="6" stroke-linejoin="round" paint-order="stroke"` : '';
      return `<text x="${x}" y="${y}"${outline} text-anchor="${anchor}" dominant-baseline="central" font-family="${this.fontFamily}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(text)}</text>`;
    },
    icon(name, x, y, size) {
      return `<g transform="translate(${x},${y}) scale(${size / ICON_BOX})" color="${this.palette.accent}">${ICONS[name] || ''}</g>`;
    },
    actor(x, y, size) {
      return `<g transform="translate(${x},${y}) scale(${size / ICON_BOX})" color="${this.palette.accent}">${ICONS.person}</g>`;
    },
    ...own,
  };
}

/** Start and end points of a state machine, the same in every style but for the ink. */
export function pointKind(kind, { x, y, width: w, height: h }, ink, ringWidth = 2) {
  const cx = x + w / 2, cy = y + h / 2;
  if (kind === 'start') return `<circle cx="${cx}" cy="${cy}" r="10" fill="${ink}"/>`;
  if (kind === 'end') return `<circle cx="${cx}" cy="${cy}" r="13" fill="none" stroke="${ink}" stroke-width="${ringWidth}"/><circle cx="${cx}" cy="${cy}" r="7" fill="${ink}"/>`;
  return null;
}
