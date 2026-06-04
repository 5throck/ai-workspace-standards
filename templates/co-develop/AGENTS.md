# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** -auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context -`docs/context.md`.

---

## Multi-Agent Phase Definitions

**co-develop follows the standard 7-phase workflow** defined in [`phase-definitions.md`](phase-definitions.md) <!-- path resolves post-scaffolding -->.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|-----------------|-------------------|
| 0 | Project Initiation | Orchestrator | stack-setup |
| 1-2 | Planning & Architecture | Observer | architect |
| 3 | Design Handoff | Coordinator | designer |
| 4 | Implementation | Coordinator | code-writer, test-runner |
| 5 | Quality Assurance | Owner | security-monitor |
| 6 | PR & Handoff | Owner | — (PM only) |

**PM Facilitation Guidance:**
See [`phase-definitions.md`](phase-definitions.md) <!-- path resolves post-scaffolding --> for detailed PM tasks in each phase:
- Opening the phase (objective, specialist nomination, expectations)
- Progress monitoring (intervene only if standards not met)
- Synthesis of outputs (key findings, decisions)
- Provisional decision with justification
- Follow-up assignment

**Phase-Specific Notes for co-develop:**
- **Phase 3 (Design Handoff)**: Designer produces UI/UX specs before execution phase
- **Phase 4 (Execution)**: automation-engineer and docs-writer work in parallel
- **Phase 5 (QA)**: Both security-expert and auditor must approve before proceeding

---

## Agent Roster

### 🛠️ Orchestration / Audit

| Agent | File | Role |
|-------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | Owns the full workflow; dispatches parallel tasks; enforces quality gates |
| Security Monitor | [`agents/security-monitor.md`](agents/security-monitor.md) | Enforces security policies; prevents secrets leaks; monitors safe dependencies |

### 📐 Design

| Agent | File | Role |
|-------|------|------|
| Architect | [`agents/architect.md`](agents/architect.md) | Produces implementation plans and ADRs; never writes application code |
| Designer | [`agents/designer.md`](agents/designer.md) | Produces UI/UX specs, wireframes, and component definitions |

### ⚙️ Execution

| Agent | File | Role |
|-------|------|------|
| Code Writer | [`agents/code-writer.md`](agents/code-writer.md) | Implements approved plans; surgical changes only |
| Test Runner | [`agents/test-runner.md`](agents/test-runner.md) | Runs tests and verifies acceptance criteria |

### 🛡️ Security / Setup

| Agent | File | Role |
|-------|------|------|
| Stack Setup | [`agents/stack-setup.md`](agents/stack-setup.md) | Identifies unknown stacks, web-searches setup procedures, mandatory security review, requires explicit user approval before executing any commands |

*(Add domain-specific agents as needed -see the extension guidance below.)*

---

## PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

### Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 5 QA

### Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

### PM Direct Execution Scope

PM is an escalation gateway, not an executor. The following whitelist defines what PM may execute directly.

| Category | Tools | Scope |
|----------|-------|-------|
| Unconditional | Read, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Skill, ToolSearch | Always allowed |
| Conditional | Write, Edit | `memory/*.md` and `CHANGELOG.md` only |
| Conditional | Bash | Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat` |
| Forbidden | Write, Edit (other paths), Bash (write/execute) | Must delegate to specialist |

When a specialist agent's required tool is denied, PM applies the [Permission Denial Protocol](agents/pm.md#permission-denial-protocol) — never substitutes for the specialist.

### Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **stack-setup** | 0-1 | "Unknown stack detected", "Setup procedure needed", "Environment configuration" |
| **designer** | 3 | "UI/UX specs needed", "Wireframes required", "Component definitions" |
| **code-writer** | 4 | "Implementing features", "Writing source code", "Applying approved plan" |
| **test-runner** | 4 | "Running tests", "Verifying acceptance criteria", "Test suite execution" |
| **security-monitor** | 0,5 | "Security policy check", "Secret scan", "Dependency audit" |

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

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
- **Medium-tier (Review/QA)**: Used by Test Runner or Security agents to review code, run tests, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Code Writer agents for fast typing, simple repetitive coding, or strictly scoped tasks.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The PM agent delegates execution to the Low-tier and delegates review to the Medium-tier before finalizing.

### Dispatch Rules

1. **Single message, multiple `Agent()` calls** -all parallel agents must be dispatched in one turn.
2. **Merge before proceeding** -PM waits for ALL parallel agents to return before the next serial step.
3. **Phase 4 execution loop** -each implementation task goes through:
   - **code-writer** implements the changes
   - **test-runner** verifies against acceptance criteria and runs tests
   - **Quality gate (audit script)** validates compliance
   - Loop and correct if issues found -maximum **3 iterations** before escalating to the user.
4. **Error handling** -if any parallel agent fails, PM resolves the failure before proceeding. Do not skip.
5. **Max fix iterations** -3 per review cycle before escalating to the user.

### Subagent Roster

| Agent | File | Parallelizable | Write Allowed? |
|-------|------|:--------------:|:--------------:|
| Security Monitor | `agents/security-monitor.md`| -Triage phase | -No |
| Architect | `agents/architect.md` | -Design phase | -No |
| Designer | `agents/designer.md` | -Design phase | -No |
| Code Writer | `agents/code-writer.md` | -Serial | -Source files |
| Test Runner | `agents/test-runner.md` | -After writes | -Test files only |
| Stack Setup | `agents/stack-setup.md` | -Research phase | -setup.sh/ps1 only (after approval) |

*(Extend this table as you add Analysis or specialized agents to the project.)*

---

## Harness Engineering Workflow

```
Phase 0 - Team Assembly & Skill Orchestration (Kickoff)
  PM assesses project requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and docs/context.md

