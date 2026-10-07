# Diagram planner

Turn requirements into one JSON spec that matches `spec-schema.json`. Return only the JSON.

## 1. Choose a template

- `flow`: a process with an order, such as a pipeline, a request path or a chain of components. It reads left to right on a grid.
- `hub`: one system in the middle and what it talks to, such as a deployment, context or integration view.
- `sequence`: messages over time between up to six actors.
- `state`: the statuses one thing moves through, such as an order, a job or a ticket.
- `schema`: database tables, their columns and the keys that join them.
- `class`: classes, what they hold and how they relate, such as which class is a kind of another.

Pick the template where position answers the reader's first question: "what happens next" is flow, "what does it connect to" is hub, "who calls whom, in what order" is sequence, "what status comes next" is state, "which table points at which" is schema, "what is a kind of what" is class.

## 2. Choose a style

Leave `style` out to use the user's default. Set it only when the user names a look: `crayon` (coloured pencil, hatched zones), `riso` (two-ink print), `whiteboard` (marker), `notebook` (ink on dot-grid paper), `watercolour` (paint and pencil) or `quiet` (plain, for formal documents).

## 3. Nodes

- `label` is 30 characters or fewer. `subtitle` wraps to two lines at most, about 40 characters.
- `kind` is `card` (default), `decision` (a yes or no question, with no subtitle), `note`, or `actor` (a person). A state machine uses `state`, plus `start` and `end` dots, which take no label. A database schema uses `table`, with `columns`. A class diagram uses `class`.
- `icon` marks infrastructure: `database`, `cloud`, `documents`, `file`, `monitor`, `person`, `table`.
- One node per real thing. Merge trivia. Aim for 8 to 15 nodes. Split a bigger system into two diagrams.

## 4. Edges

- `label` names what arrives at the target, such as "jobs" or "read-only queries". Leave obvious edges unlabelled.
- `main: true` marks the path the reader should follow first. It draws heavier.
- `style: "dashed"` is for async, optional or occasional traffic. `both: true` is for a genuinely two-way link.
- `annotation: true` is commentary, such as "not linked", between two neighbouring cells.

## 5. Groups

- A group is a real boundary: an account, a network, a machine or a phase. Two levels of nesting at most.
- `tone` marks a zone: `blue`, `green`, `orange`, `red`, `purple` or `grey`. Leave the outermost boundary untoned.
- `boundary: "dashed"` is for a soft boundary, such as a sandbox or a private network.

## 6. Place the nodes

Read `templates/<template>.md` for the template you chose, such as `templates/flow.md`. It holds that template's placement rules and a worked example.
