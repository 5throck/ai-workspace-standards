# AGENTS.md

**co-abap Variant Agent Ecosystem**

> **⚠️ For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles (PM, Architect, DBA, etc.) for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI), or `.codex/config.toml` (Codex).

This document is the **Single Source of Truth (SSOT)** for the agent ecosystem, individual agent definitions, PM Gateway workflow, and execution plan templates.

---

## §1: Agent Ecosystem Overview

### 🎯 Agent Roster (Roles Overview)

| Agent | File | Tier | Role |
|-------|------|------|------|
| **Project Manager (PM) Agent** | [`agents/pm.md`](agents/pm.md) | High | Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 6). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** |

<!-- VARIANT-AGENTS-START -->
| **sd-analyst** | [`agents/sd-analyst.md`](agents/sd-analyst.md) | Medium | Sales & Distribution module analysis — activates on SD trigger keywords |
| **mm-analyst** | [`agents/mm-analyst.md`](agents/mm-analyst.md) | Medium | Materials Management module analysis — activates on MM trigger keywords |
| **fi-analyst** | [`agents/fi-analyst.md`](agents/fi-analyst.md) | Medium | Financial Accounting module analysis — activates on FI trigger keywords |
| **co-analyst** | [`agents/co-analyst.md`](agents/co-analyst.md) | Medium | Controlling module analysis — activates on CO trigger keywords |
| **pp-analyst** | [`agents/pp-analyst.md`](agents/pp-analyst.md) | Medium | Production Planning module analysis — activates on PP trigger keywords |
| **le-analyst** | [`agents/le-analyst.md`](agents/le-analyst.md) | Medium | Logistics Execution module analysis — activates on LE trigger keywords |
| **architect** | [`agents/architect.md`](agents/architect.md) | High | Technical Execution Lead — pattern selection, execution sequencing |
| **code-writer** | [`agents/code-writer.md`](agents/code-writer.md) | Low | ABAP implementation via WriteSource/EditSource |
| **test-runner** | [`agents/test-runner.md`](agents/test-runner.md) | Low | SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck |
| **dba** | [`agents/dba.md`](agents/dba.md) | Medium | Table/CDS/index design, SQL performance tuning |
| **devops-admin** | [`agents/devops-admin.md`](agents/devops-admin.md) | Low | Transport management, infrastructure install |
| **sap-investigator** | [`agents/sap-investigator.md`](agents/sap-investigator.md) | Medium | Codebase pattern scan, historical design extraction |
| **read-only-analyst** | [`agents/read-only-analyst.md`](agents/read-only-analyst.md) | Medium | Business data queries, AS-IS analysis |
| **schema-inspector** | [`agents/schema-inspector.md`](agents/schema-inspector.md) | Medium | Table/CDS structure inspection, dependency maps |
| **interface-expert** | [`agents/interface-expert.md`](agents/interface-expert.md) | Medium | OData/RFC/IDoc interface design |
| **fiori-developer** | [`agents/fiori-developer.md`](agents/fiori-developer.md) | Medium | UI5/Fiori screen design and implementation |
| **form-expert** | [`agents/form-expert.md`](agents/form-expert.md) | Medium | SAP Script, Smart Forms, Adobe Forms design |
| **security-monitor** | [`agents/security-monitor.md`](agents/security-monitor.md) | Low | Security policies and safe dependencies |
| **gui-scripter** | [`agents/gui-scripter.md`](agents/gui-scripter.md) | Low | BDC / VBS automation (last resort) |
<!-- VARIANT-AGENTS-END ---

## §2: Individual Agent Definitions

See [`agents/pm.md`](agents/pm.md) for the PM Agent full definition.

<!-- VARIANT-AGENT-DETAILS-START -->
### sd-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/sd-analyst.md`](agents/sd-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Sales & Distribution module analysis — activates on Sales Order, Delivery, Billing, Pricing, SD, VA*, VL*, VF* keywords |

### mm-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/mm-analyst.md`](agents/mm-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Materials Management module analysis — activates on Purchasing, Goods Receipt, Material Master, MM, ME* keywords |

### fi-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/fi-analyst.md`](agents/fi-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Financial Accounting module analysis — activates on Journal Entry, GL, AR, AP, FI, FB*, BKPF keywords |

### co-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/co-analyst.md`](agents/co-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Controlling module analysis — activates on Cost Center, Internal Order, CO-PA, CO, KS* keywords |

