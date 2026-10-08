import { sizeCards, titleBox } from './cards.mjs';
import { side, straight, zRoute, trunkRoute, labelFor } from './route.mjs';

const SIDES = ['left', 'right', 'top', 'bottom'];
const HUB_MIN_WIDTH = 260;
const NEIGHBOUR_LABEL_ROOM = 24;
const ROW_TRUNK_SHARE = 0.4;
const TITLE_STEM_GAP = 12;

const bounds = (boxes) => {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x, height: Math.max(...boxes.map(b => b.y + b.height)) - y };
};

const wrap = (box, pad, band) => ({ x: box.x - pad, y: box.y - pad - band, width: box.width + 2 * pad, height: box.height + 2 * pad + band });

// A centre group widens until its title ends short of the stem out of the hub's top.
function clearStem(box, label, style) {
  const title = titleBox(box, label, style);
  const extra = title.x + title.width + TITLE_STEM_GAP - (box.x + box.width / 2);
  return extra > 0 ? { ...box, x: box.x - extra, width: box.width + 2 * extra } : box;
}

function centreChain(spec) {
  const chain = [];
  let current = spec.slots.center;
  for (;;) {
    const group = (spec.groups || []).find(g => g.id === current);
    if (!group) return { hubId: current, chain };
    chain.push(group);
    current = group.contains[0];
  }
}

function groupDepths(spec) {
  const parent = new Map();
  for (const g of spec.groups || []) for (const member of g.contains) parent.set(member, g.id);
  const depth = (id) => (parent.has(id) ? 1 + depth(parent.get(id)) : 0);
  return new Map((spec.groups || []).map(g => [g.id, depth(g.id)]));
}

