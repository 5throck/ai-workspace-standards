---
name: coke-oven-pah-heat-stress-planner
owner: steelmaking-agent
scope: workspace
status: active
description: Plan coke-oven battery worker safety — coal-tar-pitch-volatile PAH (IARC Group 1 carcinogen) inhalation exposure, oven-top extreme-heat stress, coke-oven-gas leak. Industrial-hygiene exposure-assessment discipline distinct from byproduct-gas equipment-leak. OSHA Art 125 (작업환경측정 — uncited) + OSHA Art 130 (특수건강진단 — uncited) + DSSMA Art 5 (코크스 — uncited) + OSHA Art 38 + SAPA Art 4.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 코크스로 작업 PAH 발암물질
    - coke oven PAH carcinogen
    - 코올타르피치 휘발성 유기화합물
    - coal tar pitch volatile CTPV
    - 노정 극고온 열스트레스
    - oven top heat stress steelmaking
    - 코크스로 가스 누출
    - coke oven gas leak
    - IARC Group 1 코크스 배출물
    - IARC Group 1 coke oven emissions
    - OSHA-KR Article 125 작업환경측정
    - OSHA-KR Article 130 특수건강진단
    - DSSMA Article 5 코크스 위험물
    - 특수건강진단 코크스로 작업자
  legal_basis:
    - 산업안전보건법 제125조 (작업환경측정)
    - 산업안전보건법 제130조 (특수건강진단)
    - 위험물안전관리법 제5조
    - 산업안전보건법 제38조
    - 중대재해처벌법 제4조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Coke Oven PAH Heat Stress Planner Skill

## Overview

Coke-oven battery worker-safety planner for coke-oven-top operations
(charging, leveling, pushing, quenching) — the WORKER-EXPOSURE /
industrial-hygiene hazard face of steelmaking, distinct from the
PROCESS-GAS equipment-leak discipline covered by `byproduct-gas-leak-
prevent` and the FURNACE-repair LOTO covered by `molten-metal-loto`.

The steelmaking industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 632-701) names
**산업안전보건법 (OSHA-KR) Article 125 (작업환경측정)**, **OSHA-KR Article 130
(특수건강진단)**, and **위험물안전관리법 (DSSMA) Article 5 (위험물 저장·취급 —
코크스/중유/가스)** — cited by ZERO existing steelmaking workflows prior to
the `steelmaking-coke-oven-pah-heat-stress` workflow (Task C-1b,
2026-08-07). All three articles were LIVE-VERIFIED via
`kr_safety.search_osha_regulations` this session. This skill
operationalizes those three uncited articles + OSHA Art 38 + SAPA Art 4
into a deployable coke-oven-worker exposure-protection plan.

## Korean Steelmaking Coke-Oven Context

### Why coke-oven-worker exposure is internationally tracked

| Factor | Byproduct-gas leak (existing WF) | Coke-oven worker exposure (this skill) |
|--------|----------------------------------|----------------------------------------|
| Discipline | Equipment integrity (gas-detection system) | Industrial hygiene (worker dose) |
| Hazard source | Process-gas piping (CO/H2) leak | Coal-tar-pitch-volatile PAH on oven top |
| Measurement | Stack/portable gas-detector ppm | Personal air-sample + biological monitoring |
| Exposure unit | Equipment-location | Worker-person (8-hr TWA, career cumulative) |
| Cancer class | CO acute toxicity | PAH = IARC Group 1 (coke-oven emissions) |
| Regulatory anchor | HPGSCA Art 13 (시설·용기의 안전유지) | OSHA Art 125 (work-env measurement) + Art 130 (special health exam) |
| International tracking | Equipment standard | IARC monographs (since 1984) — Korea's POSCO cohort studied |

