# Safety OS 입문 튜토리얼

> **대상**: Safety OS를 처음 사용하는 EHS 관리자, 안전보건관리자, 준법 담당자
> **소요 시간**: 약 15분 (읽기 + 실습)
> **필요 사전 지식**: 없음. 한국 EHS/GxP 업무 경험만 있으면 됩니다.

---

## 1. Safety OS란 무엇인가?

Safety OS는 **한국 EHS(환경·안전·보건) 및 GxP 규정 준수를 위한 AI 에이전트 팀**입니다. 혼자서 산업안전보건법(OSHA-KR), 중대재해처벌법(SAPA), 약사법, 화학물질관리법 등 수십 가지 법령을 추적하고 문서화하는 대신, Safety OS의 AI 에이전트들이 여러분의 상황을 분석하고, 적용 가능한 법령 조항을 식별하며, 적절한 업무 절차(워크플로)를 실행합니다.

Safety OS의 작동 방식은 간단합니다. 여러분이 현재 상황을 설명하면, PM 에이전트(CSO, 최고안전책임자 역할)가 요청을 분류하고, 담당 전문 에이전트를 파견합니다. 전문 에이전트는 규정에 따른 워크플로를 실행하고 **증거 기록(evidence record)**을 JSON 형식으로 생성합니다. 이 증거 기록은 감사 추적(audit trail)의 기초 문서가 됩니다. 여러분이 법령을 암기하거나 양식을 수작업으로 채울 필요가 없습니다.

---

## 2. 시작 전 알아야 할 에이전트 팀 구성

Safety OS는 계층 구조로 이루어진 에이전트 팀입니다. 사용자는 항상 **PM 에이전트(CSO)**에게 요청을 보냅니다. 직접 전문 에이전트를 호출하는 것은 지원되지 않습니다.

### 에이전트 역할 요약

| 에이전트 | 역할 | 무엇을 생산하는가 |
|----------|------|-------------------|
| **PM (CSO)** | 조정자. 모든 요청의 창구. 법적 근거 확인 후 전문 에이전트 파견 | 실행 계획 테이블, 감사 로그 |
| **psm-agent** | 공정안전관리(PSM) 전문가. PHA, MOC, PSSR, PSI, MI, SOP, LOTO 실행 | `psm-moc-record.json`, `psm-pssr-record.json`, `psm-loto-record.json` |
| **msds-agent** | 화학물질 데이터 및 GHS 분류 전문가 | `msds-record.json`, `ghs-classification-record.json` |
| **training-agent** | 안전교육 관리 (산안법 제29조(특별교육=③)/제31조 건설기초/제32조 직무교육) | `training-record.json` |
| **ehschem-agent** | 화학공장 운영 코디네이터. psm·msds·emergency 파견 | `ehschem-plant-safety-record.json` |
| **ehsconst-agent** | 건설현장 운영 코디네이터. 추락 위험, 작업허가서, TBM 관리 | `ehsconst-inspection-record.json` |
| **gasterm-agent** | 가스터미널·충전소 코디네이터 | `gasterm-operation-record.json` |
| **powergen-agent** | 발전설비 코디네이터 | `powergen-operation-record.json` |
| **gmp/gdp/glp/gcp/gvp-agent** | 제약 GxP 단계별 전문 에이전트 | 단계별 GxP 기록 |
| **meddevice-agent** | 의료기기 코디네이터 (ISO 13485, ISO 14971) | `meddevice-record.json` |
| **food-agent** | 식품안전 및 HACCP CCP 모니터링 전문가 | `haccp-ccp-record.json`, `food-allergen-record.json` |
| **cosmetics-agent** | 화장품 CGMP 및 ISO 22716 안전 전문가 | `cgmp-batch-record.json`, `cosmetics-stability-record.json` |
| **semicon-agent** | 반도체 클린룸 EHS 및 특수가스 전문가 | `semicon-special-gas-record.json`, `semicon-scrubber-record.json` |
| **battery-agent** | 이차전지 열폭주 방지 및 폐배터리 리사이클링 전문가 | `battery-thermal-runaway-record.json`, `battery-recycling-record.json` |
| **shipbuilding-agent** | 조선 선박 탱크 밀폐공간 및 골리앗 크레인 전문가 | `ship-confined-space-record.json`, `heavy-crane-record.json` |
| **steelmaking-agent** | 철강 용광로 LOTO 및 부생가스 전문가 | `steel-molten-metal-loto-record.json`, `steel-byproduct-gas-record.json` |
| **datacenter-agent** | 데이터센터 UPS 화재 및 고전압 수전설비 전문가 | `datacenter-ups-fire-record.json`, `datacenter-fuel-tank-record.json` |
| **logistics-agent** | 항만 물류 크레인 인양, AGV 및 냉동창고 전문가 | `port-crane-agv-record.json`, `cold-storage-refrigerant-record.json` |
| **railway-agent** | 철도 25kV 전차선 고전압 감전 및 선로 정비 전문가 | `catenary-high-voltage-record.json`, `rail-track-confined-record.json` |
| **waste-agent** | 폐기물/하수조 황화수소 질식 및 소각 파쇄기 LOTO 전문가 | `sewage-confined-h2s-record.json`, `incinerator-shredder-loto-record.json` |
| **defense-agent** | 방산 화약 추진제 ESD 및 유도무기 극저온가스 전문가 | `explosive-propellant-record.json`, `missile-cryogenic-record.json` |
| **biotech-agent** | 바이오 CDMO Bioreactor SIP 멸균 및 LMO 유해인자 전문가 | `bioreactor-sterilization-record.json`, `lmo-biohazard-record.json` |
| **emergency-agent** | 비상 대응 (모든 도메인에서 파견 가능) | `emergency-response-record.json` |

