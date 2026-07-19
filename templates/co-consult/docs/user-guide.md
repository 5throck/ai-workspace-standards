# Co-Consult — User Guide

> **For**: Engagement leads, analysts, and clients using this AI strategy-consulting team
> **Architecture**: PM Gateway → specialist agents → skills → deliverables/

This guide is task-oriented: it tells you what to say to get a given consulting job done. For the team roster and mission statement, see [`README.md`](../README.md).

## 1. Quick Start

You never talk to specialist agents directly — you talk to the **PM** (Engagement Leader), and the PM dispatches the right specialist(s).

```
You:  "I need a competitive analysis for a client entering the EV charging market"
PM:   Analyzes the request, classifies the phase, and shows an execution plan:

      | # | Task                                   | Agent             | Tier   | Model  |
      |---|-----------------------------------------|--------------------|--------|--------|
      | 1 | Market/competitive analysis              | strategy-analyst   | Medium | sonnet |
      | 2 | /sync "docs: add EV market analysis"     | pm                 | Medium | sonnet |

      Execution Order: Sequential
PM:   "Shall I dispatch strategy-analyst?"
You:  "Yes"
PM:   ▶ dispatches strategy-analyst ...
```

**Rules of engagement**:
- Always start with the PM. Do not invoke `agents/*.md` specialists directly — the PM Gateway is enforced at tool, prompt, and QA-gate level (see `AGENTS.md` §3).
- The PM shows an execution plan table **before** dispatching any specialist — review it, confirm, then work proceeds.
- When your engagement produces a change worth recording (a new deliverable, a completed analysis, a report), the last row of the plan is always `/sync "type: message"` — this runs memlog → changelog → audit → commit → PR in one pipeline. You do not run `git commit` yourself.

## 2. What Kind of Consulting Task Do You Have?

Use this table to see which agent(s) and skill(s) will typically be dispatched. You don't need to name them yourself — just describe the task — but knowing the mapping helps you frame requests and set expectations.

| Your request sounds like... | Agent(s) | Skill(s) |
|---|---|---|
| "I need a market/competitive analysis" | strategy-analyst | `competitive-intelligence` |
| "Build the business case / ROI / NPV for this recommendation" | strategy-analyst | `financial-modeling` |
| "I need a Korean company's financial analysis" (DART-based) | data-analyst | `financial-statement-analysis`, `k-dart` |
| "Give me a full profile / intelligence report on this company" | data-analyst | `company-intelligence`, `k-dart` |
| "I need industry insights / regulatory landscape" | industry-expert | (industry research, no dedicated skill file) |
| "I need a client deck / executive presentation" | communications-lead | `executive-presentation`, `narrative-framework` |
| "Write up the findings as a consulting report" | communications-lead | `consulting-report-writing` |
| "I need org change planning / transformation roadmap" | change-management-partner | `org-readiness-assessment`, `stakeholder-alignment` |
| "Map out how this change affects each department/role" | change-management-partner | `change-impact-assessment` |
| "Design the technical solution / architecture" | solutions-architect | `solution-design` |
| "Is this technically feasible? What's the risk/cost range?" | solutions-architect | `technical-feasibility` |
| "Turn multiple analyses into one strategic narrative" | strategy-analyst | `insight-synthesis` |
| "Plan the delivery schedule / milestones / risk register" | delivery-manager | `project-delivery` |
| "Manage the client review cycle on this deliverable" | delivery-manager | `stakeholder-review-management` |
| "I need functional expertise (HR/Finance/Ops/Marketing)" | sme | (functional domain expertise) |
| "Coordinate this workstream / track team progress" | workstream-lead | (workstream coordination) |
| "Set up collaboration tools / digital workflow" | technology-specialist | (platform/tooling support) |
| "Run statistical analysis / data modeling" | data-analyst | (statistical/data analysis) |

**Common multi-agent sequences**:
- Market entry engagement: `strategy-analyst` (competitive-intelligence) → `solutions-architect` (solution-design, technical-feasibility) → `strategy-analyst` (financial-modeling, iterates with technical-feasibility, max 2 loops) → `communications-lead` (executive-presentation).
- Org transformation engagement: `change-management-partner` (org-readiness-assessment, stakeholder-alignment) → `change-management-partner` (change-impact-assessment) → `communications-lead` (narrative-framework) for the change story.
- Delivery handoff: `solutions-architect` (solution-design produces dependency map + risk register) → `delivery-manager` (project-delivery converts it into an execution plan) → `delivery-manager` (stakeholder-review-management) for review cycles.

## 3. Walkthrough: Financial Statement Analysis Pipeline

