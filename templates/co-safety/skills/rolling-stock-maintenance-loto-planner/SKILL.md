---
name: rolling-stock-maintenance-loto-planner
owner: railway-agent
scope: workspace
status: active
description: Plan rolling-stock depot maintenance safety — EMU/coach/locomotive vehicle-movement lockout (wheel chock + derail + brake scotch), bogey heavy-lift rigging, undercarriage pit work, and fall protection from rolling-stock roof. Vehicle-LOTO distinct from fixed-plant LOTO. RSA Art 48 + OSHA Art 92 (LOTO 정지) + OSHA Art 99 (추락 방지 — uncited by existing railway WFs) + SAPA Art 4.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 철도 차량사업소 차량 정비 LOTO
    - rolling stock depot maintenance
    - EMU 객차 정비 차량 이동 잠금
    - rolling stock vehicle movement lockout
    - bogey 대차 리프팅 크레인
    - bogey heavy lift rigging
    - 밑바닥 pit 작업 차량 압사
    - undercarriage pit work crush
    - 차량 지붕 추락 방지
    - roof fall prevention rolling stock
    - 철도 안전관리자 정비 허가
    - RSA Article 48 철도 보호
    - OSHA-KR Article 38 추락 방지 포함 안전조치 (전차선)
    - wheel chock derail brake scotch
  legal_basis:
    - "철도안전법 제48조 (철도 보호 및 질서유지를 위한 금지행위)"
    - "산업안전보건기준에 관한 규칙 제92조 (LOTO — 에너지원 차단·작업 정지)"
    - "산업안전보건법 제38조 (추락 등 안전조치 — 차량 지붕·pit 추락 방지)"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Rolling Stock Maintenance LOTO Planner Skill

## Overview

Rolling-stock depot maintenance safety planner for EMU (Electric Multiple
Unit), coach, and locomotive work at 차량사업소 (railway depots / light-
maintenance facilities) — the MOVING-VEHICLE LOTO hazard face of railway
maintenance, distinct from the FIXED-PLANT equipment LOTO covered by
steelmaking `molten-metal-loto` and waste `incinerator-shredder-loto`,
and distinct from the 25kV catenary electrical and track/tunnel confined-
space hazards covered by the two existing railway workflows.

The railway industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 463-501) names
**철도안전법 (RSA) Article 48 (철도 보호 및 질서유지를 위한 금지행위)** and
**OSHA-KR Article 38 (추락 등 안전조치 — 전차선/선로 작업)** in the primary/adjacent
statute blocks — cited by ZERO existing railway workflows prior to the
`railway-rolling-stock-maintenance-loto` workflow (Task C-1b, 2026-08-07).
The anchor also names **OSHA-KR Article 38 (감전 등 안전조치)** for the
catenary-adjacent depot work. This skill operationalizes RSA Art 48 +
OSHA Art 92 (LOTO 정지 — 안전보건기준에관한규칙 Art 92, per existing
codebase convention) + OSHA Art 38 into a deployable depot-maintenance
safety plan.

## Korean Railway Depot Context

### Why rolling-stock vehicle-LOTO is distinct

| Factor | Fixed-plant LOTO (incinerator, furnace) | Rolling-stock vehicle LOTO (this skill) |
|--------|------------------------------------------|------------------------------------------|
| Isolation target | Fixed equipment (motor, valve) | MOVING VEHICLE (EMU car, locomotive) |
| Energy sources | Electrical, pneumatic, thermal | Kinetic (roll), pneumatic (brake), electrical (catenary/pantograph), gravity (bogey lift) |
| Lockout means | Breaker + tag + verify | Wheel chock + derail + brake scotch + pantograph down + catenary dead |
| Re-positioning risk | None (equipment is bolted down) | HIGH — vehicle can roll if any isolation fails |
| Co-existent work | Generally one trade at a time | Bogey team UNDER car + roof team ON car + pit team BENEATH floor — concurrent |
| Fall hazard geometry | Grade-level | Roof access (4 m+ fall) + pit access (2 m+ fall into pit) |

