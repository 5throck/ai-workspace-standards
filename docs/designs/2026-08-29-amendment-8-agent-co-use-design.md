# Design: Amendment 8 — Agent Co-use `composes_with` Derivation + Project Backfill Mode

- **Date**: 2026-08-29
- **Status**: Implemented
- **Related**: ADR-0060 (Amendment 8 section), docs/constitution/06-skill-lifecycle.md §6.2.1

## Problem

The Amendment 6 ruleset derives relations only from procedure participants, so
coverage saturates at procedure membership: co-newbiz 52/125, co-architect
4/32, co-safety 4/33. An additional, already-tracked source — agent
`required_skills` frontmatter (agent → skill, ADR-0060) — was not used for
skill ↔ skill derivation.

## Decision

**Amendment 8 adds the agent co-use derivation**: skills co-declared in one
agent's `required_skills` gain a symmetric `composes_with`, declared on **both**
sides (the Amendment 6 single-side convention existed for dedup; both-sides is
required to raise per-skill coverage). Skip rules: directional `follows`
between the pair wins; already-declared relations are never overwritten.

**Tool**: `tests/add-variant-relations.ts` gains `--project <path>` mode —
recursive procedure walk (shared + entity/region overrides), inline `[a, b]`
and block `required_skills` parsing, CRLF normalization. Templates mode is
unchanged; L1 `templates/common/skills/` is never written.

## Applied

| Surface | Coverage | Notes |
|---------|----------|-------|
| Projects/co-newbiz | 52 → 72/125 (+400 edges; 232n/1,029e) | `graph-map --check` holds |
| Projects/co-architect | 4 → 10/32 (+9 edges) | |
| templates/co-* + workspace root | see verification below | |

## Trade-offs

- Both-sides declaration doubles symmetric edges vs the single-side convention
  — accepted: the metric that matters is per-skill coverage, and symmetric
  `composes_with` is true by construction.
- Agent-required co-use is weaker evidence than procedure adjacency — mitigated
  by the conservative `composes_with` type (never `follows`).
