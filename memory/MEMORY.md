# Memory Index

## Sessions

> Link-free rows are tombstones: their session logs were archived to `memory/archive/`, which is deliberately git-ignored (local preservation only — see docs/constitution/02-memory-system.md §2.3), so archive links would be dead on fresh clones.

| Date | Summary |
|------|---------|
| [2026-09-12](2026-09-12.md) | docs(consistency): resolve stale claims across upgrade-policy doc fleet (audit comment, non-goals, gitignore merge) |
| [2026-09-11](2026-09-11.md) | fix(review): project-review 2026-09-10 remediations — dead variant audit hook, rollback crash, PAT-in-URL, governance doc contradictions |
| [2026-09-10](2026-09-10.md) | docs(governance): Schema Governance ADR baseline + marker engine remediation |
| [2026-09-09](2026-09-09.md) | docs(governance): Schema Governance ADR baseline (design + implementation; pre-sync working tree) |
| [2026-09-08](2026-09-08.md) | fix(governance): template/lifecycle drift fixes from project review + co-price backport |
| [2026-09-07](2026-09-07.md) | docs: fix stale statuses, broken links, and governance gaps from project review |
| [2026-09-06](2026-09-06.md) | feat(skills): session-evidence skill review loop (SkillHone-inspired) |
| [2026-09-05](2026-09-05.md) | feat(skills): meeting-facilitation v1.4.1 governance rules + template skill drift sync |
| 2026-09-03 | feat: propagate k-opendata skill and DATA_GO_KR_API_KEY to templates/common |
| 2026-09-01 | docs(governance): add ADR-0065 accessibility standard for software feature development |
| 2026-08-30 | feat(skills): promote handbook and handbook-sync-audit skills from co-deck to common |
| 2026-08-29 | feat(skills+templates): co-safety glossary back-port, project README backlog, scripts/co-safety layout (F1-F3) |
| 2026-08-28 | fix(audit): skip untracked template variants in variant-scanning checks |
| 2026-08-27 | feat(workspace): language validator 1.7.0 variant-aware exemption + co-safety variant regen |
| 2026-08-11 | feat(scripts): make README generation reusable for Phase A variant scaffolds — generate-l2-readme.ts (new, v1.0.0), create-l2-scaffold v1.9.0, helpers/generate-variant v1.10.0, l2-to-variant-pipeline v1.10.2, create-variant skill v1.2.0 |
| 2026-06-25 | fix(co-deck): unify CSS variable names across styles, fix glass panel contrast, improve TOC visibility, add preview backgroundImage support |
| 2026-06-11 | GEMINI.md Claude-specific 콘텐츠 수정, L1 pm.md 중복 섹션 제거, generate-variant.ts Windows 경로 구분자 버그 수정, VARIANT-* 플레이스홀더 주입 정상화 |
| 2026-06-10 | chore: update |
| 2026-06-09 | fix: resolve Agent Roster table rendering bug in merge-frontmatter.ts |
| 2026-06-08 | Fix variant scaffolding validation failure |
| 2026-06-05 | Tier governance violation analysis |
| 2026-06-04 | feat: add tag-template.ts, template version mismatch warning, and audit tag check |
| 2026-06-03 | chore: update |
| 2026-06-02 | fix: Limit changes to workspace root and templates to fix L0/L1 and phase definitions |
| 2026-06-01 | fix: create tests/.temp scratchpad and cleanup root stray files |
| 2026-05-31 | Comprehensive workspace improvement plan — 28 Critical, 43 High, 46 Moderate issues identified across 3 phases |
| 2026-05-29 | fix: UTF-8 BOM for ps1 emoji scripts, validate-templates workspace guard, register new ts scripts in SCRIPTS.md |
| 2026-05-28 | PM-led 3-tier parallel agent execution: platform parity, upgrade-project, docs-writer promotion, Security Bootstrap, CONSTITUTION §10 Terminology |
| 2026-05-23 | feat: align markdown files with CONSTITUTION.md standards |
| 2026-05-24 | feat: Refactor PM to 3-tier agent strategy and repair Windows terminal CP949 encoding corruptions |
| 2026-05-25 | feat: align template with hybrid scripting standards |
| 2026-05-26 | feat: implement agent lifecycle management and sync template agent references |
| 2026-05-27 | feat: script lifecycle management + context.md two-layer structure |

## Meetings

