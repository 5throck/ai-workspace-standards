# co-export — Template Lifecycle

## Created

2026-08-09

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-09 | - | beta | Initial creation — import/export trade consulting variant | pm |

## Acceptance Criteria

### Beta Phase

- [x] variant.json exists with valid schema
- [x] All 9 export agents present (customs-duty-drawback-specialist, export-control-compliance-specialist, foreign-regulatory-intelligence-analyst, fta-origin-analyst, hs-classification-specialist, logistics-coordinator, market-entry-strategist, pm, trade-documentation-specialist)
- [x] All 8 domain export skills present (customs-duty-drawback-workflow, export-control-screening, foreign-regulation-monitoring, fta-origin-determination, hs-classification-workflow, logistics-coordination, market-entry-strategy, trade-documentation-checklist), plus 2 inherited platform/common skills available under `.claude/skills/`, `.gemini/skills/` (gateguard, sync) — not domain-specific export skills
- [x] inherits_common correctly points to templates/common
- [x] Engagement methodology and deliverable template documented in variant.json
- [ ] Stable promotion criteria met (beta age, engagements, bugs)

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — consulting)
- **Current Phase**: beta
- **Owner**: pm
- **Last Updated**: 2026-08-09
- **Last Reviewer**: lifecycle-manager
