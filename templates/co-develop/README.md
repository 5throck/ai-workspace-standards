---
sync_version: 1
content_hash: 2aa680da575fc3368c1d6166304d7fe50290436646ba55f8fecae6e60d63d6e4
---

# co-develop

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ✅ Stable — v1.0.0
> Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization)

## Overview

Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization). See docs/context.md for full architecture and standards.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization)

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **architect** | Design agent - produces implementation plans and technical specs | high | inherit |
| **code-writer** | Implementation agent - writes code from an approved plan | low | inherit |
| **designer** | UI/UX design agent - produces wireframes, component specs, and design tokens | medium | inherit |
| **security-monitor** | Security monitor - scans for vulnerabilities, advisories, and secret leaks | medium | inherit |
| **stack-setup** | Stack Setup Specialist | low | inherit |
| **test-runner** | QA and verification agent - runs tests and validates acceptance criteria | medium | inherit |

## Skills

- **code-review**: Conducts thorough code reviews focusing on correctness, maintainability, security, and best practices. Use when: reviewing pull requests, evaluating code quality, providing constructive feedback, or ensuring code standards compliance.
- **refactoring**: Improves code structure and design while preserving behavior using systematic refactoring techniques. Use when: cleaning up code, reducing duplication, improving maintainability, or paying down technical debt.
- **swe-solve**: Autonomous 4-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation and pull-request synthesis.
- **test-driven-development**: Implements software using Test-Driven Development (TDD) methodology with red-green-refactor cycle. Use when: developing new features, fixing bugs with tests, or ensuring code reliability through test-first approach.

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

**Type**: development

This variant focuses on software development workflows, feature implementation, and integration testing.

---

*Last Updated: 2026-08-22*
