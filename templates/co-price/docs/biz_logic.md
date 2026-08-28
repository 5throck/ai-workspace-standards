---
lang: ko
lang_reason: proper-noun
---

# Strategic Business Logic & Formulas (biz_logic.md) v4.1

This document is the **Tactical Master Specification** for all business rules, mathematical formulas, and simulation constraints within the AIG platform. It serves as the primary reference for the simulation engine and financial auditors.

---

## 1. Logic Matrix & Tactical Constraints

### 1.1. Core Calculation Rules
| Code | Rule Name | Description | Source |
|---|---|---|---|
| **MAT-01** | **Precision Retention** | Currency and cost values must keep 4+ decimal places in memory. | `Internal Standard` |
| **MAT-02** | **Quantity Rounding** | Final unit volumes (Sales, Headcount) must use `Math.round()`. | `src/lib/simulation.ts` |
| **MAT-03** | **Inflation Anchor** | Inflation factor: $F_{inf} = (1 + r_{inf})^{Y-1}$. Applied to Unit Costs and Fixed SGA. | `src/lib/engine/formulas.ts` |
| **MAT-04** | **YTD Tax Accrual** | Tax expense = $Tax(YTD\_OP) - Tax(LastMonth\_YTD\_OP)$. Ensures annual consistency. | `src/lib/simulation.ts` |

### 1.2. Boundary Conditions & Guards
| Code | Rule Name | Constraint | Failure Action |
|---|---|---|---|
| **GUA-01** | **Negative Profit** | If $Annualized\_OP < 0$, Tax = 0 (unless regional minimums apply). | `src/lib/engine/tax.ts` |
| **GUA-02** | **LifeCycle Filter** | If $m < m_{launch}$ or $m > m_{discontinue}$, $Qty = 0$ and $Depr = 0$. | `src/lib/engine/formulas.ts` |
| **GUA-03** | **Mix Ratio Sum** | Component ratios per product must satisfy $\sum Ratio_{mix} = 1.0$. | `src/lib/types.ts` |
| **GUA-04** | **Division Stability** | Protect $ASP$ and $Margin\%$ if $Qty = 0$ or $Rev = 0$. | `src/lib/simulation.ts` |

---

## 2. Revenue & Sales Dynamics

### 2.1. Monthly Sales Quantity Projection
Sales volume is determined by the interaction of yearly targets, growth modes, and seasonality profiles.

$$Qty_{m,c} = Qty_{yearly,c} \times (1 + r_{growth})^{Y-1} \times \frac{W_{m,p}}{\sum_{i=1}^{12} W_{i,p}}$$

Where:
- $Qty_{yearly,c}$: Channel-specific yearly target (prioritizes `channelSales.yearlyTargetQty` over global mix).
- $W_{m,p}$: Monthly weight for the selected seasonality preset.

### 2.2. Pricing Engine (Supply-Base)
The engine calculates realized revenue from MSRP down to the realized supply price.

**Realized Supply Price ($P_{S,c}$):**
$$P_{S,c} = [P_{MSRP} \times Rate_{supply,c} \times (1 + Adj_{c})] + Adj_{abs,Y}$$

Where:
- $P_{MSRP}$: The active MSRP, prioritizing `referencePriceOverride` over cost-plus.
- $Adj_{c}$: Channel-specific price adjustment ratio (e.g., D2C premium).
- $Adj_{abs,Y}$: Manual absolute adjustment from the `multiYearPlan`.

---

## 3. Cost Structure & Labor Scaling

### 3.1. Total Manufacturing Cost
$$COGS_{total} = COGS_{material,var} + COGS_{material,fixed} + Labor_{mfg}$$

- **Variable (BOM)**: $COGS_{mat,var} = \sum_{p} (Qty_{p} \times \sum (C_{unit,i} \times (1+r_{inf,i})^{Y-1}))$.
- **Fixed (Depreciation)**: $COGS_{mat,fixed} = \sum \frac{Investment}{DeprYears \times 12}$ (Filtered by Lifecycle).

### 3.2. Labor Scaling & Hierarchy
Headcount is dynamically adjusted based on departmental triggers (Revenue or Volume).

**Headcount Scaling Rule ($HC_{total}$):**
$$HC_{total} = HC_{initial} + \lfloor \frac{Metric_{current}}{Threshold} \rfloor$$

**Hierarchy Breakdown (Span of Control):**
- $HC_{ceo} = 1$ (Admin only), $0$ (otherwise).
- $HC_{member} = \text{round}(\frac{HC_{total} - HC_{ceo}}{1 + 1/Span})$
- $HC_{leader} = HC_{total} - HC_{ceo} - HC_{member}$

