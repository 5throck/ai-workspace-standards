# 제조 및 포장기록 (Batch Manufacturing Records) Workflow

## 1. Objective
Document complete manufacturing and packaging history of each batch to ensure traceability, compliance, and product quality, per 의약품 등의 안전에 관한 규칙 별표 1 제8호 (제조관리) and ICH Q7.

## 2. Applicability
This workflow applies to all pharmaceutical batch manufacturing and packaging operations under the `pharma-general` profile.

## 3. Workflow Steps

### Step 1: Batch Record Preparation
- Generate Batch Manufacturing Record (BMR) from approved Master Formula and SOPs.
- Assign unique batch number.

### Step 2: Pre-Manufacturing Verification
- Verify materials (identity, quantity, status).
- Verify equipment (cleaning status, calibration, qualification).
- Verify personnel (training, hygiene).

### Step 3: In-Process Manufacturing
- Execute BMR step-by-step with real-time documentation (ALCOA+).
- Record in-process controls (IPCs): weight, pH, temperature, time, etc.
- Document any deviations immediately (link to deviation-capa workflow).

### Step 4: Yield Reconciliation
- Calculate theoretical vs actual yield at each stage.
- Investigate yield deviations outside acceptance criteria.

### Step 5: Packaging Operations
- Apply packaging-specific BMR (BPR) with line clearance verification.
- Sample for in-process packaging controls.

### Step 6: Batch Record Review
- QA review within 30 days of batch completion (KPI requirement).
- Verify completeness, accuracy, ALCOA+ compliance.
- Identify deviations and link to deviation records.

### Step 7: Batch Disposition
- QA makes disposition decision: Approved / Rejected / Conditional.
- For Approved batches: release to distribution.
- Critical defects require RP concurrence.

## 4. Evidence Record
Generate `gmp-batch-record.json` with batch ID, product code, IPC results, yield, disposition, and common fields.

## 5. KPIs
- 100% batch record review within 30 days
- <2% batch deviation rate

## 6. Legal Disclaimer
> Workflow automation assistance only. Final batch disposition requires qualified QA and RP per KP-GMP requirements.
