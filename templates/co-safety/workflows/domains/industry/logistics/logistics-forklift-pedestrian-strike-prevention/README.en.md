# Logistics Industry — Forklift Pedestrian Strike Prevention Workflow

> **Status**: This README was finalized in Phase 2 Group B and flipped to `status: active` (regulatory citations were live-checked by the compliance-agent). However, `signature_hazard` in `schema.yaml` and the evidence model's `industry_specific_fields` remain placeholders pending specialist review. Specialist confirmation of those fields is required before operational use.

## 1. Purpose
Systematically prevent collision, crush, and tip-over hazards between forklifts, powered trucks, straddle carriers, and pedestrian workers in port yards, terminals, and warehouses, by applying the hierarchy of controls. Ports are representative high-risk workplaces where vehicles and pedestrians share the same routes; vehicle tip-over, falling loads, and blind-spot collisions are major serious-accident categories. This workflow supports the Safety & Health Manager's general safety-assurance duty (중대재해처벌법/SAPA Article 4) and the risk-assessment duty (산업안전보건법/OSHA-KR Article 36).

This is an **industry-unique workflow** — a port-logistics-specific vehicle-pedestrian-separation procedure that does not duplicate any workflow under `workflows/_shared/`. (Dangerous-goods leak/fire is handled by the `logistics-dangerous-cargo-handling` workflow.)

## 2. Scope
- **Industry**: Logistics (code: `logistics`, port and freight handling)
- **Work covered**: Forklift, powered-truck, and straddle-carrier operation; container yard movement; pedestrian work (picking, inspection, weighing, spotting); yard transit and crossing; limited-visibility work (night, severe weather); equipment charging and inspection
- **Trigger points**: Vehicle introduction or modification, work-zone change, pedestrian-route change, near-miss report, limited-visibility conditions (night, severe weather)

## 3. Roles & Responsibilities
| Role | Responsibility |
|------|----------------|
| Safety & Health Manager | Leads vehicle-pedestrian risk assessment, plans route separation, manages training and licensing |
| Supervisor / Terminal Operations Lead | Controls work zones, maintains pedestrian-only routes, halts work on anomaly |
| Forklift Operator | Holds valid license, performs pre-use checks, observes speed limits and restricted zones, stops immediately on spotting pedestrians |
| Pedestrian Worker | Uses designated walkways, wears high-visibility (HVVA) vest, keeps safe distance from approaching vehicles |
| Facility Engineer | Inspects proximity sensors, cameras, beacons, and rear-view cameras; maintains route signage and barriers |
| Industrial Health & Safety Committee | Reviews collision and near-miss events, improves protective measures |

## 4. Procedure
1. **Risk assessment**: Identify vehicle routes and speeds, pedestrian routes, crossing points, blind spots, load sightline obstruction, personnel density, and visibility limits (night, yard lighting). Aligns with 산업안전보건법 (OSHA-KR) Article 36 (risk-assessment duty).
2. **Apply the hierarchy of controls**:
   1. **Elimination**: Minimize pedestrian entry into the yard itself (automated guidance, remote inspection); separate vehicle and pedestrian time windows.
   2. **Passive protection**: Physical route separation (barriers, bollards, walkways), pedestrian-only aisles and crossings, speed-calming devices (sleeping police).
   3. **Active protection**: Vehicle-pedestrian proximity detection and collision-warning systems (Pedestrian Detection), automatic braking, beacons, and rear-view cameras.
   4. **Administrative**: Pedestrian-vehicle separation SOPs, licensing and safety training, spotter assignment, speed limits and one-way traffic.
   5. **PPE**: HVVA vest (Class 2/3), hard hat, safety footwear (last resort).
3. **Vehicle safety control**: Per 산업안전보건법 (OSHA-KR) Article 38 (safety measures — fall/load-drop prevention) and 안전보건기준에관한규칙 (machinery safety-device standards) — pre-use checks (brakes, beacons, horn, rear-view camera), rated-load compliance, forks carried low.
4. **Traffic-pedestrian separation**: Physically separate vehicle and pedestrian routes; post spotters and require stop-and-go at crossings; mark no-crossing zones.
5. **Visibility-limited operations**: Ensure illumination for night/severe-weather work; check rotating beacons and work lights; mandate HVVA vests; activate rear-approach alarms.
6. **Emergency response**: On collision or tip-over, immediately rescue, provide first aid, and call 119; prevent further load drop on tip-over; pre-establish scene preservation and investigation procedures.
7. **Recordkeeping & audit**: Generate the evidence record (§5); retain vehicle inspection logs, licenses, training-completion records, and near-miss reports.

## 5. Evidence Record
Evidence model produced: [`evidence-models/domains/industry/logistics/logistics-logistics-forklift-pedestrian-strike-prevention-record.json`](../../../../../evidence-models/domains/industry/logistics/logistics-logistics-forklift-pedestrian-strike-prevention-record.json) (skeleton, `status: draft`)

- **Record ID format**: `LOGISTICS-FORKLIFT-PEDESTRIAN-STRIKE-PREVENTION-YYYY-NNNN` (pending specialist confirmation)
- **Required fields**: `record_id`, `legal_basis` (minItems 3), `audit_trail`
- **Extension point**: `industry_specific_fields` — specialist defines industry-unique fields such as vehicle type and rated capacity, route-separation tier, proximity-detection status, blind-spot assessment, and near-miss history.

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
- 산업안전보건법 Article 38 (추락·낙하 등 위해 방지 안전조치)
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
Port vehicle-pedestrian safety is governed jointly by the 항만안전특별법 (PSSA) and the 산업안전보건법 (OSHA-KR). **PSSA Article 6 (safety-assurance duties of port-transport participants) is the substantive safety-obligation article**, while **PSSA Article 4 (relation to other laws) is a procedural priority-of-application clause**. The directly applicable articles for vehicle/machine safety devices and fall/load-drop prevention are **OSHA-KR Article 99 (fall/load-drop prevention) and Article 100 (vehicle and machine safety devices)**. DSSMA Article 20 covers the transport standards for any dangerous goods carried by the vehicles. This workflow's `schema.yaml` legal_basis uses the composite auto-filled anchor set listed above.

## 8. Outsourcing Note
Port handling and yard work often use contractor personnel on both the vehicle-operator and pedestrian sides (stevedores, 3PL, equipment leasing), making 중대재해처벌법 (SAPA) Article 5 (outsourcing/contract safety obligation) central. The terminal operator must apply this workflow's controls (route separation, proximity detection, HVVA-vest mandate, license verification) equally to contractor drivers and pedestrian workers down the contracting chain, and must specify the integrated safety-management owner and responsibility boundaries in contracts whenever multiple contractors share the same yard.

---
_Legal disclaimer: Regulatory interpretation is user responsibility. This workflow provides automation assistance only, not legal advice._
