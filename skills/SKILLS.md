# SKILLS.md — Skill Lifecycle Registry

> Human-readable registry view of the skills in `skills/`. The SSOT for skill versions, status, and lifecycle metadata is `docs/VERSION_MANIFEST.md`.  
> Propagation control is via SKILL.md frontmatter (`l2_propagate`/`scope`) — not this file.  
> Platform skills (`.claude/skills/`, `.gemini/skills/`) are tracked by `verify-platform-lifecycle.ts` — not here.  
> Machine parsing: `layer-filter.ts` reads each skill's `SKILL.md` frontmatter directly.  
> **Variant-exclusive skills (L0+L2)** live only in their owning variant's `templates/co-*/skills/` directory — never in the workspace root or `templates/common/skills/` (DEC-20260829-02).  
> **Inter-skill relations** are NOT tracked here — see `docs/skill-graph.json` / `docs/skill-graph.md` (ADR-0060).

---

## Registry

### Workspace Skills

Skills with a `skills/<name>/` directory in the workspace root. These are the primary skills available across all platforms.

| skill | version | status | owner | last_reviewed | removal-date | notes |
|-------|---------|--------|-------|---------------|--------------|-------|
| `agent-lifecycle-manager` | 1.3.0 | active | pm | 2026-09-21 | — | PM-led hiring/firing workflows + skill attach/detach rules |
| `create-variant` | 1.4.2 | active | pm | 2026-09-21 | — | Workspace operator only — not deployed to L2 |
| `finishing-a-development-branch` | 1.0.1 | active | pm | 2026-06-13 | — | Workspace override — redirects branch completion to /sync (mirrored 2026-09-04 from .claude/skills) |
| `meeting-facilitation` | 1.4.4 | active | pm | 2026-09-26 | — | Canonical meeting skill; `meeting` is a trigger alias, not a separate skill directory |
| `project-review` | 1.3.1 | active | pm | 2026-09-26 | — | — |
| `promote-variant` | 1.4.0 | active | pm | 2026-08-24 | — | Workspace operator only — not deployed to L2 |
| `platform-command-lifecycle-manager` | 1.0.3 | active | pm | 2026-09-25 | — | Mirrored 2026-09-04 from .claude/skills |
| `platform-skill-lifecycle-manager` | 1.0.2 | active | pm | 2026-05-31 | — | Mirrored 2026-09-04 from .claude/skills |
| `script-lifecycle-manager` | 1.2.2 | active | pm | 2026-05-30 | — | — |
| `security-scan` | 1.2.0 | active | pm | 2026-08-30 | — | Reassigned from security-expert — not defined in templates/common/agents/ or any variant, caused orphan on every propagated variant |
| `source-command-commit-push-pr` | 1.0.3 | active | pm | — | — | Redirects commit+push+PR requests to /sync (mirrored 2026-09-04 from .claude/skills) |
| `simulate-pipeline` | 1.0.2 | active | automation-engineer | 2026-09-21 | — | Merged smoke-test skill for project creation and L3→variant promotion modes |
| `skill-lifecycle-manager` | 1.5.0 | active | pm | 2026-09-21 | — | Skill Request Workflow (agent-initiated, PM-approved) + Deprecation & Removal |
| `sync` | 1.6.0 | active | pm | 2026-09-17 | — | Full project sync pipeline — lifecycle, audit, publish, commit, push, PR. Reassigned from lifecycle-manager — same orphan cause as security-scan |
| `team-builder` | 1.1.0 | active | pm | 2026-06-13 | — | — |
| `translate` | 1.0.3 | active | pm | 2026-08-24 | — | — |
| `project-to-variant` | 1.3.0 | active | scaffolding-expert | 2026-08-23 | — | Convert existing standalone project into official variant template |
| `adopt-project` | 1.1.0 | active | scaffolding-expert | 2026-09-23 | — | Convert an existing external project into a workspace-standard project in place (preserves content + git history); automates variant-conversion-guide §3 Scenario B |
| `upgrade-project` | 1.5.1 | active | pm | 2026-09-21 | — | Upgrade existing L2/L3 project to current template version |
| `migrate-project` | 1.0.0 | active | scaffolding-expert | 2026-09-23 | — | End-to-end external-project migration: GitHub baseline → adopt-project → machine-verified result (artifacts, platform twins, provenance, hooksPath, audit smoke) |
| `variant-feature` | 1.0.0 | active | scaffolding-expert | 2026-07-31 | — | Add features (agents, skills, scripts, docs) to existing variant |
| `ticket-run` | 1.0.0 | active | automation-engineer | 2026-07-16 | — | Pulls next waiting service ticket from Phase A queue |
| `explain-me` | 1.0.0 | experimental | pm | 2026-08-03 | — | Single-file interactive HTML report generation. Inspired by beret21/reportme (MIT). Korean loanword data in references/loanword-refinements.json |
| `design-foundation` | 1.1.0 | active | architect | 2026-09-26 | — | Style-neutral design system derivation framework: principles, decision record, 3-layer token architecture ([data-theme] theming). Spec: templates/common/docs/design-foundation.md |
| `zod-contract-gate` | 1.0.2 | active | architect | 2026-08-06 | — | Defines Zod runtime schema validation patterns and contract safety rules |
| `standup-synthesizer` | 1.0.0 | active | pm | 2026-08-06 | — | Daily standup digest synthesizer aggregating commits, issues, PRs, and blockers |
| `api-documentation` | 1.0.2 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic REST/GraphQL/SDK documentation generation, not domain-specific |
| `documentation-writing` | 1.0.3 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic guide/manual/tutorial writing, not domain-specific |
| `project-resync` | 1.5.1 | active | pm | 2026-09-23 | — | Whole-fleet bidirectional cycle: provenance audit (resync-audit.ts) → project GitHub sync → selective backport → root sync → upgrades. Operator skill; distinct from `sync` |
| `release-template` | 1.0.0 | active | pm | 2026-09-09 | — | Workspace operator only — atomically bumps templates/VERSION, cuts templates/CHANGELOG.md, and creates template tag |
| `accessibility-audit` | 1.1.0 | active | pm | 2026-09-06 | — | Promoted from co-design (L2-as-basis per ADR-0068 plan): automated WCAG 2.1 AA audits via axe-core |
| `token-usage-lint` | 1.1.0 | active | pm | 2026-09-06 | — | Promoted from co-design: token SSOT compliance lint; delegates to scripts/design-lint.ts (L0+L1) |
| `ui-ux-design-intelligence` | 1.0.1 | active | pm | 2026-09-06 | — | Promoted from co-design: component design, visual hierarchy, WCAG checklist; enabled by design-foundation |
| `research-analysis` | 1.0.2 | active | pm | 2026-07-19 | — | Promoted from co-work/co-safety duplicate copies — generic research synthesis and evidence gathering, not domain-specific |
| `context-commonization-review` | 1.1.0 | active | architect | 2026-08-21 | — | Cross-variant docs/<variant>.context.md duplication review — promotes shared content into common docs/context.md (ADR-0050 Part 3) |
| `gateguard` | 1.0.2 | active | pm | 2026-08-01 | — | Pre-edit fact-forcing quality gate — investigate importers, schemas, scope constraints before editing (Hook-Prompt-Skill 3-layer enforcement) |
| `update-bun-packages` | 1.3.1 | active | pm | 2026-09-09 | — | Owns Bun dependency updates and root/common/variant alignment via sync-template-deps.ts --apply |
| `ci-triage` | 0.1.1 | active | pm | 2026-09-08 | — | CI failure triage and owner routing for scheduled health-check issues |
| `skill-graph-analytics` | 1.1.0 | active | pm | 2026-09-22 | — | Weekly fleet analytics over per-project skill-graph projections (skill-graph-fleet-report.ts): presence matrix, convergence/delivery-gap triage, dated snapshots under memory/skill-graph-metrics/; triage only — tickets, no auto-modification |

