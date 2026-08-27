---
name: arc-flash-analyzer
owner: powergen-agent
scope: workspace
status: active
description: Arc flash hazard analysis per IEEE 1584. Computes incident energy, arc flash boundary, PPE category for high voltage work.
version: "1.0"
created: "2026-06-18"
last_updated: "2026-08-26"
metadata:
  triggers:
    - 아크 플래시
    - arc flash
    - IEEE 1584
    - 고압 전기 작업
    - PPE category
    - incident energy
    - NFPA 70E
    - 활선 작업 허가
  legal_basis:
    - 전기안전관리법 제12조
    - 전기사업법 제67조
    - 산업안전보건법 제38조
    - 발전설비 안전관리 규정(산업통상자원부 고시)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Arc Flash Analyzer Skill

## Overview
IEEE 1584 standard 기반 아크 플래시 위해 분석 — incident energy, arc flash boundary, PPE category 계산하여 고압 전기 작업 안전 확보.

## Key Concepts

### Incident Energy (침입 에너지)
- 작업자 위치에서 아크 폭발 시 받을 열에너지
- 단위: cal/cm²
- 임계값: 1.2 cal/cm² (2도 화상 임계)

### Arc Flash Boundary
- 침입 에너지가 1.2 cal/cm² 도달 거리
- 이 경계 내 작업 시 PPE 필수

### PPE Category (NFPA 70E)
- Category 1: 4 cal/cm² (최소 ARC rated PPE)
- Category 2: 8 cal/cm² (ARC rated clothing + face shield)
- Category 3: 25 cal/cm² (ARC flash suit)
- Category 4: 40 cal/cm² (heavy ARC flash suit)
- > Category 4: 작업 금지 (전원 차단 후 작업)

## IEEE 1584 Inputs

### Required Parameters
- System voltage (kV)
- Bolted fault current (kA)
- Arcing current (calculated from bolted)
- Arc gap (mm)
- Working distance (cm)
- Equipment type (open air / switchgear / panelboard / cable)
- Grounding type (grounded / ungrounded)
- Arc duration (seconds) — typically clearing time of protective device

### Calculation Output
- Incident energy (cal/cm²)
- Arc flash boundary (m)
- PPE category required

## Workflow Steps

1. **System Data Collection**
   - Single-line diagram review
   - Short circuit study (bolting fault)
   - Protective device coordination study

2. **Calculation**
   - Apply IEEE 1584 empirical equations
   - Use IEEE 1584-2018 updated model (vs older 2002)
   - Consider equipment configuration factors

3. **Label Generation**
   - Arc flash warning labels per NFPA 70E
   - Post on all electrical equipment

4. **PPE Selection**
   - Match PPE category to incident energy
   - Specify exact equipment (face shield, gloves, etc.)

5. **Work Permit**
   - Energized work permit if live work required
   - Justification for not de-energizing

## Korean-Specific

- 한국전기안전공사 (KESCO) 아크 플래시 가이드
- 한국산업안전보건공단 (KOSHA) 고압 전기 작업 가이드
- 산업안전보건법 Article 38 (전기 위해 방지 포함 안전조치)
- 발전설비 안전관리 규정 (MOTIE 고시)

## Output

```json
{
  "analysis_id": "...",
  "equipment_id": "GEN-SW-345-001",
  "voltage_kv": 345,
  "bolted_fault_current_ka": 40,
  "arcing_current_ka": 28,
  "working_distance_cm": 45,
  "arc_duration_s": 0.2,
  "incident_energy_cal_cm2": 18.5,
  "arc_flash_boundary_m": 1.8,
  "ppe_category": 3,
  "required_ppe": ["ARC flash suit (25+ cal/cm²)", "ARC rated hood", "insulated gloves class 2"],
  "label_generated": true,
  "live_work_recommended": false
}
```

## Integration

- **Input from**: Single-line diagrams, short circuit study results
- **Output to**: `powergen-high-voltage-record.json` arc flash fields
- **External**: ETAP, SKM, EasyPower (v2 roadmap)

## v2 Roadmap
- 5-cycle analysis for breakers
- Dynamic arc resistance model
- Real-time PPE verification

## Legal Disclaimer
> IEEE 1584 준거 자동 분석. 최종 안전 작업 판정은 자격을 갖춘 전기안전관리자 + 작업 책임자.
