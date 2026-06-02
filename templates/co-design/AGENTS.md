# AGENTS.md

> **🚨 For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** - auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context - `docs/context.md`.

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

### 🛠️ Orchestration

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Design Project Manager (PM)** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates design workflow from brief to handoff; coordinates specialist agents; enforces quality gates |

### 🎨 Research & Strategy

| Agent | File | Tier | Role |
|-------|------|------|------|
| **UX Researcher** | [`agents/ux-researcher.md`](agents/ux-researcher.md) | Medium | Conducts user research, analyzes needs, produces insights and personas |
| **Design Lead** | [`agents/design-lead.md`](agents/design-lead.md) | High | Owns design direction, design system architecture, and creative strategy |
| **Design Storyteller** | [`agents/storyteller.md`](agents/storyteller.md) | High | Provides philosophical foundation, meaning, and narrative coherence to design systems |
| **Service Designer** | [`agents/service-designer.md`](agents/service-designer.md) | Medium | Designs end-to-end service experiences, customer journeys, and operational processes |

### 🎭 Visual & Interface Design

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Visual Designer** | [`agents/visual-designer.md`](agents/visual-designer.md) | Medium | Produces visual designs, design tokens, and component specifications |
| **Typography Expert** | [`agents/typography-expert.md`](agents/typography-expert.md) | Medium | Specializes in font selection, type systems, and visual hierarchy through typography |

### 🔨 Prototyping & Handoff

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Prototype Engineer** | [`agents/prototype-engineer.md`](agents/prototype-engineer.md) | Medium | Builds interactive prototypes and creates design handoff artifacts |

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
| **scaffolding-expert** | 0 | "Creating new projects", "Template validation", "Scaffolding tasks" |
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **automation-engineer** | 4 | "Creating scripts", "Cross-platform automation", "Implementation tasks" |
| **docs-writer** | 4 | "Updating documentation", "README creation", "CHANGELOG updates" |
| **security-expert** | 5 | "Security review", "Hook configuration", "Secret detection" |
| **auditor** | 5 | "Quality verification", "Documentation consistency check", "QA gate required" |

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM.

---

## PM Subagent Dispatch Protocol

### Dispatch Decision

```
Request received
  │
  ├─▶ Read-only? (research, inspiration, analysis)
  │   └─▶ PARALLEL - dispatch multiple agents in a single message
  │
  └─▶ Write? (create designs, prototypes, specs)
       └─▶ SERIAL - one agent at a time to prevent file conflicts
```

> **Why serial writes?** Concurrent writes to design files cause conflicts and lost work.
> Always wait for a write agent to complete before dispatching the next.

### Superpowers Plugin & Cost Optimization (3-Tier Strategy)

The Design PM MUST leverage the **`superpowers`** plugin for harness engineering using a 3-tier model strategy to optimize cost and quality:

- **High-tier (Strategy/Direction)**: Used exclusively by Design PM and Design Lead for creative direction, design system architecture, and complex design decisions.
- **Medium-tier (Design/Research)**: Used by UX Researcher and Visual Designer for design execution, user research analysis, and visual design work.
- **Low-tier (Prototyping/Production)**: Used by Prototype Engineer for building interactive prototypes, preparing design assets, and creating handoff documentation.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The Design PM delegates execution to the Medium and Low tiers before finalizing design direction.

### Dispatch Rules

1. **Single message, multiple `Agent()` calls** - all parallel agents must be dispatched in one turn.
2. **Merge before proceeding** - Design PM waits for ALL parallel agents to return before the next serial step.
3. **Phase 4 execution loop** - each design task goes through:
   - **ux-researcher** gathers user insights and requirements
   - **design-lead** establishes design direction and system approach
   - **visual-designer** creates visual designs and specifications
   - **prototype-engineer** builds interactive prototype
   - **Quality gate (design review)** validates coherence
   - Loop and correct if issues found - maximum **3 iterations** before escalating.
