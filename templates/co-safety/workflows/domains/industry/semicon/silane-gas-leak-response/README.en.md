# Semiconductor Fab Industry — Silane Gas Leak Response Workflow

> **Status**: This README was finalized in Task 12. However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review (`status: draft`). Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Establish a rapid detection, evacuation, isolation, mitigation, and post-incident investigation procedure for silane (SiH₄) gas leaks in semiconductor fabs, to secure worker safety and prevent serious accidents from auto-ignition, fire, and explosion. Silane has a low auto-ignition temperature and can spontaneously ignite in air; high-concentration leaks carry immediate fire/explosion risk. It is a representative pyrophoric gas.

This is an **emergency-response workflow** and an **industry-unique workflow** — it does not duplicate any workflow under `workflows/_shared/`.

## 2. Scope
- **Industry**: Semiconductor fabrication (code: `semicon`)
- **Target gas**: Silane (SiH₄) and equivalent pyrophoric silicon-family gases (disilane, trisilane). The same response pattern may be extended to other flammable/pyrophoric gases.
- **Trigger points**: Gas-detector alarm, worker olfactory/visual report, or process safety-system (BMS/GMS) alert.

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| High-Pressure Gas Safety Manager | On-scene command of the leak incident; decides isolation/ventilation/purge; notifies regulators |
| Safety & Health Manager | Overall incident response; confirms worker evacuation and headcount; leads post-incident investigation |
| Supervisor / Work Lead | Receives and broadcasts the initial alarm; accounts for personnel; calls medical support |
| Worker | Evacuates immediately on alarm; never attempts ad-hoc extinguishment; reports leak location and conditions |
| Emergency Response Team | Valve shut-off, ventilation, inert-gas purge (trained personnel only); on fire, shuts valve and allows controlled burn |
| Industrial Health & Safety Committee | Analyzes incident cause; formulates preventive measures |

## 4. Procedure
1. **Detection & alarm**: Gas-detector threshold exceeded or worker report received. Broadcast the alarm to all affected zones.
2. **Initial assessment**: Determine leak location, magnitude, auto-ignition/fire status, wind direction, and ventilation state. If fire is present, call the fire service immediately.
3. **Evacuate & isolate**: Evacuate workers in the leak zone and downwind zones immediately; account for all personnel. Establish a controlled perimeter; deny entry to unauthorized personnel. Run ventilation at maximum to keep the gas concentration below the lower explosive limit (LEL). Note: if fire is already present, the gas-safety manager decides ventilation from a fire-propagation standpoint.
4. **Notification**: Notify the Gas Safety Manager, Safety & Health Manager, fire service, the competent labor office, and site executive management, in that order. Aligns with 중대재해처벌법 (SAPA) Article 4 (safety-assurance duty).
5. **Isolate & mitigate**: Only the Emergency Response Team enters. Shut upstream valves, purge with inert gas (N₂), and run ventilation. Unauthorized entry or extinguishment by non-specialists is prohibited.
6. **Fire response**: For a silane fire, **do not extinguish — shut the valve** (residual gas poses re-ignition and vapor-explosion risk). After valve shut-off, cool surrounding combustibles only. Escalate to the fire service if the fire spreads.
7. **Post-incident**: Assess injuries and property damage, conduct a root-cause investigation, and submit official reports to regulators. Aligns with 산업안전보건법 (OSHA-KR) Article 57 (incident investigation and recording). Formulate and implement preventive measures.
8. **Recordkeeping & audit**: Generate the evidence record (§6); retain detector logs, notification records, and the investigation report.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/semicon/semicon-silane-gas-leak-response-record.json`](../../../../../evidence-models/domains/industry/semicon/semicon-silane-gas-leak-response-record.json) (skeleton, `status: draft`)

- **Record ID format**: `SEMICON-SILANE-GAS-LEAK-RESPONSE-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as leak onset time, location, magnitude, evacuee count, notification chain, and investigation outcome.

## 6. Legal Basis
Source: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). The citation strings below match the `legal_basis` array in `schema.yaml` VERBATIM (Korean proper nouns preserved — never translated). HPGSCA citations use the remediated article set (Article 11/13/15/24/26).

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 화학물질의 등록 및 평가 등에 관한 법률 Article 23
- 화학물질의 등록 및 평가 등에 관한 법률 Article 24
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
| 화학물질의 등록 및 평가 등에 관한 법률 (화학물질관리법) | CCA | Act on the Registration and Evaluation of Chemicals (Chemical Control Act) |
| 고압가스 안전관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |

## 7. Regulatory Notes
Semiconductor fabs are chemical-intensive (CCA), gas-intensive (HPGSCA — silane, arsine, phosphine, hydrogen), and dangerous-goods-intensive (DSSMA — pyrophoric liquids, combustible metals). No dedicated statute — a composite anchor is required. Also relevant: OSHA-KR Article 101 (electrical hazard), Article 99 (fall prevention during tool install/maintenance). **HPGSCA citation note**: The HPGSCA citations in `schema.yaml` (Art 11/13/15/24/26) are the **remediated article set** verified live by the compliance-agent via the `legalize_kr` MCP (law.go.kr full-text — authoritative) — the prior anchor cited deleted Art 14 (deleted 1999.2.8) and topic-mismatched Art 17 (용기등의 검사, NOT Safety Manager) / Art 28 (한국가스안전공사의 설립, NOT emergency response); `legalize_kr` confirmed Art 11/13/15/24/26 as the in-force articles (MST 283919, lawIdCode 001850). Note: the `kr_safety` catalog is stale for HPGSCA (still indexes deleted Art 14), so prefer the `k-law` skill (법제처 Open API) for HPGSCA verification (the `legalize_kr` MCP was removed 2026-08-26).

## 8. Verification History
A prior version of this README flagged HPGSCA Article 14/17/28 in §6 with `[UNVERIFIED — specialist re-verification required]` and posted an unverified-citation note in this section stating that `legalize_kr.parse_law_structure` returned `[]`. That flag is **STALE**.

- **Resolved**: 2026-08-07 (semicon HPGSCA remediation, Group A follow-up)
- **Statute index status**: `legalize_kr.get_law_metadata("고압가스안전관리법")` succeeds (MST 283919, lawIdCode 001850, last-commit 2026-03-10)
- **Correction applied**: Art 14 (deleted 1999.2.8), Art 17 (용기등의 검사), Art 28 (한국가스안전공사의 설립) → replaced with in-force Art 11/13/15/24/26
- **Verification source**: `legalize_kr.parse_law_structure` full-text + `regulations/KR/High-Pressure-Gas-Safety.yaml` (registered statute YAML)
- **Details**: see `memory/findings/compliance-2026-08-07-semicon-hpgsca-remediation.md`

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
