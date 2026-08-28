# Safety OS User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> A practical, task-oriented guide to working with the Safety OS team day-to-day. For the team roster and mission overview, see [`README.md`](../README.md). For the full governance/agent specification, see [`AGENTS.md`](../AGENTS.md).

## 1. Quick Start

Every task starts the same way: **talk to the PM/CSO, never invoke a specialist agent directly.**

1. **Describe your task in plain language.** e.g. "Chemical plant turnaround starts next month — build the pre-TAR risk assessment package."
2. **PM/CSO classifies the request**, checks the **legal basis gate** (every workflow must cite ≥3 Korean regulatory sources from OSHA-KR/SAPA and domain acts — the PM will not dispatch work without them), and determines which specialist(s) are needed.
3. **PM shows you an execution plan table** before doing anything multi-step (2+ files or 2+ sequential actions). Every plan ends with `/sync`:

   | Task | Agent | Tier | Skill |
   |------|-------|------|-------|
   | Pre-TAR risk assessment package | ehschem-agent | Medium | `tar-planning` |
   | Contractor surge onboarding | contractor-safety-agent | Medium | `contractor-onboarding` |
   | `/sync "feat(tar): pre-TAR package"` — audit + commit + push + PR | pm | High | `sync` |

4. **You approve (or adjust) the plan.** PM dispatches specialists — serially for anything that writes files, in parallel only for read-only research/analysis.
5. **PM verifies the output** against your original ask and runs the quality gates: `bun scripts/audit.ts` (documentation/structure) and `bun scripts/co-safety/safety-audit.ts` (legal_basis, ≥3 sources per workflow, 0 errors required).
6. **You close out the work with `/sync "type: description"`** — the only supported path to committing and opening a PR. Direct `git commit`/`git push` calls are blocked by the pre-commit hook.

**Rule of thumb:** if you find yourself typing "hey msds-agent, can you..." — stop, and ask the PM/CSO instead. The PM is the single point of entry; specialists are dispatched, not chatted with directly.

## 2. What Kind of Task Do You Have?

Use this table to guess which specialist(s) the PM will bring in — useful for describing your task efficiently, not for calling the agent yourself.

| Your scenario | Likely agent(s) | Skill(s) involved |
|---------------|-----------------|-------------------|
| Hazard identification + risk scoring, risk register update | risk-assessment-agent | `risk-assessment` |
| High-risk / non-routine work authorization | safety-workflow-manager | `permit-to-work` (PTW) |
| Pre-work daily safety briefing | safety-workflow-manager | `tool-box-meeting` (TBM) |
| Fire, spill, gas leak, injury — incident escalation | emergency-agent | `emergency-response` |
| MSDS parsing, GHS classification, chemical approval | msds-agent | `msds-parser`, `ghs-classifier` |
| LOTO / hazardous energy isolation procedure | psm-agent | `psm-loto` |
| Management of Change package | psm-agent | `psm-moc` |
| Korean statute / precedent / interpretation lookup | legal-agent | `k-law` (KR-scoped) |
| OSHA-KR / SAPA gap analysis | compliance-agent | `compliance-gap` |
| Incident root cause analysis (5-Why / Bow-Tie) | incident-investigation-agent | `root-cause-analysis` |
| Regulatory inspection readiness, evidence trail | audit-agent | `audit-preparation` |
| Equipment maintenance / aging asset plan | asset-integrity-agent | `asset-integrity-check` |
| Contractor onboarding + training packages | contractor-safety-agent, training-agent | `contractor-onboarding` |
| Chemical plant / refinery / petrochemical work | ehschem-agent | `tar-planning`, `process-hazard-screening` |
| LNG/LPG/수소 terminal storage, KGS inspections | gasterm-agent | `tank-integrity-validator`, `construction-permit-overview` |
| Power plant boiler/turbine, ESS fire, arc flash | powergen-agent | `ess-fire-risk-assessor`, `arc-flash-analyzer` |
| Pharma GMP/GxP (batch records, deviation/CAPA, QRM) | gmp/glp/gdp/gcp/gvp-agents | `gmp-qrm`, `gmp-deviation-capa`, ... |
| Industry-specific EHS (semicon, battery, shipbuilding, steel, food, cosmetics, waste, defense, biotech, datacenter, logistics, railway) | corresponding domain agent | domain skills under `skills/` |

