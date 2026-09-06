---
name: math-function-plotter
scope: co-price
description: Mathematical function visualization for pricing curves
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: core-engine-dev
prerequisites: formula section anchor in docs/biz_logic.md
---

# Math Formula Visualization (`math-function-plotter-plotly`)

## 1. Description
Visualizing correlations between business metrics and creating interactive graphs.

## 2. Trigger Criteria
- "Plot BEP"
- "Visualize function"
- "Create cost threshold graph"

## 3. Allowed Tools
- `write_to_file`
- `replace_file_content`

## 4. Behavior Rules
- Use React visualization libraries (e.g., Recharts, Plotly) to visually report Break-Even Point (BEP) curves or changes in margin rates relative to sales volume.
- Ensure graphs are interactive and visually clear.

## 5. Expected Output
A React component (`.tsx`) rendering the mathematical function accurately.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Mathematical function visualization for pricing curves** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `core-engine-dev`. See `variant.json` skills registry for the full co-price skill set.
