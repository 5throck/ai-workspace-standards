# co-work Variant Phases

## Domain Workflow

The co-work variant follows a collaboration and documentation-centric workflow:

**Briefing → Planning → Execution → Delivery**

## Phase Definitions

### Phase 0: Team Assembly & Skill Orchestration
**Purpose**: Collaboration project kick-off and team assembly
- Analyze project requirements
- Assign Architect, Docs-writer, Analyst
- Identify required skills (documentation-writing, research-analysis)

### Phase 1: Analysis & Triage
**Purpose**: Literature review and data analysis
- Read-only investigation
- Research synthesis
- Derive requirements and acceptance criteria

### Phase 2: Design
**Purpose**: Design and approve document structure
- Architect: Information architecture + ADR
- Designer: Visual hierarchy (if visual content exists)
- **User approval gate**

### Phase 3: Implementation
**Purpose**: Document writing and delivery
- Docs-writer: Document writing (serial)
- Analyst: Data visualization, charts
- Direct handoffs between agents

### Phase 4: QA Gate
**Purpose**: Quality validation
- Test-runner: Documentation accuracy check
- Auditor: Consistency validation
- Max 2 iterations before PM escalation

### Phase 5: Finalization
**Purpose**: Final delivery
- memlog → sync
- Create PR and handoff

## Specialist Agents

| Phase | Agent | Responsibility |
|-------|-------|----------------|
| Design | architect | Information architecture + ADR |
| Implementation | docs-writer | Document writing, translation |
| Implementation | analyst | Data visualization, research synthesis |
| QA | test-runner | Documentation accuracy check |
