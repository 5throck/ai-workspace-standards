---
sync_version: 1
content_hash: 3fff3bfdcf5fc24037f6e7fe74f8f553eada8ac8aa3f09213665420aefe52cfe
---

# co-architect

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> Architecture firm collaboration variant integrating design (UI/UX, service design, prototyping), research (analysis, content), project coordination (scheduling, acquisition), and engineering (SketchUp, ZWCAD) into a unified 5-team workspace with 6 named workflows.

## Overview

Architecture firm collaboration variant integrating design (UI/UX, service design, prototyping), research (analysis, content), project coordination (scheduling, acquisition), and engineering (SketchUp, ZWCAD) into a unified 5-team workspace with 6 named workflows.. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

> **Design Gate (ADR-0074)**: code changes must ship with a spec — create `docs/designs/<spec-id>-design.md`, register it (`bun scripts/spec-register.ts --file <design-doc> --source manual`), then `/sync`. The sync-time spec-check blocks undocumented code changes; trivial changes can use `--spec-exempt=E1..E5`.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Architecture firm collaboration variant integrating design (UI/UX, service design, prototyping), research (analysis, content), project coordination (scheduling, acquisition), and engineering (SketchUp, ZWCAD) into a unified 5-team workspace with 6 named workflows.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **pm** | Project Manager (PM) — cross-team orchestrator; routes to Design / Research / Project / Engineering team leads at Phase 0 | medium | inherit |
| **technical-writer** | Technical writer - creates API documentation, technical guides, and developer re | medium | inherit |
| **design-lead** | Design system architect - defines visual language, design tokens, and component  | high | inherit |
| **automation-engineer** | Implements approved technical plans for co-architect's software/platform layer — | medium | inherit |
| **zwcad-drafter** | ZWCAD technical drawing specialist | medium | inherit |
| **content-writer** | Content writer - transforms research into clear, accessible documentation and co | medium | inherit |
| **architect** | Produces implementation plans and design docs for co-architect's software/platfo | high | inherit |
| **analyst** | Research analyst - conducts systematic investigation, data synthesis, and eviden | medium | inherit |
| **project-coordinator** | Project coordinator - manages schedules, stakeholder communication, and delivery | low | inherit |
| **mep-engineer** | Mechanical, Electrical, Plumbing (MEP) and building services specialist | medium | inherit |
| **drafting-architect** | Architectural drafting standards lead and detail drawing specialist | medium | inherit |
| **design-storyteller** | Design storyteller - provides philosophical foundation, meaning, and narrative c | medium | inherit |
| **sketchup-modeler** | Engineering Team lead and 3D architectural modeling specialist | medium | inherit |
| **ux-researcher** | User research specialist - conducts user interviews, usability testing, and rese | medium | inherit |
| **bylaw-expert** | Building code, zoning ordinance, and regulatory compliance specialist | medium | inherit |
| **typography-expert** | Typography expert - specializes in font selection, type systems, and visual hier | medium | inherit |
| **visualization-expert** | Architectural 3D rendering and visual presentation specialist | medium | inherit |
| **storyteller** | Organizational storyteller - shapes organizational culture, manages change narra | medium | inherit |
| **prototype-engineer** | Interactive prototyping specialist - creates functional prototypes for testing a | medium | inherit |
| **interior-designer** | Interior architecture, space planning, and finish material specialist | medium | inherit |
| **visual-designer** | Visual design execution - creates UI designs, mockups, and design specifications | medium | inherit |
| **structural-engineer** | Structural engineering and load-bearing system specialist | medium | inherit |
| **ms365-expert** | Microsoft 365 expert - provides guidance on Outlook, Word, Excel, PowerPoint, Sh | low | inherit |
| **service-designer** | Service designer - designs end-to-end service experiences, customer journeys, an | medium | inherit |

## Skills

- **zwcad-ai-drawing**: 
- **script-lifecycle-manager**: 
- **explain-me**: 
- **team-builder**: 
- **zod-contract-gate**: 
- **service-design**: 
- **source-command-commit-push-pr**: 
- **skill-lifecycle-manager**: 
- **ci-triage**: 
- **i18n-formatting**: 
- **project-review**: 
- **translate**: 
- **standup-synthesizer**: 
- **platform-command-lifecycle-manager**: 
- **token-usage-lint**: 
- **cad-svg-preview**: 
- **gateguard**: 
- **finishing-a-development-branch**: 
- **i18n-audit**: 
- **api-documentation**: 
- **handbook**: 
- **i18n-locale-config**: 
- **security-scan**: 
- **decision-record**: 
- **handbook-sync-audit**: 
- **meeting-facilitation**: 
- **platform-skill-lifecycle-manager**: 
- **research-analysis**: 
- **accessibility-audit**: 
- **design-foundation**: 
- **agent-lifecycle-manager**: 
- **ui-ux-design-intelligence**: 
- **update-bun-packages**: 
- **sync**: 
- **cad-space-recognition**: 
- **documentation-writing**: 
- **i18n-layout**: 
- **cad-server-manager**: 
- **evidence-ledger**: 
- **generate-room-elevation**: 

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Team Assembly:** The PM creates specialized agents/skills if required.
2. **Triage:** The PM classifies the request; dispatches read-only agents in parallel.
3. **Analysis:** The PM synthesizes findings into requirements + acceptance criteria.
4. **Design:** An architect produces an implementation plan + ADR.
5. **Implementation:** Specialists implement; the PM loops up to 3× on failures.
6. **Finalization:** The PM logs decisions; runs `/sync`; opens a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: collaboration

This variant focuses on General work, research, documentation, and project coordination.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-11-02*
