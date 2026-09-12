# Project Review — Workspace Root — 2026-09-12

**Date**: 2026-09-12
**Scope**: workspace root (L0) full review — 4 parallel review slots + machine validator battery
**Method**: 4 parallel Explore review agents (Architecture+Scaffolding / Standards+Lifecycle / Automation / Docs+Security) + machine battery + base-map cross-validation; no fixes applied in-session (status-check request; 2026-09-10 remediation sweep landed 2 days ago) — all outcomes wired to 22 governance tickets (T-20260912-003 … T-20260912-024)

> Analysis only — no files modified in this report (ticket creation and this report excepted).

## Baseline (Step 0 — before agent dispatch)

| Validator | Result |
|---|---|
| `bun scripts/audit.ts` | ✅ All checks passed (0 ERROR). 7 context-commonization WARN candidates (WARN-only heuristic, ADR-0050 Part 3) |
| `bun scripts/validate-templates.ts` | 0 error / 2 WARN — `marker-inject [governance-agents]`: co-safety COMMON-AGENTS divergence awaiting adjudication (T-20260910-022). **Note**: this is the T-20260910-018 parity detector firing as designed (see Ratchet) |
| `bun scripts/verify-scripts.ts --verify` | ✅ 169/169 registered scripts in sync |
| `bun run agent-lifecycle-audit` | ⚠️ 8 WARN — stale `last_updated` frontmatter re-accumulated after agents/*.md were touched by 09-12 commits (was 0 after the 09-10 cleanup) |
| `bun run skill-lifecycle-audit` | ⚠️ 2 WARN — deprecated `audit-workspace` (removal 2026-10-10, ticketed) and `validate-docs-links` (removal 2026-12-09, **was not ticketed — fixed this run, T-20260912-013**) |
| `bun scripts/propagate-to-templates.ts --check-drift` | gemini-settings only (6/13 differ — intentional, tolerated) |

No T-03 escalation (0 ERRORs); full-mode dispatch proceeded.

## Review Results — findings (deduplicated across slots)

Class legend: `one-time` = instance drift, fix and forget · `systemic` = recurring, needs judgment · `script-gap` = a machine should have caught it; ratcheted into validator-hardening tickets.

### 🔴 Critical (2) — ticketed, not fixed in-session

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| C1 | `new-project.ts` scaffolds a **body-less PM agent for 5/13 variants** (co-export, co-hr, co-news, co-price, co-safety): the extends-stub resolver fires only when the stub body is empty (`pmBody.trim() === ''`), but these variants ship prose-only stub bodies → L3 projects get `agents/pm.md` = frontmatter with unrendered `variant_overrides` + dangling `extends:` + one prose line; the entire PM body (PM Gateway, Permission Denial Protocol, Design Gate) is missing. `variant_overrides` has no consumer in the scaffold path; `test-new-project.ts:145` asserts file existence only and defaults to co-develop (empty stub). Mitigation: first `upgrade-project` heals the body. **Recurrence: T-20260908-009 closed `done` with 0 attempts while this defect class is live** | architect | `scripts/new-project.ts:560`, `scripts/test-new-project.ts:145`, `templates/co-export/agents/pm.md` (byte-verified) | script-gap (recurrence) | T-20260912-004 |
| C2 | **Duplicate Accepted ADR numbers**: `0074-universal-design-gate` + `0074-graft-fleet-integration`, and `0075-flat-skill-layout` + `0075-codex-platform-support` — all `status: Accepted`, two pairs committed the same day (2026-09-12). Citations now ambiguous across SSOTs (AGENTS.md cites ADR-0074 = design gate; CONSTITUTION.md cites ADR-0074 = graft). `verify-adr-governance.ts` checks content markers but has no ID-uniqueness logic — no machine catches collisions | auditor | `docs/adr/0074-*.md` ×2, `docs/adr/0075-*.md` ×2; `scripts/verify-adr-governance.ts` | script-gap | T-20260912-003 |

### 🟡 High (10) — ticketed, not fixed in-session

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | `scrubConstitutionRefs` prose branch applies to **any** file under `templates/` (isCode guard covers only .ts/.tsx/.js/.jsx): corrupted a functional JSON field (L1 `propagation-map.json` `source_file` → "context.md") and made L1 CLAUDE.md/GEMINI.md line 3 self-referentially false. The map's own note claims L1 copy is "kept byte-identical per validate-templates.ts glob parity" — false twice (not byte-identical; nothing enforces it; PM-01 validates only the L0 copy); `known-issues.json` ISSUE-008 repeats the claim | architect | `scripts/propagate-to-templates.ts:462-465,621-624,704-708`; `templates/common/scripts/propagation-map.json:226` | script-gap | T-20260912-005 |
| H2 | L1 `docs/context.md:533` carries a live `CONSTITUTION.md §8.15` reference; `audit.ts` L0-leakage check exempts the **whole file** (one `intentional-duplicate` marker at :403); the scaffold sanitizer then deletes the whole line — destroying the version footer that `upgrade-project`'s docs/context.md version-sync depends on → **permanent silent no-op for every scaffolded project** | architect | `templates/common/docs/context.md:533`; `scripts/audit.ts:2307-2322`; `scripts/new-project.ts:483-490`; `scripts/helpers/context-sections.ts:263` | script-gap | T-20260912-006 |
| H3 | `lifecycle-sync-audit` Check C reports committed L0↔L1 mirror drift on 3 skills (sync, gateguard, translate — all the intentional CONSTITUTION→context scrub) as **warning-only**; its fix hint (`propagate:apply`) would clobber the scrub — checker and propagation engine disagree on the invariant; permanent warnings mask real drift | auditor | `scripts/lifecycle-sync-audit.ts` (Check C); `skills/{sync,gateguard,translate}/SKILL.md` | systemic | T-20260912-005 |
| H4 | `validate-docs-links` removal (2026-12-09) is documented everywhere but has **no backlog ticket** (asymmetric with audit-workspace's T-20260910-010); AGENTS.md documents only audit-workspace's removal | auditor | `skills/validate-docs-links/SKILL.md`; `tickets/`; `AGENTS.md:519` | one-time | T-20260912-013 (created, not-before 2026-12-09) |
| H5 | 4 of 8 spot-checked skill lifecycle records contradict their subjects: sync.md says v1.3.0 (actual 1.5.0), security-scan owner security-expert (actual pm), validate-docs-links owner docs-writer (actual pm), upgrade-project is a Phase-A stub despite v1.4.1 active skill. No machine check diffs record vs frontmatter | auditor | `docs/lifecycle/skills/{sync,security-scan,validate-docs-links,upgrade-project}.md` | script-gap | T-20260912-010 |
| H6 | test.yml "Tier 3 Auditor" runs 4 lifecycle audits in one pwsh step; `PSNativeCommandUseErrorActionPreference` defaults false in pwsh 7.4 → only the LAST command's exit code counts; 3 of 4 audits can fail while required CI goes green (weekly-health-check.yml splits them correctly, which is why this survived) | automation-engineer | `.github/workflows/test.yml:124-142` | one-time | T-20260912-008 |
| H7 | dev-sync step 3.7 "L0/L1 script drift check" is **completely inert**: `verify-scripts --check-drift` run with `.quiet().nothrow()` and exit code discarded — drift neither fails nor prints; every other gate checks `.exitCode` | automation-engineer | `scripts/dev-sync.ts:315-321` | one-time | T-20260912-009 |
| H8 | dev-sync step 5 branch creation is **fail-open**: both checkouts use `.nothrow()`, so a refused `checkout -b` falls through to `git add -A` + commit + push **on main**; only remote branch protection would catch it | automation-engineer | `scripts/dev-sync.ts:762-774` | one-time | T-20260912-007 |
| H9 | README "Built-in Country Profiles" — the flagship first-touch section — links `docs/countries/KR.md` (404) and cites `docs/country-profiles.md`; both exist only under `templates/`, not at L0 | docs-writer + security | `README.md:40` | one-time | T-20260912-011 |
| H10 | `LIFECYCLE_GOVERNANCE.md` References table is **5-for-5 dead links**, plus three mutually inconsistent location claims for VERSION_REGISTRY.json; the link gate doesn't cover this file | docs-writer + security | `docs/governance/LIFECYCLE_GOVERNANCE.md:9,192,205-209` | one-time | T-20260912-012 |

### 🟢 Moderate (22 after dedup/grouping)

| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | One-directional manifest validation (declared→exists only): co-game `validate-asset-manifest.ts` undeclared; co-safety declares 2 agents vs 42 files on disk — consumers under-count | architect | `validate-templates.ts:358-366`; `templates/co-{game,safety}/variant.json` | script-gap | T-20260912-014 |
| M2 | `common-contract.json` declares 2 PM skeleton sections that exist nowhere; C-SK-02 silently skips missing declared sections | architect | `docs/templates/common-contract.json`; `validate-templates.ts:2353-2356` | one-time | T-20260912-022 |
| M3 | L0 pm.md frontmatter says "Orchestrates Phases 0, 2, 5, 6" vs body/schema [0, 1-2, 5] | architect | `agents/pm.md:13` | one-time | T-20260912-022 |
| M4 | new-project usage strings omit the `codex` platform (ADR-0075) | architect | `scripts/new-project.ts:4,57,79-80` | one-time | T-20260912-022 |
| M5 | SCRIPTS.md prose excludes lib/helpers but its registry rows include them; VERSION_MANIFEST "Scripts: 93" lacks a scope note vs 169-row SCRIPTS.md | auditor | `scripts/SCRIPTS.md:1-2`; `docs/VERSION_MANIFEST.md:13` | systemic | T-20260912-022 |
| M6 | ADR master index says "0001 through 0069" (directory now holds 0001–0075 ×2 collisions) | auditor | `docs/index.md:58` | one-time | T-20260912-022 |
| M7 | `memory/MEMORY.md` links archive files that are untracked (0 in git; 56 local-only) — fresh clones get dead index links | auditor | `memory/MEMORY.md:15-19` | systemic | T-20260912-023 |
| M8 | Ticket hygiene: T-20260911-001 closed `done` with 0 attempts, before its own not_before; 102 done tickets accumulate flat with no archive rotation | auditor | `tickets/governance/T-20260911-001.yaml` | systemic | T-20260912-023 |
| M9 | Nightly-run log block deviates from the verify-memory/constitution daily-log section convention (passes only via later same-file blocks) | auditor | `memory/2026-09-12.md:1-21`; `scripts/verify-memory.ts:29-34` | one-time | T-20260912-023 |
| M10 | sync-skills Phase-2 premise stale: SHORTCUT_SKILLS includes SSOT-existing names; Phase 1 overwrites `.agents` first so hand-edits are silently clobbered; `.codex` never receives shortcut skills | automation-engineer | `scripts/sync-skills.ts:255-265` | one-time | T-20260912-017 |
| M11 | sync-skills has no concurrency guard; non-atomic rm-then-cp can be captured mid-write by dev-sync's immediate commit | automation-engineer | `scripts/sync-skills.ts:134-137` | systemic | T-20260912-017 |
| M12 | CI/local gate asymmetry: validate-docs-links blocks every /sync pre-flight but runs in no CI workflow; the pre-flight catch fails open | automation-engineer | `scripts/dev-sync.ts:147-159` | systemic | T-20260912-018 |
| M13 | test.yml drift gate keyed on keyword grep of human-worded output (`differ\|missing\|extra`) — report wording change silently passes unexpected drift | automation-engineer | `.github/workflows/test.yml:157-168` | script-gap | T-20260912-016 |
| M14 | Module-mode hazards: spec-register.ts runs CRUD at import top level with cwd-relative registry; validate-templates.ts bare `main()` hard-exits; l3-to-variant-pipeline.ts rejection backstop exits 0 (instances of the un-typechecked-import class already ticketed as T-20260910-012) | automation-engineer | `scripts/spec-register.ts:24,81-185`; `validate-templates.ts:3690-3693`; `l3-to-variant-pipeline.ts:1504` | script-gap | T-20260912-019 |
| M15 | qa-gate Step 4 L0↔L1 parity is shallow: top-level .ts only, intersection-only (deletions never flagged), SKILL.md-only for skills | automation-engineer | `scripts/qa-gate.ts:84-116` | script-gap | T-20260912-021 |
| M16 | Korean content outside translation zones that the language validator structurally cannot see: ADR-0072 inline terms, DEC-20260825-02 quote, VERSION_MANIFEST generated k-* tables (no frontmatter); policy gray zone: docs/constitution/* part-files carry lang: ko while AGENTS.md says exception "NOT available for CONSTITUTION.md" | docs-writer + security | `docs/adr/0072-skill-term-nodes.md:13-24`; `docs/decisions/DEC-20260825-02.md:26`; `docs/VERSION_MANIFEST.md:58-62` | script-gap | T-20260912-015 |
| M17 | Broken relative paths/anchors in live docs: l0-l1-differences.md (wrong depths, internally inconsistent), platform-parity-rules.md (phantom ADR-0033 title + stale anchors), variant-lifecycle.md ("to be created" refs never created + deleted new-project.sh), ecc-phase1-governance-design.md (nonexistent §11 part file — one hop from CONSTITUTION.md), AGENTS.md:480 `{#skills}` anchor unresolvable in any renderer | docs-writer + security | see ticket for full list | one-time | T-20260912-020 |
| M18 | Duplicate merge-artifact sections: README Prerequisites ×2 (first empty), getting-started Optional Software ×2 (divergent content), CLAUDE.md double "### 2" numbering (GEMINI.md parallel is clean) | docs-writer + security | `README.md:44,48`; `docs/getting-started.md:80,102`; `CLAUDE.md:74,153` | one-time | T-20260912-020 |
| M19 | Stale refs contradicting current rules: `scripts/setup.sh` mention (deleted; ADR-0036 TS-only), `template-v0.5.3` cited as baseline in current planning docs (tag never existed; latest is 0.6.0) | docs-writer + security | `docs/getting-started.md:~131`; `docs/variant-roadmap-2026-q3-q4.md:20,225`; `docs/designs/variant-templates-advancement-design.md:11,81` | one-time | T-20260912-020 |
| M20 | pre-rebase secret gate silently no-ops without gitleaks (pre-push has a blocking regex fallback — inconsistent); CI smoke test exercises only the gitleaks-installed path | docs-writer + security | `.githooks/pre-rebase`; contrast `scripts/hooks/pre-push.ts:152-161` | systemic | T-20260912-021 |
| M21 | Gitleaks allowlist breadth (documented, currently clean): 804 KB CHANGELOG fully unscanned, `Projects/` entire dir exempt, all co-security agent docs exempt | docs-writer + security | `.gitleaks.toml` | systemic | T-20260912-021 |
| M22 | Historical-record docs carry ~90+ frozen dead links (agents-md-final-structure, retired ADRs, old plans); suggest "links frozen as of" banners rather than mass edits | docs-writer + security | `docs/designs/agents-md-final-structure.md` etc. | systemic | report-only (batch next release cycle) |

### ℹ️ Low / Improvements

| # | Issue | File | Ticket |
|---|-------|------|--------|
| L1 | BSD-only `sed -i ''` in explain-me BUILD_GUIDE (agent-executed doc; breaks on GNU/Linux) | `.claude|/.gemini/skills/explain-me/references/BUILD_GUIDE.md:379` | T-20260912-024 |
| L2 | nightly-tickets.yml model var renders malformed argv if repo variable unset; test.yml uploads artifact globs nothing creates | `nightly-tickets.yml:123-125`; `test.yml:170-177` | T-20260912-024 |
| L3 | README `--version 0.5.0` examples lag latest tag 0.6.0 (valid syntax) | `README.md:126,304` | report-only |
| L4 | error-handling.ts lib adopted by only 18 files; biggest gates hand-roll (mostly correct) — mandate or shrink | `scripts/lib/error-handling.ts` | report-only |

### ✅ Strengths (verified by review agents)

1. **Security clean bill**: repo-wide secret greps zero real hits (the only key-shaped literal is a deliberately split fake in test.yml, commented); no `pull_request_target` anywhere; all 16 action refs SHA-pinned; least-privilege `permissions:` per job; `edu-sync.yml` PAT via credential helper with fail-loud leak check; `ssrf.ts` genuinely hardened (DNS pinning, CIDR + metadata ranges) and used by all ingestion paths; no `eval`/shell-string interpolation in scripts/.
2. **CI hygiene exemplary**: zero `continue-on-error` in any workflow; bun pinned 1.4.0 everywhere; concurrency groups; the `hook-secret-gates` job end-to-end proves hooks block a planted key in throwaway repos (landed from T-20260910-020 — ratchet win).
3. **dev-sync dangerous paths fail closed**: sensitive-file guard exits before staging; scoped-staging aborts on empty S0; sync-context token per-run file with stale sweep; English gate before any git mutation.
4. **sync-skills.ts is a model citizen**: compare-then-copy idempotency, lstat-based symlink comparison with depth cap (T-20260910-026 landed — ratchet win), per-item error collection that still fails the run.
5. **Extends chain structurally sound** end-to-end (L0→L1→13 stubs all resolve); the 8 empty-body stubs scaffold self-contained PM agents; frontmatter allowlist enforced.
6. **Propagation-map marker declarations match reality exactly** (11 COMMON-CONTEXT, 13 COMMON-AGENTS, co-safety divergence documented + ticketed).
7. **Variant contracts hold**: 10 required files × 13 variants zero missing; VERSION_REGISTRY covers 13/13; common-contract 31 skills + 6 exclusions match L1 exactly; co-consult/co-game deep-checks internally consistent.
8. **Deprecated-skill coherence genuinely good**: both deprecated skills consistently marked across 4 surfaces with owners/rationale/successors; audit-workspace date-gated in backlog.
9. **Retired-skill records exemplary** (no orphaned active records); manifest↔SKILL.md version/owner coherence verified on 6 samples.
10. **Governance backlog healthy**: only 1 ready manual ticket pre-review; nightly automation escalates for human adjudication instead of auto-acting.
11. **Terminology parity holds**: CLAUDE.md §5 ↔ GEMINI.md §5 semantically identical; agent roster coherent across 5 surfaces; README variant table matches templates/ exactly.
12. **Honest governance self-assessment**: LIFECYCLE_GOVERNANCE coverage matrix openly marks machine-coverage gaps rather than overclaiming.

## Action wiring

No fixes applied in-session (status-check request; the 2026-09-10 remediation sweep is still unmerged-cycle-adjacent). Routing per skill Step 5:

- **22 tickets created**: T-20260912-003 … T-20260912-024 (pre-existing today: T-20260912-001 co-newbiz upgrade risk, T-20260912-002 graft fleet rollout).
  - Urgent: T-20260912-003 (ADR duplicates + uniqueness gate), T-20260912-004 (PM stub resolution + scaffold test).
  - High: T-20260912-005 (scrub scope + Check C reconciliation), -006 (context.md footer chain), -007 (branch fail-open), -008 (pwsh masking), -009 (inert drift gate), -010 (lifecycle records + diff gate), -011 (README links), -012 (LIFECYCLE_GOVERNANCE refs).
  - Normal: T-20260912-013 (validate-docs-links removal, not-before 2026-12-09), -014 (manifest reconciliation), -015 (language-validator scope), -016 (machine-readable drift mode), -017 (sync-skills hardening), -018 (CI docs-links parity), -019 (import guards/exit codes), -020 (live-doc repair batch).
  - Low: T-20260912-021 (qa-gate depth + pre-rebase fallback + gitleaks periodic audit), -022 (registry/doc hygiene), -023 (memory archive + ticket hygiene + nightly log), -024 (sed/nits batch).
- **Report-only (no ticket)**: M22 frozen historical links (banner approach, next release cycle), L3 README version examples, L4 error-handling adoption policy.
- **Ratchet accounting**: `script-gap` findings this run: C1, C2, H1, H5, M1, M13, M14, M15, M16 → 9 findings, all wired to validator-hardening-carrying tickets (003, 004, 005, 010, 014, 015, 016, 019, 021).

## Ratchet check (vs 2026-09-08 and 2026-09-10 reports)

**Wins — prior script-gap classes now caught by machines:**
- WS-01 L1 parity gate (2026-09-08): holding — validate-templates 0 error two runs straight.
- T-20260910-018 marker parity check (2026-09-10 H16): **operational** — today's co-safety `governance-agents` WARN is this detector firing; only the adjudication (T-20260910-022) remains.
- T-20260910-020 gitleaks CI smoke test: landed and verified excellent by this run's automation slot.
- T-20260910-026 symlink handling: landed in sync-skills (lstat compare + depth cap).

**Misses — recurrence evidence:**
- **T-20260908-009 closed `done` (0 attempts) while the pm.md scaffold defect is live** in its prose-stub form → this run's C1. Canonical ratchet failure; reopened via T-20260912-004 with the missing standing check (all-variant body assertion) attached.
- `agent-lifecycle-audit` stale-date warnings re-accumulated to 8 (were cleaned to 0 on 09-10): the detector exists but nothing enforces bump-on-touch — accepted as warning-level noise for now; revisit if it persists next review.

**Trajectory**: found-by-agent 9 script-gap (vs 7 on 09-10, 6 on 09-08) but detector coverage is visibly widening; the dominant remaining pattern is *gates that exist but don't gate* (inert checks, warning-only drift, fail-open steps) — 6 of this run's 10 High findings are exactly that class.

## Verification

Not applicable — no fixes applied in-session. Baseline table above is the verification of record. Next step after tickets land: `/sync "fix(review): project-review 2026-09-12 remediations"` or `project-resync`.
