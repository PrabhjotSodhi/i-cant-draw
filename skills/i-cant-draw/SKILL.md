---
name: i-cant-draw
description: Draw architecture, deployment, pipeline, sequence, state machine, database schema and class diagrams from a plain description, as a hand-drawn PNG and SVG. Use this whenever the user asks for a diagram, a flowchart, an architecture or deployment view, a system overview, a state machine, a status lifecycle, a database schema, an ER diagram, tables and their keys, a class diagram, UML, classes, inheritance, a subclass, "is a kind of", an object model or a domain model, or wants to draw, sketch or illustrate how something works, even if they do not say "diagram".
---

# Draw

Turn a description into a diagram a reader understands in five seconds.

Every path below is relative to this skill's folder, the one that holds this `SKILL.md`. Call it `<skill>`. The default style is crayon.

## Pipeline

```
Request -> [Plan] -> spec -> [Validate] -> [Template: flow | hub | sequence | state | schema | class] -> [Style] -> [Collision gate] -> PNG -> [Judge]
                                                                                                                                          ^        |
                                                                                                                                          +-[Fix]--+
```

## Phase 1: Plan

1. Read `<skill>/references/planner-prompt.md` and `<skill>/references/spec-schema.json`.
2. Pick the template. Then read only that template's file, `<skill>/references/templates/<template>.md`.
3. Turn the request into one spec. Place every node and mark the main path.
4. Save the spec as `diagrams/<name>.json` in the user's project. The spec is the source of the diagram, so it stays next to the PNG.

## Phase 2: Render

```bash
node "<skill>/scripts/render.mjs" diagrams/<name>.json -o diagrams -n <name> --style crayon
```

If node fails with "maximum nested function level reached", run `sh "<skill>/scripts/render.sh"` with the same arguments.

Use another style only when the user asks for it. This writes `<name>.png` and `<name>.svg` next to the spec.

Exit codes:

- **0:** success.
- **2:** invalid spec. The message names the field to fix.
- **3:** pipeline error.
- **4:** collision. `<name>.collisions.json` names both elements.

Fix the spec and render again. Never bypass the gate.

Layout warnings print after a successful render and land in `<name>.lint.json`. Treat each one as a `layout_defect` in Phase 4.

## Phase 3: Judge

1. Read `<skill>/references/judge-prompt.md`.
2. Read the rendered PNG.
3. Return the JSON critique the judge prompt describes.

If you cannot view images, skip Phases 3 and 4. Deliver the render and tell the user nobody reviewed the picture.

## Phase 4: Fix

If the judge returns `"pass": false`, fix the spec for each critique:

- `missing_node`, `wrong_relationship`, `wrong_label`: add or correct the node, edge or label.
- `label_truncated`: shorten the label or subtitle.
- `layout_defect`: move nodes. Put the main path on one row, and put a card that feeds another directly above or below it.
- `wrong_template`: switch to the template the judge names: flow, hub, sequence, state, schema or class.
- `style_mismatch`: check the style choice.

Run two rounds at most: one fix and one confirm. Then deliver the best result and name what is left.

## Phase 5: Deliver

Show the PNG, and give the paths of the PNG, the SVG and the spec. To change the diagram later, edit the spec and render again. The same spec always gives the same picture.

## Troubleshooting

- **"Cannot find module":** the engine's packages are not installed yet. Run `npm ci --omit=dev` in `<skill>`, then render again.
- **"render.sh: no node found":** install Node 18 or later, or set `DIAGRAM_NODE` to a node binary.
