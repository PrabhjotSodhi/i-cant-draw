import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { validateSpec } from '../scripts/validate-spec.mjs';

const read = (path) => readFileSync(new URL(`../references/${path}`, import.meta.url), 'utf-8');
const prompt = read('planner-prompt.md');
const templateFiles = readdirSync(new URL('../references/templates/', import.meta.url)).filter(f => f.endsWith('.md'));
const templates = templateFiles.map(file => {
  const text = read(`templates/${file}`);
  return { name: file.replace(/\.md$/, ''), text, examples: [...text.matchAll(/```json\n([\s\S]*?)```/g)].map(m => JSON.parse(m[1])) };
});
const skill = readFileSync(new URL('../skills/draw/SKILL.md', import.meta.url), 'utf-8');

describe('planner prompt', () => {
  it('names every template and style', () => {
    for (const word of ['flow', 'hub', 'sequence', 'state', 'schema', 'table', 'class', 'quiet', 'crayon']) expect(prompt).toContain(`\`${word}\``);
  });
  it('keeps placement rules and examples out of the core prompt', () => {
    expect(prompt).not.toContain('```json');
    expect(prompt).toContain('templates/<template>.md');
  });
  it('fits in 80 lines', () => {
    expect(prompt.split('\n').length).toBeLessThanOrEqual(80);
  });
  it('uses no fields from other diagram formats', () => {
    for (const text of [prompt, ...templates.map(t => t.text)]) {
      for (const word of ['"direction"', '"category"', 'shape', 'pastel', 'corporate']) expect(text, word).not.toContain(word);
    }
  });
});

describe('template files', () => {
  it('has one file for each template', () => {
    expect(templates.map(t => t.name).sort()).toEqual(['class', 'flow', 'hub', 'schema', 'sequence', 'state']);
  });
  it('names database schemas in the skill trigger words', () => {
    const description = skill.match(/^description: (.*)$/m)[1];
    for (const words of ['database schema', 'ER diagram', 'tables']) expect(description, words).toContain(words);
  });
  it('names class diagrams in the skill trigger words', () => {
    const description = skill.match(/^description: (.*)$/m)[1];
    for (const words of ['class diagram', 'UML', 'classes', 'inheritance', 'subclass', '"is a kind of"', 'object model', 'domain model']) expect(description, words).toContain(words);
  });
  it('tells SKILL.md to read the core prompt, then one template file', () => {
    expect(skill).toContain('references/planner-prompt.md');
    expect(skill).toContain('references/templates/<template>.md');
  });
  it('carries one valid example of its own template in each file', () => {
    for (const t of templates) {
      expect(t.examples.length, t.name).toBe(1);
      expect(t.examples[0].template, t.name).toBe(t.name);
      expect(validateSpec(t.examples[0]), t.name).toEqual({ ok: true, errors: [] });
    }
  });
  it('renders every example with zero collisions and a clean lint', async () => {
    const { runPipeline } = await import('../scripts/pipeline.mjs');
    for (const t of templates) {
      const r = await runPipeline(t.examples[0], { outputDir: mkdtempSync(join(tmpdir(), 'plan-')), baseName: t.name });
      expect(r.collisions, t.name).toEqual([]);
      expect(r.lint, t.name).toEqual([]);
    }
  }, 30000);
});
