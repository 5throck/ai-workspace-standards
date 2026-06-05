# Meeting Transcript

**Date**: 2026-06-05
**Topic**: SCRIPTS.md L0-only 등록 스크립트 점검 및 layer 수정
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Opening)

오늘 회의는 SCRIPTS.md에 L0-only로 등록된 스크립트를 점검하고 적절한 layer로 수정하는 것을 다루겠습니다.

**배경**:
최근 PM Auto-Mode lib/ 파일들을 common으로 변경했습니다. 하지만 다른 스크립트들도 L0-only로 등록되어 있는지 확인이 필요합니다.

**점검 목표**:
1. 현재 L0-only로 등록된 스크립트 식별
2. 각 스크립트의 실제 필요 범위 평가 (workspace-only vs project-common)
3. 적절한 layer 분류 (L0-only, common, L1-only)
4. 잘못 분류된 스크립트 수정

참여자 여러분, 각자의 전문 관점에서 현재 SCRIPTS.md의 layer 분류를 점검해 주십시오.

---

**[Auditor]**: (Round 1)

거버넌스 관점에서 SCRIPTS.md의 layer 분류를 전면 점검했습니다.

**현재 L0-only로 등록된 스크립트**:
```
helpers/: 17개 파일 (lifecycle-governance, template-validation, inject-*, merge-*, substitute-placeholders, update-variant-lifecycle, validate-output, write-scripts-snapshot, beta-lifecycle, generate-variant, validate-platform-parity, integration-helpers, scan-l2-project, reconcile-with-l0-l1, variant-governance-rules)
```

**거버넌스 원칙 검토**:
helpers/ 디렉토리의 스크립트들은 **workspace scaffold 도구**들입니다:
- `new-project.sh/ps1`가 프로젝트 생성 시 사용
- `validate-templates.ts`가 템플릿 구조 검증 시 사용
- `generate-variant.ts`, `update-variant-lifecycle.ts`가 variant 생성/업데이트 시 사용

**문제 발견**:
이 스크립트들은 **workspace root에서만 필요**하고, **새로 생성된 프로젝트(L2)에서는 필요 없습니다**. 하지만 현재 L0-only로 분류되어 있어서 이것은 올바른 분류입니다.

**하지만**:
lib/ 디렉토리의 **encoding-utils.ts, error-handling.ts, pipeline-state.ts** 3개 파일을 확인해보니, 이것들은 **일반적인 유틸리티** 함수들입니다:
- `encoding-utils.ts`: UTF-8 BOM 제거, 문자열 처리
- `error-handling.ts`: 에러 클래스 정의, 로깅
- `pipeline-state.ts`: State 관리, 롤백 액션

이것들은 **모든 프로젝트에서 유용**하게 사용될 수 있는 함수들입니다. 현재 L0-only로 등록되어 있는지 확인이 필요합니다.

automation-engineer, 이 3개 lib 파일의 실제 용도와 전파 필요성을 평가해 주십시오.

---

**[Automation-Engineer]**: (Round 1)

auditor, 정확한 지적입니다. 각 파일의 실제 용도를 분석했습니다.

**encoding-utils.ts (5641 bytes)**:
```typescript
export function removeUtf8Bom(input: string): string
export function ensureUtf8WithoutBom(input: string): string
export function toKoreanEncoding(input: string): string
```
UTF-8 BOM 처리 및 한글 인코딩 관련 유틸리티입니다. **모든 프로젝트에서 필요할 수 있습니다**.

**error-handling.ts (7787 bytes)**:
```typescript
export class CircuitBreakerError extends Error { ... }
export function logError(context: string, error: unknown): void
export function createRetryHandler(maxAttempts: number)
```
에러 처리 클래스와 재시도 핸들러입니다. **모든 프로젝트에서 사용 가능**합니다.

**pipeline-state.ts (8103 bytes)**:
```typescript
interface Checkpoint<T> { ... }
interface RollbackAction { ... }
export function createPipelineState<T>(initialState: T)
export function createRollbackAction(...)
```
State 관리와 체크포인트/롤백 기능입니다. **PM Auto-Mode checkpoint-manager.ts에서 사용**하고 있습니다.

**분류 결론**:
- `encoding-utils.ts`: **common** - 모든 프로젝트에서 UTF-8 처리가 필요할 수 있음
- `error-handling.ts`: **common** - 에러 처리는 어디서나 필요함
- `pipeline-state.ts`: **L0-only** - 현재 PM Auto-Mode에서만 사용, 다른 곳에서는 사용되지 않음

