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
