# Battery Industry — Cell Formation Electrical Safety Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent electrocution (high-voltage DC), arc flash, flammable-electrolyte-vapor fire/explosion, and thermal-runaway hazards during lithium-ion secondary-cell formation, aging, and inspection by applying the hierarchy of controls. The formation process applies several to several-tens of volts DC per cell, and stacked strings form high-voltage assemblies, making it a representative high-risk process for electrocution and arc-flash incidents. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a battery-industry-specific electrical-safety procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Battery (code: `battery`, lithium-ion secondary-cell manufacturing)
- **Work covered**: Cell formation charge/discharge, aging-rack operation, OC/IR inspection, string/module stacking and testing, high-voltage chamber access, formation-equipment maintenance
- **Trigger points**: Pre-operation safety check of formation equipment, shift handover, response to abnormal voltage/temperature alarms, introduction of a new cell type

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads electrical/fire risk assessment, operates the safe-work-permit system for formation, formulates emergency response plans |
| Electrical Safety Manager | Verifies electrical safety of formation equipment, applies de-energization/grounding/Lockout/Tagout, judges adequacy of insulating PPE |
| Supervisor / Work Lead | Approves safe-work permits, performs cross-checks before chamber entry, halts work on anomaly |
| Worker | Wears insulating PPE, complies with permit conditions, evacuates and reports on gas/temperature alarm |
| Facility Engineer | Inspects ventilation, gas-detection, and fire-suppression status of formation chambers |
| Industrial Health & Safety Committee | Reviews electrical/fire incidents and near-misses, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify formation voltage/current levels, number of stacked strings, likelihood of electrolyte-vapor release, and thermal-runaway propagation paths. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Distribute low-voltage layouts at the design stage; apply thermal-propagation barriers.
   2. **Passive protection**: Bulkheads between formation chambers, ventilation/gas-detection/automatic suppression, insulating mats.
   3. **Active protection**: Over-voltage/over-current/over-temperature interlocks, automatic breakers.
   4. **Administrative**: Safe-work permit (electrical/fire), shift-change TBM, keep-out during charge.
   5. **PPE**: Insulating gloves/footwear/face shield/arc-rated clothing (last resort).
3. **Electrical safety control**: De-energize, ground, discharge, and Lockout/Tagout formation racks before entry; verify zero residual energy. Aligns with 전기안전관리법 (ESCA) Article 16 (Electrical Safety Manager) and Article 22 (safety inspection).
4. **Flammable vapor & fire control**: On electrolyte-vapor release (ethyl methyl carbonate, etc.), activate ventilation and gas-detection alarms; on fire, isolate the chamber and actuate suppression. Aligns with 위험물안전관리법 (DSSMA) Article 15 (handling standards) and Article 27 (facility standards).
5. **Thermal-runaway prevention**: On cell over-temperature alarm, immediately disconnect and isolate the affected rack; prevent propagation to adjacent cells.
6. **Emergency response**: Pre-establish procedures for immediate de-energization, evacuation, and rescue/fire-call on electrocution, arc-burn, or fire.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain permits, inspection sheets, and alarm logs.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/battery/battery-battery-cell-formation-electrical-safety-record.json`](../../../../../evidence-models/domains/industry/battery/battery-battery-cell-formation-electrical-safety-record.json) (skeleton, `status: draft`)

- **Record ID format**: `BATTERY-CELL-FORMATION-ELECTRICAL-SAFETY-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as formation voltage/current level, stacked-string count, grounding/discharge verification, gas-detection alarm history.

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
No single dedicated statute governs lithium-ion battery manufacturing. Composite anchor: 위험물안전관리법 (DSSMA — flammable electrolyte solvents, cathode-active-material handling standards), 화학물질의 등록 및 평가 등에 관한 법률 (ARECA — chemical-accident prevention and hazard evaluation), 전기안전관리법 (ESCA — high-voltage formation/charging/testing equipment). Also relevant: OSHA-KR Article 101 (electrical hazard) and Article 99 (fall prevention during upper rack assembly). Note, however, that this workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Battery-plant EPC construction and formation-equipment operations & maintenance (O&M) are heavily outsourced, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The commissioning client (battery maker) must ensure this workflow's controls are applied by EPC contractors and O&M subcontractors down the contracting chain.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
