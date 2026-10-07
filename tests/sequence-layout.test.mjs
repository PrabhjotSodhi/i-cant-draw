import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { sequenceLayout } from '../scripts/sequence-layout.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';
import { styleAsTheme } from '../scripts/render/draw.mjs';

const theme = styleAsTheme(loadStyle('quiet'));
const spec = JSON.parse(readFileSync(new URL('../evals/upload-sequence/spec.json', import.meta.url)));

describe('sequenceLayout', () => {
  const layout = sequenceLayout(spec, theme);
  const centerOf = (id) => layout.lifelines.find(l => l.owner === id).x;

  it('orders lifelines by declaration', () => {
    const xs = spec.actors.map(a => centerOf(a.id));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });
  it('orders message rows by declaration', () => {
    const ys = layout.edges
      .filter(e => spec.messages[e.index].from !== spec.messages[e.index].to)
      .map(e => e.sections[0].startPoint.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
  it('pairs activations from call to return', () => {
    const storage = layout.activations.filter(a => a.owner === 'storage');
    expect(storage).toHaveLength(1);
    expect(storage[0].height).toBeGreaterThan(20);
  });
  it('frames cover their regions with guards clear of bars', () => {
    expect(layout.frames).toHaveLength(1);
    const frame = layout.frames[0];
    expect(frame.kind).toBe('alt');
    expect(frame.guards).toHaveLength(2);
    for (const guard of frame.guards) {
      for (const bar of layout.activations) {
        const inBand = guard.y >= bar.y - 4 && guard.y <= bar.y + bar.height + 4;
        if (inBand) expect(guard.x).toBeGreaterThanOrEqual(bar.x + bar.width);
      }
    }
  });
  it('self-messages loop beside their lifeline', () => {
    const self = layout.edges.find(e => spec.messages[e.index].from === spec.messages[e.index].to);
    expect(self.sections[0].bendPoints[0].x).toBeGreaterThan(centerOf('upload'));
  });
});

describe('sequenceLayout: async messages', () => {
  const spec = { actors: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }],
    messages: [{ from: 'c', to: 'b', label: 'report', kind: 'async' }, { from: 'a', to: 'b', label: 'ask' }, { from: 'b', to: 'a', label: 'answer', kind: 'return' }, { from: 'a', to: 'c', label: 'later' }, { from: 'c', to: 'a', label: 'done', kind: 'return' }] };
  const layout = sequenceLayout(spec, theme);
  it('gives a fire-and-forget message a short bar that does not run to the bottom', () => {
    const bars = layout.activations.filter(b => b.owner === 'b').sort((m, n) => m.y - n.y);
    expect(bars[0].height).toBe(24);
    expect(bars).toHaveLength(2);
  });
});

describe('sequenceLayout: unanswered calls', () => {
  const actors = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }];
  const rowOf = (layout, index) => layout.edges.find(e => e.index === index).sections[0].startPoint.y;
  const barsOf = (layout, id) => layout.activations.filter(bar => bar.owner === id).sort((m, n) => m.y - n.y);
  it('closes the callee bar at the next message the caller sends', () => {
    const layout = sequenceLayout({ actors, messages: [
      { from: 'a', to: 'b', label: 'save' }, { from: 'a', to: 'c', label: 'notify' }, { from: 'c', to: 'a', label: 'done', kind: 'return' },
    ] }, theme);
    const [bar] = barsOf(layout, 'b');
    expect(barsOf(layout, 'b')).toHaveLength(1);
    expect(bar.y).toBeLessThan(rowOf(layout, 0));
    expect(bar.y + bar.height).toBeLessThan(rowOf(layout, 1));
    expect(bar.height).toBeGreaterThanOrEqual(24);
  });
  it('keeps the bar to the end when the call is the caller\'s last message', () => {
    const layout = sequenceLayout({ actors, messages: [
      { from: 'a', to: 'b', label: 'go' }, { from: 'b', to: 'c', label: 'ask' }, { from: 'c', to: 'b', label: 'answer', kind: 'return' },
    ] }, theme);
    const [bar] = barsOf(layout, 'b');
    expect(bar.y + bar.height).toBe(layout.height - 24);
  });
  it('ends an unanswered bar before a second call to the same callee opens a bar', () => {
    const layout = sequenceLayout({ actors, messages: [
      { from: 'a', to: 'b', label: 'save' }, { from: 'a', to: 'b', label: 'check' }, { from: 'b', to: 'a', label: 'ok', kind: 'return' },
    ] }, theme);
    const [first, second] = barsOf(layout, 'b');
    expect(first.y + first.height).toBeLessThanOrEqual(second.y);
    expect(second.y + second.height).toBe(rowOf(layout, 2) + 8);
  });
});

describe('sequenceLayout: second guard', () => {
  it('puts the second region guard below its divider, clear of the dashed line', () => {
    const f = sequenceLayout(spec, theme).frames.find(x => x.dividers.length);
    const guard = f.guards[1], d = f.dividers[0];
    const chipTop = guard.y - theme.typeScale.edgeLabel - 4;
    expect(chipTop).toBeGreaterThan(d + 2);
  });
});

describe('sequenceLayout: the style measures its own text', () => {
  it('spaces lifelines by the theme measure, not by Inter', () => {
    const wide = { ...theme, measure: (t, size, w) => 2 * theme.measure(t, size, w) };
    const gap = (l) => l.lifelines[1].x - l.lifelines[0].x;
    expect(gap(sequenceLayout(spec, wide))).toBeGreaterThan(gap(sequenceLayout(spec, theme)));
  });
});

