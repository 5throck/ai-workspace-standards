# Registry-Append Boundary Fix — the append index must stop at the next `## ` heading

- **Date**: 2026-10-17
- **Status**: Implemented
- **Spec ID**: 2026-10-17-registry-append-boundary-fix-design
- **Related**: T-20261017-001, nightly "Scaffold E2E (all variants)" runs 38859687026 (10-16) / 38691234503 (10-15), helpers/registry-append.ts (introduced T-20261013-001, refactored T-20261014-002), new-project §6.6, upgrade-project VARIANT SCRIPTS SYNC / reconcileScriptRegistry

## 1. Background

The nightly all-variants scaffold E2E failed two nights in a row (10-15, 10-16) with the same signature: 13/14 variants passed, **co-abap** failed at the scaffold's audit gate — `verify-scripts` reporting 7 unregistered scripts (`sap-integrity.ts`, `sap-approve.ts`, `sap-mcp-proxy.ts`, `hooks/sap-action-audit.ts`, `hooks/sap-action-gate.ts`, `validate-abap-platform-parity.ts`, `lib/sap-action-lib.ts`).

Reproducing the scaffold locally showed the rows WERE present in the delivered `scripts/SCRIPTS.md` — but **inside the `## Lifecycle States` table** (spliced between `experimental` and the rest of that table), not inside `## Registry`. The project-side `verify-scripts` only honors rows in the `## Registry` table, hence "unregistered".

## 2. Root Cause

`helpers/registry-append.ts` `registryAppendIndex()` scans from the `## Registry` heading to find the insertion point (index after the last table row). T-20261014-002 (v1.1.0) retired the original "break at the first non-table line" rule and kept a single stop condition: the first `#### \` detail-section header. The real delivered SCRIPTS.md has, between the Registry table and the first `#### \` header, three `##` sections whose tables contain backtick-row-shaped lines:

- `## Layer Classification Framework` (prose)
- `## Ownership Layers` (`| \`L0\` | ...` rows)
- `## Lifecycle States` (`| \`active\` | ...` rows)

Every one of those rows matches the row pattern `/^\|\s*`/`, so `lastRowIdx` ended up inside the Lifecycle States table and the splice landed there. Only co-abap failed because it is the only variant delivering scripts that need scaffold-time auto-registration. No existing project was affected (fleet scan of all `Projects/*/scripts/SCRIPTS.md` found zero misplaced rows) — the bug fires only when the append path runs with rows actually missing, i.e. fresh scaffolds.

## 3. Fix (registry-append.ts v1.2.0)

1. **Region bound**: the scan stops at the NEXT `## ` heading after `## Registry`. Prose and `###` subsections inside the region still do not break the scan (the v1.1.0 intent is preserved); rows in later `##` tables can never win. The `#### \` bound is kept as defense in depth.
2. **Anchor tightened**: `/^## Registry\s*$/` instead of `/^## Registry/` — a preceding `## Registry Scope` section can no longer hijack the anchor (the root SCRIPTS.md has one).

Call sites (all three share the fixed scan): new-project §6.6 scaffold append, upgrade-project VARIANT SCRIPTS SYNC append, reconcileScriptRegistry's append arm.

## 4. Tests

Two regression tests in `tests/unit/registry-append.test.ts` mirroring the real delivered-file shape:

- Registry table → `## Layer Classification Framework` → `## Lifecycle States` (backtick rows) → `## Guide` → `#### \`a.ts\``: the index must fall on the last Registry-table row, before the Lifecycle States section.
- `## Registry Scope` preceding `## Registry`: the anchor must be the exact Registry heading.

Both fail on v1.1.0 and pass on v1.2.0. Existing 8 tests unchanged and green.

## 5. Verification

- `bun test tests/unit/registry-append.test.ts` — 10/10.
- Local `bun scripts/new-project.ts … --variant co-abap` scaffold: 7 rows registered inside `## Registry`; `verify-scripts --verify` → "All 162 registered scripts verified".
- Local full variant battery `bun scripts/test-new-project.ts … --variant co-abap --platform all --yes`: **41/41 passed**.
