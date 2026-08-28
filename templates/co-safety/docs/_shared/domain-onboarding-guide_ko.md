# 도메인 온보딩 가이드

> Safety OS에 신규 도메인(예: GDP, GLP, GCP, GVP)을 추가하기 위한 **표준 운영 절차(SOP)**.

본 가이드는 2026-06-17에 채택된 폴더 구조 규칙(회의 `memory/meeting-2026-06-17-folder-structure-redesign.md` 기준)을 문서화하며, 2026-06-20에 채택된 `functional/`/`industry/` 2-tier 분리(`docs/_shared/domain-classification-guide_ko.md` §6 Phase 2 참조)를 반영해 갱신되었습니다.

> **자동화 사용 가능**: `bun scripts/new-domain.ts <name> <tier:functional|industry> [profile]`가 아래 Step 1-2-3-4-5-6-9를 자동으로 스캐폴딩합니다 (디렉터리 구조, agent/profile/workflow/evidence-model/scope 템플릿에 TODO 플레이스홀더 포함). Step 7, 8, 10, 11(스킬, 규제, 감사, 체인지로그)은 여전히 수동입니다. Step 1-6/9를 수동으로 하기보다 스크립트 실행을 우선하세요.

---

## 1. 이 가이드를 사용하는 시점

Safety OS에 신규 규제 또는 운영 도메인을 도입할 때 본 가이드를 사용합니다. 예시:

- **GDP** (Good Distribution Practice)
- **GLP** (Good Laboratory Practice)
- **GCP** (Good Clinical Practice)
- **GVP** (Good Pharmacovigilance Practice)
- **EHS-Vertical** (예: `semicon`, `ehsconst`)

## 2. 명명 규칙

| 계열 | 규칙 | 예시 |
|--------|-----------|----------|
| GxP 계열 | 소문자 | `gmp`, `gdp`, `glp`, `gcp`, `gvp` |
| EHS 계열 | `ehs<산업-약어>` | `ehsmfg`, `ehsconst`, `semicon` |
| 공통/공유 | 언더스코어 접두어 | `_shared`, `_meta` |

## 3. 최상위 디렉토리별 폴더 구조

모든 도메인은 일관된 `<top-level>/domains/<tier>/<name>/` 패턴으로 다음 최상위 디렉토리에 접합니다 (`<tier>`는 `functional` 또는 `industry` — 신규 도메인이 어느 tier에 속하는지는 `docs/_shared/domain-classification-guide_ko.md` 참조):

```
agents/
├── pm.md, safety-governance-manager.md, safety-workflow-manager.md  # 거버넌스/운영 에이전트 (pm, sgm, swm, flat 배치)
├── _shared/                       # 크로스 도메인 서비스 에이전트
└── domains/
    ├── functional/<name>/
    │   └── <name>-agent.md        # 도메인별 에이전트 (예: psm, msds, training)
    └── industry/<name>/
        └── <name>-agent.md        # 도메인별 에이전트 (예: gmp, ehschem, gasterm)

docs/
├── _meta/                         # 도메인 무관 메타 문서
├── _shared/                       # 크로스 도메인 가이드
└── domains/
    ├── functional/<name>/
    │   └── scope.md               # v1 범위 문서
    └── industry/<name>/
        └── scope.md

evidence-models/
├── _shared/base/                  # 공통 스키마 (gmp-common, finding, corrective-action 등)
└── domains/
    ├── functional/<name>/
    │   └── <name>-*-record.json   # 도메인별 증거 모델
    └── industry/<name>/
        └── <name>-*-record.json

skills/
├── _meta/                         # SKILLS.md, README 파일 (L0+L1 공통 스킬만 추적 —
│                                   #   아래 도메인별 스킬은 AGENTS.md에서 추적)
├── <governance-skill>/SKILL.md    # 거버넌스/빌드 스킬 (평면)
├── daily/                         # 일상 EHS 운영
│   └── <skill>/SKILL.md
├── investigation/                 # 위해/사고 분석 (HAZOP, RCA)
│   └── <skill>/SKILL.md
├── emergency/                     # 비상 대응
│   └── <skill>/SKILL.md
└── domains/
    ├── functional/<name>/
    │   └── <skill>/SKILL.md       # 도메인별 스킬
    └── industry/<name>/
        └── <skill>/SKILL.md

workflows/
├── _shared/                       # _template/, data-seeding.yaml
├── daily/                         # 일일 운영 (도메인 무관)
├── emergency/                     # 비상 대응 (도메인 무관)
├── compliance/                    # 구조화된 컴플라이언스 체크리스트 예약 공간 (아직 미작성)
└── domains/
    ├── functional/<name>/
    │   └── <workflow>/            # 각 워크플로우 = schema.yaml + README.md 디렉토리
    │       ├── schema.yaml
    │       └── README.md
    └── industry/<name>/
        └── <workflow>/
            ├── schema.yaml
            └── README.md

regulations/                       # 평면 구조 (국가 조직의 자연적 구조)
└── KR/
    ├── OSHA-KR.yaml                # 정본 파일 (코드베이스 전체에서 인용되는 모든 OSHA-KR 조항)
    ├── SAPA.yaml                   # 정본 파일 (코드베이스 전체에서 인용되는 모든 SAPA 조항)
    └── <Regulator>-<Framework>.{yaml,md}   # 도메인별 하위 변형

industry-profiles/                 # 평면 구조 (산업 ≈ 도메인이나 1:1 아님)
└── <profile>.yaml
```

