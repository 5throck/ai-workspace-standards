# AC-5 Dry-Run — Daily Learning Extraction (2026-10-07)

**Spec**: `2026-10-07-daily-fleet-learning-extraction-design` (approved; this run executes the §7 verification plan)
**Scope**: the three real landings of 2026-10-05..07 as named in the design's AC-5 — co-deck lecture v4, co-consult research pack, co-learning ops pack. Read-only; all outcomes converted to `learning:` tickets.

## Step 2f extraction outcomes

### Landing 1 — co-deck lecture v4 (PRs #164/#165)

8 candidate assets identified; 4 tickets filed (strongest + foldable), 4 recorded here as lower-priority follow-ups:

| Asset | Class | Outcome |
|---|---|---|
| A1 three-gate video verification (context/audio −60dB/identity) | new procedure/skill + pollination | ✅ **T-20261007-007** |
| A2 idempotent post-build injection (inject-don't-fork, triple play-mode, MutationObserver) + A3 re-run rule & syntax gate | L0/template tooling | ✅ **T-20261007-008** (A2+A3 folded; coordination note: session live on templates/co-deck) |
| A5 verified-rewrite humanization (bounded chunks + independent pre-apply verification) | reusable skill + pollination | ✅ **T-20261007-009** |
| A6 slidedata-SSOT sync discipline + A4 footnote-wrap rule | template procedure enhancement | ✅ **T-20261007-010** (folded) |
| A7 background-image sourcing pipeline (pre-existing, mature) | skill candidate | recorded — candidate for a future co-deck skill pass; not this window's delta |
| A8 defective download_all_videos.py | blocked | folded into T-007 (project-side fix first, then promotion) |
| Zen-theme CSS techniques (minor) | template/theme | folded into T-010's scope note |

### Landing 2 — co-consult AI research pack (PR #86; #89 only landed memory/manifests — evidence ref corrected by the review)

| Asset | Class | Outcome |
|---|---|---|
| A1 industry-research-pack methodology (source ladder, 1-source-1-doc, 5-section skeleton, ⚠️ protocol, verify-hypotheses rule) | new skill (strongest) | ✅ **T-20261007-013** |
| A3 cross-validation convention ↔ co-news ledger convergence + A4 pack-as-deck-substrate | pollination | ✅ **T-20261007-014** (folded) |
| A2 per-source report skeleton | template enhancement | recorded — lives inside T-013's skill scope |
| A5 skill-session classifier gap (0 symptoms on the day's largest learning session) | L0 tooling (weak) | recorded — candidate heuristic extension for scripts/skill-session-review.ts; may be intentional by design |
| 32 individual topic docs | domain content | explicit negative: not transferable process assets |

### Landing 3 — co-learning ops-review pack #1 (PR #11)

| Asset | Class | Outcome |
|---|---|---|
| read-only production-inspection runbook (+ SQL-parity test pattern) | L0 tooling/guide | ✅ **T-20261007-011** |
| monthly ops-review pack pattern | prospective skill (single instance) | ✅ **T-20261007-012** (backlog-gated on a second adopter) |
| D-numbered decisions format in reporting-analyst | template (weak) | explicit negative-leaning: pattern already normative in-variant (design §7–§8, reporting-analyst agent) |
| echo check (R7) | pollination | explicit negative: same-need-absent fleet-wide today — recorded in T-012 |

## Step 2e upstream request ledger (dry-run)

| Ticket | Requesting project | Subject | Stage | Re-delivery |
|---|---|---|---|---|
| U-20261006-001..004 | co-develop | validator-trust defects (snapshot inventory, skills index, design-lint fonts, skip-as-pass) | **fixed** (PR #1446) | **unreleased at ticket close** — this ledger's first correction: v0.13.1 (PR #1453) actually carried the L1 scripts to the fleet; reachability of U-001's content half confirmed by co-develop's regenerated scripts-snapshot in the 0.13.1 wave |
| U-20261006-005/006/007 | co-develop | L3 preservation, COMMON-CLAUDE annotations, Korean footer literals | **fixed** (PR #1439) | v0.13.0 (tag template-v0.13.0) |
| LOCAL-PATCH U-20261006-003 markers | co-develop, co-security | design-lint fonts guard | **superseded upstream** (v2.1.0 carries the guard) | drop at next upgrade (design §6); markers still resident — tracked |
| Open U-tickets | — | none | — | queue clean |

## AC-5 verdict

**Met.** Each of the three landings produced at least one concrete `learning:` request with evidence refs and correct classification; explicit negatives recorded where nothing qualified (no fabrication); zero writes to templates/, siblings, or promotion surfaces; evidence ref for the co-consult landing was corrected by the review itself (PR #86, not #89) — the extraction caught its own citation error.

## Follow-ups filed

T-20261007-007..014 (8 learning tickets; normal 5 / low 3) — these count against the day's shared 10-ticket cap as the design's own class. T-013/T-014's PR-number correction and T-008's live-session coordination note are model behaviors for the nightly extraction.
