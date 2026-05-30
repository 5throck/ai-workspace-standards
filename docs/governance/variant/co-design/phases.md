# co-design Variant Phases

## Domain Workflow

The co-design variant follows a UI/UX design-centric workflow:

**Discovery → Ideation → Prototyping → Validation → Implementation**

## Phase Definitions

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: Design project kick-off and team assembly
- Analyze project requirements
- Assign Designer, Architect, Test-runner
- Identify required skills (service-design, ui-ux-design-intelligence)

### Phase 1: Analysis & Triage
**Purpose**: Analyze user requirements and triage
- User research and data collection
- Create service blueprint
- Derive requirements and acceptance criteria

### Phase 2: Design (includes UI/UX)
**Purpose**: Write and approve design spec
- Architect: Implementation plan + ADR
- Designer: Wireframes + Component spec
- **User approval gate**

### Phase 3: Implementation
**Purpose**: Design implementation
- Code-writer: UI implementation (serial)
- Designer: Design system integration
- Direct handoffs between agents

### Phase 4: QA Gate
**Purpose**: Quality validation
- Test-runner: UX testing, visual regression test
- Auditor: Documentation consistency check
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: Final delivery
- memlog → sync
- Create PR and handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Design | architect | Implementation plan + ADR |
| Design | designer | UI/UX spec, wireframes, component definitions |
| Implementation | code-writer | UI implementation |
| QA | test-runner | UX testing, visual regression |
