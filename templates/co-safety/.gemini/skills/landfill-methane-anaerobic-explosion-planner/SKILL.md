---
name: landfill-methane-anaerobic-explosion-planner
owner: waste-agent
scope: workspace
status: active
description: Plan landfill + anaerobic-digestion facility safety — methane (CH4) LEL explosion management, leachate chemical hazard, slope-collapse prevention, deep-seated landfill-fire firefighting response. Covers Korea's Sudokwon Landfill (world's largest by volume). WCA Art 25 (허가 — uncited) + BFS Art 16 (소방 — uncited) + WCA Art 13 + OSHA Art 38 + SAPA Art 4.
version: "1.0.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 매립지 메탄 가스 폭발
    - landfill methane CH4 explosion
    - 혐기소화 소화조 biogas
    - anaerobic digestion biogas
    - 침출수 화학적 위해
    - leachate chemical hazard landfill
    - 사면 붕괴 매립지
    - landfill slope collapse
    - 매립지 깊은 화재 소방
    - deep seated landfill fire
    - 가스 추출정 LEL 모니터링
    - gas extraction well LEL monitoring
    - WCA Article 25 폐기물처리업 허가
    - BFS Article 16 소방활동
    - Sudokwon Landfill safety
  legal_basis:
    - 폐기물관리법 제25조
    - 소방기본법 제16조
    - 폐기물관리법 제13조
    - 산업안전보건법 제38조
    - 중대재해처벌법 제4조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Landfill Methane Anaerobic Explosion Planner Skill

## Overview

Landfill + anaerobic-digestion facility safety planner for methane (CH4)
explosion prevention, leachate chemical-hazard control, slope-stability
management, and deep-seated landfill-fire firefighting response — the
OPEN-AIR atmospheric hazard face of waste treatment, distinct from the
INCINERATOR-equipment LOTO covered by `incinerator-shredder-loto`, the
SEWAGE/manhole H2S asphyxia covered by `sewage-confined-h2d-prevent`,
and the chemical-treatment-process hazard covered by `waste-designated-
hazardous-chemical-treatment`.

The waste industry anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 704-747) names
**폐기물관리법 (WCA) Article 25 (폐기물처리업 허가 및 운영)** and **소방기본법
(BFS) Article 16 (소방활동 — 소각로 화재/폭발 대응)** — cited by ZERO existing
waste workflows prior to the `waste-landfill-methane-anaerobic-explosion`
workflow (Task C-1b, 2026-08-07). Both articles were LIVE-VERIFIED via
`kr_safety.search_osha_regulations` and `legalize_kr.parse_law_structure`
this session. This skill operationalizes those two uncited articles +
WCA Art 13 + OSHA Art 38 + SAPA Art 4 into a deployable landfill-safety
plan.

## Korean Waste Landfill Context

### Why landfill methane is nationally distinct

| Factor | Incinerator bypass-gas (existing WF) | Landfill methane (this skill) |
|--------|--------------------------------------|-------------------------------|
| Source | Equipment-internal pyrolysis | Open-airspace anaerobic decomposition |
| Gas composition | CO + H2 + CH4 (varies) | CH4 ~50%, CO2 ~50% (biogas) |
| Explosion zone | Equipment-internal | Subsurface migration + atmosphere |
| Monitoring | Stack-gas monitor / portable detector | Groundwater-well gas probes + surface-imission + gas-extraction-well network |
| Ignition source | Equipment spark | Any spark + spontaneous combustion deep in mass |
| Fire class | Incinerator-bay fire (surface) | Deep-seated landfill fire (smolders for months) |
| Firefighting | Standard foam / water | Foam injection + oxygen-depletion + excavation |
| Scale | Single facility | Sudokwon = world's largest by volume (~18M tons/year capacity) |

