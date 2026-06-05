---
name: [VARIANT-NAME]-execution-plan
description: [Brief 1-line description of variant purpose and target users]
metadata:
  type: project
  domain: [design | work | safety | security | consulting | other]
  created: YYYY-MM-DD
  last_updated: YYYY-MM-DD
  status: [Draft | Plan Confirmed | In Progress | Completed]
  language: English (primary), Korean (translation optional)
---

# [Variant Name] Execution Plan

**Created**: YYYY-MM-DD
**Last Updated**: YYYY-MM-DD
**Current Status**: [Draft | Plan Confirmed | In Progress | Completed]
**Language**: [Link to translated version if any, e.g., [variant-name]-plan_ko.md]

---

## 1. Background & Objectives

### 1.1 Why (Problem Statement)

[TARGET AUDIENCE] faces [SPECIFIC PROBLEM]. [VARIANT NAME] addresses [PAIN POINTS] by [SOLUTION APPROACH].

**Guidelines**:
- **TARGET AUDIENCE**: Who are we building this for? (e.g., "Safety managers in manufacturing companies")
- **PROBLEM**: What specific pain points do they face? (e.g., "Manual handling of 20-40 EHS regulations")
- **PAIN POINTS**: Concrete examples of daily struggles
- **SOLUTION APPROACH**: High-level strategy (e.g., "AI Agent-based automation")

**Example (Safety OS)**:
> South Korea's EHS sector faces rapidly increasing legal liability since the Serious Accidents Punishment Act took effect in 2022. Safety managers handle 20–40 regulations manually while performing daily tasks such as risk assessments, permit-to-work issuance, and equipment inspections. An AI Agent-based Safety Operating System (Safety OS) automates these workflows and establishes auditable evidence trails.

### 1.2 What (Deliverables)

```
Deliverables:
  vX.Y  [Deliverable 1] — [Brief description]
  vX.Y  [Deliverable 2] — [Brief description]
  vX.Y  [Deliverable 3] — [Brief description]
  v4.0  Complete [Variant Name] Playbook (auto-assembled)
```

**Guidelines**:
- Version your deliverables (v3.0, v3.1, etc.)
- Prioritize by execution order (architecture first, then implementation)
- Include documentation as deliverables
- v4.0 typically represents complete, production-ready system

**Example (Safety OS)**:
```
Deliverables:
  v3.0  Safety OS Architecture Blueprint     (Enterprise Reference Architecture, ~25p Draft)
  v3.1  Workflow Catalog                     (Manufacturing complete, 4 industries scaffold)
  v3.2  Skill Catalog                        (4 core skills)
  v3.3  Agent Prompt Pack                    (PM/SGM/SWM + 4 core agents)
  v3.4  GitHub Repository Starter Kit        (Projects/safety-os/ implementation)
  v4.0  Complete Safety OS Playbook          (Phase 2 — auto-assembled via generate-playbook.ts)
```

### 1.3 How (Development Approach)

**Methodology**: Follow existing workspace **Harness Engineering methodology**:
- Discover → Reuse → Adapt → Create
- GitHub-Native: All artifacts version-controlled
- Evidence-Based: Every workflow linked to audit evidence
- Platform-Neutral: Works on both Claude Code and Antigravity

**[VARIANT-SPECIFIC PRINCIPLE 1]**: [Unique methodology element specific to your variant]

**[VARIANT-SPECIFIC PRINCIPLE 2]**: [Another unique principle, if applicable]

**Guidelines**:
- Start with workspace standard methodology (above)
- Add 1-2 variant-specific principles that make your approach unique
- Principles should be concise (1-2 sentences each)

**Example (Safety OS)**:
> Follows the existing workspace **Harness Engineering methodology**:
> - Discover → Reuse → Adapt → Create
> - GitHub-Native: all artifacts version-controlled
> - Evidence-Based: every workflow linked to audit evidence
> - Platform-Neutral: works on both Claude Code and Antigravity
>
> **Safety-Specific Principles**:
> - **Legal-Based**: Every workflow references specific Korean EHS law articles
> - **Audit-First**: All agent actions generate immutable evidence trails

---

## 2. Overall Architecture

### 2.1 Governance Hierarchy

[Variant-specific governance structure showing decision-making flow and agent roles]

**Guidelines**:
- Define agent hierarchy (who reports to whom)
- Specify decision rights (who approves what)
- Show emergency response paths (if applicable)
- Indicate which agents are required vs optional

