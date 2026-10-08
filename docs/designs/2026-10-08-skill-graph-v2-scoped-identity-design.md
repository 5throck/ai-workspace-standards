# 2026-10-08 Skill Graph v2: Scoped Node Identity with Capability Grouping — Design

- **Date**: 2026-10-08
- **Status**: proposed
- **Spec id**: `2026-10-08-skill-graph-v2-scoped-identity-design`
- **Owner**: architect (design); automation-engineer (implementation)
- **Related**: ADR-0060 (skill relationship graph as generated projection), `scripts/generate-skill-graph.ts`, `scripts/verify-skill-graph.ts`, `scripts/skill-graph-fleet-report.ts`, `skills/skill-graph-analytics/SKILL.md`, `scripts/skill-session-review.ts`, `docs/skill-graph.json`, `docs/skill-graph.overrides.json`

## 1. Context

PM inspection of `docs/skill-graph.json` (version 1, profile `deg/v1`, 1038 nodes / 2984 edges; `verify-skill-graph` passes) found six defects:

| Id | Defect | Root cause |
|----|--------|-----------|
| G1 | Agent nodes keyed by bare name; first-seen wins (e.g. one `code-writer` node, layer `variant:co-abap`; `skill-graph.md` prints "code-writer, code-writer") | `generate-skill-graph.ts` ~L537/553/572/1674 dedupe on `agent:<name>` |
| G2 | Skill nodes keyed by bare name; variant skills with the same name but different content collapse (pdf-export co-deck 2.1.1 vs co-price 1.1.0; executive-presentation, competitive-intelligence, insight-synthesis co-consult vs co-price all "1.0.0"; consulting-report-writing, org-readiness-assessment co-consult vs co-hr; code-review co-develop vs co-game) | same dedupe on `skill:<name>` |
| G3 | 160 `phase` edges target `phase1..N` nodes that are never emitted | manifest `phases[]` emitted as edges only |
| G4 | 52 exact duplicate edges; 128 duplicate `(from,to,type)` triples | no edge-key dedupe |
| G5 | 61 isolated nodes (54 adr, 5 agent, 2 decision) | no isolation report |
| G6 | 114/203 skills have no `used_by` edge | SKILL.md `required_by` / manifests incomplete |

The verifier misses G1–G4 because it checks schema shape, not referential integrity or uniqueness.

**Hard constraint.** Fleet convergence detection (`skill-graph-analytics` SKILL.md ~L84; `scripts/skill-graph-fleet-report.ts` presence matrix) promotes a skill toward common when the same skill id appears in >= 3 project graphs. Renaming divergent skills, or naively making ids scope-unique, would break that match: `skill:co-deck/pdf-export` and `skill:co-price/pdf-export` would never meet. **No skill is renamed by this design.**

## 2. Alternatives

| Option | Description | Verdict |
|--------|-------------|---------|
| A. Rename divergent skills | `pdf-export` -> `deck-pdf-export` etc. | Rejected: user constraint; breaks convergence history and project references |
| B. Keep bare ids, attach `variants[]` array to one node | One node per name, list per-scope versions/hashes inside | Rejected: edges (`used_by`, `step_by_agent`) still cannot say which copy; G1 remains for agents; impact query ambiguous |
| C. Fully scoped ids, convergence on id | `skill:<scope>/<name>` everywhere | Rejected: breaks fleet convergence (ids never coincide across projects) |
| **D. Content-addressed scoped ids + `capability` grouping key** | Ids scoped only when content diverges; every node carries `name`, `scope`, `content_hash`, `version`, `capability`; convergence groups by `capability` | **Chosen** |

## 3. Decision (Option D)

### 3.1 Node identity

