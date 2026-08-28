---
status: Accepted
date: 2026-08-24
author: PM + Docs Writer
---

# ADR-0060: Skill Relationship Graph as Generated Projection

## Context

A 2026-08-24 design audit found that **no skill-to-skill relationship field exists anywhere in the workspace's registries** — and that the relationship data which does exist is scattered across stores that point in opposite directions:

- **Skill ↔ skill**: nothing. `prerequisites` in SKILL.md frontmatter is unvalidated free text — no schema, no target-existence check, no consumer.
- **Agent ↔ skill**: split across two opposite-direction stores. `agents/*.md` frontmatter carries `required_skills` (agent → skill), while each variant's `variant.json` carries `skill_manifest.variant_specific[].used_by_agents` / `phases` (skill → agents).
- **Registries**: SKILL.md frontmatter, `SKILLS.md`, and `VERSION_MANIFEST.md` interlink only by name — a rename in any one place silently orphans the other two.

External research (2026-08-24) confirms this is not a gap to close with infrastructure: Anthropic's official Agent Skills model treats every skill as **self-contained**, with description-driven discovery and **no native cross-skill dependency mechanism**. Community practice for large skill catalogs uses greppable backtick references and hand-drawn catalog lifecycle maps rather than dependency graphs.

The workspace owner additionally required that **relationships are mutable, not permanent** — a skill's neighbors change as variants evolve, so any store of relations must be cheap to revise or expire.

## Decision

### 1. The Graph Is a Generated Projection

`skills/`, `agents/`, and `variant.json` remain the Single Source of Truth. The relationship graph is **derived, never hand-maintained**:

- `scripts/generate-skill-graph.ts` derives the graph and emits:
  - `docs/skill-graph.json` — machine-readable, **committed** to the repo (not a build artifact).
  - `docs/skill-graph.md` — human catalog: a per-skill relation table plus lifecycle-phase grouping.
- `scripts/verify-skill-graph.ts` re-derives the graph and diffs it against the committed files. **Drift = exit 1**, wired into `dev-sync.ts` as step 4.65 (same generated-artifact pattern as README sync, ADR-0013).

### 2. Edge Sources

| Source | Direction | Notes |
|--------|-----------|-------|
| SKILL.md `prerequisites` | skill → skill | Existing field, now parsed; advisory only |
| SKILL.md `relates_to` (NEW, optional) | skill ↔ skill | Array of skill names; validated against the known skill-name set |
| `agents/*.md` frontmatter `required_skills` | agent → skill | Existing field, consumed as-is |
| `variant.json` `skill_manifest.variant_specific[].used_by_agents` / `phases` | skill → agent / skill → phase | Existing field, consumed as-is |
| Backtick prose references in SKILL.md bodies | skill → skill | **Exact matches against the known skill-name set only** — no fuzzy matching |
| `docs/skill-graph.overrides.json` | any | The **mutability escape hatch** for non-derivable relations |

The overrides file holds records of the form `{type, from, to, reason, last_reviewed, expires_at?}` — every override must state why it cannot be derived and when it expires. `expires_at` passing forces re-review; this is how the graph honors the owner's mutability requirement without letting hand entries fossilize.

### 3. All Edges Are Advisory

Edge types: `requires` (soft), `relates_to`, `used_by`, `phase`, `supersedes`. **None carry runtime dependency semantics** — no edge causes a skill to auto-load another, blocks deprecation, or gates propagation. This aligns with the Anthropic self-contained skill model (Context) and keeps the graph a documentation and audit surface, not an execution graph.

### 4. Single Unified Graph with `layer` Node Fields

One graph file for the whole workspace, with each node carrying a `layer` field (workspace / common / variant) — owner-confirmed fork over per-layer graph files. Cross-layer edges (e.g. a variant skill superseding a common skill) are then ordinary edges instead of cross-file joins.

### 5. Country-Mark Exclusion in Relation Fields

