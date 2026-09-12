---
name: security-check
description: Run engagement security gate — verify authorization status and check for exposed secrets before any offensive activity.
argument-hint: "[--pre-phase <phase-number>]"
allowed-tools: ["Bash", "Read", "Glob", "Grep"]
---

# Security Check (Engagement Gate)

**Dispatcher**: security-expert (triggered at Phase 5 entry by PM)

Arguments: $ARGUMENTS

This command runs the engagement security gate. It is automatically called before Phase 1+ work.

- **No arguments**: Verify authorization document exists and is valid. Check `docs/scope.md` exists. Report engagement status.
- **`--pre-phase <N>`**: Full pre-phase gate for Phase N. Confirms authorization, scope boundaries, and that no credentials are staged for commit.

Load and follow `agents/pm.md` Authorization Checklist exactly.

Report gate result as PASS ✅ or BLOCKED ❌ with specific blocking reason.
