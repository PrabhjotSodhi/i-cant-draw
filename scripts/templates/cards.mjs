export class SpecError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SpecError';
  }
}

const ACTOR_WIDTH = 140;
const ACTOR_GLYPH = 36;
const MAX_LINES = 2;
const POINT_SIZE = { start: 20, end: 26 };
export const TABLE = { head: 42, row: 28, pad: 5, nameX: 58, typeGap: 24, edge: 16 };
export const CLASS = { head: 44, stereotypeHead: 60, row: 26, pad: 6, textX: 16 };
const TITLE = { inset: 16, middle: 21 };
const DIAMOND = { aspect: 1.5, minHeight: 1.4 };

// A centred title fits when its half-width over the diamond's half-width plus its half-height over the diamond's half-height is at most 1.
function diamondHeightFor(n, style) {
  const ts = style.typeScale;
  const titleWidth = style.measure(n.label, ts.title, ts.titleWeight) + 2 * style.cardSize.padX;
  return Math.ceil(titleWidth / DIAMOND.aspect + ts.title * ts.lineHeight);
}

/** Rows, compartment dividers and height of a table or class card. Row y is the row's centre, from the card's top. */
function rowLayout(n, style) {
  const measure = (t) => style.measure(t, style.typeScale.sub, 400);
  if (n.kind === 'table') {
    const rows = (n.columns || []).map((c, i) => ({
      y: TABLE.head + TABLE.pad + i * TABLE.row + TABLE.row / 2, text: c.name,
      width: TABLE.nameX + measure(c.name) + TABLE.typeGap + measure(c.type || '') + TABLE.edge,
    }));
    return { rows, extras: [], dividers: [TABLE.head], height: TABLE.head + rows.length * TABLE.row + 2 * TABLE.pad };
  }
  if (n.kind === 'class') {
    const head = n.stereotype ? CLASS.stereotypeHead : CLASS.head;
    const part = (items, top, kind) => items.map((text, i) => ({ y: top + CLASS.pad + i * CLASS.row + CLASS.row / 2, text, part: kind, width: 2 * CLASS.textX + measure(text) }));
    const attributes = n.attributes || [], methods = n.methods || [];
    const attributesHeight = attributes.length * CLASS.row + 2 * CLASS.pad;
    const rows = [...part(attributes, head, 'attribute'), ...part(methods, head + attributesHeight, 'method')];
    const stereotype = n.stereotype ? `«${n.stereotype}»` : null;
    const extras = stereotype ? [{ text: stereotype, width: 2 * CLASS.textX + measure(stereotype) }] : [];
    return { rows, extras, dividers: [head, head + attributesHeight], height: head + attributesHeight + methods.length * CLASS.row + 2 * CLASS.pad };
  }
  return null;
}

/** The box draw.mjs fills with a group's title text. */
export function titleBox(group, label, style) {
  const size = style.typeScale.groupLabel, height = size * style.typeScale.lineHeight;
  return { x: group.x + TITLE.inset, y: group.y + TITLE.middle - height / 2, width: style.measure(label, size, 600), height };
}

export function wrapText(text, maxWidth, measure) {
  if (!text) return [];
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Two lines split at the break that makes the longer line shortest, so line two is never a lone word.
export function balancedWrap(text, maxWidth, measure) {
  const greedy = wrapText(text, maxWidth, measure);
  if (greedy.length !== 2) return greedy;
  const words = text.split(/\s+/);
  let best = greedy, bestWidth = Math.max(...greedy.map(measure));
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const widest = Math.max(...pair.map(measure));
    if (widest <= maxWidth && widest < bestWidth) { best = pair; bestWidth = widest; }
  }
  return best;
}

