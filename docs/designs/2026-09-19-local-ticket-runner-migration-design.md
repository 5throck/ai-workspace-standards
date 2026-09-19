# Local-Only Governance-Ticket Processing Migration — Design

**Spec ID**: 2026-09-19-local-ticket-runner-migration
**Date**: 2026-09-19
**Author**: PM (user-directed: move all GitHub Actions ticket processing to the local ZCode runner)
**Status**: Approved → Implemented
**Related**: ADR-0082 (decision), ADR-0071 (superseded cadence), `docs/constitution/09-operations-workflow.md` §9.8

## 1. Problem

Ticket processing ran on a dual-runner cadence (ADR-0071): a scheduled GitHub
Actions batch (`nightly-tickets.yml`, 02:30 KST, claude-code-action over z.ai,
cap 50 / ~5 h) plus a local ZCode automation (05:30 KST) that inspected the CI
result and only directly processed leftovers/anomalies (cap 25 / ~3 h). The user
directed that all ticket processing move to ZCode. The CI leg had operational
liabilities: runs fired 2.5–3.5 h late (overlapping the local window), metered
z.ai spend per batch, and CI-secret exposure for ticket processing.

## 2. Decision

Single local runner, same contract:

1. `.github/workflows/nightly-tickets.yml` loses its `on.schedule` trigger;
   `workflow_dispatch` (manual emergency batch + api-probe diagnostics) is kept.
2. The local ZCode automation (daily 05:30 KST, cron `30 5 * * *`) is rewritten
   from "check-then-fallback" to the primary batch: cap 50 tickets / ~5 h, high
   priority first, same SELECT/SKIP rules, four validation gates, per-ticket
   status re-check, dev-sync PR-only landing. It stages task files explicitly
   and lands with `dev-sync.ts --scoped-staging` so unrelated local working-tree
   changes are never swept into its PRs.
3. The in-progress guard is retained: while a manual `nightly-tickets.yml`
   dispatch is running, the local runner reports only and stops.
4. Governance records updated: ADR-0082 (decision), ADR-0071 supersession
   blockquote, §9.8 rewritten for the single-runner cadence.

## 3. Constraints honored

- The runner agent itself never touches `.github/workflows`; CI changes are
  authored in interactive sessions (2026-09-11 design, §3).
- `review → done` remains human-only; the runner opens PRs and never merges.
- The four-gate validation and PR-only dev-sync landing are unchanged from the
  ADR-0071 contract.
- Non-UI, workspace-tooling change: no Accessibility section targets and no
  Preview Verification apply (ADR-0065/ADR-0070 exemption — nothing user-facing
  renders).

## 4. Risks and mitigations

- **Workstation off at 05:30** → the batch waits; ready tickets stay visible at
  session start and the Weekly Health Check; manual dispatch remains.
- **Double processing during transition** (PR not yet merged, CI schedule still
  live on the remote) → the retained in-progress guard defers the local run
  while any CI batch is running; per-ticket status re-checks close the residual
  race.
- **Local working-tree pollution** → scoped staging keeps the runner's commits
  to its declared task files plus pipeline outputs.

## 5. Verification

- Workflow YAML parses (`actionlint`-equivalent: YAML load) and contains no
  `schedule:` key; `workflow_dispatch` retained.
- Standard battery passes: `audit.ts`, `validate-templates.ts`,
  `verify-scripts.ts --verify`, `bun test`; `verify-adr-governance.ts --strict`;
  `verify-memory.ts`.
- ZCode automation updated (05:30 KST cron preserved) and confirmed listed.
