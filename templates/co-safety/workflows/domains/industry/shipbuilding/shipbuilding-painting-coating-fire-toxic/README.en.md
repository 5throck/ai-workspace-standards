# Shipbuilding Industry — Painting/Coating Fire & Toxic Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, the `signature_hazard` extension in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent combustible paint-vapor LEL explosion, solvent-vapor inhalation exposure, confined-area painting oxygen deficiency, and paint-bay fire by applying the hierarchy of controls during ship painting and coating operations. Painting is the single most iconic fatal-incident class in Korean shipbuilding — major disasters including the 2015 Samsung Heavy Industries drill-ship painter-team fire and the 2019 Hyundai Heavy Industries painting-fire have recurred. When solvent vapors (xylene, toluene, methyl ethyl ketone, etc.) reach the Lower Explosive Limit (LEL), a single ignition source — static electricity, spark, or hot work — triggers a catastrophic explosion/fire; chronic exposure additionally causes organic-solvent syndrome and neurotoxicity. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a shipbuilding-industry-specific painting/coating safety procedure that does not duplicate any workflow under `workflows/_shared/`. It is distinct from crane lifting (`heavy-crane-subcontractor-safety`), ship-tank confined-space entry (`ship-tank-confined-space`), and welding fume (`shipbuilding-welding-fume-gas-safety`), and is scoped specifically to painting inside the **paint bay/shop facility** to distinguish it from in-tank painting.

## 2. Scope
- **Industry**: Shipbuilding (code: `shipbuilding`, ship construction and repair)
- **Work covered**: Block/hull painting inside the paint bay/shop, coating operations (spray/roller/brush), surface preparation (sandblast/grit), paint/thinner mixing and transport, painting-equipment cleaning and maintenance, drying/curing oven operation
- **Scope exclusion**: In-tank painting of cargo/ballast tanks triggers **both** this workflow's fire/chemical controls **and** the confined-space-entry procedures of `ship-tank-confined-space`. This workflow's primary scope is the paint bay/shop facility.
- **Trigger points**: Pre-PTW ventilation/gas-detection check, response to abnormal gas-concentration alarms, introduction of new paint/thinner, shift handover

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads painting risk assessment, operates the safe-work-permit (PTW, hot-work) system, formulates emergency response plans, reviews work-environment measurement results |
| Painting Supervisor | Verifies ventilation/gas-detection status, approves PTW, performs cross-checks before entry, halts work on abnormal gas concentration |
| Industrial Hygienist | Conducts solvent-vapor exposure assessment, work-environment measurement, MSDS review, and respirator adequacy checks |
| Painter | Wears supplied-air respirator, complies with ventilation/gas-detection status, implements static-electricity control |
| Facility Engineer | Inspects paint-bay ventilation, gas detection, fire suppression, and explosion-proof electrical equipment |
| Contractor Safety Officer | Coordinates PTW with the commissioning shipyard, verifies subcontractor training and PPE issue |
| Industrial Health & Safety Committee | Reviews painting incidents/near-misses/occupational illnesses, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify the flash point, vapor pressure, and exposure limits (TWA/STEL) of the paint/thinner in use; workspace ventilation capacity; ignition-source presence (static, electrical, hot work); and the MSDS chemical profile. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Substitute water-based / low-VOC paints; physically separate the painting zone from hot-work (welding/cutting) zones.
   2. **Passive protection**: Paint-bay bulkheads/fire doors, local exhaust ventilation (LEV), automatic suppression (sprinkler/inert gas), explosion-proof electrical equipment.
   3. **Active protection**: Continuous LEL gas-concentration monitoring, ventilation-fault interlocks, static-electricity elimination devices.
   4. **Administrative**: Safe-work permit (hot-work/painting), shift-change TBM, work-start-after-ventilation rule, prohibition on concurrent hot work.
   5. **PPE**: Supplied-air respirator / organic-vapor half-mask, chemical-protective suit, face shield, anti-static footwear (last resort).
