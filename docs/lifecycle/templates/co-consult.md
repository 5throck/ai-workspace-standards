# co-consult — Template Lifecycle

## Created

2026-06-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-03 | - | production | Initial creation — consulting variant | pm |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 11 consulting agents present (change-management-partner, communications-lead, data-analyst, delivery-manager, industry-expert, sme, solutions-architect, strategy-analyst, technology-specialist, workstream-lead)
- [x] All 15 consulting skills present
- [x] inherits_common correctly points to templates/common
- [x] Agent manifest with dispatch notes documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — consulting)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-07-03
- **Last Reviewer**: lifecycle-manager
