---
name: hv-cell-formation-electrical-safety-planner
owner: battery-agent
scope: workspace
status: active
description: Plan high-voltage DC electrical safety for lithium-ion cell formation, charging, aging, and large ESS charge/discharge facilities. Busbar LOTO, formation-charger grounding, aging-room interlock, ESS arc-flash boundary, DC arc-flash PPE selection, 전기안전관리자 sign-off per ESCA Art 22.
version: "1.0.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 배터리 셀 화성 고전압 안전
    - cell formation electrical safety
    - 이차전지 충전 에이징 감전
    - ESS charge discharge arc flash
    - formation charger grounding
    - 배터리 busbar LOTO
    - 전기안전관리자 선임 배터리
    - ESCA Article 16 전기재해 예방
    - ESCA Article 22 battery safety manager
    - 산업안전보건법 Article 38 안전조치 + 안전보건기준에관한규칙 전기 기준
    - aging room thermal interlock
    - DC arc flash battery
  legal_basis:
    - 전기안전관리법 제16조
    - 전기안전관리법 제22조
    - 산업안전보건법 제38조
    - 중대재해처벌법 제4조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# HV Cell Formation Electrical Safety Planner Skill

## Overview

High-voltage DC electrical-safety planner for lithium-ion cell-formation,
charging, aging, and large-format ESS (Energy Storage System) charge/
discharge operations — the ELECTRICAL hazard face of battery manufacturing,
distinct from the chemical/thermal face covered by `battery-thermal-runaway-
prevent`.

The battery industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 155-164) names
**전기안전관리법 (ESCA) Article 16 (전기재해 예방을 위한 안전조치)** and
**ESCA Article 22 (전기안전관리자 선임)** as adjacent laws — cited by ZERO
existing battery workflows prior to the `battery-cell-formation-electrical-
safety` workflow (Task 21, 2026-08-07). The anchor notes also name
**산업안전보건법 Article 38 (안전조치 — 감전 위험 방지)** for cell-stack assembly. This skill
operationalizes those three uncited articles into a deployable safety plan.

## Korean Battery HV Electrical Context

### Why battery HV DC work is distinct

| Factor | AC mains / industrial | Battery formation / ESS |
|--------|-----------------------|-------------------------|
| Current type | AC (natural zero-cross) | DC (no zero-cross — arc sustains) |
| Fault energy | Grid + transformer | Busbar + cell-stack (huge, sustained) |
| Disconnect | Breaker opens cleanly | DC contactor + fuse, arc lingers |
| Voltage range | 220 / 380 / 22 kV | 3.5–4.5 V/cell; packs 400–1500 V DC |
| Co-located energy | Generally de-energizable | ALWAYS live (cells store energy) |
| Work type | Install / maintain | Continuous (formation, aging, cycling) |

The absence of a natural zero-cross in DC means an arc, once struck, does
not self-extinguish. DC arc-flash boundary calculations and DC-rated PPE are
mandatory — standard AC arc-flash suits (tested with an AC zero-cross) do
not contain a sustained DC arc.

### Hazard profile (from battery regulatory anchor)

- **ESCA Art 16** (UNCITED by existing WFs) — 전기재해 예방을 위한 안전조치:
  mandatory electrical-disaster-prevention safety measures
- **ESCA Art 22** (UNCITED by existing WFs) — 전기안전관리자 선임: Electrical
  Safety Manager must be appointed and must sign off on HV work
- **OSHA-KR Article 38** (corrected anchor) — 감전 등 안전조치: electrical-
  shock hazard prevention
- **DSSMA Art 5** — 위험물 저장·취급 기술기준 (electrolyte solvent storage,
  overlapping chemical-energy control)

## Hazard Scenarios Covered

### 1. Cell-formation charger HV DC contact

- First-charge formation at controlled CV/CC (3.5–4.2 V/cell, string-level
  100–1000 V DC bus)
- Manual connection/disconnection of formation bars between charger and cell
  cart
- Busbar LOTO failure — charger remains energized while operator touches bar

### 2. Aging-room combined electrical + thermal

- Cells held at 40–60 °C for days/weeks in aging rooms, electrically
  characterized under load
