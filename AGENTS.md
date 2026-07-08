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

#### 🛠️ Orchestration & Audit

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) (L0) → [`templates/common/agents/pm.md`](templates/common/agents/pm.md) (L1) → [`templates/<variant>/agents/pm.md`](templates/co-design/agents/pm.md) (L2) | High | Three-level inheritance architecture: L0 (workspace root base) → L1 (common template pure-extends) → L2 (variant YAML overrides). Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 6). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** See [L0→L1→L2 PM Agent Architecture](#l0→l1→l2-pm-agent-architecture) for details. |
| Consistency Auditor | [`agents/auditor.md`](agents/auditor.md) | Medium | Workspace-root-only cross-domain consistency auditor; detects structural inconsistencies scripts miss; NOT dispatched in variant projects |
| **Lifecycle Manager** | [`agents/lifecycle-manager.md`](agents/lifecycle-manager.md) | Medium | **Workspace root only — L0-only agent**. Lifecycle state monitor and governance record keeper for the workspace root (8 domains × 3 layers); core duties include L0->L1 template publishing and L1->L2 explicitly requested skill/script synchronization; syncs governance docs after changes. Lifecycle finalization is handled automatically by `/sync` — PM does NOT need a separate N-1 dispatch step. **NOT available in variant templates** — this agent operates exclusively at workspace root level. |

### 📐 Design

| Agent | File | Tier | Role |
|-------|------|------|------|
| Template Architect | [`agents/architect.md`](agents/architect.md) | High | Overall project structure design expert; defines folder hierarchies and architectural standards; produces implementation plans and ADRs |

### ⚙️ Execution

| Agent | File | Tier | Role |
|-------|------|------|------|
| Automation Engineer | [`agents/automation-engineer.md`](agents/automation-engineer.md) | Low | Scripting and tools expert; maintains TypeScript (.ts) automation scripts per ADR-0036; ensures idempotency and robustness |
| Documentation Writer | [`agents/docs-writer.md`](agents/docs-writer.md) | **Medium** | Executes documentation changes per Architect decisions; writing, editing, terminology consistency; Architect owns document architecture design |
| Scaffolding Expert | [`agents/scaffolding-expert.md`](agents/scaffolding-expert.md) | Low | New Project & Template Specialist; validates new-project logic; ensures template folder synchrony; prevents OS-level encoding corruption |

### 🛡️ Security

| Agent | File | Tier | Role |
|-------|------|------|------|
| Security & Git Expert | [`agents/security-expert.md`](agents/security-expert.md) | Medium | Enforces Git Hooks; manages .gitleaks configurations; handles credential management; ensures secure dependency handling |

---

## §2: Individual Agent Definitions

### 🛠️ Orchestration & Audit Agents

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) (L0) → [`templates/common/agents/pm.md`](templates/common/agents/pm.md) (L1) → [`templates/<variant>/agents/pm.md`](templates/co-design/agents/pm.md) (L2) | High | Three-level inheritance architecture: L0 (workspace root base) → L1 (common template pure-extends) → L2 (variant YAML overrides). Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 6). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** See [L0→L1→L2 PM Agent Architecture](#l0→l1→l2-pm-agent-architecture) for details. |
| Consistency Auditor | [`agents/auditor.md`](agents/auditor.md) | Medium | Workspace-root-only cross-domain consistency auditor; detects structural inconsistencies scripts miss; NOT dispatched in variant projects |
| **Lifecycle Manager** | [`agents/lifecycle-manager.md`](agents/lifecycle-manager.md) | Medium | **Workspace root only — L0-only agent**. Lifecycle state monitor and governance record keeper for the workspace root (8 domains × 3 layers); core duties include L0->L1 template publishing and L1->L2 explicitly requested skill/script synchronization; syncs governance docs after changes. Lifecycle finalization is handled automatically by `/sync` — PM does NOT need a separate N-1 dispatch step. **NOT available in variant templates** — this agent operates exclusively at workspace root level. |

### 📐 Design Agents

| Agent | File | Tier | Role |
|-------|------|------|------|
| Template Architect | [`agents/architect.md`](agents/architect.md) | High | Overall project structure design expert; defines folder hierarchies and architectural standards; produces implementation plans and ADRs |

### ⚙️ Execution Agents

| Agent | File | Tier | Role |
|-------|------|------|------|
| Automation Engineer | [`agents/automation-engineer.md`](agents/automation-engineer.md) | Low | Scripting and tools expert; maintains TypeScript (.ts) automation scripts per ADR-0036; ensures idempotency and robustness |
| Documentation Writer | [`agents/docs-writer.md`](agents/docs-writer.md) | **Medium** | Executes documentation changes per Architect decisions; writing, editing, terminology consistency; Architect owns document architecture design |
| Scaffolding Expert | [`agents/scaffolding-expert.md`](agents/scaffolding-expert.md) | Low | New Project & Template Specialist; validates new-project logic; ensures template folder synchrony; prevents OS-level encoding corruption |

### 🛡️ Security Agents

| Agent | File | Tier | Role |
|-------|------|------|------|
| Security & Git Expert | [`agents/security-expert.md`](agents/security-expert.md) | Medium | Enforces Git Hooks; manages .gitleaks configurations; handles credential management; ensures secure dependency handling |

---

## §3: PM Gateway Workflow

**Integrated from pm.md, CLAUDE.md §5, GEMINI.md §5**

### §3.1 PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

#### §3.1.1 PM Direct Execution Scope

PM is an escalation gateway, not an executor. **⚠️ CRITICAL**: PM MUST NOT perform Write/Edit on any file except `memory/*.md` and `CHANGELOG.md`. All file modifications MUST be dispatched to specialists (docs-writer, architect, automation-engineer, auditor). See [PM Direct Execution Constraints](agents/pm.md#⚠️-critical-pm-direct-execution-constraints) in `agents/pm.md`.

| Category | Tools | Scope |
|----------|-------|-------|
| Unconditional | Read, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Skill, ToolSearch | Always allowed |
| Conditional | Write, Edit | `memory/*.md` and `CHANGELOG.md` only |
| Conditional | Bash | Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat` |
| Forbidden | Write, Edit (all other paths) | Must delegate to specialist (docs-writer, architect, automation-engineer, auditor) |
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
- Perform documentation updates (delegate to docs-writer)
- Perform design work (delegate to architect)

**Task Owner vs Executor Distinction**:
- **Task owner (PM)**: "Buck stops here" responsible person for tracking progress
- **Task executor (specialist)**: Agent who performs the actual work
- PM creates tasks (owner: pm), dispatches specialists (executor: docs-writer/architect/automation-engineer), and updates task status upon completion

**User Communication for Specialist Tasks**:
When work requires specialist delegation, PM uses the following template:
<!-- Language Policy Exception: Korean text below is intentional for Korean-language user communication templates. See AGENTS.md §Language Policy for exception rules. -->
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

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **scaffolding-expert** | 0 | "Creating new projects", "Template validation", "Scaffolding tasks" |
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **automation-engineer** | 4 | "Creating scripts", "Cross-platform automation", "Implementation tasks" |
| **docs-writer** | 4 | "Updating documentation", "README creation", "CHANGELOG updates" |
| **security-expert** | 6 | "Security review", "Hook configuration", "Secret detection" |
| **lifecycle-manager** | 5 | "Lifecycle finalization", "Governance record sync", "L0->L1 template publishing", "L1->L2 explicit skill/script sync" — invoked on-demand for governance changes; lifecycle finalization runs automatically via `/sync` (**Workspace root only — L0-only agent, NOT available in variant templates**) |
| **auditor** | 6 | "Quality verification", "Documentation consistency check", "QA gate required" (Workspace root only) |

### L0→L1→L2 PM Agent Architecture

The PM Agent follows a three-level inheritance model: **L0 (workspace root base)** → **L1 (common template pure-extends)** → **L2 (variant YAML overrides)**. PM files at each level inherit from the previous, with L2 variants adding only YAML frontmatter overrides. See [`agents/pm.md`](agents/pm.md) for the complete specification, [`CONSTITUTION.md §5.5`](CONSTITUTION.md#55-pm-gateway-workflow) for governance workflow details.

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

> **Execution Plan Format**: For mandatory criteria, boilerplate table, and rules, see [§5 Execution Plan Templates](#§5-execution-plan-templates). For platform-specific dispatch instructions, see [CLAUDE.md §5](CLAUDE.md#5-agent-dispatch-rules) or [GEMINI.md §5](GEMINI.md#5-agent-dispatch-rules).

### §3.5 Phase Determination (Deliverable-Type Gate)

Before assigning an agent to any task, PM MUST classify the deliverable type:

| Deliverable Type | Phase | Required Agent | Tier | Notes |
|------------------|-------|----------------|------|-------|
| New file design, schema definition, ADR | Phase 1-2 | architect | High | Must precede implementation |
| New directory structure, template layout | Phase 1-2 | architect | High | Must precede implementation |
| Cross-platform convention, naming standard | Phase 1-2 | architect | High | Must precede implementation |
| Script implementation (approved plan exists) | Phase 4 | automation-engineer | Low | Plan from architect required |
| Documentation update | Phase 4 | docs-writer | Medium | |
| Documentation writing | Phase 4 | docs-writer | Medium | |
| Security configuration | Phase 6 | security-expert | Medium | |
| Project scaffolding | Phase 0 | scaffolding-expert | Low | |

**Design Gate (Row 0)**: All non-exempt deliverable types above require a design document (Row 0 in the execution plan) to be created/updated by architect before implementation begins. See §5.1.1 for exemption categories.

**Tier Ceiling Rule**: An agent's tier may NOT be elevated beyond its defined tier. `automation-engineer` is always Low — assigning it High is a governance violation.

> **Execution Plan Boilerplate Policy**: For boilerplate mandatory/discretionary cases, see [CLAUDE.md §5](CLAUDE.md#5-agent-dispatch-rules) or [GEMINI.md §5](GEMINI.md#5-agent-dispatch-rules).

### §3.6 3-Tier Strategy

When leading execution and improvement tasks, PM MUST use the 3-Tier model strategy:

- **High-tier**: Complex reasoning, architectural design, planning (claude-opus-4-7 / gemini-3.1-pro)
- **Medium-tier**: Code review, testing, PR review, quality gates (claude-sonnet-4-6 / gemini-3.5-flash)
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
- Applies to: README.md, CLAUDE.md, GEMINI.md, AGENTS.md, CONSTITUTION.md, CHANGELOG.md, all documentation in docs/, agents/, skills/
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

*Note: Exception is NOT available for: agents/*.md, skills/*.md, CONSTITUTION.md, CLAUDE.md, GEMINI.md, AGENTS.md, or any variant context.md file.*

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

### Pluggable Variant Audit Hooks and Integrity Protection
- **Core Script Standardization**: The core synchronization and validation scripts (`scripts/dev-sync.ts` and `scripts/audit.ts`) must remain standardized and identical across all templates and variants. Direct modification of these core scripts in L2 projects is strictly forbidden.
- **Variant-Specific Audit Hook**: Variant projects requiring custom verification checks must implement them in a pluggable hook script located at `scripts/audit-variant.ts`.
- **Integrity Enforcement**: During template reconciliation (`l2-to-variant-pipeline.ts`), any modified core scripts will be automatically detected and will fail the reconciliation.
<!-- COMMON-AGENTS:END -->

---

## §4: Other Workflows

### 4.1 PM Subagent Dispatch Protocol

The PM agent follows a three-level inheritance model: **L0 (workspace root)** → **L1 (common template)** → **L2 (variant templates)**.

> **For PM Agent Architecture**: See [CONSTITUTION.md §5.5 - PM Gateway Workflow](CONSTITUTION.md#55-pm-gateway-workflow) for complete governance workflow, L0→L1→L2 extends chain resolution, and variant-specific configuration.

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
3. **Independent QA Gate** - Auditor owns Phase 6 QA gate autonomously using bun scripts/qa-gate.ts
4. **Parallel Agent Dispatch** - all parallel agents must be dispatched in one turn for research/analysis phases
5. **Error handling** - if any parallel agent fails, responsible agent resolves failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to PM for intervention

#### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | High | - | orchestrates only |
| Consistency Auditor | `agents/auditor.md` | Medium | Independent QA | No |
| Lifecycle Manager | `agents/lifecycle-manager.md` | Medium | On-demand governance sync | Governance docs only (Workspace root only — L0-only agent) |
| Template Architect | `agents/architect.md` | High | Design phase | No |
| Automation Engineer | `agents/automation-engineer.md` | Low | Serial | TypeScript (.ts) automation scripts per ADR-0036 |
| Documentation Writer | `agents/docs-writer.md` | **Medium** | After design | .md files only |
| Scaffolding Expert | `agents/scaffolding-expert.md` | Low | Research phase | setup scripts only (after approval) |
| Security & Git Expert | `agents/security-expert.md` | Medium | Review phase | Hook configs only |

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [CONSTITUTION.md §5.1](CONSTITUTION.md#51-agent-file-format-standard-frontmatter).

---

### 4.2 Harness Engineering Workflow

Following the **PM governance workflow** defined in [CONSTITUTION.md §5.4](CONSTITUTION.md#54-pm-governance-workflow-7-phases):

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
  Automation Engineer implements per approved plan
  Documentation Writer updates docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 5 - Lifecycle Finalization (PM-owned)
  PM updates governance records for any changed artifacts
  PM logs decisions to memory/YYYY-MM-DD.md

Phase 6 - Quality Assurance & Finalization (specialist-autonomous in workspace, PM in variants)
  Auditor (workspace) executes bun scripts/qa-gate.ts autonomously
  PM (variants) executes qa scripts
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE
  PM runs /sync "type: description" → PR opened
```

---

### 4.3 Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the implementation approach and folder structure | `architect` | `automation-engineer` |
| Write or modify automation scripts (.ts, package.json) per ADR-0036 | `automation-engineer` | `architect` |
| Update documentation files | `docs-writer` | `architect` |
| Create new project from template | `scaffolding-expert` | `automation-engineer` |
| Security review, Git hooks configuration | `security-expert` | `architect` |
| Cross-validate documentation consistency | `auditor` | `docs-writer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |

---

## §5: Execution Plan Templates

### 5.1 Standard Execution Plan Template

> **Design Gate (Row 0)**: Workspace root (L0) and common template (L1) only.
> L2 variant projects are exempt — they manage their own design workflow.

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 0 | Create/update design doc → `docs/designs/<spec-id>-design.md` | architect | High | [model] | NEW |
| 1 | [task description] | [specialist] | High/Medium/Low | [model] | <spec-id> |
| N | `/sync "type(scope): message"` — lifecycle + audit + commit + push + PR | pm | Medium | [model] | |

**Execution Order**: [Parallel | Sequential]

**Key points**:
- **Row 0 (Design Gate) is MANDATORY** for L0/L1 — design document must be created/updated before implementation
- Tier column is MANDATORY (High/Medium/Low)
- `/sync` is always the final step — it covers lifecycle update, full audit, commit, push, and PR creation
- No separate Lifecycle Update or Final QA Audit rows needed — `/sync` handles both
- State parallel vs sequential order below the table
- "pm (direct)" is FORBIDDEN - PM never executes directly

### 5.1.1 Design Gate Exemptions

When a task falls into an exempt category, Row 0 is replaced with an exemption marker:

| Category | ID | Description | Row 0 Format |
|----------|----|-------------|--------------|
| memory-log | E1 | Session log entry in `memory/YYYY-MM-DD.md` | `── EXEMPT: memory-log ──` |
| changelog | E2 | `CHANGELOG.md` update only | `── EXEMPT: changelog ──` |
| hotfix-typo | E3 | Typo fix, single-line change, trivial fix | `── EXEMPT: hotfix-typo ──` |
| pure-readme | E4 | README.md body text only (no structural/design change) | `── EXEMPT: pure-readme ──` |
| sync-only | E5 | `/sync` execution only (lifecycle finalization) | `── EXEMPT: sync-only ──` |

**Rules**:
- Exempt Row 0: Agent/Tier/Model columns left blank (`—`)
- Only E1–E5 categories may be used — PM cannot invent ad-hoc exemptions
- Abuse of exemptions is a governance violation

### 5.2 Platform Parity Considerations

When modifying files that affect both CLAUDE.md and GEMINI.md:

| # | Task | Agent | Tier | Model | Spec | Platform |
|---|------|-------|------|---------|----------|
| 1 | [task] | [specialist] | [tier] | [model] | Both |
| N | `/sync "type(scope): message"` | pm | Medium | [model] | Both |

**Platform Column**: `Claude` / `Antigravity` / `Both` / `L0-only`

**Note**: See execution plan boilerplate in CLAUDE.md §5, GEMINI.md §5, and agents/pm.md for the Platform column definition.

### 5.3 Example Execution Plans

#### Example 1: Multi-Agent Platform Parity Update

> **Note**: The `Model` column below shows the Claude Code short alias (`sonnet`/`opus`/`haiku`/`fable`) actually passed to the `Agent()` tool's `model` parameter — not the registry ID (e.g. `claude-sonnet-4-6`). See [CLAUDE.md §6](CLAUDE.md#6-native-sub-agents-agent-tool) for the registry-ID → alias translation table. On Gemini/Antigravity, use the literal model ID instead (see GEMINI.md's equivalent example).

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 1 | Update agents/pm.md | docs-writer | Medium | sonnet | <spec-id> |
| 2 | Update scripts/audit.ts | automation-engineer | Low | haiku | <spec-id> |
| 3 | Update CLAUDE.md §5 | docs-writer | Medium | sonnet | <spec-id> |
| 4 | Update GEMINI.md §5 | docs-writer | Medium | sonnet | <spec-id> |
| 5 | `/sync "docs(agents): update pm.md and platform dispatch rules"` | pm | Medium | sonnet | |

**Execution Order**: Sequential (platform parity requires CLAUDE.md and GEMINI.md updates together)

#### Example 2: Single Specialist Task

| # | Task | Agent | Tier | Model | Spec |
|---|------|-------|------|-------|------|
| 1 | Update project README introduction | docs-writer | Medium | sonnet | <spec-id> |
| 2 | `/sync "docs: update project README introduction"` | pm | Medium | sonnet | |

**Execution Order**: Sequential

---

## §6: Skills

> **📌 VERSION_MANIFEST is the Single Source of Truth (SSOT)**
>
> All skill versions, status, and lifecycle metadata are maintained in [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md).
> The table below provides skill names and locations only. For current versions, status, and detailed metadata, always reference VERSION_MANIFEST.
>
> **Skill structure specification**: See [CONSTITUTION.md §6 - Skills](CONSTITUTION.md#6-skills) for frontmatter format and session skill registration.
>
> **Skill discovery & registration**: To make these workspace-level skills discoverable and loadable by Claude, Gemini, and Antigravity, the `skills/` folder is registered in `.agents/skills.json` at the root of the workspace.

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

**Common workspace-level skills** (see `docs/VERSION_MANIFEST.md` for versions):

| Skill | Location | Purpose |
|-------|----------|---------|
| `sync` | `skills/sync/` | Sync pipeline — lifecycle, audit, publish, commit, push, PR |
| `project-review` | `skills/project-review/` | Multi-agent parallel project review |
| `audit-workspace` | `skills/audit-workspace/` | Workspace standards audit |
| `meeting-facilitation` | `skills/meeting-facilitation/` | Multi-agent meeting orchestration |
| `security-scan` | `skills/security-scan/` | Security and secret detection |
| `create-variant` | `skills/create-variant/` | New variant scaffolding |
| `promote-variant` | `skills/promote-variant/` | Variant promotion to official |

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
- **Search Tool Prioritization**: Prioritize MCP semantic search tools for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.
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

> **For Agent Lifecycle procedures**: See [CONSTITUTION.md §5.6 - Agent Lifecycle Management](CONSTITUTION.md#56-agent-lifecycle-management) for detailed lifecycle procedures.

---


## §9: Maintenance Rule

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

---

## §10: Periodic Skill Review Schedule

**Frequency**: Quarterly (every 3 months)  
**Owner**: lifecycle-manager  
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
