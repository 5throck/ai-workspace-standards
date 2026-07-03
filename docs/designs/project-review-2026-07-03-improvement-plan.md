# Improvement Plan — Project Review 2026-07-03

**Date**: 2026-07-03
**Source**: Meeting transcript `memory/meeting-2026-07-03-project-review-improvement-planning.md`
**Review Type**: Full project review (7 agents, parallel dispatch)
**Project**: ai_workspace (L0 Workspace Root)
**Status**: Approved

---

## Executive Summary

A comprehensive parallel review of the ai_workspace was conducted on 2026-07-03 using 7 specialist agents. The review identified **8 Critical, 18 High, and 18 Moderate issues** across Architecture, Standards Compliance, Automation, Documentation, Security, Lifecycle, and Scaffolding domains. The workspace demonstrates **12 confirmed strengths** including robust governance architecture, excellent secret scanning coverage, and comprehensive lifecycle tracking.

This improvement plan synthesizes the review findings and meeting discussion into a prioritized, phased execution strategy.

---

## Issue Distribution by Domain

| Domain | Critical | High | Moderate | Strengths |
|--------|:--------:|:----:|:--------:|:--------:|
| Architecture | 2 | 4 | 5 | 2 |
| Automation | 3 | 4 | 4 | 3 |
| Documentation | 2 | 3 | 3 | 5 |
| Security | 0 | 3 | 7 | 9 |
| Lifecycle | 2 | 3 | 4 | 4 |
| Scaffolding | 0 | 1 | 0 | 1 |
| Standards (Auditor) | 0 | 1 | 2 | 0 |
| **Total** | **8** | **18** | **18** | **12** |

---

## Batch 1 — Critical (Week 1)

### B1-01: Create tsconfig.json
- **Agent**: automation-engineer | **Tier**: Low | **Phase**: 4
- **Issue**: No TypeScript configuration for 96 scripts
- **Action**: Create `tsconfig.json` with `strict: true`, proper `include`/`exclude` boundaries
- **Acceptance**: `bun scripts/audit.ts` passes with tsconfig present

### B1-02: Remove Unused Dependencies + Add import.meta.main Guards
- **Agent**: automation-engineer | **Tier**: Low | **Phase**: 4
- **Issues**: playwright, @resvg/resvg-js unused in production; 51 scripts have unsafe process.exit()
- **Action**: Remove unused deps, wrap all process.exit() in `if (import.meta.main)` guards
- **Acceptance**: `grep -v "import.meta.main" scripts/*.ts | grep "process.exit"` returns empty

### B1-03: Resolve Variant Contract Contradictions
- **Agent**: architect | **Tier**: High | **Phase**: 2
- **Issues**: CLAUDE.md/GEMINI.md in blocklist AND Required; lifecycle-manager.md Required but L0-only
- **Action**: Remove CLAUDE.md/GEMINI.md from blocklist → promote to common_files; remove lifecycle-manager.md from Required Files; update variant-contract.md accordingly
- **Acceptance**: `bun scripts/validate-templates.ts` passes for all 6 variants

### B1-04: Create 5 Missing Skill Lifecycle Records
- **Agent**: lifecycle-manager | **Tier**: Medium | **Phase**: 5
- **Issues**: create-variant, project-review, promote-variant, team-builder, translate have no lifecycle docs
- **Action**: Create lifecycle records following `docs/lifecycle/README.md` template
- **Acceptance**: All 5 records exist with required sections (Creation Date, Phase History, Acceptance Criteria)

### B1-05: Fix VERSION_MANIFEST Parsing
- **Agent**: lifecycle-manager | **Tier**: Medium | **Phase**: 5
- **Issues**: qa-gate.ts and validate-model-registry.ts versions not captured; 2 ghost records
- **Action**: Fix `generate-version-manifest.ts` parsing; remove ghost records (skill-modification-checklist, ui-ux-pro-max)
- **Acceptance**: Re-generated manifest captures all script versions

---

## Batch 2 — High (Week 2)

### B2-01: Fix L0→L1 Propagation Pipeline
- **Agent**: automation-engineer + scaffolding-expert | **Tier**: Low | **Phase**: 4
- **Issue**: 13 L0+L1 scripts missing from templates/common/scripts/ subdirectories
- **Action**: Fix `propagate-to-templates.ts` subdirectory recursion; add dry-run verification; run validate-templates.ts after fix
- **Acceptance**: All L0+L1 scripts present in templates/common/

