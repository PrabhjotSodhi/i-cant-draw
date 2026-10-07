# Hub placement

- `slots.center` names the core system. When it is nested, such as EC2 instance, then Sandbox, then the agent, name the outermost group. Each group in that chain holds exactly one member.
- Put inputs and callers on the left or bottom, and outputs and dependencies on the right or top. People go at the bottom.
- Every edge touches the centre card, or joins two neighbours in one slot list.
- A group holds a whole slot list or none of it.

## Worked example

The checkout service sits in the middle. Customers call it from the left, the services it calls sit on top, storage is on the right, and what happens after the order is below.

```json
{
  "template": "hub", "title": "Checkout, high-level design",
  "slots": {"center": "checkout", "left": ["web", "mobile"], "right": ["orders"], "top": ["inventory", "fraud", "payments"], "bottom": ["events", "email"]},
  "nodes": [
    {"id": "checkout", "label": "Checkout service", "subtitle": "turns a cart into an order"},
    {"id": "web", "label": "Web shop", "subtitle": "most orders", "icon": "monitor"},
    {"id": "mobile", "label": "Mobile app", "subtitle": "iOS and Android", "icon": "monitor"},
    {"id": "orders", "label": "Orders database", "subtitle": "one row per order", "icon": "database"},
    {"id": "inventory", "label": "Inventory", "subtitle": "holds stock for 10 minutes"},
    {"id": "fraud", "label": "Fraud check", "subtitle": "scores every order"},
    {"id": "payments", "label": "Payment provider", "subtitle": "charges the card", "icon": "cloud"},
    {"id": "events", "label": "Order events", "subtitle": "a queue other teams read", "icon": "documents"},
    {"id": "email", "label": "Email service", "subtitle": "sends the receipt"}
  ],
  "edges": [
    {"from": "web", "to": "checkout", "label": "place order", "main": true},
    {"from": "mobile", "to": "checkout", "label": "place order"},
    {"from": "checkout", "to": "inventory", "label": "reserve stock"},
    {"from": "checkout", "to": "fraud", "label": "check it"},
    {"from": "checkout", "to": "payments", "label": "charge", "main": true},
    {"from": "checkout", "to": "orders", "label": "save the order", "main": true},
    {"from": "checkout", "to": "events", "label": "order placed", "style": "dashed"},
    {"from": "events", "to": "email", "label": "send receipt"}
  ],
  "groups": [
    {"id": "customers", "label": "Customers", "contains": ["web", "mobile"], "tone": "purple"},
    {"id": "services", "label": "Services it calls", "contains": ["inventory", "fraud", "payments"], "tone": "orange"},
    {"id": "storage", "label": "Storage", "contains": ["orders"], "tone": "green"},
    {"id": "after", "label": "After the order", "contains": ["events", "email"], "tone": "blue"}
  ]
}
```
