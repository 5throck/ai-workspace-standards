# AGPL-3.0 License Rollout Across Variant Templates

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted (user-approved integrated roadmap, PR3) |
| Spec ID | `license` |
| Governing anchor | Workspace root LICENSE (AGPL-3.0, adopted 2026-05-23 per CHANGELOG) |
| Related | `docs/designs/2026-08-28-codegraph-removal-design.md` (#742); `docs/designs/2026-08-28-project-template-backport-design.md` (#743); ADR-0031 (fork model) |

## Problem

The workspace root has been AGPL-3.0 since 2026-05-23, but the license does not flow to
what gets built from the templates:

- Of 13 variant templates, only `templates/co-price` ships a `LICENSE` (a manual,
  co-price-specific copy: AGPL-3.0 plus a commercial-licensing appendix, with an
  unfilled copyright placeholder).
- `templates/common/README.md`'s License section still said `[License name] - see
  [LICENSE](LICENSE)` (and the KO mirror `[라이선스 이름]`), so every scaffolded project
  README either pointed at a non-existent file or carried a placeholder.
- `upgrade-project.ts` had **no pass that handles top-level files**: LOCKED/MERGE/
  DOCS_*/VARIANT_DOCS_SYNC/SYNC_IF_NEWER are path-specific, and the VARIANT ASSET DIRS
  SYNC pass only discovers directories — a `LICENSE` present in the template fell
  through every pass and could never reach an already-scaffolded project.
- `reconcile-with-l0-l1.ts` (L3→variant promotion) discards files whose content is
  identical to L0/L1 — an identical LICENSE would be silently stripped from any
  regenerated variant, undoing this rollout on the next promotion.

User-confirmed decisions (roadmap Q&A): ship the root LICENSE verbatim (standard
AGPL-3.0 full text) to `templates/common/` + all variant templates; keep co-price's
custom license untouched; make both pipelines license-safe.

## Change Design

### D1 — License file placement

Copy the root `LICENSE` (standard AGPL-3.0 text, 662 lines) verbatim to:

- `templates/common/LICENSE` — the scaffold source: `new-project.ts` uses default-
  include/explicit-exclude, so scaffolds pick it up automatically; and
- 12 variant templates: co-abap, co-consult, co-deck, co-design, co-develop,
  co-export, co-game, co-hr, co-news, co-safety, co-security, co-work.

`templates/co-price/LICENSE` is NOT touched (custom commercial appendix is a
deliberate co-price decision and its project copy must stay byte-identical).

### D2 — README license sections

- `templates/common/README.md`: `[License name] - see [LICENSE](LICENSE)` →
  `GNU Affero General Public License v3.0 (AGPL-3.0) - see [LICENSE](LICENSE)`.
- `templates/common/README_ko.md`: `[라이선스 이름] - [LICENSE](LICENSE) 파일 참조` →
  `GNU Affero General Public License v3.0 (AGPL-3.0) - [LICENSE](LICENSE) 파일 참조`.
- `content_hash` refreshed via `verify-readme-sync.ts --update-hashes`; verification
  passes (13/13).

### D3 — `upgrade-project.ts` v1.11.0 → v1.12.0: GOVERNANCE FILES SYNC pass

New pass inserted between VARIANT ASSET DIRS SYNC and COUNTRY-SCOPED SKILL PRUNE:

- File list: `GOVERNANCE_FILES = ['LICENSE']` (extensible; SECURITY.md/NOTICES
  candidates would go here too, but are already handled elsewhere today).
- Source resolution: variant template first (`templates/<variant>/LICENSE`), then
  `templates/common/LICENSE` — matching scaffold composition order.
- Semantics: **add-if-missing only**. A project that already has the file keeps it
  (`OK (project-owned — preserved)`); no overwrite, no hash comparison, no conflict
  path. Rationale: licenses are intentionally forkable — co-price carries a commercial
  appendix, co-safety's project copy has a filled-in copyright line; an upgrade must
  never clobber either.

### D4 — `reconcile-with-l0-l1.ts` v1.3.0 → v1.3.1: LICENSE preserve rule

In `reconcileFile()`, before the Case 2 identical→discard branch: a top-level
`LICENSE` classified `identical` now returns `keep` with reason "Governance artifact
(LICENSE) — variants must ship their own copy even when identical to L1". Modified
(non-identical) LICENSEs were already kept (no version headers → keep-for-review),
so the rule only changes the previously-lossy identical case.

### D5 — Version

`templates/VERSION` 0.5.3 → 0.6.0 (minor: new shipped template artifacts + upgrade
path support). Tag `template-v0.6.0` follows the release convention once merged.

## Registrations

| File | Change |
|------|--------|
| `LICENSE` → `templates/{common,co-abap,co-consult,co-deck,co-design,co-develop,co-export,co-game,co-hr,co-news,co-safety,co-security,co-work}/LICENSE` | added (verbatim copy) |
| `templates/common/README.md`, `templates/common/README_ko.md` | License section filled; content_hash refreshed |
| `scripts/upgrade-project.ts` | v1.12.0 — GOVERNANCE FILES SYNC pass |
| `scripts/helpers/reconcile-with-l0-l1.ts` | v1.3.1 — LICENSE preserve rule |
| `scripts/SCRIPTS.md` | both entries bumped + last-updated note |
| `templates/VERSION` | 0.5.3 → 0.6.0 |
| `docs/designs/2026-08-28-agpl-license-template-rollout-design.md` | added (this document) |
| `CHANGELOG.md`, `memory/2026-08-28.md` | entries |

## Verification

| Check | Expected |
|-------|----------|
| `ls templates/*/LICENSE` | 14 (13 templates + existing co-price) |
| `diff templates/common/LICENSE LICENSE` | identical |
| `verify-readme-sync.ts` | all pass (hash gate) |
| `bun scripts/upgrade-project.ts Projects/<p> --dry-run` | `GOVERNANCE FILES SYNC` section shows `NEW LICENSE` for projects lacking it, `OK (project-owned)` for co-price/co-safety |
| `bun scripts/lifecycle-sync-audit.ts` | all pass (version bumps registered) |
| `bun scripts/validate-templates.ts` | 0 errors |
| `bun scripts/audit.ts` | all checks passed |

## Out of Scope

- Filling the copyright placeholder in the root LICENSE text (kept verbatim from root).
- co-price license unification (its commercial appendix stands).
- Adding LICENSE sections to per-variant READMEs (co-abap already has one; others can
  follow their own release cadence — the LICENSE file itself is what ships).
- Project-side delivery (Phase 5 upgrade pass executes D3 for the 8 live projects).

## References

- Root license history: CHANGELOG 2026-05-23 (MIT → AGPL-3.0).
- upgrade-project file-category model: `scripts/upgrade-project.ts` header comments.
- Promotion reconcile model: `scripts/helpers/reconcile-with-l0-l1.ts` `reconcileFile()`.
