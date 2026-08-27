---
name: cosmetics-solvent-exposure-monitor
owner: cosmetics-agent
scope: workspace
status: active
description: Plan and assess worker inhalation-exposure monitoring for solvents (ethanol, isopropanol, methanol) and volatile raw materials in cosmetics manufacturing. Air-sampling strategy, OEL comparison, ventilation verification, respiratory-PPE selection, biological monitoring.
version: "1.0"
created: "2026-08-07"
last_updated: "2026-08-07"
metadata:
  triggers:
    - 화장품 용제 노출
    - cosmetics solvent exposure
    - ethanol IPA inhalation
    - 에탄올 이소프로판올 흡입 노출
    - volatile raw material monitoring
    - OEL exposure assessment cosmetics
    - ventilation verification 향료 솔벤트
    - biological monitoring cosmetics
    - respirator selection 유기용제
    - OSHA-KR Article 110 (MSDS 작성·제출)
  legal_basis:
    - 산업안전보건법 제110조 (MSDS)
    - 산업안전보건법 제125조
    - 산업안전보건법 제36조
    - 화장품법 제5조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Cosmetics Solvent Exposure Monitor Skill

## Overview

Worker inhalation-exposure monitoring planner for cosmetics manufacturing —
covers the solvent and volatile-raw-material hazards unique to skin-care,
perfume, hair-care, and color-cosmetics production: **ethanol (향료/퍼퓸
carrier, 70-95% in perfume), isopropanol (sanitizer/disinfectant raw),
methanol (denaturant trace), ethyl acetate (nail-polish solvent), and
fragrance volatile organic compounds (VOCs)**.

This skill is the operational counterpart to the `solvent-exposure-control`
workflow (Task A-04, 2026-08-07). The cosmetics regulatory anchor
(`regulations/KR/industry-regulatory-anchors.yaml` lines 260-266) names
**OSHA-KR Article 110 (물질안전보건자료 작성·제출 의무)** as the worker-safety
anchor — a citation no existing cosmetics skill addresses. All three
existing cosmetics workflows (`cgmp-batch-release`, `cosmetics-safety-
assessment`, `cosmetics-stability-testing`) are product-quality/registration-
focused; this is the first worker-safety-oriented capability.

## Korean Cosmetics Solvent Context

### Why cosmetics solvent exposure is distinct

| Aspect | General chemical industry | Cosmetics manufacturing |
|--------|--------------------------|-------------------------|
| Ethanol concentration | Process intermediate | Final product (60-95% in perfume, toner) |
| Exposure frequency | Campaign-based | Daily (every shift) |
| Ventilation | Engineered LEV | Often mixed LEV + general dilution |
| Worker perception | "I smell solvent — hazard" | "I smell perfume — pleasant" → olfactory fatigue |
| Product contact | Avoided | Expected (hand-immersion common) |
| PPE compliance | High | Low (cosmetics "feels safe") |

### Solvent profile (typical Korean cosmetics plant)

| Solvent | OSHA-KR TWA | OSHA-KR STEL | Typical use | Risk |
|---------|-------------|--------------|-------------|------|
| **Ethanol** | 1000 ppm | — | Perfume, toner, sanitizer (60-95%) | Olfactory fatigue → overexposure |
| **Isopropanol** | 400 ppm | 500 ppm | Sanitizer, preservative carrier | Skin absorption + inhalation |
| **Methanol** | 200 ppm | 250 ppm | Denaturant (trace in industrial EtOH) | Optic nerve toxicity |
| **Ethyl acetate** | 400 ppm | — | Nail polish, fragrance extraction | Mucous-membrane irritant |
| **Fragrance VOCs** | Various | Various | Perfume, flavor | Sensitization, asthma |
| **Formaldehyde** (trace) | 0.3 ppm | 0.6 ppm | Some hair straighteners | Carcinogen — strict |

### Olfactory fatigue — the hidden risk

Ethanol and most fragrance solvents have a pleasant or neutral odor at low
concentrations. Workers acclimate within 15-30 minutes and lose the ability
to detect rising concentrations. Unlike industrial solvents (toluene, MEK)
which smell bad and trigger self-protective behavior, cosmetics solvents
generate NO subjective warning — making continuous air monitoring
mandatory rather than relying on odor thresholds.

## Monitoring Strategy

### Step 1 — Exposure characterization

- Inventory all solvents by process step (weighing, mixing, filling, QC)
- Identify open-surface operations (beaker washing, hand-pour, sampling)
- Map process flow: raw-material dispensing → mixing → filling → packaging
- Note temperature (warm mixing volatilizes 5-10× more than ambient)

### Step 2 — Sampling plan

| Method | Duration | Use |
|--------|----------|-----|
| **Personal sampling** (badge on lapel) | Full shift (8 h TWA) | Compliance vs OSHA-KR OEL |
| **Task-based sampling** | 15-30 min per task | STEL comparison, peak ID |
| **Area sampling** (fixed point) | Continuous | Ventilation effectiveness, source ID |
| **Direct-reading PID/FID** | Real-time | Leak detection, peak capture |

