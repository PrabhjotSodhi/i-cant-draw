import { describe, it, expect } from 'vitest';
import { measureText, estimateNodeSize, LINE_HEIGHT } from '../scripts/text-metrics.mjs';

const theme = {
  typeScale: { title: 18, titleWeight: 600, secondary: 15, muted: 13.5,
               edgeLabel: 13, groupLabel: 13.5, iconTitle: 16, iconSub: 13.5 },
  icon: { mode: 'plain', tile: { size: 64 } },
};

describe('measureText', () => {
  it('measures with fontkit, not estimation', () => {
    // Verified against fontkit directly: 'Ingest pipelines' @18 regular = 133.7px
    expect(measureText('Ingest pipelines', 18)).toBeGreaterThan(125);
    expect(measureText('Ingest pipelines', 18)).toBeLessThan(145);
  });
  it('semibold is wider than regular', () => {
    expect(measureText('Matcher', 18, 600)).toBeGreaterThan(measureText('Matcher', 18, 400));
  });
  it('empty text is 0', () => expect(measureText('', 18)).toBe(0));
});

describe('estimateNodeSize', () => {
  it('sizes a box from measured title plus padding', () => {
    const { width, height } = estimateNodeSize({ label: 'Ingest pipelines' }, theme);
    expect(width).toBeGreaterThan(133 + 48 - 10);
    expect(width).toBeLessThan(133 + 48 + 20);
    expect(height).toBeGreaterThanOrEqual(Math.ceil(18 * LINE_HEIGHT + 32));
  });
  it('adds room for an inside subtitle', () => {
    const a = estimateNodeSize({ label: 'Matcher' }, theme);
    const b = estimateNodeSize({ label: 'Matcher', subtitle: 'amount / date / merchant' }, theme);
    expect(b.height).toBeGreaterThan(a.height);
    expect(b.width).toBeGreaterThan(a.width);
  });
  it('diamonds scale up for text fit', () => {
    const box = estimateNodeSize({ label: 'ok?' }, theme);
    const dia = estimateNodeSize({ label: 'ok?', shape: 'diamond' }, theme);
    expect(dia.width).toBeGreaterThan(box.width);
  });
  it('icon nodes size from glyph plus label below', () => {
    const r = estimateNodeSize({ label: 'Receipt uploads', icon: 'database', subtitle: '(PDF)' }, theme);
    expect(r.height).toBeGreaterThan(64 + 16 * LINE_HEIGHT);
  });
});
