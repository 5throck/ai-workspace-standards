# L2 PM Agent YAML Schema Specification

**Version**: 1.0.0  
**Last Updated**: 2026-06-07  
**Status**: Active

## Overview

This document defines the YAML frontmatter schema for L2 (Level 2) variant PM agent configuration files. L2 variants extend the L1 common PM agent and provide variant-specific overrides through structured YAML configuration.

**Architecture**: L1 → L2 Fork Model (see [ADR-0031](../adr/0031-l1-l2-fork-model.md))

## Schema Location

- **L1 Common**: `templates/common/agents/pm.md` (pure extends file)
- **L2 Variants**: `templates/<variant>/agents/pm.md` (YAML frontmatter + variant sections)

## Complete YAML Schema

```yaml
---
extends: ../../common/agents/pm.md
variant: <variant-name>
variant_overrides:
  updated_role:
    description: <string>
    scope: <string>
  governance_workflow:
    phases: <array[number]>
    triage_required: <boolean>
  agent_roster:
    - phase: <string>
      group: <string>
      agents: <array[string]>
  dispatch_protocol:
    can_lead_phases: <array[number]>
    can_support_in: <array[number]>
    auto_dispatch_to: <array[string]>
    tier: <string>
    communication_style: <string>
  constraints:
    phase_determination:
      deliverable_types:
        - type: <string>
          phase: <string>
          required_agent: <string>
          tier: <string>
---
```

## Field Specifications

### Root-Level Fields

#### `extends`
- **Type**: `string` (path)
- **Required**: Yes
- **Description**: Relative path to the L1 common PM agent file
- **Validation**: Must be `../../common/agents/pm.md`
- **Example**:
  ```yaml
  extends: ../../common/agents/pm.md
  ```

#### `variant`
- **Type**: `string`
- **Required**: Yes
- **Description**: Variant identifier (directory name)
- **Validation**: Must match template directory name
- **Allowed Values**: `co-design`, `co-security`, `co-develop`, `co-work`
- **Example**:
  ```yaml
  variant: co-design
  ```

#### `variant_overrides`
- **Type**: `object`
- **Required**: No (optional, empty if no overrides)
- **Description**: Container object for all variant-specific configuration overrides
- **Validation**: If present, must contain at least one override section
- **Example**:
  ```yaml
  variant_overrides:
    updated_role:
      description: "PM for security engagements"
      scope: "Authorization verification, threat modeling, findings closure"
  ```

---

## `variant_overrides` Field Specifications

### 1. `updated_role`

Variant-specific role clarification and scope definition.

**Schema**:
```yaml
updated_role:
  description: <string>
  scope: <string>
```

**Field Details**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Human-readable description of the PM's variant-specific role |
| `scope` | `string` | Yes | Comma-separated list of variant-specific responsibilities |

**Validation Rules**:
- `description` must be 10-200 characters
- `scope` must contain at least 2 responsibility areas
- Both fields must be in English

**Examples**:

```yaml
updated_role:
  description: "PM orchestrator for security engagements — owns team assembly, authorization verification, threat model validation, and engagement finalization"
  scope: "Authorization verification, threat modeling, security findings management, engagement closure"
```

```yaml
updated_role:
  description: "PM for design system projects — owns design system governance, component lifecycle, and design token management"
  scope: "Design system architecture, component standardization, design token governance, design ops coordination"
```

---

### 2. `governance_workflow`

Variant-specific workflow phase configuration.

**Schema**:
```yaml
governance_workflow:
  phases: <array[number]>
  triage_required: <boolean>
```

**Field Details**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phases` | `array[number]` | Yes | Array of phase numbers this PM orchestrates (0-6) |
| `triage_required` | `boolean` | No | Whether Phase 1 (Triage) requires PM involvement (default: false) |

**Phase Reference**:
- `0`: Project Initiation / Team Assembly
- `1`: Triage / Analysis
- `2`: Planning & Architecture
- `3`: Design Handoff
- `4`: Execution
- `5`: Quality Assurance
- `6`: Lifecycle Finalization

**Validation Rules**:
- `phases` must contain at least `[0, 2, 6]` (minimum PM orchestration)
- Phase numbers must be in range 0-6
- Array should be sorted in ascending order

**Examples**:

```yaml
governance_workflow:
  phases: [0, 2, 6]
  triage_required: false