### 핵심 원칙

```
사용자 → PM (CSO) → 산업 도메인 에이전트 (코디네이터)
                         └→ 기능 도메인 에이전트 (서비스 제공자)
                         └→ emergency-agent (비상 발생 시)
```

---

## 3. 첫 번째 과제: 5분 빠른 시작

### 상황 설정

> "저는 화학공장의 EHS 관리자입니다. 커버드 공정 구역에 새로운 펌프를 설치하고 있습니다. 변경관리(Management of Change, MOC)를 안전하게 처리해야 합니다."

이 상황은 **산업안전보건법 제44조** (공정안전 보고서 제출 대상 사업장)에 따라 PSM 변경관리 워크플로가 필요합니다. 아래 단계를 따라 Safety OS와 대화해 보세요.

---

### 단계 1 — PM 에이전트에게 상황 설명

**여러분이 입력하는 내용:**
```
커버드 공정 구역에 새 펌프를 설치하려고 합니다.
PSM MOC 절차를 시작해 주세요. 대상 공정: 황산 이송 라인 (산업안전보건법 제44조 적용 사업장).
```

**PM (CSO) 응답 예시:**
```
[PM — CSO] 요청을 수신했습니다.

법적 근거 확인:
- 산업안전보건법 제44조 (공정안전보고서 제출 의무)
- OSHA-KR 시행규칙 별표 13 (PSM 요소: 변경관리)
- 중대재해처벌법 제4조 (안전보건관리체계 의무)

분류: Tier 2 화학공장 (ehschem) + Tier 1 PSM 서비스 파견 필요

실행 계획:
1. ehschem-agent (코디네이터) → 공장 컨텍스트 설정
2. psm-agent (서비스) → MOC 워크플로 실행
3. 증거 기록 생성 → psm-moc-record.json

ehschem-agent를 파견합니다...
```

---

### 단계 2 — 산업 코디네이터가 컨텍스트를 설정

**ehschem-agent 응답 예시:**
```
[ehschem-agent] 화학공장 컨텍스트 확인.

공장 유형: 정밀화학 / 커버드 공정 포함
PSM 의무: 예 (psm_applicable: true)
대상 공정: 황산 이송 라인
변경 유형: 신규 장비 설치 (펌프)

psm-agent에 MOC 워크플로를 파견합니다.
```

---

### 단계 3 — PSM 에이전트가 MOC를 실행

**psm-agent 응답 예시:**
```
[psm-agent] MOC 워크플로를 시작합니다.

변경 정보 수집:
  변경 번호: MOC-2026-047
  변경 유형: 장비 교체/신규 설치
  영향 공정: 황산 이송 라인 (P&ID Rev. 12 기준)
  예상 위험: 황산 누출, 전기 아크, 밀폐공간 인접

위험성 평가:
  PHA 방법: HAZOP (What-If 병행)
  식별된 위험:
    - 펌프 씰 파손 → 황산 누출 (심각도: 높음, 빈도: 낮음)
    - 배관 연결 불량 → 압력 이상 (심각도: 중간, 빈도: 낮음)

안전 조치:
  - 이중 씰 펌프 사양 지정 필수
  - 설치 전 PSI (공정안전 정보) 업데이트
  - PSSR (사전 안전 검토) 실시 후 가동 승인
  - 관련 SOP 개정 및 근로자 교육

증거 기록 생성 중...
```

