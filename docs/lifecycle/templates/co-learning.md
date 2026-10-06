# co-learning — Template Lifecycle

## Created

2026-10-06

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-10-06 | - | review | Initial creation — education/learning operations variant (exam-bank operations); beta-first admission per ADR-0099 §5 (no migration fast-track) | pm |

## Summary

Education and learning operations variant centered on exam-bank operations (skills/exam-bank-operations), with an i18n-specialist agent and KO-facing education workflows. Registered as variant type `learning` (variant-type-registry v1.2.0) and added by PR #1438; source lineage documented in the skill lifecycle record (origin Projects/co-develop 2026-09-07, fleet-sync deletion 43dc0c4, restoration 2026-10-06).

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema (status beta, version 0.1.0)
- [x] Variant Readiness Gate: READY — 0 errors, 0 warnings (verified 2026-10-07)
- [x] All agent/skill file paths resolve, including agents/i18n-specialist extends to ../../common/agents/i18n-specialist.md
- [x] Five-mirror parity verified for skills/exam-bank-operations (.claude/.gemini/.codex/.agents/.hermes md5-identical)
- [x] Registration touchpoints complete: variant-type-registry, validation-policy, propagation-map, templates/README, root README, common.lifecycle.json (commit 89b39266)
- [x] PROMOTION_CHECKLIST states Current Status: beta with all 10 criteria honestly Pending (verified 2026-10-07 Slot A)
- [ ] Stable promotion pending — beta-first path per ADR-0099 §5

### Production Phase

- [ ] All review phase criteria met
- [ ] Successfully tested in real scenario
- [ ] Documentation complete
- [ ] No known critical bugs

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — education/learning operations)
- **Current Phase**: review (variant.json status: beta)
- **Version**: 0.1.0
- **Owner**: pm
- **Last Updated**: 2026-10-07
- **Last Reviewer**: pm
