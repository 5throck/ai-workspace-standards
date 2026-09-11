# co-safety — Template Lifecycle

## Created

2026-08-26

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-26 | - | review | Initial creation — EHS regulatory compliance variant (South Korea) | pm |
| 2026-09-10 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |

## Summary

EHS (Environmental Health & Safety) AI agent platform for South Korean regulatory compliance. Regulation-driven workflows (permit-to-work, risk assessment, chemical/PSM safety), industry profiles, and evidence models, with a KO routing glossary (docs/glossary/kr-safety-glossary.md, lang: ko declared) for Korean statute and keyword resolution via k-law queries.

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 2 agents present (safety-governance-manager, safety-workflow-manager)
- [x] All 60 safety skills present (permit-to-work, risk-assessment, chemical-risk-assessment, ghs-classifier, msds-parser, psm-loto, psm-moc, audit-preparation, compliance-gap, etc.)
- [x] inherits_common correctly points to templates/common
- [x] Variant skill scope declared (L0+L1+L2)
- [ ] Stable promotion pending — currently beta

### Production Phase

- [ ] All review phase criteria met
- [ ] Successfully tested in real scenario
- [ ] Documentation complete
- [ ] No known critical bugs

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — EHS compliance)
- **Current Phase**: review
- **Version**: 0.1.0
- **Owner**: pm
- **Last Updated**: 2026-09-10
- **Last Reviewer**: lifecycle-manager
