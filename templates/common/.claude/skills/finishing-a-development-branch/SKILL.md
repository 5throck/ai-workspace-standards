---
name: finishing-a-development-branch
description: Workspace override — redirects all branch completion to /sync pipeline which enforces CHANGELOG, memlog, audit, and PR creation gates.
gemini-parity: skip
triggers:
  - "finish branch"
  - "complete work"
  - "wrap up"
  - "finishing a development branch"
  - "merge branch"
  - "create PR"
  - "push and PR"
---

# Finishing a Development Branch (Workspace Override)

> **This project overrides the global `finishing-a-development-branch` skill.**

## Why this override exists

This project enforces a single PR creation path via `/sync` to guarantee:
- CHANGELOG.md entry exists before committing
- Session memlog is written to `memory/YYYY-MM-DD.md`
- `bun scripts/audit.ts` passes before any push
- Branch is named `pr/YYYYMMDD-HHMMSS-slug` for traceability

The global skill's Option 2 (push without commit) bypasses CHANGELOG and memlog requirements.

## What to do instead

**Always use `/sync` to complete work and create a PR:**

```
/sync "type: description of what changed"
```

## Never use --no-verify

`git commit --no-verify` and `git push --no-verify` are **forbidden**.
They bypass secret scanning (gitleaks) and all quality gates.
