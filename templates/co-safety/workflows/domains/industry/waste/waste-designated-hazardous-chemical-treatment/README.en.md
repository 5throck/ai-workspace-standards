# Waste Industry — Designated-Hazardous-Chemical Treatment Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, `signature_hazard` refinement in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically manage (a) hazardous-chemical (heavy-metal / solvent / acid-alkali) inhalation and contact exposure, (b) leak-incident response, (c) fire/explosion hazard, and (d) treatment-facility licensing and operation compliance during the operation of designated-waste (지정폐기물) treatment facilities — neutralization, solidification, incineration, stabilization, solvent recovery — by applying the hierarchy of controls. Korea generates around 5 million tons of designated waste per year, and treatment-facility workers are a representative high-risk population simultaneously exposed to both chronic chemical exposure and acute leak incidents. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4), the risk-assessment duty (산업안전보건법/OSHA-KR Article 36), the waste-treatment-business licensing duty (폐기물관리법/WCA Article 25), and the accident-preparedness-substance management duty (화학물질관리법/CCA Article 23).

This is an **industry-unique workflow** — a waste-industry-specific chemical-treatment and licensing procedure that does not duplicate any workflow under `workflows/_shared/`. Incinerator/shredder maintenance LOTO is covered by `incinerator-shredder-loto`; sewage/manhole H₂S asphyxiation prevention is covered by `sewage-confined-h2d-prevent`.

## 2. Scope
- **Industry**: Waste (code: `waste`, treatment / recycling / incineration)
- **Work covered**: Designated-waste inbound inspection and sampling, neutralization / solidification / stabilization reactor operation, filtration / dewatering / drying, solvent recovery and purification, reactor and storage-tank cleaning and maintenance, leak-incident response and decontamination
- **Trigger points**: Inbound of a new waste stream, process change, reactor/storage-tank entry work, response to leak alarms, license renewal and periodic regulatory inspection

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads facility risk assessment, formulates chemical-control plans, operates the safe-work-permit system, formulates emergency response plans |
| Industrial Hygienist | Personal-exposure sampling for hazardous chemicals, work-environment measurement, judges adequacy of MSDS and PPE selection |
| Environmental Manager | Compliance with 폐기물관리법 (WCA) Article 25 license conditions, inbound waste assay and composition verification, manifest management |
| Chemical Safety Manager | Authors and maintains the 화학물질관리법 (CCA) Article 23 accident-preparedness-substance management plan, formulates accident-preparedness scenarios |
| Supervisor | Approves safe-work permits, verifies gas concentration and PPE before reactor/tank entry, halts work on anomaly |
| Worker | Wears chemical-protective clothing and respiratory protection, complies with permit conditions, evacuates and reports on leak/anomaly |
| Facility Engineer | Inspects local exhaust ventilation (LEV), scrubbers, secondary-containment systems, and leak-detection alarm systems |
| Industrial Health & Safety Committee | Post-incident review of chemical-exposure and leak incidents, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify per-waste-stream exposure routes (inhalation, contact, ingestion) for heavy metals, solvents, acid/alkali, and accident-preparedness substances; chemical-reaction hazards in reactors and storage tanks; and leak-dispersion pathways. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk assessment).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Closed-loop automated neutralization / solidification, remotely operated reactors, rejection of non-conforming inbound waste through pre-acceptance assay.
   2. **Engineering**: Enclosed reactors and storage tanks, LEV with scrubbers and activated-carbon adsorption, automated dosing, secondary containment dikes and spill berms, fixed gas detectors (acid/alkali vapor, solvent, LEL).
   3. **Administrative**: Comply with 폐기물관리법 (WCA) Article 25 license conditions; maintain the 화학물질관리법 (CCA) Article 23 accident-preparedness-substance management plan; author/submit and post MSDS (산업안전보건법 Articles 110, 114); issue safe-work permits (chemical/confined/fire); perform inbound assay and manifest control; conduct periodic work-environment measurement and special health examinations; run leak-response drills.
   4. **PPE**: Chemical-protective clothing (separate acid/alkali vs solvent suits), PAPR or supplied-air respirator, chemical-resistant gloves, safety glasses, face shield (last resort).
