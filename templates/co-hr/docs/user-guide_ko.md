# Co-HR 사용자 가이드

**언어**: [English](user-guide.md) · **한국어**

> 이 가이드는 co-hr 프로젝트를 *사용하는* 방법 — 에이전트 팀에 engagement 업무를
> 맡기는 방법, 각 단계에서 무슨 일이 벌어지는지, 산출물이 어디에 남는지를 설명합니다.
> 전체 로스터와 저장소 구조는 [`../README_ko.md`](../README_ko.md), 거버넌스 규칙은
> [`../AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

1. 요청은 **PM**에게 가져가세요 — PM이 유일한 진입점입니다. engagement를 일상
   언어(한국어/영어 무관)로 설명하면 됩니다: *"징계해고 절차를 컴플라이언스 관점에서
   검토해줘"* 또는 *"300명 규모 조직의 새 성과관리 제도를 설계해줘"* 처럼요.
2. PM은 요청을 **11개 engagement 아키타입**(§2 참고) 중 하나로 분류하고 해당
   아키타입의 리드 + 지원 에이전트를 배정합니다.
3. 멀티 에이전트 작업의 경우 PM은 먼저 **실행 계획 표**를 보여주고 승인을 기다린
   뒤 디스패치합니다:

   | 작업 | 에이전트 | 티어 | 모델 | 플랫폼 |
   |------|----------|------|------|--------|
   | 법령 리서치 (대상 관할권 노동법) | labor-compliance-analyst | High | claude-opus-5-0 | Claude Code |
   | 인력 데이터 분석 | data-analyst | Medium | claude-sonnet-5-0 | Claude Code |

4. 승인되면 전문가 에이전트가 실행됩니다 — 리서치는 안전한 범위에서 병렬, 쓰기는
   순차 처리됩니다. 법적 노출이 있는 engagement는 설계 착수 전 **컴플라이언스
   교차 검증**(Phase 1.5)을 통과해야 합니다.
5. PM은 `bun scripts/audit.ts`를 실행해 인수 기준 대조로 결과를 검증한 뒤, 최종
   산출물을 **고객 승인**(Phase 2 승인 게이트)에 올립니다.
6. engagement는 `/sync`로 마감합니다 — 유일하게 지원되는 커밋 경로이며, pre-commit
   훅이 직접 `git commit` / `git push`를 차단합니다.

> **경험칙**: 어느 전문가 소관인지 애매하면 PM에게 물어보세요 — PM이 라우팅하며,
> 요청을 조용히 다른 에이전트에게 넘기지 않습니다.

## 2. 어떤 engagement인가요?

| 시나리오 | 리드 에이전트 | 관련 스킬 |
|----------|--------------|-----------|
| 노동법 컴플라이언스 감사 | labor-compliance-analyst | `k-law`(KR 프로필), `hr-metrics-analysis` |
| 노동분쟁 / 노동관계 당국 대응 | labor-relations-specialist | `k-law`(KR 프로필) |
| 산업안전보건 컴플라이언스 | safety-health-officer | `k-law`(KR 프로필), `k-kosis`(KR 프로필) |
| 조직 재설계 / 인력 계획 | org-design-consultant | `org-design-framework`, `org-readiness-assessment` |
| 보상·복지 재설계 | compensation-benefits-analyst | `compensation-benchmarking` |
| 성과관리 제도 설계 | performance-management-consultant | `performance-system-design` |
| 채용 전략 | talent-acquisition-specialist | `talent-acquisition-strategy` |
| 학습·육성 / 역량 구축 | learning-development-specialist | `learning-curriculum-design` |
| 경력·계승 계획 | career-succession-consultant | `career-path-succession-planning` |
| 변화관리 / 문화·롤아웃 | change-management-partner | `stakeholder-alignment`, `org-readiness-assessment` |
| cross-functional HR 트랜스포메이션 | pm (다수 리드 조율) | `consulting-report-writing` + 아키타입 스킬 |

여러 아키타입에 걸친 요청은 순차 처리(한 engagement 완료 후 다음 착수)하거나 PM이
직접 조율합니다 — [`engagement-orchestration.md`](engagement-orchestration.md) 참고.

## 3. 표준 다단계 워크플로우

```
접수 및 아키타입 분류 (PM)
        │
        ▼
진단 및 리서치 (아키타입 리드, 안전한 범위 병렬)
        │
        ▼
컴플라이언스 교차 검증 (Phase 1.5 — 법적 노출 engagement만)
        │
        ▼
설계 ──► 승인 게이트 (고객 승인 없이는 실행 불가)
        │
        ▼
이해관계자 검증 (change-management-partner, 전사 롤아웃)
        │
        ▼
전달 및 롤아웃 ──► 감사 게이트 ──► /sync (커밋 + PR)
```

핵심 커맨드 (공통 템플릿에서 상속):

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR
- `/memlog "summary"` / `/new-task "name"` — 세션 로깅 및 태스크 블록
- `/meeting "topic"` — 결정이 다툼일 때 구조화된 다중 에이전트 토론

PM 워크플로우를 우회해 전문가에게 직접 요청하지 말고, 원시 `git commit` /
`git push`도 실행하지 마세요 — 훅이 거부합니다.

## 4. Engagement 단계 구조

| 단계 | 소유자 | 진행 내용 |
|------|--------|-----------|
| 0 — 접수 및 아키타입 분류 | pm | 요청을 11개 아키타입 중 하나로 분류, 리드 + 지원 배정 |
| 1 — 진단 및 리서치 | 아키타입 리드 | 법령 리서치(활성 국가 프로필에 따름), 인력 데이터(data-analyst), 도메인별 조사 |
| 1.5 — 컴플라이언스 교차 검증 | pm (검증자 디스패치) | labor-compliance-analyst가 법적 노출 서명, data-analyst가 정량 방법론 검증 |
| 2 — 설계 및 승인 게이트 | 아키타입 리드 | 설계/권고안 산출, 실행 전 **고객 승인 필수** |
| 3 — 이해관계자 검증 | change-management-partner | 아키타입과 무관하게 전사 롤아웃에는 항상 참여 |
| 4 — 전달 및 롤아웃 | 아키타입 리드 | 최종 산출물 작성 및 롤아웃 계획 실행 |

읽기(리서치, 데이터 조회)는 병렬 실행 가능, **쓰기는 순차 처리** — 특정 파일에는
한 번에 한 에이전트만 기록하며 PM이 조율합니다.

## 5. 산출물 위치

| 산출물 | 위치 |
|--------|------|
| engagement 문서 및 리포트 | `docs/` |
| 세션 로그 | `memory/YYYY-MM-DD.md` (`memory/MEMORY.md`가 인덱싱) |
| 사용자 대상 변경 이력 | `CHANGELOG.md` → PR |
| 컴플라이언스 검증 | `bun scripts/audit.ts` (`/sync` 전 exit 0 필수) |

유의할 도메인 규칙:

- 법령 주장은 활성 국가 프로필의 관할 법령을 해당 조회 도구(KR 프로필인 경우
  `k-law`)를 통해 인용해야 하고, 인력 통계는 KR 프로필에서 `k-kosis`를 사용합니다.
  핵심 법령군은 활성 국가 프로필(`docs/countries/KR.md`)이 정의합니다.
- 법적 노출 engagement(구조조정, 제도 변경, 해고 인접)는
  labor-compliance-analyst의 서명 없이 Phase 2를 통과할 수 없습니다.
- Phase 2 승인 게이트는 절대 규칙입니다: 일정이 빠듯해도 승인되지 않은 설계의
  실행 작업은 시작하지 않습니다.
- 산출물은 컨설팅 결과물이지 법률 자문이 아닙니다 — 관할권에 구속되는 결론은
  필요시 변호사 검토 대상으로 명시하세요.
