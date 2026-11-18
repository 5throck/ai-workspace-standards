---
sync_version: 1
content_hash: 215c1ac7a9da5ff474000f68717ea2aa87f77c4f3b3e651560c1b7b85084da04
---

# co-utility

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> Standalone utility/tool application workflow — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits. Doctrine derived from the QuickDL engagement (2026-11).

## Overview

Standalone utility/tool application workflow — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits. Doctrine derived from the QuickDL engagement (2026-11).. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

> **Design Gate (ADR-0074)**: code changes must ship with a spec — create `docs/designs/<spec-id>-design.md`, register it (`bun scripts/spec-register.ts --file <design-doc> --source manual`), then `/sync`. The sync-time spec-check blocks undocumented code changes; trivial changes can use `--spec-exempt=E1..E5`.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Standalone utility/tool application workflow — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits. Doctrine derived from the QuickDL engagement (2026-11).

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **qa** | QA Engineer — writes and maintains tests, validates cross-platform behavior | medium | inherit |
| **backend** | Backend Developer — implements Flask routes, download logic, and CLI/installer | high | inherit |
| **frontend** | Frontend Developer — implements JS logic, API wiring, and i18n in templates | medium | inherit |
| **security** | Security Officer — read-only audit of all Python source files | high | inherit |
| **i18n-specialist** | Owns locale configuration, locale-specific formatting, and text layout guidance | medium | inherit |

## Skills

- **post-write-check**: 

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
6. **Finalization:** The PM logs decisions and dispatches `/sync` to `automation-engineer`, which commits and opens the PR; the PM then verifies the landing.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `meeting-facilitation` — Run a structured, inline multi-agent discussion (skill; the legacy `/meeting` slash command is retired).

## Variant Type

**Type**: utility

This variant focuses on Standalone utility/tool applications — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/2 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-11-19*
