# ISO 30414 Metrics Mapping for co-hr

> **Purpose**: Map the `hr-metrics-analysis` skill's standard metrics onto the ISO 30414:2018 Human Capital Reporting taxonomy, extending coverage from 7 metrics to a full 11-area framework. This turns internally consistent HR dashboards into externally comparable human-capital reports.  
> **Scope**: All HR metrics defined in the `hr-metrics-analysis` skill and the extension metrics specified below.  
> **Reference**: ISO 30414:2018 (Human resource management — Guidelines for internal and external human capital reporting).

---

## Attribution

ISO 30414:2018 is a paid international standard. This document paraphrases its 11 reporting areas and maps workspace-formulated metrics to those areas. The metric definitions and formulas below are the workspace's own formulations aligned to the ISO areas — they do NOT reproduce the standard's text. For the full standard definitions and guidelines, consult the official ISO 30414:2018 publication via ISO.org.

**ISO 30414:2018 — 11 Reporting Areas** (publicly documented in abstracts and summaries):

1. Compliance and ethics
2. Costs
3. Diversity
4. Leadership
5. Organizational culture
6. Organizational availability (safety and health capacity)
7. Professional competence and development
8. Recruitment, mobility and turnover
9. Succession and work continuity
10. Workforce availability (headcounts and demographics)
11. Workforce health, well-being and satisfaction

---

## Coverage Map

| ISO 30414 Reporting Area | Current Skill Metric | Coverage Status | Extending Metric Defined Below |
|--------------------------|----------------------|-----------------|-------------------------------|
| Compliance and ethics | — | **Gap** | Ethics incidents per 100 employees; % workforce completing ethics training |
| Costs | Labor cost ratio | **Covered** | Total labor cost per FTE; labor cost breakdown by component |
| Diversity | — | **Gap** | Workforce diversity ratios by category and level; management composition ratio |
| Leadership | Span of control | **Partial** | Leadership effectiveness index; average leader tenure |
| Organizational culture | — | **Gap** | Culture survey participation rate; open feedback rate |
| Organizational availability | — | **Gap** | Absenteeism rate; work-related injury rate (per 200k hours); H&S training completion |
| Professional competence and development | — | **Gap** | Training hours per employee; development investment per employee; % roles with defined competency profile |
| Recruitment, mobility and turnover | Turnover rate (voluntary/involuntary), Time-to-fill, Offer-acceptance rate, Cost-per-hire | **Covered** | Internal mobility rate; quality-of-fill (1-year retention of new hires) |
| Succession and work continuity | — | **Gap** | Succession coverage ratio; % critical roles with successor identified |
| Workforce availability | — | **Gap** | Total headcount by contract type; demographic age-band distribution; part-time/temporary ratio |
| Workforce health, well-being and satisfaction | Engagement/eNPS | **Partial** | Survey participation rate; fatigue/burnout indicator (if surveyable) |

**Coverage Summary**: 2 areas Covered (18%), 2 areas Partial (18%), 7 areas Gap (64%). Extension metrics defined below bring full coverage to all 11 areas.

---

## Per-Area Metrics

### 1. Compliance and Ethics

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Ethics incidents per 100 employees | `(Number of reported ethics violations ÷ average headcount) × 100` | Compliance incident log; exclude trivial policy misunderstandings | `labor-compliance-analyst` | Count only substantiated violations after investigation |
| % workforce completing ethics training | `(Employees completing ethics training in period ÷ total headcount) × 100%` | LMS training completion records | `labor-compliance-analyst` | Annual training; report by department if available |

### 2. Costs

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Labor cost ratio (existing) | `Total labor cost ÷ total revenue` OR `Total labor cost ÷ total operating cost` | Financial statements; state denominator used | `compensation-benefits-analyst` | See skill Step 1 for definition |
| Total labor cost per FTE | `Total labor cost ÷ total full-time equivalent headcount` | Payroll system + financial statements | `compensation-benefits-analyst` | FTE calculation: full-time = 1.0, part-time prorated by hours |
| Labor cost breakdown by component | `Component cost (salaries/benefits/contractors) ÷ total labor cost` | Payroll system cost center allocation | `compensation-benefits-analyst` | Report as % of total; track trends over periods |