3. **Accident-preparedness-substance control**: Where the facility handles accident-preparedness substances under 화학물질관리법 (CCA) Article 23, author and retain the management plan, formulate accident-preparedness scenarios, and file periodic reports. Aligns with 폐기물관리법 (WCA) Article 13 (waste-treatment standards).
4. **Inbound assay and process control**: Pre-verify inbound waste composition (sample analysis) and reject non-conforming or unidentified material; monitor exothermic reaction and gas evolution during reactor charging; automatically track process variables (temperature, pH, pressure).
5. **Leak-incident response**: On leak alarm, isolate the affected zone, activate secondary containment, restrict the contaminated area, apply absorbents and neutralizers, and evacuate workers. For large leaks, dispatch the fire service under 소방기본법 (BFS) Article 16 (firefighting operations) and notify the relevant authorities. Post-incident decontamination and waste processing follow WCA standards.
6. **Emergency response**: Pre-establish procedures for immediate isolation, evacuation, and rescue on chemical fire, explosion, or mass exposure. For oxidizer/reactive-substance fires, observe MSDS restrictions on extinguishing media (e.g., no water).
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain manifests, safe-work permits, gas-detection logs, work-environment-measurement results, the accident-preparedness-substance management plan, and leak-incident response records.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/waste/waste-waste-designated-hazardous-chemical-treatment-record.json`](../../../../../evidence-models/domains/industry/waste/waste-waste-designated-hazardous-chemical-treatment-record.json) (skeleton, `status: draft`)

- **Record ID format**: `WASTE-DESIGNATED-HAZARDOUS-CHEMICAL-TREATMENT-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as facility license number, inbound waste composition (heavy metals, solvents, acid/alkali, accident-preparedness substances), reactor ID, leak-incident history, gas-detection alarm history, MSDS references.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 폐기물관리법 Article 13
- 폐기물관리법 Article 25
- 소방기본법 Article 16
- 화학물질관리법 Article 23

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 폐기물관리법 | WCA | Wastes Control Act |
| 소방기본법 | BFS | Basic Fire Services Act |
| 화학물질관리법 | CCA | Chemicals Control Act (사고대비물질 — accident-preparedness substances) |

## 7. Regulatory Notes
Waste treatment is governed primarily by the 폐기물관리법 (WCA), which regulates treatment standards (Art 13) and waste-treatment-business licensing and operation (Art 25). Adjacent anchors: 소방기본법 (BFS — basis for firefighting response to chemical fire/explosion, Art 16) and 화학물질관리법 (CCA — accident-preparedness-substance management plan and accident-preparedness duties, Art 23). **Correction note — CCA vs ARECA**: this workflow's `schema.yaml` legal_basis cites `화학물질관리법 Article 23` (CCA, 사고대비물질). This is a distinct statute from `화학물질의 등록 및 평가 등에 관한 법률` (ARECA / K-REACH). The accident-preparedness-and-response duty for the accident-preparedness substances (heavy-metal sludge, acid waste liquid, etc.) handled by designated-waste treatment facilities finds its natural anchor in CCA Article 23; this corrected citation was confirmed by the compliance-agent via live MCP verification. 산업안전보건법 (OSHA-KR) provides the general basis for the risk-assessment (Art 36), incident-recording (Art 57), MSDS (Art 110 family), work-environment-measurement, and special-health-examination duties.

## 8. Outsourcing Note
Designated-waste collection, transport, and treatment is structured as a multi-tier contracting chain (generator → hauler → treatment facility), making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client (the generator or the treatment-facility operator) must ensure that haulers and downstream treatment subcontractors apply WCA Article 25 license conditions, accident-preparedness-substance handling safety measures, MSDS posting, and leak-response procedures down the contracting chain. Transport-incident liability rests with the hauler; treatment-incident liability rests with the treatment facility — each bears its own safety-assurance obligation.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
