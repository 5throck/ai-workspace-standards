# Reference 워크플로우 패턴 가이드

> **패턴 기원**: 2026-06-17 MSDS 도메인 회의(`memory/meeting-2026-06-17-msds-open-questions-resolution.md` Q1 결의)에 따라 확립.
>
> **최초 적용**: `workflows/domains/functional/msds/chemical-spill-reference/` — 누출 데이터를 제공하고 `emergency-agent`로 dispatch.

---

## 1. 이 패턴을 적용해야 하는 경우

Reference 워크플로우 패턴은 다음의 경우에 적용됩니다:

1. **도메인 A**가 사건과 관련된 중요 **데이터**를 소유
2. **도메인 B**(또는 공통 에이전트)가 대응 **실행**을 소유
3. 도메인 A에 워크플로우를 직접 복제하면 유지보수 부담과 역할 혼란이 발생

### 후보 시나리오

| Reference 워크플로우 | 소스 도메인 | 대상 에이전트 | 비고 |
|-------------------|---------------|--------------|-------|
| `chemical-spill-reference` | MSDS | emergency-agent | 최초 적용 (v1) |
| `chemical-recall-reference` | GMP | emergency-agent | 향후 (v2) |
| `emergency-shutdown-reference` | PSM | emergency-agent | 향후 (v2) |
| `confined-space-entry-reference` | EHS-Mfg | emergency-agent | 향후 (v2) |
| `radiation-spill-reference` | (향후) | emergency-agent | 향후 (v3) |

---

## 2. 패턴 정의

Reference 워크플로우는 다음 특성을 가집니다:

- **유형**: `schema.yaml` 내 `workflow_type: reference`
- **포함 항목**: `target_agent` 필드 (dispatch를 수신하는 에이전트)
- **제공 항목**: `data_provided` 필드에 정의된 데이터 패키지
- **발동**: `handoff_protocol` 필드에 정의된 인계 프로토콜
- **실행하지 않음**: 실제 대응 실행 (대상 에이전트가 수행)

### 스키마 필드 (표준 워크플로우 스키마 확장)

```yaml
schema_version: "1.0"
workflow_id: <name>-reference
title: "<Korean> (<English>)"
status: active
applicability: mandatory

# reference 패턴을 위한 신규 필드
workflow_type: reference            # core | reference | deprecated
target_agent: <agent-name>          # dispatch 목적지
data_provided:                      # 이 워크플로우가 제공하는 데이터
  - <data_item_1>
  - <data_item_2>
handoff_protocol:                   # dispatch 시점과 방법
  trigger: <event-name>
  dispatch_to: <agent-name>
  include_data:
    - <data_field_1>
    - <data_field_2>

# 표준 필드
legal_basis:
  - <source_1>
  - <source_2>
industry_profile: <profile-name>
agent: <source-domain-agent>
evidence_model: <evidence-model>
```

---

## 3. 비교: Core 워크플로우 vs Reference 워크플로우

| 측면 | Core 워크플로우 | Reference 워크플로우 |
|--------|---------------|-------------------|
| 목적 | 완전한 프로세스 실행 | 데이터 제공 + dispatch |
| `workflow_type` | `core` (또는 생략) | `reference` |
| `target_agent` | 필수 아님 | **필수** |
| 실행 | 자체 완결형 | target_agent에 위임 |
| `legal_basis` 요건 | 전체 (도메인 표준에 따라) | 축소 (일반적으로 ≥2) |
| 감사 처리 | 전체 검증 | legal_basis 엄격성에 대한 예외 |

---

## 4. 감사 스크립트 처리

`safety-audit.ts` v2.3.0+는 reference 워크플로우에 대해 축소된 `legal_basis` 요건을 적용합니다:

```typescript
const requiredMin = isReference ? 2 : 3;  // MSDS 예시
```

이는 reference 워크플로우가 `target_agent`의 도메인으로부터 규제 권한을 상속받기 때문입니다. 대상 에이전트가 대응 조치의 규제 준수에 책임을 집니다.

---

## 5. 구현 예시

### `workflows/domains/functional/msds/chemical-spill-reference/schema.yaml`

