---
status: Accepted
date: 2026-09-19
author: PM
---

# ADR-0082: Local-Only Governance-Ticket Processing (ZCode Runner as Sole Batch)

## Context

ADR-0071 ratified a dual-runner cadence: a scheduled GitHub Actions batch
(`nightly-tickets.yml`, 02:30 KST, claude-code-action over the z.ai endpoint,
cap 50 tickets / ~5 h) plus a local ZCode workspace automation (05:30 KST) that
checked the nightly outcome and directly processed leftovers/anomalies
(cap 25 tickets / ~3 h). Operational record 2026-09-08 → 2026-09-19
(`memory/2026-09-19.md`):

- GitHub scheduled runs consistently fired 2.5–3.5 h late (observed ~20:20–21:00
  UTC), overlapping the local runner's 05:30 KST window and complicating the
  missed-run interpretation rules.
- Each CI batch cost metered z.ai spend (the 2026-09-09 failed run cost ~$15 for
  80 minutes) and required CI secrets for ticket processing.
- The local runner executed daily with zero double-processing incidents, and the
  ready queue was empty on every healthy morning — the anomaly pass rarely had
  real work because the CI batch had already drained the queue.

## Decision

Make the local ZCode runner the sole scheduled governance-ticket processor and
retire the GitHub scheduled batch.

1. **Workflow**: the `on.schedule` trigger is removed from
   `nightly-tickets.yml`; `workflow_dispatch` is kept (manual emergency batch;
   the api-probe diagnostic job remains dispatch-only). No scheduled CI ticket
   processing remains.
2. **Local runner**: promoted from anomaly pass to primary batch — cap raised to
   50 tickets / ~5 h (the retired CI batch's contract), same SELECT/SKIP rules,
   same four validation gates (`audit.ts`, `validate-templates.ts`,
   `verify-scripts.ts --verify`, `bun test`), same dev-sync PR-only landing,
   same per-ticket status re-check. It stages task files explicitly and lands
   with `dev-sync.ts --scoped-staging` so unrelated local working-tree changes
   are never swept into its PRs.
3. **Guard retained**: the runner still defers (report-only) while a manual
   `nightly-tickets.yml` dispatch is in progress — the no-double-processing
   guard survives the retirement of the schedule.
4. **Cadence record**: `docs/constitution/09-operations-workflow.md` §9.8
   documents the single-runner cadence; the cadence sections of ADR-0071 are
   superseded by this ADR — its safety rules, four-gate validation, PR-only
   landing, and ticket state-machine contract carry over unchanged.

## Consequences

- Ticket processing now depends on the local workstation being on at 05:30 KST.
  If the machine was off, ready tickets simply wait: they remain visible to
  `bun scripts/ticket.ts list --ready --kind manual` at session start and in the
  Weekly Health Check (AGENTS.md §3.7.5, `09-operations-workflow.md` §9.1), and
  manual workflow dispatch remains as an emergency path.
- No metered z.ai cost and no CI-secret exposure for scheduled batches.
- GitHub schedule lateness/skip interpretation rules (ADR-0071 §1) become moot.
- `review → done` remains human-only; neither the local runner nor a manual
  dispatch merges PRs.

## References

- Supersedes: ADR-0071 (dual-runner cadence sections)
- `docs/designs/2026-09-19-local-ticket-runner-migration-design.md`
- `.github/workflows/nightly-tickets.yml`, `docs/constitution/09-operations-workflow.md` §9.8
- Ticket state machine (`scripts/helpers/ticket-schema.ts`), AGENTS.md §3.7.5
