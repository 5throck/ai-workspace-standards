# Cosmetics Industry — Powder & Dust Control Workflow

> **Status**: This README was finalized in Task 12. However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review (`status: draft`). Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically control respirable-dust and combustible-dust hazards arising from powder mixing, aerosol filling, powder packaging, and cleaning/dust-collection processes in cosmetics manufacturing, to protect worker health and prevent dust fire/explosion risk.

This is an **industry-unique workflow** — a cosmetics-specific control procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Cosmetics manufacturing/import (code: `cosmetics`)
- **Processes**: Powder raw-material handling, mixing/agitation, aerosol filling, powder packaging, cleaning/dust collection
- **Trigger points**: During risk assessment, on introduction of a new powder raw material, on process change, and at recurring monitoring intervals

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads risk assessment, verifies adequacy of control measures, plans training |
| Supervisor / Work Lead | Supervises procedural compliance, issues/inspects PPE, halts work on anomaly |
| Worker | Follows standard procedures, wears PPE, reports abnormal signs |
| Industrial Health & Safety Committee | Reviews control measures and monitoring results |

## 4. Procedure
1. **Hazard identification**: Identify emission sources and dust characteristics (particle size, combustibility, toxicity) for each powder-handling process (mixing, filling, packing, cleaning). Secure the relevant MSDS.
2. **Risk assessment**: Evaluate respiratory exposure and combustible-dust explosion potential. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
3. **Engineering controls**: Local exhaust ventilation (LEV), enclosed transfer, automation, explosion-prevention design (static control, inert gas) — applied first in the control hierarchy.
4. **Administrative controls**: Standard procedures, work permits, exposure monitoring, training. Aligns with 산업안전보건법 MSDS 규정 (OSHA-KR MSDS Regulation) Article 110 (retention duty).
5. **PPE**: Respiratory protection, safety eyewear, protective clothing — applied as the final tier of the hierarchy.
6. **Training & medical surveillance**: Select special-medical-examination items based on handled substances; conduct recurring training.
7. **Recordkeeping & audit**: Generate the evidence record (§6); log recurring monitoring and audit results.

## 5. Shared TBM Reference
The cosmetics industry is a declared consumer of the shared **Tool Box Meeting (TBM)** workflow (`workflows/_shared/tbm/`). This `powder-dust-control` workflow is an industry-unique workflow; TBM is declared separately via a `references:` block. See [`workflows/_shared/REFERENCE-APPLICATION-GUIDE.md`](../../../../_shared/REFERENCE-APPLICATION-GUIDE.md) for the shared-workflow adoption pattern.

## 6. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/cosmetics/cosmetics-powder-dust-control-record.json`](../../../../../evidence-models/domains/industry/cosmetics/cosmetics-powder-dust-control-record.json) (skeleton, `status: draft`)

- **Record ID format**: `COSMETICS-POWDER-DUST-CONTROL-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as dust-concentration measurements, control-measure history, and training completion.

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
