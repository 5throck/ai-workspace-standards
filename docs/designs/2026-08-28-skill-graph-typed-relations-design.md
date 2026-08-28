# Skill Graph Typed Relations + Scaffold-Time Project Graph

| Field | Value |
|-------|-------|
| Date | 2026-08-28 |
| Status | accepted (user-approved, 3-option AskUserQuestion confirmed all three) |
| Spec ID | `skillgraph` |
| Governing anchor | [ADR-0060](../adr/0060-skill-relationship-graph-generated-projection.md) + Amendment 3 (this PR) |
| Related | `docs/designs/2026-08-28-skill-graph-template-rollout-design.md` (Amendment 2, PR4); `docs/designs/2026-08-25-skill-graph-document-layer-design.md` |

## Problem

ADR-0060 + two prior amendments built the 3-tier skill graph architecture (L0 unified
graph, per-template scoped graphs, project-local generation via propagated scripts wired
into `dev-sync.ts` step 4.65). Three concrete gaps remained:

1. **Relation vocabulary is schema-only.** `relates_to` (structured array) exists in the
   schema but zero skills used it; `prerequisites` is populated (24 L0 + 140 template
   skills) but as unstructured free text, not a typed relation. No `composes_with` /
   `follows` / `enables`, no `inputs`/`outputs` concept.
2. **Project graphs are lazy, not scaffold-time.** `new-project.ts` never touched the
   graph; a project only got `docs/skill-graph.json` on its first `/sync`.
3. **No lifecycle/versioning/migration/snapshot layer** for skill relations — the
   user's broader design proposal (6-phase DISCOVER→RETIRE lifecycle, migration
   windows, execution-time graph snapshots) is a substantially larger governance
   system layered on top of the graph.

Given ADR-0060's standing principles — **generated projection only**, **all edges
advisory**, and the explicit historical rejection of over-scoping in a single PR — item
3 was judged too large to implement safely in one pass. This design delivers items 1
and 2 now (Phase 1), documents a schema-evolution boundary so nothing built now blocks
item 3 later, and records item 3 as a structured multi-phase roadmap.

## User-Confirmed Decisions

1. Extend `relates_to` with typed relation vocabulary (`composes_with`/`follows`/
   `enables`), backward compatible with the existing bare-string-array form.
2. Add `inputs`/`outputs` as new optional frontmatter fields — opaque labels, not
   artifact identity.
3. Generate the project graph at scaffold time (`new-project.ts`), not lazily at first
   `/sync`.
4. Document (not implement) the schema-evolution boundary and the Phase 2–5 roadmap.

## Change Design

### D1 — `generate-skill-graph.ts` v1.3.0 → v1.4.0

- **Typed relation vocabulary.** `EdgeType` gains `composes_with | follows | enables`
  alongside the existing `requires | relates_to | used_by | phase | supersedes |
  references | cites_skill`. Normative definitions (verbatim from the approved plan,
  also restated in ADR-0060 Amendment 3):
  - **`requires`** (from `prerequisites`): A requires B = B is a mandatory prerequisite
    for A, direction A→B. Loose on *how* satisfied (existence vs. prior execution) —
    deliberately not narrowed, since Phase 4 artifact nodes need the same edge type to
    work for both skill→skill and skill→artifact targets.
  - **`enables`** (typed `relates_to`): A enables C = A's output makes C
    possible/unlocked, direction A→C. Not the inverse of `requires` — C may still be
    usable without A having run.
  - **`follows`**: A follows B = pure sequencing/ordering, no dependency implication
    either direction.
  - **`composes_with`**: symmetric — declared once from either skill's frontmatter,
    interpreted as true in both directions. **Materialization**: stored as a single
    directed edge (source→target as declared) carrying `symmetric: true`. Consumers
    MUST interpret a `symmetric: true` edge as traversable both ways while the graph
    preserves only the single stored representation — avoids double-counting in drift
    diffs and de-duplication logic in the verifier.
  - **Legacy vs. typed `relates_to` — no mixed arrays.** Within one skill's
    `relates_to`, entries are either all bare strings (legacy, generic `relates_to`
    edges — zero migration required for existing files) or all typed `{skill, type}`
    objects — never mixed. **Rejection happens at the schema-validation layer, not the
    YAML-parse layer**: a mixed array is syntactically valid YAML (parses fine), and a
    separate validation step (`parseRelatesTo()`, shared by generator and verifier)
    rejects it with:
    `"relates_to must contain either all string entries or all typed relation objects; mixed entries are not allowed"`
