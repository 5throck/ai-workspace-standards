# AGENTS.md Final Structural Design

## Design Overview

This document specifies the detailed structural design for AGENTS.md reorganization per ADR-0035, targeting 70-80% content reduction (from ~1500 lines to ~300-400 lines) while maintaining essential information through clear single source of truth (SSOT) references.

**Design Date**: 2026-06-09  
**Status**: Design Specification  
**Target Implementation**: docs-writer (Medium tier)  
**Architecture Decision**: ADR-0035

---

## §1: Section-by-Section Content Specification

### §1: Agent Ecosystem Overview

**Purpose**: Quick reference for available agents and their roles  
**Target Length**: 60-80 lines  
**Format**: Tables only, minimal text

#### Content Specifications

**Workspace Root Agents Table**:
```
| Agent | Role | Tier |
|-------|------|------|
| Project Manager (PM) Agent | Orchestrates Phases 0, 2, 6; enforces quality gates; manages multi-agent workflows | High |
| Consistency Auditor | Cross-domain consistency validation; detects structural inconsistencies; QA gate enforcement | Medium |
| Lifecycle Manager | L0-only governance state monitor; template publishing; skill/script lifecycle sync | Medium |
| Template Architect | Project structure design; architectural standards; implementation planning & ADR authorship | High |
| Automation Engineer | Tier 1 (.sh/.ps1) & Tier 2 (.ts/package.json) script maintenance; ensures idempotency | Low |
| Documentation Writer | Documentation updates per architect decisions; writing & editing consistency | Medium |
| Scaffolding Expert | New project & template specialist; validates scaffolding logic; ensures template synchrony | Low |
| Security & Git Expert | Git hooks enforcement; .gitleaks configuration; credential & dependency security | Medium |
```

**L1 Template Variants Table**:
```
| Variant | Base Role | Platform |
|---------|-----------|----------|
| common | Infrastructure base for all variants | Both |
| co-design | Design system governance & component lifecycle | Both |
| co-work | Collaborative workspace management | Both |
```

#### Content Removal (from current AGENTS.md)

**Remove from current §1 Agent Roster**:
- Detailed role descriptions (move to §2)
- Extended capability explanations (move to agent definition files)
- Duplicated PM Gateway details (consolidate in §3)
- Agent file path details (move to §2)

#### Reference Targets

**For detailed agent specifications**: §2 (Individual Agent Definitions)  
**For PM workflow details**: §3 (PM Gateway Workflow)  
**For lifecycle management**: agents/lifecycle-manager.md

---

### §2: Individual Agent Definitions

**Purpose**: Detailed agent specifications with clear SSOT references  
**Target Length**: 120-150 lines  
**Format**: Structured agent entries with direct links

#### Content Specifications

**Structure per Agent**:
```markdown
### <agent-name>

**Role**: [1-2 sentence role description]  
**Tier**: High/Medium/Low  
**Status**: active/deprecated  
**Definition**: [`agents/<agent-name>.md`](agents/<agent-name>.md)  
**Triggers**: [Key invocation triggers if applicable]  
**Platform**: workspace-root-only / L0-only / available-in-variants

**Quick Summary**: [2-3 sentence operational summary]
```

**Example (PM Agent)**:
```markdown
### Project Manager (PM) Agent

**Role**: Orchestrates multi-agent workflows; creates execution plans; dispatches specialists; enforces quality gates  
**Tier**: High  
**Status**: active  
**Definition**: [`agents/pm.md`](agents/pm.md)  
**Triggers**: User requests; "Managing workflow"; "Multi-step task coordination"  
**Platform**: workspace-root-only (L0)

**Quick Summary**: PM is the single entry point for all multi-step tasks. Orchestrates Phases 0 (Team Assembly), 2 (Design Approval), and 6 (Finalization). Does NOT implement code directly - dispatches specialists (architect, automation-engineer, docs-writer) for all implementation work. Enforces quality gates and maintains project standards.
```

#### Content Removal (from current AGENTS.md)

**Remove from current §2**:
- Duplicate agent roster (consolidated in §1)
- Detailed PM Gateway workflow (move to §3)
- Execution plan boilerplate (delegate to CLAUDE.md/GEMINI.md)
- 3-Tier Strategy details (move to CONSTITUTION.md §5)
- Platform-specific implementation details (keep in platform docs)

#### Reference Targets

**For detailed agent behavior**: Individual `agents/<name>.md` files  
**For PM workflow details**: `agents/pm.md` §3-5  
**For lifecycle management**: `agents/lifecycle-manager.md`  
**For execution plans**: CLAUDE.md §5, GEMINI.md §5

---

### §3: PM Gateway Workflow (Core Summary)

**Purpose**: Essential PM Gateway concepts with deep links to detailed sources  
**Target Length**: 80-100 lines  
**Format**: 2-3 sentence summaries per subsection with explicit SSOT references

#### Content Specifications

**§3.1: Phase Determination**
All multi-step tasks (2+ files or 2+ sequential steps) must follow PM Gateway workflow. PM determines execution phase and required specialist involvement based on deliverable type classification. **Full workflow**: See [`agents/pm.md`](agents/pm.md) §3.

