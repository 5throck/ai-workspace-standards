# co-abap — Template Lifecycle

## Created

2026-08-15

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-08-15 | - | production | Initial creation — SAP ABAP development variant (migrated from co-abap project, stable at 1.0.0) | pm |
| 2026-09-10 | production | production | Lifecycle record created (retroactive) | lifecycle-manager |
| 2026-09-28 | production | production | Record refreshed (T-20260927-013): ADR-0091 R3 uniform country_config declaration delivered to variant.json (commit 6551e7c7, 2026-09-27, T-20260927-002); phase unchanged | governance-ticket-runner |
| 2026-10-05 | production | production | Record refreshed (T-20261005-025): roster count corrected 20 → 21 with i18n-specialist named (roster-surface reconciliation); pm lifecycle record backfilled variant-locally; phase unchanged | pm |
| 2026-10-05 | production | production | Stable admission ratified per ADR-0099 (migration fast-track); criteria 6/8/10 waived, remainder verified in the 2026-10-05 scoped review — see PROMOTION_CHECKLIST.md Review History | pm |

## Summary

AI-assisted SAP ABAP development harness using the vsp MCP server (ADT REST APIs to SAP NetWeaver). PM-led multi-agent orchestration with specialized SAP module analysts (SD, MM, FI, CO, PP, LE), technical execution agents (architect, code-writer, QA, DBA), and ABAP-specific skills (post-write chain, performance tuning, dump monitoring).

## Acceptance Criteria

### Production Phase

- [x] variant.json exists with valid schema
- [x] All 21 agents present (architect, pm, i18n-specialist, co-analyst, code-writer, dba, devops-admin, fi-analyst, fiori-developer, form-expert, gui-scripter, interface-expert, le-analyst, mm-analyst, pp-analyst, read-only-analyst, sap-investigator, schema-inspector, sd-analyst, security-monitor, test-runner)
- [x] All 13 ABAP skills present (abap-code-review, abap-dev, dump-monitor, performance-tuning, post-write-chain, sap-co, sap-fi, sap-le, sap-mm, sap-pp, sap-sd, etc.)
- [x] inherits_common correctly points to templates/common

## Dependencies

- templates/common (L1 common layer)

## Metadata

- **Type**: Template (L2 Variant — SAP ABAP development)
- **Current Phase**: production
- **Version**: 1.0.0
- **Owner**: pm
- **Last Updated**: 2026-10-05
- **Last Reviewer**: pm
