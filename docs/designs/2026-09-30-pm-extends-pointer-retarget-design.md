# Design: project-resolvable pm.md extends pointer (T-20260930-037)

Status: SUPERSEDED and reverted (2026-10-01). The retarget rule below pointed a project
`pm.md` at the L0 root `agents/pm.md`; the pipeline change was reverted in PR #1268, and the
nightly runner had already restored `../../common/agents/pm.md` in the deployed projects
(the pipeline code, its tests, and the version bumps were reverted with it).
**Final ruling: ADR-0095 (Accepted 2026-10-01) — an L3 extends pointer is valid iff it
resolves on disk; the dangling `../../common` form is invalid; this design's L0 retarget
direction was subsequently adopted by decision rather than by its own mechanism.**
Historical note: T-20261001-003 reported the fleet effect. Open question kept for follow-up:
why `upgrade-project` MERGE creation copies a stub verbatim instead of resolving it against L1.
Source: PM triage of T-20260930-030/031/036 (dangling `pm.md` extends in variant projects).

## Problem

`templates/<variant>/agents/pm.md` carries `extends: ../../common/agents/pm.md`. In the
TEMPLATE tree this resolves to `templates/common/agents/pm.md` (correct). The scaffold
and upgrade pipelines copy the pointer string verbatim to `Projects/<variant>/agents/pm.md`,
where `../..` lands on `Projects/` — `Projects/common/agents/pm.md` does not exist, so
every scaffolded variant shipped a dangling pointer (9 variants affected; fixed locally,
`Projects/` is gitignored). The already-correct deployed pattern (`co-architect`,
`co-newbiz`) is `extends: ../../../agents/pm.md` — the workspace-root `agents/pm.md`.

## Design

One retarget rule, applied at every delivery point where a pm.md stub SURVIVES resolution:

1. `scripts/helpers/resolve-pm-stub.ts`: `rewritePmExtendsPointer(content)` (pure) rewrites
   ONLY the exact template-form pointer to `extends: ../../../agents/pm.md`; any other
   extends value (the 13 i18n-specialist stubs, standalone agents) passes through unchanged.
   `fixPmExtendsPointer(path)` applies it in place and reports whether it rewrote.
2. `scripts/new-project.ts` section 2.3b: when a pm.md stub survives (missing L1 body /
   unresolved), retarget in place. Fully-resolved scaffolds still inline and drop extends.
3. `scripts/upgrade-project.ts` MERGE_FILES `agents/pm.md` pass: retarget after
   `mergeWorkspaceManaged`, so EXISTING projects are repaired by the upgrade pass.
   Idempotent (second run is a no-op); dry-run never writes.

## Rejected alternatives

- Editing `templates/<variant>/agents/pm.md` to the root-relative path: dangles in the
  template tree itself (`templates/../../agents/pm.md` is outside the repo root).
- Copying `templates/common/agents/pm.md` into each project as `Projects/common/`: adds a
  non-standard directory to every project; the root `agents/pm.md` is the sanctioned target
  (two variants already use it).

## Verification

- New unit tests (`tests/unit/pm-extends-pointer.test.ts`, 6 tests): rewrite, idempotency,
  stub pass-through, quoted values, in-place behavior.
- New scaffold Test 31 (`scripts/test-new-project.ts`): generated `agents/pm.md` contains no
  template-form pointer; any surviving extends resolves to the repo-root `agents/pm.md`.
- `--all-variants` failure set unchanged (pre-existing co-export/co-hr/co-news/co-safety,
  tracked as T-20260930-039).

## Out of scope

`adopt-project.ts` shares the stub consumer and may need the same retarget (follow-up
ticket). Known pre-existing scaffold failures for four variants (T-20260930-039).
