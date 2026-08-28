# pbrer-generation Workflow

## 1. Objective
Generate Periodic Benefit-Risk Evaluation Report per ICH E2C(R2) annually.

## 2. PBRER Structure
- Executive summary
- Intro: marketing authorization, indication
- Safety data summary (ICSR counts, signal status)
- Cumulative safety review by SOC
- Risk characterization
- Benefit evaluation
- Integrated benefit-risk assessment
- Conclusions and actions

## 3. Workflow Steps
1. **Data compilation**: ICSR database query for reporting period.
2. **Statistical analysis**: Signal detection, trend analysis.
3. **Benefit assessment**: Efficacy data review.
4. **Risk assessment**: New signals, ADR trends.
5. **Integrated B/R**: Apply `skills/domains/gvp/benefit-risk-assessor/`.
6. **Author PBRER**: Per ICH E2C(R2) structure.
7. **MFDS submission**: Annual deadline.

## 4. Evidence Record
Generate `gvp-pbrer-record.json` with `pbrer_cycle_ref` field.
