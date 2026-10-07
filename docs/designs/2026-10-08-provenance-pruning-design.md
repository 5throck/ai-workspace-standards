# Upgrade-Pipeline Provenance Pruning — Design (proposed)

- **Date**: 2026-10-08
- **Status**: proposed (T-20261007-017; extends T-20261007-016's promotion)
- **Related**: `scripts/normalize-registry-provenance.ts` (L0, promoted), upgrade-policy REGENERATED_FILES, co-deck registry-provenance design (deferred candidates)

## Problem

The normalizer relabels fossil provenance stamps per run, but nothing stops
them re-accumulating: every upgrade delivers registry rows whose provenance
columns were computed for the SOURCE layer, and project-local rows created
between upgrades keep whatever stamp they got at creation.

## Decision (proposed)

1. **Delivery-time stamping (root cause).** upgrade-project's script delivery
   pass already knows each row's origin (L1 template / variant overlay). When
   it updates a project `scripts/SCRIPTS.md` row, it writes the correct
   provenance for that origin at delivery time (`L2 | L2-only` for variant
   overlays, source-true for L1 rows) instead of carrying the template-side
   stamp verbatim.
2. **Prune step (post-upgrade, REGENERATED-class).** After script delivery,
   upgrade-project prunes the project registry's provenance columns against
   the delivered set — the same position as the existing
   `normalize-registry-provenance` POST-UPGRADE PROVENANCE NORMALIZE pass
   (v1.66.0), but as a policy pass rather than a relabel: rows absent from
   every upstream source keep their L3 stamps (they are project-owned), rows
   matching no delivery claim and no project file are ghost-flagged for
   human review (never auto-deleted).
3. **Blast-radius control** (the reason co-deck's original design deferred
   this): the pass only ever edits the two provenance columns — versions,
   statuses, and notes are untouched; a `--prune-removed` (destructive)
   invocation is NOT required for it to run.

## Consequences

- Fossil rows cannot re-accumulate; the normalizer becomes the residual
  safety net rather than the primary mechanism.

## Open questions for the reviewer

- Whether stamping at delivery should also apply to BRAND-NEW rows the
  upgrade inserts (yes, proposed) and what stamp project-created rows carry
  on first registration (L3 proposed).
- Interaction with the v1.66.0 normalize pass: proposed disposition is
  normalize-pass stays (harmless, converges legacy), new stamping pass owns
  the going-forward guarantee.
