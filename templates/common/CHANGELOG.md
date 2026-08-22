# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- `k-kosis` skill (Korean Statistical Information Service / KOSIS OpenAPI) — promoted from `co-pitch/skills/k-kosis`, registered in `skills/SKILLS.md` (scope: common, l2_propagate).

### Changed
### Fixed
- `agents/pm.md` — removed the 5-line `lifecycle:` frontmatter block (L0-only field, forbidden in L1 by `audit.ts`'s L1 pm.md check). Pre-existing defect left on main since #605; surfaced as a blocking FAIL during the co-hr promotion gate and cleared under that PR (single-root-PR pattern per #605 precedent). Restores ADR-0033 extends-pattern conformance; no other content touched.
### Removed
