import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { sequenceLayout, sequenceRenderSpec } from './sequence-layout.mjs';
import { checkCollisions } from './collision-check.mjs';
import { convertToPng } from './convert-png.mjs';
import { validateSpec } from './validate-spec.mjs';
import { loadStyle } from './styles/index.mjs';
import { flowLayout } from './templates/flow.mjs';
import { hubLayout } from './templates/hub.mjs';
import { schemaLayout } from './templates/schema.mjs';
import { classLayout } from './templates/class.mjs';
import { draw, styleAsTheme } from './render/draw.mjs';
import { lintLayout } from './layout-lint.mjs';

const TEMPLATES = { flow: flowLayout, hub: hubLayout, state: flowLayout, schema: schemaLayout, class: classLayout };

function specError(message) {
  const error = new Error(message);
  error.name = 'SpecError';
  return error;
}

function writeOutputs(svg, png, collisions, outputDir, baseName) {
  mkdirSync(outputDir, { recursive: true });
  const svgPath = join(outputDir, `${baseName}.svg`);
  const pngPath = join(outputDir, `${baseName}.png`);
  writeFileSync(svgPath, svg);
  writeFileSync(pngPath, png);
  let collisionsPath = null;
  if (collisions.length > 0) {
    collisionsPath = join(outputDir, `${baseName}.collisions.json`);
    writeFileSync(collisionsPath, JSON.stringify(collisions, null, 2));
  }
  return { svgPath, pngPath, collisionsPath };
}

export async function runPipeline(spec, { outputDir = '.', baseName = 'diagram', scale = 2 } = {}) {
  const { ok, errors } = validateSpec(spec);
  if (!ok) throw specError(errors.join('\n'));
  const style = loadStyle(spec.style);
  const template = spec.template ?? 'flow';
  let layout;
  try {
    // sequence-layout.mjs draws the person glyph for actors in the human category.
    const sequenceSpec = template === 'sequence' ? { ...spec, actors: spec.actors.map(a => (a.kind === 'actor' ? { ...a, category: 'human' } : a)) } : null;
    layout = sequenceSpec ? sequenceLayout(sequenceSpec, styleAsTheme(style)) : TEMPLATES[template](spec, style);
  } catch (err) {
    if (err.name === 'SpecError') throw specError(err.message);
    throw err;
  }
  const { svg, geometry } = draw(layout, template === 'sequence' ? sequenceRenderSpec(spec) : spec, style);
  const collisions = checkCollisions(geometry);
  const lint = template === 'sequence' ? [] : lintLayout(layout, spec);
  const png = convertToPng(svg, { scale, fonts: style.fonts });
  const outputs = writeOutputs(svg, png, collisions, outputDir, baseName);
  let lintPath = null;
  if (lint.length) {
    lintPath = join(outputDir, `${baseName}.lint.json`);
    writeFileSync(lintPath, JSON.stringify(lint, null, 2));
  }
  return { svg, layout, collisions, lint, lintPath, ...outputs };
}
