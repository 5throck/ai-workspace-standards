---
name: hr-metrics-analysis
scope: co-hr
description: >
  Guides the HR Data Analyst through defining reproducible HR metrics,
  labeling causal driver hypotheses, specifying dashboards, and applying
  benchmarking guardrails. Use when: workforce statistics analysis,
  turnover/conversion analysis, labor-cost analysis, or HR dashboard/people-analytics
  work is required.
version: 1.0.1
last_reviewed: 2026-08-25
status: active
owner: data-analyst
prerequisites: none
metadata:
  type: domain
  triggers:
    - workforce statistics
    - turnover analysis
    - hiring conversion
    - labor cost analysis
    - HR dashboard
    - people analytics
    - HR metrics
---

## Context

Use in Phase 1 (baseline diagnosis) and Phase 3 (impact measurement) whenever an engagement requires quantitative workforce analysis. Owned by the HR Data Analyst. Headcount and workforce data produced here feeds `org-design-framework`'s headcount/workforce planning work.

## When to Use

- When establishing a baseline workforce statistics report
- When analyzing turnover, hiring conversion, or labor-cost trends
- When leadership requests an HR dashboard or people-analytics capability
- When measuring the impact of a change or HR program after rollout

## Execution Steps

1. **Define the Standard HR Metric Set**: For each metric in scope, record an explicit formula/definition so results are reproducible:
   - Turnover rate — voluntary/involuntary split (formula: separations in period ÷ average headcount in period, per split)
   - Time-to-fill (formula: days from requisition open to offer accept, median and average)
   - Offer-acceptance rate (formula: offers accepted ÷ offers extended)
   - Cost-per-hire (formula: (external + internal recruiting costs) ÷ number of hires)
   - Labor cost ratio (formula: total labor cost ÷ total revenue or total operating cost, state which denominator is used)
   - Span of control (formula: average direct reports per manager, by level)
   - Engagement/eNPS (only if survey data is available — state the survey instrument and response rate)

   Record each in-scope metric as an entry in the engagement's metric dictionary (schema: [`docs/metric-dictionary-schema.json`](../../docs/metric-dictionary-schema.json)) - the dictionary is the durable form of this step's definitions.

2. **Driver Hypothesis Labeling**: Any causal claim about *why* a metric moved must be explicitly labeled "Hypothesis" (not stated as fact) unless it has been statistically validated (e.g., via cohort comparison or regression with disclosed method). Never present an unvalidated causal narrative as a finding.

3. **Dashboard Specification Design**: For each metric intended for a recurring dashboard, define:
   - Metric name and formula (reference Step 1)
   - Data source (system of record)
   - Refresh cadence (real-time / daily / weekly / monthly)
   - Owner (who is accountable for data quality and refresh)

   Pull formula, data source, refresh cadence, and owner from the metric dictionary (Step 1) rather than restating them.

4. **Benchmarking Guardrail**: When comparing any internal metric to an external/industry benchmark:
   - Cite the benchmark source by name
   - State its recency (publication year/period)
   - Never fabricate or estimate an industry figure without a cited source — if no reliable benchmark is available, state that explicitly rather than inventing one

5. **Report Assembly**: Combine methodology (definitions used, data window, exclusions) with findings (metric values, trend direction, labeled hypotheses) into the workforce statistics report.

## Output Format

- **Workforce Statistics Report**: Methodology section (definitions, data window, exclusions) + Findings section (metric values, trends, hypothesis-labeled drivers)
- **Metric Definition Glossary**: Metric, Formula, Data Source, Notes
- **Dashboard Spec Table**: Metric, Data Source, Refresh Cadence, Owner

## Related Skills

- org-design-framework
- consulting-report-writing
