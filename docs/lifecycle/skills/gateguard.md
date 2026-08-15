# Gateguard Skill — Lifecycle Record

## Metadata
- **Skill**: gateguard
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-08-16
- **Last Updated**: 2026-08-16

## Description
Pre-edit fact-forcing quality gate. Ensures agents investigate a file's importers, schemas, and scope constraints before making changes. Part of the 3-layer enforcement model (Hook -> Prompt -> Skill).

## Changelog
- 2026-08-16: Lifecycle document created from SKILL.md frontmatter (backfill)

## Dependencies
- Bun runtime
- `scripts/hooks/gateguard-fact-force.ts` — Hook layer implementation

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-16 | - | production | Backfilled lifecycle document from existing SKILL.md | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/gateguard/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Skill is registered in VERSION_MANIFEST.md
- [x] Scope: common

## Notes
- Propagates to L2 variants (`l2_propagate: true`)
- Owner: pm
- Specified in CONSTITUTION.md section 11.2
