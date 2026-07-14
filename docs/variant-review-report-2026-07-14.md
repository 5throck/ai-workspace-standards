# Variant Infrastructure Comprehensive Review Report

**Date**: 2026-07-14
**Scope**: Static Analysis + Gap Analysis (Phase 1 & Phase 3)
**Target**: All 7 variant templates + upgrade-project.ts + related infrastructure
**Method**: Bottom-Up, Phase A/B/C → L3 Upgrade → Gap classification

---

## §1: Executive Summary

| Metric | Value |
|--------|-------|
| validate-templates.ts errors | **0** |
| validate-templates.ts warnings | **4** (empty skills/ dirs: co-design, co-develop, co-game, co-work) |
| Critical gaps identified | **1** |
| Major gaps identified | **4** |
| Minor gaps identified | **10** |
| Variant templates with contamination | **2/7** (co-consult, co-deck) |
| WORKSPACE-MANAGED markers in templates | **0** (entire MERGE mechanism is dead code) |

### Key Findings

1. **All 7 variants pass validate-templates.ts** — structural integrity is solid at the governance level.
2. **WORKSPACE-MANAGED markers are completely absent from all templates** — the upgrade-project.ts MERGE mechanism is effectively dead code. This is the most significant finding.
3. **2 variants have WORKSPACE_ONLY_FILES contamination** (co-consult: package.json + bun.lock + node_modules; co-deck: package.json + node_modules).
4. **upgrade-project.ts has 4 stale agent references** in its MERGE list that don't exist in any template.
5. **SKILL.md coverage gaps** for 3 scripts (project-to-variant.ts, variant-feature.ts, upgrade-project.ts).
6. **Plugin system** is only 1/7 implemented (GamePlugin).

---

## §2: Phase 1 — Static Analysis Results

### 2.1 validate-templates.ts (Check 1.1)

**Result**: ✅ 0 errors, 4 warnings

All 7 variants pass the full suite of 20+ checks including:
- D-04: Lifecycle governance ✅
- Variant Contract compliance (9/9 required files) ✅ for all 7
- Agent frontmatter validation ✅ for all agents across all variants
- AGENTS.md roster matches filesystem ✅ for all 7
- Workspace-root agent intrusion detection ✅ for all 7
- Workspace schema consistency (WS-01 through WS-06) ✅
- Common-contract compliance (WS-02, WS-03) ✅
- Shared file sync (L0↔L1) ✅ for 57+ scripts
- Platform Documentation Parity (P-01) ✅
- Root↔Common Commands Parity (P-02) ✅

**4 Warnings**: `co-design/skills/`, `co-develop/skills/`, `co-game/skills/`, `co-work/skills/` contain no skill directories. These are informational — these variants rely on common skills and platform-specific `.claude/skills/`/`.gemini/skills/` only.

### 2.2 variant.json Manifest Integrity (Check 1.2)

| Variant | name match | variant_type | status | lifecycle | agents | skills | inherits_common |
|---------|-----------|-------------|--------|-----------|--------|--------|-----------------|
| co-consult | ✅ | `consulting` ✅ | stable | ✅ | 10 | 13 | `templates/common` |
| co-deck | ✅ | `lecture` ✅ | beta | ✅ | 11 | 7 | `templates/common` |
| co-design | ✅ | `design` ✅ | stable | ✅ | 7 | 0 | `templates/common` |
| co-develop | ✅ | `development` ✅ | stable | ✅ | 6 | 0 | `templates/common` |
| co-game | ✅ | `game` ✅ | beta | ✅ | 12 | 0 | `templates/common` |
| co-security | ✅ | `security` ✅ | stable | ✅ | 5 | 1 | `templates/common` |
| co-work | ✅ | `collaboration` ✅ | stable | ✅ | 6 | 0 | `templates/common` |

All 7 registered types have a corresponding template. The naming mapping is:

| Registry Type | Template Directory |
|---------------|-------------------|
| `security` | co-security |
| `development` | co-develop |
| `design` | co-design |
| `consulting` | co-consult |
| `collaboration` | co-work |
| `lecture` | co-deck |
| `game` | co-game |