### 3. Diversity

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Workforce diversity ratios by category and level | `(Count in demographic category at level ÷ total headcount at level) × 100%` | HRIS demographic fields (gender, age, nationality, etc.) | `change-management-partner` | Report by organizational level (executive/manager/individual contributor) |
| Management composition ratio | `(Count in demographic category in management roles ÷ total management headcount) × 100%` | HRIS job classification × demographic fields | `change-management-partner` | Management = supervisor level and above; compare to workforce composition |

### 4. Leadership

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Span of control (existing, Partial) | `Total direct reports ÷ number of managers` | HRIS organizational structure reporting relationships | `org-design-consultant` | Average by level; see skill for definition |
| Leadership effectiveness index | `Average score on leadership competency assessment` | 360-degree feedback or leadership survey results | `org-design-consultant` | Use validated instrument; report distribution (high/medium/low) |
| Average leader tenure | `Sum of (leader tenure in role) ÷ number of leaders` | HRIS hire/promotion dates in current role | `org-design-consultant` | Report by level; watch for outliers skewing average |

### 5. Organizational Culture

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Culture survey participation rate | `(Survey responses ÷ employees surveyed) × 100%` | Culture survey platform distribution/response counts | `change-management-partner` | Target ≥70% for representativeness |
| Open feedback rate | `(Number of open feedback submissions ÷ total feedback instances) × 100%` | Internal communication channels (town halls, suggestion platforms, anonymous reporting) | `change-management-partner` | Define "open feedback" mechanism before measuring |

### 6. Organizational Availability (Safety & Health Capacity)

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Absenteeism rate | `(Total absent days ÷ (total workdays scheduled × headcount)) × 100%` | Time and attendance system; exclude approved leave | `safety-health-officer` | Report by department if patterns emerge |
| Work-related injury rate (per 200k hours) | `(Number of recordable injuries ÷ total hours worked) × 200,000` | Safety incident log; OSHA 300-log equivalent | `safety-health-officer` | Standard benchmark denominator for comparability |
| H&S training completion | `(Employees completing H&S training ÷ total headcount) × 100%` | LMS safety training completion records | `safety-health-officer` | Mandatory safety training; report by role category |

### 7. Professional Competence and Development

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Training hours per employee | `Total training hours delivered ÷ total headcount` | LMS training hours consumption report | `learning-development-specialist` | Exclude compliance-only training from development hours |
| Development investment per employee | `Total development budget ÷ total headcount` | Learning & development budget actuals | `learning-development-specialist` | Include external programs, internal facilitators, materials |
| % roles with defined competency profile | `(Roles with competency profile documented ÷ total roles in organization) × 100%` | HRIS job family catalog × competency model documentation | `learning-development-specialist` | Count roles, not positions (one role can have many positions) |

### 8. Recruitment, Mobility and Turnover

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Turnover rate — voluntary/involuntary split (existing) | `(Separations in period ÷ average headcount in period)` per split | HRIS termination records with reason code | `talent-acquisition-specialist` | See skill Step 1 for definition |
| Time-to-fill (existing) | `Days from requisition open to offer accepted` (median and average) | ATS requisition timestamps | `talent-acquisition-specialist` | See skill Step 1 for definition |
| Offer-acceptance rate (existing) | `Offers accepted ÷ offers extended` | ATS offer disposition tracking | `talent-acquisition-specialist` | See skill Step 1 for definition |
| Cost-per-hire (existing) | `(External + internal recruiting costs) ÷ number of hires` | Recruiting cost center + ATS hire count | `talent-acquisition-specialist` | See skill Step 1 for definition |
| Internal mobility rate | `(Internal role changes (promotions + transfers) ÷ total headcount) × 100%` | HRIS job history changes within same company | `talent-acquisition-specialist` | Exclude lateral reorganizations; count net changes |
| Quality-of-fill (1-year retention of new hires) | `(New hires retained ≥12 months ÷ total hires 12+ months ago) × 100%` | HRIS hire date × termination date cross-reference | `talent-acquisition-specialist` | Lagging metric; report by hiring manager if patterns differ |

