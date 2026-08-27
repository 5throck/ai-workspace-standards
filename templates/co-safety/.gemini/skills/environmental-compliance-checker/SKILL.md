---
name: environmental-compliance-checker
owner: ehschem-agent
scope: workspace
status: active
description: Check environmental discharge compliance for chemical plants. Air (SOx/NOx/VOC/PM), water (BOD/COD/heavy metals), noise/vibration.
version: "1.0"
created: "2026-06-18"
last_updated: "2026-06-18"
metadata:
  triggers:
    - 환경 배출 기준
    - 대기오염물질 배출허용기준
    - SOx NOx VOC
    - 수질오염물질
    - BOD COD
    - 환경보전법 준수
    - 배출 규제 준수
    - environmental discharge compliance
  legal_basis:
    - 대기환경보전법 (배출허용기준, 시행규칙 별표 11)
    - 물환경보전법
    - 소음진동관리법
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Environmental Compliance Checker Skill

## Overview
화학공장 환경 배출 규제 준수 검증 — 대기 (SOx/NOx/VOC/PM), 수질 (BOD/COD/중금속), 소음/진동.

## Korean Discharge Standards

### 대기오염물질 (대기환경보전법)
| 물질 | 배출허용기준 |
|------|-------------|
| SOx | 10-50 ppm (시설 규모별) |
| NOx | 50-200 ppm |
| VOC | 시설별 차등 |
| PM | 10-50 mg/m³ |

### 수질오염물질 (수질환경보전법)
| 물질 | 배출허용기준 |
|------|-------------|
| BOD | 10-30 mg/L (지역별) |
| COD | 20-40 mg/L |
| 중금속 | 물질별 0.1-5 mg/L |

## Workflow Steps
1. **배출 데이터 수집**: 자체 측정 + 위탁 분석
2. **기준 비교**: 시설 규모/지역별 허용기준
3. **초과 분석**: 초과 시 원인 조사, 시정조치
4. **규제 보고**: 월 1회 자체, 분기/연간 관할기관

## Legal Disclaimer
> 자동화 검증 보조. 최종 환경 규제 준수 판정은 환경안전책임자.
