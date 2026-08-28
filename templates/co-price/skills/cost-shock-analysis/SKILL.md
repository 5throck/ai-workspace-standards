---
name: cost-shock-analysis
scope: co-price
description: Raw-material cost shock sensitivity analysis
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: cost-asset-mgmt
prerequisites: BOM composition per product; current supply prices; export quotes for FX overlay
---

# Cost Shock Analysis Skill

## Purpose
Answer two advisory questions in one pass: **which product bleeds most** when a
material moves, and **how much must supply prices rise** to absorb it — then check
the export leg under FX bands.

## Procedure
1. **Define shocks** — ±% bands per material group (e.g., Fabric +15%, Trim +10%;
   combined bands −20/−10/+10/+20). Unmatched names no-op silently by design.
2. **Tornado** — `sensitivityTornado(products, shockPct)` sorts products by
   |ΔΠ| = Qty_Y1 × shocked unit-cost delta at unchanged supply price.
3. **Repricing guidance** — `marginNeutralReprice` per product:
   - `absolute_profit`: P′ = C′ + Π₀ — holds original per-unit profit
   - `ratio_preserving`: P′ = C′ × M — margin % invariant (multiplier unchanged)
   Report BOTH; GG elasticity (§8) decides which is feasible downstream.
4. **FX overlay** — `buildExportQuote` re-run at `fxRate × (1±band)`; appreciation
   must lower the USD quote (sign asserted in tests).
5. **Register** — tornado table and uplift percentages enter the computation ledger
   before any copilot citation.

## Boundaries
- Uplift is GUIDANCE only — application flows through cycle stages 4–7 gates.
- Sell-through-based markdown triggers (roadmap) will consume the same shocked cost
  base; keep material names canonical across BOM and shock inputs.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Raw-material cost shock sensitivity analysis** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `cost-asset-mgmt`. See `variant.json` skills registry for the full co-price skill set.
