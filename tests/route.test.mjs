import { describe, it, expect } from 'vitest';
import { side, straight, elbow, zRoute, uRoute, trunkRoute, spreadPorts, labelFor, boxDistanceToSection, endLabelFor, selfLoop } from '../scripts/templates/route.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';

const quiet = loadStyle('quiet');
const box = { x: 0, y: 0, width: 100, height: 60 };
const centreOf = l => ({ x: l.x + l.width / 2, y: l.y + l.height / 2 });

describe('route helpers', () => {
  it('finds side midpoints', () => {
    expect(side(box, 'right')).toEqual({ x: 100, y: 30 });
    expect(side(box, 'top')).toEqual({ x: 50, y: 0 });
  });
  it('straight has no bends', () => {
    expect(straight({ x: 0, y: 0 }, { x: 10, y: 0 }).bendPoints).toHaveLength(0);
  });
  it('elbow bends once, vertical first', () => {
    expect(elbow({ x: 0, y: 0 }, { x: 100, y: 50 }).bendPoints).toEqual([{ x: 0, y: 50 }]);
  });
  it('zRoute turns twice at one x', () => {
    const s = zRoute({ x: 0, y: 0 }, { x: 100, y: 50 }, 60);
    expect(s.bendPoints).toEqual([{ x: 60, y: 0 }, { x: 60, y: 50 }]);
  });
  it('uRoute runs along one lane', () => {
    const s = uRoute({ x: 200, y: 60 }, { x: 0, y: 60 }, 300);
    expect(s.bendPoints).toEqual([{ x: 200, y: 300 }, { x: 0, y: 300 }]);
  });
  it('trunkRoute gives one horizontal branch per target', () => {
    const targets = [{ x: 300, y: 0 }, { x: 300, y: 100 }, { x: 300, y: 200 }];
    const { stem, trunk, branches } = trunkRoute({ x: 100, y: 100 }, 200, targets);
    expect(branches).toHaveLength(3);
    for (const b of branches) expect(b.startPoint.y).toBe(b.endPoint.y);
    expect(trunk.startPoint).toEqual({ x: 200, y: 0 });
    expect(trunk.endPoint).toEqual({ x: 200, y: 200 });
    expect(stem.endPoint).toEqual({ x: 200, y: 100 });
  });
  it('spreads ports 12 apart, centred on the side', () => {
    const ports = spreadPorts(box, 'right', 3);
    expect(ports).toEqual([{ x: 100, y: 18 }, { x: 100, y: 30 }, { x: 100, y: 42 }]);
  });
  it('labels the horizontal segment of an elbow, close to the line', () => {
    const s = elbow({ x: 0, y: 0 }, { x: 200, y: 100 });
    const l = labelFor(s, 'jobs', quiet);
    expect(centreOf(l).y).toBeLessThan(100);
    expect(boxDistanceToSection(l, s)).toBeLessThanOrEqual(8);
  });
  it('measures a label box to its line', () => {
    const s = straight({ x: 50, y: 0 }, { x: 50, y: 200 });
    expect(boxDistanceToSection({ x: 62, y: 90, width: 150, height: 18 }, s)).toBeCloseTo(12, 6);
    expect(boxDistanceToSection({ x: 40, y: 90, width: 20, height: 18 }, s)).toBe(0);
  });
  it('keeps a label off every group border its line crosses', () => {
    const s = straight({ x: 50, y: 0 }, { x: 50, y: 400 });
    const groups = [{ x: 0, y: 150, width: 200, height: 100 }];
    const l = labelFor(s, 'session channel', quiet, groups);
    const crosses = y => l.y < y && l.y + l.height > y;
    expect(crosses(150)).toBe(false);
    expect(crosses(250)).toBe(false);
    expect(l.y + l.height).toBeLessThanOrEqual(150);
  });
  it('labels a vertical line to its right', () => {
    const s = straight({ x: 50, y: 0 }, { x: 50, y: 200 });
    const l = labelFor(s, 'session channel', quiet);
    expect(l.x).toBe(62);
  });
});
