# Meeting Transcript
**Date**: 2026-05-27
**Topic**: (1) 스크립트 생애주기 관리 — workspace root 및 template 대상 / (2) context.md 구조화 — 공통 고정 + variant별 분리 운영
**Participants**: pm, architect, automation-engineer, scaffolding-expert, docs-writer, security-expert, auditor
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

### Round 1

**Architect**: SSOT + 전파 방향 명확화를 핵심으로 제시. SCRIPTS.md 매니페스트 도입 (source/version/status 필드). context.md(공통 고정) + variant별 파일 분리 구조 제안. verify-scripts.ts로 drift 자동 감지.

**Automation-Engineer**: SCRIPTS.md 수동 관리 위험 지적. verify-scripts.ts의 --generate(자동 생성) / --verify(drift 감지) 이중 플래그 제안. deprecated 스크립트 경고를 dev-sync.sh에 추가 제안. new-project.sh의 hooks 설치 순서 교정 제안 (git init 직후, 첫 커밋 이전).

**Scaffolding-Expert**: 현재 new-project.sh가 첫 커밋 이후에 hooks를 설치하는 취약점 확인. .gitattributes에 docs/context.md merge=ours 추가 제안. CLAUDE.md에 명시적 읽기 순서 선언 (context.md → variant.context.md) 필요성 주장.

**Docs-Writer**: 파일 명명 일관성 이슈 제기. co-develop.context.md 패턴 제안 (확장자가 계층 관계를 표현). SCRIPTS.md가 개발자 문서 역할도 해야 한다고 주장.

**Security-Expert**: context.md 변경 금지는 보안 통제가 아닌 컨벤션 통제로 분류. pre-commit 경고 + audit.sh 이력 감지 방식 제안. SCRIPTS.md에 removal-date 필드 추가 및 기간 초과 시 hard block 제안.

**Auditor**: verify-skills.ts vs verify-scripts.ts 역할 중복 없음 확인. 두 오픈 이슈 도출: (1) 파일 명명 불일치, (2) SCRIPTS.md 단일 파일 vs 분리 파일.

### Round 2

**Architect**: co-develop.context.md 명명 채택 확정. SCRIPTS.md 이중 섹션 구조 (## Registry + ## Guide) 제안으로 단일 파일 유지하며 역할 분리.

**Automation-Engineer**: 3-레이어 소유권 모델 정립 (L0: templates/common, L1: workspace, L2: project). deprecated 경고 코드 예시 제시. removal-date는 L0에만 적용.

**Scaffolding-Expert**: 마이그레이션 스크립트 필요성 확인. migrate-context.sh는 초안 생성만 (자동 커밋 금지). new-project.sh 개선 코드 경로 제시.

**Docs-Writer**: CONSTITUTION.md 스크립트 관리 섹션 구조 초안 제시 (Ownership Layers 테이블 + Script States + Propagation Rule). verify-context.ts 제안 (*.context.md 존재 + CLAUDE.md 읽기 순서 자동 검증).

**Security-Expert**: L2 프로젝트의 오래된 취약 스크립트 문제 제기. security-advisory 필드 추가 및 hard block 메커니즘 제안. context.md 초기화 예외를 CONTEXT_INIT=1 환경 변수로 처리 제안.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| B-01 | Architect | SCRIPTS.md 초안 설계 (Registry + Guide 이중 섹션, source/version/status/removal-date/security-advisory 필드) | 설계 |
| B-02 | Automation-Engineer | scripts/verify-scripts.ts 구현 (--generate / --verify 플래그, pre-commit 연동) | 구현 |
| B-03 | Architect + Docs-Writer | templates/common/docs/context.md 공통 영역 정의 및 각 variant *.context.md 분리 설계 | 설계 |
| B-04 | Scaffolding-Expert | new-project.sh 수정 — hooks 설치 순서 교정, .gitattributes merge=ours, CLAUDE.md 읽기 순서 선언 | 구현 |
| B-05 | Docs-Writer | CONSTITUTION.md Script Lifecycle Management 섹션 신설 + audit.sh 검사 항목 추가 정의 | 문서화 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | SCRIPTS.md Registry 섹션이 기계 파싱 가능 | verify-scripts.ts --verify 통과 |
| C-02 | 각 variant 폴더에 *.context.md 존재 | audit.sh 검사 항목 추가 후 통과 |
| C-03 | new-project.sh 첫 커밋 시점에 pre-commit 훅 활성화 | 신규 프로젝트 생성 테스트 |
| C-04 | CLAUDE.md에 context.md → variant.context.md 읽기 순서 명시 | 전체 variant CLAUDE.md 검토 |
| C-05 | deprecated 스크립트 removal-date 초과 시 pre-commit hard block | verify-scripts.ts 단위 테스트 |
