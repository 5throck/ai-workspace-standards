# ABAP Development Rules

Quick reference for ABAP naming conventions, development workflow, and system defaults for the Harness Engineering framework.

---

## System Info (Default)

- Package: `$TMP` (no transport required for scratch/dev)
- Naming: `ZCL_` (class), `ZIF_` (interface), `ZPROG_` (program)
- Local `.abap` files: create ONLY in the `scratch/` directory

---

## Naming Conventions

| Object Type | Prefix | Example |
|-------------|--------|---------|
| Class | `ZCL_` | `ZCL_ORDER_PROCESSOR` |
| Interface | `ZIF_` | `ZIF_PRINTABLE` |
| Program | `ZPROG_` | `ZPROG_BATCH_REPORT` |
| Function Group | `ZFG_` | `ZFG_ORDER_UTILS` |
| CDS View | `ZI_` / `ZC_` | `ZI_SALES_ORDER` |
| Enhancement Spot | `ZES_` | `ZES_ORDER_HOOK` |

---

## Mandatory QA Chain

After **every** source edit, execute in order:

1. `SyntaxCheck` — must return 0 errors
2. `RunUnitTests` — must return 0 failures
3. `RunATCCheck` — Priority 1 findings block activation

See [testing-guidelines.md](testing-guidelines.md) for ATC priority thresholds and unit test patterns.

---

## Task Lifecycle

```
1. Initialize task
   → copy docs/task-template.md to scratch/tasks/task-YYYY-MM-DD-NNN.md

2. Phase 1 — Research (parallel, read-only)
   → dispatch sap-investigator, read-only-analyst, schema-inspector in one message

3. Phase 2 — Implementation (serial, one object at a time)
   → SyntaxCheck → EditSource/WriteSource → SyntaxCheck → RunUnitTests → RunATCCheck

4. Phase 3 — QA and commit
   → RunATCCheck passes → memory log → git commit
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| CSRF errors | Expired token | Auto-refreshed by vsp; retry |
| Lock conflict | Another session holds lock | `UnlockObject` or wait |
| Auth failure | Mixed basic + cookie | Use one method only |
| RunReport timeout | Long-running report | Use `RunReportAsync` + `GetAsyncResult` |
| Debugger 403 | REST breakpoints on newer SAP | Requires `ZADT_VSP` installed on SAP |

---

## Conventions

- Task Handoffs: `scratch/tasks/task-YYYY-MM-DD-NNN.md`
- SAP objects for plugin development: `ZADT_<nn>_<name>`, `ZCL_ADT_<name>`, packages `$ZADT*`
- Memory logs: `memory/YYYY-MM-DD.md`

---
*Last Updated: 2026-06-01*
