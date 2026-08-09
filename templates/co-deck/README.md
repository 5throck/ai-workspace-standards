---
sync_version: 1
content_hash: 1fbfe4537ac4be94c4a9bb8542ba33328d841cc92c8360417089cf35ac3f516c
---

# co-deck

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.2.0
> Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF, plus an independent H-Stage handbook pipeline. Includes 13 agents (1 PM orchestrator + 10 slide-pipeline specialists + 2 handbook specialists) covering research, source verification, content, design, image curation, diagram/chart generation, HTML build (5 themes), layout measurement, PDF export, and handbook authoring/review.

## Overview

Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF, plus an independent H-Stage handbook pipeline. Includes 13 agents (1 PM orchestrator + 10 slide-pipeline specialists + 2 handbook specialists) covering research, source verification, content, design, image curation, diagram/chart generation, HTML build (5 themes), layout measurement, PDF export, and handbook authoring/review. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF, plus an independent H-Stage handbook pipeline. Includes 13 agents (1 PM orchestrator + 10 slide-pipeline specialists + 2 handbook specialists) covering research, source verification, content, design, image curation, diagram/chart generation, HTML build (5 themes), layout measurement, PDF export, and handbook authoring/review.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **version** | Version snapshots before any edit; restores prior states on demand | low | inherit |
| **research** | Gathers web sources and organizes content for storyline design | medium | inherit |
| **source-verifier** | Validates research URLs; produces source-verification.md + Trust Score | medium | inherit |
| **storyline** | Writes storyline.md and slide_deck.md with per-slide content | medium | inherit |
| **design** | Locks color palette, fonts, and layout into design_spec.md | medium | inherit |
| **image-curator** | Searches and downloads license-clear images for each slide | medium | inherit |
| **diagram-specialist** | Generates SVG concept diagrams and data charts from visual_spec | medium | inherit |
| **html-build** | Generates lecture HTML from slide_deck.md and design_spec.md | medium | inherit |
| **measure** | Validates 4-layer spec merge and prepares PDF layout (Playwright-free) | medium | inherit |
| **pdf-export** | Generates sample and full PDF from slidedata via pdf-lib | medium | inherit |
| **handbook-writer** | Writes handbook chapters, course overview, and instructor guide | medium | inherit |
| **handbook-reviewer** | Quality gate — runs validation scripts and applies fixes | medium | inherit |

## Skills

- **version**: Manages version snapshots of lecture files. Auto-backs up files before edits and restores prior versions on demand.
- **research**: Source collection and ideation for lecture materials. Confirms topic/audience, performs web research, writes research_notes.md.
- **storyline**: Designs lecture storyline and slide deck composition. Produces storyline.md and slide_deck.md.
- **design**: Locks visual design style. Decides layout, color palette, font family and saves design_spec.md.
- **html-build**: Generates HTML slides from slide_deck.md and design_spec.md. Applies theme, binds images, inserts special pages.
- **measure**: Auto-measures HTML slides with Playwright to extract coordinates for PDF generation. Deprecated — superseded by prep-pdf.
- **prep-pdf**: Playwright-free PDF preparation. Resolves the 4-layer spec merge, validates fonts, outputs a layout summary.
- **pdf-export**: Generates PDF from slide data using pdf-lib. Extracts slidedata, runs sample then full PDF generation.
- **theme-authoring**: Entry point for creating a new co-deck theme or style. Dispatches Style Workflow or T-Stage.
- **handbook**: Document production workflow — generates searchable, themed handbooks as static sites. H-Stage pipeline (H-0 through H-7).
- **presenter-mode**: Dual-window presenter state synchronization using browser BroadcastChannel API.

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

**Type**: lecture

This variant focuses on lecture and presentation material production — from research to print-ready PDF, plus themed handbooks as static sites.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-08-09*
