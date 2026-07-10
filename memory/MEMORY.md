# Memory Index

## Sessions

| Date | Summary |
|------|---------|
| [2026-07-10](2026-07-10.md) | fix(project-review): two-round project review with 51+ findings, 18 actioned fixes; project-review skill v1.1.0 (conditional base-map MCP); sync skill v1.1.0 (16-step pipeline docs) |
| [2026-07-09](2026-07-09.md) | feat(skills): add cross-platform skill distribution infrastructure for Claude, Gemini, and Antigravity |
| [2026-07-08](2026-07-08.md) | feat(variant-registry): centralized registries, plugin system, validator framework, workspace-integration + co-game variant (Phase A+B) |
| [2026-07-07](2026-07-07.md) | chore: update |
| [2026-07-06](2026-07-06.md) | feat(commands): add /project-review command and track .agents/ for skill discovery |
| [2026-07-05](2026-07-05.md) | feat: register workspace skills globally via .agents/skills.json and propagate to L1 |
| [2026-07-04](2026-07-04.md) | feat(axis-001): add missing unit tests and update changelog for Phase C & D |
| [2026-07-03](2026-07-03.md) | docs(co-deck): add theme system enhancement phase 2 implementation plan; project review improvement planning meeting |
| [2026-07-02](2026-07-02.md) | fix(scripts): add isSuccess predicate and classifyError wiring to retry-handler.ts |
| [2026-07-01](2026-07-01.md) | fix(deps): add js-yaml to templates/common/scripts/package.json for independent dependency resolution |
| [2026-06-28](2026-06-28.md) | fix(l0-leak): remove CONSTITUTION.md references from templates and tighten audit |
| [2026-06-27](2026-06-27.md) | feat(co-consult): add Output Destination Mapping for all deliverable-producing agents |
| [2026-06-26](2026-06-26.md) | fix(co-deck): vertical sticky topbar + TOC drawer consistency across themes |
| [2026-06-25](2026-06-25.md) | fix(co-deck): unify CSS variable names across styles, fix glass panel contrast, improve TOC visibility, add preview backgroundImage support |
| [2026-06-24](2026-06-24.md) | chore: update |
| [2026-06-23](2026-06-23.md) | feat(co-deck): background image rendering + TTS voice selection improvements |
| [2026-06-22](2026-06-22.md) | chore: update |
| [2026-06-21](2026-06-21.md) | feat(variant-sync): pluggable variant audit hooks and pipeline integrity validation |
| [2026-06-20](2026-06-20.md) | feat(co-deck): Phase 2 — HTML themes, source-verifier, image source strategy, context docs update |
| [2026-06-19](2026-06-19.md) | feat(co-deck): complete variant template — fix all structural gaps vs other variants and update l2-to-variant-pipeline |
| [2026-06-18](2026-06-18.md) | merge: integrate main into pr branch + add co-deck variant template (Phase A-C complete) |
| [2026-06-16](2026-06-16.md) | feat(mcp): implement 3 Korean EHS MCP servers - k_skill, legalize_kr, mcp_kr_legislation |
| [2026-06-15](2026-06-15.md) | Meeting skill propagation fix |
| [2026-06-13](2026-06-13.md) | fix: Wave 1 — co-develop CLAUDE.md ADR-0036 fix, L1 sh/ps1 removal, publish-to-template ghost refs, collectDiffs L0-only filter, path traversal guard, CONSTITUTION.md lang fix |
| [2026-06-12](2026-06-12.md) | variant template section split strategy — Coding Guidelines migration, variant-specific area management |
| [2026-06-11](2026-06-11.md) | GEMINI.md Claude-specific 콘텐츠 수정, L1 pm.md 중복 섹션 제거, generate-variant.ts Windows 경로 구분자 버그 수정, VARIANT-* 플레이스홀더 주입 정상화 |
| [2026-06-10](2026-06-10.md) | chore: update |
| [2026-06-09](2026-06-09.md) | fix: resolve Agent Roster table rendering bug in merge-frontmatter.ts |
| [2026-06-08](2026-06-08.md) | Fix variant scaffolding validation failure |
| [2026-06-07](2026-06-07.md) | bash 3.2 compatibility mapfile fix meeting |
| [2026-06-06](2026-06-06.md) | chore: update |
| [2026-06-05](archive/2026-06-05.md) | Tier governance violation analysis |
| [2026-06-04](archive/2026-06-04.md) | feat: add tag-template.ts, template version mismatch warning, and audit tag check |
| [2026-06-03](archive/2026-06-03.md) | chore: update |
| [2026-06-02](archive/2026-06-02.md) | fix: Limit changes to workspace root and templates to fix L0/L1 and phase definitions |
| [2026-06-01](archive/2026-06-01.md) | fix: create tests/.temp scratchpad and cleanup root stray files |
| [2026-05-31](archive/improvement-plan-2026-05-31.md) | Comprehensive workspace improvement plan — 28 Critical, 43 High, 46 Moderate issues identified across 3 phases |
| [2026-05-29](archive/2026-05-29.md) | fix: UTF-8 BOM for ps1 emoji scripts, validate-templates workspace guard, register new ts scripts in SCRIPTS.md |
| [2026-05-28](archive/2026-05-28.md) | PM-led 3-tier parallel agent execution: platform parity, upgrade-project, docs-writer promotion, Security Bootstrap, CONSTITUTION §10 Terminology |
| [2026-05-23](archive/2026-05-23.md) | feat: align markdown files with CONSTITUTION.md standards |
| [2026-05-24](archive/2026-05-24.md) | feat: Refactor PM to 3-tier agent strategy and repair Windows terminal CP949 encoding corruptions |
| [2026-05-25](archive/2026-05-25.md) | feat: align template with hybrid scripting standards |
| [2026-05-26](archive/2026-05-26.md) | feat: implement agent lifecycle management and sync template agent references |
| [2026-05-27](archive/2026-05-27.md) | feat: script lifecycle management + context.md two-layer structure |

