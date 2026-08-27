---
name: dangerous-cargo-handling-planner
owner: logistics-agent
scope: workspace
status: active
description: Plan IMDG-classed dangerous-cargo port handling — class segregation, stowage assignment, vapor-emission control, leak response, PPE matrix by IMDG class. Covers class 1-9 dangerous goods at port stevedoring, stowage compliance, EmS/MFAG response, contractor SAPA Art 5 safety management.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 항만 위험물 하역 안전
    - IMDG dangerous cargo handling
    - 위험물 컨테이너 적치
    - dangerous goods container stowage
    - IMDG 클래스 분류
    - IMDG class segregation
    - 유독가스 흡입 노출 항만
    - toxic gas inhalation port
    - 항만하역 위험물 누출 대응
    - PSSA Article 8 위험물 하역
    - DSSMA Article 20 위험물 운반
    - IMDG EmS MFAG response
  legal_basis:
    - 항만안전특별법 제8조
    - 항만안전특별법 제9조
    - 위험물안전관리법 제20조
    - 중대재해처벌법 제5조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Dangerous Cargo Handling Planner Skill

## Overview

IMDG-classed dangerous-cargo handling planner for port operations — the
CHEMICAL/inhalation hazard face of logistics, distinct from the
LIFTING/collision MECHANICS covered by `port-crane-agv-safety` and the
warehouse-closed-loop refrigerant hazard covered by `cold-storage-refrigerant-
safety`.

The logistics industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 405-458) names
**항만안전특별법 (PSSA) Article 8 (위험물 항만하역 안전조치)**,
**PSSA Article 9 (항만사고 조사·보고)**, and **위험물안전관리법 (DSSMA)
Article 20 (위험물의 운반)** — cited by ZERO existing logistics workflows
prior to the `logistics-dangerous-cargo-handling` workflow (Task 21,
2026-08-07). All three PSSA articles (Art 4/5/6/8/9) were VERIFIED LIVE via
`legalize_kr.parse_law_structure` per the anchor verification block.

## Korean Port Dangerous-Cargo Context

### Why IMDG cargo handling is distinct

| Factor | Cold-storage (existing WF) | Port IMDG handling (this skill) |
|--------|----------------------------|---------------------------------|
| Hazard | Closed-loop ammonia refrigerant | Open handling of packaged dangerous goods |
| State | Gas (ammonia) | All physical states (solid/liquid/gas) |
| Scale | Single refrigeration loop | Hundreds of containers per vessel call |
| Release mode | Slow leak in closed space | Sudden — dropped container, valve failure |
| Co-cargo | Refrigerated goods only | Mixed dangerous + general cargo |
| Regime | KOSHA confined-space | IMDG Code + PSSA + DSSMA |

Cold-storage is one substance (ammonia) in one closed loop. Port IMDG
handling is hundreds of different substances (every IMDG class 1-9) in
thousands of packages, with class-dependent hazards and segregation rules.
The PSSA + DSSMA + IMDG Code regulatory stack has no overlap with the
cold-storage regime.

### Hazard profile (from logistics regulatory anchor)

- **PSSA Article 8** (UNCITED by existing WFs, verified live) — 위험물 항만하역
  안전조치: dangerous-goods port-handling safety measures
- **DSSMA Article 20** (UNCITED by existing WFs) — 위험물의 운반: dangerous-
  goods transport
- **PSSA Article 9** (UNCITED by existing WFs, verified live) — 항만사고
  조사·보고: port-accident investigation and reporting
- **PSSA Article 6** (verified live) — 항만작업 안전수칙: port-work safety rules
- **SAPA Article 5** — 도급·하도급 사업주 안전보건 확보 의무: outsourcing safety
  (highly relevant — port stevedoring is heavily subcontracted)

## Hazard Scenarios Covered

### 1. IMDG class 2.3 toxic gas inhalation

- Ammonia (UN 1005), chlorine (UN 1017), phosgene, methyl bromide
- Valve failure during container handling — sudden toxic cloud
- Enclosed hold vapor accumulation — below-deck entry

