# Flow placement

Give every node a `row` and `col`.
- Put the main path on one row, left to right.
- Put branches on the rows above and below. A card that feeds another sits in the same column, directly above or below it, so the edge is straight.
- A feedback edge goes right to left and routes under the row. Put the corrective step under the step that fails.
- Three or more targets from one card, stacked in one column, share a trunk. So do three or more sources in one column feeding one card.
- A group is a rectangle of cells. No card outside the group may sit inside its rectangle, so give outsiders their own column.
- A secondary actor, such as a reviewer, may sit in the column to the right of the card it uses, on the same row.
- A long chain stays on one row, about seven cards at most. A wider page shrinks the text when it is scaled to fit, so merge steps the reader does not need apart, or split the diagram.

## Worked example

A question runs straight along the middle row to the prompt, then down to the model and back to the answer. Indexing, done ahead of time, sits on the row above, and the vector store feeds the search card directly below it.

```json
{
  "template": "flow", "title": "How a RAG chatbot answers a question",
  "nodes": [
    {"id": "docs", "label": "Your documents", "subtitle": "PDFs, wiki pages, tickets", "icon": "documents", "row": 0, "col": 0},
    {"id": "chunk", "label": "Split into chunks", "subtitle": "about 500 words each", "row": 0, "col": 1},
    {"id": "store", "label": "Vector store", "subtitle": "one vector per chunk", "icon": "database", "row": 0, "col": 2},
    {"id": "question", "label": "A question", "subtitle": "how do I reset my password?", "icon": "person", "row": 1, "col": 0},
    {"id": "embed", "label": "Turn it into a vector", "subtitle": "same model as the chunks", "row": 1, "col": 1},
    {"id": "search", "label": "Find similar chunks", "subtitle": "closest 5 by meaning", "row": 1, "col": 2},
    {"id": "prompt", "label": "Build the prompt", "subtitle": "question plus those chunks", "row": 1, "col": 3},
    {"id": "llm", "label": "Language model", "subtitle": "answers from the chunks", "icon": "cloud", "row": 2, "col": 3},
    {"id": "answer", "label": "Answer", "subtitle": "with links to sources", "row": 2, "col": 2}
  ],
  "edges": [
    {"from": "docs", "to": "chunk"},
    {"from": "chunk", "to": "store", "label": "embed and save"},
    {"from": "question", "to": "embed", "main": true},
    {"from": "embed", "to": "search", "main": true},
    {"from": "store", "to": "search", "label": "top 5 chunks"},
    {"from": "search", "to": "prompt", "main": true},
    {"from": "prompt", "to": "llm", "main": true},
    {"from": "llm", "to": "answer", "main": true}
  ],
  "groups": [
    {"id": "ahead", "label": "Done once, ahead of time", "contains": ["docs", "chunk", "store"], "tone": "green"},
    {"id": "live", "label": "Every time someone asks", "contains": ["question", "embed", "search", "prompt", "llm", "answer"], "tone": "blue"}
  ]
}
```
