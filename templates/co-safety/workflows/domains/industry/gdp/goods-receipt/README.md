# goods-receipt Workflow

## 1. Objective
Receive pharmaceutical goods from GMP manufacturers with proper verification of batch release and condition, per KGDP.

## 2. Applicability
All incoming pharmaceutical shipments at GDP-certified facilities.

## 3. Workflow Steps
1. **Pre-receipt verification**: Confirm supplier GDP license, batch release from manufacturer.
2. **Vehicle inspection**: Check transport conditions (temperature logger, cleanliness).
3. **Documentation review**: Verify packing list, batch IDs, quantities, DTS codes.
4. **Physical inspection**: Check packaging integrity, no damage, no counterfeit indicators.
5. **Temperature verification**: Download logger data, verify cold chain compliance.
6. **Acceptance or rejection**: Record decision with rationale.
7. **DTS scan**: Record receipt in DTS system.

## 4. Evidence Record
Generate `gdp-goods-receipt-record.json` with `batch_disposition_approved_ref` linking to GMP batch.

## 5. KPI
- ≥99.5% receipt accuracy
- 100% DTS scan compliance
