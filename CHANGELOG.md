# Changelog

All notable changes to this workspace configuration are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added — `templates/agents/designer.md` (new)
- UI/UX design agent for Phase 3 — Design group
- Produces wireframes (text-based), component specs, design tokens, and accessibility checklists
- Output format: Design Specification with Screen Overview, Component List, Interaction Spec, Design Tokens, Accessibility Notes
- Added to `templates/AGENTS.md` and `templates/docs/context.md` agent tables
- Added to CONSTITUTION.md §5 Role groups table

### Added — `templates/` folder (new)
- Created `templates/` directory mirroring the exact structure of a new project — the folder itself is the authoritative scaffold reference
- All project files: `docs/context.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CHANGELOG.md`, `.env.sample`, `.gitignore`
- Config files: `.claude/settings.json`, `.gemini/settings.json`, `.githooks/pre-commit`, `.githooks/pre-push`
- Agent definitions: `agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`
- Scripts (cross-platform): `scripts/audit.sh`, `audit.ps1`, `dev-sync.sh`, `dev-sync.ps1`, `sync-md.sh`, `sync-md.ps1`
- Structural stubs: `memory/MEMORY.md`, `docs/adr/.gitkeep`, `skills/.gitkeep`
- `_examples/` subfolder (reference-only, excluded from new projects):
  - `adr/0001-example-decision.md` — filled-in ADR example
  - `agents/analyst-example.md` — domain analyst agent template
  - `memory/2026-01-15-example.md` — daily session log example
  - `skills/example-skill/SKILL.md` — reusable skill template

### Changed — `scripts/new-project.sh` + `new-project.ps1` (rewrite)
- Replaced ~270-line heredoc approach with `cp -r templates/. <project>/` + `perl -pi` placeholder substitution
- Script now has 6 logical steps: copy → remove `_examples/` → remove `.gitkeep` → substitute `[Project Name]` → chmod → git init
- Emits `_examples/` path in output so users know where to find extension templates

### Changed — CONSTITUTION.md §7 (simplified)
- Reduced from ~1,000 lines to ~70 lines — all template content moved to `templates/`
- §7 now contains: scaffolding commands, generated-files table, and a concise post-scaffold checklist
- Post-scaffold checklist reduced to essential placeholder checks only

### Changed — `.gitignore` (workspace)
- Added `!templates/` negation so the new folder is tracked by git

### Added — CONSTITUTION.md §7 (scaffold template completeness review)
- `scripts/audit.sh` + `audit.ps1` scaffold templates added to §7 (previously only copied from workspace, never documented)
- `scripts/dev-sync.ps1` scaffold template added alongside existing `dev-sync.sh` template (Windows parity)
- `scripts/sync-md.ps1` scaffold template added alongside existing `sync-md.sh` template (Windows parity)
- `.gemini/settings.json` scaffold template added (`{}`) — referenced in checklist but never templated
- **Extension templates** subsection added (created on demand, not at project init):
  - `docs/adr/NNNN-slug.md` — Architecture Decision Record (3-section: Context → Decision → Consequences)
  - `agents/<name>-analyst.md` — Analysis agent (read-only investigator; dispatched by PM in Phase 1–2)
  - `memory/YYYY-MM-DD.md` — Daily session log format

### Fixed — CONSTITUTION.md §7 (path bugs)
- `CLAUDE.md` scaffold: `../../CLAUDE.md` → `../CLAUDE.md` (project-root file is one level above workspace, not two)
- `GEMINI.md` scaffold: `../../GEMINI.md` → `../GEMINI.md`; `@../../CONSTITUTION.md` → `@../CONSTITUTION.md`
- Path notes for both templates corrected; clarified that `../../` is correct only for files inside subdirectories (`docs/`, `agents/`, etc.)
- Post-scaffold checklist: path check items updated to show correct `../` expectation with anti-pattern warning

### Fixed — `scripts/audit.sh` + `audit.ps1`
- CONSTITUTION.md check: now looks at both `./CONSTITUTION.md` and `../CONSTITUTION.md` — previously always failed when run from a project directory (CONSTITUTION.md lives at workspace root, one level up)

### Fixed — `scripts/new-project.sh`
- `dev-sync.sh` stub: corrected git workflow order — `git checkout -b "$BRANCH"` now runs before `git add -A && git commit` (previously committed to main before creating the PR branch)
- Generated `CLAUDE.md` / `GEMINI.md`: fixed path references (`../../` → `../`)
- Added `README.md` generation (was missing — checklist required it but script never created it)
- Added `.gemini/settings.json` generation (`{}`)
- `dev-sync.sh` memlog line: changed `echo "Session synced: $MSG"` to `echo "## Session — $MSG"` (matches §7 template)

### Fixed/Added — `scripts/new-project.ps1`
- Full rewrite for feature parity with `new-project.sh`:
  - Now generates all files: `docs/context.md` (full 10-section template), `AGENTS.md`, agent stubs (all 4), `CHANGELOG.md`, `memory/MEMORY.md`, `.env.sample`, `.gitignore`, `CLAUDE.md`, `.claude/settings.json`, `GEMINI.md`, `.gemini/settings.json`, `README.md`, `scripts/dev-sync.ps1`, `scripts/dev-sync.sh`, `scripts/sync-md.ps1`, `scripts/sync-md.sh`, `.githooks/pre-commit`, `.githooks/pre-push`
  - Copies `audit.sh` + `audit.ps1` from workspace
  - Emits actionable "Next steps" instructions on completion

### Fixed — CONSTITUTION.md §7 (5-round iterative review)
- `README.md` scaffold template: changed outer fence from ` ```markdown ` to `~~~~markdown` to fix nested code block rendering (same fix applied earlier to `docs/context.md` and `GEMINI.md`)
- `scripts/dev-sync.sh` scaffold: fixed git workflow order — `git checkout -b "$BRANCH"` now runs **before** `git add -A && git commit` to prevent commits landing on `main` before the PR branch is created
- `agents/pm.md` scaffold header: added ⚠️ stub-replacement warning (consistent with architect, code-writer, test-runner)
- Post-scaffold checklist: added `agents/pm.md — full template used (not a stub)` check (script stubs all 4 agents, not 3)
- §7 intro: expanded generated-files list to include all 4 agent files (`agents/pm.md`, `agents/architect.md`, `agents/code-writer.md`, `agents/test-runner.md`)

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
