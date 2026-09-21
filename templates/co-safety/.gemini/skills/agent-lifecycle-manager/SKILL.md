---
name: agent-lifecycle-manager
status: active
scope: co-safety
description: >
  Manages the creation, validation, and maintenance of AI agent files across the project,
  including PM-led hiring (creation) and firing (deprecation/removal) of agents with their
  skill packages. Use when: creating new agents, hiring or firing agents, updating agent
  metadata/frontmatter, validating agent structures, attaching or detaching skills to agents,
  or managing agent roles and 3-tier configurations.
owner: pm
version: 1.2.0
last_reviewed: 2026-09-18
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
    - hire agent
    - fire agent
    - deprecate agent
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
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

**Hire an Agent (PM-decided):**
- Trigger: PM observes a hiring signal (recurring unmatched work type, role overload, new domain) or the user explicitly requests a new specialist
- Use Case: PM determines the roster needs a new specialist and runs the Hiring Workflow below

**Fire an Agent (PM-decided):**
- Trigger: PM observes a firing signal (long undispatched agent, absorbed role, quarterly roster review) or the user explicitly requests removal
- Use Case: PM determines an agent should exit the roster and runs the Firing Workflow below

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

## Hiring Workflow (PM-decided)

PM decides when to hire autonomously — no blocking user approval. A hiring decision is recorded and executed through dispatch:

| Role | Duty |
|------|------|
| PM | Detect signal, define role, decide, emit decision record, dispatch |
| automation-engineer | Execute file edits (agent file, registry) |
| lifecycle-manager | Update governance records, publish L0→L1 |

### Step H1: Detect Signal and Check Duplication

**Hiring signals** (any one suffices, evidence goes in the decision record):
- The same work type recurs with no matching specialist at triage classification
- One agent repeatedly absorbs unrelated domain work (role overload)
- A new domain keeps requiring ad-hoc handling; a direct user request ("hire an agent for X") is also a valid signal

Before proceeding, verify the role does not duplicate an existing agent: review the current roster (`agents/*.md` frontmatter and the AGENTS.md §1 roster) and check whether re-tiering, re-scoping, or a skill attach would cover the need instead.

### Step H2: Define the Role

- Name: kebab-case, maps 1:1 to `agents/<name>.md`
- Responsibilities: 2–4 concrete duties, distinct from every existing agent
- Phases: which workflow phases the agent leads or supports
- Tier: assign per the 3-tier strategy (`docs/workspace-schema.json` → `agent_tiers` is SSOT)

### Step H3: Assemble the Initial Skill Package

The initial skill package is part of the hiring decision (PM-decided). For each required capability:

1. Search `skills/*/SKILL.md` for an existing skill covering it
2. **Found** → attach: set/extend the skill's `owner:` to include the new agent (see Skill Attach/Detach Rules below)
3. **Not found** → file a skill `create` request through the Skill Request Workflow in `skill-lifecycle-manager` (agent-initiated, PM-approved); execution may follow after hiring

### Step H4: Record the Decision

Before any dispatch:
1. Emit a Gate-Moment Decision Record at `docs/decisions/DEC-YYYYMMDD-NN.md` (ADR-0061): signal, evidence, role definition, skill package, alternatives considered (re-scope/attach existing agent)
2. Append a summary entry to the active `memory/YYYY-MM-DD.md`

### Step H5: Execute via Dispatch

PM dispatches **automation-engineer** (never edits files directly):
1. Create `agents/<name>.md` — write it directly (recommended) or via `bun scripts/agent-create.ts <agent-name>`; the file must contain **all schema-required frontmatter fields** (`name`, `role`, `status`, `tier`, `version`, `last_reviewed`, `description`, `lifecycle` per `schemas/agent.schema.json`)
2. Register the agent in the AGENTS.md §1 Agent Roster table (`| Agent Role | agents/agent-name.md | Tier | Role description |`)
3. Apply the skill package owner updates (Step H3)
4. lifecycle-manager then updates governance records and publishes via `bun run propagate:apply`

### Step H6: Validate

```bash
bun scripts/agent-lifecycle-audit.ts   # all-agent audit
bun scripts/lifecycle-sync-audit.ts    # Check F: tier SSOT consistency
```