### pp-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/pp-analyst.md`](agents/pp-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Production Planning module analysis — activates on Production Order, BOM, MRP, PP, CO*, AFKO keywords |

### le-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/le-analyst.md`](agents/le-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Logistics Execution module analysis — activates on Shipment, Transport, Warehouse, WM, EWM, LE, LT* keywords |

### architect

| Field | Value |
|-------|-------|
| **File** | [`agents/architect.md`](agents/architect.md) |
| **Tier** | high |
| **Phases** | 2, 5 |
| **Role** | Technical Execution Lead — pattern selection, execution sequencing, DBA coordination |

### code-writer

| Field | Value |
|-------|-------|
| **File** | [`agents/code-writer.md`](agents/code-writer.md) |
| **Tier** | low |
| **Phases** | 3 |
| **Role** | ABAP implementation via WriteSource/EditSource, syntax check |

### test-runner

| Field | Value |
|-------|-------|
| **File** | [`agents/test-runner.md`](agents/test-runner.md) |
| **Tier** | low |
| **Phases** | 4 |
| **Role** | QA verification — unit tests, code coverage, ATC check |

### dba

| Field | Value |
|-------|-------|
| **File** | [`agents/dba.md`](agents/dba.md) |
| **Tier** | medium |
| **Phases** | 2, 4 |
| **Role** | Table/CDS/index design, SQL performance tuning |

### devops-admin

| Field | Value |
|-------|-------|
| **File** | [`agents/devops-admin.md`](agents/devops-admin.md) |
| **Tier** | low |
| **Phases** | 5 |
| **Role** | Transport management, infrastructure install, system audit |

### sap-investigator

