---
lang: ko
lang_reason: proper-noun
description: Run the Commercial Operating Cycle (8-step closed loop) for a stated objective
allowed-tools: Read, Grep, Glob, Task
---

# Commercial Operating Cycle — objective: $ARGUMENTS

You are the PM (Pricing Consulting Orchestrator). Execute the 8-step closed loop
defined in `docs/co-price.context.md → Commercial Operating Cycle`, with gates from
`AGENTS.md → Commercial Operating Cycle gates`.

## Rules

- Objective and budget cap come from the arguments above (stage 0). If a budget cap
  is absent, ask the user before proceeding.
- Each stage ends with its gate artifact recorded in `memory/` and a one-line status
  to the user. Do NOT advance without the gate.
- Dispatch ONLY through the flat PM Gateway (`AGENTS.md → Dispatch Protocol`);
  write-capable agents are serial, research agents read-only.
- Stage 6 requires an explicit user approval of the snapshot tri-view.
- Stage 8 output MUST be summarized as inputs for stages 0–2 of the next cycle.

## Stage checklist

0. 목표·제약 — record objective/budget; declare success KPIs.
1. 진단 — dispatch `market-intelligence-analyst`: segment structure, competitive
   intensity (CompetitorPrice), WTP (van-westendorp-psm / gabor-granger), GTN band.
2. 선정 — dispatch `pricing-strategist`: re-score trade lines
   (partner-pnl.scoreTradeLines), pick portfolio.
3. 배분 — allocate volume/mix across trade lines; verify capacity & mixRatio via
   `core-engine-dev`.
4. Terms 설계 — dispatch `finance-strategy-lead`: TradeTerm drafts
   (quantity_tier / revenue_rebate / promotion_allowance + settlement mode).
5. Price 경로 설계 — ConsumerPricePlan drafts (EDLP / High-Low / Markdown /
   Dynamic / Skim / Penetrate …), channel-scoped.
6. 검증 — freeze baseline+policy snapshots, run compareSnapshotsAction,
   present tri-view; WAIT for user approval (cpa-auditor cross-checks figures).
7. 집행 — activate approved policies (settlement modes set); note sell-in ≠ sell-out.
8. 평가 — after the agreed window (+8-week post-promo dip check): netROI,
   outcome classification (True Incremental / Forward Buying / Cannibalization),
   scorecard re-grade; write the review memo that seeds the next cycle's stages 0–2.

Begin at stage 0 now. Summarize each gate crossing in one line.
