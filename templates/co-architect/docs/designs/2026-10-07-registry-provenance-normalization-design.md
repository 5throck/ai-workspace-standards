# Design: script-registry provenance normalization (fossil L0 stamps)

- **Spec ID**: 2026-10-07-registry-provenance-normalization
- **Date**: 2026-10-07
- **Status**: implemented
- **Scope**: `scripts/SCRIPTS.md`

## Problem

The workspace L0 audit surfaced fossil provenance in project script registries: rows for variant-delivered and project-local scripts still stamped `source=L0 | layer=common` (or `L2`) from the era when variant scripts were registered at the workspace root (inherited via the 2026-07-02 L1 sync). The true L0/L1 registries dropped those rows in the restructure; the pruning never reached project registries. This registry carries **6** such rows (0 variant-delivered, 6 project-local).

## Decision

Relabel — not prune (`verify-scripts` Check 1 requires a row per script file; the rows carry real version data; only the provenance columns lie). The L0 fleet tool `scripts/normalize-registry-provenance.ts` (workspace; spec `2026-10-07-registry-provenance-normalization-design`) relabels by filesystem truth: L1-delivered rows untouched; variant-overlay rows whose file exists in `templates/co-architect/scripts/` → `L2 | L2-only`; project-local rows → `L3 | L3`; ghosts reported without auto-edit.

Applied here: 6 rows normalized (idempotent; versions/statuses/dates untouched).

## Consequences

- Provenance reads truthfully; Check A semantics unchanged (keys on file↔row version).
- Recurrence prevented upstream: workspace `upgrade-project.ts` v1.66.0 runs the normalizer as a non-fatal post-upgrade pass, so future upgrades keep this registry convergent.

## Verification

- `bun scripts/verify-scripts.ts --verify` — green post-relabel.
- Second normalizer run reports 0 rows (idempotent).
