# Phase Definitions — co-safety

This document defines the workflow phases used by the `co-safety` variant. co-safety operates in **dispatch-on-demand mode**: specialist agents are not pre-assigned to workspace phases (their roster entries deliberately read `Phases: —` in `AGENTS.md`); instead, PM routes each request to the relevant domain specialist at the moment the deliverable type is classified (AGENTS.md §3.5). Phase vocabulary follows the standard workspace structure (see `templates/common/docs/phase-definitions.md`).

---

## Phase Overview

| Phase | Name | PM Role | Who Acts |
|-------|------|---------|----------|
| 0 | Project Initiation | Orchestrator | PM + variant setup |
| 1 | Research & Analysis | Router | Domain specialist(s) as classified |
| 2 | Design Review & Approval | Gate Keeper | PM + domain specialist |
| 3 | Execution | Router | Domain specialist(s) |
| 5 | Lifecycle Finalization | Owner | PM (updates governance records, logs decisions) |
| 6 | Quality Assurance & Finalization | Owner | PM (runs audit scripts, `/sync`, creates PR) |

---

## Phase Details

### Phase 0 — Project Initiation
PM classifies the safety/security request and selects the domain specialist (e.g. industrial-safety, process-safety, security domain per the roster in `AGENTS.md` and `variant.json`).

### Phases 1–3 — Dispatch-on-demand
- Because co-safety engagements are question-driven rather than pipeline-driven, PM dispatches the classified specialist for research (1), design input (2), and execution (3) as the deliverable type requires.
- **Gate**: Phase 2 design approval is still mandatory before any execution-phase work.

### Phases 5–6
Same as the workspace standard: PM-owned lifecycle finalization (5) and QA/finalization with audit scripts and `/sync` (6). Korean regulatory content in deliverables follows the `lang: ko` / `lang_reason: legal` frontmatter exception (statutory citations keep legal force in Korean).

---

## Governance
- Specialist roster and dispatch triggers: `AGENTS.md`
- Regulatory reference corpus: `variant.json` (`regulations` block)