Phase 1 - Triage & Analysis
  PM classifies the request
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria

Phase 2 - Design
  Architect produces implementation plan + ADR
  Designer produces UI/UX spec (if task has UI surface) ??parallel with Architect
  PM obtains explicit user approval → GATE

Phase 3 - Implementation (serial)
  Code Writer implements per approved plan
  Test Runner verifies after each change

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
| Design the implementation approach and data model | `architect` | `code-writer` |
| Design UI/UX components or screens | `designer` | `architect` |
| Security assessment, credentials scanning | `security-monitor` | `architect` |
| Write or modify source files | `code-writer` | `architect` |
| Run tests and verify acceptance criteria | `test-runner` | `code-writer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |

*(Extend this table with project-specific agents and their boundaries.)*

---

## Skills

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Agent Lifecycle Manager** | `skills/agent-lifecycle-manager/SKILL.md` | PM agent managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| **Skill Lifecycle Manager** | `skills/skill-lifecycle-manager/SKILL.md` | PM agent managing skill lifecycle after agent configuration changes; checking skill health, orphaned/deprecated skills |
| **Meeting Facilitation** | `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making and problem resolution |
| **Code Review** | `.claude/skills/code-review/SKILL.md` | Conducting thorough code reviews focusing on correctness, maintainability, security, and best practices |
| **Test-Driven Development** | `.claude/skills/test-driven-development/SKILL.md` | Implementing software using TDD methodology with red-green-refactor cycle |
| **Refactoring** | `.claude/skills/refactoring/SKILL.md` | Improving code structure and design while preserving behavior using systematic refactoring techniques |
| project-review | `.claude/skills/project-review/` | pm | Comprehensive parallel review of the current project by all available agents. Produces a prioritized improvement plan. Triggered by user request, PM structural change detection (T-02), or QA escalation (T-03). |

*(When a skill is created, add a row here and in `docs/context.md § Skills`.)*

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:
- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Coding Standards**: Follow SOLID principles. Write unit tests when creating functional code. No speculative abstractions.
- **Language**: All code, config, commit messages, and branch names -**English only**.
- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.

---

## Extending the Agent Roster

Add domain-specific agents when the project requires specialized expertise beyond the base 5 roles. Common patterns:

| Domain | Typical Additions |
|--------|-------------------|
| **Financial / BI** | `cpa-auditor`, `finance-strategy-lead`, `cost-asset-mgmt` |
| **SAP / ERP** | `sd-analyst`, `mm-analyst`, `fi-analyst`, `co-analyst`, `pp-analyst` |
| **i18n-heavy** | `l10n-auditor`, `i18n` |
| **Security-critical** | `security-auditor`, `security` |
| **Data / ML** | `data-engineer`, `ml-engineer` |

**Steps to add a new agent:**
1. Create `agents/<name>.md` with the agent's role, constraints, and write-access rules.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (Parallelizable / Write Allowed).
4. Update `docs/context.md § Agents` to match.
5. If the agent uses a skill, add it to the Skills table here and in `docs/context.md § Session Start Skills`.

> Reference: [`abap_vibe_coding/AGENTS.md`](https://github.com/5throck/abap_vibe_coding/blob/main/AGENTS.md) (ERP domain example) and [`Pricing-Mgmt-Simulation/AGENTS.md`](https://github.com/5throck/Pricing-Mgmt-Simulation/blob/main/AGENTS.md) (financial BI example).

---

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Add a row to the Agent Roster table above.
2. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
3. Update the `## Agents` table in `docs/context.md` to match.
4. If the agent uses a skill, add a row to the Skills table above and in `docs/context.md § Skills`.
<!-- COMMON-AGENTS:START -->
## Language Policy

**English-Only Documentation Rule**: All workspace documentation files (.md) must be written in English, with explicit exceptions for recognized locale translation zones (see Translation Zones below).

### English Documentation Requirement
- All `.md` files outside `ko/` and `locales/ko/` directories MUST be in English
- Applies to: README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md, all documentation in docs/, agents/, skills/
- Rationale: English documentation ensures global accessibility and cross-team collaboration

### Translation Zones (Locale Exceptions)
- `<lang-code>/` directories — language-specific documentation (e.g. `ko/`, `ja/`)
- `locales/<lang-code>/` — locale translation files for internationalization (e.g. `locales/ko/`, `locales/zh-CN/`)
- These are the ONLY locations where non-English `.md` files are permitted
- Recognized locale codes (from `docs/workspace-schema.json` `i18n.locale_codes`):
  `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar`

### Enforcement
- Pre-commit audit checks for Korean content outside ko/ and locales/ko/
- PR reviews reject non-English documentation outside translation zones
- Auditor validates compliance during Phase 6 QA gate

### Git/PR Artifacts Language Rule
- All commit messages: English
- All PR titles: English
- All PR descriptions: English
- All branch names: English
- Code comments: English (unless documenting locale-specific logic)
<!-- COMMON-AGENTS:END -->
