---
name: pricing-governance
scope: co-price
description: Pricing governance framework and corridor management
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: pricing-strategist
prerequisites: a draft TradeTerm / ConsumerPricePlan under review
relates_to:
  - skill: price-waterfall-analysis
    type: follows
  - skill: ui-component-design
    type: composes_with
inputs: [approval-record]
outputs: [exception-log, guardrail-status]
lang: ko
lang_reason: proper-noun
---

# Pricing Governance Skill

## Purpose
Turn the policy (`channel-pricing-promotion-policy.md`) and rules
(`pricing-governance-rules.md`) into day-to-day control of discounts and exceptions.

## Procedure
1. **Classify the request** against the authority matrix
   (self-serve / desk-managed / senior exception).
2. **Corridor check** — confirm price lands within target; if between target and
   guidance floor, require delegated approval; below absolute floor requires
   `finance-strategy-lead` (CFO-equivalent) sign-off.
3. **Give-get** — every exception needs a quid pro quo (volume / term / early pay /
   reference rights) and a mandatory expiry date.
4. **Discount taxonomy** — tag the concession type (promotional / volume / strategic /
   channel rebate / payment-terms / make-good / service credit) so leakage stays visible.
5. **Deal Desk process** — Deal Desk is a cross-functional **process** (no simulator
   component), owned by `engagement-director` with the log held by `cpa-auditor`.
   Exceptions are reviewed via ScenarioLibrary / WhatIfPanel and expire if not re-justified.
6. **Enforce guardrails** — before promoting a snapshot, confirm `GUA-*` (mix ±0.001,
   cost floor, stack 40% cap) are green.

## Output
An approved/denied decision with a logged exception (who / why / until when) and the
guardrail status. Stage 6 (사전검증) user gate consumes this before promotion.

## References
- `docs/pricing-governance-rules.md` §1–§5 (matrix, corridors, give-get, taxonomy, log)
- `docs/channel-pricing-promotion-policy.md` §2 (ownership)
- Engine guardrails: `GUA-01`, `GUA-03`, `GUA-PW1`, `GUA-PW2`
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Pricing governance framework and corridor management** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `pricing-strategist`. See `variant.json` skills registry for the full co-price skill set.