/** Sizes every node. Cards that share keyOf(node) share a width; cards and notes share one height. */
export function sizeCards(spec, style, keyOf) {
  const ts = style.typeScale;
  const c = style.cardSize;
  const lh = ts.lineHeight;
  const measureSub = (t) => style.measure(t, ts.sub, 400);
  const iconWidth = (n) => (n.icon ? c.iconSize + c.iconGap : 0);
  const textWidth = (n, w) => w - 2 * c.padX - iconWidth(n);
  const boxed = spec.nodes.filter(n => (n.kind || 'card') !== 'actor' && !POINT_SIZE[n.kind]);

  const keyWidth = new Map();
  for (const n of boxed) {
    const kind = n.kind || 'card';
    if (kind === 'decision' && n.subtitle) throw new SpecError(`node "${n.id}": a decision takes no subtitle. Move it into the label.`);
    if (kind === 'decision') {
      if (Math.ceil(DIAMOND.aspect * diamondHeightFor(n, style)) > c.maxWidth) throw new SpecError(`node "${n.id}": title does not fit inside the decision diamond. Shorten it.`);
      continue;
    }
    const titleWidth = style.measure(n.label, ts.title, ts.titleWeight);
    if (titleWidth > c.maxWidth - 2 * c.padX - iconWidth(n)) throw new SpecError(`node "${n.id}": title is too long. Shorten it.`);
    const rowed = rowLayout(n, style);
    const tooWide = rowed && [...rowed.rows, ...rowed.extras].find(r => r.width > c.maxWidth);
    if (tooWide) throw new SpecError(`node "${n.id}": row "${tooWide.text}" is too long. Shorten it.`);
    const rowWidth = rowed ? Math.max(0, ...[...rowed.rows, ...rowed.extras].map(r => r.width)) : 0;
    let w = Math.min(Math.max(titleWidth + iconWidth(n) + 2 * c.padX, rowWidth, c.minWidth), c.maxWidth);
    while (wrapText(n.subtitle, textWidth(n, w), measureSub).length > MAX_LINES && w < c.maxWidth) w = Math.min(w + 20, c.maxWidth);
    if (wrapText(n.subtitle, textWidth(n, w), measureSub).length > MAX_LINES) {
      throw new SpecError(`node "${n.id}": subtitle needs more than two lines at ${c.maxWidth} units. Shorten it.`);
    }
    const key = keyOf(n);
    keyWidth.set(key, Math.max(keyWidth.get(key) || 0, Math.ceil(w)));
  }

  const sizes = new Map();
  let cardHeight = 0;
  for (const n of boxed) {
    const width = keyWidth.get(keyOf(n)) ?? 0;
    const rowed = rowLayout(n, style);
    if (rowed) {
      sizes.set(n.id, { width, height: rowed.height, lines: [], kind: n.kind, rows: rowed.rows, dividers: rowed.dividers });
      continue;
    }
    const lines = (n.kind || 'card') === 'decision' ? [] : balancedWrap(n.subtitle, textWidth(n, width), measureSub);
    const height = 2 * c.padY + ts.title * lh + (lines.length ? 4 + lines.length * ts.sub * lh : 0);
    if ((n.kind || 'card') !== 'decision') cardHeight = Math.max(cardHeight, Math.ceil(height));
    sizes.set(n.id, { width, height: 0, lines, kind: n.kind || 'card' });
  }
  if (cardHeight === 0) cardHeight = Math.ceil(2 * c.padY + ts.title * lh);
  for (const n of boxed) {
    const size = sizes.get(n.id);
    if (size.rows) continue;
    size.height = size.kind === 'decision' ? Math.max(Math.round(DIAMOND.minHeight * cardHeight), diamondHeightFor(n, style)) : cardHeight;
    if (size.kind === 'decision') size.width = Math.ceil(DIAMOND.aspect * size.height);
  }

  for (const n of spec.nodes.filter(x => POINT_SIZE[x.kind])) sizes.set(n.id, { width: POINT_SIZE[n.kind], height: POINT_SIZE[n.kind], lines: [], kind: n.kind });
  for (const n of spec.nodes.filter(x => x.kind === 'actor')) {
    const wanted = Math.max(style.measure(n.label, ts.title, ts.titleWeight), n.subtitle ? measureSub(n.subtitle) : 0);
    const width = Math.ceil(Math.min(Math.max(wanted, ACTOR_WIDTH), c.maxWidth));
    const lines = wrapText(n.subtitle, width, measureSub);
    const height = ACTOR_GLYPH + 16 + ts.title * lh / 2 + (lines.length ? 4 + lines.length * ts.sub * lh : 0) + 4;
    sizes.set(n.id, { width, height: Math.ceil(height), lines, kind: 'actor' });
  }
  return sizes;
}
