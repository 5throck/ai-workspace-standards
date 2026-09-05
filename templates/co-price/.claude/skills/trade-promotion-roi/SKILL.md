---
name: trade-promotion-roi
scope: co-price
description: Trade promotion ROI evaluation with netROI gate
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: market-intelligence-analyst
prerequisites: two snapshots (no-promotion baseline vs promoted) re-simulated; spendByMonth actuals reconciled to deductions
---

# Trade Promotion ROI Skill (Cycle Stage 8 → next 0–2)

## Purpose
Close the TPM/TPO loop with honest numbers: gross ROI flatters by 30%+ when the
post-promo dip, cannibalization and forward-buying are ignored. This skill produces
the **net** figures and the outcome classification that drive repeat-or-kill decisions.

## Procedure
1. **Freeze the pair** — baseline = no-promotion snapshot; policy = promoted
   snapshot. Re-simulate both through the live engine (never reuse stale results).
2. **Reconcile spend** — match every deduction (scan-downs, bill-backs, display
   fees) to the event; `spendByMonth` must reflect ACTUALS, not planned budget.
3. **Evaluate** — `evaluatePromotionEvent({ baselinePath, promoPath,
    windowMonths, postWindowMonths: 2, spendByMonth, contributionRate,
   siblingDeltaRevenue?, sellInSpikeWithoutSellOut? })`.
   - Scan-down structure note: allowance is paid on ALL window units, so include
     it in `spendByMonth` across the full window, not only incremental units.
   - Incremental COGS applies to incremental units only — handled via the
     contribution-rate basis on promo-window revenue.
4. **Classify & prescribe** — per §11.5:
   | Outcome | Next action |
   |---|---|
    | true_incremental | repeat at same/adjusted depth if ROI ≥ hurdle (2.0) |
   | forward_buying_suspected | shorten window, shift to scan-based mechanics |
   | cannibalization-corrected | portfolio calendar re-plan, SKU swap |
   | insufficient_data | fix measurement before spending again |
5. **Hand off** — ledger-register every figure; route the memo through
   `insight-synthesis` for the next-cycle direction.

## Boundaries
- Net ROI > 2.5 ⇒ re-audit the baseline before celebrating (`PROMO-TOO-GOOD`).
- Sell-in ≠ sell-out: shipment spikes are not consumer demand.
- The repeat-or-kill decision itself belongs to humans (engagement-director gate).
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Trade promotion ROI evaluation with netROI gate** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `market-intelligence-analyst`. See `variant.json` skills registry for the full co-price skill set.
