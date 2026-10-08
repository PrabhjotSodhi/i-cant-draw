import { describe, it, expect } from 'vitest';
import { checkCollisions } from '../skills/i-cant-draw/scripts/collision-check.mjs';

describe('checkCollisions', () => {
  it('ignores overlaps that share an owner (text inside its own node)', () => {
    const g = [
      { owner: 'a', kind: 'node', x: 0, y: 0, width: 100, height: 50 },
      { owner: 'a', kind: 'text', x: 10, y: 10, width: 80, height: 20 },
    ];
    expect(checkCollisions(g)).toEqual([]);
  });
  it('flags text overlapping a foreign node', () => {
    const g = [
      { owner: 'a', kind: 'node', x: 0, y: 0, width: 100, height: 50 },
      { owner: 'e1', kind: 'edge-label', x: 90, y: 40, width: 60, height: 20 },
    ];
    const r = checkCollisions(g);
    expect(r).toHaveLength(1);
    expect(r[0].overlap.width).toBeCloseTo(10);
  });
  it('ignores sub-pixel touches', () => {
    const g = [
      { owner: 'a', kind: 'node', x: 0, y: 0, width: 100, height: 50 },
      { owner: 'b', kind: 'node', x: 99.8, y: 0, width: 100, height: 50 },
    ];
    expect(checkCollisions(g)).toEqual([]);
  });

});
