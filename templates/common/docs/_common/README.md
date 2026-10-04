# Project Documentation

This directory contains all project documentation and architecture artifacts.

## Files

| File | Purpose |
|------|---------|
| `context.md` | Single source of truth for all AI tools - architecture, tech stack, coding guidelines, multi-agent workflow |
| `adr/` | Architecture Decision Records - significant technical decisions with rationale |
| `security.md` | Security policies, vulnerability reporting, and secure development guidelines |
| `_examples/` | Reference templates for creating documentation (NOT copied to new projects) |

## Folder Manifest & Creation Criteria

This manifest governs the `docs/` tree (mirrors the workspace-root `docs/README.md`
convention, ADR-0098-adjacent docs governance). Default homes — place content here
before creating any new folder:

| Content | Home |
|---------|------|
| Significant technical decision | `adr/NNNN-title.md` |
| Security policies & reporting | `security.md` |
| Variant-specific operating procedures | `procedures/`, `workflows/`, `regulations/` (variant-declared) |
| Engagement findings & checklists | `findings/`, `reports/` (variant-declared) |
| Spec / schema seeds | `specs/` |
| Superseded or dead content | delete, or move under an `archive/` folder when provenance matters |

**Creating a new top-level folder** requires all three of: (1) a row in this table,
(2) a decision reference — an ADR documenting why no default home fits, and
(3) at least the first document that justifies it. Do not create folders for
one-off files or speculative future content. Keep this manifest current when the
tree changes; `bun scripts/validate-doc-folder.ts` (workspace-side) checks the
required folders on every audit.

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