**하지만 중요한 문제**:
`pipeline-state.ts`는 **PM Auto-Mode checkpoint-manager.ts에서 import**하고 있습니다. 만약 checkpoint-manager.ts가 common으로 전파되면, **pipeline-state.ts도 common이 되어야 합니다**.

architect, 이 의존성 관계를 아키텍처 관점에서 어떻게 해결해야 할까요?

---

**[Architect]**: (Round 1)

automation-engineer, 중요한 의존성 문제를 발견했습니다.

**의존성 분석**:
```
checkpoint-manager.ts (common) → pipeline-state.ts (L0-only)
```

이것은 **architecture violation**입니다:
- common 모듈이 L0-only 모듈에 의존
- L2 프로젝트에서 checkpoint-manager.ts를 사용할 수 없음
- Circular dependency 가능성: L0 → L1 → L2 (불불)

**해결 방안 3가지**:

**옵션 A**: 모두 common으로 변경
- `pipeline-state.ts`도 common으로 변경
- 장점: 의존성 문제 해결, 모든 프로젝트에서 State/Checkpoint 기능 사용 가능
- 단점: pipeline-state.ts가 현재 PM Auto-Mode 전용인데, 다른 곳에서는 사용되지 않는 코드가 L1/L2로 전파됨

**옵션 B**: checkpoint-manager.ts를 L0-only로 변경
- `checkpoint-manager.ts`를 L0-only로 되돌림
- 장점: 의존성 문제 해결, 불필요한 전파 방지
- 단점: PM Auto-Mode가 workspace-only 기능이 됨 (우리의 목표와 위배)

**옵션 C**: pipeline-state.ts의 PM Auto-Mode 관련 부분만 분리
- `pipeline-state.ts`를 core(공통) + pm-auto(특수)로 분리
- 장점: 깔끔한 분리, 필요한 부분만 전파
- 단점: 파일 분리 작업이 복잡함

**권고사항**:
**옵션 A**를 권장합니다. 이유는:
1. `pipeline-state.ts`의 State/Checkpoint 기능은 PM Auto-Mode뿐만 아니라, 다른 workflow에서도 유용할 수 있음
2. 향후 다른 agent들이 State 관리를 필요로 할 수 있음
3. 의존성 방향이 L0-only → common으로 가는 것이 자연스러움 (workspace-specific → project-common)

auditor, helpers/ 디렉토리의 layer 분류는 어떻게 생각하십니까?

---

**[Auditor]**: (Round 1)

architect, 의존성 분석이 정확합니다. helpers/ 디렉토리에 대해서도 검토했습니다.

**helpers/ 디렉토리 분석**:
17개 파일 모두 **workspace scaffold 도구**들입니다:
- `validate-templates.ts`, `template-validation.ts`: 템플릿 구조 검증
- `generate-variant.ts`, `update-variant-lifecycle.ts`: variant 생성/관리
- `inject-*`, `merge-*`, `substitute-placeholders`: 템플릿 처리 도구
- `validate-output.ts`, `write-scripts-snapshot.ts`: 출력 관리

**현재 분류**: **L0-only** (정확함)

**검토 결과**:
이 스크립트들은 **workspace에서만 필요**하고 **L2(새 프로젝트)에서는 전혀 필요 없습니다**:
- 새 프로젝트는 이미 생성되어 있는 상태로 시작
- 템플릿 검증은 workspace maintenance를 위해 필요
- variant 생성은 workspace에서만 수행

**결론**:
helpers/ 디렉토리의 **L0-only 분류는 정확**합니다. 수정 불필요.

**추가 점검 사항**:
그 외에 **다른 L0-only 스크립트**가 있는지 확인이 필요합니다:
- `validate-model-registry.ts` (workspace-schema.json 참조) → L0-only ✅
- `l2-to-variant-pipeline.ts` (L2 프로젝트 관리) → L0-only ✅

**요약**:
수정이 필요한 파일들:
1. `lib/encoding-utils.ts` → common (모든 프로젝트에서 UTF-8 처리 필요)
2. `lib/error-handling.ts` → common (에러 처리는 어디서나 필요)
3. `lib/pipeline-state.ts` → common (checkpoint-manager.ts 의존성 해결)

pm, 이것이 수정 범위의 전체입니다. 동의하십니까?

---

