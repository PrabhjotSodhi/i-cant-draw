import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { lintLayout } from '../skills/i-cant-draw/scripts/layout-lint.mjs';
import { flowLayout } from '../skills/i-cant-draw/scripts/templates/flow.mjs';
import { hubLayout } from '../skills/i-cant-draw/scripts/templates/hub.mjs';
import { loadStyle } from '../skills/i-cant-draw/scripts/styles/index.mjs';

const quiet = loadStyle('quiet');
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)));
const rules = findings => [...new Set(findings.map(f => f.rule))];

const base = () => ({
  spec: { template: 'flow', nodes: [
    { id: 'a', label: 'A', row: 0, col: 0 }, { id: 'b', label: 'B', row: 0, col: 1 }, { id: 'c', label: 'C', row: 1, col: 1 },
  ], edges: [{ from: 'a', to: 'b', label: 'x' }] },
  layout: {
    width: 600, height: 300,
    nodes: [
      { id: 'a', x: 0, y: 0, width: 200, height: 80 },
      { id: 'b', x: 400, y: 0, width: 200, height: 80 },
      { id: 'c', x: 400, y: 200, width: 200, height: 80 },
    ],
    groups: [],
    edges: [{ index: 0, sections: [{ startPoint: { x: 200, y: 40 }, endPoint: { x: 400, y: 40 }, bendPoints: [] }],
      labels: [{ text: 'x', x: 290, y: 16, width: 20, height: 18 }] }],
    trunks: [],
  },
});

describe('lintLayout: line-on-border', () => {
  const zone = (box) => ({ id: 'zone', depth: 0, ...box });
  it('flags an edge that runs along a group border, naming the group', () => {
    const { spec, layout } = base();
    layout.groups = [zone({ x: 150, y: -30, width: 300, height: 73 })];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'line-on-border', owner: 'a→b', detail: 'runs 200 units along the border of zone' }]);
  });
  it('flags a trunk that runs along a group border', () => {
    const { spec, layout } = base();
    layout.trunks = [{ startPoint: { x: 300, y: 100 }, endPoint: { x: 300, y: 180 }, bendPoints: [] }];
    layout.groups = [zone({ x: 297, y: 90, width: 80, height: 100 })];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'line-on-border', owner: 'trunk 0', detail: 'runs 80 units along the border of zone' }]);
  });
  it('passes a line that crosses a border, sits more than 4 units off it, or shares it for 20 units or less', () => {
    for (const box of [
      { x: 330, y: 0, width: 400, height: 300 },
      { x: 150, y: -30, width: 300, height: 75 },
      { x: 380, y: -30, width: 300, height: 72 },
    ]) {
      const { spec, layout } = base();
      layout.groups = [zone(box)];
      expect(lintLayout(layout, spec), JSON.stringify(box)).toEqual([]);
    }
  });
});

