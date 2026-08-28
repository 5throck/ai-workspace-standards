---
name: gabor-granger
scope: co-price
description: Gabor-Granger direct pricing research methodology
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: market-intelligence-analyst
prerequisites: SurveyResponse rows (method='gg') ingested via actions/market; at least two tested price points with responses
---

# Gabor-Granger Demand Analysis Skill

## Purpose
Turn purchase-intent answers across predefined price points into a demand curve,
the revenue-maximizing price $p^{*}$, and arc elasticity at that optimum.

## Procedure
1. **Load data** — `SurveyResponse` rows where `method='gg'`; each `payload`
   carries `{pricePoint, wouldBuy}`.
2. **Run engine** — call `analyzeGaborGranger(responses)` from
   `src/lib/engine/vw-gg.ts` (see `biz_logic.md` §8):
   - `curve[]`: ascending price → asked/buyers/qRate/revenue
   - `optimalPrice` = argmax revenue; `maxRevenue` index
   - `elasticityAtOptimum`: midpoint arc elasticity vs nearest lower tested price
     (`null` when optimum is the lowest tested point — flagged
     `GG-ELASTICITY-UNDEFINED`)
3. **Interpret** — check demand monotonicity; non-monotonic curves signal sample
   noise or anchoring. Elasticity |ε|<1 at optimum ⇒ room to test upward;
   |ε|>1 ⇒ volume-sensitive.
4. **Register** — push curve summary and $p^{*}$ into the computation ledger.

## Output Contract
Ledger-registered demand table + memo: $p^{*}$, revenue index, elasticity reading,
tested-price coverage caveats.

## Boundaries
- Results are relative to the TESTED price set — out-of-range optima are invisible.
- Hand elasticity to `pricing-strategist`; do not issue price recommendations here.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Gabor-Granger direct pricing research methodology** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `market-intelligence-analyst`. See `variant.json` skills registry for the full co-price skill set.
