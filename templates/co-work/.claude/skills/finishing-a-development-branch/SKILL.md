---
name: finishing-a-development-branch
description: Workspace override — redirects all branch completion to /sync pipeline which enforces CHANGELOG, memlog, audit, and PR creation gates.
version: 1.0.0
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

> **This workspace overrides the global `finishing-a-development-branch` skill.**

## Why this override exists

This workspace enforces a single PR creation path via `/sync` to guarantee:
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

Examples:
```
/sync "feat: add user authentication"
/sync "fix: resolve null pointer in payment flow"
/sync "docs: update API reference"
```

The `/sync` pipeline handles everything:
1. Writes session entry to `memory/YYYY-MM-DD.md`
2. Updates `memory/MEMORY.md` index
3. Verifies CHANGELOG.md has an entry (blocks if missing — run `/changelog` first)
4. Runs `bun scripts/audit.ts` (blocks on failure)
5. Creates `pr/date-slug` branch, commits, pushes, opens GitHub PR

## Never use --no-verify

`git commit --no-verify` and `git push --no-verify` are **forbidden** in this workspace.
They bypass secret scanning (gitleaks) and all quality gates.
