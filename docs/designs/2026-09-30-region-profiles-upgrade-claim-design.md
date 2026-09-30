# Region-Profiles Upgrade Claim and Delivery Pass — Design

- **Date**: 2026-09-30
- **Status**: implemented
- **Spec id**: `2026-09-30-region-profiles-upgrade-claim-design`
- **Owner**: automation-engineer (dispatched for T-20260927-010, follow-up of T-20260927-009 delivery-path design)
- **Related**: ADR-0091 (R2 project deltas, R3 declarations), T-20260924-011 (procedures/** clobber class, v1.48.0 pass-identity filter), `scripts/lib/upgrade-policy.ts` v1.19.0, `scripts/upgrade-project.ts` v1.59.0

## R1 — Problem

`templates/co-price/region-profiles/**` (KR.yaml, _schema.yaml, _validate.ts — the
ADR-0091 structured regulatory layer) had no dedicated upgrade claim: the
`resolveClaim` fallthrough assigned unknown top dirs plain `SYNC` on the VARIANT
ASSET DIRS pass, so every future upgrade would overwrite project-customized
profile deltas (Tooling & Skill Mapping, maintainer fields — ADR-0091 R2) with
the template seed — the same clobber class as procedures/** (T-20260924-011).
Today the co-price copy is byte-identical, so nothing has been lost yet; the fix
is preventive.

Fleet reality check (2026-09-30): five projects carry `region-profiles/`
(co-price, co-newbiz, co-consult, co-export, co-safety), but only co-price's
template ships the corpus — the other four are project-local creations with no
template counterpart (co-newbiz: CN/EU/KR/SEA/US). Only co-price is exposed to
the clobber class; the claim protects the whole class.

## R2 — Decision

1. **Claim (upgrade-policy v1.19.0, L0 + L1 mirror):** `region-profiles/**`
   claims `ADD_IF_MISSING` on a new dedicated pass id `REGION PROFILES`
   (`REGION_PROFILES_PASS`), placed next to the procedures rule and ahead of the
   platform-mirror blanket rules. Delivered once; never overwritten afterwards.
2. **Delivery pass (upgrade-project v1.59.0, L0-only engine):** new
   `REGION PROFILES SYNC (add-if-missing)` block after PROCEDURES SYNC — per-FILE
   add-if-missing from `templates/<variant>/region-profiles/` (the corpus is flat
   files; variant template is the only source — no common counterpart). Existing
   project files print `OK (project-owned — preserved)`. Note: `templatesDir` in
   upgrade-project is already the variant template dir — a first-cut
   `join(templatesDir, variant, 'region-profiles')` double-path bug was caught
   by the dry-run matrix NEW-path probe and fixed.
3. **Scaffold wiring (new-project.ts):** no code change needed — the variant
   overlay (walkFiles over templates/<variant> with only the
   SCAFFOLD_COMMON_OWNED_FILES / SKILLS.md skips) already delivers
   region-profiles/** at scaffold; verified by reading the copy path
   (new-project.ts "Copying variant templates…" pass).
4. **ADR-0073 Amendment 1 boundary kept:** upgrade-project.ts stays L0-only —
   the engine mirror `templates/common/scripts/upgrade-project.ts` was removed
   in e9eff16a (v1.44.0) and is NOT re-created; only the policy lib mirror
   (`lib/upgrade-policy.ts`, classified L0+L1) updates in lockstep.

## R3 — Rejected Alternatives

| Alternative | Reason for rejection |
|---|---|
| Keep plain SYNC with a conflict warning | The warning still ends in an overwrite; project profile deltas are deliberate (ADR-0091 R2), so SYNC is the wrong policy regardless of warning quality. |
| MERGE_MANAGED on KR.yaml | Profile files have no managed-block grammar; a merge would fabricate structure where the intended model is "first delivery wins, project owns it after". |
| VERSIONED_SYNC footer scheme | Region YAML carries provenance frontmatter, not version footers; retrofitting footers changes the corpus format for a delivery problem the claim already solves. |

## R4 — Verification

- Unit: `tests/unit/variant-asset-claim-collision.test.ts` — the fleet static
  guard now asserts region-profiles/** resolves to REGION PROFILES (exact set:
  co-price's three files) and a no-under-claim walk for the dir; upgrade test
  family 90 pass / 0 fail.
- Coverage: `bun scripts/check-upgrade-coverage.ts --strict` — no violations.
- Dry-run matrix (`bun scripts/upgrade-project.ts Projects/<p> --dry-run`):
  - co-price: asset-dirs `SKIPPED (claim) region-profiles/ — 3 file(s)`; pass
    prints per-file `OK (project-owned — preserved)`; with KR.yaml temporarily
    absent, `NEW region-profiles/KR.yaml` (dry run makes no writes; file
    restored, 0 dirty).
  - co-newbiz (project-local corpus, no template source) and
    co-work/co-safety/co-export/co-consult: `already in sync`.
- Gates: verify-scripts green at L0 (206) and L1 (134); typecheck at baseline.

## R5 — Out of Scope

- Roster/backfill of the project-local region-profiles corpora (co-newbiz's
  five profiles etc.) into templates — a template-content decision, not a
  delivery fix.
- Region-neutral scaffold pruning of region-profiles (the
  country_scoped_assets registry has no region-profiles entries today); revisit
  only if a variant ships profiles for jurisdictions it does not support.