describe('lintLayout', () => {
  it('passes a clean layout', () => {
    const { spec, layout } = base();
    expect(lintLayout(layout, spec)).toEqual([]);
  });
  it('flags more than two bends', () => {
    const { spec, layout } = base();
    layout.edges[0].sections[0].bendPoints = [{ x: 250, y: 40 }, { x: 250, y: 120 }, { x: 350, y: 120 }, { x: 350, y: 40 }];
    layout.edges[0].labels = [];
    expect(rules(lintLayout(layout, spec))).toEqual(['bends']);
  });
  it('flags a label far from its line', () => {
    const { spec, layout } = base();
    layout.edges[0].labels[0].y = 120;
    expect(rules(lintLayout(layout, spec))).toEqual(['label-distance']);
  });
  it('flags uneven widths in a flow column', () => {
    const { spec, layout } = base();
    layout.nodes[2].width = 180;
    expect(rules(lintLayout(layout, spec))).toEqual(['column-width']);
  });
  it('flags a card off its row centre line', () => {
    const { spec, layout } = base();
    layout.nodes[1].y = 5;
    layout.edges[0].sections[0].endPoint.y = 40;
    expect(rules(lintLayout(layout, spec))).toEqual(['row-centre']);
  });
  it('aligns schema rows on their top edge instead of their centre', () => {
    const { spec, layout } = base();
    spec.template = 'schema';
    layout.nodes[1].height = 120;
    expect(lintLayout(layout, spec)).toEqual([]);
    layout.nodes[1].y = 5;
    expect(rules(lintLayout(layout, spec))).toEqual(['row-top']);
  });
  it('flags a route through a foreign card', () => {
    const { spec, layout } = base();
    spec.edges.push({ from: 'a', to: 'c' });
    layout.edges.push({ index: 1, sections: [{ startPoint: { x: 100, y: 80 }, endPoint: { x: 500, y: 200 }, bendPoints: [{ x: 100, y: 240 }, { x: 500, y: 240 }] }], labels: [] });
    layout.nodes.push({ id: 'd', x: 250, y: 200, width: 100, height: 80 });
    spec.nodes.push({ id: 'd', label: 'D', row: 1, col: 2 });
    expect(rules(lintLayout(layout, spec))).toContain('through-card');
  });
  it('flags uneven widths in a hub stack', () => {
    const spec = fixture('hub-deployment');
    const layout = hubLayout(spec, quiet);
    layout.nodes.find(n => n.id === 'secrets').width -= 10;
    expect(rules(lintLayout(layout, spec))).toEqual(['stack-width']);
  });
  it('passes both template fixtures as rendered', () => {
    for (const [name, fn] of [['hub-deployment', hubLayout], ['flow-components', flowLayout]]) {
      const spec = fixture(name);
      expect(lintLayout(fn(spec, quiet), spec), name).toEqual([]);
    }
  });
});

describe('lintLayout trunk overlap', () => {
  it('flags two trunks on one line', () => {
    const { spec, layout } = base();
    layout.trunks = [
      { startPoint: { x: 330, y: 0 }, endPoint: { x: 330, y: 200 }, bendPoints: [] },
      { startPoint: { x: 333, y: 100 }, endPoint: { x: 333, y: 280 }, bendPoints: [] },
    ];
    expect(rules(lintLayout(layout, spec))).toEqual(['trunk-overlap']);
  });
});

describe('lintLayout edge overlap', () => {
  it('flags two different edges running on one line', () => {
    const { spec, layout } = base();
    spec.edges.push({ from: 'c', to: 'b' });
    layout.edges.push({ index: 1, sections: [{ startPoint: { x: 250, y: 40 }, endPoint: { x: 350, y: 40 }, bendPoints: [] }], labels: [] });
    expect(rules(lintLayout(layout, spec))).toContain('edge-overlap');
  });
  it('does not flag segments that only touch end to end', () => {
    const { spec, layout } = base();
    layout.trunks = [{ startPoint: { x: 100, y: 40 }, endPoint: { x: 200, y: 40 }, bendPoints: [] }];
    expect(rules(lintLayout(layout, spec))).not.toContain('edge-overlap');
  });
});

describe('lintLayout labels on group borders', () => {
  const zone = (x) => ({ id: 'zone', x, y: -30, width: 640 - x, height: 140, depth: 0, spec: {} });
  it('flags an edge label across a group border, naming the group', () => {
    const { spec, layout } = base();
    layout.groups = [zone(300)];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'label-on-border', owner: 'a→b', detail: '"x" sits on the border of zone' }]);
  });
  it('flags an end label across a group border', () => {
    const { spec, layout } = base();
    layout.groups = [zone(330)];
    layout.edges[0].endLabels = [{ text: '1', end: 'start', x: 320, y: 46, width: 16, height: 18 }];
    expect(rules(lintLayout(layout, spec))).toEqual(['label-on-border']);
  });
  it('passes a label clear of the border or within 2 units of it', () => {
    const { spec, layout } = base();
    for (const x of [330, 309, 291]) {
      layout.groups = [zone(x)];
      expect(lintLayout(layout, spec), `border at ${x}`).toEqual([]);
    }
  });
});

