---
name: financial-statement-prep
scope: co-price
description: Financial statement preparation and formatting
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: finance-strategy-lead
prerequisites: statement schema defined in docs/biz_logic.md and docs/erd.md
relates_to:
  - skill: harness-verification
    type: composes_with
  - skill: i18n-audit
    type: composes_with
  - skill: pricing-playbook
    type: follows
  - skill: scenario-comparison
    type: composes_with
  - skill: prisma-7
    type: composes_with
  - skill: harness-verification
    type: follows
---

# Financial Statement Preparation Skill (`finance:financial-statements`)

## 1. Description
Guidance on IS (Income Statement), BS (Balance Sheet), and CFS (Cash Flow Statement) structures based on GAAP/IFRS, and Period-over-Period (PoP) comparison.

## 2. Trigger Criteria
- "Format Balance Sheet"
- "Review Income Statement structure"
- "Build Cash Flow Statement"

## 3. Allowed Tools
- `view_file` (to read `src/components/dashboard/FinancialReportTab.tsx`)
- `replace_file_content`

## 4. Behavior Rules
- Validate calculation results according to international accounting standards (ASC 220/210/230).
- Standardize the item structure and display order (e.g., Current Assets before Non-Current Assets).

## 5. Expected Output
Correctly structured financial reporting components and strict TS typings.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Financial statement preparation and formatting** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `finance-strategy-lead`. See `variant.json` skills registry for the full co-price skill set.
