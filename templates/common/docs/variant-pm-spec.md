# Variant PM Agent Section Specification

> This document defines which sections of `agents/pm.md` should differ per variant,
> enabling the `extends` pattern in scaffolding.
> Updated per ADR-0032 (Auto-Mode Deprecation) and ADR-0033 (L0→L1→L2 Hierarchy).

## L0→L1→L2 Hierarchy

This specification operates within the established L0→L1→L2 hierarchy:

| Level | Location | Role | Extends |
|-------|----------|------|---------|
| **L0** | `agents/pm.md` | Authoritative source of truth | None |
| **L1** | `templates/common/agents/pm.md` | Common template for variants | Extends from L0 |
| **L2** | `templates/co-*/agents/pm.md` | Variant-specific implementations | Extends from L1 |

**Key Principles** (from ADR-0033):
1. **Single Source of Truth**: L0 (workspace root) is the authoritative source
2. **Frontmatter-Only Extends**: All inheritance uses YAML frontmatter `extends` field
3. **No Duplication**: Variants contain only variant-specific content
4. **Circular Reference Prevention**: Maximum extends depth is 3 (L2→L1→L0)

> **See ADR-0033** for complete hierarchy definition and implementation details.

## Auto-Mode Deprecation

**Status**: Auto-Mode sections have been removed from all PM agents per ADR-0032.

**Removed From**:
- `agents/pm.md` (L0) - lines 193-352 removed
- `templates/common/agents/pm.md` (L1) - lines 197-348 removed

**Rationale**:
- Auto-Mode was platform-specific implementation detail, not core PM behavior
- Superseded by Agent Teams (Experimental) functionality
- Reduced agent definition complexity by 160+ lines
- Aligns with single source of truth principle

> **See ADR-0032** for complete deprecation rationale and migration path.

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

### 3. Sections That Must NOT Change (inherited from parent)
All other sections are inherited from the parent (L1 for L2 variants):
- Governance Workflow
- Consensus-Driven Facilitation Model
- Constraints
- Dispatch Protocol
- Meeting Facilitation
- All other sections not explicitly listed above

## Extends Pattern Implementation

### Frontmatter-Only Approach

**Phase 1 (Current)**: New variants use frontmatter-only extends
```yaml
---
name: pm
extends: ../../../common/agents/pm.md
variant: co-design
overrides:
  - section: "## Role"
    scope: "first_paragraph"
  - section: "## Agent Roster"
    scope: "full_section"
---
```

**Override Scope Definitions**:
- `first_paragraph`: Only the first paragraph of a section is replaced
- `full_section`: The entire section content is replaced
- All other sections are inherited from parent unchanged

### Migration Status

**Current State**: Phase 1 - Frontmatter-only for new variants
- New variants MUST use frontmatter extends pattern
- Existing markers are deprecated but still supported during transition
- Scaffold script (`create-l2-scaffold.ts`) implements frontmatter resolution

**Future Phases** (from ADR-0033):
- Phase 2: Backward compatibility with deprecation warnings
- Phase 3: Complete marker deprecation, frontmatter-only mandatory

### Circular Reference Prevention

Extends chain validation enforces security constraints:
- Maximum depth: 3 levels (L2→L1→L0)
- Maximum file size: 100KB per file
- Parse timeout: 5 seconds
- Circular reference detection with immediate failure

## Implementation Guidance

### For Scaffold Scripts
1. Implement frontmatter parsing for extends field
2. Validate extends chain depth (< 3)
3. Merge sections based on override scope
4. Detect and reject circular references

### For New Variants
1. Create variant pm.md with frontmatter extends
2. Define only variant-specific sections (Role first paragraph, Agent Roster)
3. Inherit all other sections from parent
4. Validate with audit script

### For Existing Variants
1. Migrate marker-based substitution to frontmatter
2. Remove duplicate common content
3. Add extends frontmatter with override definitions
4. Validate inheritance chain

## Related Documentation

- **ADR-0032**: Auto-Mode Deprecation rationale and implementation
- **ADR-0033**: Complete L0→L1→L2 hierarchy specification
- **ADR-0031**: L1-L2 Fork Model governance
- **CONSTITUTION.md §5**: Multi-agent architecture rules