### Step 3 — Laboratory analysis

- Charcoal tube + carbon disulfide desorption (ethanol, IPA, ethyl acetate)
- Silica gel (methanol — charcoal adsorbs poorly)
- GC-FID separation and quantification
- Reporting limit: 1/10 of OSHA-KR OEL (≈ 100 ppm ethanol, 40 ppm IPA)

### Step 4 — Exposure assessment

- TWA vs OSHA-KR OEL comparison (per 산업안전보건법 — 유기용제 중독 예방 규칙)
- Risk Characterization Ratio (RCR) = TWA / OEL
  - RCR < 0.1: acceptable
  - 0.1 ≤ RCR < 0.5: ALARP review
  - 0.5 ≤ RCR < 1.0: engineering control required
  - RCR ≥ 1.0: STOP — overexposure, mandatory PPE upgrade

### Step 5 — Biological monitoring (for high-exposure groups)

- Ethanol → urinary ethyl glucuronide (EtG) at end-of-shift
- Methanol → urinary methanol (background 1-2 mg/L, action 15 mg/L)
- Frequency: annual for low-RCR, semi-annual for RCR > 0.5

## Ventilation Verification

### Local exhaust ventilation (LEV) — required at

- Raw-material weighing booth (down-flow, HEPA + carbon)
- Open mixing vessels (canopy or slot hood, face velocity ≥ 0.5 m/s)
- Hand-pour / filling stations (lateral exhaust)
- QA sampling station (slotted hood)

### General dilution ventilation

- Minimum 10 air changes per hour (ACH) in solvent-heavy rooms
- 100% exhaust to atmosphere with carbon adsorption or thermal oxidation
- Supply air from non-adjacent source (no short-circuit)

### Verification frequency

- LEV face velocity: monthly smoke test, annual calibration
- General ACH: quarterly anemometer traverse
- Carbon bed: pressure-drop monitoring, changeout on breakthrough

## PPE Selection Matrix

| Task | RCR | Respirator | Gloves | Eye |
|------|-----|-----------|--------|-----|
| Raw-weighing (open) | < 0.1 | N95 (particulate) | Nitrile | Safety glasses |
| Mixing (open vessel) | 0.1-0.5 | Half-face organic vapor cartridge | Nitrile (double) | Goggles |
| Mixing (warm, >40 °C) | 0.5-1.0 | Full-face organic vapor + supplied-air for >15 min | Viton | Goggles + face shield |
| Filling (spritz, aerosol) | ≥ 1.0 | Supplied-air hood (continuous flow) | Viton + inner nitrile | Full face shield |
| Cleaning (solvent wipe) | Variable | Half-face organic vapor | Nitrile | Goggles |

> **Cartridge changeout**: organic-vapor cartridges absorb continuously even
> when not in use. Change per manufacturer schedule (typically 30 days after
> opening, sooner if odor breakthrough detected).

## Planning Workflow

1. **Solvent inventory** — list every solvent by step, concentration, temperature
2. **Task-based risk prioritization** — warm-mixing and aerosol filling first
3. **Sampling plan** — personal + task-based + area, sampling duration
4. **Ventilation audit** — LEV face velocity, ACH, carbon bed condition
5. **PPE matrix** — per task, based on predicted RCR
6. **Biological monitoring** — high-exposure group enrollment
7. **Worker training** — olfactory-fatigue awareness, PPE donning/doffing,
   cartridge changeout schedule (TBM record)
8. **Periodic re-monitoring** — annual low-RCR, semi-annual high-RCR

## Output

