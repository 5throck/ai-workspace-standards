# co-design — Template Lifecycle

## Created

2026-05-28

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-28 | - | production | Initial creation — design/UX variant | pm |
| 2026-07-03 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-09-27 | production | production | Record refreshed (T-20260927-007): co-design scaffolded as a project 2026-09-25 (Projects/co-design) and template changed through the 09-26 ADR-0091 alignment (variant.json country_config R3 declaration); phase unchanged | governance-ticket-runner |
| 2026-10-06 | production | production | Record refreshed (ADR-0099 ratification wave): acceptance-criteria roster/skill counts and name lists reconciled to variant.json (adds pm and i18n-specialist to the agent list; adds accessibility-audit and token-usage-lint to the skills list); phase unchanged | pm |
| 2026-11-02 | production | production | Record refreshed (co-design stack conformance wave): acceptance-criteria skills list reconciled to variant.json skills[] (adds design-foundation and design-review); phase unchanged | pm |

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 9 design agents present (design-lead, i18n-specialist, pm, prototype-engineer, service-designer, storyteller, typography-expert, ux-researcher, visual-designer)
- [x] All 6 design skills present (accessibility-audit, design-foundation, design-review, service-design, token-usage-lint, ui-ux-design-intelligence)
- [x] inherits_common correctly points to templates/common
- [x] Optional agents (typography-expert, storyteller) documented

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — design)
- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-11-02
- **Last Reviewer**: pm
