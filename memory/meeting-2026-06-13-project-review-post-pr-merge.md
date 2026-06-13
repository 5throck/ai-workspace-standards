# Meeting Transcript
**Date**: 2026-06-13
**Topic**: Project Review — workspace root + templates (post PR #255/256/257 merge)
**Participants**: architect, auditor, automation-engineer, docs-writer, security-expert, lifecycle-manager, scaffolding-expert
**Rounds**: Parallel async review
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Summary

7-agent parallel diagnostic covering workspace root (`C:\git\ai_workspace`) and `templates/` after PRs #255, #256, #257 were merged to main. PRs introduced template-utils.ts SSOT, variant.context.template.md, and Wave 1 A-01~A-05 fixes.

---

## Critical Issues (9)

| # | Issue | Agent | File |
|---|-------|-------|------|
| C-01 | 4/5 variants missing CLAUDE.md + GEMINI.md (contract violation) | architect · scaffolding | `templates/co-{consult,design,security,work}/` |
| C-02 | 36 L0-only scripts orphaned in `templates/common/scripts/` — no prune pass | architect · auditor · automation | `templates/common/scripts/` |
| C-03 | `new-project.ts` `applyContextTemplate()` unconditionally overwrites variant context.md | scaffolding | `scripts/new-project.ts:443` |
| C-04 | `applyContextTemplate` call uses hardcoded `version: '1.0'` instead of `templateVersion` | scaffolding | `scripts/new-project.ts:446` |
| C-05 | `collectDiffs()` missing `exclude_prefixes` — `docs/templates/` will leak to L1 on next `--apply` | automation | `scripts/propagate-to-templates.ts` |
| C-06 | Check X regex misses `.js`-extension imports — validate-templates.ts L0-only violation undetected | auditor | `scripts/lifecycle-sync-audit.ts:~393` |
| C-07 | `validate-templates.ts` (L0+L1) imports L0-only `layer-filter.ts` — broken in L2 projects | auditor | `templates/common/scripts/validate-templates.ts:19` |
| C-08 | `generate-variant.ts` `variantPath` constructed without workspace boundary check | security | `scripts/helpers/generate-variant.ts:876` |
| C-09 | `l2-to-variant-pipeline.ts` `--name=` CLI arg unsanitized before path use | security | `scripts/l2-to-variant-pipeline.ts:488` |

## High Issues (12)

| # | Issue | Agent |
|---|-------|-------|
| H-01 | `generate-version-manifest.ts` regex misses JSDoc `@version` — propagate-to-templates/lifecycle-sync-audit show N/A in VERSION_MANIFEST | lifecycle |
| H-02 | `CHANGELOG.md` missing entries for PRs #255, #256, #257 | docs · auditor |
| H-03 | `docs/constitution/` 4 section files still reference `.sh`/`.ps1` and `publish-to-template.sh` | docs |
| H-04 | No ADR for `publish-to-template.ts` → `propagate-to-templates.ts` v2.0.0 consolidation | docs |
| H-05 | ADR numbering collisions — 0032, 0033, 0034 each assigned to 2 files | architect |
| H-06 | 4 of 5 variants use legacy `variant.json` schema (missing `name`, `description`, `status` fields) | architect |
| H-07 | Fallback secret scan regex misses `sk-ant-api03-` and `sk-proj-` formats | security |
| H-08 | `REBASE_BYPASS_SECRET_SCAN=1` bypass method documented in error message | security |
| H-09 | `pre-rebase` path-based gitleaks allowlist ignored in `--no-git` mode | security |
| H-10 | Variant `.context.md` files missing 5 of 7 VARIANT-INJECT markers | scaffolding |
| H-11 | `skills` domain `exclude` list silently ineffective (directory vs filename comparison) | automation |
| H-12 | `propagate:dry-run` alias absent from `package.json` | automation |

## Moderate Issues (18)

M-01 through M-18 documented in PM synthesis report. Key items:
- `check-pm-approval.ts` version mismatch (file 1.0.1 vs SCRIPTS.md 1.0.0)
- `new-project.ts` L1 copy imports `template-utils.js` which is deleted from L2 projects
- `dev-sync.ts` has no merge-state guard
- 6 agents missing `version:` frontmatter
- `.gemini/settings.json.bak` in all 5 variant dirs
- 19 L1 scripts reference `CONSTITUTION.md` (dead in L2 projects)
- `SYNC_ACTIVE` token uses `Date.now()` (low entropy)
- `docs/_common/context.md` and `docs/context.md` near-duplicate

## Strengths

- ADR-0036 fully applied — zero `.sh`/`.ps1` in `scripts/`, TypeScript migration complete
- `template-utils.ts` SSOT accurate — L0/L1 sync correct, 5 variant DEFAULT_PM_ROLE_DESCRIPTIONS populated
- `propagate-to-templates.ts` v2.0.0 filtering correct (`includeSkillInL1`/`includeScriptInL1`)
- Fork Model (ADR-0031) respected — no L1→L2 auto-propagation
- Memory log format 100% compliant (2026-06-06 to 2026-06-13)
- SYNC_ACTIVE 2-factor gate correctly implemented
- GitHub Actions permissions minimized, actions pinned to SHA hashes
- `INTENTIONAL_CROSS_REFS` 6 entries with documented rationale

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Medium | `propagate-to-templates.ts --prune` + remove 53 orphan L0-only files from L1 | Wave 1 |
| A-02 | scaffolding-expert | Medium | `new-project.ts` conditional overwrite guard (C-03) + version fix (C-04) | Wave 1 |
| A-03 | automation-engineer | Medium | `collectDiffs()` exclude_prefixes logic (C-05) | Wave 1 |
| A-04 | auditor | Medium | Check X regex `.js` extension fix (C-06) + recursive subdirectory scan | Wave 1 |
| A-05 | architect | High | `validate-templates.ts` layer dependency resolution (C-07) | Wave 1 |
| A-06 | security-expert | Medium | `variantPath` boundary guard (C-08) + `variantName` validation (C-09) + secret regex (H-07) | Wave 1 |
| A-07 | scaffolding-expert | High | 4 variant `CLAUDE.md` + `GEMINI.md` creation (C-01) | Wave 1 |
| A-08 | docs-writer | Medium | CHANGELOG entries (H-02) + docs/constitution fixes (H-03) + ADR-0037 (H-04) | Wave 2 |
| A-09 | lifecycle-manager | Low | SCRIPTS.md version fixes + SKILLS.md stale reference removal (H-01/H-02) | Wave 2 |
| A-10 | architect | Medium | ADR numbering collision resolution (H-05) + variant.json schema migration (H-06) | Wave 2 |
| A-11 | automation-engineer | Low | `package.json` `propagate:dry-run` alias + skills exclude directory-prefix fix (H-11/H-12) | Wave 2 |
| A-12 | PM | — | Moderate/Low cleanup (M-01~M-18, L-01~L-07) | Wave 3 |
