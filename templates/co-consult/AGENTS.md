# AGENTS.md - Co-Consult Variant

> **Canonical agent index** for collaboration-focused projects.

---

## Multi-Agent Phase Definitions

**co-consult follows the standard 7-phase workflow** defined in [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding -->.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|-----------------|-------------------|
| 0 | Project Initiation | Orchestrator | — (Engagement Leader only) |
| 1 | Research & Data Gathering | Observer | strategy-analyst, change-management-partner |
| 2 | Design Review & Approval | Gate Keeper | change-management-partner |
| 3 | Deliverable Creation | Coordinator | communications-lead, solutions-architect |
| 4 | Implementation & Delivery | Coordinator | technology-specialist, delivery-manager |
| 5 | QA & Finalization | Owner | — (Engagement Leader only) |
| 6 | PR & Handoff | Owner | — (Engagement Leader only) |

**PM Facilitation Guidance:**
See [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding --> for detailed PM tasks in each phase:
- Opening the phase (objective, specialist nomination, expectations)
- Progress monitoring (intervene only if standards not met)
- Synthesis of outputs (key findings, decisions)
- Provisional decision with justification
- Follow-up assignment

**Phase-Specific Notes for co-consult:**
- **Phase 1-2 (Planning)**: Change Management Partner contributes to organizational culture and transformation narrative strategy
- **Phase 3 (Design Handoff)**: Strategy Analyst conducts systematic investigation and data synthesis; Communications Lead and Solutions Architect transform research into deliverables; Delivery Manager manages stakeholder communication
- **Phase 4 (Execution)**: Communications Lead produces client-facing communications; Solutions Architect creates technical solution designs; Technology Specialist provides platform expertise for collaboration tools

---

## Agent Roster

### 🎯 Senior Leadership (High Tier)
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Engagement Leader** | [`agents/pm.md`](agents/pm.md) | High | Client interface, project direction, final decision-making, quality assurance |
| **Change Management Partner** | [`agents/change-management-partner.md`](agents/change-management-partner.md) | High | Organizational transformation, culture change, stakeholder alignment, executive coaching |

> **Note**: The Engagement Leader file is `agents/pm.md` for CLAUDE.md platform compatibility. `pm.md` and Engagement Leader refer to the same role. The `name:` field inside the file is set to `engagement-leader`.

### 📊 Strategy & Analysis (Medium Tier)
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Strategy Analyst** | [`agents/strategy-analyst.md`](agents/strategy-analyst.md) | Medium | Market analysis, competitive research, financial modeling, strategic assessment |
| **Industry Expert** | [`agents/industry-expert.md`](agents/industry-expert.md) | High | Industry-specific insights, competitive dynamics, regulatory landscape, trend analysis |
| **Subject Matter Expert** | [`agents/sme.md`](agents/sme.md) | Medium | Functional expertise (HR, Finance, Operations, Marketing), solution design, implementation guidance |

### 🏗️ Solutions & Delivery (Medium Tier)
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Communications Lead** | [`agents/communications-lead.md`](agents/communications-lead.md) | Medium | Client-facing communications, presentations, strategic narratives |
| **Solutions Architect** | [`agents/solutions-architect.md`](agents/solutions-architect.md) | Medium | Technical solution design, system architecture, implementation planning |
| **Workstream Lead** | [`agents/workstream-lead.md`](agents/workstream-lead.md) | Medium | Workstream management, team coordination, progress tracking, delivery quality |

### ⚙️ Operations & Support (Low Tier)
| Agent | File | Tier | Role |
|-------|------|------|------|
| **Delivery Manager** | [`agents/delivery-manager.md`](agents/delivery-manager.md) | Low | Project delivery, operations coordination, resource allocation, execution quality |
| **Technology Specialist** | [`agents/technology-specialist.md`](agents/technology-specialist.md) | Low | Collaboration platforms, workflow automation, digital transformation support |
| **Data Analyst** | [`agents/data-analyst.md`](agents/data-analyst.md) | Low | Statistical analysis, data modeling, visualization, business insights |

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
| **change-management-partner** | 1-2 | "Organizational transformation", "Stakeholder alignment", "Culture change", "Executive coaching" |
| **strategy-analyst** | 1, 3 | "Market analysis", "Competitive research", "Financial modeling", "Strategic assessment" |
| **industry-expert** | 1-2 | "Industry insights", "Competitive dynamics", "Regulatory landscape", "Trend analysis" |
| **sme** | 1-2 | "Functional expertise", "HR/Finance/Operations/Marketing guidance", "Solution design" |
| **communications-lead** | 3 | "Client-facing communications", "Presentation creation", "Strategic narratives" |
| **solutions-architect** | 3 | "Technical solution design", "System architecture", "Implementation planning" |
| **workstream-lead** | 3-4 | "Workstream management", "Team coordination", "Progress tracking" |
| **delivery-manager** | 4 | "Project delivery", "Operations coordination", "Resource allocation", "Execution quality" |
| **technology-specialist** | 4 | "Collaboration platforms", "Workflow automation", "Digital transformation support" |
| **data-analyst** | 1, 4 | "Statistical analysis", "Data modeling", "Visualization", "Business insights" |

**⚠️ IMPORTANT**: Do NOT invoke any specialist agent directly. All requests must go through PM (Engagement Leader).
 
 ---
 
### Superpowers Plugin & Cost Optimization (3-Tier Strategy)

The PM agent MUST leverage the **`superpowers`** plugin for harness engineering using a 3-tier model strategy to optimize cost and quality:

- **High-tier (Design/Plan)**: Used exclusively by the Engagement Leader/Change Management Partner for complex reasoning, architectural design, and writing precise sub-agent prompts.
- **Medium-tier (Review/QA)**: Used by Strategy Analyst or Communications Lead to review, synthesize, and perform quality gates. Acts as an independent supervisor.
- **Low-tier (Coding/Execute)**: Used by Delivery Manager/Technology Specialist for fast execution, simple repetitive tasks, or strictly scoped tasks.

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

---

## Skills

### Platform Skills (shared infrastructure)

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Research Analysis** | `.claude/skills/research-analysis/SKILL.md` | Analyzing topics, synthesizing research, evidence gathering |
| **Documentation Writing** | `.claude/skills/documentation-writing/SKILL.md` | Creating guides, drafting communications, synthesizing complex information |
| **Agent Lifecycle Manager** | `.claude/skills/agent-lifecycle-manager/SKILL.md` | Engagement Leader managing agent lifecycle and validation |

### Phase 1 — Research & Analysis Skills

| Skill | File | Owner | Trigger condition |
|-------|------|-------|-------------------|
| **Competitive Intelligence** | `skills/competitive-intelligence/SKILL.md` | strategy-analyst | Market/competitive analysis, industry assessment, market entry evaluation |
| **Financial Modeling** | `skills/financial-modeling/SKILL.md` | strategy-analyst | ROI analysis, NPV/IRR, business case, cost-benefit modeling |
| **Insight Synthesis** | `skills/insight-synthesis/SKILL.md` | strategy-analyst | Integrating multi-agent analysis outputs into unified strategic insight |
| **Stakeholder Alignment** | `skills/stakeholder-alignment/SKILL.md` | change-management-partner | Stakeholder mapping, resistance analysis, communication strategy |
| **Org Readiness Assessment** | `skills/org-readiness-assessment/SKILL.md` | change-management-partner | Organizational change capacity diagnosis, change management cost estimation |

### Phase 3 — Content Creation Skills

| Skill | File | Owner | Trigger condition |
|-------|------|-------|-------------------|
| **Change Impact Assessment** | `skills/change-impact-assessment/SKILL.md` | change-management-partner | Mapping change effects across organizational layers, roles, and processes |
| **Narrative Framework** | `skills/narrative-framework/SKILL.md` | communications-lead | Constructing persuasive story structures for client deliverables |
| **Consulting Report Writing** | `skills/consulting-report-writing/SKILL.md` | communications-lead | McKinsey/BCG-style report structure, MECE, recommendation framing |
| **Executive Presentation** | `skills/executive-presentation/SKILL.md` | communications-lead | C-level strategy decks, Pyramid Principle, one-page executive summaries |
| **Solution Design** | `skills/solution-design/SKILL.md` | solutions-architect | Technical solution architecture, options comparison, implementation roadmap |
| **Technical Feasibility** | `skills/technical-feasibility/SKILL.md` | solutions-architect | Implementation viability assessment, complexity grading, risk cost estimation |

### Phase 4 — Delivery Skills

| Skill | File | Owner | Trigger condition |
|-------|------|-------|-------------------|
| **Project Delivery** | `skills/project-delivery/SKILL.md` | delivery-manager | Execution planning, milestone tracking, risk/issue management |
| **Stakeholder Review Management** | `skills/stakeholder-review-management/SKILL.md` | delivery-manager | Feedback collection, review cycles, sign-off tracking |

---

## Maintenance Rule

When creating new agents, update AGENTS.md and docs/context.md § Agents to maintain consistency.

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:

- **Search Tool Prioritization**: Prioritize MCP semantic search tools (e.g., codegraph) for AST-aware insights over basic file search. Use standard grep as a fallback if MCP tools are unavailable.