- Aging rack bus energized continuously; thermal runaway in one cell can
  breach adjacent racks (combined thermal + electrical escalation)
- Door-interlock failure — operator enters energized rack zone

### 3. ESS container arc-flash

- Grid-tie inverter (AC) + HV DC battery string (400–1500 V DC) in one
  container
- DC fault during maintenance — massive, sustained arc-flash
- Standard AC arc-flash PPE insufficient for DC sustained arc

### 4. Cell-level characterization bench

- Probe contact at bench with individual cells under test
- Small but frequent — repetitive exposure, low-vigilance drift

## HV Electrical Safety Hierarchy (battery-specific)

### 1. Elimination

- Engineer the operator out of the loop — automated formation-bar handling
  (robotic cart docking) where economically feasible
- Remote ESS monitoring — minimize container entry during operation
- Dielectric-barrier cell characterization (no exposed probe tips)

### 2. Engineering controls (preferred over PPE)

- **DC contactor + fast fuse** at every busbar tap — clears DC fault faster
  than operator can react
- **Ground-fault detection** on every formation charger (per ESCA Art 16)
- **Aging-room door interlock** — de-energizes rack bus on door open
- **ESS container arc-resistant design** — ducts arc plasma away from
  operator work zone
- **Insulation monitoring** on ungrounded IT-system battery DC buses

### 3. Administrative controls

- **작업허가서 (work permit)** for any busbar LOTO work per ESCA Art 16
- **전기안전관리자 sign-off** per ESCA Art 22 — named safety manager must
  approve the LOTO plan before execution
- **DC arc-flash boundary calculation** posted on every container
- **Buddy system** for all ESS-container entry
- **TBM (tool-box meeting)** before each shift — see shared TBM workflow

### 4. PPE (DC-rated)

- **DC arc-flash suit** rated for the calculated incident energy (NOT an
  AC-only suit) — typical 40–100 cal/cm² for ESS work
- Dielectric gloves (Class 2, 17 kV) with leather over-protectors
- Arc-rated face shield + balaclava + hearing protection (DC arc blast
  overpressure)
- Insulated hand tools (1000 V rated) — no bare metal in the work zone

## Planning Workflow

1. **Work-zone characterization** — formation line / aging room / ESS
   container; identify every energy source (DC bus, AC inverter, stored cell
   energy, control-power 24 V)
2. **DC arc-flash incident-energy calculation** per IEEE 1584 / NFPA 70E
   (using maximum prospective DC fault current from the cell string)
3. **Busbar LOTO procedure** — written, energy-isolated, verified absent by
   meter; DC contactor + physical bus-bar disconnect + ground strap
4. **Aging-room interlock verification** — door interlock tested, rack-bus
   de-energization confirmed before entry
5. **전기안전관리자 sign-off per ESCA Art 22** — named manager reviews and
   signs the LOTO plan
6. **PPE selection** — match arc-rated suit to calculated incident energy;
   verify DC-rated (not AC-only)
7. **TBM + permit issuance** — tool-box meeting conducted, 작업허가서 issued
8. **Execution + buddy** — second worker outside the arc-flash boundary with
   rescue equipment
9. **Post-work verification** — bus re-energized in sequence, interlocks
   re-armed, no tools/debris in container
10. **Emergency response plan** — DC-fault rescue (extract without touching
    energized bus), 119 dispatch, incident reporting per OSHA-KR Art 57

## Output

