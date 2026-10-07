# Design: Daily Fleet Learning Extraction & Bidirectional Carrier (project-resync v2)

- **Spec id**: `2026-10-07-daily-fleet-learning-extraction` (approved by user 2026-10-07; implemented same day — AC-5 dry-run passed, see docs/reports/2026-10-07-learning-extraction-dryrun.md; runner prompt updated to skill v1.6.0 with Steps 2e/2f, first nightly run 2026-10-08 01:30 KST)
- **Date**: 2026-10-07
- **Author**: Template Architect (Design Gate, ADR-0074)
- **Source**: user directive 2026-10-07 — the daily fleet review+resync must not merely sync state; it must understand and carry what the fleet produces. Daily cadence explicitly chosen over weekly (user directive: run the extraction daily, not weekly).
- **Related**: ADR-0031 (fork model — reporting direction only), ADR-0084 (evidence backport), ADR-0089 (nightly runner), ADR-0074 (Design Gate), 2026-09-28-project-template-backport-design (5-surface), 2026-10-07-upstream-validator-trust-wave-design (proven U-ticket intake)

---

## 1. Background

project-resync is the only process that visits every `Projects/co-*` workspace daily, but its role is state-sync: provenance audit, GitHub sync, upgrade delivery. Three landings this week demonstrate the gap:

- co-deck **lecture v4** (PRs #164/#165 — video-embed slide pipeline, caption-wrap CSS)
- co-consult **AI industry research pack** (PR #89 — 16 topics, 33 files)
- co-learning **ops-review pack #1** (PR #11 — ops cadence + first review decisions)

All three are potentially reusable learnings; none was assessed for platform value. Meanwhile the upward channel for workspace-tooling needs proved itself (U-20261006-001..007 → trust wave PR #1446), but it is informally bolted on: resync does not read, report, or carry it.

## 2. Goals

1. Make the nightly run a **bidirectional carrier**: downward (upgrades deliver improvements), upward (requests carry needs + learnings), lateral (cross-project pollination).
2. **Daily learning extraction**: every landing in the 24h window gets a reusable-asset assessment the same night, while the authoring session is still reachable.
3. Surface an **upstream request ledger** (open U-tickets + LOCAL-PATCH markers) in the cycle report with disposition stages.

## 3. Non-goals

- **Promotion automation**: project→variant promotion and backport adoption remain human-judged (user directive 2026-10-07). Extraction files requests with evidence; Design Gate + human approval decide.
- Sibling auto-sync, content rewriting of project files, or any write into `templates/` from the extraction path.
- Replacing the weekly FULL review (Friday sweep stays as the cumulative safety net).

## 4. Requirements (ASD-STE100, ADR-0079)

### 4.1 Upstream request ledger (Step 2e)

- R1. Read every open upstream-request ticket (`kind: manual`, `U-` ids) and every LOCAL-PATCH marker in the fleet.
- R2. Report each in the cycle report with: requesting project, subject, disposition stage (received / designed / fixed / re-delivered), and — when re-delivered — the template version that carried it to the requesting project.

### 4.2 Learning extraction (Step 2f)

- R3. For each project with merged landings in the window (PRs merged, or commits landed by its own session), dispatch one scoped review pass over the delta.
- R4. The pass identifies reusable assets and files one ticket per asset — `kind: manual`, title prefix `learning:` — citing evidence refs (files, PRs). Asset classes: template enhancement, new/reusable skill, L0 tooling improvement, cross-pollination candidate.
- R5. Landings with no reusable assets get a one-line "reviewed, nothing to extract" entry. Silence is never acceptable: every landing produces either a request or an explicit negative.
- R6. Never write into `templates/`, `Projects/*` siblings, or promotion surfaces from this step. Requests only.

### 4.3 Pollination ledger (Step 2c redefined)

- R7. Define echo candidates from **landings** (not backport diffs): for each extracted asset, query the other projects for the same need; report same-need-present / absent / divergent-solution.

### 4.4 Budget and degradation

- R8. Review up to 3 landings per night; overflow is listed and carried to the next night (first-in-first-reviewed).
- R9. On wall-clock breach, degrade to ledger + listing only (existing degrade patterns).

### 4.5 Boundaries

- R10. ADR-0031 unchanged: this design adds reporting and requests. It moves no promotion authority.
- R11. The Friday FULL sweep reviews the cumulative week as the safety net for anything a nightly pass missed or degraded.

## 5. Acceptance criteria

- AC-1. A landing equivalent to co-deck lecture v4 produces, within one nightly cycle, either a `learning:` request citing evidence or an explicit "nothing to extract" entry.
- AC-2. The cycle report contains the upstream request ledger with disposition stages (R1–R2).
- AC-3. Zero commits into `templates/` or sibling projects originate from Steps 2e/2f (R6).
- AC-4. Overflow and degradation are visible in the report (R8–R9).
- AC-5. Dry-run against this week's real landings (co-deck lecture v4, co-consult research pack, co-learning ops pack) produces at least one concrete `learning:` request per landing and no fabricated ones.

## 6. Alternatives considered

1. **Weekly intelligence pass — rejected.** Daily batches are 1–3 landings (small, fresh context, authoring session reachable); weekly batches compound (this week: 3 packs in 3 days) and lose author-session access. User directive picks daily.
2. **Promotion request channel — deferred.** Promotion stays human-judged; the scanner plus checklists already give pull-side signals. Revisit if promotion cadence grows.
3. **Standalone fleet-ops skill — rejected for now.** Splitting would orphan the daily cadence from the sync context; re-evaluate if nightly runtime exceeds the window.

## 7. Verification plan

- Dry-run extraction over the three real landings of 2026-10-05..07 (read-only) — output reviewed against AC-5.
- Ledger dry-run: enumerate open U-tickets (U-20261006-001..007, all done → ledger shows closed loop) and LOCAL-PATCH markers (co-develop/co-security design-lint guards pending drop).
- Post-adoption: two consecutive nightly reports carry the ledger and at least one `learning:` entry.

## 8. Accessibility exemption (ADR-0065)

Backend automation only — no UI; not applicable.

## 9. Preview-verification exemption (ADR-0070)

Exempt — non-UI change; verification is command-exit and artifact-presence based (§7).
