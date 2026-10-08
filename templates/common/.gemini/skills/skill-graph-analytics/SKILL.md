---
name: skill-graph-analytics
version: 1.2.0
description: >
  Weekly fleet analytics over the per-project skill-graph projections:
  consolidate root + Projects/<co-x> graphs into a dated snapshot, triage
  skill convergence (consolidation/promotion candidates), delivery drift
  (root skills missing from projects), and root-graph orphans (4-way
  cross-check), and record findings. Use when: the weekly analytics cadence
  fires (the 02:30 ticket runner may invoke it), the user says "skill-graph
  analytics", "fleet skill graph", "skill graph report", or asks which skills
  the project fleet carries, which root skills never reached projects, whether
  any agent or skill is orphaned, or what changed fleet-wide since last week.
status: active
scope: workspace
l2_propagate: false
owner: pm
last_reviewed: 2026-10-08
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
    - orphan agent check
    - orphan skill check
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
- **Presence matrix + top skills** — fleet presence counts per skill
  **capability** (frontmatter `capability`, default = skill name; v1 project
  graphs derive it from the bare node id, so v1 and v2 graphs join on the
  same key).
- **Skill convergence by capability** — capabilities carried by >= 3 project
  graphs, split into `converged` (one content hash), `convergence-with-
  divergence` (>= 2 hashes) and `hash-unknown` (a v1 project graph carries no
  hashes yet); see §3 and §3.4.
- **Root skills missing per project** — the delivery-drift surface.
- **Root-graph orphan candidates** — graph-isolated root skills/agents with the
  4-way cross-check axes (see §3.5); feeds the orphan triage rules.
- **NEW/VANISHED vs the previous snapshot** — fleet-wide skill evolution.

### 3. Triage (judgment — not automatable)

| Signal | Threshold | Action |
|---|---|---|
| **Capability** present in project graphs but **absent from the root graph**, `converged` class (single content hash) | >= 3 project graphs | Consolidation/promotion candidate — file a ticket: `bun scripts/ticket.ts create --manual "skill-graph: <capability> converged in N projects, absent from root — consolidation review" --priority normal` (routes through §3.7.5 governance-backlog triage) |
| Capability in the `convergence-with-divergence` class (>= 3 projects, >= 2 content hashes) | any | **Reconciliation candidate, not a promotion candidate** — see §3.4; never auto-promote |
| Capability in the `hash-unknown` class | >= 3 project graphs | Treat as a promotion *candidate* by presence only; content equality is unverified until the carrying v1 projects are upgraded (`upgrade-project` delivers the v2 generator) — compare the SKILL.md files by hand before filing a promotion ticket |
| **Root skill missing from many projects** | missing from >= 3 project graphs | Delivery-gap candidate — file a ticket naming the skill and the missing projects (likely template-delivery drift; check `templates/common/skills/` and the variant contract) |
| NEW/VANISHED skills in the diff | any | Verify each is intentional (new skill landed / skill deprecated) — unexplained entries are tickets |
| **Root-graph orphan candidate** (report section "Root-graph orphan candidates") | any isolated skill/agent | Apply the 4-way orphan criteria below — never treat graph isolation alone as proof of orphanhood |
| Everything else | — | No action; the snapshot is the record |

### 3.4 Divergence triage (capability-based convergence)

Since skill-graph v2 (ADR-0060 Amendment 11) a skill node's identity is
`skill:<scope>/<name>` with a `content_hash`, and fleet convergence groups by
**capability** rather than by raw node id, so same-named skills whose content
differs no longer look identical. For each `convergence-with-divergence`
capability in the report:

1. Read the hash groups (`hash: projects`) and diff the SKILL.md copies of the
   largest and smallest group.
2. Classify: **fork** (intentional variant specialisation — set a distinct
   `capability:` in the forked SKILL.md frontmatter, or keep and record why),
   **drift** (accidental divergence — reconcile to one copy, then the group
   becomes `converged` and a promotion candidate), or **rename** (same job,
   different name — set the same `capability:` on both so they group).
3. File one reconciliation ticket per capability (`bun scripts/ticket.ts create
   --manual "skill-graph: <capability> diverged across N projects — reconcile"
   --priority normal`); never edit the project copies from this skill.

The root `docs/skill-graph.md` section "Same-Name Divergence (E2)" and
`bun scripts/verify-skill-graph.ts` carry the same signal inside the workspace
(`version-drift` = same version, different content — bump or reconcile).
`bun scripts/generate-skill-graph.ts --impact <skill>` lists the agents,
procedures, scopes, tests and contracts a change to a skill touches.

### 3.5 Root-graph orphan cross-check (4-way criteria)

A root skill or agent is an **orphan candidate** only when it is graph-isolated
(zero edges — reported in the fleet report's orphan section since
fleet-report v1.1.0). Isolation alone is NOT proof: classify each candidate by
crossing four axes, all reported in the same section:

| Axis | Meaning | How the report shows it |
|------|---------|------------------------|
| **Definition** | The node exists in the graph (skills/, agents/) | the isolation list itself |
| **Registry** | A SKILLS.md / roster row exists | `registry ✓/✗` |
| **Mirror** | The 4 platform skill bases carry it | `mirrors N/4` |
| **Reference** | Workflow docs mention it (bounded corpus: platform/agent context docs + procedures/ + process/) | `refs N` |

Triage rules:

- **All four axes present** (registry ✓, mirrors 4/4, refs > 0) → *graph-edge
  gap*, not an orphan. Fix the graph, not the skill: add a hand-reasoned
  `docs/skill-graph.overrides.json` entry (`relates_to`, with `reason`/`since`)
  or a workflow-doc citation, then regenerate.
- **Definition + Registry only** (no mirror, no refs) → *weak candidate* —
  wire it into a workflow or schedule deprecation review.
- **Missing registry row or mirrors** → *delivery drift* — the standard
  registry/mirror fixes apply before any orphan verdict.
- **Zero axes beyond definition** → *true orphan* — retire via the
  skill/agent lifecycle manager.
- Agent candidates: mirror axis does not apply (agents are not mirrored);
  weigh roster presence (AGENTS.md §1/§4.1) and doc references instead.

Historical baseline (2026-09-23 audit): 12 L0 + 48 variant skills were
graph-isolated; the workflow-doc citation scan (generator Source 4.8) plus four
overrides entries brought L0 isolation to zero — variant-isolated skills remain
on this cadence's triage list.

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

- Capability-keyed presence: presence is keyed by `capability` (default = skill
  name). Semantic duplicates under *different* names need an explicit shared
  `capability:` in frontmatter (or content-similarity matching — out of scope,
  design doc §Out of Scope). Hashes cover SKILL.md only (supporting files under
  `references/` and `scripts/` are not hashed).
- Snapshots accumulate under `memory/skill-graph-metrics/`; they are the input
  for future trend analysis (Phase 3, future work). Do not hand-edit them.
