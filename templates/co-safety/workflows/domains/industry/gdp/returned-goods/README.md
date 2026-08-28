# returned-goods Workflow

## 1. Objective
Process returned pharmaceutical goods per KGDP, determine disposition (restock / destroy / return to manufacturer).

## 2. Applicability
All customer returns at GDP-certified facilities.

## 3. Workflow Steps
1. **Return authorization**: Verify return reason, original sale record.
2. **Receipt inspection**: Check packaging, temperature logger (if cold chain).
3. **Condition assessment**: Determine if returnable per KGDP criteria.
4. **Disposition decision**:
   - Restock: Only if never left distribution chain, packaging intact.
   - Destroy: Most customer returns (KGDP conservative).
   - Return to manufacturer: Manufacturing defect suspected.
5. **Documentation**: Full chain of custody, DTS scan.
6. **Financial reconciliation**: Credit customer per policy.

## 4. Evidence Record
Generate `gdp-returned-goods-record.json`.

## 5. KPI
- 100% return processing within 14 days