Korea's Sudokwon Landfill Site (수도권 매립지), serving the Seoul Capital
Area (~25 million people), is the world's largest landfill by volume.
Its methane-generation rate is correspondingly world-scale, making the
LEL-explosion + deep-fire + leachate hazard profile a nationally-
distinct waste-management challenge. The existing `incinerator-shredder-
loto` WF's "바이포가스 폭발" refers to incinerator/pyrolysis BYPASS gas
during EQUIPMENT MAINTENANCE; landfill methane is a distinct atmospheric
hazard from anaerobic decomposition in the landfill MASS, with distinct
monitoring (groundwater-well gas probes vs. stack-gas monitors), distinct
explosion zone (subsurface migration vs. equipment-internal), and
distinct fire class (deep-seated vs. incinerator-bay).

### Hazard profile (from waste regulatory anchor)

- **WCA Art 25** (UNCITED by existing waste WFs; LIVE-VERIFIED via
  kr_safety this session) — 폐기물처리업 허가 및 운영: waste-treatment-
  business licensing and operation; basis for landfill operating-permit
  conditions (gas-extraction-well network, leachate-management system,
  slope-stability plan)
- **BFS Art 16** (UNCITED by existing waste WFs; LIVE-VERIFIED via
  legalize_kr this session) — 소방활동 (화재 진압·구조·구급):
  firefighting activity; the natural anchor for landfill fire/explosion
  firefighting response (deep-seated landfill fire + methane cloud
  ignition)
- **WCA Art 13** — 폐기물의 처리 기준: waste-treatment standards
  (collection, transport, disposal)
- **OSHA-KR Art 38** — 유해물·위험물 취급 안전조치 (universal worker-safety
  measures)
- **SAPA Art 4** — 사업주 안전보장 의무

## Hazard Scenarios Covered

### 1. Methane (CH4) LEL cloud explosion at landfill surface

- Anaerobic decomposition in the landfill mass generates CH4 (~50% biogas)
- Methane migrates upward through cover soil + laterally through
  subsurface strata; accumulates in site buildings, utility vaults, or
  above the working face on calm days
- LEL cloud ignition from equipment spark, cigarette, or lightning —
  volumetric explosion
- The signature landfill hazard

### 2. Deep-seated landfill fire (smoldering mass)

- Spontaneous combustion deep in the waste mass (exothermic reaction +
  retained heat + oxygen ingress through cracks)
- Smolders for months; surface expression is subsidence + smoke + odor
- Nearly impossible to extinguish with surface water — requires foam
  injection + oxygen-depletion + excavation of the hot zone
- BFS Art 16 firefighting response is uniquely challenging

### 3. Anaerobic-digestion (AD) tank biogas explosion

- AD reactor (closed tank) operates on food-waste / sewage-sludge /
  organic-waste feedstock; headspace CH4 ~60%
- Tank overpressure / rupture / vent failure → biogas release
- Different geometry from landfill (tank vs. mass) but same gas-
  explosion physics
- Co-existent H2S in the biogas (sour-gas toxicity)

### 4. Gas-extraction-well network worker exposure

- Vertical gas-extraction wells (100+ wells at Sudokwon) require routine
  flow-measurement + condensate drainage
- Worker at wellhead exposed to CH4 + CO2 + trace H2S + vinyl-chloride
  (VCM, from PVC decomposition)
- Confined-space classification for well-vault entry

### 5. Leachate chemical hazard

- Leachate (liquid percolating through waste mass) contains heavy metals
  (Pb, Cd, Hg), ammonia, VOCs, PFAS (emerging contaminant)
- Worker exposure during leachate-collection-pump maintenance + leachate
  pond inspection
- Environmental release hazard if leachate pond liner fails

### 6. Slope / berm collapse

- Landfill is built up in lifts (layers); working-face slope + interim-
  cover berm can collapse if over-steepened or saturated by rainfall
- Worker-on-foot or equipment-operator buried
- Korea's summer monsoon (June-August) drives slope-failure risk

### 7. Heavy equipment / working-face traffic

- Compactors + bulldozers + transfer trucks operate on the working face
  in proximity to each other + to pickers / spotters on foot
- Equipment-pedestrian strike + equipment-equipment collision
- Co-existent with the methane hazard (the working face is where CH4 is
  actively released from freshly-deposited waste)

