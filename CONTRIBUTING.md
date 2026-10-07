# Contributing

I Can't Draw is built by AI agents working from tickets, with a human maintainer who sets the direction. The rules for writing code are in [AGENTS.md](AGENTS.md). They apply to people and agents alike.

## Setup

1. Install Node 24 or newer.
2. Run `npm install`.
3. Run `npm test`.

## How work flows

1. Every piece of work starts as a GitHub issue using the ticket form.
2. Work happens on a branch named `<issue number>-<short-name>`.
3. A pull request closes the issue. CI must pass.
4. The pull request is squash merged.

Keep pull requests small and focused on one ticket. Explain what changed and why. Include a picture for any change to how diagrams look.
