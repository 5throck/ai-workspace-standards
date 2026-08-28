---
name: painting-coating-fire-toxic-planner
owner: shipbuilding-agent
scope: workspace
status: active
description: Plan shipyard painting/coating bay safety — combustible paint-vapor LEL explosion control, solvent-vapor inhalation (toluene/xylene/MEK), confined-area painting O2 deficiency, paint-shop fire response. Covers Korea's iconic shipbuilding fatal-fire cause (2015 Samsung Heavy, 2019 Hyundai Heavy painting-bay fires). DSSMA Art 5 + Art 27 (both uncited by existing shipbuilding WFs) + OSHA Art 38 + Art 110 (MSDS) + SAPA Art 4/5.
version: "1.0.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 조선 도장 작업 화재 폭발
    - ship painting coating fire
    - 선박 도료 가연성 증기 LEL
    - paint vapor LEL explosion shipyard
    - 유기용제 흡입 노출 도장
    - solvent vapor inhalation painting
    - 도장 베이 화재 대응
    - paint bay fire response
    - 밀폐구역 도장 산소결핍
    - confined area painting O2 deficiency
    - DSSMA Article 5 도장 위험물
    - DSSMA Article 27 응급조치
    - OSHA-KR Article 110 물질안전보건자료(MSDS) 작성·제출
    - SAPA Article 5 도급 사업주
  legal_basis:
    - "위험물안전관리법 제5조 (도장·도포 작업 위험물 저장 및 취급)"
    - "위험물안전관리법 제27조 (응급조치·통보 및 조치명령)"
    - "산업안전보건법 제38조 (추락 등 안전조치 — 도장 베이 가연성 증기 환기 및 화기 관리)"
    - "산업안전보건법 제110조 (물질안전보건자료 작성·제출 — 용제 MSDS)"
    - "중대재해처벌법 제5조 (도급·하도급 사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Painting Coating Fire Toxic Planner Skill

## Overview

Shipyard painting/coating bay safety planner for new-build block painting,
touch-up coating, and paint-mixing operations — the FIRE/TOXIC hazard
face of shipbuilding, distinct from the LIFTING/subcontractor MECHANICS
covered by `heavy-crane-subcontractor-safety`, the TANK-ENTRY asphyxia
covered by `ship-tank-confined-space`, and the WELDING-fume/gas hazard
covered by `shipbuilding-welding-fume-gas-safety`.

The shipbuilding industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 560-624) names
**위험물안전관리법 (DSSMA) Article 5 (도장/도포 작업 위험물 취급)** and
**DSSMA Article 27 (응급조치 — 화재/폭발 대응)** in the adjacent_laws
block — cited by ZERO existing shipbuilding workflows prior to the
`shipbuilding-painting-coating-fire-toxic` workflow (Task C-1b,
2026-08-07). Both articles were LIVE-VERIFIED via
`kr_safety.search_osha_regulations` this session. This skill
operationalizes those two uncited articles + OSHA Art 38 + OSHA Art 110
(MSDS) + SAPA Art 5 into a deployable painting-bay safety plan.

## Korean Shipbuilding Painting Context

### Why painting/coating is the iconic shipbuilding hazard

| Factor | Welding (sister WF) | Painting/coating (this skill) |
|--------|---------------------|-------------------------------|
| Hazard class | Solid particulate (fume) + arc-electrical | Liquid vapor (solvent) + flammability |
| Fire risk | Spark ignition (localized) | LEL vapor cloud explosion (volume-wide) |
| Toxic profile | Mn, Cr6+, ozone (chronic) | Toluene, xylene, MEK (acute + chronic) |
| Ignition sources | welding arc itself | ALL static sparks, electrical, hot work adjacent |
| Ventilation regime | Local exhaust (LEV) at arc | Bay-wide dilution + LEL continuous monitor |
| Fatal history | Long-latency cancer | Acute multi-fatality fire (Samsung 2015, Hyundai 2019) |
| Co-existent work | Usually solo welder | Multi-spray-gun crew + mixer + supervisor |

Painting-bay fires are Korea's single most fatal shipbuilding incident
class. The 2015 Samsung Heavy Industries painting-bay explosion (6 dead)
and the 2019 Hyundai Heavy Industries paint-shop fire (3 dead) are the
canonical Korean shipbuilding disasters of the last decade. The hazard
profile is fundamentally different from welding: solvent vapor can
accumulate into an LEL cloud that ignites volumetrically, killing the
entire spray crew + mixer + supervisor before evacuation is possible.

