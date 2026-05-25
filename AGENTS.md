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

| Agent | File | Role |
|-------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | Owns the full workflow; dispatches parallel tasks; enforces quality gates; evaluates requirements and enforces CONSTITUTION.md standards |
| Consistency Auditor | [`agents/auditor.md`](agents/auditor.md) | Cross-validates documentation; ensures rules defined in one place are not contradicted elsewhere |

### 📐 Design

| Agent | File | Role |
|-------|------|------|
| Template Architect | [`agents/architect.md`](agents/architect.md) | Overall project structure design expert; defines folder hierarchies and architectural standards; produces implementation plans and ADRs |

### ⚙️ Execution

| Agent | File | Role |
|-------|------|------|
| Automation Engineer | [`agents/automation-engineer.md`](agents/automation-engineer.md) | Scripting and tools expert; maintains .ps1 and .sh cross-platform scripts; ensures idempotency and robustness |
| Documentation Writer | [`agents/docs-writer.md`](agents/docs-writer.md) | Standardizes Markdown documentation (README.md, CONSTITUTION.md, CHANGELOG.md) and manages locales/ translations |
| Scaffolding Expert | [`agents/scaffolding-expert.md`](agents/scaffolding-expert.md) | New Project & Template Specialist; validates new-project logic; ensures template folder synchrony; prevents OS-level encoding corruption |

### 🛡️ Security

| Agent | File | Role |
|-------|------|------|
| Security & Git Expert | [`agents/security-expert.md`](agents/security-expert.md) | Enforces Git Hooks; manages .gitleaks configurations; handles credential management; ensures secure dependency handling |

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

1. **Single message, multiple `Agent()` calls** - all parallel agents must be dispatched in one turn.
2. **Merge before proceeding** - PM waits for ALL parallel agents to return before the next serial step.
3. **Phase 4 execution loop** - each implementation task goes through:
   - **automation-engineer** implements the changes
   - **auditor** verifies against acceptance criteria and consistency
   - **Quality gate (audit script)** validates compliance
   - Loop and correct if issues found - maximum **3 iterations** before escalating to the user.
4. **Error handling** - if any parallel agent fails, PM resolves the failure before proceeding. Do not skip.
5. **Max fix iterations** - 3 per review cycle before escalating to the user.

### Subagent Roster

| Agent | File | Parallelizable | Write Allowed? |
|-------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | - | orchestrates only |
| Consistency Auditor | `agents/auditor.md` | Triage phase | No |
| Template Architect | `agents/architect.md` | Design phase | No |
| Automation Engineer | `agents/automation-engineer.md` | Serial | Script files only |
| Documentation Writer | `agents/docs-writer.md` | After design | .md files only |
| Scaffolding Expert | `agents/scaffolding-expert.md` | Research phase | setup scripts only (after approval) |
| Security & Git Expert | `agents/security-expert.md` | Review phase | Hook configs only |

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [CONSTITUTION.md §5.1](CONSTITUTION.md#51-agent-file-format-standard-frontmatter).

---

## Harness Engineering Workflow

Following the **PM governance workflow** defined in [CONSTITUTION.md §5.4](CONSTITUTION.md#54-pm-governance-workflow-6-phases):

```
Phase 0 - Team Assembly & Skill Orchestration (Kickoff)
  PM assesses workspace requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1 - Triage & Analysis
  PM classifies the request
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria

Phase 2 - Design
  Architect produces implementation plan + ADR
  PM obtains explicit user approval → GATE

Phase 3 - Implementation (serial)
  Automation Engineer implements per approved plan
  Documentation Writer updates docs as needed
  Auditor verifies after each change

Phase 4 - QA Gate (all must pass)
  bash scripts/audit.sh     exit 0
  [project test command]    all tests pass

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
| Simulate Project Creation | `skills/simulate-project-creation/SKILL.md` | Testing new-project scaffolding logic in temporary directory |
| Security Scan | `skills/security-scan/SKILL.md` | Running vulnerability scans, checking advisories, secret detection |
| Audit Workspace | `skills/audit-workspace/SKILL.md` | Validating workspace standards compliance, documentation consistency |
| Validate Docs Links | `skills/validate-docs-links/SKILL.md` | Checking all markdown links point to existing files |

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

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Add a row to the Agent Roster table above.
2. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
3. Ensure the agent file follows the frontmatter specification in [CONSTITUTION.md §5.1](CONSTITUTION.md#51-agent-file-format-standard-frontmatter).
4. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Add a row to the Skills table above.
2. Ensure the skill follows the frontmatter specification in [CONSTITUTION.md §6.2](CONSTITUTION.md#62-skill-file-format-standard-frontmatter).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [CONSTITUTION.md §1](CONSTITUTION.md#1-standard-folder-structure).
