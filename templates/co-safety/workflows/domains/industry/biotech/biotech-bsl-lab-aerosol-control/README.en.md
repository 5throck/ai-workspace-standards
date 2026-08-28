# Biotech Industry — BSL Lab Aerosol Control Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent pathogenic-microorganism aerosol exposure, LMO (living-modified-organism) dispersion, and out-of-BSC exposure hazards in BSL-2/3 laboratories and biomanufacturing facilities, by applying the hierarchy of controls. Centrifugation, pipetting, sonication, and fermentation sampling generate infectious aerosols; BSC performance degradation and inadequate PPE are leading causes of laboratory-acquired infections (LAI). This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a biotech-industry-specific aerosol-control procedure that does not duplicate any workflow under `workflows/_shared/` (`gcp`/`gvp`/`glp` domains).

## 2. Scope
- **Industry**: Biotech (code: `biotech`, life-science R&D and biomanufacturing)
- **Work covered**: BSL-2/3 pathogen handling, virus culture/concentration, centrifugation/pipetting/sonication, bioreactor sampling, animal-procedure work, LMO handling, BSC and containment equipment operation/certification
- **Trigger points**: Introduction of a new pathogen/LMO, scheduled BSC certification (HVAC/HEPA), aerosol-release incident, containment-zone modification

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads biological risk assessment, assigns biosafety level (BSL), formulates emergency response plans |
| Biosafety Officer (BSO) | Manages BSC/containment performance, delivers biosafety training, approves LMO experiments |
| Industrial Hygienist | Monitors aerosol/airborne exposure, assesses respiratory-protection adequacy |
| Supervisor / Principal Investigator (PI) | Approves experimental protocols, pre-checks BSC, halts work and reports on anomaly |
| Researcher / Worker | Works inside BSC, wears PPE, follows aerosol-suppression techniques |
| Institutional Biosafety Committee (IBC) | Reviews LMO/pathogen experiments, reviews incidents and near-misses |

## 4. Procedure
1. **Risk assessment**: Identify pathogen transmission route/titer and LMO classification, aerosol-generating procedures (centrifugation, pipetting, sonication, sampling), BSC adequacy, and containment level (BSL-2/3). Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Inactivate or substitute infectious material (non-infectious surrogate); immediately inactivate waste.
   2. **Passive protection**: BSC (Class II/III), containment facilities, negative-pressure rooms, HEPA filtration, closed bioreactors.
   3. **Active protection**: Continuous BSC airflow/differential-pressure monitoring, HEPA-leak alarms.
   4. **Administrative**: BSL experiment approval and IBC review, standard operating procedures (SOPs), medical surveillance.
   5. **PPE**: N95/Powered Air-Purifying Respirator (PAPR), lab coats, double gloves (last resort).
3. **BSC & containment control**: Annual certification of BSC Class II/III (NSF/ANSI 49 or KOSHA criteria); pre-use checks (airflow, differential pressure, HEPA); prohibit aerosol-generating work outside a BSC.
4. **Aerosol suppression**: Use sealed rotors (bucket seals) for centrifugation, aerosol-barrier tips for pipetting, closed vessels for sonication, and aseptic technique inside a BSC for sampling.
5. **LMO & pathogen control**: Comply with 유전자변형생물체의 국가간 이동 등에 관한 법률 (LMO-Act) Articles 22/24 (containment and transport) and 생명윤리 및 안전에 관한 법률 (BSA) Articles 13/16 (safety measures) _[UNVERIFIED — specialist re-verification required; see anchor table]_.
6. **Emergency response**: Pre-establish procedures for immediate work stoppage, evacuation, and decontamination on aerosol release, BSC failure, or suspected LAI, with exposure reporting and medical surveillance. (Related: `biotech-biological-spill-response` workflow.)
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain BSC certificates, IBC approvals, exposure records, and medical-surveillance results.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/biotech/biotech-biotech-bsl-lab-aerosol-control-record.json`](../../../../../evidence-models/domains/industry/biotech/biotech-biotech-bsl-lab-aerosol-control-record.json) (skeleton, `status: draft`)

- **Record ID format**: `BIOTECH-BSL-LAB-AEROSOL-CONTROL-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as pathogen classification/titer, BSL level, BSC certification results, differential-pressure/airflow logs, and respirator fit.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated). The `[UNVERIFIED]` markers are preserved verbatim from the schema anchor table.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 생명윤리 및 안전에 관한 법률 Article 13 _[UNVERIFIED — see anchor table]_
- 생명윤리 및 안전에 관한 법률 Article 16 _[UNVERIFIED — see anchor table]_
- 유전자변형생물체의 국가간 이동 등에 관한 법률 Article 22 _[UNVERIFIED — see anchor table]_
- 유전자변형생물체의 국가간 이동 등에 관한 법률 Article 24 _[UNVERIFIED — see anchor table]_
- 약사법 및 GMP/GCP 규정 Article GMP

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 생명윤리 및 안전에 관한 법률 | BSA | Bioethics and Safety Act |
| 유전자변형생물체의 국가간 이동 등에 관한 법률 | LMO-Act | Act on the Transboundary Movement of Living Modified Organisms |
| 약사법 및 GMP/GCP 규정 | MFDS-GMP | Pharmaceutical Affairs Act (MFDS GMP/GCP) |

## 7. Regulatory Notes
The biotech industry spans R&D (생명윤리 및 안전에 관한 법률/BSA, 유전자변형생물체의 국가간 이동 등에 관한 법률/LMO-Act) and biopharma manufacturing (MFDS GMP). The existing `gcp`/`gvp`/`glp` domain workflows focus on clinical and data-integrity concerns; this workflow complements them by addressing biotech-specific hazards (pathogenic aerosols, LMO containment, Institutional Biosafety Committee governance). BSA Articles 13/16 and LMO-Act Articles 22/24 are marked `[UNVERIFIED]` in the anchor table; specialist re-verification is recommended once the statute structure is indexed. This workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Biopharma facility construction (CR/EPC), containment-equipment maintenance, and waste-inactivation handling are heavily outsourced, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client (biopharma manufacturer) must ensure this workflow's controls (including containment cross-contamination prevention and infectious-waste control) are applied by engineering, cleaning, and waste subcontractors down the contracting chain.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
