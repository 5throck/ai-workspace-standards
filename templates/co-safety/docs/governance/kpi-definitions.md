# Safety Governance KPI Definitions

Owner: `safety-governance-manager` (SGM). Referenced by `agents/safety-governance-manager.md`
§Responsibilities ("Define compliance KPI targets aligned with regulatory requirements") and
`docs/_meta/blueprint/03-governance.md`. Previously undefined — this file establishes the
initial KPI set; SGM should extend it as new industry profiles and workflows are added.

## 1. LTIFR — Lost Time Injury Frequency Rate

- **Formula**: `(Number of lost-time injuries × 1,000,000) / Total hours worked`
- **Data source**: `memory/incidents/` (incident records with `sapa_qualifying`/severity
  fields) aggregated over the reporting period. Requires `memory/incidents/` to be
  populated by `emergency-agent` and `incident-investigation-agent` per their existing
  workflow patterns.
- **Target threshold**: < 1.0 (industry-typical target for manufacturing/chemical sites;
  SGM should calibrate per selected industry profile in `industry-profiles/`).
- **Reporting cadence**: Monthly, rolled up quarterly for CSO review.
- **Escalation**: Any month where LTIFR exceeds 2× the target triggers an SGM policy
  review per `agents/safety-governance-manager.md` Core Workflow.

## 2. Audit Pass Rate

- **Formula**: `(bun scripts/safety-audit.ts total files checked − errors found) / total files checked × 100%`
- **Data source**: `scripts/safety-audit.ts` output (see `scripts/SCRIPTS.md` for version
  history). Each CI/local run's error count and total-checked count should be logged to
  `memory/YYYY-MM-DD.md` for trend tracking.
- **Target threshold**: 100% (0 errors) — this is a hard compliance gate, not an
  aspirational target; the CSO mandate requires 0 missing/insufficient `legal_basis`
  fields at all times.
- **Reporting cadence**: Every audit run; SGM reviews the trend monthly.
- **Escalation**: Any run with ≥3 errors triggers a `project-review` per the T-03 QA
  escalation trigger (`skills/project-review/SKILL.md`).

## 3. Corrective Action Closure Rate

- **Formula**: `(Corrective actions with status "completed"/"verified") / (Total corrective actions issued in period) × 100%`
- **Data source**: `memory/corrective-actions/*.json` records conforming to
  `evidence-models/_shared/base/corrective-action.schema.json`.
- **Target threshold**: ≥ 90% closed within their `due_date`.
- **Reporting cadence**: Monthly.
- **Escalation**: Any corrective action overdue by 30+ days is escalated per
  `agents/_shared/audit-agent.md` §Escalation Thresholds.

## 4. TRIR — Total Recordable Incident Rate

- **Formula**: `(Recordable incidents × 200,000) / Total hours worked` (200,000 =
  base hours for 100 full-time employees working 40 hours/week, 50 weeks/year,
  per `agents/_shared/reporting-agent.md` §KPI Formulas)
- **Data source**: `memory/incidents/` (recordable-incident records aggregated over
  the reporting period, ingested by `agents/_shared/reporting-agent.md`). **Baseline
  not measurable yet** — `memory/incidents/` is currently empty.
- **Target threshold**: At or below the published industry average for the active
  profile in `industry-profiles/` (numeric value calibrated by SGM per profile).
- **Reporting cadence**: Monthly, rolled up quarterly for CSO review.
- **Escalation**: Escalate to PM if TRIR exceeds the industry average by ≥ 20%
  (mirrors `agents/_shared/reporting-agent.md` §Escalation Triggers).

## 5. LTIR — Lost Time Incident Rate

- **Formula**: `(Lost-time incidents × 200,000) / Total hours worked`
- **Data source**: `memory/incidents/` (lost-time incident records with
  `sapa_qualifying`/severity fields). **Baseline not measurable yet** —
  `memory/incidents/` is currently empty.
