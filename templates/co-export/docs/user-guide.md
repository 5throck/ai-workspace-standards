# Co-Export User Guide

**Language**: **English** · [한국어](user-guide_ko.md)

> This guide explains how to *use* a co-export project — how to hand trade-compliance work
> to the agent team, what happens at each phase, and where output lands. For the full
> roster and repository layout, see [`../README.md`](../README.md); for governance rules,
> see [`../AGENTS.md`](../AGENTS.md).

## 1. Quick Start

1. Bring your request to the **PM** — it is the single entry point. Describe the export
   matter in plain language: *"Classify this new product for export to Vietnam"* or
> *"Screen this buyer list against sanctions before we sign."*
2. The PM triages and dispatches Phase 1 research — up to six specialists run **in
   parallel** (HS classification, export control, FTA origin, foreign regulation
   monitoring, halal certification, market entry).
3. For any multi-agent task, the PM shows an **execution plan table** and waits for your
   approval before dispatching:

   | Task | Agent | Tier | Model | Platform |
   |------|-------|------|-------|----------|
   | HS classification research | hs-classification-specialist | High | claude-opus-5-0 | Claude Code |
   | FTA origin determination | fta-origin-analyst | High | claude-opus-5-0 | Claude Code |
   | Trade document preparation | trade-documentation-specialist | Medium | claude-sonnet-5-0 | Claude Code |

4. Phase 2 is a **mandatory user-approval gate**: the PM synthesizes compliance + strategy
   findings and presents them — no Phase 3 execution work begins on unapproved findings,
   even if the client is in a hurry.
5. Approved work proceeds to strategy documents, trade documents, and duty-drawback
   assessment; logistics coordination follows (Phase 4).
6. Close with `/sync` — the only supported commit path; the pre-commit hook blocks direct
   `git commit` / `git push`.

> **Rule of thumb**: compliance-critical determinations (HS codes, FTA origin, export
> control) always go to their High-tier specialists — never let a "quick version" skip
> the specialist, because misclassification carries real financial and legal penalty
> risk.

## 2. What Kind of Task Do You Have?

| Your scenario | Likely agent(s) | Skill(s) involved |
|---------------|-----------------|-------------------|
| Product classification / tariff assessment | hs-classification-specialist | `hs-classification-workflow` |
| Export control / sanctions screening | export-control-compliance-specialist | `export-control-screening` |
| FTA preferential origin | fta-origin-analyst | `fta-origin-determination` |
| Duty drawback claims | customs-duty-drawback-specialist | `customs-duty-drawback-workflow` |
| Halal market entry | halal-certification-specialist | `halal-certification-workflow` |
| New-market entry strategy | market-entry-strategist | `market-entry-strategy` |
| Destination-country regulation watch | foreign-regulatory-intelligence-analyst | `foreign-regulation-monitoring` |
| L/C, invoice, packing list, B/L preparation | trade-documentation-specialist | `trade-documentation-checklist` |
| Incoterms / delivery coordination | logistics-coordinator | `logistics-coordination` |

## 3. The Standard Multi-Stage Workflow

```
PM Triage (Phase 0: scope)
        │
        ▼
Phase 1 — parallel research (classification, export control, FTA,
           foreign regulation, halal, market entry)
        │
        ▼
Phase 2 — GATE: PM synthesizes findings ──► USER APPROVAL
        │
        ▼
Phase 3 — strategy doc + trade documents + drawback
           (parallel once gate clears; drawback re-runs per shipment)
        │
        ▼
Phase 4 — logistics coordination
        │
        ▼
Phase 5-6 — audit gate ──► /sync (commit + PR)
```

Key commands (inherited from the common template):

- `/sync "feat: ..."` — full pipeline: memlog → changelog → audit → commit → PR
- `/memlog "summary"` / `/new-task "name"` — session logging and task blocks
- `/meeting "topic"` — structured multi-agent discussion when findings conflict

Never bypass the PM workflow with direct specialist invocation, and never run raw
`git commit` / `git push` — the hooks will reject it.

## 4. Engagement Phase Structure

| Phase | Owner | What happens |
|-------|-------|--------------|
| 0 — Triage | pm | Scope + engagement classification |
| 1 — Parallel research | 6 research specialists (concurrently) | Classification, screening, origin, regulation, certification, market findings |
| 2 — Compliance synthesis gate | pm → **user** | Findings synthesized; approval required before execution |
| 3 — Execution | market-entry-strategist, trade-documentation-specialist, customs-duty-drawback-specialist | Strategy docs, trade docs, drawback assessment (drawback needs the confirmed HS code from Phase 1-2) |
| 4 — Logistics | logistics-coordinator | Delivery / handoff coordination |
| 5-6 — Finalization | pm | Audit → `/sync` → PR |

Reads (research, regulation scans) run in parallel; **writes are serialized** — one
agent writes a given file at a time, coordinated by the PM.

## 5. Where Your Output Goes

| Output | Location |
|--------|----------|
| Compliance & determination reports (HS, drawback, FTA, halal, export control) | `deliverables/reports/` |
| Regulation monitoring briefs | `deliverables/research/` |
| Strategy documents (draft → final) | `deliverables/drafts/` → `deliverables/reports/` |
| Trade document templates / checklists, logistics plans | `deliverables/drafts/` |
| Client-facing decks | `deliverables/presentations/` |
| Session log entries | `memory/YYYY-MM-DD.md` (indexed by `memory/MEMORY.md`) |

Domain rules to keep in mind:

- Label every finding **Korea-based** vs **destination-country-based**; never silently
  reconcile conflicts between jurisdictions.
- Denied-party screening full-name matches are never self-cleared — they always require
  resolution; partial matches are flagged for manual/legal review.
- Duty drawback is a **recurring sub-process**: it re-runs per shipment without
  re-triggering the Phase 2 gate, unless its output would change an approved
  classification.
- Regulation monitoring findings carry source attribution plus a staleness check (any
  source not verified within 30 days of delivery is flagged).
- Agents save deliverables per the Output Destination Mapping table in
  [`co-export.context.md`](co-export.context.md) — folders are created if missing.