Both must pass before the hiring is considered complete.

---

## Firing Workflow (PM-decided)

PM decides when to fire autonomously. Default exit is **deprecation** (reversible); hard delete requires an explicit user request.

### Step F1: Detect Signal and Analyze Dependencies

**Firing signals**:
- Agent not dispatched over an extended period (evidence from lifecycle records / memory logs)
- Role fully absorbed by another agent
- Quarterly roster review (AGENTS.md §10 cadence; the Q4 deprecation sweep may be extended to agents)

Dependency analysis before deciding — map everything that breaks if the agent exits:
1. **Owned skills**: reverse-lookup `owner:` across `skills/*/SKILL.md`
2. **Handoff relations**: `handoff_to` / `handoff_from` in the agent definition and dispatch templates
3. **Phases**: phases where the agent is lead or supporting
4. **Roster references**: AGENTS.md §1/§4.1 rows, `docs/lifecycle/agents/<name>.md`

### Step F2: Plan Skill Disposition

The disposition plan is part of the firing decision — the fired agent cannot request anything:
- **Still-needed skills** → reassign `owner:` to a surviving agent (or to the hiring package of a replacement)
- **Unnecessary skills** → route through the Deprecation & Removal section of `skill-lifecycle-manager` (PM-approved)

### Step F3: Record the Decision

Before any dispatch:
1. Emit a Gate-Moment Decision Record at `docs/decisions/DEC-YYYYMMDD-NN.md` (ADR-0061): signal, dependency map, disposition plan, exit mode (deprecate vs delete)
2. Append a summary entry to the active `memory/YYYY-MM-DD.md`

### Step F4: Execute via Dispatch

PM dispatches **automation-engineer**:

**Default — deprecate:**
1. Set `status: deprecated` in the agent frontmatter (keep the file and governance record in place)
2. Apply the skill disposition plan (Step F2)
3. Update AGENTS.md roster cells (mark deprecated; do not delete the row yet)
4. lifecycle-manager updates governance records and publishes L0→L1

**Hard delete — explicit user request only:**
1. Confirm the user explicitly asked for deletion (not just "fire" in passing)
2. Run `bun scripts/agent-delete.ts <name> --force`
3. Remove the AGENTS.md §1/§4.1 roster rows
4. Complete the skill disposition plan — no orphaned skills may remain
5. lifecycle-manager updates governance records and publishes L0→L1

### Step F5: Validate

```bash
bun scripts/agent-lifecycle-audit.ts
bun scripts/lifecycle-sync-audit.ts
```

Additional checks: no dangling `handoff_to`/`handoff_from` references to the fired agent; no skill left with the fired agent as sole `owner:`.

---

## Skill Attach/Detach Rules

Skill-to-agent binding lives in the skill frontmatter `owner:` field. Keep both surfaces consistent — the skill's `owner:` and the agent's own capability descriptions must tell the same story.

- **Attach**: add the agent name to `owner:` (space-delimited or list per existing notation in that file). Do not remove the previous owner unless the capability moves entirely.
- **Detach**: remove the agent from `owner:` only when another owner remains or the skill is routed to deprecation (never leave `owner:` empty).
- **Multi-owner**: allowed — record the primary owner first; each owner must actually dispatch the skill in its workflow, otherwise use a one-off reference instead.
- **Consistency check**: after any attach/detach, grep both directions — the skill's `owner:` list and the agent definition's tool/skill sections — and fix drift before validation.

---


## Expected Outputs

- Properly formatted agent `.md` file in the `agents/` directory.
- Clean run of `agent-lifecycle-audit.ts` with 0 errors or warnings.
- Updated `AGENTS.md` reflecting the new or modified agent state.
- For hiring: decision record + registered roster row + attached skill package.
- For firing: decision record + deprecated status (or clean delete) + completed skill disposition plan.

---

## Related Skills

- **skill-lifecycle-manager**: Manages skill creation, validation, agent skill requests (Step R1–R3), and skill deprecation/removal.
- **team-builder**: Whole-team restructuring (benchmarking, bulk create/convert/delete with skill transfer) — use for team-scale changes, not single-agent hire/fire.
