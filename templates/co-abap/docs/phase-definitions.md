# Phase Definitions

This document defines the workflow phases used by the co-abap variant. It formalizes the
orchestration workflow and phase-numbering map that previously lived only inline in
[`AGENTS.md § 3`](../AGENTS.md), matching the `docs/phase-definitions.md` convention used by every
other variant in this workspace.

co-abap uses a **6-step orchestration workflow** (business-facing steps) that maps onto a
**6-phase agent model** (the `phases:` field in each `agents/<name>.md` frontmatter). The two
numbering schemes are not 1:1 — see the mapping table below.

---

## Orchestration Workflow (Harness Advanced)

1. **Triage & Initial Research** (PM & Subagents)
   - The Global PM receives and classifies the request.
   - Immediate research is dispatched (parallel: `sap-investigator` + `read-only-analyst` +
     `schema-inspector`) to gather technical and business data before any discussion.

2. **Business Analysis & AC Definition** (Biz Group)
   - Module analysts (SD, MM, FI, CO, PP, LE) discuss the request based on research data.
   - **Output**: PRD (Product Requirements Document) and clear Acceptance Criteria (AC).

3. **Governance & Implementation Approval** (PM & User)
   - PM Agent reviews the PRD/AC and confirms the scope.
   - **User Approval Required** for high-risk changes (core BAPI/CDS modification, schema
     changes, cross-module refactors).

4. **Technical Design & Impact Analysis** (Tech Group)
   - Technical agents (Architect, DBA, Developer) design the implementation.
   - **Impact Analysis**: use `sap:impact-architecture` to identify side effects.

5. **Implementation & Verification Chain** (Assigned Agents)
   - Implementation is delegated to `code-writer`; verification to `test-runner`.
   - **Mandatory Chain**: must pass `SyntaxCheck` → `RunUnitTests` → `GetCodeCoverage` (≥70% new
     objects) → `RunATCCheck` (zero P1 findings).

6. **Finalization, Sync & Reporting** (PM)
   - **Memory Logging**: record key decisions and issues in `memory/YYYY-MM-DD.md`.
   - **Git Sync**: execute `/sync` (full pipeline: memlog → changelog → audit → commit → push → PR).
   - **Final Report**: PM summarizes the outcome and test results for the user.

---

## Phase Numbering Map (Orchestration Steps ↔ Agent Phases)

The orchestration workflow above uses **steps 1-6**; individual agent definitions use **phases
1-5** (plus occasional phase 6 for late-stage skills). The mapping is:

| Orchestration Step | Agent Phase | Scope |
|--------------------|:-----------:|-------|
| 1. Triage & Initial Research | 1 | Read-only parallel research (sap-investigator, read-only-analyst, schema-inspector, module analysts) |
| 2. Business Analysis & AC Definition | 1 | Module analyst PRD/AC drafting (read-only) |
| 3. Governance & Implementation Approval | 2 | Design & approval gate (PM + user sign-off) |
| 4. Technical Design & Impact Analysis | 2 | Architect/DBA design, impact analysis |
| 5. Implementation & Verification Chain | 3-4 | code-writer implementation (3) + test-runner QA chain (4) |
| 6. Finalization, Sync & Reporting | 5-6 | Memory logging, /sync, reporting (5); late-stage skills (e.g., dump-monitor) run at 6 |

> Agent `phases:` fields refer to the **Agent Phase** column above, not the orchestration step
> number. Skills may declare phase 6 for post-release monitoring.

---

## Requirements-Driven Deliverables Workflow (Stage 1 to 5)

All software requirements and implementation logs are structured and stored under
`deliverables/`, managed by a central index `deliverables/index.md` (Traceability Matrix). This
pipeline runs *within* orchestration steps 2-6 above — it is the concrete deliverable trail for
Business Analysis through Finalization.

| Stage | Deliverable | Responsible Agent |
|-------|-------------|--------------------|
| 1. Requirements Definition | `deliverables/REQ-NNN-[slug]/01_srs.md` | Module Analyst (SD/MM/FI/CO/PP/LE) or PM (cross-module/integration task) |
| 2. Technical Design | `deliverables/REQ-NNN-[slug]/02_technical_design.md` | Architect (control flows, architecture) & DBA (schema/index design) |
| 3. Coding & Implementation | `deliverables/REQ-NNN-[slug]/03_implementation_report.md` | ABAP Developer (`code-writer`) or specialist developers |
| 4. Quality Gate Verification | `deliverables/REQ-NNN-[slug]/04_qa_report.md` | QA Engineer (`test-runner`) — runs `SyntaxCheck` → `RunUnitTests` → `GetCodeCoverage` → `RunATCCheck`, marks `[QUALITY GATE STATUS: PASSED]` |
| 5. Governance & Release | — | PM & DevOps/Admin |

Stage 1 transitions require approval by PM and sign-off by the Technical Lead before Stage 2
begins.

---

## PM Facilitation per Orchestration Step

| Step | PM Opening | PM Monitoring | PM Synthesis |
|------|-----------|----------------|---------------|
| 1. Triage & Initial Research | Classify request, dispatch parallel research | Confirm research agents completed | Technical/business data summary |
| 2. Business Analysis & AC Definition | Brief module analysts on scope | Check PRD/AC quality | PRD + Acceptance Criteria |
| 3. Governance & Implementation Approval | Present PRD/AC for review | — | **USER APPROVAL** (high-risk changes only) + confirmed scope |
| 4. Technical Design & Impact Analysis | Hand off approved scope to tech group | Review impact analysis | Approved technical design |
| 5. Implementation & Verification Chain | Dispatch code-writer with approved design | Track QA chain progress; max 3 fix iterations | Quality-gate-passed implementation |
| 6. Finalization, Sync & Reporting | Run `/sync` | — | PR link + final report |

---

## Variant Customization Points

co-abap declares its specialist agents per phase in each agent's `agents/<name>.md` frontmatter:

```yaml
# Example agent frontmatter
phases: [1, 2]
handoff_to: [next-agent]
handoff_from: [pm]
required_skills: [skill-name]
```

See [`AGENTS.md § 2`](../AGENTS.md) for the full agent roster and individual agent definitions,
and [`AGENTS.md § 3`](../AGENTS.md) for the PM subagent dispatch decision tree.
