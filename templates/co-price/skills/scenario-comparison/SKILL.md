---
name: scenario-comparison
scope: co-price
description: Multi-scenario pricing comparison and evaluation
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: engagement-director
prerequisites: two approved ScenarioSnapshots; engine re-simulation via compareSnapshotsAction
---

# Scenario Comparison Validation Skill

## Purpose
Turn `compareSnapshotsAction` output into the stage-6 validation artifact of the
Commercial Operating Cycle: what changed, why it changed, and whether it is safe to
execute.

## Procedure
1. **Run comparison** — `compareSnapshotsAction(aId, bId)` (both states re-simulated
   through the live engine; spec §6.5).
2. **Read the tri-view** — for each year:
   - ΔRevenue% sign & magnitude vs plan expectation
   - OP-margin direction (erosion vs improvement) with promo-month attribution
   - Volume shift consistency (units up while revenue down ⇒ deep discount effect)
3. **Sanity gates** —
   - deltas within policy-implied bounds (e.g., High-Low depth × window share)
   - no negative-revenue or impossible-magnitude rows
   - realization (§6.2) consistent with channel mix assumptions
4. **Package** — summary table + top-3 drivers + reversal conditions +
   open questions; attach ledger ids for every cited figure.
5. **User gate** — present the package; record approval entry (who/when/decision)
   before stage 7 execution.

## Boundaries
- The comparison proves *difference*, not correctness — correctness comes from the
  Harness Pass Certificate on the underlying engine.
- Never average or stitch results across different engine versions.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Multi-scenario pricing comparison and evaluation** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `engagement-director`. See `variant.json` skills registry for the full co-price skill set.
