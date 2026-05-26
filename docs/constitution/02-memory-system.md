> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §2 Memory System
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 2. Memory System {#memory-system}

Every session that produces a meaningful change must be logged.

#### 2.1 Tracking Management Guidelines: CHANGELOG vs. Memory
To avoid noise and preserve agent context, maintain a strict separation of concerns:
- **Strictly English**: `CHANGELOG.md` and all `memory/` logs MUST be written in English. Do not write them in Korean even if the user converses in Korean.
- **`CHANGELOG.md` (Product-Facing)**: Document *what* changed for the end-user (e.g., new features, bug fixes). Use structured format (Added, Changed, Fixed). Every entry MUST include a PR reference: `- Description of change (#PR-number)`.
- **`memory/` (Developer/AI-Facing)**: Document *how* and *why* it changed. Record the development process, architectural decisions, failed experiments, and agent task states to maintain AI context across sessions.

**`memory/MEMORY.md`** - index file, updated by `dev-sync` scripts automatically:
```markdown
| Date | Summary |
|------|---------|
| [2026-05-21](2026-05-21.md) | feat: add pricing formula |
```

**`memory/YYYY-MM-DD.md`** - daily log, written by the developer (via `/memlog` in Claude Code · manually in Gemini CLI):

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

> **Tool consistency note**: All AI tools (Claude Code, Claude App, Antigravity, Antigravity CLI) MUST produce session logs with these exact four section headings. This ensures logs are machine-readable and consistent across tools.

#### 2.2 Rules
- Log files are written in **English**.
- Append to today's file - never overwrite.
- Run `/memlog` (Claude Code) or manually append to `memory/YYYY-MM-DD.md` (Gemini CLI) before running `sync` to ensure the log is recorded prior to commit.

#### 2.3 Archiving Policy
- When `memory/MEMORY.md` exceeds ~50 rows or `docs/context.md` becomes difficult to navigate, archive older content:
  - Move completed ADR summaries and resolved decisions to `docs/history.md`
  - Retain the last 30 days in `memory/MEMORY.md`; move older daily logs to `memory/archive/`
  - Never delete logs - archive them
