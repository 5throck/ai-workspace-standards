---
status: Accepted
date: 2026-09-11
author: PM
---

# ADR-0072: Skill Term Nodes — Korean Reference Data Becomes First-Class Skill-Graph Vocabulary

## Context

The country-scoped Korean data skills (`k-dart`, `k-kosis`, `k-law`, `k-opendata`, `k-ecos`) map Korean domain terms to API codes in `references/terms-ko.json` (non-Markdown assets per CONSTITUTION §6.7). The skill graph (ADR-0060) derives nodes and edges from SKILL.md frontmatter, procedure schemas, and backtick-quoted *skill names* in prose — so the terms themselves are invisible to the graph. Concretely:

- An agent cannot ask the graph "which skills cover `소비자동향지수`?" even though the term legitimately spans `k-ecos` (BOK Consumer Sentiment Index survey) and `k-kosis` (re-published series).
- Cross-skill term collisions and ownership gaps are undiscoverable by script.
- The term data is already structured JSON; only the graph ignores it.

## Decision

`scripts/generate-skill-graph.ts` gains a term-extraction pass:

1. For every scanned skill directory, read `references/terms-ko.json` when present.
2. Emit one node per Korean term key (recursively over category maps, both the simple-string and object value forms):
   - `{ id: "term:<용어>", type: "term", layer: <skill's layer> }` — `term` is added to the `GraphNode` type union. The `term:` prefix keeps the id namespace disjoint from skill/agent/ADR ids.
3. Emit one edge per (skill, term): `{ type: "references", from: <skillId>, to: "term:<용어>", source: "terms-ko.json" }` — reusing the existing `references` edge type; no new edge vocabulary.
4. `scripts/verify-skill-graph.ts` is extended to enforce: `term` node ids are unique; every `term` node has at least one incoming `references` edge from a skill.

Terms stay data-only: no `SKILL.md` prose is required to reference them, and the English-only documentation policy is unaffected (the source files are JSON, already exempt per §6.7).

## Consequences

- **Positive**: cross-skill term overlap becomes a graph query; term coverage gaps per skill become auditable; future tooling (search, `/meeting` briefings, project reviews) can rank skills by vocabulary relevance without new metadata.
- **Cost**: `docs/skill-graph.json` grows by one node per distinct Korean term (~100+ at adoption, shared terms deduplicated by id). Consumers of the JSON must tolerate the new node type — the type union is additive and existing node types are unchanged.
- **Maintenance**: terms can rot with upstream APIs. Mitigation is the per-skill drift-check pattern (`scripts/verify-terms.ts` under `templates/common/skills/k-ecos/scripts/`, ADR companion design `docs/designs/2026-09-11-k-skills-advancement-design.md` D7) and the `verified` field in each terms file; quarterly skill review (CONSTITUTION §10) is the natural re-verification cadence.
- **Neutral**: no propagation semantics change — terms files travel with their skill directory; pruned country-scoped skills take their term nodes' edges with them, and the generator simply does not emit nodes for absent files.

## References

- Design: `docs/designs/2026-09-11-k-skills-advancement-design.md` (D2, D3, D8)
- ADR-0060 (skill relation graph) and Amendments 3/6B (typed relation vocabulary, L1 target existence)
- CONSTITUTION §6.7 (Non-English Reference Material)
- Reference implementation: `templates/common/skills/k-ecos/references/terms-ko.json`