### 2. IMDG class 3 flammable liquid vapor cloud fire

- Gasoline, acetone, methanol, ethanol (UN 1203, 1090, 1230, 1170)
- Spill during container damage — vapor cloud ignition source
- Vessel hold accumulation — below lower-explosive-limit

### 3. IMDG class 8 corrosive

- Sulfuric acid, hydrochloric acid, caustic soda (UN 1830, 1789, 1824)
- Container damage — skin / eye burn
- IBC tote puncture — large-volume release

### 4. IMDG class 4.x flammable solid / self-reactive

- Class 4.1 flammable solids, 4.2 spontaneous-combustible, 4.3 dangerous-
  when-wet
- Moisture activation (4.3) — hydrogen generation
- Heat source in hold — auto-ignition

### 5. IMDG class 5.x oxidizing + organic peroxide

- Class 5.1 oxidizers amplify any fire; 5.2 organic peroxides self-
  decompose
- Incompatible stowage with class 3 — exothermic cascade

### 6. IMDG class 1 explosives / 6.2 infectious / 7 radioactive

- Class 1 — stowage segregation per IMDG (passenger vs cargo vessel)
- Class 6.2 infectious — chain-of-custody
- Class 7 radioactive — stowage distance from crew, documented in advance

### 7. Incompatible cargo stowage

- Exothermic cross-reaction between adjacent containers (e.g. class 5.1
  oxidizer next to class 3 flammable liquid)
- Segregation table violation (the IMDG "4x block" segregation rules)

## Dangerous Cargo Handling Hierarchy (port-specific)

### 1. Elimination

- Substitute less-hazardous form (e.g. dilute solution instead of
  concentrate)
- Limit cargo to IMO Type-B packaging only (reject marginal shippers)
- Shift dangerous-cargo handling to daylight shifts only when feasible

### 2. Engineering controls (preferred over PPE)

- **Segregation-by-class stowage** per the IMDG segregation table —
  "away from", "separated from", "separated by a complete compartment
  from", "separated longitudinally by an intervening complete
  compartment"
- **Below-deck ventilation** — forced ventilation before any hold entry
  (per PSSA Art 8)
- **Vapor recovery** — for class 3 liquid loading where applicable
- **Container damage inspection** at the gate before acceptance — every
  IMDG container visually + structurally inspected
- **Gas-detection instrumentation** — multi-gas meters at the berth
  (LEL, O2, H2S, CO, plus class-specific tubes)

### 3. Administrative controls

- **PSSA Art 8 dangerous-goods handling plan per vessel call** —
  submitted before the call, approved by the terminal authority
- **DSSMA Art 20 transport documentation** — multimodal dangerous-goods
  form per shipment
- **IMDG EmS (Emergency Schedules) + MFAG (Medical First Aid Guide)**
  posted at the berth and reviewed before each class-1/class-2.3/class-7
  operation
- **PSSA Art 9 incident reporting procedure** — first-responder pathway,
  30-minute regulatory notification window
- **SAPA Art 5 contractor safety management** — stevedoring contractor
  pre-qualification, signed safety-management agreement on file
- **Risk assessment per OSHA-KR Art 36** — documented for each class
- **TBM** before each shift — see shared TBM workflow

### 4. PPE (class-specific matrix)

- **Class 2.3 toxic gas** — SCBA or supplied-air respirator (NOT an N95
  — toxic gas requires gas-specific cartridge or supplied air)
- **Class 3 flammable liquid** — anti-static FRC (flame-resistant
  clothing), chemical-resistant gloves + boots, safety glasses
- **Class 8 corrosive** — full acid suit, face shield, acid-resistant
  gloves + boots
- **Class 4.3 dangerous-when-wet** — FRC, dry-gear protocol (no moisture
  contact during handling)
- **Class 5.2 organic peroxide** — FRC + cool-chain handling
- **Class 7 radioactive** — dosimetry for handlers; ALARA time-distance-
  shielding discipline

