# Simulate-L3-To-Variant-Promotion Skill — Lifecycle Record

## Metadata
- **Skill**: simulate-l3-to-variant-promotion
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Performs end-to-end (E2E) smoke testing of the L3 scaffold -> variant promotion pipeline (create-l3-scaffold.ts + l3-to-variant-pipeline.ts) to catch classification/parsing regressions before promotion.

## Changelog
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)

## Dependencies
- Bun (bun scripts/test-l3-to-variant-promotion.ts, per ADR-0036)
- `scripts/create-l3-scaffold.ts`
- `scripts/l3-to-variant-pipeline.ts`

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/simulate-l3-to-variant-promotion/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: workspace

## Notes
- Workspace-root only skill (no L2 propagation)
- Owner: automation-engineer