## Landfill Methane Protection Hierarchy (waste-specific)

### 1. Elimination

- Gas extraction at source: active gas-extraction-well network (vertical
  wells + horizontal trenches) continuously removes CH4 from the mass,
  keeping subsurface concentration below the LEL migration pathway
- Flare or energy-recovery: extracted CH4 burned in a controlled flare
  or utilized in a power-generation turbine (turns hazard into resource)
- Waste pre-sorting: remove organic fraction for AD / composting before
  landfill (reduces in-mass anaerobic-decomposition feedstock)

### 2. Engineering controls (preferred over PPE)

- **Active gas-extraction-well network** — vertical wells on a 30-50 m
  grid; horizontal trenches in lifts; connected to a central blower/
  flare or energy-recovery plant; balanced for uniform CH4 draw
- **Continuous CH4 monitoring** at: each wellhead + site perimeter
  (imission probes) + site buildings (basement + utility vaults, alarms
  at 25% LEL = 1.25% CH4)
- **Leachate-collection system** — composite liner (geomembrane + GCL)
  + leachate-collection pipe network + leachate pond; prevents
  groundwater contamination + worker leachate exposure
- **Slope-stability engineering** — geotechnical design of lifts + berms
  for the monsoon rainfall case; pore-pressure monitoring piezometers
- **AD tank overpressure protection** — pressure-relief valve + flame
  arrestor + secondary containment; biogas-holder with weighted seal
- **Landfill-cover system** — daily cover (6 in soil) + intermediate
  cover (12 in compacted clay) + final cover (geomembrane cap) to
  minimize oxygen ingress + CH4 escape
- **Deep-fire detection** — temperature probes in the mass + surface-
  infrared scanning + settlement monitoring (subsidence = combustion
  void)

### 3. Administrative controls

- **WCA Art 25 operating permit** — landfill operating-permit conditions
  specify: gas-extraction-well network density, leachate-system
  specification, slope-stability plan, monitoring-and-reporting cadence
- **BFS Art 16 emergency-response plan** — deep-seated landfill-fire
  response: foam-injection contractor on retainer, 119 integration,
  evacuation zone, public-notification protocol
- **Methane-monitoring plan** — wellhead CH4 + CO2 + O2 + H2S weekly;
  perimeter probes continuous; site buildings continuous with alarm;
  recorded per OSHA-KR Art 57
- **Confined-space entry program** for well-vaults + leachate-collection
  manholes — permit-required, atmosphere monitoring (LEL, O2, H2S, CO),
  rescue plan (references the sewage-confined-h2s-prevent WF)
- **Slope-inspection program** — daily visual inspection of working
  face + berms; monsoon-season daily piezometer review; halt operations
  if slope-movement detected
- **Heavy-equipment traffic-management plan** — separated pedestrian
  routes, spotter protocol for backing equipment, radio communication
- **TBM (tool-box meeting)** before each shift — see shared TBM workflow
- **SAPA Art 4 / Art 5** — operator safety-management; contractor
  management for the heavy-equipment fleet (often owner-operator
  trucks)

### 4. PPE (landfill + AD specific)

- **Combustible-gas monitor (personal)** on every worker on the working
  face + at gas-extraction wells — LEL + H2S + CO + O2
- **Flame-resistant clothing (FRC)** for workers on the working face +
  at AD tank (flash-fire hazard from sudden CH4 release)
- **Chemical-resistant gloves + boots** for leachate-contact tasks
  (nitrile or PVC for ammonia + heavy-metal protection)
- **Safety glasses + face shield** for leachate-splash tasks
- **Hard hat** (slope-fall + equipment-traffic hazard)
- **High-visibility vest** (heavy-equipment traffic)
- **Steel-toe boots** (sharp waste + equipment-traffic hazard)
- **Respirator (P3 + acid-gas cartridge)** for dusty / leachate-mist
  tasks; SCBA for confined-space well-vault entry

## Planning Workflow