- **Target threshold**: ≤ 1.0 (default annual target; configurable per site — see
  [Annual Targets](#annual-targets) below).
- **Reporting cadence**: Monthly, rolled up quarterly for CSO review.
- **Escalation**: Any period where LTIR exceeds 1.0 escalates to SGM per
  `agents/_shared/reporting-agent.md` §Escalation Triggers; SGM responds via its
  Core Workflow policy-review path.

## 6. Near-Miss Reporting Rate

- **Formula**: Frequency form `(Near-miss reports × 200,000) / Total hours worked`;
  also tracked in leading-indicator form as reports per 100 workers per month
  (both expressions appear in `agents/_shared/reporting-agent.md` §Section B).
- **Data source**: Near-miss logs under `memory/` ingested by
  `agents/_shared/reporting-agent.md` §Operational Procedures. **Baseline not
  measurable yet** — no near-miss records exist.
- **Target threshold**: ≥ 5 reports per 100 workers per month (leading-indicator
  floor; higher is better — this KPI measures reporting culture, not harm).
- **Reporting cadence**: Monthly, rolled up quarterly for CSO review.
- **Escalation**: Two consecutive months below the floor escalates to SGM for a
  reporting-culture intervention (training, simplified intake via TBM outputs).

## Normalization Note — Dual Incident-Rate Bases

This catalog intentionally keeps both hour bases: LTIFR uses the 1,000,000-hour
base (international/KOSHA benchmarking convention) while TRIR/LTIR use the
200,000-hour base (OSHA-US convention), because `agents/_shared/reporting-agent.md`
computes all of its targets and escalation triggers exclusively on the 200,000-hour
basis; the two are never numerically comparable — convert with
`rate(1M-hr) = rate(200k-hr) × 5` before any cross-benchmark use.

## Annual Targets

Targets owned by SGM and consumed by `agents/_shared/reporting-agent.md`
§Operational Procedures step 3 ("Compare KPIs against annual targets"):

| Metric | Annual Target | Compliant Direction |
|--------|---------------|---------------------|
| LTIR | ≤ 1.0 (default; configurable per site) | at-or-below |
| TRIR | ≤ industry average for active profile | at-or-below |
| Near-Miss Reporting Rate | ≥ 5 reports / 100 workers / month | at-or-above |
| Audit Pass Rate | 100% (hard compliance gate) | at-or-above |
| Corrective Action Closure Rate | ≥ 90% within `due_date` | at-or-above |
| SAPA-Qualifying Incident Count | 0 | zero-tolerance |

All incident-rate baselines are **not measurable yet** until `memory/incidents/`
begins receiving records from `emergency-agent` and `incident-investigation-agent`;
targets take effect as monitoring thresholds, not performance verdicts, during the
baseline period. SGM re-approves these targets annually per the OSHA-KR Article 15 /
SAPA goal-setting obligations cited in its Section A legal basis.

### SAPA Compliance Metrics

Anchored to the `sapa_qualifying` boolean evidence-field convention shared by all
eight emergency record schemas (e.g.
`evidence-models/emergency/emergency-medical-record.json:35`,
`evidence-models/emergency/emergency-fire-response-record.json:35` —
`"sapa_qualifying": { "type": "boolean", "description": "중대재해처벌법 적용 여부" }`):

- **SAPA-Qualifying Incident Count** — count of incident records in
  `memory/incidents/` with `sapa_qualifying: true`.
  - **Target threshold**: 0 per annual period (zero-tolerance).
  - **Reporting cadence**: Monthly, rolled up quarterly for CSO review.
  - **Escalation**: Any single SAPA-qualifying incident triggers the
    `emergency-response` workflow and an immediate SGM policy review.
  - **Baseline**: Not measurable yet — `memory/incidents/` is currently empty.
- **`sapa_qualifying` Field Completeness** — percentage of incident records that
  carry a populated `sapa_qualifying` boolean per the schema convention above.
  - **Target threshold**: 100%.
  - **Reporting cadence**: Monthly.
  - **Escalation**: Any conformant record omitting the field escalates to
    `agents/_shared/audit-agent.md` as an evidence-integrity defect.

## Future KPIs (not yet instrumented)

- Training compliance rate (% of workers with current certifications) — data source
  `evidence-models/domains/functional/training/training-compliance-record.json`,
  pending the automated expiry-scan script noted in the Training & Operations domain
  review (2026-07-11).
- Contractor safety onboarding completion rate.

SGM should extend this file as new KPIs are approved, and link approved policies in
`policies/` back to the KPI(s) they are intended to move.
