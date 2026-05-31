# Variant PM Agent Section Specification

> This document defines which sections of `agents/pm.md` should differ per variant,
> enabling the `extends` pattern or VARIANT-SECTION substitution in scaffolding.
> Required before executing S2-A-04 (pm.md extends conversion).

## Sections That Must Be Variant-Specific

### 1. `## Role` (first paragraph only)
The opening sentence must identify the variant domain. Common pm.md says:
> "You are the PM orchestrator for the **ai-workspace-standards repository** (the workspace root)."

Each variant must override this to reflect its domain:

| Variant | Role Opening |
|---------|-------------|
| co-design | You are the Design PM orchestrator. Your domain is UI/UX design projects — from design brief through prototype handoff. |
| co-work | You are the Collaboration PM orchestrator. Your domain is research, documentation, and stakeholder alignment projects. |
| co-security | You are the Security PM orchestrator. Your domain is authorized security engagements — from scoping through verified remediation. |

### 2. `## Agent Roster` (full section)
Each variant's Agent Roster table must list only that variant's agents (not the workspace-root agent set).

| Variant | Agents in Roster |
|---------|-----------------|
| co-design | design-lead, ux-researcher, visual-designer, prototype-engineer, storyteller, service-designer, typography-expert |
| co-work | analyst, storyteller, content-writer, technical-writer, ms365-expert, project-coordinator |
| co-security | red-team-lead, threat-modeler, pentester, patch-engineer, report-writer |

### 3. Sections That Must NOT Change (inherited from common)
All other sections are shared: Governance Workflow, Consensus-Driven Facilitation Model, Constraints, Dispatch Protocol, Meeting Facilitation.

## Implementation Note
S2-A-04 should implement this as `extends` frontmatter in each variant pm.md, overriding only the `## Role` opening and `## Agent Roster` sections via frontmatter merge or VARIANT-SECTION substitution.
