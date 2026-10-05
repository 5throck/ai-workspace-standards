# co-develop — Template Lifecycle

## Created

2026-06-09

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-06-09 | - | review | Initial creation — development variant | pm |
| 2026-06-13 | review | production | Beta → stable promotion | auditor |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-08-29 | production | production | swe-solve re-scoped common → co-develop (skill became variant-exclusive at 1.1.1, 5-stage pipeline; common copy removed per DEC-20260829-02) | pm |
| 2026-09-21 | production | production | i18n-specialist agent registered in the variant roster (common extends-stub; lifecycle modernization wave T-20260921-005) | pm |
| 2026-09-28 | production | production | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |
| 2026-10-06 | production | production | Stable admission ratified per ADR-0099 (migration fast-track); criteria 6/8/10 waived, remainder verified in the 2026-10-05 scoped review — see PROMOTION_CHECKLIST.md Review History | pm |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 8 agents present (architect, code-writer, designer, i18n-specialist, pm, security-monitor, stack-setup, test-runner)
- [x] All 4 skills present (code-review, refactoring, swe-solve, test-driven-development)
- [x] inherits_common correctly points to templates/common
- [x] Pipeline order documented: architect → designer → stack-setup → code-writer → test-runner → security-monitor
- [x] Optional agents (designer, stack-setup) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — development)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-10-06
- **Last Reviewer**: pm
