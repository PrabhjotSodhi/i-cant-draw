import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { runPipeline } from '../scripts/pipeline.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';

const CASES = { flow: 'rag-chatbot', hub: 'checkout-hld', sequence: 'coding-agent', state: 'checkout-statuses', schema: 'shop-schema', class: 'payments-classes' };
const goldens = readdirSync(new URL('../references/goldens/', import.meta.url)).filter(f => f.endsWith('.png'));
// A style whose system font is missing draws in Inter, so its golden only matches where the font is installed.
const fontMissing = (style) => Boolean(style.font) && style.fonts[0] === 'Inter-Regular.ttf';

describe('goldens', () => {
  it('pins every layout in crayon and quiet, and the hub in every style', () => {
    for (const layout of Object.keys(CASES)) for (const style of ['crayon', 'quiet']) expect(goldens).toContain(`${style}-${layout}.png`);
    for (const style of ['riso', 'whiteboard', 'notebook', 'watercolour']) expect(goldens).toContain(`${style}-hub.png`);
  });
  for (const file of goldens) {
    const [styleName, layout] = file.replace(/\.png$/, '').split('-');
    it.skipIf(fontMissing(loadStyle(styleName)))(`${file} matches a fresh render byte for byte`, async () => {
      const spec = JSON.parse(readFileSync(new URL(`../evals/${CASES[layout]}/spec.json`, import.meta.url)));
      const result = await runPipeline({ ...spec, style: styleName }, { outputDir: mkdtempSync(join(tmpdir(), 'golden-')), baseName: file.replace(/\.png$/, '') });
      expect(readFileSync(result.pngPath).equals(readFileSync(new URL(`../references/goldens/${file}`, import.meta.url)))).toBe(true);
    });
  }
});