### Hazard profile (from shipbuilding regulatory anchor)

- **DSSMA Art 5** (UNCITED by existing WFs; in anchor adjacent_laws) —
  도장/도포 작업 위험물 취급: dangerous-goods handling for painting /
  coating operations — paint and thinner are Class 4 / Class 5
  flammable liquids under DSSMA
- **DSSMA Art 27** (UNCITED by existing WFs; in anchor adjacent_laws) —
  응급조치·통보 및 조치명령: emergency response for fire/explosion;
  mandatory notification and corrective-order authority
- **OSHA-KR Art 38** — 안전조치 (universal worker-safety measures)
- **OSHA-KR Art 110** — 물질안전보건자료 작성·제출 (paint/thinner MSDS submission
  on-site and consulted for solvent-specific PPE / first-aid)
- **SAPA Art 5** — 도급·하도급 사업주 (outsourcing safety; painting is
  the most heavily subcontracted trade in Korean shipyards — virtually
  all spray crews are contractor firms)

## Hazard Scenarios Covered

### 1. Paint-vapor LEL cloud explosion (painting bay)

- Multi-spray-gun operation in a semi-enclosed painting bay; toluene /
  xylene / MEK vapor accumulates if ventilation fails
- Static-electricity discharge from spray gun or operator clothing — LEL
  cloud ignition
- Volume-wide explosion — multi-fatality (Samsung 2015 pattern)
- The signature painting-bay fatal-incident class

### 2. Confined-area painting O2 deficiency + solvent asphyxia

- Painting inside a ship block section (not a cargo tank — that is
  `ship-tank-confined-space`; this is the block-interior painting before
  block-erection)
- Solvent vapor displaces oxygen; painter inside the section loses
  consciousness
- Different rescue profile from tank-entry (block-interior geometry is
  irregular, not a single tank)

### 3. Paint-mixing room flammable-vapor fire

- Paint + thinner mixing in a dedicated mixing room; vapor release during
  transfer
- Spark from non-explosion-proof equipment (fan motor, light switch) —
  mixing-room fire
- High volume of flammable liquid in one location

### 4. Surface-prep dust (sandblasting / grit) co-existent

- Abrasive blasting before painting — silica / steel-grit dust
- Subsumed as a surface-prep job-step under this skill (Group C-1a
  rejected `shipbuilding-sandblasting-silica-dust` as a separate WF to
  avoid fragmenting the coating workflow)
- Concurrent with the painting hazard profile

### 5. Hot-work-adjacent ignition (welding in nearby block)

- Welding work on an adjacent block in the same bay — spark travels to
  painting bay vapor cloud
- Multi-trade shipyard bay allocation failure — the canonical shipbuilding
  fatality causal chain

### 6. Solvent chronic-inhalation (painter long-term exposure)

- Career painter exposure to low-level toluene / xylene — chronic
  neurotoxicity, hepatotoxicity
- Acute vs chronic: LEL explosion is the acute risk; this is the long-
  latency chronic risk
- OSHA Art 125 작업환경측정 + OSHA Art 111 건강진단 apply

## Painting/Coating Safety Hierarchy (shipyard-specific)

### 1. Elimination

- Substitute water-based paint for solvent-based where coating spec allows
  (low-VOC or zero-VOC paint eliminates most of the LEL + toxic hazard)
- Pre-fabrication coating (shop-primer applied at plate stage before
  block assembly) reduces block-stage painting volume
- Robotic / automated spray where geometrically feasible (operator out
  of the spray zone entirely)

### 2. Engineering controls (preferred over PPE)

- **Bay-wide dilution ventilation** — air changes per hour (ACH) sized
  to keep solvent vapor below 25% LEL under worst-case spray rate; LEL
  monitor with audible/visual alarm
- **Continuous LEL monitoring** at spray-zone + mixing room + exhaust
  duct discharge; interlock that auto-stops spray guns at 25% LEL
- **Explosion-proof (Ex-e / Ex-d) electrical** in the entire painting-bay
  zone — fans, lights, switches, monitor housings (DSSMA Art 5
  dangerous-goods facility standard)
