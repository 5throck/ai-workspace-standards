---
name: skill-graph-analytics
version: 1.0.0
description: >
  Weekly fleet analytics over the per-project skill-graph projections:
  consolidate root + Projects/<co-x> graphs into a dated snapshot, triage
  skill convergence (consolidation/promotion candidates) and delivery drift
  (root skills missing from projects), and record findings. Use when: the
  weekly analytics cadence fires (the 02:30 ticket runner may invoke it),
  the user says "skill-graph analytics", "fleet skill graph", "skill graph
  report", or asks which skills the project fleet carries, which root skills
  never reached projects, or what changed fleet-wide since last week.
status: active
scope: workspace
l2_propagate: false
owner: pm
last_reviewed: 2026-09-22
prerequisites: workspace-root CWD; docs/skill-graph.json + Projects/<co-x>/docs/skill-graph.json projections present
relates_to:
  - skill: project-resync
    type: composes_with
  - skill: context-commonization-review
    type: relates_to
metadata:
  type: process
  triggers:
    - skill-graph analytics
    - fleet skill graph
    - skill graph report
    - skill graph fleet report
    - skill convergence triage
---

# Skill: skill-graph-analytics

Weekly fleet analytics over the per-project skill-graph projections
(`Projects/<co-x>/docs/skill-graph.json`, root `docs/skill-graph.json`).
One run answers: which skills does the fleet carry, which root skills never
reached the projects, how far has each project drifted from the root
projection, and what is NEW or VANISHED fleet-wide since the last snapshot?

**Triage only — never auto-modify.** This skill produces tickets and findings;
it does not edit skills, promote content, or rewrite graphs.

## When to Run

- **Weekly cadence** — the scheduled 02:30 ticket runner may invoke this skill;
  otherwise run it at the start of a weekly maintenance session.
- **On demand** — after a fleet-wide skill promotion/upgrade wave, before a
  consolidation decision, or whenever skill-graph drift is suspected.

## Step-by-Step Procedure

### 1. Run the fleet report

```bash
bun scripts/skill-graph-fleet-report.ts
```

Read-only over all inputs. Writes one machine snapshot per local calendar date:
`memory/skill-graph-metrics/snapshot-<YYYY-MM-DD>.json` (same-date reruns
overwrite). First run establishes the baseline — no NEW/VANISHED diff exists yet.
Projects without a graph projection are skipped with a note; zero graphs found
exits 1 (fix the generator, `bun scripts/generate-skill-graph.ts`, before triage).

### 2. Read the snapshot and the report

- **Per-project stats + Jaccard distance vs root** — bigger distance = narrower
  or more divergent projection; small projects are expected to diverge, a large
  project with rising distance is a delivery-gap signal.
- **Presence matrix + top skills** — fleet presence counts per skill id.
- **Root skills missing per project** — the delivery-drift surface.
- **NEW/VANISHED vs the previous snapshot** — fleet-wide skill evolution.

### 3. Triage (judgment — not automatable)

| Signal | Threshold | Action |
|---|---|---|
| Skill present in project graphs but **absent from the root graph** | >= 3 project graphs | Consolidation/promotion candidate — file a ticket: `bun scripts/ticket.ts create --manual "skill-graph: <skill-id> converged in N projects, absent from root — consolidation review" --priority normal` (routes through §3.7.5 governance-backlog triage) |
| **Root skill missing from many projects** | missing from >= 3 project graphs | Delivery-gap candidate — file a ticket naming the skill and the missing projects (likely template-delivery drift; check `templates/common/skills/` and the variant contract) |
| NEW/VANISHED skills in the diff | any | Verify each is intentional (new skill landed / skill deprecated) — unexplained entries are tickets |
| Everything else | — | No action; the snapshot is the record |

**Centrality-readiness note (Phase 2, future work)**: presence counts are a
blunt proxy for importance. A later phase adds centrality ranking over the root
graph (degree/betweenness over `step_uses_skill`/`used_by` edges) per
docs/designs/2026-09-22-skill-graph-fleet-analytics-design.md — do not
over-prioritize a skill on presence alone today.

### 4. Record findings

Append a `## Skill-Graph Fleet Analytics` section to the daily memory log
(`memory/YYYY-MM-DD.md`): snapshot path, headline stats (projects covered,
fleet skill count, top-3 by presence), every ticket filed, and any
delivery-gap or convergence observation that did not merit a ticket.

## Notes

- Name-keyed limitation: presence is keyed by graph node id. Semantic
  duplicates under different ids need content-similarity matching — out of
  scope (design doc §Out of Scope).
- Snapshots accumulate under `memory/skill-graph-metrics/`; they are the input
  for future trend analysis (Phase 3, future work). Do not hand-edit them.
