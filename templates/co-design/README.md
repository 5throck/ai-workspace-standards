---
sync_version: 1
content_hash: TBD
---

# co-design variant

> **Status**: Stable — v1.0.0

AI-assisted design workspace template. Optimized for UI/UX design workflows, prototyping, and design system management with a structured multi-agent architecture.

## Overview

The co-design template provides a ready-to-use workspace for design projects that leverage AI assistants throughout the full design lifecycle. It pairs Claude Code (via `CLAUDE.md`) and Gemini (via `GEMINI.md`) with a structured multi-agent system covering research through delivery, giving every project consistent commands, agent roles, and quality gates from day one.

Key characteristics:

- **Design-focused agent team** — Specialized agents (PM, Design Lead, UX Researcher, Visual Designer, Prototype Engineer) handle distinct design phases, keeping each session focused.
- **Dual-AI support** — Claude and Gemini configurations ship together so you can use either assistant without extra setup.
- **Full design lifecycle coverage** — Six phases from Discovery through Handoff, with explicit review gates at each stage.
- **Slash-command driven** — Common operations are exposed as slash commands so daily design work stays fast and consistent.

## Quick Start

This project was scaffolded from the **co-design** template.

> To scaffold a new project from the workspace root, run:
> `scripts/new-project.sh "project-name" --variant co-design`

After scaffolding:

1. Open the new project directory in your editor.
2. Review and update `CLAUDE.md` / `GEMINI.md` with project-specific context.
3. Run `/sync "chore: initial scaffold"` to create the first commit and PR.

## Agents

The co-design template ships with specialized design agents. Each agent's role definition lives in `agents/<name>.md`.

| Agent | Responsibility |
|-------|---------------|
| **PM** | Orchestrates design phases, writes briefs, manages task sequencing |
| **Design Lead** | Creative direction, design system oversight, phase gate sign-off |
| **UX Researcher** | User research, usability testing, insight synthesis |
| **Visual Designer** | Visual design, component creation, accessibility review |
| **Prototype Engineer** | Interactive prototype development and handoff preparation |

## Available Commands

| Command | Description |
|---------|-------------|
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/changelog "..."` | Add an entry to `CHANGELOG.md` under `[Unreleased]` |
| `/memlog "summary"` | Append a session summary to today's memory log only |
| `/meeting` | Run a structured multi-agent design review (inline role-play) |
| `/new-task "name"` | Create a task tracking block in today's memory log |
