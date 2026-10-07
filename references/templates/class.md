# Class placement

Use `template: "class"` for classes and how they relate.

## Classes

- Every node is `kind: "class"` with `label`, `attributes` and `methods`, 8 each at most.
- `stereotype` is optional, such as `abstract`.

## Relations

- `relation: "inherits"` points from the child to the parent.
- `relation: "uses"`, the default, draws an arrow.
- `multiplicity: ["1", "0..*"]` names the start end, then the end end.
- Label one inherits edge per parent.
- Do not draw both directions between two classes.

## Placement

Set `row` and `col` on every class.
- Put each parent in the row above its children, with all children in one row.
- When there are three children, put the parent in the middle child's column.
- Keep a parent and its children in one zone.
- A parent's bottom belongs to its children's line, so other lines enter its top or sides. A line from a class up and to its right turns once into its right side, so leave the cell beside the parent free.

## Worked example

A scheduler alerts through an abstract notifier. Its two kinds sit in the row below it, inside one zone with their parent.

```json
{
  "template": "class",
  "nodes": [
    {"id": "scheduler", "kind": "class", "label": "Scheduler", "attributes": ["interval: Duration"], "methods": ["tick()"], "row": 0, "col": 0},
    {"id": "notifier", "kind": "class", "label": "Notifier", "stereotype": "abstract", "attributes": ["retries: number"], "methods": ["send(alert)"], "row": 0, "col": 1},
    {"id": "email", "kind": "class", "label": "EmailNotifier", "attributes": ["smtpHost: string"], "methods": ["send(alert)"], "row": 1, "col": 1},
    {"id": "sms", "kind": "class", "label": "SmsNotifier", "attributes": ["sender: string"], "methods": ["send(alert)"], "row": 1, "col": 2}
  ],
  "edges": [
    {"from": "scheduler", "to": "notifier", "label": "alerts through", "multiplicity": ["1", "1..*"]},
    {"from": "email", "to": "notifier", "relation": "inherits", "label": "is a kind of"},
    {"from": "sms", "to": "notifier", "relation": "inherits"}
  ],
  "groups": [
    {"id": "senders", "label": "Senders", "contains": ["notifier", "email", "sms"], "tone": "green"}
  ]
}
```