/** Places the hub card, its nested groups and four side stacks. Routes are added by routeHub. */
export function hubLayout(spec, style) {
  const { groupPad, groupLabelBand, sideGap, stackGap } = style.spacing;
  const slots = spec.slots;
  const slotOf = new Map(SIDES.flatMap(side => (slots[side] || []).map(id => [id, side])));
  const sizes = sizeCards(spec, style, n => (slotOf.has(n.id) ? 'cards' : 'hub'));
  const { hubId, chain } = centreChain(spec);

  const boxes = new Map();
  const hubSize = sizes.get(hubId);
  const hubWidth = Math.max(hubSize.width, HUB_MIN_WIDTH);
  boxes.set(hubId, { x: -hubWidth / 2, y: -hubSize.height / 2, width: hubWidth, height: hubSize.height });
  const stemUp = (spec.edges || []).some(e => (e.from === hubId && slotOf.get(e.to) === 'top') || (e.to === hubId && slotOf.get(e.from) === 'top'));
  let centre = boxes.get(hubId);
  for (const g of [...chain].reverse()) {
    centre = wrap(centre, groupPad, groupLabelBand);
    if (stemUp && g.label) centre = clearStem(centre, g.label, style);
    boxes.set(g.id, centre);
  }

  // A labelled edge between neighbours in a row needs the gap to hold its label.
  const gapAfter = (a, b, vertical) => {
    if (vertical) return stackGap;
    const e = (spec.edges || []).find(x => x.label && ((x.from === a && x.to === b) || (x.from === b && x.to === a)));
    return e ? Math.max(stackGap, style.measure(e.label, style.typeScale.edgeLabel) + NEIGHBOUR_LABEL_ROOM) : stackGap;
  };
  const stack = (ids, vertical) => {
    const list = ids.map(id => ({ id, ...sizes.get(id) }));
    const gaps = list.slice(1).map((n, i) => gapAfter(list[i].id, n.id, vertical));
    const total = list.reduce((sum, n) => sum + (vertical ? n.height : n.width), 0) + gaps.reduce((sum, g) => sum + g, 0);
    let cursor = -total / 2;
    return list.map((n, i) => {
      const at = cursor;
      cursor += (vertical ? n.height : n.width) + (gaps[i] ?? 0);
      return { ...n, at };
    });
  };
  for (const n of stack(slots.left || [], true)) boxes.set(n.id, { x: centre.x - sideGap - n.width, y: n.at, width: n.width, height: n.height });
  for (const n of stack(slots.right || [], true)) boxes.set(n.id, { x: centre.x + centre.width + sideGap, y: n.at, width: n.width, height: n.height });
  // Top and bottom rows clear any side stack they would overlap, so their trunks never cross a card.
  const { trunkInset } = style.spacing;
  const reach = (side, b) => (side === 'left'
    ? { x: b.x, y: b.y, width: centre.x - trunkInset - b.x, height: b.height }
    : { x: centre.x + centre.width + trunkInset, y: b.y, width: b.x + b.width - centre.x - centre.width - trunkInset, height: b.height });
  const sideBoxes = ['left', 'right'].flatMap(side => (slots[side] || []).map(id => reach(side, boxes.get(id))));
  const overlapping = (row) => {
    if (!row.length) return [];
    const x0 = row[0].at, x1 = row[row.length - 1].at + row[row.length - 1].width;
    return sideBoxes.filter(b => b.x < x1 && b.x + b.width > x0);
  };
  const top = stack(slots.top || [], false);
  const ceiling = Math.min(centre.y, ...overlapping(top).map(b => b.y));
  const topEdge = ceiling - 0.75 * sideGap;
  for (const n of top) boxes.set(n.id, { x: n.at, y: topEdge - Math.max(...top.map(t => t.height)), width: n.width, height: n.height });
  const bottom = stack(slots.bottom || [], false);
  const floor = Math.max(centre.y + centre.height, ...overlapping(bottom).map(b => b.y + b.height));
  const bottomEdge = floor + 0.75 * sideGap;
  for (const n of bottom) boxes.set(n.id, { x: n.at, y: bottomEdge, width: n.width, height: n.height });

  const chainIds = new Set(chain.map(g => g.id));
  let pending = (spec.groups || []).filter(g => !chainIds.has(g.id));
  while (pending.length) {
    const ready = pending.filter(g => g.contains.every(id => boxes.has(id)));
    if (!ready.length) throw new Error(`hub groups cannot be resolved: ${pending.map(g => g.id).join(', ')}`);
    for (const g of ready) boxes.set(g.id, wrap(bounds(g.contains.map(id => boxes.get(id))), groupPad, groupLabelBand));
    pending = pending.filter(g => !ready.includes(g));
  }

  const all = bounds([...boxes.values()]);
  const shift = (b) => ({ x: b.x - all.x, y: b.y - all.y, width: b.width, height: b.height });
  const depths = groupDepths(spec);
  const nodes = spec.nodes.map(n => ({ id: n.id, ...shift(boxes.get(n.id)), lines: sizes.get(n.id).lines }));
  const groups = (spec.groups || []).map(g => {
    const box = shift(boxes.get(g.id));
    return { id: g.id, ...box, depth: depths.get(g.id), spec: g, ...(g.label ? { titleBox: titleBox(box, g.label, style) } : {}) };
  });
  const layout = { width: all.width, height: all.height, nodes, groups, edges: [], trunks: [], hubId };
  const outer = chain.length ? groups.find(g => g.id === chain[0].id) : nodes.find(n => n.id === hubId);
  routeHub(layout, spec, style, slotOf, outer);
  return layout;
}

const FACING = { left: ['left', 'right'], right: ['right', 'left'], top: ['top', 'bottom'], bottom: ['bottom', 'top'] };

function rowTrunkY(where, list, box, outer, style) {
  const cards = list.map(({ other }) => box.get(other));
  const room = 0.75 * style.spacing.sideGap * ROW_TRUNK_SHARE;
  return where === 'top'
    ? Math.max(...cards.map(c => c.y + c.height)) + room
    : Math.min(...cards.map(c => c.y)) - room;
}

