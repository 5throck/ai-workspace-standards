# PM (Project Manager) Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial workspace root PM established | lifecycle-manager |
| 2026-05-30 | production | production | Updated Meeting Facilitation section to reflect dual execution modes | antigravity |
| 2026-06-23 | production | production | ADR-0047: Migrated co-work/co-design pm.md to frontmatter-only extends (redundant body cleanup) | lifecycle-manager |
| 2026-06-23 | production | production | ADR-0048: Migrated co-deck pm.md domain orchestration to AGENTS.md §4.2, converted pm.md to frontmatter-only. All 6 variants now follow identical 7-line minimal frontmatter pattern. | lifecycle-manager |
| 2026-09-18 | production | production | v1.2.0: Added Agent Hiring & Firing authority (PM-decided timing, deprecate-default exit, ADR-0061 decision records) and Skill Request Approval (agent-initiated, PM-approved) | pm |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Orchestrates Phases 0, 2, 5, 6 only
- [x] Tier assignment: Medium-tier (claude-sonnet-5-0, gemini-3.8-flash, gpt-5.6-terra)
- [x] Single entry point: All agent dispatch goes through PM
- [x] 3-tier strategy enforcement documented
- [x] Agent roster specified (architect, automation-engineer, etc.)
- [x] Meeting facilitation role defined
- [x] Platform detection logic documented
- [x] Successfully validated in workspace root operations
- [x] ADR-0047: All variant pm.md files are frontmatter-only extends (no redundant body)
- [x] ADR-0048: AGENTS.md is SSOT for all variant workflow orchestration; pm.md is agent identity file only

## Dependencies

- architect (for design validation)
- automation-engineer (for implementation)
- auditor (for QA validation)
- docs-writer (for documentation)
- security-expert (for security review)
- scaffolding-expert (for project setup)
- lifecycle-manager (for governance records and L0→L1 publishing)

## Domain

**Workspace Root PM** - Cross-platform template maintenance and workspace standards

**Phases Owned**: 0 (Team Assembly), 2 (Design), 5 (Lifecycle Finalization)

**Key Responsibilities**:
- Maintaining cross-platform template scripts
- Defining workspace standards
- Safely scaffolding new projects
- Orchestrating multi-agent workflows
- Enforcing quality gates
- Deciding agent hiring/firing (agent-lifecycle-manager)
- Approving agent skill requests (skill-lifecycle-manager)

## Dispatch Protocol

**Can Lead Phases**: [0, 2, 5]
**Can Support In**: []
**Auto-Dispatch To**: architect, automation-engineer, auditor, docs-writer, security-expert, scaffolding-expert
**Tier**: medium
**Communication Style**: sync (PM gates require user confirmation)

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Last Updated**: 2026-09-18 (record refreshed after v1.2.0 hiring/firing + skill request approval rollout; Instruction Writing Duty section landed 2026-09-17)
- **Last Reviewer**: lifecycle-manager