| Date | Topic | File |
|------|-------|------|
| 2026-05-31 | Model name SSOT dispersion problem resolution — agents/*.md as SSOT, workspace-schema.json models block planned | *(archived — local only)* |
| 2026-05-30 | Command Documentation Inconsistency | *(archived — local only)* |
| 2026-05-30 | C-SK-02 Resolution Plan — Variant PM Migration | *(archived — local only)* |
| 2026-05-30 | Common PM Skeleton Design — Baseline Methodology | *(archived — local only)* |
| 2026-05-30 | Common Lifecycle Governance Deep Dive v2 | *(archived — local only)* |
| 2026-05-30 | Common Skills and Agents Central Management Governance | *(archived — local only)* |
| 2026-05-30 | Project Review Skill Design v2 — Naming and Scaffolding | *(archived — local only)* |
| 2026-05-30 | Workspace Review Skill Design | *(archived — local only)* |
| 2026-05-30 | SSOT Design for Phase Numbering Schema | *(archived — local only)* |
| 2026-05-30 | Phase 1/2/3 Root Cause Analysis and Prevention Measures | *(archived — local only)* |
| 2026-05-30 | Inline Roleplay Adoption | *(archived — local only)* |
| 2026-05-30 | Meeting Skill Improvements | *(archived — local only)* |
| 2026-05-30 | Scaffolding TypeScript Migration | *(archived — local only)* |
| 2026-05-29 | Review of PM Agent Facilitator Transition Implementation | *(archived — local only)* |
| 2026-05-29 | 7-item system improvement plan — PM workflow, 3-tier todo, lifecycle docs, skill audit, file structure | *(archived — local only)* |
| 2026-05-29 | lifecycle-manager scope reduction — secretary role, L0+L1 dual deployment | *(archived — local only)* |
| 2026-05-29 | Lifecycle manager agent — new dedicated agent proposal unanimously agreed | *(archived — local only)* |
| 2026-05-29 | Lifecycle governance audit review — 7 issues, C-01~C-07 remediation plan | *(archived — local only)* |
| 2026-05-29 | Open items resolution — audit.sh thin wrapper sequence, agents/README policy | *(archived — local only)* |
| 2026-05-29 | Comprehensive review — co-security, lifecycle governance, 2-Tier script strategy | *(archived — local only)* |
| 2026-05-29 | Antigravity migration and PM hook | *(archived — local only)* |
| 2026-05-29 | Docs folder restructure | *(archived — local only)* |
| 2026-05-29 | Gemini transcript and PM plan display | *(archived — local only)* |
| 2026-05-29 | New project test sync | *(archived — local only)* |
| 2026-05-29 | NTRC execution conflict analysis | *(archived — local only)* |
| 2026-05-29 | PM mandatory gateway policy | *(archived — local only)* |
| 2026-05-29 | Script conversion strategy | *(archived — local only)* |
| 2026-05-29 | Script policy violation and template cleanup | *(archived — local only)* |
| 2026-05-29 | .sh/.ps1 parity enforcement | *(archived — local only)* |
| 2026-05-29 | Templates common contamination | *(archived — local only)* |
| 2026-05-29 | Variant docs migration and scripts tier | *(archived — local only)* |
| 2026-05-28 | Script pair sync gap — intentional drift policy flaw in .sh/.ps1 horizontal sync | *(archived — local only)* |
| 2026-05-28 | Cross-platform parity gap in /meeting skill — root .gemini/commands missing | *(archived — local only)* |
| 2026-05-28 | Unified lifecycle governance structure across workspace root and templates | *(archived — local only)* |
| 2026-05-28 | Template lifecycle ↔ Script lifecycle integration review | *(archived — local only)* |
| 2026-05-28 | Variant structural gaps improvement plan meeting | *(archived — local only)* |
| 2026-05-28 | Kanban process and system design for current and new projects — **SUPERSEDED 2026-07-16** by the Service Ticket + Kanban design (meeting notes removed in the 7c8a2f8d memory cleanup) | *(archived — local only)* |
| 2026-05-28 | Encoding and README sync review | *(archived — local only)* |
| 2026-05-28 | Implementation direction for platform parity, upgrade-project, and team role changes | *(archived — local only)* |
| 2026-05-28 | Team composition review and project improvement roadmap meeting | *(archived — local only)* |
| 2026-05-28 | Co-security rebuild | *(archived — local only)* |
| 2026-05-28 | Script lifecycle integration | *(archived — local only)* |
| 2026-05-28 | Variant plan review (2nd round) | *(archived — local only)* |
| 2026-05-28 | Variant plan review | *(archived — local only)* |
| 2026-05-28 | Script migration strategy | *(archived — local only)* |
| 2026-05-27 | CONSTITUTION.md hub-and-spoke restructure proposal | *(archived — local only)* |
| 2026-05-27 | Doc format best practices | *(archived — local only)* |
| 2026-05-27 | Template lifecycle review | *(archived — local only)* |
| 2026-05-27 | Script lifecycle + context.md structure | *(archived — local only)* |
| 2026-05-27 | Workspace root and template lifecycle management review | *(archived — local only)* |
| 2026-05-27 | Antigravity support | *(archived — local only)* |
| 2026-05-27 | Architectural refinements | *(archived — local only)* |
| 2026-05-27 | Compliance improvements | *(archived — local only)* |
| 2026-05-27 | README sync | *(archived — local only)* |
| 2026-05-27 | PS1 parse error | *(archived — local only)* |
| 2026-05-27 | chmod fix | *(archived — local only)* |
| 2026-06-05 | Tier governance violation analysis — automation-engineer High tier breach, architect Phase 1-2 bypass | *(archived — local only)* |
| 2026-06-05 | Tier governance L0→L1→L2 propagation strategy — principles vs specialist-list separation | *(archived — local only)* |
| 2026-06-05 | Antigravity parity gap root cause — PM execution plan table missing Platform column | *(archived — local only)* |
| 2026-06-05 | Action item completeness review — C-01 L0→L1→L2 scope, A-00 and D-01 added | *(archived — local only)* |
| 2026-06-21 | Pluggable variant audit hooks and pipeline integrity validation | meeting notes removed in the 7c8a2f8d memory cleanup |
| 2026-06-21 | html-themes per-theme style restructure design — artifact ownership, target structure, 3-layer PDF merge | meeting notes removed in the 7c8a2f8d memory cleanup |
| 2026-05-24 | Multi-agent analysis: 96 improvement opportunities identified | *(archived — file not preserved)* |

## ADRs

| ID | Title | Status | File |
|----|-------|--------|------|
| ADR-0001 | Document Format Single Source of Truth | Accepted | *(archived — local only)* |
| ADR-0044 | Pluggable Variant Audit Hooks and Pipeline Integrity Validation | Accepted | [0044-variant-specific-audit-hooks.md](../docs/adr/0044-variant-specific-audit-hooks.md) |
