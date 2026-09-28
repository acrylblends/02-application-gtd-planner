# GTD Planner

Category **02 · Application** — Productivity · Personal information management · Communication · Collaboration.

An [ACRYL Blends](https://acrylblends.github.io) Blueprint: Getting Things Done (David Allen) grown from `acryl.blank`. A fresh, MIT-licensed
implementation - capture, triage (the one GTD decision), next actions, waiting for, someday/maybe, reference, and a calendar, with an interactive
board (list, kanban, calendar, project progress) served at `/gtd`.

## Start a project from this Blueprint

```bash
acryl new my-planner --from git@github.com:acrylblends/02-application-gtd-planner.git
cd my-planner
bin/acryl web
```

Open the printed URL, then `/gtd` for the board (no token needed - it is a loopback-gated page, not a chat session).

## What's here

- `blend.yaml` - the Blueprint manifest (`kind: Blueprint`, `extends: acryl.blank`)
- `extensions/acryl-gtd/` - the plugin: tools the builder agent calls (`gtd_capture`, `gtd_triage`, ...), and the standalone board page
  (`/gtd`, `lib/board-page.js`) with its own Host routes (`/api/acryl-gtd/state|capture|triage`)
- `bin/acryl`, `AGENTS.md` - the same scaffold every `acryl new` app gets

This is a **Blueprint**, not a Project: nothing here is a user's own data. A Project grown from it (`acryl new --from`) is private and
Proprietary from its first commit, with this Blueprint's license kept in its own `THIRD-PARTY.md`.
