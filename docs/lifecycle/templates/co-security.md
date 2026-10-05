# co-security — Template Lifecycle

## Created

2026-05-28

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-28 | - | review | Initial creation — security variant | pm |
| 2026-06-13 | review | production | 0.3.0 → 1.0.0 stable promotion | auditor |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-09-28 | production | production | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |
| 2026-10-06 | production | production | Record refreshed: roster reconciled to 7 agents (pm, i18n-specialist added); PROMOTION_CHECKLIST ratified per ADR-0099 (migration fast-track; short-window promotion 2026-05-28 → 2026-06-13; beta-window criteria 6/8/10 waived); validate-variant-claims PASS 0 findings; phase unchanged | pm |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 7 agents present (i18n-specialist, patch-engineer, pentester, pm, red-team-lead, report-writer, threat-modeler)
- [x] verify-authorization skill present
- [x] inherits_common correctly points to templates/common
- [x] Pipeline order documented: red-team-lead → threat-modeler → pentester → patch-engineer → report-writer
- [x] Optional agents (patch-engineer) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — security)
- **Current Phase**: production
- **Version**: 1.0.0
- **Owner**: pm
- **Last Updated**: 2026-10-06
- **Last Reviewer**: pm
