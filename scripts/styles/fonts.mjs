import { existsSync, readFileSync } from 'fs';
import * as fontkit from 'fontkit';
import { measureText } from '../text-metrics.mjs';

const INTER = { family: "Inter, 'Helvetica Neue', Arial, sans-serif", fonts: ['Inter-Regular.ttf', 'Inter-SemiBold.ttf'], measure: measureText };
const warned = new Set();

// A face inside a .ttc collection is picked by its PostScript name.
function face({ file, name }) {
  const font = fontkit.create(readFileSync(file));
  return font.fonts ? font.fonts.find(f => f.postscriptName === name) : font;
}

/** An installed system font for a style, or Inter with one warning when this machine lacks it. */
export function systemFont({ family, regular, bold }, { warn = (message) => console.error(message) } = {}) {
  const faces = [regular, bold].every(f => existsSync(f.file)) ? { 400: face(regular), 600: face(bold) } : {};
  if (!faces[400] || !faces[600]) {
    if (!warned.has(family)) warn(`i-cant-draw: the font "${family}" is not installed here, so this style draws in Inter.`);
    warned.add(family);
    return INTER;
  }
  const measure = (text, size, weight = 400) => {
    if (!text) return 0;
    const f = weight >= 600 ? faces[600] : faces[400];
    return (f.layout(String(text)).advanceWidth / f.unitsPerEm) * size;
  };
  return { family, fonts: [...new Set([regular.file, bold.file])], measure };
}