- Node id format: `skill:<scope>/<name>` and `agent:<scope>/<name>`, where `scope` is `root`, `common`, or `<variant>` (e.g. `co-deck`).
- **Identical-content collapse**: all copies of a skill/agent with the same `name` and same `content_hash` (root, `templates/common`, `.claude/skills`, `.gemini/skills`, platform mirrors, and any variant carrying an identical copy) collapse to one node. Its `scope` is the highest-precedence scope among the copies (`root` > `common` > variant, variants alphabetical), and `mirrors[]` lists every path.
- Distinct content under the same name yields one node per distinct hash, each scoped by its highest-precedence location.
- `content_hash`: sha256 (first 16 hex) of the SKILL.md / agent .md with frontmatter `version`, `last_updated` and trailing whitespace normalized out, so mirrors that differ only by metadata stamp still collapse. Supporting files (`references/`, `scripts/`) are not hashed in v2 (documented limitation).
- Every skill/agent node carries: `name`, `scope`, `content_hash`, `version`, `capability`, `mirrors[]`, `layer` (kept for v1 consumers).
- `capability`: optional new SKILL.md / agent frontmatter field; defaults to `name`. It lets an intentionally renamed skill still group with its siblings, and lets a deliberately unrelated same-named skill opt out (set a different capability). No existing file is edited by this PR; the default makes it a no-op.

### 3.2 Edge resolution

Edges originating inside a scope (variant manifest `used_by_agents`, procedure `step_by_agent`, SKILL.md `required_by`) resolve names **scope-first**: same variant, then `common`, then `root`. Unresolvable references are reported (see §6) rather than emitted as dangling edges.

### 3.3 Convergence with divergence

Fleet convergence groups nodes by `capability`, not by id:

- `converged`: capability present in >= 3 project graphs with a single `content_hash` — unchanged promotion candidate.
- `convergence-with-divergence`: capability present in >= 3 projects but with >= 2 hashes — new report section; a reconciliation candidate, not auto-promoted.
- Same capability, same `version`, different hash (G2 cases) is flagged as **version-drift** (E2).

v1 project graphs have no `capability`; the fleet reader derives `capability = name` from the bare id (`skill:<name>`), so v1 and v2 graphs join on the same key.

## 4. Schema v2

```jsonc
{
  "version": 2,
  "graph_profile": "deg/v2",
  "nodes": [
    { "id": "skill:co-deck/pdf-export", "type": "skill", "name": "pdf-export",
      "scope": "co-deck", "capability": "pdf-export", "content_hash": "3f9a…",
      "version": "2.1.1", "layer": "variant:co-deck", "mirrors": ["templates/co-deck/skills/pdf-export/SKILL.md"],
      "usage": { "sessions": 4, "last_used": "2026-10-06" } },
    { "id": "phase:co-deck/3", "type": "phase", "scope": "co-deck", "ordinal": 3 }
  ],
  "edges": [ { "from": "skill:co-deck/pdf-export", "to": "agent:co-deck/deck-builder", "type": "used_by" } ]
}
```

- `phase` nodes (G3 decision): **emit nodes** `phase:<scope>/<n>` (label from `docs/phase-definitions.md` when present). Rationale: the edges already exist and consumers (`generate-raci.ts`, `procedure-coverage.ts`, `experiments/infer-graph-from-phases.ts`) traverse them; converting to an attribute would be a larger consumer change. Phase is scoped because phase numbering is per variant.
- `usage` (E3): optional node attribute; no new edge type, to keep the edge vocabulary stable.
- `version: 2` and `graph_profile: 'deg/v2'` in the `SkillGraph` type (~L202).

## 5. Backward compatibility

