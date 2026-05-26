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

<!-- DYNAMIC_SKILLS_START -->
| Skill path | Trigger condition |
|------------|-------------------|
| `.claude/skills/ui-ux-design-intelligence/SKILL.md` | Building design systems, creating visual designs, UI components, or design specifications |
| `skills/agent-lifecycle-manager/SKILL.md` | Design PM managing agent lifecycle; creating new agents, updating frontmatter, validating agent status and tiers |
| `skills/skill-lifecycle-manager/SKILL.md` | Design PM managing skill lifecycle after agent configuration changes |
| `skills/meeting-facilitation/SKILL.md` | Running structured multi-agent meetings for collaborative decision-making |
| `.claude/skills/service-design/SKILL.md` | Designing end-to-end service experiences, customer journeys, and operational processes |
<!-- DYNAMIC_SKILLS_END -->

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

### Iterative Design-Native Workflow Phases

| Phase | Name | What Happens | Lead Agent(s) |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM analyzes project needs; creates specialized design agents/skills | Design PM |
| 1 | Narrative & Ecosystem Mapping | Establish core user story, map service touchpoints, define problem space | Storyteller, UX Researcher |
| 2 | Foundational Exploration | Establish typographic hierarchy, visual mood boards, and layout frameworks | Typography Expert, Visual Designer |
| 3 | Rapid Prototyping Loops | Continuous build/test of low-fi to high-fi interactive models | Prototype Engineer, Design Lead |
| 4 | Continuous Validation | Parallel user testing and a11y validation integrated with prototyping loops | UX Researcher, Design Lead |
| 5 | System Refinement & Handoff | Polish visuals, finalize design system, prepare dev handoff, log decisions | Visual Designer, Prototype Eng |

> **Note:** Phases 3 and 4 operate as a continuous "figure-eight" loop rather than sequential steps.

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
