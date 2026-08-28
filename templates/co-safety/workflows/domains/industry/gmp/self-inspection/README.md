# 자체점검 (Self-Inspection) Workflow

## 1. Objective
Verify GMP compliance through structured internal audits, identify non-conformances, and implement corrective actions to maintain the Pharmaceutical Quality System, per 의약품 등의 안전에 관한 규칙 별표 1 제13호 (자율점검) and PIC/S PE 009 Chapter 9.

## 2. Applicability
This workflow applies to all GMP-regulated operations at pharmaceutical manufacturing sites under the `pharma-general` profile.

## 3. Frequency (per meeting decision 2026-06-17)
- **Default**: annual (KP-GMP minimum)
- **Risk-based adjustment**:
  - High-risk areas (sterile, biologics, API critical processes): quarterly
  - Medium-risk areas: semi-annual
  - Low-risk areas: annual
- `next_due` auto-calculated by `skills/gmp-self-inspection/SKILL.md`

## 4. Workflow Steps

### Step 1: Annual Self-Inspection Plan
- Define inspection scope, schedule, and team.
- Risk-based prioritization via `skills/domains/industry/gmp/qrm/`.

### Step 2: Pre-Inspection Preparation
- Develop inspection checklist per area.
- Review prior inspection findings and CAPA status.

### Step 3: Conduct Inspection
- On-site inspection with documentation.
- Verify: facilities, equipment, personnel, documentation, quality system, training.

### Step 4: Findings Classification
- Classify findings: critical / major / minor / observation.
- Apply ICH Q9 risk assessment for finding prioritization.

### Step 5: CAPA Plan
- Develop CAPA for each finding (link to deviation-capa workflow).
- Define owners, target dates, effectiveness checks.

### Step 6: Management Review
- Present findings to senior management.
- Obtain commitment for CAPA resources.

### Step 7: Follow-Up
- Track CAPA completion via `gmp-capa-record.json`.
- Verify effectiveness.

### Step 8: Closure & Report
- Close inspection after all CAPAs effective.
- Archive inspection report per regulatory retention (5 years minimum).

## 5. Evidence Record
Generate `gmp-self-inspection-record.json` with inspection ID, scope, frequency, findings, CAPAs, and common fields.

## 6. KPI
- 100% self-inspection completion on schedule
- 0 CAPAs overdue >90 days from self-inspection findings

## 7. Legal Disclaimer
> Workflow automation assistance only. Final self-inspection acceptance and management review require qualified QA management and RP.
