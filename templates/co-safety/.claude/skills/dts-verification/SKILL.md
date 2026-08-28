---
name: dts-verification
owner: gdp-agent
scope: workspace
status: active
description: Verify DTS (Drug Tracking System) barcode/RFID scans against manufacturer and MFDS records per Korean DTS regulations.
version: "1.0.0"
created: 2026-06-17
last_updated: 2026-06-17
metadata:
  triggers:
    - DTS 바코드 검증
    - DTS verification
    - 의약품 유통관리
    - RFID 검증
    - MFDS DTS센터
    - 위변조 의약품 조사
    - GS1 데이터매트릭스
  legal_basis:
    - 약사법 제47조의3
    - 약사법 제43조의2
    - 약사법 제43조의3
    - 의약품 등 추적관리에 관한 규정(식약처 고시)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# DTS Verification Skill

## Overview
Verifies DTS barcode/RFID scans at each distribution stage against manufacturer records and MFDS DTS Center database. Detects counterfeits, mismatches, and tracking gaps per Korean regulations.

## Scope
- **In scope**: DTS-mandated pharmaceutical items (17+ categories per MFDS)
- **Out of scope**: Non-pharmaceutical products; non-Korean DTS systems

## Verification Steps

### Step 1: Barcode/RFID Parse
- Parse GS1 DataMatrix 2D barcode or RFID data
- Extract:
  - GTIN (Global Trade Item Number)
  - Batch/Lot number
  - Serial number
  - Expiry date

### Step 2: Format Validation
- Verify GTIN checksum
- Verify serial number format per product specification
- Validate barcode structure per GS1 standards

### Step 3: Manufacturer Record Match
- Query manufacturer database (or MFDS DTS Center API) with GTIN + batch + serial
- Verify match exists
- Cross-check product attributes (name, strength, dosage form)

### Step 4: Distribution Stage Verification
- Verify the current transaction aligns with expected distribution chain:
  - Manufacturer → Wholesaler: First scan after manufacturing
  - Wholesaler → Pharmacy: Subsequent scans
  - Pharmacy → Patient: Final scan
- Flag any out-of-sequence scans (potential diversion or counterfeit)

### Step 5: MFDS DTS Center Submission
- Submit transaction data to MFDS DTS Center via API
- Verify successful submission
- Record submission timestamp and reference

### Step 6: Mismatch Investigation
- If any verification step fails:
  - Quarantine product immediately
  - Initiate counterfeit investigation
  - Notify manufacturer and MFDS
  - Escalate to PM/CSO

## Verification Result

Returns:
```json
{
  "scan_id": "...",
  "dts_code": "...",
  "verification_status": "matched | mismatched | pending",
  "checks_performed": {
    "format_valid": true,
    "manufacturer_match": true,
    "distribution_chain_valid": true,
    "mfds_submission_success": true
  },
  "anomalies": [],
  "recommended_action": "proceed | quarantine | destroy"
}
```

## DTS Code Parsing

GS1 DataMatrix structure (Korean DTS):
```
(01)GTIN(11)ProductionDate(17)ExpiryDate(21)SerialNumber(10)LotBatch
```

Example:
```
0108801111222234112025123117261231231SN1234567810BATCH001
```

## Verification Failure Categories

| Failure | Severity | Action |
|---------|----------|--------|
| Format invalid | High | Quarantine, investigate |
| GTIN not in MFDS database | Critical | Counterfeit suspected, MFDS notify |
| Manufacturer mismatch | Critical | Counterfeit suspected, MFDS notify |
| Distribution chain out-of-sequence | High | Diversion suspected, quarantine |
| MFDS submission failed | Medium | Retry; if persistent, manual submission |
| Duplicate scan (already scanned at this stage) | Low | Log warning, allow if same actor |

## Integration Points

- **Input from**: `gdp-dts-tracking-record.json`
- **Output to**: Updates verification fields in same record
- **Escalation**: Counterfeit suspicion → emergency-agent + MFDS notification

## v2 Roadplan
- Direct MFDS DTS Center API integration (real-time)
- ML-based counterfeit pattern detection
- Blockchain-based immutable tracking
- Cross-border DTS harmonization

## Legal Disclaimer
> Skill automation only. Final counterfeit determinations require qualified regulatory affairs professional and MFDS coordination per Korean law.