```

```yaml
governance_workflow:
  phases: [0, 1, 2, 3, 4, 5, 6]
  triage_required: true
```

---

### 3. `agent_roster`

Variant-specific specialist agent configuration.

**Schema**:
```yaml
agent_roster:
  - phase: <string>
    group: <string>
    agents: <array[string]>
```

**Field Details**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phase` | `string` | Yes | Lifecycle phase where this agent group operates |
| `group` | `string` | Yes | Functional group classification (e.g., "Analysis", "Design", "Red Team") |
| `agents` | `array[string]` | Yes | Array of agent filenames (without `.md` extension) |

**Validation Rules**:
- `phase` values must match phase names from workflow
- `group` must be a known functional category
- `agents` array must contain at least one agent
- Agent names must not include `.md` extension
- Each agent must have a corresponding `agents/<name>.md` file

**Allowed Groups** (by variant):
- **co-design**: Analysis, Research, Design, Content, Execution
- **co-security**: Analysis, Red Team, Blue Team, Documentation
- **co-develop**: Analysis, Architecture, Development, Testing, DevOps
- **co-work**: Analysis, Planning, Execution, Documentation

**Examples**:

```yaml
agent_roster:
  - phase: "Triage / Analysis"
    group: "Analysis"
    agents: ["security-analyst"]
  - phase: "Threat Modeling"
    group: "Red Team"
    agents: ["red-team-lead", "threat-modeler"]
  - phase: "Penetration Testing"
    group: "Red Team"
    agents: ["pentester"]
  - phase: "Remediation"
    group: "Blue Team"
    agents: ["patch-engineer"]
  - phase: "Reporting"
    group: "Documentation"
    agents: ["report-writer"]
```

```yaml
agent_roster:
  - phase: "Research"
    group: "Research"
    agents: ["ux-researcher"]
  - phase: "Direction"
    group: "Design"
    agents: ["design-lead"]
  - phase: "Visual"
    group: "Design"
    agents: ["visual-designer"]
  - phase: "Prototype"
    group: "Execution"
    agents: ["prototype-engineer"]
```

---

### 4. `dispatch_protocol`

Variant-specific agent dispatch configuration.

**Schema**:
```yaml
dispatch_protocol:
  can_lead_phases: <array[number]>
  can_support_in: <array[number]>
  auto_dispatch_to: <array[string]>
  tier: <string>
  communication_style: <string>
```

**Field Details**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `can_lead_phases` | `array[number]` | Yes | Phase numbers where PM can lead orchestration |
| `can_support_in` | `array[number]` | No | Phase numbers where PM can act as supporting agent |
| `auto_dispatch_to` | `array[string]` | Yes | Agent names that PM auto-dispatches to without user confirmation |
| `tier` | `string` | Yes | PM's capability tier (model selection) |
| `communication_style` | `string` | Yes | Communication mode (`sync` or `async`) |

**Tier Values**:
- `high`: High-complexity orchestration (claude-opus-4-7, gemini-3.1-pro)
- `medium`: Standard orchestration (claude-sonnet-4-6, gemini-3.5-flash)
- `low`: Simple coordination (claude-haiku-4-5)

**Communication Style Values**:
- `sync`: Synchronous - requires user confirmation at each gate
- `async`: Asynchronous - autonomous agent handoffs

**Validation Rules**:
- `can_lead_phases` must include 0, 2, 6 (minimum PM orchestration)
- `can_support_in` is typically empty for PM (PM is orchestrator, not support)
- `auto_dispatch_to` agents must exist in `agent_roster`
- `tier` must be one of: high, medium, low
- `communication_style` must be either: sync, async

**Examples**:

```yaml
dispatch_protocol:
  can_lead_phases: [0, 2, 6]
  can_support_in: []
  auto_dispatch_to: [red-team-lead, pentester, threat-modeler, patch-engineer, report-writer]
  tier: high
  communication_style: sync
```

