# Project Review — ai_workspace (workspace root + templates/ + services/) — 2026-10-04

**Date**: 2026-10-04 01:30 KST (Sunday)
**Scope**: workspace root L0 + templates/ + services/; window 2026-10-03 02:01 → run (88 commits, 187 paths)
**Method**: machine battery + FULL-mode 4-slot agent review (trigger: agents/pm.md + common-contract.json changed)
**Runner**: daily fleet-review automation (ADR-0089)

## Baseline

6/6 green. Main CI: green streak (12 consecutive since 11:06Z 10-03; one windows-only flake in PR #1362 — see T-20261004-002). Fleet: v0.10.0 delivered to all 13 (11 direct merges + 6 instant auto-merges during yesterday's wave); co-price #138 open (CONFLICTING — see H-slot).

## Review Results

### 🔴 Critical

None.

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | **Graft block resurrection**: the withdrawn 41-line AGENTS.md graft block was silently re-added to root AGENTS.md:275-315 and templates/common/AGENTS.md:281-321 by commit 36a739f0 ("provider-key for claude/codex runtimes", 4h after the same-day withdrawal; unmentioned in the message) — the re-added block carries the RETIRED "Re-ask freely" phrasing, contradicts the contract row removal (cb5ac472), SKILL.md `l2_propagate: false`, and the graft-free variant templates — and will re-propagate on next sync/scaffold | D+A | root `AGENTS.md:275-315`, `templates/common/AGENTS.md:281-321` | docs-drift-resurrection (suspected graft CLI/hooks auto-append) | **Re-withdrawn this cycle** (both surfaces restored to the withdrawn state; the block remains in git history) + mechanism investigation | T-20261004-001 |
| H2 | **T-20260928-002 record still overclaims** + the substance is NOW true: last night's batch ported the remaining 5 suites (per-test gates, no whole-file skips) — but -002's record still carries the 09-28 overclaiming result text with attempts: 0 | B | `tickets/governance/T-20260928-002.yaml:19-25` | ticket-accuracy | Pointer history note (can't hand-edit yaml — recorded here; the batch's own -002-adjacent closures documented) | recorded |
| H3 | **4 review-stuck tickets closed this cycle**: T-20261003-011/026/027/028 were stuck in review though their delivery merged overnight | B | ticket yamls | process hygiene | closed done with verified results | closed this cycle |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | Graft surface residue: 4 projects still track skills/graft (+co-work 2 graft .cjs) post-custody-transfer — co-price folds into its open PR | A | propagation residue | folded into co-price #138 rebase |
| M2 | coworkspace-login-exempt design: ad-hoc format (no test-plan/residual-risk sections) | A | format drift (optional) | recorded |
| M3 | i18n-specialist lifecycle record Last Updated 2026-09-21 — consistent (outside the model-ID scope) | A | no action | recorded |
| M4 | 2 approved specs >14d stale | B | registry triage | T-20261004-004 |
| M5 | co-workspace loginRequired wave-B gate: windows-only flake (11.7s) in PR #1362, recovered same-day | C | CI-flake (windows) | T-20261004-002 |
| M6 | registry-db.ts 2 Hangul comment lines (repeat) | D | language nick | recorded |
| M7 | Tooling: `gh run list --branch main` without --repo resolves a different repo — runner practice: always pin --repo | C | tooling note | recorded |

### ✅ FIXED-CONFIRMED / VERIFIED

- **T-20260929-001 (port 5 spawn suites): DONE** — 9/23 co-workspace suites use the portable HERMES_BIN_PREFIX; the 5 named suites have zero whole-file win32 gates; remaining gates narrow + justified. Kill-wrapper fix (26e7cefd) root-caused: `exec sleep 5` replaces the shell so SIGTERM closes stdout immediately — fully portable.
- **T-20260929-002 DONE + verified live**: new-project v1.33.0 seeds the initial scaffold through the pre-commit sync-context contract; co-work v0.8.1 sync PR #1 merged; 0 untracked.
- **T-20260930-001 (8 lifecycle stamps)**: all 8 verified (Last Updated 09-29 + history rows citing 5b2778b8).
- **T-20260930-002**: SCRIPTS.md:182 single well-formed row; verify-scripts 206/206, 0 warnings.
- **T-20260930-003**: templates/CHANGELOG strictly descending; survived an actual auto-release prepend.
- **T-20260930-004**: verified no-fix-needed (all 3 links resolve post-rename).
- **T-20260930-006**: verified no-fix-needed (orphan dir removed; deleteTenantData prevents recurrence).
- **Graft "delivery gap" adjudication closed**: co-abap/co-architect received the full sequence (upgrade → untrack mirrors → withdrawal); the custody transfer (self-managed-surfaces.json) is the mechanism — the gap premise was an input-fact error (Y2).
- **PM tier-floor**: DEC-20260930-02 (accept forward-only) executed as decided — 0/13 fleet pm.md carry tier_semantics frontmatter (deliberate); the operative rule reached the fleet via the COMMON-AGENTS zone.
- **Contract reshape consistent**: graft row removed + `common_platform_skill_exclusions` added, consumed by validate-templates.ts.

### ✅ Strengths

- Verification-based closures (T-004, T-006) carry real evidence; the security-review → fix → verification chain (T-008→fc5d28da→T-009) fully traceable.
- Broker security rewrite: immutable policy module + 1,358 lines of tests + adversarial review doc; recursive-descent JSON scanner rejects duplicate AND case-variant keys.
- Batch commit 1c246950 atomic (fixes + ticket history + mirrors + tests together).
- Ticket board coherent: 38 T-20261003-* tickets — 13 done / 25 deliberate backlog; every done populated, every backlog result-null.

## Window-facts corrections (agent-verified)

1. The graft "delivery gap" premise was an input-fact error: the custody transfer made graft workspace-local; co-abap/co-architect received the full sequence.
2. The fleet is 13 templates (co-newbiz/co-architect have no templates/<variant> beyond the standard — window facts overstated).
3. `--usage-file` accounting intentionally absent from chat (tested).
4. Runner tooling: always pin `--repo` on gh queries (the bare form resolves a different repo).

## Action wiring

| Route | Items |
|-------|-------|
| Closed this cycle | T-20261003-011/026/027/028 (review-stuck → done, delivery verified) |
| Tickets created | T-20261004-001 (graft re-bake investigation, normal) · -002 (windows login-gate flake, low) · -003 (co-price rebase, normal) · -004 (stale specs triage, low) |
| Fixed this cycle | graft block re-withdrawal (both surfaces) |
| Recorded | T-20260928-002 overclaim note · M2-M7 nicks |

## Mode announcement

FULL mode (structural trigger: agents/pm.md + common-contract.json).
