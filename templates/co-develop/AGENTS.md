# AGENTS.md

**Workspace Root Agent Ecosystem**

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

This document is the **Single Source of Truth (SSOT)** for the agent ecosystem, individual agent definitions, PM Gateway workflow, and execution plan templates.

---

## §1: Agent Ecosystem Overview

### 🎯 Agent Roster (Roles Overview)

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 6). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** |

<!-- VARIANT-AGENTS-START -->
| **architect** | [`agents/architect.md`](agents/architect.md) | High | Design agent - produces implementation plans and technical specs. Use when: planning a new feature, evaluating architect |
| **code-writer** | [`agents/code-writer.md`](agents/code-writer.md) | Low | Implementation agent - writes code from an approved plan. Use when: an architect plan has been approved and it is time t |
| **designer** | [`agents/designer.md`](agents/designer.md) | Medium | UI/UX design agent - produces wireframes, component specs, and design tokens. Use when: designing new screens or flows,  |
| **security-monitor** | [`agents/security-monitor.md`](agents/security-monitor.md) | Medium | Security monitor - scans for vulnerabilities, advisories, and secret leaks. Use for: daily security scans, pre-PR adviso |
| **stack-setup** | [`agents/stack-setup.md`](agents/stack-setup.md) | Low | Stack Setup Specialist. Use when: "Unrecognized tech stack", "Environment setup needed", "Project initialization" |
| **test-runner** | [`agents/test-runner.md`](agents/test-runner.md) | Medium | QA and verification agent - runs tests and validates acceptance criteria. Use when: code has been written and needs to b |
<!-- VARIANT-AGENTS-END -->
---

## §2: Individual Agent Definitions

See [`agents/pm.md`](agents/pm.md) for the PM Agent full definition.

<!-- VARIANT-AGENT-DETAILS-START -->
### architect

| Field | Value |
|-------|-------|
| **File** | [`agents/architect.md`](agents/architect.md) |
| **Tier** | high |
| **Phases** | 1, 2 |
| **Role** | Design agent - produces implementation plans and technical specs. Use when: planning a new feature, evaluating architectural trade-offs, or generating an ADR before implementation starts. |

### code-writer

| Field | Value |
|-------|-------|
| **File** | [`agents/code-writer.md`](agents/code-writer.md) |
| **Tier** | low |
| **Phases** | 4 |
| **Role** | Implementation agent - writes code from an approved plan. Use when: an architect plan has been approved and it is time to write, modify, or delete source files. |

### designer

| Field | Value |
|-------|-------|
| **File** | [`agents/designer.md`](agents/designer.md) |
| **Tier** | medium |
| **Phases** | 3 |
| **Role** | UI/UX design agent - produces wireframes, component specs, and design tokens. Use when: designing new screens or flows, defining visual language, specifying component behaviour before implementation, or reviewing design consistency. |

### security-monitor

| Field | Value |
|-------|-------|
| **File** | [`agents/security-monitor.md`](agents/security-monitor.md) |
| **Tier** | medium |
| **Phases** | 0, 5 |
| **Role** | Security monitor - scans for vulnerabilities, advisories, and secret leaks. Use for: daily security scans, pre-PR advisory checks, post-scaffold baseline scans. |

### stack-setup

| Field | Value |
|-------|-------|
| **File** | [`agents/stack-setup.md`](agents/stack-setup.md) |
| **Tier** | low |
| **Phases** | 0, 1 |
| **Role** | Stack Setup Specialist. Use when: "Unrecognized tech stack", "Environment setup needed", "Project initialization" |

### test-runner

| Field | Value |
|-------|-------|
| **File** | [`agents/test-runner.md`](agents/test-runner.md) |
| **Tier** | medium |
| **Phases** | 4 |
| **Role** | QA and verification agent - runs tests and validates acceptance criteria. Use when: code has been written and needs to be verified, or when the QA gate needs to be run before a PR. |
<!-- VARIANT-AGENT-DETAILS-END -->
---

