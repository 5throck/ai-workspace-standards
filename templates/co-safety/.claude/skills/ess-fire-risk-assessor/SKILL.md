---
name: ess-fire-risk-assessor
owner: powergen-agent
scope: workspace
status: active
description: Lithium-ion ESS (Energy Storage System) fire risk assessment. Thermal runaway prediction, suppression strategy, gas emission analysis.
version: "1.0"
created: "2026-06-18"
last_updated: "2026-06-18"
metadata:
  triggers:
    - ESS 화재
    - 리튬이온 배터리 화재
    - thermal runaway
    - 열폭주
    - BMS 안전
    - energy storage system fire
    - MPSL 인증
    - 에너지저장장치 화재위험
  legal_basis:
    - 전기사업법 제67조 (전기설비 안전관리 기술기준)
    - 전기안전관리법 제12조 (전기설비 안전점검)
    - 신재생에너지 개발·이용·보급 촉진법 제13조 (신·재생에너지 설비의 인증 — 안전)
    - 산업안전보건법 제38조 (안전조치)
    - 중대재해처벌법 제4조 (사업주와 경영책임자등의 안전 및 보건 확보의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# ESS Fire Risk Assessor Skill

## Overview
리튬이온 ESS (Energy Storage System) 화재 위해 평가 — Thermal Runaway 예측, 소화 전략, 가스 배출 분석. 2018~2019 한국 ESS 화재 사건 27건 이후 고도화된 안전 기준 반영.

## Korean ESS Fire Context

### 역사적 배경
- 2018-2019: 27건 ESS 화재 (한국 집중)
- 원인: 전지 결함 + BMS 미흡 + 환경 요인
- 2020+: MPSL (Medium and Large Secondary Lithium) 안전인증 의무

### 화재 특성 (리튬이온)
- Thermal Runaway (열폭주) — 온도 급상승 자가촉매 반응
- 가스 배출 (CO, H2, CH4, 기타) — 가스 폭발 위험
- 화염 안 보임 (수소 화염)
- 재발화 흔함 (물 소화 시 반응)
- 화재 진압 곤란 (화학 반응 자체 지속)

## Battery Chemistry Comparison

| 화학 | 안전도 | Thermal Runaway 온도 | 특징 |
|------|-------|---------------------|------|
| **LFP** (LiFePO4) | 높음 | 270°C | 저에너지, 가장 안전 |
| **NMC** (LiNiMnCoO2) | 중간 | 210°C | 균형 |
| **NCA** (LiNiCoAlO2) | 중간 | 150°C | 고에너지 |
| **LCO** (LiCoO2) | 낮음 | 150°C | 열폭주 위험 높음 |

## Risk Factors

### 1. Cell Level
- Manufacturing defects
- Internal short circuit (ISC)
- Aging/degradation
- Overcharge/over-discharge
- Mechanical damage

### 2. Module/Pack Level
- Cell imbalance
- BMS accuracy/cycling
- Thermal management failure
- Connection resistance

### 3. System Level
- Cooling system failure
- Fire detection latency
- Suppression system adequacy
- Ventilation for off-gases

### 4. Environmental
- Ambient temperature
- Humidity
- Dust
- Seismic activity

## Risk Assessment Methodology

### Step 1: Hazard Identification
- Chemistry-specific failure modes
- HAZOP (Hazard and Operability Study)
- FMEA (Failure Modes and Effects Analysis)

### Step 2: Likelihood Assessment
- Cell defect rate (ppm)
- Operating conditions
- Historical failure data
- BMS effectiveness

### Step 3: Consequence Assessment
- Thermal runaway propagation time
- Heat release rate (HRR)
- Toxic gas emission rate
- Smoke production

### Step 4: Risk Evaluation
- Risk matrix (Likelihood × Severity)
- ALARP (As Low As Reasonably Practicable) principle
- Comparison to acceptance criteria

## Mitigation Hierarchy

### 1. Prevention
- Cell quality ( manufacturer certification)
- BMS redundancy (2-of-3 voting)
- Thermal management (HVAC, liquid cooling)
- SOPs for charge/discharge

### 2. Detection
- Gas detection (CO, H2 — earliest thermal runaway sign)
- Smoke detection
- Heat detection
- BMS anomaly alerts

### 3. Suppression
- **Water**: 사용 금지 (리튬 반응) — 예외적으로 대량 사용 (NFPA 855)
- **Dry chemical**: 1차 진화
- **Inert gas (N2, CO2)**: 산소 차단
- **Aerosol**: 일부 효과
- **Immersion cooling**: 실험 단계

### 4. Containment
- Fire-resistant enclosure (2-4 hours)
- Deflagration venting
- Gas management system

## Korean Standards

- **MPSL 인증** (Medium and Large Secondary Lithium) — 의무
- **KFC-2021** 한국화재보험협회 ESS 화재 방지 가이드
- **KOSHA GUIDE** ESS 안전관리
- **NFPA 855** (참고 — 미국 표준)
- **발전설비 안전관리 규정** (MOTIE)

## Output

```json
{
  "ess_id": "...",
  "battery_chemistry": "NMC",
  "capacity_kwh": 2000,
  "risk_score": 0.62,
  "risk_level": "high",
  "hazard_factors": {
    "cell_defect_rate_ppm": 5.2,
    "thermal_runaway_threshold_c": 210,
    "bms_redundancy": "2_of_3_voting"
  },
  "consequence_assessment": {
    "time_to_propagation_s": 180,
    "hrr_peak_mw": 12,
    "toxic_gases": ["CO", "HF", "POF3", "H2"]
  },
  "recommended_mitigations": [
    "Gas detection (CO + H2) 추가 설치",
    "Deflagration venting 강화",
    "Water mist system (NFPA 855 준거)",
    "격실 벽 4시간 내화 등급"
  ],
  "acceptance_status": "ALARP_review_required"
}
```

## Integration

- **Input from**: `powergen-renewable-facility-record.json` (ESS subtype)
- **Output to**: Updates fire risk fields, mitigation tracking
- **Escalation**: Critical → 즉시 ESS 운영 중지 + 화재 진압 대기

## v2 Roadmap
- ML 기반 thermal runaway 조기 탐지
- 실시간 가스 모니터링 통합
- 화재 시뮬레이션 (FDS)

## Legal Disclaimer
> 자동화 위해 평가. 최종 화재 안전 설계는 자격을 갖춘 소방설비사 + KOSHA 인증 전문가 판정.
