# sae-reporting Workflow

## 1. Objective
SAE/SUSAR reporting per KGCP Article 73의2 + ICH E2A.

## 2. Definitions
- **AE (Adverse Event)**: Any unfavorable medical occurrence
- **SAE (Serious AE)**: AE that: results in death, is life-threatening, requires/prolongs hospitalization, causes persistent disability, is congenital anomaly, or other serious events
- **SUSAR (Suspected Unexpected Serious Adverse Reaction)**: SAE that is both unexpected (not in IB) and related to IP

## 3. Reporting Timelines (Korea)
- **SUSAR fatal**: 7 days to MFDS
- **SUSAR other serious**: 15 days total
- **Annual safety report (PSUR)**: Yearly aggregate

## 4. Workflow Steps
1. **Event identification**: Investigator awareness.
2. **Causality assessment**: Apply `skills/domains/gcp/sae-causality-assessor/`.
3. **Seriousness determination**: Per ICH E2A criteria.
4. **Expectedness determination**: Against investigator's brochure.
5. **Reporting**: To IRB, Sponsor, MFDS per timeline.
6. **Follow-up**: Continued information gathering.

## 5. Evidence Record
Generate `gcp-sae-record.json` with causality assessment, timelines.
