---
name: munitions-magazine-storage-safety-planner
owner: defense-agent
scope: workspace
status: active
description: Plan munitions magazine storage operations — quantity-distance (Q-D) siting, UN hazard-division (HD 1.1-1.6) and compatibility-group segregation, magazine lightning/static control, sympathetic-detonation prevention, 화약류안전관리자 oversight per FSESA Art 23.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 탄약 마가진 저장 안전
    - munitions magazine storage safety
    - 화약류 안전거리 Q-D
    - quantity-distance siting explosives
    - 호환성 그룹 분리 저장
    - compatibility group segregation
    - UN hazard division 1.1 1.2 1.3
    - sympathetic detonation prevention
    - 화약류안전관리자 선임
    - FSESA Article 23 explosives safety manager
    - 마가진 낙뢰 정전기 대책
    - magazine lightning protection
  legal_basis:
    - "총포·도검·화약류 등 단속법 제9조 (화약류 취급제한)"
    - "총포·도검·화약류 등 단속법 제23조 (화약류 안전관리자)"
    - "방위사업법 제53조 (방위산업체 안전관리) [UNVERIFIED-via-legalize-kr-full-text]"
    - "산업안전보건법 제36조 (위험성평가)"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Munitions Magazine Storage Safety Planner Skill

## Overview

Magazine storage operations planner for munitions and explosives — the
STORAGE-lifecycle phase, distinct from the MANUFACTURE-phase covered by
`explosive-propellant-handling` (propellant mixing and ESD prevention) and
the missile-cryogenic propellant phase covered by `missile-cryogenic-high-
pressure`.

The defense industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 322-360) names
**총포·도검·화약류 등 단속법 (FSESA) Article 23 (화약류 안전관리자 — Explosives
Safety Manager)** as an adjacent law — cited by ZERO existing defense
workflows prior to the `defense-munitions-storage-magazine-safety` workflow
(Task 21, 2026-08-07). The anchor also names **FSESA Article 9 (화약류
취급제한 — covers storage)** and **방위사업법 (DAA) Article 53 (방위산업체
안전관리)**.

> **[UNVERIFIED] flag**: DAA Art 28 and Art 53 are flagged
> `[UNVERIFIED-via-legalize-kr-full-text]` in the defense anchor (confirmed
> in `kr_safety` catalog but not re-verified via `parse_law_structure` this
> session). Article numbers are sourced from `Defense-Acquisition-Act.yaml`
> (mcp-kr-legislation) and are stable. Compliance-agent must pre-screen.

## Korean Defense Magazine Context

### Why magazine storage is distinct

| Factor | Manufacture (explosive-propellant WF) | Storage (this skill) |
|--------|---------------------------------------|----------------------|
| Lifecycle | Mixing, pressing, charging | Receipt, stacking, surveillance |
| Dominant hazard | ESD / friction during mixing | Sympathetic detonation / Q-D violation |
| Anchor | FSESA Art 9 + DAA Art 28 | FSESA Art 9 + FSESA Art 23 + DAA Art 53 |
| Failure mode | Single-point ignition | Cascade across stacked magazines |
| Frequency | Continuous production | Intermittent; decades-long hold |
| Fix | Process engineering | Siting + segregation rules |

A magazine is not just a warehouse with thicker walls. It is a system whose
siting (Q-D), internal segregation (compatibility groups), and surveillance
(periodic inspection for propellant deterioration) determine whether a single
initiation event cascades into a mass-detonation catastrophe.

### Hazard profile (from defense regulatory anchor)

- **FSESA Art 23** (UNCITED by existing WFs) — 화약류 안전관리자: Explosives
  Safety Manager must be appointed and supervise magazine operations
- **FSESA Art 9** — 화약류 취급제한: handling restrictions, including storage
  quantity and manner
- **DAA Art 53** ([UNVERIFIED-via-legalize-kr-full-text]) — 방위산업체
  안전관리: defense-industry contractor safety-management regime
- **OSHA-KR Art 36** — 위험성평가: mandatory risk assessment

## Hazard Scenarios Covered

### 1. Q-D (quantity-distance) violation

- Inhabited building (office, dormitory, public road) within the calculated
  inhabited-building distance (IBD) of the magazine NEW (net explosive
  weight)
- Intermagazine separation insufficient — one magazine initiation cascades
- Public-traffic route too close — fragment throw distance exceeded

### 2. Compatibility-group violation

- Commodity stored with incompatible group (e.g. flares with detonators)
  per the UN compatibility matrix (groups A through S, excluding I)
- Incompatible items in the same magazine — exothermic cross-reaction

### 3. UN hazard-division co-storage

- HD 1.1 (mass detonate) stored with HD 1.4 (moderate) — the 1.1 risk
  dominates the magazine
- HD 1.3 (mass fire) raising fire-load beyond magazine design

### 4. Sympathetic detonation

- Magazine-to-magazine propagation — stacked magazines without adequate Q-D
  or barricade geometry cascade
