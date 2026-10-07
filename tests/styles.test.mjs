import { describe, it, expect } from 'vitest';
import { loadStyle } from '../scripts/styles/index.mjs';

const box = { x: 0, y: 0, width: 200, height: 80 };

describe('quiet style', () => {
  const quiet = loadStyle('quiet');
  it('provides the full interface', () => {
    for (const key of ['name', 'fonts', 'fontFamily', 'typeScale', 'cardSize', 'spacing', 'palette']) expect(quiet[key], key).toBeTruthy();
    for (const key of ['measure', 'groupFill', 'defs', 'group', 'card', 'line', 'text', 'icon', 'actor', 'overlay']) expect(typeof quiet[key], key).toBe('function');
  });
  it('draws cards with a border, and the hub card with the accent', () => {
    expect(quiet.card({ box, kind: 'card', emphasis: false }, {})).toContain('stroke="#CBD5E1"');
    expect(quiet.card({ box, kind: 'card', emphasis: true }, {})).toContain('stroke="#2563EB"');
  });
  it('draws main edges darker and thicker', () => {
    const svg = quiet.line([{ x: 0, y: 0 }, { x: 100, y: 0 }], { main: true, endMarker: 'arrow' }, {});
    expect(svg).toContain('stroke="#334155"');
    expect(svg).toContain('stroke-width="2"');
    expect(svg).toContain('marker-end="url(#quiet-head-main)"');
  });
  it('leaves depth-0 groups unfilled', () => {
    expect(quiet.group({ box, depth: 0, label: 'x' }, {})).toContain('fill="none"');
  });
  it('fills a toned top-level group with its tone', () => {
    expect(quiet.group({ box, depth: 0, label: 'x', tone: 'orange' }, {})).toContain('fill="#FFF7ED"');
    expect(quiet.groupFill({ depth: 0, tone: 'orange' })).toBe('#FFF7ED');
    expect(quiet.groupFill({ depth: 0 })).toBe('none');
  });
  it('defines both arrow markers', () => {
    const defs = quiet.defs({});
    expect(defs).toContain('id="quiet-head"');
    expect(defs).toContain('id="quiet-head-main"');
  });
});
