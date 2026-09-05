---
name: excel-export
scope: co-price
description: Structured Excel workbook generation from engine data
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: core-engine-dev
prerequisites: simulation state loaded; Korean business-plan templates in src/templates
---

# Advanced Excel Export Skill (`anthropic-skills:xlsx`)

## 1. Description
Generates professional investor-grade Excel workbooks including cell styling, numeric formats (currency/%), column widths, and header highlighting.

## 2. Trigger Criteria
- "Export to Excel"
- "Create xlsx file"
- "Format workbook cells"

## 3. Allowed Tools
- `write_to_file`
- `replace_file_content`
- `run_command` (for bun add if sheetjs/xlsx missing)

## 4. Behavior Rules
- Use `xlsx-js-style` or standard `xlsx` library with style support.
- Apply industry-standard color conventions: Blue for Hardcoded inputs, Black for Formulas, Green for Links.
- Unify decimal points and use proper Accounting formats.

## 5. Expected Output
A fully formatted `.xlsx` file generated via TypeScript logic in `src/lib/export.ts`.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Structured Excel workbook generation from engine data** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `core-engine-dev`. See `variant.json` skills registry for the full co-price skill set.