- Stacking geometry inside magazine that channels blast to adjacent stack

### 5. Lightning and static-electricity ignition

- Lightning strike on magazine roof without adequate air-terminal +
  down-conductor + grounding system
- Static discharge during loose-propellant transfer (analogous to the
  manufacture-phase ESD hazard but at lower frequency in storage)

### 6. Surveillance failure

- Deteriorated propellant (nitroester migration, acid sweat) undetected
  between inspection cycles
- Corroded casing, leaking filler — delayed initiation risk during handling

## Magazine Storage Safety Hierarchy (defense-specific)

### 1. Elimination

- Store at the minimum operationally-necessary NEW — reduce holdings
- Remote siting — move the magazine away from inhabited areas (greenfield
  siting for new facilities)
- Disperse storage across multiple smaller magazines instead of one large
  magazine (reduces per-magazine NEW and cascade risk)

### 2. Engineering controls (preferred over PPE)

- **Q-D siting** — calculate IBD per KOSHA / DOT 49 CFR / DoD 6055.09 for
  the stored NEW; barricaded vs unbarricaded geometry
- **Barricades** — earth-berm or concrete revetment between magazines to
  attenuate fragment throw and reduce intermagazine distance
- **Magazine construction** — above-ground arch, igloo (earth-covered), or
  underground per stored HD
- **Lightning protection system** — air terminals, down-conductors,
  grounding resistance per KOSHA guidance; bond all metallic infrastructure
  to ground
- **Static-electricity control** — conductive flooring, grounded
  bonding-straps on transfer equipment, humidity control (>55 % RH for
  loose-propellant zones)
- **Ventilation** — for HD 1.3 fire-load magazines, designed to vent
  combustion pressure without fragmenting the structure

### 3. Administrative controls

- **화약류안전관리자 appointment per FSESA Art 23** (UNCITED by existing
  WFs) — named Explosives Safety Manager supervises every operation
- **DAA Art 53 defense-contractor safety-management regime**
  [UNVERIFIED-flagged] — documented safety program
- **Risk assessment per OSHA-KR Art 36** — for receipt, storage, and issue
  operations
- **Compatibility-group segregation plan** — posted at the magazine door,
  updated on every receipt
- **Receipt inspection** — every incoming lot inspected for damage, proper
  marking, lot documentation
- **Periodic surveillance** — propellant-stability testing (e.g. vacuum
  stability, methyl-violet test) on the documented schedule
- **TBM** before each operation — see shared TBM workflow

### 4. PPE

- Anti-static smock + conductive footwear for loose-propellant zones
- Eye protection + leather gloves for handling
- Hearing protection for any transfer operation involving detonators
- No synthetic fabrics in HD 1.1 zones (static risk)

## Planning Workflow

1. **NEW inventory and HD classification** — net explosive weight by
   magazine; UN hazard division (1.1 / 1.2 / 1.3 / 1.4 / 1.5 / 1.6) for
   every item
2. **Q-D siting calculation** — IBD per the applicable KOSHA / DoD 6055.09
   table, for the magazine NEW and HD, with and without barricade
3. **Compatibility-group segregation plan** — verify each co-stored item
   against the UN compatibility matrix; assign magazine bays
4. **Intermagazine separation check** — confirm cascading detonation is
   not possible at the planned spacing
5. **Lightning-protection verification** — air terminals in place, ground
   resistance tested within cycle, bonding confirmed
6. **Static-control verification** — conductive flooring resistance tested,
   humidity controlled, bonding straps on transfer gear
7. **화약류안전관리자 appointment per FSESA Art 23** — named Explosives
   Safety Manager sign-off on the plan
8. **Receipt + surveillance cadence** — inspection schedule posted,
   propellant-stability test dates tracked
9. **Emergency response plan** — evacuation zones based on Q-D IBD, 119
   integration, magazine fire-fight approach (only with safety-manager
   approval — many HD 1.1 magazine fires require evacuation NOT
   firefighting)
10. **Issue-and-receipt execution** — chain-of-custody documentation,
    compatibility recheck at every transfer

## Output

