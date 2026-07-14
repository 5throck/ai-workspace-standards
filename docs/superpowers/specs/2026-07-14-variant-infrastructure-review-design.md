# Variant Infrastructure Comprehensive Review — Design Document

**Date**: 2026-07-14
**Scope**: Static Analysis + Gap Analysis (Phase 1 & Phase 3 of full review)
**Target**: All 7 variant templates + upgrade-project.ts + related infrastructure
**Approach**: Bottom-Up, Phase A/B/C → L3 Upgrade → Gap classification

---

## §1: Review Objectives

1. **Static Analysis**: Validate structural integrity of all 7 variant templates and the upgrade mechanism without executing pipelines
2. **Gap Analysis**: Identify and classify all gaps (Critical/Major/Minor) in the variant creation, promotion, and upgrade infrastructure
3. **Documentation**: Produce actionable recommendations and a project upgrade guide

## §2: Scope

### In Scope
- `templates/common/` — L1 base template
- `templates/co-consult/`, `co-deck/`, `co-design/`, `co-develop/`, `co-game/`, `co-security/`, `co-work/` — L2 variants
- `scripts/upgrade-project.ts` (v1.2.2) — L3 project upgrade mechanism
- `scripts/create-l2-scaffold.ts` (v1.6.4) — Phase A scaffold engine
- `scripts/l2-to-variant-pipeline.ts` (v1.9.0) — Phase B promotion pipeline
- `scripts/project-to-variant.ts` (v1.0.2) — Direct conversion
- `scripts/propagate-to-templates.ts` (v2.3.0) — L0→L1 propagation
- `scripts/validate-templates.ts` (v1.5.13) — Template validation
- `scripts/variant-feature.ts` (v1.0.0) — Variant feature addition
- `scripts/helpers/registries/` — Variant type, promotion policy, governance rules
- `scripts/helpers/plugins/` — Plugin system
- `skills/create-variant/` and `skills/promote-variant/` — SKILL.md guides
- `agents/scaffolding-expert.md` — Agent definition

### Out of Scope (Deferred to Separate Session)
- Dynamic E2E testing (Phase 2): actual execution of scaffold, promote, new-project, upgrade pipelines
- Implementation of fixes or new features

---

## §3: Phase 1 — Static Analysis Checklist

### 1.1 Template Validation
- [ ] Run `bun scripts/validate-templates.ts` — capture full output
- [ ] Record all errors, warnings, and info messages
- [ ] Cross-reference with expected check types (20+ checks documented)

### 1.2 variant.json Manifest Integrity
For each of 7 variants:
- [ ] `name` matches directory name
- [ ] `variant_type` is registered in `variant-type-registry.ts`
- [ ] `status` is valid (draft/beta/stable/deprecated)
- [ ] `lifecycle.statusSince`, `lastTransition` populated
- [ ] `agents[]` entries match actual `agents/*.md` files
- [ ] `skills[]` entries match actual skill files (if any)
- [ ] `inherits_common` points to correct path

### 1.3 AGENTS.md Roster Consistency
For each of 7 variants:
- [ ] Agent roster table matches actual `agents/` directory contents
- [ ] No phantom entries (listed but file missing)
- [ ] No orphan files (file exists but not in roster)

### 1.4 pm.md Structure Validation
For each of 7 variants:
- [ ] Contains `extends:` YAML frontmatter pointing to common pm.md
- [ ] Body length ≤ 200 lines (pipeline pre-flight requirement)
- [ ] No duplicate sections (e.g., duplicate "Responsibilities")
- [ ] `variant_overrides` block present if variant-specific config needed
- [ ] No L0-only content (lifecycle-manager, auditor references)

### 1.5 WORKSPACE_ONLY_FILES Contamination
Check all 7 variants for presence of:
- [ ] `package.json`, `package-lock.json`, `bun.lock`
- [ ] `propagation-map.json`
- [ ] `variant.json` (should be in template root, not in projects)

### 1.6 Platform Parity
For each of 7 variants:
- [ ] CLAUDE.md and GEMINI.md have identical heading structure
- [ ] `.claude/` and `.gemini/` directory structures mirror each other
- [ ] Platform-specific skill/command files present in both locations

### 1.7 SKILL.md Coverage
- [ ] `create-variant` has SKILL.md → ✅ confirmed
- [ ] `promote-variant` has SKILL.md → ✅ confirmed
- [ ] `project-to-variant.ts` has NO SKILL.md → ⚠️ gap
- [ ] `variant-feature.ts` has NO SKILL.md → ⚠️ gap
- [ ] `upgrade-project.ts` has NO SKILL.md → ⚠️ gap
- [ ] Variant-specific skills are guided by SKILL.md

