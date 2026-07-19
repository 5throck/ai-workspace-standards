---
name: solution-design
scope: co-consult
description: >
  Guides the Solutions Architect through converting business requirements into a
  full technical solution design. Covers requirements decomposition, architecture
  option comparison, trade-off analysis, and implementation roadmap with explicit
  dependency mapping and risk levels. Mandatory output includes dependency map
  and risk register for handoff to delivery-manager.
version: 1.0.0
last_reviewed: 2026-06-13
status: active
owner: solutions-architect
prerequisites: none
---

## Context

Use in Phase 3 after Phase 2 approval. The implementation roadmap produced here must include dependency mapping and risk levels to enable Delivery Manager to build the execution plan directly.

## When to Use

Invoke this skill when Phase 2 has been approved and the Solutions Architect is ready to translate business requirements into a concrete technical design and implementation roadmap.

## Execution Steps

1. **Requirements Decomposition**:
   - Functional requirements (what the solution must do)
   - Non-functional requirements (performance, scalability, security, compliance)
   - Constraints (budget, timeline, existing technology stack, organizational capabilities)
2. **Architecture Options**: Define 2-3 viable technical approaches. For each:
   - High-level architecture description
   - Technology stack / components
   - Integration points with existing systems
   - Pros and cons
3. **Trade-off Analysis**: Compare options on: cost, complexity, time-to-value, risk, maintainability, vendor dependency
4. **Recommended Architecture**: Select and justify the recommended option
5. **Implementation Roadmap**:
   - Phase-by-phase breakdown (each phase: objective, deliverables, duration estimate)
   - **Dependency Map** (mandatory for Delivery Manager):
     - List all task dependencies (what must be complete before each phase starts)
     - External dependencies (vendor contracts, data availability, regulatory approval)
   - **Risk Register** (mandatory for Delivery Manager):
     - Risk, probability (H/M/L), impact (H/M/L), risk level, mitigation action, owner
6. **Handoff Package**: Structured output ready for Delivery Manager to convert to execution plan

## Output Format

- Architecture Decision Record (ADR): Context, Options Considered, Decision, Consequences
- Implementation Roadmap: Phase, Objective, Deliverables, Duration, Dependencies, Owner
- Dependency Map (table or diagram)
- Risk Register: Risk, Probability, Impact, Level, Mitigation, Owner

## Related Skills

- technical-feasibility
- project-delivery
- narrative-framework