## §3: PM Gateway Workflow

**Integrated from pm.md, CLAUDE.md §5, GEMINI.md §5**

### §3.1 PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

#### §3.1.1 PM Direct Execution Scope

PM is an escalation gateway, not an executor. **⚠️ CRITICAL**: PM MUST NOT perform Write/Edit on any file except `memory/*.md` and `CHANGELOG.md`. All file modifications MUST be dispatched to project specialists. See [PM Direct Execution Constraints](agents/pm.md#⚠️-critical-pm-direct-execution-constraints) in `agents/pm.md`.

| Category | Tools | Scope |
|----------|-------|-------|
| Unconditional | Read, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Skill, ToolSearch | Always allowed |
| Conditional | Write, Edit | `memory/*.md` and `CHANGELOG.md` only |
| Conditional | Bash | Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat` |
| Forbidden | Write, Edit (all other paths) | Must delegate to project specialist |
| Forbidden | Bash (write/execute patterns) | Must delegate to specialist |

**Rationale**: PM is orchestrator, not executor. Direct execution violates governance separation of concerns. See [Role Clarification](agents/pm.md#⚠️-role-clarification) and [Task Tracking vs Execution](agents/pm.md#task-tracking-vs-execution) in `agents/pm.md`.

When a specialist agent's required tool is denied, PM applies the [Permission Denial Protocol](#§3.8-permission-denial-protocol) — never substitutes for the specialist.

#### §3.1.2 PM Role Boundaries

**What PM Does**:
- Orchestrate multi-agent workflows
- Create execution plans
- Dispatch specialist agents
- Enforce quality gates
- Track progress

**What PM Does NOT Do**:
- Directly Edit/Write files (except `memory/*.md`, `CHANGELOG.md`)
- Implement code or scripts
- Perform documentation updates (delegate to `[docs specialist]`)
- Perform design work (delegate to `[design specialist]`)

**Task Owner vs Executor Distinction**:
- **Task owner (PM)**: "Buck stops here" responsible person for tracking progress
- **Task executor (specialist)**: Agent who performs the actual work
- PM creates tasks (owner: pm), dispatches project specialists (executor: `[specialist agent]`), and updates task status upon completion

**User Communication for Specialist Tasks**:
When work requires specialist delegation, PM uses the following template:
```
PM: 🔍 [Task Analysis] 이 작업은 [specialist] 전문 영역입니다.
   Task: [description]
   Specialist: [specialist name]
   Reason: [why specialist needed]
PM: [specialist]를 dispatch할까요?
User: "Yes"
PM: ▶️ [specialist] dispatch...
```

See [agents/pm.md](agents/pm.md) for complete role definition and delegation protocols.

#### §3.1.3 Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 6 QA

#### §3.1.4 Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

#### §3.1.5 Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

<!-- VARIANT-DISPATCH-TRIGGERS-START -->
| `architect` | Phase 1, Phase 2 | "architect task needed", "architect work required" |
| `code-writer` | Phase 4 | "code-writer task needed", "code-writer work required" |
| `designer` | Phase 3 | "designer task needed", "designer work required" |
| `security-monitor` | Phase 0, Phase 5 | "security-monitor task needed", "security-monitor work required" |
| `stack-setup` | Phase 0, Phase 1 | "stack-setup task needed", "stack-setup work required" |
| `test-runner` | Phase 4 | "test-runner task needed", "test-runner work required" |
<!-- VARIANT-DISPATCH-TRIGGERS-END -->
**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

> **Execution Plan Format**: For mandatory criteria, boilerplate table, and rules, see [AGENTS.md §5](AGENTS.md#§5-execution-plan-templates). For platform-specific dispatch instructions, see [CLAUDE.md §5](CLAUDE.md#5-agent-dispatch-rules) or [GEMINI.md §5](GEMINI.md#5-agent-dispatch-rules).

### §3.5 Phase Determination (Deliverable-Type Gate)

Before assigning an agent to any task, PM MUST classify the deliverable type:

| Deliverable Type | Phase | Required Agent | Tier | Notes |
|------------------|-------|----------------|------|-------|
| New file design, schema definition, ADR | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| New directory structure, template layout | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| Cross-platform convention, naming standard | Phase 1-2 | `[design specialist]` | High | Must precede implementation |
| Script/tool implementation (approved plan exists) | Phase 4 | `[implementation specialist]` | Low–Medium | Plan from design specialist required |
| Documentation update | Phase 4 | `[docs specialist]` | Medium | |
| Documentation writing | Phase 4 | `[docs specialist]` | Medium | |
| Security configuration | Phase 6 | `[security specialist]` | Medium | |
| Project setup | Phase 0 | pm | Low | PM handles initial setup directly |

<!-- VARIANT-PHASE-GATE-START -->
<!-- REQUIRES DOMAIN DESIGN: fill when co-develop is promoted to active.
     Each row maps a deliverable type to its required specialist agent and phase.
     Reference agent definitions in agents/<name>.md for role descriptions. -->
| <!-- deliverable type: architect --> | Phase TBD | `architect` | high | TBD |
| <!-- deliverable type: code-writer --> | Phase TBD | `code-writer` | low | TBD |
| <!-- deliverable type: designer --> | Phase TBD | `designer` | medium | TBD |
| <!-- deliverable type: security-monitor --> | Phase TBD | `security-monitor` | medium | TBD |
| <!-- deliverable type: stack-setup --> | Phase TBD | `stack-setup` | low | TBD |
| <!-- deliverable type: test-runner --> | Phase TBD | `test-runner` | medium | TBD |
<!-- VARIANT-PHASE-GATE-END -->

**Tier Ceiling Rule**: An agent's tier may NOT be elevated beyond its defined tier.

> **Execution Plan Boilerplate Policy**: For mandatory and discretionary boilerplate cases, see [§3 (PM Gateway Workflow)](AGENTS.md#§3-pm-gateway-workflow) above.


### §3.6 3-Tier Strategy

When leading execution and improvement tasks, PM MUST use the 3-Tier model strategy:

- **High-tier**: Complex reasoning, architectural design, planning (claude-opus-4-7 / gemini-3.1-pro)
- **Medium-tier**: Code review, testing, PR review, quality gates (claude-sonnet-4.6 / gemini-3.5-flash)
- **Low-tier**: Fast, repetitive coding, script maintenance (claude-haiku-4-5 / gemini-3.5-flash)

### §3.7 Meeting Facilitation

When `/meeting` is invoked, the PM orchestrates structured multi-agent discussions.

**Meeting Process**:
1. **Open meeting**: Set agenda and objectives
2. **Facilitate dialogue**: Ensure all specialists contribute
3. **Synthesize outcomes**: Cross-domain agent synthesizes agreements
4. **Document results**: Write transcript to `memory/meeting-YYYY-MM-DD-[slug].md`

### §3.8 Permission Denial Protocol

When a specialist agent's required tool is denied, PM must **not** substitute for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

---

<!-- COMMON-AGENTS:START -->
## Language Policy

**English-Only Documentation Rule**: All workspace documentation files (.md) must be written in English, with explicit exceptions for recognized locale translation zones and declared Korean legal/regulatory content (see Exceptions below).

### English Documentation Requirement
- All `.md` files outside `ko/` and `locales/ko/` directories MUST be in English
- Applies to: README.md, CLAUDE.md, GEMINI.md, AGENTS.md, context.md, CHANGELOG.md, all documentation in docs/, agents/, skills/
- Rationale: English documentation ensures global accessibility and cross-team collaboration

### Translation Zones (Locale Exceptions)
- `<lang-code>/` directories — language-specific documentation (e.g. `ko/`, `ja/`)
- `locales/<lang-code>/` — locale translation files for internationalization (e.g. `locales/ko/`, `locales/zh-CN/`)
- These are the ONLY locations where non-English `.md` files are permitted (except declared exceptions)
- Recognized locale codes (from `docs/workspace-schema.json` `i18n.locale_codes`):
  `ko`, `ja`, `zh-CN`, `zh-TW`, `de`, `es`, `fr`, `pt`, `vi`, `ms`, `id`, `th`, `ru`, `it`, `ar`

### Language Policy Exception — Korean Legal/Regulatory Content
The English-only policy admits a narrow exception for files where Korean is legally or academically mandatory. To declare an exception, add to the file's frontmatter:
```yaml
lang: ko
lang_reason: legal   # legal | source-material | proper-noun
```
- `legal`: Statutory texts, ordinances, regulations, contracts where Korean original has legal force.
- `source-material`: Primary source quotations where English translation would compromise academic accuracy or meaning.
- `proper-noun`: Files dominated by Korean proper nouns (institution/place/person names).

*Note: Exception is NOT available for: agents/*.md, skills/*.md, context.md, CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md file.*

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

---

## §4: Other Workflows

### 4.1 PM Subagent Dispatch Protocol

The PM agent follows a three-level inheritance model: **L0 (workspace root)** → **L1 (common template)** → **L2 (variant templates)**.

> **For PM Agent Architecture**: See [docs/context.md](docs/context.md) for complete governance workflow, L0→L1→L2 extends chain resolution, and variant-specific configuration.

#### Dispatch Decision

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

#### Cost Optimization (3-Tier Strategy)

The PM uses a 3-tier model strategy to optimize cost and quality:

- **High-tier (Design/Plan)**: Used exclusively by the PM/Architect for complex reasoning, architectural design, and writing precise sub-agent prompts.
- **Medium-tier (Review/QA)**: Used by Auditor or Security agents to review code, run tests, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Automation Engineer agents for fast typing, simple repetitive coding, or strictly scoped tasks.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The PM agent delegates execution to the Low-tier and delegates review to the Medium-tier before finalizing.

#### Dispatch Rules

1. **Autonomous Agent Handoffs** - Agents can dispatch each other directly via JSON contracts without PM intervention for routine workflows
2. **PM Orchestration Phases** - PM only orchestrates Phases 0 (Team Assembly), 2 (Design Validation), and 5 (Lifecycle Finalization)
3. **QA Gate** - PM executes qa scripts at Phase 6 (bun scripts/qa-gate.ts)
4. **Parallel Agent Dispatch** - all parallel agents must be dispatched in one turn for research/analysis phases
5. **Error handling** - if any parallel agent fails, responsible agent resolves failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to PM for intervention

#### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | High | - | orchestrates only |

<!-- VARIANT-SUBAGENT-ROSTER-START -->
| architect | `agents/architect.md` | High | ⚠️ sequential preferred | orchestrates only |
| code-writer | `agents/code-writer.md` | Low | ✅ | project files |
| designer | `agents/designer.md` | Medium | ⚠️ sequential preferred | project files |
| security-monitor | `agents/security-monitor.md` | Medium | ⚠️ sequential preferred | project files |
| stack-setup | `agents/stack-setup.md` | Low | ✅ | project files |
| test-runner | `agents/test-runner.md` | Medium | ⚠️ sequential preferred | project files |
<!-- VARIANT-SUBAGENT-ROSTER-END -->

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [docs/context.md](docs/context.md).

---

### 4.2 Harness Engineering Workflow

Following the **PM governance workflow** defined in [docs/context.md](docs/context.md):

```
Phase 0 - Project Initiation (PM-owned)
  PM assesses workspace requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1-2 - Planning & Architecture (specialist-autonomous)
  PM classifies the request; Architect produces implementation plan + ADR
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria
  PM validates design approach and obtains explicit user approval → GATE

Phase 3 - Design Handoff (variant-specific)
  Architect hands off approved plan to execution agents
  Agents can dispatch each other directly for routine handoffs

Phase 4 - Execution (specialist-autonomous)
  `[implementation specialist]` implements per approved plan
  `[docs specialist]` updates docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 5 - Lifecycle Finalization (PM-owned)
  PM updates governance records for any changed artifacts
  PM logs decisions to memory/YYYY-MM-DD.md

Phase 6 - Quality Assurance & Finalization (PM-owned)
  PM executes bun scripts/qa-gate.ts
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE
  PM runs /sync "type: description" → PR opened
```

---

### 4.3 Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Orchestrate multi-step task across agents | `pm` | any execution agent |

<!-- VARIANT-ROLE-BOUNDARY-START -->
<!-- REQUIRES DOMAIN DESIGN: fill when co-develop is promoted to active.
     Each row defines which agent owns a scenario, to resolve dispatch ambiguity. -->
| <!-- scenario: architect --> | `architect` | `pm` |
| <!-- scenario: code-writer --> | `code-writer` | `pm` |
| <!-- scenario: designer --> | `designer` | `pm` |
| <!-- scenario: security-monitor --> | `security-monitor` | `pm` |
| <!-- scenario: stack-setup --> | `stack-setup` | `pm` |
| <!-- scenario: test-runner --> | `test-runner` | `pm` |
<!-- VARIANT-ROLE-BOUNDARY-END -->

---

## §5: Execution Plan Templates

### 5.1 Standard Execution Plan Template

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task description] | [specialist] | High/Medium/Low | [model] |
| N-1 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | pm | Medium | [model] |
| N | Final QA Audit (bun scripts/audit.ts) | pm | Medium | [model] |

**Execution Order**: [Parallel | Sequential]

**Key points**:
- Tier column is MANDATORY (High/Medium/Low)
- Always include Lifecycle Update (N-1) and Final QA Audit (N) as final two steps
- State parallel vs sequential order below the table
- "pm (direct)" is FORBIDDEN - PM never executes directly

### 5.2 Platform Parity Considerations

When modifying files that affect both CLAUDE.md and GEMINI.md:

| # | Task | Agent | Tier | Model | Platform |
|---|------|-------|------|---------|----------|
| 1 | [task] | [specialist] | [tier] | [model] | Both |
| N-1 | Lifecycle Update | pm | Medium | [model] | Both |
| N | Final QA | pm | Medium | [model] | Both |

**Platform Column**: `Claude` / `Antigravity` / `Both` / `L0-only`

**Note**: See execution plan boilerplate in CLAUDE.md §5, GEMINI.md §5, and agents/pm.md for the Platform column definition.

### 5.3 Example Execution Plans

#### Example 1: Multi-Agent Platform Parity Update

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update agents/pm.md | `[docs specialist]` | Medium | claude-sonnet-4-6 |
| 2 | Update scripts/audit.ts | `[implementation specialist]` | Low | claude-haiku-4-5 |
| 3 | Update CLAUDE.md §5 | `[docs specialist]` | Medium | claude-sonnet-4-6 |
| 4 | Update GEMINI.md §5 | `[docs specialist]` | Medium | claude-sonnet-4-6 |
| 5 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | pm | Medium | claude-sonnet-4-6 |
| 6 | Final QA Audit (bun scripts/audit.ts) | pm | Medium | claude-sonnet-4-6 |

**Execution Order**: Sequential (platform parity requires CLAUDE.md and GEMINI.md updates together)

#### Example 2: Single Specialist Task

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update project README introduction | `[docs specialist]` | Medium | claude-sonnet-4-6 |
| 2 | Lifecycle Update (if needed) | pm | Medium | claude-sonnet-4-6 |
| 3 | Final QA Audit | pm | Medium | claude-sonnet-4-6 |

**Execution Order**: Sequential

---

## §6: Skills

### Platform Skills (Priority 2)

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Agent Lifecycle Manager** | `.claude/skills/agent-lifecycle-manager/SKILL.md` | Managing agent lifecycle, creating/retiring agents, validation |

> **📌 VERSION_MANIFEST is the Single Source of Truth (SSOT)**
>
> All skill versions, status, and lifecycle metadata are maintained in [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md).
> The table below provides skill names and locations only. For current versions, status, and detailed metadata, always reference VERSION_MANIFEST.
>
> **Skill structure specification**: See [docs/context.md](docs/context.md) for frontmatter format and session skill registration.

> **`owner` field definition**: The `owner` field in `SKILL.md` frontmatter identifies the **maintainer responsibility** for that skill — the agent or role accountable for keeping the skill current. It does NOT require that agent to exist in the current project, and does NOT mean that agent is the only one who can invoke the skill.

### Skill Resolution Priority

When a user request matches a skill trigger, apply this priority order — **enforced every session, regardless of platform**:

| Priority | Source | Location | Purpose |
|----------|--------|----------|---------|
| **1 (highest)** | Workspace-level skills | `skills/<name>/SKILL.md` in the workspace root | Core workspace functionality (scaffolding, validation, security, audit) |
| **2** | Platform config skills | `.claude/skills/` or `.gemini/skills/` in the project root | Platform-specific hooks, commands, and lifecycle management |
| **3 (lowest)** | Global plugin skills | e.g., `superpowers/brainstorming`, `superpowers/writing-plans` | General-purpose development workflows |

**Location Rules**:
- **Single location requirement**: Workspace-level skills should exist **only** in `skills/` folder (priority 1). Do not duplicate these in `.claude/skills/` or `.gemini/skills/`.
- **Platform-specific skills**: `.claude/skills/` and `.gemini/skills/` are reserved for platform-specific hooks, commands, and lifecycle management tools that differ between Claude Code and Gemini CLI.
- **No cross-duplication**: Avoid duplicating the same skill across multiple locations. Choose the single most appropriate location based on the skill's purpose.

**Resolution Rule**: If a higher-priority skill's `metadata.triggers` matches the user request, use it — do **not** fall through to lower-priority skills with overlapping intent.

**Canonical conflict example — meeting vs. brainstorming**:

| User says | Correct skill | Priority |
|-----------|--------------|----------|
| "meeting", "facilitate", "agent discussion" | `skills/meeting-facilitation` | 1 |
| "brainstorm", "design before coding", "explore options" | `superpowers/brainstorming` | 3 |

When ambiguous, prefer the higher-priority (workspace-level) skill and confirm intent with the user.
Explicit invocation: `/meeting "topic" [--agents a,b] [--rounds N] [--dialogue]`

---


## §7: Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Coding Standards**: Follow SOLID principles. Write unit tests when creating functional code. No speculative abstractions.
- **Language**: All code, config, commit messages, and branch names - **English only**.
- **UTF-8 Enforcement**: Always use UTF-8 encoding; prevent CP949 or other localized encoding corruptions.
- **File Organization**: Never create `.md` files at the project root unless explicitly creating a standard root file (README.md, CHANGELOG.md, AGENTS.md, SECURITY.md). Place analysis and reports in `docs/`, session logs and meeting transcripts in `memory/`. Create all temporary code and scratch scripts in `tests/`.
- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.
- **Source Attribution**: When presenting research findings, external data, or factual claims, always cite the source using `[Source: URL/document]` inline or a `## References` section. If a source cannot be verified, explicitly mark it as `⚠️ Unverified` and recommend manual verification. Never present unverified information as established fact.
- **Computational Integrity**: Never perform high-precision or safety-critical numerical calculations directly. For aerospace, aviation, precision control, or regulated financial computations, delegate to a validated external tool (Fortran, Python+NumPy/SciPy, Julia, etc.) via the `stack-setup` agent. Label any AI-generated numerical estimate explicitly as **approximate**.

---

## §8: Lifecycle Management

### Phase 5 Lifecycle Finalization

At **Phase 5 (Lifecycle Finalization)**, PM **must** execute finalization when any of the following occurred in the session:

| Trigger | Dispatch lifecycle-manager? |
|---------|---------------------------|
| Agent added, modified, or deprecated | ✅ Yes |
| Skill added, modified, or deprecated | ✅ Yes |
| Script status changed in SCRIPTS.md | ✅ Yes |
| Variant status changed (draft→beta, beta→stable, etc.) | ✅ Yes |
| Governance tool updated (audit.ts, validate-templates.ts, etc.) | ✅ Yes |
| `.claude/commands/*.md` or `.gemini/commands/*.md` added or removed | ✅ Yes |
| `.claude/skills/*/SKILL.md` or `.gemini/skills/*/SKILL.md` added or modified | ✅ Yes |
| `templates/common/.claude/` or `templates/common/.gemini/` structure changed | ✅ Yes |
| `common-contract.json` or `docs/templates/*.json` governance files modified | ✅ Yes |
| README/documentation-only changes | ❌ No |
| Memory log entries only | ❌ No |

PM will produce either a **"no drift" confirmation** or a **drift report + governance document updates**.

PM does NOT execute finalization updates for: pure documentation changes (body text only), README updates, memory log entries, or changes that do not affect lifecycle-tracked artifacts.

> **For Agent Lifecycle procedures**: See [docs/context.md](docs/context.md) for detailed lifecycle procedures.

---


## §9: Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in [docs/context.md](docs/context.md).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in [docs/context.md](docs/context.md).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [docs/context.md](docs/context.md).

---

## §10: Periodic Skill Review Schedule

**Frequency**: Quarterly (every 3 months)  
**Owner**: pm  
**Tool**: `bun scripts/skill-dependency-analysis.ts --report`

### Review Cadence

| Quarter | Target Month | Scope |
|---------|-------------|-------|
| Q1 | March | All active skills — full health report |
| Q2 | June | All active skills — full health report |
| Q3 | September | All active skills — full health report |
| Q4 | December | All active skills — full health report + deprecation sweep |

### Review Steps

1. **Generate health report**
   ```
   bun scripts/skill-dependency-analysis.ts --report
   bun scripts/validate-skills.ts
   ```

2. **Triage findings** by severity:
   - 🔴 Broken dependencies or circular references → fix before quarter ends
   - 🟡 Deprecated dependency usage → fix within 2 weeks
   - 🟢 Wording or example improvements → batch in next release cycle

3. **Apply modifications** using the checklist at [docs/lifecycle/skills/skill-modification-checklist.md](docs/lifecycle/skills/skill-modification-checklist.md)

4. **Update governance records** in `docs/lifecycle/skills/<name>.md` for every skill modified

5. **Deprecation sweep** (Q4 only): review skills with `last_updated` older than 12 months — evaluate whether they remain relevant or should be deprecated

6. **Log results** in the quarterly memory log: `memory/YYYY-MM-DD.md` with `## Skill Review Q[N] YYYY` heading

### Trigger Conditions (Outside Quarterly Cadence)

A skill health check should also be run outside the quarterly schedule when:
- A tool, agent, or script referenced by any skill is renamed or removed
- A new skill is added that may introduce dependency cycles
- CI reports skill validation failures on any branch

---

## Version History

- **v2.0.0 (2026-06-09)**: Restructured as SSOT - Integrated PM Gateway workflow (§3), execution plan templates (§5), and renumbered existing sections. Consolidated duplicate content from pm.md, CLAUDE.md §5, GEMINI.md §5 into single source of truth.
- **v1.x**: Previous versions maintained agent roster and individual definitions without PM Gateway integration
