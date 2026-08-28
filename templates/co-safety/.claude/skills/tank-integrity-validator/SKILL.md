---
name: tank-integrity-validator
owner: gasterm-agent
scope: workspace
status: active
description: Validate LNG/LPG/수소 저장탱크 구조 건전성. 압력/온도/부식/피로 검증.
version: "1.0.0"
created: "2026-06-18"
last_updated: "2026-06-18"
metadata:
  triggers:
    - 저장탱크 건전성
    - tank integrity
    - LNG 탱크 검사
    - 수소 취성
    - hydrogen embrittlement
    - KGS 코드
    - 압력용기 검사
    - 부식 피로 검증
  legal_basis:
    - "고압가스 안전관리법 제13조 (시설·용기의 안전유지)"
    - "고압가스 안전관리법 제11조 (안전관리규정 — 저장탱크 안전유지 계획)"
    - "고압가스 안전관리법 제22조의2 (시설·기술·검사 상세기준 위임 — KGS Code)"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Tank Integrity Validator Skill

## Overview
저장탱크 구조 건전성 검증 — 설계 압력/온도, 부식, 피로, 수소 취성 등의 다양한 위해 평가.

## Tank Types

### LNG Storage
- 내열탱크 (9% Nickel steel, austenitic stainless)
- 외탱크 (Reinforced concrete)
- Perlite insulation
- 위험: 저온 취성, 단열 성능 저하

### LPG Storage
- Spherical tanks (구형)
- Bullet tanks (횡형)
- Pressure vessels
- 위험: 응력 부식 균열 (SCC), BLEVE

### 수소 Storage
- Type IV (composite, plastic liner)
- Type III (metal liner + composite)
- 위험: 수소 취성 (금속), 크리프

## Validation Categories

### 1. Pressure Boundary
- 설계 압력 대비 운전 압력 비율
- 안전율 (PSV 작동 압력)
- 압력 사이클 횟수 (피로 수명)

### 2. Temperature
- 저온 취성 (LNG: -162°C)
- 고온 크리프
- 열응력 (온도 구배)

### 3. Corrosion
- 내부 부식 (화학물질 노출)
- 외부 부식 (대기, 토양)
- 응력 부식 균열 (SCC)

### 4. Hydrogen Embrittlement (수소)
- 금속 종류별 수소 취성 민감도
- 크리프 변형
- 마이크로 크랙

### 5. Fatigue
- 압력 사이클 (충전/방전)
- 온도 사이클
- 진동 (compressor 인접)

### 6. Foundation
- 침하 (uniform/differential)
- 지진 내진 성능
- 얼음/동결 (수분 침투)

## Validation Workflow

### Step 1: Design Verification
- 설계 도면/계산서 검토
- KGS/ASME 코드 준거 확인

### Step 2: NDT (Non-Destructive Testing)
- UT (초음파 두께 측정)
- MT (자분 탐상)
- PT (침투 탐상)
- RT (방사선 투과)
- AE (음향 방출)

### Step 3: Hydrotest
- 설계 압력 1.3-1.5배 시험
- 5년 또는 10년 주기

### Step 4: Online Monitoring
- 압력/온도 실시간
- 가스 검지기
- 음향 방출 모니터링

### Step 5: Risk Assessment
- RBI (Risk-Based Inspection)
- 잔류 수명 예측

## Korean-Specific KGS Standards

- KGS CODE (한국가스안전공사 코드)
- KOSHA GUIDE (한국산업안전보건공단)
- ASME BPVC Section VIII (압력 용기)
- API 510 (Pressure Vessel Inspection Code)
- API 653 (Aboveground Storage Tank)

## Output

```json
{
  "tank_id": "...",
  "tank_type": "LNG_double_containmentment",
  "design_year": 2008,
  "integrity_score": 0.92,
  "validation_findings": {
    "pressure_boundary": "OK (operating 8 bar, design 12 bar)",
    "corrosion": "minor_external (3% wall thickness loss at bottom)",
    "fatigue_cycles_remaining": 8500,
    "next_hydrotest_due": "2028-06"
  },
  "recommendations": ["UT 재측정 (외부 하부)", "재도장 (외부)"],
  "anomalies": []
}
```

## Integration

- **Input from**: `gasterm-tank-storage-record.json`, `gasterm-inspection-record.json`
- **Output to**: Updates tank health metrics, maintenance schedule
- **Escalation**: Critical anomaly → 즉시 운영 중지

## v2 Roadmap
- ML 기반 잔류 수명 예측
- 디지털 트윈 (digital twin)
- IoT 센서 통합 (영구 모니터링)

## Legal Disclaimer
> 자동화 검증 보조. 최종 구조 건전성 판정은 자격을 갖춘 압력용기 검사기관 + 가스안전관리자.
