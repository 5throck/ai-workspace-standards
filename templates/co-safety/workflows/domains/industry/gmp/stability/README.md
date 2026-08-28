# 안정성 시험 (Stability Testing) Workflow

## 1. Objective
Generate stability data to establish and verify drug product shelf-life, storage conditions, and quality over time, per 의약품 등의 안전에 관한 규칙 별표 1 제7.2호 (안정성 시험) and ICH Q1A/Q1E.

## 2. Applicability
This workflow applies to all GMP-regulated drug products, APIs, and intermediates under the `pharma-general` profile. Covers registration stability, commitment stability, and ongoing stability programs.

## 3. Workflow Steps

### Step 1: Stability Protocol Development
- Define stability protocol per ICH Q1A.
- Storage conditions: long-term (25°C/60%RH), intermediate (30°C/65%RH), accelerated (40°C/75%RH).
- Define timepoints, test parameters, acceptance criteria.

### Step 2: Sample Selection & Storage
- Select representative batches per protocol (typically 3 batches for registration).
- Apply ICH Q9 sampling justification via `skills/domains/industry/gmp/qrm/`.
- Place samples in qualified stability chambers (calibrated, monitored).

### 3.3 Timepoint Testing
- Pull samples at scheduled timepoints (0, 3, 6, 9, 12, 18, 24, 36 months).
- Test per protocol: assay, impurities, dissolution, physical properties.

### Step 4: Out-of-Trend / Out-of-Specification Investigation
- Investigate any OOT/OOS results via deviation-capa workflow.
- Apply ICH Q9 methodology for impact assessment.

### Step 5: Data Evaluation
- Evaluate stability data per ICH Q1E for shelf-life extrapolation.
- Statistical analysis for trend assessment.

### Step 6: Stability Report
- Generate stability report with conclusion, recommended shelf-life, storage conditions.
- Submit for regulatory filings or product release decisions.

### Step 7: Annual Ongoing Stability
- Annual stability program for commercial batches (1 batch/year per product).
- Trend monitoring across batches.

## 4. Evidence Record
Generate `gmp-stability-record.json` with protocol ID, conditions, timepoints, results, conclusion, and common fields.

## 5. Legal Disclaimer
> Workflow automation assistance only. Final shelf-life determination and regulatory submission require qualified QA, Analytical Development, and Regulatory Affairs professionals.
