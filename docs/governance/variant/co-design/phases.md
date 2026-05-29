# co-design Variant Phases

## Domain Workflow

co-design variant는 UI/UX 설계 중심의 workflow를 따릅니다:

**Discovery → Ideation → Prototyping → Validation → Implementation**

## Phase Definitions

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: 디자인 프로젝트 kick-off 및 팀 구성
- Project requirements 분석
- Designer, Architect, Test-runner 할당
- 필요한 스킬 확인 (service-design, ui-ux-design-intelligence)

### Phase 1: Analysis & Triage
**Purpose**: 사용자 요구 분석 및 triage
- 사용자 조사 및 데이터 수집
- Service blueprint 작성
- Requirements 및 acceptance criteria 도출

### Phase 2: Design (includes UI/UX)
**Purpose**: 디자인 스펙 작성 및 승인
- Architect: Implementation plan + ADR
- Designer: Wireframes + Component spec
- **User approval gate**

### Phase 3: Implementation
**Purpose**: 디자인 구현
- Code-writer: UI 구현 (serial)
- Designer: Design system integration
- Direct handoffs between agents

### Phase 4: QA Gate
**Purpose**: 품질 검증
- Test-runner: UX testing, visual regression test
- Auditor: Documentation consistency check
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: 최종 전달
- memlog → sync
- PR 생성 및 handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Design | architect | Implementation plan + ADR |
| Design | designer | UI/UX spec, wireframes, component definitions |
| Implementation | code-writer | UI 구현 |
| QA | test-runner | UX testing, visual regression |
