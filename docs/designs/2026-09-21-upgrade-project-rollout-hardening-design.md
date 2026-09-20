# Design: upgrade-project rollout hardening (registry reconcile ordering, variant catch-up, delivery manifest)

- **Spec ID**: `2026-09-21-upgrade-project-rollout-hardening-design`
- **Date**: 2026-09-21
- **Status**: implemented
- **Owner**: automation-engineer
- **Scripts**: `scripts/upgrade-project.ts` 1.37.1 → 1.38.0, `scripts/dev-sync.ts` 1.15.0 → 1.16.0, `scripts/lib/upgrade-policy.ts` 1.9.0 → 1.10.0

## Summary

The 2026-09-21 fleet rollout (lifecycle modernization wave) surfaced three defects that
forced manual intervention in 4 of 11 projects. This design fixes each at the mechanism
level so the next fleet wave runs hands-off.

## Root Problems (measured during the 2026-09-21 rollout)

| # | Problem | Evidence |
|---|---------|----------|
| P1 | `SKILLS_REGISTRY_RECONCILE` runs BEFORE the skills delivery passes, so it reconciles pre-delivery state and every version-changing delivery invalidates the registry again. Projects whose registries carry rows for delivered skills failed their post-upgrade audits (co-game, co-architect; co-newbiz needed a second fixup). | reconcile block at L1349; skills passes at L1692/L1818 |
| P2 | The variant-skills pass has no equal-version catch-up: a variant skill whose template gained sub-files at an unchanged version never receives them (company-intelligence `references/terms-ko.json` required a manual copy into co-consult). | variant pass OK branches only log |
| P3 | Project-side spec-check (ADR-0055 Stage 2) fails on pure upgrade-delivered diffs (scripts count as code), forcing `--spec-exempt=E5` by hand in 3 of 11 projects. | co-abap, co-export, co-game rollout transcripts |

## Requirements

- **R1**: The registry reconcile must run after ALL passes that can change `skills/`
  (common skills, variant skills, country prune, variant-scope prune), so the
  registry reflects the final delivered state.
- **R2**: The variant-skills pass must apply the same equal-version CATCH-UP /
  DRIFT policy as the common pass (deliver missing files, warn on same-version
  content differences, never clobber).
- **R3**: An apply-mode upgrade must record the delivered diff
  (`.claude/last-upgrade-delivery.json`) so downstream tooling can recognize
  upgrade-only changes.
- **R4**: Project `/sync` must auto-legitimize a diff that is fully explained by
  the recorded upgrade delivery (E5 semantics, loudly logged) instead of blocking.
- **R5**: The auto-legitimization must live in shared, unit-tested code
  (`lib/upgrade-policy.ts`), and must never fire when ANY changed file falls
  outside the delivered set ∪ known pipeline artifacts.

## Design

1. **Reconcile relocation (R1)**: the `SKILLS_REGISTRY_RECONCILE` block moves from
   L1349 to immediately after the VARIANT-SCOPE SKILL PRUNE pass — the last pass
   that adds/removes project skills. No logic changes; placement only.
2. **Shared catch-up (R2)**: the common-pass helper is generalized to
   `catchUpDir(srcDir, dstDir)` (pure fs walk + copy-if-missing + drift list,
   dry-run aware). The common pass wraps it; the variant pass calls it in its
   equal-version branches (`OK` → CATCH-UP/DRIFT reporting, `syncChanged` bookkeeping).
3. **Delivery manifest (R3)**: at the end of an apply-mode upgrade, before the
   post-upgrade sync-skills invoke, write `.claude/last-upgrade-delivery.json`:
   `{ "timestamp": <ISO>, "files": [<git status --porcelain paths>] }`.
4. **Auto-E5 (R4/R5)**: `lib/upgrade-policy.ts` gains
   `isDeliveredDiff(changedFiles, deliveredFiles, pipelineArtifacts)` — true iff
   `changedFiles ⊆ deliveredFiles ∪ pipelineArtifacts` and `changedFiles` is
   non-empty. `dev-sync.ts` step 3.9, on spec-check failure, loads the manifest
   and the repo's changed-file list; when `isDeliveredDiff` holds it retries the
   identical audit command with `SYNC_SPEC_EXEMPT=E5` and logs
   `auto-E5: diff fully explained by upgrade delivery`. Pipeline artifacts:
   `CHANGELOG.md`, `memory/**`, `docs/VERSION_MANIFEST.md`, `docs/skill-graph.json`,
   `docs/skill-graph.md`, `.claude/last-upgrade-delivery.json`.

## Files Changed

- `scripts/upgrade-project.ts` 1.38.0 (reconcile move, shared catch-up, manifest)
- `scripts/dev-sync.ts` 1.16.0 (step 3.9 auto-E5 retry)
- `scripts/lib/upgrade-policy.ts` 1.10.0 (`isDeliveredDiff`)
- `scripts/SCRIPTS.md` + `templates/common/scripts/SCRIPTS.md` rows (lockstep)
- `tests/unit/upgrade-skill-subfile-sync.test.ts` (reconcile-order regression)
- `tests/unit/upgrade-delivered-diff.test.ts` (new, isDeliveredDiff unit tests)
- `CHANGELOG.md`

## Test Plan

1. Reconcile ordering: temp project seeded with handbook SKILL.md 0.5.9 + registry
   row 0.6.0 → upgrade → row must read 0.6.0 (pre-fix behavior left 0.5.9).
2. Delivery manifest: apply-mode run writes `.claude/last-upgrade-delivery.json`
   containing delivered paths; dry-run writes nothing.
3. `isDeliveredDiff` unit tests: subset→true, foreign file→false, empty→false.
4. Full `bun test`, `bun scripts/audit.ts`, `bun scripts/validate-templates.ts`.
5. Live validation on co-consult: delete the manually-copied
   `company-intelligence/references/terms-ko.json`, run the upgrade — the file must
   return via variant-pass CATCH-UP at equal version.

## Accessibility

Non-UI developer tooling. Exempt per ADR-0065 backend/non-UI exemption.

## Preview Verification

No rendered UI. Exempt per ADR-0070; verification is the test battery above.

## Rollout & Compatibility

Manifest file is additive (unknown to older tooling). Auto-E5 only relaxes the
spec-relevance arm for diffs fully explained by a recorded delivery; any hand-edited
file in the diff still blocks, preserving ADR-0074 discipline. Fleet delivery of this
script happens through the normal upgrade path; no immediate re-rollout is required.
