---
name: van-westendorp-psm
scope: co-price
description: Van Westendorp Price Sensitivity Meter survey analysis
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: market-intelligence-analyst
prerequisites: SurveyResponse rows (method='vw') ingested via actions/market; thresholds strictly increasing per row
relates_to:
  - skill: pricing-playbook
    type: enables
  - skill: gabor-granger
    type: follows
inputs: [survey-responses-vw]
outputs: [price-corridor, opp-price-point]
---

# Van Westendorp PSM Analysis Skill

## Purpose
Convert raw four-question survey responses (`too_cheap / bargain / expensive /
too_expensive`) into the four canonical price points and an acceptable pricing
corridor for advisory use.

## Procedure
1. **Load data** — pull `SurveyResponse` rows where `method='vw'` for the project;
   each `payload` carries strictly-increasing thresholds.
2. **Run engine** — call `analyzeVanWestendorp(responses)` from
   `src/lib/engine/vw-gg.ts`. It evaluates cumulative curves on the candidate grid
   and interpolates crossings (see `biz_logic.md` §7).
3. **Read outputs**:
   - `points.pmc` — quality-suspicion floor (marginal cheapness)
   - `points.opp` — optimal price point
   - `points.idp` — indifference point
   - `points.pme` — resistance ceiling (marginal expensiveness)
   - `ordered` — canonical sanity: PMC ≤ OPP ≤ PME and OPP ≤ IDP
   - `findings` — `VW-INSUFFICIENT-SAMPLE` (n<5), `VW-ORDER-VIOLATION`
4. **Interpret** — OPP is the statistically preferred price; [PMC, PME] bounds the
   defensible corridor. Feed points into the computation ledger before any
   copilot citation.

## Output Contract
Ledger-registered figures + a short memo: corridor, OPP position vs current price,
sample-size caveat when n<5.

## Boundaries
- Stated-preference bias applies — never present raw WTP as realized price.
- No strategy conclusions here; hand results to `pricing-strategist`.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Van Westendorp Price Sensitivity Meter survey analysis** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `market-intelligence-analyst`. See `variant.json` skills registry for the full co-price skill set.