Full dispatch trigger table: [`AGENTS.md`](../AGENTS.md) §3 "Specialist Agent Roster".

## 3. The Standard Multi-Stage Workflow

```
User Request
     │
     ▼
┌─────────────┐   legal_basis < 3 sources? ──► BLOCKED (escalate to PM/CSO)
│  PM / CSO   │──────────────────────────
│   Triage    │
└──────┬──────┘
       ▼
Design Approval (execution plan table, ends with /sync)
       ▼
┌─────────────────────────────────────────────┐
│  Specialist Dispatch (Phase 1-5)            │
│  serial for writes · parallel for read-only │
│  every workflow cites legal_basis ≥3        │
└──────┬──────────────────────────────────────┘
       ▼
┌─────────────┐   FAIL ──► fix cycle (max 3×)
│  QA Gate    │──────────────────────► back to specialist
│ audit.ts +  │
│ safety-audit│
└──────┬──────┘
       ▼ PASS
  Finalization — /sync: memlog → CHANGELOG → audit → commit → push → PR
```

**Key commands** (run from the project root):

| Command | What it does |
|---------|--------------|
| `bun scripts/co-safety/safety-audit.ts` | legal_basis gate — ≥3 regulatory sources per workflow/evidence model, 0 errors required (1,077+ files checked) |
| `bun scripts/audit.ts` | workspace-standards audit (structure, lifecycle, encoding, skills registry) |
| `bun scripts/agent-verify.ts` | agent roster integrity (AGENTS.md ↔ agents/ files) |
| `/sync "type: description"` | the ONLY supported commit path — runs the full pipeline and opens a PR |

**Never bypass git**: direct `git commit` / `git push` are blocked by the pre-commit hook. All changes flow through `/sync`.

## 4. Phase Structure

| Phase | Owner | What happens |
|-------|-------|--------------|
| 1–2 Governance | safety-governance-manager, legal-agent | EHS strategy, KPI definition, regulatory tracking, legal interpretation |
| 3–4 Operations | safety-workflow-manager + functional/domain agents | Daily workflows — TBM, PTW, risk assessment, MSDS, training, compliance monitoring, domain-specific EHS work |
| 5 Investigation | incident-investigation-agent, audit-agent | RCA/CAPA, audit preparation, evidence traceability |
| 6 QA / Finalization | pm (+ auditor) | Quality gate, `/sync`, PR |

**Serial writes, parallel reads**: agents that write files run one at a time; read-only research/analysis agents (legal, compliance, reporting) may run in parallel. The PM enforces this automatically.

## 5. Where Your Output Goes

| Output | Location |
|--------|----------|
| Risk assessment records, registers | `memory/` (evidence records, `RR-*.json` rollups) |
| Findings / corrective actions (CA) | `memory/findings/`, `memory/corrective-actions/` |
| Session logs, meeting transcripts | `memory/YYYY-MM-DD.md`, `memory/` |
| Analysis, reports, deliverables | `docs/` |
| Workflow documentation | `workflows/` (daily / domains / compliance / emergency) |
| Evidence-model schemas | `evidence-models/` (JSON, referenced by every record) |
| Regulation coordinate registry | `regulations/KR/*.yaml` (live law text via `k-law`) |

**Domain rules**:

- Every record carries `timestamp`, `agent ID`, `workflow ID`, and `legal_basis` — no anonymous evidence.
- Korean is the default for human operational documentation; governance/agent/code files are English-only (see `docs/context.md` Language Policy).
- Workflows without ≥3 `legal_basis` sources are rejected before dispatch — fix the citations, not the gate.
