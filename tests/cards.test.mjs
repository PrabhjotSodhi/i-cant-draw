import { describe, it, expect } from 'vitest';
import { sizeCards, SpecError } from '../scripts/templates/cards.mjs';
import { loadStyle } from '../scripts/styles/index.mjs';

const quiet = loadStyle('quiet');
const byCol = n => n.col;

describe('sizeCards', () => {
  it('gives cards with one key one width, sized to the widest', () => {
    const spec = { nodes: [
      { id: 'a', label: 'Short', col: 0 },
      { id: 'b', label: 'A much longer title here', col: 0 },
      { id: 'c', label: 'Elsewhere', col: 1 },
    ] };
    const sizes = sizeCards(spec, quiet, byCol);
    expect(sizes.get('a').width).toBe(sizes.get('b').width);
    const need = quiet.measure('A much longer title here', 15, 600) + 2 * quiet.cardSize.padX;
    expect(sizes.get('b').width).toBeGreaterThanOrEqual(Math.max(need, quiet.cardSize.minWidth));
  });
  it('wraps a 60-character subtitle to two lines', () => {
    const subtitle = 'one read statement at a time with query and time caps set';
    expect(subtitle.length).toBeGreaterThanOrEqual(55);
    const sizes = sizeCards({ nodes: [{ id: 'a', label: 'Tools', subtitle, col: 0 }] }, quiet, byCol);
    expect(sizes.get('a').lines).toHaveLength(2);
  });
  it('balances a two-line subtitle so the second line is not one short word', () => {
    const sizes = sizeCards({ nodes: [
      { id: 'm', label: 'Redirect cache', subtitle: 'hot links kept in memory', icon: 'cloud', col: 0 },
      { id: 'n', label: 'Rate limiter', subtitle: 'checks each caption call against the daily quota', col: 0 },
    ] }, quiet, () => 'all');
    for (const id of ['m', 'n']) {
      const lines = sizes.get(id).lines;
      if (lines.length === 2) expect(lines[1].split(' ').length, lines.join(' | ')).toBeGreaterThan(1);
    }
    expect(sizes.get('m').width).toBe(sizes.get('n').width);
  });
  it('sizes the shared width to fit subtitles in two lines, not one', () => {
    const sizes = sizeCards({ nodes: [{ id: 'n', label: 'Rate limiter', subtitle: 'checks each caption call against the daily quota', col: 0 }] }, quiet, () => 'all');
    expect(sizes.get('n').lines).toHaveLength(2);
    expect(sizes.get('n').width).toBeLessThan(quiet.measure('checks each caption call against the daily quota', 13) + 2 * quiet.cardSize.padX);
  });
  it('widens an actor to keep its subtitle on one line', () => {
    const p = sizeCards({ nodes: [{ id: 'p', label: 'On-call engineer', subtitle: 'bastion login, no open port', kind: 'actor', col: 0 }] }, quiet, byCol).get('p');
    expect(p.lines).toHaveLength(1);
  });
  it('rejects a subtitle that needs more than two lines', () => {
    const subtitle = 'word '.repeat(40).trim();
    expect(() => sizeCards({ nodes: [{ id: 'wordy', label: 'X', subtitle, col: 0 }] }, quiet, byCol))
      .toThrow(SpecError);
    expect(() => sizeCards({ nodes: [{ id: 'wordy', label: 'X', subtitle, col: 0 }] }, quiet, byCol))
      .toThrow(/wordy.*Shorten it/);
  });
  it('gives every card one height', () => {
    const sizes = sizeCards({ nodes: [
      { id: 'a', label: 'A', subtitle: 'one read statement at a time with query and time caps set', col: 0 },
      { id: 'b', label: 'B', col: 1 },
    ] }, quiet, byCol);
    expect(sizes.get('a').height).toBe(sizes.get('b').height);
  });
  it('sizes actors to their text', () => {
    const none = sizeCards({ nodes: [{ id: 'p', label: 'Operator', kind: 'actor', col: 0 }] }, quiet, byCol).get('p');
    const long = 'reviews every release bundle before it leaves the account boundary';
    const two = sizeCards({ nodes: [{ id: 'p', label: 'Operator', subtitle: long, kind: 'actor', col: 0 }] }, quiet, byCol).get('p');
    expect(none.width).toBe(140);
    expect(two.lines.length).toBe(2);
    expect(two.height).toBeGreaterThan(none.height);
  });
  it('makes decisions 1.4 times the card height', () => {
    const sizes = sizeCards({ nodes: [
      { id: 'a', label: 'Card', subtitle: 'a subtitle', col: 0 },
      { id: 'd', label: 'Valid?', kind: 'decision', col: 1 },
    ] }, quiet, byCol);
    expect(sizes.get('d').height).toBe(Math.round(1.4 * sizes.get('a').height));
  });
});

