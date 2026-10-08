# I Can't Draw

I Can't Draw is a Claude Code plugin. A user types one plain sentence, such as "how does a RAG chatbot answer a question?", and gets a clean, hand-drawn-looking diagram as a PNG and an SVG, plus the JSON spec that made it.

Claude plans and the engine draws. Claude writes a small JSON spec and places each box on a grid or in a hub slot. Templates line everything up and route the lines. Styles only draw. The engine is plain Node.js ES modules with no build step.

## Never compromise on

1. **Low reading effort.** A reader follows the main path without searching. Straight lines, aligned boxes, one card width per diagram and quiet colour beat clever automatic layout. Colour marks meaning only: a zone, the main path, or the centre card.
2. **Nothing overlaps.** A collision gate fails any render where text or boxes overlap.
3. **The same spec gives the same picture.** Every render is deterministic, down to the bytes. Hand-drawn wobble comes from a random generator seeded by the spec, never `Math.random()`. Users can edit a spec later without losing their layout.

## Glossary

- **spec**: the JSON a diagram is made from. `skills/i-cant-draw/references/spec-schema.json` is the authority.
- **template**: turns a spec into positions. Flow, hub, sequence, state, schema and class.
- **layout**: what a template returns: boxes, zones, line sections and label boxes, in drawing units.
- **style**: turns a layout into SVG. It draws and never moves anything.
- **zone**: a group of cards drawn as a tinted rectangle.
- **trunk**: one shared line that several lines join, so three arrows into one card read as one.
- **collision gate**: the check that fails a render when text or boxes overlap.
- **lint**: the checks that flag hard-to-read layouts, such as lines with many bends or labels far from their line.

## How it works

```
sentence -> Claude writes a spec -> validate -> template (positions) -> style (SVG)
         -> collision gate -> lint -> PNG at 2x -> Claude reviews the PNG -> fix once -> render again
```

- Text is measured in the font it is drawn in. Boxes, the collision gate and the PNG all use the same measured font files.
- The canvas is at least 1920 units wide with the drawing centred, so text stays one size wherever the image is scaled.

## Where code lives

`skills/i-cant-draw/` is the whole skill, and installers copy it as one folder. Everything it needs at run time lives inside it, and nothing inside it reaches outside.

- `SKILL.md` is what the agent loads. Its paths are relative to its own folder.
- `package.json` lists the engine's two packages.
- `scripts/render.mjs` is the command line. `scripts/pipeline.mjs` is the library behind it.
- `scripts/templates/` turns specs into layouts. `cards.mjs` sizes cards and `route.mjs` shapes lines.
- `scripts/styles/` holds one file per style, plus shared helpers and font loading.
- `scripts/render/` holds drawing shared by every style: the SVG assembly, icons, line-end markers, seeded randomness.
- `scripts/` top level holds the checks: spec validation, the layout contract, the collision gate and the lint.
- `references/` holds what the agent reads at run time: prompts, layout guides, the spec schema, the goldens and the bundled fonts.

Outside the skill folder:

- `scripts/` at the repo root holds the eval runners.
- `evals/` holds one folder per eval case: a request and the spec that answers it.
- `tests/` holds the vitest tests. `tests/fixtures/` holds specs only the tests use.

Put every file in the folder that matches its job.

## Writing code

- Use full, descriptive names. Abbreviate only when the meaning is obvious, like `x`, `y` or `svg`.
- Write the simplest code that works. No abstraction until there is a second use. No options nobody asked for.
- Code describes the current state only. History belongs in git.
- Comments are rare and one line. Use them for a constraint the code cannot show.
- Remove code your change made unused. Leave unrelated code alone.
- Ask before adding a dependency. The engine needs only `fontkit` and `@resvg/resvg-js`.

## Traps

- resvg crashes on a filter region larger than the canvas, and a filter on a zero-area line clips it.
- Halftones rotated at an angle and stacked turbulence filters blow PNGs past a few megabytes. Every PNG at 2x stays at or under 1.5 MB.
- In a `.ttc` font collection, pick faces by PostScript name. fontkit reports legacy family names, so semibold faces look missing.
- resvg must get exactly the measured font files, with system fonts off.

## Verifying

- `npm test` runs the unit tests. Every change ships with a focused test.
- `npm run eval` renders every eval case in every style. Each must contain its labels, have zero collisions and a clean lint.
- `npm run render -- <spec> -o <dir> -n <name>` renders one spec.
- Open every PNG your change affects and look at it. Passing tests say nothing about how a diagram looks.
- Examples, evals and fixtures describe generic or public subjects only.

## Tickets and pull requests

- Work comes from GitHub issues. Each issue has a goal, acceptance criteria and what is out of scope. Meet every criterion and build nothing out of scope.
- Branch name: `<issue number>-<short-name>`, for example `4-flow-layout`.
- One concern per PR.
- Title: a capitalised imperative of 50 characters or fewer, no trailing period. For example `Route lines on the flow grid`.
- Body: the problem in a sentence or two, how you solved it, how you verified it, then `Closes #<issue>`.
- A PR is squash merged once CI passes and every picture it changes has been looked at.

## Plans and notes

- Do not commit plans, research notes or scratch renders. Keep them outside the repo.
- The GitHub issue tracks the work. The merged PR is the record.
