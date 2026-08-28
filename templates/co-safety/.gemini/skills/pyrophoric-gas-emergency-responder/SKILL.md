---
name: pyrophoric-gas-emergency-responder
owner: semicon-agent
scope: workspace
status: active
description: Plan and execute emergency response for pyrophoric and toxic special-gas leaks in semiconductor fabs — silane (SiH4), arsine (AsH3), phosphine (PH3), diborane (B2H6). Detection-alarm response, gas-cabinet isolation, sub-fab evacuation zoning, suppression, post-incident investigation.
version: "1.0.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 실란 가스 누출
    - silane gas leak
    - pyrophoric gas emergency
    - 발화성 가스 사고
    - arsine phosphine diborane leak
    - special gas cabinet emergency
    - gas alarm response fab
    - 고압가스 사고 응급조치
    - HPGSCA Article 26
    - sub-fab evacuation
  legal_basis:
    - 고압가스안전관리법 제26조 (사고의 통보 등)
    - 위험물안전관리법 제27조 (응급조치·통보 및 조치명령)
    - 산업안전보건법 제36조 (위험성평가)
    - 산업안전보건법 제110조 (MSDS 작성·비치 의무)
    - 중대재해처벌법 제4조 (사업주와 경영책임자등의 안전 및 보건 확보의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Pyrophoric Gas Emergency Responder Skill

## Overview

Emergency-response planner and incident-phase decision support for
pyrophoric and toxic special-gas leaks in semiconductor fabs. Covers the
gas family that defines semiconductor catastrophic risk: **silane (SiH4,
pyrophoric), arsine (AsH3, LT-c 0.05 ppm), phosphine (PH3, LT-c 0.3 ppm),
diborane (B2H6, LT-c 0.05 ppm)**.

This skill is the operational counterpart to the `silane-gas-leak-response`
workflow (Task A-04, 2026-08-07). It fills the **incident-response phase**
gap that no existing semicon skill addresses — `special-gas-handling` covers
PREVENTIVE cylinder changeout and cabinet commissioning; it does not cover
active-leak response.

The semicon anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 527-529) cites
**고압가스 안전관리 및 사업법 (HPGSCA) Article 26 (사고의 통보 등)**
and **위험물안전관리법 (DSSMA) Article 27 (응급조치·통보)** — neither cited by
any other existing semicon skill.

## Korean Semiconductor Gas Context

### Why pyrophoric/toxic gas response is distinct

| Gas | PEL/LT-c | Flammability | Toxicity | Signature behavior |
|-----|----------|--------------|----------|--------------------|
| **Silane (SiH4)** | 5 ppm TWA | Pyrophoric (auto-ignites ~room temp) | Pulmonary edema | May autoignite OR accumulate and detonate — unpredictable |
| **Arsine (AsH3)** | 0.05 ppm | Flammable 4-10% | Hemolytic (destroys RBC) | 2-24 h latency then massive hemolysis |
| **Phosphine (PH3)** | 0.3 ppm | Flammable 1.6-98% | Cellular asphyxiant | Garlic odor threshold below PEL — unreliable warning |
| **Diborane (B2H6)** | 0.1 ppm | Pyrophoric + explosive 0.8-98% | Pulmonary edema | Autoignites, boron oxide smoke |

### Sub-fab gas architecture

- Gas cabinets (cylinder storage, auto-switchover) — sub-fab level -1
- Valve manifold box (VMB) — distributes to multiple tools
- Distribution piping (double-walled, annulus N2 purge monitoring)
- Process tool gas box — inside the cleanroom
- Exhaust → gas abatement (scrubber + burn box + water wash)
- Continuous monitoring (point + open-path FTIR/NDIR/UVDOAS)

### Detection architecture

- **Point sensors** at cabinet, VMB, tool gas box, exhaust (ppm-level)
- **Open-path** along the sub-fab service corridor (silane FTIR)
- **Annulus pressure** on double-walled pipe (1-3 s response)
- **Area UVDOAS** for arsine/phosphine at sub-pfm sensitivity

### Alarm taxonomy (typical Korean fab convention)

- **Level 1 (Advisory)**: 25% of PEL — investigate, log
- **Level 2 (Warning)**: 50% of PEL — cabinet auto-isolate, audio alarm
- **Level 3 (Evacuation)**: 100% of PEL OR confirmed leak — full sub-fab
  evacuation, scrubber bypass diversion, 119 standby

## Response Phases

### Phase 1 — Detection and verification (0-30 seconds)

1. Sensor triggers at Level 2 or Level 3
2. Auto-isolate: gas cabinet process valve closes, exhaust diverts to
   secondary scrubber, annulus purge N2 flow rises
3. BMS/Fab control system confirms sensor (no drift / no calibration event)
4. If silane: check for visible smoke / flame at cabinet exhaust — silane
   may have already autoignited at the leak point

