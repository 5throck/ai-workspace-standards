---
status: Accepted
date: 2026-06-02
author: PM + Architect + Auditor
---

# ADR 0023: Claude Code Agent Teams Experimental Feature Adoption

## Context

Claude Code v2.1.32 introduced an experimental multi-agent coordination feature called Agent Teams, activated via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. It allows multiple Claude Code instances to work in parallel with a shared task list, direct inter-agent messaging, and lifecycle hooks (`TeammateIdle`, `TaskCreated`, `TaskCompleted`).

The workspace PM Gateway workflow already uses the `Agent` tool for specialist dispatch (subagents). Agent Teams extends this with true peer-to-peer coordination: teammates can communicate directly without routing through the PM, and the shared task list enables autonomous work distribution.

Key constraints were identified before adoption:
- **Desktop App**: `TeammateIdle`/`TaskCompleted` hooks do not fire (same limitation as `PostToolUse`)
- **tmux split-pane mode**: Not supported in VS Code integrated terminal, Windows Terminal, or Ghostty
- **Antigravity CLI**: No equivalent feature — Antigravity 2.0 uses an Agent Manager (UI-based, separate workspaces) with fundamentally different architecture; no `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` equivalent exists
- **Experimental status**: Feature may change; requires v2.1.32+

## Decision

Adopt `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` as a workspace standard, enabled in:
- `C:\git\.claude\settings.json` (workspace root)
- `templates/common/.claude/settings.json` (inherited by all new projects)
- All 4 variant `.claude/settings.json` files

Configuration:
```json
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "teammateMode": "auto"
}
```

`teammateMode: "auto"` uses tmux split-pane when inside a tmux session, in-process mode otherwise. This gracefully handles both CLI and Desktop App contexts.

New hooks added (claude_only tier per ADR-0021):
- `TeammateIdle` → runs `post-write-lifecycle-check.ts` when a teammate finishes work
- `TaskCompleted` → runs `audit.ts` when a task is marked complete (workspace root only)

Integration with PM Gateway: when using Agent Teams, the PM Gateway still applies. Specialist agents are dispatched as teammates using their `agents/<name>.md` definitions. The PM remains the single entry point.

Antigravity users: use the Agent Manager (UI-based) for parallel work. The `invoke_subagent` tool with `Workspace: "share"` provides the closest equivalent for shared file access. See `GEMINI.md §3 Subagent Orchestration`.

## Consequences

- Agent Teams is the recommended approach for parallel specialist dispatch in Claude Code CLI sessions
- Desktop App sessions fall back to in-process mode; hooks do not fire — run `bun scripts/audit.ts` manually
- The experimental flag will be removed when the feature reaches GA; this ADR documents the adoption rationale for that future cleanup
- Antigravity sessions are unaffected — Agent Teams settings are `claude_only` and do not appear in `.gemini/settings.json`
- `asyncRewake: true` on TeammateIdle hook ensures teammate failures are surfaced to Claude rather than silently ignored