```yaml
dispatch_protocol:
  can_lead_phases: [0, 2, 3, 6]
  can_support_in: [4]
  auto_dispatch_to: [ux-researcher, design-lead, visual-designer, prototype-engineer]
  tier: high
  communication_style: sync
```

---

### 5. `constraints.phase_determination`

Variant-specific deliverable-type classification rules for phase determination.

**Schema**:
```yaml
constraints:
  phase_determination:
    deliverable_types:
      - type: <string>
        phase: <string>
        required_agent: <string>
        tier: <string>
```

**Field Details**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `string` | Yes | Deliverable type classification |
| `phase` | `string` | Yes | Target phase for this deliverable type |
| `required_agent` | `string` | Yes | Agent role that handles this deliverable |
| `tier` | `string` | Yes | Agent tier (High/Medium/Low) |

**Common Deliverable Types**:

| Type | Default Phase | Default Agent |
|-----|---------------|---------------|
| `New file design / schema / ADR` | Phase 1-2 | architect |
| `New directory or template layout` | Phase 1-2 | architect |
| `Cross-platform convention / naming standard` | Phase 1-2 | architect |
| `Script or code implementation` | Phase 4 | automation-engineer |
| `Documentation update` | Phase 4 | docs-writer |
| `Security configuration` | Phase 6 | security-expert |
| `Project scaffolding` | Phase 0 | scaffolding-expert |

**Variant-Specific Examples**:

**co-design**:
```yaml
constraints:
  phase_determination:
    deliverable_types:
      - type: "Design system architecture"
        phase: "Phase 1-2"
        required_agent: "design-architect"
        tier: "High"
      - type: "Component specification"
        phase: "Phase 3"
        required_agent: "component-designer"
        tier: "Medium"
      - type: "Design token definition"
        phase: "Phase 4"
        required_agent: "design-engineer"
        tier: "Low"
```

**co-security**:
```yaml
constraints:
  phase_determination:
    deliverable_types:
      - type: "Threat model"
        phase: "Phase 1-2"
        required_agent: "threat-modeler"
        tier: "High"
      - type: "Penetration test"
        phase: "Phase 4"
        required_agent: "pentester"
        tier: "Medium"
      - type: "Vulnerability report"
        phase: "Phase 5"
        required_agent: "report-writer"
        tier: "Medium"
      - type: "Security patch"
        phase: "Phase 4"
        required_agent: "patch-engineer"
        tier: "Low"
```

**Validation Rules**:
- `type` must be unique within the array
- `phase` must match governance workflow phases
- `required_agent` must exist in agent_roster
- `tier` must be one of: High, Medium, Low
- Tier ceiling rule applies: Low-tier agents cannot be assigned High-tier tasks

---

## Complete Example Files

### Example 1: co-design Variant

```yaml
---
extends: ../../common/agents/pm.md
variant: co-design
variant_overrides:
  updated_role:
    description: "PM orchestrator for design system projects — owns team assembly, design validation, and system finalization"
    scope: "Design system governance, component lifecycle, design token management, design ops coordination"
  governance_workflow:
    phases: [0, 2, 6]
    triage_required: false
  agent_roster:
    - phase: "Research"
      group: "Research"
      agents: ["ux-researcher"]
    - phase: "Direction"
      group: "Design"
      agents: ["design-lead"]
    - phase: "Visual"
      group: "Design"
      agents: ["visual-designer"]
    - phase: "Prototype"
      group: "Execution"
      agents: ["prototype-engineer"]
    - phase: "Service"
      group: "Design"
      agents: ["service-designer"]
    - phase: "Typography"
      group: "Design"
      agents: ["typography-expert"]
    - phase: "Narrative"
      group: "Content"
      agents: ["storyteller"]
  dispatch_protocol:
    can_lead_phases: [0, 2, 6]
    can_support_in: []
    auto_dispatch_to: [ux-researcher, design-lead, visual-designer, prototype-engineer, service-designer, typography-expert, storyteller]
    tier: high
    communication_style: sync
  constraints:
    phase_determination:
      deliverable_types:
        - type: "Design system architecture"
          phase: "Phase 1-2"
          required_agent: "design-architect"
          tier: "High"
        - type: "Component specification"
          phase: "Phase 3"
          required_agent: "component-designer"
          tier: "Medium"
        - type: "Design token definition"
          phase: "Phase 4"
          required_agent: "design-engineer"
          tier: "Low"
---
```

