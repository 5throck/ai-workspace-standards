# co-develop Variant Phases

## Domain Workflow

co-develop variant는 소프트웨어 개발 중심의 workflow를 따릅니다:

**Analysis → Architecture → Implementation → Testing → Review**

## Phase Definitions

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: 개발 프로젝트 kick-off 및 팀 구성
- Project requirements 분석
- Architect, Code-writer, Test-runner 할당
- 필요한 스킬 확인 (refactoring, test-driven-development)

### Phase 1: Analysis & Triage
**Purpose**: 기술 요구 분석 및 triage
- Read-only investigation
- Architecture assessment
- Requirements 및 acceptance criteria 도출

### Phase 2: Design
**Purpose**: 설계 스펙 작성 및 승인
- Architect: Implementation plan + ADR
- Designer: UI component spec (if UI surface exists)
- **User approval gate**

### Phase 3: Implementation
**Purpose**: 코드 구현
- Code-writer: 기능 구현 (serial)
- TDD cycle: Red → Green → Refactor
- Direct handoffs between agents

### Phase 4: QA Gate
**Purpose**: 품질 검증
- Test-runner: Unit tests, integration tests
- Auditor: Workspace audit, documentation check
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: 최종 전달
- memlog → sync
- PR 생성 및 handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Design | architect | Implementation plan + ADR |
| Implementation | code-writer | 코드 구현 (TDD) |
| QA | test-runner | Unit tests, integration tests |
| QA | security-monitor | Security review (if needed) |