**Pattern**:
```
[Top-Level Agent]  ←  [Chief Role]
  │
  ├── [Strategy Agent]  ←  Strategic decisions
  │     - [Strategy responsibility 1]
  │     - [Strategy responsibility 2]
  │
  └── [Execution Agent]  ←  Operational dispatch
        - [Execution responsibility 1]
        - [Execution responsibility 2]

[Top-Level] → [Strategy]: when strategic decisions needed
[Top-Level] → [Execution]: for all operational dispatch
```

**Example (Safety OS)**:
```
PM Agent  ←  Chief Safety Officer (CSO) role
  │
  ├── Safety Governance Manager (SGM)  ←  Strategy
  │     - Select Industry Profile
  │     - Define KPIs and compliance objectives
  │     - Approve policies and standards
  │
  └── Safety Workflow Manager (SWM)   ←  Execution
        - Select and execute workflows
        - Dynamically assemble Agent Teams
        - Manage task progress and evidence collection
```

### 2.2 [Architecture Definition]

[Variant-specific architecture definition: layers, tiers, components, or other structural elements]

**Guidelines**:
- Choose architecture type appropriate for your variant:
  - **Layer Architecture**: For tiered systems (e.g., 5-layer architecture)
  - **Workflow Architecture**: For process-oriented variants (e.g., 3-tier workflow)
  - **Component Architecture**: For modular systems (e.g., component hierarchy)
  - **Network Architecture**: For connected systems (e.g., node-edge architecture)
- Define 3-7 key architectural elements
- Show relationships between elements
- Include diagrams (text-based) if helpful

**Pattern Options**:

**Option 1: Layer Architecture**
```
Layer 1  [Layer Name]           [Description]
Layer 2  [Layer Name]           [Description]
Layer 3  [Layer Name]           [Description]
...
```

**Option 2: Tier Architecture**
```
Tier 1  [Tier Name]   80%  → [Description]
Tier 2  [Tier Name]   10%  → [Description]
Tier 3  [Tier Name]   10%  → [Description]
```

**Option 3: Component Architecture**
```
[Component A]
  ├─ [Subcomponent A-1]
  └─ [Subcomponent A-2]
[Component B]
  ├─ [Subcomponent B-1]
  └─ [Subcomponent B-2]
```

**Example (Safety OS)**:
> ### 5-Layer Architecture
> ```
> Layer 1  Agent Pool           15 agents (MVP: 7)
> Layer 2  Industry Profile     5 industry definition files (MVP: manufacturing only)
> Layer 3  Workflow Library     SSOT — the most critical layer
> Layer 4  Scenario Library     Emergency response scenarios
> Layer 5  Evidence Graph       Audit traceability — Finding → Corrective Action
> ```
>
> ### Workflow 3-Tier (80:20 Rule)
> ```
> Daily Operations  80%  →  workflows/daily/
> Compliance  10%  →  workflows/compliance/
> Emergency  10%  →  workflows/emergency/
> ```

### 2.3 Agent Prompt 3-Section Structure (Platform-Neutral)

Every agent `.md` file follows this structure for platform parity:

```markdown
## Section A: Role & Responsibility
# Platform-agnostic — identical for Claude Code and Antigravity
# Role, responsibilities, I/O contract, legal basis

## Section B: Claude Code Integration
# Skill invocation: /skill-name
# Agent dispatch: Agent tool
# Tool use: Read, Write, Bash

## Section C: Antigravity Integration
# Skill invocation: activate_skill skill-name
# Agent dispatch: agent_manager
# Tool use: read_file, write_file, run_command
```

**Requirement**: All variant-specific agents must follow this 3-section structure.

---

## 3. Development Strategy

### 3.1 Phase A — Independent Prototype

**Location**: `Projects/[variant-name]/`

**Principle**: Develop independently without touching workspace root.

**Rationale**:
- Fast experimentation and structural validation
- No workspace impact on failure
- Only stable, validated outputs promoted to workspace

**Activities**:
- A-1. Design document creation (this file)
- A-2. New project creation via `new-project.sh/ps1`
- A-3. Project refinement (agents/, skills/, config)
- A-4. Quality gates (Prototype Completeness, Platform Parity)

**Common Drift Prevention**:
To prevent divergence from workspace root common/ files:

- **`_ORIGIN.md`**: List of files copied from workspace root
  ```markdown
  # Files Copied from Workspace Root
  
  ## Root Configuration
  - CLAUDE.md
  - GEMINI.md
  - AGENTS.md
  - CHANGELOG.md
  ```