**Note**: `co-deck` uses `variant_type: "lecture"` — the `--domain deck` shorthand in create-l2-scaffold.ts maps to the `lecture` registry type internally. No orphaned types.

**Discrepancies found**:
- co-consult: `md-to-report.ts` exists on disk but is NOT declared in `script_manifest`
- co-deck: 6+ scripts on disk (build-theme-deck.ts, build-theme-preview.ts, etc.) NOT declared in `script_manifest.local`

### 2.3 AGENTS.md Roster Consistency (Check 1.3)

| Variant | Roster Count | Filesystem Match | Phantom | Orphan |
|---------|-------------|-------------------|---------|--------|
| co-consult | 11 | ✅ | 0 | 0 |
| co-design | 8 | ✅ | 0 | 0 |
| co-develop | 7 | ✅ | 0 | 0 |
| co-game | (not separately checked) | ✅ (via validator) | 0 | 0 |
| co-security | 6 | ✅ | 0 | 0 |
| co-work | 7 | ✅ | 0 | 0 |

All variants have perfect roster-filesystem alignment.

### 2.4 pm.md Structure Validation (Check 1.4)

| Variant | Has extends | Line count | ≤200? | Duplicates? | L0-only refs? |
|---------|-------------|-----------|-------|-------------|---------------|
| co-consult | ✅ `../../common/agents/pm.md` | 0 | ✅ | None | None |
| co-deck | ✅ | 0 | ✅ | None | None |
| co-design | ✅ | 0 | ✅ | None | None |
| co-develop | ✅ | 0 | ✅ | None | None |
| co-game | ✅ | 26 | ✅ | None | None |
| co-security | ✅ | 0 | ✅ | None | None |
| co-work | ✅ | 0 | ✅ | None | None |

All pm.md files pass. 6/7 have zero body content (pure extends), 1 (co-game) has 26 lines of variant-specific overrides.

### 2.5 WORKSPACE_ONLY_FILES Contamination (Check 1.5)

| Variant | Status | Contaminated Files |
|---------|--------|-------------------|
| co-consult | ⚠️ **CONTAMINATED** | `package.json`, `bun.lock`, `node_modules/` (59 packages) |
| co-deck | ⚠️ **CONTAMINATED** | `package.json`, `node_modules/` (10 packages) |
| co-design | ✅ Clean | — |
| co-develop | ✅ Clean | — |
| co-game | ✅ Clean | — |
| co-security | ✅ Clean | — |
| co-work | ✅ Clean | — |

### 2.6 Platform Parity (Check 1.6)

| Variant | Heading parity | Dir parity | Commands parity | Skills parity |
|---------|---------------|-------------|----------------|---------------|
| co-consult | N/A (no CLAUDE/GEMINI.md) | ⚠️ Mismatch (empty .claude/commands/) | N/A | ✅ 18/18 |
| co-deck | N/A | ⚠️ Mismatch (empty .claude/commands/) | N/A | ✅ 10/10 |
| co-design | N/A | ⚠️ Mismatch (empty .claude/commands/) | N/A | ✅ 5/5 |
| co-develop | N/A | ✅ Match | ✅ 1/1 | ✅ 7/7 |
| co-game | N/A | ⚠️ Near-match (settings.local.json only in .claude) | ✅ 1/1 | ✅ 17/17 |
| co-security | N/A | ✅ Match | ✅ 1/1 | ✅ 5/5 |
| co-work | N/A | ⚠️ Mismatch (empty .claude/commands/) | N/A | ✅ 6/6 |

**Key observations**:
- No variant has CLAUDE.md or GEMINI.md (these are generated at project creation time by new-project.ts from context.md templates)
- Skills parity is 100% across all 7 variants
- 4 variants have empty `.claude/commands/` with no `.gemini/commands/` counterpart
- Minor file asymmetries: co-consult has `template-version.txt` (only .claude) and `settings.json.bak` (only .gemini); co-game has `settings.local.json` (only .claude)

