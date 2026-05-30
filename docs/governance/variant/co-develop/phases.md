# co-develop Variant Phases

## Domain Workflow

The co-develop variant follows a software development-centric workflow:

**Analysis → Architecture → Implementation → Testing → Review**

## Phase Definitions

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: Development project kick-off and team assembly
- Analyze project requirements
- Assign Architect, Code-writer, Test-runner
- Identify required skills (refactoring, test-driven-development)

### Phase 1: Analysis & Triage
**Purpose**: Analyze technical requirements and triage
- Read-only investigation
- Architecture assessment
- Derive requirements and acceptance criteria

### Phase 2: Design
**Purpose**: Write and approve design spec
- Architect: Implementation plan + ADR
- Designer: UI component spec (if UI surface exists)
- **User approval gate**

### Phase 3: Implementation
**Purpose**: Code implementation
- Code-writer: Feature implementation (serial)
- TDD cycle: Red → Green → Refactor
- Direct handoffs between agents

### Phase 4: QA Gate
**Purpose**: Quality validation
- Test-runner: Unit tests, integration tests
- Auditor: Workspace audit, documentation check
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: Final delivery
- memlog → sync
- Create PR and handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Design | architect | Implementation plan + ADR |
| Implementation | code-writer | Code implementation (TDD) |
| QA | test-runner | Unit tests, integration tests |
| QA | security-monitor | Security review (if needed) |
