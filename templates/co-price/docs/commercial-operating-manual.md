---
lang: ko
lang_reason: proper-noun
---

# Commercial Operating Manual (Channel · Price · Promotion)

> Step-by-step SOP for running the co-price Commercial Operating Cycle. The loop:
>
> ```
> 0 목표·제약 → 1 진단 → 2 선정 → 3 배분
>    → [4 Terms 설계 | 5 Price 경로 설계] → 6 사전검증 → 7 집행 → 8 평가 ─┐
> ◄──────────────────────────────────────────────────────────────────────┘
> ```
>
> Each stage has an entry condition, owner, artifact, and exit criteria. Stage 8 output
> is a mandatory input to stages 0–2 of the next cycle.

## Stage 0 — 목표·제약 (Goal & Constraints)

- **Do:** capture business objective, budget cap, margin floor, and working-capital limit.
  Define which channels are in scope and each channel's strategic role (DTC vs wholesale vs retail).
- **Owner:** PM / Engagement Director.
- **Artifact:** goal declaration (ledger-registered).
- **Exit:** objective + budget cap recorded; channel scope agreed.

## Stage 1 — 진단 (Diagnose)

- **Do:** benchmark competitors; run Van Westendorp / Gabor-Granger on target segments.
  Reconstruct the current **price waterfall by channel** and rank leaks in dollars (Profit Diagnostic).
- **Minimum sample:** CompetitorPrice / Survey sample ≥ required minimum before proceeding.
- **Owner:** Market Intelligence Analyst.
- **Artifact:** ledger-registered diagnostic report.
- **Exit:** diagnostics + market intel complete; ledger IDs issued.

## Stage 2 — 선정 (Select)

- **Do:** re-score the scorecard; choose segment / channel / SKU portfolio and the tier
  architecture. Set **price fences** and eligibility.
- **Owner:** Pricing Strategist (review).
- **Artifact:** portfolio decision.
- **Exit:** scorecard re-scored; portfolio + fences decided.

## Stage 3 — 배분 (Allocate)

- **Do:** allocate volume and budget across channels subject to capacity and **mixRatio**
  constraints. `mixRatio` must sum to 1.0 (± 0.001 tolerance).
- **Owner:** Core Engine Dev (verify).
- **Artifact:** allocation table.
- **Exit:** capacity & mixRatio constraints met (engine verified).

## Stage 4 — Terms 설계 (Trade Terms Design)

- **Do:** define `wholesaleParams` per wholesale channel — quantity tiers, revenue rebates,
  promotion allowance, payment terms. Validate each tier **earns its discount** via pocket
  margin (cost-to-serve evidence). Prefer incremental over retroactive volume schedules.
- **Schema gate:** `wholesaleParamsSchema` must pass.
- **Owner:** Finance Strategy Lead.
- **Artifact:** TradeTerm draft.
- **Exit:** schema valid; every tier justified by pocket margin.

## Stage 5 — Price 경로 설계 (Consumer Price Plan)

- **Do:** define `consumerParams` — price corridors (target / floor / ceiling), discount
  ladders. MAP is a documented guardrail (roadmap to implement as a corridor field). Map the promotion calendar (`KBEAUTY_PROMO_CALENDAR`) to windows.
- **Schema gate:** `consumerParamsSchema` must pass.
- **Owner:** Pricing Strategist.
- **Artifact:** ConsumerPricePlan draft.
- **Exit:** schema valid; corridors + MAP + calendar aligned.

## Stage 6 — 사전검증 (Pre-Validation) — **USER GATE**

- **Do:** tri-view (wholesale / consumer / promo) approved by the user. Run the simulation;
  enforce corridors/floors; check forward-buy and ROI gates (promo ROI ≥ 2.0×; forward-buy
  dip monitored 6–8 wks post-close).
- **Owner:** CPA Auditor.
- **Artifact:** approved snapshot pair + Harness Pass Certificate.
- **Exit:** tri-view approved; guardrails green.

## Stage 7 — 집행 (Execute)

- **Do:** inject paths into the simulator; set settlement mode. Activate promotions per
  calendar; monitor deduction / claim compliance and display execution.
- **Owner:** Engagement Director.
- **Artifact:** active policies.
- **Exit:** paths live; promotions activated and monitored.

## Stage 8 — 평가 (Evaluate) → feeds next cycle 0–2

- **Do:** compute **netROI(8w)** = incremental gross profit ÷ total promo cost, measured
  6–8 weeks post-close. Classify each scheme (win / hold / cut) and re-score the scorecard.
- **Owner:** Engagement Director.
- **Artifact:** review memo → next cycle stage 0–2.
- **Exit:** netROI + classification + re-score complete; loop closed.

## Cadence & Rhythm

| Cadence | Activities |
|---------|------------|
| Weekly | Realized price by channel & seller; discount variance; exception log |
| Monthly | Rebate accruals; win-loss; promotion settlement & deduction resolution |
| Quarterly | Reset floors/bands; segment architecture; promo ROI review → next calendar |
| Annual | Full portfolio & policy review |

Leakage compounds weekly and is invisible by year-end — annual-only reviews fail.

## Using the co-price Simulator

1. **Load baseline:** ScenarioLibrary → K-Beauty sample (`getKBeautySampleState`).
2. **Sensitivity:** WhatIfPanel for corridor/floor sweeps; EducationalTooltip for concept
   guidance (price waterfall, dual pricing, discount ladder, pocket margin).
3. **Validate:** `bun run test` (harness-tagged) before any sync; `scripts/extract-baseline.ts`
   exports the baseline oracle for regression.
4. **Govern:** governance exceptions (Deal Desk **process**, owned by `engagement-director`
   + `cpa-auditor`) reviewed via ScenarioLibrary / WhatIfPanel; approvals follow
   the authority matrix in `pricing-governance-rules.md` §1.

## Per-Stage Checklists

- **Stage 0:** [ ] objective [ ] budget cap [ ] margin floor [ ] channel scope
- **Stage 1:** [ ] competitor benchmark [ ] VW/GG [ ] waterfall leak ranking [ ] min sample
- **Stage 2:** [ ] scorecard re-score [ ] portfolio [ ] price fences
- **Stage 3:** [ ] capacity OK [ ] mixRatio = 1.0 ±0.001 [ ] allocation table
- **Stage 4:** [ ] wholesaleParamsSchema [ ] tier pocket-margin proof [ ] incremental schedules
- **Stage 5:** [ ] consumerParamsSchema [ ] corridors [ ] MAP [ ] calendar mapped
- **Stage 6 (USER GATE):** [ ] tri-view approved [ ] corridors/floors enforced [ ] ROI gates
- **Stage 7:** [ ] paths injected [ ] settlement mode [ ] promo activated + monitored
- **Stage 8:** [ ] netROI(8w) [ ] win/hold/cut [ ] re-score [ ] memo → loop

## References

- Commercial Operating Cycle: `AGENTS.md` §3 (dual lifecycle phase gates).
- Policy & rules: `channel-pricing-promotion-policy.md`, `pricing-governance-rules.md`.
- External best practice: channel pricing frameworks; discount governance & price waterfall;
  trade promotion management (TPM); MAP & antitrust (see policy §9).
