# co-price — Template Lifecycle

## Created

2026-08-25

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-25 | - | review | Initial creation — pricing management & consulting variant (converted from co-price project; template added 2026-08-28, PR #723) | pm |
| 2026-09-10 | review | review | Lifecycle record created (retroactive) | lifecycle-manager |

## Summary

Pricing management & consulting simulator variant. Multi-product, multi-channel pricing with double-entry P&L projection, benchmark diagnostics, market research analytics (Van Westendorp / Gabor-Granger), cost-shock sensitivity, and distribution trade-line management. 15-agent roster across five groups (engineering, audit, strategy, market intelligence, UX/security).

## Acceptance Criteria

### Review Phase

- [x] variant.json exists with valid schema
- [x] All 14 agents present (core-engine-dev, cost-asset-mgmt, cpa-auditor, devops-admin, engagement-director, finance-strategy-lead, l10n-auditor, lead-architect, market-intelligence-analyst, pricing-strategist, qa-tester, security-auditor, security-monitor, ux-specialist)
- [x] All 22 pricing/simulation skills present (van-westendorp-psm, gabor-granger, double-entry-reconciliation, cost-shock-analysis, price-waterfall-analysis, trade-promotion-roi, etc.)
- [x] inherits_common correctly points to templates/common
- [ ] Stable promotion pending — currently beta (Phase B conversion in progress; Phase C template promotion deferred until v10.1 feature phases land, per variant.json lifecycle notes)

### Production Phase

- [ ] All review phase criteria met
- [ ] Successfully tested in real scenario
- [ ] Documentation complete
- [ ] No known critical bugs

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — pricing consulting)
- **Current Phase**: review
- **Version**: 4.1.0
- **Owner**: pm
- **Last Updated**: 2026-09-10
- **Last Reviewer**: lifecycle-manager
