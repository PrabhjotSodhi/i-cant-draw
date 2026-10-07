import { describe, it, expect } from 'vitest';
import { seededRandom, hashSpec } from '../scripts/render/random.mjs';

describe('seededRandom', () => {
  it('repeats for the same seed', () => {
    const a = seededRandom(42), b = seededRandom(42);
    for (let i = 0; i < 10; i++) expect(a()).toBe(b());
  });
  it('differs across seeds', () => {
    expect(seededRandom(42)()).not.toBe(seededRandom(43)());
  });
  it('stays in [0, 1)', () => {
    const r = seededRandom(7);
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('hashSpec', () => {
  it('is stable and content-sensitive', () => {
    expect(hashSpec({ a: 1 })).toBe(hashSpec({ a: 1 }));
    expect(hashSpec({ a: 1 })).not.toBe(hashSpec({ a: 2 }));
  });
});
