# Project Review — ai_workspace (workspace root + templates/ + services/) — 2026-09-30

**Date**: 2026-09-30 01:30 KST
**Scope**: workspace root L0 + templates/ + services/; window 2026-09-29 02:02 → run (84 commits, 192 paths)
**Method**: machine battery + FULL-mode 4-slot agent review (trigger: 8+ L0 agent files changed — the entire roster)
**Runner**: daily fleet-review automation (ADR-0089); standing specs + auto-release design

## Baseline

6/6 green. **Main CI: green streak** — ≥10 consecutive Test Suite successes on main through #1205 and beyond (09-29 08:15Z→15:18Z). Fleet 13/13 at **v0.8.1** (released overnight).

## Review Results

### 🔴 Critical

None.

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | **T-20260927-016 record stale, quota STILL ACTIVE**: the 10 private upgrade PRs it gated merged anyway overnight (post-record owner merges — undocumented in CHANGELOG/memory until this report), and fresh co-consult CI runs still show runner=none (5-6s failures, zero steps) — billing NOT resolved | C+B | `tickets/governance/T-20260927-016.yaml:10,17-19`; co-consult runs 36520584473/36517085088 | stale-blocker + fleet-infra | Keep OPEN (quota real); record-plane correction in this report; merges done under owner authority — the record plane now documents them | report + record note |
| H2 | Record-plane discrepancy: yesterday's resync report says "10/12 OPEN — quota-blocked" but all 10 merged overnight (owner action, unrecorded until now) | D | memory/2026-09-29.md:74, resync-daily-r?:19 | report-accuracy | This report is the correcting record; CHANGELOG backfill convention (per the 09-27 precedent) applies to the owner's landing | reported |
| H3 | 8 agent lifecycle records edited (model-ID comment drops) without Last Updated bumps or history rows | B | `docs/lifecycle/agents/{8}.md` | lifecycle-record coherence nick | Stamp the refreshes | T-20260930-001 |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | templates/CHANGELOG.md section ordering broken ([0.6.0] above [Unreleased]/[0.8.1]; [0.8.0] mis-dated) + auto-release prepend logic check | C | release-hygiene | T-20260930-003 |
| M2 | co-workspace rename residue: 3 dead design-doc links (README/AGENTS) remain though T-20260928-004 closed with 4-of-6 items landed | A+D | one-time rename residue | T-20260930-004 |
| M3 | Malformed SCRIPTS.md row (regenerate-agents-md.ts) — 1 standing verify-scripts warning | C | registry-hygiene | T-20260930-002 |
| M4 | PM tier-floor semantics template-forward-only: 13 fleet pm.md copies lack 1.2.1 floor semantics; upgrades deliberately preserve the override (pm is contract-overridable) | A | propagation drift, partially documented | T-20260930-005 (backfill-or-accept decision) |
| M5 | gateway tenant.delete leaves orphaned tenant dir under data/tenants | A | robustness (runtime-only) | T-20260930-006 |
| M6 | 2 approved specs >14d stale (upgrade-project-drift-fixes 15d; governance-docs-architecture) | B | registry triage | recorded |
| M7 | Tooling: bare `gh run list --branch main` resolved a DIFFERENT repo (runner must pin --repo) | C | tooling note | recorded — runner practice updated |

### ✅ FIXED-CONFIRMED / VERIFIED

- Main CI green streak ≥10 consecutive (C1 fix holding).
- T-20260929-001 already done: 9/23 co-workspace suites use the portable HERMES_BIN_PREFIX pattern; the 5 named suites have zero whole-file win32 gates (remaining gates narrow + justified).
- T-20260928-005 corrected diagnosis verified: anthropic/antigravity pass locally (17 pass).
- T-20260928-004: 4 of 6 items landed (links partially — see M2, Formerly-quote gone, image name, ADR-0092 addendum).
- co-work adjudication progressed: initial commit landed (a393d80) + v0.8.1 sync PR #1 merged; 0 untracked — T-20260929-002's fix verified live (new-project v1.33.0 seeds the initial commit through the pre-commit sync-context contract).
- v0.8.1 release chain fully traceable: VERSION ↔ CHANGELOG ↔ tag (6b636c2c) ↔ release commit (0e42cb09); released manually 12:32 KST (owner), auto-release fingerprints exact.
- L1 propagation exact for the roster change: pm.md 1.2.1 + PM Tier Semantics via COMMON-AGENTS zone; contract pm 1.2.1; model-ID cleanup zero-residue.
- Fleet spot-checks (co-work #1, co-newbiz #424, co-architect #354): 0.8.1, HERMES.md present, audits green with the new model-registry gate.
- Secrets clean: docker/.env.sample placeholder-only; data/ never committed; credential grep hits prose/fixtures only.

## Window-facts corrections (agent-verified)

1. 9 agent files (not 8) — agents/ holds 9 including skill-graph-analyst.
2. The v0.8.1 release was **manually invoked by the owner 12:32 KST** — not the 01:30 runner (the runner's yesterday run was v0.8.0).
3. The 10 private upgrade PRs merged **post-record** (owner action over quota-red CI) — the record plane now documents them.
4. `--usage-file` is intentionally NOT passed to chat (tokens from the stream envelope; a test asserts absence).

## Action wiring

| Route | Items |
|-------|-------|
| Closed | T-20260929-013 (landed via PR #1227 — corrected record) |
| Tickets created | T-20260930-001 (record stamps, low) · -002 (SCRIPTS.md row repair, low) · -003 (changelog reorder, normal) · -004 (dead links, normal) · -005 (PM floor backfill-or-accept, normal) · -006 (tenant.delete orphan, low) |
| Kept open | T-20260927-016 (quota real) · T-20260927-012/-010 · T-20260928-002 (accuracy note recorded via -001's close) |

## Mode announcement

FULL mode (structural trigger: 8+ agent files — the entire L0 roster; plus the double schema/contract triggers carried from the window's overnight activity).
