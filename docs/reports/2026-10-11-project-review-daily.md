# Project Review — Workspace Root — 2026-10-11 (daily fleet review, run-13)

**Date**: 2026-10-11 (Sunday — no Friday override; SCOPED)
**Scope**: workspace root (L0) SCOPED review + Phase 1b batteries (15 template variants) + live Steps 2e/2f
**Method**: 4 parallel Explore slots (SCOPED, ~41.5h window) + machine battery (now 8 validators) + per-variant batteries + merged-PR learning extraction (2 fleet events)
**Window**: 2026-10-09T08:02:50 → HEAD (~41.5h; the 10-10 nightly did not run): 4 landing waves — co-deck injector promotion + co-safety ahead-deltas port (#1490, implementing learning tickets T-007/T-008), scaffold package merge + standing validators (#1488), skill-graph triage hardening (same PR), promotion/backlog ticket batches (#1487/#1489/#1491/#1492); new upstream requests U-20261008-001, U-20261009-001; co-newbiz live session (valuation fixes #489-491 merged + ongoing); co-abap hardening wave (#194-196)

## Baseline (machine battery — now 8 validators)

8/8 green: audit 2.52.0, validate-templates 1.54.0, verify-scripts, agent-lifecycle, skill-lifecycle, propagate-drift, validate-variant-claims, **nightly E2E conclusion surfacing (new #8)** — battery extensions from the #1488 wave.

## Phase 1b — per-variant batteries (15 variants)

14/14 batteries PASS 0 findings + READY (co-architect standalone-track, no template). No variant needed delta review this window beyond the slots' coverage (co-consult checklist + co-deck promotion reviewed by Slots A/B; co-hr/co-news unchanged).

## Step 2f — learning extraction (second live run)

| Landing | Extraction outcome |
|---|---|
| co-abap hardening wave (#194-196) | 4 tickets: branch-sweep workflow adoption (T-20261011-005), agent-shell hardening checklist/skill — **strongest of the window** (T-006), parallel-dispatch grants + command SSOT (T-007), proxy-seam template bundle (T-008). Explicit negatives: #195 docs-only, fiori-rap-dev is variant-only. Operational note: local co-abap clone was stale (missing #189-196) — flagged for resync |
| co-newbiz valuation fixes (#489-491) | 2 tickets: per-subject WACC consumption store/consume gap + audit-xls pollination (T-009), archive-don't-delete + enumerate-before-cleanup (T-010). Explicit negatives: model-deals/run-fpa same-need-absent, co-price single-subject (watch note), #490 cosmetics folded |

Step 2c pollination seeded: co-abap hardening ↔ co-learning XSS ("allowlist strictness + committed regression proof" shared theme, T-006); WACC class → audit-xls checklist row (T-009).

## Step 2e — upstream request ledger

| Ticket | Requesting | Subject | Stage | Re-delivery |
|---|---|---|---|---|
| U-20261008-001 | co-newbiz | upstream request (backlog) | received | — (pending triage) |
| U-20261009-001 | co-newbiz | upstream request (backlog) | received | — (pending triage) |
| LOCAL-PATCH markers (co-develop, co-security design-lint) | — | superseded upstream v2.1.0 | drop markers at next upgrade (T-20261007-015 wave delivered the validator change via #1469) |

## Review Results

### 🔴 Critical — none

### 🟡 High
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | T-20261008-008 (co-safety fork port, audit_exception contract) closed done on a runner-recorded POST-HOC sign-off with no gate-moment artifact — no DEC record, no quoted owner direction, sign-off session's memory says "Decisions: None" | A | tickets/governance/T-20261008-008.yaml; memory/2026-10-09.md:387,408-432 | systemic | T-20261011-001: gate-moment DEC record or reopen to review |

### 🟢 Moderate
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | co-safety project-review fork self-contradiction: port ADDED upgrade-project to the body while fork frontmatter omits it and the design's keeper says "no upgrade-project related_skill"; closure audit checked deletions only, not additions | A | templates/co-safety/skills/project-review/SKILL.md:254-255 | one-time | T-20261011-011 (deferred) |
| M2 | templates/co-deck/_smoke_test/_vr_matrix_helper.mjs hardcodes /Users/techcross absolute paths; undocumented template surface (design Surfaces omits it) | A+D (deduped) | templates/co-deck/presentations/_smoke_test/_vr_matrix_helper.mjs:2-3 | one-time | T-20261011-011 (deferred) |
| M3 | VA-08 crashes uncaught when templates/common/package.json is unparseable (guarded fail then unguarded re-parse destroys triage) | C | scripts/validate-templates.ts:442 | script-gap | T-20261011-002 |
| M4 | 5 approved specs past the 14-day adjudication window with stale 10-01 review_notes; no disposition sweep ran in the window | B | docs/specs/registry.json (5 rows) | systemic | T-20261011-003 |
| M5 | review-baseline battery #8 reads "8/8 green" even when the nightly FAILED (ok:true unconditional; --quiet drops the note) | C | scripts/review-baseline.ts:130-140 | script-gap | T-20261011-004 |
| M6 | #1491's memory block records "Changes: N/A" while the PR demonstrably changed 2 ticket files; commit title/content mismatch (1d8f68f8 over-cites T-008) | B | memory/2026-10-09.md:408-419 | one-time | recorded — memory-log faithfulness note for the owning sessions |
| M7 | learning ticket ID correction: provenance-pruning implementation follow-up is T-20261007-017 (closed design-only — implementation now untracked); refiled | C | tickets/governance/T-20261007-017.yaml | one-time | follow-up ticket filed (see Action wiring) |

### ℹ️ Low / Improvements
| # | Issue | Agent | Class | Fix |
|---|-------|-------|-------|-----|
| L1 | co-deck promotion is a model learning-loop closure: T-007/T-008 (filed 10-07) implemented and verified same-window (gates at procedures schema.yaml:55,58; injector TS + 3 pin tests; 5-mirror parity held) | A | — | recorded as the pattern proof |
| L2 | co-safety fork version scheme (common+1 patch per fork) is a clean E2 answer | A/C | — | recorded |
| L3 | co-newbiz #490 cosmetics folded into T-009's scope note (unit labels, target-default extraction) | 2f | — | folded (R5) |
| L4 | local co-abap clone stale (missing #189-196) — resync flagged | 2f | — | next cycle's sync covers it |

## Action wiring

T-20261011-001 (H1 governance), -002 (VA-08 crash), -003 (spec sweep), -004 (battery warn flag), -005..008 (co-abap learnings), -009/-010 (co-newbiz learnings), -011 (deferred fork/hygiene batch, not-before 10-12). Today's shared cap: 10/10 reached; T-20261007-017 follow-up (provenance-pruning implementation) to be filed first next cycle.

## Verification

Post-landing re-run appended after merge. Phase II continues below (2e ledger, upgrade wave).
