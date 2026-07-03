# co-develop — Template Lifecycle

## Created

2026-06-09

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-09 | - | review | Initial creation — development variant | pm |
| 2026-06-13 | review | production | Beta → stable promotion | auditor |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 6 development agents present (architect, code-writer, designer, security-monitor, stack-setup, test-runner)
- [x] All 3 development skills present (code-review, refactoring, test-driven-development)
- [x] inherits_common correctly points to templates/common
- [x] Pipeline order documented: architect → designer → stack-setup → code-writer → test-runner → security-monitor
- [x] Optional agents (designer, stack-setup) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — development)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-07-03
- **Last Reviewer**: lifecycle-manager
