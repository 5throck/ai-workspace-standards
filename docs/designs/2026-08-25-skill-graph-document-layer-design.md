# Skill Graph Document Layer — Design (ADR-0060 Amendment)

**Status**: Implemented (same PR)
**Date**: 2026-08-25
**Related**: [ADR-0060](../adr/0060-skill-relationship-graph-generated-projection.md) · [ADR-0061](../adr/0061-decision-record-standard.md)

## Problem

The root projection modeled only skills and agents. The co-newbiz pilot proved a multi-element model works; at L0 the immediately valuable subset is the **document layer** — decision records (`docs/decisions/`, now live after PR #684) and ADRs — because ADR-0061's Agent→Skill→Knowledge→Evidence→Rule→Decision chain ends at artifacts the graph could not see.

## Design

- New node types `decision` (`dec:<stem>`) and `adr` (`adr:<NNNN>`), layer `L0`.
- New edge type `cites_skill`: DEC `skills_used[]` validated against the known skill set (exact match — vocabulary enforcement for free).
- Reused advisory edges: `references` (DEC `knowledge_refs[]` naming `ADR-NNNN`; backtick skill refs inside ADR bodies) and `supersedes` (prose label `Supersedes: ADR-NNNN|DEC-…` on one line).
- Procedure/Artifact/Rule/EvidenceVar node types are **deliberately not ported**: L0 has no generic registries behind them (they are project-local strengths); porting them would fabricate empty structure. Revisit if/when a generic rule registry lands.
- Implementation rides the existing shared `buildGraph()`, so `verify-skill-graph.ts` inherits the extension with zero changes (verified: pass, 257 nodes / 600 edges).

## Non-goals

Runtime semantics for doc edges; retro-linking historical ADR prose beyond exact backtick/label matches; country-mark relaxation (invariant untouched).
