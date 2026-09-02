# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] 2026-09-01

- docs: design-foundation.md §2b — design process pipeline (principles→tokens→style guide→icons→components→patterns→screens) and design-phase gate; style-neutral (ADR-0066)
- docs/_templates: design-review-checklist-template.md added
- skills: k-dart 2.0.0 → 2.1.0 — corp_code fallback chain with company.json cross-validation, financial account normalization + summation integrity checks, CFS→BFS fallback, disclosure search presets, shareholder signal, source-document text extraction, shared fetch gate (concurrency/backoff/daily budget)


## [Unreleased]

### Added
- `k-kosis` skill (Korean Statistical Information Service / KOSIS OpenAPI) — promoted from `co-pitch/skills/k-kosis`, registered in `skills/SKILLS.md` (scope: common, l2_propagate).

### Changed
### Fixed
- `agents/pm.md` — removed the 5-line `lifecycle:` frontmatter block (L0-only field, forbidden in L1 by `audit.ts`'s L1 pm.md check). Pre-existing defect left on main since #605; surfaced as a blocking FAIL during the co-hr promotion gate and cleared under that PR (single-root-PR pattern per #605 precedent). Restores ADR-0033 extends-pattern conformance; no other content touched.
### Removed
