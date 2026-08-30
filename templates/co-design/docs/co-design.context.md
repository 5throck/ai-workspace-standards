# [Project Name] —co-design Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE —all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md             —immutable project identity (architecture, standards)
>   2. docs/co-design.context.md   —THIS FILE —design stack, agents, skills, workflow

---

## Design Stack

| Layer | Technology / Standard |
|-------|----------------------|
| **Design Tokens** | [e.g., Figma Variables / CSS Custom Properties] |
| **Component Library** | [e.g., Custom / shadcn/ui / Material Design] |
| **Prototyping Tool** | [e.g., Figma / Framer / Principle] |
| **Handoff Format** | [e.g., Figma Dev Mode / Zeplin / Storybook] |
| **Research Tools** | [e.g., Maze, UserTesting, Hotjar] |

---

## Agents

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

| Agent | File | Role | Status |
|-------|------|------|--------|
| Design PM (Orchestrator) | `agents/pm.md` | Design workflow management, dispatch, quality gates | active |
| UX Researcher | `agents/ux-researcher.md` | User research and insights | active |
| Design Lead | `agents/design-lead.md` | Design direction and system architecture | active |
| Visual Designer | `agents/visual-designer.md` | Visual designs and specifications | active |
| Prototype Engineer | `agents/prototype-engineer.md` | Interactive prototypes and handoff | active |
| Storyteller | `agents/storyteller.md` | Narrative and user journey definition | active |
| Typography Expert | `agents/typography-expert.md` | Type hierarchy and font systems | active |
| Service Designer | `agents/service-designer.md` | End-to-end service experience design | active |

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.

---

## Skills

<!-- Add/remove rows as skills are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

<!-- DYNAMIC_SKILLS_START -->
<!-- DYNAMIC_SKILLS_END -->

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`

> **Lifecycle procedures**: See `templates/common/docs/context.md § Lifecycle Management`

---

## Development Workflow

```
Design brief received
  —
/sync "feat: description"
  —
  1. audit.ts —abort on failure
  2. memory/YYYY-MM-DD.md —session log (4-section format)
  3. MEMORY.md index update
  4. git add -A —commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (co-design standard)

```
Design PM
  —UX Researcher + Design Lead (parallel —research + strategy)
  —Visual Designer —Prototype Engineer (sequential —design + prototype)
  —UX Researcher (validation loop —continuous)
  —Design Lead + Visual Designer (system refinement + handoff)
```

### Workflow Phases

| Phase | Name | What Happens | Lead Agent(s) |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM creates specialized design agents/skills | Design PM |
| 1 | Narrative & Ecosystem Mapping | Core user story, service touchpoints, problem space | Storyteller, UX Researcher |
| 2 | Foundational Exploration | Typographic hierarchy, visual mood boards, layout frameworks | Typography Expert, Visual Designer |
| 3 | Rapid Prototyping Loops | Continuous build/test low-fi —high-fi prototypes | Prototype Engineer, Design Lead |
| 4 | Continuous Validation | Parallel user testing and a11y validation | UX Researcher, Design Lead |
| 5 | System Refinement & Handoff | Polish, finalize design system, dev handoff | Visual Designer, Prototype Engineer |

> Phases 3 and 4 operate as a continuous loop rather than sequential steps.

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Design Guidelines
<!-- intentional-duplicate: workspace standards §8 — maintained locally for AI context proximity; source: docs/constitution/08-coding-guidelines.md; hash: d03bef2a -->

### Core Principles

1. **User-centered** — all design decisions grounded in user needs and research.
2. **Consistency first** — follow the established design system; document exceptions.
3. **Accessibility** — WCAG 2.1 AA compliance required for all UI components.
4. **Simplicity** — prefer fewer, well-considered decisions over complex solutions.
5. **PR required** — all design changes via `/sync`; never direct push to main.

### Design System

Maintain component library consistency: reuse existing components before creating new ones. Document new components in `docs/specs/` (see Recommended Folder Structure below). Component-to-token bindings are defined in `docs/component-primitives.md`; token values live in `tokens.json` (SSOT).

### Hybrid Scripting

All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).
<!-- END VARIANT-INJECT -->

---

## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See `docs/context.md` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.

---


## File Organization Policy

### Recommended Folder Structure (co-design)
| Folder | Purpose |
|--------|---------|
| `docs/designs/` | Design decisions and rationale |
| `docs/specs/` | UI/UX specifications |
| `docs/prototypes/` | Prototype documentation |
| `memory/` | Session logs, design review transcripts |

---

## Domain Rules

<!-- co-design variant specific rules —edit after project creation -->
1. Design tokens must be documented before implementation.
2. All new components require design system review from Design Lead. **[DESIGN-R1]**
3. User testing findings must be logged to memory/ before design decisions are finalized.
4. Theme presets (`tokens.json` → `themes`) override color and shadow tokens only — layout tokens (typography, spacing, borderRadius) are theme-invariant. Adding or changing a theme preset requires visual-designer approval, same as the base palette. **[DESIGN-R2]**

---

<!-- COMMON-CONTEXT:START -->
This project follows the workspace coding standards defined in the project's Coding Guidelines section.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->

---

*co-design.context.md version: 1.2 — theme-preset rule [DESIGN-R2] added, [DESIGN-R1] restored on Rule 2 (2026-08-25); previous: 1.1 normalized to canonical template structure*
