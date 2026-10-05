---
sync_version: 1
content_hash: e58a04a72c3426cfbc1086a81f4ee6e820a21723843ddc7f4abca59af4ea58b9
---

# co-develop

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ✅ Stable — v1.0.0
> Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization)

## Overview

Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization). See `AGENTS.md` for the agent ecosystem and governance; `docs/context.md` (architecture and standards) is inherited from `templates/common` at project creation.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### Shipped instruction files:

- `AGENTS.md` — agent ecosystem, PM Gateway workflow, and dispatch rules (all platforms).
- `HERMES.md` — Hermes Agents instruction map.

(`CLAUDE.md` / `GEMINI.md` are delivered from `templates/common` at project creation.)

## Team Mission

**Mission:** Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization)

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | Medium | inherit |
| **architect** | Design agent - produces implementation plans and technical specs | high | inherit |
| **code-writer** | Implementation agent - writes code from an approved plan | low | inherit |
| **designer** | UI/UX design agent - produces wireframes, component specs, and design tokens | medium | inherit |
| **i18n-specialist** | Localization review, locale config, and translation-sync for locale mirrors (common extends-stub; engaged on demand — not part of the sequential pipeline) | medium | inherit |
| **security-monitor** | Security monitor - scans for vulnerabilities, advisories, and secret leaks | medium | inherit |
| **stack-setup** | Stack Setup Specialist | low | inherit |
| **test-runner** | QA and verification agent - runs tests and validates acceptance criteria | medium | inherit |

## Skills

- **code-review**: Conducts thorough code reviews focusing on correctness, maintainability, security, and best practices. Use when: reviewing pull requests, evaluating code quality, providing constructive feedback, or ensuring code standards compliance.
- **refactoring**: Improves code structure and design while preserving behavior using systematic refactoring techniques. Use when: cleaning up code, reducing duplication, improving maintainability, or paying down technical debt.
- **swe-solve**: Autonomous 5-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation and pull-request synthesis.
- **test-driven-development**: Implements software using Test-Driven Development (TDD) methodology with red-green-refactor cycle. Use when: developing new features, fixing bugs with tests, or ensuring code reliability through test-first approach.

> The platform mirrors additionally ship three common-provided skills — `finishing-a-development-branch`, `platform-command-lifecycle-manager`, and `platform-skill-lifecycle-manager` — inherited from `templates/common` and registered in the workspace `VERSION_MANIFEST.md`.

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

The canonical 7-phase model (see `docs/phase-definitions.md`):

0. **Team Assembly & Environment Baseline:** The PM assembles the team and confirms scope; `stack-setup` (optional) and `security-monitor` establish the environment baseline.
1. **Analysis & Stack Setup:** `architect` analyzes requirements and acceptance criteria into an implementation-ready brief.
2. **Design Review & Approval:** The architect's implementation plan + ADR are presented for explicit user approval.
3. **UI/UX Design:** `designer` (optional) produces wireframes, component specs, and design tokens when a UI/UX component is in scope.
4. **Implementation & QA Gate:** `code-writer` implements; `test-runner` verifies; the PM loops up to 3× on failures.
5. **Security Review & Lifecycle Finalization:** `security-monitor` runs the pre-PR advisory check; the PM logs decisions and updates governance records.
6. **Quality Assurance & Finalization:** The PM runs the audit, `/sync`, and opens a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/security-check [--pr]` — Security advisory scan (daily) or pre-PR advisory check.

## Variant Type

**Type**: development

This variant focuses on software development workflows, feature implementation, and integration testing.

---

*Last Updated: 2026-10-06*
