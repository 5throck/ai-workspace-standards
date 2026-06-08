# PM.md Operations Design Guide

## Part 1: Quick Start & Status (NEW - 최상단)

### Quick Start Guide

This section provides immediate guidance for different user personas and current implementation status.

#### 🟢 Stable Path (v1.0.0 ONLY)
**Target Audience**: First-time users, production environments
**Availability**: Immediately usable, fully verified

**New L2 Variant? 3-Step Quick Start (v1.0.0)**
1. Create L2 template: `templates/co-new/agents/pm.md`
2. Configure YAML (currently use `remove_sections`)
3. Run `new-project.sh` to test scaffolding

**L0 Role Leakage? 1-Minute Fix**
- Check: Does generated pm.md contain "ai-workspace-standards"?
- Fix: Add "## Role" to L1 `variant_overrides.remove_sections`

#### 🟡 Experimental Path (v1.2.0 - v1.5.0+)
**Target Audience**: Developers, experimental feature testing
**Warning**: Includes unimplemented features, requires manual implementation

**variant_sections Architecture (v1.2.0)**
- **Status**: 📋 PROPOSED - Design complete, not implemented
- **Effort**: Low (~30 minutes)
- **Prerequisites**: None
- **Note**: Remove implementation pending Phase 1+ completion

**Layout Reconstruction (v1.5.0+)**
- **Status**: 📋 PROPOSED - Architecture defined, not implemented
- **Effort**: Medium (requires rewrite)
- **Prerequisites**: v1.2.0 implementation complete

