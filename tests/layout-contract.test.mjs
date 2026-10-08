import { describe, it, expect } from 'vitest';
import { assertLayout } from '../skills/i-cant-draw/scripts/layout-contract.mjs';

const valid = () => ({
  width: 400, height: 200,
  nodes: [{ id: 'a', x: 0, y: 0, width: 100, height: 60 }],
  groups: [{ id: 'g', x: -10, y: -10, width: 120, height: 80, depth: 0, spec: {} }],
  edges: [{ index: 0, sections: [{ startPoint: { x: 100, y: 30 }, endPoint: { x: 200, y: 30 }, bendPoints: [] }],
    labels: [{ text: 'l', x: 120, y: 5, width: 40, height: 18 }] }],
  trunks: [{ startPoint: { x: 150, y: 0 }, endPoint: { x: 150, y: 100 }, bendPoints: [] }],
});

describe('assertLayout', () => {
  it('passes a valid layout and returns it', () => {
    const layout = valid();
    expect(assertLayout(layout)).toBe(layout);
  });
  it('names a non-finite node coordinate', () => {
    const layout = valid(); layout.nodes[0].x = NaN;
    expect(() => assertLayout(layout)).toThrow(/nodes\[0\]\.x/);
  });
  it('rejects an edge without sections', () => {
    const layout = valid(); layout.edges[0].sections = [];
    expect(() => assertLayout(layout)).toThrow(/edges\[0\]\.sections/);
  });
  it('names a non-finite trunk point', () => {
    const layout = valid(); layout.trunks[0].endPoint.y = Infinity;
    expect(() => assertLayout(layout)).toThrow(/trunks\[0\]\.endPoint\.y/);
  });
  it('accepts every end marker on both ends of a section and a trunk', () => {
    for (const marker of ['none', 'arrow', 'one', 'many', 'triangle']) {
      const layout = valid();
      Object.assign(layout.edges[0].sections[0], { startMarker: marker, endMarker: marker });
      layout.trunks[0].endMarker = marker;
      expect(assertLayout(layout)).toBe(layout);
    }
  });
  it('names an unknown end marker', () => {
    const layout = valid(); layout.edges[0].sections[0].endMarker = 'diamond';
    expect(() => assertLayout(layout)).toThrow(/edges\[0\]\.sections\[0\]\.endMarker/);
  });
  it('checks end label boxes and their end', () => {
    const layout = valid();
    layout.edges[0].endLabels = [{ text: '1', x: 170, y: 40, width: 12, height: 18, end: 'end' }];
    expect(assertLayout(layout)).toBe(layout);
    layout.edges[0].endLabels[0].end = 'middle';
    expect(() => assertLayout(layout)).toThrow(/edges\[0\]\.endLabels\[0\]\.end/);
    layout.edges[0].endLabels[0] = { text: '1', x: 170, y: NaN, width: 12, height: 18, end: 'end' };
    expect(() => assertLayout(layout)).toThrow(/edges\[0\]\.endLabels\[0\]\.y/);
  });
  it('checks a group title box when present', () => {
    const layout = valid();
    layout.groups[0].titleBox = { x: 6, y: -1, width: 40, height: 17 };
    expect(assertLayout(layout)).toBe(layout);
    layout.groups[0].titleBox.width = NaN;
    expect(() => assertLayout(layout)).toThrow(/groups\[0\]\.titleBox\.width/);
  });
});