4. **Error handling** - if any parallel agent fails, Design PM resolves the failure before proceeding. Do not skip.
5. **Max fix iterations** - 3 per review cycle before escalating to the user.

### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| Design PM | `agents/pm.md` | High | Orchestrates only | No |
| UX Researcher | `agents/ux-researcher.md` | Medium | Research phase | Research reports only |
| Design Lead | `agents/design-lead.md` | High | Direction phase | Design docs only |
| Visual Designer | `agents/visual-designer.md` | Medium | After direction | Design files + specs |
| Prototype Engineer | `agents/prototype-engineer.md` | Medium | After designs | Prototypes + handoff |

---

## Design Workflow

```
Phase 0 - Team Assembly & Brief
  Design PM assesses design requirements
  Design PM creates specialized agents/skills if needed
  Design PM updates AGENTS.md and docs/context.md

Phase 1 - Research & Discovery
  UX Researcher conducts user research and competitive analysis (parallel)
  Design Lead analyzes technical constraints and platform requirements
  Design PM synthesizes findings → design brief

Phase 2 - Design Direction
  Design Lead establishes design system approach and creative direction
  Design PM obtains explicit user approval → GATE

Phase 3 - Design Execution (serial)
  Visual Designer creates visual designs and component specifications
  Prototype Engineer builds interactive prototype for validation
  
Phase 4 - Design Review Gate
  Design system consistency validated
  Accessibility compliance verified (WCAG AA)
  User experience coherence confirmed → GATE

Phase 5 - Handoff & Finalization
  Prototype Engineer creates design handoff package
  Design PM logs decisions to memory/YYYY-MM-DD.md
  Design PM runs /sync "design: description" → deliverable ready
```

---

## Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Define design system architecture and tokens | `design-lead` | `visual-designer` |
| Conduct user research and create personas | `ux-researcher` | `design-lead` |
| Create visual designs and mockups | `visual-designer` | `ux-researcher` |
| Build interactive prototype | `prototype-engineer` | `visual-designer` |
| Establish overall design direction | `design-lead` | `visual-designer` |
| Orchestrate multi-phase design project | `pm` | any specialist agent |
| Create competitive analysis | `ux-researcher` | `design-lead` |

---

## Skills

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **UI/UX Design Intelligence** | `.claude/skills/ui-ux-design-intelligence/SKILL.md` | Building design systems, creating visual designs, UI components, or design specifications |
| **Agent Lifecycle Manager** | `skills/agent-lifecycle-manager/SKILL.md` | Design PM managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| **Skill Lifecycle Manager** | `skills/skill-lifecycle-manager/SKILL.md` | Design PM managing skill lifecycle after agent configuration changes |
| **Meeting Facilitation** | `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| **Service Design** | `.claude/skills/service-design/SKILL.md` | Designing end-to-end service experiences, customer journeys, and operational processes |
| project-review | `.claude/skills/project-review/` | pm | Comprehensive parallel review of the current project by all available agents. Produces a prioritized improvement plan. Triggered by user request, PM structural change detection (T-02), or QA escalation (T-03). |

---

## Universal Baseline Behaviors

All design agents, regardless of their role, must adhere to the following:

- **Accessibility First**: All designs must meet WCAG AA standards by default. Color contrast, text sizing, and interaction patterns should be accessible.
- **Design System Consistency**: Work within established design systems. Document any new tokens or patterns before using them.
- **Communication Style**: Use visual language where appropriate (wireframes, mockups). Always explain design rationale, not just visual choices.
- **User-Centered Decision Making**: Default to choices that serve user needs over technical convenience when there's conflict.
- **Handoff Quality**: All designs must include sufficient specification for implementation—no "I'll design it in code."
- **Language**: All design documentation, file names, commit messages, and branch names - **English only**.
- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.

---

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:

1. Add a row to the Agent Roster table above.
2. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
3. Update the `## Agents` table in `docs/context.md` to match.
4. If the agent uses a skill, add a row to the Skills table above and in `docs/context.md § Skills`.


