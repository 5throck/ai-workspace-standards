# Shipbuilding Industry — Welding Fume/Gas Safety Workflow

> **Status**: This README was finalized in Phase 2 Group C and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent via MCP `kr_safety` + `legalize_kr`). However, the `signature_hazard` extension in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent chronic welding-fume (Mn / hexavalent Cr / ozone) inhalation exposure, high-pressure gas-cylinder (oxygen / acetylene / argon / CO2) handling and gas-leak hazards, and welding-arc electrocution/burn by applying the hierarchy of controls during ship construction and repair welding/cutting operations. Shipyards employ the largest welding workforce in Korean industry, and welding fume is classified IARC Group 1 carcinogenic, causing manganese neurotoxicity, hexavalent-chromium lung cancer, and ozone lung damage. High-pressure gas-cylinder mishandling leads to gas accumulation and explosion; the high voltage of the welding arc causes electrocution and burn incidents. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a shipbuilding-industry-specific welding/cutting fume-and-gas safety procedure that does not duplicate any workflow under `workflows/_shared/`. It is distinct from crane lifting (`heavy-crane-subcontractor-safety`), ship-tank confined space (`ship-tank-confined-space`), and painting fire/toxic (`shipbuilding-painting-coating-fire-toxic`) — welding fume is solid particulate + ozone + UV, whereas painting vapor is liquid solvent + LEL flammability: fundamentally different chemical and physical hazard profiles.

## 2. Scope
- **Industry**: Shipbuilding (code: `shipbuilding`, ship construction and repair)
- **Work covered**: Block-erection and hull-assembly welding, arc welding (SMAW/FCAW/GMAW), gas welding/cutting (oxygen/acetylene), plasma cutting, weld grinding/finishing, welding-gas cylinder transport/connection/storage, in-tank/in-block confined-space welding
- **Trigger points**: Pre-PTW ventilation/gas-detection check, work-environment measurement cycle, introduction of new welding consumable/gas, shift handover, special health-exam cycle

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads welding risk assessment, operates the safe-work-permit (PTW) system, reviews work-environment measurement and special health-exam results, formulates emergency response plans |
| Welding Supervisor | Verifies ventilation/gas-detection status, approves PTW, performs cross-checks before entry, halts work on gas leak or arc anomaly |
| Industrial Hygienist | Conducts welding-fume (Mn/Cr6+) and ozone exposure assessment, work-environment measurement, special health exams, and respirator adequacy checks |
| Welder | Wears supplied-air respirator and welding helmet, complies with ventilation/gas-detection status, secures and grounds cylinders |
| Gas Safety Officer | Controls high-pressure cylinder storage/transport/connection, conducts leak checks, inspects facilities per HPGSCA |
| Electrical Safety Manager | Inspects welding-machine grounding/insulation/interlocks, welding-cable damage, and earth-leakage breaker operation |
| Contractor Safety Officer | Coordinates PTW with the commissioning shipyard, verifies subcontractor welder training and PPE issue |
| Industrial Health & Safety Committee | Reviews welding incidents/near-misses/occupational lung disease, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify welding consumable type (low-hydrogen / high-tensile / stainless), base-metal composition (Cr/Ni content), workspace ventilation capacity, confined-space status, high-pressure cylinder types and storage distances, and welding-machine grounding state. Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Substitute low-toxicity consumables (low-Mn / low-Cr6+) and reduce manual welding through automation/robotics.
   2. **Passive protection**: Local exhaust ventilation (LEV / portable fume extractors), welding partitions/shields, cylinder storage cages and separation walls, automatic fire suppression.
   3. **Active protection**: Continuous gas-leak detection alarms, ventilation-fault interlocks, welding-machine earth-leakage breakers.
   4. **Administrative**: Safe-work permit (hot-work/welding), work-environment measurement, special health exams, shift-change TBM, pre-entry confined-space checks.
   5. **PPE**: Supplied-air respirator / P100 half-mask, auto-darkening welding helmet, welding protective clothing/leather gloves/safety footwear.
