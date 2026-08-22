# Co-ABAP User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> This guide explains how to *use* a co-abap project — how to hand SAP development work to
> the agent team, what happens at each stage, and where output lands. For the full roster
> and repository layout, see [`../README.md`](../README.md); for governance rules, see
> [`../AGENTS.md`](../AGENTS.md).

## 1. Quick Start

1. Start with `/triage <request>` — the PM classifies the request, creates the task file,
   and kicks off parallel research. Describe the work in plain language: *"Add a new
   pricing report for sales org 1000"* or *"Fix dump in ZPROG_MM_STOCK_UPLOAD".*
2. The relevant **module analyst** (SD / MM / FI / CO / PP / LE) translates the business
   request into requirements (`01_srs.md` under `deliverables/REQ-NNN-[slug]/`).
3. For any multi-agent task, the PM shows an **execution plan table** and waits for your
   approval before dispatching:

   | Task | Agent | Tier | Model | Platform |
   |------|-------|------|-------|----------|
   | Module requirements analysis | sd-analyst | Medium | claude-sonnet-5-0 | Claude Code |
   | ABAP implementation | code-writer | Medium | claude-sonnet-5-0 | Claude Code |
   | QA chain | test-runner | Low | claude-haiku-4-5 | Claude Code |

4. Implementation runs through `code-writer` with the **post-write mandatory chain**
   (`SyntaxCheck → RunUnitTests → GetCodeCoverage → RunATCCheck`) after every
   `WriteSource` / `EditSource`.
5. QA produces `04_qa_report.md`; the transport is created/released with `/transport`.
6. Close with `/sync` — the only supported commit path, and it always runs **after**
   `/transport` so the CTS transport and the git commit stay in sync.

> **Rule of thumb**: requests that touch a business module go to the module analyst
> first; pure technical requests (performance, dumps, interfaces) go straight to the
> matching technical specialist — ask the PM when unsure.

## 2. What Kind of Task Do You Have?

| Your scenario | Likely agent(s) | Skill(s) involved |
|---------------|-----------------|-------------------|
| Functional requirement in SD / MM / FI / CO / PP / LE | sd/mm/fi/co/pp/le-analyst | `sap-sd` … `sap-le` |
| New or changed ABAP object | architect + code-writer | `abap-dev`, `post-write-chain` |
| Slow program / large-table access | sap-investigator, dba | `performance-tuning` |
| Runtime dump analysis | sap-investigator | `dump-monitor` |
| OData / RFC / IDoc interface | interface-expert | `abap-dev` |
| Fiori / UI5 screen | fiori-developer | `abap-dev` |
| SAP Script / Smart Forms / Adobe Forms | form-expert | `abap-dev` |
| Table / CDS design, SQL tuning | dba + schema-inspector | `abap-dev` |
| Business data query / AS-IS analysis | read-only-analyst | — |
| Transport management / infrastructure | devops-admin | — |

## 3. The Standard Multi-Stage Workflow

```
/triage (PM classifies, creates task file, parallel research)
        │
        ▼
Business Analysis (module analysts → 01_srs.md)
        │
        ▼
Tech Design (architect + dba → 02_technical_design.md)
        │
        ▼
Implementation (code-writer — post-write chain after EVERY write)
        │
        ▼
QA & Verification (test-runner → 04_qa_report.md)
        │
        ▼
/transport (CTS transport created/released)
        │
        ▼
/sync (memlog → changelog → audit → commit → PR)
```

Key commands:

- `/triage <request>` — start a task; PM classification + task file
- `/post-write` — manual post-write QA chain (when hooks are unavailable, e.g. Desktop App — see `desktop-app-fallback`)
- `/transport` — create/release the CTS transport
- `/sync "feat: ..."` — full pipeline; runs **after** `/transport`, never before

Never bypass the workflow with direct specialist invocation, and never run raw
`git commit` / `git push` — the hooks will reject it.

## 4. Requirements-Driven Deliverable Structure

Every requirement lives in its own numbered directory, built up stage by stage:

| Stage | File | Owner |
|-------|------|-------|
| 1 — Requirements Definition | `deliverables/REQ-NNN-[slug]/01_srs.md` | Module analyst + PM |
| 2 — Technical Design | `deliverables/REQ-NNN-[slug]/02_technical_design.md` | Architect + DBA |
| 3 — Implementation Summary | `deliverables/REQ-NNN-[slug]/03_implementation_report.md` | Specialist developers |
| 4 — QA & Verification | `deliverables/REQ-NNN-[slug]/04_qa_report.md` | QA engineer |
| 5 — Release & sync | transport + `/sync` | PM + DevOps/Admin |

Reads (schema inspection, business data queries) may run in parallel; **writes are
serialized** — one agent writes a given file at a time, coordinated by the PM.

## 5. Where Your Output Goes

| Output | Location |
|--------|----------|
| Requirement deliverables | `deliverables/REQ-NNN-[slug]/` (numbered `01_`–`04_` files) |
| Local `.abap` files | `scratch/` — the ONLY allowed location |
| Session log entries | `memory/YYYY-MM-DD.md` (indexed by `memory/MEMORY.md`) |
| User-facing change entries | `CHANGELOG.md` → PR |
| Final documentation audit | `sap:documentation-audit` skill before every sync |

Domain rules to keep in mind:

- Naming: `ZCL_` (class), `ZIF_` (interface), `ZPROG_` (program).
- Always run `SyntaxCheck` **before** `WriteSource`; use `EditSource` for small changes.
- The post-write chain is mandatory after any logic change — Priority 1 ATC findings
  block deployment, and coverage below 70% on new objects blocks proceeding to ATC.
- `/transport` before `/sync`, always — the CTS transport and git history must not
  diverge.