A rail vehicle is not "de-energized" in the fixed-plant sense — it can
move under gravity (grade), residual brake-pressure release, or pantograph-
driven traction. Vehicle-LOTO therefore requires POSITIVE mechanical
restraint (wheel chocks, derails, brake scotches) layered on top of
electrical/pneumatic isolation. This is the only skill in the codebase
that plans lockout of a MOVING VEHICLE.

### Hazard profile (from railway regulatory anchor)

- **RSA Art 48** (UNCITED by rolling-stock WF; rail-track WF cites it but
  for track work) — 철도 보호 및 질서유지를 위한 금지행위: prohibits
  interference with railway vehicles and structures; basis for depot
  vehicle-movement control
- **OSHA-KR Art 92** (LOTO 정지 — 안전보건기준에관한규칙 Art 92, per existing
  codebase convention `산업안전보건법 Article 92`) — hazardous-energy
  isolation; applied here to kinetic + pneumatic + electrical energy of a
  rail vehicle
- **OSHA-KR Art 38** (corrected anchor, 2026-08-24; in anchor
  adjacent_laws) — 추락 방지: fall prevention for roof access and pit
  access during depot work
- **OSHA-KR Art 38** (in anchor adjacent_laws) — 감전 등 안전조치: electrical
  hazard for catenary-adjacent / pantograph work
- **SAPA Art 4** — 사업주 안전보장 의무: universal safety-assurance
  obligation

## Hazard Scenarios Covered

### 1. Vehicle-movement / roll-away during undercarriage work

- EMU car stopped at depot track; pit worker under floor for brake-
  cylinder inspection
- Brake-pressure release or grade-induced roll — worker crushed by wheel
  or undercarriage equipment
- The signature depot fatal-incident class in Korea (KORAIL / Seoul Metro
  depot history)

### 2. Bogey (대차) heavy-lift rigging failure

- Bogey removed from under carbody using overhead crane (15-25 tonne
  bogey); carbody supported on stands
- Rigging sling failure or stand collapse — carbody drops onto workers
- Crane-loads overhead simultaneously (dual lifting hazard)

### 3. Roof access fall (pantograph / air-conditioner / roof equipment)

- Worker climbs onto EMU roof (~4 m above rail level) for pantograph
  inspection or AC-unit service
- No fall-protection anchor point on curved roof — fall-to-grade
- Catenary adjacent on same track — co-existent electrical hazard
  (OSHA Art 38 + OSHSR 전기기준)

### 4. Pit access fall + confined-space edge

- Pit entry for underfloor inspection (battery box, compressor, traction
  motor)
- Pit-access ladder failure or edge fall (~2 m) into pit
- Pit confined-space atmosphere (residual solvent / welding fume from
  adjacent bay)

### 5. Pantograph / catenary residual-energy (depot track)

- Depot tracks often have overhead catenary for test movements; pantograph
  up = 25kV exposure
- Worker on roof near raised pantograph — arc-flash + electrocution
- Adjacent track live while depot track isolated — co-existent electrical

### 6. Concurrent multi-trade conflict

- Bogey team (under carbody) + roof team (on carbody) + pit team
  (beneath floor) + interior team (inside cabin) all working one EMU
  simultaneously
- Any one team's energy-isolation failure endangers the others

## Rolling-Stock Vehicle-LOTO Hierarchy (depot-specific)

### 1. Elimination

- Engineer-out the hazard: automated bogey-drop tables (no overhead
  crane lift) where economically feasible
- Remote pantograph inspection cameras (eliminate roof access for routine
  checks)
- Track-movable depots (vehicle stays on one track for the full
  maintenance cycle, eliminating inter-bay movements)

### 2. Engineering controls (preferred over PPE)

- **Wheel chocks** at both ends of every isolated axle (positive
  mechanical roll-restraint) — verified chock-to-rail contact
- **Portable derails** placed on the depot track at both ends of the
  isolated vehicle (prevents a vehicle from adjacent track entering the
  work zone)