3. **Flammable vapor LEL control**: Activate ventilation and measure LEL before and during work; suspend work at 25% LEL; control ignition sources (electrical, hot work, static). Aligns with 위험물안전관리법 (DSSMA) Article 5 (dangerous-goods storage and handling).
4. **Solvent-vapor exposure control**: Operate LEV, perform work-environment measurement, wear supplied-air respirators, observe MSDS exposure limits. Aligns with 산업안전보건법 (OSHA-KR) Article 110 (MSDS).
5. **Confined-area O2 deficiency**: For in-tank/in-block painting, measure oxygen (19.5–23.5%) and gas concentration before entry; ventilate; post an outside attendant. Aligns with 산업안전보건법 (OSHA-KR) Article 99 (fall/access control) and Article 100 (structural collapse safety).
6. **Static/ignition-source control**: Require Ex-rated explosion-proof electrical equipment throughout the paint bay; provide grounding/static-dissipation mats; prohibit concurrent hot work. Aligns with 산업안전보건법 (OSHA-KR) Article 101 (electrical/fire hazard).
7. **Fire/explosion emergency response**: On gas/fire alarm, immediately stop work, cut power, evacuate, and activate suppression; pre-establish external fire-department notification. Aligns with 위험물안전관리법 (DSSMA) Article 27 (emergency response).
8. **High-pressure gas facility control**: For inert-gas (nitrogen/CO2) use, comply with 고압가스 안전 관리 및 사업법 (HPGSCA) Article 11 (safety management regulations), Article 13 (facility and container safety maintenance), Article 15 (Safety Manager appointment), Article 24 (licensing-authority corrective measures), and Article 26 (accident notification).
9. **Recordkeeping & audit**: Generate the evidence record (§5); retain permits, gas-concentration logs, work-environment measurement results, and MSDS availability records.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-painting-coating-fire-toxic-record.json`](../../../../../evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-painting-coating-fire-toxic-record.json) (skeleton, `status: draft`)

- **Record ID format**: `SHIPBUILDING-PAINTING-COATING-FIRE-TOXIC-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as paint type/flash point/exposure limit, LEL measurement, ventilation capacity, gas-detection alarm history, supplied-air-respirator status, and inert-gas usage.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated). HPGSCA citations use the remediated article numbers (Article 11/13/15/24/26).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27
- 고압가스 안전관리 및 사업법 Article 11
- 고압가스 안전관리 및 사업법 Article 13
- 고압가스 안전관리 및 사업법 Article 15
- 고압가스 안전관리 및 사업법 Article 24
- 고압가스 안전관리 및 사업법 Article 26

### Gloss
| Korean | Abbreviation | English |
|--------|--------------|---------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |
| 고압가스 안전 관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |

## 7. Regulatory Notes
No single dedicated shipbuilding-safety statute exists. Composite anchor: 위험물안전관리법 (DSSMA — flammable paint/thinner dangerous-goods storage and handling Article 5, emergency response Article 27), 고압가스 안전 관리 및 사업법 (HPGSCA — inert-gas/spray-gas facilities, safety management regulations Article 11, facility and container safety maintenance Article 13, Safety Manager appointment Article 15, licensing-authority corrective measures Article 24, accident notification Article 26), and 산업안전보건법 (OSHA-KR — painter protection, fall Article 38, collapse OSHSR Ch.6, electrical/fire safety measures Article 38 + OSHSR, MSDS preparation/submission Article 110 and posting/education Article 114). 중대재해처벌법 (SAPA) Articles 4–7 supply the general employer safety-assurance duty. **HPGSCA citation note**: the HPGSCA citations in `schema.yaml` (Art 11/13/15/24/26) are **remediated article numbers** verified by the compliance-agent via live MCP `legalize_kr` (authoritative law.go.kr full-text) — the anchor previously cited Art 14 (deleted 1999.2.8) and the topic-mismatched Art 17/28; `legalize_kr` confirmed Art 11/13/15/24/26 as the substantive in-force articles. Note: the `kr_safety` catalog is stale for HPGSCA (it still indexes the deleted Art 14), so prefer the `k-law` skill (법제처 Open API) for HPGSCA verification (the `legalize_kr` MCP was removed 2026-08-26). The defining feature of this workflow is the **paint-bay/shop LEL explosion + chronic solvent exposure** composite hazard, scoped to distinguish it from tank-entry asphyxiation (`ship-tank-confined-space`).

## 8. Outsourcing Note
Shipyard painting/coating work is performed predominantly by specialized painting contractors, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. Most of Korea's major painting-fire disasters occurred during outsourced painter-team work. The commissioning shipyard must ensure this workflow's ventilation, gas-detection, static-electricity, supplied-air-respirator, and PTW-coordination controls are applied by painting contractors and their subcontractors down the contracting chain, and where multiple contractors share the same paint bay, must explicitly assign scope-overlap and concurrent-hot-work prohibition responsibilities.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
