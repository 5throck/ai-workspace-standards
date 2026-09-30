# Project Review — ai_workspace (workspace root + templates/ + services/) — 2026-10-01

**Date**: 2026-10-01 01:30 KST
**Scope**: workspace root L0 + templates/ + services/; window 2026-09-30 02:01 → run (84 commits, 192 paths)
**Method**: machine battery + FULL-mode 4-slot agent review (trigger: the entire 9-file L0 agent roster changed — tier-line model-ID cleanup + PM tier-floor semantics 1.2.1)
**Runner**: daily fleet-review automation (ADR-0089); standing specs + auto-release design

## Baseline

6/6 green. Main CI: green streak held (≥10 successes) with **one windows-only red at #1261** — recovered within one PR (#1262, 47 min; auth-composability change; ubuntu/macos were green throughout). Fleet 13/13 at v0.8.1; **v0.8.2 released overnight** (22 delivered paths; see 6b note — this was the T-007 retry executed by the owner/session, not the runner slot).

## Review Results

### 🔴 Critical

None.

### 🟡 High

| # | Issue | Agent | File:Line | Class | Fix | Wired |
|---|-------|-------|-----------|-------|-----|-------|
| H1 | **Quota still active + scripted admin-merges continue**: all 3 fresh co-consult CI runs show runner=none (5-6s failures, zero steps), yet the 3 private upgrade PRs (co-consult #73, co-deck #115, co-design #15) merged within 8s of each other with failing Documentation Audit + Secret Scan checks — private main branches now carry red checks and zero CI verifiability | C | co-consult runs 36644781372/36601033934/36520584473; PR merge stamps 23:21:39-47Z | fleet-infra | The only real fix is billing (T-20260927-016); stop scripted admin-merges past failing checks — re-run the two workflows on the 3 merge commits once billing lands | T-20260927-016 stays OPEN; record corrected in this report |
| H2 | Record-plane: T-20260927-016 documents none of the merges it gated nor the v0.8.2 delivery (correcting record = this report + yesterday's resync report) | B | `tickets/governance/T-20260927-016.yaml:17-19,31` | record-drift (recurrence of the 09-30 H1/H2 pattern) | History-note convention: the fixing session should append the wave record to the ticket it gates | recorded |
| H3 | **Nightly Scaffold E2E red 2 consecutive nights** (09-29/30, ~5m duration = job-timeout class; last green 09-28; regression window matches the fleet v0.8.x delivery) | C (triaged: run 36682032034) | `.github/workflows/nightly-scaffold-e2e.yml` | CI regression (nightly job) | Triage run 36682032034's failing variant/step; fix or raise the job timeout | T-20261001-001 |

### 🟢 Moderate / Low

| # | Issue | Agent | Class | Wired |
|---|-------|-------|-------|-------|
| M1 | docker-broker control-route token non-constant-time compare (route internal-network only; codebase standard is hashed timingSafeEqual) | C | defense-in-depth inconsistency | T-20261001-002 |
| M2 | 8 agent lifecycle records edited (model-ID comment drops) without Last Updated bumps — B verified the stamps landed overnight via T-20260930-001 (all 8 confirmed 09-29 + history rows) | B | resolved | closed via T-20260930-001 |
| M3 | tenant.delete orphan-dir cleanup landed (lifecycle.ts:202-241 incl. volume mode, T-20260930-038); operator verification of real-provider docker-mode turn remains backlog (T-20260930-009) | A | verified | recorded |
| M4 | 2 approved specs >14d stale (upgrade-project-drift-fixes 15d; governance-docs-architecture) | B | registry triage | recorded (repeat) |
| M5 | 2 UI-touching designs lack a11y/exemption statements (coworkspace-web-split-plan; coworkspace-latency-ux) — no standing rule, convention-consistency note | D | convention | recorded |
| M6 | registry-db.ts retains 2 Hangul comment lines (code outside the md/yaml language gate) | D | language nick | recorded (repeat) |

### ✅ FIXED-CONFIRMED / VERIFIED

- T-20260930-001: 8/8 lifecycle records stamped (Last Updated 09-29 + history rows citing 5b2778b8) — spot-checked architect/auditor/lifecycle-manager/skill-graph-analyst.
- T-20260930-002: SCRIPTS.md row repaired; verify-scripts 206/206, **0 warnings** (the standing regenerate-agents-md warning cleared).
- T-20260930-003: templates/CHANGELOG strictly descending (Unreleased → 0.8.2 → 0.8.1 → 0.8.0 → 0.7.0); survived an actual auto-release prepend.
- T-20260930-004: verified **no-fix-needed** — all 3 links resolve post-rename (the design files exist under their co-workspace names; PR #1219).
- T-20260930-006: verified **no-fix-needed** — orphan dir removed in the 09-29 straggler cleanup; deleteTenantData prevents recurrence (incl. volume mode).
- Fleet merges: co-work PR #1, co-newbiz #424, co-architect #354 spot-checked — 0.8.1, HERMES.md present, audits green (incl. the new model-registry gate).
- Registry: 7/7 window design docs registered implemented same-day; ticket board coherent (54 files: 13 done, 25 deliberate backlog batches, 0 stuck).

### ✅ Strengths

- Release discipline end-to-end: clean-tree guard → ticketed retry (T-007, executed overnight from a clean temp clone with full provenance) → VERSION↔CHANGELOG↔tag↔PR chain verified.
- The co-workspace docker-broker rewrite pairs an immutable policy module (906 ln allowlists) with 1,358 lines of tests and an adversarial review doc; the security-review → fix → verification-ticket chain (T-008 → fc5d28da → T-009) is fully traceable.
- Sync mechanism self-healed before the fleet rollout (99361a0d hyphenated managed keys; bc344690 placeholder rendering).
- Verification-based ticket closures carry real evidence (T-004/T-006), not rubber stamps.

## Window-facts corrections (agent-verified)

1. 9 agent files changed (not 8) — agents/ holds 9 including skill-graph-analyst; the 8 non-pm files are comment-only tier-line model-ID drops (no version bump needed); pm.md 1.2.1 is the one behavioral change (`tier_semantics: floor`, `session_hosted: true`).
2. The v0.8.1→v0.8.2 release chain: v0.8.2 was released 09-30 (T-007 retry from a clean temp clone; PR #1252, commit 593cdd2a) — between the runner's cycles, not in the runner slot.
3. `--usage-file` accounting: intentionally absent from chat (tokens from the stream envelope; tested).

## Action wiring

| Route | Items |
|-------|-------|
| Tickets created | T-20261001-001 (scaffold E2E red ×2, normal) · T-20261001-002 (broker token constant-time, low) |
| Kept open | T-20260927-016 (quota — billing is the human lever; merges happened under owner authority) · T-20260930-009 (operator verification) · T-20260927-012/-010 |
| Resolved overnight by other sessions | T-20260930-001..011, -024/-025/-027/-038 (13 done); T-007 v0.8.2 retry |

## Mode announcement

FULL mode (structural trigger: the entire 9-file L0 agent roster changed).
