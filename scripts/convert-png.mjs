import { Resvg } from '@resvg/resvg-js';
import { join, dirname, isAbsolute } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = join(__dirname, '..', 'references', 'fonts');

export function convertToPng(svg, { scale = 2, fonts = ['Inter-Regular.ttf', 'Inter-SemiBold.ttf'] } = {}) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: {
      // Inter stays loaded so any glyph a system font lacks still draws.
      fontFiles: [...new Set([...fonts, 'Inter-Regular.ttf', 'Inter-SemiBold.ttf'])].map(file => (isAbsolute(file) ? file : join(FONT_DIR, file))),
      loadSystemFonts: false,
      defaultFontFamily: 'Inter',
    },
  });
  return resvg.render().asPng();
}
