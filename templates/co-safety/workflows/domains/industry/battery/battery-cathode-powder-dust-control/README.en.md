# Battery Industry — Cathode Powder Dust Control Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent inhalation toxicity, combustible-dust explosion, and hazardous-powder exposure during cathode-active-material mixing, dispersion, and coating in lithium-ion secondary-cell manufacturing, by applying the hierarchy of controls. Cathode powders (cobalt/nickel/manganese oxides — NMC/NCA chemistries) are respiratory toxins, and dry-process powders can exceed the minimum-explosible-concentration (MEC), making this a representative compound hazard. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a battery-industry-specific dust-control procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Battery (code: `battery`, lithium-ion secondary-cell manufacturing)
- **Work covered**: Cathode-powder charging and mixing, slurry dispersion, coating/drying, powder transport (conveying pipes, silos), dust-collector (bag filter/scrubber) operation and cleaning, drum/FIBC filling and discharge, interior equipment cleaning
- **Trigger points**: Powder-handling line start-up, dust-collector replacement/cleaning, dust-release alarm, introduction of a new cathode chemistry

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads dust/chemical risk assessment, formulates dust-explosion protective measures, plans workplace-environment monitoring |
| Industrial Hygienist | Measures/evaluates respirable-dust concentrations, assesses respirator adequacy, inspects local-exhaust-ventilation (LEV) performance |
| Supervisor / Work Lead | Approves work permits, pre-checks dust-control equipment, verifies static-charge and fugitive-emission suppression |
| Worker | Wears respirator/PPE, confirms LEV is operating, complies with dust-suppression rules |
| Facility Engineer | Maintains dust-collector and conveying-pipe tightness, inspects inerting (inert-gas blanketing) systems |
| Industrial Health & Safety Committee | Reviews dust-exposure, dust-explosion, and near-miss events, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify dust chemistry (cobalt/nickel/manganese), particle size and moisture, combustibility (MIE/Kst/MEC), fugitive-emission zones, and ignition sources (static, friction, flame). Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Minimize dry-powder handling via wet-slurry process; introduce closed-transfer systems.
   2. **Passive protection**: Fully enclosed equipment/glove boxes, local exhaust ventilation (LEV), explosion venting/suppression hardware.
   3. **Active protection**: Continuous fugitive-dust monitoring, inerting and oxygen-concentration control.
   4. **Administrative**: Powder-handling permit, standardized cleaning procedures (sequential cleaning, HEPA vacuuming), workplace-environment monitoring.
   5. **PPE**: P3/HEPA respirator, coveralls, safety goggles (last resort).
3. **Inhalation exposure control**: Comply with exposure limits for cathode powders (cobalt/nickel/manganese oxides — carcinogenic/reprotoxic). Aligns with 산업안전보건법 (OSHA-KR) Article 57 (workplace-environment measurement). Conforms with 화학물질의 등록 및 평가 등에 관한 법률 (ARECA) Articles 23/24 (hazard evaluation, accident preparedness).
4. **Dust-explosion prevention**: Design protective measures based on Kst/MEC assessment; apply static-electricity grounding/bonding, inerting (nitrogen blanketing), and explosion-proof electrical equipment. Aligns with 위험물안전관리법 (DSSMA) Article 15 (handling standards) and Article 27 (facility standards).
5. **Dust-collection operations**: Inspect bag-filter/scrubber differential pressure and operating status; control residual-dust hazards (fire/ignition prevention) during replacement/cleaning.
6. **Emergency response**: Pre-establish metal-fire response using Class-D extinguishing agents (water prohibited where applicable), and isolation/evacuation on dust explosion.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain workplace-environment measurement results, dust-collector inspection logs, and dust-explosion risk-assessment documents.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/battery/battery-battery-cathode-powder-dust-control-record.json`](../../../../../evidence-models/domains/industry/battery/battery-battery-cathode-powder-dust-control-record.json) (skeleton, `status: draft`)

- **Record ID format**: `BATTERY-CATHODE-POWDER-DUST-CONTROL-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as dust composition/particle size, Kst/MEC values, dust-collector status, monitoring results, and respirator fit.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 15
- 위험물안전관리법 Article 27
- 화학물질의 등록 및 평가 등에 관한 법률 Article 23
- 화학물질의 등록 및 평가 등에 관한 법률 Article 24
- 전기안전관리법 Article 16
- 전기안전관리법 Article 22

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |
| 화학물질의 등록 및 평가 등에 관한 법률 | ARECA | Act on the Registration and Evaluation of Chemicals (K-REACH) |
| 전기안전관리법 | ESCA | Electrical Safety Control Act |

## 7. Regulatory Notes
No single dedicated statute governs cathode-active-material handling. Composite anchor: 위험물안전관리법 (DSSMA — combustible-dust and solvent handling/facility standards), 화학물질의 등록 및 평가 등에 관한 법률 (ARECA — hazard evaluation and chemical-accident preparedness), 전기안전관리법 (ESCA — explosion-proof electrical equipment and static-electricity grounding). Also relevant: OSHA-KR Article 57 (workplace-environment measurement for cobalt/nickel/manganese exposure), and the MOEL Dust-Explosion Prevention Technical Guideline. Note, however, that this workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Battery-plant EPC construction, equipment cleaning, and operations & maintenance (O&M) — especially dust-collector replacement and interior cleaning — are heavily outsourced, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client (battery maker) must ensure this workflow's controls (including residual-dust fire and dust-explosion prevention) are applied by cleaning and equipment subcontractors down the contracting chain.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
