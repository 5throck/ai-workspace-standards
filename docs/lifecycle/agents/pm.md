# PM (Project Manager) Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial workspace root PM established | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Orchestrates Phases 0, 2, 6 only
- [x] Tier assignment: High-tier (claude-opus-4-7, gemini-3.1-pro)
- [x] Single entry point: All agent dispatch goes through PM
- [x] 3-tier strategy enforcement documented
- [x] Agent roster specified (architect, automation-engineer, etc.)
- [x] Meeting facilitation role defined
- [x] Platform detection logic documented
- [x] Successfully validated in workspace root operations

## Dependencies

- architect (for design validation)
- automation-engineer (for implementation)
- auditor (for QA validation)
- docs-writer (for documentation)
- security-expert (for security review)
- scaffolding-expert (for project setup)

## Domain

**Workspace Root PM** - Cross-platform template maintenance and workspace standards

**Phases Owned**: 0 (Team Assembly), 2 (Design), 6 (Finalization)

**Key Responsibilities**:
- Maintaining cross-platform template scripts
- Defining workspace standards
- Safely scaffolding new projects
- Orchestrating multi-agent workflows
- Enforcing quality gates

## Dispatch Protocol

**Can Lead Phases**: [0, 2, 6]
**Can Support In**: []
**Auto-Dispatch To**: architect, automation-engineer, auditor, docs-writer, security-expert, scaffolding-expert
**Tier**: high
**Communication Style**: sync (PM gates require user confirmation)

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-05-29
- **Last Reviewer**: lifecycle-manager
