---
name: executive-presentation
scope: co-price
description: C-level presentation and decision deck design
version: "1.0.0"
last_reviewed: 2026-08-25
status: active
owner: ux-specialist
prerequisites: engagement-director approval entry; all figures ledger-cited
relates_to:
  - skill: harness-verification
    type: follows
---

# Executive Presentation Skill

## Purpose
Shape approved analysis into the C-level artifact: one page of decisions, not a
data dump. Pairs with the H-3 print pipeline (`window.print()` → PDF).

## Report Skeleton (A4 portrait)
1. **Decision header** — objective restated from cycle stage 0 + the ask.
2. **KPI strip** — revenue / OP margin / units / realization (ledger-cited).
3. **Tri-view table** — baseline vs policy by year with Δ% (from scenario-comparison).
4. **Diagnosis highlights** — segment CPI extremes, GTN band, WTP corridor.
5. **Recommendations** — diagnostic register only; reversal conditions attached.
6. **Disclaimers** — mandatory block (advisory nature, assumptions, data vintage).

## Rules
- Figures ONLY from computation-ledger ids; unverifiable numbers block delivery.
- Bilingual titles/labels from locale keys — never hardcode strings.
- Print pipeline output must pass the `@media print` white-background rules;
  dark-theme screenshots are NOT acceptable deliverables.

## Boundaries
- No new analysis in this layer — packaging of approved artifacts only.
- Client-facing copy requires engagement-director approval entry (who/when).
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **C-level presentation and decision deck design** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `ux-specialist`. See `variant.json` skills registry for the full co-price skill set.
