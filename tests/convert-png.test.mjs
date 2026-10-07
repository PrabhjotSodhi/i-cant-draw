import { describe, it, expect } from 'vitest';
import { convertToPng } from '../scripts/convert-png.mjs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><rect width="100%" height="100%" fill="#fff"/><text x="100" y="30" text-anchor="middle" font-family="Inter" font-size="18">Hello Inter</text></svg>`;

describe('convertToPng', () => {
  it('renders text with bundled fonts only (no system fonts)', () => {
    const png = convertToPng(svg);
    expect(png.length).toBeGreaterThan(1000);
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });
  it('defaults to 2x scale', () => {
    const png1 = convertToPng(svg, { scale: 1 });
    const png2 = convertToPng(svg);
    expect(png2.length).toBeGreaterThan(png1.length);
  });
});

describe('convertToPng fonts', () => {
  it('accepts an explicit font list', () => {
    const png = convertToPng(svg, { fonts: ['Inter-Regular.ttf'] });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });
});