function routeHub(layout, spec, style, slotOf, outer) {
  const { trunkInset } = style.spacing;
  const box = new Map(layout.nodes.map(n => [n.id, n]));
  const hub = box.get(layout.hubId);
  const bySide = new Map();
  (spec.edges || []).forEach((e, index) => {
    const other = e.from === layout.hubId ? e.to : e.to === layout.hubId ? e.from : null;
    if (other === null) {
      const [a, b] = [box.get(e.from), box.get(e.to)];
      const vertical = slotOf.get(e.from) === 'left' || slotOf.get(e.from) === 'right';
      const down = vertical ? a.y < b.y : a.x < b.x;
      const [fromSide, toSide] = vertical ? (down ? ['bottom', 'top'] : ['top', 'bottom']) : (down ? ['right', 'left'] : ['left', 'right']);
      const section = straight(side(a, fromSide), side(b, toSide));
      layout.edges.push({ index, sections: [section], labels: e.label ? [labelFor(section, e.label, style, layout.groups)] : [] });
      return;
    }
    const where = slotOf.get(other);
    if (!bySide.has(where)) bySide.set(where, []);
    bySide.get(where).push({ e, index, other });
  });

  for (const [where, list] of bySide) {
    const [hubSide, cardSide] = FACING[where];
    const horizontal = where === 'left' || where === 'right';
    const stemFrom = side(hub, hubSide);
    const aligned = list.length === 1 && (horizontal
      ? Math.abs(side(box.get(list[0].other), cardSide).y - stemFrom.y) < 0.5
      : Math.abs(side(box.get(list[0].other), cardSide).x - stemFrom.x) < 0.5);
    const lone = list.length === 1 && !aligned;
    for (const { e, index, other } of list) {
      const target = side(box.get(other), cardSide);
      let section;
      if (aligned) {
        section = e.from === layout.hubId ? straight(stemFrom, target) : straight(target, stemFrom);
      } else if (lone) {
        // One edge on a side needs no trunk, so it runs as one path and its arrow reaches the card it points at.
        const out = e.from === layout.hubId;
        if (horizontal) {
          const turnX = where === 'left' ? outer.x - trunkInset : outer.x + outer.width + trunkInset;
          section = out ? zRoute(stemFrom, target, turnX) : zRoute(target, stemFrom, turnX);
        } else {
          const turnY = rowTrunkY(where, list, box, outer, style);
          const [a, b] = out ? [stemFrom, target] : [target, stemFrom];
          section = { startPoint: a, endPoint: b, bendPoints: [{ x: a.x, y: turnY }, { x: b.x, y: turnY }] };
        }
      } else if (horizontal) {
        const trunkX = where === 'left' ? outer.x - trunkInset : outer.x + outer.width + trunkInset;
        const branch = straight({ x: trunkX, y: target.y }, target);
        section = e.from === layout.hubId ? branch : straight(branch.endPoint, branch.startPoint);
      } else {
        const trunkY = rowTrunkY(where, list, box, outer, style);
        const branch = straight({ x: target.x, y: trunkY }, target);
        section = e.from === layout.hubId ? branch : straight(branch.endPoint, branch.startPoint);
      }
      const trunked = !aligned && !lone, intoHubByTrunk = trunked && e.to === layout.hubId;
      if (trunked && e.both && !intoHubByTrunk) section.startMarker = 'none';
      layout.edges.push({ index, sections: [section], labels: e.label ? [labelFor(section, e.label, style, layout.groups)] : [], ...(intoHubByTrunk ? { arrow: false } : {}) });
    }
    if (aligned || lone) continue;
    const main = list.some(({ e }) => e.main), dashed = list.every(({ e }) => e.style === 'dashed');
    const styled = (section) => ({ ...section, main, dashed });
    const targets = list.map(({ other }) => side(box.get(other), cardSide));
    // Edges into the hub drop their arrows at the trunk, so the stem carries one arrow in.
    const inward = list.some(({ e }) => e.to === layout.hubId || e.both);
    const stemOf = (joint) => (inward ? { ...styled(straight(joint, stemFrom)), endMarker: 'arrow' } : styled(straight(stemFrom, joint)));
    if (horizontal) {
      const trunkX = where === 'left' ? outer.x - trunkInset : outer.x + outer.width + trunkInset;
      const { stem, trunk } = trunkRoute(stemFrom, trunkX, targets);
      layout.trunks.push(stemOf(stem.endPoint), styled(trunk));
    } else {
      const trunkY = rowTrunkY(where, list, box, outer, style);
      const xs = [stemFrom.x, ...targets.map(t => t.x)];
      layout.trunks.push(stemOf({ x: stemFrom.x, y: trunkY }), styled(straight({ x: Math.min(...xs), y: trunkY }, { x: Math.max(...xs), y: trunkY })));
    }
  }
  layout.edges.sort((a, b) => a.index - b.index);
}