## 4. 온보딩 절차 (단계별)

### Step 1: 도메인명 예약
도메인명이 이미 사용 중이 아닌지 확인하세요. 본 가이드의 "활성 도메인" 표(Section 5)에 항목을 추가합니다.

### Step 2: 표준 하위 구조 생성
각 최상위 디렉토리에 대해 `domains/<tier>/<name>/` 하위 디렉토리를 생성합니다 (`<tier>` = `functional` 또는 `industry`):

```bash
mkdir -p agents/domains/<tier>/<name>
mkdir -p docs/domains/<tier>/<name>
mkdir -p evidence-models/domains/<tier>/<name>
mkdir -p skills/domains/<tier>/<name>
mkdir -p workflows/domains/<tier>/<name>
```

또는 위 Step 2와 3-6/9를 한 번에 자동화: `bun scripts/new-domain.ts <name> <tier> [profile]`.

### Step 3: 에이전트 작성
flat core 에이전트(`agents/pm.md`, `agents/safety-governance-manager.md`, `agents/safety-workflow-manager.md`)의 템플릿에 따라 `agents/domains/<tier>/<name>/<name>-agent.md`를 작성합니다. 필수 섹션:
- Section A — Legal Basis (다중 출처; 최소 3개 규제 참조)
- Section B — Role & Responsibilities (명시적 범위 제한 포함)
- Section C — Operational Protocols & Escalation Rules

### Step 4: 산업 프로필 작성
도메인을 적용 가능한 법령, GMP/PQS 핵심요소, 워크플로우 목록에 매핑하는 `industry-profiles/<profile>.yaml`을 작성합니다.

### Step 5: 워크플로우 작성
각 워크플로우에 대해:
1. `workflows/domains/<tier>/<name>/<workflow>/` 디렉토리 생성
2. 필수 필드를 포함한 `schema.yaml` 작성 (`schema_version`, `workflow_id`, `title`, `status: active`, `applicability: mandatory`, `legal_basis`, `industry_profile`, `agent`, `evidence_model`)
3. Objective, Applicability, Workflow Steps, Evidence Record, Legal Disclaimer를 포함한 `README.md` 작성

### Step 6: 증거 모델 작성
각 증거 유형에 대해 `evidence-models/domains/<tier>/<name>/<name>-*-record.json`을 작성합니다. (도메인 결정에 따라 적용 가능한 경우) 필수 공통 필드:
- `e_signature` (`_shared/base/gmp-common.schema.json` 또는 도메인별 스키마에 대한 $ref)
- `qrm_assessment` (도메인이 ICH Q9 또는 동등한 기준을 사용하는 경우)
- `nomenclature` (다국어 선언)
- `audit_trail` (ALCOA+ 메타데이터)
- `legal_basis` (다중 출처 배열, 최소 3개 항목)

### Step 7: 스킬 작성 (선택)
도메인이 횡단적 방법론 스킬(예: `gmp-qrm`)을 가진 경우 `skills/domains/<tier>/<name>/<skill>/SKILL.md`를 작성합니다.

### Step 8: 규제 참조 작성
감사 준수를 위해 `source_mcp` 필드를 포함하여 `regulations/<jurisdiction>/<Regulator>-<Framework>.{yaml,md}`를 작성합니다.

### Step 9: 범위 문서 작성
v1 범위, 제외 항목, KPI, 컴플라이언스 게이트를 문서화하는 `docs/domains/<tier>/<name>/scope.md`를 작성합니다.

### Step 10: 감사 실행
```bash
bun scripts/safety-audit.ts
```
0건의 오류로 통과해야 합니다. 감사는 재귀적 walkDir을 통해 신규 도메인을 자동 인식합니다.

### Step 11: CHANGELOG 및 메모리 로그 갱신
- `CHANGELOG.md`에 `### Added (YYYY-MM-DD — <Domain> Module v1)` 섹션 추가
- 추가 사항을 요약하는 `memory/YYYY-MM-DD.md` 항목 작성

## 5. 활성 도메인 레지스트리

> **Tier** 분류: `functional` (산업 무관, 방법론/데이터 중심), `industry` (특정 산업 운영 중심), `cross-cutting` (공통 서비스). `docs/_shared/domain-classification-guide.md` 참조.