- **`inputs`/`outputs`**: new optional frontmatter fields, `inputs: [label, ...]` /
  `outputs: [label, ...]`. Documented as plain **labels**, not "artifacts" — avoids
  presupposing artifact identity so Phase 4's promotion to first-class artifact nodes
  isn't pre-constrained. Rendered per-skill in `docs/skill-graph.md`; the generator
  treats them as opaque strings, no resolution against any node type in Phase 1.
- **Parser swap.** `parseFrontmatter()` now uses `js-yaml` (`load()`) instead of the
  previous hand-rolled single-line-`key: value`/inline-`[a,b]` regex parser, so the
  nested `relates_to: - skill: ... type: ...` block parses correctly. **Dependency
  decision**: `js-yaml` was already a dependency of both the root and
  `templates/common` `package.json` (used by `generate-version-manifest.ts`,
  `resolve-variants.ts`, `propagate-to-templates.ts`, `validate-templates.ts`,
  `new-project.ts`) — no new dependency was added. Scoped strictly to the text between
  the `---`/`---` delimiters; the Markdown body is untouched, verified by a fixture
  (fenced code block containing `key: value`-shaped lines inside the body) that
  confirms the body passes through unparsed. **Fallback**: a small number of
  pre-existing `docs/decisions/DEC-*.md` frontmatter blocks contain prose values with
  unescaped `key: value`-shaped colons that are not strict YAML (tolerated by the old
  regex parser, rejected by `js-yaml`). `parseFrontmatter()` falls back to the legacy
  line parser (`legacyParseFrontmatterLines()`) on a `YAMLException`, so non-SKILL.md
  consumers of `parseFrontmatter()` see zero behavior change — fixing those decision
  records' YAML is out of this pass's scope.
- **Edge provenance.** Every edge produced from SKILL.md `prerequisites`/`relates_to`
  and agent `required_skills` gains `provenance: {file, field, index?}` (JSON-only, not
  rendered in `docs/skill-graph.md`), recording exactly which frontmatter field/entry
  produced it. Cheap at generation time (the generator already has the file path and
  array index in hand) and is a direct prerequisite for Phase 5's audit-trail goal.
  Other edge sources (variant.json `skill_manifest`, prose backtick references,
  document-layer edges) are unchanged and do not carry `provenance` in this pass — the
  plan's motivating cases (typed relates_to review, "where was this edge defined")
  are SKILL.md-frontmatter-sourced.

### D2 — `verify-skill-graph.ts` v1.1.0 → v1.2.0

`validateRelations()`'s `relates_to` check was a line-regex scan
(`relates_to:\s*\n((?:\s*-\s*[^\n]+\n?)+)`) that only matched every-line-starts-with-`-`
blocks — it would mis-tokenize a typed multi-line entry (`- skill: name\n  type: ...`),
only capturing the first line. Replaced with the real parser
(`parseFrontmatter()` + the shared `parseRelatesTo()`), so both legacy and typed forms
are checked correctly for country marks and unknown targets, and a mixed array is
reported as a finding (not silently mis-parsed).

### D3 — `new-project.ts` v1.8.0 → v1.9.0: scaffold-time graph generation

New step 7.6, inserted after `bunInstall(projectDir)` (so `node_modules/js-yaml` is
present) and before the security bootstrap check: runs the propagated
`scripts/generate-skill-graph.ts` **inside the new project directory** (`cwd:
projectDir`, plain non-scope invocation — the same pattern `dev-sync.ts` step 4.65
already uses). The generator's own run-context auto-detection (`ROOT/templates`
absent) tags every discovered skill/agent `L3`, matching a project-local run — no new
detection logic needed in `new-project.ts` itself. Does not copy any upstream graph
("projects never receive a copy of any upstream graph" — Amendment 2 stands); derives
fresh from whatever the variant overlay just placed in `projectDir/skills`,
`projectDir/agents`. **Non-fatal**: missing `bun`, missing generator script, or any
generation error prints a warning and continues — the existing `dev-sync.ts` step 4.65
`existsSync` gate still generates the artifact on the project's first `/sync` if
scaffold-time generation was skipped.

## Registrations