1. **Facility characterization** — landfill cell / AD tank / leachate
   pond / gas-extraction-well network; identify CH4 source points +
   migration pathways + ignition sources + leachate contact points +
   slope-stability critical zones
2. **Baseline methane-monitoring data review** — wellhead CH4 history +
   perimeter-imission data + site-building basement readings
3. **Gas-extraction-well network verification** — well count, blower/
   flare operational status, balance (uniform draw), energy-recovery
   turbine status
4. **LEL-monitoring instrument verification** — calibration of personal
   monitors + fixed site-building monitors; alarm set at 25% LEL
5. **Confined-space entry plan (if well-vault or leachate-manhole work)**
   — permit-required, atmosphere monitoring, rescue plan
6. **Leachate-contact task plan (if applicable)** — PPE selection,
   splash control, environmental-release prevention
7. **Slope-stability review (especially monsoon season)** — piezometer
   readings, visual slope inspection, halt-operations threshold
8. **Heavy-equipment traffic-management plan (if working-face work)** —
   separated routes, spotter protocol, radio comms
9. **BFS Art 16 emergency-response plan reference** — deep-fire response
   procedure, foam-injection contractor availability, 119 integration
10. **WCA Art 25 operating-permit verification** — current permit on
    file; monitoring-and-reporting cadence up to date
11. **TBM + permit issuance** — tool-box meeting conducted, 작업허가서
    issued (for confined-space + leachate-contact tasks)
12. **Execution + continuous monitoring** — personal gas monitors live,
    fixed monitors live, weather (wind + barometric pressure — affects
    CH4 migration), buddy system
13. **Deep-fire response (if detected)** — BFS Art 16 procedure: isolate
    area, foam-injection contractor mobilized, 119 notified, evacuation
    zone established, excavation plan if hotspot accessible
14. **Post-operation** — gas-monitor data logged, slope inspection post-
    work, equipment decontaminated if leachate contact, incident log
    filed per OSHA Art 57

## Output