**§3.2: Permission Denial Protocol**
Direct specialist agent invocation bypasses PM Gateway governance. PM denies such requests and redirects through proper workflow, maintaining quality gate enforcement. **Full protocol**: See [`agents/pm.md`](agents/pm.md) §3.2.

**§3.3: Meeting Facilitation**
Multi-agent coordination uses structured meeting format for collaborative decision-making. PM facilitates discussions using `/meeting` command or equivalent skill to enable real-time agent dialogue. **Full details**: See [`agents/pm.md`](agents/pm.md) §5 and [`skills/meeting-facilitation/SKILL.md`](skills/meeting-facilitation/SKILL.md).

**§3.4: Execution Plan Display**
Before dispatching 2+ agents, PM displays mandatory execution plan table. Required columns: #, Task, Agent, Tier, Model. End every plan with a single `/sync` row — it covers lifecycle update, audit, commit, push, and PR in one pipeline. **Full templates**: See [`agents/pm.md`](agents/pm.md) §5.

**§3.5: Role Boundaries**
PM orchestrates multi-agent workflows but never implements code directly. All file modifications (except `memory/*.md` and `CHANGELOG.md`) must be dispatched to specialists (docs-writer, architect, automation-engineer). **Full constraints**: See [`agents/pm.md`](agents/pm.md) ⚠️ CRITICAL section.

#### Content Removal (from current AGENTS.md)

**Remove from current §3 PM Gateway**:
- Detailed PM Gateway policy (keep 2-3 sentences)
- Full execution plan templates (reference CLAUDE.md/GEMINI.md)
- PM Direct Execution Scope table (reference pm.md)
- Enforcement layers detail (keep summary)
- Specialist Agent Roster table (consolidate in §1)
- Phase determination table (reference pm.md)
- 3-Tier Strategy explanation (move to CONSTITUTION.md)
- Meeting facilitation details (keep summary)

#### Reference Targets

**Phase Determination**: `agents/pm.md` §3  
**Permission Denial**: `agents/pm.md` §3.2  
**Meeting Facilitation**: `agents/pm.md` §5, `skills/meeting-facilitation/SKILL.md`  
**Execution Plans**: `agents/pm.md` §5, CLAUDE.md §5, GEMINI.md §5  
**Role Boundaries**: `agents/pm.md` "⚠️ CRITICAL" section

---

### §4: Cross-Reference

**Purpose**: Clear documentation of where detailed content lives  
**Target Length**: 40-60 lines  
**Format**: Structured reference lists with explicit SSOT locations

#### Content Specifications

**Agent Lifecycle**
- Agent creation, modification, deprecation: **[`CONSTITUTION.md`](CONSTITUTION.md) §5.6**
- Template variant lifecycle: **[`CONSTITUTION.md`](CONSTITUTION.md) §10**
- Lifecycle manager operations: **[`agents/lifecycle-manager.md`](agents/lifecycle-manager.md)**

**Platform Differences**
- Claude Code vs Antigravity: **[`CONSTITUTION.md`](CONSTITUTION.md) §5**
- Agent Manager (Antigravity): **[`GEMINI.md`](GEMINI.md)** §Agent Manager
- Platform-specific agent behavior: **[`CLAUDE.md`](CLAUDE.md)** / **[`GEMINI.md`](GEMINI.md)** §5

**Execution Plans**
- Templates and boilerplate: **[`CLAUDE.md`](CLAUDE.md)** §5, **[`GEMINI.md`](GEMINI.md)** §5
- 3-Tier Strategy: **[`CONSTITUTION.md`](CONSTITUTION.md)** §5
- Model assignments: **[`docs/workspace-schema.json`](docs/workspace-schema.json)**

**Language Policy**
- English-only documentation: **[`CLAUDE.md`](CLAUDE.md)** §4, **[`GEMINI.md`](GEMINI.md)** §4
- Translation zones: **[`CLAUDE.md`](CLAUDE.md)** §4 Language Policy
- Git/PR artifacts language: **[`CLAUDE.md`](CLAUDE.md)** §4