---

## 4. Financial Statement Engineering (P&L to CF)

### 4.1. Global Multi-Regional Tax Engine
The engine selects logic based on the `state.region` setting.

| Region | Primary Tax Logic | Key Constraint |
|---|---|---|
| **KR** | Progressive (9% / 19% / 21% / 24%) | +10% Local Surtax |
| **US/CA** | Fed (21%) + State (8.84%) | **$800 Minimum Tax** applies even at loss |
| **SG** | Tiered (17%) | Partial exemption on first $200k |
| **JP** | SME Tiered (15% / 30.6%) | Effective combined rate logic |

**YTD Accrual Formula:**
$Tax_{m} = Tax(OP_{YTD, region}) - \sum_{i=1}^{m-1} Tax_{i}$

### 4.2. Operating Cash Flow Bridge (WC)
Working capital adjustments are snapshots of sales and cost velocity.

$$CFO = NetIncome + Depr - \Delta AR - \Delta Inv + \Delta AP + \Delta Accrued$$

- **AR (Receivables)**: $Revenue \times (Day_{ar} / 30)$
- **Inv (Inventory)**: $COGS_{mat,var} \times (Day_{inv} / 30)$
- **AP (Payables)**: $COGS_{mat,var} \times (Day_{ap} / 30)$
- **Accrued Exp**: $(Labor_{total} + SGA_{fixed}) \times (Day_{accrued} / 30)$

---

## 5. Value Driver Tree (VDT) Analysis
The VDT decomposes Operating Profit into tactical drivers. Sensitivity is calculated as the impact on OP for a 1% change in a specific driver.

- **ASP Sensitivity**: $\Delta OP = Revenue \times 0.01$
- **Volume Sensitivity**: $\Delta OP = (Revenue - VariableCost) \times 0.01$
- **Break-Even Point (Static):**
  $$Qty_{BEP} = \frac{Annual\_Fixed\_Cost}{Weighted\_Supply\_Price - Unit\_Var\_Cost}$$

## 6. Benchmark Diagnostics Engine (v4.2)

Advisory layer comparing the simulated pricing posture against industry benchmark
multipliers ($D$: default multiplier, $[L_{o}, H_{i}]$: acceptable range) from
`src/lib/constants/benchmarks.ts`. The effective multiplier follows the MSRP
precedence chain of §2.2:

$$M_{p} = Override_{plan,Y} \;\lor\; M_{target} \;\lor\; 5.0$$

### 6.1 Multiplier Gap Score
$$status(M_{p}) = \begin{cases} below & M_{p} < L_{o} \\ above & M_{p} > H_{i} \\ in\_range & otherwise \end{cases} \qquad Gap\% = \frac{M_{p} - D}{D} \times 100$$

### 6.2 Price Waterfall Realization (per Year $Y$)
Channel-weighted realization of list price captured as manufacturer revenue,
reusing $P_{S,c}$ from §2.2 and mix-ratio weights $w_{c} = Ratio_{mix}/\sum Ratio$:

$$Realization_{Y} = \frac{\sum_{c} P_{S,c} \times w_{c} \times Qty_{Y}}{\sum_{c} P_{MSRP,c} \times w_{c} \times Qty_{Y}} \qquad TakeRate_{c} = 1 - \frac{P_{S,c}}{P_{MSRP,c}}$$

Guard (GUA-04 extension): if the denominator is zero, $Realization := 1$ (neutral —
no observable leakage when no volume is priced).

### 6.3 Good/Better/Best Inversion Check
For any two products $i, j$ in the portfolio:

$$Violation(i,j) \iff Cost_{i} > Cost_{j} \;\land\; MSRP_{i} \le MSRP_{j}$$

where $Cost_{p}$ is the annualized unit cost (§3.1) at $Y=1$. All violating pairs are
reported (higher-cost product priced at or below a cheaper one).

### 6.4 Floor / Target / Stretch Corridor
Industry multiplier bounds form the defensible pricing corridor for each product:

$$Floor = Cost_{p} \times L_{o} \qquad Target = Cost_{p} \times M_{p} \qquad Stretch = Cost_{p} \times H_{i}$$

The corridor is ordered ($Floor \le Target \le Stretch$) exactly when §6.1 reports
`in_range`; `below`/`above` states mark the target outside the corridor.

### 6.5 Snapshot Comparison Tri-View
Two frozen scenarios ($A$, $B$) are re-simulated through the identical §2–§4 engine and
aggregated per year:

