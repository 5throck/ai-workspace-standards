> **SSOT**: This file is the authoritative source for workspace-root phase definitions.
> Phase definitions for each variant are in `docs/governance/variant/<variant-name>/phases.md`.
> These files are governance records, NOT scaffold-time copy targets — they are not copied to new projects.

# Workspace Root (Common) Core Phases

## Governance Workflow

The workspace root PM focuses on **cross-platform template maintenance** and orchestrates only the following 3 core phases:

## Core Phases (Workspace Root PM Only)

### Phase 0: Team Assembly
**Purpose**: Team assembly and role definition
- Maintain workspace standards
- Ensure cross-platform compatibility of template scripts
- New project scaffolding

### Phase 2: Design
**Purpose**: Design approval (user approval gate)
- Architect: Template structure design, folder hierarchies
- **User approval required** - confirm before proceeding

### Phase 6: Finalization
**Purpose**: Create PR and memory logging
- Execute memlog → sync pipeline
- Create PR (including Co-Authored-By line)
- Handoff completed work to user

## Phases NOT Orchestrated by Workspace Root PM

- ~~Phase 1 (Triage)~~ → Autonomous analysis team (parallel, no PM)
- ~~Phase 4 (Implementation)~~ → Lead Agent autonomous dispatch
- ~~Phase 5 (QA)~~ → Consistency Auditor independent QA

## Agent Roster (Workspace Root)

| Phase | Group | Agent | Responsibility |
|-------|-------|--------|----------------|
| Triage | Analysis | auditor | Documentation cross-validation, consistency check |
| Design | Design | architect | Template structure design, architectural standards |
| Implementation | Execution | automation-engineer | Cross-platform scripting (.ps1, .sh), tool maintenance |
| Documentation | Execution | docs-writer | Markdown documentation standardization, translations |
| Security | Security | security-expert | Git hooks enforcement, .gitleaks configuration, credential management |
| Setup | Setup | scaffolding-expert | New project scaffolding, template synchronization, UTF-8 enforcement |

## Constraints

- **Mandatory 3-Tier Strategy**: PM strictly uses the 3-tier model when leading execution/improvement tasks
- **High-tier**: Complex reasoning, architectural design, planning, PM orchestration
- **Medium-tier**: Code review, testing, PR review, quality gates (Auditor / Security Expert)
- **Low-tier**: Fast, repetitive coding, script maintenance, strictly scoped execution (Automation Engineer)
- Dispatch independent tasks **in parallel** (single message, multiple Agent calls)
- Maximum **3 fix iterations** per review cycle before user escalation
- Never bypass audit hooks (`--no-verify` forbidden)
- All Git artifacts (commit messages, PR titles, branch names) must be in English
- Ensure all changes align with CONSTITUTION.md standards
