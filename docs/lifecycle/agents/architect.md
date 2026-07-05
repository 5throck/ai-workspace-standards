# Architect Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial architect agent established | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Design phase specialist
- [x] Tier assignment: High-tier (claude-opus-4-7)
- [x] Design responsibilities specified: Implementation plans, ADRs, architectural standards
- [x] Template structure design expertise documented
- [x] User approval gate requirement documented
- [x] Successfully validated in design workflows

## Dependencies

- pm (for design dispatch)
- docs-writer (for ADR documentation)

## Domain

**Design Phase Specialist** - Template structure design and architectural standards

**Phases Supported**: 2 (Design)

**Key Responsibilities**:
- Implementation plan creation
- Architecture Decision Records (ADRs)
- Template structure design
- Folder hierarchy definition
- Architectural standards enforcement

## Dispatch Protocol

**Can Lead Phases**: [2]
**Can Support In**: [0, 6]
**Tier**: medium
**Communication Style**: sync (requires user approval before implementation)

## Design Deliverables

1. **Implementation Plan**: Step-by-step implementation approach
2. **ADR**: Architecture Decision Record with rationale
3. **User Approval Gate**: Must get explicit user approval before Phase 4

## Metadata

- **Current Phase**: production
- **Owner**: architect
- **Last Updated**: 2026-05-29
- **Last Reviewer**: lifecycle-manager
