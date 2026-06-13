# ADR-0035: AGENTS.md Structural Redesign

## Status
Proposed

## Type
Structural

## Created
2026-06-09

## Deciders
- architect
- docs-writer  
- auditor

## Context

Two collaborative meetings were held to redesign the AGENTS.md structure:

1. **First meeting**: Established basic 5-section structure with content reduction
2. **Second meeting**: Further simplified to 4-section structure targeting 70-80% content reduction

The current AGENTS.md suffers from significant structural issues that impact maintainability and user experience.

## Problem Statement

Current AGENTS.md exhibits multiple structural deficiencies:

### Duplication Issues
- **§1 and §2 overlap**: Agent roster information duplicated across sections
- **PM Gateway scattered**: Gateway workflow content spread across multiple sections
- **Platform parity duplication**: Execution Plan boilerplate duplicated in CLAUDE.md/GEMINI.md
- **3-Tier Strategy redundancy**: Same content exists across multiple files
- **Language Policy repetition**: English-only policy duplicated unnecessarily

### Content Organization Problems
- **Redundant Skill Registry**: Duplicate of platform-specific skill systems
- **Excessive lifecycle content**: Lifecycle management details belong in CONSTITUTION.md
- **Mixed concerns**: Agent definitions mixed with workflow processes
- **Unclear ownership**: No clear single source of truth for topics

### Scale Issues
- Current size: ~1500 lines
- Difficult to navigate and maintain
- Information overload for users
- High maintenance burden

## Decision

Restructure AGENTS.md to a streamlined 4-section format, achieving 70-80% content reduction while maintaining essential information.

### New Structure

## §1: Agent Ecosystem Overview

**Purpose**: Quick reference for available agents and their roles

**Content**:
- Workspace Root Agents (table format)
  - Agent name | Role | Tier
  - Focus on roles only, no detailed descriptions
  
- L1 Template Variants (table format)
  - Variant name | Base role | Platform
  - Focus on roles only, no detailed descriptions

**Rationale**: Provides at-a-glance view of agent ecosystem without overwhelming detail.

## §2: Individual Agent Definitions

**Purpose**: Detailed agent specifications with clear single source of truth

**Content**:
- Simple role descriptions for each agent
- Direct links to canonical agent definition files (`agents/<name>.md`)
- YAML frontmatter-based approach where applicable
- Minimal duplication - link to source rather than repeat

**Structure per Agent**:
```
### <agent-name>
**Role**: 1-2 sentence description
**Tier**: High/Medium/Low
**Definition**: `agents/<agent-name>.md`
**Triggers**: [Key triggers if applicable]
```

**Rationale**: AGENTS.md becomes navigation hub rather than content repository.

## §3: PM Gateway Workflow (Core Summary)

**Purpose**: Essential PM Gateway concepts with deep links to detailed sources

**Content**:

### §3.1: Phase Determination
All multi-step tasks (2+ files or 2+ sequential steps) must follow PM Gateway workflow. PM determines execution phase and required specialist involvement. **Full workflow**: See `agents/pm.md` §3.

### §3.2: Permission Denial Protocol  
Direct specialist agent invocation bypasses PM Gateway governance. PM denies such requests and redirects through proper workflow. **Full protocol**: See `agents/pm.md` §3.2.

### §3.3: Meeting Facilitation
Multi-agent coordination uses structured meeting format for collaborative decision-making. PM facilitates discussions using `/meeting` command or equivalent. **Full details**: See `agents/pm.md` §5 and `skills/meeting-facilitation/SKILL.md`.

### §3.4: Execution Plan Display
Before dispatching 2+ agents, PM displays mandatory execution plan table. Required columns: #, Task, Agent, Tier, Model. **Full templates**: See `agents/pm.md` §5.

**Rationale**: AGENTS.md provides quick reference while single source of truth remains in specialist documentation.

## §4: Cross-Reference

**Purpose**: Clear documentation of where detailed content lives

**Content**:

### Agent Lifecycle
- Agent creation, modification, deprecation: **CONSTITUTION.md §5.6**
- Template variant lifecycle: **CONSTITUTION.md §10**

### Platform Differences
- Claude Code vs Antigravity: **CONSTITUTION.md §5**
- Agent Manager (Antigravity): See GEMINI.md

### Execution Plans
- Templates and boilerplate: **CLAUDE.md §5**, **GEMINI.md §5**
- 3-Tier Strategy: **AGENTS.md (current)** → **CONSTITUTION.md §5**

### Language Policy
- English-only documentation: **CLAUDE.md §4**, **GEMINI.md §4**

### Skill Registry
- Local skills: `skills/<name>/SKILL.md`
- Platform skills: `.claude/skills/`, `.gemini/skills/`
- Priority resolution: **CLAUDE.md §5**, **GEMINI.md §5**

**Rationale**: Eliminates duplication by clearly documenting single source of truth for each topic.

### Content Removal Targets

The following sections will be **completely removed** from AGENTS.md:

