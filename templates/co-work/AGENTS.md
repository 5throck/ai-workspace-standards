# AGENTS.md - Co-Work Variant

> **Canonical agent index** for collaboration-focused projects.

---

## Multi-Agent Phase Definitions

**co-work follows the standard 7-phase workflow** defined in [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding -->.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|-----------------|-------------------|
| 0 | Project Initiation | Orchestrator | — (PM only) |
| 1 | Research & Data Gathering | Observer | analyst, storyteller |
| 2 | Design Review & Approval | Gate Keeper | storyteller |
| 3 | Content Creation | Coordinator | content-writer, technical-writer |
| 4 | Platform Delivery | Coordinator | ms365-expert, project-coordinator |
| 5 | QA & Finalization | Owner | — (PM only) |
| 6 | PR & Handoff | Owner | — (PM only) |

**PM Facilitation Guidance:**
See [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding --> for detailed PM tasks in each phase:
- Opening the phase (objective, specialist nomination, expectations)
- Progress monitoring (intervene only if standards not met)
- Synthesis of outputs (key findings, decisions)
- Provisional decision with justification
- Follow-up assignment

**Phase-Specific Notes for co-work:**
- **Phase 1-2 (Planning)**: Storyteller contributes to organizational culture and change narrative strategy
- **Phase 3 (Design Handoff)**: Analyst conducts systematic investigation and data synthesis; Content Writer and Technical Writer transform research into documentation; Project Coordinator manages stakeholder communication
- **Phase 4 (Execution)**: Content Writer produces documentation and communications; Technical Writer creates technical resources; MS 365 Expert provides platform expertise for collaboration tools

---

## Agent Roster

### 🛠️ Orchestration
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Collaboration PM** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates research workflow, documentation strategy, stakeholder alignment |

### 📊 Research & Analysis
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Research Analyst** | [`agents/analyst.md`](agents/analyst.md) | Medium | Conducts systematic investigation, data synthesis, evidence gathering |
| **Storyteller** | [`agents/storyteller.md`](agents/storyteller.md) | High | Shapes organizational culture, manages change narratives, provides historical context |

### ✍️ Documentation & Communication
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Content Writer** | [`agents/content-writer.md`](agents/content-writer.md) | Medium | Transforms research into clear documentation and communications |
| **Technical Writer** | [`agents/technical-writer.md`](agents/technical-writer.md) | Medium | Creates API documentation, technical guides, and developer resources |

### 📅 Coordination & Logistics
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Coordinator** | [`agents/project-coordinator.md`](agents/project-coordinator.md) | Low | Manages schedules, stakeholder communication, delivery logistics |

### 🛠️ Tools & Platforms
| Agent | File | Tier | Role |
|-------|------|------|------|
| **MS 365 Expert** | [`agents/ms365-expert.md`](agents/ms365-expert.md) | Low | Provides Microsoft 365 expertise for Outlook, Word, Excel, PowerPoint, SharePoint, and Teams |

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
 
### Superpowers Plugin & Cost Optimization (3-Tier Strategy)

The PM agent MUST leverage the **`superpowers`** plugin for harness engineering using a 3-tier model strategy to optimize cost and quality:

- **High-tier (Design/Plan)**: Used exclusively by the PM/Storyteller for complex reasoning, architectural design, and writing precise sub-agent prompts.
- **Medium-tier (Review/QA)**: Used by Analyst or Content Writer to review code, run tests, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Project Coordinator/MS365 Expert for fast typing, simple repetitive tasks, or strictly scoped tasks.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

---

## Skills

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Research Analysis** | `.claude/skills/research-analysis/SKILL.md` | Analyzing topics, synthesizing research, evidence gathering |
| **Documentation Writing** | `.claude/skills/documentation-writing/SKILL.md` | Creating guides, drafting communications, synthesizing complex information |
| **Meeting Facilitation** | `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| **Agent Lifecycle Manager** | `skills/agent-lifecycle-manager/SKILL.md` | PM managing agent lifecycle and validation |
| **Skill Lifecycle Manager** | `skills/skill-lifecycle-manager/SKILL.md` | PM managing skill lifecycle and validation |
| **API Documentation** | `.claude/skills/api-documentation/SKILL.md` | Documenting REST APIs, GraphQL interfaces, SDKs, and developer-facing technical specifications |
| project-review | `.claude/skills/project-review/` | pm | Comprehensive parallel review of the current project by all available agents. Produces a prioritized improvement plan. Triggered by user request, PM structural change detection (T-02), or QA escalation (T-03). |

---

## Maintenance Rule

When creating new agents, update AGENTS.md and docs/context.md § Agents to maintain consistency.

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.