```json
{
  "plan_id": "def-mmssp-2026-08-07-001",
  "site": "Defense Depot Magazine Row C",
  "magazine_id": "MAG-C-04",
  "operations": ["receipt", "storage", "surveillance", "issue"],
  "new_net_explosive_weight_kg": 4500,
  "dominant_hazard_division": "1.1",
  "compatibility_groups_present": ["D", "L"],
  "quantity_distance": {
    "ibd_inhabited_building_distance_m": 540,
    "imd_intermagazine_distance_m": 120,
    "barricaded": true,
    "public_traffic_route_distance_m": 320
  },
  "engineering_controls": {
    "construction_type": "igloo_earth_covered",
    "lightning_protection_ground_resistance_ohm": 7,
    "conductive_flooring_resistance_ohm": 1200000,
    "humidity_control_percent": 58,
    "ventilation": "pressure_venting_hd13_bay"
  },
  "administrative": {
    "explosives_safety_manager_per_fsesa_art23": "화약류안전관리자 박안전",
    "daa_art53_safety_program_registered": true,
    "risk_assessment_per_osha_art36": "RA-2026-08-07-022",
    "surveillance_test_next_due": "2026-11-15",
    "tbm_conducted": true
  },
  "ppe": {
    "anti_static_smock": true,
    "conductive_footwear": true,
    "leather_gloves": true,
    "synthetic_fabric_prohibited": true
  },
  "emergency_response": {
    "evacuation_zone_m": 540,
    "firefighting_policy": "evacuate_not_fight_for_hd11",
    "ems_pathway_119": "confirmed"
  },
  "regulatory_basis": [
    "총포·도검·화약류 등 단속법 (FSESA) Article 9 — 화약류 취급제한 (storage)",
    "총포·도검·화약류 등 단속법 (FSESA) Article 23 — 화약류 안전관리자",
    "방위사업법 (DAA) Article 53 — 방위산업체 안전관리 [UNVERIFIED-via-legalize-kr-full-text]",
    "산업안전보건법 (OSHA-KR) Article 36 — 위험성평가",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **총포·도검·화약류 등 단속법 (FSESA) Article 9** — 화약류 취급제한 (handling
  restrictions including storage quantity and manner)
- **총포·도검·화약류 등 단속법 (FSESA) Article 23** — 화약류 안전관리자
  (Explosives Safety Manager appointment) — the UNCITED gap this skill fills
- **방위사업법 (DAA) Article 53** — 방위산업체 안전관리
  [UNVERIFIED-via-legalize-kr-full-text] (defense-contractor safety regime)
- **산업안전보건법 (OSHA-KR) Article 36** — 위험성평가
- **KOSHA guidance** — Q-D tables and lightning-protection envelopes follow
  KOSHA publication by convention (which in turn tracks DoD 6055.09-M)
- **Defense-specific**: most Korean defense-depot magazines operate under a
  named 화약류안전관리자 (per FSESA Art 23) who MUST countersign every
  receipt and issue ticket; the safety-manager role cannot be vacant
  during operations
- **DAA Art 18 historical note**: DAA Article 18 was deleted 2020-03-31;
  the current safety-management anchor is Article 53 (verified — none of
  this skill's content cites the deleted Art 18)

## Integration

- **Input from**: depot operations order, magazine construction drawing,
  munitions lot documentation, NEW inventory
- **Output to**: `defense-munitions-storage-magazine-safety-record.json`
  (the evidence model for the `defense-munitions-storage-magazine-safety`
  workflow)
- **Coordinated skills**:
  - `explosive-propellant-handling` (existing defense WF) — MANUFACTURE-
    phase propellant mixing + ESD prevention; this skill is the STORAGE-
    phase counterpart
  - `missile-cryogenic-high-pressure` (existing defense WF) — cryogenic
    propellant gas handling; orthogonal hazard class
  - `permit-to-work` (daily) — generic permit issuance
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If Q-D IBD is violated by an inhabited building OR
  incompatible compatibility groups are found co-stored OR the
  화약류안전관리자 position is vacant, halt operations and escalate to the
  depot commander + safety manager before any issue/receipt transaction.

## Non-Duplication Justification

vs. `explosive-propellant-handling` (existing defense WF): that addresses
the MANUFACTURE phase — mixing of energetic materials, ESD prevention
during pressing and charging, FSESA Art 9 + DAA Art 28. This skill
addresses the STORAGE phase — magazine siting, Q-D, compatibility-group
segregation, surveillance of stored material, citing FSESA Art 23
(Explosives Safety Manager) which the existing WF does NOT cite. Different
lifecycle phase, different physics (process ignition vs. Q-D cascade),
different regulatory anchor (manufacture Art 9+28 vs. storage Art 9+23).

vs. `missile-cryogenic-high-pressure` (existing defense WF): that addresses
cryogenic / high-pressure gas during missile fueling — entirely different
hazard class (gas pressure vs. detonation).

vs. `defense-weapons-assembly-composite-solvent` (newly-generated defense
WF): that addresses weapons-system final-assembly chemical / composite /
confined-space hazards — inert structural assembly. This skill addresses
energetic-material storage. Orthogonal hazard class.

## Legal Disclaimer

> 자동화 계획 보조. 최종 마가진 안전 조치 결정은 화약류안전관리자 + 방위산업체
> 안전관리자 권한 per 총포·도검·화약류 등 단속법 (FSESA) Article 9 + Article 23
> and 방위사업법 (DAA) Article 53 [UNVERIFIED-flagged]. Q-D calculations,
> compatibility-group assignments, and lightning-protection ground resistance
> MUST be verified by a qualified explosives safety officer and the named
> 화약류안전관리자 before any magazine operation begins.
