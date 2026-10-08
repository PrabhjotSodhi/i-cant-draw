import { seededRandom, hashSpec } from './random.mjs';
import { TABLE, CLASS } from '../templates/cards.mjs';

const PADDING = 40;
const CANVAS_MIN_WIDTH = 1920;
const ACTOR_GLYPH = 36;

const GUARD_PAD = 7;
const CLASS_TEXT = { stereotypeY: 19, nameY: 40, plainNameY: 22 };

const pointsOf = (section) => [section.startPoint, ...section.bendPoints, section.endPoint];

/** The theme shape sequence-layout.mjs reads its sizes from. */
export function styleAsTheme(style) {
  const ts = style.typeScale;
  return {
    typeScale: { title: ts.title, titleWeight: ts.titleWeight, secondary: ts.sub, muted: ts.sub, edgeLabel: ts.edgeLabel,
      groupLabel: ts.groupLabel, iconTitle: ts.title, iconSub: ts.sub },
    icon: { mode: 'plain' },
    measure: (text, size, weight) => style.measure(text, size, weight),
    categories: { process: { fill: '#FFFFFF', stroke: style.palette.border, text: style.palette.ink } },
  };
}
const inside = (p, b) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

/** Draws any Layout with any style. Returns the SVG and the geometry the collision gate reads. */
export function draw(layout, spec, style) {
  const ts = style.typeScale;
  const palette = style.palette;
  const ctx = { palette, random: seededRandom(hashSpec(spec)) };
  const specNodes = new Map((spec.nodes || []).map(n => [n.id, n]));
  const specEdges = spec.edges || [];
  const geometry = [];
  const geo = (owner, kind, box) => geometry.push({ owner, kind, x: box.x, y: box.y, width: box.width, height: box.height });
  const text = (x, y, value, size, weight, color, anchor = 'start') =>
    style.text({ x, y, text: value, size, weight, color, anchor }, ctx);
  const textBox = (x, y, value, size, weight, anchor) => {
    const width = style.measure(value, size, weight);
    const height = size * ts.lineHeight;
    const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
    return { x: left, y: y - height / 2, width, height };
  };

  const groupLayer = [];
  for (const g of [...layout.groups].sort((a, b) => a.depth - b.depth)) {
    const box = { x: g.x, y: g.y, width: g.width, height: g.height };
    const tone = g.spec?.tone;
    groupLayer.push(style.group({ box, depth: g.depth, label: g.spec?.label, tone, boundary: g.spec?.boundary }, ctx));
    const label = g.spec?.label;
    if (label) {
      const color = (palette.tones[tone] || palette.tones.grey).text;
      const title = g.titleBox ?? textBox(g.x + 16, g.y + 21, label, ts.groupLabel, 600, 'start');
      groupLayer.push(text(title.x, title.y + title.height / 2, label, ts.groupLabel, 600, color));
      geo(g.id, 'group-label', title);
    }
  }

  const lateLayer = [];
  (layout.frames || []).forEach((frame, fi) => {
    const box = { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
    const tone = palette.tones[frame.tone] ? frame.tone : 'grey';
    groupLayer.push(style.group({ box, depth: 1, label: frame.kind, tone }, ctx));
    const tag = frame.kind.toUpperCase();
    groupLayer.push(text(frame.x + 12, frame.y + 16, tag, ts.groupLabel, 600, palette.tones[tone].text));
    geo(`frame${fi}`, 'group-label', textBox(frame.x + 12, frame.y + 16, tag, ts.groupLabel, 600, 'start'));
    for (const d of frame.dividers) groupLayer.push(style.line([{ x: frame.x, y: d }, { x: frame.x + frame.width, y: d }], { dashed: true }, ctx));
    frame.guards.forEach((guard, gi) => {
      if (!guard.text) return;
      const value = `[${guard.text}]`;
      const width = style.measure(value, ts.edgeLabel, 600);
      const chip = { x: guard.x - GUARD_PAD, y: guard.y - ts.edgeLabel - 4, width: width + 2 * GUARD_PAD, height: ts.edgeLabel * ts.lineHeight + 6 };
      lateLayer.push(`<rect x="${chip.x}" y="${chip.y}" width="${chip.width}" height="${chip.height}" rx="4" fill="${palette.tones[tone].fill}" fill-opacity="0.14"/>`);
      lateLayer.push(text(guard.x, chip.y + chip.height / 2, value, ts.edgeLabel, 600, palette.tones[tone].text));
      geo(`frame${fi}g${gi}`, 'edge-label', chip);
    });
  });

  const edgeLayer = [];
  for (const l of layout.lifelines || []) edgeLayer.push(style.line([{ x: l.x, y: l.y1 }, { x: l.x, y: l.y2 }], { faint: true }, ctx));
  for (const bar of layout.activations || []) {
    edgeLayer.push(style.card({ box: { x: bar.x, y: bar.y, width: bar.width, height: bar.height }, kind: 'bar' }, ctx));
    geo(bar.owner, 'activation', bar);
  }
  for (const trunk of layout.trunks || []) {
    edgeLayer.push(style.line(pointsOf(trunk), { main: trunk.main ?? true, dashed: !!trunk.dashed, endMarker: trunk.endMarker ?? 'none' }, ctx));
  }
  for (const e of layout.edges) {
    const se = specEdges[e.index] || {};
    // Every message is content in a sequence diagram, so all messages take the main weight.
    const opts = { dashed: se.style === 'dashed', main: !!se.main || !!layout.lifelines, open: !!se.async };
    const endMarker = !se.annotation && e.arrow !== false ? 'arrow' : 'none', startMarker = se.both ? 'arrow' : 'none';
    for (const s of e.sections) {
      edgeLayer.push(style.line(pointsOf(s), { ...opts, endMarker: s.endMarker ?? endMarker, startMarker: s.startMarker ?? startMarker }, ctx));
    }
  }

  const labelLayer = [];
  const groupsDeepFirst = [...layout.groups].sort((a, b) => b.depth - a.depth);
  for (const e of layout.edges) {
    for (const l of e.labels || []) {
      const centre = { x: l.x + l.width / 2, y: l.y + l.height / 2 };
      const holder = groupsDeepFirst.find(g => inside(centre, g));
      const fill = holder ? style.groupFill({ depth: holder.depth, tone: holder.spec?.tone }) : 'none';
      // Crayon outlines the letters instead, so the hatching stays visible around a label.
      if (!style.labelHalo) labelLayer.push(`<rect x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" fill="${fill === 'none' ? palette.background : fill}"/>`);
      labelLayer.push(style.text({ x: centre.x, y: centre.y, text: l.text, size: ts.edgeLabel, weight: 400, color: palette.label, anchor: 'middle', halo: !!style.labelHalo }, ctx));
      geo(`e${e.index}`, 'edge-label', l);
    }
    for (const l of e.endLabels || []) {
      const holder = groupsDeepFirst.find(g => inside({ x: l.x + l.width / 2, y: l.y + l.height / 2 }, g));
      const fill = holder ? style.groupFill({ depth: holder.depth, tone: holder.spec?.tone }) : 'none';
      if (!style.labelHalo) labelLayer.push(`<rect x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" fill="${fill === 'none' ? palette.background : fill}"/>`);
      labelLayer.push(style.text({ x: l.x + l.width / 2, y: l.y + l.height / 2, text: l.text, size: ts.edgeLabel, weight: 400, color: palette.sub, anchor: 'middle', halo: !!style.labelHalo }, ctx));
      geo(`e${e.index}:${l.end}`, 'end-label', l);
    }
  }

  const cardLayer = [];
  for (const n of layout.nodes) {
    const sn = specNodes.get(n.id) || {};
    const kind = sn.kind === 'actor' || sn.category === 'human' ? 'actor' : sn.kind || 'card';
    const titleLines = String(sn.label ?? '').split('\n');
    const box = { x: n.x, y: n.y, width: n.width, height: n.height };
    const lines = n.lines || (layout.lifelines && sn.subtitle ? [sn.subtitle] : []);
    const cx = n.x + n.width / 2;
    const glyphIcon = layout.lifelines && sn.icon && kind !== 'actor';
    if (kind === 'actor' || glyphIcon) {
      if (glyphIcon) cardLayer.push(style.icon(sn.icon, cx - ACTOR_GLYPH / 2, n.y, ACTOR_GLYPH, ctx));
      else cardLayer.push(style.actor(cx - ACTOR_GLYPH / 2, n.y, ACTOR_GLYPH, ctx));
      geo(n.id, 'tile', { x: cx - ACTOR_GLYPH / 2, y: n.y, width: ACTOR_GLYPH, height: ACTOR_GLYPH });
      let titleY = n.y + ACTOR_GLYPH + 16;
      titleLines.forEach((line, i) => {
        const y = titleY + i * ts.title * ts.lineHeight;
        cardLayer.push(text(cx, y, line, ts.title, ts.titleWeight, palette.ink, 'middle'));
        geo(n.id, 'text', textBox(cx, y, line, ts.title, ts.titleWeight, 'middle'));
      });
      titleY += (titleLines.length - 1) * ts.title * ts.lineHeight;
      lines.forEach((line, i) => {
        const y = titleY + ts.title * ts.lineHeight / 2 + 4 + (i + 0.5) * ts.sub * ts.lineHeight;
        cardLayer.push(text(cx, y, line, ts.sub, 400, palette.sub, 'middle'));
        geo(n.id, 'subtitle', textBox(cx, y, line, ts.sub, 400, 'middle'));
      });
      continue;
    }
    const zone = groupsDeepFirst.find(g => inside({ x: cx, y: n.y + n.height / 2 }, g));
    cardLayer.push(style.card({ box, kind, emphasis: n.id === layout.hubId, tone: zone?.spec?.tone, dividers: n.dividers }, ctx));
    geo(n.id, 'node', box);
    if (kind === 'start' || kind === 'end') continue;
    const put = (x, y, value, size, weight, color, anchor = 'start') => {
      cardLayer.push(text(x, y, value, size, weight, color, anchor));
      geo(n.id, 'text', textBox(x, y, value, size, weight, anchor));
    };
    if (kind === 'table') {
      put(n.x + TABLE.edge, n.y + n.dividers[0] / 2, sn.label, ts.title, ts.titleWeight, palette.ink);
      n.rows.forEach((row, i) => {
        const column = sn.columns[i], y = n.y + row.y;
        if (column.key) put(n.x + TABLE.edge, y, column.key, ts.sub, 600, palette.accent);
        put(n.x + TABLE.nameX, y, column.name, ts.sub, 400, palette.ink);
        if (column.type) put(n.x + n.width - TABLE.edge, y, column.type, ts.sub, 400, palette.sub, 'end');
      });
      continue;
    }
    if (kind === 'class') {
      if (sn.stereotype) put(cx, n.y + CLASS_TEXT.stereotypeY, `«${sn.stereotype}»`, ts.sub, 400, palette.sub, 'middle');
      put(cx, n.y + (sn.stereotype ? CLASS_TEXT.nameY : CLASS_TEXT.plainNameY), titleLines[0], ts.title, ts.titleWeight, palette.ink, 'middle');
      for (const row of n.rows || []) put(n.x + CLASS.textX, n.y + row.y, row.text, ts.sub, 400, palette.ink, 'start');
      continue;
    }
    const titleH = titleLines.length * ts.title * ts.lineHeight;
    const subH = ts.sub * ts.lineHeight;
    const blockH = titleH + (lines.length ? 4 + lines.length * subH : 0);
    const top = n.y + (n.height - blockH) / 2;
    const titleY = (i) => top + (i + 0.5) * ts.title * ts.lineHeight;
    const centred = kind === 'decision' || kind === 'state' || (layout.lifelines && !sn.icon);
    if (centred) {
      titleLines.forEach((line, i) => {
        cardLayer.push(text(cx, titleY(i), line, ts.title, ts.titleWeight, palette.ink, 'middle'));
        geo(n.id, 'text', textBox(cx, titleY(i), line, ts.title, ts.titleWeight, 'middle'));
      });
      lines.forEach((line, i) => {
        const y = top + titleH + 4 + (i + 0.5) * subH;
        cardLayer.push(text(cx, y, line, ts.sub, 400, palette.sub, 'middle'));
        geo(n.id, 'subtitle', textBox(cx, y, line, ts.sub, 400, 'middle'));
      });
      continue;
    }
    let textX = n.x + style.cardSize.padX;
    if (sn.icon) {
      cardLayer.push(style.icon(sn.icon, textX, n.y + n.height / 2 - style.cardSize.iconSize / 2, style.cardSize.iconSize, ctx));
      textX += style.cardSize.iconSize + style.cardSize.iconGap;
    }
    titleLines.forEach((line, i) => {
      cardLayer.push(text(textX, titleY(i), line, ts.title, ts.titleWeight, palette.ink));
      geo(n.id, 'text', textBox(textX, titleY(i), line, ts.title, ts.titleWeight, 'start'));
    });
    lines.forEach((line, i) => {
      const y = top + titleH + 4 + (i + 0.5) * subH;
      cardLayer.push(text(textX, y, line, ts.sub, 400, palette.sub));
      geo(n.id, 'subtitle', textBox(textX, y, line, ts.sub, 400, 'start'));
    });
  }

  const width = Math.max(layout.width + PADDING * 2, CANVAS_MIN_WIDTH);
  const height = layout.height + PADDING * 2;
  const offsetX = (width - layout.width) / 2;
  // A filter on the group layer would put noise under every hatch line and triple the PNG size.
  const edgeLayerSvg = style.layerFilter ? `<g filter="url(#${style.layerFilter})">${edgeLayer.join('')}</g>` : edgeLayer.join('');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${palette.background}"/>`,
    `<defs>${style.defs(ctx)}</defs>`,
    style.underlay ? style.underlay(width, height, ctx) : '',
    `<g transform="translate(${offsetX},${PADDING})">`,
    groupLayer.join(''), edgeLayerSvg, labelLayer.join(''), lateLayer.join(''), cardLayer.join(''),
    '</g>',
    style.overlay(width, height, ctx),
    '</svg>',
  ].join('');
  const shifted = geometry.map(g => ({ ...g, x: g.x + offsetX, y: g.y + PADDING }));
  return { svg, geometry: shifted };
}
