---
name: competitive-intelligence
scope: co-price
description: Systematic market and competitive analysis
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: market-intelligence-analyst
prerequisites: CompetitorPrice observations ingested; diagnostics GTN band available
relates_to:
  - skill: van-westendorp-psm
    type: follows
  - skill: gabor-granger
    type: composes_with
  - skill: price-waterfall-analysis
    type: composes_with
---

# Competitive Intelligence Skill

## Purpose
Produce the Diagnose-stage evidence pack (cycle stage 1): which segments exist, how
hard they are to compete in, and where our pricing posture stands versus the market.

## Procedure
1. **Segment framing** — group `CompetitorPrice` observations by product × channel ×
   region; compute volume-weighted **Competitive Price Index**
   (`own avg price / competitor avg price × 100`) per segment.
2. **Intensity read** — flag segments where:
   - CPI < 95 (we price below market) or > 110 (above), AND
   - observation coverage is stale (>90 days) or thin (<5 sources).
3. **GTN band check** — pull `grossToNetRate` per trade line; classify
   LEAN(<15%) / HEALTHY(15–30%) / CONCERN(30–40%) / CRITICAL(>40%).
4. **WTP overlay** — hand off to `van-westendorp-psm` / `gabor-granger` for
   willingness-to-pay corridors when survey data exists.
5. **Output pack** — ledger-registered table: segment · CPI · GTN band · WTP corridor ·
   data-vintage warnings. This pack seeds cycle stage 2 (trade-line selection).

## Boundaries
- Every market claim carries source + retrieval date (provenance rule).
- No strategy conclusions here — evidence only; selection belongs to
  `pricing-strategist` at stage 2.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Systematic market and competitive analysis** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `market-intelligence-analyst`. See `variant.json` skills registry for the full co-price skill set.
