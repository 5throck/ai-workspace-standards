# CI template `workflow_dispatch` trigger — fleet parity with co-price (T-20261031)

- **Status**: Implemented (this delivery)
- **Date**: 2026-10-31
- **Owner**: automation-engineer (PM Gateway dispatch)
- **Tier**: L0+L1 (edit lands in `templates/common/`; projects receive it through
  the ci.yml MERGE pass on their next upgrade)
- **Spec registry id**: `2026-10-31-ci-workflow-dispatch-design`
- **Precedent**: Projects/co-price/docs/designs/2026-10-30-ci-migration-drift-gate-design.md §3.1

## 0. Accessibility exemption statement

This design is a CI workflow configuration change. It produces no user-facing
UI. The ADR-0065 accessibility sections and the ADR-0070 preview-verification
sections are **exempt** for the artifact in this design.

## 1. Context

co-price deliberately added a bare `workflow_dispatch:` trigger to its
`.github/workflows/ci.yml` on 2026-10-30 (design
`Projects/co-price/docs/designs/2026-10-30-ci-migration-drift-gate-design.md`
§3.1: one-click full drift check on any ref). The template copy at
`templates/common/.github/workflows/ci.yml` lacks the trigger, so every
co-price upgrade run fails the ci.yml MERGE prelude
(`scripts/lib/ci-workflow-merge.ts` `checkProjectTopLevel`, comparing parsed
`on:` blocks with `stableStringify`): `MIGRATION_UNSAFE — project
on/permissions differ from the template`, blocking the co-price 0.22.1 → 0.25.0
upgrade. `--accept-ci-perm-diff` would silently drop the project's deliberate
addition and was rejected.

## 2. Decision

Add a bare `workflow_dispatch:` key (no inputs) to the template's `on:` block
with a provenance comment. Bare `workflow_dispatch:` parses to YAML `null`,
identical to co-price's `workflow_dispatch: null` semantics, so the semantic
`on:` comparison passes and the divergence disappears for co-price — and no
other fleet project regresses, because their template-delivered copies gain the
same key in the same MERGE pass (the comparison is on parsed YAML, not text;
the provenance comment does not affect it).

Not exempt under E1–E5: this changes template CI configuration that ships to
every scaffolded project (ADR-0074 Design Gate applies).

## 3. Alternatives considered

- **`--accept-ci-perm-diff` on the co-price upgrade** — rejected: silently
  drops the project's deliberate trigger; systemic divergence remains for the
  fleet.
- **Per-project hand-edit + accept flag** — rejected: repeats the same manual
  step for every project and still leaves template/project `on:` divergence.

## 4. Version gating (verified)

- `.github/workflows/ci.yml` is not an entry in
  `docs/templates/common-contract.json` (no contract row) — grep verified.
- The file carries no `@version`-style marker; it is content-gated by the
  ci.yml MERGE pass (template-owned content authoritative, PROJECT-JOBS region
  preserved), so no version bump is required.
- `scripts/upgrade-project.ts` v1.63.0 header (v1.61.0 note, 2026-10-01,
  ADR-0094) documents the MERGE pass; the `--accept-ci-perm-diff` flag remains
  available for genuine intentional divergence only.

## 5. Risks

- All fleet projects gain a manual-dispatch trigger on their next upgrade.
  Risk accepted: the trigger is inert until manually invoked and matches what
  co-price already validated in production.
- GitHub fires `workflow_dispatch`-enabled workflows only on manual dispatch;
  no scheduled or automatic behavior changes.

## 6. Verification plan

- `bun scripts/audit.ts` green.
- `bun scripts/upgrade-project.ts Projects/co-price --dry-run` no longer
  reports `MIGRATION_UNSAFE` for `.github/workflows/ci.yml`.
- CHANGELOG `[Unreleased]` entry dated 2026-10-31 citing this design and the
  co-price design.