describe('lintLayout lines through group titles', () => {
  const titled = (titleY) => ({ id: 'zone', x: 220, y: -60, width: 160, height: 200, depth: 0, spec: {},
    titleBox: { x: 236, y: titleY, width: 120, height: 17 } });
  it('flags an edge through a group title, naming the group', () => {
    const { spec, layout } = base();
    layout.groups = [titled(32)];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'line-through-title', owner: 'a→b', detail: 'crosses the title of zone' }]);
  });
  it('flags a trunk through a group title', () => {
    const { spec, layout } = base();
    layout.groups = [titled(-50)];
    layout.trunks = [{ startPoint: { x: 300, y: -80 }, endPoint: { x: 300, y: 0 }, bendPoints: [] }];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'line-through-title', owner: 'trunk 0', detail: 'crosses the title of zone' }]);
  });
  it('passes a line clear of the title', () => {
    const { spec, layout } = base();
    layout.groups = [titled(-50)];
    expect(lintLayout(layout, spec)).toEqual([]);
  });
});

describe('lintLayout title overflow', () => {
  const zone = (titleWidth) => ({ id: 'zone', x: 380, y: -40, width: 240, height: 140, depth: 0, spec: {},
    titleBox: { x: 396, y: -27, width: titleWidth, height: 17 } });
  it('flags a title that runs within 8 units of its group right edge or past it', () => {
    const { spec, layout } = base();
    layout.groups = [zone(220)];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'title-overflow', owner: 'zone', detail: 'title ends 4 units from the right edge' }]);
    layout.groups = [zone(260)];
    expect(rules(lintLayout(layout, spec))).toEqual(['title-overflow']);
  });
  it('passes a title that ends 8 units or more before the right edge', () => {
    const { spec, layout } = base();
    layout.groups = [zone(216)];
    expect(lintLayout(layout, spec)).toEqual([]);
  });
});

describe('lintLayout labels on another line', () => {
  const crossing = (x) => ({ index: 1, sections: [{ startPoint: { x, y: -20 }, endPoint: { x, y: 120 }, bendPoints: [] }], labels: [] });
  it('flags an edge label that another edge passes through, naming that edge', () => {
    const { spec, layout } = base();
    spec.edges.push({ from: 'c', to: 'b' });
    layout.edges.push(crossing(300));
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'label-on-line', owner: 'a→b', detail: '"x" sits on c→b' }]);
  });
  it('flags an edge label that a trunk passes through, naming the trunk', () => {
    const { spec, layout } = base();
    layout.trunks = [{ startPoint: { x: 300, y: -20 }, endPoint: { x: 300, y: 120 }, bendPoints: [] }];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'label-on-line', owner: 'a→b', detail: '"x" sits on trunk 0' }]);
  });
  it('flags an end label that another edge passes through', () => {
    const { spec, layout } = base();
    spec.edges.push({ from: 'c', to: 'b' });
    layout.edges.push(crossing(240));
    layout.edges[0].endLabels = [{ text: '1', end: 'start', x: 230, y: 52, width: 16, height: 18 }];
    expect(lintLayout(layout, spec)).toEqual([{ rule: 'label-on-line', owner: 'a→b', detail: '"1" sits on c→b' }]);
  });
  it('passes a line clear of the label or within 2 units of its box', () => {
    const { spec, layout } = base();
    spec.edges.push({ from: 'c', to: 'b' });
    layout.edges.push(crossing(0));
    for (const x of [280, 291, 309]) {
      layout.edges[1].sections[0].startPoint.x = x;
      layout.edges[1].sections[0].endPoint.x = x;
      expect(lintLayout(layout, spec), `line at ${x}`).toEqual([]);
    }
  });
  it('passes a label on its own line', () => {
    const { spec, layout } = base();
    layout.edges[0].sections[0].bendPoints = [{ x: 300, y: 40 }, { x: 300, y: 25 }, { x: 300, y: 40 }];
    expect(rules(lintLayout(layout, spec))).not.toContain('label-on-line');
  });
});
