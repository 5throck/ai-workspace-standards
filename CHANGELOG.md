# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

## [2026-05-22]

### Added — CONSTITUTION.md

#### §1 Standard Folder Structure
- Added `.env.sample` and `.gitignore` to the standard folder structure tree
- Added rule: `AGENTS.md` is always created at project root as the canonical agent roster
- Added rule: `.env.sample` always committed; `.env` always in `.gitignore`

#### §5 Multi-Agent Architecture
- Split "Execution" group into distinct **Design** and **Execution** groups
  - **Design**: `architect.md` — architecture decisions, implementation planning, technical spec
  - **Execution**: `code-writer.md`, `test-runner.md` — code implementation and test verification

#### §6 Reusable Skills
- Updated Session skill load timing to reference `docs/context.md ## Session Start Skills`

#### §7 New Project Initialization — scaffold templates
- `docs/context.md` full scaffold template
  - Cross-platform Python venv activation (macOS/Linux + Windows)
  - `## Session Start Skills` section
  - `## Agents` table with all 4 core agents and Group column
  - `## Key Files` expanded with AGENTS.md, CHANGELOG.md, and all agent files
  - Path assumption note added to `## Coding Guidelines` link
  - Outer fence changed to `~~~~markdown` to fix nested code block rendering
- `AGENTS.md` scaffold template (new) — canonical agent index with Group column, dispatch guidance, maintenance rule
- `agents/pm.md` scaffold template (new) — YAML frontmatter + markdown body, 6-phase workflow, Agent Roster with Group column
- `agents/architect.md` scaffold template (new) — design-only agent; produces plans/ADRs; structured Implementation Plan output format
- `agents/code-writer.md` scaffold template (new) — implements approved plans only; per-file change report format
- `agents/test-runner.md` scaffold template (new) — QA agent; verification sequence; structured QA Report with READY/BLOCKED verdict
- `CLAUDE.md` project-level scaffold template (new) — Session Start, MCP Servers, Hooks Override, Model Selection Override
- `.claude/settings.json` scaffold template (new) — PostToolUse hook wiring for `scripts/audit.sh`
- `GEMINI.md` project-level scaffold template (new) — `@`-syntax context loading, model selection override
- `CHANGELOG.md` initial scaffold (new)
- `.env.sample` initial scaffold (new)
- `memory/MEMORY.md` initial scaffold (new)
- `.gitignore` initial scaffold covering Python, Node.js, OS artifacts (new)
- Post-scaffold checklist (new) — 10-item verification with cross-platform commands

#### §7 Design principle
- `docs/context.md` = single source of truth for ALL AI tools; project-level `CLAUDE.md`/`GEMINI.md` = platform-specific overrides only

---

*Last Updated: 2026-05-22*
