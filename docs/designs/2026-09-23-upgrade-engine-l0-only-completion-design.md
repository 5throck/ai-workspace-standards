# Design: Upgrade-engine L0-only completion + registry-aware prune

- **Spec ID**: `2026-09-23-upgrade-engine-l0-only-completion-design`
- **Status**: implemented
- **Owner**: pm (adjudication), automation-engineer (implementation)
- **Tickets**: T-20260923-003 (registry-aware prune), T-20260923-004 (ADR-0073 Amendment 1 adjudication)
- **Date**: 2026-09-23

## Background

The 2026-09-23 fleet resync surfaced two defects in `upgrade-project.ts` v1.43.0:

1. **PRUNE REMOVED ate a project-local script.** The `scripts/` prune category
   keeps only files whose basename exists in `templates/common/scripts/`;
   co-newbiz's registered project-local `deploy-web.ts` (owner `co-newbiz`,
   L3-only, design 2026-09-21-docker-prod-cicd) was `git rm`-ed. The `skills/`
   category consults the variant manifest + asset gate before pruning; the
   `scripts/` category consults nothing. Additionally, `reconcileScriptRegistry`
   only appends/syncs rows — it never drops the row of a legitimately pruned
   file, which is why the 2026-09-16 sync-agent-status ghost rows had to be
   hand-remediated.
2. **The engine re-delivered itself to every project.** ADR-0073 Amendment 1
   (2026-09-11) declared the upgrade trio L0-only with physical L1 mirrors
   removed, but `templates/common/scripts/upgrade-project.ts` +
   `templates/common/scripts/helpers/skills-registry.ts` still existed,
   test-guarded in lockstep, with `L0+L1` layer rows in both registries — so
   TEMPLATE TREE SYNC shipped a fresh 165 KB inert engine copy into all 11
   `Projects/co-*` on every upgrade. PM adjudication (2026-09-23): the engine
   must NOT be delivered to projects; complete Amendment 1.

## Scope adjustment (user decision, 2026-09-23)

`lib/upgrade-policy.ts` is **excluded** from the L0-only removal. Amendment 1
listed it in the trio, but since v1.11.0 it exports `isDeliveredDiff()`
(dev-sync step 3.9 auto-E5) and `MERGE_MANAGED_FILES` /
`SCAFFOLD_COMMON_OWNED_FILES` constants imported by the **delivered** project
scripts `dev-sync.ts` and `validate-templates.ts`. It is a leaf data module
(imports only `node:fs`/`node:path`) with no engine behavior. Removing it from
L1 would break every project's sync pipeline. The engine-only rule is
therefore: **L0-only = `upgrade-project.ts` + `check-upgrade-coverage.ts` +
`helpers/skills-registry.ts`**; `lib/upgrade-policy.ts` remains L0+L1 as a
shared data module. Recorded as Amendment 3 in `docs/adr/0073`.

## Decisions

- **D1 — L1 mirror removal (completes ADR-0073 Amendment 1).**
  `git rm templates/common/scripts/upgrade-project.ts`
  `templates/common/scripts/helpers/skills-registry.ts`. Layer cells for both
  rows become `L0` in the L0 and L1 SCRIPTS.md registries (the
  `new-project.ts` row is the existing precedent for the L0-in-L1-registry
  convention). Fleet copies are retired by the prune pass itself (see D2) —
  no hand deletion needed. `reconcileScriptRegistry`'s append-time layer
  rewrite (L0 → L3 on append) keeps protecting the remaining L0-only rows
  (e.g. `new-project.ts`).
- **D2 — registry-aware prune with row reconciliation.** In the PRUNE REMOVED
  `scripts/` category (top-level `scripts/*.ts`, unchanged scope):
  - Look the file up in the project `scripts/SCRIPTS.md` registry (same row
    regex shape as `reconcileScriptRegistry`).
  - A row whose **source cell names the project variant** (e.g. `co-newbiz`)
    marks a project-local script → **skip the prune** (file and row survive).
  - Otherwise (source `L0`/`L1`, or unregistered) → prune as before, and
    **drop the file's registry row(s)** so no ghost row trips
    `verify-scripts --verify`. Row-drop is legitimate-prune-only by
    construction: it fires only inside the branch that actually deletes the
    file.
- **D3 — engine version bump.** `upgrade-project.ts` v1.43.0 → v1.44.0
  (prune behavior change + D1 header note). Registry rows updated in the same
  change. L1 registry row keeps documenting the script under the L0
  convention (no physical mirror).

## Requirements

1. `bun scripts/upgrade-project.ts <project> --prune-removed` on a project
   whose `scripts/SCRIPTS.md` registers a project-local script (source =
   variant name) absent from the template MUST keep both file and row.
2. The same run on a project holding an engine copy
   (`scripts/upgrade-project.ts`, source `L0`) absent from the template MUST
   prune the file and remove its registry row.
3. Root `bun test`, `bun scripts/typecheck.ts`, `bun scripts/validate-templates.ts`,
   `bun scripts/check-upgrade-coverage.ts --strict` pass after the changes.
4. After the fleet upgrade run, every project exits `verify-scripts --verify`
   clean (no ghost rows) and its `audit.ts` passes.

## Accessibility

Backend/scripting change only — no user-facing UI, no interaction areas.
Exempt per ADR-0065 with this explicit statement.

## Preview verification

Not applicable — no rendered UI surface. Exempt statement per ADR-0070.

## Validation plan

- New regression test `tests/unit/upgrade-prune-removed.test.ts`
  (temp-project harness, subprocess style):
  (a) registered project-local script survives `--prune-removed`;
  (b) registered L0-source script absent from template is pruned + row dropped;
  (c) unregistered foreign script is pruned (unchanged legacy behavior).
- Full root battery (Requirement 3), then the fleet upgrade run
  (Requirement 4) inside the same resync cycle.
