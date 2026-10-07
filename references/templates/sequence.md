# Sequence

`actors` appear left to right, caller first, with `kind: "actor"` for people. `messages` run top to bottom. A message `kind` is omitted for a call, `return` for a reply or `async` for fire and forget. A self-message draws a small loop. `fragments` draw `alt`, `opt` or `loop` frames over a contiguous run of messages, with at most 2 regions and 1 level of nesting. A fragment takes a `tone` like a group; it defaults to purple.

## Worked example

You ask the agent for a fix. The agent and the model go back and forth inside a loop frame until the model stops asking for tools, then the agent replies.

```json
{
  "template": "sequence", "title": "How a coding agent fixes a failing test",
  "actors": [
    {"id": "you", "label": "You", "kind": "actor"},
    {"id": "agent", "label": "Coding agent"},
    {"id": "model", "label": "Language model"},
    {"id": "tools", "label": "Tools", "subtitle": "read, edit, run"}
  ],
  "messages": [
    {"from": "you", "to": "agent", "label": "fix the failing test"},
    {"from": "agent", "to": "model", "label": "the task, and the tools it may use"},
    {"from": "model", "to": "agent", "label": "call: read the test file", "kind": "return"},
    {"from": "agent", "to": "tools", "label": "read login.test.js"},
    {"from": "tools", "to": "agent", "label": "file contents", "kind": "return"},
    {"from": "agent", "to": "model", "label": "here is the file"},
    {"from": "model", "to": "agent", "label": "call: edit login.js", "kind": "return"},
    {"from": "agent", "to": "tools", "label": "apply the edit, run the tests"},
    {"from": "tools", "to": "agent", "label": "all tests pass", "kind": "return"},
    {"from": "agent", "to": "model", "label": "tests pass"},
    {"from": "model", "to": "agent", "label": "done, with a summary", "kind": "return"},
    {"from": "agent", "to": "you", "label": "fixed: a missing await", "kind": "return"}
  ],
  "fragments": [
    {"kind": "loop", "tone": "orange", "regions": [{"guard": "until the model stops asking for tools", "messages": [2,3,4,5,6,7,8,9]}]}
  ]
}
```