---

### 단계 4 — 생성된 증거 기록 확인

**여러분이 입력하는 내용:**
```
증거 기록을 보여주세요.
```

**psm-agent가 생성하는 psm-moc-record.json 예시** (`evidence-models/domains/functional/psm/psm-moc-record.json` v1.0.0 기준):
```json
{
  "version": "1.0.0",
  "record_id": "PSM-MOC-2026-0047",
  "change_id": "MOC-2026-047",
  "title": "황산 이송 라인 — 신규 펌프 설치",
  "description": "HAZOP에서 확인된 씰 파손 누출 위험에 대응하기 위해, P&ID Rev. 12 기준 황산 이송 라인의 기존 단일 씰 펌프를 이중 씰 펌프로 교체.",
  "change_type": "permanent",
  "classification": "major",
  "status": "under_review",
  "legal_basis": [
    "산업안전보건법 Article 44 (공정안전관리 — 변경관리)",
    "산업안전보건법 Article 38 (작업 전 안전조치)",
    "안전보건기준에관한규칙 Article 92 (정비 등 작업 시 운전정지 등)"
  ],
  "timestamp": "2026-06-20T09:32:15+09:00",
  "agent_id": "psm-agent",
  "workflow_id": "psm/moc-process",
  "hazard_review": {
    "assessment_type": "HAZOP",
    "findings": [
      "펌프 씰 파손 -> 황산 누출 (심각도: HIGH, 빈도: LOW); 이중 씰 펌프 사양 + 누출 감지기로 완화",
      "배관 연결 불량 -> 압력 이상 (심각도: MEDIUM, 빈도: LOW)"
    ],
    "completed_by": "PSM 팀장",
    "completion_date": "2026-06-25T00:00:00+09:00"
  },
  "approval_chain": [
    { "role": "공정 엔지니어", "approver_id": "eng-042", "approval_date": "2026-06-26T00:00:00+09:00", "decision": "approved", "comments": "PSI 업데이트 완료; PSSR로 진행." },
    { "role": "안전관리자", "approver_id": "safety-mgr-01", "approval_date": "2026-06-27T00:00:00+09:00", "decision": "pending", "comments": "PSSR 완료 후 서명 예정." }
  ]
}
```

이 JSON 파일 하나가 MOC의 전 과정을 추적하는 감사 증거 기록입니다. `psm-moc-record.json`은 다른 증거 모델 대부분이 사용하는 공통 `e_signature`/`nomenclature`/`audit_trail` `$ref` 블록을 사용하지 않는다는 점에 유의하세요 — 이 스키마의 출처 추적은 `timestamp`/`agent_id`/`workflow_id`로, 승인 이력은 `approval_chain`으로 관리됩니다.

---

## 4. 내 상황에 맞는 도메인 선택하기

요청하기 전에 어떤 에이전트에게 가야 할지 아래 의사결정 흐름도를 참고하세요. (항상 PM이 최종 조정합니다만, 사전 이해가 있으면 빠른 대화가 가능합니다.)

```
[나는 어디에서 일하는가?]
        |
        |-- 제약/바이오 산업 ---→ [어떤 단계인가?]
        |                              |-- 제조 품질 ---→ gmp-agent
        |                              |-- 유통 관리 ---→ gdp-agent
        |                              |-- 비임상 시험 ---→ glp-agent
        |                              |-- 임상 시험 ---→ gcp-agent
        |                              └-- 시판 후 감시 ---→ gvp-agent
        |
        |-- 화학공장 (정유·석유화학·정밀화학)
        |           └→ ehschem-agent (코디네이터)
        |               ├── PSM 의무 공정 포함 시 → psm-agent 협업
        |               └── 신규 화학물질 취급 시 → msds-agent 협업
        |
        |-- 건설현장
        |           └→ ehsconst-agent (코디네이터)
        |               └── 중대재해 발생 시 → emergency-agent 즉시 파견
        |
        |-- 가스터미널·LNG·LPG·수소 충전소
        |           └→ gasterm-agent (코디네이터)
        |               └── 대규모 시설(PSM 의무) 시 → psm-agent 협업
        |
        |-- 발전소 (LNG 화력·신재생 등, 원자력 제외)
        |           └→ powergen-agent (코디네이터)
        |
        |-- 의료기기 제조·수입
        |           └→ meddevice-agent (코디네이터)
        |
        |-- 화학물질 데이터만 필요 (어느 산업이든)
        |           └→ msds-agent (기능 도메인, 직접 가능)
        |
        |-- 안전교육 관리 (어느 산업이든)
        |           └→ training-agent (기능 도메인, 직접 가능)
        |
        └-- 비상 상황 발생!
                    └→ PM에게 즉시 알리면 emergency-agent 자동 파견
```

