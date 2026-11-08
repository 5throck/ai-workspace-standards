# Variant scripts delivery + prune visibility — design

- **Spec id**: 2026-11-08-variant-scripts-delivery-prune-design
- **Status**: implemented
- **Date**: 2026-11-08
- **Tickets**: T-20261108-007 (delivery gap), T-20261108-008 (recurring prune loss)
- **Version**: upgrade-project.ts v1.95.0

## 1. Problem

One root cause, two failure classes observed on 2026-11-08:

1. **Delivery gap (T-20261108-007)**: `SYNC_IF_NEWER: scripts/` walks only
   `templates/common/scripts` (`tplScriptsRoot`, upgrade-project v1.94.0 line ~3225).
   Variant-template scripts — both top-level (`templates/co-abap/scripts/sap-*.ts`)
   and subdirectory trees (`templates/co-work/scripts/deck/ppt-master-adapter.ts`) —
   were never enumerated for delivery. The co-work deck adapter was skipped silently
   until the external-deps V4 adapter-existence gate caught it (the gate is loud by
   design and dev-sync gates on `external-deps verify`, so the landing blocked).

2. **Prune loss (T-20261108-008)**: the PRUNE REMOVED `scripts/` category's
   `tplDirs` is `[templates/common/scripts]` only. A variant-template script
   present in the project is "absent from the template" from the prune's point of
   view, and `scriptIsRetiredDelivery` finds its row in the ROOT registry
   (DEC-20261106-03 registered co-abap-only scripts as L0+L2 so validate-templates
   WS-05 stays quiet) → classified "retired upstream delivery" → PRUNED with its
   project registry row dropped. This fired twice (11-07 wave, 11-08 wave) on the
   same four co-abap scripts and silently deleted
   `validate-abap-platform-parity.ts`, which co-abap's `ci.yml` invokes
   (Documentation Audit job fails on the missing module).

The claim routing was never wrong: `resolveClaim('scripts/**')` already routes to
`{ policy: 'SYNC', pass: 'SYNC_IF_NEWER: scripts/' }` — only the enumeration was
incomplete. No upgrade-policy change is required.

## 2. Fix

### R1 — delivery enumerates the variant overlay (upgrade-project v1.95.0)

`SYNC_IF_NEWER: scripts/` builds a rel→source map over
`[templates/<variant>/scripts, templates/common/scripts]` (variant first, so the
variant copy wins where both exist — the same precedence `resolveTemplate` uses),
then runs the existing SYNC_IF_NEWER logic per rel. The walk stays recursive with
its existing exclusions (dot-dirs, node_modules, temp). Overlap with the
`scripts/<variant>/` registry-dir copy pass is benign: identical content is a
no-op under SYNC_IF_NEWER, and the preserve-project-only semantics of that pass
are untouched.

### R2 — prune treats the variant overlay as upstream (same version)

PRUNE REMOVED's `scripts/` category gains
`templates/<variant>/scripts` in `tplDirs` (filtered by existsSync —
identity-separated projects may lack a variant template). The existing recursive
`walkTs` then marks variant-overlay scripts as template-side, so the loop's
`tplRels.has(rel)` guard keeps them before any retirement verdict is reached.
The agents/ and skills/ categories are unchanged (they already consult variant
trees per v1.22.1/v1.35.0/v1.66.0).

### R3 — operator protocol (no code): wave helpers must snapshot pre-existing dirt

T-20261108-008 item (2) traced the restore-loss not to dev-sync (which has no
failure-time wipe) but to operator wave helpers running
`git reset --hard` + `git clean -fdq` at project switch. Protocol going forward
(recorded here; the 11-08 wave already followed it after the incident): a wave
helper captures `git stash list` + `git status --porcelain` output BEFORE any
reset/clean, and refuses to clean when pre-existing modified/untracked paths are
present unless they are exactly the delivery's own state (`.claude/last-upgrade-*`,
`docs/VERSION_MANIFEST.md` regen output). Pre-existing local work is never
wiped by a helper; it is reported and skipped.

## 3. Verification

- Unit: `tests/unit/upgrade-variant-scripts.test.ts` — (a) the prune category's
  `tplDirs` includes the variant scripts dir when present; (b) a
  variant-overlay relative path present in the project is NOT classified as a
  retired delivery when it exists under the variant template (guarded via
  `scriptIsRetiredDelivery` semantics through the tplRels guard — tested at the
  category level via the exported helper surfaces where available).
- Live: `upgrade-project Projects/co-abap --dry-run` shows no `PRUNE  scripts/sap-*`
  rows after the fix (with the files present on main); `upgrade-project
  Projects/co-work --dry-run` shows the deck adapter as OK (already landed
  manually — no re-delivery).
- The full root unit suite must stay green (3,580+ tests).

## 4. Out of scope

- The 29 co-newbiz Biome residuals (T-20261108-009 — human lint-policy
  adjudication; the delivery-enumeration fix does not change which files
  co-newbiz receives).
- A generic "variant scripts subdirectories" policy for NEW claim types —
  any future top-level dir still routes through resolveClaim's KNOWN_TOP_DIRS
  branch; this design only completes the existing scripts/ claim's enumeration.
