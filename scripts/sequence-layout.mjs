import { estimateNodeSize, measureText as measureInter, LINE_HEIGHT } from './text-metrics.mjs';

// Sequence layout producer. No graph solver is necessary: lifelines are
// columns in declaration order, and messages are rows in time order. The
// output extends the Layout contract with lifelines, activations, and frames.
// The renderer draws messages through its normal edge path.

const MIN_GAP = 160;        // minimum distance between adjacent lifelines
const ROW = 44;             // base height of one message row
const SELF_EXTRA = 24;      // extra height for a self-message loop
const HEAD_GAP = 48;        // space between actor headers and the first row
const FRAME_HEAD = 34;      // frame label band (ALT / OPT / LOOP + first guard)
const FRAME_DIVIDER = 60;   // dashed divider band; the next guard sits below the line
const FRAME_PAD_BOTTOM = 16;
const ACT_W = 12;           // activation bar width

export function sequenceLayout(spec, theme) {
  const ts = theme.typeScale;
  const measureText = theme.measure ?? measureInter;
  const actors = spec.actors;
  const messages = spec.messages;
  const fragments = spec.fragments || [];

  // ---- columns ----
  const headers = actors.map(a => ({ actor: a, size: estimateNodeSize(a, theme) }));
  const headerH = Math.max(...headers.map(h => h.size.height));
  const col = new Map();
  const centers = [];
  let cursorX = 0;
  headers.forEach((h, i) => {
    const half = h.size.width / 2;
    let cx = cursorX + half;
    if (i > 0) {
      // widen the gap when a message label between this pair needs room
      const prev = headers[i - 1];
      let need = MIN_GAP;
      for (const m of messages) {
        const a = actors.findIndex(x => x.id === m.from);
        const b = actors.findIndex(x => x.id === m.to);
        if (Math.min(a, b) === i - 1 && Math.max(a, b) === i && m.from !== m.to) {
          need = Math.max(need, measureText(m.label || '', ts.edgeLabel) + 60);
        }
      }
      cx = Math.max(cx, centers[i - 1] + prev.size.width / 2 + need - half + half);
      cx = Math.max(cx, centers[i - 1] + need);
    }
    centers.push(cx);
    col.set(h.actor.id, i);
    cursorX = cx + half;
  });
  // room for self-message loops on the right of their column
  messages.forEach(m => {
    if (m.from !== m.to) return;
    const i = col.get(m.from);
    const need = 90 + measureText(m.label || '', ts.edgeLabel);
    const rightEdge = i + 1 < centers.length ? centers[i + 1] : Infinity;
    if (rightEdge - centers[i] < need && i + 1 < centers.length) {
      const shift = need - (rightEdge - centers[i]);
      for (let j = i + 1; j < centers.length; j++) centers[j] += shift;
    }
  });

  // ---- rows ----
  // fragment boundaries by message index
  const frameStart = new Map(); // msgIndex -> [fragment]
  const regionStart = new Map(); // msgIndex -> [{fragment, region}]
  const frameEnd = new Map();   // msgIndex -> [fragment]
  fragments.forEach((f) => {
    const all = f.regions.flatMap(r => r.messages);
    const first = Math.min(...all);
    const last = Math.max(...all);
    frameStart.set(first, [...(frameStart.get(first) || []), f]);
    frameEnd.set(last, [...(frameEnd.get(last) || []), f]);
    f.regions.forEach((r, ri) => {
      if (ri === 0) return;
      const rFirst = Math.min(...r.messages);
      regionStart.set(rFirst, [...(regionStart.get(rFirst) || []), { fragment: f, region: r }]);
    });
  });

  let y = headerH + HEAD_GAP;
  const rowY = [];
  const frameGeom = new Map();
  messages.forEach((m, i) => {
    for (const f of frameStart.get(i) || []) {
      y += FRAME_HEAD;
      frameGeom.set(f, { top: y - FRAME_HEAD, dividers: [] });
    }
    for (const { fragment } of regionStart.get(i) || []) {
      y += FRAME_DIVIDER;
      frameGeom.get(fragment).dividers.push(y - FRAME_DIVIDER / 2);
    }
    y += ROW;
    rowY.push(y - ROW / 2 + ts.edgeLabel * LINE_HEIGHT / 2);
    if (m.from === m.to) y += SELF_EXTRA;
    for (const f of frameEnd.get(i) || []) {
      y += FRAME_PAD_BOTTOM;
      frameGeom.get(f).bottom = y;
    }
  });
  const bottomY = y + 32;

  // ---- activations ----
  const stacks = new Map(actors.map(a => [a.id, []]));
  const activations = [];
  const asyncOpens = new Set();
  const callers = new Map();
  messages.forEach((m, i) => {
    if (m.from === m.to) return;
    if (m.kind === 'return') {
      const stack = stacks.get(m.from);
      const open = stack.pop();
      if (open) activations.push({ owner: m.from, x: centers[col.get(m.from)] - ACT_W / 2,
        y: open, width: ACT_W, height: rowY[i] + 8 - open });
    } else {
      stacks.get(m.to).push(rowY[i] - 8);
      if (m.kind === 'async') asyncOpens.add(rowY[i] - 8);
      callers.set(rowY[i] - 8, { from: m.from, index: i });
    }
  });
  for (const [id, stack] of stacks) {
    for (const open of stack) {
      // An async message nobody answers gets a short bar; an unanswered call ends when its caller sends again, else at the end.
      const call = callers.get(open);
      const next = messages.findIndex((m, j) => j > call.index && m.from === call.from);
      const end = asyncOpens.has(open) ? open + 24 : next === -1 ? bottomY - 24 : Math.max(open + 24, rowY[next] - 8);
      activations.push({ owner: id, x: centers[col.get(id)] - ACT_W / 2, y: open, width: ACT_W, height: end - open });
    }
  }
  const active = (id, my) => activations.some(a => a.owner === id && my >= a.y && my <= a.y + a.height);

  // ---- element arrays for the renderer ----
  const nodes = headers.map((h, i) => ({
    id: h.actor.id,
    x: centers[i] - h.size.width / 2, y: 0,
    width: h.size.width, height: h.size.height,
  }));
  const lifelines = actors.map((a, i) => ({
    owner: a.id, x: centers[i], y1: headers[i].size.height, y2: bottomY,
  }));

  const edges = messages.map((m, i) => {
    const my = rowY[i];
    if (m.from === m.to) {
      const cx = centers[col.get(m.from)];
      const x0 = cx + (active(m.from, my) ? ACT_W / 2 : 0);
      const loop = { startPoint: { x: x0, y: my },
        bendPoints: [{ x: cx + 64, y: my }, { x: cx + 64, y: my + SELF_EXTRA }],
        endPoint: { x: x0, y: my + SELF_EXTRA } };
      const w = Math.ceil(measureText(m.label || '', ts.edgeLabel));
      return { index: i, sections: [loop], labels: m.label ? [{
        text: m.label, width: w, height: Math.ceil(ts.edgeLabel * LINE_HEIGHT),
        x: cx + 76, y: my + SELF_EXTRA / 2 - ts.edgeLabel * LINE_HEIGHT / 2 }] : [] };
    }
    const fi = col.get(m.from), ti = col.get(m.to);
    const dir = ti > fi ? 1 : -1;
    const x1 = centers[fi] + dir * (active(m.from, my) ? ACT_W / 2 : 0);
    const x2 = centers[ti] - dir * (active(m.to, my) ? ACT_W / 2 : 0);
    const w = Math.ceil(measureText(m.label || '', ts.edgeLabel));
    return { index: i,
      sections: [{ startPoint: { x: x1, y: my }, endPoint: { x: x2, y: my }, bendPoints: [] }],
      labels: m.label ? [{ text: m.label, width: w, height: Math.ceil(ts.edgeLabel * LINE_HEIGHT),
        x: (x1 + x2) / 2 - w / 2, y: my - ts.edgeLabel * LINE_HEIGHT - 8 }] : [] };
  });

  const frames = fragments.map((f) => {
    const geom = frameGeom.get(f);
    const covered = f.regions.flatMap(r => r.messages);
    const cols = covered.flatMap(i => [col.get(messages[i].from), col.get(messages[i].to)]);
    const minX = Math.min(...cols.map(c => centers[c])) - 88;
    const maxX = Math.max(...cols.map(c => centers[c])) + 88;
    const tagWidth = Math.ceil(measureText(f.kind.toUpperCase(), ts.groupLabel, 600)) + 22;
    return {
      kind: f.kind, tone: f.tone || 'purple', x: minX, y: geom.top, width: maxX - minX, height: geom.bottom - geom.top,
      guards: f.regions.map((r, ri) => {
        const guardY = ri === 0 ? geom.top + FRAME_HEAD - 10 : geom.dividers[ri - 1] + 21;
        const width = measureText(`[${r.guard || ''}]`, ts.edgeLabel, 600);
        // start after the tag, then step right past any activation bar in the way
        let guardX = minX + tagWidth + 14;
        for (const bar of activations) {
          const inBand = guardY >= bar.y - 4 && guardY - ts.edgeLabel <= bar.y + bar.height + 4;
          const overlaps = guardX < bar.x + bar.width + 8 && guardX + width > bar.x - 8;
          if (inBand && overlaps) guardX = bar.x + bar.width + 10;
        }
        return { text: r.guard || '', y: guardY, x: guardX };
      }),
      dividers: geom.dividers,
    };
  });

  // ---- normalize: true extents, so page padding stays even on every side ----
  let minX = 0;
  let maxX = cursorX;
  const scanX = (x0, x1) => { minX = Math.min(minX, x0); maxX = Math.max(maxX, x1); };
  for (const n of nodes) scanX(n.x, n.x + n.width);
  for (const f of frames) scanX(f.x, f.x + f.width);
  for (const b of activations) scanX(b.x, b.x + b.width);
  for (const e of edges) {
    for (const s of e.sections) for (const p of [s.startPoint, s.endPoint, ...s.bendPoints]) scanX(p.x, p.x);
    for (const l of e.labels) scanX(l.x, l.x + l.width);
    for (const g of frames) for (const guard of g.guards) scanX(guard.x, guard.x);
  }
  const shift = minX < 0 ? -minX : 0;
  if (shift > 0) {
    for (const n of nodes) n.x += shift;
    for (const l of lifelines) l.x += shift;
    for (const b of activations) b.x += shift;
    for (const f of frames) { f.x += shift; for (const g of f.guards) g.x += shift; }
    for (const e of edges) {
      for (const s of e.sections) for (const p of [s.startPoint, s.endPoint, ...s.bendPoints]) p.x += shift;
      for (const l of e.labels) l.x += shift;
    }
  }

  return {
    width: maxX + shift,
    height: bottomY,
    nodes, groups: [], edges, lifelines, activations, frames,
  };
}

// The renderer reads node categories and edge styles from a spec. This facade
// presents a sequence spec in that shape: actors become nodes, and messages
// become edges with mapped styles.
export function sequenceRenderSpec(spec) {
  return {
    ...spec,
    nodes: spec.actors,
    edges: spec.messages.map(m => ({
      from: m.from, to: m.to, label: m.label,
      style: m.kind === 'return' ? 'dashed' : 'solid',
      async: m.kind === 'async',
    })),
    groups: [],
  };
}
