---
sync_version: 1
content_hash: 57b9c9c5107cbe394519f980f89661d285488ee63e69b109ab4a34a422657837
---

# co-game

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> Game development variant for HTML5 Canvas games using Vanilla TypeScript. Specialized agents for game design, arcade/puzzle genres, visual art, sound, engine implementation, debugging, and testing.

## Overview

Game development variant for HTML5 Canvas games using Vanilla TypeScript. Specialized agents for game design, arcade/puzzle genres, visual art, sound, engine implementation, debugging, and testing. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Game development variant for HTML5 Canvas games using Vanilla TypeScript. Specialized agents for game design, arcade/puzzle genres, visual art, sound, engine implementation, debugging, and testing.

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **architect** | Design agent — produces implementation plans and technical specs. | high | inherit |
| **game-designer** | Universal game design agent — core loop, difficulty curves, rewards. | high | inherit |
| **arcade-designer** | Arcade specialist — entity AI, wave/stage systems, scoring, items. | high | inherit |
| **puzzle-designer** | Puzzle/board specialist — matching logic, turn systems, difficulty. | high | inherit |
| **designer** | UI/UX design agent — wireframes, component specs, design tokens. | medium | inherit |
| **game-developer** | Game implementation — Canvas engine, game loop, collision, entities. | low | inherit |
| **visual-artist** | Visual asset specs — sprites, animation frames, tile/board visuals. | medium | inherit |
| **sound-designer** | Procedural audio design — SFX, BGM loops, Web Audio effect chains. | medium | inherit |
| **game-debugger** | Game debugger — root-causes bugs, proposes fixes, repro tests. | medium | inherit |
| **test-runner** | QA and verification — runs tests, validates acceptance criteria. | medium | inherit |
| **security-monitor** | Security monitor — scans vulnerabilities, advisories, secret leaks. | medium | inherit |
| **stack-setup** | Stack setup — environment config, build setup, stack recovery. | low | inherit |

## Skills

- **code-review**: Conducts thorough code reviews focusing on correctness, maintainability, security, and best practices.
- **refactoring**: Improves code structure and design while preserving behavior using systematic refactoring techniques.
- **test-driven-development**: Implements software using Test-Driven Development (TDD) methodology with red-green-refactor cycle.
- **sound-synth**: Procedural 8-bit retro sound effect and audio synthesis rules using Web Audio API and jsfxr parameter specifications for games and interactive web apps.

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

**Type**: game

This variant focuses on HTML5 Canvas game development using Vanilla TypeScript with genre-specialized design agents.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/3 (see variant governance rules)
- **Beta Duration**: 0/3 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-08-09*