### Example 2: co-security Variant

```yaml
---
extends: ../../common/agents/pm.md
variant: co-security
variant_overrides:
  updated_role:
    description: "PM orchestrator for security engagements — owns team assembly, authorization verification, threat model validation, and engagement finalization"
    scope: "Authorization verification, threat modeling, security findings management, engagement closure"
  governance_workflow:
    phases: [0, 2, 6]
    triage_required: true
  agent_roster:
    - phase: "Triage / Analysis"
      group: "Analysis"
      agents: ["security-analyst"]
    - phase: "Threat Modeling"
      group: "Red Team"
      agents: ["red-team-lead", "threat-modeler"]
    - phase: "Penetration Testing"
      group: "Red Team"
      agents: ["pentester"]
    - phase: "Remediation"
      group: "Blue Team"
      agents: ["patch-engineer"]
    - phase: "Reporting"
      group: "Documentation"
      agents: ["report-writer"]
  dispatch_protocol:
    can_lead_phases: [0, 2, 6]
    can_support_in: []
    auto_dispatch_to: [red-team-lead, pentester, threat-modeler, patch-engineer, report-writer]
    tier: high
    communication_style: sync
  constraints:
    phase_determination:
      deliverable_types:
        - type: "Threat model"
          phase: "Phase 1-2"
          required_agent: "threat-modeler"
          tier: "High"
        - type: "Penetration test"
          phase: "Phase 4"
          required_agent: "pentester"
          tier: "Medium"
        - type: "Vulnerability report"
          phase: "Phase 5"
          required_agent: "report-writer"
          tier: "Medium"
        - type: "Security patch"
          phase: "Phase 4"
          required_agent: "patch-engineer"
          tier: "Low"
---
```

### Example 3: Minimal Variant (No Overrides)

```yaml
---
extends: ../../common/agents/pm.md
variant: co-work
# No variant_overrides - uses L1 defaults
---
```

---

## Scaffolding Integration

This schema is used by:
- `scripts/create-l2-scaffold.ts` - Initial variant scaffolding
- `scripts/l2-to-variant-pipeline.ts` - L2 to template promotion
- Variant author workflows - Manual override configuration

### Scaffolding Script Usage

When creating a new L2 variant, the scaffolding script:

1. Validates `variant` name against allowed values
2. Creates `templates/<variant>/agents/pm.md`
3. Injects YAML frontmatter with variant-specific defaults
4. Creates placeholder agent files for all `agent_roster` entries
5. Validates YAML syntax before completion

### Validation Checklist

Before committing an L2 pm.md file:

- [ ] YAML frontmatter is valid (no syntax errors)
- [ ] `extends` path is correct: `../../common/agents/pm.md`
- [ ] `variant` matches directory name
- [ ] All `agent_roster` agents have corresponding `.md` files
- [ ] All `auto_dispatch_to` agents exist in `agent_roster`
- [ ] `tier` values are valid (high/medium/low)
- [ ] `communication_style` is valid (sync/async)
- [ ] `phase` numbers are in range 0-6
- [ ] All required fields are present
- [ ] No duplicate `type` entries in `constraints.phase_determination`

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-07 | Initial schema specification for L2 PM YAML frontmatter |

---

## Related Documentation

- [L1-L2 Fork Model](../adr/0031-l1-l2-fork-model.md)
- [Variant Creation Workflow](../variant-creation-workflow.md)
- [PM Agent Role](../../lifecycle/agents/pm.md)
- [Multi-Agent Architecture](../../constitution/05-multi-agent-architecture.md)
- [Agent Lifecycle](../../constitution/05.6-agent-lifecycle.md)

---

**Maintained by**: PM Agent (workspace root)  
**Last Review**: 2026-06-07  
**Next Review**: 2026-07-07
