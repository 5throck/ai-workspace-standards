# co-news — Template Lifecycle

## Created

2026-08-10

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-10 | - | review | Initial creation — business/finance journalism variant | pm |
| 2026-09-10 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |

## Summary

Business/finance journalism variant for economics reporters covering listed companies. Synthesizes regulator financial disclosures (DART via the k-dart skill) and commercial-law research (k-law) under the KR country profile into fact-checked articles with financial infographics, for readers including listed-company IR staff, CFOs/executives, and PE/VC/bank finance professionals.

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 6 newsroom agents present (fact-checker, financial-analyst, legal-researcher, reporter, style-editor, visual-editor)
- [x] All 6 journalism skills present (ai-tell-reduction, financial-infographic-svg, financial-journalism-style, financial-narrative-brief, source-verification-ledger, style-lint-checklist)
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

- **Type**: Template (L2 Variant — journalism)
- **Current Phase**: review
- **Version**: 0.1.0
- **Owner**: pm
- **Last Updated**: 2026-09-10
- **Last Reviewer**: lifecycle-manager
