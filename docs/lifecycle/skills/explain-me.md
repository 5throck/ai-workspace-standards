# Explain-Me Skill — Lifecycle Record

## Metadata
- **Skill**: explain-me
- **Status**: experimental
- **Version**: 1.0.0
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Turn a topic or your own materials into a single self-contained, interactive HTML report with top tabs, clickable reference drawers, dense tables, comparison heatmaps, inline SVG, in-page search, a light/dark theme toggle, and multilingual support. Inspired by beret21/reportme.

## Changelog
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)

## Dependencies
- Python 3 (for validate_report.py)
- git + gh (for optional publish)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/explain-me/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: common
- [x] Attribution: MIT, inspired by beret21/reportme

## Notes
- Propagates to L2 variants (`l2_propagate: true`)
- Owner: pm
- Status is experimental per SKILL.md
