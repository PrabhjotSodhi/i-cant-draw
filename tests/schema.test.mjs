import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { ICONS } from '../skills/i-cant-draw/scripts/render/icons.mjs';

const schema = JSON.parse(readFileSync(new URL('../skills/i-cant-draw/references/spec-schema.json', import.meta.url)));
const evalDirs = readdirSync(new URL('../evals/', import.meta.url), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
const specs = [
  ...evalDirs.map(d => new URL(`../evals/${d}/spec.json`, import.meta.url)).filter(u => existsSync(u)),
  ...readdirSync(new URL('./fixtures/', import.meta.url)).map(f => new URL(`./fixtures/${f}`, import.meta.url)),
].map(u => ({ name: u.pathname.split('/').slice(-2).join('/'), spec: JSON.parse(readFileSync(u)) })).filter(x => x.spec.template);

const levels = {
  top: schema.properties,
  node: schema.properties.nodes.items.properties,
  edge: schema.properties.edges.items.properties,
  group: schema.properties.groups.items.properties,
  actor: schema.properties.actors.items.properties,
  message: schema.properties.messages.items.properties,
  column: schema.properties.nodes.items.properties.columns.items.properties,
};
const itemsOf = (spec) => ({ top: [spec], node: spec.nodes || [], edge: spec.edges || [], group: spec.groups || [], actor: spec.actors || [], message: spec.messages || [], column: (spec.nodes || []).flatMap(n => n.columns || []) });

describe('spec schema', () => {
  it('covers every spec in the repo', () => {
    expect(specs.length).toBeGreaterThanOrEqual(10);
  });
  it('declares every key the specs use', () => {
    for (const { name, spec } of specs) {
      for (const [level, items] of Object.entries(itemsOf(spec))) {
        for (const item of items) for (const key of Object.keys(item)) expect(levels[level][key], `${name} ${level}.${key}`).toBeDefined();
      }
    }
  });
  it('allows every enum value the specs use', () => {
    for (const { name, spec } of specs) {
      for (const [level, items] of Object.entries(itemsOf(spec))) {
        for (const item of items) for (const [key, value] of Object.entries(item)) {
          const allowed = levels[level][key]?.enum;
          if (allowed) expect(allowed, `${name} ${level}.${key}=${value}`).toContain(value);
        }
      }
    }
  });
  it('lists exactly the icons the renderer draws', () => {
    expect([...schema.properties.nodes.items.properties.icon.enum].sort()).toEqual(Object.keys(ICONS).sort());
  });
  it('leaves out the fields the validator rejects', () => {
    expect(schema.properties.theme).toBeUndefined();
    expect(schema.properties.direction).toBeUndefined();
    expect(levels.node.shape).toBeUndefined();
    expect(levels.node.category).toBeUndefined();
  });
});
