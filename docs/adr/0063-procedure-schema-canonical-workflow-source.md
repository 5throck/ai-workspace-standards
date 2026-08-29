---
status: Accepted
date: 2026-08-29
author: PM + Architect
---

# ADR-0063: Procedure Schema as Canonical Workflow Source

## Context

The workspace automates variant lifecycle work through scripts
(`create-l3-scaffold.ts`, `l3-to-variant-pipeline.ts`, `project-to-variant.ts`,
`upgrade-project.ts`), but the workflows themselves lived only in prose:
`phase-definitions.md` documents and skill guidance. Workflow knowledge — which
agent acts at which step, with which skill, producing which artifact, in what
order — was not machine-checkable anywhere. The co-newbiz L2 project
(`Projects/co-newbiz/procedures/`) proved the pattern works, but it was
project-local.

Meanwhile the skill graph (ADR-0060) expressed only skill↔skill and
skill↔agent relations. It could answer "who uses this skill" but not "what is
the workflow of this variant, and is every declared (agent, phase) actually
reachable through it?"

## Decision

1. **Procedure YAML is the canonical source for workflow structure.**
   `procedures/<name>/schema.yaml` (per variant template, plus the root `l0`
   namespace) records steps as `{id, agent_key, skill_key, output_type,
   description}` with typed relations (`follows` / `enables` / `composes_with`).
   All procedure-derived graph nodes (`procedure`, `output_type`) and edges
   (`step_uses_skill`, `step_by_agent`, `produces`) are **generated
   projections** — the same derived-artifact discipline as ADR-0060. Hand-editing
   them is forbidden; repair the procedure and regenerate.
2. **Validation is a repository consistency check (L1–L8).**
   `scripts/validate-procedures.ts` checks schema shape, enums, the closed
   `_output-types.yaml` vocabulary, and — critically — that every
   `agent_key`/`skill_key` resolves to a real agent file / skill directory.
   Wired into the audit layer; `/sync` blocks on failure.
3. **Coverage is (agent_key, phase)-unit, step-satisfied, and
   human-judged on gaps.** Agent frontmatter `phases:` declares required
   `(agent_key, phase)` pairs; a pair is covered only by an actual procedure
   step. `scripts/procedure-coverage.ts` reports gaps and — via `--tickets` —
   registers idempotent governance tickets keyed by deterministic
   `coverage_key: <variant>:<agent_key>:<phase>`. Gaps are **never**
   auto-filled: each is human-judged as `PROCEDURE_REQUIRED` or
   `N/A_JUSTIFIED`. This encodes the workspace principle "repetition →
   scripts; judgment → guidelines + tickets".
4. **Procedures are workflow-shaped, not agent-shaped.** One procedure
   connects multiple agents/phases across a natural workflow boundary.
   Per-agent decomposition or procedures written only to close coverage
   numbers are rejected in review.
5. **L0 applies the same mechanism to itself.** The five root lifecycle
   procedures (`l0-create-variant`, `l0-promote-variant`,
   `l0-project-to-variant`, `l0-upgrade-project`,
   `l0-de-commonization-review`) map 1:1 to the lifecycle scripts, so the
   workspace's own most-repeated work is graph-queryable. L0 agents declare no
   `phases:`; their coverage is the existence and relation-chain completeness
   of these five procedures.

## Governance

- Constitution: §6.7 Procedure Lifecycle Management
  (`docs/constitution/06.7-procedure-lifecycle.md`)
- Design documents: `docs/designs/2026-08-29-procedure-schema-design.md` (v1.0
  schema + invariants), `docs/designs/2026-08-29-procedure-coverage-and-l0-design.md`
  (coverage + L0)
- Scripts: `validate-procedures.ts` 1.1.0, `procedure-coverage.ts` 1.0.0,
  `generate-skill-graph.ts` 1.6.0, `verify-skill-graph.ts` 1.4.0
- Agent `phases:` frontmatter is the machine-readable coverage requirement
  source; declarations must reflect actual workflow participation and are
  reviewed whenever procedures change (2026-08-29 review: 3 under-declarations
  corrected, 3 coverable gaps closed by steps, 17 continuous/cross-cutting
  pairs retired as `N/A_JUSTIFIED` tickets).

## Consequences

- Every variant's skill graph (`templates/<scope>/docs/skill-graph.json`)
  now contains its own procedure realization, giving per-variant graph
  diversity.
- Adding a procedure is a fully automated chain: write → validate → coverage →
  graph regeneration → verify → `/sync`. Manual consistency checks are gone.
- New lifecycle questions become graph traversals ("which procedure covers
  this variant's phase 3?") instead of document reading.
- v2 candidates (predicate conditions, layered overrides, kill criteria) stay
  deferred until real use cases emerge.
