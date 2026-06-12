# Meeting Transcript
**Date**: 2026-06-12
**Topic**: Project Review — Workspace Root + Templates (7-agent parallel diagnosis)
**Participants**: architect, auditor, automation-engineer, docs-writer, lifecycle-manager, scaffolding-expert, security-expert
**Mode**: Parallel background agents (Claude Code Agent tool)
**Status**: Complete

---

## Scope

- Workspace root: `C:\git\ai_workspace`
- Templates: `templates/` directory (all 5 variants + common)

---

## Critical Findings

### C-01: co-develop/CLAUDE.md marker injection corruption
`templates/co-develop/CLAUDE.md` contains 9 separate `COMMON-CLAUDE:START/END` marker pairs at individual section level (lines 105, 143, 187, 232, 246, 255, 264, 274, 287). Each `--docs` re-run duplicates content into each marker. Other 4 variants lack CLAUDE.md entirely, so this is co-develop-specific.

### C-02: co-develop/CLAUDE.md §11 contradicts ADR-0036
Line 281 states `.ps1` counterparts exist — ADR-0036 abolished all `.sh/.ps1` scripts. AI agents reading this file receive incorrect governance instructions.

---

## High Findings

| # | Issue | Agent | File |
|---|-------|-------|------|
| H-01 | `file.targetPath` path traversal in `generate-variant.ts` — SecurityValidator not called | security | `scripts/helpers/generate-variant.ts:244,939` |
| H-02 | L1 `templates/common/scripts/` has banned `.sh/.ps1` files (audit.sh, dev-sync.sh, setup.sh, etc.) | architect | `templates/common/scripts/` |
| H-03 | `publish-to-template` ghost references in 6 scripts + 2 skill files (broken fix instructions) | lifecycle, auditor | Multiple files |
| H-04 | 4/5 variant templates structurally incomplete — missing .githooks/, .github/, CLAUDE.md, GEMINI.md, etc. | architect | `templates/co-design/`, `co-develop/`, `co-security/`, `co-work/` |
| H-05 | `collectDiffs()` L0→L1 does not call `includeScriptInL1()` — 11 L0-only scripts propagate to L1 | architect | `scripts/propagate-to-templates.ts` |
| H-06 | CONSTITUTION.md §6.5 contains Korean text (language policy violation) | docs | `CONSTITUTION.md:208-214` |
| H-07 | CONSTITUTION.md §7, §10 and 07-new-project.md have stale .sh/.ps1 references (ADR-0036) | docs | Multiple sections |
| H-08 | `merge-frontmatter.ts` exists in L1 but not L0 — SCRIPTS.md claims L0-sourced | architect | `templates/common/scripts/merge-frontmatter.ts` |
| H-09 | `co-develop/variant.json` uses `inherits_common: "templates/common"` path vs other 4 using semver | architect | `templates/co-develop/variant.json` |
| H-10 | `memory/2026-06-08.md` has 4 format violations — blocks pre-commit when staged | lifecycle | `memory/2026-06-08.md` |
| H-11 | `claude-skills`/`gemini-skills` domains lack workspace-scope filter | automation | `scripts/propagate-to-templates.ts` |
| H-12 | `scripts/new-project.sh.backup` (29KB) remains in L0 — ADR-0036 artifact | architect | `scripts/new-project.sh.backup` |
| H-13 | `settings.local.json` has `--no-verify` allowlist entry | security | `.claude/settings.local.json:288` |
| H-14 | SCRIPTS.md has 3 duplicate rows (merge-package-scripts.ts ×2, variant-governance-rules.ts ×2) | auditor | `scripts/SCRIPTS.md:82-94` |
| H-15 | `contextTemplatePath` uses CWD-relative path — silently fails after chdir | scaffolding | `scripts/new-project.ts:442` |

---

## Moderate Findings (summary)

