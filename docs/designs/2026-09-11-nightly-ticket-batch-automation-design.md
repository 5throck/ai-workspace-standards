# Nightly Governance-Ticket Batch Automation + 05:30 Local Runner — As-Deployed Record

**Spec ID**: 2026-09-11-nightly-ticket-batch-automation
**Date**: 2026-09-11
**Author**: PM (user-directed documentation-gap pass)
**Status**: Approved → Implemented
**Related**: ADR-0071 (ratifying decision), docs/adr/0044 (Amendment 1 — variant hook resolution), `docs/constitution/09-operations-workflow.md` §9.8 (cadence)

## 1. Problem (documentation gap, not a build gap)

The workspace has been running a standing agent automation since 2026-09-08 with **no
design record, no ADR, and no operations-doc cadence entry**:

- `.github/workflows/nightly-tickets.yml` — a scheduled CI job (17:30 UTC / 02:30 KST)
  that runs claude-code-action against the z.ai GLM Anthropic-compatible endpoint,
  processes ready `kind: manual` governance tickets, and lands them via `dev-sync.ts`
  as PRs (never merges). Batch cap 10 → raised to 50 with a ~5-hour budget
  (2026-09-11, PR #859).
- A local ZCode workspace automation (created 2026-09-11, daily **05:30 KST**) that
  checks the nightly result and directly processes leftovers/anomalies — schedule
  skips, failures, or unclaimed ready tickets — with the same gates and PR-only
  discipline (cap 25 / ~3 hours).

Both produce governance effects (ticket state moves, PRs) yet were discoverable only
through the workflow file and memory logs. Additionally, scheduled GitHub runs are
best-effort: the 2026-09-09 run fired 2h28m late and the 2026-09-10 run was initially
believed skipped before firing late the same evening — the miss/delay handling rules
were nowhere written down.

## 2. Decision (recorded in ADR-0071)

Ratify the as-deployed system and write the cadence into the operations workflow:

1. **ADR-0071** codifies: the nightly CI batch (provider auto-detection, cap 50,
   ~5 h budget, PR-only, per-ticket status re-check), the 05:30 local runner
   (skip-if-nightly-in-progress; direct execution for leftovers/anomalies, cap 25 /
   ~3 h, same four gates), the ticket state-machine interactions, and the dual-runner
   no-double-processing logic (concurrency group + status re-checks + in-progress guard).
2. **`09-operations-workflow.md` §9.8** documents the daily cadence
   (02:30 GitHub → 05:30 local) and the missed-run interpretation rule.
3. **ADR-0044 Amendment 1** (same pass): the variant audit-hook resolution is now
   variant.json-aware (`script_manifest` declared path → root `scripts/audit-variant.ts`
   → `scripts/<variant>/audit-variant.ts`) with a WARN on declared-but-missing —
   reconciling ADR-0044 §1's hard-coded root path with ADR-0050's `scripts/<variant>/`
   layout rule (co-safety's hook was silently never executed before PR #859's fix).

## 3. Constraints honored

- The nightly agent itself may never author these records (its safety rules forbid
  touching `.github/workflows`); documentation is authored in interactive sessions.
- `review → done` remains human-only; neither runner merges PRs.
- Both runners enforce the four validation gates (`audit.ts`, `validate-templates.ts`,
  `verify-scripts.ts --verify`, `bun test`) before landing, and never bypass or
  `--no-verify` a gate.

## 4. Verification

- `verify-adr-governance.ts --strict` passes with ADR-0071 referenced from the
  operations workflow corpus; skill-graph regenerated for the new ADR node.
- Standard battery: `audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`,
  `bun test`.
