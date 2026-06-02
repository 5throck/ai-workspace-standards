---
name: finishing-a-development-branch
description: Workspace override — redirects all branch completion to /sync pipeline which enforces CHANGELOG, memlog, audit, and PR creation gates.
version: 1.0.0
triggers:
  - "finish branch"
  - "complete work"
  - "wrap up"
  - "finishing a development branch"
  - "merge branch"
  - "create PR"
  - "push and PR"
---

# Finishing a Development Branch (Workspace Override — Gemini/Antigravity)

> **This workspace overrides the global `finishing-a-development-branch` skill for Gemini CLI and Antigravity.**

## Why this override exists

This workspace enforces a single PR creation path via `/sync` to guarantee:
- CHANGELOG.md entry exists before committing
- Session memlog is written to `memory/YYYY-MM-DD.md`
- `bun scripts/audit.ts` passes before any push

## What to do instead

**Always use `/sync` to complete work and create a PR:**

```
/sync "type: description of what changed"
```

## Never use --no-verify

`git commit --no-verify` and `git push --no-verify` via `run_command` are **forbidden**.
They bypass secret scanning (gitleaks) and all quality gates.
