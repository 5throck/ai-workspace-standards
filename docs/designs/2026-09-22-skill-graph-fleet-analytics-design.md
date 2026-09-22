# Design: skill-graph fleet analytics (skill-graph-fleet-report.ts + skill-graph-analytics skill + skill-graph-analyst agent)

- **Spec ID**: `2026-09-22-skill-graph-fleet-analytics`
- **Date**: 2026-09-22
- **Status**: implemented
- **Owner**: automation-engineer (implementation) / pm (ADR-0080 team decision)
- **Artifacts**: `scripts/skill-graph-fleet-report.ts` 1.0.0 (new, L0-only) · `skills/skill-graph-analytics/SKILL.md` 1.0.0 (new) · `agents/skill-graph-analyst.md` 1.0.0 (new)

## Problem

Every variant project carries its own projection of the workspace skill graph
(`Projects/<co-x>/docs/skill-graph.json`, generated per ADR-0083/DEG v1), and the
root carries `docs/skill-graph.json` — but nothing ever consolidates the
per-project projections. There is no fleet-wide visibility into:

- which skills the fleet actually carries (and how widely each one propagated),
- which root-graph skills never reached a project's graph (delivery drift),
- how far each project's node set has drifted from the root projection,
- which skills are NEW or VANISHED fleet-wide between two points in time
  (skill evolution / convergence signal).

Consequently, consolidation candidates (skills converged across many projects
but absent from the root graph) and delivery gaps (root skills missing from
many projects) are discovered only by accident.

## Decision

Read-only consolidation report + dated machine snapshots. No graph is modified.

1. **Script** (`scripts/skill-graph-fleet-report.ts`, L0-only, v1.0.0):
   - Inputs: root `docs/skill-graph.json` + every `Projects/<co-x>/docs/skill-graph.json`
     (scanned dynamically; projects without a graph are skipped with a note —
     11 of the fleet's projects carry graphs as of 2026-09-22).
   - Parses the graph generically from what the files show: nodes are
     `{id, type, layer}` (skill nodes = `type: "skill"`), edges are
     `{type, from, to, ...}` with edge types such as `step_by_agent`,
     `step_uses_skill`, `used_by`, `relates_to`. No node/edge-type vocabulary
     is hardcoded beyond the skill-node type.
   - Computes: (a) per-project node/edge/skill-node counts; (b) the
     skill x project presence matrix with fleet presence counts; (c) root skills
     missing from each project's graph (full list in the snapshot, capped display
     in the human report); (d) project-vs-root node-set **Jaccard distance**
     (`1 - |A∩B| / |A∪B|`, bigger = more drift); (e) a NEW/VANISHED skill diff
     against the newest previous snapshot (fleet-wide: project-carried skills
     plus root skills — a previous snapshot's root set is recovered from its
     `missingFromProjects` union); (f) the top-10 skills by fleet presence.
   - Output: human-readable report on stdout; machine snapshot written to
     `memory/skill-graph-metrics/snapshot-<YYYY-MM-DD>.json` (local calendar
     date via `scripts/lib/local-date.ts`; one snapshot per date — same-date
     reruns overwrite). `--json` prints the snapshot JSON instead of the report.
   - Exit 0 normally; exit 1 when zero graphs are found. Read-only over all
     inputs — the snapshot file is the only write.
   - Snapshot schema: `{date, projects: {name: {nodes, edges, skills}},
     fleetPresence: {skillId: count}, missingFromProjects: {project: [skillIds]},
     jaccard: {project: number}}`.

2. **Skill** (`skills/skill-graph-analytics`, v1.0.0): the weekly (or on-demand)
   fleet analysis cadence — run the report, read the snapshot, triage
   (>=3-project convergence without root presence -> consolidation/promotion
   ticket; root skills missing from many projects -> delivery-gap ticket),
   record findings in the daily memory log. Triage only: the skill never
   modifies skills or graphs directly.

3. **Agent** (`agents/skill-graph-analyst`, v1.0.0, **low tier** — read-only
   analysis + ticket filing, matching the lightweight analyst profile):
   owns the weekly cadence. **ADR-0080 gate-moment decision (hiring)**: fleet
   skill-graph analytics is a new recurring work type (weekly cadence) with no
   owning role — PM hires this specialist persona to absorb it. Decision
   recorded here per ADR-0080; PM retains dispatch authority (PM-ONLY
   invocation). Non-goals: no skill modification, no promotion execution —
   tickets only.

## Out of Scope (recorded as future work — NOT built)

- **Phase 2 — centrality ranking**: degree/betweenness centrality over the
  root graph to rank skills by structural importance (how many procedures/
  stages/agents reference them). The report's presence matrix is the input
  surface; the snapshot schema deliberately stays centrality-ready.
- **Phase 3 — spectral trend analysis**: time-series over accumulated
  snapshots (Jaccard trends, presence deltas, eigenvector-based convergence
  scoring). Requires >= 2 snapshots of history to be meaningful.
- **Name-keyed limitation**: the presence matrix keys skills by graph node id.
  Semantic duplicates under different ids need content-similarity matching —
  out of scope for v1.0.0.

## Verification Results (2026-09-22)

Baseline snapshot (`memory/skill-graph-metrics/snapshot-2026-09-22.json`,
regenerated after the new agent/skill joined the graph projection):

- Root graph: 849 nodes / 2103 edges / 198 skill nodes; 11/11 project graphs loaded.
- Fleet-wide skill set: 259 distinct skill ids (30 carried by all 11 projects;
  42 present in >= 3 projects; 27 root-only, carried by zero projects).
- Top-3 by fleet presence (11/11 each): `accessibility-audit`,
  `agent-lifecycle-manager`, `api-documentation`.
- Jaccard distance vs root: 0.687 (co-consult, closest) to 0.933 (co-architect,
  most divergent) — small projects legitimately carry narrow projections.
- NEW/VANISHED diff: n/a on the baseline run (reported as "baseline
  established"); verified by a second run against the baseline snapshot
  (empty diff) and by the zero-graph exit-1 path.
