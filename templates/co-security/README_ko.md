---
sync_version: 1
translated_from_hash: TBD
---

# {{PROJECT_NAME}}

> **Status**: Beta — v0.2.0

**Co-Security** 워크스페이스에 오신 것을 환영합니다. 이곳은 여러분의 전담 AI 레드팀 및 위협 모델링 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다.

## 1. 팀 미션

**미션:** 종합적인 멀티 에이전트 보안 점검 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 제품 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 여러분이 비전을 제시하는 동안, 우리는 범위 설정, 위협 모델링, 모의 해킹, 패치 단계를 처리하는 것을 목표로 합니다.

## 2. AI 팀 소개

여러분의 파트너는 각자 고유한 역할을 가진 전문 에이전트들로 구성됩니다. **Project Manager (PM)**는 단일 진입점으로서 팀의 나머지 인원을 조율합니다.

| 에이전트 | 역할 및 역량 |
|----------|--------------|
| **PM (Security PM)** | 보안 점검 조율, 승인 게이트 통제, 작업 관리 |
| **Red Team Lead** | 공격 전략 수립, 취약점 공격 총괄 |
| **Pentester** | 실무 모의 해킹, PoC(개념 증명) 개발 |
| **Threat Modeler** | STRIDE/PASTA 분석, 공격 트리 구성 |
| **Patch Engineer** | 조치 스크립트 개발, 앤서블(Ansible) 플레이북 작성 |
| **Report Writer** | 기술 및 요약 보고서 작성, CVSS 점수 산정 |

## 3. 이 팀과의 협업 방법

우리와의 작업은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 다음은 우리의 표준 워크플로입니다:

### A. PM 게이트웨이
항상 **PM**과 대화하여 요청을 시작하세요. 전문 에이전트를 직접 호출하지 마십시오. PM이 요청을 분석하고 적절한 전문가를 투입합니다.

### B. 표준 워크플로 단계
1. **승인 게이트:** PM이 모든 작업 전에 `verify-authorization` 스킬을 실행하여 권한을 확인합니다.
2. **위협 모델링:** **Threat Modeler**가 공격 표면을 분석하고 모델링합니다.
3. **취약점 공격:** **Red Team Lead**와 **Pentester**가 승인된 모의 해킹을 수행합니다.
4. **조치 및 보고:** **Patch Engineer**가 패치를 배포하고 **Report Writer**가 결과를 문서화합니다.
5. **리뷰 및 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 주요 스킬
- **`verify-authorization`** (`skills/verify-authorization/SKILL.md`) — 필수 사전 점검 게이트입니다. Phase 1 이상(정찰, 취약점 공격, 패치) 작업을 진행하기 전에 서명된 승인 문서와 범위 문서가 존재하는지 확인합니다. `security-gate: true`.

### D. 사용 가능한 명령어
우리의 일상 업무는 슬래시 명령어로 진행됩니다 (Claude Code 및 Gemini CLI 스킬로 등록됨):
- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목을 추가합니다.
- `/memlog "summary"` — 오늘 세션 로그에 요약을 추가합니다.
- `/meeting` — 구조화된 인라인 멀티 에이전트 토론을 실행합니다.

### E. 산출물 위치
- `docs/threat-models/` — STRIDE 표, 공격 트리, MITRE ATT&CK 매핑.
- `docs/findings/` — CVSS 점수가 포함된 취약점 발견 티켓 (`FIND-NNNN.md`).
- `docs/reports/` — 모의 해킹 보고서 및 요약 보고서.
- `PATCH_LOG.md` — 적용된 조치 사항의 감사 로그.

작업 중심의 사용 안내(시나리오 → 에이전트 조회, 단계 구조, 산출물 경로)는 [`docs/user-guide_ko.md`](docs/user-guide_ko.md)를 참고하세요.

함께 훌륭한 결과물을 만들어 봅시다!