```json
{
  "plan_id": "wst-lma-2026-08-07-001",
  "facility": "Sudokwon Landfill Site — Cell 4B Working Face",
  "operator": "Sudokwon Landfill Site Management Corporation (SLC)",
  "task_type": "gas_extraction_well_flow_measurement_and_working_face_compactor_ops",
  "workers_exposed": 8,
  "shift_duration_min": 480,
  "hazard_classification": {
    "primary": "methane_CH4_LEL_cloud_explosion",
    "secondary": "deep_seated_landfill_fire",
    "tertiary": "slope_collapse_monsoon_season"
  },
  "elimination_applied": {
    "active_gas_extraction_network": true,
    "well_count": 142,
    "flare_status": "operational_2_of_2_flares",
    "energy_recovery_turbine_mw": 50
  },
  "engineering_controls": {
    "wellhead_ch4_monitors": 142,
    "perimeter_imission_probes": 16,
    "site_building_alarms": {
      "locations": ["admin_bldg_basement", "utility_vault_3", "scale_house"],
      "alarm_threshold_pct_lel": 25,
      "live_status": "functional"
    },
    "leachate_collection_system": "composite_liner_functional",
    "slope_stability_piezometers": 24,
    "deep_fire_temp_probes": 30,
    "settlement_monitoring": "monthly_infrared_survey"
  },
  "administrative": {
    "wca_art25_operating_permit": "current_permit_SLC-2024-019-exp_2027",
    "bfs_art16_er_plan_filed": true,
    "foam_injection_contractor": "FIRECON-Korea-on-retainer-24hr",
    "methane_monitoring_cadence": {
      "wellhead": "weekly",
      "perimeter_probes": "continuous",
      "site_buildings": "continuous_with_alarm"
    },
    "confined_space_entry_program": "references_sewage_confined_h2s_prevent_wf",
    "slope_inspection_cadence": "daily_visual_monsoon_piezometer_review",
    "traffic_management_plan": "separated_routes_spotter_protocol",
    "permit_issued": true,
    "permit_id": "WP-LANDFILL-2026-08-07-0058",
    "tbm_conducted": true
  },
  "ppe": {
    "personal_gas_monitor": {
      "channels": ["LEL", "O2", "H2S", "CO"],
      "calibrated_2026_08_07": true
    },
    "flame_resistant_clothing": true,
    "chemical_resistant_gloves_boots": "nitrile",
    "hard_hat": true,
    "high_vis_vest": true,
    "steel_toe_boots": true
  },
  "monitoring_live": {
    "wellhead_ch4_pct_max": 58,
    "perimeter_ch4_ppm_max": 12,
    "site_building_basement_pct_lel": 0,
    "slope_piezometer_status": "stable_monsoon_watch",
    "weather": {
      "wind_ms": 3.2,
      "barometric_trend": "falling",
      "monsoon_advisory": "in_effect"
    }
  },
  "rescue_plan_ref": "SLC-ERP-2026-landfill-deep-fire",
  "regulatory_basis": [
    "폐기물관리법 (WCA) Article 25 — 폐기물처리업 허가 및 운영",
    "소방기본법 (BFS) Article 16 — 소방활동 (화재 진압·구조·구급)",
    "폐기물관리법 (WCA) Article 13 — 폐기물의 처리 기준",
    "산업안전보건법 (OSHA-KR) Article 38 — 유해물·위험물 취급 안전조치",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **폐기물관리법 (WCA) Article 25** — 폐기물처리업 허가 및 운영 (waste-
  treatment-business licensing and operation; basis for landfill
  operating-permit conditions — gas-extraction-well network, leachate
  system, slope plan, monitoring cadence) — UNCITED by existing waste
  WFs, newly activated by this skill. LIVE-VERIFIED via kr_safety this
  session
- **소방기본법 (BFS) Article 16** — 소방활동 (firefighting activity —
  suppression, rescue, EMS; the natural anchor for landfill fire/explosion
  firefighting response) — UNCITED by existing WFs, newly activated.
  LIVE-VERIFIED via legalize_kr this session
- **폐기물관리법 (WCA) Article 13** — 폐기물의 처리 기준 (waste-treatment
  standards: collection, transport, disposal)
- **Sudokwon Landfill Site Management Corporation (SLC)** — operator of
  the world's-largest-by-volume landfill; SLC's technical standards are
  the de facto Korean reference for large-scale landfill methane
  management
- **환경부 (Ministry of Environment)** — landfill-permitting authority;
  WCA Art 25 operating permits issued via regional environmental offices
- **소방청 (National Fire Agency) + 119** — BFS Art 16 landfill-fire
  response; deep-seated landfill fires are uniquely challenging and
  require specialized foam-injection contractors
- **Korea monsoon (June-August)** — concentrated heavy rainfall drives
  slope-failure + leachate-system overload risk; the seasonal risk
  profile is a Korean-specific planning factor
- **Waste-specific**: Korea's high-density urban-waste regime (Sudokwon
  serving ~25M people at ~18M tons/year capacity) makes methane-
  generation rates + deep-fire risk among the highest in the world per
  facility; the gas-extraction-well + energy-recovery discipline is the
  single highest-leverage control

## Integration

- **Input from**: landfill cell work-order, gas-extraction-well network
  status, baseline methane-monitoring data, piezometer readings, weather
  forecast
- **Output to**: `waste-waste-landfill-methane-anaerobic-explosion-record.json`
  (the evidence model for the `waste-landfill-methane-anaerobic-explosion`
  workflow at `workflows/domains/industry/waste/waste-landfill-methane-anaerobic-explosion/`)
- **Coordinated skills**:
  - `incinerator-shredder-loto` (existing waste WF) — INCINERATOR/
    shredder EQUIPMENT LOTO + bypass-GAS explosion prevention. This
    skill addresses LANDFILL methane + anaerobic digestion — different
    facility, different gas-source (decomposition mass vs. equipment),
    different explosion zone (atmosphere vs. equipment-internal).
    Coordinate via shared gas-monitoring + permit-to-work infrastructure
  - `sewage-confined-h2s-prevent` (existing waste WF) — SEWAGE/manhole
    H2S asphyxia. This skill REFERENCES that WF's confined-space regime
    for well-vault + leachate-manhole entry (different gas — CH4 vs.
    H2S — but same entry-permit discipline)
  - `waste-designated-hazardous-chemical-treatment` (sister new WF) —
    지정폐기물 CHEMICAL-TREATMENT process. This skill is LANDFILL +
    anaerobic digestion (physical/biological process). Different waste
    stream, different process chemistry
  - `gas-dispersion-analyzer` (ehsconst) — for CH4 atmospheric-dispersion
    modeling at the perimeter
  - `environmental-compliance-checker` (ehschem) — for leachate + gas-
    emission environmental-permit compliance
  - `permit-to-work` (daily) — issues the 작업허가서 for confined-space +
    leachate-contact tasks
  - `tool-box-meeting` (TBM) — pre-work briefing record
- **Escalation**: If site-building basement LEL reads >25% at any point,
  OR a deep-fire temperature probe reads >80 °C (indicating subsurface
  combustion), OR piezometer indicates slope-movement during monsoon, OR
  a personal gas-monitor alarms, halt the affected operation, evacuate
  the zone, and escalate to landfill 안전관리자 + 119 (fire) + 환경부
  (environmental release) before resumption. No PPE-only fallback exists
  for methane LEL cloud explosion — the gas-extraction network + LEL
  monitoring + BFS Art 16 fire response triad is load-bearing.

## Non-Duplication Justification

vs. `incinerator-shredder-loto` (existing waste WF): that addresses
INCINERATOR/SHREDDER equipment LOTO + BYPASS-GAS explosion during
EQUIPMENT MAINTENANCE (WCA Art 13 + OSHA Art 92 + Sewerage Act Art 20 +
SAPA Art 4). This skill addresses LANDFILL methane + anaerobic digestion
— the existing WF's "바이포가스 폭발" refers to incinerator/pyrolysis BYPASS
gas during equipment maintenance; landfill methane is a distinct
atmospheric hazard from anaerobic decomposition in the landfill MASS,
with distinct monitoring (groundwater-well gas probes vs. stack-gas
monitors), distinct explosion zone (subsurface migration vs. equipment-
internal), and distinct fire class (deep-seated vs. incinerator-bay).
Distinct physics + distinct response + distinct regulatory anchor
(WCA Art 25 + BFS Art 16, both uncited by the existing WF).

vs. `sewage-confined-h2d-prevent` (existing waste WF): that addresses
SEWAGE/manhole H2S asphyxia (Sewerage Act Art 19 + OSHA Art 618 + WCA
Art 13). This skill addresses LANDFILL CH4 + anaerobic digestion biogas
— different gas (CH4 not H2S), different location (open-airspace landfill
+ AD tank vs. manhole confined-space), different fire class (CH4 cloud
explosion + deep-seated landfill fire vs. H2S asphyxia). Coordinate via
shared confined-space-entry regime when this WF's tasks enter well-vaults
or leachate manholes.

vs. `waste-designated-hazardous-chemical-treatment` (sister new WF):
that addresses 지정폐기물 CHEMICAL-TREATMENT process (CCA Art 23 + WCA
Art 25). This skill addresses LANDFILL + anaerobic digestion (physical/
biological process). Different waste stream, different process chemistry
(chemical-treatment neutralization vs. biological decomposition), different
PPE matrix, different facility type.

## Legal Disclaimer

> 자동화 계획 보조. 최종 매립지 안전 조치 결정은 매립지 안전관리자 +
> 환경부 지방환경청 + 소방청 권한 per 폐기물관리법 (WCA) Article 25 +
> Article 13 and 소방기본법 (BFS) Article 16. Methane-monitoring data
> interpretation, deep-fire response strategy, slope-stability assessment,
> and leachate environmental-release determination MUST be verified by the
> landfill 안전관리자 + a qualified geotechnical engineer + the on-retainer
> deep-fire foam-injection contractor before any operational decision is
> made.
