# Channel, Pricing & Promotion Policy

> Governing policy for how the business designs and manages distribution channels,
> pricing architecture, and trade promotions. Synthesized from external best practice
> (channel pricing frameworks, discount governance, trade promotion management).
> Aligned to the co-price simulator domain (multi-channel wholesale + retail,
> price waterfall, trade terms, promotion calendar).

## 1. Purpose & Scope

This policy defines the principles and required posture for three interdependent
disciplines:

- **Distribution channels** — how product reaches market (direct, distributor, retail).
- **Pricing architecture** — how list price cascades to pocket margin.
- **Trade promotion** — how investment in the channel is planned, executed, measured.

It applies to every route to market: own_mall (DTC), wholesale distributors,
marketplaces, and physical retail. It is the "why and what we require" layer;
enforceable mechanics live in `pricing-governance-rules.md`; step-by-step procedure
lives in `commercial-operating-manual.md`.

## 2. Ownership & Governance

| Domain | Owner (co-price agent) | Non-delegable decisions |
|--------|-------|--------------------------|
| Channel strategy | `engagement-director` | model choice per segment, rules of engagement |
| Pricing architecture | `pricing-strategist` | target corridors, fence logic |
| Margin & waterfall | `finance-strategy-lead` | absolute floors, cost-to-serve basis |
| Trade promotion (objective / ROI gates) | `market-intelligence-analyst` + `pricing-strategist` | objective setting, ROI gates (stage 6 user gate) |
| Exceptions (Deal Desk process) | `engagement-director` + `cpa-auditor` (log) | below-floor approvals, precedent risk |
| Guardrails (CFO-equivalent) | `finance-strategy-lead` + `security-auditor` (schema) + `cpa-auditor` (double-entry) | absolute floor, MAP stance, audit |

## 3. Distribution Channel Strategy

- **Three models, chosen per segment:** Direct (full margin + control), Indirect/Distributor
  (reach, lower cost-to-serve, gives up margin), Hybrid/Dual (default — keep strategic
  accounts direct, delegate long tail to distributors). Margin and control move together:
  every point of distributor margin must *buy* reach, coverage, or service.
- **Tiered distribution entry:** gate expansion on velocity (e.g., 4–6 units/store/week at
  Tier 1 before Tier 2; Tier 3/mass only after proven pull). Growing doors faster than
  velocity is the most common path to delisting.
- **Rules of engagement written BEFORE conflict:** direct-account list, deal-registration
  process, and escalation path documented in the partner agreement. Rules written during a
  conflict are a fight, not a tool.
- **Measure the channel, not just revenue:** channel gross margin *after cost-to-serve*,
  revenue concentration (a single partner > ~1/3 of revenue is standing risk), sell-through
  vs sell-in (inventory loading vs real demand), and end-user data sharing.

## 4. Pricing Architecture

- **Price waterfall is the single source of truth:** List → on-invoice discount → off-invoice
  (rebates, freight, payment terms, MDF/co-op) → **Pocket Price** → **Pocket Margin**
  (less COGS + cost-to-serve). Typical leakage is 8–15% of list; disciplined governance
  recovers 1–5 points of net price realization without raising list price.
- **Dual pricing:** wholesale price (to partners) and consumer/retail price (to end customer)
  each carry their own corridor. The goal is *consistent profitability after cost-to-serve and
  strategic role* — with differences you can explain — not price uniformity.
- **Price fences:** eligibility by segment/channel/volume/contract term prevents cross-segment
  arbitrage and gray-market leakage. Fences must be observable and enforceable in systems.
- **Cost-to-serve is in the floor:** small orders, expedited delivery, premium SLAs are
  *separately governed concessions*, not buried in base price. Burying them is an invisible
  discount your worst-behaved customers collect.

## 5. Promotion Philosophy (TPM)

- Trade promotion is typically the **second-largest P&L line (15–25% of gross sales)**. Treat
  it as a managed investment with a ROI anchor, not default spend. A large share of individual
  events fail to break even — measurement is the differentiator.
- **One measurable objective per promotion**, set *before* mechanics: distribution gain
  (new listings), sell-through acceleration, consumer trial, or behavior change. "Drive volume"
  is not an objective.