- M-01: No ADR for propagation consolidation decision (ADR-0037 needed)
- M-02: `docs` propagation-map domain semantics incorrect (L0 governance docs ≠ L1 project template docs)
- M-03: Plan file 2026-06-12-consolidate shows 0% complete but fully implemented
- M-04: CHANGELOG [Unreleased] missing 2026-06-12 entries
- M-05: CLAUDE.md §9 anchor `#10-lifecycle-management-rules` broken
- M-06: `--governance-l1 --dry-run` always reports 3 "would update" regardless of actual diff
- M-07: SYNC_ACTIVE token uses `Date.now()` (low entropy) — replace with `crypto.randomUUID()`
- M-08: pre-commit fallback secret scan misses Anthropic/OpenAI/Slack modern key formats
- M-09: `applyContextTemplate()` accepts caller-controlled paths without workspace containment
- M-10: Check C warning always fires regardless of drift — false noise in CI
- M-11: 7 of 8 agents missing `version:` frontmatter
- M-12: VARIANT-INJECT 7 sections mostly untagged REQUIRED/OPTIONAL — enforcement gap
- M-13: `new-project.ts` applyContextTemplate() version hardcoded as `'1.0'`
- M-14: `co-develop/skills/` empty directory
- M-15: `co-consult` has files absent from other 4 variants (CHANGELOG, SECURITY.md, memory/, etc.)
- M-16: `post-write-lifecycle-check.ts` does not cover `scripts/*.ts` edits
- M-17: CLAUDE.md §9 link anchor mismatch
- M-18: pm.md L0→L2 divergence in all 5 variants — intentionality unverified

---

## Action Items

| # | Owner | Deliverable | Priority | Phase |
|---|-------|-------------|----------|-------|
| A-01 | automation-engineer | co-develop/CLAUDE.md marker consolidation + ADR-0036 §11 fix | Critical | Wave 1 |
| A-02 | automation-engineer | L1 .sh/.ps1 files deleted + new-project.sh.backup removed | High | Wave 1 |
| A-03 | automation-engineer | publish-to-template ghost references in 6 scripts + 2 skills replaced | High | Wave 1 |
| A-04 | automation-engineer | collectDiffs() L0→L1 includeScriptInL1() filter + platform-skills scope filter | High | Wave 1 |
| A-05 | security-expert | generate-variant.ts path traversal fix (SecurityValidator applied) | High | Wave 1 |
| A-06 | docs-writer | CONSTITUTION.md §6.5 translated to English + §7/§10 .sh/.ps1 fixed | High | Wave 1 |
| A-07 | docs-writer | 07-new-project.md .sh/.ps1 references replaced with bun scripts/*.ts | High | Wave 1 |
| A-08 | automation-engineer | contextTemplatePath absolute path + SCRIPTS.md duplicate rows removed | High | Wave 1 |
| A-09 | docs-writer | ADR-0037 written (propagation consolidation decision) | Moderate | Wave 2 |
| A-10 | automation-engineer | crypto.randomUUID() + path containment + secret scan patterns | Moderate | Wave 2 |
| A-11 | scaffolding-expert | 4/5 variant structure completed or gap policy documented | Moderate | Wave 2 |
| A-12 | docs-writer | CHANGELOG [Unreleased] updated + plan file marked complete | Moderate | Wave 2 |
| A-13 | lifecycle-manager | Template version 0.6.0 bump + agent version headers | Low | Wave 3 |
| N-1 | lifecycle-manager | Lifecycle Update | — | Per wave end |
| N | auditor | Final QA Audit | — | Per wave end |

---

## Strengths

- propagate-to-templates.ts v2.0.0 dry-run: 123/123 in sync, exit 0
- Check X INTENTIONAL_CROSS_REFS covers all known legitimate cross-references
- audit.ts v2.7.0 passes all checks cleanly
- validate-templates.ts: 0 errors across all 5 variants
- SecurityValidator class is well-designed — gap is caller integration
- template-utils.ts: clean shared utility, no circular imports
- CI workflow: minimal permissions, fork PR restriction
- pre-commit dual-lock (SYNC_ACTIVE + .sync_context.tmp) resists simple env-var bypass
