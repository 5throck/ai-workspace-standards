# co-price Variant Execution Plan (v10.1)

> **Status**: Approved 2026-08-25 · **Owner**: pm · **Scope**: simulation → pricing consulting platform
> **Registration**: pending `spec-register.ts` (workspace root)

---

## 1. Why (Motivation)

The project has matured beyond a financial simulator (60-month double-entry
P&L engine, multi-channel pricing, BEP/VDT analytics, 16-locale L10N). The
sponsor requires:

1. **Workspace integration** — become a compliant `ai_workspace` variant.
2. **Consulting-grade capability** — real pricing advisory, not just simulation.

## 2. What (Approved Scope — v10.1)

| Phase | Deliverable |
|-------|-------------|
| P1 | Variant markers (`variant.json`, `_ORIGIN.md`, `_COMMON_VERSION.md`, `template-version.txt`), naming cleanup (`co-price`), **npm→bun migration**, user guides ×2 |
| P2 | Agent schema normalization (12) + golden 7-section migration; new agents `pricing-strategist`, `market-intelligence-analyst`, `engagement-director`; skill frontmatter (10); AGENTS/CLAUDE/GEMINI restructure; engagement lifecycle workflow |
| DB | Batch design (lead-architect): `ScenarioSnapshot`, `SurveyResponse`, `CompetitorPrice`, `TradeLine` (+market), `DiscountPolicy` + supplyRate migration |
| 3-A | Diagnostics engine: benchmark gap, price waterfall, G/B/B validation, Floor/Target/Stretch |
| 3-B | On-rails AI copilot: self-built multi-provider adapter (claude/gemini/codex/zai/deepseek, zero npm deps), fallback chain + circuit breaker, computation ledger + critic gate |
| 3-C | Scenario comparison (margin/revenue/volume tri-view), CSV import UI, PDF reports |
| 3-D | Van Westendorp PSM + Gabor-Granger modules |
| 3-E | Cost shock: sensitivity tornado, margin-neutral repricing, pass-through, FX bands |
| 3-F | Distribution trade-line mgmt: wholesale/retail tiers, partner P&L sim, scorecard, domestic–export dual pricing (Incoterms, VAT refund); **TWO-LAYER Pricing Strategy engine** (`DiscountPolicy` generalized to `PricingPolicy(layer)`): **Layer 1 Wholesale/B2B** — quantity tiers, revenue rebates, promotion allowances against the supply-price path (`P_S,c`) with deferred IS/CF timing; **Layer 2 Consumer/B2C** — EDLP baseline / High-Low promo cycles / lifecycle Markdown step-downs / rule-based Dynamic pricing shaping the per-channel consumer MSRP path; both channel-scoped (`scope: all \| channelIds[] \| tradeLineIds[]`), analyzed solo and combined via a double-waterfall (list → consumer promo → shelf → supply rate → trade discount → net supply) through the snapshot tri-view (`ScenarioSnapshot.strategyParams` JSON column) |

## 3. How (Architecture & Strategy)

- **Harness Engineering**: every formula lands in `docs/biz_logic.md`
  (LaTeX) → Vitest `[Ref:]` tests → mathjs implementation. No exceptions.
- **On-Rails Copilot**: LLM never computes. Engine outputs are ledgered
  (`calc_id`); critic blocks untraceable numbers; structured Zod outputs;
  certainty-language guard; human gate for client deliverables.
- **AI transport**: pure-`fetch` provider registry, per-provider
  `PRICE_{P}_API_KEY/MODEL/BASE_URL`, ordered failover via
  `PRICE_FALLBACK_PROVIDERS`, circuit breaker, deadline budgeting.
- **PR cadence**: #1 (P1) → #2 (P2) → #3 (3-A/B/C) → #4 (3-D/E) → #5 (3-F).
  Each PR passes: vitest full suite + i18n-audit (16 locales) +
  security-auditor review.

## 4. Folder Structure (delta)

```
src/lib/engine/{diagnostics,sensitivity,partner-pnl,discounts,vw-gg,export-pricing}.ts
src/lib/ai/{providers,circuit,ledger,critic,stream,types}.ts
src/app/api/copilot/chat/route.ts
prisma/schema.prisma            # +5 models
skills/<9 new>/SKILL.md
agents/{pricing-strategist,market-intelligence-analyst,engagement-director}.md
docs/user-guide{,_ko}.md
```

## 5. Non-Negotiables

- No floating-point drift (mathjs wrappers for currency only).
- Secrets never committed; `PRICE_*` keys live in `.env.local`.
- PR-only to `main`; audit gate must exit 0.
- All user-facing strings land in all 16 locales simultaneously.

## 6. Roadmap Backlog (recorded, not scheduled)

External market-price auto-ingestion (web scraping / price APIs).
