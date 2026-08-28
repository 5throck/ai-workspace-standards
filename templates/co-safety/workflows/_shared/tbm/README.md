# 작업전 안전점검회의 TBM (Tool Box Meeting) — 공통 기반 워크플로우

> **공통 워크플로우 (Shared Workflow)** — 본 워크플로우는 15개 산업(battery, biotech, datacenter, defense, ehschem, ehsconst, food, gasterm, logistics, powergen, railway, semicon, shipbuilding, steelmaking, waste)에서 공통으로 참조하는 표준 TBM 기반입니다. 각 산업은 자체 `schema.yaml`의 `references:` 블록을 통해 본 기반을 참조하며, 산업 고유의 `signature_hazard` 및 관련 법령을 override로 선언합니다. 상세 참조 규격은 [`../REFERENCE-SPEC.md`](../REFERENCE-SPEC.md)를 참조하십시오.

## 1. 목적
TBM (Tool Box Meeting, 작업 전 안전점검회의) — 일일 작업 시작 전 전일 안전사례 공유, 금일 작업 위해요소 교육, 안전장구 점검, 작업별 안전수칙 확인, 건의사항 수렴을 수행하는 의무적 안전회보. 한국 고위험 산업 공통 관행이자 산업안전보건법(OSHA-KR) Article 15 및 중대재해처벌법(SAPA) Article 4에 근거한 안전보건관자리의 핵심 의무 활동.

## 2. 공통 법적 근거 (Legal Basis — 공통 기반)
모든 참조 산업에 공통으로 적용되는 최소 법적 근거 (본 기반에 포함):

- **산업안전보건법 (OSHA-KR) Article 15** — 안전보건관리자 선임 및 직무 (Safety & Health Management Director)
- **산업안전보건법 (OSHA-KR) Article 36** — 안전보건관리규정 (Safety & Health Management Regulations)
- **중대재해처벌법 (SAPA) Article 4** — 안전보건 확보 의무 (General duty to secure safety and health)

> 산업별 추가 법령(예: 항만안전특별법, 고압가스안전관리법, 철도안전법, 위험물안전관리법 등)은 각 산업의 `schema.yaml`에 있는 `references.overrides.legal_basis.add` 블록에 선언합니다. 본 공통 기반의 법적 근거를 대체(replace)하지 말고 추가(add)하십시오.

## 3. TBM 공통 내용 (5항목)
1. 전일 안전사고/문제점 공유
2. 금일 작업별 위해 요소 교육 — 산업별 `signature_hazard` 중심
3. 안전장구 점검 — 안전모/안전대/안전화 및 산업별 특수 PPE
4. 작업별 안전수칙 확인
5. 건의사항 수렴

## 4. 워크플로우 단계 (Workflow Steps — 공통)
1. **작업 전 15분 실시**: 작업 시작 전
2. **참석 체크**: 전원 서명 (e-signature)
3. **주제 기록**: 일지 작성 — `signature_hazard` 명시
4. **사진 기록**: 교육 실시 증빙
5. **결근자 후속조치 (follow-up)**: 별도 교육 실시

## 5. 증거 기록 (Evidence Record)
공통 증거 모델: [`../../../evidence-models/_shared/tbm-record.json`](../../../evidence-models/_shared/tbm-record.json)

- 레코드 ID 형식: `TBM-<DOMAIN>-YYYY-NNNN` (예: `TBM-RAILWY-2026-0001`, `TBM-SHIPBD-2026-0001`)
- 산업별 특화 필드는 증거 모델의 `industry_specific_fields` 확장 포인트 사용
- 버전: 1.0.0

## 6. 산업별 Override (Industry Overrides)
각 산업은 다음 필드를 `references.overrides`에 선언합니다 (상세 규격: [`../REFERENCE-SPEC.md`](../REFERENCE-SPEC.md)):

| 필드 | 필수 여부 | 설명 |
|------|:---------:|------|
| `signature_hazard` | 필수 | 산업 고유 대표 위해요인 |
| `industry_profile` | 필수 | 산업 프로필 식별자 |
| `agent` | 필수 | 담당 산업 에이전트 |
| `legal_basis.add` | 선택 | 산업 관련 법령 추가 (공통 기반에 add) |
| `evidence_model` | 선택 | 산업 전용 증거 모델로 override 시 사용 |

### 보존되는 산업별 변형 (Preserved Industry Variants)
다음 산업 변형은 Phase 1/2 마이그레이션 시에도 반드시 override로 보존해야 합니다 (본직 이유로 공통 기반으로 흡수되지 않음):

- **ehsconst (건설)** — `ehsconst-tbm-record.json` 전용 증거 모델 유지. 사유: SAPA Article 5 도급업체 층위(contractor tier) 및 건설기술진흥법 Article 24의 건설 전용 규정이 공통 기반에 포함되지 않음. 건설업은 본 공통 기반을 참조하되 `evidence_model`과 추가 `legal_basis`(건설기술진흥법 Art 24, SAPA Art 5)을 override로 유지합니다.

## 7. 참조 산업 (Consumed By)
본 공통 TBM은 다음 15개 산업에서 참조합니다 (Phase 1/2 마이그레이션 예정 — Phase 0에서는 기존 per-industry 워크플로우를 유지):

battery · biotech · datacenter · defense · ehschem · ehsconst (부분 override) · food · gasterm · logistics · powergen · railway · semicon · shipbuilding · steelmaking · waste

> **참고**: cosmetics 산업은 현재 TBM 워크플로우가 없습니다. Phase 1/2에서 본 공통 기반을 참조하는 cosmetics TBM을 신규 생성할 수 있습니다.
