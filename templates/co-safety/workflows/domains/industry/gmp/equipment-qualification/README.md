# 설비 적격성평가 (Equipment Qualification) Workflow

## 1. Objective
Establish and maintain documented evidence that equipment is properly installed, operates correctly, and consistently performs within established limits, per 의약품 등의 안전에 관한 규칙 별표 1 제6호 (적격성평가) and ICH Q7.

## 2. Applicability
This workflow applies to all GMP-regulated manufacturing equipment, analytical instruments, and utility systems under the `pharma-general` profile.

## 3. Workflow Steps (IQ / OQ / PQ)

### Step 1: User Requirements Specification (URS)
- Define user requirements and intended use.

### Step 2: Design Qualification (DQ)
- Verify design meets URS and GMP requirements.

### Step 3: Installation Qualification (IQ)
- Document equipment installation per design specifications.
- Verify materials, utilities, calibration of instruments.

### Step 4: Operational Qualification (OQ)
- Test equipment under expected operating ranges (worst-case conditions).
- Verify alarms, interlocks, control functions.

### Step 5: Performance Qualification (PQ)
- Verify consistent performance under normal operating conditions.
- Typically 3 consecutive successful runs.

### Step 6: Calibration & Preventive Maintenance
- Establish calibration schedule per 의약품 등의 안전에 관한 규칙 별표 1 제6호.
- Define preventive maintenance schedule.
- Generate evidence in `gmp-equipment-qualification-record.json`.

### Step 7: Re-Qualification
- Re-qualify after change (via change-control workflow), major maintenance, or per defined schedule.

## 4. PSM Equivalent
Pattern reused from `workflows/psm/mi-inspection.md` (Mechanical Integrity). Key difference: GMP adds PQ (Performance Qualification) and emphasizes ALCOA+ data integrity for qualification records.

## 5. Evidence Record
Generate `gmp-equipment-qualification-record.json` with IQ/OQ/PQ status, calibration due dates, and common fields (`e_signature`, `qrm_assessment`, `nomenclature`, `audit_trail`).

## 6. Legal Disclaimer
> Workflow automation assistance only. Final qualification approval requires qualified Engineering and QA professionals.
