# Project Review — co-architect — 2026-09-08

**Date**: 2026-09-08
**Scope**: workspace project copy (L1/L2 tier), full review
**Method**: 4 parallel domain agents (Explore, read-only) + machine validator battery + base-map cross-validation
**Domain agents**: Architecture+Scaffolding · Standards+Lifecycle · Automation · Documentation+Security

> Analysis + in-session Critical fixes — the fixes are listed in **Fixes applied this session** below.

---

## Baseline (machine battery)

| Command | Result | Notes |
|---|---|---|
| `bun scripts/audit.ts` | **PASS** | full battery incl. variant audit (6/6), skill-graph drift gate |
| `bun scripts/verify-scripts.ts --verify` | **PASS, 1 WARN** | 104 scripts verified; WARN: deprecated `co-architect/check-pm-approval.ts`, removal 2026-11-30 |
| `bun scripts/agent-lifecycle-audit.ts` | **PASS** | 23 agents healthy |
| `bun scripts/skill-lifecycle-audit.ts` | **PASS** | 32 skills healthy (33 after `meeting` restore / 34 after `k-law` lands) |
| `bun scripts/validate-templates.ts` | **N/A** | L0-only script; not shipped to this tier (`scripts/SCRIPTS.md:10` Tier-3 exemption note) |
| `bun scripts/propagate-to-templates.ts --check-drift` | **N/A** | L0-only, same as above |
| `bun scripts/ticket.ts` | **N/A** | L0-only; deferred items are recorded in this report + memory log instead |
| `bun test scripts/tests/` | **18 pass / 8 fail (pre-existing)** | all 8 failures are `apply-handbook-theme` tests invoking the L0-only `templates/common/scripts/…` path |

3 of the 6 battery commands named in `skills/project-review/SKILL.md` cannot run at this tier — the skill/commands text was never tier-gated (see H-2).

---

## Findings

Severity: 🔴 Critical · 🟡 High · 🟢 Moderate. **Class** drives action wiring:
`one-time` = instance drift, fix and forget · `systemic` = recurring, needs judgment · `script-gap` = a machine should have caught this.