```json
{
  "plan_id": "batt-hvces-2026-08-07-001",
  "site": "Battery Plant 2 Formation Hall B",
  "task_type": "ess_container_maintenance",
  "dc_bus_voltage_v": 1250,
  "prospective_fault_current_ka": 35,
  "calculated_incident_energy_cal_cm2": 65,
  "arc_flash_boundary_m": 2.8,
  "workers_exposed": 2,
  "energy_sources": ["dc_battery_string", "ac_inverter_380v", "control_24v"],
  "elimination_opportunities": ["remote_monitoring_upgrade_q4"],
  "engineering_controls": {
    "dc_contactor_per_busbar_tap": true,
    "ground_fault_detection": true,
    "door_interlock": "verified_2026_08_07",
    "insulation_monitoring": "IT_system_ungrounded"
  },
  "administrative": {
    "permit_issued": true,
    "permit_id": "WP-2026-08-07-0312",
    "electrical_safety_manager_signoff_per_esca_art22": true,
    "esm_name": "전기안전관리자 김안전",
    "tbm_conducted": true,
    "buddy_assigned": "worker_2_outside_arc_boundary"
  },
  "ppe": {
    "arc_flash_suit_rating_cal_cm2": 75,
    "dc_rated": true,
    "dielectric_gloves_class": 2,
    "insulated_tools_1000v": true
  },
  "rescue_plan_ref": "BATT-2-ERP-2026-dc-fault",
  "regulatory_basis": [
    "전기안전관리법 (ESCA) Article 16 — 전기재해 예방을 위한 안전조치",
    "전기안전관리법 (ESCA) Article 22 — 전기안전관리자 선임",
    "산업안전보건법 (OSHA-KR) Article 38 — 감전 등 위해 방지 안전조치",
    "위험물안전관리법 (DSSMA) Article 5 — 위험물 저장·취급 기술기준",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **전기안전관리법 (ESCA) Article 16** — 전기재해 예방을 위한 안전조치
  (mandatory electrical-disaster prevention measures; work-permit for HV
  work)
- **전기안전관리법 (ESCA) Article 22** — 전기안전관리자 선임 (Electrical
  Safety Manager must be appointed; signs off on HV LOTO plans)
- **산업안전보건법 (OSHA-KR) Article 38** — 감전 등 위해 방지 안전조치 (electrical-shock
  hazard prevention)
- **KOSHA 안전검사 합격품** — DC arc-flash suits and dielectric gloves must
  carry the KOSHA certification mark
- **119 구조대 연계** — DC-fault rescue requires rapid 119 dispatch; sustained
  DC arc cannot be interrupted by the victim
- **Battery-specific**: most Korean cell-formation and ESS facilities operate
  under a named 전기안전관리자 (per ESCA Art 22) who MUST countersign every
  HV work permit before execution

## Integration

- **Input from**: battery work-order, formation-line / ESS-container
  single-line diagram, cell-string fault-current specification
- **Output to**: `battery-cell-formation-electrical-safety-record.json`
  (the evidence model for the `battery-cell-formation-electrical-safety`
  workflow)
- **Coordinated skills**:
  - `permit-to-work` (daily) — issues the 작업허가서 that this plan references
  - `psm-loto` (psm) — generic LOTO procedure; this skill specializes it for
    DC battery buses (which have no natural zero-cross)
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If DC arc-flash incident energy exceeds 100 cal/cm² (DC
  suit ceiling), halt work and re-engineer (move the work to a different
  busbar tap, or de-energize the string fully). No PPE-only solution exists
  above that threshold.

## Non-Duplication Justification

vs. `battery-thermal-runaway-prevent` (existing battery WF): that addresses
the CHEMICAL/THERMAL aspect of the cell itself (electrolyte volatility, NMP
recovery, thermal-runaway chain) under DSSMA Art 5 + Art 27. This skill
addresses the ELECTRICAL aspect during formation/aging/ESS work, citing
ESCA Art 16 + Art 22 — which the existing WF does NOT cite. The two
disciplines (thermal-runaway chemistry vs. HV DC arc-flash) have distinct
physics, distinct PPE, and distinct regulatory anchors.

vs. `battery-recycling-hazard-control` (existing battery WF): that addresses
end-of-life wet-chemical leaching. This skill addresses start-of-life HV
electrical formation — entirely different lifecycle phase.

vs. `arc-flash-analyzer` (ehsconst / powergen): that skill addresses AC
arc-flash at industrial mains frequencies (60 Hz, with natural zero-cross).
It does NOT cover DC arc-flash from battery strings, where the sustained arc
fundamentally changes incident-energy calculation and PPE selection.

## Legal Disclaimer

> 자동화 계획 보조. 최종 고전압 안전 조치 결정은 전기안전관리자 + 안전관리자 권한
> per 전기안전관리법 (ESCA) Article 16 + Article 22 and 산업안전보건법 (OSHA-KR)
> Article 101. DC arc-flash incident-energy calculations and PPE ratings MUST
> be verified by a qualified electrical engineer and the named
> 전기안전관리자 before any energized work begins.
