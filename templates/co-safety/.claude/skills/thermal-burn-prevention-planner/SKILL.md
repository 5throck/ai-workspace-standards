---
name: thermal-burn-prevention-planner
owner: food-agent
scope: workspace
status: active
description: Plan worker thermal-burn and cooking-oil fire-risk prevention for industrial fryers, cookers, steam lines, and hot surfaces in food manufacturing. Thermal-zone mapping, PPE selection, Class F/K cooking-oil fire response, steam-line LOTO points.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 식품공장 화상 예방
    - 튀김기 화재 위험
    - cooking-oil fire risk
    - industrial fryer safety
    - thermal burn prevention food
    - steam line LOTO
    - 조리유 과열 방지
    - hot surface PPE
    - Class F Class K fire
    - 식품 제조 열 설비
  legal_basis:
    - "소방기본법 제16조 (소방활동 — 조리유·건조기 화재 진압 대응)"
    - "산업안전보건법 제38조 (안전조치 — 고온 설비 화상·화재 예방)"
    - "식품위생법 제48조 (HACCP 적용 — 열공정 관리) [UNVERIFIED-via-legalize-kr-full-text]"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Thermal Burn Prevention Planner Skill

## Overview

Worker thermal-burn and cooking-oil fire-risk prevention planner for food
manufacturing. Covers the four signature thermal hazards named in the food
industry regulatory anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 392-397):
industrial-fryer cooking-oil burns, dryer-fire risk, steam-line contact
burns, and hot-surface contact burns on processing equipment.

The food anchor explicitly cites **소방기본법 (BFS) Article 16 (소방활동 —
cooking-oil/dryer fire response)** as the worker-safety anchor statute — a
citation no other existing food workflow or skill addresses. This skill is
the operational counterpart to the `thermal-hazard-control` workflow
(Task A-04, 2026-08-07).

Existing food skills cover product safety (HACCP, allergens) and mechanical
LOTO (`food-mixer-loto`). They do NOT cover thermal hazards to workers.

## Korean Food Manufacturing Thermal Context

### Hazard profile (from food regulatory anchor)

| Hazard | Equipment | Typical temp | Injury mechanism |
|--------|-----------|--------------|------------------|
| Cooking-oil burn | Industrial fryer, wok line | 170-190 °C | Splash, spill, immersion |
| Cooking-oil fire | Fryer, cooking-oil tank | > 200 °C auto-ignition | Auto-ignition, grease-duct fire |
| Dryer fire | Hot-air dryer, spray dryer | 150-220 °C | Dust ignition, residual fat |
| Steam-line burn | Steam line, autoclave, retort | 130-160 °C / 3-6 bar | Contact, leak jet, condensate |
| Hot-surface burn | Cooker exterior, conveyor | 60-120 °C | Inadvertent contact |
| Scald (hot water) | Blancher, CIP line | 80-100 °C | Splash, immersion |

### Why food thermal hazards are distinct

- **Class F / K cooking-oil fires** behave differently from Class A/B fires —
  water application causes violent steam explosion and burning-oil ejection.
  Only wet-chemical (potassium acetate / citrate) agents are effective.
- **Steam-line jets** are invisible at the leak point — workers walk into
  high-velocity superheated-steam jets without seeing them.
- **Grease-duct accumulation** is the leading fire-propagation path from fryer
  to roof in food plants.
- **HACCP product-temperature kill steps** (e.g. 75 °C internal) are product-
  safety focused; worker thermal hazards operate at much higher surface/oil
  temperatures.

## Thermal-Hazard Zone Classification

### Zone 1 — Cooking-oil zone (fryer / wok / oil-circulation line)

- Surface temp: 170-220 °C
- PPE: aluminized apron, heat-resistant gloves (Kevlar), face shield
- Fire class: **F (international) / K (US-NFPA)** — wet-chemical extinguisher
  ONLY. **Water and water-mist are PROHIBITED** (steam-explosion ejection).
- Engineering controls: splash guards, automated basket lift, oil-level
  interlock, grease-duct auto-clean (weekly minimum), fryer hood Ansul system

### Zone 2 — Dryer / oven zone

- Surface temp: 150-220 °C internal; 60-90 °C external
- PPE: heat-resistant gloves, long sleeves
- Fire risk: dust ignition (cereals, milk powder, cocoa), residual-fat
  auto-oxidation
- Engineering controls: explosion relief, inert-gas purge, oxygen monitoring,
  brush/scroll clean-in-place

### Zone 3 — Steam-line zone (distribution, retort, autoclave, CIP)

- Surface temp: 130-160 °C; pressure 3-6 bar
- PPE: thermal gloves, face shield during valve operation
- Engineering controls: pipe insulation (skin-contact temp < 50 °C), valve
  guards, leak-detection (acoustic / ultrasonic), LOTO before any maintenance
- **LOTO mandatory** before steam-line breach per OSHA-KR Art 92 equivalent

### Zone 4 — Hot-surface zone (cooker exterior, conveyor, packaging seal)

- Surface temp: 60-120 °C
- PPE: heat-resistant gloves for contact tasks
- Engineering controls: insulation, heat shields, warning labels (KOSHA
  "高温注意" yellow/black label at 50 °C skin-contact threshold)

### Zone 5 — Hot-water / scald zone (blancher, CIP, washdown)

- Surface temp: 80-100 °C
- PPE: waterproof thermal gloves, face shield during splash-risk tasks
- Engineering controls: splash guards, CIP interlock (no entry during cycle)

## Cooking-Oil Fire Response (Class F / K)

> **Water is PROHIBITED on cooking-oil fires.** Even one cup of water applied
> to a 180 °C fryer will eject a 3-5 m column of burning oil.

### Decision tree