## Planning Workflow

1. **IMDG cargo manifest review** — class, UN number, packing group,
   quantity for every shipment on the vessel call
2. **Segregation plan** — apply the IMDG segregation table to the
   manifest; assign stowage blocks
3. **Stowage assignment** — on-deck vs below-deck (class 1, 5.2, 6.2, 7
   typically on-deck; class 2.1 in well-ventilated hold); distance-from-
   crew computation for class 7
4. **Container damage inspection** — gate-in inspection for every IMDG
   container; reject damaged
5. **Vapor-emission control plan** — forced ventilation schedule for
   below-deck work; vapor recovery for class 3 loading
6. **PPE matrix issued** — match respirator / suit to the class handled
   that shift
7. **EmS + MFAG + PSSA Art 9 reporting pathway** — posted at the berth;
   crew briefed on the relevant EmS schedule for the cargo on hand
8. **SAPA Art 5 contractor verification** — stevedoring contractor safety-
   management agreement on file, insurance + training verified
9. **Execution + gas monitoring** — multi-gas meters deployed, wind
   direction monitored, escape route kept clear
10. **Leak response** — EmS-schedule action + MFAG first-aid + PSSA Art 9
    regulatory notification within the 30-minute window
11. **Post-operation** — container inspection on gate-out, hold ventilation
    before next entry, incident log filed

## Output

