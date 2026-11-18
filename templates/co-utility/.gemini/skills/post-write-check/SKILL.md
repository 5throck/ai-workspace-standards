---
name: post-write-check
description: >
  Use after ANY Write or Edit operation on project source files. Enforces the
  mandatory quality gate: workspace audit, then the project test suite.
  Trigger automatically after every code change, or manually when hooks are
  unavailable (Desktop App, Gemini CLI).
version: 1.0.0
last_reviewed: 2026-11-19
status: active
owner: qa
scope: variant
prerequisites: Project test suite configured (pytest or equivalent)
---

> ⚠️ **Desktop App / Gemini CLI**: `PostToolUse` hooks may not fire automatically.
> Run `/post-write` manually after every Write or Edit in those environments.

# Post-Write Quality Check

Applies to all tools: **Claude Code CLI, Gemini CLI, Desktop App**

## Context

Utility projects gate every write behind two checks: the workspace documentation
audit and the project test suite. This skill is the enforcement wrapper — it runs
both in order and issues a pass certificate only when both are green.

## When to Use

- After ANY Write or Edit to application source files
- After locale or UI asset changes
- Before every `/sync`
- Manually in environments where PostToolUse hooks do not fire

## Execution Steps

After ANY Write or Edit to source files, run these steps in order:

| Step | Command | Pass Condition |
|------|---------|----------------|
| 1 | `bun scripts/audit.ts --skip-memory` | Exit 0 — full workspace gate suite |
| 2 | `pytest tests/ -q` (or the project's configured test command) | 0 failures |

## When to Run

- After any change to the application source (e.g. `src/*.py`)
- After any change to locale files (`src/locales/*.json` or equivalent)
- After any change to UI assets (web templates, static JS/CSS)
- Before every `/sync`

## Related Skills

- `sync` — the pipeline this gate precedes; `/sync` re-runs the audit itself
- `i18n-audit` — the locale-parity audit backing step 1's locale checks
- `test-driven-development` — discipline for keeping step 2 green

## Output Format

Report each step clearly:

```
✅ audit      — PASSED (workspace gate suite, exit 0)
✅ pytest     — PASSED (N passed, 0 failed)
```

If any step fails:

```
❌ audit      — FAILED
  [!] <first failing gate line>
Action required: Fix the reported issue before proceeding.
```

## PASS Certificate

If all steps pass, issue this certificate in the task log:

```
✅ POST-WRITE PASS CERTIFICATE
──────────────────────────────
  audit   : OK — workspace gate suite, exit 0
  pytest  : N passed, 0 failed
──────────────────────────────
```

## Rules

1. Never skip the audit gate — even for "trivial" one-line changes.
2. If the audit fails, fix before running tests.
3. Report skipped steps as skipped, never as passed.
