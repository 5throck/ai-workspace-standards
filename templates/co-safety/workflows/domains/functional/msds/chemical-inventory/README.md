# 화학물질 재고 관리 (Chemical Inventory Management) Workflow

## 1. Objective
Maintain accurate chemical inventory and submit monthly reports per K-REACH Article 10 (annual ≥1 ton existing chemical reporting) and OSHA-KR Article 110 (MSDS posting implies inventory tracking).

## 2. Applicability
All chemicals stored or used at site facilities under the `chemical-handling` profile.

## 3. Workflow Steps

### Step 1: Daily Inventory Tracking
- Record chemical intake (purchases, transfers in).
- Record chemical consumption (production use, transfers out, disposal).
- Track storage location and quantity.

### Step 2: Monthly Reconciliation
- Calculate month-end inventory by substance.
- Reconcile physical count vs system records.
- Investigate discrepancies (typical tolerance: ±2%).

### Step 3: Annual Tonnage Calculation
- Aggregate annual quantities by substance.
- Identify substances exceeding K-REACH Article 10 threshold (1 ton/year).
- Trigger `kreach-registration` workflow for newly threshold-crossing substances.

### Step 4: Regulatory Reporting (K-REACH Article 10)
- Submit annual report to KEITI (Korea Environmental Industry & Technology Institute) by March 31.
- Include: substance name, CAS number, annual tonnage, use category.

### Step 5: Internal Reporting
- Monthly dashboard to EHS team.
- Quarterly summary to senior management.
- Annual chemical footprint report.

### Step 6: Inventory Optimization
- Identify obsolete/slow-moving chemicals for disposal.
- Flag substances with high carrying cost or risk.
- Recommend substitutions for hazardous substances.

## 4. Evidence Record
Generate `chemical-inventory-record.json` monthly with: snapshot date, substance list, quantities, locations, and tonnage calculation.

## 5. Threshold Management
| Threshold | Trigger |
|-----------|---------|
| 0.5 ton/year | Internal monitoring begins |
| 1.0 ton/year (K-REACH Art 10) | Annual reporting to KEITI |
| 10 ton/year | Additional data requirements |
| 100 ton/year | Enhanced hazard assessment |

## 6. KPI
- 100% on-time K-REACH Article 10 reporting (March 31 annual deadline)
- Inventory accuracy ≥98% (physical vs system)

## 7. Legal Disclaimer
> Workflow automation assistance only. Final K-REACH submissions require qualified EHS manager and Chemical Management Officer review.
