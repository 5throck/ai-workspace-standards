---
sync_version: 1
content_hash: 0395ad739b73ba55cb839d9e428f27c0f9c3932c7ee10f10ad4300b5a170557c
---

# co-learning

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> Learning and assessment workflow — question-bank authoring with answer-length bias checks, remediation ledger review, and exam operations (cohorts, windows, activation, statistics monitoring)

## Overview

Learning and assessment workflow — question-bank authoring with answer-length bias checks, remediation ledger review, and exam operations (cohorts, windows, activation, statistics monitoring). See `AGENTS.md` for the agent ecosystem and governance; `docs/context.md` (architecture and standards) is inherited from `templates/common` at project creation.

## Quick Start

This is a stable variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### Shipped instruction files:

- `AGENTS.md` — agent ecosystem, PM Gateway workflow, and dispatch rules (all platforms).
- `HERMES.md` — Hermes Agents instruction map.

(`CLAUDE.md` / `GEMINI.md` are delivered from `templates/common` at project creation.)

## Team Mission

**Mission:** Learning and assessment workflow — question-bank authoring with answer-length bias checks, remediation ledger review, and exam operations (cohorts, windows, activation, statistics monitoring)

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | Medium | inherit |
| **exam-bank-steward** | Exam content and operations steward - question bank curation, bias review, exam operations | medium | inherit |
| **i18n-specialist** | Localization review, locale config, and translation-sync for locale mirrors (common extends-stub; engaged on demand — not part of the sequential pipeline) | medium | inherit |


## Skills

- **exam-bank-operations**: Question bank quality and exam operations workflow — authoring with answer-length bias checks, remediation ledger review, exam window preparation and statistics monitoring.

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

**Type**: learning

This variant focuses on learning and assessment workflows: question-bank quality, exam operations, and statistics monitoring.

---

*Last Updated: 2026-10-06*
