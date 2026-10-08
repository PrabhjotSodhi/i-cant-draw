# State placement

Place nodes on rows and columns, as in a flow.
- The usual path runs left to right on one row, from the `start` dot to the `end` dot. Side states, such as paused or failed, go on the row below the state they leave.
- An edge label is the event that causes the move, such as "card declined".
- A state that repeats takes an edge to itself. Two states may link both ways, with one edge each way.
- Zones mark phases: `blue` for working, `orange` for paused or stopped, `green` for done, `red` for failed.

## Worked example

An order moves left to right. Problems sit on the row below the states they leave, and a declined card can be retried with a new one.

```json
{
  "template": "state", "title": "Checkout, order statuses",
  "nodes": [
    {"id": "start", "kind": "start", "row": 0, "col": 0},
    {"id": "placed", "kind": "state", "label": "Placed", "row": 0, "col": 1},
    {"id": "paid", "kind": "state", "label": "Paid", "row": 0, "col": 2},
    {"id": "shipped", "kind": "state", "label": "Shipped", "row": 0, "col": 3},
    {"id": "delivered", "kind": "state", "label": "Delivered", "row": 0, "col": 4},
    {"id": "end", "kind": "end", "row": 0, "col": 5},
    {"id": "failed", "kind": "state", "label": "Payment failed", "row": 1, "col": 1},
    {"id": "cancelled", "kind": "state", "label": "Cancelled", "row": 1, "col": 2},
    {"id": "returned", "kind": "state", "label": "Returned", "row": 1, "col": 4}
  ],
  "edges": [
    {"from": "start", "to": "placed", "label": "cart submitted"},
    {"from": "placed", "to": "paid", "label": "card approved", "main": true},
    {"from": "paid", "to": "shipped", "label": "label printed", "main": true},
    {"from": "shipped", "to": "delivered", "label": "signed for", "main": true},
    {"from": "delivered", "to": "end"},
    {"from": "placed", "to": "failed", "label": "card declined"},
    {"from": "failed", "to": "placed", "label": "new card"},
    {"from": "paid", "to": "cancelled", "label": "cancel, refund"},
    {"from": "delivered", "to": "returned", "label": "within 30 days"}
  ],
  "groups": [
    {"id": "progress", "label": "In progress", "contains": ["placed", "paid", "shipped"], "tone": "blue"},
    {"id": "done", "label": "Done", "contains": ["delivered"], "tone": "green"},
    {"id": "stopped", "label": "Stopped", "contains": ["failed", "cancelled", "returned"], "tone": "red"}
  ]
}
```
