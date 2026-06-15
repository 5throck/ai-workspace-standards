# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** - auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`.
> **Agent architecture and governance rules**: See workspace standards(workspace standards#5-multi-agent-architecture).

---

## Multi-Agent Phase Definitions

**co-design follows the standard 7-phase workflow** defined in [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding -->.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|-----------------|-------------------|
| 0 | Project Initiation | Orchestrator | — (PM only) |
| 1 | Research & Strategy | Observer | ux-researcher, storyteller |
| 2 | Design Review & Approval | Gate Keeper | design-lead, storyteller |
| 3 | Design Execution | Coordinator | design-lead, service-designer, visual-designer, typography-expert |
| 4 | Prototyping | Coordinator | prototype-engineer |
| 5 | QA & Finalization | Owner | — (PM only) |
| 6 | PR & Handoff | Owner | — (PM only) |

**PM Facilitation Guidance:**
See [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding --> for detailed PM tasks in each phase:
- Opening the phase (objective, specialist nomination, expectations)
- Progress monitoring (intervene only if standards not met)
- Synthesis of outputs (key findings, decisions)
- Provisional decision with justification
- Follow-up assignment

**Phase-Specific Notes for co-design:**
- **Phase 1-2 (Planning)**: Design Lead and Design Storyteller contribute to design direction and creative strategy
- **Phase 3 (Design Handoff)**: UX Researcher provides user insights, Design Lead owns design system architecture, Visual Designer produces visual designs and component specs, Typography Expert specializes in type systems
- **Phase 4 (Execution)**: Prototype Engineer builds interactive prototypes and creates design handoff artifacts

---

## Agent Roster

### 🛠️ Orchestration / Audit

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 5); reduced bottleneck role. **PM does NOT execute code or documentation directly — all specialist work dispatched through PM. See `agents/pm.md` for ⚠️ CRITICAL direct execution constraints.** |

### 🎨 Design Specialists

| Agent | File | Tier | Role |
|-------|------|------|------|
| Design Lead | [`agents/design-lead.md`](agents/design-lead.md) | High | Design direction, design system architecture, and creative strategy owner |
| UX Researcher | [`agents/ux-researcher.md`](agents/ux-researcher.md) | Medium | User research, needs analysis, and UX insights specialist |
| Visual Designer | [`agents/visual-designer.md`](agents/visual-designer.md) | Medium | Visual designs, design tokens, and component specifications producer |
| Typography Expert | [`agents/typography-expert.md`](agents/typography-expert.md) | Medium | Font selection, type systems, and visual hierarchy specialist |
| Service Designer | [`agents/service-designer.md`](agents/service-designer.md) | Medium | End-to-end service experience and customer journey designer |
| Storyteller | [`agents/storyteller.md`](agents/storyteller.md) | Medium | Philosophical foundation, meaning, and narrative coherence for design systems |
| Prototype Engineer | [`agents/prototype-engineer.md`](agents/prototype-engineer.md) | Medium | Interactive prototypes and design handoff artifacts builder |

---

## PM Gateway Policy

**Single Point of Entry**: PM is the ONLY agent that users may directly invoke.
All specialist agents require PM dispatch - enforced at 4 levels.

### PM Direct Execution Scope

PM is an escalation gateway, not an executor. **⚠️ CRITICAL**: PM MUST NOT perform Write/Edit on any file except `memory/*.md` and `CHANGELOG.md`. All file modifications MUST be dispatched to specialists (design-lead, ux-researcher, visual-designer, typography-expert, service-designer, storyteller, prototype-engineer). See [PM Direct Execution Constraints](agents/pm.md#⚠️-critical-pm-direct-execution-constraints) in `agents/pm.md`.

| Category | Tools | Scope |
|----------|-------|-------|
| Unconditional | Read, Glob, Grep, Agent, TaskCreate, TaskUpdate, AskUserQuestion, Skill, ToolSearch | Always allowed |
| Conditional | Write, Edit | `memory/*.md` and `CHANGELOG.md` only |
| Conditional | Bash | Read-only: `git status/diff/log`, `bun scripts/audit.ts`, `ls`, `cat` |
| Forbidden | Write, Edit (all other paths) | Must delegate to specialist (design-lead, ux-researcher, visual-designer, typography-expert, service-designer, storyteller, prototype-engineer) |
| Forbidden | Bash (write/execute patterns) | Must delegate to specialist |

**Rationale**: PM is orchestrator, not executor. Direct execution violates governance separation of concerns. See [Role Clarification](agents/pm.md#⚠️-role-clarification) and [Task Tracking vs Execution](agents/pm.md#task-tracking-vs-execution) in `agents/pm.md`.

When a specialist agent's required tool is denied, PM applies the [Permission Denial Protocol](agents/pm.md#permission-denial-protocol) — never substitutes for the specialist.

### PM Role Boundaries

**What PM Does**:
- Orchestrate multi-agent workflows
- Create execution plans
- Dispatch specialist agents
- Enforce quality gates
- Track progress

**What PM Does NOT Do**:
- Directly Edit/Write files (except `memory/*.md`, `CHANGELOG.md`)
- Implement code or scripts
- Perform documentation updates (delegate to design-lead or appropriate specialist)
- Perform design work (delegate to design-lead)

**Task Owner vs Executor Distinction**:
- **Task owner (PM)**: "Buck stops here" responsible person for tracking progress
- **Task executor (specialist)**: Agent who performs the actual work
- PM creates tasks (owner: pm), dispatches specialists (executor: design-lead/ux-researcher/visual-designer/prototype-engineer/etc.), and updates task status upon completion

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

### Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 6 QA

### Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

### Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **design-lead** | 2-3 | "Design direction needed", "Design system architecture", "Creative strategy", "Visual language" |
| **ux-researcher** | 1 | "User research", "Usability testing", "Research synthesis", "User needs analysis" |
| **visual-designer** | 3 | "Visual designs", "Design tokens", "Component specs", "UI execution" |
| **typography-expert** | 3 | "Font selection", "Type system", "Visual hierarchy", "Typography" |
| **service-designer** | 3 | "Service experience", "Customer journey", "End-to-end service design" |
| **storyteller** | 1-2 | "Brand narrative", "Design philosophy", "Meaning and coherence", "Storytelling" |
| **prototype-engineer** | 4 | "Interactive prototypes", "Design handoff artifacts", "Prototype implementation" |

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

---

<!-- COMMON-AGENTS:START -->
## Language Policy

**English-Only Documentation Rule**: All workspace documentation files (.md) must be written in English, with explicit exceptions for recognized locale translation zones (see Translation Zones below).

### English Documentation Requirement
- All `.md` files outside `ko/` and `locales/ko/` directories MUST be in English
- Applies to: README.md, CLAUDE.md, GEMINI.md, AGENTS.md, context.md, CHANGELOG.md, all documentation in docs/, agents/, skills/
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

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The PM agent delegates execution to the Low-tier and delegates review to the Medium-tier before finalizing.

### Dispatch Rules

1. **Autonomous Agent Handoffs** - Agents can dispatch each other directly via JSON contracts without PM intervention for routine workflows
2. **PM Orchestration Phases** - PM only orchestrates Phases 0 (Team Assembly), 2 (Design Validation), and 5 (Lifecycle Finalization)
3. **Independent QA Gate** - Auditor owns Phase 6 QA gate autonomously using bun scripts/qa-gate.ts
4. **Parallel Agent Dispatch** - all parallel agents must be dispatched in one turn for research/analysis phases
5. **Error handling** - if any parallel agent fails, responsible agent resolves failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to PM for intervention

### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | High | - | orchestrates only |
| Design Lead | `agents/design-lead.md` | High | Design phase (parallel with storyteller) | Design system docs only |
| UX Researcher | `agents/ux-researcher.md` | Medium | Research phase (parallel) | Research docs only |
| Visual Designer | `agents/visual-designer.md` | Medium | Serial (after design-lead) | Visual specs and component docs |
| Typography Expert | `agents/typography-expert.md` | Medium | Parallel with visual-designer | Typography docs only |
| Service Designer | `agents/service-designer.md` | Medium | Parallel with visual-designer | Service design docs only |
| Storyteller | `agents/storyteller.md` | Medium | Research phase (parallel) | Narrative docs only |
| Prototype Engineer | `agents/prototype-engineer.md` | Medium | Serial (after design approval) | Prototype files and handoff artifacts |

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in workspace standards(workspace standards#51-agent-file-format-standard-frontmatter).

---

## Harness Engineering Workflow

Following the **PM governance workflow** defined in workspace standards(workspace standards#54-pm-governance-workflow-7-phases):

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
  Prototype Engineer builds interactive prototypes per approved plan
  Visual Designer and Typography Expert produce final design assets
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

## Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Define design direction and creative strategy | `design-lead` | `ux-researcher` |
| Conduct user research and usability testing | `ux-researcher` | `design-lead` |
| Produce visual designs and component specs | `visual-designer` | `design-lead` |
| Design type systems and font selection | `typography-expert` | `visual-designer` |
| Design end-to-end service experiences | `service-designer` | `design-lead` |
| Write design narrative and brand philosophy | `storyteller` | `design-lead` |
| Build interactive prototypes and handoff artifacts | `prototype-engineer` | `visual-designer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |

---

## Skills

> **📌 VERSION_MANIFEST is the Single Source of Truth (SSOT)**
>
> All skill versions, status, and lifecycle metadata are maintained in [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md).
> The table below provides skill names and locations only. For current versions, status, and detailed metadata, always reference VERSION_MANIFEST.
>
> **Skill structure specification**: See workspace standards(workspace standards#6-skills) for frontmatter format and session skill registration.

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

### Platform Skills (shared infrastructure)

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Agent Lifecycle Manager** | `.claude/skills/agent-lifecycle-manager/SKILL.md` | PM managing agent lifecycle — creating, versioning, deprecating agents |
| **Platform Skill Lifecycle Manager** | `.claude/skills/platform-skill-lifecycle-manager/SKILL.md` | PM managing platform skill lifecycle and propagation |
| **Platform Command Lifecycle Manager** | `.claude/skills/platform-command-lifecycle-manager/SKILL.md` | PM managing platform command lifecycle and parity |
| **Finishing a Development Branch** | `.claude/skills/finishing-a-development-branch/SKILL.md` | Redirects branch completion to `/sync` pipeline |
| **Simulate Project Creation** | `.claude/skills/simulate-project-creation/SKILL.md` | Testing new-project scaffolding in temporary directory |

### Skill Registry

| Skill | File | Trigger condition |
|-------|------|-------------------|
| UI/UX Design Intelligence | `skills/ui-ux-pro-max/SKILL.md` | Building web components, pages, or applications; UI/UX design tasks |
| Skill Lifecycle Manager | `skills/skill-lifecycle-manager/SKILL.md` | PM agent managing skill lifecycle after agent configuration changes; checking skill health, orphaned/deprecated skills |
| Script Lifecycle Manager | `skills/script-lifecycle-manager/SKILL.md` | PM agent managing script lifecycle; creating scripts, managing versions and dependencies in SCRIPTS.md |
| Agent Lifecycle Manager | `skills/agent-lifecycle-manager/SKILL.md` | PM agent managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| Platform Skill Lifecycle Manager | `.claude/skills/platform-skill-lifecycle-manager/SKILL.md` · `.gemini/skills/platform-skill-lifecycle-manager/SKILL.md` | PM managing platform skill lifecycle — creation, versioning, propagation for .claude/skills/ and .gemini/skills/ |
| Platform Command Lifecycle Manager | `.claude/skills/platform-command-lifecycle-manager/SKILL.md` · `.gemini/skills/platform-command-lifecycle-manager/SKILL.md` | PM managing platform command lifecycle — creation, parity, propagation for .claude/commands/ and .gemini/commands/ |
| Simulate Project Creation | `skills/simulate-project-creation/SKILL.md` | Testing new-project scaffolding logic in temporary directory |
| Create Variant | `skills/create-variant/SKILL.md` | Phase A guided process for creating a new workspace variant prototype in Projects/ |
| Promote Variant | `skills/promote-variant/SKILL.md` | Phase B guided process for promoting a completed Phase A prototype to templates/co-<name>/ |
| Security Scan | `skills/security-scan/SKILL.md` | Running vulnerability scans, checking advisories, secret detection |
| Audit Workspace | `skills/audit-workspace/SKILL.md` | Validating workspace standards compliance, documentation consistency |
| Validate Docs Links | `skills/validate-docs-links/SKILL.md` | Checking all markdown links point to existing files |
| Meeting Facilitation | `skills/meeting-facilitation/SKILL.md` | Running an interactive meeting where agents read each other's contributions and respond in dialogue |
| Validate Templates | `scripts/validate-templates.ts` | Validating template variant structure, agent frontmatter, AGENTS.md roster, and shared file sync; run manually or triggered by pre-commit on templates/ changes |
| project-review | `skills/project-review/SKILL.md` | Comprehensive parallel review of the current project by all available agents. Produces a prioritized improvement plan. Triggered by user request, PM structural change detection (T-02), or QA escalation (T-03). |
| Finishing a Development Branch | `.claude/skills/finishing-a-development-branch/SKILL.md` · `.gemini/skills/finishing-a-development-branch/SKILL.md` | Workspace override — redirects branch completion to `/sync` pipeline; enforces CHANGELOG, memlog, audit, and PR creation gates. Available on both Claude Code and Gemini CLI. |
| Team Builder | `skills/team-builder/SKILL.md` | Guides PM through building a new AI agent team — requirements interview, benchmarking, current team diagnosis, proposal generation, approval gate, and execution via `scripts/team-builder.ts`. Triggered by: "새 팀 구성", "에이전트팀 변경", "build new agent team". |

> **📌 VERSION_MANIFEST Reference**: For the complete, up-to-date list of all skill versions, status (active/deprecated), and lifecycle metadata, see [`docs/VERSION_MANIFEST.md`](docs/VERSION_MANIFEST.md). That file is the authoritative source — this table serves only as a quick reference for skill names and locations.

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
- **File Organization**: Never create `.md` files at the project root unless explicitly creating a standard root file (README.md, CHANGELOG.md, AGENTS.md, SECURITY.md). Place analysis and reports in `docs/`, session logs and meeting transcripts in `memory/`. Create all temporary code and scratch scripts in `tests/`.
- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.
- **Source Attribution**: When presenting research findings, external data, or factual claims, always cite the source using `[Source: URL/document]` inline or a `## References` section. If a source cannot be verified, explicitly mark it as `⚠️ Unverified` and recommend manual verification. Never present unverified information as established fact.
- **Computational Integrity**: Never perform high-precision or safety-critical numerical calculations directly. For aerospace, aviation, precision control, or regulated financial computations, delegate to a validated external tool (Fortran, Python+NumPy/SciPy, Julia, etc.) via the `stack-setup` agent. Label any AI-generated numerical estimate explicitly as **approximate**.

---

## Lifecycle Management

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

---

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
| `skills/` | Workspace-level skills (single source of truth) |
| `.claude/skills/` | Platform-specific skills for Claude Code only |
| `.gemini/skills/` | Platform-specific skills for Gemini CLI only |

> **Sync rule**: Workspace-level skills in `skills/` are the single source of truth. Do not duplicate them in `.claude/skills/` or `.gemini/skills/`. Platform-specific skills may exist in both `.claude/skills/` and `.gemini/skills/` when they serve platform-specific purposes.

> **Schema propagation**: `docs/workspace-schema.json` is the SSOT for workflow phases, agent tiers, and model assignments.
> Validated automatically by `scripts/validate-model-registry.ts` and `scripts/validate-templates.ts`.

> **Workspace-level skills**: All workspace-level skills reside in `skills/` folder only.
> Platform-specific skills in `.claude/skills/` and `.gemini/skills/` must be annotated with `gemini-parity: skip` or `claude-parity: skip` in their SKILL.md frontmatter to indicate platform-specific implementation.

---

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in workspace standards(workspace standards#51-agent-file-format-standard-frontmatter).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in workspace standards(workspace standards#62-skill-file-format-standard-frontmatter).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per workspace standards(workspace standards#1-standard-folder-structure).

---

## Periodic Skill Review Schedule

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
