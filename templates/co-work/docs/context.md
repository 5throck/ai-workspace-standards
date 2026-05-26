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

<!-- DYNAMIC_SKILLS_START -->
| Skill path | Trigger condition |
|------------|-------------------|
| `.claude/skills/research-analysis/SKILL.md` | Analyzing topics, synthesizing research, evidence gathering |
| `.claude/skills/documentation-writing/SKILL.md` | Creating guides, drafting communications, synthesizing complex information |
| `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| `skills/agent-lifecycle-manager/SKILL.md` | PM managing agent lifecycle and validation |
| `skills/skill-lifecycle-manager/SKILL.md` | PM managing skill lifecycle and validation |
| `.claude/skills/api-documentation/SKILL.md` | Documenting REST APIs, GraphQL interfaces, SDKs, and developer-facing technical specifications |
<!-- DYNAMIC_SKILLS_END -->

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

### Asynchronous Collaboration Workflow Phases

| Phase | Name | What Happens | Primary Owner |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM forms collaboration team and establishes objectives | PM |
| 1 | Asynchronous Research & Discovery | Independent data gathering and fact-checking to build knowledge base | Analyst |
| 2 | Narrative Framework & Alignment | Draft core storyline and outline; obtain stakeholder alignment early | Storyteller |
| 3 | Collaborative Drafting | Parallel creation of engaging prose and technical docs via live co-authoring | Content Writer, Technical Writer |
| 4 | Iterative Stakeholder Review | Continuous, non-blocking feedback loops by SMEs directly in living docs | Project Coordinator, Tech Writer |
| 5 | Stylistic Polish & Finalization | Final formatting, brand voice refinement, and multimedia integration | Content Writer, Storyteller |
| 6 | Automated Publication | Push final artifacts to channels, archive source materials, notify stakeholders | MS365 Expert |

---

## Workspace Constitution Reference

All projects must read [`CONSTITUTION.md`](../../../CONSTITUTION.md) at session start, including the files listed in its `## Required Reading` block:
- `docs/constitution/05-multi-agent-architecture.md` — Agent architecture, 3-tier model, PM governance workflow
- `docs/constitution/08-coding-guidelines.md` — Behavioral guidelines for coding

For full lifecycle procedures:
- **Agent Lifecycle**: See `CONSTITUTION.md` → [§5.6 Agent Lifecycle Management](../../../CONSTITUTION.md#56-agent-lifecycle-management)
- **Skill Lifecycle**: See `CONSTITUTION.md` → [§6 Skill Lifecycle Management](../../../CONSTITUTION.md#6-skill-lifecycle-management)
- **Lifecycle procedures**: See `co-work.context.md § Agent & Skill Lifecycle Management`

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

---

## Documentation Standards

### Session Log Format (`memory/YYYY-MM-DD.md`)
Every session log entry MUST include the following four sections:

```markdown
## Session Summary
<!-- One paragraph: what was accomplished this session -->

## Changes
<!-- File-level list of what was created, modified, or deleted -->
- `path/to/file` — created: reason
- `path/to/file` — modified: what changed and why
- `path/to/file` — deleted: reason

## Decisions
<!-- Architectural or design choices made, with rationale -->
- Decision: why this approach was chosen over alternatives

## Open Issues
<!-- Unresolved problems, blockers, or follow-up items -->
- Issue: symptom → root cause → resolution (or "pending")
```

> All AI tools (Claude Code, Claude App, Antigravity, Antigravity CLI) MUST produce session logs with these exact four section headings for cross-tool consistency.

### CHANGELOG Entry Format (`CHANGELOG.md`)
Every entry under `[Unreleased]` MUST include a PR reference:
```markdown
## [Unreleased]
### Added
- Short description of change (#PR-number)
```
