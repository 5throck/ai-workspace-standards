---
name: desktop-app-fallback
description: Manual Post-Write QA chain for Claude Code Desktop App (hooks don't fire)
metadata:
  type: task
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
2. Commit: `bun scripts/dev-sync.ts "description"
