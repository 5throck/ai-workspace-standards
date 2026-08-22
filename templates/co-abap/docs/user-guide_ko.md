# Co-ABAP 사용자 가이드

**언어**: [English](user-guide.md) · **한국어**

> 이 가이드는 co-abap 프로젝트를 *사용하는* 방법 — SAP 개발 업무를 에이전트 팀에
> 맡기는 방법, 각 단계에서 무슨 일이 벌어지는지, 산출물이 어디에 남는지를 설명합니다.
> 전체 로스터와 저장소 구조는 [`../README.md`](../README.md), 거버넌스 규칙은
> [`../AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

1. `/triage <request>`로 시작하세요 — PM이 요청을 분류하고 태스크 파일을 만든 뒤
   병렬 리서치를 시작합니다. 일상 언어로 기술하면 됩니다: *"영업조직 1000용 신규
> 가격 리포트 추가"* 또는 *"ZPROG_MM_STOCK_UPLOAD 덤프 수정"* 처럼요.
2. 해당 **모듈 애널리스트**(SD / MM / FI / CO / PP / LE)가 비즈니스 요청을 요구사항
   (`deliverables/REQ-NNN-[slug]/01_srs.md`)으로 변환합니다.
3. 멀티 에이전트 작업의 경우 PM은 **실행 계획 표**를 보여주고 승인을 기다린 뒤
   디스패치합니다:

   | 작업 | 에이전트 | 티어 | 모델 | 플랫폼 |
   |------|----------|------|------|--------|
   | 모듈 요구사항 분석 | sd-analyst | Medium | claude-sonnet-5-0 | Claude Code |
   | ABAP 구현 | code-writer | Medium | claude-sonnet-5-0 | Claude Code |
   | QA 체인 | test-runner | Low | claude-haiku-4-5 | Claude Code |

4. 구현은 `code-writer`가 수행하며, 모든 `WriteSource` / `EditSource` 직후에
   **post-write 필수 체인**(`SyntaxCheck → RunUnitTests → GetCodeCoverage →
   RunATCCheck`)이 실행됩니다.
5. QA는 `04_qa_report.md`를 산출하고, `/transport`로 CTS 트랜스포트를 생성/릴리스
   합니다.
6. `/sync`로 마감합니다 — 유일하게 지원되는 커밋 경로이며, 항상 `/transport`
   **이후에** 실행되어 CTS 트랜스포트와 git 커밋이 어긋나지 않습니다.

> **경험칙**: 비즈니스 모듈에 닿는 요청은 모듈 애널리스트에게 먼저, 순수 기술
> 요청(성능, 덤프, 인터페이스)은 해당 기술 전문가에게 바로 갑니다 — 애매하면
> PM에게 물으세요.

## 2. 어떤 작업인가요?

| 시나리오 | 담당 에이전트 | 관련 스킬 |
|----------|--------------|-----------|
| SD / MM / FI / CO / PP / LE 기능 요구사항 | sd/mm/fi/co/pp/le-analyst | `sap-sd` … `sap-le` |
| 신규 또는 변경 ABAP 오브젝트 | architect + code-writer | `abap-dev`, `post-write-chain` |
| 느린 프로그램 / 대용량 테이블 접근 | sap-investigator, dba | `performance-tuning` |
| 런타임 덤프 분석 | sap-investigator | `dump-monitor` |
| OData / RFC / IDoc 인터페이스 | interface-expert | `abap-dev` |
| Fiori / UI5 화면 | fiori-developer | `abap-dev` |
| SAP Script / Smart Forms / Adobe Forms | form-expert | `abap-dev` |
| 테이블 / CDS 설계, SQL 튜닝 | dba + schema-inspector | `abap-dev` |
| 비즈니스 데이터 조회 / AS-IS 분석 | read-only-analyst | — |
| 트랜스포트 관리 / 인프라 | devops-admin | — |

## 3. 표준 다단계 워크플로우

```
/triage (PM 분류, 태스크 파일 생성, 병렬 리서치)
        │
        ▼
비즈니스 분석 (모듈 애널리스트 → 01_srs.md)
        │
        ▼
기술 설계 (architect + dba → 02_technical_design.md)
        │
        ▼
구현 (code-writer — 모든 쓰기 직후 post-write 체인)
        │
        ▼
QA 및 검증 (test-runner → 04_qa_report.md)
        │
        ▼
/transport (CTS 트랜스포트 생성/릴리스)
        │
        ▼
/sync (memlog → changelog → audit → commit → PR)
```

핵심 커맨드:

- `/triage <request>` — 태스크 시작; PM 분류 + 태스크 파일
- `/post-write` — 수동 post-write QA 체인 (Desktop App처럼 훅이 없는 환경 — `desktop-app-fallback` 참고)
- `/transport` — CTS 트랜스포트 생성/릴리스
- `/sync "feat: ..."` — 전체 파이프라인; `/transport` **이후에** 실행, 절대 그 전에 안 됨

워크플로우를 우회해 전문가에게 직접 요청하지 말고, 원시 `git commit` /
`git push`도 실행하지 마세요 — 훅이 거부합니다.

## 4. 요구사항 중심 산출물 구조

모든 요구사항은 고유 번호 디렉토리에서 단계별로 완성됩니다:

| 단계 | 파일 | 소유자 |
|------|------|--------|
| 1 — 요구사항 정의 | `deliverables/REQ-NNN-[slug]/01_srs.md` | 모듈 애널리스트 + PM |
| 2 — 기술 설계 | `deliverables/REQ-NNN-[slug]/02_technical_design.md` | Architect + DBA |
| 3 — 구현 요약 | `deliverables/REQ-NNN-[slug]/03_implementation_report.md` | 전문 개발자 |
| 4 — QA 및 검증 | `deliverables/REQ-NNN-[slug]/04_qa_report.md` | QA 엔지니어 |
| 5 — 릴리스 및 동기화 | transport + `/sync` | PM + DevOps/Admin |

읽기(스키마 조사, 비즈니스 데이터 조회)는 병렬 실행 가능, **쓰기는 순차 처리** —
특정 파일에는 한 번에 한 에이전트만 기록하며 PM이 조율합니다.

## 5. 산출물 위치

| 산출물 | 위치 |
|--------|------|
| 요구사항 산출물 | `deliverables/REQ-NNN-[slug]/` (번호 `01_`–`04_` 파일) |
| 로컬 `.abap` 파일 | `scratch/` — 유일하게 허용된 위치 |
| 세션 로그 | `memory/YYYY-MM-DD.md` (`memory/MEMORY.md`가 인덱싱) |
| 사용자 대상 변경 이력 | `CHANGELOG.md` → PR |
| 최종 문서 감사 | 매 sync 전 `sap:documentation-audit` 스킬 |

유의할 도메인 규칙:

- 네이밍: `ZCL_`(클래스), `ZIF_`(인터페이스), `ZPROG_`(프로그램).
- `WriteSource` **전에 항상** `SyntaxCheck` 실행; 작은 변경에는 `EditSource` 사용.
- post-write 체인은 모든 로직 변경 후 필수입니다 — ATC Priority 1 결과는 배포를
  차단하고, 신규 오브젝트 커버리지 70% 미만이면 ATC 진행이 차단됩니다.
- `/transport`가 `/sync`보다 항상 먼저 — CTS 트랜스포트와 git 이력이 어긋나면
  안 됩니다.
