---
name: insight-synthesis
scope: co-price
description: Multi-specialist analysis integration into strategic insight
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: engagement-director
prerequisites: cycle stage-8 artifacts present (netROI memo, outcome classifications, re-scored trade lines)
---

# Insight Synthesis Skill (cycle 8 → next 0–2)

## Purpose
Close the TPM/TPO loop: convert measured results into a defensible **next-direction
memo** so the following cycle's objectives and selections are data-seeded rather
than habitual.

## Procedure
1. **Collect** — gather stage-8 artifacts: netROI (gross vs net), outcome
   classifications per event/policy (True Incremental / Forward Buying /
   Cannibalization), scorecard deltas, market re-diagnosis.
2. **Cluster** — group findings into keep / adjust / kill candidates:
   - True Incremental + ROI ≥ hurdle ⇒ repeat (same or scaled depth)
   - Forward-Buying pattern ⇒ shorten window, deepen scan-based mechanics
   - Cannibalization ⇒ portfolio-level calendar re-plan, SKU swap
   - CRITICAL GTN band ⇒ structural terms renegotiation before more spend
3. **Prioritize** — rank candidates by ledger-cited incremental contribution per
   trade dollar; cap the list at the budget envelope from stage 0.
4. **Emit memo** — next-cycle objective proposal, top-3 moves, reversal conditions,
   open questions. Every figure cites `calc_*` ids.

## Boundaries
- Diagnostic register only; imperative recommendations are banned (critic gate).
- The memo is INPUT to cycle 0–2 decisions; selection authority stays with the user.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Multi-specialist analysis integration into strategic insight** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `engagement-director`. See `variant.json` skills registry for the full co-price skill set.
