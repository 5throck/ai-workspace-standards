# Design: docs/ Folder Manifest and Anti-Proliferation Gate

- **Spec id**: `2026-10-04-docs-folder-manifest-design`
- **Date**: 2026-10-04
- **Status**: Implemented
- **Related**: `docs/README.md` (new manifest), `scripts/validate-doc-folder.ts` 1.2.0, `scripts/audit.ts` 2.48.0, `docs/index.md`, ADR-0069 (L1 docs independence), ADR-0090 (thin dispatchers)

## Problem

The user review flagged two issues: (1) `docs/` had grown to 30+ top-level entries with
no recorded criterion for what a folder is for or when a new one may appear —
`audits/`, `examples/`, `specs/`, `superpowers/`, `architecture/`, `archive/` among
them; (2) stray files accrete (a scratch `.test-extends-validator-temp/` sat at the
workspace root; an unmanifested root file surfaced the moment an allowlist was
drafted). Also verified at the user's request: the LLM-Interaction-Standard
consolidation IS reflected in ADR-0098, the design doc addenda, CONSTITUTION,
AGENTS.md, and docs/index.md (a standards-folder index entry was the one missing
piece — added).

## Survey result (what was cleaned vs kept)

- **Removed**: `.test-extends-validator-temp/` — untracked scratch left by
  `scripts/test-extends-validator.ts` (gitignored by the `/*/` rule; the script
  unlinks its files but keeps the dir).
- **Kept after reference checks** (each is convention- or code-backed, NOT clutter):
  `docs/audits/` (recorded convention: design 2026-09-08-project-review-v1.2 persists
  audit-flavored reports there; CHANGELOG cites the 2026-08-25 file twice),
  `docs/architecture/extends-pattern.md` (validate-templates C-SK-02 fix hints name
  it), `docs/graph-deltas/` (ADR-0084 §5.4 writer), `docs/superpowers/` (legacy
  provenance; ticket-system code comments cite its spec), `docs/specs/registry.json`
  (Design Gate), `docs/evidence/ledger.md` (validate-decisions),
  `docs/examples/runner-config.json` (self-describing committed defaults for the
  unattended runners). `docs/variant-benchmark-backlog.md` (all rows Done) stays at
  root for its roadmap cross-reference and joins the allowlist.
- **`tests/` verdict**: required infrastructure — 153 CI-run test files plus
  `fixtures/`, `helpers/`, `procedures-fixtures/`; no junk found inside.

## Decisions

1. **Manifest as human SSOT** (`docs/README.md`): a row per top-level entry
   (purpose / belongs / does-not-belong), a default-homes decision table, and the
   creation criteria — a new top-level folder requires ALL of a manifest row, a
   decision reference (ADR or spec-registered design), and an allowlist entry.
2. **Machine gate** (`validate-doc-folder.ts` 1.2.0 `--workspace`): every `docs/`
   top-level directory and loose file must be allowlisted (`ALLOWED_DIRS` /
   `ALLOWED_ROOT_FILES`); unknown entries FAIL with the remediation text. Default
   (project) mode is unchanged. Wired into `audit.ts` 2.48.0 as an existsSync-guarded
   spawn next to the doc-command lint, so pre-push and CI both enforce it.
3. **No mass physical reorganization.** Reference checks showed the "fragmented"
   folders are deliberate, recorded homes; moving them would churn links, validators,
   and CHANGELOG provenance for no behavioral gain. The manifest documents the
   structure; the gate prevents future sprawl. `superpowers/` is explicitly marked
   LEGACY-frozen in the manifest (new content goes to `designs/`).
4. **No dedicated unit test for the gate**: the audit spawn IS the enforcement path
   (a duplicate subprocess test against the real tree would only re-assert the
   allowlist twice).

## Non-goals

- Moving the root-level guide files into a `guides/` folder (link churn across
  README/index/roadmap outweighs the tidiness gain; they are allowlisted and
  indexed).
- Enforcing per-subfolder naming inside `designs/` etc. (already governed by the
  Design Gate and spec-register).