```json
{
  "plan_id": "logi-dchp-2026-08-07-001",
  "berth": "Port of Busan Pier 7 Berth 3",
  "vessel_call": "MV Container vessel call 2026-08-07-019",
  "imdg_containers_count": 47,
  "classes_present": ["2.1", "2.3", "3", "8", "5.1", "9"],
  "highest_hazard_class": "2.3",
  "segregation_plan": {
    "applied_table": "IMDG Code segregation table",
    "violations": [],
    "on_deck": ["class_1", "class_5.2", "class_6.2", "class_7"],
    "below_deck_forced_ventilation": ["class_2.1", "class_3"],
    "class_2_3_separation_from_class_3_m": 6
  },
  "engineering_controls": {
    "container_gate_in_inspection": "100_percent",
    "hold_ventilation_minutes_before_entry": 15,
    "vapor_recovery_class_3_loading": true,
    "multi_gas_meters_deployed": 4,
    "meter_specs": ["LEL", "O2", "H2S", "CO", "NH3_tube", "Cl2_tube"]
  },
  "administrative": {
    "pssa_art8_plan_approved": true,
    "dssma_art20_transport_docs_complete": true,
    "ems_mfag_posted": true,
    "pssa_art9_reporting_pathway": "30_minute_notification_confirmed",
    "sapa_art5_contractor_agreement": "STEVEDORE-CO-2026-014-on-file",
    "risk_assessment_per_osha_art36": "RA-2026-08-07-071",
    "tbm_conducted": true
  },
  "ppe_matrix_by_class": {
    "class_2_3_toxic_gas": "SCBA_supplied_air",
    "class_3_flammable_liquid": "anti_static_FRC_chemical_gloves",
    "class_8_corrosive": "full_acid_suit_face_shield",
    "class_5_1_oxidizer": "FRC_dry_gear_protocol"
  },
  "regulatory_basis": [
    "항만안전특별법 (PSSA) Article 8 — 위험물 항만하역 안전조치",
    "항만안전특별법 (PSSA) Article 9 — 항만사고 조사·보고",
    "위험물안전관리법 (DSSMA) Article 20 — 위험물의 운반",
    "항만안전특별법 (PSSA) Article 6 — 항만작업 안전수칙",
    "중대재해처벌법 (SAPA) Article 5 — 도급·하도급 사업주 안전보건 확보 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **항만안전특별법 (PSSA) Article 8** — 위험물 항만하역 안전조치 (dangerous-goods
  port-handling safety measures) — VERIFIED LIVE via legalize_kr
- **항만안전특별법 (PSSA) Article 9** — 항만사고 조사·보고 (port-accident
  investigation and reporting; 30-minute notification window) — VERIFIED LIVE
- **항만안전특별법 (PSSA) Article 6** — 항만작업 안전수칙 (port-work safety
  rules) — VERIFIED LIVE
- **위험물안전관리법 (DSSMA) Article 20** — 위험물의 운반 (dangerous-goods
  transport)
- **중대재해처벌법 (SAPA) Article 5** — 도급·하도급 사업주 (outsourcing safety
  obligation; highly relevant for stevedoring subcontractors)
- **IMDG Code** — international standard, adopted by Korean port authority by
  convention (MFDS / Ministry of Oceans and Fisheries enforcement)
- **Logistics-specific**: Korean stevedoring contractor regime means SAPA
  Article 5 is the operative safety-management anchor for most dangerous-
  cargo handling (the terminal operator often has only indirect supervisory
  authority over the stevedoring crew handling the cargo)

## Integration

- **Input from**: vessel cargo manifest, IMDG declaration, container
  packing list, berth assignment
- **Output to**: `logistics-dangerous-cargo-handling-record.json` (the
  evidence model for the `logistics-dangerous-cargo-handling` workflow)
- **Coordinated skills**:
  - `port-crane-agv-safety` (existing logistics WF) — LIFTING/collision
    MECHANICS; this skill covers the CHEMICAL/inhalation hazard of what
    the crane is lifting
  - `cold-storage-refrigerant-safety` (existing logistics WF) — warehouse
    ammonia closed-loop; this skill covers open IMDG-class cargo handling
  - `ghs-classifier` (ehschem) — for chemical classification when the IMDG
    class is ambiguous or mixed
  - `msds-parser` (msds) — for chemical-specific PPE and first-aid lookup
  - `permit-to-work` (daily) — generic permit issuance
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If IMDG segregation is violated by the proposed stowage
  OR multi-gas meter alarms OR a class 2.3 container is damaged during
  handling, halt operations, evacuate the berth, and escalate to the
  terminal authority + stevedoring safety manager before resumption.

## Non-Duplication Justification

vs. `port-crane-agv-safety` (existing logistics WF): that addresses the
LIFTING/collision MECHANICS of gantry cranes and automated guided vehicles
(PSSA Art 6 + OSHA-KR Art 38/63). This skill addresses the CHEMICAL/
inhalation hazard of what is being lifted — IMDG-classed dangerous cargo.
The two skills operate in series (crane lifts the cargo, but the cargo's
chemical hazard needs its own control plan). Different physics (kinetic vs.
chemical), different regulatory anchor (PSSA Art 6 lifting vs. PSSA Art 8
dangerous-goods + DSSMA Art 20 transport).

vs. `cold-storage-refrigerant-safety` (existing logistics WF): that
addresses closed-loop ammonia refrigerant in a cold-storage warehouse
(고압가스 안전 관리 및 사업법 (HPGSCA) Art 13 + OSHA-KR Art 39 confined-space). This skill
addresses OPEN handling of packaged IMDG dangerous goods at the port.
Different substances (one refrigerant gas in a closed loop vs. every IMDG
class in open handling), different location (warehouse vs. berth).

vs. `logistics-forklift-pedestrian-strike-prevention` (newly-generated
logistics WF): that addresses pedestrian-strike and dock-edge fall hazards
(PSSA Art 4/5). This skill addresses chemical/inhalation hazards (PSSA
Art 8 + DSSMA Art 20). Different hazard class entirely.

## Legal Disclaimer

> 자동화 계획 보조. 최종 위험물 취급 조치 결정은 항만하역업체 안전관리자 +
> 해양수산부 항만관리청 권한 per 항만안전특별법 (PSSA) Article 8 + Article 9
> and 위험물안전관리법 (DSSMA) Article 20. IMDG class assignments, segregation
> decisions, and PPE selection MUST be verified by a qualified dangerous-goods
> safety officer before any cargo handling begins.
