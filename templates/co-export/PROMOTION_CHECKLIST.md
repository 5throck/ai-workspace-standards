# Co-Export Promotion Checklist

**Variant:** co-export
**Current Status:** beta (v0.1.0)
**Beta Since:** 2026-08-08
**Phase A Complete:** true

## Phase A Completion (prerequisite for promotion eligibility)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| A1 | **Agent manifest complete** | ✅ Verified | 10 agents defined in variant.json; all 10 agent `.md` files contain substantive domain-specific content (1,706 total lines). Zero TODO stubs or placeholders. |
| A2 | **Skill manifest complete** | ✅ Verified | 9 variant-specific skills defined; all 9 SKILL.md files have complete frontmatter (name, version, scope, status, owner, prerequisites, last_reviewed) and substantive body content (74–94 lines each). variant.json and disk directories match exactly. |
| A3 | **Agent files substantive** | ✅ Verified | pm.md has substantive variant_overrides (111 lines) with governance-workflow, agent-roster, and dispatch-protocol. All 9 specialist agents have full sections: Legal Basis, Role, Responsibilities, Protocols, Constraints, Meeting Participation, Engagement Context, Deliverable Standards, Special Instructions. |
| A4 | **Documentation complete** | ✅ Verified | README.md present with accurate 10-agent/9-skill roster; context.md complete with domain-specific guidelines; AGENTS.md reflects actual roster; variant.json fields accurate. |
| A5 | **Engagement methodology documented** | ✅ Verified | 4-phase delivery methodology documented in pm.md variant_overrides dispatch-protocol: Phase 1 (regulatory intelligence), Phase 2 (compliance cross-check with client sign-off gate), Phase 3 (market-entry refinement), Phase 4 (logistics/drawback). |
| A6 | **Deliverable templates defined** | ✅ Verified | Deliverable Standards sections present in all specialist agent files. Document types include Classification Memorandum, FTA Origin Analysis Report, Export Control Screening Certificate, Drawback Filing Package, L/C Documentation Package, Market Entry Recommendation, etc. |
| A7 | **Audit passes** | ✅ Verified | `bun scripts/audit.ts` passes with 0 errors (3 pre-existing beta variant warnings unrelated to co-export). |

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

## Country-Profile Readiness (KR profile shipped)

| Check | Description | Status |
|-------|-------------|--------|
| `country_config` valid | `country_config` declares `supported: ["KR"]` with `default: null` (region-neutral default); `docs/countries/KR.md` exists with frontmatter `code: KR` | ✅ Verified |
| Scoped assets registered | Country-specific assets (k-law skill, `LAW_API_OC` env key) are registered in `country_scoped_assets` in both schema copies; no variant-local forks of registry-governed scoped skills in `skills/` | ✅ Verified |
| Region-neutral default intact | Docs and agents anchor to a jurisdiction only via the active country profile or explicit `(KR: ...)`/`(KR profile)` markers; no hardcoded target-jurisdiction assumptions in default paths | ✅ Verified |

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
