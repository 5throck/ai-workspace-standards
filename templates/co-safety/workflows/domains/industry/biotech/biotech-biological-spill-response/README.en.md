# Biotech Industry — Biological Spill Response Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Establish a systematic emergency-response procedure to contain, decontaminate, and recover from spills of infectious material, pathogen cultures, or LMOs in life-science R&D and biopharmaceutical manufacturing facilities — preventing contamination spread, primary/secondary exposure, and environmental release. Large spills outside a BSC, centrifuge-tube breakage, and bioreactor leaks are representative biosafety scenarios that generate secondary aerosols and cross-contamination. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and emergency-response-system building.

This is an **industry-unique workflow** — a biotech-specific biological-spill-response procedure that complements the generic emergency-response workflow under `workflows/_shared/`. (Incident prevention does not overlap with the `biotech-bsl-lab-aerosol-control` workflow.)

## 2. Scope
- **Industry**: Biotech (code: `biotech`, life-science R&D and biomanufacturing)
- **Work covered**: Infectious-material spills inside/outside a BSC, centrifuge-tube breakage, bioreactor/incubator leaks, LMO/pathogen release during transport, bulk-culture spills
- **Trigger points**: Immediately on spill (initial response), decontamination and restoration, post-incident medical surveillance

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads biosafety emergency-response plan, assesses exposure extent, notifies external authorities |
| Biosafety Officer (BSO) | Assigns spill tier, judges decontamination method and disinfectant adequacy, authorizes restoration |
| Industrial Hygienist | Conducts medical surveillance and medical referral for exposed persons, environmental monitoring |
| Supervisor / Principal Investigator (PI) | Orders immediate work stoppage and isolation, leads first-response team, reports the situation |
| Worker / Spill Response Team | Performs isolation, absorption, and decontamination in PPE; suppresses re-aerosolization |
| Institutional Biosafety Committee (IBC) | Investigates root cause and formulates preventive measures |

## 4. Procedure
1. **Immediate containment**: Stop work at once, evacuate personnel, establish an isolation zone, check ventilation (keep BSC on, maintain negative pressure), and restrict access. Suppress further aerosol generation (do not sweep; absorb slowly).
2. **Spill assessment**: Identify the spilled material (pathogen/LMO), volume and concentration, BSL tier, contamination extent, and exposed persons. The Biosafety Officer selects the decontamination method and disinfectant (e.g., 70% ethanol, 10% bleach, VHP). Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk assessment).
3. **PPE & hierarchy**:
   1. **Isolation**: Cordon and post the contaminated zone; maintain negative pressure and HEPA filtration.
   2. **Decontamination**: Apply disinfectant → observe contact time → neutralize → absorb and remove (3 cycles recommended).
   3. **PPE**: Tyvek coverall, double gloves, N95/PAPR, face shield; follow contamination-safe doffing order.
4. **Decontamination & restoration**: Under BSO approval, disinfect → rinse → dry → inspect for reuse; decide on BSC HEPA/exhaust-filter replacement; restore only after release criteria (culture testing, environmental sampling) are met.
5. **Environmental release control (LMO/pathogen)**: Comply with 유전자변형생물체의 국가간 이동 등에 관한 법률 (LMO-Act) Articles 22/24 (environmental-release reporting) and 생명윤리 및 안전에 관한 법률 (BSA) Articles 13/16 (safety measures) _[UNVERIFIED — specialist re-verification required; see anchor table]_.
6. **Exposed-person management**: Primary decontamination and medical referral, exposure records, incubation-period medical surveillance and follow-up, post-exposure prophylaxis (PEP) where indicated.
7. **Post-incident**: Root-cause investigation and IBC reporting, share lessons learned, preventive actions (SOP revision, training, facility improvements).
8. **Recordkeeping & audit**: Generate the evidence record (§5); retain spill reports, decontamination checklists, exposure records, and medical-surveillance results.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/biotech/biotech-biotech-biological-spill-response-record.json`](../../../../../evidence-models/domains/industry/biotech/biotech-biotech-biological-spill-response-record.json) (skeleton, `status: draft`)

- **Record ID format**: `BIOTECH-BIOLOGICAL-SPILL-RESPONSE-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as spilled pathogen/LMO classification and BSL tier, spill volume/extent, disinfectant and contact time, exposed-person roster and surveillance results, and release-criteria test results.

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
Biological-spill response rests on the biosafety R&D statutes (생명윤리 및 안전에 관한 법률/BSA, 유전자변형생물체의 국가간 이동 등에 관한 법률/LMO-Act) and MFDS GMP rules. This workflow complements the generic emergency response in the `gcp`/`gvp`/`glp` domains by addressing infectious-material- and LMO-specific decontamination, release-criteria, and environmental-release reporting requirements. BSA Articles 13/16 and LMO-Act Articles 22/24 are marked `[UNVERIFIED]` in the anchor table; specialist re-verification is recommended once the statute structure is indexed. This workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Maintenance, cleaning, and infectious-waste handling in biopharma facilities are often delegated to contractors, whose exposure and spread-containment during a spill are critical. Under 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation), the commissioning client must apply the same spill-response training, PPE, and decontamination procedures to contractor personnel, and must specify responsibility allocation in the contract.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
