# co-work — Template Lifecycle

## Created

2026-05-28

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-28 | - | production | Initial creation — collaboration variant | pm |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-09-28 | production | production | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |
| 2026-10-06 | production | production | Record refreshed (ADR-0099 ratification wave): acceptance-criteria roster/skill lists reconciled to variant.json (adds pm and i18n-specialist to the agent list; skills list corrected to the variant-specific manifest, common L1 skills noted separately); phase unchanged | pm |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 8 collaboration agents present (analyst, content-writer, i18n-specialist, ms365-expert, pm, project-coordinator, storyteller, technical-writer)
- [x] All 1 collaboration skill present (standup-synthesizer); api-documentation, documentation-writing, and research-analysis are common-inherited L1 skills, not variant-specific
- [x] inherits_common correctly points to templates/common
- [x] Optional agents (ms365-expert, storyteller) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — collaboration)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-10-06
- **Last Reviewer**: pm
