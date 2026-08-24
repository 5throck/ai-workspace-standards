---
sync_version: 1
content_hash: 690f6389e85f79832c6473bf249a4f32c8fd5426ed757c2a6dcf84b961e1d810
---

# co-design

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ✅ Stable — v1.0.0
> Design and UX workflow variant for UI/UX design, design systems, prototyping, and design handoff. Includes specialized design agents covering visual design, service design, UX research, and prototyping.

## Overview

Welcome to the **co-design** workspace—your dedicated AI specialized UI/UX design agent team. Optimized for collaborative work with Claude and Gemini AI assistants, this template gives you a full team of specialized AI agents ready to support your projects from day one. See `docs/co-design.context.md` for full architecture and standards.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** To provide a comprehensive, multi-agent UI/UX design partnership.

We are designed to reduce context overload by delegating specific phases of work to specialized agents. Instead of chatting with a single omniscient AI, you act as the user or team lead collaborating with a full product team. Our goal is to handle the research, prototyping, and visual design while you guide the vision.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **design-lead** | Design system architect — visual language, tokens, and component architecture | high | inherit |
| **prototype-engineer** | Interactive prototyping specialist — builds functional prototypes for testing | medium | inherit |
| **service-designer** | Service designer — end-to-end service experiences, journeys, and blueprints | medium | inherit |
| **storyteller** | Brand narrative lead — design principles, brand voice, and pattern consistency audits | medium | inherit |
| **typography-expert** | Typography expert — font selection, type systems, and visual hierarchy | medium | inherit |
| **ux-researcher** | User research specialist — interviews, usability testing, and synthesis | medium | inherit |
| **visual-designer** | Visual design execution — UI designs, mockups, and specifications | medium | inherit |

## Skills

- **accessibility-audit**: Defines automated WCAG 2.1 Level AA accessibility evaluation rules, DOM audit patterns, and remediation guidance using axe-core for UI components, templates, and web applications.
- **service-design**: Designs end-to-end service experiences including customer journeys, service blueprints, and operational processes. Use when: mapping customer experiences, optimizing touchpoints, aligning frontstage and backstage operations, or improving service delivery.
- **ui-ux-design-intelligence**: Provides comprehensive UI/UX design capabilities including design system creation, component design, visual hierarchy, and user-centered design principles. Use when: building design systems, creating visual designs, designing UI components, or establishing design specifications.

See [docs/user-guide.md](docs/user-guide.md) for a practical, task-oriented walkthrough of when to use each agent and skill, the workflow phases, and where deliverables are saved.

### Design Tokens & Playground

- **`tokens.json`** — the design-token SSOT (color, typography, spacing, borderRadius, shadow), compiled by `scripts/compile-tokens.ts` into CSS custom properties and typed TS constants.
- **`playground/`** — a minimal Vite dev server wired to the compiled tokens for live preview during design phases. See [playground/README.md](playground/README.md) for quickstart and the token wiring diagram; runs inside a scaffolded co-design project.

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Discovery & Research:** The PM brings in the **ux-researcher** to gather insights.
2. **Design Strategy:** The **design-lead** defines the creative direction and design system.
3. **Creation:** The **visual-designer** and **service-designer** build out components and journeys.
4. **Prototyping:** The **prototype-engineer** creates interactive handoff materials.
5. **Review & Sync:** We use `/sync "commit message"` to safely commit and open a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: design

This variant focuses on UI/UX design, design systems, prototyping, and design handoff with specialized agents for visual design, service design, UX research, and prototyping.

---

*Last Updated: 2026-08-24*