**[PM]**: (Round 1)

명확해졌습니다. 수정 범위에 동의합니다.

**수정 대상**:
1. `lib/encoding-utils.ts`: L0-only → **common**
2. `lib/error-handling.ts`: L0-only → **common**
3. `lib/pipeline-state.ts`: L0-only → **common**

**수정 불필요**:
- helpers/ 디렉토리 (17개 파일) - L0-only 정확함 유지
- validate-model-registry.ts - L0-only 정확함 유지
- l2-to-variant-pipeline.ts - L0-only 정확함 유지

**아키텍처 관점**:
architect가 지적한 대로, checkpoint-manager.ts(common) → pipeline-state.ts(L0-only) 의존성은 해결해야 합니다. 옵션 A를 선택하겠습니다.

2라운드에서 구체적인 수정 방법과 검증 사항을 논의하겠습니다.

---

**[Automation-Engineer]**: (Round 2)

구체적인 수정 방법에 대해 제안이 있습니다.

**SCRIPTS.md 수정**:
```
| `lib/encoding-utils.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |
| `lib/error-handling.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
| `lib/pipeline-state.ts` | L0 | 1.1.0 | active | — | — | L0-only | — |
```

↓

```
| `lib/encoding-utils.ts` | L0 | 1.0.0 | active | — | — | common | — |
| `lib/error-handling.ts` | L0 | 1.1.0 | active | — | — | common | — |
| `lib/pipeline-state.ts` | L0 | 1.1.0 | active | — | — | common | — |
```

**기술적 검증 사항**:
1. **의존성 순환 방지**: encoding-utils와 error-handling은 서로 독립적이므로 문제 없음
2. **pipeline-state.ts 의존성**: checkpoint-manager.ts에서만 사용되므로, common으로 변경해도 문제 없음
3. **파일 크기**: 3개 파일 합쳐 21KB 정도로, 전파에 부담 없음

**전파 영향도**:
- 이 파일들이 common으로 변경되면, **L1→L2로 자동 전파**
- 새 프로젝트 5개 variant에 자동 포함
- 기존 safety-os 프로젝트에는 이미 복사 완료

**질문**:
architect, pipeline-state.ts가 common이 되면, 다른 곳에서도 사용될 가능성이 있습니까? 아니면 PM Auto-Mode 전용으로 보는 것이 좋습니까?

---

**[Architect]**: (Round 2)

automation-engineer, 좋은 질문입니다. pipeline-state.ts의 잠재적 사용처를 분석해보겠습니다.

**pipeline-state.ts 현재 사용처**:
1. **checkpoint-manager.ts**: State 저장소, 롤백 액션 정의
2. **그 외**: 현재 다른 곳에서는 사용되지 않음

**잠재적 사용 가능성**:
pipeline-state.ts가 제공하는 기능:
- **Checkpoint<T>**: 상태 저장소 (generic type T)
- **RollbackAction**: 롤백 액션 (실행 취소, 파일 삭제, git revert 등)
- **createPipelineState<T>()**: 파이프라인 상태 생성
- **createRollbackAction()**: 롤백 액션 생성 팩토리

이것들은 **PM Auto-Mode뿐만 아니라**:
- **pipeline execution** 일반적으로 필요할 수 있음
- **multi-phase workflow**에서 체크포인트/롤백이 필요할 수 있음
- **automation-engineer가 복잡한 작업 할 때 중간 상태 저장에 필요할 수 있음

**하지만 현실적으로**:
현재 workspace에서 **이 기능을 사용하는 곳은 PM Auto-Moded뿐입니다. 다른 agent들이 복잡한 stateful 작업을 하지 않습니다.

**권고사항**:
**common으로 변경**하는 것을 권장합니다. 이유:
1. **기능 확장성**: 향후 누군가 State/Checkpoint 기능이 필요할 수 있음
2. **모듈성**: 좋은 유틸리티는 공개될 때 가치가 있음
3. **의존성 단순화**: common → common 의존이 L0-only → common보다 관리하기 쉬움

**단점 관리**:
- 현재로서는 PM Auto-Mode 전용인데, common으로 변경하면 "불규한 전파"가 됨
- 하지만 이것은 **향후 확장성을 고려한 투자**라고 생각합니다.

auditor, 최종 검증과 실행 계획은 어떻게 생각하십니까?

---

**[Auditor]**: (Round 2)

종합 검증을 완료했습니다.