- **Brake scotch / parking-brake lock** — mechanical brake-application
  lock to prevent brake-pressure release
- **Pantograph lock-down** — pantograph physically clamped in down
  position; catenary on isolated track de-energized and grounded per
  existing catenary-high-voltage-safety WF
- **Bogey-lift crane with anti-drop valve** — hydraulic check valve
  prevents uncontrolled descent on hose failure
- **Carbody stands with mechanical lock pin** — positive mechanical
  support, not hydraulic-only
- **Roof-edge fall-protection guardrail system** (deployable on depot
  roof-access platforms, NOT on the carbody itself)
- **Pit-edge fall protection** — removable guardrails at pit access
  openings

### 3. Administrative controls

- **작업허가서 (work permit)** per OSHA Art 92 for every depot maintenance
  job — isolated-vehicle permit issued by depot 안전관리자 before work
  begins
- **Vehicle-movement lockout log** — wheel-chock installed-by / verified-
  by / removed-by sign-off trail
- **Multi-trade coordination briefing** — single depot supervisor
  coordinates all concurrent trades on one EMU; no trade begins until all
  isolations confirmed
- **Catenary isolation certificate** — for any roof work, depot catenary
  on the isolated track grounded per catenary-high-voltage-safety WF
- **Bogey-lift plan** — rigging diagram, crane capacity verification,
  exclusion zone, signed by lifting engineer
- **TBM (tool-box meeting)** before each shift — see shared TBM workflow
- **Fall-protection plan** per OSHA Art 38 for any roof / pit access

### 4. PPE

- **Full-body harness with double lanyard** for all roof access (100%
  tie-off on carbody) — anchored to depot-rated anchor point, NOT to
  carbody hand-hold (which is not rated for fall arrest)
- **Hard hat with chin strap** (wind blast from passing train on
  adjacent track)
- **Steel-toe safety boots** for pit work + bogey zone (heavy dropped-
  object hazard)
- **High-visibility vest** (depot has active vehicle movements on other
  tracks)
- **Dielectric gloves Class 2** if catenary-adjacent work cannot be
  avoided (per OSHA Art 38 + OSHSR)
- **Hearing protection** in bogey-test bay (post-maintenance test runs)

## Planning Workflow

1. **Vehicle identification + depot track assignment** — EMU/coach/
   locomotive road number, depot track, isolated-track confirmation
2. **Energy-source inventory** — kinetic (roll), pneumatic (brake),
   electrical (catenary/pantograph), gravity (bogey-lift/carbody-stands),
   co-existent adjacent-track energy
3. **Vehicle-movement LOTO** — wheel chocks both-ends + portable derails
   both-ends + brake scotch + parking-brake lock; verified by depot
   안전관리자
4. **Catenary isolation (if roof work or pantograph work)** — depot
   catenary on isolated track de-energized, grounded, danger-tagged per
   catenary-high-voltage-safety WF
5. **Bogey-lift plan (if bogey work)** — rigging diagram, crane capacity
   vs bogey weight, carbody stand placement, exclusion zone
6. **Roof-access fall-protection plan (if roof work)** — anchor point
   selection, 100% tie-off procedure, rescue plan per OSHA Art 38
7. **Pit-access plan (if underfloor work)** — pit-edge guardrails, ladder
   condition, pit atmosphere check
8. **Multi-trade coordination briefing** — single supervisor sequences
   all concurrent trades; energy-isolation confirmation before each trade
   begins
9. **작업허가서 issuance per OSHA Art 92** — depot 안전관리자 signs the
   consolidated permit covering all isolations
10. **TBM + execution** — tool-box meeting conducted, work proceeds under
    the single supervisor
11. **Post-work restoration** — all tools/accountability verified out,
    vehicle-movement LOTO removed in reverse order (brake release last),
    catenary re-energized per catenary WF sequence, vehicle released for
    test movement
12. **Emergency response plan** — vehicle-roll rescue (extract without
    re-energizing catenary), bogey-drop extraction, 119 dispatch, incident
    reporting per OSHA-KR Art 57

