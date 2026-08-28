# 세정 밸리데이션 (Cleaning Validation) Workflow

## 1. Objective
Establish documented evidence that cleaning procedures consistently remove residues (active ingredients, detergents, bioburden) to predetermined acceptance levels, preventing cross-contamination between products, per 의약품 등의 안전에 관한 규칙 별표 1 제6호 (세척 밸리데이션) and PIC/S cleaning validation guidance.

## 2. Applicability
This workflow applies to all GMP-regulated shared (multi-product) manufacturing equipment under the `pharma-general` profile. Single-product dedicated equipment may have reduced scope.

## 3. Workflow Steps

### Step 1: Cleaning Validation Protocol
- Define equipment scope, cleaning procedure (SOP), sampling locations.
- Calculate acceptance criteria:
  - Active residue limit: 1/1000 of minimum therapeutic dose or 10 ppm (whichever is stricter)
  - Detergent limit: per supplier LD50 data
  - Bioburden and endotoxin limits (if applicable)

### Step 2: Risk Assessment
- Apply ICH Q9 (FMEA) to identify worst-case products, locations, and conditions.
- Justify sampling locations (swab + rinse) per equipment geometry.

### Step 3: Analytical Method Validation
- Validate analytical methods for residue detection (specificity, sensitivity at PDE level).
- Method detection limit must be below acceptance criteria.

### Step 4: Cleaning Execution (Worst-Case)
- Execute cleaning procedure per SOP.
- Document operator, time, materials used.

### Step 5: Sampling & Testing
- Swab samples at defined locations.
- Rinse samples for large/complex equipment.
- Test per validated methods.

### Step 6: Data Evaluation
- Compare results to acceptance criteria.
- Investigate any out-of-specification via deviation-capa workflow.

### Step 7: Validation Runs
- Typically 3 consecutive successful cleaning runs required.
- Document consistency of cleaning procedure.

### Step 8: Report & Approval
- Generate validation report with conclusion.
- QA approval required before product changeover.

### Step 9: Ongoing Verification
- Periodic verification (annual or per defined batch interval).
- Trigger re-validation on significant cleaning procedure change.

## 4. Evidence Record
Generate `gmp-cleaning-validation-record.json` with equipment ID, residue limits, analytical methods, results, and common fields.

## 5. Legal Disclaimer
> Workflow automation assistance only. Final cleaning validation acceptance requires qualified QA, Analytical Development, and Engineering professionals. Toxicological assessment of PDE limits requires qualified toxicologist.
