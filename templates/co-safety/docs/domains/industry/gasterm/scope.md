# Gas Terminal (gasterm) Domain v1 — Scope Document

> **Domain**: `gasterm` (Gas Terminal Safety / 가스터미널 안전)
> **Status**: Approved (2026-06-18) — **9th domain**

## 1. Purpose

LNG/LPG/수소 가스 기지, 충전소, 저장시설의 안전 관리. 한국가스안전공사(KGS) 규제 준수, 폭발/화재 예방, 비상 대응이 핵심. 대규모 시설은 PSM과 병행 적용.

## 2. Components

| Component | Count |
|-----------|-------|
| Agent | 1 (`gasterm-agent`) |
| Workflows | 12 (10 core + 1 reference + 1 orchestrator) |
| Evidence Models | 11 |
| Skills | 2 |
| Regulations | 4 (고압가스법, LPG법, 수소법, 도시가스법) |
| Industry Profile | 1 (`gas-facility.yaml`) |

## 3. Workflows

| # | Workflow | Type | Key Topic |
|---|----------|------|-----------|
| 1 | tank-storage-management | core | LNG/LPG/수소 저장탱크 운영 |
| 2 | gas-leak-detection-response | core | 가스 검지기 모니터링 및 알람 대응 |
| 3 | charging-operation-safety | core | LPG/수소 충전 작업 |
| 4 | pipe-transfer-management | core | 배관 이송 (터미널 내/외부) |
| 5 | hazardous-zone-management | core | 법정 거리/위해 구역 유지 |
| 6 | tank-inspection-maintenance | core | KGS 안전검사 대응 (연/월) |
| 7 | gas-emergency-preparedness | core | 비상 대비 (확산 모델, 대피) |
| 8 | major-gas-incident-reference | reference | 대형 사고 시 emergency-agent 위임 |
| 9 | construction-permit-overview | orchestrator | 건설/인허가 전체 관리 (3단계 오케스트레이터) |
| 10 | pre-construction-technical-review | core | 사전기술검토 (KGS Code 적합성 심사) |
| 11 | mid-construction-inspection | core | 중간검사 (KGS 입회 공정검사) |
| 12 | completion-inspection | core | 완성검사 (KGS 입회 완성검사 → 허가) |

## 4. Common Fields (all gasterm-*.json)

- `facility_type`: LNG_terminal / LPG_charging / hydrogen_charging / city_gas_storage / pipe_transfer
- `kgs_inspection_status`: certified / pending / failed / expired
- `psm_applicable`: boolean (대규모 시설)
- `gas_type`: LNG / LPG / hydrogen / natural_gas / other

Plus standard: `e_signature`, `nomenclature`, `audit_trail`, `legal_basis` (≥3)

## 5. Gas-Specific Hazards

### LNG (Liquefied Natural Gas, -162°C)
- 저온 화상, RPT (Rapid Phase Transition)
- 가스 확산 (증발 시 공기보다 가벼움)

### LPG (Liquefied Petroleum Gas)
- 공기보다 무거움 → 지저부 분포
- BLEVE (Boiling Liquid Expanding Vapor Explosion)

### 수소 (Hydrogen, 신규 법령 2021)
- 폭발 범위 매우 넓음 (4-75%)
- 음폭성 (detonation 18.3-59%)
- 금속 취성 (수소 취성)
- 화염 안 보임 (UV/IR 검출기 필수)

## 6. Cross-Domain Interface

- gasterm ↔ PSM (대규모 시설 PSM 적용)
- gasterm → MSDS (가스 처리 화학물질)
- gasterm → emergency (explosion-gas-response 직접 연계)
- gasterm → emergency (disaster-response — 지진/태풍 시설 대응)

## 7. KGS Code Construction/Permit Procedure

가스 3법에 따른 건설/인허가는 KGS Code를 실질적 심사 기준으로 삼는다.

| 단계 | 내용 | 주관 | 선행 조건 |
|------|------|------|-----------|
| 사전기술검토 | 시설기준·기술기준 적합성 심사 | KGS | — |
| 지자체 변경허가 | KGS 검토 결과 바탕 허가 | 지자체 | 사전기술검토 합격 |
| 중간검사 | 공사 진행 중 KGS 입회 검사 | KGS | 변경허가 완료 |
| 완성검사 | 전체 시설 종합 검사 | KGS | 중간검사 합격 |
| 허가증 발급 | 완성검사 합격 후 허가 | 지자체 | 완성검사 합격 |
| 운영 개시 | 정기검사 주기 설정 | 자체 | 허가증 발급 |

## 8. KGS Inspection Cycles

| 항목 | 주기 | 주관 |
|------|------|------|
| 저장탱크 (LNG/LPG) | 연 1회 | 한국가스안전공사 |
| 가스 검지기 | 월 1회 | 자체 점검 |
| 안전밸브 | 연 1회 | 자체 점검 |
| 충전기 (LPG) | 분기 1회 | 자체 점검 |
| 수소 충전소 | 연 1회 + 정기 | KGS + 자체 |

## 9. Legal Disclaimer

> 가스 시설 운영은 법적 안전관리자/시설관리자 책임. 본 시스템은 워크플로우 자동화 지원만 제공.
