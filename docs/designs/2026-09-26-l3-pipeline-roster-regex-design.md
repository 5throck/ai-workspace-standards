# L3 Promotion E2E — Roster-Link Regex Over-Match Fix

| Field | Value |
|-------|-------|
| Date | 2026-09-26 |
| Status | implemented |
| Spec ID | `l3-pipeline-roster-regex` |
| Governing anchor | ADR-0031 (L1/L2 fork model); ADR-0090 (thin-dispatcher AGENTS.md) |
| Related | PR #1093 (restored VARIANT-* markers + governance links in L1 common AGENTS.md); `scripts/l3-to-variant-pipeline.ts` Phase 3.5 |

## Problem

The `scripts` E2E suite (`test-l3-to-variant-promotion.ts`, the ubuntu-only CI leg) has failed on
every run since the ADR-0090 thin-dispatcher wave: Phase 3.5 (AGENTS.md §-structure pre-flight)
reports `unresolvable agent links: agents/pm-gateway-workflow.md, agents/workflows.md,
agents/execution-plan-templates.md` and blocks the pipeline, so promotion produces no report and
no injected context doc (downstream tests 4/5c/5d fail in cascade; same-version overlay-guard
noise appears mid-run). First main-branch CI failure: the Nightly all-variants E2E (06:27Z), then
every Test Suite run from #1093 onward.

## Root Cause

The roster-link validity check scans the L3 source AGENTS.md with the unanchored pattern
`/agents\/[A-Za-z0-9_/-]+\.md/g`. #1093 added inline links to
`docs/governance/agents/{pm-gateway-workflow,workflows,execution-plan-templates}.md` in
`templates/common/AGENTS.md` (the L1 base the fixture AGENTS.md derives from). The regex bites
the `agents/…` tail of those paths, then resolves them against the L3 source root — where only
`agents/<roster>.md` exists, not `docs/governance/agents/…` — and blocks.

## Change

Anchor the pattern with a negative lookbehind —
`/(?<![A-Za-z0-9_./-])agents\/[A-Za-z0-9_/-]+\.md/g` — so a match must start a path segment
(preceded by backtick, space, or line start). True roster links (`agents/pm.md`,
table-cell `agents/architect.md`) still match; the tail of `docs/governance/agents/…` no longer
does. No content change to any AGENTS.md: the L1 links are correct and stay.

## Verification

| Check | Expected |
|-------|----------|
| `bun scripts/test-l3-to-variant-promotion.ts` | 23/23 pass (was: Phase 3.5 blocking) |
| `bun scripts/test-runner.ts scripts` | 7/7 test files pass |
| `templates/` after runs | no co-e2etest / co-e2eguard residue |
| ubuntu CI `Run scripts E2E suite` | green on the fix PR |

## Out of Scope

- windows-latest job failure with zero failed steps (runner-level orphan-process flake; rerun if
  it reproduces).
- regenerate-agents-md.ts L3-mode §6 workspace-only row pruning (separate finding, own fix).
