# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** - auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`.
> **Agent architecture and governance rules**: See [CONSTITUTION.md §5 - Multi-Agent Architecture](CONSTITUTION.md#5-multi-agent-architecture).

---

## Agent Roster

### 🛠️ Orchestration / Audit

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates team assembly (Phase 0), design validation (Phase 2), and finalization (Phase 6); reduced bottleneck role |
| Consistency Auditor | [`agents/auditor.md`](agents/auditor.md) | Medium | Cross-validates documentation; owns Phase 5 QA gate independently; ensures rules consistency

### 📐 Design

| Agent | File | Tier | Role |
|-------|------|------|------|
| Template Architect | [`agents/architect.md`](agents/architect.md) | High | Overall project structure design expert; defines folder hierarchies and architectural standards; produces implementation plans and ADRs |

### ⚙️ Execution

| Agent | File | Tier | Role |
|-------|------|------|------|
| Automation Engineer | [`agents/automation-engineer.md`](agents/automation-engineer.md) | Low | Scripting and tools expert; maintains .ps1 and .sh cross-platform scripts; ensures idempotency and robustness |
| Documentation Writer | [`agents/docs-writer.md`](agents/docs-writer.md) | **Medium** | Executes documentation changes per Architect decisions; writing, editing, terminology consistency; Architect owns document architecture design |
| Scaffolding Expert | [`agents/scaffolding-expert.md`](agents/scaffolding-expert.md) | Low | New Project & Template Specialist; validates new-project logic; ensures template folder synchrony; prevents OS-level encoding corruption |

### 🛡️ Security

| Agent | File | Tier | Role |
|-------|------|------|------|
| Security & Git Expert | [`agents/security-expert.md`](agents/security-expert.md) | Medium | Enforces Git Hooks; manages .gitleaks configurations; handles credential management; ensures secure dependency handling |

---

## PM Subagent Dispatch Protocol

### Dispatch Decision

```
Request received
  │
  ├─▶ Read-only? (research, analysis, inspect)
  │   └─▶ PARALLEL - dispatch multiple agents in a single message
  │
  └─▶ Write? (create/edit files, run tests)
       └─▶ SERIAL - one agent at a time to prevent file lock conflicts
```

> **Why serial writes?** Concurrent writes to the same files cause merge conflicts and lock contention.
> Always wait for a write agent to complete before dispatching the next.

### Superpowers Plugin & Cost Optimization (3-Tier Strategy)

The PM agent MUST leverage the **`superpowers`** plugin for harness engineering using a 3-tier model strategy to optimize cost and quality:

- **High-tier (Design/Plan)**: Used exclusively by the PM/Architect for complex reasoning, architectural design, and writing precise sub-agent prompts.
- **Medium-tier (Review/QA)**: Used by Auditor or Security agents to review code, run tests, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Automation Engineer agents for fast typing, simple repetitive coding, or strictly scoped tasks.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The PM agent delegates execution to the Low-tier and delegates review to the Medium-tier before finalizing.

### Dispatch Rules

1. **Autonomous Agent Handoffs** - Agents can dispatch each other directly via JSON contracts without PM intervention for routine workflows
2. **PM Orchestration Phases** - PM only orchestrates Phases 0 (Team Assembly), 2 (Design Validation), and 6 (Finalization)
3. **Independent QA Gate** - Auditor owns Phase 5 QA gate autonomously using qa-gate.sh/.ps1 scripts
4. **Parallel Agent Dispatch** - all parallel agents must be dispatched in one turn for research/analysis phases
5. **Error handling** - if any parallel agent fails, responsible agent resolves failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to PM for intervention

### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | High | - | orchestrates only |
| Consistency Auditor | `agents/auditor.md` | Medium | Independent QA | No |
| Template Architect | `agents/architect.md` | High | Design phase | No |
| Automation Engineer | `agents/automation-engineer.md` | Low | Serial | Script files only |
| Documentation Writer | `agents/docs-writer.md` | **Medium** | After design | .md files only |
| Scaffolding Expert | `agents/scaffolding-expert.md` | Low | Research phase | setup scripts only (after approval) |
| Security & Git Expert | `agents/security-expert.md` | Medium | Review phase | Hook configs only |

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [CONSTITUTION.md §5.1](CONSTITUTION.md#51-agent-file-format-standard-frontmatter).

---

## Harness Engineering Workflow

Following the **PM governance workflow** defined in [CONSTITUTION.md §5.4](CONSTITUTION.md#54-pm-governance-workflow-6-phases):

```
Phase 0 - Team Assembly & Skill Orchestration (Kickoff)
  PM assesses workspace requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1 - Analysis & Triage
  PM classifies the request
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria

Phase 2 - Design
  Architect produces implementation plan + ADR
  PM validates design approach and obtains explicit user approval → GATE

Phase 3 - Implementation (serial)
  Automation Engineer implements per approved plan
  Documentation Writer updates docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 4 - QA Gate (Independent Auditor)
  Auditor executes qa-gate.sh/.ps1 autonomously
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE

Phase 5 - Finalization
  PM logs decisions to memory/YYYY-MM-DD.md
  PM runs /sync "type: description" → PR opened
```

---

## Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the implementation approach and folder structure | `architect` | `automation-engineer` |
| Write or modify scripts (.sh, .ps1) | `automation-engineer` | `architect` |
| Update documentation files | `docs-writer` | `architect` |
| Create new project from template | `scaffolding-expert` | `automation-engineer` |
| Security review, Git hooks configuration | `security-expert` | `architect` |
| Cross-validate documentation consistency | `auditor` | `docs-writer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |

---

## Skills

> **Skill structure specification**: See [CONSTITUTION.md §6 - Skills](CONSTITUTION.md#6-skills) for frontmatter format and session skill registration.

| Skill | File | Trigger condition |
|-------|------|-------------------|
| UI/UX Design Intelligence | `.claude/skills/ui-ux-pro-max/SKILL.md` | Building web components, pages, or applications; UI/UX design tasks |
| Skill Lifecycle Manager | `.claude/skills/skill-lifecycle-manager/SKILL.md` | PM agent managing skill lifecycle after agent configuration changes; checking skill health, orphaned/deprecated skills |
| Script Lifecycle Manager | `.claude/skills/script-lifecycle-manager/SKILL.md` | PM agent managing script lifecycle; creating scripts, managing versions and dependencies in SCRIPTS.md |
| Agent Lifecycle Manager | `.claude/skills/agent-lifecycle-manager/SKILL.md` | PM agent managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| Simulate Project Creation | `skills/simulate-project-creation/SKILL.md` | Testing new-project scaffolding logic in temporary directory |
| Security Scan | `skills/security-scan/SKILL.md` | Running vulnerability scans, checking advisories, secret detection |
| Audit Workspace | `skills/audit-workspace/SKILL.md` | Validating workspace standards compliance, documentation consistency |
| Validate Docs Links | `skills/validate-docs-links/SKILL.md` | Checking all markdown links point to existing files |
| Meeting Facilitation | `skills/meeting-facilitation/SKILL.md` | Running an interactive meeting where agents read each other's contributions and respond in dialogue |
| Validate Templates | `scripts/validate-templates.sh` | Validating template variant structure, agent frontmatter, AGENTS.md roster, and shared file sync; run manually or triggered by pre-commit on templates/ changes |

> **Note:** This is the workspace root - skills here focus on template maintenance and scaffolding validation.
> Individual projects may define their own project-specific skills.
>
> **Platform Support:** Skills are compatible with both Claude Code and Antigravity (Gemini CLI).
> Lifecycle audit scripts use Bun (`.ts`) for cross-platform support.

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Coding Standards**: Follow SOLID principles. Write unit tests when creating functional code. No speculative abstractions.
- **Language**: All code, config, commit messages, and branch names - **English only**.
- **UTF-8 Enforcement**: Always use UTF-8 encoding; prevent CP949 or other localized encoding corruptions.

---

## Lifecycle Management

Use the dedicated lifecycle manager skills whenever creating, modifying, or retiring agents and skills. These skills are located in `.claude/skills/` and are loaded automatically by Claude Code.

### Agent Lifecycle

| Event | Skill to Use | Action |
|-------|-------------|--------|
| Create new agent | `agent-lifecycle-manager` | Draft frontmatter → write content → register in AGENTS.md → validate |
| Update agent role/tier | `agent-lifecycle-manager` | Update frontmatter → bump version → re-validate |
| Deprecate agent | `agent-lifecycle-manager` | Set `status: deprecated` → reassign owned skills → update AGENTS.md |

**Trigger**: Invoke the `agent-lifecycle-manager` skill from Claude Code when any of the above events occur.

```
Skill("agent-lifecycle-manager")
```

### Skill Lifecycle

| Event | Skill to Use | Action |
|-------|-------------|--------|
| Create new skill | `skill-lifecycle-manager` | Create `skills/<name>/SKILL.md` → write frontmatter → update AGENTS.md Skills table |
| Update skill metadata | `skill-lifecycle-manager` | Update frontmatter → bump version → re-validate |
| Deprecate skill | `skill-lifecycle-manager` | Set `status: deprecated` → archive after 30 days → update AGENTS.md |

**Trigger**: Invoke the `skill-lifecycle-manager` skill from Claude Code when any of the above events occur.

```
Skill("skill-lifecycle-manager")
```

### Script Lifecycle

| Event | Skill to Use | Action |
|-------|-------------|--------|
| Create new script | `script-lifecycle-manager` | Create script → update SCRIPTS.md → write documentation |
| Update script | `script-lifecycle-manager` | Modify script → bump version in SCRIPTS.md → validate |
| Deprecate script | `script-lifecycle-manager` | Set `status: deprecated` and `removal-date` → update SCRIPTS.md |

**Trigger**: Invoke the `script-lifecycle-manager` skill from Claude Code/Antigravity when any of the above events occur.

```
Skill("script-lifecycle-manager")
```

### Skills Location Reference

| Location | Purpose |
|----------|---------|
| `.claude/skills/` | Workspace-level skills (available in all sessions) |
| `skills/` | Workspace utility skills (validate, scan, simulate) |
| `templates/common/skills/` | Single source of truth — changes here must sync to `.claude/skills/` |

> **Sync rule**: When updating a skill in `templates/common/skills/`, also update the corresponding file in `.claude/skills/`. Run `bash scripts/audit.sh` to verify.

---

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in [CONSTITUTION.md §5.1](CONSTITUTION.md#51-agent-file-format-standard-frontmatter).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in [CONSTITUTION.md §6.2](CONSTITUTION.md#62-skill-file-format-standard-frontmatter).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [CONSTITUTION.md §1](CONSTITUTION.md#1-standard-folder-structure).