### 2.7 SKILL.md Coverage (Check 1.7)

| Script/Tool | Has SKILL.md? | Status |
|-------------|--------------|--------|
| create-variant (create-l2-scaffold.ts) | ✅ Yes (v1.0.1) | Guides PM through Phase A |
| promote-variant (l2-to-variant-pipeline.ts) | ✅ Yes (v1.0.1) | Guides PM through Phase B |
| project-to-variant.ts | ❌ **No** | Unguided — PM has no workflow document |
| variant-feature.ts | ❌ **No** | Unguided — CLI only, no PM workflow |
| upgrade-project.ts | ❌ **No** | Hidden L0-only tool, no discoverability |

### 2.8 Variant-Type-Registry Alignment (Check 1.8)

**All 7 types registered and mapped.** The initial concern about 'deck' not being registered and 'lecture' having no template was resolved: `co-deck` uses `variant_type: "lecture"`, and the `deck` shortname in create-l2-scaffold.ts maps to this type internally.

### 2.9 upgrade-project.ts Structural Review (Check 1.9)

**Version**: v1.2.2

| Category | Findings |
|----------|----------|
| **LOCKED files** | 9 items (6 git hooks + .gitattributes + .gitleaks.toml). Coverage looks appropriate. |
| **MERGE files** | **CRITICAL ISSUE**: Zero `<!-- WORKSPACE-MANAGED -->` markers exist in any template file. The entire merge mechanism is dead code. |
| **Stale MERGE references** | 4 agent files in MERGE list don't exist in any template: `automation-engineer.md`, `docs-writer.md`, `scaffolding-expert.md`, `security-expert.md` |
| **SYNC_IF_NEWER logic** | Semver comparison via `// @version X.Y.Z` for scripts, YAML frontmatter for agents/skills. Logic appears correct. |
| **Script subdirs** | Hardcoded `['', 'hooks', 'lib', 'helpers']`. No mechanism for auto-discovery of new subdirs. |
| **Agent MERGE list** | Hardcoded list of 7 agent files (4 stale). Not auto-discovered. |
| **PRESERVE list** | README.md, README_ko.md, docs/context.md, src/. Appropriate. |
| **Security bootstrap** | Post-upgrade verification of gitleaks, hooks, gitattributes, gitignore. Includes auto-fix for core.hooksPath. |
| **Conflict handling** | No 3-way merge. Template always wins for SYNC files. WORKSPACE-MANAGED markers protect user content in MERGE files (but markers don't exist). Recovery via git stash only. |
| **Deleted files** | Not handled. If L1 removes a file, it stays in L2 forever. |

### 2.10 WORKSPACE-MANAGED Marker Audit (Check 1.10)

| File (in MERGE list) | In templates/common/? | Has markers? |
|---------------------|----------------------|-------------|
| CLAUDE.md | ✅ Yes | ❌ **NO** |
| GEMINI.md | ✅ Yes | ❌ **NO** |
| CONSTITUTION.md | ❌ Not in templates | N/A (only at L0 root) |
| .gitignore | ✅ Yes | ❌ **NO** |
| agents/pm.md | ✅ Yes | ❌ **NO** |
| agents/architect.md | ❌ Not in common | N/A (variant-specific only) |
| agents/automation-engineer.md | ❌ **Doesn't exist anywhere** | Stale reference |
| agents/docs-writer.md | ❌ **Doesn't exist anywhere** | Stale reference |
| agents/scaffolding-expert.md | ❌ **Doesn't exist anywhere** | Stale reference |
| agents/security-expert.md | ❌ **Doesn't exist anywhere** | Stale reference |

**Result**: ZERO `<!-- WORKSPACE-MANAGED -->` markers exist anywhere in `templates/common/` or any variant template. The MERGE tier of upgrade-project.ts is entirely non-functional.

---

## §3: Gap Analysis

### 3.1 Gap Classification

#### 🔴 Critical (1)

| ID | Area | Gap | Impact | Recommended Fix |
|----|------|-----|--------|-----------------|
| **G01** | upgrade-project.ts | **WORKSPACE-MANAGED markers completely absent from all templates** — the MERGE mechanism that should allow safe section-based updates to CLAUDE.md, GEMINI.md, .gitignore, and pm.md is dead code. Template updates to these critical files NEVER propagate to existing L2/L3 projects. | During project upgrade, MERGE-listed files are silently skipped. Critical template improvements (security patterns, agent behavior changes, governance updates) cannot reach downstream projects without manual copy. | Add `<!-- WORKSPACE-MANAGED -->...<!-- /WORKSPACE-MANAGED -->` markers to appropriate sections in templates/common/ CLAUDE.md-equivalent (context.md template), .gitignore, and agents/pm.md. Also remove 4 stale agent references from MERGE list. |

#### 🟡 Major (4)

| ID | Area | Gap | Impact | Recommended Fix |
|----|------|-----|--------|-----------------|
| **G02** | Skills | project-to-variant.ts has no SKILL.md | PM has no guided workflow for converting existing projects to variants. Only the promote-variant skill (for Phase A→Phase B) is documented. | Create `skills/project-to-variant/SKILL.md` with a step-by-step PM workflow. |
| **G03** | Skills | variant-feature.ts has no SKILL.md | PM has no guided workflow for adding features to existing variants via the CLI tool. | Create `skills/variant-feature/SKILL.md` or integrate into create-variant skill. |
| **G04** | Skills | upgrade-project.ts has no SKILL.md | The upgrade tool is undiscoverable — PMs and project owners don't know it exists. No recommended usage pattern or decision tree. | Create `skills/upgrade-project/SKILL.md` documenting when and how to use the upgrade tool. |
| **G05** | upgrade-project.ts | No 3-way merge for locally modified SYNC files — template always wins, local changes silently lost | If a project owner modified a script or agent that also gets a template update, their modifications are overwritten. The only recovery is `git stash pop`. | Implement conflict detection: if project file was modified (git status), warn and offer stash+upgrade+manual-merge workflow. Or add `--preserve-local` flag. |

#### ⚪ Minor (10)

| ID | Area | Gap | Impact | Recommended Fix |
|----|------|-----|--------|-----------------|
| **G06** | Templates | co-consult contaminated: package.json, bun.lock, node_modules/ (59 packages) | Bloats template; leaked runtime artifacts | Delete contaminated files |
| **G07** | Templates | co-deck contaminated: package.json, node_modules/ (10 packages) | Same as G06 | Delete contaminated files |
| **G08** | Plugin System | Only 1/7 variant type plugins implemented (GamePlugin only) | Other types (security, development, design, consulting, collaboration, lecture) lack type-specific validation, golden references, and capability coverage checks during Phase B | Implement remaining plugins — prioritize security (highest-risk domain) |
| **G09** | upgrade-project.ts | 4 stale agent references in MERGE list | Dead code that will always SKIP | Remove `automation-engineer.md`, `docs-writer.md`, `scaffolding-expert.md`, `security-expert.md` from MERGE_FILES |
| **G10** | upgrade-project.ts | No handling of deleted template files | When L1 removes a file, L2/L3 projects retain it forever, accumulating stale content | Add optional `--prune-removed` flag that deletes files present in project but absent from template |
| **G11** | upgrade-project.ts | Hardcoded script subdirectory list `['', 'hooks', 'lib', 'helpers']` | New script subdirectories won't be discovered during upgrade | Consider auto-scanning template scripts/ structure |
| **G12** | upgrade-project.ts | No `--rollback` flag (stash exists but no built-in recovery command) | User must know to run `git stash pop` manually | Add `--rollback` convenience flag |
| **G13** | Parity | 4 variants have empty .claude/commands/ with no .gemini/commands/ counterpart | Minor directory structure asymmetry | Either add empty .gemini/commands/ or remove empty .claude/commands/ |
| **G14** | variant.json | co-consult has md-to-report.ts on disk but not in script_manifest; co-deck has 6+ unlisted scripts | script_manifest doesn't reflect actual on-disk state | Update script_manifest.local to include all scripts, or remove orphaned scripts |
| **G15** | upgrade-project.ts | CONSTITUTION.md in MERGE list doesn't exist in templates (only at L0 root) | Always skipped — dead reference | Remove from MERGE list, or document that it's intentionally L0-only |

---

## §4: upgrade-project.ts Detailed Analysis

### 4.1 Architecture Overview

```
upgrade-project.ts v1.2.2
├── Argument Parsing: <project-path> [--variant] [--platform] [--dry-run]
├── Path Resolution: workspace root, project dir validation
├── Version Detection: templates/VERSION + .claude/template-version.txt
├── Pre-Upgrade Safety: git stash (pre-upgrade-snapshot-YYYYMMDD)
├── File Categories:
│   ├── LOCKED (9 files): unconditional overwrite
│   ├── MERGE (10 files): section-based merge ← DEAD CODE (no markers)
│   ├── SYNC_IF_NEWER: versioned overwrite for scripts/, agents/, skills/
│   ├── PRESERVE: never touched (README, context.md, src/)
│   └── OVERWRITE: governance docs (security.md)
├── SKILLS.md Schema Migration: stale column removal
├── Post-Upgrade: template-version.txt update
└── Security Bootstrap: gitleaks, hooks, gitattributes verification
```

### 4.2 Functional Tier Status

| Tier | Status | Explanation |
|------|--------|-------------|
| LOCKED | ✅ **Functional** | Unconditionally overwrites 9 security/git-critical files. Works correctly. |
| MERGE | ❌ **Non-functional** | Zero markers exist in templates. All MERGE files silently skipped. |
| SYNC_IF_NEWER (scripts) | ✅ **Functional** | Version comparison via `// @version X.Y.Z`. Correct semver logic. |
| SYNC_IF_NEWER (agents) | ✅ **Functional** | Version comparison via YAML frontmatter. Falls back to unconditional overwrite if no version. |
| SYNC_IF_NEWER (skills) | ✅ **Functional** | Frontmatter version or MD5 hash fallback. Correct. |
| PRESERVE | ✅ **Functional** | Correctly never touches listed files. |
| OVERWRITE (governance) | ⚠️ **Partial** | Only `security.md` is unconditionally overwritten. Other governance docs explicitly preserved. |
| SKILLS.md Migration | ✅ **Functional** | Removes stale `layer` column. One-time migration. |
| Security Bootstrap | ✅ **Functional** | 5 verification checks + auto-fix for hooksPath. |
| Pre-upgrade Stash | ✅ **Functional** | Creates named stash for recovery. |
| Dry-run Mode | ✅ **Functional** | Full analysis with zero writes. |

**Effective coverage**: ~60% of the upgrade mechanism is functional (LOCKED + SYNC + PRESERVE + bootstrap). ~40% is non-functional (MERGE + stale references).

### 4.3 Missing Capabilities

| Capability | Status | Impact |
|------------|--------|--------|
| 3-way merge | Not implemented | Local modifications lost on SYNC files |
| Deleted file handling | Not implemented | Stale files accumulate |
| Interactive conflict resolution | Not implemented | No user choice during conflicts |
| Rollback command | Not implemented | Manual `git stash pop` required |
| Variant-specific override detection | Not implemented | Can't distinguish intentional drift from stale content |
| Delta report (what changed) | Partial (line diff counts) | No actual diff output for review |

---

## §5: Plugin System Status

### 5.1 Current Implementation

| Type | Plugin | Status | What It Provides |
|------|--------|--------|-----------------|
| game | GamePlugin ✅ | Implemented | Capability coverage validation (game-design, game-loop, asset-pipeline, debugging), performance budget mention check, architecture pattern documentation, golden reference for agent/skill sections |
| security | SecurityPlugin | Not implemented | — |
| development | DevelopmentPlugin | Not implemented | — |
| design | DesignPlugin | Not implemented | — |
| consulting | ConsultingPlugin | Not implemented | — |
| collaboration | CollaborationPlugin | Not implemented | — |
| lecture | LecturePlugin | Not implemented | — |

### 5.2 Implementation Priority Recommendation

| Priority | Type | Rationale |
|----------|------|-----------|
| 1 | **Security** | Highest-risk domain; authorization-gate-review required for promotion; compliance validation critical |
| 2 | **Development** | Most complex agent workflow (architect→code-writer→test-runner); test-driven validation useful |
| 3 | **Design** | Second most agents (7); design system validation could prevent template drift |
| 4 | **Consulting** | Most skills (13); capability coverage check would ensure engagement readiness |
| 5 | **Collaboration** | General-purpose; lower priority |
| 6 | **Lecture** | Niche (co-deck only); lowest priority |

---

## §6: Recommendations

### 6.1 Immediate Actions (This Sprint)

1. **Add WORKSPACE-MANAGED markers to templates/common/** — This unblocks the MERGE tier in upgrade-project.ts, which is currently the most impactful dead code in the infrastructure.
2. **Clean contaminated variants** — Remove package.json, bun.lock, node_modules/ from co-consult and co-deck.
3. **Remove stale MERGE references** — Delete 4 non-existent agent files from upgrade-project.ts MERGE list.
4. **Create upgrade-project SKILL.md** — Make the tool discoverable for PMs and project owners.

### 6.2 Short-term (Next Sprint)

5. **Create project-to-variant SKILL.md** — Guide PMs through the conversion workflow.
6. **Create variant-feature SKILL.md** — Or merge into create-variant skill as a sub-workflow.
7. **Fix directory parity** — Clean up empty .claude/commands/ in 4 variants.
8. **Update script_manifest** — Add unlisted scripts in co-consult and co-deck.

### 6.3 Medium-term (Next Quarter)

9. **Implement remaining plugins** — Start with SecurityPlugin, then DevelopmentPlugin.
10. **Add conflict detection to upgrade-project.ts** — Warn when local modifications would be overwritten.
11. **Add `--prune-removed` flag** — Handle deleted template files.
12. **Add `--rollback` convenience flag** — Wrap `git stash pop` for one-command recovery.

### 6.4 Deferred (Backlog)

13. **autoFixPmMd implementation** — Automatic pm.md slimming during Phase B pipeline.
14. **CONSTITUTION.md false claim fix** — Remove or update the claim that audit.ts verifies WORKSPACE-MANAGED markers.
15. **Dynamic script directory discovery** — Replace hardcoded subdirectory list in upgrade-project.ts.
16. **Variant-specific audit hooks** (per ADR-0044) — Each variant can have custom validation in `scripts/audit-variant.ts`.

---

## §7: Appendix — Detailed Check Results

### A. validate-templates.ts Warnings

```
[WARN] co-design/skills/ exists but contains no skill directories
[WARN] co-develop/skills/ exists but contains no skill directories
[WARN] co-game/skills/ exists but contains no skill directories
[WARN] co-work/skills/ exists but contains no skill directories
```

These are expected — these variants don't define variant-level skills in the `skills/` directory. Skills are in `.claude/skills/` and `.gemini/skills/` instead.

### B. Platform Parity Skip Summary

The following skills are marked `gemini-parity: skip` across variants:

| Skill | Skipped in variants |
|-------|-------------------|
| finishing-a-development-branch | 7/7 (all) |
| platform-command-lifecycle-manager | 7/7 (all) |
| documentation-writing | co-consult, co-work |
| research-analysis | co-consult, co-work |
| code-review | co-develop, co-game |
| refactoring | co-develop, co-game |
| test-driven-development | co-develop, co-game |
| service-design | co-design |
| ui-ux-design-intelligence | co-design |
| api-documentation | co-work |

### C. Variant Status Distribution

| Status | Variants |
|--------|---------|
| stable | co-consult, co-design, co-develop, co-security, co-work (5) |
| beta | co-deck, co-game (2) |
| draft | (0) |
| deprecated | (0) |
