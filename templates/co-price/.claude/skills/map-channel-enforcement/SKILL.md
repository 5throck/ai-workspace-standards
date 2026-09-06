---
name: map-channel-enforcement
scope: co-price
description: MAP policy enforcement and channel conflict resolution
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: pricing-strategist
prerequisites: a published channel roster and promotion calendar
---

# MAP & Channel Enforcement Skill

## Purpose
Prevent channel conflict and gray-market leakage through a clear, consistently enforced
MAP posture and rules of engagement.

## Procedure
1. **Define MAP** — the lowest *publicly advertised* price per SKU, set **unilaterally**
   and never negotiated with retailers. In-cart/checkout discounts remain the retailer's
   discretion (distinguish advertised vs selling price to avoid RPM exposure).
2. **Enforce uniformly** — identical treatment across all sellers (selective enforcement
   is the clearest legal risk). Monitor marketplace repricing algorithms (most breaches
   are algorithmic).
3. **3-strikes protocol**
   1. First violation — written notice + 48h cure window.
   2. Second (within 90 days) — suspend MDF access 30 days.
   3. Third (within 90 days) — 30-day supply restriction; continued → terminate authorized status.
4. **Authorized waivers** (e.g., Black Friday) — written, ≥ 14 days in advance, with
   explicit start/end dates and discount depth.
5. **Assortment & own-channel** — DTC owns highest-margin/LTV SKUs; retail gets a curated
   entry assortment; never let retail undercut DTC price. Hold the rules of engagement
   (direct-account list, deal-registration) written *before* conflict.
6. **Roadmap flag** — MAP is currently a documented guardrail only; implement as a
   corridor constraint field in `KBEAUTY_PRICING_POLICIES` when the policy surface lands.

## Output
A MAP price sheet (per SKU/UPC, effective/expiry, promo exceptions) and a violation
log feeding the Deal Desk process (`pricing-governance`).

## References
- `docs/channel-pricing-promotion-policy.md` §6 (MAP & channel conflict)
- `docs/pricing-governance-rules.md` §7 (enforcement protocol)
- Owner: `pricing-strategist`; schema guardrails co-owned by `security-auditor`
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **MAP policy enforcement and channel conflict resolution** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `pricing-strategist`. See `variant.json` skills registry for the full co-price skill set.
