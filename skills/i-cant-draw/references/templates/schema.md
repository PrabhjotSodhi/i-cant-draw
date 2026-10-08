# Schema placement

Each table is a `table` node with `columns`. Each relation is an edge from the table that holds the foreign key to the table it points at.

## Tables

- `label` is the table name as the database spells it, such as `order_items`. The node `id` uses dashes, such as `order-items`.
- A column is `{"name": "user_id", "type": "bigint", "key": "FK"}`. `key` is `PK`, `FK` or left out. `type` is the SQL type, such as `bigint`, `text` or `timestamptz`.
- List the primary key first, then the foreign keys, then the columns the reader needs. Skip audit columns unless the request is about them.
- A table holds 12 columns at most. Past that, list the key columns and end with `{"name": "+ N more", "type": ""}`.

## Relations

- An edge is `{"from": "orders", "fromColumn": "user_id", "to": "users", "toColumn": "id", "ends": ["many", "one"], "label": "places"}`.
- `ends` gives the from end first. Use `["many", "one"]` for a plain foreign key, and `["one", "one"]` when the foreign key is also unique or is the primary key.
- Never use `["many", "many"]`. Add a junction table with a foreign key to each side, and draw two relations.
- Every FK column gets exactly one relation, drawn from its own row.
- `label` reads from the table pointed at to the table that points, such as "places" for users and orders. Keep it to one to three words.
- Two foreign keys from one table to the same table, such as `billing_address_id` and `shipping_address_id`, are two edges.
- A table that points at itself, such as `parent_id`, is an edge from the table to itself. It draws a small loop on the table's right side.

## Placement

Give every table a `row` and `col`. Each row lines up on its top edge.
- Put tables that relate in neighbouring columns, so each line crosses one gap. A line between columns further apart runs through the tables between them.
- Put the table that others point at to the left of them, or above them in the same column.
- Relations that end at the same column from one side merge into one line, so one table can take many.
- Zones mark areas of the data, such as customers, orders or the catalogue. Give each zone a `tone`.
- Aim for 4 to 10 tables. Split a bigger schema into two diagrams.

## Worked example

An online shop. Orders sit in the middle with their items and payments, users are on the left, and the catalogue is on the right. Each category can sit inside a parent category.

```json
{
  "template": "schema", "title": "Online shop, database",
  "nodes": [
    {"id": "users", "kind": "table", "label": "users", "row": 0, "col": 0, "columns": [{"name": "id", "type": "bigint", "key": "PK"},{"name": "email", "type": "text, unique"},{"name": "name", "type": "text"},{"name": "created_at", "type": "timestamptz"}]},
    {"id": "orders", "kind": "table", "label": "orders", "row": 0, "col": 1, "columns": [{"name": "id", "type": "bigint", "key": "PK"},{"name": "user_id", "type": "bigint", "key": "FK"},{"name": "status", "type": "text"},{"name": "placed_at", "type": "timestamptz"},{"name": "total", "type": "numeric"}]},
    {"id": "order-items", "kind": "table", "label": "order_items", "row": 0, "col": 2, "columns": [{"name": "id", "type": "bigint", "key": "PK"},{"name": "order_id", "type": "bigint", "key": "FK"},{"name": "product_id", "type": "bigint", "key": "FK"},{"name": "quantity", "type": "int"},{"name": "unit_price", "type": "numeric"}]},
    {"id": "products", "kind": "table", "label": "products", "row": 0, "col": 3, "columns": [{"name": "id", "type": "bigint", "key": "PK"},{"name": "category_id", "type": "bigint", "key": "FK"},{"name": "name", "type": "text"},{"name": "price", "type": "numeric"},{"name": "stock", "type": "int"}]},
    {"id": "payments", "kind": "table", "label": "payments", "row": 1, "col": 1, "columns": [{"name": "id", "type": "bigint", "key": "PK"},{"name": "order_id", "type": "bigint", "key": "FK"},{"name": "amount", "type": "numeric"},{"name": "provider", "type": "text"},{"name": "paid_at", "type": "timestamptz"}]},
    {"id": "categories", "kind": "table", "label": "categories", "row": 1, "col": 3, "columns": [{"name": "id", "type": "bigint", "key": "PK"},{"name": "parent_id", "type": "bigint", "key": "FK"},{"name": "name", "type": "text"}]}
  ],
  "edges": [
    {"from": "orders", "fromColumn": "user_id", "to": "users", "toColumn": "id", "ends": ["many", "one"], "label": "places"},
    {"from": "order-items", "fromColumn": "order_id", "to": "orders", "toColumn": "id", "ends": ["many", "one"], "label": "holds"},
    {"from": "order-items", "fromColumn": "product_id", "to": "products", "toColumn": "id", "ends": ["many", "one"], "label": "appears in"},
    {"from": "payments", "fromColumn": "order_id", "to": "orders", "toColumn": "id", "ends": ["many", "one"], "label": "paid by"},
    {"from": "products", "fromColumn": "category_id", "to": "categories", "toColumn": "id", "ends": ["many", "one"], "label": "groups"},
    {"from": "categories", "fromColumn": "parent_id", "to": "categories", "toColumn": "id", "ends": ["many", "one"], "label": "contains"}
  ],
  "groups": [
    {"id": "customers", "label": "Customers", "contains": ["users"], "tone": "purple"},
    {"id": "sales", "label": "Orders and payments", "contains": ["orders", "order-items", "payments"], "tone": "blue"},
    {"id": "catalogue", "label": "Catalogue", "contains": ["products", "categories"], "tone": "green"}
  ]
}
```
