# Co-HR Promotion Checklist

**Variant:** co-hr
**Current Status:** beta (v0.1.0)
**Beta Since:** 2026-08-22
**Phase A Complete:** true

## Phase A Completion (prerequisite for promotion eligibility)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| A1 | **Agent manifest complete** | ✅ Verified | 11 agents defined in variant.json; all 11 agent `.md` files contain substantive domain-specific content (1,308 total lines). Zero TODO stubs or placeholders. |
| A2 | **Skill manifest complete** | ✅ Verified | 10 variant-specific skills defined; all 10 SKILL.md files have complete frontmatter (name, version, scope, status, owner, prerequisites, last_reviewed) and substantive body content. variant.json and disk directories match exactly. |
| A3 | **Agent files substantive** | ✅ Verified | pm.md carries variant_overrides for governance-workflow, agent-roster, and dispatch-protocol. All 11 specialist agents have full sections: Role, Responsibilities, Protocols (Dispatch Protocol, PM-ONLY INVOCATION), Output Format, Output Destination, Meeting Participation, Constraints. |
| A4 | **Documentation complete** | ✅ Verified | README.md present with accurate 11-agent/10-skill roster; context.md complete with domain-specific guidelines; AGENTS.md reflects actual roster; variant.json fields accurate; bilingual user guide (docs/user-guide.md + docs/user-guide_ko.md) present. |
| A5 | **Engagement methodology documented** | ✅ Verified | 4-phase engagement lifecycle documented in variant.json engagement_methodology and pm.md dispatch-protocol: Phase 0 (intake) -> Phase 1 (research & diagnosis) -> Phase 2 (design) -> Phase 3 (validation & delivery). |
| A6 | **Deliverable templates defined** | ✅ Verified | Output Format and Output Destination sections present in all specialist agent files, keyed to the 4-phase lifecycle (diagnosis reports, design deliverables, validation packages per domain). |
| A7 | **Audit passes** | ✅ Verified | `bun scripts/audit.ts` passes with 0 errors at beta entry; re-run required at promotion time (Criterion 5). |

## Country-Profile Readiness (KR profile shipped)

| Check | Description | Status |
|-------|-------------|--------|
| `country_config` valid | `country_config` declares `supported: ["KR"]` with `default: null` (region-neutral default); `docs/countries/KR.md` exists with frontmatter `code: KR` | ✅ Verified |
| Scoped assets registered | Country-specific assets (k-law skill, `LAW_API_OC` env key) are registered in `country_scoped_assets` in both schema copies; no variant-local forks of registry-governed scoped skills in `skills/` | ✅ Verified |
| Region-neutral default intact | Docs and agents anchor to a jurisdiction only via the active country profile or explicit `(KR: ...)`/`(KR profile)` markers; no hardcoded target-jurisdiction assumptions in default paths | ✅ Verified |

## Promotion Criteria (beta -> stable)

| # | Criterion | Status | Evidence / Notes |
|---|-----------|--------|-----------------|
| 1 | **Phase A complete** | ✅ Met | `phaseAComplete: true` in variant.json; Phase A checklist above verified. |
| 2 | **Agent roster completeness** | ✅ Met | 11 specialist agents with substantive files; roster documented in AGENTS.md and README.md. |
| 3 | **Skills coverage** | ✅ Met | 10 variant-specific skills with complete frontmatter and `used_by_agents`/`phases` mappings in variant.json. |
| 4 | **Documentation completeness** | ✅ Met | README.md, context.md, AGENTS.md, bilingual user guide, and variant.json all accurate. |
| 5 | **Audit pass rate** | Pending | `bun scripts/audit.ts` must pass with 0 errors at promotion time. |
| 6 | **Real engagements** | Pending | Minimum 1 successful HR/labor-relations engagement (Phase 0 intake -> research/diagnosis -> design -> validation/delivery end-to-end). |
| 7 | **README accuracy** | Pending | README reflects the current 11-agent roster, 10 skills, and 4-phase engagement lifecycle at promotion time. |
| 8 | **Minimum beta duration** | Pending | 3 months in beta status (earliest promotion: 2026-11-22). |
| 9 | **Zero unresolved bugs** | Pending | 0 open bug reports at promotion time. |
| 10 | **User feedback** | Pending | Positive feedback from beta users; no critical UX/functional complaints. |

## Domain-Specific Validation

| Check | Description | Status |
|-------|-------------|--------|
| Labor compliance review | labor-compliance-analyst drafts/audits work rules and verifies statutory text via statute lookup per the active country profile | Pending |
| Labor relations support | labor-relations-specialist structures precedent research and labor-relations-authority proceeding responses | Pending |
| Compensation & benefits | compensation-benefits-analyst produces benchmarked pay structures and benefits designs | Pending |
| Org design | org-design-consultant applies org-design-framework to target operating models | Pending |
| Learning & development | learning-development-specialist designs curricula via learning-curriculum-design | Pending |
| Performance management | performance-management-consultant designs evaluation/KPI/OKR systems | Pending |
| Talent acquisition | talent-acquisition-specialist produces recruiting strategy and sourcing-channel designs | Pending |
| Career & succession | career-succession-consultant designs career pathing and leadership pipelines | Pending |
| Safety & health | safety-health-officer handles workplace safety/health compliance workflows | Pending |
| Change management | change-management-partner runs org-readiness-assessment and stakeholder-alignment cycles | Pending |
| HR analytics | data-analyst delivers hr-metrics-analysis dashboards and turnover/labor-cost analyses | Pending |
| 4-phase methodology | Phase 0 intake gates jurisdiction/locale assumptions before Phase 1 dispatch | Pending |

## Review History

| Date | Reviewer | Outcome | Notes |
|------|----------|---------|-------|
| | | | |
