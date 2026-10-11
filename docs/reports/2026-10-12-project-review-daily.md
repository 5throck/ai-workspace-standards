# Project Review — Workspace Root — 2026-10-12 (daily fleet review, run-14)

**Date**: 2026-10-12 (Monday — no override; SCOPED)
**Scope**: workspace root (L0) SCOPED review + Phase 1b batteries (15 template variants) + live Steps 2e/2f
**Method**: 4 parallel Explore slots (SCOPED, ~15h window) + machine battery (8 validators, 7 green + 1 WARN) + per-variant batteries + merged-PR learning extraction (1 fleet event)
**Window**: 2026-10-11T10:37:32 → HEAD (~15h): resync v2 mirror landing (#1461), workspace-sync waves (templates 43+45+68 files, scripts 16, tests 2, docs 6), guides landed (agent-shell-hardening, parallel-dispatch-grants, record-lifecycle-hygiene — implementing T-005..007), constitution model-id hygiene + haiku bump, upgrade-stash warning (T-014), co-abap hardening template backport (4 SAP scripts promoted), co-newbiz UI refinement (#509)

## Baseline (machine battery — 8 validators)

7 green + 1 WARN: **nightly scaffold E2E FAILED** (run 38122078949 — battery #8 correctly surfaced it; see H1).

## Phase 1b — per-variant batteries (15 variants)

14/14 batteries PASS 0 findings + READY. (co-architect standalone-track.)

## Step 2f — learning extraction (third live run)

| Landing | Extraction outcome |
|---|---|
| co-newbiz UI refinement wave (PR #509, 35 files) | 3 learning-note tickets: T-20261012-003 (view-model extraction pattern — pure lib + semantic-invariant tests, cross-pollination candidate), -004 (opt-in data-scope filter without FKs — match-rule discipline + branch-complete tests), -005 (percentage-colgroup two-step refactoring sequence — proven same-day generalization). Explicit negative: the design-docs+specs+tests-per-PR discipline is already fleet-standard (skip). |
| 10× fleet "chore: update" merges | group negative (routine maintenance) |

Step 2c pollination: none seeded this run (the 3 assets are learning-notes, not promotions).

## Step 2e — upstream request ledger

Open U- tickets: **none** (U-20261006/U-20261009 sets all done). LOCAL-PATCH markers: co-develop/co-security design-lint guards superseded upstream (v2.1.0 shipped in 0.14.0's wave via #1469) — drop markers at next upgrade. Loop-closing: the 0.14.0 wave (PR #1469) carried U-20261006-005/006/007 fixes to co-develop (confirmed by the project's regenerated scripts-snapshot in the 0.14.0 upgrade).

## Review Results

### 🔴 Critical — none

### 🟡 High
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| H1 | co-abap scaffold E2E RED: the template delivers 4 SAP scripts (sap-mcp-proxy/sap-approve/sap-integrity/validate-abap-platform-parity) with NONE registered in variant.json script_manifest or the overlay registry — every fresh co-abap scaffold fails verify-scripts; audit first-fail masking hides 3 of the 4 (nightly named only sap-mcp-proxy) | C | templates/co-abap/variant.json script_manifest; scripts/audit.ts:1086-1098 | script-gap | **T-20261012-001 (URGENT, scope corrected to all 4 + audit unmasking)** |
| H2 | L1-published upgrade-project.ts imports 4 L0-only helpers that scaffolds delete — the project-side upgrade entry point is runtime-broken (4× TS2307); gates miss it (hash-compare only; E2E never executes it) | C | templates/common/scripts/upgrade-project.ts:593,594,619,624 | script-gap | T-20261012-006 |

### 🟢 Moderate
| # | Issue | Agent | File:Line | Class | Fix |
|---|-------|-------|-----------|-------|-----|
| M1 | co-safety project-review fork self-contradiction: port ADDED upgrade-project to the body while frontmatter omits it and the design's keeper says "no upgrade-project related_skill"; closure audit checked deletions only | A | templates/co-safety/skills/project-review/SKILL.md:254-255 | one-time | T-20261012-007 |
| M2 | templates/co-deck/_smoke_test/_vr_matrix_helper.mjs hardcodes /Users/techcross absolute paths; undocumented template surface | A+D (deduped) | templates/co-deck/presentations/_smoke_test/_vr_matrix_helper.mjs:2-4 | one-time | T-20261012-008 |
| M3 | VA-08 crashes uncaught when common package.json is unparseable (guarded fail then unguarded re-parse destroys triage) — re-confirmed live in the 0.16.0 tree | A+C (deduped) | scripts/validate-templates.ts:442 | script-gap | T-20261011-002 (open) |
| M4 | 5 approved specs past the 14-day adjudication window, stale 10-01 review_notes; no disposition sweep in the window | B | docs/specs/registry.json (5 rows) | systemic | T-20261011-003 (open) |
| M5 | review-baseline battery #8 summary reads "8/8 green" even when the nightly FAILED (WARN dropped from summary) | C | scripts/review-baseline.ts:130-140 | script-gap | T-20261011-004 (open) |
| M6 | templates/co-abap/docs/platform-setup/antigravity.md:11,15 dangling security links (SECURITY.md#agent-shell-hardening anchor + tooling-matrix don't ship) — the only 2 warnings in docs-links --all | D | templates/co-abap/docs/platform-setup/antigravity.md | one-time | T-20261012-009 |
| M7 | 3 new guides are orphan docs (not in docs/index.md §2; no guides/README) | D | docs/guides/*.md; docs/index.md:48-53 | one-time | T-20261012-010 |
| M8 | PR #1509 closed-unmerged content (45 files) landed under #1510 titled "1 file" — review surface under-represented 47; dev-sync should derive titles from the full diff and refuse closed-PR-branch reuse | C | dev-sync/PR-title derivation | script-gap | T-20261012-011 |

### ℹ️ Low / Improvements
| # | Issue | Agent | Class | Fix |
|---|-------|-------|-------|-----|
| L1 | Bare "chore: workspace sync" without count when no paths classify; #1504 slug count computed pre-main-merge | C | script-gap | folded into T-20261012-011 |
| L2 | #1474 commit title over-cites T-008 (delivered only a skill-review record); store accurate, title misleading | B | one-time | recorded |
| L3 | T-20261007-012 review→backlog disposition carries no result text | B | one-time | noted for next touch |
| L4 | memory/2026-10-09.md:373 clock drift (~11:30-12:30 vs actual 10:03-10:42) | A | one-time | recorded |
| L5 | parallel-dispatch-grants.md:42 cites agent-shell-hardening.md as plain text (unvalidatable) | D | one-time | recorded |
| L6 | WINDOW SCOPE CORRECTIONS (runner bookkeeping): co-consult PROMOTION_CHECKLIST did NOT change in-window (haiku bump hit AGENTS.md instead); the skill-graph triage hardening rode #1488, not #1489; provenance-pruning follow-up is T-20261007-017 not T-20261004-017; upgrade-project is at 1.70.0 | B+C | — | corrected here |

### ✅ Strengths
- The 10-09/10-10 waves' closure claims were truthful: every ticket result checked against the tree and verified (T-007 gates at schema.yaml:55,58; T-008 injector + 3 pin tests; 6/6 audit_exception surfaces; 19=19=19 co-consult skills three-way).
- Model-migration lifecycle rollout: skill + record + registration + owner attach + companion script with tests + Check MM enforcement + constitution zone + graph sync in one wave.
- #1488 package-merge: three-layer defense (pure unit-tested merge + VA-08 + E2E Test 11 pin) closing the #1432/#1433 regression class; carriedByScoped eliminated a real false-positive class.
- PR-only landing discipline: 8/8 via merge commits, zero direct pushes; #1504 main-drift reconciled in-branch.
- Battery #8 works: the red nightly surfaces as a WARN with URL and repro command.
- Security posture clean: zero secrets in the window diff; the co-abap hardening backport's deny-rules configs carry no internal hosts; new CI surface well-pinned.

## Action wiring

T-20261012-001 (updated urgent), T-20261012-006..011 (6 new; total today 7/10). Existing open: T-20261011-001..004, T-20261011-011..013.

## Verification

Post-landing re-run appended after merge. Phase II continues below.