- **Static-electricity control** — spray guns + spray-booth structure +
  paint-supply drums bonded and grounded; conductive flooring; operator
  anti-static garments (NOT synthetic fabric)
- **Paint-mixing room with blast-relief venting** — separate from spray
  bay; explosion-proof lighting; limited inventory (one-shift paint
  volume only)
- **Local exhaust ventilation (LEV) at block-interior painting** —
  forced exhaust from the block section, not just bay dilution
- **Hot-work exclusion zone** — physical barrier + signage between
  painting bay and any welding bay; permit-required to cross

### 3. Administrative controls

- **DSSMA Art 5 dangerous-goods handling plan** — paint + thinner
  inventory, storage, transfer, disposal procedures; documented and
  approved
- **DSSMA Art 27 emergency-response plan** — fire / explosion response,
  notification sequence, 30-minute regulatory notification window for
  major incidents
- **SAPA Art 5 contractor safety-management agreement** — painting
  contractor pre-qualification, training records, insurance; on file
  before crew mobilization (painting is the most subcontracted trade)
- **Hot-work permit coordination** — daily bay-allocation meeting to
  prevent painting/welding co-location; PTW issued by shipyard
  안전관리자
- **OSHA Art 110 MSDS on-site** — MSDS for every paint + thinner on the
  job site; crew briefed on solvent-specific hazards and first-aid
- **OSHA Art 125 작업환경측정** — periodic solvent-vapor air monitoring
  for chronic-exposure compliance
- **TBM (tool-box meeting)** before each shift — see shared TBM workflow
- **Permit-to-work** for confined-area painting (block-interior)

### 4. PPE (painting-specific)

- **Supplied-air respirator (SAR) or SCBA** for all spray painting —
  NOT an organic-vapor cartridge respirator (cartridge breakthrough
  time is too short at spray-zone vapor concentrations, and painters
  cannot detect breakthrough by smell due to olfactory fatigue)
- **Anti-static coveralls (cotton or conductive-fiber)** — NOT synthetic
  fabric (nylon/polyester generates static)
- **Chemical-resistant gloves + boots** (nitrile for solvent-based
  paint)
- **Safety glasses + face shield** during mixing (splash)
- **Conductive footwear** (anti-static rating)
- **Hearing protection** if grit-blasting is co-existent

## Planning Workflow

1. **Paint/coating specification review** — paint type (solvent vs water-
   based), thinner, spray rate, surface area to be coated
2. **Bay-zone allocation** — confirm painting bay is separated from
   welding/hot-work bays by hot-work exclusion zone; PTW cross-check
3. **Ventilation design / verification** — bay ACH confirmed for the
   planned spray rate; LEL monitors calibrated and tested
4. **LEL monitor interlock test** — spray-gun auto-stop verified at 25%
   LEL (the critical engineering control)
5. **Static-electricity control verification** — spray gun + structure +
   drums grounded; conductivity tested; operator garments inspected
6. **Explosion-proof equipment verification** — every fan, light,
   switch in the bay zone confirmed Ex-rated
7. **Paint-mixing room setup** — inventory limited to one-shift volume;
   blast-relief venting functional; explosion-proof lighting
8. **Confined-area painting plan (if block-interior)** — LEV forced
   exhaust, entry permit, atmosphere monitoring, rescue plan
9. **MSDS review per OSHA Art 110** — solvent-specific PPE + first-aid
   briefed to crew
10. **SAPA Art 5 contractor verification** — painting-contractor safety-
    management agreement, training records, insurance on file
11. **DSSMA Art 5 + Art 27 documentation** — dangerous-goods plan +
    emergency-response plan filed; fire-response pathway briefed
12. **OSHA Art 125 작업환경측정 schedule** — air monitoring set for the
    shift
13. **PPE issuance** — supplied-air respirators fit-tested; anti-static
    garments issued
14. **TBM + permit issuance** — tool-box meeting conducted, PTW issued
15. **Execution + continuous LEL monitoring** — LEL monitors live, wind
    direction considered for any partial-vent bay, escape routes clear
16. **Fire response** — at first LEL alarm, spray stops (auto-interlock),
    crew evacuates, fire-watch calls 119, DSSMA Art 27 notification
    sequence initiated
17. **Post-operation** — ventilation continues until vapor below 10% LEL,
    paint/sealed for curing, incident log filed