### Variant-Exclusive Skills

Skills registered in the catalog but without a `skills/<name>/` directory in the workspace root. These live exclusively inside variant templates (`templates/co-*/skills/`) and are only available when that variant is active.

| skill | version | status | owner | last_reviewed | removal-date | variant |
|-------|---------|--------|-------|---------------|--------------|---------|
| `change-impact-assessment` | 1.0.0 | active | change-management-partner | 2026-06-13 | — | co-consult only |
| `design` | 1.2.1 | active | design | 2026-08-24 | — | co-deck only |
| `financial-modeling` | 1.0.1 | active | strategy-analyst | 2026-08-26 | — | co-consult only |
| `html-build` | 1.5.0 | active | html-build | 2026-06-24 | — | co-deck only |
| `narrative-framework` | 1.0.0 | active | communications-lead | 2026-06-13 | — | co-consult only |
| `project-delivery` | 1.0.0 | active | delivery-manager | 2026-06-13 | — | co-consult only |
| `research` | 1.2.1 | active | research | 2026-08-23 | — | co-deck only |
| `solution-design` | 1.0.0 | active | solutions-architect | 2026-06-13 | — | co-consult only |
| `stakeholder-review-management` | 1.0.0 | active | delivery-manager | 2026-06-13 | — | co-consult only |
| `storyline` | 1.2.0 | active | storyline | 2026-06-19 | — | co-deck only |
| `technical-feasibility` | 1.0.0 | active | solutions-architect | 2026-06-13 | — | co-consult only |
| `theme-authoring` | 1.0.1 | active | pm | 2026-06-21 | — | co-deck only |
| `verify-authorization` | 1.0.0 | active | pm | 2026-06-13 | — | co-security only |
| `version` | 1.3.0 | active | version | 2026-06-20 | — | co-deck only |
| `swe-solve` | 1.1.1 | active | pm | 2026-08-25 | — | co-develop only |
| `sound-synth` | 1.0.0 | active | sound-designer | 2026-08-06 | — | co-game only |
| `mece-logic-auditor` | 1.0.0 | active | strategy-analyst | 2026-08-06 | — | co-consult only |
| `sarif-exporter` | 1.0.1 | active | security-expert | 2026-08-25 | — | co-security only |
| `presenter-mode` | 1.0.1 | active | html-build | 2026-08-16 | — | co-deck only |
| `stride-threat-matrix` | 1.0.0 | active | security-expert | 2026-08-06 | — | co-security only |
| `abap-code-review` | 1.0.0 | active | code-writer | 2026-08-25 | — | co-abap only |
| `abap-dev` | 1.1.0 | active | code-writer | 2026-08-15 | — | co-abap only |
| `ai-tell-reduction` | 1.0.0 | active | style-editor | 2026-08-10 | — | co-news only |
| `arc-flash-analyzer` | 1.0.0 | active | powergen-agent | — | — | co-safety only |
| `arcade-physics` | 1.0.0 | active | pm | 2026-08-25 | — | co-game only |
| `asset-integrity-check` | 1.0.0 | active | asset-integrity-agent | — | — | co-safety only |
| `audit-preparation` | 1.0.0 | active | audit-agent | — | — | co-safety only |
| `benefit-risk-assessor` | 1.0.0 | active | gvp-agent | — | — | co-safety only |
| `bsl-lab-aerosol-control-planner` | 1.0.0 | active | biotech-agent | — | — | co-safety only |
| `career-path-succession-planning` | 1.0.0 | active | career-succession-consultant | 2026-08-23 | — | co-hr only |
| `chemical-risk-assessment` | 1.1.0 | active | msds-agent | — | — | co-safety only |
| `code-review` | 1.0.0 | active | pm | 2026-07-19 | — | co-develop, co-game |
| `coke-oven-pah-heat-stress-planner` | 1.0.0 | active | steelmaking-agent | — | — | co-safety only |
| `company-intelligence` | 1.0.0 | active | pm | 2026-07-19 | — | co-consult only |
| `compensation-benchmarking` | 1.0.0 | active | compensation-benefits-analyst | 2026-08-23 | — | co-hr only |
| `competency-modeling` | 1.0.0 | active | learning-development-specialist | 2026-08-25 | — | co-hr only |
| `completion-inspection` | 1.0.0 | active | gasterm-agent | — | — | co-safety only |
| `compliance-gap` | 1.0.0 | active | compliance-agent | — | — | co-safety only |
| `construction-permit-overview` | 1.0.0 | active | gasterm-agent | — | — | co-safety only |
| `contractor-onboarding` | 1.0.0 | active | contractor-safety-agent | — | — | co-safety only |
| `cosmetics-solvent-exposure-monitor` | 1.0.0 | active | cosmetics-agent | — | — | co-safety only |
| `cost-shock-analysis` | 1.0.0 | active | cost-asset-mgmt | 2026-08-25 | — | co-price only |
| `customs-duty-drawback-workflow` | 1.0.0 | active | customs-duty-drawback-specialist | 2026-08-08 | — | co-export only |
| `dangerous-cargo-handling-planner` | 1.0.0 | active | logistics-agent | — | — | co-safety only |
| `desktop-app-fallback` | 1.0.0 | active | test-runner | 2026-08-15 | — | co-abap only |
| `double-entry-reconciliation` | 2.0.0 | active | cpa-auditor | 2026-08-25 | — | co-price only |
| `dts-verification` | 1.0.0 | active | gdp-agent | — | — | co-safety only |
| `dump-monitor` | 1.0.0 | active | devops-admin | 2026-08-15 | — | co-abap only |
| `emergency-response` | 1.0.1 | active | emergency-agent | — | — | co-safety only |
| `environmental-compliance-checker` | 1.0.0 | active | ehschem-agent | — | — | co-safety only |
| `ess-fire-risk-assessor` | 1.0.0 | active | powergen-agent | — | — | co-safety only |
| `excel-export` | 2.0.0 | active | core-engine-dev | 2026-08-25 | — | co-price only |
| `export-control-screening` | 1.0.0 | active | export-control-compliance-specialist | 2026-08-08 | — | co-export only |
| `fall-hazard-assessor` | 1.0.0 | active | ehsconst-agent | — | — | co-safety only |
| `financial-infographic-svg` | 1.0.1 | active | visual-editor | 2026-08-24 | — | co-news only |
| `financial-journalism-style` | 1.0.0 | active | style-editor | 2026-08-10 | — | co-news only |
| `financial-narrative-brief` | 1.0.1 | active | financial-analyst | 2026-08-26 | — | co-news only |
| `financial-statement-analysis` | 1.3.1 | active | data-analyst | 2026-07-19 | — | co-consult only |
| `financial-statement-prep` | 2.0.0 | active | finance-strategy-lead | 2026-08-25 | — | co-price only |
| `finding-reconciliation` | 1.0.0 | active | security-expert | 2026-08-25 | — | co-security only |
| `foreign-regulation-monitoring` | 1.0.0 | active | foreign-regulatory-intelligence-analyst | 2026-08-08 | — | co-export only |
| `fta-origin-determination` | 1.0.0 | active | fta-origin-analyst | 2026-08-08 | — | co-export only |
| `gabor-granger` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only |
| `gas-dispersion-analyzer` | 1.0.0 | active | gasterm-agent | — | — | co-safety only |
| `ghs-classifier` | 1.0.0 | active | msds-agent | — | — | co-safety only |
| `glp-data-integrity-checker` | 1.0.0 | active | glp-agent | — | — | co-safety only |
| `glp-study-protocol-validator` | 1.0.0 | active | glp-agent | — | — | co-safety only |
| `gmp-change-control` | 1.0.0 | active | gmp-agent | — | — | co-safety only |
| `gmp-deviation-capa` | 1.0.0 | active | gmp-agent | — | — | co-safety only |
| `gmp-qrm` | 1.0.0 | active | gmp-agent | — | — | co-safety only |
| `halal-certification-workflow` | 1.0.0 | active | halal-certification-specialist | 2026-08-16 | — | co-export only |
| `harness-verification` | 2.1.0 | active | cpa-auditor | 2026-08-25 | — | co-price only |
| `hazop-analysis` | 1.1.0 | active | psm-agent | — | — | co-safety only |
| `hr-metrics-analysis` | 1.0.1 | active | data-analyst | 2026-08-25 | — | co-hr only |
| `hs-classification-workflow` | 1.0.1 | active | hs-classification-specialist | 2026-08-25 | — | co-export only |
| `hv-cell-formation-electrical-safety-planner` | 1.0.0 | active | battery-agent | — | — | co-safety only |
| `hwp-document-processing` | 2.0.1 | active | technology-specialist | 2026-08-24 | — | co-consult only |
| `i18n-audit` | 2.1.0 | active | l10n-auditor | 2026-08-29 | — | co-price only |
| `iso14971-risk-scorer` | 1.1.0 | active | meddevice-agent | — | — | co-safety only |
| `labor-compliance-audit` | 1.0.0 | active | labor-compliance-analyst | 2026-08-25 | — | co-hr only |
| `landed-cost-calculation` | 1.0.0 | active | logistics-coordinator | 2026-08-25 | — | co-export only |
| `landfill-methane-anaerobic-explosion-planner` | 1.0.0 | active | waste-agent | — | — | co-safety only |
| `learning-curriculum-design` | 1.0.0 | active | learning-development-specialist | 2026-08-23 | — | co-hr only |
| `logistics-coordination` | 1.1.0 | active | logistics-coordinator | 2026-08-16 | — | co-export only |
| `map-channel-enforcement` | 1.0.0 | active | pricing-strategist | 2026-08-25 | — | co-price only |
| `market-entry-strategy` | 1.0.0 | active | market-entry-strategist | 2026-08-08 | — | co-export only |
| `math-function-plotter` | 2.0.0 | active | core-engine-dev | 2026-08-25 | — | co-price only |
| `mid-construction-inspection` | 1.0.0 | active | gasterm-agent | — | — | co-safety only |
| `msds-parser` | 1.0.0 | active | msds-agent | — | — | co-safety only |
| `munitions-magazine-storage-safety-planner` | 1.0.0 | active | defense-agent | — | — | co-safety only |
| `org-design-framework` | 1.0.0 | active | org-design-consultant | 2026-08-23 | — | co-hr only |
| `painting-coating-fire-toxic-planner` | 1.0.0 | active | shipbuilding-agent | — | — | co-safety only |
| `performance-system-design` | 1.0.0 | active | performance-management-consultant | 2026-08-23 | — | co-hr only |
| `performance-tuning` | 1.0.0 | active | dba | 2026-08-15 | — | co-abap only |
| `permit-to-work` | 1.0.1 | active | safety-workflow-manager | — | — | co-safety only |
| `post-write-chain` | 1.1.0 | active | test-runner | 2026-08-15 | — | co-abap only |
| `pre-construction-technical-review` | 1.0.0 | active | gasterm-agent | — | — | co-safety only |
| `prep-pdf` | 2.0.0 | active | pdf-export | 2026-06-23 | — | co-deck only |
| `price-waterfall-analysis` | 1.0.0 | active | finance-strategy-lead | 2026-08-25 | — | co-price only |
| `pricing-governance` | 1.0.0 | active | pricing-strategist | 2026-08-25 | — | co-price only |
| `pricing-playbook` | 1.0.0 | active | pricing-strategist | 2026-08-25 | — | co-price only |
| `prisma-7` | 2.0.0 | active | lead-architect | 2026-08-25 | — | co-price only |
| `process-hazard-screening` | 1.0.0 | active | ehschem-agent | — | — | co-safety only |
| `protocol-deviation-analyzer` | 1.0.0 | active | gcp-agent | — | — | co-safety only |
| `psm-loto` | 1.0.0 | active | psm-agent | — | — | co-safety only |
| `psm-moc` | 1.0.0 | active | psm-agent | — | — | co-safety only |
| `pyrophoric-gas-emergency-responder` | 1.0.0 | active | semicon-agent | — | — | co-safety only |
| `rack-fall-protection-planner` | 1.0.0 | active | datacenter-agent | — | — | co-safety only |
| `refactoring` | 1.0.0 | active | pm | 2026-07-19 | — | co-develop, co-game |
| `risk-assessment` | 1.0.0 | active | risk-assessment-agent | — | — | co-safety only |
| `rolling-stock-maintenance-loto-planner` | 1.0.0 | active | railway-agent | — | — | co-safety only |
| `roo-qualification-worksheet` | 1.0.0 | active | fta-origin-analyst | 2026-08-25 | — | co-export only |
| `root-cause-analysis` | 1.0.0 | active | incident-investigation-agent | — | — | co-safety only |
| `sae-causality-assessor` | 1.0.0 | active | gcp-agent | — | — | co-safety only |
| `safety-inspection-validator` | 1.0.0 | active | ehsconst-agent | — | — | co-safety only |
| `samm-maturity` | 1.0.0 | active | pm | 2026-08-24 | — | co-security only |
| `sample-driven-report-writing` | 1.0.0 | active | communications-lead | 2026-08-11 | — | co-consult only |
| `sap-co` | 1.0.0 | active | co-analyst | 2026-08-15 | — | co-abap only |
| `sap-fi` | 1.0.0 | active | fi-analyst | 2026-08-15 | — | co-abap only |
| `sap-le` | 1.0.0 | active | le-analyst | 2026-08-15 | — | co-abap only |
| `sap-mm` | 1.0.0 | active | mm-analyst | 2026-08-15 | — | co-abap only |
| `sap-pp` | 1.0.0 | active | pp-analyst | 2026-08-15 | — | co-abap only |
| `sap-sd` | 1.0.0 | active | sd-analyst | 2026-08-15 | — | co-abap only |
| `scenario-comparison` | 1.0.0 | active | engagement-director | 2026-08-25 | — | co-price only |
| `service-design` | 1.1.0 | active | pm | 2026-07-19 | — | co-design only |
| `sheet-model` | 2.0.0 | active | cpa-auditor | 2026-08-25 | — | co-price only |
| `signal-detector` | 1.0.0 | active | gvp-agent | — | — | co-safety only |
| `slide-layout-gate` | 1.0.0 | active | pdf-export | 2026-08-26 | — | co-deck only |
| `source-command-celebrate` | 1.0.0 | active | pm | 2026-08-15 | — | co-abap only |
| `source-verification-ledger` | 1.0.1 | active | fact-checker | 2026-08-24 | — | co-news only |
| `spdx-sbom` | 1.0.0 | active | pm | 2026-08-24 | — | co-security only |
| `style-lint-checklist` | 1.0.1 | active | style-editor | 2026-08-26 | — | co-news only |
| `talent-acquisition-strategy` | 1.0.0 | active | talent-acquisition-specialist | 2026-08-23 | — | co-hr only |
| `tank-integrity-validator` | 1.0.0 | active | gasterm-agent | — | — | co-safety only |
| `tar-planning` | 1.1.0 | active | ehschem-agent | — | — | co-safety only |
| `temperature-excursion-analyzer` | 1.0.0 | active | gdp-agent | — | — | co-safety only |
| `test-driven-development` | 1.0.0 | active | pm | 2026-07-19 | — | co-develop, co-game |
| `thermal-burn-prevention-planner` | 1.0.0 | active | food-agent | — | — | co-safety only |
| `tool-box-meeting` | 1.0.0 | active | safety-workflow-manager | — | — | co-safety only |
| `trade-documentation-checklist` | 1.0.0 | active | trade-documentation-specialist | 2026-08-08 | — | co-export only |
| `trade-promotion-roi` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only |
| `ui-component-design` | 2.0.0 | active | ux-specialist | 2026-08-25 | — | co-price only |
| `van-westendorp-psm` | 1.0.0 | active | market-intelligence-analyst | 2026-08-25 | — | co-price only |
