# 변경관리 (Change Control) Workflow

## 1. Objective
Ensure that all changes to facilities, equipment, processes, materials, documentation, or organization affecting GMP compliance are properly evaluated, approved, implemented, and documented before execution, per 의약품 등의 안전에 관한 규칙 별표 1 제12호 (변경관리) and ICH Q10.

## 2. Applicability
This workflow applies to all GMP-regulated changes at pharmaceutical manufacturing sites under the `pharma-general` profile, except replacements-in-kind (RIK).

## 3. Workflow Steps

### Step 1: Change Request Initiation
- Initiator submits change request with description, rationale, technical basis, and scope.

### Step 2: Impact Assessment (Quality Risk Management)
- Apply ICH Q9 methodology via `skills/domains/industry/gmp/qrm/` (typically FMEA or cQRM-HAZOP).
- Document impact on: product quality, validated state, regulatory filings, stability, supplier qualification.

### Step 3: Multi-Disciplinary Review
- QA, Production, Engineering, Regulatory, and (if applicable) Medical review the proposed change.
- Verify compliance with applicable regulations (KP-GMP, PIC/S, ICH).

### Step 4: Approval
- Obtain required approvals (Section B of gmp-change-control-record.json).
- For major/critical changes: QA Manager and RP (Responsible Person) approval mandatory.

### Step 5: Implementation Planning
- Define implementation tasks, training requirements, and timeline.
- Identify dependent actions (re-validation, re-qualification, stability studies).

### Step 6: Pre-Implementation Verification
- Confirm all prerequisites met (training completed, materials available, documents updated).

### Step 7: Implementation & Effectiveness Check
- Execute the change.
- Define effectiveness check criteria and timeline (typically 30-90 days).

### Step 8: Closure
- Verify effectiveness check passed.
- Archive evidence record with multi-source legal_basis and e-signature.

## 4. Evidence Record
Generate `gmp-change-control-record.json` to `memory/` with required common fields (`e_signature`, `qrm_assessment`, `nomenclature`, `audit_trail`).

## 5. PSM Equivalent
This workflow reuses the pattern from `workflows/domains/functional/psm/moc-process/` (90% reuse per architecture decision). Key difference: GMP change control includes quality impact assessment in addition to safety impact.

## 6. Legal Disclaimer
> Workflow automation assistance only. Final change approval and regulatory filing decisions require qualified QA and Regulatory Affairs professionals.
