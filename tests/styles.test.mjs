import { describe, it, expect } from 'vitest';
import { loadStyle } from '../scripts/styles/index.mjs';

const box = { x: 0, y: 0, width: 200, height: 80 };

describe('loadStyle', () => {
  it('defaults to crayon and rejects unknown names', () => {
    expect(loadStyle().name).toBe('crayon');
    expect(() => loadStyle('nope')).toThrow(/unknown style "nope"; valid: quiet, crayon, riso, whiteboard, notebook, watercolour/);
  });
});

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

describe('end markers', () => {
  const points = [{ x: 0, y: 50 }, { x: 200, y: 50 }];
  const shapes = (svg) => (svg.match(/<(path|polygon)\b/g) || []).length;
  for (const name of ['quiet', 'crayon']) {
    const style = loadStyle(name);
    const ctx = () => ({ random: (() => { let i = 0; return () => ((i++ * 0.37) % 1); })() });
    const draw = (opts) => style.line(points, opts, ctx());
    it(`${name}: a bare line draws nothing extra at its ends`, () => {
      expect(draw({ endMarker: 'none', startMarker: 'none' })).toBe(draw({}));
    });
    it(`${name}: one, many and triangle each add a marker at the end they name`, () => {
      const bare = draw({});
      for (const marker of ['one', 'many', 'triangle']) {
        const end = draw({ endMarker: marker }), start = draw({ startMarker: marker });
        expect(end, marker).not.toBe(bare);
        expect(start, marker).not.toBe(end);
      }
      expect(shapes(draw({ endMarker: 'triangle' }))).toBeGreaterThan(shapes(bare));
      expect(draw({ endMarker: 'triangle' })).toContain('fill="#FFFFFF"');
    });
  }
});

describe('state kinds in both styles', () => {
  const box = { x: 10, y: 10, width: 180, height: 56 };
  for (const name of ['quiet', 'crayon']) {
    const style = loadStyle(name);
    const ctx = { random: (() => { let i = 0; return () => ((i++ * 0.37) % 1); })() };
    it(`${name}: a state is rounded and tinted with its zone's tone`, () => {
      const svg = style.card({ box, kind: 'state', tone: 'green' }, ctx);
      expect(svg).toContain('rx="18"');
      if (name === 'crayon') expect(svg).toContain(`fill="${style.palette.tones.green.fill}" fill-opacity="0.16"`);
      else expect(svg).toContain(`stroke="${style.palette.tones.green.text}"`);
    });
    it(`${name}: start is a filled dot and end is a ring around a dot`, () => {
      const start = style.card({ box: { x: 0, y: 0, width: 20, height: 20 }, kind: 'start' }, ctx);
      const end = style.card({ box: { x: 0, y: 0, width: 26, height: 26 }, kind: 'end' }, ctx);
      expect((start.match(/<circle/g) || []).length).toBe(1);
      expect(start).toContain('r="10"');
      expect((end.match(/<circle/g) || []).length).toBe(2);
      expect(end).toContain('r="13"');
      expect(end).toContain('r="7"');
    });
  }
});
