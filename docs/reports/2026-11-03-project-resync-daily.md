# Daily Project Resync — 2026-11-03

Fleet: **17 projects** (`Projects/co-*` glob — co-newbiz-pr-disable-register appeared during the pause; gitignored local L3 checkout, excluded from the wave). Standalone-track: co-newbiz. Template at cycle start: 0.27.0 (the pause sessions released 0.26.0/0.27.0 themselves) → released **0.28.0** this cycle (MINOR, hub-spoke wave; tag `template-v0.28.0`, PR #1830).

**Pause note**: 11-01/11-02 runs were paused per user request (one-line notes in memory/2026-11-01.md / 2026-11-02.md). The 2-day window therefore covers the hub-spoke program and the sessions' own delivery waves.

## Step 0 — Resync audit

All 17 projects: **0 verdict rows** — manifest-based TOMBSTONE-VIOLATION scan fleet-clean.

## Step 1 — Local work

| Project | PR | Content | Path |
|---|---|---|---|
| co-newbiz | #798 | residue (gui-test screenshots dir, bootstrap state, pipeline-state) | billing-wall exception (0-step) → **merged** |
| co-security | #99 | residue | billing-wall exception → **merged** |
| co-design / co-work | — | on live session branches (`deliver-agent-model-gate-1`) | **session-owned, untouched** |

## Step 2 — Backport review (verdict columns; time-boxed summary)

Window deltas: **all 16 tracked projects** (the hub-spoke wave + the sessions' 0.26.0/0.27.0 deliveries). The dominant surface is delivery content (template-origin). Non-mechanical project landings: co-newbiz #791–#797 (scheduler P7 + security), co-price #174/#175 (docker auto-start; deps: stale braces waiver + 9 criticals cleared), co-develop #198 (restore project-adopted skills), co-architect #388/#389 (promotion normalization), co-security #96/#97 (authorization-registry + agent-model-gate delivery), co-game #66.

- **PORT_CANDIDATE**: dominated by project-only design docs/records (no port). co-architect `variant.json`/agents — already covered by T-20261103-002's reconciliation decision.
- **ADJUDICATE**: co-architect promotion normalization (#388 — the L3→variant pipeline's own outputs; recorded). co-price `.github/workflows/ci.yml` **conflict persists** (project-migrated CI — standing human item from 10-31; suggested systemic fix unchanged: delivery-exclude CI paths).
- Standing `workspace-schema.json` conflict class: **absent tonight** — no template delta re-opened it.

### Step 2 PORT-CANDIDATES (design D6, report-only)

Time-boxed: summaries were captured for the 4 largest deltas on 10-31 and the class is unchanged (adapted-span counts stable; conflict-bound only via the standing ci.yml/schema items above). Full per-project re-run deferred to the next full-window cycle; the would-revert risk tonight is delivery-origin content only.

## Step 2d — Domain Operating Model (read-only diff)

No project changed process/governance/gates/evidence-model surfaces this window (co-newbiz's flow.spec change was pre-window). `domain-model:` rows: none.

## Step 2e — Upstream request ledger

Open U-tickets: **7 → recount pending #1824** (U-20261102-001/-002 resolutions ride the OPEN session PR; U-20261029-004 closed via dev-sync v1.37.0 variant generators — the generators gap is now implemented). Done/rejected: 46+. LOCAL-PATCH pending fleet-wide: ~92 (stable).

**Fix→request pairing (this cycle's wave = 0.28.0)**: U-20261029-004 (co-newbiz variant generators) → **delivered** as dev-sync v1.37.0 step 3.86 (declared generator pre-convergence) — the request that spawned the ticket is implemented upstream. U-20261029-005/-006/-007 (co-deck) → **delivered** (0.27.0 render batch reached the project via the pause sessions' waves). No open request is paired with 0.28.0 itself (hub-spoke content).

## Step 2f — Learning extraction (FIFO: co-newbiz #793, #795, #796)

| Landing | Verdict |
|---|---|
| co-newbiz #793 (P7 schedule CRUD: run-now/health/create) | **learning candidate (1)** → T-20261103-005: extend the scheduled-jobs runtime pattern doc to v1.1 (operator-control layer: enqueue-only run-now + static import-scan no-execution pin; heartbeat/overdue/3-strike health; registered-handler create boundary) |
| co-newbiz #795 (structured cron picker) | **reviewed, nothing to extract** — project UX over the ticketed scheduler; parse-back identity gate is standard technique |
| co-newbiz #796 (close self-registration) | **learning candidate (2)** → T-20261103-006: security-scan skill gains an auth-surface audit step (default-open signup flagging; co-newbiz remediation shape as reference — default-closed env flag, refusal-before-parse/throttle, admin-provisioned accounts) |

**2 `learning:` tickets filed.** NO-SILENCE: the pause sessions' delivery waves (0.26.0/0.27.0 ×15 projects) — mechanical, nothing to extract.

## Step 2b — Evidence backport scan

Deferred this cycle (time-box): the co-safety PROMOTABLE adjudication completed via DEC-20261030-01 + #1758 lineage (user-directed cycle); the next scan rides the next full-window run.

## SECRETS GATE

co-price **clean**; co-newbiz **3 findings** — `tests/unit/{api,login-form-hardening}.test.ts` (commit 3c8d983d): auth-flow test fixtures, **4th-5th occurrence of the class**. Hard-fail recorded → **T-20261103-007 (high)** consolidating with the still-pending T-20261030-005 systemic policy decision (its own note anticipated exactly this: "if a 5th lands, propose a structural fix"). No port of the flagged tests until cleared.

## Step 3 — This PR

Report-only landing (judgment report + tickets T-20261103-005/-006/-007). Design Gate: standing specs ADR-0089 + 2026-10-07-daily-fleet-learning-extraction-design + 2026-10-28-instruction-ownership-backport-hardening-design (+ 2026-10-31-changelog-normalize-design for the wave's heal path).

## Steps 4–5 — v0.28.0 wave (delivers 0.24.0→0.28.0 to the laggards)

Appended after the wave. Note: the pause sessions already delivered 0.26.0/0.27.0 fleet-wide (fail-then-heal worked — including the 6 projects halted on 10-31); tonight's wave brings all tracked projects to 0.28.0.

## Step 6 — Final state

Appended after the wave.
