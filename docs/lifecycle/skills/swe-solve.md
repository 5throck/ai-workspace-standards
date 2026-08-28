# SWE-Solve Skill — Lifecycle Record

## Metadata
- **Skill**: swe-solve
- **Status**: active
- **Version**: 1.1.1
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-29

## Description
Autonomous 5-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation, pull-request synthesis, and resolution-trajectory logging.

## Changelog
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)
- 2026-08-29: Re-scoped `common` → `co-develop`. The skill had evolved to 1.1.1 (5-stage pipeline with trajectory record) inside `templates/co-develop/skills/` while the common copy remained at 1.0.0 (4-stage), shipping the stale version to every non-co-develop project. Registered in `variant_scoped_skills` (docs/workspace-schema.json 1.5.0); L1 common copy and platform mirrors removed; L0 dev copy aligned to co-develop 1.1.1 with scope: co-develop.

## Dependencies
- Bun runtime
- test-runner.ts

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/swe-solve/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: co-develop (variant-exclusive; registered in `variant_scoped_skills`)

## Notes
- Variant-exclusive skill (owner: co-develop) — reaches only co-develop projects via the variant overlay; other variants no longer receive the stale common copy
- Owner: pm
