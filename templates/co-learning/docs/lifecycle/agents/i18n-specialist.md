# I18N Specialist Agent Lifecycle

## Created

2026-08-24

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-24 | - | production | Common agent established — locale documentation, translation zones, language-policy enforcement | pm |
| 2026-09-21 | production | production | Governance record backfilled during the lifecycle modernization wave (T-20260921-005): the agent shipped in every scaffold via templates/common/agents/ but carried no workspace record, and variant AGENTS.md rosters now register it | pm |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: locale documentation, translation zones, language-policy enforcement (Korean plain-language, `순우리말`-first)
- [x] Tier assignment: Medium-tier across platforms
- [x] Delivered via templates/common/agents/ to every scaffolded project
- [x] Registered in variant AGENTS.md §1 rosters (13 variants, 2026-09-21)
- [x] Ownership: i18n-* common skills are owned by pm; i18n-specialist is the dispatch executor

## Dependencies

- `docs/workspace-schema.json` → `i18n.locale_codes` (recognized locale list)
- Language Policy (workspace AGENTS.md, COMMON-AGENTS block)

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Tier**: Medium
- **Last Updated**: 2026-09-21
- **Last Reviewer**: pm
