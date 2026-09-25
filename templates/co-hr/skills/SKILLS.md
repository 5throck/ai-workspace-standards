# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-hr skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. The auto-generated index this file replaces was produced by verify-skills.ts — converting this file to a curated registry opts the variant out of legacy-index regeneration.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `career-path-succession-planning` | 1.0.0 | active | career-succession-consultant | 2026-08-23 | — | co-hr only — Guides the Career & Succession Consultant through career path architecture, 9-box talent review,… |
| `compensation-benchmarking` | 1.0.0 | active | compensation-benefits-analyst | 2026-08-23 | — | co-hr only — Guides the Compensation & Benefits Analyst through job evaluation, market benchmarking, pay… |
| `competency-modeling` | 1.0.0 | active | learning-development-specialist | 2026-08-25 | — | co-hr only — Guides the building of organizational competency models — competency definition with behavioral… |
| `consulting-report-writing` | 1.0.0 | active | pm | 2026-08-23 | — | co-hr only — Guides any agent producing a client-facing deliverable through writing McKinsey/BCG-style… |
| `hr-metrics-analysis` | 1.0.1 | active | data-analyst | 2026-08-25 | — | co-hr only — Guides the HR Data Analyst through defining reproducible HR metrics, labeling causal driver… |
| `labor-compliance-audit` | 1.0.0 | active | labor-compliance-analyst | 2026-08-25 | — | co-hr only — Instantiates the active country profile's statute-families table as a per-engagement compliance… |
| `learning-curriculum-design` | 1.0.0 | active | learning-development-specialist | 2026-08-23 | — | co-hr only — Guides the Learning & Development Specialist through training needs analysis, competency model… |
| `org-design-framework` | 1.0.0 | active | org-design-consultant | 2026-08-23 | — | co-hr only — Guides the Org Design Consultant through organizational design principle definition, job… |
| `org-readiness-assessment` | 1.0.0 | active | change-management-partner | 2026-08-23 | — | co-hr only — Guides the Change Management Partner through diagnosing an organization's capacity to absorb and… |
| `performance-system-design` | 1.0.0 | active | performance-management-consultant | 2026-08-23 | — | co-hr only — Guides the Performance Management Consultant through evaluation framework selection, goal cascade… |
| `stakeholder-alignment` | 1.0.0 | active | change-management-partner | 2026-08-23 | — | co-hr only — Guides the Change Management Partner through systematic stakeholder mapping, resistance analysis,… |
| `talent-acquisition-strategy` | 1.0.0 | active | talent-acquisition-specialist | 2026-08-23 | — | co-hr only — Guides the Talent Acquisition Specialist through role/headcount intake, sourcing channel strategy,… |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each SKILL.md file. Fleet-common skills (handbook, handbook-sync-audit, the lifecycle managers, sync, translate, and the rest of the common contract) are not listed here — they resolve from templates/common/skills/ at scaffold time.
