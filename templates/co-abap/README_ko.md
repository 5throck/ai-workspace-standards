---
sync_version: 1
translated_from_hash: 2004d1d0f82c1ae1a66737d2e615fe3e2a539ab551ac50267716adad27e6d6eb
lang: ko
lang_reason: source-material
---

# co-abap

> **언어**: [English](README.md) · **한국어**
> **상태**: ✅ Stable — v1.0.0
> AI 지원 SAP ABAP 개발 하네스 — vsp MCP 서버를 사용한 PM 주도 멀티 에이전트 오케스트레이션. 전문 SAP 모듈 애널리스트(SD, MM, FI, CO, PP, LE), 기술 실행 에이전트 및 자동화된 QA 체인을 포함합니다.

## 개요

**co-abap** 워크스페이스에 오신 것을 환영합니다. 이곳은 여러분의 전담 AI SAP ABAP 개발 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다. 6단계 하네스 라이프사이클(Triage → 비즈니스 분석 → 거버넌스 → 기술 설계 → 구현 → 최종화)을 따라, 6개 SAP 모듈 애널리스트와 기술 에이전트가 협력하여 고품질 ABAP 솔루션을 제공합니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 stable 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

1. 이 변형 템플릿을 복제/스캐폴드합니다
2. `vsp.exe`를 프로젝트 루트에 배치합니다
3. `.env`에 SAP 자격 증명을 구성합니다
4. git hooks 활성화: `git config core.hooksPath .githooks`
5. `/triage <요청>`으로 시작합니다

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 포괄적인 멀티 에이전트 SAP ABAP 개발 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 ABAP 개발 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 비즈니스 요구사항 분석부터 기술 설계, 코드 구현, 품질 검증까지 — 우리는 SAP 모듈 전문가와 기술 에이전트 팀을 통해 엔터프라이즈급 ABAP 솔루션을 제공하는 것을 목표로 합니다.

## AI 팀 소개

여러분의 파트너는 각자 고유한 역할을 가진 전문 에이전트들로 구성됩니다. **Project Manager (PM)**는 단일 진입점으로서 팀의 나머지 인원을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 오케스트레이션, 디스패치, 품질 게이트, 라이프사이클 관리 | high | inherit |
| **sd-analyst** | 판매 및 배포(SD) 모듈 분석 — SD 트리거 키워드에 따라 활성화 | medium | inherit |
| **mm-analyst** | 자재 관리(MM) 모듈 분석 — MM 트리거 키워드에 따라 활성화 | medium | inherit |
| **fi-analyst** | 재무 회계(FI) 모듈 분석 — FI 트리거 키워드에 따라 활성화 | medium | inherit |
| **co-analyst** | 관리 회계(CO) 모듈 분석 — CO 트리거 키워드에 따라 활성화 | medium | inherit |
| **pp-analyst** | 생산 계획(PP) 모듈 분석 — PP 트리거 키워드에 따라 활성화 | medium | inherit |
| **le-analyst** | 물류 실행(LE) 모듈 분석 — LE 트리거 키워드에 따라 활성화 | medium | inherit |
| **architect** | 기술 실행 리드 — 패턴 선택, 실행 시퀀싱, DBA 조율 | high | inherit |
| **code-writer** | WriteSource/EditSource를 통한 ABAP 구현, 구문 검사 | low | inherit |
| **test-runner** | QA 검증 — 단위 테스트, 코드 커버리지, ATC 체크 | low | inherit |
| **dba** | 테이블/CDS/인덱스 설계, SQL 성능 튜닝, ERD 정규화 | medium | inherit |
| **devops-admin** | 전송 관리, 인프라 설치, 시스템 감사 | low | inherit |
| **sap-investigator** | 코드베이스 패턴 스캔, 기존 설계 추출 (읽기 전용) | medium | inherit |
| **read-only-analyst** | 비즈니스 데이터 쿼리, 초안 AC를 포함한 AS-IS 분석 (읽기 전용) | medium | inherit |
| **schema-inspector** | 테이블/CDS 구조 검사, 의존성 맵 (읽기 전용) | medium | inherit |
| **interface-expert** | OData/RFC/IDoc 인터페이스 설계 및 연결 검증 | medium | inherit |
| **fiori-developer** | UI5/Fiori 화면 설계 및 구현 | medium | inherit |
| **form-expert** | SAP Script, Smart Forms, Adobe Forms 설계 및 인쇄 프로그램 | medium | inherit |
| **security-monitor** | 보안 정책 시행 및 안전한 의존성 감사 | low | inherit |
| **gui-scripter** | BDC / VBS 자동화 — BAPI/OData/RFC 대안이 없는 경우 최후 수단 | low | inherit |