**Skills & Commands**
- Local skills: `skills/<name>/SKILL.md`
- Platform skills: `.claude/skills/`, `.gemini/skills/`
- Priority resolution: **[`CLAUDE.md`](CLAUDE.md)** §5, **[`GEMINI.md`](GEMINI.md)** §5
- Skill lifecycle: **[`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md)**

**PM Gateway Details**
- Full workflow: **[`agents/pm.md`](agents/pm.md)** §3-5
- Permission denial: **[`agents/pm.md`](agents/pm.md)** §3.2
- Meeting facilitation: **[`agents/pm.md`](agents/pm.md)** §5
- Execution plan templates: **[`agents/pm.md`](agents/pm.md)** §5

**Variant Management**
- L1-L2 fork model: **[`docs/adr/0031-l1-l2-fork-model.md`](docs/adr/0031-l1-l2-fork-model.md)**
- YAML extends pattern: **[`docs/adr/0033-variant-specific-skills-scripts-blueprint.md`](docs/adr/0033-variant-specific-skills-scripts-blueprint.md)**
- PM variant overrides: **[`templates/common/docs/variants/pm-yaml-schema.md`](templates/common/docs/variants/pm-yaml-schema.md)**

#### Content Removal (from current AGENTS.md)

**Remove from current §4 Other Workflows**:
- PM Subagent Dispatch Protocol (reference pm.md)
- Harness Engineering Workflow (reference CONSTITUTION.md)
- Role Boundary Matrix (keep summary in §3)
- L0→L1→L2 PM Agent Architecture (reference variant docs)

**Remove from current §5-10**:
- §5: Execution Plan Templates (CLAUDE.md/GEMINI.md)
- §6: Skills (VERSION_MANIFEST.md)
- §7: Universal Baseline Behaviors (CONSTITUTION.md)
- §8: Lifecycle Management (CONSTITUTION.md §5.6)
- §9: Maintenance Rule (CONSTITUTION.md)
- §10: Periodic Skill Review Schedule (CONSTITUTION.md)

#### Reference Targets

**All cross-references**: Explicitly documented with full markdown links  
**Validation**: All reference targets must exist and contain referenced content  
**Maintenance**: Cross-reference section must be updated when reference targets change

---

## §2: Content Removal Checklist

### Complete Content Removal Inventory

#### 1. Skill Registry (§6, Lines ~658-727)

**Remove completely**:
- Skill Resolution Priority table → Reference CLAUDE.md §5, GEMINI.md §5
- Location Rules → Reference platform docs
- Resolution Rule → Reference platform docs
- Skill Registry table → Reference docs/VERSION_MANIFEST.md
- VERSION_MANIFEST reference block → Keep reference link only
- Platform Support note → Remove (platform-specific)

**Target destination**: N/A (use VERSION_MANIFEST.md as SSOT)

#### 2. Execution Plan Boilerplate (§5, Lines ~599-656)

**Remove completely**:
- Standard Execution Plan Template → Reference CLAUDE.md §5, GEMINI.md §5
- Platform Parity Considerations → Reference CLAUDE.md §5
- Example Execution Plans → Reference agents/pm.md §5

**Target destination**: CLAUDE.md §5, GEMINI.md §5, agents/pm.md §5

#### 3. 3-Tier Strategy (Lines ~236-244, ~500-516)

**Remove completely**:
- 3-Tier Strategy explanation → Move to CONSTITUTION.md §5
- Tier Adjustment Rules → Move to CONSTITUTION.md §5
- Model selection details → Reference docs/workspace-schema.json

**Target destination**: CONSTITUTION.md §5

#### 4. Language Policy (Lines ~267-294)

**Remove completely**:
- English-Only Documentation Rule → Reference CLAUDE.md §4, GEMINI.md §4
- English Documentation Requirement → Reference CLAUDE.md §4
- Translation Zones → Reference CLAUDE.md §4
- Enforcement → Reference CLAUDE.md §4
- Git/PR Artifacts Language Rule → Reference CLAUDE.md §4

**Target destination**: CLAUDE.md §4, GEMINI.md §4

#### 5. Agent Lifecycle Details (§8, Lines ~747-853)

**Remove completely**:
- Phase 5 Lifecycle Finalization → Reference agents/lifecycle-manager.md
- Agent Lifecycle table → Reference CONSTITUTION.md §5.6
- Skill Lifecycle table → Reference CONSTITUTION.md §5.6
- Script Lifecycle table → Reference CONSTITUTION.md §5.6
- Skills Location Reference → Reference CONSTITUTION.md §6

**Target destination**: CONSTITUTION.md §5.6, agents/lifecycle-manager.md

#### 6. PM Gateway Duplication (Lines ~48-130, ~164-264)

**Consolidate to summaries**:
- PM Gateway Policy → Keep 2-3 sentence summary in §3
- PM Direct Execution Scope → Reference agents/pm.md
- PM Role Boundaries → Keep 2-3 sentence summary in §3
- Enforcement Layers → Keep summary
- Specialist Agent Roster → Consolidate in §1
- Phase Determination → Reference agents/pm.md §3
- Permission Denial Protocol → Keep summary in §3

**Target destination**: §3 (PM Gateway Summary) with references to agents/pm.md

#### 7. PM Subagent Dispatch Protocol (Lines ~300-542)

**Remove completely**:
- Architecture Overview → Reference templates/common/docs/variants/pm-yaml-schema.md
- L1 Structure → Reference docs/adr/0033-*
- L2 Structure → Reference templates/common/docs/variants/pm-yaml-schema.md
- Extends Chain Resolution → Reference docs/adr/0033-*
- Schema Reference → Keep link
- ADR Reference → Keep reference
- Fork Model Relationship → Reference docs/adr/0031-*
- Validation Checklist → Reference scripts/validate-templates.ts

**Target destination**: templates/common/docs/variants/pm-yaml-schema.md, docs/adr/0033-*

#### 8. Other Workflows (§4, Lines ~483-597)

**Remove completely**:
- Harness Engineering Workflow → Reference CONSTITUTION.md §5.4
- Role Boundary Matrix → Keep summary in §3

**Target destination**: CONSTITUTION.md §5

#### 9. Universal Baseline Behaviors (§7, Lines ~730-745)

**Remove completely**:
- Security Boundaries → Reference agents/security-expert.md
- Communication Style → Reference CONSTITUTION.md
- Conflicting Instructions → Reference CONSTITUTION.md
- Coding Standards → Reference docs/constitution/08-coding-guidelines.md
- Language → Reference CLAUDE.md §4
- UTF-8 Enforcement → Reference agents/scaffolding-expert.md
- File Organization → Reference docs/constitution/01-folder-structure.md
- Search Tool Prioritization → Reference CLAUDE.md/GEMINI.md
- Source Attribution → Reference CONSTITUTION.md
- Computational Integrity → Reference agents/architect.md

**Target destination**: CONSTITUTION.md, specialist agent files

#### 10. Maintenance Rule (§9, Lines ~835-851)

**Remove completely**:
- New agent creation steps → Reference agents/lifecycle-manager.md
- New skill creation steps → Reference docs/VERSION_MANIFEST.md
- SSOT sync requirements → Reference CONSTITUTION.md §1

**Target destination**: agents/lifecycle-manager.md, CONSTITUTION.md

#### 11. Periodic Skill Review Schedule (§10, Lines ~854-897)

**Remove completely**:
- Review cadence → Reference agents/lifecycle-manager.md
- Review steps → Reference scripts/skill-dependency-analysis.ts
- Trigger conditions → Reference agents/lifecycle-manager.md

**Target destination**: agents/lifecycle-manager.md

---

## §3: Reference Link Verification

### Exact Reference Targets

#### pm.md Specific Sections

**PM Gateway Workflow**:
- Link target: [`agents/pm.md`](agents/pm.md) §3
- Content: Phase determination, enforcement layers, specialist dispatch
- Validation: Section must exist in pm.md and contain complete workflow

**Permission Denial Protocol**:
- Link target: [`agents/pm.md`](agents/pm.md) §3.2
- Content: Denial classification, escalation template, logging requirements
- Validation: Section must exist with detailed protocol steps

**Meeting Facilitation**:
- Link target: [`agents/pm.md`](agents/pm.md) §5
- Content: Meeting process, dialogue facilitation, transcript documentation
- Validation: Section must describe `/meeting` usage

**Execution Plan Templates**:
- Link target: [`agents/pm.md`](agents/pm.md) §5
- Content: Standard templates, boilerplate policy, platform considerations
- Validation: Must include table format and mandatory criteria

#### Governance Reference Links (L0 vs L1 Distinction)

> **L0 (workspace root)** uses `CONSTITUTION.md` for all governance references.
> **L1 (templates/common)** uses `docs/context.md` as the project-level equivalent.
> When deploying AGENTS.md to L1, replace all CONSTITUTION.md links with `docs/context.md`.

**§5: Multi-Agent Architecture**:
- L0 link target: [`CONSTITUTION.md`](CONSTITUTION.md) §5
- L1 link target: [`docs/context.md`](docs/context.md)
- Content: Agent ecosystem, PM Gateway, enforcement model
- Validation: Section must exist with governance architecture

**§5.6: Agent Lifecycle**:
- L0 link target: [`CONSTITUTION.md`](CONSTITUTION.md) §5.6
- L1 link target: [`docs/context.md — Lifecycle Management`](docs/context.md#lifecycle-management)
- Content: Agent creation, modification, deprecation processes
- Validation: Section must detail lifecycle management

**§10: L1-L2 Fork Model**:
- L0 link target: [`CONSTITUTION.md`](CONSTITUTION.md) §10
- L1 link target: [`docs/context.md`](docs/context.md)
- Content: Template lifecycle, distribution rules, independence principles
- Validation: Section must explain fork model

#### CLAUDE.md Links

**§5: Agent Dispatch Rules**:
- Link target: [`CLAUDE.md`](CLAUDE.md) §5
- Content: Execution plan templates, 3-tier strategy, platform-specific rules
- Validation: Must include complete boilerplate and tier assignment

**§4: Language Policy**:
- Link target: [`CLAUDE.md`](CLAUDE.md) §4
- Content: English-only documentation rule, translation zones, enforcement
- Validation: Section must detail language requirements

#### GEMINI.md Links

**§5: Agent Dispatch Rules**:
- Link target: [`GEMINI.md`](GEMINI.md) §5
- Content: Execution plan templates, Antigravity-specific dispatch rules
- Validation: Must include platform-specific adaptations

**§4: Language Policy**:
- Link target: [`GEMINI.md`](GEMINI.md) §4
- Content: Language requirements for Gemini CLI environment
- Validation: Must align with CLAUDE.md §4

#### Additional Reference Targets

**VERSION_MANIFEST.md**:
- Link target: [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md)
- Content: Skill versions, status, lifecycle metadata
- Validation: Must be authoritative source for skill information

**workspace-schema.json**:
- Link target: [`docs/workspace-schema.json`](docs/workspace-schema.json)
- Content: Workflow phases, agent tiers, model assignments
- Validation: Must contain complete schema definitions

**ADR-0031**:
- Link target: [`docs/adr/0031-l1-l2-fork-model.md`](docs/adr/0031-l1-l2-fork-model.md)
- Content: L1-L2 fork model, distribution rules
- Validation: Must explain fork model principles

**ADR-0033**:
- Link target: [`docs/adr/0033-variant-specific-skills-scripts-blueprint.md`](docs/adr/0033-variant-specific-skills-scripts-blueprint.md)
- Content: Variant directory structure, YAML extends pattern
- Validation: Must include blueprint details

**pm-yaml-schema.md**:
- Link target: [`templates/common/docs/variants/pm-yaml-schema.md`](templates/common/docs/variants/pm-yaml-schema.md)
- Content: YAML frontmatter schema for variant PM agents
- Validation: Must include complete schema specification

---

## §4: YAML Frontmatter Design

### New AGENTS.md Frontmatter

```yaml
---
title: AGENTS.md
subtitle: Workspace Root Agent Ecosystem - Single Source of Truth
version: 3.0.0
status: active
last_updated: 2026-06-09
maintainer: lifecycle-manager
governance: docs/lifecycle/agents/agents.md

# Documentation Architecture
document_type: registry
purpose: "Agent ecosystem reference and PM Gateway workflow summary"
scope: workspace-root-only

# Content Scope (Section-based)
sections:
  - section: "§1: Agent Ecosystem Overview"
    purpose: "Quick reference for available agents and their roles"
    format: "tables-only, minimal text"
    target_length: "60-80 lines"
    
  - section: "§2: Individual Agent Definitions"
    purpose: "Detailed agent specifications with clear SSOT references"
    format: "structured entries with direct links"
    target_length: "120-150 lines"
    
  - section: "§3: PM Gateway Workflow"
    purpose: "Essential PM Gateway concepts with deep links"
    format: "2-3 sentence summaries per subsection"
    target_length: "80-100 lines"
    
  - section: "§4: Cross-Reference"
    purpose: "Clear documentation of where detailed content lives"
    format: "structured reference lists with explicit SSOT"
    target_length: "40-60 lines"

# Scale Targets
current_lines: ~1500
target_lines: ~300-400
reduction_target: "70-80%"

# SSOT References (Primary)
pm_gateway_workflow: agents/pm.md
lifecycle_management: agents/lifecycle-manager.md
execution_plans: CLAUDE.md#5, GEMINI.md#5
agent_lifecycle: CONSTITUTION.md#5.6
language_policy: CLAUDE.md#4, GEMINI.md#4
skill_registry: docs/VERSION_MANIFEST.md

# ADR References
governance_architecture: docs/adr/0035-agents-md-restructure.md
l1_l2_fork_model: docs/adr/0031-l1-l2-fork-model.md
yaml_extends_pattern: docs/adr/0033-variant-specific-skills-scripts-blueprint.md

# Platform Parity
claude_specific: CLAUDE.md
gemini_specific: GEMINI.md
platform_agnostic_content: true

# Migration
migration_status: pending
previous_version: 2.0.0
migration_guide: docs/designs/agents-md-final-structure.md
user_communication: CHANGELOG.md

# Validation
validation_required: true
validation_script: scripts/validate-agents-md.sh
link_validation_required: true
completeness_check: true

# Related Documents
dependencies:
  - agents/pm.md
  - agents/lifecycle-manager.md
  - CONSTITUTION.md
  - CLAUDE.md
  - GEMINI.md
  - docs/VERSION_MANIFEST.md
  - docs/workspace-schema.json

# Change History
changelog:
  - version: "3.0.0"
    date: 2026-06-09
    type: structural
    description: "Restructured per ADR-0035 - 4-section format, 70-80% size reduction"
    impact: "Breaking - new navigation patterns"
  - version: "2.0.0"
    date: 2026-06-09
    type: content
    description: "Integrated PM Gateway workflow, execution plan templates"
    impact: "Feature enhancement"
---
```

### Frontmatter Field Specifications

**Document Metadata**:
- `version`: Follows semantic versioning (major.minor.patch)
- `status`: active / deprecated / draft
- `maintainer`: Agent responsible for lifecycle updates
- `governance`: Lifecycle management file location

**Architecture Fields**:
- `document_type`: Defines document role in ecosystem
- `purpose`: Concise statement of document intent
- `scope`: workspace-root-only / platform-specific / variant-specific

**Section Specifications**:
- Each section must have purpose, format, and target length
- Enables automated validation against targets
- Supports scale monitoring

**Scale Targets**:
- `current_lines`: Baseline measurement
- `target_lines`: Success criteria
- `reduction_target`: Percentage goal

**SSOT References**:
- Primary sources for each topic
- Enables cross-link validation
- Single source of truth enforcement

**Migration Tracking**:
- Status of transition from v2.0.0 to v3.0.0
- User communication requirements
- Rollback capability

---

## §5: Section Content Examples

### §1: Sample Table Format

```markdown
## §1: Agent Ecosystem Overview

### Workspace Root Agents

| Agent | Role | Tier |
|-------|------|------|
| Project Manager (PM) Agent | Orchestrates Phases 0, 2, 6; enforces quality gates; manages multi-agent workflows | High |
| Consistency Auditor | Cross-domain consistency validation; detects structural inconsistencies; QA gate enforcement | Medium |
| Lifecycle Manager | L0-only governance state monitor; template publishing; skill/script lifecycle sync | Medium |
| Template Architect | Project structure design; architectural standards; implementation planning & ADR authorship | High |
| Automation Engineer | Tier 1 (.sh/.ps1) & Tier 2 (.ts/package.json) script maintenance; ensures idempotency | Low |
| Documentation Writer | Documentation updates per architect decisions; writing & editing consistency | Medium |
| Scaffolding Expert | New project & template specialist; validates scaffolding logic; ensures template synchrony | Low |
| Security & Git Expert | Git hooks enforcement; .gitleaks configuration; credential & dependency security | Medium |

### L1 Template Variants

| Variant | Base Role | Platform |
|---------|-----------|----------|
| common | Infrastructure base for all variants | Both |
| co-design | Design system governance & component lifecycle | Both |
| co-work | Collaborative workspace management | Both |
```

### §2: Sample Agent Listing Format

```markdown
## §2: Individual Agent Definitions

### Project Manager (PM) Agent

**Role**: Orchestrates multi-agent workflows; creates execution plans; dispatches specialists; enforces quality gates  
**Tier**: High  
**Status**: active  
**Definition**: [`agents/pm.md`](agents/pm.md)  
**Triggers**: User requests; "Managing workflow"; "Multi-step task coordination"  
**Platform**: workspace-root-only (L0)

**Quick Summary**: PM is the single entry point for all multi-step tasks. Orchestrates Phases 0 (Team Assembly), 2 (Design Approval), and 6 (Finalization). Does NOT implement code directly - dispatches specialists (architect, automation-engineer, docs-writer) for all implementation work. Enforces quality gates and maintains project standards.

### Consistency Auditor

**Role**: Cross-domain consistency validation; detects structural inconsistencies; QA gate enforcement  
**Tier**: Medium  
**Status**: active  
**Definition**: [`agents/auditor.md`](agents/auditor.md)  
**Triggers**: "Quality verification"; "Consistency check"; "Documentation validation"  
**Platform**: workspace-root-only

**Quick Summary**: Workspace-root-only specialist detecting structural inconsistencies that automated scripts miss. NOT dispatched in variant projects. Executes autonomous QA gate using `bun scripts/qa-gate.ts`. Maximum 2 iterations before PM escalation. Validates documentation consistency and cross-domain structural integrity.
```

### §3: Sample 2-3 Sentence Summaries

```markdown
## §3: PM Gateway Workflow

### §3.1: Phase Determination
All multi-step tasks (2+ files or 2+ sequential steps) must follow PM Gateway workflow. PM determines execution phase and required specialist involvement based on deliverable type classification. **Full workflow**: See [`agents/pm.md`](agents/pm.md) §3.

### §3.2: Permission Denial Protocol
Direct specialist agent invocation bypasses PM Gateway governance. PM denies such requests and redirects through proper workflow, maintaining quality gate enforcement. **Full protocol**: See [`agents/pm.md`](agents/pm.md) §3.2.

### §3.3: Meeting Facilitation
Multi-agent coordination uses structured meeting format for collaborative decision-making. PM facilitates discussions using `/meeting` command or equivalent skill to enable real-time agent dialogue. **Full details**: See [`agents/pm.md`](agents/pm.md) §5 and [`skills/meeting-facilitation/SKILL.md`](skills/meeting-facilitation/SKILL.md).

### §3.4: Execution Plan Display
Before dispatching 2+ agents, PM displays mandatory execution plan table. Required columns: #, Task, Agent, Tier, Model. End every plan with a single `/sync` row — it covers lifecycle update, audit, commit, push, and PR in one pipeline. **Full templates**: See [`agents/pm.md`](agents/pm.md) §5.

### §3.5: Role Boundaries
PM orchestrates multi-agent workflows but never implements code directly. All file modifications (except `memory/*.md` and `CHANGELOG.md`) must be dispatched to specialists (docs-writer, architect, automation-engineer). **Full constraints**: See [`agents/pm.md`](agents/pm.md) ⚠️ CRITICAL section.
```

### §4: Sample Reference Format

```markdown
## §4: Cross-Reference

### Agent Lifecycle
- Agent creation, modification, deprecation: **[`CONSTITUTION.md`](CONSTITUTION.md) §5.6**
- Template variant lifecycle: **[`CONSTITUTION.md`](CONSTITUTION.md) §10**
- Lifecycle manager operations: **[`agents/lifecycle-manager.md`](agents/lifecycle-manager.md)**

### Platform Differences
- Claude Code vs Antigravity: **[`CONSTITUTION.md`](CONSTITUTION.md) §5**
- Agent Manager (Antigravity): **[`GEMINI.md`](GEMINI.md)** §Agent Manager
- Platform-specific agent behavior: **[`CLAUDE.md`](CLAUDE.md)** / **[`GEMINI.md`](GEMINI.md)** §5

### Execution Plans
- Templates and boilerplate: **[`CLAUDE.md`](CLAUDE.md)** §5, **[`GEMINI.md`](GEMINI.md)** §5
- 3-Tier Strategy: **[`CONSTITUTION.md`](CONSTITUTION.md)** §5
- Model assignments: **[`docs/workspace-schema.json`](docs/workspace-schema.json)**

### Language Policy
- English-only documentation: **[`CLAUDE.md`](CLAUDE.md)** §4, **[`GEMINI.md`](GEMINI.md)** §4
- Translation zones: **[`CLAUDE.md`](CLAUDE.md)** §4 Language Policy
- Git/PR artifacts language: **[`CLAUDE.md`](CLAUDE.md)** §4

### Skills & Commands
- Local skills: `skills/<name>/SKILL.md`
- Platform skills: `.claude/skills/`, `.gemini/skills/`
- Priority resolution: **[`CLAUDE.md`](CLAUDE.md)** §5, **[`GEMINI.md`](GEMINI.md)** §5
- Skill lifecycle: **[`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md)**

### PM Gateway Details
- Full workflow: **[`agents/pm.md`](agents/pm.md)** §3-5
- Permission denial: **[`agents/pm.md`](agents/pm.md)** §3.2
- Meeting facilitation: **[`agents/pm.md`](agents/pm.md)** §5
- Execution plan templates: **[`agents/pm.md`](agents/pm.md)** §5

### Variant Management
- L1-L2 fork model: **[`docs/adr/0031-l1-l2-fork-model.md`](docs/adr/0031-l1-l2-fork-model.md)**
- YAML extends pattern: **[`docs/adr/0033-variant-specific-skills-scripts-blueprint.md`](docs/adr/0033-variant-specific-skills-scripts-blueprint.md)**
- PM variant overrides: **[`templates/common/docs/variants/pm-yaml-schema.md`](templates/common/docs/variants/pm-yaml-schema.md)**
```

---

## §6: Migration Guide Outline

### User Transition Documentation

#### Navigation Changes

**Old Structure → New Structure**:
- Previous §1 (Agent Roster) → New §1 (Agent Ecosystem Overview)
- Previous §2 (Individual Agent Definitions) → New §2 (streamlined)
- Previous §3 (PM Gateway Workflow) → New §3 (summarized with deep links)
- Previous §4-10 (Various workflows) → New §4 (Cross-Reference only)

**Reading Pattern Changes**:
- **Old**: Scroll through all content in AGENTS.md
- **New**: AGENTS.md as navigation hub → Follow links to specialist documentation

**Key Behavioral Changes**:
1. **Quick reference**: Use §1 for agent/variant overview
2. **Detailed specifications**: Follow links from §2 to agent definition files
3. **PM workflow**: Read §3 summary → Link to agents/pm.md for details
4. **Specific topics**: Use §4 Cross-Reference to find SSOT location

#### Content Location Guide

**"Where do I find..." Quick Reference**:

| Looking for... | Old Location | New Location |
|----------------|--------------|--------------|
| List of available agents | §1 Agent Roster | §1 Agent Ecosystem Overview |
| Detailed agent specifications | §2 Individual Agent Definitions | §2 + links to `agents/*.md` |
| PM Gateway workflow | §3 PM Gateway Workflow | §3 summary + `agents/pm.md` §3 |
| Execution plan templates | §5 Execution Plan Templates | `agents/pm.md` §5, CLAUDE.md §5, GEMINI.md §5 |
| 3-Tier Strategy | §3.6 3-Tier Strategy | CONSTITUTION.md §5 |
| Language Policy | §4 Language Policy | CLAUDE.md §4, GEMINI.md §4 |
| Skill list and versions | §6 Skills | docs/VERSION_MANIFEST.md |
| Agent lifecycle processes | §8 Lifecycle Management | CONSTITUTION.md §5.6, agents/lifecycle-manager.md |
| Platform-specific behavior | Throughout | CLAUDE.md, GEMINI.md (platform docs) |
| Variant management | §4 PM Subagent Dispatch | docs/adr/0031-*, templates/common/docs/variants/pm-yaml-schema.md |

#### New Reading Patterns

**Pattern 1: Quick Agent Lookup**
1. Start at §1 Agent Ecosystem Overview
2. Find agent in table
3. Go to §2 for quick summary
4. Follow link to `agents/<name>.md` for details

**Pattern 2: PM Workflow Reference**
1. Read §3.1-§3.5 summaries (2-3 sentences each)
2. Follow link to `agents/pm.md` for full workflow
3. Return to AGENTS.md for cross-references

**Pattern 3: Topic Research**
1. Use §4 Cross-Reference to find SSOT location
2. Navigate to referenced document
3. Use specialist documentation as primary source

**Pattern 4: Lifecycle Management**
1. Check §4 for lifecycle reference links
2. Navigate to CONSTITUTION.md or agents/lifecycle-manager.md
3. Follow detailed processes in specialist documentation

#### Breaking Changes

**User Impact**:
- **High**: Users accustomed to single-document reference must now navigate multiple documents
- **Medium**: Learning curve for new cross-reference pattern
- **Low**: Content relocation requires relearning locations

**Mitigation Strategies**:
1. **Migration guide**: This document provides comprehensive transition documentation
2. **Clear cross-references**: All links explicit and validated
3. **Summary retention**: 2-3 sentence summaries maintain context
4. **Release communication**: CHANGELOG.md announcement with examples

#### Adaptation Timeline

**Week 1-2: Learning Phase**
- Users reference both old and new structure
- Migration guide heavily used
- Questions about content location expected

**Week 3-4: Adaptation Phase**
- Users become familiar with cross-reference pattern
- Reduced reliance on migration guide
- New navigation patterns established

**Week 5+: Normalization**
- New structure becomes standard practice
- AGENTS.md used primarily as navigation hub
- Specialist documentation used for detailed reference

#### Support Resources

**Immediate Support**:
- Migration guide (this document)
- CHANGELOG.md announcement
- ADR-0035 rationale and decision

**Ongoing Support**:
- Link validation scripts (prevent broken references)
- Regular cross-reference audits
- Feedback collection on navigation patterns

**Escalation Path**:
- Content location questions → Check §4 Cross-Reference
- Missing content → Validate against reference targets
- Broken links → Run link validation script
- Navigation difficulties → Review migration guide examples

---

## Implementation Validation Checklist

### Phase 1: Structure Validation

- [ ] §1 contains only tables (Workspace Root Agents + L1 Template Variants)
- [ ] §2 contains structured agent entries with direct links
- [ ] §3 contains 2-3 sentence summaries with deep links
- [ ] §4 contains structured cross-reference lists
- [ ] Total line count: 300-400 lines (70-80% reduction achieved)

### Phase 2: Content Validation

- [ ] All removed content properly redirected to SSOT
- [ ] No duplicate content across sections
- [ ] All summaries retain essential information
- [ ] Cross-reference links are accurate and specific
- [ ] No broken references to non-existent sections

### Phase 3: Link Validation

- [ ] All `agents/*.md` links exist and contain referenced content
- [ ] All CONSTITUTION.md section links are accurate
- [ ] All CLAUDE.md/GEMINI.md section links are accurate
- [ ] All docs/adr/*.md links exist
- [ ] All docs/variant/*.md links exist
- [ ] Relative paths use correct syntax (./ or ../)

### Phase 4: Completeness Validation

- [ ] All agents from current AGENTS.md represented in §1
- [ ] All agents have entries in §2 with definitions
- [ ] All PM Gateway subsections summarized in §3
- [ ] All cross-reference targets documented in §4
- [ ] YAML frontmatter complete and accurate

### Phase 5: Migration Validation

- [ ] Migration guide complete and clear
- [ ] CHANGELOG.md entry created
- [ ] User communication prepared
- [ ] Rollback procedure documented
- [ ] Feedback collection mechanism established

---

## Success Criteria

### Quantitative Metrics

- **Line count reduction**: 70-80% (1500 → 300-400 lines)
- **Section count**: 4 sections (down from 10)
- **Duplication elimination**: 100% of identified duplicates removed
- **Link accuracy**: 100% of cross-references validated
- **Content completeness**: 100% of essential information retained via summaries/links

### Qualitative Metrics

- **Navigation clarity**: Users can find information within 3 clicks
- **SSOT adherence**: Each topic has one clear primary source
- **Maintainability**: Content updates require single-file changes
- **User adaptation**: Migration friction resolved within 2 weeks
- **Documentation quality**: Clear structure with explicit purposes

### Risk Mitigation

- **Link rot**: Regular validation scripts in CI/CD
- **User confusion**: Comprehensive migration guide
- **Content loss**: Validation checklist ensures completeness
- **Maintenance burden**: Reduced through SSOT approach
- **Platform divergence**: Explicit platform-specific references

---

## Design Principles

### Core Design Philosophy

1. **Single Source of Truth**: Each topic has one authoritative location
2. **Navigation Hub**: AGENTS.md becomes entry point, not content repository
3. **Reference Clarity**: All cross-references explicit and validated
4. **Scale Appropriateness**: 70-80% size reduction while retaining essential information
5. **User-Centric**: Migration focused on user experience and adaptation

### Architectural Alignment

This design aligns with:
- **ADR-0035**: Structural restructure decision
- **CONSTITUTION.md**: SSOT principles and governance architecture
- **CLAUDE.md/GEMINI.md**: Platform parity and localization
- **ADR-0031**: L1-L2 fork model principles
- **ADR-0033**: Variant-specific blueprint architecture

### Maintenance Implications

**Reduced Maintenance Burden**:
- No duplicate content synchronization required
- Single-file updates for specialist documentation
- Clear ownership of each topic
- Automated link validation

**Improved Governance**:
- Clear SSOT for each topic
- Explicit reference chains
- Validated cross-document dependencies
- Reduced merge conflicts

---

**Design End**: This structural design specification is ready for implementation by docs-writer (Medium tier) following PM Gateway workflow per ADR-0035 Phase 3.