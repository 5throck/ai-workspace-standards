---
name: compensation-benchmarking
scope: co-hr
description: >
  Guides the Compensation & Benefits Analyst through job evaluation,
  market benchmarking, pay structure design, incentive plan design,
  benefits design, and pay equity checks. Use when: pay band design,
  market pricing, incentive/bonus plan design, benefits design, or
  pay equity analysis is required.
version: 1.0.0
last_reviewed: 2026-08-23
status: active
owner: compensation-benefits-analyst
prerequisites: none
relates_to:
  - skill: hr-metrics-analysis
    type: follows
  - skill: consulting-report-writing
    type: composes_with
  - skill: org-design-framework
    type: composes_with
  - skill: learning-curriculum-design
    type: follows
  - skill: performance-system-design
    type: composes_with
  - skill: stakeholder-alignment
    type: composes_with
  - skill: org-readiness-assessment
    type: composes_with
metadata:
  type: domain
  triggers:
    - compensation design
    - pay bands
    - market benchmarking
    - incentive plan
    - benefits design
    - pay equity
    - salary structure
---

## Context

Use in Phase 2-3 whenever an engagement requires designing or benchmarking compensation structures, incentive plans, or benefits. Owned by the Compensation & Benefits Analyst. Job leveling consumes `org-design-framework`'s job architecture output as input rather than re-deriving levels independently, and offer-readiness context arrives from `talent-acquisition-strategy`.

## When to Use

- When a job architecture needs to be evaluated/leveled for pay purposes
- When market benchmarking is requested for a role, family, or the whole org
- When pay bands, ranges, or midpoint progression need to be designed
- When an incentive plan (short-term or long-term) needs design or review
- When a benefits package needs design or review
- When any pay structure change requires a pay equity check before finalization

## Execution Steps

1. **Job Evaluation / Leveling**:
   - Consume the job architecture (job families, levels, role definitions) from `org-design-framework` as the input — do not build a parallel leveling scheme
   - Evaluate each role against compensable factors (scope, complexity, impact) to confirm or refine its level assignment
   - Flag any role whose job architecture leveling is missing or stale before proceeding to market pricing

2. **Market Benchmarking Methodology**:
   - Select peer group(s) and survey source(s) explicitly — cite the survey/source name and its publication year or period
   - Recency requirement: do not use a benchmark source older than what is reasonably current for the market in question; state the data's age plainly
   - Position each role at percentile targets (P25/P50/P75) against the selected market data
   - Never fabricate or estimate a market figure without a cited source — if no reliable benchmark exists for a role, state that explicitly rather than inventing one

3. **Pay Structure Design**:
   - Design pay bands per job family/level: minimum, midpoint, maximum
   - Define range spread and midpoint progression logic between adjacent levels
   - Cross-check band overlap and progression against the market positioning from Step 2

4. **Incentive Plan Design**:
   - Design short-term incentive (STI) and/or long-term incentive (LTI) plans as scoped
   - Define eligibility criteria, target/threshold/maximum payout levels, and the funding formula (what triggers and scales the pool)
   - State the linkage between plan metrics and organizational/individual performance measures (coordinate with `performance-system-design`'s merit-linkage output rather than inventing a separate rating-to-payout mapping)

5. **Benefits Package Design**:
   - Inventory benefit categories in scope (health, retirement, leave, perquisites) and design or benchmark each against the cited market source
   - Note any statutory/mandatory minimums separately from discretionary/competitive benefits

6. **Pay Equity Check**:
   - Before finalizing any pay structure, run a statistical check for pay gaps by gender and other relevant groups (e.g., regression-adjusted or cohort comparison — state the method used)
   - Report any statistically significant gap found, with magnitude and affected group, rather than omitting adverse findings
   - Do not finalize a pay structure recommendation until the equity check has been run and reported

## Output Format

- **Pay Structure / Band Table**: Job Family, Level, Min, Midpoint, Max, Range Spread
- **Market Positioning Summary**: Role/Family, Percentile Target, Cited Source (name + year), Notes
- **Incentive Plan Design Doc**: Plan Type, Eligibility, Payout Levels, Funding Formula, Performance Linkage
- **Pay Equity Check Report**: Method Used, Groups Compared, Findings (gap magnitude if any), Recommended Action

## Related Skills

- org-design-framework
- talent-acquisition-strategy
