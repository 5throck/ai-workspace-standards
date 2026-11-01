# Architecture Firm AI Agent Team — Documentation Index

> **Status**: Phase 1 (Quick Win) deliverables — Draft, pending architect approval
> **Created**: 2026-06-15
> **Origin**: Meeting `memory/meeting-2026-06-15-architecture-firm-agent-workflow.md`

---

## Overview

This folder contains the design and governance documents for deploying an AI agent team
to support an architecture firm's design and documentation workflow.

The agent team follows a **5-agent + 2 Human-in-the-Loop gate** architecture:

```
Client Input
    ↓
[Intake Agent] → [Research Agent] → 🔴 ARCHITECT GATE 1
    → [Review Agent] → [QA Agent] → 🔴 ARCHITECT GATE 2
    → [Communication Agent]
```

A **Project Context Card (PCC)** is the single source of truth flowing between all agents.

---

## Document Map

| # | Document | Purpose | Owner |
|---|----------|---------|-------|
| 1 | [pcc-v1-template.md](./pcc-v1-template.md) | Project Context Card template v1.1 (single source of truth; includes DrawingSummaries) | Technical Writer |
| 2 | [communication-agent-design.md](./communication-agent-design.md) | Communication Agent spec, prompt system, test cases (Phase 1 first deploy) | Analyst |
| 3 | [agent-team-implementation-roadmap.md](./agent-team-implementation-roadmap.md) | 6-month, 3-phase rollout plan with milestones and success criteria | Project Coordinator |
| 4 | [usage-boundaries.md](./usage-boundaries.md) | **Binding governance** — what agents CAN/CANNOT do, liability, prohibitions | PM Office |
| 5 | [regulatory-db-integration-research.md](./regulatory-db-integration-research.md) | Regulatory DB integration research (A-05) — MOLEG (Ministry of Government Legislation) Open API recommendation, freshness gate | Analyst |

---

## Reading Order

**Start here (mandatory for all staff):**
1. `usage-boundaries.md` — governance boundaries and legal responsibility

**For implementation teams:**
2. `agent-team-implementation-roadmap.md` — phased adoption plan
3. `pcc-v1-template.md` — the data backbone
4. `communication-agent-design.md` — the first agent to deploy

---

## Critical Reminders

- ⚠️ **Agents are assistants, not decision-makers.** The licensed architect holds all legal responsibility.
- ⚠️ **Regulatory output is "reference summary only"** — never a legal determination. Verify against official gazette text.
- ⚠️ **Two architect review gates are non-skippable.**
- ⚠️ **All agent outputs are drafts** until the architect stamps approval.

---

## Phase 1 Deliverables Checklist

- [x] PCC v1.1 template (incl. DrawingSummaries field)
- [x] Communication Agent design
- [x] 3-phase roadmap
- [x] Usage boundaries governance document
- [x] Documentation index (this file)
- [x] Regulatory DB integration research (A-05)
- [ ] Pilot project selection
- [ ] Firm-wide acknowledgement of usage-boundaries.md

## Next Phase (Phase 2) Prerequisites

- Pilot completion and feedback incorporation
- [x] Regulatory DB integration research (Action Item A-05) — **complete**: MOLEG (Ministry of Government Legislation) Open API + freshness gate recommended
- [ ] Resolve A-05 open questions (jurisdiction scope, statute scope list, freshness trust window, commercial-DB budget)
- [ ] Research Agent + QA Agent design
