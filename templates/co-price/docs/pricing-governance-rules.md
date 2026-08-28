---
lang: ko
lang_reason: proper-noun
---

# Pricing & Promotion Operating Rules

> The "rules of the road" — concrete, enforceable rules that turn the policy
> (`channel-pricing-promotion-policy.md`) into day-to-day control. These are the
> guardrails implemented in the co-price simulator and the Deal Desk.

## 1. Discount Authority Matrix

Approval bands tied to pocket-margin / net-discount thresholds. Keep tiers few and intuitive.

| Role | Within corridor | Above corridor | Below floor |
|------|-----------------|----------------|-------------|
| Sales Rep | ≤ 8% self-serve | — | — |
| Regional Manager | ≤ 12% with give-get | desk-managed | — |
| Deal Desk / Pricing Lead | any | approves w/ rationale | senior exception |
| CFO | — | — | non-delegable approval |

**Non-delegable (always CFO/senior):** below absolute floor, open-ended price holds,
most-favored-nation clauses, precedent-setting structures.

> **co-price mapping:** these roles map to existing agents — Deal Desk → `engagement-director`
> + `cpa-auditor` (exception log); CFO guardrails → `finance-strategy-lead` (margin floor) +
> `security-auditor` (schema) + `cpa-auditor` (double-entry). No separate TPM/CFO agent exists.

## 2. Price Corridors

- For each segment / SKU / channel define three anchors:
  - **Target** — where the bulk of deals should land.
  - **Guidance Floor** — lowest price approvable under normal delegated authority.
  - **Absolute Floor** — never without CFO sign-off.
- Express as discount band from list *or* price corridor; pick one primary unit of measure
  (per-unit or effective annual rate) and normalize across configurations so deals are
  comparable.
- Publish three zones: **self-serve** (no approval), **desk-managed** (within delegated
  authority), **senior exception** (required escalation). Publishing reduces escalations.

## 3. Give-Get Rules

- Every exception requires a **quid pro quo**: volume commitment, multi-year term, earlier
  payment, or reference rights.
- Documented in the quote/order; an **expiration date is mandatory**. Exceptions without
  expiry effectively become permanent price reductions (forbidden).

## 4. Discount Taxonomy

Standard, mutually exclusive types — each with an owner and a funding source:

| Type | Purpose | Funds from |
|------|---------|------------|
| Promotional | time-boxed consumer/retail event | marketing / channel |
| Volume | tier/quantity break | product P&L |
| Strategic | named-account acquisition/retention | product P&L |
| Channel rebate | distributor/wholesale performance | channel |
| Payment-terms | early-pay / extended-terms trade | finance |
| Make-good | service recovery | ops |
| Service credit | SLA miss | ops |

No overlapping or opaque categories — they hide leakage.

## 5. Exception Process & Log

- Every below-standard price: manager approval, logged (who / why / until when), reviewed
  monthly against the waterfall.
- Deal desk owns a **time-bound exception log**; exceptions expire and must be re-justified.
- Rep-level visibility matters more than executives expect: publish realized-price league
  tables by seller.

## 6. Price Waterfall Rules

- **All concessions map to a step.** On-invoice *and* off-invoice (rebates, freight, payment
  terms, MDF) must appear in the waterfall — no hidden leakage.
- **Fixed sequence.** Apply discounts → rebates → costs in a defined order; order determines
  final margin.
- **Freight:** set a freight-included threshold (e.g., orders ≥ $2,500 free freight; small-order
  fee below). Reserve best payment terms for best tiers.
- **Volume discounts:** prefer **incremental** (marginal) schedules over **retroactive** (cliff)
  schedules to protect baseline margin.
- **Robinson-Patman hygiene:** document tier qualification rules, keep cost-to-serve evidence,
  log every exception with approver + expiry, have counsel review the policy. Differential
  pricing between competing resellers needs a defensible basis (cost justification or meeting
  competition).

## 7. Channel Conflict & MAP Enforcement

- **MAP price sheet by SKU:** SKU/UPC, MAP price, effective date, expiry, notes (promo exceptions).
- MAP = minimum **advertised** price; in-cart / checkout discounts are allowed.
- **Unilateral & uniform:** announce, don't negotiate; enforce identically across all sellers
  (selective enforcement is the clearest legal risk).
- **3-strikes protocol:**
  1. First violation — written notice + 48h cure window.
  2. Second (within 90 days) — suspend MDF access 30 days.
  3. Third (within 90 days) — 30-day supply restriction; continued → terminate authorized status.
- **Authorized waivers** (Black Friday, etc.): issued in writing ≥ 14 days in advance with
  explicit start/end dates and discount depth.
- **Online monitoring** of marketplace repricing algorithms is required (most MAP breaches are
  algorithmic).

## 8. Promotion ROI Gates (TPM)

Pre-approval requires three inputs:

1. A **single measurable objective** (distribution gain / sell-through / trial / behavior).
2. A **mechanic that maps directly** to that objective.
3. A **budget built backward** from the objective target at a defined ROI threshold
   (recommended ≥ 2.0× incremental gross profit).

**Illustrative ROI ranges (incremental profit ÷ total cost):**

| Promotion type | ROI range | Forward-buy risk |
|----------------|-----------|------------------|
| Off-invoice discount | 1.5×–2.5× | High |
| Bill-back | 2.0×–3.5× | Medium |
| Free goods | 1.8×–3.0× | Medium |
| Consumer promo at outlet | 2.5×–4.5× | Low |
| DSR incentive | varies by objective | Low |

- **Measurement window:** 6–8 weeks post-close to net forward buying; baseline = volume without
  promo. A post-promo dip below baseline signals forward buying.
- **Kill rule:** schemes below threshold or with high forward-buy ratio are cut next cycle.
- **Trade-spend guardrail:** plan 8–15% of wholesale revenue in year one; track deduction
  resolution rate/aging and accrual accuracy.

## 9. Metrics & Dashboards (seller-level, not just company-level)

- Price realization % by channel & seller.
- Pocket margin by customer segment (not just pocket price).
- Discount variance (spread between similar deals — shrinks as guardrails hold).
- Exception count & value per month.
- Rebate accrual accuracy.
- EBITDA contribution from net price (isolated from mix/volume).
- Promo ROI & CID (cost per incremental dollar); deduction resolution rate/aging.
- **Compensation** partially tied to price realization / pocket margin, not just bookings.

## 10. Alignment to the co-price Simulator

| Rule | co-price artifact |
|------|-------------------|
| Corridors / floors | engine guardrails (GUA-*) over `SimulationConfig`; Deal Desk = governance **process** owned by `engagement-director` + `cpa-auditor` (log), reviewed via ScenarioLibrary / WhatIfPanel |
| Discount taxonomy | `KBEAUTY_TRADE_TERMS` (quantity tiers, revenue rebates, promotion allowance, payment terms) |
| MAP | documented guardrail (unilateral, 3-strikes); **not yet a `KBEAUTY_PRICING_POLICIES` field** — roadmap to implement as a corridor constraint |
| TPM gates | stage 6 (사전검증) tri-view approval; stage 8 **netROI(8w)** re-score |
| Waterfall | price build in `KBEAUTY_COSTS` + trade terms → pocket margin |

## 11. References

Same external best-practice set as `channel-pricing-promotion-policy.md` §9 (channel pricing,
discount governance / waterfall, TPM, MAP & antitrust).
