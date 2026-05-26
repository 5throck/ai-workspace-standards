# Meeting Transcript
**Date**: 2026-05-27
**Topic**: (1) Template 폴더 변경사항 점검 및 신규 프로젝트 생성 체계 검토 / (2) 에이전트·스킬 생애주기 관리 체계 점검
**Participants**: pm, architect, scaffolding-expert, automation-engineer, security-expert, docs-writer, auditor
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**[Architect]**: 두 개의 skills 레이어 불일치 지적. `templates/common/skills/`에 lifecycle manager 스킬 존재하나 `C:/git/skills/`에 없음. `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts` 워크스페이스 루트 누락. variant 파라미터가 command를 통해 제대로 전달되는지 확인 요청.

**[Scaffolding-Expert]**: `$ARGUMENTS` 전체가 PROJECT_NAME으로 파싱되는 버그 확인. `--variant` 플래그 command 경유 불가. AGENTS.md를 common으로 올릴 경우 audit false positive 위험 지적.

**[Automation-Engineer]**: `"$@"` 배열에 단일 원소로 파싱되는 쉘 동작 확인. 해결책 A(quote 제거)와 B(command에서 분리 파싱) 제시. `bun` 런타임 의존성 문제 지적.

**[Security-Expert]**: lifecycle audit 스크립트가 어떤 hook에도 연결되지 않음 확인. path traversal 위험 지적. `co-develop/.claude/skills/`의 중복 파일이 보안 정책 override 벡터 가능성 지적.

**[Docs-Writer]**: `co-develop/.claude/skills/skill-lifecycle-manager`와 `common/skills/` 중복으로 common 레이어 설계 원칙 위반. system-reminder에 표시되지만 실제 없는 스킬로 인한 운영 장애 가능성 지적.

**[Auditor]**: audit.sh 커버리지 갭 정리 — skills registry cross-check, template 동기화, 중복 파일, hook 연결 상태 모두 현재 검출 불가. Architect에게 lifecycle manager 누락이 의도적 설계인지 질문.

### Round 2

**[Architect]**: 누락이 버그임 확인. Skills single source of truth = `templates/common/skills/` 제안. audit.sh 확장 제안. command 인자 파싱 개선 제안.

**[Scaffolding-Expert]**: 신규 프로젝트 생성 시 `common/skills/` → `.claude/skills/` 복사 경로 확인. 워크스페이스 루트용 `sync-workspace-skills.sh` 스크립트 필요성 제안.

**[Automation-Engineer]**: audit.sh 체크 bash 구현 제시. skills registry 독립 파일(REGISTRY.json) 도입 제안. PROJECT_NAME validation regex 제시.

**[Security-Expert]**: validation 패턴 승인 + 길이 제한 추가. co-develop 중복 파일 제거 권장. bun 환경 보장 선행 조건 강조.

**[Docs-Writer]**: lifecycle management 사용 안내 문서 부재 지적. AGENTS.md에 "Lifecycle Management" 섹션 추가 제안.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Automation-Engineer | `C:/git/skills/`에 lifecycle manager 스킬 복사 + co-develop 중복 제거 | 즉시 |
| A-02 | Automation-Engineer | new-project.sh/.ps1 PROJECT_NAME validation 추가 | 즉시 |
| A-03 | Automation-Engineer | audit.sh/.ps1 skills registry cross-check 추가 | A-01 완료 후 |
| A-04 | Docs-Writer | AGENTS.md "Lifecycle Management" 섹션 추가 | A-01과 병행 |
| A-05 | Architect + PM | Skills registry 관리 방법 결정 후 설계 지시 | A-03 착수 전 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `C:/git/skills/agent-lifecycle-manager` 및 `skill-lifecycle-manager` 존재 | `ls C:/git/skills/` |
| C-02 | `co-develop/.claude/skills/skill-lifecycle-manager` 제거됨 | 파일 부재 확인 |
| C-03 | PROJECT_NAME에 특수문자 입력 시 new-project.sh가 exit 1 반환 | `bash scripts/new-project.sh "test;rm -rf"` |
| C-04 | audit.sh가 AGENTS.md 등록 스킬 부재 시 FAIL 출력 | 임의 스킬 삭제 후 audit 실행 |
| C-05 | AGENTS.md에 Lifecycle Management 섹션 존재 | grep으로 확인 |
