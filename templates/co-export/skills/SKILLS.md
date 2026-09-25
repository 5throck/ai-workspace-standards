# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-export skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `customs-duty-drawback-workflow` | 1.0.0 | active | customs-duty-drawback-specialist | 2026-08-08 | — | co-export only — Guides the Customs Duty Drawback Specialist through refund-eligible raw material determination,… |
| `export-control-screening` | 1.0.0 | active | export-control-compliance-specialist | 2026-08-08 | — | co-export only — Guides the Export Control & Sanctions Screening Specialist through strategic-item classification,… |
| `foreign-regulation-monitoring` | 1.0.0 | active | foreign-regulatory-intelligence-analyst | 2026-08-08 | — | co-export only — Guides the Foreign Regulatory Intelligence Analyst through tracking US/China/EU import regulation,… |
| `fta-origin-determination` | 1.0.0 | active | fta-origin-analyst | 2026-08-08 | — | co-export only — Guides the FTA/Origin Analyst through determining whether goods qualify for preferential tariff… |
| `halal-certification-workflow` | 1.0.0 | active | halal-certification-specialist | 2026-08-16 | — | co-export only — Guides the Halal Certification Specialist through determining whether halal certification is… |
| `hs-classification-workflow` | 1.0.1 | active | hs-classification-specialist | 2026-08-25 | — | co-export only — Guides the HS Classification Specialist through GRI-ordered Harmonized System classification,… |
| `landed-cost-calculation` | 1.0.0 | active | logistics-coordinator | 2026-08-25 | — | co-export only — Defines the landed-cost computation convention for export engagements: a formula ledger decomposing… |
| `logistics-coordination` | 1.1.0 | active | logistics-coordinator | 2026-08-16 | — | co-export only — Guides the Logistics Coordinator through Incoterms term selection (2020 default, with 2000/2010… |
| `market-entry-strategy` | 1.0.0 | active | market-entry-strategist | 2026-08-08 | — | co-export only — Guides the Market Entry Strategist through destination-market demand assessment, competitive… |
| `roo-qualification-worksheet` | 1.0.0 | active | fta-origin-analyst | 2026-08-25 | — | co-export only — Produces a per-shipment Rules of Origin qualification worksheet from the FTA skill's determination… |
| `trade-documentation-checklist` | 1.0.0 | active | trade-documentation-specialist | 2026-08-08 | — | co-export only — Guides the Trade Documentation Specialist through assembling a complete, internally consistent… |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each SKILL.md file. Fleet-common skills (handbook, handbook-sync-audit, the lifecycle managers, sync, translate, and the rest of the common contract) are not listed here — they resolve from templates/common/skills/ at scaffold time.
