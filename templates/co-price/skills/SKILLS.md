# SKILLS.md — Skill Lifecycle Registry

Curated registry for the co-price skills (T-20260925-005). One row per skill directory; values come from each skill's SKILL.md frontmatter. This curated registry replaces the earlier prose skills guide; adopting the curated header opts the variant out of legacy-index regeneration by verify-skills.ts.

## Registry

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `competitive-intelligence` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only — Systematic market and competitive analysis |
| `cost-shock-analysis` | 1.0.0 | active | cost-asset-mgmt | 2026-08-25 | — | co-price only — Raw-material cost shock sensitivity analysis |
| `double-entry-reconciliation` | 2.0.0 | active | cpa-auditor | 2026-08-25 | — | co-price only — Double-entry bookkeeping integrity verification |
| `excel-export` | 2.0.0 | active | core-engine-dev | 2026-08-25 | — | co-price only — Structured Excel workbook generation from engine data |
| `executive-presentation` | 1.0.0 | active | ux-specialist | 2026-08-25 | — | co-price only — C-level presentation and decision deck design |
| `financial-statement-prep` | 2.0.0 | active | finance-strategy-lead | 2026-08-25 | — | co-price only — Financial statement preparation and formatting |
| `gabor-granger` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only — Gabor-Granger direct pricing research methodology |
| `harness-verification` | 2.1.0 | active | cpa-auditor | 2026-08-25 | — | co-price only — Authoritative Harness Engineering Protocol: machine-readable spec requirements,… |
| `i18n-audit` | 2.1.0 | active | l10n-auditor | 2026-08-29 | — | co-price only — co-price specialization of the common i18n-audit skill — 16-locale translation parity and glossary… |
| `insight-synthesis` | 1.0.0 | active | engagement-director | 2026-08-25 | — | co-price only — Multi-specialist analysis integration into strategic insight |
| `map-channel-enforcement` | 1.0.0 | active | pricing-strategist | 2026-08-25 | — | co-price only — MAP policy enforcement and channel conflict resolution |
| `math-function-plotter` | 2.0.0 | active | core-engine-dev | 2026-08-25 | — | co-price only — Mathematical function visualization for pricing curves |
| `pdf-export` | 1.1.0 | active | core-engine-dev | 2026-08-25 | — | co-price only — PDF report generation for client-facing deliverables |
| `price-waterfall-analysis` | 1.0.0 | active | finance-strategy-lead | 2026-08-25 | — | co-price only — Pocket margin analysis and price waterfall diagnostics |
| `pricing-governance` | 1.0.0 | active | pricing-strategist | 2026-08-25 | — | co-price only — Pricing governance framework and corridor management |
| `pricing-playbook` | 1.0.0 | active | pricing-strategist | 2026-08-25 | — | co-price only — Standardized pricing methodology and process guide |
| `prisma-7` | 2.0.0 | active | lead-architect | 2026-08-25 | — | co-price only — Prisma 7 ORM schema management and migration |
| `scenario-comparison` | 1.0.0 | active | engagement-director | 2026-08-25 | — | co-price only — Multi-scenario pricing comparison and evaluation |
| `sheet-model` | 2.0.0 | active | cpa-auditor | 2026-08-25 | — | co-price only — Spreadsheet-style data modeling and scenario analysis |
| `trade-promotion-roi` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only — Trade promotion ROI evaluation with netROI gate |
| `ui-component-design` | 2.0.0 | active | ux-specialist | 2026-08-25 | — | co-price only — Onyx 2.0 component design patterns |
| `van-westendorp-psm` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only — Van Westendorp Price Sensitivity Meter survey analysis |

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each SKILL.md file. Fleet-common skills (handbook, handbook-sync-audit, the lifecycle managers, sync, translate, and the rest of the common contract) are not listed here — they resolve from templates/common/skills/ at scaffold time.
