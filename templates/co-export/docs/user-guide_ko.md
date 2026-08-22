# Co-Export 사용자 가이드

**언어**: [English](user-guide.md) · **한국어**

> 이 가이드는 co-export 프로젝트를 *사용하는* 방법 — 무역 컴플라이언스 업무를
> 에이전트 팀에 맡기는 방법, 각 단계에서 무슨 일이 벌어지는지, 산출물이 어디에
> 남는지를 설명합니다. 전체 로스터와 저장소 구조는 [`../README.md`](../README.md),
> 거버넌스 규칙은 [`../AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

1. 요청은 **PM**에게 가져가세요 — PM이 유일한 진입점입니다. 수출 관련 사안을
   일상 언어로 설명하면 됩니다: *"베트남 수출용 신제품 HS 분류해줘"* 또는
   *"계약 전에 이 바이어 명단 제재 스크리닝해줘"* 처럼요.
2. PM이 트리아지 후 Phase 1 리서치를 디스패치합니다 — 최대 6명의 전문가가
   **병렬**로 실행됩니다 (HS 분류, 수출통제, FTA 원산지, 해외 규제 모니터링,
   할랄 인증, 시장 진입).
3. 멀티 에이전트 작업의 경우 PM은 **실행 계획 표**를 보여주고 승인을 기다린 뒤
   디스패치합니다:

   | 작업 | 에이전트 | 티어 | 모델 | 플랫폼 |
   |------|----------|------|------|--------|
   | HS 분류 리서치 | hs-classification-specialist | High | claude-opus-5-0 | Claude Code |
   | FTA 원산지 판정 | fta-origin-analyst | High | claude-opus-5-0 | Claude Code |
   | 무역 서류 준비 | trade-documentation-specialist | Medium | claude-sonnet-5-0 | Claude Code |

4. Phase 2는 **필수 사용자 승인 게이트**입니다: PM이 컴플라이언스 + 전략 결과를
   종합해 제시하며, 승인되지 않은 결과로는 Phase 3 실행 작업이 절대 시작되지
   않습니다 — 고객이 급해도 마찬가지입니다.
5. 승인된 작업은 전략 문서, 무역 서류, 관세 환급 평가로 진행되고, 이어 물류
   조율(Phase 4)이 따릅니다.
6. `/sync`로 마감합니다 — 유일하게 지원되는 커밋 경로이며, pre-commit 훅이 직접
   `git commit` / `git push`를 차단합니다.

> **경험칙**: 컴플라이언스critical 판정(HS 코드, FTA 원산지, 수출통제)은 항상
> 해당 High-tier 전문가에게 — "간단 버전"으로 전문가를 건너뛰지 마세요.
> 오판은 실제 금전·법적 제재 리스크를 수반합니다.

## 2. 어떤 작업인가요?

| 시나리오 | 담당 에이전트 | 관련 스킬 |
|----------|--------------|-----------|
| 품목 분류 / 관세율 평가 | hs-classification-specialist | `hs-classification-workflow` |
| 수출통제 / 제재 스크리닝 | export-control-compliance-specialist | `export-control-screening` |
| FTA 특혜 원산지 | fta-origin-analyst | `fta-origin-determination` |
| 관세 환급 청구 | customs-duty-drawback-specialist | `customs-duty-drawback-workflow` |
| 할랄 시장 진입 | halal-certification-specialist | `halal-certification-workflow` |
| 신규 시장 진입 전략 | market-entry-strategist | `market-entry-strategy` |
| 목적국 규제 모니터링 | foreign-regulatory-intelligence-analyst | `foreign-regulation-monitoring` |
| L/C, 인보이스, 패킹리스트, B/L 준비 | trade-documentation-specialist | `trade-documentation-checklist` |
| Incoterms / 인도 조율 | logistics-coordinator | `logistics-coordination` |

## 3. 표준 다단계 워크플로우

```
PM 트리아지 (Phase 0: 범위)
        │
        ▼
Phase 1 — 병렬 리서치 (분류, 수출통제, FTA,
           해외 규제, 할랄, 시장 진입)
        │
        ▼
Phase 2 — 게이트: PM 결과 종합 ──► 사용자 승인
        │
        ▼
Phase 3 — 전략 문서 + 무역 서류 + 관세 환급
           (게이트 통과 후 병렬; 환급은 선적 단위 재실행)
        │
        ▼
Phase 4 — 물류 조율
        │
        ▼
Phase 5-6 — 감사 게이트 ──► /sync (커밋 + PR)
```

핵심 커맨드 (공통 템플릿에서 상속):

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR
- `/memlog "summary"` / `/new-task "name"` — 세션 로깅 및 태스크 블록
- `/meeting "topic"` — 결과가 충돌할 때 구조화된 다중 에이전트 토론

PM 워크플로우를 우회해 전문가에게 직접 요청하지 말고, 원시 `git commit` /
`git push`도 실행하지 마세요 — 훅이 거부합니다.

## 4. Engagement 단계 구조

| 단계 | 소유자 | 진행 내용 |
|------|--------|-----------|
| 0 — 트리아지 | pm | 범위 + engagement 분류 |
| 1 — 병렬 리서치 | 리서치 전문가 6인 (동시) | 분류, 스크리닝, 원산지, 규제, 인증, 시장 결과 |
| 2 — 컴플라이언스 종합 게이트 | pm → **사용자** | 결과 종합; 실행 전 승인 필수 |
| 3 — 실행 | market-entry-strategist, trade-documentation-specialist, customs-duty-drawback-specialist | 전략 문서, 무역 서류, 환급 평가 (환급은 Phase 1-2의 확정 HS 코드 필요) |
| 4 — 물류 | logistics-coordinator | 인도 / 핸드오프 조율 |
| 5-6 — 마무리 | pm | 감사 → `/sync` → PR |

읽기(리서치, 규제 스캔)는 병렬 실행, **쓰기는 순차 처리** — 특정 파일에는 한 번에
한 에이전트만 기록하며 PM이 조율합니다.

## 5. 산출물 위치

| 산출물 | 위치 |
|--------|------|
| 컴플라이언스·판정 리포트 (HS, 환급, FTA, 할랄, 수출통제) | `deliverables/reports/` |
| 규제 모니터링 브리프 | `deliverables/research/` |
| 전략 문서 (초안 → 최종) | `deliverables/drafts/` → `deliverables/reports/` |
| 무역 서류 템플릿·체크리스트, 물류 계획 | `deliverables/drafts/` |
| 고객 대상 덱 | `deliverables/presentations/` |
| 세션 로그 | `memory/YYYY-MM-DD.md` (`memory/MEMORY.md`가 인덱싱) |

유의할 도메인 규칙:

- 모든 결과는 **본국 관할권 기준**인지 **목적국 기준**인지 명시하고, 관할권 간 충돌을
  조용히 통합하지 않습니다.
- 수출규제 대상자 스크리닝의 성명 정확 일치는 자체 해석할 수 없습니다 — 항상
  해결 절차를 거치고, 부분 일치는 수동/법률 검토 대상으로 플래그합니다.
- 관세 환급은 **반복 서브프로세스**입니다: 선적 단위로 재실행되되 Phase 2 게이트를
  재발생시키지 않습니다 — 단, 승인된 분류를 변경하는 결과라면 예외입니다.
- 규제 모니터링 결과는 출처 표기 + 신선도 검사(전달 기준 30일 내 미확인 출처
  플래그)를 수반합니다.
- 에이전트는 [`co-export.context.md`](co-export.context.md)의 Output Destination
  Mapping 표에 따라 산출물을 저장합니다 — 폴더가 없으면 생성합니다.