```json
{
  "plan_id": "cosmetics-csem-2026-08-07-001",
  "site": "Plant 2 - Perfume Line + Toner Line",
  "solvents_inventoried": [
    {"solvent": "ethanol", "steps": ["perfume_blending", "toner_filling"], "max_conc_pct": 85, "warm_mix_c": 35},
    {"solvent": "isopropanol", "steps": ["sanitizer_filling"], "max_conc_pct": 70},
    {"solvent": "ethyl_acetate", "steps": ["nail_enamel_filling"], "max_conc_pct": 60}
  ],
  "sampling_plan": {
    "personal_twa_samples": 12,
    "task_based_stel_samples": 8,
    "area_continuous_pids": 4
  },
  "exposure_assessment": [
    {"worker_group": "perfume_blending_operator", "ethanol_twa_ppm": 412, "oel_ppm": 1000, "rcr": 0.41, "status": "ALARP_review"},
    {"worker_group": "toner_filling_operator", "ethanol_twa_ppm": 187, "oel_ppm": 1000, "rcr": 0.19, "status": "ALARP_review"},
    {"worker_group": "sanitizer_filling_operator", "ipa_twa_ppm": 95, "oel_ppm": 400, "rcr": 0.24, "status": "ALARP_review"}
  ],
  "ventilation_audit": {
    "lev_face_velocity_ms": 0.62,
    "general_ach": 12,
    "carbon_bed_status": "OK_no_breakthrough",
    "last_smoke_test": "2026-07-20"
  },
  "ppe_matrix": {
    "perfume_blending_operator": "half_face_organic_vapor + double_nitrile + goggles",
    "toner_filling_operator": "half_face_organic_vapor + nitrile + safety_glasses"
  },
  "biological_monitoring": {
    "etg_enrolled": ["perfume_blending_operator_group"],
    "frequency": "semi_annual",
    "last_round": "2026-05-10"
  },
  "worker_training": {
    "olfactory_fatigue_tbm": "2026-08-01",
    "cartridge_changeout_log_current": true
  },
  "regulatory_basis": [
    "산업안전보건법 (OSHA-KR) Article 110 — 물질안전보건자료 작성·제출 의무",
    "화장품법 (CA) Article 5 — 제조업 등의 등록 및 시설 기준 (ventilation)",
    "화학물질의 등록 및 평가 등에 관한 법률 (K-REACH) Article 10 — 기존화학물질 등록",
    "산업안전보건법 (OSHA-KR) Article 36 — 위험성평가",
    "중대재해처벌법 (SAPA) Article 4 — 사업주 안전보장 의무"
  ],
  "acceptance_status": "monitoring_active_review_due_2026-11"
}
```

## Korean-Specific Standards

- **산업안전보건법 (OSHA-KR) Article 110** — 물질안전보건자료 작성·제출 의무
  (mandatory MSDS preparation and retention). Foundation for solvent-hazard
  communication.
- **유기용제 중독 예방 규칙** (OSHA-KR Organic Solvent Poisoning Prevention
  Rule) — sector-specific exposure limits, ventilation specs, medical
  surveillance
- **화장품법 (CA) Article 5** — cosmetics manufacturing facility standards;
  requires ventilation as a condition of manufacturing license
- **K-REACH Article 10** — existing-chemical registration; underpins hazard
  data availability for cosmetics raw materials
- **KOSHA 가이드 향료·화장품 제조업** — sector guidance for fragrance and
  cosmetics manufacturing exposure assessment

## Integration

- **Input from**: MSDS (via `msds-parser`), product formula, process flow
- **Output to**: `cosmetics-solvent-exposure-control-record.json` (the
  evidence model for the `solvent-exposure-control` workflow)
- **Coordinated skills**:
  - `msds-parser` — extract Section 8 (OEL) and Section 11 (toxicology) from
    raw-material SDS
  - `chemical-risk-assessment` (msds) — generic RCR risk characterization;
    this skill produces the cosmetics-specific monitoring PLAN that feeds it
  - `ghs-classifier` — classify raw materials for GHS hazard communication
  - `tool-box-meeting` (TBM) — olfactory-fatigue awareness briefing
- **Escalation**: RCR ≥ 1.0 → STOP work, PPE upgrade, re-sample within 24 h.
  RCR ≥ 0.5 in two consecutive rounds → engineering-control retrofit.

## Non-Duplication Justification

vs. `chemical-risk-assessment` (msds): that skill performs GENERIC risk
characterization (GHS hazard × use-scenario exposure) for any new-chemical
introduction approval, used by the msds/occupational-health domains. It
explicitly states "Out of scope: Workplace measurement, biological
monitoring." This skill produces the cosmetics-sector-specific monitoring
PLAN (sampling strategy, ventilation verification, PPE matrix, biological
monitoring enrollment) that operationalizes risk characterization for one
specific industry (cosmetics) and one specific hazard class (solvent vapor
inhalation). The two are complementary, not duplicative.

vs. `ghs-classifier`: classification-only, not monitoring.

vs. `msds-parser`: parses SDS Section 8/11 — input tool, not a planning skill.

vs. the 3 existing cosmetics workflows (`cgmp-batch-release`, `cosmetics-
safety-assessment`, `cosmetics-stability-testing`): all are product-quality/
registration-focused. This is the first WORKER-safety skill for cosmetics.

vs. `powder-dust-control` (companion workflow): particulate/dust control is
a distinct EHS discipline (combustible-dust ventilation + explosion venting
+ particulate filtration) from vapor-solvent control (carbon adsorption +
respiratory cartridge PPE + biological monitoring). The two skills will
serve different worker groups (powder mixing vs. liquid blending/filling).

## Legal Disclaimer

> 자동화 모니터링 계획 보조. 최종 노출 평가 및 PPE 결정은 산업보건의 + 안전관리자
> 권한 per 산업안전보건법 (OSHA-KR) Article 110 and 화장품법 (CA)
> Article 5. Air sampling must be performed by a KOSHA-accredited analytical
> laboratory; biological monitoring interpretation requires a board-certified
> occupational physician.