### 9. Succession and Work Continuity

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Succession coverage ratio | `(Number of critical roles with ready-now successor ÷ total critical roles) × 100%` | Succession plan documentation × talent readiness assessments | `career-succession-consultant` | Ready-now = can assume role within 3 months with minimal support |
| % critical roles with successor identified | `(Number of critical roles with any successor named ÷ total critical roles) × 100%` | Succession plan documentation | `career-succession-consultant` | Weaker than coverage ratio; includes successors not yet ready |

### 10. Workforce Availability

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Total headcount by contract type | `Count of employees by contract type (full-time/part-time/temporary/contractor)` | HRIS employment contract type field | `data-analyst` | Report trends; watch for excessive contractor dependency |
| Demographic age-band distribution | `(Count in age band ÷ total headcount) × 100%` | HRIS date of birth grouped into bands (e.g., <25, 25-34, 35-44, 45-54, 55+) | `data-analyst` | Privacy compliance: aggregate only, no individual ages |
| Part-time/temporary ratio | `(Part-time + temporary headcount ÷ total headcount) × 100%` | HRIS employment status × FTE calculation | `data-analyst` | Track over time; high ratios may indicate underinvestment in core workforce |

### 11. Workforce Health, Well-being and Satisfaction

| Metric | Formula (Workspace Formulation) | Data Source Guidance | Owning Agent | Notes |
|--------|--------------------------------|---------------------|--------------|-------|
| Engagement/eNPS (existing, Partial) | `Survey instrument score; state instrument and response rate` | Employee engagement survey platform | `data-analyst` | See skill Step 1 for definition |
| Survey participation rate | `(Survey responses ÷ employees surveyed) × 100%` | Employee survey platform response counts | `data-analyst` | Target ≥70% for representativeness; critical for interpreting eNPS |
| Fatigue/burnout indicator (if surveyable) | `(% high burnout risk) OR (average burnout score on validated scale)` | Employee well-being survey with burnout items | `data-analyst` | Use validated instrument (e.g., Maslach Burnout Inventory); report distribution |

---

## Benchmarking and Hypothesis Guardrails

Extension metrics defined in this document inherit the benchmarking and hypothesis-labeling disciplines from the `hr-metrics-analysis` skill:

**Benchmarking Guardrail** (skill Step 4): When comparing any internal metric to an external/industry benchmark, cite the benchmark source by name, state its recency (publication year/period), and never fabricate or estimate an industry figure without a cited source. If no reliable benchmark is available, state that explicitly rather than inventing one.

**Driver Hypothesis Labeling** (skill Step 2): Any causal claim about *why* a metric moved must be explicitly labeled "Hypothesis" (not stated as fact) unless it has been statistically validated (e.g., via cohort comparison or regression with disclosed method). Never present an unvalidated causal narrative as a finding.

These disciplines apply to ALL metrics — both the 7 existing skill metrics and the extension metrics defined above.

---

## Dashboard Spec Extension

Extension metrics adopt the dashboard specification format from the `hr-metrics-analysis` skill (Step 3), so they drop directly into the existing Output Format table:

| Metric | Data Source | Refresh Cadence | Owner |
|--------|-------------|-----------------|-------|
| [Metric name from extension metric] | [System of record] | [real-time / daily / weekly / monthly] | [Agent accountable for data quality and refresh] |

For extension metrics, the Owner column uses the Owning Agent specified in each per-area section above. This maintains consistency with the skill's existing dashboard governance model.

---

## Skill Relationship

This document is a **reference layer** consumed by the `hr-metrics-analysis` skill and the `data-analyst` agent. The `hr-metrics-analysis/SKILL.md` file itself is **NOT modified** by this deliverable — the skill remains at v1.0.0 with its 7 standard metrics.

**How the mapping is used**:
- When `data-analyst` executes `hr-metrics-analysis`, this mapping document provides the ISO 30414 context for external reporting comparability.
- Extension metrics become available for dashboard specification using the skill's Step 3 format.
- Future skill revisions may inline pointers to this document, but the current v1.0.0 skill operates independently.

**Backlog linkage**: This mapping document is referenced in `docs/variant-benchmark-backlog.md` §12 row 10 as the completion artifact for PR21.

---

*Last Updated: 2026-08-24 — ISO 30414 Metrics Mapping v1.0.0*