| 도메인 | Tier | 추가일 | 상태 | 산업 프로필 |
|--------|------|-------|--------|------------------|
| `psm` | functional | pre-2026-06-17 | active | chemical-processing (LNG/LPG/발전 등 covered process 적용) |
| `msds` | functional | 2026-06-17 | active (v1) | chemical-handling |
| `gmp` | industry (pharma) | 2026-06-17 | active (v1) | pharma-general |
| `gdp` | industry (pharma) | 2026-06-17 | active (v1) | pharma-distribution |
| `glp` | industry (pharma) | 2026-06-17 | active (v1) | pharma-laboratory |
| `gcp` | industry (pharma) | 2026-06-17 | active (v1) | clinical-research |
| `gvp` | industry (pharma) | 2026-06-17 | active (v1) | pharmacovigilance |
| `ehsconst` | industry | 2026-06-18 | active (v1) | construction |
| `gasterm` | industry | 2026-06-18 | active (v1) | gas-facility |
| `powergen` | industry | 2026-06-18 | active (v1) | power-generation |
| `ehschem` | industry | 2026-06-18 | active (v1) | chemical-plant (정유/석유화학/정밀화학) |
| `meddevice` | industry | 2026-06-18 | active (v1) | medical-device |
| `training` | functional | 2026-06-19 | active (v1) | training-management |
| `contractor-safety` | functional | 2026-07-03 | active (v1) | TAR/대정비 surge 시나리오 |
| `occupational-health` | functional | 2026-07-03 | active (v1) | TAR/대정비 건강검진 |
| `food` | industry | 2026-08-07 | active | food-gxp |
| `cosmetics` | industry | 2026-08-07 | active | cosmetics-cgmp |
| `semicon` | industry | 2026-08-07 | active | semicon-cleanroom |
| `battery` | industry | 2026-08-07 | active | battery-manufacturing |
| `datacenter` | industry | 2026-08-07 | active | datacenter-infrastructure |
| `logistics` | industry | 2026-08-07 | active | logistics-port |
| `railway` | industry | 2026-08-07 | active | railway-transit |
| `waste` | industry | 2026-08-07 | active | waste-water-environmental |
| `defense` | industry | 2026-08-07 | active | defense-aerospace |
| `biotech` | industry | 2026-08-07 | active | biotech-cdmo |
| `shipbuilding` | industry | 2026-08-07 | active | shipbuilding-heavy |
| `steelmaking` | industry | 2026-08-07 | active | steelmaking-heavy |
| `risk-assessment` | functional | 2026-08-07 | active | 산안법 제36조 위험성평가 (작업안전분석, 위험등록부) |
| `incident-investigation` | functional | 2026-08-07 | active | RCA 방법론 (5-Why, bow-tie, CAPA) |
| `asset-integrity` | functional | 2026-08-07 | active | 설비 무결성 (예방정비, 법정검사) |

## 6. 마이그레이션 참고사항 (기존 도메인 대상)

기존 평면 구조 도메인을 신규 패턴으로 마이그레이션할 때:

1. **PSM 방식 `.md` → 계층형**: YAML 프론트매터를 `schema.yaml`로, 본문은 `README.md`로 분리. `schema.yaml`에 `status: active` 및 `applicability: mandatory` 추가 (감사 요건).
2. **증거 모델**: `evidence-models/<prefix>-*.json`에서 `evidence-models/domains/<tier>/<name>/<prefix>-*.json`로 이동. `$ref` 경로를 `base/X.schema.json`에서 `../../../_shared/base/X.schema.json`로 갱신 (tier 단계만큼 `../` 하나 추가).
3. **에이전트 참조 갱신**: 에이전트 `.md` 파일은 워크플로우 경로를 참조합니다. `workflows/<name>/X.md`에서 `workflows/domains/<tier>/<name>/X/README.md`로 갱신.
4. **스킬 참조 갱신**: 스킬 파일은 에이전트 경로를 참조할 수 있습니다. `agents/X-agent.md`에서 `agents/domains/<tier>/<name>/X-agent.md`(또는 `agents/_shared/X-agent.md`)로 갱신.

## 7. 검증 체크리스트

- [ ] 모든 도메인 파일이 `<top-level>/domains/<tier>/<name>/` 하위에 위치
- [ ] `_shared/`, `_meta/` 언더스코어 접두어 일관적 적용
- [ ] `schema.yaml` 파일에 `legal_basis`, `status: active`, `applicability: mandatory` 포함
- [ ] 증거 모델이 유효한 `$ref` 경로(상대 경로) 보유
- [ ] `bun scripts/safety-audit.ts`가 0건의 오류로 통과
- [ ] 상기 Section 5 레지스트리에 도메인 추가
- [ ] CHANGELOG 및 메모리 로그 갱신
