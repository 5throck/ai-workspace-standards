---
name: desktop-app-fallback
description: Manual Post-Write QA chain for Claude Code Desktop App (hooks don't fire)
version: 1.0.0
last_reviewed: 2026-08-15
status: active
scope: co-abap
owner: test-runner
prerequisites: Claude Code Desktop App
metadata:
  type: task
  triggers:
    - desktop-app-fallback
    - manual QA
    - Desktop App
---

# Desktop App Post-Write Fallback

## When to Use

Use this skill when working in the **Claude Code Desktop App**, where `PostToolUse` hooks do not fire automatically.

## Trigger

After any `WriteSource` or `EditSource` operation in the Desktop App.

## Manual QA Chain

Run the following commands manually after each write operation:

```bash
# 1. Syntax Check
vsp syntax check --object "<object_url>"

# 2. Run Unit Tests
vsp test run --object "<object_url>"

# 3. Run ATC Check
vsp atc run --object "<object_url>"
```

## Or Use the Combined Script

```bash
bun scripts/post-write.ts "<object_url>"
```

## Expected Results

| Step | Required | Action on Fail |
|------|:--------:|----------------|
| Syntax Check | ✅ Pass | Fix syntax errors, re-run |
| Unit Tests | ⚠️ Best effort | Fix bugs if critical |
| ATC Check | ✅ P1 must pass | Fix P1 findings, document P2/P3 |

## After QA Pass

1. Sync changes: `bun scripts/sync-mcp.ts`
2. Commit: `bun scripts/dev-sync.ts "description"`

## Context

The Claude Code Desktop App does not automatically fire `PostToolUse` hooks after write operations, meaning the standard post-write QA chain is bypassed. This skill provides a manual fallback so developers can still enforce syntax checking, unit testing, and ATC validation after every ABAP write operation in Desktop App sessions.

## Execution Steps

1. **Syntax Check** — Run `vsp syntax check --object "<object_url>"` and verify pass.
2. **Unit Tests** — Run `vsp test run --object "<object_url>"` and review results.
3. **ATC Check** — Run `vsp atc run --object "<object_url>"` and ensure no Priority-1 findings.
4. Alternatively, run the combined script: `bun scripts/post-write.ts "<object_url>"`.
5. After QA passes, sync changes with `bun scripts/sync-mcp.ts` and commit with `bun scripts/dev-sync.ts`.

## Output Format

Pass/fail result for each QA step:
- Syntax Check: Pass required; fix and re-run on failure.
- Unit Tests: Best effort; fix critical bugs.
- ATC Check: Priority-1 must pass; document Priority-2/3 findings.

## Related Skills

- [post-write-chain](../post-write-chain/SKILL.md) — The automated version of this chain for CLI sessions where hooks fire
- [abap-dev](../abap-dev/SKILL.md) — Core ABAP development workflows that precede the write operations
