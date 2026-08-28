---
name: gas-dispersion-analyzer
owner: gasterm-agent
scope: workspace
status: active
description: Model gas dispersion after leak for emergency response. LNG/LPG/수소 특성 반영.
version: "1.0.0"
created: "2026-06-18"
last_updated: "2026-06-18"
metadata:
  triggers:
    - 가스 확산 모델
    - gas dispersion
    - 가스 누출 시나리오
    - LNG LPG 누출
    - 수소 누출 확산
    - BLEVE
    - 대피 반경 산정
    - Gaussian dispersion model
  legal_basis:
    - 고압가스안전관리법 제13조 (시설·용기의 안전유지)
    - 고압가스안전관리법 제26조 (사고의 통보 등)
    - 산업안전보건법 제54조 (중대재해 발생 시 조치)
    - 중대재해처벌법 제4조 (사업주와 경영책임자등의 안전 및 보건 확보의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Gas Dispersion Analyzer Skill

## Overview
가스 누출 시 확산 모델링 — LNG (공기보다 가벼움, 상승), LPG (공기보다 무거움, 하강), 수소 (매우 빠른 확산, 음폭 위험)의 특성 차이 반영.

## Gas Behavior Characteristics

### LNG (Liquefied Natural Gas, Methane)
- Vapor density: 공기보다 가벼움 (0.55)
- 가스화 후 상승 → 위쪽 확산
- RPT (Rapid Phase Transition) 위험 — 물 접촉 시 급격 기화
- 폭발 범위: 5-15%

### LPG (Propane/Butane)
- Vapor density: 공기보다 무거움 (1.5-2.0)
- 저지대, 지하 시설에 축적
- BLEVE 위험 — 용기 가열 시 폭발
- 폭발 범위: 2-9.5% (propane)

### 수소 (Hydrogen)
- 매우 빠른 확산 (메탄보다 4배 빠름)
- 폭발 범위 매우 넓음: 4-75%
- 음폭 (Detonation): 18.3-59%
- 음폭 시 압력파 피해 심각
- 금속 취성 (수소 취성)

## Modeling Parameters

### Gaussian Dispersion Model
- 풍향, 풍속
- 대기 안정도 (Pasquill class A-F)
- 누출 유량 (kg/s)
- 누출 높이
- 주변 지형 (장애물, 건물)

### Special Considerations
- 밀도 차이 (가벼움/무거움)
- 저온 가스 (LNG vapor初期 무거움 → 가온 후 가벼워짐)
- 장애물 영향 (건물 사이 channeling)

## Workflow Steps

1. **누출 시나리오 식별**: 가스 종류, 누출 유량, 위치, 풍향
2. **모델 선택**: 밀도 기반 (heavy/light gas model)
3. **확산 영역 계산**: 농도별 등고선 (LEL 25%, LEL 100%, IDLH)
4. **대피 영역 결정**: LEL 50% 이상 영역
5. **점화원 식별**: 화기 작업, 정전, 차량 등
6. **권고**: 대피 반경, 통제 구역, 진화 전략

## Output

```json
{
  "scenario_id": "...",
  "gas_type": "LPG",
  "release_rate_kg_per_s": 12.5,
  "wind_speed_ms": 3.2,
  "wind_direction": "NE",
  "stability_class": "D",
  "dispersion_model_used": "heavy_gas_DEGADIS",
  "distance_to_LEL_25_pct_m": 180,
  "distance_to_LEL_100_pct_m": 75,
  "evacuation_zone_radius_m": 300,
  "ignition_sources_within_zone": ["컨베이어 #3", "차량 진입로"],
  "recommended_actions": ["350m 대피", "전원 차단", "소방서 알림"]
}
```

## Korean-Specific Standards

- 한국가스안전공사 가스확산 시나리오 가이드
- 인구 밀집 지역 특수 대응
- 지형 (산/바다/도시) 영향 반영

## Integration

- **Input from**: `gasterm-leak-detection-record.json`
- **Output to**: Updates evacuation zones, emergency response
- **External**: ALOHA, DEGADIS, PHAST 모델 (v2 roadmap)

## v2 Roadmap
- 3D 확산 모델링 (CFD)
- 실시간 기상 연동
- 다중 가스 누출 시나리오

## Legal Disclaimer
> 자동화 모델. 최종 대응 결정은 가스안전관리자 + 소방대장 권한.
