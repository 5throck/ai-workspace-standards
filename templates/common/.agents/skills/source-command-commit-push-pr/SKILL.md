---
name: "source-command-commit-push-pr"
version: "1.0.1"
description: "Redirects commit+push+PR requests to the /sync pipeline (workspace enforcement)"
metadata:
  type: process
  triggers:
    - commit-push-pr
    - commit and push
    - create PR
---

# source-command-commit-push-pr

Use this skill when the user asks to run the migrated source command `commit-push-pr`.

## Command Template

# Commit, Push, and Create PR

> **This workspace requires all commits and PRs to go through `/sync`.**

Do NOT use direct `git commit` or `git push` commands. The pre-commit hook blocks any
`git commit` not originating from `dev-sync.ts` (`SYNC_ACTIVE` gate).

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
