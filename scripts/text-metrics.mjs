import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as fontkit from 'fontkit';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, '..', 'references', 'fonts');

const FONTS = {
  400: fontkit.create(readFileSync(join(FONT_DIR, 'Inter-Regular.ttf'))),
  600: fontkit.create(readFileSync(join(FONT_DIR, 'Inter-SemiBold.ttf'))),
};

export const LINE_HEIGHT = 1.3;

export function measureText(text, fontSize, weight = 400) {
  if (!text) return 0;
  const font = FONTS[weight] ?? FONTS[400];
  const run = font.layout(String(text));
  return (run.advanceWidth / font.unitsPerEm) * fontSize;
}

const PADDING_X = 24;
const PADDING_Y = 16;
const MIN_WIDTH = 60;
const MIN_HEIGHT = 40;
const DIAMOND_SCALE = 1.5;
const ICON_LABEL_GAP = 6;

export function estimateNodeSize(specNode, theme) {
  const ts = theme.typeScale;
  const measure = theme.measure ?? measureText;
  const lines = (specNode.label || '').split('\n');

  if (specNode.icon || specNode.category === 'human') {
    const glyph = specNode.iconSize
      || (theme.icon?.mode === 'tile' && specNode.category !== 'human'
        ? theme.icon.tile.size : 48);
    const labelW = Math.max(0, ...lines.map(l => measure(l, ts.iconTitle, ts.titleWeight)));
    const subW = specNode.subtitle ? measure(specNode.subtitle, ts.iconSub) : 0;
    const width = Math.max(labelW + 16, subW + 16, glyph + 24, MIN_WIDTH);
    const height = glyph + ICON_LABEL_GAP + lines.length * ts.iconTitle * LINE_HEIGHT
      + (specNode.subtitle ? ts.iconSub * LINE_HEIGHT : 0) + 8;
    return { width: Math.ceil(width), height: Math.ceil(height) };
  }

  const titleW = Math.max(0, ...lines.map(l => measure(l, ts.title, ts.titleWeight)));
  const titleH = lines.length * ts.title * LINE_HEIGHT;
  const subW = specNode.subtitle ? measure(specNode.subtitle, ts.secondary) : 0;
  const subH = specNode.subtitle ? ts.secondary * LINE_HEIGHT + 4 : 0;

  let width = Math.max(titleW, subW) + PADDING_X * 2;
  let height = titleH + subH + PADDING_Y * 2;
  if (specNode.shape === 'diamond') { width *= DIAMOND_SCALE; height *= DIAMOND_SCALE; }
  if (specNode.shape === 'cylinder') height += 24;
  return {
    width: Math.ceil(Math.max(width, MIN_WIDTH)),
    height: Math.ceil(Math.max(height, MIN_HEIGHT)),
  };
}
