# Defense Industry — Munitions Storage Magazine Safety Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent explosion, fire, and spontaneous-reaction hazards in munitions and explosives magazines at defense-industry manufacturing sites, by applying the hierarchy of controls. The critical controls at the storage stage are quantity-distance (QD) criteria, compatibility-group segregation, ignition-source control (static, lightning, mechanical spark/friction), and ventilation/temperature-humidity management; deviations cause large-scale casualties and facility loss. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a defense-industry-specific magazine-safety procedure that does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Defense (code: `defense`, defense-industry manufacturing)
- **Work covered**: Receipt, transfer, and storage of munitions, explosives, propellants, and pyrotechnics; magazine operation (above-ground, semi-underground, earth-covered); compatibility-group classified storage; cyclic inventory inspection; isolation of defective/rejected munitions; access control and stockpile inventory
- **Trigger points**: Introduction of a new munition type, magazine expansion or modification, scheduled QD re-assessment, discovery of defective/aged munitions, lightning or fire alarm

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads explosion/fire risk assessment, verifies QD and compatibility compliance, formulates emergency response plans |
| Explosives Safety Officer | Classifies munitions and assigns compatibility groups, approves storage layout, judges isolation of defective items |
| Magazine Supervisor | Enforces access control, conducts inventory, inspects ventilation/temperature-humidity and lightning grounding; halts work and evacuates on anomaly |
| Worker | Follows static- and friction-suppression procedures, wears PPE, reports abnormal signs (abnormal heating, off-gassing, discoloration) |
| Facility Engineer | Inspects and maintains magazine walls, ventilation, suppression, lightning grounding, and static-grounding systems |
| Industrial Health & Safety Committee | Reviews explosion/fire incidents and near-misses, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify stored munition NET/explosive weight, classification (1.1–1.6), compatibility group, flash/auto-ignition temperature, ignition sources (static, lightning, friction, impact), and distance to surrounding facilities. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Promptly destroy/isolate defective or unstable munitions; minimize excess inventory.
   2. **Passive protection**: QD via barricades/earthwork, earth-covered magazines, physical separation by compatibility group, lightning and static grounding.
   3. **Active protection**: Continuous temperature/humidity/gas monitoring, fire detection and automatic suppression (suppression method is munition-type-restricted), grounding-fault alarms.
   4. **Administrative**: Access control and inventory system, compatibility and storage-limit criteria (SOPs), permit system, periodic QD re-assessment.
   5. **PPE**: Flame-resistant clothing, anti-static garments, safety footwear, safety glasses, hearing protection (last resort).
3. **Storage layout & compatibility**: Apply 총포·도검·화약류 등 단속법 (FSESA) Article 9 (explosives-storage licensing and criteria) and Article 23 (handling criteria) — storage limits, compatibility-group segregation, floor/wall clearance.
4. **Ignition-source control**: Inspect lightning and static grounding (bonding/grounding); use non-sparking tools; designate restricted zones for electronic equipment; strictly control open flame and firearms.
5. **Environmental control**: Comply with munition-specific temperature/humidity criteria; ventilate to prevent gas accumulation; check for water ingress and leaks.
6. **Emergency response**: On explosion/fire, evacuate immediately using distance and barricades; fight fire only within munition-specific limits; when not feasible, evacuate and isolate; pre-establish external-notification procedures (fire service, military/police).
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain inventory ledgers, ignition-source inspection logs, defective-munition isolation records, and QD assessments.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/defense/defense-defense-munitions-storage-magazine-safety-record.json`](../../../../../evidence-models/domains/industry/defense/defense-defense-munitions-storage-magazine-safety-record.json) (skeleton, `status: draft`)

- **Record ID format**: `DEFENSE-MUNITIONS-STORAGE-MAGAZINE-SAFETY-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as munition classification/NET, compatibility group, storage limit and QD distance, ignition-source inspection results, and temperature/humidity logs.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 방위사업법 Article 28
- 방위사업법 Article 53
- 총포·도검·화약류 등 단속법 Article 9
- 총포·도검·화약류 등 단속법 Article 23

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 방위사업법 | DAA | Defense Acquisition Act |
| 총포·도검·화약류 등 단속법 | FSESA | Act on the Safety Control of Firearms, Swords, Explosives, etc. |

## 7. Regulatory Notes
Defense munitions storage is governed jointly by explosives safety (총포·도검·화약류 등 단속법/FSESA) and defense-industry safety management (방위사업법/DAA). FSESA Article 9 (storage licensing and criteria) and Article 23 (handling criteria) are the directly applicable storage-standard articles; DAA Article 28 (defense-facility safety) and Article 53 (safety-management system) establish the overarching industrial-safety obligations. Note: DAA Article 18 was deleted on 2020.3.31 (confirmed in prior compliance remediation); the current safety-management anchor is Article 53. This workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Defense manufacturing involves a prime contractor (OEM) and multiple subcontractors (munition maintenance, transfer and storage outsourcing, facility maintenance, waste disposal), making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. The prime must ensure this workflow's controls (ignition-source control, compatibility segregation, QD compliance) are applied by storage, transfer, and maintenance subcontractors down the contracting chain, and must specify security/access and safety requirements in the contract.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