### 🔴 Critical

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C-1 | `.cache/admrule-kr`, `.cache/legalize-kr` tracked as gitlink (mode 160000) with no `.gitmodules`; runtime MCP clones cause permanent dirty worktree | Automation, Docs+Security, Architecture | `git ls-files -s .cache/` | one-time | ✅ Fixed — `git rm --cached` + delete caches (PR #290, 2026-09-08) |
| C-2 | AGENTS.md §5.1/§5.1.1 "Single Source of Truth" (Execution Plan Template / Design Gate Exemptions) exists in **no file**; 10+ dangling refs from CLAUDE.md:189/198, GEMINI.md:195, skills/sync:86, skills/project-review, source-command-meeting | Docs+Security | `CLAUDE.md:198`, `GEMINI.md:195` | one-time | ✅ Fixed this session — §5 + §10 ported from L0 AGENTS.md; §3/§8 numbered; §3.7.5 stub added |
| C-3 | `skills/SKILLS.md` lifecycle SSOT lists 14 of 32 skills, 6 stale versions, phantom owners (`security-expert`, `docs-writer` don't exist); no validator checks it | Standards | `skills/SKILLS.md:9-23` | script-gap | ✅ Fixed this session — registry regenerated from frontmatter (33 rows); hardening ticket `T-20260909-001` (VH-1) |
| C-4 | `meeting` skill exists in all 3 platform mirrors but not in `skills/` SSOT (constitution violation, `docs/context.md:56`); mirrors stale at 1.4.0 vs L0 1.4.1 | Architecture | `.claude/skills/meeting/` vs `skills/meeting/` (absent) | one-time | ✅ Fixed this session — copied 1.4.1 from `templates/common/skills/meeting/`, mirrors re-synced |

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix / Ticket |
|---|-------|-------|-----------|-------|--------------|
| H-1 | `scripts/package.json` aliases broken in both contexts: from `scripts/` resolves `scripts/scripts/x`; from root falls through to PATH — `bun run audit` executed the macOS system `audit` binary (exit 255) | Automation | `scripts/package.json:5-17` | systemic | Ticket T-1 |
| H-2 | Governance commands/skills mandate L0-only validators (`validate-templates`, `propagate-to-templates`, `ticket.ts`) that don't exist at this tier — 20 files affected | Automation, Docs+Security | `.claude/commands/project-review.md:7`, `skills/sync/SKILL.md:54` | systemic | Ticket T-2 |
| H-3 | CI runs only `audit.ts` on ubuntu; no `bun test`, no `verify-scripts --verify`, no lifecycle audits; no `scripts/**` path filter; dead commented `test-node` job | Automation | `.github/workflows/ci.yml:38-53,189-198` | systemic | Ticket T-3 |
| H-4 | Critical validators have zero test coverage; `test-runner.ts` suite table points at nonexistent dirs and matches `test-runner.ts` itself (self-spawn) | Automation | `scripts/test-runner.ts:44-47` | script-gap | Ticket T-4 (partial overlap with VH-1 rationale) |
| H-5 | AGENTS.md / context.md skill tables omit 4 on-disk skills (violates own Maintenance Rule) | Standards | `AGENTS.md:207-251`, `docs/co-architect.context.md:129-158` | systemic | Ticket T-5 |
| H-6 | CHANGELOG.md ~18 days stale + verbatim duplicate entry at lines 12/14 | Standards | `CHANGELOG.md:12,14` | systemic | Ticket T-6 |
| H-7 | `memory/MEMORY.md` index has 8 dead links to pruned session logs; `verify-memory.ts` only checks the orphan direction | Standards | `memory/MEMORY.md` | script-gap | Ticket T-7 + VH-2 |
| H-8 | `memory/` holds misplaced working code (`memory/scripts/*.py`, 132K) and a tracked 388K `drawings.zip` of gitignored-pattern content | Standards | `memory/scripts/`, `memory/drawings.zip` | systemic | Ticket T-8 |
| H-9 | `scripts/co-architect/setup/setup.bat` on disk, absent from every registry; `verify-scripts.ts` `SCRIPT_EXTENSIONS` omits `.bat` | Standards | `scripts/verify-scripts.ts:30` | script-gap | Ticket T-9 + VH-3 |
| H-10 | Agent `lifecycle.last_updated` dates stale vs actual git history (analyst, design-lead, zwcad-drafter, pm); no freshness check | Standards | `agents/analyst.md` frontmatter | script-gap | Ticket T-10 + VH-4 |
| H-11 | `variant.json` registers 3 skills absent from repo (L0-only); `audit-variant.ts` never checks the `skills` array | Architecture | `variant.json:229-256` | script-gap | Ticket T-11 + VH-5 |
| H-12 | `audit.ts` reads `schema.rootAllowlist` which this tier's `docs/workspace-schema.json` doesn't define → silently-empty allowlist; inert only because `IS_WORKSPACE_ROOT=false`; two disagreeing root predicates (`audit.ts:132` vs `:1747`) | Architecture | `scripts/audit.ts:1847-1848` | script-gap | Ticket T-12 + VH-6 |
| H-13 | `docs/context.md` retains unfilled `[Project Name]` placeholders; scaffold would have substituted them; no validator checks | Architecture, Docs+Security | `docs/context.md:1,15` | script-gap | Ticket T-13 + VH-7 |
| H-14 | Committed Windows absolute path (`c:/git/...`) + UTF-8 BOM in the 3 `skills.json` platform configs | Architecture | `.claude/skills.json` etc. | one-time | Ticket T-14 |
| S-1 | No secrets in tracked files; CI least-privilege + SHA-pinned actions + full-history gitleaks; dependencies current | Docs+Security | — | — | ✅ Strength |

### 🟢 Moderate (abbreviated)

| # | Issue | Agent | Class | Ticket |
|---|-------|-------|-------|--------|
| M-1 | 8 skills missing `last_reviewed` frontmatter | Standards | systemic | T-15 |
| M-2 | `agents/pm.md` is the only agent without `status:` field | Standards | one-time | T-15 |
| M-3 | SCRIPTS.md claims this project's `scripts/` has no package.json — it does | Standards | one-time | T-16 |
| M-4 | SCRIPTS.md Guide documents `test-platform-parity.ts` (nowhere on disk, not in Tier-3 exemption list) | Standards | one-time | T-16 |
| M-5 | `explain-me` is `experimental` but listed without status marker in both tables | Standards | systemic | T-15 |
| M-6 | `docs/README.md` index drift: nonexistent `plans/`, missing `lifecycle/`+`specs/`, wrong ADR range | Docs+Security | one-time | T-17 |
| M-7 | `docs/reports/` did not exist (mandated persist path) | Docs+Security | one-time | ✅ Fixed — created by this report |
| M-8 | One language-policy violation: `docs/designs/2026-08-29-co-architect-identity-separation-design.md:5` Korean quote, no frontmatter; validator excludes `docs/designs/` | Docs+Security | script-gap | T-18 + VH-8 |
| M-9 | `docs/context.md:165-167` language-policy self-contradiction vs COMMON block | Docs+Security | one-time | T-18 |
| M-10 | `pre-commit.ts` uses bare `which` (breaks gitleaks detection on Windows) | Automation | systemic | T-19 |
| M-11 | `audit.ts:1859-1863` byte-identical win32/else branches; both require bash | Automation | one-time | T-19 |
| M-12 | `verify-scripts.ts:294` remediation hint references nonexistent `bun run propagate:apply`; `--check-drift` drift is warn-only | Automation | one-time | T-19 |
| M-13 | Silent skip of unreadable files in audit scan walkers (no files-skipped count) | Automation | script-gap | T-19 + VH-9 |
| M-14 | Template provenance footer stale (`context.md:424` 0.5.3 vs actual 0.6.0); audit version note stale | Architecture | systemic | T-20 |
| M-15 | Local `docs/context.md` lags L0 template content (~35 lines missing, same footer version) | Architecture | systemic | T-20 |
| M-16 | Cosmetic: AGENTS.md tier-table header duplicated (✅ fixed with §3.7.5 edit), `.gitignore` duplicate `memory/archive/`, `memory/2026-09-08.md` misrecords a deletion as modification | Standards, Architecture | one-time | — |

---

## Root-cause chains (base-map cross-validation)

1. **Scaffold/tier-alignment group** (H-1, H-2, H-13, part of H-12): this checkout was scaffolded from the L0 workspace, but post-creation steps (placeholder substitution, tier-gating of governance docs, alias path resolution) were never executed or enforced. One scaffold-pipeline hardening pass addresses the group.
2. **L0↔project sync-mechanism group** (C-3, C-4, M-15): registry files (`SKILLS.md`, skill tables, `docs/context.md`) are hand-maintained copies with no drift gate — the same class of drift the WS-01 parity check eliminated for template content.

## Script-gap ratchet (validator-hardening tickets)

| ID | Gap | Proposed standing check |
|----|-----|------------------------|
| VH-1 | SKILLS.md registry drift undetected | extend `skill-lifecycle-audit.ts` to diff registry rows vs `skills/*/SKILL.md` frontmatter |
| VH-2 | `verify-memory.ts` misses index→disk direction | add reverse dead-link check |
| VH-3 | `.bat` scripts invisible to registry verification | add `.bat` to `SCRIPT_EXTENSIONS` (or delete `setup.bat`) |
| VH-4 | agent `last_updated` staleness silent | warn when frontmatter date < last git commit date |
| VH-5 | `variant.json` skills entries unvalidated | extend `audit-variant.ts` skills-array existence check |
| VH-6 | missing `rootAllowlist` → silently empty allowlist | fail-loud "schema missing rootAllowlist" guard |
| VH-7 | template placeholders survive into live context files | audit WARN on `[Project Name]`-style placeholders |
| VH-8 | `docs/designs/` excluded from language validation | narrow the exclusion or frontmatter-check the dir |
| VH-9 | audit scan skips unreadable files silently | count skipped files per scan, WARN when > 0 |

## Action wiring

All deferred items were filed as L0 workspace manual tickets on 2026-09-09 (tickets/governance/, `bun scripts/ticket.ts create --manual`).

**Validator-hardening (script-gap ratchet)**:

| Report ID | Ticket | Gap |
|---|---|---|
| VH-1 | `T-20260909-001` | SKILLS.md registry drift check |
| VH-2 | `T-20260909-002` | verify-memory.ts reverse dead-link direction |
| VH-3 | `T-20260909-003` | `.bat` in SCRIPT_EXTENSIONS / delete setup.bat |
| VH-4 | `T-20260909-004` | agent `last_updated` freshness vs git history |
| VH-5 | `T-20260909-005` | audit-variant.ts skills-array existence check |
| VH-6 | `T-20260909-006` | rootAllowlist fail-loud guard |
| VH-7 | `T-20260909-007` | context.md placeholder check |
| VH-8 | `T-20260909-008` | validate-md-language `docs/designs/` blind spot |
| VH-9 | `T-20260909-009` | audit scan skipped-file counting |

**Deferred work tickets**:

| Report ID | Ticket | Pri | Report ID | Ticket | Pri |
|---|---|---|---|---|---|
| T-1 | `T-20260909-010` | high | T-11 | `T-20260909-020` | normal |
| T-2 | `T-20260909-011` | high | T-12 | `T-20260909-021` | normal |
| T-3 | `T-20260909-012` | high | T-13 | `T-20260909-022` | low |
| T-4 | `T-20260909-013` | normal | T-14 | `T-20260909-023` | low |
| T-5 | `T-20260909-014` | normal | T-15 | `T-20260909-024` | low |
| T-6 | `T-20260909-015` | normal | T-16 | `T-20260909-025` | low |
| T-7 | `T-20260909-016` | normal | T-17 | `T-20260909-026` | normal |
| T-8 | `T-20260909-017` | normal | T-18 | `T-20260909-027` | low |
| T-9 | `T-20260909-018` | normal | T-19 | `T-20260909-028` | normal |
| T-10 | `T-20260909-019` | low | T-20 | `T-20260909-029` | low |

## Fixes applied this session

- **C-1**: `.cache/` gitlinks untracked + caches deleted — shipped in PR #290 (2026-09-08).
- **C-2**: AGENTS.md §5 (§5.1/§5.1.1/§5.2/§5.3) and §10 ported verbatim from L0; `## PM Gateway Policy` → `## §3:`; `## 8.` → `## §8:`; §3.7.5 governance-backlog stub added (L0-only note); duplicated tier-table header fixed. All previously dangling anchors (`#51-*`, `#511-*`, `#agent-roster`) now resolve.
- **C-3**: `skills/SKILLS.md` registry regenerated from `skills/*/SKILL.md` frontmatter — 33 rows, versions corrected (meeting-facilitation 1.4.1, generate-floorplan-svg 2.3.1, project-review 1.2.0, skill-lifecycle-manager 1.3.0, security-scan 1.2.0, translate 1.0.1), phantom owners fixed (security-scan→pm, validate-docs-links→pm, ui-ux-pro-max→design-lead).
- **C-4**: `skills/meeting/` (v1.4.1, owner pm) copied from `templates/common/skills/meeting/`; mirrors synced via `sync-skills.ts`.
- **M-7**: `docs/reports/` created with this report (header convention = this file's frontmatter block).

## Verification

Post-fix battery (2026-09-08, after C-2/C-3/C-4 fixes on this branch):

| Command | Result |
|---|---|
| `bun scripts/audit.ts` | ✅ All checks passed (incl. skill-graph drift gate — regenerated, 70 nodes / 64 edges) |
| `bun scripts/skill-lifecycle-audit.ts` | ✅ All 33 skills healthy |
| `bun scripts/agent-lifecycle-audit.ts` | ✅ All 23 agents healthy |
| `bun scripts/verify-scripts.ts --verify` | ✅ 104 scripts verified (1 pre-existing deprecation WARN) |

Anchor resolution: `AGENTS.md#51-standard-execution-plan-template`, `#511-design-gate-exemptions`, `#agent-roster`, `#lifecycle-management` all resolve after the §-heading restoration.

Known pre-existing, untouched: 8 `apply-handbook-theme` test failures (L0-only path reference, ticket T-4/T-2), deprecated `check-pm-approval.ts` removal due 2026-11-30.
