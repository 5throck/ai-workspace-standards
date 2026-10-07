# Project Review — Workspace Root — 2026-10-07 (afternoon, run-10b, user-directed)

**Date**: 2026-10-07 (~14:39 KST start)
**Scope**: workspace root (L0) SCOPED review + Phase 1b batteries
**Method**: 4 parallel Explore slots (SCOPED to the 7h window) + machine battery + per-variant batteries
**Mode rationale**: off-schedule user-directed invocation; window non-empty (6 PRs) but no structural triggers → SCOPED (smallest covering mode)
**Window**: 2026-10-07T07:38:12 → `5a200c28` (6 PRs #1446–#1451): upstream-validator-trust wave (+ its T-20261007-002 port), ADR-0099 co-deck extension (T-20261006-005), ticket-schema/store invariants, spec entry, ticket closures. #1450 closed unmerged (clean supersession by #1451, verified by Slot B).

## Baseline (machine battery)

7/7 green (audit, validate-templates, verify-scripts, agent-lifecycle, skill-lifecycle, propagate-drift, validate-variant-claims).

## Phase 1b — per-variant battery (second run)

14/14 variants: validate-variant-claims PASS 0 findings + validate-variant-readiness READY — co-learning improved 11/20 → 12/20 green (lifecycle record now audited). Agent-dispatch waiver: the window's only variant deltas (3 PROMOTION_CHECKLISTs) were under Slot A's verification; wave-dedupe rule applies.

## Review Results

### 🔴 Critical — none

### 🟡 High
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | write-scripts-snapshot v1.1.0 resolves l1Source with `join(cwd, l1Source)` — absolute common/scripts paths from the adopt and post-upgrade call sites mis-prefix and silently fall back to the L0 registry (the exact defect the port fixed, on 2 of 3 call sites; exit 0 either way) | C | scripts/helpers/write-scripts-snapshot.ts:69 | script-gap | ✅ fixed: `resolve()` + comment; integration test added (absolute l1-source must select L1; would fail pre-fix); 1.1.1 + registry row |

### 🟢 Moderate
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | co-deck checklist heading "— met at the 2026-08-30 promotion" blanket-claims met over waived rows (residual of T-20261006-005) | A+D (deduped) | templates/co-deck/PROMOTION_CHECKLIST.md:23 | one-time | ✅ fixed → "— state at the 2026-08-30 promotion (criteria 6/8/10 waived per ADR-0099, ratified 2026-10-07)"; claims re-verified PASS |
| M2 | ADR-0099's co-deck amendment invisible in the metadata header | D | docs/adr/0099:3-6 | one-time | ✅ fixed: `**Amended**: 2026-10-07 (T-20261006-005 …)` line added |
| M3 | ADR-0099 taxonomy stretch: co-deck is NOT a migrated variant (created as variant 2026-06-17) but is ratified under "migration fast-track" wording | A | docs/adr/0099:23 | one-time | ✅ fixed: "Extension scope (2026-10-07)" paragraph under Decision 1 — beta-shortfall waiver is a distinct basis; "ratified admission" marker allowed for non-migrated cases |
| M4 | verify-skills --check clean path unreachable (embedded `Generated:` timestamp defeats byte-match; remediation loop can never pass; clean case untested; "read-only" wording overstated) | C+D (deduped) | scripts/verify-skills.ts:236-251 | script-gap | T-20261007-003 |
| M5 | Ticket-history artifacts span 4 U-tickets (doubled backlog→waiting edge; non-monotonic retroactive created_at) — machine checks pass over histories ticket-store could not have produced | B | tickets/governance/U-20261006-00{1,5,6,7}.yaml | script-gap | T-20261007-004 |
| M6 | L1 SCRIPTS.md stale tail persists (readme-lifecycle-audit 1.0.4, validate-docs-links 1.4.0 truncated, verify-skill-graph 1.6.0, verify-scripts malformed row) — window followed the §7 caveat correctly but the structural dedup is still open | B+C | templates/common/scripts/SCRIPTS.md | script-gap | T-20261006-007 (open, backlog — unchanged) |

### ℹ️ Low / Improvements
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| L1 | U-20261006-001 resolution.pr_url points at ai-workspace-standards#1446 — wrong repo slug for this workspace's PRs | A | tickets/governance/U-20261006-001.yaml:94 | one-time | report-only (result field not hand-editable); correct at next ticket touch |
| L2 | co-develop/co-security carry superseded LOCAL-PATCH design-lint guards (2.1.1 vs upstream 2.1.0) — design §6 says drop at next upgrade | A | Projects/co-{develop,security}/scripts/design-lint.ts | one-time | handled by today's upgrade wave (verify LOCAL-PATCH markers in upgrade reports) |
| L3 | design doc §3.2 says verify-skills "v1.5.0" but shipped 1.5.1 (disclosed windows fix) | A | docs/designs/2026-10-07-upstream-validator-trust-wave-design.md | one-time | cosmetic; sweep next doc touch |
| L4 | runner's window brief said "upstream-validator-trust = MCP identity (T-20261003-009)" — wrong: it is validator-trust-of-generated-state (T-20261003-003 landed 10-03; T-20261003-009 is unrelated) | A | — | — | corrected here |

### ✅ Strengths
- The trust wave is a model upstream-fix cycle: 4 defects with repro counts → design → fix → 12+ tests → registry rows both levels → spec entry, one day, with the superseded #1441 content explicitly re-landed (Slots A/B/C agree).
- Skip-as-pass fixed structurally: `[SKIP]` counted and labeled at source (audit 2.51.0 + typecheck 1.2.0) — skipped gates can no longer masquerade as passes.
- ticket-store validate-before-atomic-write closes the wedged-ticket class; U-001's known doubled edge did NOT multiply (frozen legacy).
- L0↔L1 lockstep held: 4 scripts byte-identical, audit.ts comment-only divergence per the declared convention; all registry rows reconciled (verify-scripts 219/219, 0 warnings).
- T-20261006-005's fix is a textbook §2 execution (waived-not-met, quantified shortfall, ratification row) — the one residual heading is fixed in this landing.

## Fixes applied this session

| File | Change |
|---|---|
| scripts/helpers/write-scripts-snapshot.ts | 1.1.1 — join→resolve + comment (H1) |
| scripts/SCRIPTS.md | registry row 1.1.1 |
| tests/unit/write-scripts-snapshot.test.ts | absolute-l1-source integration test (regression pin) |
| templates/co-deck/PROMOTION_CHECKLIST.md | heading defixed (M1) |
| docs/adr/0099-template-migration-admission-policy.md | Amended header line (M2) + Extension scope paragraph (M3) |
| docs/VERSION_MANIFEST.md | regenerated |
| tickets/governance/T-20261007-003/004.yaml | 2 tickets (runner cap today: 2/10) |

## Action wiring

T-20261007-003 (verify-skills --check dead clean path), T-20261007-004 (ticket-history repair); open carries: T-20261006-007 (L1 tail), T-20261007-001 (backlog, from the wave).

## Verification

Post-landing re-run results appended after merge.
