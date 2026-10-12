# Design: Variant script registry key fix + explain-me harness reference restore

- **Spec ID**: 2026-10-13-variant-script-registry-key-fix-design
- **Date**: 2026-10-13
- **Status**: implemented
- **Tickets**: T-20261013-006 (found by the co-safety 0.18.0 canary), follow-up to T-20261012-001

## Summary

Two defects surfaced by the first real exercise of the T-20261012-001 VARIANT
SCRIPTS SYNC feature (co-safety 0.16.0 → 0.18.0 upgrade, 2026-10-13):

### D1 — registry rows for nested variant scripts carried bare basenames

`upgrade-project.ts` v1.70.1's auto-registration scanned the delivered variant
script tree starting at `rel=''`, so registry keys were bare basenames
(`safety-audit.ts`) while the delivered files live at `scripts/co-safety/*.ts`
and the correct keys (`co-safety/safety-audit.ts`) already existed in the
project registry. Result: 15 duplicate ghost entries failed the project's first
post-upgrade `verify-scripts`. Fix (v1.70.2): the scan starts at
`rel=<variant>`, producing manifest-consistent keys; the existing-row dedupe
then matches the nested rows and skips them.

### D2 — templates/common explain-me shipped a dangling reference

`templates/common/skills/explain-me/SKILL.md` (3 refs) and
`references/BUILD_GUIDE.md` (2 refs) point at
`references/PLATFORM_HARNESS.md`, which did not exist in the template tree —
every scaffold/upgrade delivered a broken reference, while stale project-local
copies (pre-dating the workspace model-literal cleanup) still carried model-ID
literals and tripped Check MM (co-safety canary). Fix: restore
`references/PLATFORM_HARNESS.md` from the literals-free workspace-root SSOT
(`skills/explain-me/references/PLATFORM_HARNESS.md`), so the references resolve
and the next upgrade re-delivery overwrites stale project copies.

## Verification

- co-safety real-run upgrade re-delivers the clean harness file (project Check MM clears).
- Local canary re-run: `upgrade-project.ts --dry-run` shows no duplicate-row append for co-safety's nested scripts.
- `audit.ts` green on the root (SCRIPTS.md rows bumped, mirrors consistent).
- Suites: `bun test` root; project-side gates rerun in the canary PR.

## Non-goals

- Removing the now-unused `@l2-propagate: false` sweep semantics (dormant; tracked via T-20261013-005 context).
- co-safety's already-appended duplicate rows: cleaned project-side in the canary upgrade PR (mechanical dedupe), not by the root fix.