### 빠른 참조 표

| 내 상황 | 말해야 할 것 | PM이 파견하는 에이전트 |
|---------|--------------|------------------------|
| 화학공장 PSM MOC | "커버드 공정 변경관리 필요" | ehschem → psm |
| 화학물질 신규 도입 | "신규 화학물질 MSDS 접수" | ehschem → msds |
| 건설현장 TBM | "오늘 TBM 진행" | ehsconst |
| 추락 위험 작업 | "고소 작업 허가서 발행" | ehsconst |
| 임상시험 부작용 보고 | "중증 이상반응(SAE) 발생" | gcp → emergency |
| 의약품 콜드체인 이탈 | "온도 이탈 확인 필요" | gdp |
| LNG 터미널 일상 점검 | "가스 저장탱크 정기 점검" | gasterm (→ psm if 대규모) |
| 발전소 정기 안전 점검 | "발전설비 정기 안전 점검" | powergen |
| 안전교육 계획 수립 | "연간 안전교육 일정 수립" | training |

---

## 5. 증거 기록 읽는 법

앞서 생성된 `psm-moc-record.json`을 예시로, 각 섹션이 감사에서 어떤 역할을 하는지 설명합니다.

### 핵심 필드 해설

| 필드 | 역할 | 감사 시 확인 사항 |
|------|------|-------------------|
| `record_id` | 고유 식별자 (`PSM-MOC-YYYY-NNNN`). 다른 기록과 교차 참조 시 사용 | 번호가 연속적으로 관리되는지 |
| `version` | 증거 모델 스키마 버전 | 현재 활성화된 `psm-moc-record.json` 스키마와 일치하는지 |
| `legal_basis` | 적용 법령 조항. **최소 3개 이상** 필수 | 감사관이 가장 먼저 확인하는 항목 |
| `title` / `description` / `change_type` / `classification` | 변경 내용, 기간 구분, 위험 등급 | ALCOA+ 귀속성(Attributable)·동시성(Contemporaneous) 증거 |
| `hazard_review` | HAZOP/PHA 결과: `assessment_type`, `findings[]`, `completed_by`, `completion_date` | 위험성 평가가 실질적으로 이루어졌는지 |
| `approval_chain` | 순차 승인 이력: `role`, `approver_id`, `approval_date`, `decision`, `comments` | 이행 전 필요한 승인자 전원이 서명했는지 |
| `timestamp` / `agent_id` / `workflow_id` | 기록 출처 — 생성 시각, 생성 에이전트, 워크플로 실행 ID | 원 워크플로 실행까지 추적 가능한지 |

### ALCOA+ 원칙이란?

Safety OS의 모든 증거 기록은 **ALCOA+** 데이터 무결성 원칙을 따릅니다.

| 원칙 | 영어 | 의미 |
|------|------|------|
| **A** | Attributable | 누가 했는지 특정 가능 |
| **L** | Legible | 읽을 수 있고 영구 보존 가능 |
| **C** | Contemporaneous | 행위 시점에 기록 |
| **O** | Original | 최초 기록 (사본 아님) |
| **A** | Accurate | 오류 없음 |
| **+C** | Complete | 완전한 기록 |
| **+C** | Consistent | 타 기록과 일관성 |
| **+E** | Enduring | 규정 보존 기간 준수 |
| **+A** | Available | 필요 시 즉시 접근 가능 |

---

## 6. 흔히 하는 실수 5가지

### 실수 1 — PM을 건너뛰고 전문 에이전트를 직접 호출하려는 경우

Safety OS의 모든 요청은 **PM (CSO)을 통해야 합니다**. psm-agent, msds-agent 등을 직접 호출하는 것은 지원되지 않습니다. 이유는 간단합니다 — PM이 법적 근거(`legal_basis`)를 확인하고 다중 도메인 조정이 필요한지 판단한 후에야 올바른 에이전트가 파견되기 때문입니다. PM을 건너뛰면 법적 근거 없는 증거 기록이 생성될 수 있습니다.

**올바른 방법:**
```
✗ psm-agent에게 "MOC 시작해줘"
✓ PM에게 "커버드 공정에 새 펌프를 설치합니다. PSM MOC 절차 시작해 주세요."
```

### 실수 2 — PSM 교육과 일반 안전교육을 혼동하는 경우

