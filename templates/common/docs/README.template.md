---
sync_version: 1
---

# {{VARIANT_NAME}}

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: {{STATUS_LINE}}
> {{TAGLINE}}

## Overview

{{NARRATIVE_OVERVIEW}}

## Quick Start

{{QUICK_START_BODY}}

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

{{NARRATIVE_MISSION}}

## Meet the AI Team

{{TEAM_INTRO_PROSE}}

| Agent | Role | Tier | Model |
|-------|------|------|-------|
{{AGENT_ROSTER_ROWS}}

## Skills

{{SKILLS_BLOCK}}

## How to Collaborate

{{NARRATIVE_HOWTO_INTRO}}

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

{{NARRATIVE_WORKFLOW_PHASES}}

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: {{VARIANT_TYPE}}

This variant focuses on {{VARIANT_TYPE_DESCRIPTION}}.

{{BETA_STATUS_BLOCK}}

---

*Last Updated: {{LAST_UPDATED}}*
