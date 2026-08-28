# traceability-dts Workflow

## 1. Objective
Maintain DTS (Drug Tracking System) compliance per MFDS, capturing each distribution stage with barcode/RFID.

## 2. Applicability
All DTS-mandated pharmaceutical items at each distribution stage.

## 3. Workflow Steps
1. **Scan at receipt**: Barcode/RFID scan, verify against manufacturer data.
2. **Scan at storage**: Record putaway location with DTS code.
3. **Scan at dispatch**: Record outbound transaction.
4. **Scan at delivery**: Customer receipt confirmation.
5. **MFDS DTS Center submission**: Real-time data submission via API.
6. **Mismatch investigation**: Apply `skills/domains/gdp/dts-verification/`.

## 4. Evidence Record
Generate `gdp-dts-tracking-record.json` with batch ID, DTS code, transaction stages.

## 5. KPI
- 100% DTS scan compliance for mandated items
- Zero DTS discrepancies
