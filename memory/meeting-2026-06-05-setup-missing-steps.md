---
name: meeting-2026-06-05-setup-missing-steps
description: Meeting on missing new-project.sh execution steps in safety-os — bun install, setup.sh, .githooks, .gitignore not run
metadata:
  type: project
---

# Meeting Transcript
**Date**: 2026-06-05
**Topic**: new-project.sh vs safety-os Gap — Package Install and Setup Steps
**Participants**: architect, automation-engineer, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## new-project.sh Steps vs safety-os Status

| Step | new-project.sh action | safety-os status |
|---|---|---|
| 1. common copy | cp -r common/. project/ | ✅ (manual, missing .gitignore/.env.sample/.githooks) |
| 2. variant overlay | find + cp | ✅ manual |
| 3. variant.json lifecycle | update-variant-lifecycle.ts | ⚠️ lifecycle fields missing |
| 4. scripts-snapshot | write-scripts-snapshot.ts | ❌ missing |
| 5. package.json merge | merge-package-scripts.ts | ⚠️ exists but bun install not run |
| 6. placeholder sub | substitute-placeholders.ts | ❌ not run |
| 7. skills injection | inject-skills.ts | ❌ not run |
| 8. audit | bun scripts/audit.ts | ✅ safety-audit.ts passes |
| **9. setup.sh** | bash setup.sh | ❌ **NOT RUN — critical** |
| 10. global plugins | inject-global-plugins.ts | ❌ not run |

## Critical Issue

`setup.sh` was NOT run. This means:
- `cd scripts && bun install` not executed → TypeScript scripts have no dependencies
- `.env` not created (.env.sample itself missing)
- CodeGraph not initialized
- git not initialized in project directory
- Gemini superpowers plugin not installed globally
- No initial commit

## Why safety-audit.ts passed despite bun install missing

`safety-audit.ts` uses only Node.js built-in modules (fs, path) — no external deps needed.
Other scripts (agent-verify.ts, dispatch.ts etc.) may fail on import resolution.

## create-l2-scaffold.ts Final 10-Step Design

1. Duplicate check (Projects/<name>/ already exists?)
2. Create Projects/<name>/ directory
3. Copy templates/common/ overlay (includes .gitignore, .env.sample, .githooks/)
   + Copy scripts/ Tier 1+2 (Tier 3 excluded — hardcoded set)
4. Copy skills/ root (common/skills/ all)
5. Generate stub files (variant.json, _ORIGIN.md, _COMMON_VERSION.md,
   PROMOTION_CHECKLIST.md, SECURITY.md, docs/VERSION_MANIFEST.md)
6. Insert TODO markers in CLAUDE.md / GEMINI.md
7. git init + git config core.hooksPath .githooks
8. cd scripts && bun install (warn on failure, don't abort)
9. bash scripts/setup.sh --skip-commit --skip-license-check
10. Print completion message + next steps

## safety-os Immediate Fixes (B-05 expanded)

| Order | Action | Tool |
|---|---|---|
| 1 | Copy .gitignore, .env.sample, .githooks/ from common | cp |
| 2 | git init (if needed) + git config core.hooksPath .githooks | bash |
| 3 | cd scripts && bun install | bun |
| 4 | bash scripts/setup.sh --skip-commit --skip-license-check | bash |

## Action Items

| # | Owner | Tier | Deliverable | Change from previous |
|---|---|---|---|---|
| B-01 | automation-engineer | High | create-l2-scaffold.ts 10-step | + setup.sh, git init, bun install |
| B-02 | docs-writer | Medium | skills/create-variant/SKILL.md | + setup.sh step |
| B-03 | docs-writer | Medium | skills/promote-variant/SKILL.md | unchanged |
| B-04 | automation-engineer | Medium | SCRIPTS.md + AGENTS.md registration | unchanged |
| B-05 | scaffolding-expert | Medium | safety-os immediate fix (expanded) | scope expanded |
| B-06 | automation-engineer | Low | safety-os variant.json schema | unchanged |
| B-07 | docs-writer | Low | safety-os SECURITY.md + VERSION_MANIFEST | unchanged |
