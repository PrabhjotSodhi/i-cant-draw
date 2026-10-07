import quiet from './quiet.mjs';
import { systemFont } from './fonts.mjs';

const STYLES = { quiet };

export const STYLE_NAMES = Object.keys(STYLES);

export function loadStyle(name = 'crayon') {
  const style = STYLES[name];
  if (!style) throw new Error(`unknown style "${name}"; valid: ${STYLE_NAMES.join(', ')}`);
  // A system font is looked up the first time its style is used, so a missing font warns only when it matters.
  if (style.font && !style.measure) {
    const { family, fonts, measure } = systemFont(style.font);
    Object.assign(style, { fontFamily: family, fonts, measure });
  }
  return style;
}