`verify-skill-graph.ts` rejects country marks inside any relation field. This extends the `country_scoped_assets` invariant from ADR-0057/ADR-0058: **country scoping never lives in SKILL.md frontmatter**, and relation fields are no exception — a `relates_to: k-law-kr` style entry is a finding, not a warning.

### Rejected Alternatives

| Alternative | Why rejected |
|-------------|--------------|
| **Hand-maintained graph registry** | Would drift from the SSOTs it describes and fights the owner's mutability requirement — exactly the three-registries-by-name problem this ADR exists to end. |
| **Hard dependency semantics** (edges gate loading/deprecation) | Contradicts Anthropic's self-contained skill model; a missing prerequisite would break skill discovery for no runtime benefit. |
| **Per-layer graph files** (workspace/common/variant) | Triples the gate count, makes cross-layer edges (`supersedes` across layers) awkward joins, and duplicates the drift check three ways. |

## Consequences

**Positive:**

- Relations become **queryable and committed** without a new SSOT to maintain — regeneration is deterministic from existing fields.
- The mutability requirement is honored structurally: derived edges update themselves on regeneration; only non-derivable relations need human attention, and those carry expiry.
- The two opposite-direction agent↔skill stores are finally joined in one view, exposing disagreements (an agent listing a skill the variant manifest doesn't) as visible graph facts.
- SKILLS.md stays registry-only (constitution §6 SKILLS.md Registry Principle) — inter-skill relations live in the generated graph, not a new column.

**Negative / Trade-offs:**

- **A new dev-sync gate** (step 4.65) means any relation-field edit requires regenerating the committed graph files in the same PR.
- **Backtick prose parsing is exact-match only** — prose that refers to a skill by paraphrase or renamed name is invisible to the graph (deliberate: no fuzzy matching).
- **The overrides file is a small hand-maintained surface** — bounded by the expiry discipline, but nonzero.
- `relates_to` adds a second relation field next to `prerequisites`; the semantic line (hard-ish prerequisite vs. soft relation) is advisory anyway and must be documented in each SKILL.md.

## Implementation

| File | Change |
|------|--------|
| `docs/adr/0060-skill-relationship-graph-generated-projection.md` | This ADR |
| `scripts/generate-skill-graph.ts` | New generator — derives graph from SSOTs, emits `docs/skill-graph.json` + `docs/skill-graph.md` (lands in follow-up PRs) |
| `scripts/verify-skill-graph.ts` | New verifier — re-derives and diffs, drift = exit 1; rejects country marks in relation fields (lands in follow-up PRs) |
| `scripts/dev-sync.ts` | Step 4.65 wiring for the drift gate (lands in follow-up PRs) |
| `docs/skill-graph.json` / `docs/skill-graph.md` | Generated, committed outputs (first emitted when the generator lands) |
| `docs/skill-graph.overrides.json` | Overrides file with `{type, from, to, reason, last_reviewed, expires_at?}` records (lands in follow-up PRs) |
| SKILL.md files | Optional `relates_to: [skill-name]` frontmatter, added skill-by-skill as relations are identified (follow-up PRs) |
| `docs/constitution/06-skill-lifecycle.md` | Pointer: inter-skill relations are NOT tracked in SKILLS.md — they live in the generated skill graph (this PR) |

## References

- ADR-0059 — Governance reflection validators: this ADR must appear in the governance corpus (`verify-adr-governance.ts --strict`)
- ADR-0057 / ADR-0058 — Country-profile mechanism and country-scoped env keys (the `country_scoped_assets` invariant extended by §5)
- ADR-0013 — Committed generated-artifact pattern (README sync) that step 4.65 mirrors
- ADR-0061 — Decision Record Standard (`skills_used[]` frontmatter consumes this graph's vocabulary)
- ADR-0062 — Marker-Based Doc Propagation Domains (sibling ADR from the same 2026-08-24 design series)

---

## Amendment 2026-08-25 — Document Layer

**Status**: Accepted (same-day amendment, implemented in the amending PR)
**Design of record**: [2026-08-25-skill-graph-document-layer-design.md](../designs/2026-08-25-skill-graph-document-layer-design.md)

The projection gains a document layer generalizing the co-newbiz multi-element pilot (project-local; see that project's `docs/designs/2026-08-24-multi-element-skill-graph-pilot-design.md`):

- New node types `decision` (`dec:<stem>`, from `docs/decisions/DEC-YYYYMMDD-NN.md` per ADR-0061) and `adr` (`adr:<NNNN>` from `docs/adr/`), layer `L0`.
- New edge type `cites_skill` — a decision record's `skills_used[]` entry validated against the known skill set. This is the vocabulary-enforcement payoff: decision records now draw their skill vocabulary FROM the graph, closing ADR-0061's cross-reference loop.
- Reused advisory edges: `references` (a DEC `knowledge_refs[]` entry naming an ADR; backtick skill references inside ADR bodies) and `supersedes` (prose label `Supersedes: ADR-NNNN|DEC-…`).
- **Not ported**: procedure/artifact/rule/evidence-var node types remain project-local strengths (co-newbiz); L0 has no generic registries behind them and the amendment refuses to fabricate empty structure. Revisit on first generic registry.

All document edges are advisory like every other edge in this graph. Implementation: `generate-skill-graph.ts` 1.2.0 (shared `buildGraph()` — the verifier inherits the extension unchanged, verified passing at 257 nodes / 600 edges).

---

## Amendment 2026-08-28 — Per-Template Graph Artifacts + Project-Local Generation (Amendment 2)

**Status**: Accepted (owner decision overturning the original rejection of per-layer graph files for the template layer)
**Design of record**: [2026-08-28-skill-graph-template-rollout-design.md](../designs/2026-08-28-skill-graph-template-rollout-design.md)

The original Rejected Alternatives section declined per-layer graph files ("triples the gate
count, makes cross-layer edges awkward joins, duplicates the drift check"). The owner has now
confirmed a scoped reversal for the template layer, with two distinct mechanisms:

- **Template layer — scoped artifacts**: `templates/common` and every `templates/co-*` ship
  their own `docs/skill-graph.json`, generated at L0 by `generate-skill-graph.ts --scope` and
  drift-gated per /sync by the extended step 4.65 (`verify-skill-graph.ts --scope`). These are
  **scoped views, not replacements**: the L0 unified graph remains the workspace SSOT; scope
  files carry only scope-local nodes (tagged `common` / `variant:co-*`) plus the upstream
  targets their relations actually reference. Cross-layer joins stay awkward by design —
  exactly one edge, both endpoints materialized.
- **Project layer — local generation, not propagation**: projects never receive a copy of any
  upstream graph. They run the (already L0+L1-promoted) generator in their own context, where
  run-context auto-detection labels local assets `L3` instead of the previous mislabel `L0`,
  and the existing dev-sync step 4.65 `existsSync` gate maintains the project-local artifact.
  This is the mechanism the 2026-08-25 amendment already anticipated; Amendment 2 makes it the
  contractual path and fixes the layer-labeling defect that would have corrupted project graphs.

The original unified-graph decision stands for the workspace layer; the gate-count concern is
answered by deriving every scope artifact from the same `buildScopeGraph()`/`buildGraph()`
engines and gating all of them inside the single existing step 4.65 rather than adding new
pipeline stages. Implementation: `generate-skill-graph.ts` 1.3.0, `verify-skill-graph.ts`
1.1.0, `dev-sync.ts` 1.7.8.

---

## Amendment 2026-08-29 — Typed Relation Vocabulary + Scaffold-Time Project Graph (Amendment 3)

**Status**: Accepted (Phase 1 of a 5-phase roadmap; user-confirmed via 3-option AskUserQuestion)
**Design of record**: [2026-08-28-skill-graph-typed-relations-design.md](../designs/2026-08-28-skill-graph-typed-relations-design.md)

Two gaps remained after Amendment 2: `relates_to` was schema-only (zero skills used it,
`prerequisites` stayed unstructured free text, and there was no `composes_with`/`follows`/
`enables` or `inputs`/`outputs` concept), and project graphs were generated lazily at the
first `/sync` rather than at scaffold time. This amendment closes both (Phase 1 of a
5-phase roadmap — §D below), and records a schema-evolution boundary (§C) so nothing built
now blocks the deferred phases.

### A. Typed relation vocabulary

`relates_to` now accepts either a bare string array (**legacy** — unchanged generic
`relates_to` edges, zero migration required) or an array of typed `{skill, type}` objects
using three new edge types alongside the existing `requires | relates_to | used_by | phase |
supersedes | references | cites_skill`:

- **`requires`** (from `prerequisites`, unchanged): A requires B = B is a mandatory
  prerequisite for A, direction A→B. Deliberately loose on *how* satisfied (existence vs.
  prior execution) — Phase 4 artifact nodes need the same edge type to work for both
  skill→skill and skill→artifact targets without redefinition.
- **`enables`** (typed `relates_to`): A enables C = A's output makes C possible/unlocked,
  direction A→C. Not the inverse of `requires` — C may still be usable without A having run.
- **`follows`**: A follows B = pure sequencing/ordering (workflow position), no dependency
  implication either direction.
- **`composes_with`**: symmetric — declared once from either skill's frontmatter, always
  interpreted as true in both directions. **Materialization**: stored as a single directed
  edge (source→target as declared) carrying `symmetric: true` in its edge metadata, not two
  edges. Normative: **consumers MUST interpret an edge marked `symmetric: true` as
  traversable in both directions, while the graph preserves only the single stored
  source→target representation.**
- **Legacy vs. typed `relates_to` — no mixed arrays.** Within one skill's `relates_to`,
  entries are either all bare strings or all typed objects, never mixed. **Rejection happens
  at the schema-validation layer, not the YAML-parse layer** — a mixed array is
  syntactically valid YAML, so parsing succeeds; a separate validation step
  (`parseRelatesTo()`, shared by generator and verifier) then rejects it with:
  `"relates_to must contain either all string entries or all typed relation objects; mixed entries are not allowed"`.

`inputs`/`outputs` are new optional frontmatter fields (`inputs: [label, ...]` / `outputs:
[label, ...]`), documented as plain **input/output labels** — not "artifacts" — so Phase 4's
promotion to first-class artifact nodes isn't pre-constrained by naming used today. Rendered
per-skill in `docs/skill-graph.md`; treated as opaque strings, not resolved against any node
type in Phase 1.

**Parser**: `parseFrontmatter()` swapped from a hand-rolled single-line-`key:
value`/inline-`[a,b]`-array regex parser to `js-yaml`, scoped strictly to the text between
the `---`/`---` delimiters (Markdown body untouched — verified by a fenced-code-block
fixture). `js-yaml` was already a dependency of both the root and `templates/common`
`package.json` (used by four other scripts); no new dependency was added. A small number of
pre-existing `docs/decisions/DEC-*.md` frontmatter blocks are not strict YAML (unescaped
`key: value`-shaped colons inside prose, tolerated by the old regex parser); `parseFrontmatter()`
falls back to the legacy line parser on a YAML parse failure so non-SKILL.md consumers see
zero behavior change — fixing those records' YAML is out of this pass's scope.

**Edge provenance**: every edge derived from SKILL.md `prerequisites`/`relates_to` and agent
`required_skills` gains `provenance: {file, field, index?}` (JSON-only, not rendered in
`docs/skill-graph.md`), recording exactly which frontmatter field/entry produced it — cheap
at generation time (the generator already has the file path and array index in hand) and a
direct prerequisite for Phase 5's audit-trail goal ("where was this edge defined?").

Proof-of-concept applied to 4 co-consult skills (`executive-presentation`,
`technical-feasibility`, `org-readiness-assessment`, `financial-modeling`) — **not** a mass
migration across the ~164-skill catalog, matching the original ADR's "separate future
effort" framing for `relates_to` itself.

### B. Scaffold-time project graph generation

`new-project.ts` now runs the propagated `generate-skill-graph.ts` **inside the new project
directory** immediately after dependency install, so a scaffolded project gets an initial
`docs/skill-graph.json` tagged `L3` at creation time instead of waiting for the first
`/sync`. Does not copy any upstream graph (Amendment 2's "projects never receive a copy of
any upstream graph" stands) — derives fresh from whatever the variant overlay just placed.
Non-fatal: any failure (missing `bun`, missing script, generation error) warns and
continues; the existing `dev-sync.ts` step 4.65 gate still covers the artifact on first
`/sync` regardless.

### C. Schema-evolution boundary (documented now, not implemented)

- The typed `relates_to` entry shape (`{skill, type}`) is a **forward-open object**, not a
  closed 2-field record. Future fields (`status`, `version`, `valid_from`, `valid_until`,
  `confidence`, `evidence`) can be added later without a breaking migration. **Unknown-field
  tolerance is a Phase 1 parser contract, decided now**: a typed entry carrying keys beyond
  `{skill, type}` does not error — unrecognized keys are preserved unmodified on the parsed
  entry and passed through into the generated JSON edge (`extra: {...}`), unvalidated and
  uninterpreted by Phase 1 code. Phase 2 is responsible for defining validation semantics for
  each future field before anything reads or acts on them.
- **SSOT principle restated as non-negotiable across all future phases**: the graph JSON is
  always a generated projection of `skills/`, `agents/`, `variant.json` (plus, later,
  wherever lifecycle/version metadata actually lives) — never hand-edited to carry lifecycle
  state itself. Any future lifecycle/version field must be authored in source files and
  merely *read* by the generator, exactly as `prerequisites`/`relates_to` are today.
- **Three separate governance units are declared now, even though only one has behavior
  today**: Node (skill), Edge (relationship), and Graph (template/project graph as a whole)
  are independently lifecycle-able and independently versionable/ownable — a skill reaching
  `PRODUCTION` does not imply every edge off it is `active`, and a graph's own version is not
  derived by summing its skills' versions. Concretely: Phase 2 must add a `lifecycle.phase`
  field (`DISCOVER→RETIRE`) *distinct from* the existing `status: active|deprecated` column
  in `skills/SKILLS.md` (not merged — `status` is a simpler operational flag already relied
  on elsewhere; `lifecycle.phase` is a richer, separate axis). Same separation applies to an
  edge's future `status` (`proposed→validated→active→deprecated→removed`) versus the skill
  node's own status. An `owner` field is likewise named as applicable independently at all
  three levels, mirroring the `owner` field skills already carry today.

### D. Phase 2+ roadmap (documented, not implemented)

- **Phase 2 — Graph Governance**: the four dimensions from §C as separate axes — skill
  lifecycle state machine, relationship (edge) lifecycle state machine on the forward-open
  `relates_to` entry, skill/edge versioning, owner at skill/edge/graph level. Needs
  reconciliation with existing conventions (the `status` column, skills' existing `owner`
  field) before adding as new dimensions.
- **Phase 3 — Graph Migration**: template/project graph versioning (Standards → Template →
  Project version chain, each project pinned to the template graph version it was scaffolded
  from); graph diff; reverse-traversal dependency impact analysis from a deprecated
  skill/edge to every dependent skill/template graph/downstream project; migration plans
  (`migration: {from, to, strategy, deadline}`); per-project compatibility checks.
- **Phase 4 — Graph Intelligence**: promote `inputs`/`outputs` labels (§A) to first-class
  artifact nodes with `produces`/`consumed_by` edges; graph traversal for skill routing,
  workflow planning, agent-team generation from a template's graph topology.
- **Phase 5 — Graph Audit**: execution-time snapshot storage as an audit trail (`Result →
  Workflow → Agent → Skill Version → Graph Snapshot → Evidence`); relationship confidence
  scoring; graph learning/feedback into skill updates.

Each phase needs its own dedicated design session per the ADR-0060 precedent (every prior
amendment was scoped to one coherent change) — recording the sequence now gives the next
design conversation a concrete starting point without rushing governance machinery that
could conflict with existing conventions into this pass.

Implementation: `generate-skill-graph.ts` 1.4.0, `verify-skill-graph.ts` 1.2.0,
`new-project.ts` 1.9.0.

---

## Amendment 2026-08-29 — Inference-Derived Graph Strategy (Amendment 4)

**Status**: Accepted (documentation-only)
**Design of record**: [2026-08-29-inference-derived-graph-strategy-design.md](../designs/2026-08-29-inference-derived-graph-strategy-design.md)

Following Amendment 3, a proposed "Phase 1.5" experiment (apply the declarative typed
`relates_to` schema to real workflows before building Phase 2 governance) targeted
`Projects/co-newbiz`. The premise didn't fit: co-newbiz doesn't use `relates_to`
frontmatter at all — it has its own independently designed, complete, more richly-typed
graph system, `scripts/co-newbiz/graph.ts` (v0.4.0), which infers 7 node types and 12 edge
types purely from existing structured SSOTs (`procedures/_shared/*/schema.yaml` step
tables, `procedures/_kill-criteria/*.json` rule predicates, `docs/adr/`,
`docs/decisions/`) with zero new frontmatter declared. This matures exactly what the
2026-08-25 Document Layer amendment deferred ("procedure/artifact/rule/evidence-var node
types remain project-local strengths... revisit on first generic registry").

**This amendment does not prescribe a graph-construction mechanism — it recognizes that
ADR-0060's principle (a relationship graph generated as a projection of existing SSOTs,
never a hand-maintained master store) admits two valid strategies:**

| Strategy | SSOT of the relationship | Right fit when |
|----------|---------------------------|-----------------|
| **Declarative** (Amendment 3) | `SKILL.md` frontmatter (`relates_to`, `prerequisites`) | No other structured data describes execution order/relations |
| **Inferential** (Amendment 4, co-newbiz precedent) | Existing structured data (procedure schemas, rule predicates, decision docs) | The project already has rich structured execution-order/rule data |

**Normative rule (load-bearing line of this amendment)**: An inferential graph MUST NOT
introduce a second hand-maintained declaration of facts already authoritative elsewhere —
the same anti-pattern ADR-0060's "generated projection, not hand-maintained master graph"
principle exists to prevent, applied one level deeper.

**Provenance by construction**: unlike Amendment 3's declarative edges, which need
`provenance: {file, field, index?}` bolted on as separate metadata, an inferential edge's
provenance is inherent in the extraction event itself (co-newbiz's `source_ref` on every
edge) — it is derived directly from the SSOT location that produced it, not declared
alongside the relationship.

**Graph-to-agent consumption precedent (forward reference only)**: co-newbiz's `context
--skill <name>` / `context --gate <Name>` commands are a working precedent for consuming a
generated graph as session-time agent context — recorded for a future Phase 4 ("Graph
Intelligence") to draw from, not something this amendment asks the parent workspace to
build now.

**co-newbiz is recognized precedent, not promoted standard** — cited as the working example
the Inferential branch is named after, not adopted as an L0 default or a requirement for
other projects.

**Three-stage revisit criterion** (deliberately stronger than "a second project exists"):
(1) one project today — local precedent only, no action; (2) a second independent `co-*`
project builds its own inferential extractor — compare the two extraction contracts, still
no action; (3) only if that comparison confirms a sufficiently common contract, consider
generalizing the pattern into `generate-skill-graph.ts` as an **opt-in** extraction mode —
never a requirement that other projects adopt the inferential strategy.

Implementation: none (documentation-only recognition of existing co-newbiz
`scripts/co-newbiz/graph.ts` v0.4.0, a separate repository — no code changes here or there).