#### 🔧 For Maintainers
**Target Audience**: Documentation maintainers
**Update Procedure**: See [Implementation Status Matrix](#implementation-status-matrix) below

---

### Implementation Status Matrix

| Feature | Version | Status | Verified | Notes |
|---------|---------|--------|----------|-------|
| Three-Layer Architecture | 1.0.0 | ✅ Implemented | 2026-06-08 | All variants scaffolding correctly |
| YAML Frontmatter | 1.0.0 | ✅ Implemented | 2026-06-08 | L1/L2 templates working |
| L0→L1→L2 Extends Chain | 1.0.0 | ✅ Implemented | 2026-06-08 | Chain resolution functional |
| Basic Extends Validation | 1.0.0 | ✅ Implemented | 2026-06-08 | Circular reference protection exists |
| variant_sections Rename | 1.2.0 | ✅ Documented | 2026-06-08 | Terminology standardized in design doc |
| Layout Reconstruction | 1.5.0+ | ✅ Designed | 2026-06-08 | **Comprehensive spec complete**: 6-component architecture with 5-phase implementation plan |
| YAML Injection Security | 1.3.0 | 📋 Proposed | - | P0 priority, awaiting implementation |
| Error Recovery Strategy | 1.3.0 | 📋 Proposed | - | P1 priority, awaiting implementation |
| Edge Case Handling | 1.4.0 | ✅ Documented | 2026-06-08 | **Phase 2 Complete**: All 10 cases documented with error types, behaviors, examples, and testing requirements |

---

### Version Stability Guide

| Version | Stability | Implementation Status | Production Ready | Notes |
|---------|-----------|----------------------|------------------|-------|
| v1.0.0 | 🟢 Stable | ✅ Fully Implemented | ✅ Yes | All features working |
| v1.1.0 | 🟡 Partial | ✅ Basic extends | ⚠️ Limited | Basic chain resolution only |
| v1.2.0 | 🔴 Proposed | 📋 Design Only | ❌ No | variant_sections not implemented |
| v1.3.0 | 🔴 Proposed | 📋 Design Only | ❌ No | Security & error recovery not implemented |
| v1.5.0+ | 🔴 Proposed | 📋 Architecture Only | ❌ No | Layout reconstruction not implemented |
| v2.0.0+ | 🔴 Future | 📋 Roadmap Only | ❌ No | Long-term improvements (caching, observability) |

---

### User Intent-Based Navigation

**"I want to add a new L2 variant"**
→ 🟢 Stable Path → See [Layer Responsibilities](#layer-responsibilities) → Create L2 template with YAML config

**"I want to upgrade existing variant to variant_sections"**
→ 🟡 Experimental Path → See [YAML Frontmatter Schema](#yaml-frontmatter-schema) → Note: v1.2.0 not yet implemented

**"I have L0 leakage problems"**
→ 🟢 Stable Path → See [Common Pitfalls & Solutions](#common-pitfalls--solutions) → [Pitfall 1: L0 Role Leakage](#pitfall-1-l0-role-leakage)

**"I want to understand the architecture"**
→ See [Architecture Overview](#architecture-overview) → [ADR-0033](docs/adr/0033-l0-l1-l2-hierarchy.md)

**"I'm implementing variant_sections"**
→ 🟡 Experimental Path → See [ADR-0034](docs/adr/0034-pm-md-architecture-evolution.md) → Phase 1 implementation guide

---

## Part 2: Core Design Content

## Document Information

- **Status**: Final
- **Version**: 1.4.0
- **Last Updated**: 2026-06-08
- **Authors**: Architect, Automation Engineer, Auditor (Joint Review)
- **Related ADRs**: ADR-0031 (L1-L2 Fork Model), ADR-0033 (L0-L1-L2 Hierarchy)

## Executive Summary

This document provides comprehensive design guidelines for operating PM (Project Manager) agent configuration files (`pm.md`) across the three-layer template architecture (L0 workspace root → L1 common template → L2 variant templates). It addresses critical issues discovered during June 7-8, 2026, including L0 leakage, section duplication, and variant characteristic injection failures.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer Responsibilities](#layer-responsibilities)
3. [YAML Frontmatter Schema](#yaml-frontmatter-schema)
4. [Layout Reconstruction Process](#layout-reconstruction-process)
5. [Scaffolding Integration](#scaffolding-integration)
6. [Validation & QA Gates](#validation--qa-gates)
7. [Common Pitfalls & Solutions](#common-pitfalls--solutions)

---

## Architecture Overview

### Three-Layer Hierarchy

The PM.md file structure follows ADR-0033's L0→L1→L2 extends chain:

```
L0 (Workspace Root)
  ↓ extends
L1 (Common Template)
  ↓ extends
L2 (Variant Template)
  ↓ scaffolding
Generated PM.md in New Project
```

**Key Principles**:

1. **L0 (Workspace Root)**: Single source of truth for workspace governance, defines base PM orchestration rules for `ai-workspace-standards` repository maintenance
2. **L1 (Common Template)**: Pure template with only extends directive and variant overrides, acts as intermediary between L0 and L2
3. **L2 (Variant Template)**: YAML-only config file defining variant-specific characteristics, injected into generated projects via scaffolding

### L1-L2 Fork Model (ADR-0031)

After L2 scaffold creation from L1:
- The L1→L2 relationship **ends**
- L2 evolves independently
- L1 changes do **not** auto-propagate to L2
- To promote L2 changes back to template: explicit `l2-to-variant-pipeline.ts` execution

---

## Layer Responsibilities

### L0: Workspace Root PM (`agents/pm.md`)

**Purpose**: Define PM agent role for workspace standards repository maintenance

**Content Structure**:
```markdown
---
# Standard PM frontmatter (description, examples, etc.)
---

## Role
You are the PM orchestrator for the **ai-workspace-standards repository**...

## ⚠️ ROLE CLARIFICATION
Your domain is maintaining cross-platform template scripts...

## Agent Roster
| Phase | Agent | Responsibility |
|-------|--------|---------------|
| 0 | scaffolding-expert | Project scaffolding |
...

## Governance Workflow
Workspace-specific governance rules...

## Dispatch Protocol
Workspace dispatch rules...

### Phase Determination (Deliverable-Type Gate)
| Deliverable Type | → Phase | → Required Agent |
...

[Generic PM Rules]
## Consensus-Driven Facilitation Model
## Permission Denial Protocol
## Execution Plan Boilerplate Policy
...
```

**Key Sections**:
- **L0-Specific Sections** (must be stripped in variants):
  - `## Role`: References "ai-workspace-standards repository"
  - `## ⚠️ ROLE CLARIFICATION`: Mentions "cross-platform template scripts"
  - `## 🚨 YOU ARE THE SINGLE ENTRY POINT`: Domain-specific constraints
  - `## Agent Roster`: L0-specific agents (automation-engineer, docs-writer, etc.)
  - `## Governance Workflow`: Workspace-specific rules
  - `## Dispatch Protocol`: Workspace dispatch logic
  - `### Phase Determination (Deliverable-Type Gate)`: L0 agent mappings

- **Generic Sections** (retained in variants with agent substitution):
  - Consensus-Driven Facilitation Model
  - Permission Denial Protocol
  - Execution Plan Boilerplate Policy
  - Task Tracking vs Execution
  - User Communication

### L1: Common Template (`templates/common/agents/pm.md`)

**Purpose**: Pure extends file with variant override defaults

**Structure**:
```yaml
---
extends: ../../../agents/pm.md
formal_name: Project Manager (PM) Agent
variant_overrides:
  # Sections to update with variant-specific characteristics
  variant_sections:
    - "## Governance Workflow"
    - "## Updated Role"
    - "## Agent Roster"
    - "## Dispatch Protocol"
    - "### Phase Determination (Deliverable-Type Gate)"
  
  # Default role definition (inherited by L2 variants)
  role:
    description: "You are the PM orchestrator for this project. You own the end-to-end workflow from triage to PR creation..."
    scope: "Classify requests, dispatch specialist agents, synthesize findings, enforce quality gates"
---
```

**Key Fields**:
- `extends`: Path to L0 pm.md relative to template location
- `variant_overrides.variant_sections`: List of L0 sections to update with variant-specific content
- `variant_overrides.role`: Default role definition inherited by L2 variants

**Body Content**: **EMPTY** (pure config file)

### L2: Variant Template (`templates/co-*/agents/pm.md`)

**Purpose**: Define variant-specific PM characteristics

**Structure**:
```yaml
---
extends: ../../common/agents/pm.md
formal_name: Project Manager (PM) Agent
variant_overrides:
  # Sections to update with variant-specific characteristics
  variant_sections:
    - "## Governance Workflow"
    - "## Updated Role"
    - "## Agent Roster"
    - "## Dispatch Protocol"
    - "### Phase Determination (Deliverable-Type Gate)"
  
  # Variant-specific role definition
  role:
    description: "You are the PM orchestrator for this project..."
    scope: "Classify requests, dispatch specialist agents..."
  
  # Agent roster (variant-specific agents)
  agent_roster:
    - phase: Triage
      group: Strategy
      agents:
        - name: engagement-leader
          file: agents/engagement-leader.md
          responsibility: "Initial client assessment"
    - phase: Analysis
      group: Research
      agents:
        - name: industry-expert
          responsibility: "Domain knowledge consultation"
  
  # Governance workflow (variant-specific rules)
  governance_workflow:
    phases: [0, 1, 2, 4, 5, 6]
    client_approval_required: true
  
  # Dispatch protocol (variant-specific dispatch rules)
  dispatch_protocol:
    can_lead_phases: [0, 2, 6]
    auto_dispatch_to: [engagement-leader, solutions-architect]
---
```

**Body Content**: **EMPTY** (pure config file)

**Override Fields**:
- `variant_sections`: List of L0 sections to update with variant-specific content
- `role`: Variant-specific role description and scope
- `agent_roster`: Structured list of variant agents with phases, groups, responsibilities
- `governance_workflow`: Variant-specific governance rules
- `dispatch_protocol`: Variant dispatch rules

---

## YAML Frontmatter Schema

### Base Schema (All Layers)

```yaml
---
extends: string              # Path to parent pm.md file
formal_name: string          # Display name
description: string          # Short description
examples: array             # Usage examples
---
```

### L1/L2 Extended Schema (v1.2.0+)

```yaml
---
variant_overrides:
  # Sections to update with variant-specific content (v1.2.0+)
  variant_sections:
    - string              # Heading names to customize with variant content
  
  # Role definition
  role:
    description: string     # Variant-specific role description
    scope: string          # Variant-specific scope
  
  # Agent roster (NEW in v1.5.0)
  agent_roster:
    - phase: string
      group: string
      agents:
        - name: string
          file?: string    # Default: agents/${name}.md
          responsibility?: string
  
  # Governance rules
  governance_workflow:
    phases: array          # Active phase numbers
    client_approval_required: boolean
  
  # Dispatch protocol
  dispatch_protocol:
    can_lead_phases: array
    auto_dispatch_to: array
  
  # Frontmatter overrides (v1.4.0+)
  frontmatter_overrides:
    description: string
    examples: array
    # ... any top-level frontmatter key
---
```

---

## Layout Reconstruction Process

### Problem Statement

Prior to v1.5.0, the merge process had critical failures:
1. **L0 Role Leakage**: L0 `## Role` section remained in variants, describing "ai-workspace-standards repository"
2. **Agent Name Leakage**: L0 agent names (automation-engineer, docs-writer) appeared in variant constraints
3. **Section Duplication**: `## Agent Roster`, `## Governance Workflow` appeared twice
4. **Roster Format Issues**: No standard schema, inconsistent presentation
5. **L0 Content Duplication**: L2 variants contained 384 lines (full L0 content) instead of ~50-100 lines variant-specific content
6. **Phase Determination Table Leakage**: Table showed L0 agents instead of variant-specific agents

### Solution: Complete Layout Reconstruction (v1.5.0+)

**Design Strategy**: Complete reconstruction (not copy + remove)

**Key Architectural Changes**:

1. **L0→L1→L2 Content Propagation**:
   - L0: Single source of truth for workspace governance (384 lines)
   - L1: Byte-for-byte copy of L0 (YAML + body)
   - L2: Complete reconstruction from scratch (~50-100 lines variant-specific only)

2. **Trigger Points**:
   - **Trigger 1**: L2 template generation (create-l2-scaffold.ts)
   - **Trigger 2**: Project scaffold from L2 template (new-project.ps1/sh)

3. **Process Flow** (`merge-frontmatter.ts`):
   ```typescript
   const isPMFile = filePath.toLowerCase().endsWith('agents/pm.md');
   const hasVariantOverrides = !!yaml.variant_overrides;
   
   if (isPMFile && hasVariantOverrides && variantLevel === 'L2') {
     // Apply Complete Layout Reconstruction
     return reconstructPMLayout(yaml, baseContent, variantLevel);
   }
   ```

**6-Component Architecture**:

| Component | Purpose | Input | Output |
|-----------|---------|-------|--------|
| **Component 1**: Agent Type Extraction | Extract agent types from roster using Group → Type mapping | variant_overrides.agent_roster | Record<AgentType, string> |
| **Component 2**: Group → Type Mapping | Define comprehensive mapping for all 5 variants | groupName, variant, context | AgentType |
| **Component 3**: Agent Roster Table Generation | Generate 4-column table with responsibility field | variant_overrides.agent_roster | Markdown table |
| **Component 4**: Phase Determination Table Generation | Generate variant-specific agent mapping (no L0 agents) | agent_roster, variant | Markdown table |
| **Component 5**: L0-Only Content Removal | Remove L0-specific sections and terminology | L0 body content, variant | Cleaned content |
| **Component 6**: MANDATORY Dispatch List Generation | Generate variant-specific dispatch list | variant_overrides.agent_roster | Markdown list |

### Component 1: Agent Type Extraction with Group → Type Mapping

**Purpose**: Extract agent types from variant_overrides.agent_roster using comprehensive Group → Type mapping

**Algorithm**:
```typescript
function extractAgentTypes(roster: AgentRosterEntry[], variant: string): Record<AgentType, string> {
  const typeMap: Record<AgentType, string> = {};
  
  for (const entry of roster) {
    const agentType = mapGroupToType(entry.group, variant);
    const agentName = Array.isArray(entry.agents) ? entry.agents[0] : entry.agents;
    
    if (!typeMap[agentType]) {
      typeMap[agentType] = agentName;
    }
  }
  
  return typeMap;
}
```

**Fallback Hierarchy** (prevents L0 agent leakage):
```
design: designer → architect → ERROR
execution: code-writer → prototype-engineer → automation-engineer (L0, WARNING)
qa: analyst → researcher → auditor (L0, WARNING)
pm: project-coordinator → delivery-manager → pm (L0, WARNING)
infrastructure: technology-specialist → solutions-architect → security-expert (L0, WARNING)
documentation: technical-writer → content-writer → docs-writer (L0, WARNING)
security: security-monitor → threat-modeler → security-expert (L0, WARNING)
```

### Component 2: Group → Type Mapping Configuration

**Purpose**: Define comprehensive Group → Type mapping for all 5 variants with context-aware resolution

**Configuration Structure**:
```typescript
interface GroupTypeMapping {
  groupName: string;
  defaultType: AgentType;
  variantOverrides?: {
    [variant: string]: AgentType;
  };
  contextRules?: {
    phase: string;
    type: AgentType;
  }[];
}
```

**Ambiguity Resolution Priority**:
1. Check variant-specific override first
2. Check context-based rules (phase + group)
3. Use default type
4. Log warning if ambiguous mapping detected

**Example Mappings**:
- `Design` group → `design` (all variants)
- `Strategy` group → `qa` (co-consult, co-develop) or `design` (co-design)
- `Analysis` group → `qa` (default) or `security` (Threat phase context)

### Component 3: Agent Roster Table Generation

**Purpose**: Generate 4-column table with responsibility field populated

**Algorithm**:
```typescript
function generateAgentRosterTable(roster: AgentRosterEntry[]): string {
  const lines = [
    `## Agent Roster`,
    ``,
    `| Phase | Group | Agent file | Responsibility |`,
    `|-------|--------|------------|----------------|`,
  ];
  
  for (const entry of roster) {
    const agentsList = Array.isArray(entry.agents) ? entry.agents : [entry.agents];
    for (const agentRaw of agentsList) {
      if (!agentRaw) continue;
      
      const agent = parseAgent(agentRaw);
      const responsibility = agent.responsibility || generateResponsibilityFallback(entry.group);
      
      lines.push(`| ${entry.phase ?? ''} | ${entry.group ?? ''} | \`${agent.file}\` | ${responsibility} |`);
    }
  }
  
  return lines.join('\n');
}

function generateResponsibilityFallback(group: string): string {
  return `${group} specialist`;  // "Analysis" → "Analysis specialist"
}
```

### Component 4: Phase Determination Table Generation

**Purpose**: Generate variant-specific Phase Determination table with NO L0 agents

**Critical Requirement**: Table must NOT contain L0 agent names (automation-engineer, docs-writer, architect, auditor, security-expert, scaffolding-expert)

**Algorithm**:
```typescript
function generatePhaseDeterminationTable(roster: AgentRosterEntry[], variant: string): string {
  const agentTypes = extractAgentTypes(roster, variant);
  
  const lines = [
    `## Phase Determination Checklist`,
    ``,
    `| Deliverable Type | → Phase | → Required Agent | → Tier |`,
    `|-----------------|---------|-----------------|--------|`,
  ];
  
  const deliverableMapping = [
    { type: 'New file design / schema / ADR', phase: '1-2', agentType: 'design', tier: 'High' },
    { type: 'Script or code implementation', phase: '4', agentType: 'execution', tier: 'Low' },
    { type: 'Documentation update', phase: '4', agentType: 'documentation', tier: 'Medium' },
  ];
  
  for (const mapping of deliverableMapping) {
    const agent = agentTypes[mapping.agentType] || resolveFallback(mapping.agentType, variant);
    lines.push(`| ${mapping.type} | Phase ${mapping.phase} | ${agent} | ${mapping.tier} |`);
  }
  
  return lines.join('\n');
}
```

**Validation**:
```typescript
const L0_AGENT_NAMES = [
  'automation-engineer', 'docs-writer', 'architect', 'auditor', 
  'security-expert', 'scaffolding-expert'
];

function validateNoL0Leakage(generatedTable: string): ValidationResult {
  const violations = L0_AGENT_NAMES.filter(agent => 
    generatedTable.toLowerCase().includes(agent.toLowerCase())
  );
  
  return {
    valid: violations.length === 0,
    violations,
    message: violations.length > 0 
      ? `L0 leakage detected: ${violations.join(', ')}`
      : 'No L0 leakage'
  };
}
```

### Component 5: L0-Only Content Removal

**Purpose**: Remove L0-specific sections and terminology from L2 variants

**Removal Rules**:
1. Remove "Platform Note" section entirely
2. Replace "CONSTITUTION.md" references with "context.md and <variant>.context.md"
3. Remove L0-specific terminology (workspace root, ai-workspace-standards, cross-platform template scripts)
4. Remove "YOU ARE THE SINGLE ENTRY POINT" section (L0-specific)

**Algorithm**:
```typescript
function removeL0OnlyContent(content: string, variant: string): string {
  let cleaned = content;
  
  // 1. Remove Platform Note section
  cleaned = removeSection(cleaned, 'Platform Note');
  
  // 2. Replace CONSTITUTION.md references
  cleaned = cleaned.replace(
    /CONSTITUTION\.md/g,
    `context.md and ${variant}.context.md`
  );
  
  // 3. Remove L0-specific terminology
  const l0Terms = [
    'workspace root',
    'ai-workspace-standards',
    'cross-platform template scripts'
  ];
  
  for (const term of l0Terms) {
    cleaned = cleaned.replace(new RegExp(term, 'gi'), `this ${variant} project`);
  }
  
  // 4. Remove L0-specific sections
  cleaned = removeSection(cleaned, 'YOU ARE THE SINGLE ENTRY POINT');
  
  return cleaned;
}
```

### Component 6: MANDATORY Dispatch List Generation

**Purpose**: Generate variant-specific MANDATORY dispatch list

**Algorithm**:
```typescript
function generateMandatoryDispatchList(roster: AgentRosterEntry[]): string {
  const agentSet = new Set<string>();
  
  for (const entry of roster) {
    const agentsList = Array.isArray(entry.agents) ? entry.agents : [entry.agents];
    for (const agent of agentsList) {
      const agentName = typeof agent === 'string' ? agent : agent.name;
      agentSet.add(agentName);
    }
  }
  
  const lines = [
    `**MANDATORY**: All file modifications MUST be dispatched to:`,
    ``,
  ];
  
  for (const agent of agentSet) {
    lines.push(`- \`${agent}\` (variant-specific specialist)`);
  }
  
  return lines.join('\n');
}
```

---

### Implementation Plan (5 Phases)

**Phase 1: YAML Schema Extension** (Architect, 2 hours)
- Update all 5 variant templates with responsibility field
- For each agent in agent_roster, add: `responsibility: "Domain knowledge and business analysis"`
- Fallback: `responsibility: "${group} specialist"`

**Phase 2: Layout Reconstruction Implementation** (Automation-Engineer, 4 hours)
- Implement all 6 component functions in merge-frontmatter.ts
- Add reconstructPMLayout() orchestration function
- Create unit tests for each component

**Phase 3: remove_sections Chain Propagation** (Automation-Engineer, 30 minutes)
- Implement L1→L2 remove_sections inheritance
- Merge L1 and L2 remove_sections arrays
- Apply inherited remove_sections to L2 content

**Phase 4: Test Suite Creation** (Auditor, 2 hours)
- Create comprehensive test suite: scripts/test/__tests__/pm-layout-reconstruction.test.ts
- Implement critical tests for all 6 components
- Target 95%+ coverage

**Phase 5: Validation and QA** (Auditor, 2 hours)
- Run audit.ts and verify all checks PASS
- Generate test project and manually review pm.md
- Validate all 5 variants

---

### Acceptance Criteria (6 Items)

**AC-01: No L0 Agent Names in Phase Determination Table**
- Verification: Table must NOT contain automation-engineer, docs-writer, architect, auditor, security-expert, scaffolding-expert
- Manual check: Generated L2 pm.md files show only variant agents

**AC-02: All Roster Entries Have Non-Empty Responsibility Field**
- Verification: All rows in Agent Roster table have responsibility column populated
- Fallback: Generate from group field if missing ("Analysis specialist")

**AC-03: Platform Note Removed from L2 Variants**
- Verification: "Platform Note" section is absent from generated L2 pm.md
- Manual check: Search for "Platform Note" returns no results

**AC-04: MANDATORY Dispatch List Contains Only Variant Agents**
- Verification: Dispatch list shows only variant agents, no L0 agents
- Manual check: List matches variant_overrides.agent_roster

**AC-05: remove_sections Properly Inherited from L1 to L2**
- Verification: L1 remove_sections applied to L2 content during reconstruction
- Test: Merge L1 and L2 remove_sections arrays correctly

**AC-06: L2 pm.md File Size Under 150 Lines**
- Verification: All 5 variant pm.md files are under 150 lines (vs L0's 384 lines)
- Expected: ~50-100 lines variant-specific only

---

### Update List (Legacy - Pre v1.5.0)

**Note**: This section documents the pre-v1.5.0 behavior. After v1.5.0 implementation, complete reconstruction replaces this approach.

These L0 sections are **always** updated with variant-specific content during PM.md merge:

```typescript
const PM_CUSTOM_SECTIONS = [
  "## Role",
  "## ⚠️ ROLE CLARIFICATION",
  "## 🚨 YOU ARE THE SINGLE ENTRY POINT",
  "## Updated Role",
  "## Governance Workflow",
  "## Agent Roster",
  "## Dispatch Protocol",
  "## ⚠️ CRITICAL: PM Direct Execution Constraints",
  "### Phase Determination (Deliverable-Type Gate)"
];
```

### Generated Variant Sections

**1. ## Role** (Prepend)
```markdown
## Role

<variant_overrides.role.description>

**Scope**: <variant_overrides.role.scope>
```

**2. ## ⚠️ ROLE CLARIFICATION** (Prepend, with agent substitution)
```markdown
## ⚠️ ROLE CLARIFICATION

You are the PM orchestrator for this project. Your domain is [variant-specific domain].

All file modifications MUST be dispatched to:
- **[mapped design agent]** (design)
- **[mapped execution agent]** (implementation)
- **[mapped QA agent]** (testing)
```

**3. ## 🚨 YOU ARE THE SINGLE ENTRY POINT** (Prepend, with agent substitution)
```markdown
## 🚨 YOU ARE THE SINGLE ENTRY POINT

Specialist agents ([mapped agents]) receive focused tasks via the Agent tool...
```

**4. ## Agent Roster** (Prepend, 4-column table)

**Schema**:
```typescript
interface RosterEntry {
  phase: string;          // Phase name
  group: string;          // Agent group/category
  name: string;           // Agent name
  file?: string;          // Default: agents/${name}.md
  responsibility?: string; // Default: ${group} specialist
}
```

**Generated Table**:
```markdown
## Agent Roster

| Phase | Group | Agent file | Responsibility |
|-------|--------|------------|---------------|
| Triage | Strategy | agents/engagement-leader.md | Initial client assessment |
| Analysis | Research | agents/industry-expert.md | Domain knowledge |
```

**5. ## Governance Workflow** (Prepend)
```markdown
## Governance Workflow

Active phases: <governance_workflow.phases>
Client approval required: <governance_workflow.client_approval_required>
```

**6. ## ⚠️ CRITICAL: PM Direct Execution Constraints** (Prepend, with dynamic Phase Determination)

**Phase Determination Table Generation**:
```typescript
const AGENT_TYPE_MAP = {
  design: "mapped design agent from roster",
  execution: "mapped execution agent from roster",
  qa: "mapped QA agent from roster",
  security: "mapped security agent from roster",
  scaffolding: "mapped setup agent from roster"
};
```

**Generated Table**:
```markdown
## ⚠️ CRITICAL: PM Direct Execution Constraints

### Phase Determination (Deliverable-Type Gate)

| Deliverable Type | → Phase | → Required Agent |
|-----------------|---------|------------------|
| New file design | Phase 1-2 | [mapped design agent] |
| Script implementation | Phase 4 | [mapped execution agent] |
| Testing | Phase 4 | [mapped QA agent] |
```

**7. ## Dispatch Protocol** (Prepend)
```markdown
## Dispatch Protocol

Can lead phases: <dispatch_protocol.can_lead_phases>
Auto-dispatch to: <dispatch_protocol.auto_dispatch_to>
```

**8. Retained Generic L0 Content** (with agent substitution)

All remaining L0 sections (Consensus-Driven Facilitation, Denial Protocol, etc.) undergo **agent name substitution**:

```typescript
const AGENT_SUBSTITUTION_MAP = {
  "automation-engineer": mappedExecutionAgent,
  "docs-writer": mappedDocumentationAgent,
  "architect": mappedDesignAgent,
  "auditor": mappedQAAgent,
  "security-expert": mappedSecurityAgent,
  "scaffolding-expert": mappedSetupAgent
};
```

### Final Layout Structure

```markdown
[FRONTMATTER]

## Role (variant-specific)
## ⚠️ ROLE CLARIFICATION (variant-specific, agent-substituted)
## 🚨 YOU ARE THE SINGLE ENTRY POINT (variant-specific, agent-substituted)
## Agent Roster (variant-specific, 4-column table)
## Governance Workflow (variant-specific)
## ⚠️ CRITICAL: PM Direct Execution Constraints (variant-specific, dynamic Phase Determination)
## Dispatch Protocol (variant-specific)

[Generic L0 Content with Agent Substitution]
## Consensus-Driven Facilitation Model
## Permission Denial Protocol
## Execution Plan Boilerplate Policy
...
```

---

## Scaffolding Integration

### Script Modifications (v1.5.0+)

**Affected Scripts**:
1. `scripts/helpers/merge-frontmatter.ts` (v1.5.0)
2. `scripts/new-project.sh` (v1.4.7+)
3. `scripts/create-l2-scaffold.ts`
4. `scripts/l2-to-variant-pipeline.ts`
5. `scripts/validate-templates.ts`

### Key Changes

**1. merge-frontmatter.ts v1.5.0**

- **Force-Strip PM Custom Sections**: Automatically strip custom L0 sections for `agents/pm.md` files regardless of `remove_sections`
- **Layout Reconstruction**: Assemble generated document in strict layout order
- **Agent Substitution**: Replace L0 agent names in generic sections
- **4-Column Roster Generation**: Standardized table format with Phase, Group, Agent file, Responsibility

**2. new-project.sh v1.4.7+**

```bash
# Pass original template path for extends validation
merge-frontmatter.ts "$src_file" "$target_file" "$src_file"
```

**3. validate-templates.ts Updates**

- **L1 CLAUDE.md/GEMINI.md**: Removed from `forbiddenFiles` (consolidated in L1 per ADR-0033)
- **L2 CLAUDE.md/GEMINI.md**: Not required (inherited from L1)
- **PM.md Validation**: Check for L0 leakage and agent name contamination

---

## Validation & QA Gates

### Automated Checks

**1. L0 Leakage Detection** (`audit.ts`)

```typescript
// Check for L0-specific strings in generated pm.md
const L0_INDICATORS = [
  "ai-workspace-standards",
  "workspace root",
  "cross-platform template scripts"
];
```

**2. Agent Name Validation**

```typescript
// L0 agent names should NOT appear in variant pm.md
const L0_AGENTS = [
  "automation-engineer",
  "docs-writer",
  "architect",
  "auditor",
  "security-expert",
  "scaffolding-expert"
];
```

**3. Roster Schema Validation**

```typescript
interface RosterValidation {
  has_phase_column: boolean;
  has_group_column: boolean;
  has_agent_file_column: boolean;
  has_responsibility_column: boolean;
  no_duplicate_entries: boolean;
  all_files_exist: boolean;
}
```

### Manual Review Checklist

- [ ] Generated `## Role` describes variant project, not "ai-workspace-standards repository"
- [ ] `## Agent Roster` appears exactly once at document top
- [ ] Roster has exactly 4 columns: Phase, Group, Agent file, Responsibility
- [ ] Phase Determination table contains variant agent names only
- [ ] No L0 agent names in any section
- [ ] `variant_overrides` frontmatter is clean (not emitted to final file)
- [ ] Document flows logically: Role → Roster → Workflow → Constraints → Protocol → Generic Rules

---

## ⚠️ Known Limitations

This section documents current limitations in the PM.md operations implementation and design documentation. It distinguishes between **actually implemented features** and **proposed improvements**.

### Current Implementation (v1.0.0 - v1.1.0)

**Security**:
- ❌ **No YAML injection protection**: Path traversal attacks (`../../../etc/passwd`) not blocked
- ❌ **No external URL validation**: Malicious external extends (`https://evil.com/pm.md`) not blocked
- ❌ **No agent path validation**: Agent file paths not validated against white-list
- ⚠️ **Security validations pending**: Phase 1+ (v1.3.0) will implement YAML injection protection

**Error Handling**:
- ❌ **No structured error types**: Errors not classified as recoverable vs unrecoverable
- ❌ **No fallback mechanism**: Missing files cause complete failure instead of graceful degradation
- ❌ **Limited edge case handling**: Only basic extends resolution, 10 identified edge cases not covered
- ❌ **No recovery suggestions**: Error messages don't include actionable recovery steps
- ⚠️ **Error recovery pending**: Phase 1+ (v1.3.0) will implement comprehensive error recovery

**Performance**:
- ❌ **No caching mechanism**: Every extends resolution hits filesystem (performance bottleneck in large-scale scaffolding)
- ❌ **No performance monitoring**: No metrics for cache hit rate, resolution time, or chain depth
- ❌ **No observability**: No structured logging for debugging or performance analysis
- ⚠️ **Caching pending**: Phase 3 (v2.0.0) will implement LRU cache with 50%+ performance improvement target

**Validation**:
- ✅ **Basic extends validation**: Circular reference detection exists (visited Set, depth limit)
- ❌ **No comprehensive edge case testing**: 10 edge cases documented but not yet tested
- ❌ **No security validation tests**: Path traversal and external URL attacks not tested
- ⚠️ **Edge case testing pending**: Phase 1+ (v1.3.0) will achieve 100% edge case test coverage

**Architecture**:
- ❌ **L0 Content Duplication Bug**: L2 variants contain 384 lines (full L0 content) instead of ~50-100 lines variant-specific content
- ❌ **Layout Reconstruction Not Triggered**: merge-frontmatter.ts has reconstruction functions but doesn't call them
- ❌ **removeL0OnlyContent() Failure**: Function doesn't remove CONSTITUTION.md references or Platform Note sections
- ❌ **Agent Roster Responsibility Field Empty**: Template YAML has empty responsibility values, table generation fails
- ❌ **Phase Determination Table Shows L0 Agents**: Table shows automation-engineer, docs-writer instead of variant agents
- ⚠️ **Comprehensive design complete (v1.5.0+)**: 6-component architecture with 5-phase implementation plan ready
- ⚠️ **Implementation pending**: Awaiting Phase 1-5 execution (10.5 hours estimated)

### Documentation Gaps

**Version Status Confusion**:
- ⚠️ **Document marked "Final" but describes unimplemented features**: v1.2.0 "Final" document describes v1.5.0+ features that don't exist
- ⚠️ **Implementation Status Matrix shows clear reality**: This "Known Limitations" section addresses documentation-reality mismatch
- ⚠️ **Version Stability Guide clarifies production readiness**: Only v1.0.0 is production-ready

**Migration Notes**:
- ⚠️ **v1.2.0 variant_sections documented but not implemented**: Feature appears in design but not in code
- ⚠️ **v1.5.0+ Layout Reconstruction proposed but requires rewrite**: Not yet actionable
- ⚠️ **Breaking changes deferred to v2.0.0**: Extensibility and internationalization require major version bump

**Testing Coverage**:
- ⚠️ **Current test coverage**: Unknown (audit.ts exists but coverage not measured)
- ⚠️ **Target coverage**: Phase 1+ aims for 90%+ (80%+ base + 100% edge cases + 100% security)
- ⚠️ **Integration testing gaps**: No comprehensive integration tests for all 5 variants

### Roadmap Clarity

**Phase 1+ (v1.3.0): Security & Stability** - **Priority: P0-P1**
- **Timeline**: Immediate (7-9 hours estimated)
- **Deliverables**: 
  - YAML injection protection
  - Circular reference protection enhancement
  - variant_sections semantic definition
  - Error recovery strategy
  - Edge case documentation (10 cases)
  - Comprehensive test suites
- **Status**: 📋 Proposed, awaiting implementation

**Phase 2+ (v1.5.0): Layout Reconstruction Implementation** - **Priority: P0**
- **Timeline**: Immediate (10.5 hours estimated)
- **Deliverables**:
  - Phase 1: YAML Schema Extension (2 hours)
  - Phase 2: Layout Reconstruction Implementation (4 hours)
  - Phase 3: remove_sections Chain Propagation (30 minutes)
  - Phase 4: Test Suite Creation (2 hours)
  - Phase 5: Validation and QA (2 hours)
  - Complete 6-component architecture
  - All 6 acceptance criteria met
- **Status**: ✅ **Comprehensive design complete**, implementation pending

**Phase 3+ (v1.6.0): Simplification** - **Priority: P2**
- **Timeline**: Short-term (4-7 hours estimated)
- **Deliverables**:
  - Agent Roster schema simplification (4→3 columns)
  - Layout reconstruction simplification (8→3 steps, 60-70% code reduction)
  - Optional: Caching strategy
  - Optional: Observability
- **Status**: 📋 Proposed, awaiting Phase 1+ and Phase 2+ completion

**Phase 3+ (v2.0.0): Performance & Operations** - **Priority: P2**
- **Timeline**: Long-term (6-12 months)
- **Status**: Documented in [Long-term Roadmap (v2.0.0+)](#long-term-roadmap-v200-long-term)

**Phase 4+ (v2.5.0+): Extensibility & i18n** - **Priority: P3**
- **Timeline**: Long-term (12-18 months)
- **Status**: Documented in [Long-term Roadmap (v2.0.0+)](#long-term-roadmap-v200-long-term)

---

## Common Pitfalls & Solutions

### Pitfall 1: L0 Role Leakage

**Problem**: Generated pm.md still says "You are the PM orchestrator for the **ai-workspace-standards repository**"

**Root Cause**: `## Role` section not in `variant_overrides.variant_sections`

**Solution**: 
- Ensure L1 `templates/common/agents/pm.md` includes `## Role` in `variant_overrides.variant_sections`
- Verify `merge-frontmatter.ts` updates custom PM sections with variant content

### Pitfall 2: Agent Name Duplication

**Problem**: `## Agent Roster` appears twice, or L0 agent names appear in variant constraints

**Root Cause**: 
- L0 sections not stripped before variant injection
- Agent substitution not applied to generic sections

**Solution**:
- Use Layout Reconstruction (v1.5.0+) to completely rebuild custom sections
- Apply agent substitution map to retained generic content

### Pitfall 3: Phase Determination Table Leakage

**Problem**: Table under Constraints still shows L0 agents (automation-engineer, docs-writer)

**Root Cause**: Hard-coded L0 mappings in `### Phase Determination` section

**Solution**:
- Change L0 bullet `- **Phase Determination**:` to proper heading `### Phase Determination`
- Dynamically generate table from variant `agent_roster` with agent type mapping

### Pitfall 4: Variant Role Not Inherited

**Problem**: L2 variants lack fallback role description

**Root Cause**: L1 doesn't define default `variant_overrides.role`

**Solution**:
- Add default role block to L1 `templates/common/agents/pm.md`
- L2 variants inherit by default, can override with own `variant_overrides.role`

### Pitfall 5: Frontmatter Stagnation

**Problem**: Top-level frontmatter (`description`, `examples`) not overridden in variants

**Root Cause**: `variant_overrides` structure doesn't support top-level key override

**Solution**:
- Use `frontmatter_overrides` nested key (v1.4.0+):
  ```yaml
  variant_overrides:
    frontmatter_overrides:
      description: "Variant-specific description"
      examples: ["variant-specific example"]
  ```

### Pitfall 6: Variant Sections Structure

**Problem**: Confusion about the naming and purpose of section customization

**Root Cause**: Historical terminology focused on "removal" rather than "customization"

**Solution** (v1.2.0+):
- **Positive terminology**: `variant_sections` instead of `remove_sections`
- **Clear semantics**: Sections listed are "updated with variant characteristics," not "removed"
- **Single source of truth**: `variant_overrides.variant_sections` for all section customization
- **Backward compatibility**: Scripts support both `remove_sections` and `variant_sections` (legacy support)
- **Documentation standard**: Use `variant_overrides.variant_sections` for clarity and consistency

### Pitfall 7: L0 Content Duplication

**Problem**: L2 variants contain 384 lines (full L0 content) instead of ~50-100 lines variant-specific content

**Root Cause**: 
- merge-frontmatter.ts copies L0 body content to L2 without reconstruction
- Layout Reconstruction functions exist but are not properly triggered
- removeL0OnlyContent() doesn't remove all L0-specific sections

**Solution** (v1.5.0+):
- Use **Complete Reconstruction strategy** (not copy + remove)
- Generate ALL L2 content from scratch using variant_overrides
- Implement proper trigger condition in merge-frontmatter.ts:
  ```typescript
  if (isPMFile && hasVariantOverrides && variantLevel === 'L2') {
    return reconstructPMLayout(yaml, baseContent, variantLevel);
  }
  ```
- Verify L2 pm.md file size is under 150 lines

**Verification**:
```bash
# Check line count
wc -l templates/co-work/agents/pm.md
# Expected: ~50-100 lines (not 384 lines)
```

### Pitfall 8: Layout Reconstruction Not Triggered

**Problem**: Layout Reconstruction functions exist in merge-frontmatter.ts but L2 templates still show L0 content

**Root Cause**:
- isPMFile detection exists but reconstruction logic not called
- hasVariantOverrides check missing
- variantLevel not properly detected

**Solution** (v1.5.0+):
- Add proper trigger condition in merge-frontmatter.ts extends chain processing
- Ensure reconstruction happens at both trigger points:
  1. L2 template generation (create-l2-scaffold.ts)
  2. Project scaffold from L2 template (new-project.ps1/sh)
- Test with manual trigger validation

**Manual Verification**:
1. Generate L2 template: `bun scripts/create-l2-scaffold.ts co-work`
2. Check output: `templates/co-work/agents/pm.md`
3. Verify: No L0 agent names in Phase Determination table
4. Verify: File size under 150 lines

---

## Edge Cases and Error Handling (v1.3.0+)

This section documents the 10 identified edge cases in PM.md operations and their specified handling behaviors. This is the definitive reference for edge case resolution per ADR-0034 Phase 2.

### Edge Case Classification

Edge cases are classified into three categories:

| Category | Definition | Recovery Strategy |
|----------|------------|-------------------|
| **Fatal Errors** | System integrity violations that prevent safe operation | Immediate termination with clear error message |
| **Recoverable Errors** | Partial failures that can be resolved with fallback behavior | Graceful degradation with warning |
| **Warnings** | Non-critical issues that don't affect functionality | Continue with notification to user |

---

### Fatal Errors (Category 1)

**Fatal errors cause immediate termination and require user intervention before retry.**

#### 1. Missing L0 Section

**Condition**: A required L0 section (e.g., `## Role`, `## Agent Roster`) is referenced in `variant_sections` but doesn't exist in the base L0 file.

**Error Type**: `MISSING_L0_SECTION`

**Behavior**: 
```typescript
throw new PMError({
  type: 'MISSING_L0_SECTION',
  message: `Required L0 section "${sectionName}" not found in base file`,
  recoverable: false,
  suggestion: `Verify that "${sectionName}" exists in L0 agents/pm.md or remove it from variant_sections`
});
```

**Example Scenario**:
```yaml
# L2 variant configuration
variant_overrides:
  variant_sections:
    - "## Non-existent Section"  # This section doesn't exist in L0
```

**Error Output**:
```
[FATAL] Missing L0 Section: "## Non-existent Section" not found in base file
Suggestion: Verify that "## Non-existent Section" exists in L0 agents/pm.md or remove it from variant_sections
```

---

#### 2. Circular Extends

**Condition**: The `extends` chain forms a circular reference (e.g., A → B → C → A).

**Error Type**: `CIRCULAR_EXTENDS`

**Behavior**:
```typescript
// Detection during chain resolution
const visited = new Set<string>();

function detectCircular(filePath: string, chain: string[]): void {
  if (visited.has(filePath)) {
    throw new PMError({
      type: 'CIRCULAR_EXTENDS',
      message: `Circular reference detected: ${chain.join(' → ')} → ${filePath}`,
      recoverable: false,
      suggestion: 'Break the circular reference by removing one of the extends directives'
    });
  }
  visited.add(filePath);
}
```

**Example Scenario**:
```yaml
# File A: agents/a.md
extends: agents/b.md

# File B: agents/b.md  
extends: agents/c.md

# File C: agents/c.md
extends: agents/a.md  # Circular: A → B → C → A
```

**Error Output**:
```
[FATAL] Circular Extends: agents/a.md → agents/b.md → agents/c.md → agents/a.md
Suggestion: Break the circular reference by removing one of the extends directives
```

---

#### 3. Invalid Action

**Condition**: A `variant_sections` entry specifies an action that is not one of the allowed values: `prepend`, `replace`, or `append`.

**Error Type**: `INVALID_ACTION`

**Behavior**:
```typescript
const VALID_ACTIONS = ['prepend', 'replace', 'append'];

if (!VALID_ACTIONS.includes(action)) {
  throw new PMError({
    type: 'INVALID_ACTION',
    message: `Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`,
    recoverable: false,
    suggestion: `Use one of the valid actions: prepend, replace, append`
  });
}
```

**Example Scenario**:
```yaml
variant_overrides:
  variant_sections:
    - section: "## Role"
      action: "insert"  # Invalid action
```

**Error Output**:
```
[FATAL] Invalid Action: "insert" is not a valid action
Suggestion: Use one of the valid actions: prepend, replace, append
```

---

#### 4. Deep Extends Chain (>10)

**Condition**: The `extends` chain depth exceeds 10 levels.

**Error Type**: `DEEP_EXTENDS_CHAIN`

**Behavior**:
```typescript
const MAX_CHAIN_DEPTH = 10;

if (chainDepth > MAX_CHAIN_DEPTH) {
  throw new PMError({
    type: 'DEEP_EXTENDS_CHAIN',
    message: `Extends chain depth (${chainDepth}) exceeds maximum (${MAX_CHAIN_DEPTH})`,
    recoverable: false,
    suggestion: 'Simplify the template hierarchy or increase MAX_CHAIN_DEPTH in merge-frontmatter.ts'
  });
}
```

**Example Scenario**:
```
L0 → L1 → L2 → L3 → L4 → L5 → L6 → L7 → L8 → L9 → L10 → L11  # Too deep
```

**Error Output**:
```
[FATAL] Deep Extends Chain: Chain depth (11) exceeds maximum (10)
Suggestion: Simplify the template hierarchy or increase MAX_CHAIN_DEPTH in merge-frontmatter.ts
```

---

#### 5. Invalid YAML Syntax

**Condition**: YAML frontmatter contains syntax errors (indentation, quote mismatches, etc.).

**Error Type**: `INVALID_YAML_SYNTAX`

**Behavior**:
```typescript
try {
  const parsed = parseYAML(content);
} catch (error) {
  throw new PMError({
    type: 'INVALID_YAML_SYNTAX',
    message: `YAML syntax error: ${error.message}`,
    recoverable: false,
    suggestion: 'Fix YAML syntax errors (indentation, quotes, colons, etc.)'
  });
}
```

**Example Scenario**:
```yaml
extends: agents/pm.md
variant_overrides:
  variant_sections:    # Missing proper indentation
    - section: "## Role"
action: "prepend"      # Misaligned key
```

**Error Output**:
```
[FATAL] Invalid YAML Syntax: YAML syntax error: unexpected token at line 4
Suggestion: Fix YAML syntax errors (indentation, quotes, colons, etc.)
```

---

### Recoverable Errors (Category 2)

**Recoverable errors allow operation to continue with fallback behavior and issue warnings.**

#### 6. Missing Extends

**Condition**: A template file lacks the `extends` field in frontmatter.

**Error Type**: `MISSING_EXTENDS`

**Behavior**:
```typescript
if (!frontmatter.extends) {
  console.warn(`[WARNING] Missing Extends: No extends field in ${filePath}`);
  console.warn(`[WARNING] Using default L0 path: ${DEFAULT_L0_PATH}`);
  
  return {
    success: true,
    warnings: [`Missing extends field, using default L0 path: ${DEFAULT_L0_PATH}`],
    data: mergeWithDefaultL0(filePath)
  };
}
```

**Example Scenario**:
```yaml
# L1 template without extends
variant_overrides:
  variant_sections:
    - "## Role"
```

**Warning Output**:
```
[WARNING] Missing Extends: No extends field in templates/common/agents/pm.md
[WARNING] Using default L0 path: ../../../agents/pm.md
```

---

#### 7. Conflicting variant_sections

**Condition**: Multiple entries in `variant_sections` specify the same section with different actions.

**Error Type**: `CONFLICTING_VARIANT_SECTIONS`

**Behavior**:
```typescript
// Detect conflicts
const sectionMap = new Map<string, string[]>();

for (const entry of variant_sections) {
  if (!sectionMap.has(entry.section)) {
    sectionMap.set(entry.section, []);
  }
  sectionMap.get(entry.section).push(entry.action);
}

// Report conflicts
for (const [section, actions] of sectionMap.entries()) {
  if (actions.length > 1) {
    console.warn(`[WARNING] Conflicting variant_sections: "${section}" has multiple actions: ${actions.join(', ')}`);
    console.warn(`[WARNING] Last action wins: "${actions[actions.length - 1]}"`);
  }
}
```

**Example Scenario**:
```yaml
variant_sections:
  - section: "## Role"
    action: "prepend"
  - section: "## Role"
    action: "replace"  # Conflict with previous entry
```

**Warning Output**:
```
[WARNING] Conflicting variant_sections: "## Role" has multiple actions: prepend, replace
[WARNING] Last action wins: "replace"
```

---

#### 8. Duplicate Sections

**Condition**: The same section appears multiple times in the final merged document.

**Error Type**: `DUPLICATE_SECTIONS`

**Behavior**:
```typescript
// Detect duplicates in final document
const sectionCounts = new Map<string, number>();

for (const section of documentSections) {
  sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
}

for (const [section, count] of sectionCounts.entries()) {
  if (count > 1) {
    console.warn(`[WARNING] Duplicate Sections: "${section}" appears ${count} times`);
    console.warn(`[WARNING] Merging duplicates into single occurrence`);
    
    // Merge duplicates
    mergeDuplicateSections(section);
  }
}
```

**Example Scenario**:
```markdown
## Agent Roster
| Phase | Agent | Responsibility |
|-------|--------|---------------|
| 0 | scaffolding-expert | Project setup |

## Agent Roster  (Duplicate)
| Phase | Agent | Responsibility |
|-------|--------|---------------|
| 1 | architect | Design |
```

**Warning Output**:
```
[WARNING] Duplicate Sections: "## Agent Roster" appears 2 times
[WARNING] Merging duplicates into single occurrence
```

---

### Warnings (Category 3)

**Warnings are informational and don't affect functionality.**

#### 9. Empty variant_sections

**Condition**: The `variant_sections` array is empty or contains only empty strings.

**Error Type**: `EMPTY_VARIANT_SECTIONS`

**Behavior**:
```typescript
if (!variant_sections || variant_sections.length === 0) {
  console.info(`[INFO] Empty variant_sections: No sections to customize`);
  console.info(`[INFO] Using default L0 content without modifications`);
  
  return {
    success: true,
    warnings: ['Empty variant_sections, using default L0 content'],
    data: useDefaultL0Content()
  };
}
```

**Example Scenario**:
```yaml
variant_overrides:
  variant_sections: []  # Empty array
```

**Info Output**:
```
[INFO] Empty variant_sections: No sections to customize
[INFO] Using default L0 content without modifications
```

---

#### 10. File Permission Errors

**Condition**: Cannot read or write files due to insufficient permissions.

**Error Type**: `FILE_PERMISSION_ERROR`

**Behavior**:
```typescript
try {
  const content = fs.readFileSync(filePath, 'utf8');
} catch (error) {
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    throw new PMError({
      type: 'FILE_PERMISSION_ERROR',
      message: `Permission denied: Cannot read ${filePath}`,
      recoverable: false,
      suggestion: 'Check file permissions and run with appropriate privileges'
    });
  }
  throw error;
}
```

**Example Scenario**:
```bash
# Trying to scaffold project without read permissions
chmod 000 templates/common/agents/pm.md
./new-project.sh my-project
```

**Error Output**:
```
[FATAL] File Permission Error: Permission denied: Cannot read templates/common/agents/pm.md
Suggestion: Check file permissions and run with appropriate privileges
```

---

### Error Type Reference Table

| Error Type | Category | Recoverable | Detection Stage | Fallback Strategy |
|-----------|----------|-----------|-----------------|------------------|
| `MISSING_L0_SECTION` | Fatal | ❌ No | Chain resolution | None (terminate) |
| `CIRCULAR_EXTENDS` | Fatal | ❌ No | Chain resolution | None (terminate) |
| `INVALID_ACTION` | Fatal | ❌ No | YAML validation | None (terminate) |
| `DEEP_EXTENDS_CHAIN` | Fatal | ❌ No | Chain resolution | None (terminate) |
| `INVALID_YAML_SYNTAX` | Fatal | ❌ No | YAML parsing | None (terminate) |
| `MISSING_EXTENDS` | Recoverable | ✅ Yes | Frontmatter parsing | Use default L0 path |
| `CONFLICTING_VARIANT_SECTIONS` | Recoverable | ✅ Yes | Section merging | Last action wins |
| `DUPLICATE_SECTIONS` | Recoverable | ✅ Yes | Document assembly | Merge duplicates |
| `EMPTY_VARIANT_SECTIONS` | Warning | ✅ Yes | Configuration validation | Use default L0 |
| `FILE_PERMISSION_ERROR` | Fatal | ❌ No | File I/O | None (terminate) |

---

### Testing Requirements (v1.3.0+)

Per ADR-0034 Phase 2, all 10 edge cases must have corresponding test cases:

```typescript
// Test file: tests/pm-md-edge-cases.test.ts
describe('PM.md Edge Cases', () => {
  
  describe('Fatal Errors', () => {
    test('should throw MISSING_L0_SECTION for non-existent section', () => {
      // Test implementation
    });
    
    test('should throw CIRCULAR_EXTENDS for circular references', () => {
      // Test implementation
    });
    
    test('should throw INVALID_ACTION for unsupported actions', () => {
      // Test implementation
    });
    
    test('should throw DEEP_EXTENDS_CHAIN for chains > 10 levels', () => {
      // Test implementation
    });
    
    test('should throw INVALID_YAML_SYNTAX for malformed YAML', () => {
      // Test implementation
    });
  });
  
  describe('Recoverable Errors', () => {
    test('should use default L0 when extends is missing', () => {
      // Test implementation
    });
    
    test('should resolve conflicting variant_sections with last-action-wins', () => {
      // Test implementation
    });
    
    test('should merge duplicate sections with warning', () => {
      // Test implementation
    });
  });
  
  describe('Warnings', () => {
    test('should handle empty variant_sections gracefully', () => {
      // Test implementation
    });
  });
  
  describe('File I/O', () => {
    test('should throw FILE_PERMISSION_ERROR for unreadable files', () => {
      // Test implementation
    });
  });
});
```

---

### Implementation Status (v1.3.0+)

| Edge Case | Status | Implementation Date | Test Coverage |
|-----------|--------|---------------------|----------------|
| 1. Missing L0 Section | 📋 Proposed | - | 0% |
| 2. Circular Extends | ✅ Partially Implemented | v1.0.0 | 50% (basic detection exists) |
| 3. Conflicting variant_sections | 📋 Proposed | - | 0% |
| 4. Empty variant_sections | ✅ Implemented | v1.0.0 | 100% (no-op handling exists) |
| 5. Invalid action | 📋 Proposed | - | 0% |
| 6. Missing extends | 📋 Proposed | - | 0% |
| 7. Deep extends chain (>10) | ✅ Partially Implemented | v1.0.0 | 50% (basic depth limit exists) |
| 8. Duplicate sections | 📋 Proposed | - | 0% |
| 9. Invalid YAML syntax | 📋 Proposed | - | 0% |
| 10. File permission errors | 📋 Proposed | - | 0% |

**Overall Progress**: 20% (2/10 fully or partially implemented)

**Next Priority** (Phase 1+ v1.3.0):
1. Implement structured error types (`PMError` class)
2. Add remaining 8 edge case handlers
3. Create comprehensive test suite (100% coverage target)

---

## Appendix: Meeting References

### June 7, 2026 Meetings

1. **Template Structure & L1-L2 Redesign** (`meeting-2026-06-07-template-structure-l1-l2-variant-management-redesign.md`)
   - Decision: L1 as pure extends file, L2 as YAML-only config
   - File naming: Keep `pm.md`, not `variant.pm.md`

2. **PM Variant File Naming Alternatives** (`meeting-2026-06-07-pm-variant-file-naming-alternatives.md`)
   - Evaluated 7 alternative structures
   - Final agreement: YAML frontmatter + empty body

### June 8, 2026 Meetings

1. **PM Variant Sections** (`meeting-2026-06-08-pm-variant-sections.md`)
   - Root cause analysis: L0 sections not in `remove_sections`
   - Solution: Expanded strip list, prepend variant sections

2. **Joint Review** (`meeting-2026-06-08-pm-variant-joint-review.md`)
   - 4-layer failure analysis
   - Layout reconstruction architecture

3. **Logic Review** (`meeting-2026-06-08-pm-logic-review.md`)
   - Duplication resolution
   - 4-column roster schema
   - Agent substitution mapping

---

## Long-term Roadmap (v2.0.0+)

This section outlines long-term improvement opportunities identified during June 8, 2026 design reviews. These items are **not part of immediate implementation (Phase 1+/2+)** but represent strategic directions for future evolution.

### Phase 3: Performance & Operations (v2.0.0, Priority: P2)

**Timeline**: 6-12 months after Phase 2+ completion
**Expected Effort**: 2-3 weeks

**A. Caching Strategy**

**Objective**: Optimize performance for large-scale scaffolding operations

**Proposed Implementation**:
```typescript
// LRU Cache for extends chain resolution
const extendsCache = new LRUCache({ 
  max: 100,
  ttl: 1000 * 60 * 60  // 1 hour TTL
});

function resolveExtendsChainWithCache(filePath, useCache = true) {
  if (useCache && extendsCache.has(filePath)) {
    monitor.cacheHit++;
    return extendsCache.get(filePath);
  }
  
  monitor.cacheMiss++;
  const result = resolveExtendsChain(filePath);
  
  if (useCache) {
    extendsCache.set(filePath, result);
  }
  
  return result;
}
```

**Performance Targets**:
- Cache hit rate: 50%+ for repeated scaffolding
- Average resolution time: <10ms (cached) vs <100ms (uncached)
- Memory overhead: <10MB for 100-entry cache

**Activation Strategy**:
- Development: Cache disabled by default (`CACHE=false`)
- Production: Cache enabled by default
- CLI flag: `--no-cache` to bypass when needed

---

**B. Observability & Monitoring**

**Objective**: Enable operational monitoring and debugging

**Proposed Implementation**:
```typescript
// Structured logging
interface ResolutionLog {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  event: string;
  data: Record<string, unknown>;
}

class ExtendsResolver {
  private logger: StructuredLogger;
  
  resolve(filePath: string) {
    const startTime = performance.now();
    
    try {
      const result = this.resolveInternal(filePath);
      
      this.logger.log({
        timestamp: new Date().toISOString(),
        level: "info",
        event: "resolve_success",
        data: {
          path: filePath,
          depth: this.currentDepth,
          duration: performance.now() - startTime
        }
      });
      
      return result;
    } catch (error) {
      this.logger.log({
        timestamp: new Date().toISOString(),
        level: "error",
        event: "resolve_error",
        data: {
          path: filePath,
          error: error.message,
          duration: performance.now() - startTime
        }
      });
      
      throw error;
    }
  }
}
```

**Monitoring Metrics**:
- Cache hit rate
- Average resolution time
- Max chain depth observed
- Error rate by type

**Activation Strategy**:
- Development: `DEBUG=1` enables verbose logging
- Production: Structured logs to file only on error
- CLI flag: `--debug` for temporary activation

---

### Phase 4: Extensibility & Internationalization (v2.5.0+, Priority: P3)

**Timeline**: 12-18 months after Phase 3 completion
**Expected Effort**: 3-4 weeks

**A. Extensibility Design**

**Objective**: Enable plugin-like extension for custom section processors

**Proposed Architecture**:
```typescript
interface SectionProcessor {
  type: string;
  priority: number;
  process(content: string, config: any, context: ProcessingContext): string;
}

class SectionProcessorRegistry {
  private processors: Map<string, SectionProcessor> = new Map();
  
  register(processor: SectionProcessor) {
    this.processors.set(processor.type, processor);
  }
  
  apply(content: string, config: any, context: ProcessingContext): string {
    const sorted = Array.from(this.processors.values())
      .sort((a, b) => a.priority - b.priority);
    
    let result = content;
    for (const processor of sorted) {
      if (config[processor.type]) {
        result = processor.process(result, config[processor.type], context);
      }
    }
    
    return result;
  }
}

// Built-in processors
registry.register({
  type: "variant_sections",
  priority: 100,
  process: processVariantSections
});

// Future custom processors (example)
registry.register({
  type: "section_append",
  priority: 200,
  process: processSectionAppend
});

registry.register({
  type: "section_wrap",
  priority: 300,
  process: processSectionWrap
});
```

**Extension Points**:
1. Custom section types beyond `variant_sections`
2. Custom content transformations
3. Custom validation rules
4. Custom merge strategies

---

**B. Internationalization (i18n) Support**

**Objective**: Enable multi-language YAML field names and error messages

**Proposed Implementation**:
```typescript
// Locale configuration
interface LocaleConfig {
  code: string;
  fieldNames: {
    variant_sections: string;
    section: string;
    action: string;
    agent_roster: string;
  };
  errorMessages: Record<string, string>;
}

const LOCALES: Record<string, LocaleConfig> = {
  'en': {
    code: 'en',
    fieldNames: {
      variant_sections: 'variant_sections',
      section: 'section',
      action: 'action',
      agent_roster: 'agent_roster'
    },
    errorMessages: {
      CIRCULAR_REFERENCE: "Circular reference detected: {path}",
      MISSING_FILE: "File not found: {path}"
    }
  },
  
  'ko': {
    code: 'ko',
    fieldNames: {
      variant_sections: 'variant_섹션',
      section: '섹션',
      action: '동작',
      agent_roster: '에이전트_명단'
    },
    errorMessages: {
      CIRCULAR_REFERENCE: "순환 참조가 감지되었습니다: {path}",
      MISSING_FILE: "파일을 찾을 수 없습니다: {path}"
    }
  },
  
  'ja': {
    code: 'ja',
    fieldNames: {
      variant_sections: 'variant_セクション',
      section: 'セクション',
      action: 'アクション',
      agent_roster: 'エージェント_名簿'
    },
    errorMessages: {
      CIRCULAR_REFERENCE: "循環参照が検出されました: {path}",
      MISSING_FILE: "ファイルが見つかりません: {path}"
    }
  }
};

// Locale-aware parsing
function parseLocalizedYAML(content: string, locale: string = 'en') {
  const config = LOCALES[locale] || LOCALES['en'];
  
  // Parse with localized field names
  const parsed = parseYAML(content);
  
  // Map localized fields to canonical names
  return {
    variant_sections: parsed[config.fieldNames.variant_sections] || 
                       parsed.variant_sections,
    // ... other field mappings
  };
}

// Localized error messages
function getLocalizedMessage(key: string, params: Record<string, string>, locale: string = 'en') {
  const config = LOCALES[locale] || LOCALES['en'];
  let message = config.errorMessages[key] || key;
  
  // Replace placeholders
  for (const [param, value] of Object.entries(params)) {
    message = message.replace(`{${param}}`, value);
  }
  
  return message;
}
```

**Activation Strategy**:
- Default: English (en)
- Config: `locale: 'ko'` in workspace config
- CLI flag: `--locale ja` for temporary override
- Detection: Auto-detect from system locale if not specified

**Translation Requirements**:
- Field names: Translate YAML keys
- Error messages: Translate all user-facing messages
- Documentation: Provide translated guides for major languages

---

### Strategic Considerations

**Trade-offs**:

| Area | Benefit | Cost | Recommendation |
|------|---------|------|----------------|
| Caching | 50%+ performance improvement | Memory overhead (~10MB) | **Implement** with configurable limits |
| Observability | Better debugging | Logging overhead | **Implement** with DEBUG-only activation |
| Extensibility | Plugin ecosystem | Complexity increase | **Defer** until explicit demand |
| Internationalization | Multi-language support | Translation maintenance | **Defer** until non-English adoption |

**Dependency Management**:
- Caching → Requires no breaking changes
- Observability → Requires no breaking changes
- Extensibility → **Breaking change**: v1.x → v2.0
- Internationalization → **Breaking change**: v1.x → v2.0

**Recommendation**:
- Phase 3 (P2): Implement progressively with backward compatibility
- Phase 4 (P3): Major version bump (v2.0.0) with migration guide

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.5.0 | 2026-06-08 | **Comprehensive Design Integration**: Integrated complete PM.md Variant-Specific Content Injection design with 6-component architecture, 5-phase implementation plan, and 6 acceptance criteria. Updated Implementation Status Matrix, Layout Reconstruction Process, Known Limitations, and Common Pitfalls sections |
| 1.4.0 | 2026-06-08 | **Phase 2 Complete**: Added comprehensive "Edge Cases and Error Handling" section documenting all 10 edge cases with error types, behaviors, examples, and testing requirements per ADR-0034 Phase 2 |
| 1.3.0 | 2026-06-08 | Added Long-term Roadmap (v2.0.0+) section with Phase 3/4 strategic plans |
| 1.2.0 | 2026-06-08 | Renamed `remove_sections` → `variant_sections` for positive semantics ("customization" not "removal") |
| 1.1.0 | 2026-06-08 | Unified `remove_sections` under `variant_overrides` for consistent schema |
| 1.0.0 | 2026-06-08 | Initial release based on June 7-8 meeting resolutions |

---

## Related Documents

- **ADR-0031**: L1-L2 Fork Model
- **ADR-0033**: L0-L1-L2 Hierarchy and Extends
- **CONSTITUTION.md §5**: Multi-Agent Architecture
- **AGENTS.md**: PM Agent Architecture Section

---

*End of Document*