```yaml
schema_version: "1.0"
workflow_id: chemical-spill-reference
title: "화학물질 누출 참조 (데이터 제공)"
status: active
applicability: mandatory
workflow_type: reference
target_agent: emergency-agent
data_provided:
  - msds_section_6_accidental_release_measures
  - recommended_ppe
  - reporting_authorities
handoff_protocol:
  trigger: chemical_spill_event
  dispatch_to: emergency-agent
  include_data:
    - msds_section_6
    - ghs_classification
legal_basis:
  - OSHA-KR Article 110
  - 위험물안전관리법
industry_profile: chemical-handling
agent: msds-agent
evidence_model: msds-record.json
```

### README.md 구조

Reference 워크플로우의 README는 다음을 명시해야 합니다:

```markdown
# [워크플로우명] Reference 워크플로우

> **WORKFLOW TYPE**: `reference` — 본 워크플로우는 데이터를 제공하고
> 실행을 위해 `target-agent`로 dispatch 합니다. [소스 도메인]은 [활동]을 직접 수행하지 않습니다.

## 1. 목적
[제공되는 데이터, dispatch 대상]

## 2. 적용 범위
[이 워크플로우가 발동되는 조건]

## 3. Reference 워크플로우 패턴
[본 가이드를 참조]

## 4. 워크플로우 단계
### Step 1: 트리거 감지
### Step 2: 데이터 조합
### Step 3: target-agent로 인계
### Step 4: 사후 문서화

## 5. 제공 데이터 (Reference 인터페이스)
[데이터 항목의 구조화된 목록]

## 6. target-agent와의 경계
[역할 분리 매트릭스]

## 7. 법적 고지사항
```

---

## 6. 이점

1. **단일 진실 공급원**: 데이터는 소유 도메인에 보관되며 중복 없음
2. **명확한 역할 경계**: 어떤 에이전트가 무엇을 수행하는지 모호성 없음
3. **유지보수성**: 데이터 형식 변경이 한 곳에서 발생
4. **확장성**: 향후 도메인 추가에 재사용 가능한 패턴
5. **감사 명확성**: reference 워크플로우가 명시적으로 표시되어 컴플라이언스 검토 용이

---

## 7. 피해야 할 안티 패턴

### ❌ 금지: 그림자 실행(shadow execution) 생성
Reference 워크플로우에 실행 단계를 포함해서는 안 됩니다. "Step 4: 누출 통제"를 추가하고 싶다면, 그것은 대상 에이전트의 워크플로우에 속합니다.

### ❌ 금지: 데이터 중복
소스 도메인의 데이터를 대상 에이전트의 기록으로 복사하지 마세요. 대상 에이전트는 evidence_model ID를 통해 소스를 참조합니다.

### ❌ 금지: 인계 프로토콜 생략
명시적인 `handoff_protocol`가 없으면 reference가 고립(orphan)됩니다. 항상 트리거와 dispatch 지시사항을 명시하세요.

### ❌ 금지: 단순 데이터 조회에 사용
워크플로우가 dispatch 없이 데이터만 조회한다면, reference 워크플로우가 아니라 유틸리티 스킬입니다. Reference 워크플로우는 항상 인계(handoff)를 수반합니다.

---

## 8. 도메인 온보딩 통합

신규 도메인을 추가할 때 필요한 reference 워크플로우가 있는지 검토하세요:

- 이 도메인이 사건 중 다른 도메인/에이전트에 필요한 데이터를 소유하는가?
- 이 도메인이 어떤 시나리오에서 `emergency-agent`로 dispatch 해야 하는가?
- 역할 분리가 명확해지는 크로스 도메인 워크플로우가 있는가?

모든 reference 워크플로우는 해당 도메인의 `docs/domains/<name>/scope.md`에 문서화하세요.

---

## 9. 향후 패턴 확장

향후 요구사항에 대한 잠재적 변형:

| 패턴 변형 | 사용 사례 |
|-----------------|----------|
| `workflow_type: notification` | 단방향 통지 (dispatch 없음) |
| `workflow_type: escalation` | 상향 에스컬레이션 (예: PM/CSO로) |
| `workflow_type: aggregation` | 다중 도메인에서 데이터 수집 |

이것들은 v1에 구현되어 있지 않습니다. 필요에 따라 추가하세요.
