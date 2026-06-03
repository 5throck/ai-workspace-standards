---
sync_version: 1
content_hash: TBD
---

# co-consult

> **Status**: Stable — v1.0.0

AI-assisted knowledge work workspace template. Optimized for documentation-heavy projects, research, and cross-functional team coordination with a structured multi-agent architecture.

## Overview

The co-consult template provides a ready-to-use workspace for consulting engagements that leverage AI assistants for research, strategy development, and client deliverable creation. It pairs Claude Code (via `CLAUDE.md`) and Gemini (via `GEMINI.md`) with a structured multi-agent consulting team, giving every engagement consistent commands, agent roles, and quality gates from day one.

Key characteristics:

- **Consulting agent team** — Specialized agents (Engagement Leader, Strategy Analyst, Communications Lead, Solutions Architect, and more) handle distinct engagement phases, keeping context organized.
- **Dual-AI support** — Claude and Gemini configurations ship together so you can use either assistant without extra setup.
- **Delivery-first workflow** — Pre-commit hooks, an audit script, and a sync pipeline enforce quality standards on client deliverables automatically.
- **Slash-command driven** — Common operations are exposed as slash commands so daily work stays fast and consistent.

## Quick Start

This project was scaffolded from the **co-consult** template.

> To scaffold a new project from the workspace root, run:
> `scripts/new-project.sh "project-name" --variant co-consult`

After scaffolding:

1. Open the new project directory in your editor.
2. Review and update `CLAUDE.md` / `GEMINI.md` with project-specific context.
3. Run `/sync "chore: initial scaffold"` to create the first commit and PR.

## Agents

The co-consult template ships with specialized consulting agents. Each agent's role definition lives in `agents/<name>.md`.

| Agent | Responsibility |
|-------|---------------|
| **Engagement Leader** | Orchestrates engagement phases, manages client interface, enforces quality gates |
| **Change Management Partner** | Organizational transformation, culture strategy, stakeholder alignment |
| **Strategy Analyst** | Market analysis, competitive research, financial modeling |
| **Communications Lead** | Client-facing communications, presentations, strategic narratives |
| **Solutions Architect** | Technical solution design, system architecture, implementation roadmaps |
| **Delivery Manager** | Project delivery, operations coordination, stakeholder management |
| **Technology Specialist** | M365 platforms, workflow automation, digital transformation support |

## Available Commands

| Command | Description |
|---------|-------------|
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/changelog "..."` | Add an entry to `CHANGELOG.md` under `[Unreleased]` |
| `/memlog "summary"` | Append a session summary to today's memory log only |
| `/meeting` | Run a structured multi-agent meeting (inline role-play, no spawning) |
| `/new-task "name"` | Create a task tracking block in today's memory log |
