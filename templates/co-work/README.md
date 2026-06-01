---
sync_version: 1
---

# {{PROJECT_NAME}}

> **Status**: Stable — v1.0.0

AI-assisted knowledge work workspace template. Optimized for documentation-heavy projects, research, and cross-functional team coordination with a structured multi-agent architecture.

## Overview

The co-work template provides a ready-to-use workspace for knowledge work projects that leverage AI assistants for writing, research, and collaboration. It pairs Claude Code (via `CLAUDE.md`) and Gemini (via `GEMINI.md`) with a structured multi-agent system, giving every project consistent commands, agent roles, and quality gates from day one.

Key characteristics:

- **Knowledge-work agent team** — Specialized agents (PM, Analyst, Content Writer, Technical Writer, Project Coordinator) handle distinct work phases, keeping context organized.
- **Dual-AI support** — Claude and Gemini configurations ship together so you can use either assistant without extra setup.
- **Documentation-first workflow** — Pre-commit hooks, an audit script, and a sync pipeline enforce quality standards on written deliverables automatically.
- **Slash-command driven** — Common operations are exposed as slash commands so daily work stays fast and consistent.

## Quick Start

This project was scaffolded from the **co-work** template.

> To scaffold a new project from the workspace root, run:
> `scripts/new-project.sh "project-name" --variant co-work`

After scaffolding:

1. Open the new project directory in your editor.
2. Review and update `CLAUDE.md` / `GEMINI.md` with project-specific context.
3. Run `/sync "chore: initial scaffold"` to create the first commit and PR.

## Agents

The co-work template ships with specialized knowledge-work agents. Each agent's role definition lives in `agents/<name>.md`.

| Agent | Responsibility |
|-------|---------------|
| **PM** | Orchestrates work phases, writes briefs, manages task sequencing and stakeholder coordination |
| **Analyst** | Research synthesis, data analysis, insight documentation |
| **Content Writer** | Long-form writing, report drafting, editorial review |
| **Technical Writer** | Process documentation, reference guides, structured knowledge base articles |
| **Project Coordinator** | Cross-functional task tracking, meeting facilitation, status reporting |

## Available Commands

| Command | Description |
|---------|-------------|
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/changelog "..."` | Add an entry to `CHANGELOG.md` under `[Unreleased]` |
| `/memlog "summary"` | Append a session summary to today's memory log only |
| `/meeting` | Run a structured multi-agent meeting (inline role-play, no spawning) |
| `/new-task "name"` | Create a task tracking block in today's memory log |