### 1.8 Variant-Type-Registry Alignment
- [ ] `co-consult` → type "consulting" → registered ✅
- [ ] `co-deck` → type "design" → registered ✅ (but `--domain deck` flag exists)
- [ ] `co-design` → type "design" → registered ✅
- [ ] `co-develop` → type "development" → registered ✅
- [ ] `co-game` → type "game" → registered ✅
- [ ] `co-security` → type "security" → registered ✅
- [ ] `co-work` → type "collaboration" → registered ✅
- [ ] `lecture` → registered but NO template ⚠️

### 1.9 upgrade-project.ts Structural Review
Code review of `scripts/upgrade-project.ts`:
- [ ] LOCKED files list completeness (git hooks, gitleaks, gitattributes)
- [ ] MERGE files list alignment with actual template structure
- [ ] SYNC_IF_NEWER version comparison correctness (semver logic)
- [ ] Script subdirectory allowlist (`['', 'hooks', 'lib', 'helpers']`) completeness
- [ ] Agent MERGE list completeness
- [ ] PRESERVE allowlist completeness (README, context.md, src/)
- [ ] Security bootstrap verification checks
- [ ] Error handling robustness

### 1.10 WORKSPACE-MANAGED Marker Alignment
- [ ] Verify all MERGE-eligible files in common template contain `<!-- WORKSPACE-MANAGED -->` markers
- [ ] Check that marker format is consistent across files
- [ ] Identify any files that should have markers but don't

---

## §4: Phase 3 — Gap Analysis Framework

### Gap Severity Classification

| Severity | Definition | Action |
|----------|-----------|--------|
| **Critical** | Breaks core workflow (scaffold/promote/upgrade fails) | Must fix before next release |
| **Major** | Missing functionality that limits usability | Plan fix in next sprint |
| **Minor** | Improvements, code quality, documentation gaps | Backlog |

### Known Preliminary Gaps (from exploration)

| ID | Area | Gap | Preliminary Severity |
|----|------|-----|---------------------|
| G01 | Plugins | Only 1/7 variant type plugins implemented (GamePlugin only) | Minor |
| G02 | Skills | project-to-variant.ts has no SKILL.md | Major |
| G03 | Skills | variant-feature.ts has no SKILL.md | Major |
| G04 | Skills | upgrade-project.ts has no SKILL.md | Major |
| G05 | Pipeline | autoFixPmMd not implemented (placeholder warning) | Minor |
| G06 | Registry | co-deck uses `--domain deck` flag, not registered type | Minor |
| G07 | Registry | 'lecture' type registered but no template exists | Minor |
| G08 | Upgrade | No three-way merge for locally modified files | Major |
| G09 | Upgrade | No handling of deleted template files in L3 | Minor |
| G10 | Upgrade | Hardcoded file lists (agents, scripts) require manual maintenance | Minor |
| G11 | Upgrade | No built-in rollback (stash exists but no --rollback flag) | Minor |
| G12 | L1→L2 | No automated drift enforcement in CI | Minor |
| G13 | Governance | Phase 7 deprecated without verified replacement completeness | Minor |

### Analysis Deliverables

| # | Deliverable | Format | Location |
|---|------------|--------|----------|
| D1 | Full gap report with severity classification | Markdown table | Inline in review report |
| D2 | upgrade-project.ts limitations analysis | Structured analysis | Inline in review report |
| D3 | Plugin implementation priority recommendation | Ordered list | Inline in review report |
| D4 | Project upgrade procedure manual | Markdown guide | `docs/project-upgrade-guide.md` |
| D5 | Variant conversion procedure manual | Markdown guide | `docs/variant-conversion-guide.md` |
| D6 | Comprehensive review report | Full report | `docs/variant-review-report-2026-07-14.md` |

---

## §5: Execution Plan (This Session)

### Execution Order: Sequential

| # | Task | Method |
|---|------|--------|
| 1.1 | Run validate-templates.ts | Bash |
| 1.2-1.8 | Per-variant static checks (manifest, roster, pm.md, contamination, parity, SKILL.md, registry) | Agent (parallel per variant) |
| 1.9 | upgrade-project.ts code review | Agent |
| 1.10 | WORKSPACE-MANAGED marker audit | Agent |
| 3.1 | Gap classification (validate/update preliminary gaps) | Analysis |
| 3.2-3.13 | Gap deep-dive for each identified gap | Agent |
| D1-D6 | Documentation deliverables | docs-writer (via PM dispatch) |

### Success Criteria

| Criterion | Threshold |
|-----------|-----------|
| validate-templates.ts | 0 critical errors |
| Critical gaps | 0 |
| All 7 variants pass manifest check | Yes |
| upgrade-project.ts structural review | No logical bugs in semver/merge logic |
| Documentation | All deliverables (D1-D6) produced |