- **`_COMMON_VERSION.md`**: Workspace common version snapshot
  ```markdown
  # Workspace Common Version Snapshot
  
  **Date**: YYYY-MM-DD
  **Git Commit**: [commit-hash]
  **Scripts Version**: [from scripts/SCRIPTS.md]
  ```

### 3.2 Phase B — Workspace Integration & Promotion Decision

**Prerequisites** (Before Promotion):
1. Phase A quality gates pass (A-1, A-2)
2. Promotion checklist passes (7 criteria — see PROMOTION_CHECKLIST.md)
3. Common drift verified (_ORIGIN.md, _COMMON_VERSION.md accurate)
4. Platform parity confirmed (works on both Claude Code and Antigravity)

**Promotion Checklist** (7 Criteria):
1. Folder Structure Compliance
2. Agent Completeness (3-section structure)
3. Skill Completeness (platform-agnostic)
4. Common Drift Prevention (tracking files present)
5. Platform Parity (both platforms work)
6. Documentation Completeness (all docs present)
7. Test Coverage (basic integration tests pass)

**Full Checklist**: See `docs/templates/PROMOTION_CHECKLIST-template.md`

**Promotion Decision**:
- **PASS**: Proceed to Phase C (Template Creation)
- **FAIL**: Rollback to Phase A, fix issues, repeat refinement

### 3.3 Phase C — Template Creation & Validation

**Location**: `templates/co-[variant-name]/`

**Activities**:
- C-1. Template creation (copy from `Projects/[variant-name]/`)
- C-2. Workspace root reflection (update CONSTITUTION.md, CLAUDE.md, GEMINI.md if needed)
- C-3. Validation (run `validate-templates.ts`)
- C-4. New project test (generate test project to verify end-to-end workflow)

**Propagation Path**:
```
L1 (Workspace Root)      ← Editing SSOT
      ↓
L2 (templates/co-xxx/)   ← Variant definition
      ↓
L3 (Projects/xxx/)       ← Creation-time snapshot
```

**Quality Gates**:
- C-1: Template Validation (structure, integrity, integration)
- C-2: Integration Test (new project generation and functionality)

**Full Quality Gates**: See `docs/templates/QUALITY_GATES-template.md`

---

## 4. Folder Structure

### 4.1 Structure Overview

**[Variant Name] Project Structure**:

```
Projects/[variant-name]/
│
├── # ── Tracking Files (New)
├── _ORIGIN.md                     ← List of files copied from common
├── _COMMON_VERSION.md             ← Workspace common version + git hash
├── PROMOTION_CHECKLIST.md         ← 7 Phase B criteria
│
├── # ── Common Inherited (Copied from Workspace Root)
├── CLAUDE.md                      ← Variant context addition only
├── GEMINI.md                      ← Parity with CLAUDE.md
├── AGENTS.md                      ← Includes [variant] agent roster
├── CHANGELOG.md
├── .gitignore
├── .env.sample
│
├── # ── Memory (Variant Extended)
├── memory/
│   ├── MEMORY.md
│   ├── [variant-specific dirs]/   ← e.g., incidents/, findings/
│
├── # ── Agent Definitions
├── agents/
│   ├── pm.md                      ← [Copied + CSO override added]
│   ├── [variant]-manager.md        ← [New] Strategy or execution agent
│   ├── [domain-agent-1].md        ← [New] Domain specialist
│   ├── [domain-agent-2].md        ← [New] Domain specialist
│   └── ...
│
├── # ── Skill Definitions (3-Section Platform-Neutral)
├── skills/
│   ├── [skill-1]/SKILL.md
│   ├── [skill-2]/SKILL.md
│   └── ...
│
└── # ── [Variant-Specific Directories]
    └── [domain-specific]/
        └── [variant-specific files]
```

### 4.2 Common Inherited Files

**Minimal Modification Policy**:
Files copied from workspace root should have **minimal changes**:

