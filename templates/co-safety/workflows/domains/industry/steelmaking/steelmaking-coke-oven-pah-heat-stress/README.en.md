# Steelmaking Industry — Coke-Oven PAH Carcinogen Exposure and Oven-Top Heat-Stress Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, `signature_hazard` refinement in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent (a) coal-tar-pitch volatile organic compound (PAH, IARC Group 1 carcinogen) inhalation exposure, (b) oven-top extreme-radiant-heat stress, and (c) coke-oven gas (CO·H₂·CH₄) leak / fire / explosion hazards during integrated-steelmill coke-oven-battery operations — coal charging, coke push, oven-top inspection and insulation, leveling, door cleaning, and refractory repair — by applying the hierarchy of controls. Coke-oven workers are an internationally cancer-tracked cohort (IARC monographs); the oven-top of Korea's integrated mills (POSCO Pohang/Gwangyang, Hyundai Steel Dangjin, etc.) is a representative high-risk work surface. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a steelmaking-specific industrial-hygiene and fire/explosion procedure that does not duplicate any workflow under `workflows/_shared/`. Byproduct-gas piping leak detection is covered by `byproduct-gas-leak-prevent`; furnace and molten-metal repair LOTO is covered by `molten-metal-loto`.

## 2. Scope
- **Industry**: Steelmaking (code: `steelmaking`, integrated steel mills — blast furnace / steelmaking / rolling integrated works)
- **Work covered**: Coke-oven-battery oven-top work (charging, push, leveling, inspection), coke-oven door opening/cleaning, refractory repair and lancing, coke-oven gas manifold and valve inspection, PAH-resuspension-zone work in the coal/coke yard
- **Trigger points**: In-service periodic inspection, shift handover, response to PAH/gas alarms, introduction of a new coal type and battery-aging assessment, heat-stress risk increase during hot-weather season

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads coke-oven risk assessment, formulates PAH and heat-stress control plans, operates the safe-work-permit system, formulates emergency response plans |
| Industrial Hygienist | Personal-exposure sampling for coal-tar-pitch PAH, interprets work-environment-measurement results, judges adequacy of respiratory protection |
| Occupational Physician | Plans the special health examination (carcinogen exposure) for coke-oven workers, follow-up of abnormal findings |
| Supervisor | Approves safe-work permits, verifies gas concentration and heat-stress index before oven-top entry, halts work on anomaly |
| Worker | Wears respiratory protection and heat-shield clothing, complies with permit conditions, evacuates and reports on gas/temperature alarm |
| Facility Engineer | Inspects coke-oven gas capture/ventilation, cooling and heat-shielding, and gas-detection alarm systems |
| Industrial Health & Safety Committee | Post-incident review of PAH exposure, cooperates with epidemiological investigation of cancer cases, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify per-battery PAH sources (charging, push, door leakage), oven-top radiant temperature and WBGT index, and potential coke-oven-gas (CO·H₂·CH₄) leak zones. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: At new-battery design stage, adopt back-pressure-charged sealed ovens, mechanized push/leveling, and oven-top de-manning.
   2. **Engineering**: Local exhaust ventilation (LEV) with activated-carbon adsorption, door lapping and gas sealing, heat-shield screens and cooling airflow, fixed gas detectors (CO/LEL) with continuous monitoring, automatic shutoff valves.
   3. **Administrative**: Safe-work permit (fire/chemical/heat), shift-change TBM, oven-top residence-time minimization (work-rest cycle), heat-acclimatization program during hot season, periodic work-environment measurement (benzo[a]pyrene, etc.) and special health examination (carcinogen). These monitoring activities are the implementation of the risk-assessment duty (Art 36) and the safety-assurance duty (SAPA Art 4).
   4. **PPE**: Powered air-purifying respirator (PAPR) or supplied-air mask for organic-vapor/PAH service, heat-resistant and radiant-shield clothing, protective gloves and face shield (last resort).
3. **Coke-oven gas leak control**: On CO/LEL alarm, immediately isolate the affected zone, maximize ventilation, eliminate ignition sources, and evacuate workers. Aligns with 고압가스 안전관리 및 사업법 (HPGSCA) Article 13 (facility and container safety maintenance) and Article 26 (accident notification). Recovery work proceeds only after re-measurement of gas concentration.
4. **Heat-stress management**: Under high-heat and high-radiant-load conditions, measure WBGT on the oven top, apply work-rest cycles, provide cool drinking water and rest areas, and monitor early symptoms of heat illness. Field application of the risk-assessment duty (Art 36).
5. **PAH exposure monitoring**: Conduct periodic personal sampling (pump + filter), quantify carcinogenic PAHs (benzo[a]pyrene, etc.), classify exposure bands, and on exceedance remediate the source (door leakage, charging dust). Link to special health examination (skin, respiratory, bladder).
6. **Emergency response**: Pre-establish procedures for immediate isolation, evacuation, and rescue on coke-oven fire, gas explosion, or mass PAH exposure. For coke-oven gas: remove ignition sources then dilute; for fire: seal the battery, nitrogen purge, or apply specialized extinguishment.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain safe-work permits, gas-detection logs, work-environment-measurement results, special-health-exam results, and oven-top residence-time logs.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-coke-oven-pah-heat-stress-record.json`](../../../../../evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-coke-oven-pah-heat-stress-record.json) (skeleton, `status: draft`)

- **Record ID format**: `STEELMAKING-COKE-OVEN-PAH-HEAT-STRESS-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as coke-oven battery ID, oven-top residence time, PAH (benzo[a]pyrene) concentration, WBGT index, gas-detection alarm history, special-health-exam results.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)
- 고압가스 안전관리 및 사업법 Article 11
- 고압가스 안전관리 및 사업법 Article 13
- 고압가스 안전관리 및 사업법 Article 15
- 고압가스 안전관리 및 사업법 Article 24
- 고압가스 안전관리 및 사업법 Article 26
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 고압가스 안전관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |
| 위험물안전관리법 | DSSMA | Dangerous Substances Safety Management Act |

## 7. Regulatory Notes
No single dedicated statute governs steelmaking. Composite anchor: 산업안전보건법 (OSHA-KR — risk assessment, safety measures, fall/collapse/electrical (Art 38 + OSHSR) (Art 101), and the general basis for work-environment-measurement and special-health-exam duties), 고압가스 안전관리 및 사업법 (HPGSCA — safety-management regulations (Art 11), facility/container safety maintenance (Art 13), Safety Manager appointment (Art 15), corrective measures (Art 24), and accident notification (Art 26) for coke-oven-gas manifold and storage facilities), and 위험물안전관리법 (DSSMA — storage and handling standards (Art 5) and emergency measures / corrective orders (Art 27) for coal, coke, and coal-tar dangerous goods). Conceptually, OSHA-KR work-environment-measurement (Art 125 family) and special health examination (Art 130 family) are the natural anchors for coke-oven PAH industrial-hygiene control; however, this workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Coke-oven refractory repair, lancing, and door maintenance are heavily outsourced to specialty refractory contractors, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client (the steel mill) must ensure this workflow's controls (PAH exposure monitoring, heat-shield PPE, gas-detection evacuation procedures) are applied by refractory and maintenance subcontractors down the contracting chain.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
