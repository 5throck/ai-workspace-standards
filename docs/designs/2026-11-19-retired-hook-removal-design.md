# Retired hook removal on upgrade — design

**Status:** implemented

## Problem
`hooks.WorktreeCreate` running `git config core.hooksPath .githooks` prints no worktree path, so Claude Code worktree creation fails ("WorktreeCreate hook failed"). Templates and root dropped the hook (PRs #2107, #2108), but the generator still emitted it and the upgrade JSON merge only adds entries, so deployed projects keep it.

## Decision
- `generate-variant.ts` stops emitting `WorktreeCreate` and emits `attribution: {commit: "", pr: ""}`.
- `lib/hook-dedupe.ts` gains `RETIRED_HOOK_COMMANDS` (event + exact command) and `removeRetiredHookCommands` (pure). Empty inner hooks, entries, and events are pruned; other commands and the same command under other events (SessionStart) are untouched.
- `upgrade-project.ts` applies it after `dedupeClaudeSettingsHooks` in the JSON_MERGE pass, so it also heals files whose merge is otherwise a no-op.

## Out of scope
Fleet rollout (`upgrade-project` / `project-resync`); `audit.ts` lines 3599-3600 double-count (`Fail(...)` then `errors++`) — candidate separate ticket.

## Tests
`tests/unit/hook-dedupe.test.ts` — removal, partial-entry retention, other-event/other-command safety, junk input.
