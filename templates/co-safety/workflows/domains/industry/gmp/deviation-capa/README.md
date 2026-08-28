# 이상관리 및 시정예방조치 (Deviation Management and CAPA) Workflow

## 1. Objective
Identify, document, investigate, and resolve deviations from approved procedures or specifications, and implement corrective and preventive actions (CAPA) to eliminate root causes, per 의약품 등의 안전에 관한 규칙 별표 1 제7.3호 (이상관리 및 시정조치) and ICH Q10.

## 2. Applicability
This workflow applies to all GMP-regulated operations at pharmaceutical manufacturing sites under the `pharma-general` profile. Covers planned and unplanned deviations, out-of-specification (OOS) events, and adverse trends.

## 3. Workflow Steps

### Step 1: Deviation Identification
- Identify deviation through batch record review, in-process control failure, OOS result, or observation.
- Classify: minor / major / critical.

### Step 2: Immediate Action (Containment)
- For critical/major: implement immediate containment to prevent patient impact.
- Quarantine affected batches if applicable.

### Step 3: Deviation Documentation
- Generate `gmp-deviation-record.json` within 24 hours of identification.
- Include description, classification, immediate action, impact assessment.

### Step 4: Investigation (Root Cause Analysis)
- Apply ICH Q9 methodology (FMEA, FTA, or 5-Whys) via `skills/domains/industry/gmp/qrm/`.
- Identify root cause(s) — distinguish from contributing causes.

### Step 5: CAPA Development
- Define corrective action (eliminate root cause for current event).
- Define preventive action (prevent recurrence in similar processes).
- For each CAPA: assign owner, target date, effectiveness check method.

### Step 6: CAPA Implementation
- Execute corrective and preventive actions.
- Track progress via `gmp-capa-record.json`.

### Step 7: Effectiveness Check
- Verify CAPA effectiveness (typically 30-90 days post-implementation).
- Document verification with evidence.

### Step 8: Closure
- Close deviation and CAPA records after effectiveness verification.
- Critical deviations require RP (Responsible Person) approval for closure.

## 4. Evidence Records
- `gmp-deviation-record.json` — deviation documentation
- `gmp-capa-record.json` — CAPA tracking (one deviation may have multiple CAPAs)

## 5. KPIs (per gmp-agent)
- Deviation rate <2%
- Zero CAPAs overdue >90 days
- 100% critical deviations investigated within 7 days

## 6. Legal Disclaimer
> Workflow automation assistance only. Final disposition decisions require qualified QA and RP per KP-GMP requirements.
