---
description: Redirects commit+push+PR requests to the /sync pipeline (Gemini/Antigravity enforcement)
---

# Commit, Push, and Create PR

> **This workspace requires all commits and PRs to go through `/sync`.**

Do NOT issue `git commit` or `git push` via `run_command` directly. The pre-commit hook
blocks any `git commit` not originating from `dev-sync.ts` (`SYNC_ACTIVE` gate).
Subagents dispatched via `invoke_subagent` must NOT issue git commits directly.

## Use /sync instead

```
/sync "type: description of what changed"
```

The `/sync` pipeline enforces all required quality gates:
1. Writes `memory/YYYY-MM-DD.md` session entry
2. Checks `CHANGELOG.md [Unreleased]` has entries (run `/changelog` first if needed)
3. Runs `bun scripts/audit.ts` — blocks on failure
4. Creates `pr/YYYYMMDD-slug` branch, commits, pushes, opens GitHub PR

## Never use --no-verify

`--no-verify` is **forbidden**. It bypasses gitleaks secret scanning and all quality gates.
