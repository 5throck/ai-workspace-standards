# Project Review — Workspace Root — 2026-10-05 (daily fleet review, run-9)

**Date**: 2026-10-05
**Scope**: workspace root (L0) + templates/ — FULL mode
**Method**: 4 parallel Explore review slots (A Architecture+Scaffolding / B Standards+Lifecycle / C Automation / D Docs+Security) + machine battery + skill-graph fleet report
**Mode rationale**: window non-empty AND two structural triggers fired — 3 agent files changed (pm/architect/docs-writer) and docs/templates/common-contract.json + workspace-schema.json touched. Friday override not applicable (Monday).
**Window**: 2026-10-04T01:56:15 → HEAD `277f6442` (PRs #1399–#1411; 504 files, 269 R100 renames — the docs/ physical consolidation; L1 skills wave ci-triage 0.2.0 across 5 mirrors; ADR-0098 LLM Interaction Standard migration; 18 tickets T-20261004-001..018 processed by concurrent sessions)

## Baseline (machine battery)

| Validator | Result |
|---|---|
| audit.ts | ✅ PASS (exit 0) |
| validate-templates.ts | ✅ PASS |
| verify-scripts.ts --verify | ✅ PASS (218 registered, 0 warnings) |
| agent-lifecycle-audit | ✅ PASS |
| skill-lifecycle-audit | ✅ PASS |
| propagate-to-templates --check-drift | ✅ PASS (tolerated class only: gemini-settings) |
| propagate --dry-run | ✅ 375/375 in sync, zero pending zones |

## Skill-graph orphan sweep

- Snapshot `memory/skill-graph-metrics/snapshot-2026-10-05.json` committed in this landing (diff base for tomorrow).
- rootOrphans vs prior snapshot: isolatedSkills NEW 0 / VANISHED 0; isolatedAgents NEW 0 / VANISHED 0 (standing: auditor, automation-engineer, docs-writer, security-expert, skill-graph-analyst — no NEW).
- missingFromProjects: no newly-appearing per-project gaps vs 2026-10-04 snapshot. Jaccard 0.73–0.94, no convergence candidates ≥ threshold movement.
- Gap check (a): every skill named in agents/*.md exists — `decision-record` is the documented deliberate L1-only common asset (AGENTS.md §6 whitelist). Gap check (b): no lifecycle record with a vanished subject (whitelists per 2026-09-27 report applied).

## Per-target verification (window items)

- L1 wave deployment: propagate dry-run 375/375 in sync; five-mirror parity for the 5 updated skills md5-verified identical (Slot A).
- co-price (only in-window project merge): template-version 0.10.0, audit PASS, verify-scripts 141/141 clean, tree clean, on main.
- co-safety stranded branch `pr/20261003-225351-docs-security-phase-b`: commit 6d7b4a7 turned out ALREADY MERGED as PR #196 by a concurrent session — local repo had a stale main and sat on the branch. Fixed: fetched, fast-forwarded local main to origin/main (`2dfd084`), deleted the redundant branch local+remote (it had been re-pushed by this runner before the containment check), gitleaks clean over the diff set.

## Review Results

### 🔴 Critical
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|

*(none)*

### 🟡 High
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1a | Reorg-induced dead links from R100 rename: `../README.md` silently retargets docs/README.md, `../CONSTITUTION.md` dead | D | docs/guides/getting-started.md:366 | one-time | ✅ fixed → `../../README.md`, `../../CONSTITUTION.md` |
| H1b | Dead link: variant-creation-workflow target moved to docs/guides/ in-window | D | docs/adr/0039-l0-l1-l2-hierarchy-and-extends.md:873 | one-time | ✅ fixed → `../guides/variant-creation-workflow.md` |
| H2 | New dead link added in-window: `../../AGENTS.md` resolves to nonexistent docs/AGENTS.md | D | docs/governance/agents/workflows.md:36 | one-time | ✅ fixed → `../../../AGENTS.md#36-3-tier-strategy` |
| H3 | `validate-docs-links.ts --all` reports 62 broken links across 530 files; subdirectory scan is not a gated mode | D | scripts/validate-docs-links.ts (header scope) | script-gap | T-20261004-024 |

### 🟢 Moderate
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | ci-triage lifecycle footer Version 0.1.0 vs header/frontmatter 0.2.0; changelog missing 0.2.0 entry | B | docs/lifecycle/skills/ci-triage.md:49 | one-time | ✅ fixed footer + added changelog entry; gate → T-20261004-020 |
| M2 | architect.md + docs-writer.md substantive edits unstamped (last_updated 2026-09-29, no lifecycle row) while VERSION_MANIFEST says modified 2026-10-04 | B | agents/architect.md:2, agents/docs-writer.md:2 | script-gap | ✅ hand-stamped both (frontmatter + lifecycle row + footer); machine check → T-20261004-023 |
| M3 | SKILLS.md ci-triage description drift root vs common (root gained "; merge-time CI healing loop") | B | skills/SKILLS.md:59, templates/common/skills/SKILLS.md:45 | script-gap | ✅ aligned; description-parity gate → T-20261004-021 |
| M4 | graft SKILL.md doctrine block added with zero registry/lifecycle movement | B | skills/graft/SKILL.md:98-107 | script-gap | ✅ hand-stamped (last_reviewed → 2026-10-04, SKILLS.md row date, lifecycle footer); covered by T-20261004-023 |
| M5 | Malformed markdown: unclosed `[...(` link syntax | B | docs/governance/github-first-checksum-verification.md:246 | one-time | ✅ fixed → plain-text form mirroring sibling |
| M6 | audit.ts/dev-sync.ts L0↔L1 copies at equal @version but ~10 lines diverge (context.md→CONSTITUTION.md substitution); template header comment says "context.md guard" over CONSTITUTION.md code; mixed internal keying ~line 925 | C | scripts/audit.ts vs templates/common/scripts/audit.ts | script-gap | T-20261004-022 |
| M7 | `data/turn-config.json` persisted with plaintext apiKey at umask-derived mode (0644), no 0600 | C | services/co-workspace/src/config.ts:561 | one-time | T-20261004-026 |
| M8 | Language gate perimeter excludes reorganized destinations (reports/guides/standards); 2 reports with Korean carried no lang declaration | D | scripts/validate-md-language.ts; docs/reports/2026-10-03-project-review-co-workspace.md, docs/reports/2026-09-26-meeting-command-retirement-audit.md | script-gap | ✅ lang: ko frontmatter added to both; allowlist extension → T-20261004-025 |
| M9 | Stale pre-reorg prose paths (`docs/analysis/…`) in 3 live design docs (navigation pointers) | D | docs/designs/2026-09-25-agents-md-size-reduction-design.md:5,12,16,100,101; 2026-09-25-hermes-agent-platform-support-design.md:130; 2026-09-26-meeting-command-retirement-design.md:7 | one-time | ✅ repointed → docs/reports/ (all targets verified present) |
| M10 | L1 llm-interaction-standard.md verbatim copy ships L0-dangling references into scaffolds (no written rule violated — policy decision needed) | D | templates/common/docs/standards/llm-interaction-standard.md:83,281 | systemic | T-20261004-028 |
| M11 | Fleet sync lag: all 13 Projects at ci-triage 0.1.1; co-design carries 0.1.2 — a version that never existed in git history (local mutation) | A | Projects/*/docs/VERSION_MANIFEST.md | one-time | Tonight's upgrade wave delivers 0.12.0; co-design diff-before-overwrite noted in resync cycle |

### ℹ️ Low / Improvements
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| L1 | resync-audit misclassifies tracked-modified file as "added-then-modified (no HEAD version)" when a HEAD version exists; group key renders truncated ("cripts/co-deck*") | PM (Phase II Step 0) | scripts/resync-audit.ts | script-gap | T-20261004-019 |
| L2 | pm.md lifecycle footer parenthetical described the previous v1.2.2 change, not the 2026-10-04 reword | B | docs/lifecycle/agents/pm.md:71 | one-time | ✅ fixed |
| L3 | upgrade-project lifecycle footer stale narrative (1.5.0 vs 1.5.2, pre-existing) | B | docs/lifecycle/skills/upgrade-project.md | one-time | Touch up on next substantive edit (pre-window) |
| L4 | Voice-mode auto-arm-on-reload undocumented in service README | C | services/co-workspace/web/index.html (PR #1399) | one-time | T-20261004-027 |
| L5 | L1 lacks canonical copies of 4 of the 5 updated skills (contract sources point at root — design observation) | A | templates/common/skills/ | systemic | Acceptable if intentional; note in contract README on next contract edit |
| L6 | co-deck delivered test copy left uncommitted (equals template byte-for-byte; T-20261004-011 recorded template+delivery, delivery uncommitted) | C | Projects/co-deck/scripts/co-deck/tests/verify-new-theme.test.ts | one-time | Discarded with snapshot (content = current template; 0.12.0 upgrade re-delivers identical content) — adjudication below |

### ✅ Strengths
- Graft re-bake incident (T-20261004-001) closed exactly per governance: package-canonical block now md5-identical across all 10 host surfaces and byte-matches the installed `@nanonets/graft` package (Slot A verified the extracted `instructionBody()`).
- ADR-0079→ADR-0098 migration executed with complete reference hygiene — zero stale anchors repo-wide (Slots A/B).
- Five-mirror parity perfect for the L1 skills wave; fork-model holds 13/13 on pm.md extends (Slot A).
- ci-triage 0.2.0 propagated across all seven surfaces in lockstep (Slot B); ticket hygiene exemplary — 18/18 T-20261004 tickets done with coherent machine-generated histories (Slot B awk-scanned all 18).
- Registry hygiene: no divergent duplicate rows in either SCRIPTS.md; all changed scripts registered with matching versions (Slot C).
- Windows login-gate timeout bump (cc42384d) is evidence-based (run 37116607423, 11.7s measured, argon2id bootstrap cause), not a mask (Slot C).
- Docs reorg executed with same-window gate alignment (manifest v1.0.1, validator v1.2.1, index.md, L1 `_templates` repointed same-day); escapes were only R100-file-internal links (Slot D).
- Credential handling disciplined: masked reads, loud validation, gitignored persistence verified untracked, tested dual-header injection; zero secrets in window diff (Slot D); `.github/` untouched.

## Fixes applied this session (all docs/metadata class)

| File | Change |
|---|---|
| docs/guides/getting-started.md | 2 link fixes (H1a) |
| docs/adr/0039-l0-l1-l2-hierarchy-and-extends.md | 1 link fix (H1b) |
| docs/governance/agents/workflows.md | 1 link fix (H2) |
| docs/governance/github-first-checksum-verification.md | malformed link repair (M5) |
| docs/lifecycle/skills/ci-triage.md | footer 0.2.0 + 0.2.0 changelog entry (M1) |
| agents/architect.md, agents/docs-writer.md | frontmatter last_updated → 2026-10-04 (M2) |
| docs/lifecycle/agents/architect.md, docs-writer.md | 2026-10-04 phase-history rows + footers (M2) |
| skills/graft/SKILL.md, skills/SKILLS.md, docs/lifecycle/skills/graft.md | graft stamps → 2026-10-04 (M4) |
| templates/common/skills/SKILLS.md | ci-triage description aligned to root (M3) |
| docs/lifecycle/agents/pm.md | footer parenthetical corrected (L2) |
| docs/reports/2026-09-26-meeting-command-retirement-audit.md, 2026-10-03-project-review-co-workspace.md | lang: ko frontmatter declared (M8) |
| docs/designs/2026-09-25-agents-md-size-reduction-design.md, 2026-09-25-hermes-agent-platform-support-design.md, 2026-09-26-meeting-command-retirement-design.md | docs/analysis/ → docs/reports/ repoints (M9) |
| memory/skill-graph-metrics/snapshot-2026-10-05.json | today's fleet snapshot (diff base) |

## Action wiring

| Ticket | Class | Summary |
|---|---|---|
| T-20261004-019 | script-gap | resync-audit added-then-modified misclassification + truncated group key |
| T-20261004-020 | validator-hardening | lifecycle footer-vs-header/frontmatter version parity |
| T-20261004-021 | validator-hardening | SKILLS.md description parity root↔common |
| T-20261004-022 | validator-hardening | core-script L0↔L1 equal-version content divergence (audit/dev-sync) |
| T-20261004-023 | validator-hardening | VERSION_MANIFEST modified-date vs frontmatter last_updated cross-check |
| T-20261004-024 | validator-hardening | gate validate-docs-links --all with frozen baseline + batch-fix 62 rot |
| T-20261004-025 | validator-hardening | language-gate perimeter extension to reorganized destinations |
| T-20261004-026 | one-time (security) | turn-config.json 0600 persistence + documented expectation |
| T-20261004-027 | one-time | voice auto-arm-on-reload README note |
| T-20261004-028 | systemic | L1 verbatim-copy divergence policy for llm-interaction-standard |

## Adjudications

- **co-deck echo discard vs commit (L6)**: Slot C recommended committing the delivered test copy; this runner discarded it instead after proving byte-equality with the current template (the only content delta vs project HEAD is the template's own T-20261004-011 fix). Committing would duplicate content the 0.12.0 upgrade re-delivers within the same cycle. Snapshot: `.pipeline-state/resync-snapshots/2026-10-05-codeck-echo/`.
- **co-safety branch**: resync-audit surfaced a stranded `pr/*` checkout; containment check proved origin/main already carried the commit (PR #196, concurrent session). No PR created; redundant refs deleted. The lesson stands: session closeout must end on main (process reminder, not a ticket — the audit detected it and the daily review acted).
- **Slot D context correction accepted**: only ci-triage of the five wave skills has a canonical copy under templates/common/skills/; the other four are root-canonical + platform mirrors. Brief framing adjusted; no inconsistency results.

## Verification

Re-run after fixes: `bun scripts/audit.ts` (post-landing), VERSION_MANIFEST regen handled by dev-sync step 3.85. Results appended after landing.
