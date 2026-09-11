# co-hr — Template Lifecycle

## Created

2026-08-22

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-22 | - | review | Initial creation — HR & labor relations consulting variant | pm |
| 2026-09-10 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |

## Summary

HR & Labor Relations multi-agent team covering labor-law compliance via per-jurisdiction country profiles (docs/countries/), HRM/HRD consulting, org design, and change management. Uses country-profile promotion standards; roster spans compensation, labor relations, learning & development, talent acquisition, and safety & health.

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 11 agents present (career-succession-consultant, change-management-partner, compensation-benefits-analyst, data-analyst, labor-compliance-analyst, labor-relations-specialist, learning-development-specialist, org-design-consultant, performance-management-consultant, safety-health-officer, talent-acquisition-specialist)
- [x] All 12 HR skills present (competency-modeling, hr-metrics-analysis with ISO 30414 taxonomy mapping, labor-compliance-audit, org-design-framework, etc.)
- [x] inherits_common correctly points to templates/common
- [ ] Stable promotion pending — currently beta

### Production Phase

- [ ] All review phase criteria met
- [ ] Successfully tested in real scenario
- [ ] Documentation complete
- [ ] No known critical bugs

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — HR & labor relations)
- **Current Phase**: review
- **Version**: 0.1.0
- **Owner**: pm
- **Last Updated**: 2026-09-10
- **Last Reviewer**: lifecycle-manager
