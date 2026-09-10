---
status: Accepted
date: 2026-09-11
author: PM
---

# ADR-0071: Nightly Governance-Ticket Batch Automation and the 05:30 Local Runner

## Context

Since 2026-09-08 the workspace has operated a standing CI automation
(`.github/workflows/nightly-tickets.yml`) in which an AI agent processes ready
`kind: manual` governance tickets and opens PRs via the dev-sync pipeline. A local
ZCode workspace automation (daily 05:30 KST, created 2026-09-11) acts as the
leftovers/anomalies pass. The system produces governance effects — ticket state moves
and PRs — but had **no design record, no ADR, and no operations-doc cadence entry**;
its operating rules lived only in the workflow prompt and memory logs. Separately,
GitHub scheduled runs are best-effort: the 2026-09-09 run fired 2h28m late, and the
2026-09-10 run was initially misdiagnosed as skipped before firing late the same
evening.

## Decision

**Ratify the as-deployed system** and document its contract as follows.

### 1. Nightly CI batch (02:30 KST, `nightly-tickets.yml`)

- Scheduled 17:30 UTC; an AI agent (claude-code-action; provider auto-detected —
  `ANTHROPIC_API_KEY` direct, else `ZAI_API_KEY` via the z.ai Anthropic-compatible
  endpoint; skipped cleanly if neither secret exists) processes ready `kind: manual`
  tickets.
- **Batch cap 50 tickets, ~5-hour stop rule**; job timeout 350 minutes.
- **PR-only**: lands every change set through `bun scripts/dev-sync.ts`; never merges,
  never force-pushes, never bypasses a gate.
- **Per-ticket status re-check**: a ticket is claimed only if still `backlog`/`waiting`
  at execution time (`move <id> waiting` before work; `review` on success;
  `failed --error` → `waiting` on failure, one retry at most).
- Safety rules are part of the contract: no CI/workflow or permission changes, no
  Projects/ content, no hand edits to `tickets/governance/*.yaml`, no secrets work.
- Scheduled runs are **best-effort** (GitHub may delay or skip); interpretation rule:
  "a run exists after 17:00 UTC" counts as fired regardless of how late it started.

### 2. Local runner (05:30 KST, workspace automation)

- Checks the nightly outcome since the 17:00 UTC window; **if a run is still
  in progress: report only and stop** (no double processing).
- Healthy case (nightly succeeded, ready list empty): log and stop.
- Anomaly case (run missing, failed, or ready tickets remain unclaimed): **perform the
  batch directly on the local checkout** — cap 25 tickets / ~3 hours, high priority
  first, same SELECT/SKIP rules, same four validation gates, same dev-sync PR-only
  landing and ticket state moves as the CI batch.

### 3. No-double-processing

Three independent guards: the workflow `concurrency` group serializes CI runs;
both agents re-check per-ticket status immediately before claiming; the local runner's
in-progress guard defers entirely to a running CI batch. A late-firing schedule run
therefore degrades to a no-op pass rather than duplicating work.

### 4. Cadence record

The daily cadence is normatively recorded in
`docs/constitution/09-operations-workflow.md` §9.8 (02:30 GitHub batch → 05:30 local
check/direct-execution pass).

## Consequences

- Ticket authors can rely on: ready manual tickets are mechanically processed within
  ~27 hours of creation in the normal case; `review → done` remains a human-only move.
- Run summaries land in `memory/YYYY-MM-DD.md` from both runners, keeping the
  §9.1-style evidence trail.
- Costs scale with batch size (z.ai GLM metered; the 2026-09-09 failed run cost ~$15
  for 80 minutes) — bounded by the stop rules and the concurrency group.

## References

- `docs/designs/2026-09-11-nightly-ticket-batch-automation-design.md` (as-deployed record)
- `.github/workflows/nightly-tickets.yml`, `docs/constitution/09-operations-workflow.md` §9.8
- AGENTS.md §3.7.5 (governance-backlog dispatch), ticket state machine
  (`scripts/helpers/ticket-schema.ts`)
