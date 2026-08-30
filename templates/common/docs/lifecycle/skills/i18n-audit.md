# I18N Audit Skill Lifecycle

## Created

2026-08-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-29 | - | production | Common `i18n-audit` skill created (generalized from the co-price specialization) as part of the I18N audit consolidation (`reledgev` design) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `templates/common/skills/i18n-audit/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: i18n audit, locale parity, translation parity, glossary audit, L10N parity
- [x] co-price `i18n-audit` re-anchored as a variant specialization of this common base (v2.1.0)
- [x] `i18n-specialist` agent routing table and `required_skills` updated