## 스킬

- **abap-dev**: BAPI 탐색, 전송 관리, 단위 테스트, 성능 분석, 영향도 아키텍처 분석 및 문서 감사를 포함한 전문화된 SAP ABAP 개발 워크플로.
- **dump-monitor**: ListDumps/GetDump를 사용하여 ABAP short dump를 감지하고 /triage로 라우팅하는 표준화된 SAP 시스템 헬스 체크.
- **performance-tuning**: 느린 ABAP 프로그램 및 비용이 많이 드는 SQL 문 진단을 위한 TraceExecution, ListSQLTraces, GetCallGraph 워크플로.
- **post-write-chain**: 모든 WriteSource/EditSource/Activate 작업 후 강제되는 필수 품질 게이트: SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck.
- **sap-co**: 비용 중심, 내부 주문, CO-PA 수익성 분석, 비용 배분을 위한 CO 모듈 프로세스 플로, 테이블 관계, 쿼리 패턴.
- **sap-fi**: 전표, 계정 결정, G/L, 미수/미지급금, 재무 보고를 위한 FI 모듈 프로세스 플로, 테이블 관계, 표준 BAPI.
- **sap-le**: 출하, 운송, 창고 관리, 인도 처리, 취급 단위를 위한 LE 모듈 프로세스 플로, 테이블 관계, 쿼리 패턴.
- **sap-mm**: 구매, 입고, 자재 마스터, 재고, 조달 대 지불 프로세스를 위한 MM 모듈 프로세스 플로, 테이블 관계, 표준 BAPI.
- **sap-pp**: BOM, 라우팅, 생산 주문, MRP, 작업장 관리를 위한 PP 모듈 프로세스 플로, 테이블 관계, 쿼리 패턴.
- **sap-sd**: 판매 주문, 인도, 청구, 가격 책정, 주문 대 현금 프로세스를 위한 SD 모듈 프로세스 플로, 테이블 관계, 표준 BAPI.
- **desktop-app-fallback**: Claude Code 데스크탑 앱용 수동 Post-Write QA 체인 (후크가 작동하지 않는 경우).
- **source-command-celebrate**: 작업 성공적 완료 시 팀 사기 향상을 위한 축하.

## 협업 방법

우리와의 작업은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 다음은 우리의 표준 워크플로입니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

1. **Triage & 리서치:** PM이 요청을 분류하고 즉시 병렬 리서치를 디스패치합니다(sap-investigator + read-only-analyst + schema-inspector).
2. **비즈니스 분석:** 모듈 애널리스트(SD, MM, FI, CO, PP, LE)가 비즈니스 요구사항과 수용 기준(AC)을 정의합니다.
3. **거버넌스 & 승인:** PM이 PRD/AC를 검토하고 범위를 확정합니다. 고위험 변경 시 사용자 승인이 필요합니다.
4. **기술 설계 & 구현:** 아키텍트가 패턴을 선택하고 실행 계획을 생성한 후, code-writer가 ABAP 코드를 구현합니다.
5. **검증:** test-runner가 필수 QA 체인(SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck)을 실행합니다.
6. **리뷰 & 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.
- `/triage <request>` — 요청 자동 분류 및 태스크 파일 생성.

## 변형 유형

**유형**: abap-development

이 변형은 vsp MCP 서버를 사용한 AI 지원 SAP ABAP 개발에 중점을 둡니다. PM 주도의 멀티 에이전트 오케스트레이션, 6개 SAP 모듈 애널리스트(SD, MM, FI, CO, PP, LE), 기술 실행 에이전트, 자동화된 QA 체인을 포함합니다.

---

*최근 업데이트: 2026-08-15*
