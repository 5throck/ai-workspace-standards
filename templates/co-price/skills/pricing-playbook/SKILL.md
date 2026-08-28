---
name: pricing-playbook
scope: co-price
description: Standardized pricing methodology and process guide
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: pricing-strategist
prerequisites: biz_logic.md §9; PricingPolicy persistence; snapshot comparison actions
---

# Pricing Strategy Playbook Skill

## Purpose
Turn commercial objectives into an explicit, testable **two-layer policy set**
(`biz_logic.md` §9) and quantify each option against a frozen baseline through
the snapshot comparison engine.

## Layer Model

| Layer | Audience | Instruments | Price path affected |
|---|---|---|---|
| **Wholesale (B2B)** | trade lines / channels | quantity tiers · revenue rebates · promotion allowances (+deferred IS/CF timing) | realized supply price `P_S,c` |
| **Consumer (B2C)** | channels × products | EDLP · High-Low cycles · lifecycle Markdown · rule-based Dynamic | consumer MSRP monthly path |

## Procedure
1. **Frame** — confirm objective KPIs with the client (margin floor, volume target,
   cash timing) and the channel/trade-line scope for each candidate policy.
2. **Author policies** — express as `PricingPolicy` rows (`layer`, `kind`, JSON
   `scope`/`params`, `effectiveFrom`, `recognitionLagMonths`). Validate through
   the Zod schemas in `src/lib/engine/pricing-policy.ts`.
3. **Simulate** — freeze baseline into `ScenarioSnapshot`; freeze policy variant;
   run `compareSnapshotsAction` for the yearly revenue/margin/units tri-view.
4. **Read results** — realization shift (§6.2), promo-month margin erosion,
   wholesale stack cap hits (GUA-PW2), dynamic clamp ceiling/floor touches.
5. **Recommend** — ledger-cited findings only; hand to `engagement-director`
   for the deliverable gate.

## Boundaries
- Every figure cites a computation-ledger id; no invented numbers.
- Wholesale stack is hard-capped at 40% (GUA-PW2) — proposals above it are invalid.
- Conflicting consumer scopes are configuration errors, not features to average.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Standardized pricing methodology and process guide** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `pricing-strategist`. See `variant.json` skills registry for the full co-price skill set.
