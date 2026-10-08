# co-consult — Template Lifecycle

## Created

2026-06-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-03 | - | production | Initial creation — consulting variant | pm |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-10-05 | production | production | Stable admission ratified per ADR-0099 (migration fast-track); criteria 6/8/10 waived, remainder verified in the 2026-10-05 scoped review — see PROMOTION_CHECKLIST.md Review History | pm |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 12 agents present (change-management-partner, communications-lead, data-analyst, delivery-manager, i18n-specialist, industry-expert, pm, sme, solutions-architect, strategy-analyst, technology-specialist, workstream-lead)
- [x] All 19 skills present
- [x] inherits_common correctly points to templates/common
- [x] Agent manifest with dispatch notes documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — consulting)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-10-09
- **Last Reviewer**: lifecycle-manager
