---
name: agent-lifecycle-manager
status: active
scope: common
description: >
  Manages the creation, validation, and maintenance of AI agent files across the project.
  Use when: creating new agents, updating agent metadata/frontmatter, validating agent structures,
  or managing agent roles and 3-tier configurations.
owner: pm
version: 1.1.0
last_reviewed: 2026-09-15
relates_to:
  - skill: skill-lifecycle-manager
    type: composes_with
metadata:
  type: process
  triggers:
    - create agent
    - new agent
    - validate agents
    - agent lifecycle
    - manage agents
---

## Overview

This skill provides a systematic approach to creating, validating, and maintaining AI agent files (`agents/*.md`). It ensures all agents follow proper structure, have correct YAML frontmatter (status, tier, role, etc.), and are properly registered in the central `AGENTS.md` registry.

## When to Use This Skill

**Create New Agent:**
- Trigger: "Create a new agent for X" or "Add a new agent to the project"
- Use Case: A new specific role is needed that requires its own system prompt and tools.

**Validate Existing Agents:**
- Trigger: "Check if agents are valid" or "Run agent audit"
- Use Case: After modifying agent markdown files, before committing changes.

**Update Agent Status/Metadata:**
- Trigger: "Update agent tiers" or "Deprecate agent Y"
- Use Case: Modifying the 3-tier strategy mappings or retiring old agents.

---

## Step 1: Create or Update Agent File

**Purpose**: Create or modify an agent file in the `agents/` directory.

**Steps**:
1. Navigate to the `agents/` directory in the project root.
2. Create or edit `agents/<agent-name>.md` using kebab-case naming.
3. (Optional) Run `bun scripts/agent-create.ts <agent-name>` if you want to use the automated scaffolding script.

---

## Step 2: Write Agent Frontmatter

**Purpose**: Define agent metadata using the standard YAML frontmatter specification.

**Required Frontmatter Structure**:
```yaml
---
name: agent-name
role: "Brief 2-4 word title"
status: active
description: "Short sentence on what the agent does"
tier:
  claude: high | medium | low
  gemini: high | medium | low
  antigravity: high | medium | low
  gemini-cli: high | medium | low
  codex: high | medium | low
---
```

**Validation**:
- All required fields must be present.
- `status` must be valid.
- `tier` mappings must strictly follow the 3-tier strategy rules.

---

## Step 3: Write Agent Content

**Purpose**: Document the agent's system prompt and behavioral instructions.

**Content Guidelines**:
- Provide clear identity and context mapping.
- Focus on specific behavioral guidelines and domain constraints.
- Do NOT repeat global rules (like UTF-8 enforcement or standard PR procedures) that are already covered in workspace standards.
- **If the agent role involves research, investigation, or presenting external information**: explicitly include the Source Attribution principle in the agent's constraints or behavioral guidelines — require source citation for factual claims and use `⚠️ Unverified` disclosure for unverifiable information.

---

## Step 4: Update AGENTS.md Registry

**Purpose**: Register the agent in the project's central orchestrator document.

**Steps**:
1. Open `AGENTS.md` in the project root.
2. Add a new row to the appropriate table (Orchestration, Design, Execution, Security).
3. Ensure the format matches: `| Agent Role | agents/agent-name.md | Tier | Role description |`

---

## Changing an Agent's Tier

**Purpose**: Keep every tier declaration surface in sync when a tier changes.

Tier is declared in multiple places, and `docs/workspace-schema.json` → `agent_tiers` is the single source of truth (the `agent-model-gate` hook reads it at runtime). **Update surfaces in this order**:

1. `docs/workspace-schema.json` → `agent_tiers` (SSOT — change this first)
2. `agents/<name>.md` frontmatter `tier:` block (all 5 platforms, same value)
3. `AGENTS.md` §1 Agent Roster and §4.1 Subagent Roster Tier cells
4. `docs/lifecycle/agents/<name>.md` `**Tier**:` field (and any stale tier prose)

Then run the tier drift check — it must pass before the change lands:

```bash
bun scripts/lifecycle-sync-audit.ts   # Check F: agent tiers vs agent_tiers SSOT
```

---

## Step 5: Validate Agent Lifecycle

**Purpose**: Ensure the agent passes all programmatic lifecycle audits.

**Run Validation Scripts**:
To run a comprehensive audit across all agents:
```bash
bun scripts/agent-lifecycle-audit.ts
```

To verify a specific agent:
```bash
bun scripts/agent-verify.ts <agent-name>
```

To verify tier consistency across all declaration surfaces (schema SSOT, frontmatter, AGENTS.md rosters, lifecycle records):
```bash
bun scripts/lifecycle-sync-audit.ts   # Check F
```

**Validation Checklist**:
- [ ] No orphaned agents (every `.md` file in `agents/` is listed in `AGENTS.md`)
- [ ] Frontmatter passes all audit checks
- [ ] Tier mappings are correctly structured
- [ ] Tier drift check passes (Check F: frontmatter, rosters, and lifecycle record all match `agent_tiers`)
- [ ] **Recommended**: Consider declaring the skill's deployment scope — is it needed in all variant projects (common) or workspace-root-only? Workspace-only skills should not be placed in `templates/common/skills/`.
- [ ] **If research/investigation role**: agent content includes source citation requirements and uncertainty disclosure (`⚠️ Unverified`)
- [ ] **If numerical computation role** (aerospace, finance, precision control, scientific): agent content includes Computational Integrity Standards — states that calculations must be delegated to external tools (Fortran, Python+NumPy, etc.) and never performed by AI directly
- [ ] **If education/tutoring/coaching role**: agent content includes the Socratic Method as the default teaching approach — guide learners through questions before providing direct answers; include explicit exceptions for urgent or simple lookup contexts where direct answers are appropriate

---

## Expected Outputs

- Properly formatted agent `.md` file in the `agents/` directory.
- Clean run of `agent-lifecycle-audit.ts` with 0 errors or warnings.
- Updated `AGENTS.md` reflecting the new or modified agent state.

---

## Related Skills

- **skill-lifecycle-manager**: Manages skill creation and validation.
