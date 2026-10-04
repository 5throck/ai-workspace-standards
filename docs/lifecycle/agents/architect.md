# Architect Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial architect agent established | lifecycle-manager |
| 2026-09-29 | production | production | Tier-line model-ID literals dropped in agents/architect.md (commit 5b2778b8 — Claude High/Medium tiers → opus-5-5 / sonnet-5-5); record stamped (T-20260930-001) | lifecycle-manager |
| 2026-10-04 | production | production | Instruction-standard pointer reworded to the LLM Interaction Standard (ADR-0098, docs/standards/llm-interaction-standard.md §2), replacing the ADR-0079/AGENTS.md §3.10 wording; record stamped (2026-10-05 daily review, Slot B) | pm |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Design phase specialist
- [x] Tier assignment: High-tier
- [x] Design responsibilities specified: Implementation plans, ADRs, architectural standards
- [x] Template structure design expertise documented
- [x] User approval gate requirement documented
- [x] Successfully validated in design workflows

## Dependencies

- pm (for design dispatch)
- docs-writer (for ADR documentation)

## Domain

**Design Phase Specialist** - Template structure design and architectural standards

**Phases Supported**: 1-2 (Planning & Architecture)

**Key Responsibilities**:
- Implementation plan creation
- Architecture Decision Records (ADRs)
- Template structure design
- Folder hierarchy definition
- Architectural standards enforcement

## Dispatch Protocol

**Can Lead Phases**: [1, 2]
**Can Support In**: [0, 6]
**Tier**: high
**Communication Style**: sync (requires user approval before implementation)

## Design Deliverables

1. **Implementation Plan**: Step-by-step implementation approach
2. **ADR**: Architecture Decision Record with rationale
3. **User Approval Gate**: Must get explicit user approval before Phase 4

## Metadata

- **Current Phase**: production
- **Owner**: architect
- **Last Updated**: 2026-10-04
- **Last Reviewer**: lifecycle-manager
