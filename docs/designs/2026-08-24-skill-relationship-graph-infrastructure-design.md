# Skill Relationship Graph Infrastructure — Implementation Design

- **Date**: 2026-08-24
- **Status**: Implemented (PR2 of the 10-PR 5-part design series)
- **Anchoring ADR**: [ADR-0060 — Skill Relationship Graph as Generated Projection](../adr/0060-skill-relationship-graph-generated-projection.md)
- **Source**: PM plan mode (owner-approved 2026-08-24; forks: single unified graph file, advisory edges, L0-only tooling)

## Problem

Skill↔skill relationships had no machine-readable representation — `prerequisites` was free text, agent↔skill edges were split between agent `required_skills` and variant.json `skill_manifest`, and prose references were undiscoverable. The owner required a contextual linking structure whose relations are NOT permanent (mutable, advisory), which rules out a hand-maintained registry.

## Design

**Generated projection, not registry**: the graph is always re-derivable from SSOT sources (skills/, agents/, variant.json). Skills stay self-contained; the graph is a build artifact with a drift gate, mirroring the README rendering engine pattern.

**Edge sources (priority order)**:
1. SKILL.md frontmatter `prerequisites` (parsed, advisory) + new optional `relates_to: [skill-name]`
2. Agent `required_skills` (workspace agents/ + templates/*/agents/)
3. variant.json `skill_manifest.variant_specific[].used_by_agents` / `phases`
4. Backtick prose references — exact matches against the known-skill-name set only (false-positive guard)
5. `docs/skill-graph.overrides.json` — non-derivable relations escape hatch (`{type, from, to, reason, last_reviewed, expires_at?}`); expiry/deletion is the mutability mechanism

**Edge types** — `requires` / `relates_to` / `used_by` / `phase` / `supersedes`, all advisory (no runtime dependency semantics), every edge carries a `source` attribution.

**Artifacts**: `docs/skill-graph.json` (machine; shape `{version, nodes[{id,type,layer}], edges[{type,from,to,source,reason?}]}`), `docs/skill-graph.md` (human: per-skill relation table + phase grouping), both committed. Byte-stable generation (no timestamps, stable sort) so drift diffs are meaningful.

**Invariants enforced by the verifier**:
- Committed graph == re-derived graph (node id/type/layer + edge identity from+to+type+source); drift = exit 1, capped 20-line diff, remedy line
- No country marks in relation fields (extends the country_scoped_assets invariant; codes loaded from workspace-schema)
- `relates_to` and override targets must resolve to known nodes
- Overrides stale >12 months (`last_reviewed`) WARN only

**Pipeline wiring**: dev-sync step 4.65 (between 4.6 sync-skills and 4.7 VERSION_MANIFEST) — generate → verify, fatal on failure. `existsSync`-guarded so scaffolded projects skip it; both scripts are L0-only per the SCRIPTS.md layer column (same skip pattern as the 3.97 governance gate).

## Files

| File | Role |
|---|---|
| `scripts/generate-skill-graph.ts` (1.0.0, L0-only) | Scans sources, emits json+md; exports `buildGraph()` |
| `scripts/verify-skill-graph.ts` (1.0.1, L0-only) | Drift + invariant gate |
| `docs/skill-graph.json` / `.md` / `.overrides.json` | Committed projection + seeded-empty overrides |
| `scripts/dev-sync.ts` (1.7.3) | Step 4.65 fatal gate |
| `skills/SKILLS.md` | Relations-not-here note → generated graph |

## Verification (PM independent battery)

- Clean: 197 nodes (97 skills + 100 agents), 430 edges, exit 0; re-run byte-identical
- Negative fixtures (applied → exit 1 → restored): tamper-appended edge; deleted edge; `relates_to: ["k-dart (KR)"]` (country mark); `relates_to: ["nonexistent-skill"]` (unknown target)
- validate-templates 0 errors (L0/L1 dev-sync drift caught and fixed via propagate); audit all-pass; verify-scripts 159/159, --check-drift clean

## Series Context

PR1 (#638) landed ADR-0060/0061/0062. This PR implements ADR-0060. Later PRs consume the graph (PR9 benchmark backlog queries it) and add frontmatter `relates_to` opt-in usage. The spec-relevance gate (step 3.9) is satisfied by this design doc per ADR-0055 Stage 2.