Coke-oven emissions are an **IARC Group 1 carcinogen** (confirmed human
carcinogen since 1984, reaffirmed in IARC Monograph 100F). The
international literature tracks coke-oven-worker lung cancer incidence
as a signature occupational-cancer sentinel — Korea's POSCO Pohang/
Gwangyang coke batteries (the world's largest integrated coke operations)
are part of that international cohort. This is the single most cancer-
tracked steelmaking hazard worldwide.

### Hazard profile (from steelmaking regulatory anchor)

- **OSHA-KR Art 125** (UNCITED by existing steelmaking WFs; LIVE-VERIFIED
  via kr_safety this session) — 작업환경측정: workplace-environment
  measurement; the natural PAH-exposure monitoring anchor
- **OSHA-KR Art 130** (UNCITED by existing steelmaking WFs; LIVE-VERIFIED
  via kr_safety this session) — 특수건강진단: special health diagnosis
  for coke-oven workers (lung cancer + skin cancer + PAH biomarkers)
- **DSSMA Art 5** (UNCITED by existing steelmaking WFs; in anchor
  adjacent_laws) — 위험물 저장·취급 (코크스/석탄숯/중유/가스): dangerous-
  goods storage/handling for coke, coal, heavy-oil, gas at the coke
  battery
- **OSHA-KR Art 38** — 유해물·위험물 취급 안전조치 (universal worker-safety
  measures for hazardous-material handling)
- **SAPA Art 4** — 사업주 안전보장 의무

## Hazard Scenarios Covered

### 1. Oven-top coal-tar-pitch-volatile PAH inhalation

- Charging (coal feed into oven) + leveling (coal-bed leveling) + pushing
  (coke discharge) operations on the coke-battery top deck
- Coal-tar-pitch volatiles (CTPV) — benzene-soluble fraction containing
  PAHs (benzo[a]pyrene, naphthalene, chrysene, benz[a]anthracene)
- Career coke-oven-worker cumulative dose → IARC Group 1 lung cancer +
  skin cancer (scrotal cancer sentinel — Pott 1775, reaffirmed IARC 1984)
- The signature chronic-exposure hazard

### 2. Oven-top extreme-heat stress

- Oven-top deck surface temperature 40-60 °C ambient + radiant heat from
  charging holes (which open to ~1300 °C interior)
- Heat-strain: dehydration, heat exhaustion, heat stroke
- Compounded by impermeable PPE (PAH-coverall traps metabolic heat)
- Co-existent with the PAH exposure (same workers, same location)

### 3. Coke-oven-gas (CO/H2/CH4) leak at battery

- Coke-oven gas (CO ~7%, H2 ~50%, CH4 ~25%) leaks from battery flanges /
  standpipes / collecting main
- Acute CO poisoning + flammability
- Distinct from `byproduct-gas-leak-prevent` which addresses the gas-
  PIPING downstream of the battery; this scenario is the battery ITSELF
  during worker presence

### 4. Pushing / quenching thermal-burn

- Pushing operation: incandescent coke (~1000 °C) discharged from oven
  into coke car; radiant-heat + spark burn
- Quenching: water spray on hot coke → steam plume + scald burn
- Different burn mechanism from molten-metal (molten-metal is liquid-
  metal contact; pushing is radiant-heat + steam)

### 5. Coal / coke / pitch dust

- Coal handling (pre-oven) + coke handling (post-quench) generate
  respirable dust (coal dust = coal-workers-pneumoconiosis risk; coke
  dust = PAH-bearing particulate)
- Different from the vapor-phase PAH on oven top — this is the
  material-handling dust face

### 6. Sub-contracted cleaning / maintenance

- Battery-top cleaning crews are often contractor firms (SAPA Art 5
  applies); high turnover = high exposure variability
- Career-dose tracking harder for contractor workers

## Coke-Oven Worker Protection Hierarchy (industrial-hygiene-specific)

### 1. Elimination

- Battery automation: coke batteries with fully-automated charging /
  pushing / leveling machines remove the operator from the oven top
  entirely (modern POSCO Gwangyang batteries trend this direction)
- Substitution: lower-PAH coal blends (washed / pre-processed coal)
  reduce PAH emission at source
- Remote monitoring: oven-top cameras + thermal sensors replace in-person
  inspection rounds

### 2. Engineering controls (preferred over PPE)

- **Battery-top local exhaust ventilation (LEV)** — capture hood at
  charging hole + standpipe; designed to keep PAH below the regulatory
  exposure limit at the breathing zone
- **Enclosed operator cabins** on charging / pushing / leveling machines
  — pressurized, HEPA + carbon-filtered supply air; operator inside
- **Oven-top deck cooling** — radiant-heat shielding on walking surfaces;
  reflective barriers between worker and charging hole
- **Battery flange / standpipe leak detection** — continuous CO + H2 +
  CH4 monitors on the battery top deck with audible alarm
- **Quench-car enclosure + spray optimization** — minimize steam-plume
  drift onto walkways

### 3. Administrative controls

- **OSHA Art 125 작업환경측정** — personal-air-sample monitoring for PAH
  (benzene-soluble fraction + benzo[a]pyrene) on every oven-top worker;
  8-hr TWA tracked against the regulatory exposure limit; quarterly
  measurement cadence (or per change of coal blend)
- **OSHA Art 130 특수건강진단** — annual special health exam for coke-oven
  workers: chest X-ray (lung cancer), skin exam (scrotal / skin cancer),
  urinary 1-hydroxypyrene biomarker (PAH metabolite), spirometry
- **DSSMA Art 5 dangerous-goods plan** — coke / coal / heavy-oil / gas
  inventory + storage + handling procedures for the coke battery
- **Heat-stress management plan** — WBGT index monitoring on oven-top
  deck; work-rest cycle per ACGIH TLN (e.g., 45 min work / 15 min rest
  at WBGT >28 °C in impermeable PPE); hydration protocol
- **Career-dose registry** — cumulative PAH exposure tracked per worker
  across employer changes (essential for contractor workers — SAPA Art
  5 requires the host employer to maintain records)
- **Rotation policy** — limit tenure on oven-top duty (e.g., max 5 years
  cumulative before rotation to lower-exposure assignment)
- **SAPA Art 5 contractor management** — cleaning / maintenance contractor
  pre-qualification, exposure-data handover, training records
- **TBM (tool-box meeting)** before each shift — see shared TBM workflow

### 4. PPE (PAH + heat-stress specific)

- **Type-5 chemical-protective coverall** (PAH-impermeable — woven
  polyester with fluoroelastomer coating, NOT standard cotton) — changed
  every shift; never reused without decontamination
- **P3 / P100 respirator with organic-vapor cartridge** OR **powered
  air-purifying respirator (PAPR)** with P3 + OV cartridge — fit-tested
  annually; PAPR preferred for oven-top (positive pressure reduces
  leakage AND provides cooling airflow, mitigating heat stress)
- **Heat-stress PPE** — cooling vest under coverall (phase-change or
  circulatory); reflective apron for pushing-zone proximity
- **Nitrile gloves** (inner) + heat-resistant gloves (outer) for dual
  chemical + thermal protection
- **Safety goggles + face shield** (PAH skin contact with eye + thermal
  hazard)
- **Hearing protection** (battery-top is noisy: fans, machines)

## Planning Workflow

1. **Work-zone characterization** — oven-top deck / charging machine /
   pushing machine / quench car; identify PAH source points + radiant-
   heat zones + leak-prone flanges
2. **Baseline OSHA Art 125 작업환경측정** — personal air-sample on the
   planned work task for the planned duration; result feeds the exposure
   control plan
3. **PAH exposure assessment** — benzene-soluble fraction + benzo[a]-
   pyrene 8-hr TWA; compare to regulatory limit + ACGIH TLV
4. **Heat-stress assessment** — WBGT measurement on oven-top deck at
   planned work location; determine work-rest cycle per ACGIH TLN
5. **Engineering-control verification** — LEV capture-velocity at charging
   hole, enclosed-cabin pressure + filter integrity, leak-detection
   monitors functional
6. **OSHA Art 130 특수건강진단 verification** — confirm every oven-top
   worker on the shift has a current annual special-health-exam on file
7. **Career-dose registry check** — confirm cumulative PAH dose for each
   worker; flag any approaching the rotation threshold
8. **PPE selection** — PAH-impermeable coverall + PAPR with P3/OV
   cartridge + cooling vest; fit-test verification
9. **DSSMA Art 5 dangerous-goods plan reference** — coke/coal/heavy-oil/
   gas inventory for the battery on file
10. **Heat-stress work-rest cycle plan** — hydration station, rest
    shelter, rotation schedule
11. **SAPA Art 5 contractor verification** — cleaning / maintenance
    contractor records on file (if applicable)
12. **TBM + permit issuance** — tool-box meeting conducted, 작업허가서
    issued
13. **Execution + continuous monitoring** — leak-detector live, WBGT
    monitor live, hydration enforced, buddy-system for heat-strain
    symptoms
14. **Post-shift** — coverall decontamination / disposal, shower (PAH
    skin decontamination), exposure-record update, special-health-exam
    schedule refresh
15. **Emergency response plan** — acute CO-poisoning rescue, heat-stroke
    cooling (119 dispatch), PAH skin-contact decontamination, incident
    reporting per OSHA-KR Art 57

## Output

```json
{
  "plan_id": "stl-cop-2026-08-07-001",
  "mill": "POSCO Gwangyang Works Coke Battery 4",
  "task_type": "battery_top_charging_machine_inspection_round",
  "work_zone": "battery_top_deck_charging_side",
  "workers_exposed": 3,
  "shift_duration_min": 480,
  "hazard_classification": {
    "primary": "PAH_inhalation_IARC_G1_carcinogen",
    "secondary": "extreme_heat_stress",
    "tertiary": "CO_acute_poisoning_battery_leak"
  },
  "elimination_applied": {
    "automated_charging_machine": "partial_operator_still_on_deck",
    "lower_pah_coal_blend": false,
    "reason": "blend_set_by_metallurgy"
  },
  "engineering_controls": {
    "lev_capture_velocity_ms": 0.6,
    "enclosed_cabin_pressure_pa": 50,
    "cabin_filter": "HEPA_P3_OV_verified_2026_08_07",
    "radiant_heat_shielding": "reflective_barrier_installed",
    "leak_detection_monitors": {
      "co_ppm_alarm": 25,
      "h2_percent_alarm": 1,
      "ch4_percent_alarm": 1,
      "live_status": "functional"
    }
  },
  "administrative": {
    "osha_art125_work_env_measurement": {
      "scheduled": true,
      "method": "personal_air_sample_benzene_soluble_fraction",
      "target_analytes": ["BSF", "benzo_a_pyrene", "naphthalene"],
      "cadence": "quarterly_or_per_blend_change"
    },
    "osha_art130_special_health_exam": {
      "all_workers_current": true,
      "exam_components": ["chest_xray", "skin_exam", "urinary_1_hydroxypyrene", "spirometry"],
      "cadence": "annual"
    },
    "career_dose_registry": {
      "tracked": true,
      "highest_cumulative_worker": "4.2_years_of_5_year_threshold",
      "rotation_recommended": false
    },
    "dssma_art5_dg_plan_filed": true,
    "heat_stress_plan": {
      "wbgt_c": 29.5,
      "work_rest_cycle": "45_min_work_15_min_rest",
      "hydration_protocol": "250_ml_water_per_30_min"
    },
    "permit_issued": true,
    "permit_id": "WP-COKEBATT-2026-08-07-0089",
    "tbm_conducted": true
  },
  "ppe": {
    "coverall": "type_5_PAH_impermeable_fluoroelastomer",
    "respirator": "PAPR_P3_OV_cartridge",
    "fit_test_current": true,
    "cooling_vest": "phase_change",
    "gloves": "nitrile_inner_heat_resistant_outer",
    "hearing_protection": true
  },
  "exposure_monitoring_live": {
    "co_ppm": 3,
    "wbgt_c": 29.5,
    "pah_twa_mg_m3": "pending_shift_result"
  },
  "rescue_plan_ref": "MILL-ERP-2026-co-battery-rescue",
  "regulatory_basis": [
    "산업안전보건법 (OSHA-KR) Article 125 — 작업환경측정",
    "산업안전보건법 (OSHA-KR) Article 130 — 특수건강진단",
    "위험물안전관리법 (DSSMA) Article 5 — 위험물 저장·취급 (코크스/중유/가스)",
    "산업안전보건법 (OSHA-KR) Article 38 — 유해물·위험물 취급 안전조치",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **산업안전보건법 (OSHA-KR) Article 125** — 작업환경측정 (workplace-
  environment measurement; the natural PAH-exposure monitoring anchor) —
  UNCITED by existing steelmaking WFs, newly activated by this skill.
  LIVE-VERIFIED via kr_safety.search_osha_regulations this session
- **산업안전보건법 (OSHA-KR) Article 130** — 특수건강진단 (special health
  diagnosis for coke-oven workers: lung cancer + skin cancer + PAH
  biomarker + spirometry) — UNCITED by existing WFs, newly activated.
  LIVE-VERIFIED via kr_safety this session
- **위험물안전관리법 (DSSMA) Article 5** — 위험물 저장·취급 (코크스/석탄숫/
  중유/가스) (dangerous-goods storage/handling for coke / coal / heavy-
  oil / gas at the coke battery) — UNCITED by existing steelmaking WFs,
  newly activated
- **IARC Monograph 100F (2012)** — Coke-oven emissions classified Group 1
  (carcinogenic to humans). International scientific standard, adopted by
  Korean occupational-health practice. The basis for the OSHA Art 130
  special-health-exam requirement
- **ACGIH TLVs** — benzo[a]pyrene + coal-tar-pitch-volatiles threshold-
  limit values; heat-stress TLN based on WBGT — adopted by Korean
  occupational-health practice
- **KOSHA (한국산업안전보건공단)** — exposure-measurement + special-health-
  exam service provider for most Korean steelmakers; KOSHA Guide
  H-39-2012 (coke-oven-worker protection) is the practical reference
- **Steelmaking-specific**: Korea's POSCO Pohang (1973 onwards) and
  Gwangyang (1985 onwards) coke batteries are part of the international
  IARC coke-oven-worker cohort; the career-dose registry + annual
  special-health-exam discipline is the single highest-leverage control
  for steelmaking occupational cancer

## Integration

- **Input from**: coke-battery work-order, coal-blend specification,
  baseline 작업환경측정 result, worker career-dose registry, special-
  health-exam records
- **Output to**: `steelmaking-steelmaking-coke-oven-pah-heat-stress-record.json`
  (the evidence model for the `steelmaking-coke-oven-pah-heat-stress`
  workflow at `workflows/domains/industry/steelmaking/steelmaking-coke-oven-pah-heat-stress/`)
- **Coordinated skills**:
  - `byproduct-gas-leak-prevent` (existing steelmaking WF) — PROCESS-GAS
    piping leak detection + gas-inspection rounds. This skill addresses
    the WORKER standing on top of the operating oven. Coordinate via the
    leak-detection monitor data (this skill READS the gas-monitor output,
    does not duplicate the inspection procedure)
  - `molten-metal-loto` (existing steelmaking WF) — FURNACE-repair LOTO
    during outage; this skill covers OPERATING battery worker exposure.
    Different lifecycle phase (operating vs. outage)
  - `chemical-risk-assessment` (ehschem) — for PAH chemical-class
    assessment
  - `ghs-classifier` (ehschem) — for PAH-coke-oven-emissions GHS
    classification (IARC G1 maps to GHS Cat 1A/1B carcinogen)
  - `permit-to-work` (daily) — issues the 작업허가서
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If 작업환경측정 result exceeds 50% of the regulatory
  limit, OR any worker's special-health-exam shows abnormal urinary
  1-hydroxypyrene (>4.4 umol/mol Cr), OR WBGT exceeds 32 °C (heat-stroke
  threshold in impermeable PPE), OR CO monitor reads >25 ppm, halt oven-
  top work and escalate to mill 안전관리자 + occupational-health physician
  before resumption. No PPE-only fallback exists for chronic PAH
  carcinogen exposure — the exposure-assessment + special-health-exam +
  career-dose discipline is load-bearing.

## Non-Duplication Justification

vs. `byproduct-gas-leak-prevent` (existing steelmaking WF): that
addresses the PROCESS-GAS piping leak-detection SYSTEM integrity
(HPGSCA Art 13 + OSHA Art 36/38). This skill addresses the WORKER-
EXPOSURE industrial-hygiene profile — PAH carcinogen, heat stress,
special-health-exam tracking. Different discipline entirely: gas-
detection system integrity (equipment) vs. personal-exposure assessment
(worker dose). The byproduct-gas WF prevents gas LEAKS; this WF protects
the WORKER standing on top of the operating oven, who is exposed to PAH
even when the gas system is leak-tight.

vs. `molten-metal-loto` (existing steelmaking WF): that addresses
FURNACE + molten-metal repair under LOTO during outage (OSHA Art 36/38/
92). This skill addresses the OPERATING battery during normal production
— no LOTO applies (the battery cannot be de-energized; it is a
continuous thermal process). Different lifecycle phase (outage vs.
operating), different discipline (energy isolation vs. exposure
control).

vs. `chemical-risk-assessment` (ehschem domain): that addresses generic
chemical risk-assessment methodology. This skill SPECIALIZES it for the
coke-oven context — IARC Group 1 carcinogen, OSHA Art 125/130 monitoring
cadence, PAH-specific biomarker (1-hydroxypyrene), career-dose registry.

## Legal Disclaimer

> 자동화 계획 보조. 최종 코크스로 작업자 건강 보호 조치 결정은 제철소
> 안전관리자 + 산업보건의 + 직업환경의학 전문의 권한 per 산업안전보건법
> (OSHA-KR) Article 125 + Article 130 and 위험물안전관리법 (DSSMA) Article 5.
> 작업환경측정 result interpretation, 특수건강진단 biomarker thresholds, and
> career-dose registry management MUST be verified by a qualified occupational-
> health physician and the certified work-environment-measurement agency before
> any exposure-management decision is made.