This is the newest and most complex skill (`financial-statement-analysis`), for Korean company financial analysis based on DART (Korea's Financial Supervisory Service disclosure system). It runs as a six-stage pipeline: **DART collection → validation → normalization → KPI extraction → ROIC value driver tree → report generation.**

### Step 1 — Collect DART data
Use the `k-dart` skill (or ask the PM to dispatch `data-analyst`) to pull the target company's disclosures and financial statements from the DART OpenAPI. This requires the `API_K_DART` environment variable to be set. Save the raw JSON response — this is the input to the pipeline.

### Step 2 — Run the pipeline
The whole validation → normalization → KPI → driver-tree → report chain is automated by one script:

```bash
bun scripts/co-consult/financial-pipeline.ts <dart-json-path> --company <name> [--output-dir <dir>]
```

Example:
```bash
bun scripts/co-consult/financial-pipeline.ts ./deliverables/samsung/dart/dart-2026-07-19.json --company samsung
```

Internally, the pipeline script:
1. Copies your DART input into `<output-dir>/dart/dart-<date>.json`.
2. **② Validation** — runs the Python validation engine, writes `<output-dir>/validation/validation-report-<date>.json`, and reports a pass-rate percentage.
3. **③ Normalization** — maps the raw DART fields to a canonical IFRS-general financial model using `python/mappings/ifrs_general.json`, writes `<output-dir>/canonical/canonical-model-<date>.json`, and reports field-coverage percentage.
4. **④ KPI extraction** — computes profitability, growth, leverage, and cash-flow KPIs from the canonical model, writes `<output-dir>/kpi/kpi-report-<date>.json`.
5. **⑤ ROIC value driver tree** — builds a 5+ level ROIC decomposition tree, writes `<output-dir>/driver-tree/driver-tree-<date>.json`.
6. **⑥ Report generation** — assembles validation, canonical model, KPIs, and driver tree into a structured Markdown report at `<output-dir>/reports/financial-analysis-<company>-<date>.md`.

If you need to run or re-run an individual stage (e.g. re-generate KPIs after fixing a mapping), the underlying scripts are also available standalone:

```bash
bun scripts/co-consult/financial-validate.ts <dart-json-path>
bun scripts/co-consult/financial-normalize.ts <dart-json-path> <mapping-path>
bun scripts/co-consult/financial-kpi.ts <canonical-model-path>
bun scripts/co-consult/financial-driver-tree.ts <canonical-model-path>
bun scripts/co-consult/financial-report.ts   # invoked programmatically by financial-pipeline.ts
```

### Step 3 — Review the report
The final Markdown report is your deliverable-ready artifact. Hand it to `communications-lead` if it needs to be turned into a client-facing presentation (`executive-presentation` skill), or to `strategy-analyst` if it feeds into a broader business case (`financial-modeling` skill).

## 4. Engagement Phase Structure

Per `AGENTS.md` §3.5 and §4.2, work moves through phases; the PM only actively orchestrates Phases 0, 2, and 5-6 — specialists work autonomously within their assigned phase.

| Phase | Name | Who |
|---|---|---|
| 0 | Project Initiation | PM |
| 1 | Strategy & Research | strategy-analyst, industry-expert, data-analyst, sme, change-management-partner |
| 2 | Design Validation | industry-expert, sme, change-management-partner — PM validates and gates |
| 3 | Solution & Narrative Design | communications-lead, solutions-architect, sme |
| 4 | Execution & Delivery | delivery-manager, workstream-lead, technology-specialist |
| 5 | Lifecycle Finalization | PM (updates governance records, logs to memory/) |
| 6 | QA & Finalization | PM (runs `bun scripts/audit.ts`, then `/sync`) |

**Iterative loops**: `financial-modeling` ↔ `technical-feasibility` may iterate up to 2 times to reconcile cost/ROI assumptions with technical risk before moving to Phase 4.

## 5. Where to Find Your Deliverables

All engagement outputs are written under `deliverables/`:

```
deliverables/
├── drafts/          # work-in-progress analyses, in-flight deliverables
├── presentations/    # executive-presentation and narrative-framework outputs
├── references/       # supporting research, source documents, citations
└── research/         # competitive-intelligence, company-intelligence, industry research
```

For the `financial-statement-analysis` pipeline specifically, each company gets its own subdirectory (created automatically by `financial-pipeline.ts`, defaulting to `deliverables/<company-name>/`) containing `dart/`, `validation/`, `canonical/`, `kpi/`, `driver-tree/`, and `reports/` — see §3 above.

Session activity and decisions are logged separately in `memory/YYYY-MM-DD.md` (not a deliverable — this is the internal engagement log).

## 6. A Note on Reliability

This team accelerates research, drafting, and analysis — it does not replace professional judgment. Financial figures, ROIC calculations, and DART-derived data should be independently verified before being presented as final client deliverables. Numerical outputs from the financial-statement-analysis pipeline are approximations derived from public disclosure data and normalization mappings; always cite sources and flag anything unverified per the workspace's Source Attribution standard (see `AGENTS.md` §7).