$$Cell_{s,Y} = \big(Revenue_{Y}, OP_{Y}, Qty_{Y}, Margin^{OP}_{Y}\big), \quad \Delta X_{Y} = \frac{X_{B,Y} - X_{A,Y}}{|X_{A,Y}|} \times 100$$

Aggregation is additive (revenue/profit/qty); margin recomputes from aggregates. When a
baseline cell is zero, its delta is reported as `null` (undefined percentage) rather than
infinity.

## 7. Van Westendorp PSM Engine (v4.2)

Input: per-respondent four thresholds $(T_{cheap}, T_{bargain}, T_{exp}, T_{tooExp})$,
$T_{cheap} < T_{bargain} < T_{exp} < T_{tooExp}$ (enforced at ingestion).

### 7.1 Cumulative Acceptance Curves
Evaluated on the candidate grid $G$ = sorted unique threshold values:

$$C_{\downarrow}(p)=\tfrac{\#\{i:\,T_{k,i}\ge p\}}{n}\ \text{(decreasing, } k\in\{cheap,bargain\}) \qquad C_{\uparrow}(p)=\tfrac{\#\{i:\,T_{k,i}\le p\}}{n}\ \text{(increasing, } k\in\{exp,tooExp\})$$

### 7.2 Intersection Points
With $D_{ab}(p)=C^{a}_{\downarrow}(p)-C^{b}_{\uparrow}(p)$, each point is the first
sign-change of its pair, linearly interpolated between surrounding grid points
(exact grid hit when $D=0$). **A crossing counts only where the rising cumulative
share is positive** — flat-zero plateaus beyond every respondent's threshold are
not intersections:

| Point | Pair | Meaning |
|---|---|---|
| **PMC** | $D_{cheap,\,exp}$ | Point of Marginal Cheapness (quality-suspicion floor) |
| **OPP** | $D_{bargain,\,exp}$ | Optimal Price Point |
| **IDP** | $D_{bargain,\,tooExp}$ | Indifference Price Point |
| **PME** | $D_{cheap,\,tooExp}$ | Point of Marginal Expensiveness |

### 7.3 Sanity Guards
- Canonical ordering: $PMC \le OPP \le PME$ and $OPP \le IDP$. (An $IDP \le PME$
  relationship is NOT guaranteed by the method and must not be enforced.)
- Violations produce a `VW-ORDER-VIOLATION` warn instead of silently reordering.
- Sample size $n < 5$ ⇒ `insufficient_sample` finding.

---

## 8. Gabor-Granger Demand Engine (v4.2)

Input: responses $(pricePoint_{j}, wouldBuy_{i})$ across a researcher-defined price set.

### 8.1 Demand & Revenue Curves
$$Q(p)=\frac{\#\{wouldBuy@\ p\}}{\#\{asked@\ p\}} \qquad R(p)=p\times Q(p)$$

### 8.2 Revenue-Maximizing Price and Elasticity
$$p^{*}=\arg\max_{p} R(p)$$

Arc elasticity between adjacent price points $(p_{a}<p_{b})$, midpoint method:

$$\varepsilon_{a,b}=\frac{\Delta Q / \bar{Q}}{\Delta P / \bar{P}},\quad \bar{Q}=\tfrac{Q_a+Q_b}{2},\ \bar{P}=\tfrac{P_a+P_b}{2}$$

Reported elasticity at the optimum uses the pair $(p^{-}, p^{*})$ — the nearest tested
price below $p^{*}$. Monotonic demand is NOT assumed; zero-respondent price points are
excluded with a `warn` finding.

## 9. Price Management & Pricing Terms (v4.3, Phase 3-F)

Two distinct tracks, deliberately separated:

- **PRICE track (가격 수준)** — WHAT the price is each month: consumer shelf
  multiplier paths (§9.2) built on the §2.2 MSRP chain.
- **PRICING track (프라이싱 조건·운영)** — terms and governance attached to
  transactions: wholesale discount stacks, caps, floors and settlement timing
  (§9.1), evaluated continuously through the §9.3 loop.

Persistence mirrors the split: `ConsumerPricePlan` (price track) and `TradeTerm`
(pricing/terms track).

### 9.1 PRICING track — Wholesale Trade-Terms Stack (Net Supply)

Policies are explicitly separated into two tracks and persisted accordingly:
**ConsumerPricePlan** holds price-track shelf paths; **TradeTerm** holds
pricing-track terms `{ kind, scope, params }` with settlement mode.

Monthly discount/rebate stack $r^{tot}_{m}$ = $\min\big(\sum_k r_k(m),\ 0.40\big)$ (hard
cap, `GUA-PW2` warn on cap hit):

$$P^{net}_{S,c,m} = \max\big(P_{S,c,m}\times(1-r^{tot}_{m}),\ Cost_{unit}\big)\quad\text{(GUA-PW1 margin floor)}$$

Kinds: `quantity_tier` ($r$ by monthly qty crossing tier steps), `revenue_rebate`
($r$ when YTD revenue ≥ threshold), `promotion_allowance` (fixed % during months).
**Timing split**: IS recognizes in month $m$; cash settles at
$m + L$ (`recognitionLagMonths`) — CFO bridge shifts the settlement leg only.

### 9.2 PRICE track — Consumer Monthly Shelf-Multiplier Path

With base multiplier $M_0$ (§2.2 precedence) and scope-resolved channels:

| Kind | Path |
|---|---|
| `edlp` | $M_m = M_0\ \forall m$ |
| `high_low` | $M_m = M_0\times(1-d_w)$ if $m\in W_w$ else $M_0$; overlapping windows take the **deepest** discount |
| `markdown` | $M_m = M_0\times\prod_{s:\,start_s\le m}(1-drop_s)$ — lifecycle-linked step-downs |
| `dynamic` | rule set on triggers (`demand_index`, `inventory_weeks`, `competitor_gap`) → $M_m=\mathrm{clamp}\!\left(M_{m-1}\times(1+\textstyle\sum adj),\ 0.7M_0,\ 1.3M_0\right)$ |

Conflicting consumer policies on an identical scope ⇒ configuration error.

**Policy injection (execution, cycle stage 7):** at save time each plan resolves
its path into **per-year shelf factors** $f_{p,Y}$ (year-average of the monthly path,
base 1.0). The effective multiplier becomes:

$$M_{eff}(p,Y)=M_{precedence}\times f_{p,Y}\qquad f\equiv 1\ \text{when unbound}$$

applied AFTER the reference-price override so the shelf factor shapes realized
pricing uniformly across channels. Unbound products are byte-identical to the
pre-injection engine (no-op invariant, tested).

### 9.3 Combined Double Waterfall & Analysis
Per month/channel: `List(M_m) → Shelf → ×supplyRate(+adj) → GrossSupply →
×(1−r_tot) → NetSupply`. Analysis freezes policies into
`ScenarioSnapshot.strategyParams`, re-simulates baseline vs policy scenario through
the identical engine, and reports the §6.5 tri-view plus per-month paths and KPIs
(avg selling price, realization, uplift %, promo-month margin erosion).

## 10. Trade-Line Economics: Partner P&L, Scorecard & Dual Pricing (v4.3)

### 10.1 Partner (Distributor/Retailer) P&L — portfolio per trade line
For a trade line carrying assortment $A$ in month $m$ (our net supply = their
purchase price; their shelf price from the Layer-2 consumer path):

$$Rev^{P}_{m}=\sum_{p\in A}S_{p,m}\,Qty_{p,m}\qquad GM^{P}_{m}=\sum_{p\in A}(S_{p,m}-P^{net}_{p,m})\,Qty_{p,m}$$
$$Profit^{P}_{m}=GM^{P}_{m}-\rho\cdot Rev^{P}_{m}\qquad(\rho:\text{partner opex ratio on shelf revenue})$$

Portfolio effect is inherent — the sum covers every product the line carries, so a
low-margin traffic driver can be offset by profitable mix partners.

### 10.2 Trade-Line Scorecard (A/B/C)
Over an evaluation window $W$, each raw component is max-normalized across the
competing trade lines ($\tilde{x}=x/\max x$):

$$Score=100\big(w_{rev}\widetilde{Rev}+w_{op}\widetilde{OpContribution}+w_{vol}\widetilde{Vol}+w_{ten}\tfrac{Tenure_{m}}{24}+w_{promo}\tfrac{PromoM_{W}}{12}\big)$$

Default weights $w=(0.30,\,0.25,\,0.15,\,0.15,\,0.15)$, $\sum w=1$. Grades:
**A ≥ 80**, **B ≥ 60**, else **C**. Zero-revenue lines score 0 on normalized terms
(no division guards needed beyond $\max x=0 \Rightarrow \tilde{x}=0$).

### 10.3 Domestic–Export Dual Pricing (Incoterms)
From the domestic net supply price $P^{net}_{dom}$ and unit cost $C_u$:

| Incoterm | Quote |
|---|---|
| EXW | $P^{net}_{dom}$ |
| FOB | $EXW + C_{inland+loading}$ |
| CIF | $FOB + C_{freight}^{intl} + C_{ins}$ |

Export VAT refund $R = v_{r}\cdot C_u$ (rate on the cost base) **adds** to margin;
the foreign-currency quote divides by the FX rate $f>0$:

$$P^{USD}_{term}=\frac{P_{term}+R}{f}\qquad Margin^{exp}_{\%}=\frac{P_{term}+R-C_u}{P_{term}+R}\times100$$

Domestic-vs-export comparison reports both margins on the shared $C_u$ base.

## 11. Promotion Analytics — TPM/TPO Measurement Loop (v4.3)

Evaluates a promotion event against the **counterfactual baseline** produced by a
no-promotion scenario snapshot (our simulator IS the causal-baseline generator —
matched-store designs are unnecessary here). The 8-week post-event window is
mandatory: pantry-loading must be netted before any ROI claim.

### 11.1 Incremental Revenue & Lift (event window $W$)
$$Inc_{W}=R^{promo}_{W}-R^{base}_{W}\qquad Lift_{\%}=\frac{Inc_{W}}{R^{base}_{W}}\times100\quad(R^{base}_{W}>0)$$

### 11.2 Post-Promo Dip Correction (default observation window = 8 weeks ≈ 2 months)
$$Deficit=\sum_{m\in P}\max\big(0,\ R^{base}_{m}-R^{promo}_{m}\big)\qquad Inc^{net}_{W}=Inc_{W}-Deficit$$

### 11.3 Brand-Level Correction (cannibalization)
When sibling-SKU deltas are supplied ($\Delta Sib$, negative = siblings lost sales):
$$Inc^{brand}_{W}=Inc^{net}_{W}+\Delta Sib$$

### 11.4 ROI / ROMI (contribution-rate basis)
$$ROI^{gross}=\frac{Inc_{W}\times c}{Spend}\qquad ROI^{net}=\frac{Inc^{net}_{W}\times c}{Spend}\qquad ROMI=ROI-1$$

$c$: contribution rate on promo-window revenue (promo-discounted prices already in
the paths). Hurdle policy: **2.0** per trade dollar (caller-configured; a net ROI > 2.5 triggers a PROMO-TOO-GOOD re-audit).

### 11.5 Outcome Classification
| Class | Evidence rule |
|---|---|
| `true_incremental` | $Inc^{net}_{W}>0$ ∧ post-dip ratio < 20% |
| `post_dip` | post-dip deficit ≥ 20% of $Inc_{W}$ |
| `forward_buying_suspected` | sell-in proxy rises while shelf path flat (input flag) |
| `insufficient_data` | $R^{base}_{W}=0$ or empty paths |

`VW`-style suspicion rule: net ROI > 2.5 ⇒ re-audit warning (`PROMO-TOO-GOOD`).

## 12. Cost Shock Sensitivity Engine (v4.3, Phase 3-E)

Raw-material price shocks (±% bands per material group) applied to the BOM cost
base; outputs a tornado ranking and margin-neutral repricing guidance. Pure
functions over explicit numbers — wiring into snapshots rides §6.5.

### 12.1 Shocked Unit Cost & Tornado Ranking
With shock $s_k$ on material $k$ (share $\omega_{k}=C_{k}/C_{u}$):

$$C'_{u}=C_{u}\times\Big(1+\textstyle\sum_{k}s_{k}\,\omega_{k}\Big)\qquad \Delta\Pi_{p}=Qty_{Y1}\times\big(\Pi_{0,p}-\Pi'_{0,p}\big)$$

$\Pi_{0}=P_{S}-C_{u}$ (per-unit profit at unchanged supply price). Tornado rows sort
products by $|\Delta\Pi|$ descending — the ranking answers "which product bleeds most".

### 12.2 Margin-Neutral Repricing
Two documented policies:

| Policy | Required supply uplift | Meaning |
|---|---|---|
| `absolute_profit` | $uplift=\dfrac{C'_{u}}{P_{S}}-1\;\Rightarrow\;P_{S}'=C'_{u}+\Pi_{0}$ | holds the original per-unit profit |
| `ratio_preserving` | $uplift=s^{tot}\cdot\omega_{COGS}$ | keeps margin % (cost-plus multiplier unchanged) |

Guard: uplift is reported, never auto-applied; GG elasticity (§8) decides feasibility.

### 12.3 FX Band Overlay (export path)
Export quotes (§10.3) re-evaluated at $f'=f\times(1+b)$ for band $b\in\{-0.2,-0.1,0.1,0.2\}$;
KPI = export-margin % shift vs neutral. Positive state-currency appreciation ($b>0$)
must reduce export margin — sign asserted in tests.

---
*Maintained by Agent Intelligence Group (AIG) v4.3 | Strategic Financial Intelligence*
