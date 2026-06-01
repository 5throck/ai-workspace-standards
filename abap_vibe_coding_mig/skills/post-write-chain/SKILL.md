---
name: Post-Write Mandatory Chain
description: Use after ANY WriteSource, EditSource, or Activate operation on SAP ABAP objects. Enforces the mandatory quality gate: SyntaxCheck → RunUnitTests → RunATCCheck. Trigger automatically after every ABAP write operation.
version: 1.0.0
---

> ⚠️ **Desktop App**: `PostToolUse` hooks do **not** fire automatically. Run `/post-write <object-name>` **manually** after every WriteSource or EditSource in Desktop App sessions.

# Post-Write Mandatory Chain

Applies to all tools: **Claude Code CLI, Antigravity, Gemini CLI**

After ANY `WriteSource` / `EditSource` / `Activate`, the executing agent MUST run these three steps in order:

| Step | Tool | Pass Condition |
|------|------|----------------|
| 1 | `SyntaxCheck` | 0 errors |
| 2 | `RunUnitTests` | 0 failures |
| 3 | `RunATCCheck` | 0 Priority-1 findings |

## ATC Priority Levels

- **Priority 1 (Error)** → BLOCKS deployment — fix before `Activate`
- **Priority 2 (Warning)** → PM review required before proceeding
- **Priority 3 (Info)** → Log to task file only

## Output Format

Report each step result clearly:

```
✅ SyntaxCheck — PASSED
✅ RunUnitTests — PASSED (N tests, 0 failures)
✅ RunATCCheck — PASSED (0 Priority-1, 0 Priority-2, N Priority-3)
```

If any step fails:

```
❌ SyntaxCheck — FAILED
  Error: <error message>
  Line: <line number>
Action required: Fix the syntax error before proceeding.
```

## Rules

1. Never skip SyntaxCheck — even for "trivial" one-line changes.
2. If SyntaxCheck fails, fix the code and re-run before proceeding to RunUnitTests.
3. If RunUnitTests fails, do not run RunATCCheck until the test logic is fixed.
4. Priority-1 ATC findings block all further steps including transport release.
5. In Gemini / Antigravity sessions: route all three steps through `sap_execute` with `"action": "SyntaxCheck"`, `"action": "RunUnitTests"`, `"action": "RunATCCheck"`.

## Claude Code Desktop App Note

`PostToolUse` hooks do **not** fire automatically in the Desktop App. Run all three steps of this chain manually after each write in Desktop sessions using `/post-write <object-name>`.