- Add `scripts/lib/skill-graph-compat.ts` exporting `loadSkillGraph(path): SkillGraphV2` that upgrades v1 in memory: `skill:<name>` -> `skill:<layer-scope>/<name>`, `capability = name`, `content_hash = null`, dangling phase targets materialized as phase nodes, duplicate edges dropped. All readers go through it.
- Projects/*/docs/skill-graph.json stay v1 until `upgrade-project` delivers the new generator; the fleet report must handle a mixed v1/v2 fleet (convergence on `capability`; divergence only computable where hashes exist — v1 entries are reported as `hash-unknown`).
- `docs/skill-graph.overrides.json`: entries keyed by bare id (`skill:<name>`) remain valid; the generator resolves a bare override to every node with that `name` (warn if > 1 and the override sets content-specific fields). Scoped keys are accepted going forward. No migration of the file in this PR.

## 6. Verifier invariants (`verify-skill-graph.ts`)

New ERRORs:
1. No dangling edges: every `from`/`to` exists as a node.
2. No duplicate edges on `(from, to, type)` (G4).
3. Node id uniqueness, and `(name, scope, content_hash)` uniqueness for skill/agent nodes.
4. Id/attribute consistency: `id == type + ':' + scope + '/' + name` for skill/agent/phase.
5. No two nodes share `(name, content_hash)` (would mean failed collapse).

New WARN/INFO (non-blocking, reported counts):
- Isolated nodes (G5), broken down by type. ADR and decision nodes are INFO (expected until `references` edges from docs are mined); isolated agents are WARN.
- Skills with no `used_by` (G6) as WARN, with E4 suggestions attached.
- Same-name divergence summary (E2) as WARN.

## 7. Enhancements

| Id | Feature | Placement |
|----|---------|-----------|
| E1 | `--impact <skill>` (name or scoped id): BFS over reverse edges, grouped output — agents, procedures, variants (scopes + mirrors), tests (files under `tests/` referencing the name, via node `references` edges or a literal scan), contracts (`contracts/`/schema nodes). Name input expands to all nodes of that capability. | `scripts/generate-skill-graph.ts --impact` (read-only mode, no write) |
| E2 | Same-version-different-content detector across variants | New check in `scripts/verify-skill-graph.ts` reading the graph (the hashes are already computed); surfaced as a section in `validate-templates` output by calling the same helper. WARN, not ERROR, in this PR. |
| E3 | Join `memory/*.md` `## Skills Used` (parser reused from `scripts/skill-session-review.ts`, extracted to an exported function) into `usage.sessions` / `usage.last_used`; report `unused` (0 sessions in 90 days) and `used-but-unlinked` (usage > 0 and no `used_by`). Names resolve via capability. | generator + `skill-graph.md` sections |
| E4 | Suggest `required_by` agents for skills lacking `used_by`, inferred from procedures whose steps cite the skill and are owned via `step_by_agent`. Report-only section in `skill-graph.md` and verifier WARN detail. **Never edits SKILL.md.** | generator |

## 8. Consumers that must change

| File | Change |
|------|--------|
| `scripts/generate-skill-graph.ts` | scoped ids, hashing, collapse, scope-first resolution, phase nodes, edge dedupe, E1/E3/E4, v2 header |
| `scripts/lib/skill-graph-compat.ts` (new) | v1->v2 loader, `capabilityOf(node)` |
| `scripts/verify-skill-graph.ts` | §6 invariants, E2 |
| `scripts/skill-graph-fleet-report.ts` | load via compat; presence matrix keyed by capability; new convergence-with-divergence + hash-unknown sections |
| `scripts/generate-raci.ts`, `scripts/procedure-coverage.ts`, `scripts/graph-delta-log.ts` | load via compat; match agents/skills by `name` (or scoped id) instead of bare id string; delta log diffs on scoped id and reports v1->v2 transition once as a migration, not 1000 changes |
| `scripts/audit.ts`, `scripts/dev-sync.ts`, `scripts/lifecycle-sync-audit.ts` | only if they parse ids/version; otherwise unchanged (verify by grep during implementation) |
| `scripts/lib/upgrade-policy.ts`, `scripts/upgrade-project.ts`, `scripts/new-project.ts`, `scripts/l3-to-variant-pipeline.ts` | confirm `docs/skill-graph.json` still regenerated (not copied) per project; no logic change expected |
| `scripts/experiments/infer-graph-from-phases.ts` | load via compat; phase node ids |
| `tests/reflect-skill-graph-to-project.ts`, `tests/unit/skill-graph-variant-ordering.test.ts`, `tests/unit/upgrade-policy*.test.ts`, `tests/unit/scaffold-delivery-parity.test.ts` | update fixtures/expectations for v2 ids |
| `skills/skill-graph-analytics/SKILL.md` | convergence now by capability; new divergence triage step |
| `scripts/SCRIPTS.md` | version bumps, new compat lib entry |
| `templates/common/scripts/*` mirrors | propagated by `dev-sync` (do not hand-edit); confirm compat lib is on the delivery list |

## 9. ADR-0060 amendment

Required. Add an Amendment: (a) node identity is `type:scope/name` with content-hash collapse; (b) `capability` is the cross-project grouping key and is the contract for fleet convergence; (c) referential-integrity and uniqueness are verifier invariants; (d) v1 graphs are read through a compat loader for one template minor cycle, after which v1 support may be dropped by a follow-up ADR.

## 10. Acceptance criteria

1. `docs/skill-graph.json` is `version: 2`, `deg/v2`; `verify-skill-graph` passes with the §6 ERROR invariants enabled.
2. 0 dangling edges, 0 duplicate `(from,to,type)` triples.
3. Each of the G2 skills appears as one node per distinct content hash with the correct scope and version; `code-writer` appears once per distinct agent content; `skill-graph.md` no longer prints duplicate bare names without scope.
4. Mirror copies with identical content (root / common / .claude / .gemini) produce exactly one node.
5. Fleet report run against the current (all v1) Projects/* produces the same converged set as before this change (regression), plus divergence sections.
6. `--impact pdf-export` lists both scoped nodes and their dependents.
7. E2 reports the eight G2 skill pairs as same-version-different-content where versions are equal (pdf-export reported as divergence, not version-drift).
8. E3/E4 sections present; no SKILL.md modified by the generator (asserted by test).
9. No skill or agent file renamed; `git diff --stat` touches only files listed in §11.
10. `bun scripts/audit.ts` passes.

## 11. Test plan

- Unit `tests/unit/skill-graph-v2-identity.test.ts`: fixture tree with root+common identical mirrors (collapse to one), two variants with same-name different-content (two nodes), metadata-only diffs (collapse), scope-first edge resolution, phase node emission, edge dedupe.
- Unit `tests/unit/skill-graph-compat.test.ts`: v1 fixture upgrades; capability derived; duplicate/dangling edges removed.
- Unit `tests/unit/verify-skill-graph-invariants.test.ts`: each ERROR invariant fails on a crafted bad graph.
- Unit fleet test: mixed v1+v2 fixture fleet; converged, convergence-with-divergence, hash-unknown classification; threshold 3 preserved.
- Unit E1/E3/E4: impact BFS on fixture; `## Skills Used` parse; suggestion derivation; generator never writes outside `docs/`.
- Regression: regenerate real `docs/skill-graph.json`, run verifier and fleet report; diff converged set against pre-change output (AC 5).

## 12. Implementation plan (one PR, ordered)

1. `scripts/lib/skill-graph-compat.ts` + its test (types `SkillGraphV2`, `loadSkillGraph`, `capabilityOf`).
2. Extract `parseSkillsUsed()` from `scripts/skill-session-review.ts` into an export (no behaviour change).
3. `generate-skill-graph.ts`: hashing + scoped ids + collapse + scope-first resolution + overrides bare-key fan-out; phase nodes; edge dedupe; v2 header; `skill-graph.md` rendering with scope.
4. E3/E4 sections and `--impact` mode in the generator.
5. `verify-skill-graph.ts`: §6 invariants + E2 helper; hook E2 summary into `validate-templates`.
6. Port consumers in §8 to the compat loader (fleet report first, then raci, procedure-coverage, graph-delta-log, experiments).
7. Update existing tests/fixtures; add new tests from §11.
8. Regenerate `docs/skill-graph.json` / `docs/skill-graph.md`; run verifier, fleet report regression, `bun scripts/audit.ts`.
9. ADR-0060 amendment; `skills/skill-graph-analytics/SKILL.md` and `scripts/SCRIPTS.md` updates; CHANGELOG via `/sync` (which also mirrors `templates/common/scripts`).

## 13. Out of scope

- Editing any SKILL.md to add `capability` or `required_by` (E4 is report-only).
- Reconciling the divergent G2 skill pairs (separate tickets per pair after the first divergence report).
- Hashing skill supporting files; mining `references` edges to de-isolate ADR nodes.
- Upgrading Projects/* graphs (happens via normal `upgrade-project`).