## Output

```json
{
  "plan_id": "rail-rsml-2026-08-07-001",
  "depot": "Seoul Metro Gunja Depot Bay 3",
  "vehicle": "EMU Car 3815-set, Road Number 3815-3",
  "track": "Depot Track 7 (isolated)",
  "task_type": "bogey_removal_and_pit_inspection",
  "energy_sources": ["kinetic_roll", "pneumatic_brake", "catenary_25kv_adjacent", "gravity_bogey_lift"],
  "adjacent_track_live": false,
  "workers_by_trade": {
    "bogey_team": 3,
    "pit_team": 2,
    "roof_team": 0
  },
  "vehicle_movement_loto": {
    "wheel_chocks_axles": [1, 4],
    "derails_installed": ["track_north_end", "track_south_end"],
    "brake_scotch": "verified_installed",
    "parking_brake_lock": "engaged",
    "install_verified_by": "depot_supervisor_이안전"
  },
  "catenary_isolation": {
    "required_for_this_job": false,
    "reason": "no_roof_no_pantograph_work"
  },
  "bogey_lift_plan": {
    "crane_capacity_t": 30,
    "bogey_weight_t": 18.5,
    "safety_factor": 1.62,
    "anti_drop_valve": true,
    "carbody_stands_lock_pin": "verified",
    "rigging_diagram_ref": "DEPOT-RIG-2026-3815-3"
  },
  "administrative": {
    "permit_issued_per_osha_art92": true,
    "permit_id": "WP-DEPOT-2026-08-07-0142",
    "depot_safety_manager_signoff": true,
    "multi_trade_coordinator": "supervisor_김현",
    "tbm_conducted": true
  },
  "fall_protection_plan": {
    "roof_work": false,
    "pit_work": {
      "edge_guardrails": true,
      "ladder_inspected": true,
      "pit_atmosphere_check": "19.5_23.5_pct_O2_pass"
    }
  },
  "ppe": {
    "harness_double_lanyard_roof_team": "n_a_no_roof_work",
    "steel_toe_boots": true,
    "high_vis_vest": true,
    "hearing_protection_test_bay": true
  },
  "rescue_plan_ref": "DEPOT-ERP-2026-vehicle-roll",
  "regulatory_basis": [
    "철도안전법 (RSA) Article 48 — 철도 보호 및 질서유지를 위한 금지행위",
    "산업안전보건법 (OSHA-KR) Article 92 — LOTO 정지 (안전보건기준에관한규칙 제92조, codebase convention)",
    "산업안전보건법 (OSHA-KR) Article 38 — 추락 등 위해 방지 안전조치 (전차선/선로/차량 작업)",
    "산업안전보건기준에관한규칙 — 감전 등 전기 재해 방지 기준 (25kV 전차선 인접)",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **철도안전법 (RSA) Article 48** — 철도 보호 및 질서유지를 위한 금지행위
  (basis for depot vehicle-movement control; restricts interference with
  railway vehicles)
- **산업안전보건법 (OSHA-KR) Article 92** — LOTO 정지 (hazardous-energy
  isolation; cited per existing codebase convention — technically in
  안전보건기준에관한규칙 Art 92, followed for consistency with existing
  `incinerator-shredder-loto` and `molten-metal-loto` schemas)
- **산업안전보건법 (OSHA-KR) Article 38** — 추락 등 안전조치 (fall prevention;
  UNCITED by existing railway WFs — this skill newly activates it for
  roof and pit access)
- **안전보건기준에관한규칙 (OSHSR)** — 감전 등 전기 재해 방지 기준 (electrical-
  hazard prevention; co-existent catenary-adjacent work)
- **KORAIL / Seoul Metro depot 안전관리자** — every depot has a named
  안전관리자 who MUST countersign the 작업허가서 and verify vehicle-
  movement LOTO before any undercarriage / pit / bogey work begins
- **118 (철도종합상황실) + 119** — depot rescue pathway; vehicle-roll
  rescue must NOT re-energize catenary; coordinated with 철도종합상황실
- **Railway-specific**: Korea's urban-metro depots (Seoul Metro, KORAIL,
  Busan Transportation Corporation) operate EMU fleets with nightly
  light-maintenance cycles — the bogey/pit/roof work is routine, high-
  frequency, and the re-positioning risk is ever-present on graded depot
  tracks

## Integration

- **Input from**: depot maintenance work-order, EMU/loco road number,
  depot track assignment, bogey-lift crane specification
- **Output to**: `railway-railway-rolling-stock-maintenance-loto-record.json`
  (the evidence model for the `railway-rolling-stock-maintenance-loto`
  workflow at `workflows/domains/industry/railway/railway-rolling-stock-maintenance-loto/`)
- **Coordinated skills**:
  - `permit-to-work` (daily) — issues the 작업허가서 that this plan
    references per OSHA Art 92
  - `psm-loto` (psm) — generic LOTO procedure; this skill SPECIALIZES it
    for a MOVING VEHICLE (wheel chocks + derails + brake scotch on top of
    electrical/pneumatic isolation — fixed-plant LOTO has no equivalent
    of wheel chocks or derails)
  - `fall-hazard-assessor` (ehsconst) — generic fall-hazard assessment;
    this skill specializes for the curved-roof / pit-edge geometry of a
    rail vehicle
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If wheel chocks cannot achieve positive rail-contact
  (wet/oily rail, steep depot grade), OR bogey-lift crane capacity is
  within 1.25x of bogey weight (insufficient safety factor), OR adjacent-
  track catenary cannot be confirmed de-energized for roof work, halt the
  job and escalate to depot 안전관리자 + 철도종합상황실 before proceeding.
  No PPE-only fallback exists for vehicle-movement isolation failure.

## Non-Duplication Justification

vs. `catenary-high-voltage-safety` (existing railway WF): that addresses
the 25kV ELECTRICAL hazard of the overhead catenary during maintenance
(RSA Art 45 + ESCA Art 16). This skill addresses the MECHANICAL /
vehicle-movement hazard of the rail vehicle itself in the depot —
different energy class (kinetic + pneumatic + gravity vs. electrical),
different work location (depot track vs. catenary), different isolation
discipline (wheel chocks + derails vs. breaker + ground strap). The two
skills coordinate when roof work requires catenary de-energization (this
skill REFERENCES the catenary WF, does not duplicate it).

vs. `rail-track-confined-maintenance` (existing railway WF): that
addresses TRACK + TUNNEL work (RSA Art 48 for track protection + OSHA
Art 38). This skill addresses VEHICLE work in the DEPOT — the WF is on
the rail vehicle, not on the track. Different hazard (vehicle roll /
bogey drop / roof fall vs. train-approach struck-by / tunnel asphyxia).

vs. `psm-loto` (psm domain): that addresses FIXED-PLANT equipment LOTO
(vessel, pump, valve). This skill addresses MOVING-VEHICLE LOTO — the
only skill in the codebase that locks out a rail vehicle against
accidental movement. The isolation physics are fundamentally different
(positive mechanical restraint layered on electrical/pneumatic isolation
vs. electrical/pneumatic isolation alone).

vs. `molten-metal-loto` (steelmaking) and `incinerator-shredder-loto`
(waste): both are FIXED-PLANT equipment LOTO. This skill is MOVING-
VEHICLE LOTO — distinct isolation discipline as described above.

## Legal Disclaimer

> 자동화 계획 보조. 최종 차량 정비 안전 조치 결정은 차량사업소 안전관리자 +
> 철도운영기관 안전책임자 권한 per 철도안전법 (RSA) Article 48 and
> 산업안전보건법 (OSHA-KR) Article 92 + Article 38 (+안전보건기준에관한규칙). Wheel-
> chock-to-rail contact, bogey-lift rigging capacity, and catenary
> isolation MUST be verified by the depot 안전관리자 and a qualified lifting
> engineer before any undercarriage, pit, bogey, or roof work begins.
