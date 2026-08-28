# Cosmetics Industry — Solvent Exposure Control Workflow

> **Status**: This README was finalized in Task 12. However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review (`status: draft`). Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically control respiratory and dermal exposure to organic solvents used in cosmetics manufacturing and filling processes, to protect worker health (liver, kidney, central-nervous-system effects, dermatitis) and prevent fire/explosion risk from flammable solvents.

This is an **industry-unique workflow** — a cosmetics-specific control procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Cosmetics manufacturing/import (code: `cosmetics`)
- **Processes**: Solvent metering/transfer, mixing/agitation, cleaning/degreasing, nail/aerosol filling, painting/coating maintenance
- **Trigger points**: During risk assessment, on introduction of a new solvent, on process change, and at recurring exposure-monitoring intervals

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads risk assessment, verifies adequacy against exposure limits, plans training |
| Supervisor / Work Lead | Supervises procedural compliance, issues/inspects PPE, confirms ventilation operation, halts work on anomaly |
| Worker | Follows standard procedures, wears PPE, immediately reports solvent leaks or abnormal signs |
| Industrial Health & Safety Committee | Reviews monitoring results and special-medical-examination outcomes |

## 4. Procedure
1. **Hazard identification**: Identify solvents in use (MSDS-based), determine exposure routes (inhalation, skin), and confirm hazard traits (flash point, carcinogenicity).
2. **Risk assessment**: Evaluate workplace exposure concentration and flammable-explosion risk. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
3. **Engineering controls**: Local exhaust ventilation (LEV), enclosed transfer, automated dispensing, explosion-proof ventilation — applied first in the control hierarchy.
4. **Administrative controls**: Standard procedures, work permits (flammable work), exposure monitoring, training. Aligns with 산업안전보건법 MSDS 규정 (OSHA-KR MSDS Regulation) Article 110 (retention duty).
5. **PPE**: Appropriate respiratory protection, chemical-resistant gloves, safety eyewear, protective clothing — applied as the final tier of the hierarchy.
6. **Training & medical surveillance**: Recurring special medical examinations (liver function, etc.) for solvent-handling workers; recurring training.
7. **Recordkeeping & audit**: Generate the evidence record (§6); log recurring monitoring and audit results.

## 5. Shared TBM Reference
The cosmetics industry is a declared consumer of the shared **Tool Box Meeting (TBM)** workflow (`workflows/_shared/tbm/`). This `solvent-exposure-control` workflow is an industry-unique workflow; TBM is declared separately via a `references:` block. See [`workflows/_shared/REFERENCE-APPLICATION-GUIDE.md`](../../../../_shared/REFERENCE-APPLICATION-GUIDE.md) for the shared-workflow adoption pattern.

## 6. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/cosmetics/cosmetics-solvent-exposure-control-record.json`](../../../../../evidence-models/domains/industry/cosmetics/cosmetics-solvent-exposure-control-record.json) (skeleton, `status: draft`)

- **Record ID format**: `COSMETICS-SOLVENT-EXPOSURE-CONTROL-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as exposure measurements, control-measure history, and training completion.

## 7. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 화장품법 Article 5
- 화학물질의 등록 및 평가 등에 관한 법률 Article 10
- 산업안전보건법 MSDS 규정 Article 110

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 화장품법 | CA | Cosmetics Act |
| 화학물질의 등록 및 평가 등에 관한 법률 | K-REACH | Act on Registration and Evaluation of Chemicals |

## 8. Regulatory Notes
Cosmetics manufacturing involves solvent handling, aerosol filling, and powder mixing — all covered by OSHA-KR + DSSMA-style controls rather than a cosmetics-specific safety statute. The Cosmetics Act itself is primarily a product-quality registration regime (MFDS-enforced), with facility standards in Article 5 that have safety overlap.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