- **CLAUDE.md**: Add variant context in new section (don't remove existing content)
- **GEMINI.md**: Maintain parity with CLAUDE.md
- **AGENTS.md**: Add variant agent roster (don't remove existing agents)
- **CHANGELOG.md**: Standard changelog format

**Do NOT**:
- Remove workspace-root specific sections
- Modify common workflow definitions
- Change core governance rules (unless variant introduces new governance)

### 4.3 [Variant-Specific Structure Pattern]

[If your variant has specific directory structure patterns, describe them here]

**Guidelines**:
- Define 3-7 key directories
- Explain purpose of each directory
- Include naming conventions
- Note any special file types

**Example (Safety OS)**:
> ### Regulation Registry
> ```
> regulations/
> ├── _REGISTRY.md               ← Master regulation list
> └── KR/
>     └── tier1-laws/
>         ├── occupational-safety-health-act.yaml
>         └── serious-accidents-punishment-act.yaml
> ```
>
> ### Industry Profiles
> ```
> industry-profiles/
> └── manufacturing.yaml         ← MVP: manufacturing only
> ```

---

## 5. Agent & Skill Catalogs

### 5.1 Agent Definitions

**[Variant Name] Agent Pool**:

| Agent | Role | Tier | Section | Description |
|-------|------|------|---------|-------------|
| pm | Project Manager | High | A+B+C | Overall orchestration, [variant-specific override] |
| [agent-1] | [Role] | [High/Med/Low] | A+B+C | [1-line description] |
| [agent-2] | [Role] | [High/Med/Low] | A+B+C | [1-line description] |
| ... | ... | ... | ... | ... |

**Guidelines**:
- **Section**: A = Role & Responsibility, B = Claude Code Integration, C = Antigravity Integration
- **Tier**: High (design/decisions), Medium (execution), Low (routine tasks)
- Start with PM agent (always required)
- Add 3-7 variant-specific agents

**Example (Safety OS)**:
| Agent | Role | Tier | Section | Description |
|-------|------|------|---------|-------------|
| pm | Chief Safety Officer | High | A+B+C | PM with CSO role override for Safety OS |
| safety-governance-manager | Strategy Agent | High | A+B+C | Selects Industry Profile, defines KPIs, approves policies |
| safety-workflow-manager | Execution Agent | High | A+B+C | Selects workflows, assembles Agent Teams, manages progress |
| compliance-agent | Regulatory Specialist | Medium | A+B+C | Ensures workflows align with Korean EHS laws |
| risk-assessment-agent | Risk Specialist | Medium | A+B+C | Conducts risk assessments using established methodologies |
| emergency-agent | Response Specialist | Medium | A+B+C | Manages emergency scenarios and response protocols |
| audit-agent | Audit Specialist | Low | A+B+C | Conducts audits and maintains evidence trails |

### 5.2 Skill Definitions

**[Variant Name] Skill Catalog**:

| Skill | Trigger | Owner | Description |
|-------|---------|-------|-------------|
| [skill-1] | [Invocation trigger] | [agent] | [1-line description] |
| [skill-2] | [Invocation trigger] | [agent] | [1-line description] |
| ... | ... | ... | ... |

**Guidelines**:
- **Trigger**: How users invoke the skill (e.g., "/risk-assessment", "conduct assessment")
- **Owner**: Which agent owns this skill
- **Description**: 1-line summary of what the skill does
- Include 4-7 core skills (not all skills need to be listed)

**Example (Safety OS)**:
| Skill | Trigger | Owner | Description |
|-------|---------|-------|-------------|
| risk-assessment | /risk-assessment | risk-assessment-agent | Conducts comprehensive risk assessment using Korean EHS standards |
| permit-to-work | /permit-to-work | safety-workflow-manager | Issues permit-to-work for high-risk activities |
| emergency-response | /emergency | emergency-agent | Manages emergency response scenarios (fire, chemical, etc.) |
| compliance-gap | /compliance-check | compliance-agent | Identifies compliance gaps against Korean EHS regulations |

---

## 6. Execution Roadmap

### 6.1 Phased Approach

**[Variant Name] Development Roadmap**:

**Phase 1: [Phase Name]** (Week 1-2)
- **Objective**: [What this phase achieves]
- **Key Activities**:
  - [Activity 1]
  - [Activity 2]
  - [Activity 3]
- **Deliverable**: [vX.Y output]
- **Success Criteria**: [How to measure success]

**Phase 2: [Phase Name]** (Week 3-4)
- **Objective**: [What this phase achieves]
- **Key Activities**:
  - [Activity 1]
  - [Activity 2]
  - [Activity 3]
- **Deliverable**: [vX.Y output]
- **Success Criteria**: [How to measure success]

**Phase 3: [Phase Name]** (Week 5-6)
- **Objective**: [What this phase achieves]
- **Key Activities**:
  - [Activity 1]
  - [Activity 2]
  - [Activity 3]
- **Deliverable**: [vX.Y output]
- **Success Criteria**: [How to measure success]

**Phase 4: [Phase Name]** (Week 7-8)
- **Objective**: [What this phase achieves]
- **Key Activities**:
  - [Activity 1]
  - [Activity 2]
  - [Activity 3]
- **Deliverable**: [vX.Y output]
- **Success Criteria**: [How to measure success]

**Phase 5: Deployment & Operations** (Week 9-10)
- **Objective**: [What this phase achieves]
- **Key Activities**:
  - [Activity 1]
  - [Activity 2]
  - [Activity 3]
- **Deliverable**: [v4.0 Complete System]
- **Success Criteria**: [How to measure success]

**Guidelines**:
- Define 5 phases (or fewer for simpler variants)
- Each phase: 1-2 weeks
- Start with architecture/design phases
- End with deployment/operations
- Include success criteria for each phase

**Example Pattern**:

**Phase 1: Discovery & Requirements** (Week 1-2)
- **Objective**: Understand user needs and regulatory requirements
- **Key Activities**:
  - User interviews with [target audience]
  - Regulatory research (e.g., Korean EHS laws)
  - Competitor analysis
- **Deliverable**: v1.0 Requirements Document
- **Success Criteria**: All key requirements identified and validated

**Phase 2: Architecture Design** (Week 3-4)
- **Objective**: Design system architecture and agent interactions
- **Key Activities**:
  - Define governance hierarchy
  - Design agent roles and responsibilities
  - Design skill catalog
- **Deliverable**: v2.0 Architecture Blueprint
- **Success Criteria**: Architecture approved by stakeholders

**Phase 3: Core Implementation** (Week 5-6)
- **Objective**: Implement core agents and skills
- **Key Activities**:
  - Implement PM agent with [variant] override
  - Implement [strategy/execution] agents
  - Implement core skills
- **Deliverable**: v3.0 Prototype (Projects/[variant]/)
- **Success Criteria**: All agents and skills functional in test environment

**Phase 4: Integration & Testing** (Week 7-8)
- **Objective**: Integrate components and validate system
- **Key Activities**:
  - Integration testing
  - Platform parity testing
  - User acceptance testing
- **Deliverable**: v3.1 Tested System
- **Success Criteria**: All tests pass, users approve

**Phase 5: Deployment & Operations** (Week 9-10)
- **Objective**: Deploy to production and establish operations
- **Key Activities**:
  - Create template (templates/co-[variant]/)
  - Propagate to workspace root
  - Documentation and handoff
- **Deliverable**: v4.0 Complete [Variant Name] System
- **Success Criteria**: System production-ready, documentation complete

---

## 7. Usage Guide

### 7.1 How to Use This Template

This template provides a structured framework for creating execution plans for new variants. Follow these 4 steps:

**Step 1: Copy Template**
```bash
# Copy template to your memory/ directory
cp docs/templates/variant-execution-plan-template.md memory/[your-variant-name]-plan.md
```

**Step 2: Fill Parameters**
Replace all `[BRACKETED]` placeholders with your variant-specific information:
- **Frontmatter**: name, description, domain, dates, status
- **Section 1 (Background)**: TARGET AUDIENCE, PROBLEM, PAIN POINTS, SOLUTION APPROACH
- **Section 2 (Architecture)**: Governance hierarchy, Architecture definition
- **Section 3 (Strategy)**: Variant-specific principles
- **Section 4 (Structure)**: Folder structure, variant-specific directories
- **Section 5 (Catalogs)**: Agent pool, skill catalog
- **Section 6 (Roadmap)**: Phases with objectives, activities, deliverables

**Step 3: Write Variant-Specific Content**
- **Section 1.1 (Why)**: Write problem statement (2-3 paragraphs)
- **Section 1.2 (What)**: List deliverables (4-7 items)
- **Section 1.3 (How)**: Describe methodology + add 1-2 variant-specific principles
- **Section 2.1 (Governance)**: Define agent hierarchy with text-based diagram
- **Section 2.2 (Architecture)**: Choose architecture type (layer/tier/component) and define 3-7 elements
- **Section 4 (Structure)**: Adapt folder structure pattern to your variant
- **Section 5 (Catalogs)**: List agents (4-7) and skills (4-7)
- **Section 6 (Roadmap)**: Define 5 phases with objectives, activities, deliverables

**Step 4: Review and Validate**
- Check all `[BRACKETED]` placeholders are replaced
- Ensure 3-section agent structure is documented (Section 2.3)
- Verify Phase A→B→C workflow is appropriate for your variant
- Validate against promotion checklist (7 criteria)
- Have architect or pm review before execution

### 7.2 Language Strategy

**Primary Language**: English
- This template is in English
- Execution plans should be written in English first
- English version is the source of truth

**Translation Optional**:
- If bilingual support is needed, create `[variant-name]-plan_ko.md` (Korean) or other language
- Language header in English version: `**Korean version**: [variant-name]-plan_ko.md`
- Keep both versions in sync when updating

**Language Selection Guidelines**:
- Use English for:
  - Technical terminology
  - Architecture diagrams
  - Agent/skill definitions
  - Code comments
- Use native language (if not English) for:
  - User-facing examples
  - Case studies
  - Local regulatory references (e.g., Korean EHS laws for Safety OS)

### 7.3 Common Patterns

**Architecture Type Selection**:
Choose the architecture type that fits your variant:

- **Layer Architecture**: For systems with clear separation of concerns (e.g., safety, security)
- **Tier Architecture**: For workflow/process systems (e.g., content management)
- **Component Architecture**: For modular systems (e.g., design systems)
- **Network Architecture**: For connected systems (e.g., communication platforms)

**Agent Tier Guidelines**:
- **High-tier (opus)**: Design, architecture, strategic decisions
- **Medium-tier (sonnet)**: Implementation, review, standard execution
- **Low-tier (haiku)**: Simple transformations, routine tasks

**Phase Duration Guidelines**:
- **Discovery/Requirements**: 1-2 weeks
- **Architecture/Design**: 1-2 weeks
- **Implementation**: 2-4 weeks (scales with complexity)
- **Integration/Testing**: 1-2 weeks
- **Deployment/Operations**: 1-2 weeks

---

## 8. Examples

### 8.1 Example 1: Complex Variant (Safety OS)

**Extracted from**: `memory/safety-os-plan.md`

**Variant Type**: Enterprise Safety Operating System
**Domain**: safety (EHS compliance)
**Complexity**: High (5-layer architecture, 7 agents, 4 skills)

**Key Characteristics**:
- **Governance**: 3-tier hierarchy (PM → SGM → SWM)
- **Architecture**: 5-layer + 3-tier workflow
- **Agents**: 7 agents (PM, SGM, SWM, Compliance, Risk, Emergency, Audit)
- **Skills**: 4 skills (risk-assessment, permit-to-work, emergency-response, compliance-gap)
- **Unique Principles**: Legal-based, Audit-first

**Architecture Pattern**: Layer Architecture
```
Layer 1  Agent Pool           15 agents (MVP: 7)
Layer 2  Industry Profile     5 industry definition files (MVP: manufacturing only)
Layer 3  Workflow Library     SSOT — the most critical layer
Layer 4  Scenario Library     Emergency response scenarios
Layer 5  Evidence Graph       Audit traceability
```

**Development Duration**: 10 weeks (5 phases × 2 weeks each)

---

### 8.2 Example 2: Simple Variant (Hypothetical)

**Variant Type**: Task Management System
**Domain**: work (productivity)
**Complexity**: Medium (2-layer architecture, 3 agents, 2 skills)

**Key Characteristics**:
- **Governance**: 2-tier hierarchy (PM → Task Manager)
- **Architecture**: 2-layer (Tasks + Projects)
- **Agents**: 3 agents (PM, Task Manager, Team Lead)
- **Skills**: 2 skills (create-task, update-status)
- **Unique Principles**: Efficiency-first, Real-time collaboration

**Architecture Pattern**: Tier Architecture
```
Tier 1  Task Execution     80%  → Daily task management (create, assign, complete)
Tier 2  Project Management  15%  → Project oversight and reporting
Tier 3  Team Coordination    5%  → Team communication and handoffs
```

**Development Duration**: 6 weeks (3 phases × 2 weeks each)

---

## 9. References

- **Variant Creation Workflow**: `docs/variant-creation-workflow.md` (3-Phase process)
- **Promotion Checklist**: `docs/templates/PROMOTION_CHECKLIST-template.md` (7 criteria)
- **Quality Gates**: `docs/templates/QUALITY_GATES-template.md` (validation checkpoints)
- **CONSTITUTION.md**: Workspace constitution and governance
- **AGENTS.md**: Agent roster and definitions

---

## Appendix: Template Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-05 | Initial template creation | pm |

---

*Template Owner: pm*
*Last Updated: 2026-06-05*
*Status: Active*
