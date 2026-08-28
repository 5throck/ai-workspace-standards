# 제품품질평가 (Product Quality Review) Workflow

## 1. Objective
Conduct annual review of all GMP-regulated drug products to verify consistency of existing manufacturing processes, identify trends, and implement product/process improvements, per 의약품 등의 안전에 관한 규칙 별표 1 제7.3호 (제품품질평가) and ICH Q7/Q10.

## 2. Applicability
This workflow applies to all commercialized drug products manufactured under the `pharma-general` profile. PQR is conducted annually for each product.

## 3. Workflow Steps

### Step 1: PQR Plan
- Define products in scope for the annual PQR.
- Define review period (typically previous calendar year).

### Step 2: Data Collection
- Collect data from each relevant workflow:
  - Batch records (batch-mfg): batches manufactured, yields, deviations
  - Deviation/CAPA records (deviation-capa): trends by type, severity
  - Stability data (stability): ongoing stability results
  - Change control records (change-control): changes implemented
  - Supplier qualification records (supplier-qualification): supplier performance
  - Self-inspection findings (self-inspection): relevant findings
  - Equipment qualification status (equipment-qualification): maintenance/calibration
  - Customer complaints and returns
  - Regulatory feedback/inspection findings

### Step 3: Trend Analysis
- Apply ICH Q9 methodology (typically FMEA for trend analysis).
- Identify adverse trends: increasing deviation rate, OOS frequency, complaint rate.

### Step 4: Quality Risk Assessment
- Evaluate identified trends for product quality impact.
- Prioritize via risk classification: critical / major / minor.

### Step 5: CAPA Development
- Develop CAPAs for critical/major findings.
- Link to deviation-capa workflow.

### Step 6: Process Improvement Recommendations
- Identify continuous improvement opportunities.
- Document for management review.

### Step 7: PQR Report
- Generate comprehensive PQR report with conclusions and recommendations.
- Compare to previous year trends.

### Step 8: Management Review
- Present PQR to senior management.
- Obtain commitment for resource allocation for CAPAs and improvements.

### Step 9: Regulatory Submission (if applicable)
- Submit PQR summary to MFDS if required for product variations or renewals.

## 4. PSM Equivalent
Pattern reused from `workflows/psm/pssr-review.md` (Pre-Startup Safety Review). Key difference: PQR is retrospective (annual review) while PSSR is prospective (pre-launch verification).

## 5. Evidence Record
Generate `gmp-pqr-record.json` with product ID, review period, trends identified, CAPAs, conclusions, and common fields.

## 6. KPI
- 100% PQR completion within 60 days of review period end

## 7. Legal Disclaimer
> Workflow automation assistance only. Final PQR acceptance and management review require qualified QA management and RP per KP-GMP requirements.