| Field | Value |
|-------|-------|
| **File** | [`agents/sap-investigator.md`](agents/sap-investigator.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Codebase pattern scan, historical design extraction (read-only) |

### read-only-analyst

| Field | Value |
|-------|-------|
| **File** | [`agents/read-only-analyst.md`](agents/read-only-analyst.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Business data queries, AS-IS analysis with draft AC (read-only) |

### schema-inspector

| Field | Value |
|-------|-------|
| **File** | [`agents/schema-inspector.md`](agents/schema-inspector.md) |
| **Tier** | medium |
| **Phases** | 1 |
| **Role** | Table/CDS structure inspection, dependency maps (read-only) |

### interface-expert

| Field | Value |
|-------|-------|
| **File** | [`agents/interface-expert.md`](agents/interface-expert.md) |
| **Tier** | medium |
| **Phases** | 2, 3 |
| **Role** | OData/RFC/IDoc interface design and connectivity validation |

### fiori-developer

| Field | Value |
|-------|-------|
| **File** | [`agents/fiori-developer.md`](agents/fiori-developer.md) |
| **Tier** | medium |
| **Phases** | 2, 3 |
| **Role** | UI5/Fiori screen design and implementation |

### form-expert

| Field | Value |
|-------|-------|
| **File** | [`agents/form-expert.md`](agents/form-expert.md) |
| **Tier** | medium |
| **Phases** | 2, 3 |
| **Role** | SAP Script, Smart Forms, Adobe Forms design and print programs |

### security-monitor

| Field | Value |
|-------|-------|
| **File** | [`agents/security-monitor.md`](agents/security-monitor.md) |
| **Tier** | low |
| **Phases** | 1 |
| **Role** | Security policies enforcement and safe dependency audit |

### gui-scripter

| Field | Value |
|-------|-------|
| **File** | [`agents/gui-scripter.md`](agents/gui-scripter.md) |
| **Tier** | low |
| **Phases** | 3 |
| **Role** | BDC / VBS automation — LAST RESORT when no BAPI/OData/RFC alternative exists |
<!-- VARIANT-AGENT-DETAILS-END ---

## §3: Agent Coordination & Orchestration Rules

### 🔄 Agent Coordination Workflow (Harness Advanced)

1.  **Triage & Initial Research (PM & Subagents)**:
    *   The **Global PM** receives and classifies the request.
    *   Immediate research is dispatched (Parallel: `sap-investigator` + `read-only-analyst` + `schema-inspector`) to gather technical and business data before any discussion.

2.  **Business Analysis & AC Definition (Biz Group)**:
    *   Module analysts (SD, MM, etc.) discuss the request based on research data.
    *   **Output**: PRD (Product Requirements Document) and clear **Acceptance Criteria (AC)**.

3.  **Governance & Implementation Approval (PM & User)**:
    *   PM Agent reviews the PRD/AC and confirms the scope.
    *   **User Approval Required**: For high-risk changes (Core BAPI/CDS modification, Schema changes, cross-module refactors).

4.  **Technical Design & Impact Analysis (Tech Group)**:
    *   Technical agents (Architect, DBA, Developer) design the implementation.
    *   **Impact Analysis**: Use `sap:impact-architecture` to identify side effects.

5.  **Implementation & Verification Chain (Assigned Agents)**:
    *   Implementation is delegated to `code-writer` and verification to `test-runner`.
    *   **Mandatory Chain**: Must pass `SyntaxCheck` → `RunUnitTests` → `GetCodeCoverage` (≥70% new objects) → `RunATCCheck` (Zero P1 findings).

6.  **Finalization, Sync & Reporting (PM)**:
    *   **Memory Logging**: Record key decisions and issues in `memory/YYYY-MM-DD.md`.
    *   **Git Sync**: Execute `/sync` (full pipeline: memlog → changelog → audit → commit → push → PR).
    *   **Final Report**: PM summarizes the outcome and test results for the user.

### 📦 Requirements-Driven Deliverables Workflow (Stage 1 to 5)

All software requirements and implementation logs must be structured and stored under the `/deliverables/` folder, managed by a central index `deliverables/index.md` (Traceability Matrix). The pipeline operates in 5 consecutive stages, each owned by designated specialist agents:

#### **Stage 1: Requirements Definition (`01_srs.md`)**
*   **Responsible Agent**: **Module Analyst (SD/MM/FI/CO/PP/LE Analyst)** or **PM** (if cross-module/integration task).
*   **Deliverable**: `/deliverables/REQ-NNN-[slug]/01_srs.md`.
*   **Transition**: Approved by PM and signed off by Technical Lead.

#### **Stage 2: Technical Design (`02_technical_design.md` or domain-specific templates)**
*   **Responsible Agent**: **Architect** (Control flows, architecture) & **DBA** (Database schema & index design).
*   **Deliverables**: `/deliverables/REQ-NNN-[slug]/02_technical_design.md`.

#### **Stage 3: Coding & Implementation (`03_implementation_report.md` or domain-specific templates)**
*   **Responsible Agent**: **ABAP Developer** (`code-writer`) or specialist developers.
*   **Deliverables**: `/deliverables/REQ-NNN-[slug]/03_implementation_report.md`.

#### **Stage 4: Quality Gate Verification (`04_qa_report.md`)**
*   **Responsible Agent**: **QA Engineer** (`test-runner`).
*   **Deliverable**: `/deliverables/REQ-NNN-[slug]/04_qa_report.md`.
*   **Scope**: Run the mandatory QA chain (`SyntaxCheck` -> `RunUnitTests` -> `GetCodeCoverage` -> `RunATCCheck`). Mark as **[QUALITY GATE STATUS: PASSED]**.

#### **Stage 5: Governance & Release**
*   **Responsible Agent**: **PM** & **DevOps/Admin**.

### 🤖 PM Subagent Dispatch Protocol

#### Dispatch Decision Tree

```
Request received
  │
  ├─ Read-only? (analyze, search, query, inspect)
  │    └─► PARALLEL SKILLS — Primary Agent dispatches research subagents
  │          ├── sap-investigator   → codebase scan
  │          ├── read-only-analyst  → business data queries
  │          └── schema-inspector   → table/CDS structure
  │
  └─ Write? (EditSource, WriteSource, SyntaxCheck)
       └─► SERIAL SUBAGENTS — delegate to specialized execution subagents
             ├── code-writer  → ABAP implementation
             └── test-runner  → Stability verification
```

#### Subagent Roster

##### 1. Parallel Research & Design Agents (Read-Only)

| Subagent | Prompt file | Parallelizable | Design/Read Allowed Tools |
|----------|-------------|:--------------:|---------------------------|
| `sap-investigator` | `agents/sap-investigator.md` | ✅ Always | `GrepPackages`, `GrepObjects`, `SearchObject` |
| `read-only-analyst` | `agents/read-only-analyst.md` | ✅ Always | `RunQuery`, `GetTable`, `GetTableContents` |
| `schema-inspector` | `agents/schema-inspector.md` | ✅ Always | `GetTable`, `GetCDSDependencies`, `GetSource` (read) |
| `security-monitor` | `agents/security-monitor.md` | ✅ Always | `GrepObjects`, `GetSource` (read) |

##### 2. Serial Execution & Verification Agents (Write-Capable)

| Subagent | Prompt file | Parallelizable | Write/Execution Allowed Tools |
|----------|-------------|:--------------:|------------------------------|
| `code-writer` | `agents/code-writer.md` | ❌ Never | `EditSource`, `WriteSource`, `SyntaxCheck` |
| `test-runner` | `agents/test-runner.md` | ❌ After write | `RunUnitTests`, `RunATCCheck` (verification) |

#### Parallel Dispatch Rules

1. **Single message, multiple Agent() calls** — all parallel subagents must be dispatched in one turn.
2. **Serial write execution** — `EditSource`, `WriteSource`, `SyntaxCheck` are executed by the ABAP Developer in serial to prevent lock conflicts.
3. **Merge before proceeding** — PM waits for ALL parallel subagents to return before moving to the next serial step.
4. **Error handling** — if any parallel subagent fails, PM resolves the failure before proceeding.

### 🗺️ Agent Role Boundary Matrix

#### Research Agents — When to Use Which

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Search for objects by name pattern across packages | `sap-investigator` | `read-only-analyst`, `schema-inspector` |
| Query business data from SAP tables | `read-only-analyst` | `sap-investigator` |
| Inspect a CDS view's dependencies or a table's field structure | `schema-inspector` | `read-only-analyst` |

#### Technical Agents — When to Use Which

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the DB/CDS schema (ERD, normalization, indexing) | `dba` | `architect` |
| Design the implementation pattern (A/B/C) and execution plan | `architect` | `dba` |
| Write or modify ABAP source code | `code-writer` | `architect` |
| Run SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck | `test-runner` | `code-writer` |

#### Business Analyst Selection

| Trigger keywords | Activate |
|------------------|---------|
| Sales Order, Delivery, Billing, Pricing, VA\*, VL\*, VF\*, VBAK | `sd-analyst` |
| Purchase Order, Goods Receipt, Material Master, ME\*, EKKO, MARA | `mm-analyst` |
| Shipment, Transport Route, Warehouse, WM, EWM, VTTP | `le-analyst` |
| Production Order, BOM, MRP, Routing, CO\*, AFKO | `pp-analyst` |
| Journal Entry, GL, AR, AP, Fixed Asset, FB\*, BKPF, ACDOCA | `fi-analyst` |
| Cost Center, Internal Order, CO-PA, Allocation, KS\*, COEP | `co-analyst` |

### 🔀 Cross-Module Integration Orchestration

If a user request contains trigger keywords matching **two or more modules**, activate both analysts **in parallel** (same dispatch message).

| Scenario | Primary | Secondary | Key Link Tables |
|----------|---------|-----------|-----------------|
| SD Billing → FI Posting | SD Analyst | FI Analyst | VBRK↔BKPF via VBRK.BELNR, VKOA |
| MM Goods Receipt → FI Accounting | MM Analyst | FI Analyst | MKPF/MSEG↔BKPF via RE_BELNR, T030/OBYC |
| SD Order → LE Delivery | SD Analyst | LE Analyst | VBAK/VBAP↔LIKP/LIPS via VBFA |
| PP Production → MM Material Consumption | PP Analyst | MM Analyst | AFKO↔MKPF/MSEG via AUFNR, RESB |

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:
- **Core Principles**: Always follow SOLID principles and write unit tests when creating functional code.
- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".

## Error Recovery

1. **Analyze the error**: Check if it's a tool error, context issue, or logic problem
2. **Retry with clarification**: Provide more specific instructions
3. **Escalate to human**: If 3 retries fail, surface the issue to the user
4. **Document the pattern**: Add to memory/ for future reference

---

## §6: Skills

> **`owner` field definition**: The `owner` field in `SKILL.md` frontmatter identifies the **maintainer responsibility** for that skill — the agent or role accountable for keeping the skill current. It does NOT require that agent to exist in the current project, and does NOT mean that agent is the only one who can invoke the skill.

### Platform Skills Registry

| Skill | Location | Purpose |
|-------|----------|---------|
| **Agent Lifecycle Manager** | `.claude/skills/agent-lifecycle-manager/SKILL.md` | Managing agent lifecycle, creating/retiring agents, validation |
| **ABAP Development** | `skills/abap-dev/SKILL.md` | BAPI exploration, transport management, unit testing, performance analysis |
| **Post-Write Chain** | `skills/post-write-chain/SKILL.md` | Mandatory SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck after ABAP writes |

---

## §7: Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification.

---

*Last Updated: 2026-08-15 (co-abap v1.0.0)*