PSM에는 **12대 요소**가 있으며, 그 중 **요소 4가 교육 훈련**입니다. 이것은 PSM 워크플로 내의 교육 기록으로, `training` 도메인과는 다릅니다.

| 구분 | 어디에서 처리하는가 | 근거 법령 |
|------|---------------------|-----------|
| PSM 교육 훈련 (요소 4) | psm-agent 내부 | 산업안전보건법 시행규칙 별표 13 |
| 일반 안전보건 교육 | training-agent | 산업안전보건법 제29조(특별교육=제29조③)/제31조(건설 기초)/제32조(직무교육) |
| 신규 화학물질 교육 통보 | msds-agent → occupational-health | 산업안전보건법 제114조 |

### 실수 3 — 증거 기록을 공식 신고서로 오해하는 경우

Safety OS가 생성하는 JSON 증거 기록은 **워크플로 실행 기록**입니다. 이것은 공정안전보고서(PSR), 화학물질 영향조사서, MFDS 보고서 등 **공식 행정 서류를 대체하지 않습니다.**

증거 기록의 용도:
- 내부 감사 추적 (audit trail)
- 규정 준수 문서화 근거 자료
- 업무 절차 이행 증명

공식 서류 제출은 담당자가 별도로 해야 합니다. Safety OS는 그 준비를 돕는 도구입니다.

### 실수 4 — PSM 의무 대상 여부를 모르고 일반 안전 점검으로만 처리하는 경우

커버드 공정(covered process)이 있는 사업장은 산업안전보건법 제44조에 따라 PSM 의무 대상입니다. 화학공장뿐 아니라 **대규모 LNG 터미널, LPG 기지, 대규모 LNG 화력발전소**도 PSM 의무 대상일 수 있습니다. 사업장이 어느 산업 도메인에 속하든, PSM 의무 여부를 PM에게 먼저 확인하세요.

```
PM에게: "저희 시설이 PSM 의무 대상인지 확인해 주세요.
         LNG 터미널 운영 중이며, 저장 용량은 __톤입니다."
```

### 실수 5 — 비상 상황에서 정상 워크플로를 시도하는 경우

화재, 화학물질 누출, 폭발, 중대재해 발생 시에는 **일반 워크플로를 시작하지 마세요.** 즉시 PM에게 비상 상황임을 알리면 `emergency-agent`가 바로 파견됩니다.

```
✗ "화학물질 누출 MSDS 확인해 주세요" (일반 워크플로)
✓ "긴급 상황: 황산 누출 발생. 즉시 대응 필요." → emergency-agent 즉시 파견
```

---

## 7. 다음 단계

튜토리얼을 완료하셨습니다. 이제 아래 자료로 심화 학습을 이어가세요.

### 추가 문서

| 문서 | 내용 | 링크 |
|------|------|------|
| **사용자 시나리오 가이드** | 5가지 실전 시나리오 (신규 화학물질 도입, SAE 보고, 건설현장 일일 안전, 의약품 콜드체인, 화학공장 정비보수) 상세 단계별 설명 | [user-scenarios.md](user-scenarios.md) |
| **도메인 분류 가이드** | 3-Tier 도메인 구조, 다중 도메인 dispatch 규칙, PSM 적용 시나리오 | [domain-classification-guide.md](domain-classification-guide.md) |
| **사용자 가이드** | 도메인 선택 기준, ALCOA+ 증거 기록 구조, 참조 워크플로 목록 | [user-guide.md](user-guide.md) |

### 실습 권장 순서

1. **이 튜토리얼의 빠른 시작 (§3)** → PM에게 MOC 요청해 보기
2. **[user-scenarios.md](user-scenarios.md) 시나리오 1** → 신규 화학물질 도입 (MSDS + PSM 협업)
3. **[user-scenarios.md](user-scenarios.md) 시나리오 3** → 건설현장 일일 안전 (ehsconst 일상 워크플로)
4. 본인 업무와 가장 가까운 시나리오로 연습

### 법적 고지사항

> **규제 해석은 사용자의 책임입니다. 이 시스템은 워크플로 자동화 보조 도구이며, 법적 자문을 제공하지 않습니다.**
>
> Safety OS가 참조하는 산업안전보건법, 중대재해처벌법, 약사법, 화학물질관리법 등의 조항은 워크플로 문서화 목적으로만 사용됩니다. 모든 규제 참조의 정확성과 적용 가능성은 자격을 갖춘 법률 전문가 또는 EHS 전문가에 의해 운영 사용 전에 반드시 검증되어야 합니다. 이 시스템의 AI 에이전트는 법적 의견을 제공하지 않습니다.

---

*Last Updated: 2026-08-27*
