# AGENTS.md - Co-Work Variant

> **Canonical agent index** for collaboration-focused projects.

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

## Collaboration Workflow (7 Phases)

| Phase | Name | Lead Agent |
|-------|------|------------|
| 0 | Team Assembly | PM |
| 1 | Research & Analysis | Analyst |
| 2 | Strategy Validation | PM |
| 3 | Content Creation | Content Writer |
| 4 | Coordination | Project Coordinator |
| 5 | Final Review | All |
| 6 | Publication | PM |

---

## Skills

| Skill | File | Trigger condition |
|-------|------|-------------------|
| **Research Analysis** | `.claude/skills/research-analysis/SKILL.md` | Analyzing topics, synthesizing research, evidence gathering |
| **Documentation Writing** | `.claude/skills/documentation-writing/SKILL.md` | Creating guides, drafting communications, synthesizing complex information |
| **Meeting Facilitation** | `../common/skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| **Skill Lifecycle Manager** | `../common/skills/skill-lifecycle-manager/SKILL.md` | PM managing skill lifecycle and validation |
| **API Documentation** | `.claude/skills/api-documentation/SKILL.md` | Documenting REST APIs, GraphQL interfaces, SDKs, and developer-facing technical specifications |

---

## Maintenance Rule

When creating new agents, update AGENTS.md and docs/context.md § Agents to maintain consistency.
