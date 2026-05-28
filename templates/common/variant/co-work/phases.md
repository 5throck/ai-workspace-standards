# co-work Variant Phases

## Domain Workflow

co-work variant는 협업 및 문서 중심의 workflow를 따릅니다:

**Briefing → Planning → Execution → Delivery**

## Phase Definitions

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: 협업 프로젝트 kick-off 및 팀 구성
- Project requirements 분석
- Architect, Docs-writer, Analyst 할당
- 필요한 스킬 확인 (documentation-writing, research-analysis)

### Phase 1: Analysis & Triage
**Purpose**: 문헌 조사 및 데이터 분석
- Read-only investigation
- Research synthesis
- Requirements 및 acceptance criteria 도출

### Phase 2: Design
**Purpose**: 문서 구조 설계 및 승인
- Architect: Information architecture + ADR
- Designer: Visual hierarchy (if visual content exists)
- **User approval gate**

### Phase 3: Implementation
**Purpose**: 문서 작성 및 전달
- Docs-writer: 문서 작성 (serial)
- Analyst: Data visualization, charts
- Direct handoffs between agents

### Phase 4: QA Gate
**Purpose**: 품질 검증
- Test-runner: Documentation accuracy check
- Auditor: Consistency validation
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: 최종 전달
- memlog → sync
- PR 생성 및 handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Design | architect | Information architecture + ADR |
| Implementation | docs-writer | 문서 작성, 번역 |
| Implementation | analyst | Data visualization, research synthesis |
| QA | test-runner | Documentation accuracy check |
