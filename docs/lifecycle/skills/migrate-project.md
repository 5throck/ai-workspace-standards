# Migrate-Project Skill — Lifecycle Record

## Metadata
- **Skill**: migrate-project
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-09-23
- **Last Updated**: 2026-09-23 (Version 1.0.0: initial — end-to-end migration flow wrapping adopt-project with verification, spec `2026-09-23-adopt-project-conversion-design`)

## Description
End-to-end migration of an external project into the workspace standard:
ensures the GitHub baseline, runs `adopt-project`, and verifies the migration
landed correctly (structure, hooks, audits). Use for legacy/external projects
that need the full project-migration flow rather than bare adoption.
Operator-level skill (workspace root); `l2_propagate: false`. Owner:
scaffolding-expert.

## Changelog
- 2026-09-23: 1.0.0 — created alongside adopt-project (spec docs/designs/2026-09-23-adopt-project-conversion-design.md)

## Dependencies
- Wraps `adopt-project`; verifies with the workspace audit battery

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-23 | - | active | Created with the skill (wraps adopt-project with verification) | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/migrate-project/SKILL.md`
- [x] Frontmatter valid; scope: common; l2_propagate: false
- [x] Registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
- [x] Verification gate encoded (migration verified before reporting success)
