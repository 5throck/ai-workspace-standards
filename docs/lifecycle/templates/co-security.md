# co-security — Template Lifecycle

## Created

2026-05-28

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-28 | - | review | Initial creation — security variant | pm |
| 2026-06-13 | review | production | 0.3.0 → 1.0.0 stable promotion | auditor |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 5 security agents present (patch-engineer, pentester, red-team-lead, report-writer, threat-modeler)
- [x] verify-authorization skill present
- [x] inherits_common correctly points to templates/common
- [x] Pipeline order documented: red-team-lead → threat-modeler → pentester → patch-engineer → report-writer
- [x] Optional agents (patch-engineer) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — security)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-07-03
- **Last Reviewer**: lifecycle-manager
