---
status: "Accepted"
---

# ADR-0004: Consulting Analytics as Deterministic Engine Modules

**Status**: Accepted
**Date**: 2026-08-25
**Deciders**: pm, finance-strategy-lead, core-engine-dev, cpa-auditor

## Context

v10.1 adds advisory capability: benchmark-gap diagnostics, price-waterfall analysis,
Van Westendorp PSM and Gabor-Granger demand analytics, cost-shock sensitivity with
margin-neutral repricing, partner (distributor/retailer) P&L simulation, discount and
promotion timing, and domestic–export dual pricing under Incoterms.

The project's credibility model — Harness Engineering (`biz_logic.md` LaTeX →
`[Ref:]` tests → implementation, certified by `cpa-auditor`) — was built for the
simulation core. Advisory features could plausibly have been implemented as
spreadsheet-style UI calculations or LLM-generated estimates instead.

## Decision

1. **Every consulting computation is an engine module** under
   `src/lib/engine/`: `diagnostics.ts`, `sensitivity.ts`, `vw-gg.ts`,
   `partner-pnl.ts`, `discounts.ts`, `export-pricing.ts` — all using `mathjs`
   precision wrappers.
2. **Spec-first discipline extends to these modules**: each lands as a LaTeX
   section in `docs/biz_logic.md` before tests and code. Closed-form methods are
   chosen where available (VW cumulative intersections; GG revenue curve peak;
   margin-neutral uplift formula), keeping the harness applicable without Monte
   Carlo machinery.
3. **Results enter the computation ledger** (ADR-0003) so recommendations cite
   traced figures only.
4. **Cross-module contracts**: Gabor-Granger elasticity feeds Cost-Shock pass-through
   judgement; benchmark data flows from `market-intelligence-analyst` curation into
   diagnostics; partner-P&L consumes trade-line supply prices.

## Alternatives Considered

- **UI-side or spreadsheet calculations**: rejected — unaudited, untested, drift-prone.
- **LLM estimation of elasticity/recommendations**: rejected — violates ADR-0003;
  fabricated numbers in advisory output are indistinguishable from correct ones.

## Consequences

- Advisory outputs inherit the same zero-drift guarantees and CPA certification as
  the simulation core.
- `biz_logic.md` grows significantly; section anchors become the traceability spine
  across engine, copilot, and reports.
- Method scope is bounded to closed-form analytics for now; stochastic methods would
  require a harness extension (seeded RNG policy) — deferred until needed.