describe('sizeCards decisions', () => {
  const crayon = loadStyle('crayon');
  // The title box's corner must sit inside the diamond: half-width over half the diamond width plus half-height over half its height.
  const fits = (style, label, size) => {
    const width = style.measure(label, style.typeScale.title, style.typeScale.titleWeight) + 2 * style.cardSize.padX;
    const height = style.typeScale.title * style.typeScale.lineHeight;
    return width / size.width + height / size.height <= 1;
  };
  it('makes a decision 1.5 times as wide as it is tall, narrower than the cards beside it', () => {
    const sizes = sizeCards({ nodes: [
      { id: 'a', label: 'Card', subtitle: 'a subtitle that wraps onto a second line here', col: 0 },
      { id: 'd', label: 'Valid?', kind: 'decision', col: 1 },
    ] }, quiet, () => 'cards');
    const d = sizes.get('d');
    expect(Math.abs(d.width - 1.5 * d.height)).toBeLessThanOrEqual(1);
    expect(d.width).toBeLessThan(sizes.get('a').width);
  });
  it('fits the title inside the diamond in quiet and crayon', () => {
    for (const style of [quiet, crayon]) {
      for (const label of ['Valid?', 'Quality gate', 'Good enough?', 'Is the customer eligible?']) {
        const d = sizeCards({ nodes: [{ id: 'd', label, kind: 'decision', col: 0 }] }, style, () => 'cards').get('d');
        expect(fits(style, label, d), `${label} in ${style.name}`).toBe(true);
        expect(Math.abs(d.width - 1.5 * d.height)).toBeLessThanOrEqual(1);
      }
    }
  });
  it('grows a decision taller than 1.4 cards only when its title needs it', () => {
    const nodes = (label) => [{ id: 'a', label: 'Card', col: 0 }, { id: 'd', label, kind: 'decision', col: 1 }];
    const short = sizeCards({ nodes: nodes('Ok?') }, quiet, () => 'cards');
    const long = sizeCards({ nodes: nodes('Is the customer eligible?') }, quiet, () => 'cards');
    expect(short.get('d').height).toBe(Math.round(1.4 * short.get('a').height));
    expect(long.get('d').height).toBeGreaterThan(Math.round(1.4 * long.get('a').height));
  });
  it('leaves the card width to the cards', () => {
    const sizes = sizeCards({ nodes: [
      { id: 'a', label: 'Card', col: 0 },
      { id: 'd', label: 'Is the customer eligible for a refund?', kind: 'decision', col: 1 },
    ] }, quiet, () => 'cards');
    expect(sizes.get('a').width).toBe(quiet.cardSize.minWidth);
  });
  it('throws a SpecError naming the node when the title cannot fit in the widest diamond', () => {
    const label = 'Has the customer been eligible for a refund?';
    expect(() => sizeCards({ nodes: [{ id: 'refund', label, kind: 'decision', col: 0 }] }, quiet, () => 'cards')).toThrow(SpecError);
    expect(() => sizeCards({ nodes: [{ id: 'refund', label, kind: 'decision', col: 0 }] }, quiet, () => 'cards')).toThrow(/node "refund"/);
  });
});

describe('sizeCards edge cases', () => {
  it('gives decisions a height when no card sets one', () => {
    const sizes = sizeCards({ nodes: [{ id: 'd', label: 'Valid?', kind: 'decision', col: 0 }] }, quiet, () => 'cards');
    expect(sizes.get('d').height).toBeGreaterThan(0);
  });
});
