---
sync_version: 1
content_hash: TBD
---

# {{PROJECT_NAME}}

AI-assisted software development workspace template. Optimized for collaborative coding with Claude and Gemini AI assistants using a multi-agent architecture.

## Overview

The co-develop template provides a ready-to-use workspace for software projects that leverage multiple AI assistants in parallel. It pairs Claude Code (via `CLAUDE.md`) and Gemini (via `GEMINI.md`) with a structured multi-agent system, giving every project consistent commands, agent roles, and quality gates from day one.

Key characteristics:

- **Dual-AI support** — Claude and Gemini configurations ship together, so you can use either assistant (or both) without extra setup.
- **Multi-agent architecture** — Specialized agents (PM, Architect, Auditor, etc.) handle distinct phases of work, reducing context overload in any single session.
- **Opinionated workflow** — Pre-commit hooks, an audit script, and a sync pipeline enforce quality standards automatically.
- **Slash-command driven** — Common operations are exposed as slash commands so daily work stays fast and consistent.

## Quick Start

This project was scaffolded from the **co-develop** template.

> To scaffold a new project from the workspace root, run:
> `scripts/new-project.sh "project-name" --variant co-develop`

This copies all co-develop template files and performs initial variable substitution (project name, dates).

After scaffolding:

1. Open the new project directory in your editor.
2. Review and update `CLAUDE.md` / `GEMINI.md` with project-specific context.
3. Run `/sync "chore: initial scaffold"` to create the first commit and PR.

## Project Structure

```
<project-name>/
├── CLAUDE.md               # Claude Code behavioral config
├── GEMINI.md               # Gemini behavioral config
├── CONSTITUTION.md         # Shared workspace standards (symlinked from root)
├── AGENTS.md               # Agent roster and dispatch rules
├── CHANGELOG.md            # Unreleased + versioned history
├── agents/                 # Per-agent role definition files
│   ├── pm.md
│   ├── architect.md
│   ├── automation-engineer.md
│   ├── security-expert.md
│   ├── docs-writer.md
│   └── auditor.md
├── docs/                   # Project documentation
├── memory/                 # Daily session logs (YYYY-MM-DD.md)
└── scripts/                # Utility scripts (audit.sh, dev-sync.sh, …)
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/sync "feat: ..."` | Full pipeline — memlog → sync-md → changelog → audit → commit → PR |
| `/changelog "..."` | Add an entry to `CHANGELOG.md` under `[Unreleased]` |
| `/memlog "summary"` | Append a session summary to today's memory log only |
| `/meeting` | Run a structured multi-agent meeting (inline role-play, no spawning) |
| `/new-task "name"` | Create a task tracking block in today's memory log |

All commands are defined in `.claude/commands/` and are auto-registered as Skills by Claude Code.

## Agents

The co-develop template ships with six specialized agents. Each agent's role definition lives in `agents/<name>.md`.

| Agent | Responsibility |
|-------|---------------|
| **PM** | Orchestrates planning, writes specs, manages task sequencing |
| **Architect** | System design, ADRs, dependency decisions |
| **Automation-Engineer** | Script authoring, CI/CD, infrastructure automation |
| **Security-Expert** | Threat modeling, dependency audits, secure-by-default review |
| **Docs-Writer** | Technical writing, README maintenance, changelog authorship |
| **Auditor** | Post-implementation verification against acceptance criteria |

Dispatch agents via the native `Agent` tool. Embed the relevant `agents/<name>.md` content in the prompt rather than referencing the file path — sub-agents do not share filesystem context with the parent session.

## Configuration

### CLAUDE.md

Controls Claude Code behavior: automated hooks, slash command definitions, plan-mode rules, task tracking conventions, and Git/PR standards. Edit this file to adjust Claude-specific behaviors without affecting Gemini workflows.

### GEMINI.md

Mirrors the behavioral configuration for the Gemini CLI. Keeps phrasing consistent with `CLAUDE.md` while adapting to Gemini-specific conventions (e.g., `/google-search` integration, Gemini model tiers).

Both files inherit shared standards from `CONSTITUTION.md`. When updating policies that apply to all AI assistants, edit `CONSTITUTION.md` first, then propagate the changes to `CLAUDE.md` and `GEMINI.md`.