**최종 수정 대상 확인**:
1. ✅ `lib/encoding-utils.ts` → **common** (UTF-8 처리는 모든 프로젝트에서 필요)
2. ✅ `lib/error-handling.ts` → **common** (에러 처리는 범용적 필요)
3. ✅ `lib/pipeline-state.ts` → **common** (checkpoint-manager 의존성 해결 + 향후 확장성)

**거버넌스 검증**:
- ✅ **Circular dependency 없음**: 3개 파일 모두 서로 독립적
- ✅ **의존성 방향 올바름**: checkpoint-manager(common) → pipeline-state(common) (L0 → L1)
- ✅ **전파 영향도 적절**: 3개 파일 합쳐 21KB로 부담 없음
- ✅ **helpers/ 유지**: 17개 파일 모두 workspace scaffold 도구로서 L0-only 정확함

**실행 계획**:
1. SCRIPTS.md 수정 (3개 파일 layer 변경)
2. publish-to-template.ts 실행 (L1으로 전파)
3. 기존 safety-os 프로젝트에 3개 파일 추가 복사
4. audit 실행 (거버넌스 준수 확인)

**기대 효과**:
- encoding-utils와 error-handling는 **진정한 범용 유틸리티**로서 모든 프로젝트에서 활용 가능
- pipeline-state는 **PM Auto-Mode State/Checkpoint 기반**으로서 향후 워크플로우 확장 시 활용 가능

**승인 여부**:
이 수정이 적절하다고 판단합니다. pm, 실행을 승인하십시오.

---

**[PM]**: (Closing)

종합 합의 도출을 완료했습니다.

---

## Synthesis

### Points of Agreement

1. **수정 대상 확정**: 3개 lib 파일의 layer를 L0-only → common으로 변경 필요
   - `lib/encoding-utils.ts`: UTF-8 처리 유틸리티 → 모든 프로젝트에서 필요
   - `lib/error-handling.ts`: 에러 처리 유틸리티 → 범용적으로 필요
   - `lib/pipeline-state.ts`: State/Checkpoint 기능 → checkpoint-manager 의존성 해결 + 향후 확장성

2. **의존성 문제 해결**: checkpoint-manager.ts(common)가 pipeline-state.ts(L0-only)에 의존하는 architecture violation을 common 변경으로 해결

3. **helpers/ 유지 결정**: 17개 helpers/ 파일 모두 workspace scaffold 도구로서 L0-only 분류 유지가 적절함

4. **실행 계획 합의**:
   - SCRIPTS.md 수정
   - L1→L2 전파
   - 기존 프로젝트 업데이트
   - audit 검증

### Open Disagreements or Unresolved Questions

없음. 모든 참여자가 수정 필요성과 방법에 동의함.

### Concrete Next Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-05 | automation-engineer | Low | SCRIPTS.md 수정: lib/encoding-utils.ts, lib/error-handling.ts, lib/pipeline-state.ts를 L0-only → common으로 layer 변경 | L0-only | Phase 4 |
| A-06 | pm | Medium | publish-to-template.ts 실행으로 L1→L2 전파 및 기존 프로젝트 업데이트 | L0-only | Phase 6 |

---

**[PM]**: (Closing Action)

실행 계획을 수립했습니다.

**이번 수정의 영향**:
- **긍정적**: UTF-8 처리와 에러 처리가 모든 프로젝트에서 활용 가능
- **기술적**: PM Auto-Mode 의존성 문제 해결, 향후 워크플로우 확장성 확보
- **거버넌스**: Circular dependency 없는 깔끔한 의존성 구조

**다음 단계**:
A-05와 A-06을 즉시 실행하겠습니다. 동의하십니까?

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-05 | automation-engineer | Low | SCRIPTS.md 수정: lib/encoding-utils.ts, lib/error-handling.ts, lib/pipeline-state.ts를 L0-only → common으로 layer 변경 | L0-only | Phase 4 |
| A-06 | pm | Medium | publish-to-template.ts 실행으로 L1→L2 전파 및 기존 프로젝트 업데이트 | L0-only | Phase 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| A-05 | 3개 lib 파일이 SCRIPTS.md에서 common으로 변경됨 | Manual verification of scripts/SCRIPTS.md |
| A-06 | L1→L2 전파 완료 및 safety-os 프로젝트 업데이트 완료 | Verify templates/common/scripts/lib/ exists and Projects/safety-os/scripts/lib/ contains 3 files |
