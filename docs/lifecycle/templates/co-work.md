# co-work — Template Lifecycle

## Created

2026-05-28

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-28 | - | production | Initial creation — collaboration variant | pm |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-09-28 | production | production | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 6 collaboration agents present (analyst, content-writer, ms365-expert, project-coordinator, storyteller, technical-writer)
- [x] All 3 collaboration skills present (api-documentation, documentation-writing, research-analysis)
- [x] inherits_common correctly points to templates/common
- [x] Optional agents (ms365-expert, storyteller) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — collaboration)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-09-28
- **Last Reviewer**: governance-ticket-runner
