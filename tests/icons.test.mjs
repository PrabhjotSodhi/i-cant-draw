import { describe, it, expect } from 'vitest';
import { ICONS, ICON_BOX } from '../scripts/render/icons.mjs';

describe('ICONS', () => {
  it('draws every glyph with currentColor in a 48-unit box', () => {
    expect(ICON_BOX).toBe(48);
    for (const [name, svg] of Object.entries(ICONS)) expect(svg, name).toContain('stroke="currentColor"');
  });
});