3. **Welding-fume exposure control**: Activate LEV before work; perform work-environment measurement (Mn, Cr6+, total dust, ozone); wear supplied-air respirators; undergo special health exams (annual or more frequent). Aligns with 산업안전보건법 (OSHA-KR) Articles 110 (MSDS), 125 (work-environment measurement), and 130 (special health exams).
4. **High-pressure gas-cylinder control**: Store oxygen/acetylene/argon/CO2 cylinders separately (oxygen and fuel-gas ≥6 m apart or behind a fire wall); secure with chains/clamps; immediately replace damaged valves/regulators; check leaks with soap solution or gas detectors. Aligns with 고압가스 안전 관리 및 사업법 (HPGSCA) Articles 11 (safety management regulations), 13 (facility and container safety maintenance), 15 (Safety Manager appointment), 24 (licensing-authority corrective measures), and 26 (accident notification).
5. **Welding-arc electrical safety**: Verify welding-machine grounding/insulation, welding-cable integrity, earth-leakage breaker (ELB) operation; prohibit welding in wet conditions. Aligns with 산업안전보건법 (OSHA-KR) Article 101 (electrical-hazard prevention).
6. **Confined-space welding control**: For in-tank/in-block welding, measure oxygen and gas concentration before entry; ventilate; post an outside attendant; maintain communication. Aligns with 산업안전보건법 (OSHA-KR) Articles 99 (fall/access control) and 100 (structural-collapse safety).
7. **Fire/explosion emergency response**: On gas leak or fire, immediately close gas valves, cut power, evacuate, and activate suppression; pre-establish external fire-department notification. Aligns with 위험물안전관리법 (DSSMA) Article 27 (emergency response).
8. **Recordkeeping & audit**: Generate the evidence record (§5); retain permits, work-environment measurement results, special health-exam records, gas-leak inspection logs, and cylinder ledgers.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-welding-fume-gas-safety-record.json`](../../../../../evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-welding-fume-gas-safety-record.json) (skeleton, `status: draft`)

- **Record ID format**: `SHIPBUILDING-WELDING-FUME-GAS-SAFETY-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as process-specific (SMAW/FCAW/GMAW) fume concentration, Mn/Cr6+/ozone exposure measurement, cylinder type/storage status, confined-space entry records, and special health-exam results.

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
No single dedicated shipbuilding-safety statute exists. Composite anchor: 산업안전보건법 (OSHA-KR — welder protection, fall Article 38, collapse OSHSR Ch.6, electrical/fire safety measures under Article 38 + OSHSR, MSDS preparation/submission Article 110, work-environment measurement Article 125, special health exams Article 130), 고압가스 안전 관리 및 사업법 (HPGSCA — oxygen/acetylene/argon cylinders, safety management regulations Article 11, facility and container safety maintenance Article 13, Safety Manager appointment Article 15, licensing-authority corrective measures Article 24, accident notification Article 26), and 위험물안전관리법 (DSSMA — dangerous-goods storage and handling Article 5, emergency response Article 27). 중대재해처벌법 (SAPA) Articles 4–7 supply the general employer safety-assurance duty. **HPGSCA citation note**: the HPGSCA citations in `schema.yaml` (Art 11/13/15/24/26) are **remediated article numbers** verified by the compliance-agent via live MCP `legalize_kr` (authoritative law.go.kr full-text) — the anchor previously cited Art 14 (deleted 1999.2.8) and the topic-mismatched Art 17/28; `legalize_kr` confirmed Art 11/13/15/24/26 as the substantive in-force articles. Note: the `kr_safety` catalog is stale for HPGSCA (it still indexes the deleted Art 14), so prefer the `k-law` skill (법제처 Open API) for HPGSCA verification (the `legalize_kr` MCP was removed 2026-08-26). The defining feature of this workflow is the **solid-particulate welding fume (Mn/Cr6+/ozone) chronic exposure + high-pressure gas-cylinder physical hazard** composite, fundamentally distinct from the liquid solvent-vapor profile of painting (`shipbuilding-painting-coating-fire-toxic`).

## 8. Outsourcing Note
Shipyard welding is performed predominantly by specialized welding contractors, making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) especially relevant. A large share of the shipyard welding workforce is employed by subcontractors, and welding-fume chronic exposure, missed special health exams, and gas-cylinder mishandling have been repeatedly reported. The commissioning shipyard must ensure this workflow's LEV, work-environment measurement, special health exams, cylinder management, and PTW-coordination controls are applied by welding contractors and their subcontractors down the contracting chain, and where multiple contractors share confined-space work or common gas-storage areas, must explicitly assign responsibility.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