1. **Fire contained in fryer, no duct involvement** → activate hood Ansul
   (wet-chemical), isolate gas/power, DO NOT move the fryer
2. **Fire in grease duct** → full plant evacuation, 119 call, Ansul + duct
   CO2 (if equipped); firefighting by professionals only
3. **Fire spread beyond duct** → full evacuation, 119, perimeter control per
   BFS Article 16 (소방활동 — firefighting activity)
4. **Worker burn injury** → 20-minute cool-water flush, 119, do not remove
   embedded clothing or apply ointments

### Wet-chemical extinguisher siting

- Travel distance to extinguisher: ≤ 10 m from any fryer
- Minimum rating: Class F 75F (international) or 6L wet-chemical (Korean
  NFDS 인정품)
- Monthly inspection tag, annual KFS refilling certification

## Planning Workflow

1. **Thermal-zone mapping** — survey each piece of equipment, assign zone 1-5
2. **PPE matrix** — zone-specific PPE list, KOSHA certification check
3. **Engineering-control audit** — insulation skin-temp, Ansul inspection,
   grease-duct cleaning log, LOTO points labeled
4. **Cooking-oil fire response plan** — extinguisher siting, Ansul zones,
   evacuation route, 119 caller assignment
5. **Steam-line LOTO plan** — isolation points, verification, bleed, lock-out
6. **Worker training record** — thermal-hazard TBM, cooking-oil fire drill
   (quarterly minimum per BFS guidance)
7. **Burn-injury first-aid station** — cool-water source (16-25 °C), sterile
   dressings, 119 call list posted in Korean

## Output

```json
{
  "plan_id": "food-tbpp-2026-08-07-001",
  "site": "Plant 3 - Frying Line A",
  "thermal_zones_mapped": [
    {"zone": 1, "equipment": "industrial_fryer_FRY-301", "surface_temp_c": 185, "ppe": ["aluminized_apron", "kevlar_gloves", "face_shield"]},
    {"zone": 3, "equipment": "steam_line_STM-A12", "surface_temp_c": 152, "pressure_bar": 5, "loto_required": true},
    {"zone": 4, "equipment": "cooker_exterior_CKR-201", "surface_temp_c": 88, "ppe": ["heat_resistant_gloves"]}
  ],
  "engineering_controls": {
    "fryer_ansul_inspected": "2026-07-15",
    "grease_duct_last_cleaned": "2026-07-29",
    "steam_pipe_skin_temp_c": 42,
    "loto_points_labeled": true
  },
  "cooking_oil_fire_response": {
    "extinguisher_class": "F_75F_wet_chemical",
    "travel_distance_to_extinguisher_m": 7,
    "ansul_system_armed": true,
    "evacuation_route": "Fryer-hall-east-exit",
    "caller_119_assigned": "shift_lead"
  },
  "worker_training": {
    "tbm_last_conducted": "2026-08-05",
    "fire_drill_last_quarterly": "2026-06-30",
    "first_aid_station_verified": true
  },
  "regulatory_basis": [
    "소방기본법 (BFS) Article 16 — 소방활동 (cooking-oil/dryer fire response)",
    "식품위생법 (FSA) Article 48 — HACCP facility (process-equipment context)",
    "산업안전보건법 (OSHA-KR) Article 36 — 위험성평가 (risk assessment)",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "ready_to_execute"
}
```

## Korean-Specific Standards

- **소방기본법 (BFS) Article 16** — 소방활동 (firefighting activity); basis
  for cooking-oil/dryer fire response and 119 coordination
- **식품위생법 (FSA) Article 48** — HACCP facility standard; provides the
  process-equipment context (worker thermal hazards cluster around HACCP
  kill-step equipment)
- **KFS (Korea Fire Safety) 인정품** — wet-chemical extinguisher and fryer
  Ansul system must carry Korean Fire Safety certification
- **KOSHA 고온작업 가이드** — heat-stress and contact-burn PPE specification
- **119 소방서 pre-plan** — local fire department should have a pre-incident
  plan on file for any facility operating industrial fryers (grease-duct
  fire spread is a known firefighter-fatality scenario)

## Integration

- **Input from**: food work-order, equipment layout, HACCP plan
- **Output to**: `food-thermal-hazard-control-record.json` (the evidence model
  for the `thermal-hazard-control` workflow)
- **Coordinated skills**:
  - `psm-loto` — steam-line lock-out/tag-out procedure
  - `tool-box-meeting` (TBM) — thermal-hazard briefing record
  - `emergency-response` — if burn injury or fire-spread occurs
- **Escalation**: Cooking-oil fire extending beyond the fryer hood triggers
  full evacuation + 119 dispatch under BFS Article 16

## Non-Duplication Justification

vs. `food-mixer-loto`: that skill covers mechanical LOTO on mixer/blender
equipment (rotational-energy isolation) — distinct hazard class. Steam-line
LOTO is part of THIS skill's scope (thermal + stored-energy isolation), but
the orientation is thermal-burn prevention, not mechanical-energy control.

vs. `haccp-ccp-monitoring`: HACCP addresses product-temperature kill steps
for pathogen control (product safety). This skill addresses worker thermal-
burn hazards at much higher surface/oil temperatures (worker safety).

vs. `food-allergen-control`: completely distinct hazard class (product cross-
contamination).

No existing skill cites BFS Article 16 or addresses worker thermal/cooking-
oil fire hazards.

## Legal Disclaimer

> 자동화 계획 보조. 최종 열 안전 조치 결정은 안전관리자 + 소방안전관리자 권한
> per 소방기본법 (BFS) Article 16 and 식품위생법 (FSA) Article 48. Cooking-oil
> fire response and grease-duct cleaning intervals must be verified against
> the local fire department pre-plan and KFS certification records.