### B2-02: Security Hardening
- **Agent**: security-expert | **Tier**: Medium | **Phase**: 6
- **Issues**: Pre-rebase bypass env var; bun.lock tracking; CVE override documentation; pre-rebase executable bit
- **Action**: Remove REBASE_BYPASS_SECRET_SCAN; verify bun.lock in git; add CVE comments to package.json overrides; chmod +x pre-rebase
- **Acceptance**: No bypass mechanism exists; bun.lock tracked; overrides documented

### B2-03: Documentation Reorganization
- **Agent**: docs-writer | **Tier**: Medium | **Phase**: 4
- **Issues**: CHANGELOG.md unstructured; AGENTS.md broken anchor; frontmatter inconsistency; Korean text exception undocumented
- **Action**: Reorganize CHANGELOG into semver sections; fix anchor; standardize quoting; add exception note; create docs/index.md
- **Acceptance**: CHANGELOG has proper version headers; all links resolve

### B2-04: Script Quality Standardization
- **Agent**: automation-engineer | **Tier**: Low | **Phase**: 4
- **Issues**: Shebang inconsistency (3 patterns); empty catch blocks; mixed import extensions
- **Action**: Standardize to `#!/usr/bin/env bun`; add error logging to empty catches; standardize to `.ts` extensions
- **Acceptance**: Single shebang pattern; no empty catches; consistent extensions

### B2-05: Encoding Safety + Template Tooling
- **Agent**: scaffolding-expert | **Tier**: Low | **Phase**: 4
- **Issues**: Sub-scripts lack UTF-8 enforcement; .editorconfig/.gitattributes missing from variants
- **Action**: Add CP949 protection to sub-scripts; add .editorconfig/.gitattributes to common layer and variant contract
- **Acceptance**: All file-writing scripts have UTF-8 enforcement; template files present

### B2-06: Cross-Document Consistency Verification
- **Agent**: auditor | **Tier**: Medium | **Phase**: 6
- **Issue**: Tier/Model mapping may differ across AGENTS.md, CLAUDE.md, GEMINI.md
- **Action**: Cross-verify all dispatch tables; fix any inconsistencies
- **Acceptance**: All three files have identical agent/tier/model mappings

---

## Deferred — Requires ADR

### D-01: Phase Renumbering Strategy
- **Agent**: architect | **Tier**: High | **Phase**: 1-2
- **Issue**: Phase numbering differs between workspace-schema.json ("1-2" combined) and variants (split, shifted)
- **Decision needed**: Unify to 7 explicit numbers in schema vs align variants
- **Dependencies**: Requires ADR before implementation
- **Timeline**: Week 3+

---

## Finalization

### After All Batches
- **PM**: Run `/sync "fix(project-review): execute improvement plan from review meeting"`
- **Auditor**: Execute `bun scripts/qa-gate.ts` for full validation
- **Lifecycle Manager**: Update governance records for all changed artifacts

---

## Review Strengths (Preserved)

| # | Strength | Domain |
|---|----------|--------|
| 1 | L0→L1→L2→L3 layer architecture with anti-swelling rule | Architecture |
| 2 | 32 active ADRs with proper Context/Decision/Consequences | Architecture |
| 3 | 3-layer secret scanning (pre-commit, pre-push, pre-rebase) + gitleaks + regex fallback | Security |
| 4 | Minimal CI permissions (contents: read, checks: write only) | Security |
| 5 | Exponential backoff retry handler with error classification | Automation |
| 6 | 5 TypeScript hooks covering full Git lifecycle | Automation |
| 7 | 8/8 agents have lifecycle records with phase history | Lifecycle |
| 8 | 103 scripts registered in SCRIPTS.md with version/status/layer | Lifecycle |
| 9 | Zero Korean content outside ko/ and locales/ zones | Documentation |
| 10 | 8/8 agent files match AGENTS.md roster — zero orphans | Documentation |
| 11 | Zero hardcoded secrets found in full scan | Security |
| 12 | Zero eval() usage — clean input separation | Security |
