---
name: price-waterfall-analysis
scope: co-price
description: Pocket margin analysis and price waterfall diagnostics
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: finance-strategy-lead
prerequisites: a populated simulation state (wholesaleParams + consumerParams + costs)
---

# Price Waterfall Analysis Skill

## Purpose
The price waterfall is the single source of truth for realized price. Typical leakage
is 8–15% of list; disciplined governance recovers 1–5 points of net price realization
without raising list price. This skill maps every concession to a step and verifies it
against the engine guardrails.

## Procedure
1. **List price** — start from the channel list price in `KBEAUTY_TRADE_TERMS`.
2. **On-invoice** — subtract quantity-tier discounts and revenue rebates.
3. **Off-invoice** — subtract freight, payment-term concessions, MDF/co-op. Each must
   appear in the waterfall (no hidden leakage).
4. **Pocket Price** = list − all above.
5. **Pocket Margin** = pocket price − COGS − cost-to-serve (`KBEAUTY_COSTS`).
6. **Guardrail checks**
   - `GUA-PW1`: pocket price must stay ≥ cost floor (never sell below cost).
   - `GUA-PW2`: total discount stack must not exceed the 40% cap.
   - Dynamic clamp 0.7–1.3 on relative factors.
7. **Leakage ranking** — rank steps by dollars lost; report the top leaks.

## Output
A waterfall table per channel/SKU and a leakage ranking. Feed the ranking into
`pricing-governance` (exception log) and `finance-strategy-lead` margin floors.

## References
- `docs/channel-pricing-promotion-policy.md` §4 (waterfall is SSOT)
- `docs/pricing-governance-rules.md` §6 (waterfall rules)
- Engine guardrails: `GUA-PW1`, `GUA-PW2`
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Pocket margin analysis and price waterfall diagnostics** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `finance-strategy-lead`. See `variant.json` skills registry for the full co-price skill set.
