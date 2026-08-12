# Project Review Fixes — Design Document

> **Spec**: project-review-fixes
> **Date**: 2026-08-12
> **Author**: PM Agent (architect dispatch)
> **Status**: Approved

## 1. Overview

Comprehensive fix plan addressing all findings from the project review of the workspace template system (`templates/<variant>`). The workspace root (L0) contains 10 template variants (common + 9 co-* variants), core scripts, Git hooks, and security configuration.

## 2. Findings Summary

| Severity | Count | Primary Domains |
|----------|-------|-----------------|
| 🔴 Critical | 8 | Template contracts, inheritance bypass, build artifacts, gitleaks |
| 🟡 High | 13 | GitHooks security, script quality, validation gaps |
| 🟢 Moderate | 10 | Documentation consistency, schema enforcement, propagation |
| **Total** | **31** | |

## 3. Root Cause Chains

### RC-1: Missing schema enforcement for variant.json optional fields
- `agent_manifest` missing in co-export, co-news
- `script_manifest` only in 2/9 variants
- `skills[].file` inconsistent (4 variants use it, 5 don't)
- **Fix**: Strengthen `variant.schema.json` with recommended fields; add audit checks

### RC-2: L0→L1 hook sync gap
- L0 `.githooks/` and L1 `templates/common/.githooks/` have identical issues
- `commit-msg` uses python3 (Korean-only regex) instead of `language-guard.ts`
- `post-checkout` uses hardcoded `/tmp/` path
- Missing `set -euo pipefail` in 4/5 hooks
- **Fix**: Fix L0 first, then sync to L1

### RC-3: Script validation tools exist but aren't wired into audit.ts
- `validate-skills.ts` and `validate-agents.ts` exist but audit.ts doesn't call them
- `generate-version-manifest.ts` parser returns N/A for many scripts
- **Fix**: Integrate validation scripts into audit pipeline

### RC-4: Documentation drift from actual file state
- `docs/lifecycle/README.md` references non-existent `.sh` scripts
- `AGENTS.md §6` missing workspace-level skills
- Variant AGENTS.md headers say "Workspace Root" instead of variant name
- **Fix**: Update all references to match actual state

### RC-5: Build artifacts committed to template directories
- `_pipeline_report.json/md` in co-export and co-news
- **Fix**: Delete artifacts, add to `.gitignore` if applicable

## 4. Change Specifications

### 4.1 PR1: Template Contracts (Critical)

**4.1.1 co-news extends path fix**
- File: `templates/co-news/agents/pm.md` line 4
- Change: `extends: ../../../agents/pm.md` → `extends: ../../common/agents/pm.md`
- Risk: None (common/pm.md is the correct L1 parent)

**4.1.2 co-export agent_manifest**
- File: `templates/co-export/variant.json`
- Add `agent_manifest` block following co-consult/co-deck pattern
- Include: file paths, tier assignments, versions for all agents

**4.1.3 co-news agent_manifest + createdAt fix**
- File: `templates/co-news/variant.json`
- Add `agent_manifest` block
- Rename `createdAt` → `created_at` (snake_case consistency)

**4.1.4 Build artifact removal**
- Delete: `templates/co-export/_pipeline_report.json`, `templates/co-export/_pipeline_report.md`
- Delete: `templates/co-news/_pipeline_report.json`, `templates/co-news/_pipeline_report.md`

**4.1.5 gitleaks.toml for common template**
- File: `templates/common/.gitleaks.toml`
- Replace `[Project Name]` placeholder with `ai-workspace-common-template`
- Add `memory/.*` to paths allowlist
- Add `YOUR_API_KEY`, `YOUR_TOKEN`, `YOUR_SECRET` to regex allowlist

**4.1.6 variant.schema.json enhancement**
- File: `docs/templates/variant.schema.json`
- Add optional properties: `agent_manifest`, `skill_manifest`, `script_manifest`, `variant_type`, `inherits_common`, `agents`, `skills`
- Keep optional (not required) to maintain backward compatibility
- Add type definitions for manifest objects

### 4.2 PR2: GitHooks Security (High)

**4.2.1 Strict mode for all hooks**
- Files: `.githooks/commit-msg`, `post-checkout`, `pre-commit`, `pre-push`
- Add `set -euo pipefail` after shebang line
- Note: `pre-rebase` already has it

**4.2.2 Replace python3 with language-guard.ts**
- File: `.githooks/commit-msg` lines 14-22
- Replace python3 Korean-only regex with: `bun run scripts/lib/language-guard.ts "$COMMIT_MSG_FILE"`
- This provides Korean + Japanese + Chinese detection + code-block stripping
- Fallback if bun not found: warn and skip (don't block commit)

**4.2.3 Fix /tmp/ lock path**
- File: `.githooks/post-checkout` line 34
- Change: `LOCK_FILE="/tmp/post-checkout-ai.lock"` → `LOCK_FILE="$(git rev-parse --git-dir)/post-checkout-ai.lock"`

**4.2.4 Bun availability guards**
- Files: `.githooks/pre-commit`, `.githooks/pre-push`
- Add `command -v bun >/dev/null 2>&1 || { echo "❌ bun not found"; exit 1; }` before bun call

**4.2.5 Sync to L1 common template**
- Copy all L0 hook fixes to `templates/common/.githooks/`

### 4.3 PR3: Script Quality (High)

**4.3.1 dispatch-serial.ts path validation**
- File: `scripts/dispatch-serial.ts` line 263
- Add validation before `import(pipelinePath)`:
  - Must be absolute path or relative to workspace root
  - Must resolve within workspace root boundary
  - Reject paths with `..` traversal outside workspace

**4.3.2 new-project.ts dead code review**
- File: `scripts/new-project.ts` lines 518-524
- Assessment needed: conditional helper existence check — likely NOT dead code
- Action: Add clarifying comment if code is intentional, or remove if truly dead

**4.3.3 upgrade-project.ts prompt fix**
- File: `scripts/upgrade-project.ts` line 89
- Add `--yes` / `-y` flag support to skip interactive prompt
- Default behavior unchanged (still prompts)

**4.3.4 dev-sync.ts indentation fix**
- File: `scripts/dev-sync.ts` lines 17-27
- Fix inconsistent indentation in workspace root guard block

**4.3.5 generate-version-manifest.ts parser improvement**
- File: `scripts/generate-version-manifest.ts`
- Investigate why 42 scripts show N/A version
- Likely cause: version comment format not matching parser regex

**4.3.6 audit.ts validation integration**
- File: `scripts/audit.ts`
- Add calls to `scripts/validate-skills.ts` and `scripts/validate-agents.ts`
- Run as part of standard audit, with graceful failure (warn, not fail)

### 4.4 PR4: Documentation Consistency (Moderate)

**4.4.1 lifecycle README stale .sh references**
- File: `docs/lifecycle/README.md` lines 194, 201
- Check if `scripts/validate-doc-folder.sh` exists; if not, remove reference
- Replace with actual validation approach

**4.4.2 SCRIPTS.md version sync**
- Compare `scripts/SCRIPTS.md` with `templates/common/scripts/SCRIPTS.md`
- Sync versions and entries

**4.4.3 VERSION_MANIFEST reconciliation**
- File: `docs/VERSION_MANIFEST.md`
- Align variant skill versions with actual SKILL.md frontmatter

**4.4.4 AGENTS.md §6 skills table**
- File: `AGENTS.md`
- Compare registered skills with actual `skills/*/SKILL.md` directories
- Add missing entries

**4.4.5 Variant AGENTS.md headers**
- Check all 9 variants for "Workspace Root Agent Ecosystem" header
- Replace with variant-specific headers

**4.4.6 sync-skills.ts SHORTCUT_SKILLS**
- File: `scripts/sync-skills.ts`
- Verify SHORTCUT_SKILLS list matches actual shortcut skills

### 4.5 PR5: CI/Cleanup (Moderate)

**4.5.1 CI workflows review**
- Check `templates/common/.github/workflows/`
- Verify Dependabot status, pin SHAs in actions

**4.5.2 audit.ts schema validation**
- Add variant.json validation against `docs/templates/variant.schema.json`
- Report as warning (not error) for backward compatibility

**4.5.3 propagation-map.json targets**
- File: `scripts/propagation-map.json`
- Add co-export, co-news targets if missing

## 5. Execution Constraints

- **Sequential PR merging**: Each PR must merge before the next branch is created
- **PM does NOT execute directly**: All file modifications dispatched to specialists
- **Design Gate**: This document serves as Row 0 approval for all 5 PRs
- **ADR-0036**: All scripts must be TypeScript — no bash scripts added

## 6. Out of Scope

| Item | Reason |
|------|--------|
| 13 lifecycle governance records | Bulk creation — separate lifecycle-manager session |
| co-consult/co-deck lifecycle docs | Variant-specific — separate session |
| skills[].file standardization | Convention needs ratification before enforcement |
| variant AGENTS.md full content sync | Content-heavy — separate session |
