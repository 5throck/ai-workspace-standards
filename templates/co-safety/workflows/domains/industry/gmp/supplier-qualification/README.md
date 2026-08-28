# 공급자 자격부여 (Supplier Qualification) Workflow

## 1. Objective
Establish and maintain a qualified supply chain for raw materials, components, and services affecting product quality, per 의약품 등의 안전에 관한 규칙 별표 1 제10호 (원자재 및 제품의 관리) and PIC/S PE 009 Chapter 5.

## 2. Applicability
This workflow applies to all suppliers of GMP-regulated materials (APIs, excipients, packaging components) and contract service providers (laboratories, contract manufacturers) under the `pharma-general` profile.

## 3. Workflow Steps

### Step 1: Supplier Identification
- Identify candidate supplier for material/service.
- Document supplier information, certificates (ISO, GMP), and references.

### Step 2: Risk-Based Assessment
- Apply ICH Q9 methodology via `skills/domains/industry/gmp/qrm/`.
- Risk classification: low (commodity materials) / medium / high (APIs, primary packaging).

### Step 3: Initial Assessment
- Desk review: supplier quality documentation, regulatory certificates, audit reports.
- Material sampling and testing for high-risk suppliers.

### Step 4: On-Site Audit (for high-risk)
- Conduct on-site GMP audit for high-risk suppliers.
- Verify facility, equipment, personnel, documentation, quality system.

### Step 5: Approval
- QA approval for qualified suppliers.
- Define approved materials, specifications, monitoring frequency.

### Step 6: Ongoing Monitoring
- Periodic re-qualification: typically every 2-3 years (high-risk: annual).
- Track incoming material quality (deviation rate, OOS rate).
- Annual supplier performance review.

### Step 7: Disqualification
- Disqualify suppliers with significant quality failures.
- Document disqualification rationale and replacement plan.

## 4. PSM Equivalent
Pattern reused from `workflows/psm/contractor-management.md`. Key difference: GMP supplier qualification includes material-specific risk assessment and ongoing quality monitoring.

## 5. Evidence Record
Generate `gmp-supplier-record.json` with supplier ID, qualification status, audit dates, materials list, and common fields.

## 6. KPI
- 100% supplier qualification onboarding

## 7. Legal Disclaimer
> Workflow automation assistance only. Final supplier approval requires qualified QA and Procurement professionals.
