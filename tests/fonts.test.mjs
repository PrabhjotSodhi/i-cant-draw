import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { systemFont } from '../skills/i-cant-draw/scripts/styles/fonts.mjs';
import { measureText } from '../skills/i-cant-draw/scripts/text-metrics.mjs';

const avenir = '/System/Library/Fonts/Avenir Next.ttc';

describe('systemFont', () => {
  it('falls back to Inter and warns once when the font is not installed', () => {
    const warnings = [];
    const spec = { family: 'Nowhere Sans', regular: { file: '/no/such/font.ttc', name: 'X' }, bold: { file: '/no/such/font.ttc', name: 'Y' } };
    const a = systemFont(spec, { warn: (m) => warnings.push(m) });
    systemFont(spec, { warn: (m) => warnings.push(m) });
    expect(a.measure('Hello', 16)).toBe(measureText('Hello', 16));
    expect(a.fonts).toEqual(['Inter-Regular.ttf', 'Inter-SemiBold.ttf']);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Nowhere Sans.*Inter/);
  });
  it.skipIf(!existsSync(avenir))('measures with the installed font and lists its file', () => {
    const f = systemFont({ family: 'Avenir Next', regular: { file: avenir, name: 'AvenirNext-Regular' }, bold: { file: avenir, name: 'AvenirNext-DemiBold' } });
    expect(f.family).toBe('Avenir Next');
    expect(f.fonts).toEqual([avenir]);
    expect(f.measure('Hello world', 16)).not.toBe(measureText('Hello world', 16));
    expect(f.measure('Hello', 16, 600)).toBeGreaterThan(f.measure('Hello', 16, 400));
  });
});