1. **Skill Registry** (entire section) → Use platform-specific skill resolution
2. **Execution Plan Boilerplate** (full templates) → Delegate to CLAUDE.md/GEMINI.md
3. **3-Tier Strategy** (detailed explanation) → Move to CONSTITUTION.md §5
4. **Language Policy** (detailed rules) → Keep in CLAUDE.md/GEMINI.md only
5. **Agent Lifecycle** (detailed processes) → CONSTITUTION.md §5.6
6. **Platform Differences** (detailed comparisons) → CONSTITUTION.md §5
7. **Detailed PM Gateway sections** → Summarize to 2-3 sentences each

### Expected Scale Reduction

- **Current**: ~1500 lines
- **Target**: ~300-400 lines  
- **Reduction**: 70-80%

## Consequences

### Positive Consequences

1. **Dramatic size reduction**: 70-80% decrease in line count
2. **Eliminated duplication**: Single source of truth for each topic
3. **Clear navigation**: AGENTS.md becomes focused entry point
4. **Improved maintainability**: Less content to keep synchronized
5. **Better user experience**: Easier to find essential information
6. **Clear ownership**: Each document has specific purpose

### Negative Consequences

1. **Navigation overhead**: Users must consult multiple documents for complete information
2. **Increased interdependencies**: More cross-document links to maintain
3. **Cognitive load**: Understanding document ecosystem becomes necessary
4. **Link rot risk**: More dependent on accurate cross-references

### Mitigation Strategies

1. **Core concept summaries**: AGENTS.md retains 2-3 sentence summaries for each topic
2. **Clear documentation**: All cross-references explicitly documented in §4
3. **Migration guide**: Document transition for users accustomed to current structure
4. **Link validation**: Regular audits of cross-document references
5. **Navigation aids**: Clear section headers and link descriptions

## Implementation Steps

### Phase 1: Preparation
1. **Audit current content**: Catalog all content in AGENTS.md with target destinations
2. **Verify cross-reference targets**: Ensure all destination documents exist and are accurate
3. **Create backup**: Preserve current AGENTS.md as `docs/adr/0035-agents-md-backup.md`

### Phase 2: Content Migration
1. **Move 3-Tier Strategy**: Migrate detailed content to CONSTITUTION.md §5
2. **Consolidate Language Policy**: Ensure CLAUDE.md/GEMINI.md have complete policy
3. **Update pm.md**: Add AGENTS.md delegation references
4. **Verify Skill Registry**: Confirm platform-specific resolution is sufficient

### Phase 3: Structure Creation
1. **Create §1 (Agent Ecosystem)**: Build agent/variant tables with roles only
2. **Create §2 (Agent Definitions)**: Write simple descriptions with YAML frontmatter
3. **Create §3 (PM Gateway Summary)**: Write 2-3 sentence summaries for each subsection
4. **Create §4 (Cross-Reference)**: Document all single sources of truth

### Phase 4: Validation
1. **Link verification**: Test all cross-document references
2. **Content completeness**: Verify no essential information lost
3. **Navigation testing**: Ensure users can find required information
4. **Line count validation**: Confirm 70-80% reduction achieved

### Phase 5: Transition
1. **Create migration guide**: Document changes for existing users
2. **Update related docs**: Modify any documents that reference old AGENTS.md structure
3. **Release communication**: Announce structural changes via CHANGELOG.md
4. **Monitor feedback**: Track user issues post-deployment

## Alternatives Considered

### Alternative 1: Maintain Current Structure
**Pros**: No migration effort, users already familiar
**Cons**: Continued duplication, maintenance burden, poor navigation

**Rejected**: Current problems outweigh transition costs

### Alternative 2: Split into Multiple Documents
**Pros**: Each document focused on single topic
**Cons**: Too many small documents, navigation complexity, over-engineering

**Rejected**: Excessive fragmentation for the scope of content

### Alternative 3: Keep Detailed Content in AGENTS.md
**Pros**: Self-contained document, no cross-references needed
**Cons**: Defeats purpose of restructure, no duplication elimination

**Rejected**: Doesn't address core problems of duplication and scale

## References

- **Meeting 1**: Initial 5-section structure proposal
- **Meeting 2**: Simplification to 4-section structure with 70-80% reduction target
- **CONSTITUTION.md**: Lifecycle management, platform differences, 3-Tier Strategy destination
- **CLAUDE.md/GEMINI.md**: Execution Plan templates, Language Policy, PM Gateway details
- **agents/pm.md**: Detailed PM Gateway workflow, execution plan templates
- **ADR-0034**: Previous ADR related to agent documentation (if applicable)

## Notes

- This restructure aligns with **CLAUDE.md/GEMINI.md platform parity rule**: AGENTS.md becomes platform-agnostic, platform-specific details remain in respective platform docs
- **PM Gateway enforcement**: This ADR itself is a multi-step structural change requiring PM Gateway workflow
- **Tier assignment**: docs-writer (Medium) appropriate for documentation structural changes
- **Implementation timeline**: Estimate 2-3 sessions for full migration and validation

---

**Next Steps**: PM Gateway validation -> Implementation Phase 1 -> Full migration per 5-phase plan