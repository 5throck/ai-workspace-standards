# Handbook Skill Lifecycle

## Created

2026-09-21 (record backfill — the skill predates this record; active since at least 2026-09-20 per frontmatter `last_reviewed`)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-21 | (pre-record) | production | Record backfill — active skill without a lifecycle record (2026-09-21 project review H-9) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `templates/common/skills/handbook/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope (`common`), version, owner populated
- [x] L1-only asset — deliberately absent from workspace-root `skills/` (2026-09-12 root-upgrade incident rule)
- [x] Declared as `common_skills` in `docs/templates/common-contract.json`
- [x] Companion validation skill `handbook-sync-audit` has its own L0 record

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Version at record creation**: 0.6.0
- **Last Updated**: 2026-09-21
