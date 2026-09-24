# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-consult variant-exclusive skills (T-20260924-009). One row per variant-exclusive skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `change-impact-assessment` | 1.0.0 | active | change-management-partner | 2026-06-13 | — | co-consult only — change-impact mapping for the Change Management Partner |
| `company-intelligence` | 1.0.0 | active | pm | 2026-07-19 | — | co-consult only — company and corporate-group intelligence gathering |
| `competitive-intelligence` | 1.0.0 | active | strategy-analyst | 2026-06-13 | — | co-consult only — market and competitive analysis |
| `consulting-report-writing` | 1.0.0 | active | communications-lead | 2026-06-13 | — | co-consult only — consulting-style report writing |
| `executive-presentation` | 1.0.0 | active | communications-lead | 2026-06-13 | — | co-consult only — C-level strategy presentation design |
| `financial-modeling` | 1.0.1 | active | strategy-analyst | 2026-08-26 | — | co-consult only — business-case financial modeling |
| `financial-statement-analysis` | 1.3.1 | active | data-analyst | 2026-07-19 | — | co-consult only — financial statement analysis pipeline |
| `hwp-document-processing` | 2.0.1 | active | technology-specialist | 2026-08-24 | — | co-consult only — Korean HWP/DVB document handling |
| `insight-synthesis` | 1.0.0 | active | strategy-analyst | 2026-06-13 | — | co-consult only — multi-specialist insight integration |
| `mece-logic-auditor` | 1.0.0 | active | strategy-analyst | 2026-08-06 | — | co-consult only — MECE issue-tree auditing and strategic reasoning |
| `narrative-framework` | 1.0.0 | active | communications-lead | 2026-06-13 | — | co-consult only — narrative construction frameworks |
| `org-readiness-assessment` | 1.0.0 | active | change-management-partner | 2026-06-13 | — | co-consult only — organizational change-capacity diagnosis |
| `project-delivery` | 1.0.0 | active | delivery-manager | 2026-06-13 | — | co-consult only — engagement delivery planning and management |
| `sample-driven-report-writing` | 1.0.0 | active | communications-lead | 2026-08-11 | — | co-consult only — structure extraction from deliverable samples |
| `solution-design` | 1.0.0 | active | solutions-architect | 2026-06-13 | — | co-consult only — requirements-to-architecture solution design |
| `stakeholder-alignment` | 1.0.0 | active | change-management-partner | 2026-06-13 | — | co-consult only — stakeholder mapping and resistance management |
| `stakeholder-review-management` | 1.0.0 | active | delivery-manager | 2026-06-13 | — | co-consult only — stakeholder review-cycle management |
| `technical-feasibility` | 1.0.0 | active | solutions-architect | 2026-06-13 | — | co-consult only — technical feasibility evaluation |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each SKILL.md file. Fleet-common skills (handbook, handbook-sync-audit, the lifecycle managers, sync, translate, and the rest of the common contract) are not listed here — they resolve from templates/common/skills/ at scaffold time.