### Phase 2 — Cabinet isolation and ventilation (30 s - 2 min)

1. Cabinet auto-isolation confirmed (process valve closed, cylinder valve
   closed if equipped)
2. Cabinet exhaust flow verified (maintains negative pressure)
3. Adjacent cylinders in same cabinet row — auto-switchover to standby row
4. Process tool using the gas → emergency interlock (stop gas flow at tool
   gas box, purge with inert N2)

### Phase 3 — Evacuation and accountability (2-5 min)

1. Sub-fab Level 3 evacuation announced (Korean + English bilingual PA)
2. Assembly point: upwind sub-fab entrance, gas-detection checkpoint
3. Tool operators in cleanroom above — shelter-in-place if gas is heavier
   than air (most pyrophorics rise, but arsine is borderline)
4. Headcount at assembly point vs. access-control badge log
5. Missing-worker search team with SCBA (positive-pressure, 30-min bottle)

### Phase 4 — Suppression and abatement (5-30 min)

1. **Silane small fire (cabinet exhaust flame)**: DO NOT extinguish unless
   gas source can be isolated. Burning silane produces SiO2 powder; unburned
   silane accumulation is the explosion risk. Isolate cylinder, let burn off,
   scrubber handles products.
2. **Silane accumulation (no flame yet)**: max explosion risk — evacuate
   ALL ignition sources, dilute with inert N2, monitor LEL until < 10%
3. **Arsine/phosphine release**: no flame risk, pure toxic-inhalation event.
   SCBA team only. Contaminated PPE → designated decon.
4. **Scrubber overload**: divert to backup abatement, then burn-box if
   equipped

### Phase 5 — Notification (within 1 hour)

- 고용노동부 (Ministry of Employment and Labor) — 중대재해 if any worker
  exposure > PEL or any injury
- 한국가스안전공사 (Korea Gas Safety Corp) — 고압가스 사고 per HPGSCA Art 26
- 소방서 (119) — if fire spread, burn injury, or rescue needed
- 고객사/동종 산업 단지 — mutual-aid activation if release reaches
  property line

### Phase 6 — Post-incident (within 24 hours)

- All-clear: continuous monitoring < 10% PEL for 30 min, source isolated
- Re-entry: SCBA team first, then gas-free verification
- Incident investigation under OSHA-KR Art 57 + SAPA Art 4
- Root-cause analysis (RCA) — see `root-cause-analysis` skill
- Evidence preservation: sensor logs, cabinet valve timing, scrubber data,
  cylinder weight record

## Decision Support Matrix

| Gas | Leak size | Flame? | Action |
|-----|-----------|--------|--------|
| Silane | Small (annulus) | No | Isolate, monitor, purge |
| Silane | Small (cabinet) | Yes (steady flame) | Isolate cylinder, let burn, scrubber on |
| Silane | Large (cabinet burst) | No (accumulating) | EVACUATE all ignition sources, inert, monitor LEL |
| Silane | Large | Yes (deflagration) | EVACUATE, 119, perimeter, DO NOT suppress |
| Arsine | Any | No | SCBA team, isolate, monitor, decon |
| Phosphine | Any | Possible | SCBA team, eliminate ignition, isolate |
| Diborane | Any | Likely (pyrophoric) | SCBA team, isolate, monitor |

## Planning Workflow (pre-incident)

1. **Gas inventory** — every cylinder, location, gas class, max inventory
2. **Detection map** — point sensors, open-path, annulus monitors
3. **Alarm setpoints** — Level 1/2/3 calibrated per gas, logged quarterly
4. **Evacuation routes** — sub-fab, cleanroom, assembly point, wind-direction
5. **SCBA team roster** — trained, fit-tested, 30-min bottles minimum 4
6. **Mutual-aid agreement** — adjacent fab / fire department pre-plan
7. **Notification tree** — 고용노동부, 한국가스안전공사, 119, customer
8. **Drill** — quarterly tabletop, annual full-evacuation with gas simulant

## Output

