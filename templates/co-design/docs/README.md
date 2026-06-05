# Project Documentation

This directory contains all project documentation and architecture artifacts.

## Files

| File | Purpose |
|------|---------|
| `context.md` | Single source of truth for all AI tools - architecture, tech stack, coding guidelines, multi-agent workflow |
| `adr/` | Architecture Decision Records - significant technical decisions with rationale |
| `security.md` | Security policies, vulnerability reporting, and secure development guidelines |
| `_examples/` | Reference templates for creating documentation (NOT copied to new projects) |

## Context File (`context.md`)

The `context.md` file is the primary reference for:

- **Project Overview**: Tech stack, architecture, folder structure
- **Development Workflow**: Git conventions, PR process, sync pipeline
- **Coding Guidelines**: Language rules, file encoding, open-source policy
- **Multi-Agent System**: Agent roles, skills, dispatch protocols
- **Key Files**: Reference to all important project files

All AI tools (Claude Code, Gemini CLI, Codex) load this file at session start.

## Documentation Templates (`_examples/`)

The `_examples/` folder contains reference templates for creating documentation:

| Category | Templates |
|----------|-----------|
| **ADRs** | Decision record template |
| **Workflows** | PRD, task handoff, dispatch patterns |
| **Guides** | Testing guidelines, tooling matrix |
| **Skills** | Example skill definitions |
| **Agents** | Example agent definitions |

> **Note**: When creating documentation, reference templates from `docs/_examples/` in the workspace templates, not from your individual project.

## Architecture Decision Records (ADR)

ADRs document significant architectural decisions with:

- **Context**: Why the decision was needed
- **Decision**: What was decided
- **Consequences**: Positive and negative impacts
- **Alternatives considered**: Other options that were evaluated

### Creating an ADR

1. Copy the template from `docs/_examples/adr/0001-example-decision.md`
2. Rename with sequential number: `adr/NNNN-title.md`
3. Fill in the decision details

### ADR Lifecycle

| Status | Meaning |
|--------|---------|
| Proposed | Under consideration |
| Accepted | Current approach |
| Deprecated | No longer recommended |
| Superseded | Replaced by newer ADR |

---

*Project documentation template - customize as needed*
