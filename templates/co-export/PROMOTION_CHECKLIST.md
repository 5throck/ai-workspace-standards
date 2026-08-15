# Co-Export Promotion Checklist

**Variant:** co-export
**Current Status:** beta (v0.1.0)
**Beta Since:** 2026-08-08
**Phase A Complete:** false

## Phase A Completion (prerequisite for promotion eligibility)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| A1 | **Agent manifest complete** | Pending | 10 agents defined in variant.json. Verify each agent file (`agents/*.md`) has substantive content (no TODO stubs). |
| A2 | **Skill manifest complete** | Pending | 9 variant-specific skills defined. Verify each SKILL.md is complete and operational. |
| A3 | **Agent files substantive** | Pending | PM pm.md currently minimal (no variant_overrides). Per agent_overrides, pm.md should include additive overrides for governance-workflow, agent-roster, and dispatch-protocol sections. All 9 specialist agent files must have non-placeholder content. |
| A4 | **Documentation complete** | Pending | README.md present and accurate; context.md complete with domain-specific guidelines; AGENTS.md reflects actual roster; variant.json fields accurate. |
| A5 | **Engagement methodology documented** | Pending | 4-phase delivery methodology documented (regulatory intelligence, compliance cross-check, market-entry refinement, logistics/drawback). |
| A6 | **Deliverable templates defined** | Pending | Standard deliverable templates per phase documented (Classification Memorandum, FTA Origin Analysis Report, Export Control Screening Certificate, etc.). |
| A7 | **Audit passes** | Pending | `bun scripts/audit.ts` passes with 0 errors. No deprecated scripts. |

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | Blocked | `phaseAComplete: false` in variant.json. Must complete Phase A checklist above first. |
| 2 | **Agent roster completeness** | Blocked | Depends on Phase A completion. |
| 3 | **Skills coverage** | Blocked | Depends on Phase A completion. |
| 4 | **Documentation completeness** | Blocked | Depends on Phase A completion. |
| 5 | **Audit pass rate** | Pending | `bun scripts/audit.ts` must pass with 0 errors. |
| 6 | **Real engagements** | Pending | Minimum 1 successful trade-consulting engagement (regulatory intelligence -> compliance -> market-entry -> logistics end-to-end). |
| 7 | **README accuracy** | Pending | README reflects current 10-agent roster, 9 skills, 4-phase methodology, and domain configuration. |
| 8 | **Minimum beta duration** | Pending | 3 months in beta status (earliest promotion: 2026-11-08). |
| 9 | **Zero unresolved bugs** | Pending | 0 open bug reports at promotion time. |
| 10 | **User feedback** | Pending | Positive feedback from beta users; no critical UX/functional complaints. |

## Domain-Specific Validation

| Check | Description | Status |
|-------|-------------|--------|
| HS classification | hs-classification-specialist produces correct HS codes with GRI reasoning | Pending |
| FTA origin determination | fta-origin-analyst applies WH/RVC/CTC criteria correctly | Pending |
| Export control screening | export-control-compliance-specialist screens against sanctions lists | Pending |
| Halal certification | halal-certification-specialist handles halal workflow end-to-end | Pending |
| Customs duty drawback | customs-duty-drawback-specialist produces valid drawback filing packages | Pending |
| Foreign regulation monitoring | foreign-regulatory-intelligence-analyst monitors target-market regulatory changes | Pending |
| Logistics coordination | logistics-coordinator applies Incoterms correctly and coordinates shipment | Pending |
| Trade documentation | trade-documentation-specialist produces complete documentation packages (invoice, packing list, COO, FTA certificate) | Pending |
| Market entry strategy | market-entry-strategist produces compliance-cost-integrated landed-cost models | Pending |
| 4-phase methodology | Client sign-off gates between each phase function correctly | Pending |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| | | | |