| File | Change |
|------|--------|
| `docs/adr/0060-skill-relationship-graph-generated-projection.md` | Amendment 3 appended |
| `scripts/generate-skill-graph.ts` | v1.4.0 |
| `scripts/verify-skill-graph.ts` | v1.2.0 |
| `scripts/new-project.ts` | v1.9.0 |
| `scripts/SCRIPTS.md` (+ `templates/common/scripts/SCRIPTS.md` L1 mirror) | three version rows + last-updated note |
| `docs/skill-graph.json` / `.md` (L0) | regenerated, 0 drift beyond the new typed-relation content |
| `templates/{common,co-*}/docs/skill-graph.json` (14 scopes) | regenerated, 0 drift |
| `templates/co-consult/skills/{executive-presentation,technical-feasibility,org-readiness-assessment,financial-modeling}/SKILL.md` | typed `relates_to` + `inputs`/`outputs` proof-of-concept (4 skills, not a mass migration) |
| `docs/designs/2026-08-28-skill-graph-typed-relations-design.md` | this document |
| `CHANGELOG.md`, `memory/2026-08-29.md` | entries |

L1 mirrors of `generate-skill-graph.ts`/`verify-skill-graph.ts` propagated via
`bun run propagate:apply`.

## Verification

| Check | Result |
|-------|--------|
| Parser regression: derived edge-set diff (old committed L0 graph vs. new parser) | 0 missing edges; 4 *extra* correct edges surfaced — the old regex parser silently dropped multi-line YAML list frontmatter (e.g. `templates/common/agents/i18n-specialist.md` `required_skills:\n  - i18n-locale-config\n  ...`); the new parser correctly derives them. Net-positive correctness fix, not a regression. |
| Frontmatter-only-scope fixture (fenced `key: value` in Markdown body) | Passes — body content unaffected, only the `---`/`---` block is parsed |
| `relates_to` form fixtures (legacy / typed / mixed-rejected / unknown-key-tolerated) | All 4 pass — mixed array throws the exact specified message; unknown future key (`status: active`) preserved on `extra`, not rejected |
| `bun scripts/generate-skill-graph.ts` (L0) + `verify-skill-graph.ts` | 294 nodes, 660 edges (was 648; +5 composes_with, +3 enables from the 4 proof-of-concept skills, +4 previously-mis-parsed edges); verify passes 0 drift |
| `bun scripts/generate-skill-graph.ts --scope co-consult` + typed relation JSON inspection | `symmetric: true` on all 5 `composes_with` edges; `provenance: {file, field, index}` present on every relates_to/prerequisites/required_skills edge |
| `generate` + `verify --scope <S>` for all 14 template scopes | All pass, 0 drift |
| `bun scripts/new-project.ts test-graph-init(2) --variant co-consult` (throwaway, cleaned up after) | `docs/skill-graph.json` present immediately after scaffolding, all nodes tagged `L3`, before any `/sync` |
| `bun scripts/audit.ts` (L0) | 0 errors (pre-existing WARN-only findings unrelated to this change) |
| `bun scripts/validate-templates.ts` | 0 errors, 3 pre-existing warnings |
| `lifecycle-sync-audit.ts` inside a scaffolded project | Failed once (SCRIPTS.md version mismatch) until the L1 `templates/common/scripts/SCRIPTS.md` mirror rows were updated by hand — confirms the version-bump gate this pass is required to satisfy |

`/sync` was intentionally **not** run — this pass stops at local verification per the
task's scope; the full pipeline dry run is a follow-up step before merge.

## Out of Scope (Phase 2+)

See ADR-0060 Amendment 3 §D "Roadmap" for the full 4-phase breakdown (Governance,
Migration, Intelligence, Audit). Not implemented in this pass:

- Skill/edge lifecycle state machines (`DISCOVER→RETIRE`), edge `status`
  (`proposed→validated→active→deprecated→removed`), owner fields at edge/graph level.
- Skill/edge/graph versioning and template↔project version pinning, migration plans,
  compatibility checks.
- Promoting `inputs`/`outputs` labels to first-class artifact nodes with
  `produces`/`consumed_by` edges; graph-topology-driven skill routing/workflow
  planning.
- Execution-time graph snapshots as an audit trail; relationship confidence scoring.
- Mass migration of all ~164 skills to typed `relates_to` — the 4-skill co-consult
  proof-of-concept stands alone; broader adoption is a separate future effort (mirrors
  ADR-0060's original "separate future effort" framing for `relates_to` itself).

## References

- ADR-0060 + Amendment 2 (2026-08-28) — the 3-tier architecture this design extends.
- `docs/designs/2026-08-28-skill-graph-template-rollout-design.md` — structural
  precedent for this document.