```json
{
  "plan_id": "fab-pger-2026-08-07-001",
  "site": "Fab-2 Sub-fab Bay S-12",
  "gas_inventory": [
    {"cabinet": "GC-SIL-301", "gas": "silane_SiH4", "cylinders": 2, "max_inventory_kg": 11},
    {"cabinet": "GC-ASH-101", "gas": "arsine_AsH3", "cylinders": 2, "max_inventory_kg": 1.5}
  ],
  "detection_coverage": {
    "point_sensors": 18,
    "open_path_FTIR": true,
    "annulus_monitors": "all_double_wall_pipes"
  },
  "alarm_setpoints": {
    "silane_L2_ppm": 2.5,
    "silane_L3_ppm": 5.0,
    "arsine_L2_ppm": 0.025,
    "arsine_L3_ppm": 0.05
  },
  "evacuation": {
    "sub_fab_zone": "S-12_S-13_S-14",
    "cleanroom_action": "shelter_in_place",
    "assembly_point": "Fab-2_north_loading_dock_upwind",
    "wind_direction_source": "Fab_BMS"
  },
  "response_team": {
    "SCBA_team_lead": "shift_lead_2",
    "SCBA_team_members": 4,
    "bottle_duration_min": 30,
    "decon_station": "Fab-2_west_decon"
  },
  "notification_tree": {
    "goelbo_within_1h": true,
    "kgsa_within_1h": true,
    "119_auto_dispatch": "if_Level_3_confirmed"
  },
  "drill_record": {
    "last_tabletop": "2026-07-15",
    "last_full_evacuation": "2026-04-20"
  },
  "regulatory_basis": [
    "고압가스 안전관리 및 사업법 (HPGSCA) Article 26 — 사고의 통보 등",
    "위험물안전관리법 (DSSMA) Article 27 — 응급조치·통보 및 조치명령",
    "화학물질관리법 (CCA) Article 40 — 사고대비물질의 관리기준",
    "산업안전보건법 (OSHA-KR) Article 36 — 위험성평가",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "incident_phase": "pre-incident_plan_ready",
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **고압가스 안전관리 및 사업법 (HPGSCA) Article 26** — 사고의 통보 등
  (accident notification: death/injury/poisoning, gas-leak explosion/fire,
  facility damage). [VERIFIED via legalize_kr (law.go.kr) — MST 283919,
  2026-08-07; Art 28 is 한국가스안전공사의 설립 (KGS establishment), not 응급조치]
- **위험물안전관리법 (DSSMA) Article 27** — 응급조치·통보 및 조치명령
- **한국가스안전공사 (KGS) 가스안전점검** — semi-annual cabinet + piping inspection
- **고용노동부 (MOEL) 중대재해 신고** — mandatory within 1 hour of any
  worker exposure > PEL or any injury
- **Semiconductor industry practice**: SEMI S2 (equipment safety), SEMI S14
  (fire risk), SEMI S17 (silane delivery) — referenced as engineering
  baseline, not as legal requirement

## Integration

- **Input from**: fab gas inventory, BMS alarm data, cabinet telemetry
- **Output to**: `semicon-silane-gas-leak-response-record.json` (the evidence
  model for the `silane-gas-leak-response` workflow)
- **Coordinated skills**:
  - `special-gas-handling` (workflow, not skill) — preventive cabinet
    operations
  - `gas-dispersion-analyzer` (gasterm) — for outdoor plume modeling if the
    release reaches the fab exhaust stack (NOT for sub-fab indoor dispersion)
  - `root-cause-analysis` — post-incident RCA per OSHA-KR Art 57
  - `emergency-response` — generic emergency dispatcher if first report
    comes through unclassified channel
- **Escalation**: Any Level 3 silane event triggers immediate 119 standby +
  KGS notification; any arsine exposure > 0.05 ppm triggers immediate
  hospital transport (hemolysis latency is 2-24 h)

## Non-Duplication Justification

vs. `gas-dispersion-analyzer` (gasterm): that skill models outdoor LNG/LPG/
hydrogen dispersion for terminal/transport incidents using Gaussian/dense-
gas models. It does NOT address indoor sub-fab gas-cabinet response, gas-
specific toxicity (arsine hemolysis, silane pyrophoricity), or the HPGSCA
Art 26 accident-notification protocol. The release physics are also distinct
(high-pressure cylinder indoor release vs. outdoor atmospheric release).

vs. `emergency-response` (skills/emergency): that skill is a generic
emergency dispatcher framework (Type A-E classification, 119 routing, MOEL
notification). It does NOT contain the gas-specific decision matrix
(silane-burn-vs-accumulate, arsine-hemolysis-latency) or the fab-specific
architecture (sub-fab, VMB, scrubber interlock). This skill is the
specialized responder; `emergency-response` is the dispatcher.

vs. `special-gas-handling` (workflow): preventive cylinder-changeout and
cabinet-commissioning scope. This skill is incident-response.

## Legal Disclaimer

> 자동화 응급조치 보조. 최종 가스 사고 대응 결정은 가스안전관리자 + 소방대장 +
> 현장 안전관리자 권한 per 고압가스 안전관리 및 사업법 (HPGSCA) Article 26 and
> 위험물안전관리법 (DSSMA) Article 27. HPGSCA article numbers were
> VERIFIED via legalize_kr (law.go.kr, MST 283919) on 2026-08-07 — Art 26
> (사고의 통보 등) is the accident-notification article; Art 28 is 한국가스안전공사의
> 설립 (KGS establishment). Silane behavior is inherently unpredictable — this
> skill's decision matrix is a planning aid, not a substitute for SCBA-equipped
> trained response teams.
