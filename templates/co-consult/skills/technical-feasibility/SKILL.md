---
name: technical-feasibility
description: >
  Guides the Solutions Architect through evaluating whether a proposed solution
  is technically implementable. Produces complexity grades, key risk factors with
  cost range estimates (lookup table format), and preconditions. Designed to
  iterate with financial-modeling (max 2 loops). Does NOT perform precise
  financial calculations — provides risk-grade cost range percentages only.
version: 1.0.0
status: active
owner: solutions-architect
prerequisites: none
---

## Context

Use in Phase 1 (early feasibility check) and Phase 3 (confirming solution viability). The outputs are mandatory inputs for financial-modeling. Maximum 2 iteration loops with financial-modeling are allowed before Engagement Leader escalates.

## When to Use

Invoke this skill when the Engagement Leader requires a technical viability check on a proposed solution, either as an early Phase 1 screen or as a Phase 3 confirmation prior to financial modeling.

## Execution Steps

1. **Solution Description**: Confirm the solution being evaluated (from Engagement Leader brief)
2. **Technology Readiness Assessment**:
   - Technology maturity level (proven / emerging / experimental)
   - Existing reference implementations in similar contexts
   - Vendor/open-source stability and support
3. **Integration Complexity Assessment**:
   - Number and complexity of integration points with existing systems
   - Data migration scope and risk
   - API availability and quality
4. **Organizational Capability Gap**:
   - Required technical skills vs. current team capabilities
   - Build vs. buy vs. partner decision
5. **Overall Complexity Grade**: Low / Medium / High (based on weighted assessment above)
6. **Risk Identification**: Document 3-5 key implementation risks. For each risk:
   - Risk description
   - Probability (H/M/L)
   - **Cost Range Estimate** (lookup table — do NOT calculate precisely):
     - Low complexity risk: +5-10% of implementation cost
     - Medium complexity risk: +15-25% of implementation cost
     - High complexity risk: +30-50% of implementation cost
   - Recommended mitigation
7. **Preconditions List**: What must be true before implementation can begin?
8. **Iteration Protocol**:
   - **Entry condition**: financial-modeling returns with budget constraint that requires technical option re-evaluation
   - **Max iterations**: 2 loops with financial-modeling
   - **Exit condition**: (1) cost range fits client budget, OR (2) Engagement Leader escalates to client after 2 loops

## Output Format

- Feasibility Summary: Solution, Overall Complexity Grade, Key Findings, Recommendation (proceed / proceed with conditions / do not proceed)
- Risk Register with Cost Range: Risk, Probability, Complexity Grade, Cost Range %, Mitigation
- Preconditions Checklist
- Handoff Note for financial-modeling: complexity grade + risk cost ranges + preconditions (formatted as financial-modeling inputs)

## Related Skills

- solution-design
- financial-modeling
- project-delivery
