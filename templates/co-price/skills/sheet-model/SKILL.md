---
name: sheet-model
scope: co-price
description: Spreadsheet-style data modeling and scenario analysis
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: cpa-auditor
prerequisites: exported workbook plus engine output for the same state snapshot
---

# Financial Sheet Modeling Skill (`sheet-model`)

## 1. Description
Validation of advanced financial logic (P&L, IS, BS) and scenario analysis calculations.

## 2. Trigger Criteria
- "Model scenario"
- "Validate P&L math"
- "What-if analysis"

## 3. Allowed Tools
- `view_file`
- `run_command` (to execute vitest)

## 4. Behavior Rules
- Cross-validate the mathematical integrity of the `simulation.ts` engine based on Excel formulas.
- Simulate complex What-if scenarios (e.g., changes in operating profit due to exchange rate fluctuations).

## 5. Expected Output
Scenario validation reports or `simulation_v32.test.ts` suites.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Spreadsheet-style data modeling and scenario analysis** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `cpa-auditor`. See `variant.json` skills registry for the full co-price skill set.
