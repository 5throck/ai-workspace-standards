---
name: financial-modeling
scope: co-consult
description: >
  Guides the Strategy Analyst through building a full business case for consulting
  recommendations. Covers ROI analysis, NPV/IRR/Payback Period calculation,
  scenario sensitivity analysis, and explicitly includes change management cost
  category. Designed to work iteratively with technical-feasibility (max 2 loops).
version: 1.0.0
last_reviewed: 2026-06-13
status: active
owner: strategy-analyst
prerequisites: technical-feasibility, org-readiness-assessment
---

## Context

Use in Phase 1-2 after technical-feasibility and org-readiness-assessment have produced outputs. Converts complexity grades and risk factors into a complete financial business case for client decision-making.

## When to Use

- Building investment justification for a recommended solution
- Comparing financial impact of multiple strategic options
- Presenting business case to C-level stakeholders

## Execution Steps

1. **Gather Inputs**:
   - Solution definition (from Engagement Leader brief)
   - `technical-feasibility` outputs: complexity grade, risk cost range lookup values, preconditions
   - `org-readiness-assessment` outputs: change management cost estimates, training requirements
2. **Build Cost Model**:
   - Implementation costs (use technical-feasibility complexity grade as basis)
   - Change management costs (explicitly include — sourced from org-readiness-assessment):
     - Training and capability building
     - Change agent resourcing
     - Schedule delay buffer for resistance
   - Ongoing operational costs (year 1-3)
   - Risk contingency (apply technical-feasibility cost range percentages)
3. **Build Benefit Model**:
   - Revenue uplift (quantified where possible)
   - Cost reduction / efficiency gains
   - Risk mitigation value
4. **Financial Metrics**: Calculate NPV, IRR, Payback Period, ROI
5. **Scenario Analysis**:
   - Base case, optimistic, pessimistic
   - Sensitivity table: top 3 variables that most impact NPV
6. **Iteration Protocol**:
   - **Entry condition**: Budget constraint confirmed mismatched with cost model
   - **Max iterations**: 2 loops with technical-feasibility
   - **Exit condition**: Cost range fits client budget OR Engagement Leader escalates to client after loop 2
7. **Output**: Pass complete business case to `executive-presentation`

## Output Format

- Business Case Document: Executive Summary, Investment Overview, Cost Breakdown (incl. change management), Benefit Projections, NPV/IRR/Payback, Scenario Analysis, Recommendation
- Excel-compatible data table for sensitivity analysis

## Related Skills

- technical-feasibility
- org-readiness-assessment
- insight-synthesis
- executive-presentation
