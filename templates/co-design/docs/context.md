# [Project Name] - Design Context

> **Design-focused project context** - This template variant is for design-first projects where user experience, visual design, and design systems are the primary deliverables.

## Design Philosophy

| Principle | Description |
|-----------|-------------|
| **User-Centered** | All design decisions start from user needs and validated through research |
| **Accessible by Default** | WCAG AA compliance is a baseline, not an add-on |
| **System-Thinking** | Every design decision considers the broader design system |
| **Iterative Validation** | Designs are validated through prototypes and user feedback |

## Design System

| Layer | Technology / Standard |
|-------|----------------------|
| **Design Tokens** | Figma Variables / CSS Custom Properties |
| **Component Library** | Custom / shadcn/ui / Material Design |
| **Prototyping Tool** | Figma / Framer / Principle |
| **Handoff Format** | Figma Dev Mode / Zeplin / Storybook |

## Agents

| Group | Agent file | Role |
|-------|------------|------|
| Orchestration | `agents/pm.md` | Design PM - orchestrates design workflow |
| Research & Strategy | `agents/ux-researcher.md` | UX Researcher - user research and insights |
| Research & Strategy | `agents/design-lead.md` | Design Lead - design direction and system architecture |
| Visual & Interface | `agents/visual-designer.md` | Visual Designer - visual designs and specifications |
| Prototyping & Handoff | `agents/prototype-engineer.md` | Prototype Engineer - interactive prototypes |

## Skills

| Skill path | Trigger condition |
|------------|-------------------|
| `.claude/skills/ui-ux-design-intelligence/SKILL.md` | Building design systems, creating visual designs, UI components, or design specifications |
| `skills/agent-lifecycle-manager/SKILL.md` | Design PM managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| `skills/skill-lifecycle-manager/SKILL.md` | Design PM managing skill lifecycle after agent configuration changes |
| `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| `.claude/skills/service-design/SKILL.md` | Designing end-to-end service experiences, customer journeys, and operational processes |

## Multi-Agent Design Workflow

This project uses a **Design PM-first multi-agent architecture**. All design work flows through the Design PM orchestrator.

**The Design PM agent (`agents/pm.md`) is the ONLY interface for ALL design requests.**

```
┌──────────────┐
│ Design Brief │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Design PM    │ → Classify, dispatch, synthesize, execute
└──────┬───────┘
       │
       ├─▶[Research tasks]   → UX Researcher (parallel)
       ├─▶[Strategy tasks]   → Design Lead (parallel)
       ├─▶[Visual tasks]     → Visual Designer → Prototype Engineer
       └─▶[System tasks]     → Design Lead → Visual Designer
```

### Design Workflow Phases

| Phase | Name | What Happens |
|-------|------|--------------|
| 0 | Team Assembly | Design PM assesses project needs; creates specialized design agents/skills |
| 1 | Research & Discovery | UX Researcher conducts research; Design Lead analyzes constraints (parallel) |
| 2 | Design Direction | Design Lead establishes creative direction and design system approach |
| 3 | Design Execution | Visual Designer creates designs; Prototype Engineer builds prototype |
| 4 | Design Review | Validate system consistency, accessibility, and UX coherence |
| 5 | Handoff | Create handoff package; log decisions; run `/sync` |

> **Full details:** See [`AGENTS.md`](../AGENTS.md) for complete workflow, agent roster, and dispatch protocols.

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/context.md` | This file - design project single source of truth |
| `AGENTS.md` | Canonical design agent index |
| `agents/pm.md` | Design PM orchestrator - workflow owner |
| `scripts/dev-sync.sh` | Full sync pipeline |

---

## Design Guidelines

### 1. Research-Driven Design
- Start every design project with research or existing insights.
- Document user needs, pain points, and goals before designing.
- Validate assumptions through prototypes or user testing when possible.

### 2. Design System Thinking
- Every design decision should consider the broader design system.
- Document new patterns or tokens before using them in designs.
- Reuse existing components before creating new ones.

### 3. Accessibility First
- Design for accessibility from the start, not as a retrofit.
- WCAG AA is the minimum bar—aim higher when feasible.
- Test keyboard navigation and screen reader experience.

### 4. Iterative Validation
- Create prototypes to validate design decisions before finalizing.
- Test with real users when possible—even informal tests help.
- Be prepared to iterate based on feedback.

### 5. Clear Communication
- Use visual artifacts (wireframes, mockups) to communicate design intent.
- Explain design rationale, not just visual choices.
- Document constraints and trade-offs explicitly.

---

## Response Language

- All **conversational** replies to the user → **Korean** by default.
- All design documentation, file names, commit messages, PR titles, **PR bodies**, branch names, **CHANGELOG.md**, and **memory/` logs → **English only**.
