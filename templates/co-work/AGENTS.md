# AGENTS.md - Co-Work Variant

> **Canonical agent index** for collaboration-focused projects.

---

## Multi-Agent Phase Definitions

**co-work follows the standard 7-phase workflow** defined in [`phase-definitions.md`](docs/phase-definitions.md) <!-- path resolves post-scaffolding -->.

**Phase Summary:**
| Phase | Name | PM Facilitation | Specialist Agents |
|-------|------|------------------|-------------------|
| 0 | Project Initiation | Orchestrator | scaffolding-expert |
| 1-2 | Planning & Architecture | Orchestrator | architect |
| 3 | Design Handoff | Orchestrator | analyst (content research, data gathering) |
| 4 | Execution | Orchestrator | automation-engineer, docs-writer |
| 5 | Quality Assurance | Orchestrator | security-expert, auditor |
| 6 | Lifecycle Finalization | Orchestrator | PM |

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


