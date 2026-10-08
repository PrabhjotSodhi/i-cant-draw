import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { ICONS, ICON_BOX } from '../skills/i-cant-draw/scripts/render/icons.mjs';

const schema = JSON.parse(readFileSync(new URL('../skills/i-cant-draw/references/spec-schema.json', import.meta.url)));

describe('ICONS', () => {
  it('covers every icon the schema allows', () => {
    for (const name of schema.properties.nodes.items.properties.icon.enum) expect(ICONS[name], name).toBeTruthy();
  });
  it('draws every glyph with currentColor in a 48-unit box', () => {
    expect(ICON_BOX).toBe(48);
    for (const [name, svg] of Object.entries(ICONS)) expect(svg, name).toContain('stroke="currentColor"');
  });
});
