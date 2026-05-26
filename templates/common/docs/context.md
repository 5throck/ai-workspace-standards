# [Project Name] — Project Context

> Shared reference for all AI tools (Claude Code, Gemini CLI, Antigravity).
> Tool-specific behaviors: CLAUDE.md (Claude Code), GEMINI.md (Gemini/Antigravity).
> Variant-specific configuration (tech stack, agents, skills, scripts, workflow):
>   → docs/<variant-name>.context.md
>
> ⚠️ This file is IMMUTABLE after project creation.
>    All project-specific changes belong in docs/<variant-name>.context.md

---

## Project Overview

[One-sentence description of what this project does and who it's for.]

**Type**: web | cli | api | mcp
**Status**: Active development

---

## Architecture

Standard directory layout for all projects in this workspace:

```
<project-root>/
├── src/          # Source code
├── docs/         # context.md (this file) + <variant>.context.md + ADRs
├── scripts/      # Automation scripts (.sh + .ps1 pairs)
├── memory/       # Session logs (MEMORY.md index + daily logs)
├── agents/       # Role-based agent definitions
├── skills/       # Reusable workflow skills
└── .claude/      # Claude Code settings and slash commands
```

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/context.md` | This file — immutable project identity |
| `docs/<variant>.context.md` | Variant config — tech stack, agents, skills, scripts, workflow |
| `CLAUDE.md` | Claude Code session behavior and slash commands |
| `GEMINI.md` | Gemini CLI / Antigravity session behavior |
| `AGENTS.md` | Canonical agent index (auto-loaded by Claude Code) |
| `scripts/audit.sh` / `.ps1` | Documentation audit (enforced on pre-commit) |
| `scripts/dev-sync.sh` / `.ps1` | Full sync pipeline (memlog → audit → commit → PR) |
| `memory/MEMORY.md` | Development log index |
| `CHANGELOG.md` | User-visible change history |

---

## Documentation Standards

### Session Log Format (`memory/YYYY-MM-DD.md`)

Every session log entry MUST include the following four sections:

```markdown
## Session Summary
<!-- One paragraph: what was accomplished this session -->

## Changes
<!-- File-level list of what was created, modified, or deleted -->
- `path/to/file` — created: reason
- `path/to/file` — modified: what changed and why
- `path/to/file` — deleted: reason

## Decisions
<!-- Architectural or design choices made, with rationale -->
- Decision: why this approach was chosen over alternatives

## Open Issues
<!-- Unresolved problems, blockers, or follow-up items -->
- Issue: symptom → root cause → resolution (or "pending")
```

> All AI tools (Claude Code, Gemini CLI, Antigravity) MUST produce session logs
> with these exact four section headings for cross-tool consistency.

### CHANGELOG Entry Format (`CHANGELOG.md`)

Every entry under `[Unreleased]` MUST include a PR reference:

```markdown
## [Unreleased]
### Added
- Short description of change (#PR-number)
```

### Language Policy

| Content | Language |
|---------|----------|
| Conversational replies to user | Korean (default) |
| Code, config, commit messages | English only |
| PR titles, bodies, branch names | English only |
| CHANGELOG.md entries | English only |
| memory/ session logs | English only |

### File Encoding

All text files (Markdown, scripts) must be saved as **UTF-8 (without BOM)**.

---

*context.md version: 2.0 — created by /new-project*