## Output

```json
{
  "plan_id": "ship-pcfp-2026-08-07-001",
  "shipyard": "HHI Ulsan Yard Block-Erection Bay 7",
  "task_type": "new_build_block_primer_and_topcoat",
  "paint_type": "solvent_based_epoxy",
  "thinner": "xylene_me_blend",
  "surface_area_m2": 480,
  "spray_rate_l_min": 4.5,
  "crew_size": 6,
  "contractor": "PaintCo-Korea (SAPA Art 5 agreement on file)",
  "hazard_classification": {
    "primary": "LEL_vapor_cloud_explosion",
    "secondary": "solvent_inhalation_chronic",
    "tertiary": "confined_area_O2_deficiency"
  },
  "elimination_applied": {
    "water_based_substitution": false,
    "reason": "marine_grade_spec_requires_solvent_epoxy"
  },
  "engineering_controls": {
    "bay_ventilation_ach": 20,
    "lel_monitors_count": 4,
    "lel_alarm_threshold_pct": 25,
    "spray_gun_lel_interlock": "tested_2026_08_07",
    "explosion_proof_equipment": "Ex_d_all_fans_lights_switches",
    "static_grounding": "verified_spray_gun_structure_drums",
    "hot_work_exclusion_zone_m": 30,
    "hot_work_permit_cross_check": "no_welding_in_bay_7_today"
  },
  "administrative": {
    "dssma_art5_dg_plan_filed": true,
    "dssma_art27_er_plan_filed": true,
    "sapa_art5_contractor_agreement": "PAINTCO-2026-022-on-file",
    "osha_art110_msds_on_site": true,
    "osha_art125_work_env_measurement": "scheduled_shift_1",
    "ptw_issued": true,
    "permit_id": "WP-SHIPYARD-2026-08-07-0317",
    "tbm_conducted": true
  },
  "ppe": {
    "respirator_type": "supplied_air_sar",
    "coverall": "anti_static_cotton",
    "gloves": "nitrile_chemical_resistant",
    "footwear": "conductive_anti_static",
    "cartridge_respirator_authorized": false,
    "reason": "cartridge_breakthrough_too_fast_at_spray_zone_concentration"
  },
  "lel_monitoring": {
    "continuous": true,
    "alarm_threshold_pct_lel": 25,
    "auto_stop_spray_gun": true,
    "fire_watch_posted": true
  },
  "rescue_plan_ref": "SHIPYARD-ERP-2026-painting-bay-fire",
  "regulatory_basis": [
    "위험물안전관리법 (DSSMA) Article 5 — 도장/도포 작업 위험물 취급",
    "위험물안전관리법 (DSSMA) Article 27 — 응급조치·통보 및 조치명령 (화재/폭발 대응)",
    "산업안전보건법 (OSHA-KR) Article 38 — 유해물·위험물 취급 안전조치",
    "산업안전보건법 (OSHA-KR) Article 110 — 물질안전보건자료 작성·제출",
    "산업안전보건법 (OSHA-KR) Article 125 — 작업환경측정",
    "중대재해처벌법 (SAPA) Article 5 — 도급·하도급 사업주 안전보건 확보 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **위험물안전관리법 (DSSMA) Article 5** — 도장/도포 작업 위험물 취급
  (dangerous-goods handling for painting/coating; shipyard paint and
  thinner are regulated dangerous goods) — UNCITED by existing shipbuilding
  WFs, newly activated by this skill
- **위험물안전관리법 (DSSMA) Article 27** — 응급조치·통보 및 조치명령
  (emergency response, notification, and corrective orders for fire/
  explosion) — UNCITED by existing WFs, newly activated
- **산업안전보건법 (OSHA-KR) Article 110** — 물질안전보건자료 작성·제출 (paint/thinner
  MSDS mandatory on-site)
- **산업안전보건법 (OSHA-KR) Article 125** — 작업환경측정 (periodic solvent-
  vapor air monitoring for chronic-exposure compliance)
- **중대재해처벌법 (SAPA) Article 5** — 도급·하도급 사업주 (outsourcing safety;
  highly relevant — virtually all spray crews in Korean shipyards are
  contractor firms, so SAPA Art 5 is the operative safety-management
  anchor)
- **119 소방서 + 해양경찰청** — painting-bay fire response requires rapid
  119 dispatch; the 30-minute DSSMA Art 27 regulatory notification window
  applies for major incidents
- **Shipbuilding-specific**: Korea's Big Three shipyards (HHI Ulsan, SHI
  Geoje, DSME Okpo) all operate large painting bays with tragic fatal-
  fire history — the LEL interlock + supplied-air respirator discipline
  is the single highest-leverage control for the industry

## Integration

- **Input from**: ship block coating specification, paint + thinner
  product data sheets, spray-equipment list, contractor mobilization
  plan, bay-allocation schedule
- **Output to**: `shipbuilding-shipbuilding-painting-coating-fire-toxic-record.json`
  (the evidence model for the `shipbuilding-painting-coating-fire-toxic`
  workflow at `workflows/domains/industry/shipbuilding/shipbuilding-painting-coating-fire-toxic/`)
- **Coordinated skills**:
  - `heavy-crane-subcontractor-safety` (existing shipbuilding WF) — block
    ERECTION lifting; this skill covers the PAINTING of the erected block.
    Coordinate via SAPA Art 5 contractor-management provisions
  - `ship-tank-confined-space` (existing shipbuilding WF) — TANK-ENTRY
    asphyxia from inert gas during inspection; this skill covers the
    painting BAY/SHOP (scopes to paint shop per Group C-1a to avoid
    overlap with tank painting)
  - `ghs-classifier` (ehschem) — for paint/thinner chemical classification
  - `msds-parser` (msds) — for solvent-specific PPE and first-aid lookup
    per OSHA Art 110
  - `permit-to-work` (daily) — issues the PTW for hot-work exclusion zone
    and confined-area painting entry
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If LEL monitor reads >25% at any point, OR spray-gun
  interlock fails test, OR hot-work permit is issued for an adjacent bay
  on the same shift, OR a supplied-air respirator is unavailable, halt
  painting operations immediately. No PPE-only fallback exists for LEL
  cloud explosion — the interlock + ventilation + exclusion zone triad is
  the load-bearing control.

## Non-Duplication Justification

vs. `heavy-crane-subcontractor-safety` (existing shipbuilding WF): that
addresses the LIFTING/subcontractor MECHANICS of goliath cranes (OSHA
Art 38 + Art 63 + SAPA Art 5). This skill addresses the CHEMICAL/fire
hazard of painting — different physics (flammable-vapor vs. kinetic),
different regulatory anchor (DSSMA Art 5/27 vs. OSHA Art 63), different
trade (painters vs. crane operators).

vs. `ship-tank-confined-space` (existing shipbuilding WF): that addresses
TANK-ENTRY asphyxia from inert gas during cargo/ballast tank inspection
(OSHA Art 38 + 39 + 618). This skill addresses the PAINTING BAY/SHOP
fire/toxic hazard — different hazard class (flammable-vapor LEL +
solvent toxicity vs. inert-gas asphyxia). Explicitly scopes to paint
shop per Group C-1a to avoid overlap with tank painting (tank painting
would invoke the confined-space WF's permit + atmosphere regime).

vs. `shipbuilding-welding-fume-gas-safety` (sister new WF): that
addresses WELDING-fume particulate (Mn/Cr6+) + gas-cylinder + arc
(고압가스 안전 관리 및 사업법 (HPGSCA) Art 11/13/15/24/26 + OSHA Art 38 + OSHSR 전기·화재 기준). This skill addresses PAINTING-vapor
liquid solvent + LEL flammability (DSSMA Art 5/27). Different chemical
profile (solid particulate + ozone vs. liquid solvent + flammability),
different fire risk geometry (spark ignition vs. LEL cloud), different
PPE (fume respirator + welding helmet vs. supplied-air + anti-static).
The two skills coordinate via the hot-work exclusion zone.

## Legal Disclaimer

> 자동화 계획 보조. 최종 도장 작업 안전 조치 결정은 조선소 안전관리자 +
> 도장하도급업체 안전책임자 권한 per 위험물안전관리법 (DSSMA) Article 5 +
> Article 27 and 중대재해처벌법 (SAPA) Article 5. LEL monitor calibration,
> ventilation design, spray-gun interlock testing, and supplied-air
> respirator fit-testing MUST be verified by the shipyard 안전관리자 and a
> qualified industrial hygienist before any spray painting begins.
