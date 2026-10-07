---
status: "Accepted"
---

# ADR-0001: Skill Relationship Graph Adoption (reledgev wave)

**Status**: Accepted
**Date**: 2026-08-29
**Deciders**: pm

## Context

The upstream workspace (ai_workspace) formalized its skill relationship system via
ADR-0060 (Amendments 3–6) and the `reledgev` design
(`docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md`):
typed `relates_to` frontmatter, a per-scope experimental overrides layer, and the
always-regenerated graph projection. This project's copies of the graph pipeline
scripts predated the wave (generate-skill-graph 1.3.0 / verify-skill-graph 1.1.0)
and its skills carried no explicit relation metadata.

## Decision

Adopt the upstream skill-graph feature into this project:

1. **Pipeline scripts** refreshed from the common template: `generate-skill-graph.ts`
   1.7.0, `verify-skill-graph.ts` 1.5.0, `validate-skills.ts` 1.3.0,
   `validate-decisions.ts` 1.0.0 (fail-closed skill/decision chain validators).
2. **Typed `relates_to` relations** adopted for 14 skill(s) whose
   upstream definitions gained them (procedure-derived `follows` / symmetric
   `composes_with` edges). Project-local modifications to other skills are untouched.
3. **Per-scope experimental layer**: `docs/skill-graph.overrides.json` seeded;
   entries require `reason` + `since`, are warned at 90 days, and support
   `suppress: true` removal markers.
4. **`docs/context.md`** gains the "Skill Relationship Graph" section.

## Consequences

- Project graph after adoption: 44 nodes / 91 edges
  (typed relation edges: 20).
- Relations flow this project's skills → L1 (common) or same-project targets only.
- The graph is a derived artifact: regenerate with
  `bun scripts/generate-skill-graph.ts`, verify with
  `bun scripts/verify-skill-graph.ts --determinism`. Never hand-edit the JSON.
- Future upstream relation waves can be reflected the same way: update SKILL.md
  frontmatter + scripts, then regenerate.

## References

- ai_workspace ADR-0060 (Amendments 1–6) — skill relationship graph as generated projection
- ai_workspace `docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md`
- ai_workspace ADR-0063 — Procedure Schema as canonical workflow source

## Addendum (2026-08-29): Procedures Adoption

Adopted the variant template's procedure corpus into `procedures/` (ADR-0063):
schema.yaml workflows + `_output-types.yaml` vocabulary. Procedure/output_type nodes
and step edges now participate in the regenerated project graph. Retained upstream:
- new-project scaffolds copy `procedures/` via the variant overlay (generic copy),
- `upgrade-project.ts` v1.15.0 adds the PROCEDURES SYNC pass (add-if-missing,
  project-owned entries preserved),
- the L3→variant promotion scan (scan-l3-project) carries `procedures/` so promotion
  includes the workflow corpus.
