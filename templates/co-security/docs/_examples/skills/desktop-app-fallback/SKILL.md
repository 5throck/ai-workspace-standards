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

After any `Write` or `Edit` operation in the Desktop App.

## Manual QA Chain

Run the following commands manually after each write operation:

```bash
# 1. Lint / Type Check
npm run lint        # or your project's linter
# or
python -m pylint src/    # for Python

# 2. Run Tests
npm test            # or your project's test command
# or
pytest              # for Python

# 3. Additional Checks (if applicable)
npm run type-check  # TypeScript
npm run build       # Verify build succeeds
```

## Expected Results

| Step | Required | Action on Fail |
|------|:--------:|----------------|
| Lint / Type Check | ✅ Pass | Fix linting errors, re-run |
| Tests | ⚠️ Best effort | Fix bugs if critical |
| Build | ✅ Pass | Fix build errors |

## After QA Pass

1. Review changes: Check the diff
2. Commit: Use your project's commit workflow
3. Push: Create PR if applicable
