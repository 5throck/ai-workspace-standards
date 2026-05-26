# [Project Name] - Collaboration Context

> **Collaboration-focused project context** - This template variant is for research, documentation, and cross-functional coordination projects.

## Collaboration Philosophy

| Principle | Description |
|-----------|-------------|
| **Research-Driven** | All decisions start from evidence and validated through analysis |
| **Clear Communication** | Complex information synthesized for diverse audiences |
| **Stakeholder Alignment** | Inclusive communication and structured review processes |
| **Knowledge Management** | Organized archives and documentation standards |

## Tool Stack

| Purpose | Tool |
|---------|-------|
| **Research** | Perplexity, Google Scholar, Zotero |
| **Documentation** | Notion, Google Docs, Markdown |
| **Coordination** | Calendly, Slack, Email |
| **Version Control** | Git + LFS for design assets |

## Agents

| Group | Agent file | Role |
|-------|------------|------|
| Orchestration | `agents/pm.md` | Collaboration PM - orchestrates research workflow |
| Research & Analysis | `agents/analyst.md` | Research Analyst - research and data analysis |
| Documentation | `agents/content-writer.md` | Content Writer - documentation and communication |
| Coordination | `agents/project-coordinator.md` | Project Coordinator - schedule and stakeholder management |

## Skills

| Skill path | Trigger condition |
|------------|-------------------|
| `.claude/skills/research-analysis/SKILL.md` | Analyzing topics, synthesizing research, evidence gathering |
| `.claude/skills/documentation-writing/SKILL.md` | Creating guides, drafting communications, synthesizing complex information |
| `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| `skills/agent-lifecycle-manager/SKILL.md` | PM managing agent lifecycle and validation |
| `skills/skill-lifecycle-manager/SKILL.md` | PM managing skill lifecycle and validation |
| `.claude/skills/api-documentation/SKILL.md` | Documenting REST APIs, GraphQL interfaces, SDKs, and developer-facing technical specifications |

## Multi-Agent Collaboration Workflow

This project uses a **Collaboration PM-first multi-agent architecture**. All collaboration work flows through the Collaboration PM orchestrator.

**The Collaboration PM agent (`agents/pm.md`) is the ONLY interface for ALL collaboration requests.**

```
┌──────────────┐
│ Brief / Task │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Collaboration PM    │ → Classify, dispatch, synthesize
└──────┬───────┘
       │
       ├─▶[Research]   → Analyst
       ├─▶[Content]    → Content Writer
       └─▶[Coord]      → Project Coordinator
```

### Collaboration Workflow Phases

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

## Key Files

| File | Purpose |
|------|---------|
| `docs/context.md` | This file - collaboration project context |
| `AGENTS.md` | Canonical collaboration agent index |
| `agents/pm.md` | Collaboration PM orchestrator |
| `scripts/dev-sync.sh` | Full sync pipeline |

---

## Collaboration Guidelines

### 1. Research-First Approach
- Start every project with research or existing insights
- Document user needs and goals before creating content
- Validate assumptions through analysis when possible

### 2. Clear Communication
- Use plain language and define jargon
- Explain rationale, not just conclusions
- Use consistent terminology

### 3. Stakeholder Inclusion
- Ensure all relevant parties are consulted at appropriate gates
- Document decisions and open questions
- Maintain organized archives

---

## Response Language

- All **conversational** replies → **Korean** by default
- All documentation, file names, commit messages, PR titles, **PR bodies**, branch names, **CHANGELOG.md**, and **memory/` logs → **English only**
