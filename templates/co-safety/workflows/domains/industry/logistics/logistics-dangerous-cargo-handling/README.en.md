# Logistics Industry — Dangerous Cargo Handling Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent leak, fire, explosion, inhalation exposure, and environmental-release hazards during the loading/unloading, transfer, and yard storage of IMDG dangerous goods (flammable, combustible, toxic, corrosive, spontaneously-reactive substances) at ports, by applying the hierarchy of controls. Dangerous cargo in a dense port environment compounds with cranes, forklifts, and containers to drive complex incidents; incompatible-class co-loading in particular causes reactions and fires on leakage. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a port-logistics-specific dangerous-cargo-handling procedure that does not duplicate any workflow under `workflows/_shared/`. (Forklift-strike prevention is handled by the `logistics-forklift-pedestrian-strike-prevention` workflow.)

## 2. Scope
- **Industry**: Logistics (code: `logistics`, port and freight handling)
- **Work covered**: Dangerous-goods container loading/unloading, tank-container/IBC/drum discharge, yard storage and segregation, cargo-crane and straddle-carrier operation, leak-emergency response, dangerous-cargo handover
- **Trigger points**: Dangerous-goods berth assignment, pre-handling MSDS and manifest verification, leak/abnormal-sign report, decision to suspend work on severe weather

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads dangerous-goods fire/leak risk assessment, formulates emergency response plans; fulfils the port Safety Manager legal duty |
| Dangerous Goods Safety Advisor | Reviews IMDG classification and incompatibility, verifies the manifest, approves loading/stowage layout |
| Stevedore Supervisor | Approves handling permits, pre-checks PPE and firefighting equipment, halts work and evacuates on anomaly |
| Handler / Crane Operator | Wears PPE, prevents incompatible co-loading, immediately reports leak signs |
| Facility Engineer | Inspects and maintains firefighting, leak-detection, oil-water separator, and ventilation systems; manages crane and gear safety devices |
| Industrial Health & Safety Committee | Reviews leak, fire, and near-miss events, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify cargo IMDG Class/UN number, flash point, toxicity, reactivity, incompatible combinations, handling equipment and routing, weather conditions, and personnel density. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Substitute alternative materials/packaging (reinforced IBC), minimize handling (dedicated berth).
   2. **Passive protection**: Physical separation and isolation distance for incompatible cargo, oil-boom and oil-water separator, leak-detection and automatic suppression, dedicated yard zone.
   3. **Active protection**: Continuous gas/smoke monitoring, wind tracking, stop-work threshold alarms.
   4. **Administrative**: Handling permit, pre-job MSDS briefing, incompatibility table and manifest verification, TBM and shift handover.
   5. **PPE**: Chemical suit, respirator (organic-vapor/acid cartridge), safety goggles, gloves, safety footwear (last resort).
3. **Loading & transport standards**: Comply with 위험물안전관리법 (DSSMA) Article 20 (transport of dangerous goods) — packaging, stowage, and marking standards; apply IMDG Code segregation-table isolation distances and separation by Class.
4. **Cargo-handling control**: Verify manifest and MSDS in advance; inspect container exterior for damage/leak before handling; observe rated loads on cranes and gear; suspend work in high winds or severe weather.
5. **Incompatibility control**: Prohibit adjacent stowage of reactive combinations (oxidizers with flammables, acids with bases); apply isolation distance and barrier walls.
6. **Emergency response**: On leak, immediately stop work, isolate, and contain with absorbents/booms; on fire, use Class-appropriate agents (foam/dry powder/CO2; water restricted); pre-establish notification to Coast Guard, fire service, and Port Authority; establish upwind evacuation routes.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain manifests, handling permits, leak-inspection logs, and emergency-response records.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/logistics/logistics-logistics-dangerous-cargo-handling-record.json`](../../../../../evidence-models/domains/industry/logistics/logistics-logistics-dangerous-cargo-handling-record.json) (skeleton, `status: draft`)

- **Record ID format**: `LOGISTICS-DANGEROUS-CARGO-HANDLING-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as IMDG Class/UN number, incompatible combinations, isolation distance, leak-inspection results, and firefighting-system status.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 항만안전특별법 Article 4
- 항만안전특별법 Article 5
- 항만안전특별법 Article 6
- 항만안전특별법 Article 8
- 항만안전특별법 Article 9
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 위험물안전관리법 Article 20

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 항만안전특별법 | PSSA | Port Safety Special Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |

## 7. Regulatory Notes
Port dangerous-cargo handling is governed jointly by the 항만안전특별법 (PSSA) and the 위험물안전관리법 (DSSMA). **PSSA Article 6 (safety-assurance duties of port-transport participants) is the substantive safety-obligation article**, while **PSSA Article 4 (relation to other laws) is a procedural priority-of-application clause** (for dangerous-goods transport, DSSMA takes precedence). **위험물안전관리법 (DSSMA) Article 20 (transport of dangerous goods) is the directly applicable article** governing packaging, stowage, marking, and carriage standards. Internationally, the IMDG Code segregation table (Classes 1–9) is the operational basis for incompatibility control and isolation distance. This workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Port operations depend heavily on stevedore contractors, 3PL carriers, and equipment-leasing firms, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) central. The terminal operator must apply this workflow's controls (MSDS briefing, incompatibility segregation, leak response) equally to handling, transport, and yard subcontractors down the contracting chain, and must specify safety-responsibility boundaries in contracts wherever work areas overlap.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