## Meetings

| Date | Topic | File |
|------|-------|------|
| 2026-07-02 | withRetry + .nothrow() masks gh pr create failures in dev-sync.ts | [meeting-2026-07-02-withretry-nothrow-masks-gh-pr-create-fai.md](meeting-2026-07-02-withretry-nothrow-masks-gh-pr-create-fai.md) |
| 2026-05-31 | Model name SSOT dispersion problem resolution — agents/*.md as SSOT, workspace-schema.json models block planned | [meeting-2026-05-31-model-name-ssot.md](archive/meeting-2026-05-31-model-name-ssot.md) |
| 2026-05-30 | Command Documentation Inconsistency | [meeting-2026-05-30-command-doc-inconsistency.md](archive/meeting-2026-05-30-command-doc-inconsistency.md) |
| 2026-05-30 | C-SK-02 Resolution Plan — Variant PM Migration | [meeting-2026-05-30-csk02-resolution-plan.md](archive/meeting-2026-05-30-csk02-resolution-plan.md) |
| 2026-05-30 | Common PM Skeleton Design — Baseline Methodology | [meeting-2026-05-30-common-pm-skeleton-design.md](archive/meeting-2026-05-30-common-pm-skeleton-design.md) |
| 2026-05-30 | Common Lifecycle Governance Deep Dive v2 | [meeting-2026-05-30-common-lifecycle-governance-v2.md](archive/meeting-2026-05-30-common-lifecycle-governance-v2.md) |
| 2026-05-30 | Common Skills and Agents Central Management Governance | [meeting-2026-05-30-common-skills-agents-governance.md](archive/meeting-2026-05-30-common-skills-agents-governance.md) |
| 2026-05-30 | Project Review Skill Design v2 — Naming and Scaffolding | [meeting-2026-05-30-project-review-skill-design-v2.md](archive/meeting-2026-05-30-project-review-skill-design-v2.md) |
| 2026-05-30 | Workspace Review Skill Design | [meeting-2026-05-30-workspace-review-skill-design.md](archive/meeting-2026-05-30-workspace-review-skill-design.md) |
| 2026-05-30 | SSOT Design for Phase Numbering Schema | [meeting-2026-05-30-ssot-phase-schema-design.md](archive/meeting-2026-05-30-ssot-phase-schema-design.md) |
| 2026-05-30 | Phase 1/2/3 Root Cause Analysis and Prevention Measures | [meeting-2026-05-30-phase123-root-cause-analysis.md](archive/meeting-2026-05-30-phase123-root-cause-analysis.md) |
| 2026-05-30 | Inline Roleplay Adoption | [meeting-2026-05-30-inline-roleplay-adoption.md](archive/meeting-2026-05-30-inline-roleplay-adoption.md) |
| 2026-05-30 | Meeting Skill Improvements | [meeting-2026-05-30-meeting-skill-improvements.md](archive/meeting-2026-05-30-meeting-skill-improvements.md) |
| 2026-05-30 | Scaffolding TypeScript Migration | [meeting-2026-05-30-scaffolding-ts-migration.md](archive/meeting-2026-05-30-scaffolding-ts-migration.md) |
| 2026-05-29 | Review of PM Agent Facilitator Transition Implementation | [meeting-2026-05-29-pm-facilitator-transition-review.md](archive/meeting-2026-05-29-pm-facilitator-transition-review.md) |
| 2026-05-29 | 7-item system improvement plan — PM workflow, 3-tier todo, lifecycle docs, skill audit, file structure | [meeting-2026-05-29-system-improvement-7items.md](archive/meeting-2026-05-29-system-improvement-7items.md) |
| 2026-05-29 | lifecycle-manager scope reduction — secretary role, L0+L1 dual deployment | [meeting-2026-05-29-lifecycle-manager-scope.md](archive/meeting-2026-05-29-lifecycle-manager-scope.md) |
| 2026-05-29 | Lifecycle manager agent — new dedicated agent proposal unanimously agreed | [meeting-2026-05-29-lifecycle-manager-agent.md](archive/meeting-2026-05-29-lifecycle-manager-agent.md) |
| 2026-05-29 | Lifecycle governance audit review — 7 issues, C-01~C-07 remediation plan | [meeting-2026-05-29-lifecycle-audit-review.md](archive/meeting-2026-05-29-lifecycle-audit-review.md) |
| 2026-05-29 | Open items resolution — audit.sh thin wrapper sequence, agents/README policy | [meeting-2026-05-29-open-items-resolution.md](archive/meeting-2026-05-29-open-items-resolution.md) |
| 2026-05-29 | Comprehensive review — co-security, lifecycle governance, 2-Tier script strategy | [meeting-2026-05-29-comprehensive-review.md](archive/meeting-2026-05-29-comprehensive-review.md) |
| 2026-05-29 | Antigravity migration and PM hook | [meeting-2026-05-29-antigravity-migration-and-pm-hook.md](archive/meeting-2026-05-29-antigravity-migration-and-pm-hook.md) |
| 2026-05-29 | Docs folder restructure | [meeting-2026-05-29-docs-folder-restructure.md](archive/meeting-2026-05-29-docs-folder-restructure.md) |
| 2026-05-29 | Gemini transcript and PM plan display | [meeting-2026-05-29-gemini-transcript-and-pm-plan-display.md](archive/meeting-2026-05-29-gemini-transcript-and-pm-plan-display.md) |
| 2026-05-29 | New project test sync | [meeting-2026-05-29-new-project-test-sync.md](archive/meeting-2026-05-29-new-project-test-sync.md) |
| 2026-05-29 | NTRC execution conflict analysis | [meeting-2026-05-29-ntrс-execution-conflict-analysis.md](archive/meeting-2026-05-29-ntrс-execution-conflict-analysis.md) |
| 2026-05-29 | PM mandatory gateway policy | [meeting-2026-05-29-pm-mandatory-gateway-policy.md](archive/meeting-2026-05-29-pm-mandatory-gateway-policy.md) |
| 2026-05-29 | Script conversion strategy | [meeting-2026-05-29-script-conversion-strategy.md](archive/meeting-2026-05-29-script-conversion-strategy.md) |
| 2026-05-29 | Script policy violation and template cleanup | [meeting-2026-05-29-script-policy-violation-and-template-cleanup.md](archive/meeting-2026-05-29-script-policy-violation-and-template-cleanup.md) |
| 2026-05-29 | .sh/.ps1 parity enforcement | [meeting-2026-05-29-sh-ps1-parity-enforcement.md](archive/meeting-2026-05-29-sh-ps1-parity-enforcement.md) |
| 2026-05-29 | Templates common contamination | [meeting-2026-05-29-templates-common-contamination.md](archive/meeting-2026-05-29-templates-common-contamination.md) |
| 2026-05-29 | Variant docs migration and scripts tier | [meeting-2026-05-29-variant-docs-migration-and-scripts-tier.md](archive/meeting-2026-05-29-variant-docs-migration-and-scripts-tier.md) |
| 2026-05-28 | Script pair sync gap — intentional drift policy flaw in .sh/.ps1 horizontal sync | [meeting-2026-05-28-script-pair-sync.md](archive/meeting-2026-05-28-script-pair-sync.md) |
| 2026-05-28 | Cross-platform parity gap in /meeting skill — root .gemini/commands missing | [meeting-2026-05-28-gemini-parity-gap.md](archive/meeting-2026-05-28-gemini-parity-gap.md) |
| 2026-05-28 | Unified lifecycle governance structure across workspace root and templates | [meeting-2026-05-28-lifecycle-governance-structure.md](archive/meeting-2026-05-28-lifecycle-governance-structure.md) |
| 2026-05-28 | Template lifecycle ↔ Script lifecycle integration review | [meeting-2026-05-28-lifecycle-integration-review.md](archive/meeting-2026-05-28-lifecycle-integration-review.md) |
| 2026-05-28 | Variant structural gaps improvement plan meeting | [meeting-2026-05-28-variant-structural-gaps.md](archive/meeting-2026-05-28-variant-structural-gaps.md) |
| 2026-05-28 | Kanban process and system design for current and new projects | [meeting-2026-05-28-kanban-process-design.md](archive/meeting-2026-05-28-kanban-process-design.md) |
| 2026-05-28 | Encoding and README sync review | [meeting-2026-05-28-encoding-readme-sync.md](archive/meeting-2026-05-28-encoding-readme-sync.md) |
| 2026-05-28 | Implementation direction for platform parity, upgrade-project, and team role changes | [meeting-2026-05-28-implementation-direction.md](archive/meeting-2026-05-28-implementation-direction.md) |
| 2026-05-28 | Team composition review and project improvement roadmap meeting | [meeting-2026-05-28-team-composition-improvement.md](archive/meeting-2026-05-28-team-composition-improvement.md) |
| 2026-05-28 | Co-security rebuild | [meeting-2026-05-28-co-security-rebuild.md](archive/meeting-2026-05-28-co-security-rebuild.md) |
| 2026-05-28 | Script lifecycle integration | [meeting-2026-05-28-script-lifecycle-integration.md](archive/meeting-2026-05-28-script-lifecycle-integration.md) |
| 2026-05-28 | Variant plan review (2nd round) | [meeting-2026-05-28-variant-plan-review-2nd.md](archive/meeting-2026-05-28-variant-plan-review-2nd.md) |
| 2026-05-28 | Variant plan review | [meeting-2026-05-28-variant-plan-review.md](archive/meeting-2026-05-28-variant-plan-review.md) |
| 2026-05-28 | Script migration strategy | [meeting-2026-05-28-script-migration-strategy.md](archive/meeting-2026-05-28-script-migration-strategy.md) |
| 2026-05-27 | CONSTITUTION.md hub-and-spoke restructure proposal | [meeting-2026-05-27-constitution-restructure.md](archive/meeting-2026-05-27-constitution-restructure.md) |
| 2026-05-27 | Doc format best practices | [meeting-2026-05-27-doc-format-best-practices.md](archive/meeting-2026-05-27-doc-format-best-practices.md) |
| 2026-05-27 | Template lifecycle review | [meeting-2026-05-27-template-lifecycle-review.md](archive/meeting-2026-05-27-template-lifecycle-review.md) |
| 2026-05-27 | Script lifecycle + context.md structure | [meeting-2026-05-27-script-lifecycle-context-structure.md](archive/meeting-2026-05-27-script-lifecycle-context-structure.md) |
| 2026-05-27 | Workspace root and template lifecycle management review | [meeting-2026-05-27-lifecycle-management-review.md](archive/meeting-2026-05-27-lifecycle-management-review.md) |
| 2026-05-27 | Antigravity support | [meeting-2026-05-27-antigravity-support.md](archive/meeting-2026-05-27-antigravity-support.md) |
| 2026-05-27 | Architectural refinements | [meeting-2026-05-27-architectural-refinements.md](archive/meeting-2026-05-27-architectural-refinements.md) |
| 2026-05-27 | Compliance improvements | [meeting-2026-05-27-compliance-improvements.md](archive/meeting-2026-05-27-compliance-improvements.md) |
| 2026-05-27 | README sync | [meeting-2026-05-27-readme-sync.md](archive/meeting-2026-05-27-readme-sync.md) |
| 2026-05-27 | PS1 parse error | [meeting-2026-05-27-ps1-parse-error.md](archive/meeting-2026-05-27-ps1-parse-error.md) |
| 2026-05-27 | chmod fix | [meeting-2026-05-27-chmod-fix.md](archive/meeting-2026-05-27-chmod-fix.md) |
| 2026-06-05 | Tier governance violation analysis — automation-engineer High tier breach, architect Phase 1-2 bypass | [meeting-2026-06-05-tier-governance-violation.md](archive/meeting-2026-06-05-tier-governance-violation.md) |
| 2026-06-05 | Tier governance L0→L1→L2 propagation strategy — principles vs specialist-list separation | [meeting-2026-06-05-tier-governance-l0-l1-l2-propagation.md](archive/meeting-2026-06-05-tier-governance-l0-l1-l2-propagation.md) |
| 2026-06-05 | Antigravity parity gap root cause — PM execution plan table missing Platform column | [meeting-2026-06-05-antigravity-parity-gap-root-cause.md](archive/meeting-2026-06-05-antigravity-parity-gap-root-cause.md) |
| 2026-06-05 | Action item completeness review — C-01 L0→L1→L2 scope, A-00 and D-01 added | [meeting-2026-06-05-action-item-completeness-review.md](archive/meeting-2026-06-05-action-item-completeness-review.md) |
| 2026-06-21 | Pluggable variant audit hooks and pipeline integrity validation | [meeting-2026-06-21-variant-dev-sync-verification.md](meeting-2026-06-21-variant-dev-sync-verification.md) |
| 2026-06-21 | html-themes per-theme style restructure design — artifact ownership, target structure, 3-layer PDF merge | [meeting-2026-06-21-html-themes-per-theme-style-design.md](meeting-2026-06-21-html-themes-per-theme-style-design.md) |
| 2026-05-24 | Multi-agent analysis: 96 improvement opportunities identified | *(archived — file not preserved)* |

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
| ADR-0001 | Document Format Single Source of Truth | Accepted | [adr-0001-document-format-single-source-of-truth.md](archive/adr-0001-document-format-single-source-of-truth.md) |
| ADR-0044 | Pluggable Variant Audit Hooks and Pipeline Integrity Validation | Accepted | [0044-variant-specific-audit-hooks.md](../docs/adr/0044-variant-specific-audit-hooks.md) |
