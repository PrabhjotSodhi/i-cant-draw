import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const prompt = readFileSync(new URL('../references/judge-prompt.md', import.meta.url), 'utf-8');

describe('judge prompt', () => {
  it('names every critique type', () => {
    for (const type of ['missing_node', 'wrong_relationship', 'wrong_label', 'label_truncated', 'style_mismatch', 'layout_defect', 'wrong_template']) {
      expect(prompt, type).toContain(type);
    }
  });
  it('checks a schema: every foreign key has a relation and its ends are right', () => {
    expect(prompt).toMatch(/every FK column/);
    expect(prompt).toMatch(/ends/);
    expect(prompt).toMatch(/many-to-many/);
  });
  it('checks a class diagram: compartments, one triangle per parent, multiplicities below their line ends', () => {
    expect(prompt).toMatch(/name header, then attributes, then methods/);
    expect(prompt).toMatch(/exactly one hollow triangle/);
    expect(prompt).toMatch(/multiplicity sits beside its own line end/);
  });
  it('falls back to the style\'s hub golden when no golden matches the layout', () => {
    expect(prompt).toContain('references/goldens/<style>-<layout>.png');
    expect(prompt).toMatch(/does not exist, compare with the style's hub golden `references\/goldens\/<style>-hub\.png`/);
  });
});