- **Budget built backward from the objective at a target ROI** (e.g., 3:1), not "what's
  available." Promotion that cannot pass this test at planning is not improved by funding.
- **Baseline-and-uplift measurement:** baseline = volume that would have sold without the
  promotion. Uplift = incremental. Account for **forward buying** (post-promo dip 4–8 weeks)
  by measuring 6–8 weeks post-close. Full-cost ROI includes trade discount, DSR incentives,
  POS materials, execution overhead, and logistics premiums.

## 6. Channel Conflict & MAP

- **Minimum Advertised Price (MAP):** the lowest *publicly advertised* price by SKU. It does
  **not** set the selling price — in-cart/checkout discounts remain the retailer's discretion.
  Set **unilaterally**, enforce **consistently** (no selective enforcement), use a 3-strikes
  protocol, and never negotiate MAP levels with retailers.
  *Legal note:* unilateral MAP is permissible in the US (Colgate doctrine) but restricted in the
  EU/UK and parts of Asia — consult counsel per market. Distinguish advertised vs selling price
  to avoid resale-price-maintenance (RPM) exposure.
- **Channel-specific assortment:** DTC owns highest-margin/LTV SKUs (bundles, subscriptions,
  limited editions); retail gets a curated entry assortment. Use retail shelf as top-of-funnel
  back to DTC (QR/inserts), never let retail undercut DTC price.
- **Never undercut your own channel:** hold the rules of engagement; going direct on price
  against handed-over accounts destroys a hybrid model.

## 7. Governance Cadence

| Cadence | Review |
|---------|--------|
| Weekly | Realized price by channel & seller; discount variance; exception log |
| Monthly | Rebate accruals; win-loss; promotion settlement & deduction resolution |
| Quarterly | Reset floors/bands/segment architecture; promo ROI review → next calendar |
| Annual | Full portfolio & policy review (year-end-only audits miss weekly leakage) |

## 8. Alignment to the co-price Simulator

| Policy element | co-price artifact |
|----------------|------------------|
| Channels & roles | `KBEAUTY_CHANNELS` (wholesale_emart/hyundai/oliveyoung + retail coupang/instagram/own_mall + **naver**) |
| Trade terms / waterfall | `KBEAUTY_TRADE_TERMS` (quantity tiers, revenue rebates, promotion allowance, payment terms) |
| Consumer price plan | `KBEAUTY_PRICING_POLICIES` (EDLP / High-Low / Markdown pricing templates) |
| Promotion calendar | `KBEAUTY_PROMO_CALENDAR`; evaluate **netROI(8w)** at stage 8 |
| Guardrails | engine guardrails (GUA-01 tax, GUA-03 mix ±0.001, GUA-PW1 cost floor, GUA-PW2 stack 40% cap, dynamic clamp 0.7–1.3) over `SimulationConfig`; Deal Desk = cross-functional **process** (no simulator component) → logged via ScenarioLibrary / WhatIfPanel |

## 9. References (external best practice)

- Channel pricing: Handle "Channel Pricing Strategy" (2026); Revify "Channel Pricing: 5 Proven
  Moves To Stop Margin Leaks" (2026); Revify "Wholesale Pricing: 7 Proven Tier Rules" (2026);
  D2C Times "Build a DTC Wholesale Channel Past $50M" (2026); Vx Group "Distribution Strategy"
  (2026).
- Pricing governance & waterfall: Umbrex "Discount Governance Framework" (2026), "Pricing
  Guardrails" (2026), "Pocket Price Framework" (2026); Glacier Lake Partners "Pricing Waterfall
  Analysis" (2026); Conga "Price Waterfall Analysis" (2026).
- Trade promotion: Rework "Trade Promotion Management in FMCG" (2026); CPGScout "What is TPM?"
  (2026); Inymbus "TPM Complete Guide" (2026); ParallelDots "TPM 2026" (2026); POI "TPM"
  (2019/2025); Confido "TPM Best Practices" (2026).
- MAP / antitrust: Mondaq "MAP Policies" (2025); Pricelysis "How to Write a MAP Policy" (2026);
  MetricsCart "MAP & Antitrust" (2026); Shopify "MAP Pricing" (2025); Wharton "Channel Management
  and MAP" (2017); TheAntitrustAttorney "MAP & Antitrust" (2022).
