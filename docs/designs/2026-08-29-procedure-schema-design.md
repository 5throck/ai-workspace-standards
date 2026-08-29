# Procedure Schema v1.0 — Design Document

- **Spec ID**: 2026-08-29-procedure-schema
- **Date**: 2026-08-29
- **Status**: Approved
- **Owner**: architect
- **Decision record**: ADR-0063 (`docs/adr/0063-procedure-schema-canonical-workflow-source.md`)
- **Related**: ADR-0060 (typed skill relations), `scripts/experiments/infer-graph-from-phases.ts`, co-newbiz `procedures/` (L2 precedent, not propagated)

---

## 1. Problem Statement

The co-newbiz L2 project encodes its workflows as structured `schema.yaml` files
(step order, responsible agent, skill, output per step) that machines can
validate and graph. The workspace template system (`templates/common` + 13
variant templates) expresses workflows only as prose (`phase-definitions.md`)
plus a derived `skill-graph.json`. There is no machine-readable, per-step
procedure contract: step order, agent, skill, and output live in free text, so
consistency is checked by humans and graph relations are inferred heuristically.

## 2. Goal & Acceptance Criterion

**Acceptance criterion (frozen)**: Adding one new procedure must close the
chain `Procedure → Schema Validation (L1–L8) → Graph Generation → Graph
Verification (regression / orphan / semantics / determinism) → Audit →
VERSION_MANIFEST / CHANGELOG → Commit → PR` with **no manual consistency
checks by humans**. The existence of 13 seeded procedures is not the deliverable;
the closed pipeline is.

## 3. Architectural Invariants (Normative)

### INV-1 Canonical Source Invariant

> **Skill Graph nodes and edges derived from procedures MUST NOT be manually
> maintained independently. Any procedure-derived graph change MUST be
> reproducible by regenerating the graph from the validated procedure set.**

Procedure YAML is the canonical source; the Skill Graph is a **derived
artifact**. Editing `skill-graph.json` (or `docs/skill-graph.overrides.json`)
to reconcile procedure-derived nodes/edges with procedures is forbidden —
edit the procedure instead. Existing override/edge mechanisms remain valid
only for non-procedure-derived graph content.

### INV-2 outputs / inputs / relations Independence

- `inputs` — what the procedure consumes (output types produced elsewhere).
- `outputs` — what the procedure produces.
- `relations` — semantic links to other graph nodes (`follows`, `enables`,
  `composes_with`).
These three must never be merged: an output type MUST NOT act as an edge
predicate, and a relation MUST NOT replace an input/output dependency.

### INV-3 Steps Are Canonical Graph Source

Each step's `agent_key`, `skill_key`, `output_type` are primary graph data,
not documentation. Derived edges:

```
procedure ── step_uses_skill ──→ skill
procedure ── step_by_agent   ──→ agent
procedure ── produces        ──→ output_type
procedure ── follows / enables / composes_with ──→ procedure
```

### INV-4 `produces` Edge Rule (single rule, no duplicate edges)

- Procedure-level `outputs[]` produce **one** `produces` edge per type:
  `procedure → output_type`.
- Step-level `output_type` values that already appear in the procedure's
  `outputs[]` produce **no additional edge** (they are represented by the
  procedure-level edge).
- Step-level `output_type` values **not** in `outputs[]` produce a
  `produces` edge attributed to the step's **skill**:
  `skill → output_type`. Promotion: if the same type is later added to
  `outputs[]`, the step-level edge is replaced by the procedure-level edge.
- Net effect: every `output_type` in a procedure yields exactly one
  `produces` edge somewhere in the graph.

### INV-5 regression ≠ determinism

- **Regression test**: normalize old graph → semantic graph A; normalize new
  graph → semantic graph B. Assert every pre-existing node/edge of A is
  preserved in B (A_pre ⊆ B). Semantic identity = (id, type, layer) for
  nodes and (from, to, type) for edges — serialization order and metadata
  changes are ignored. Byte-level diff is NOT used.
- **Determinism test**: same procedure set, generate #1 → normalize,
  generate #2 → normalize, assert exact equality (diff = 0).
These are two separate tests and must not be merged into one.

## 4. Schema v1.0 (Frozen)

```yaml
schema_version: "1.0"
procedure_id: co-design-discover        # "<variant>-<kebab-name>", globally unique
variant: co-design                      # template directory name
version: "1.0.0"                        # semver of the procedure doc
title: Discover Phase Procedure
phase: 1                                # integer 0–6 (common phase vocabulary)
status: active                          # draft | active | deprecated
owner_agent: ux-researcher              # dotted-line owner; must exist in agents/
purpose: >
  One-paragraph statement of what this procedure accomplishes.
inputs:                                  # output types consumed (L3 vocabulary)
  - research_brief
preconditions:
  - "Kickoff approved and scope confirmed."
steps:
  - id: 1                                # integer or fractional (2.5) for insertion
    agent_key: ux-researcher             # must exist: agents/<key>.md
    skill_key: research-analysis         # must exist: skills/<key>/SKILL.md
    output_type: research_findings       # must be in _output-types.yaml
    description: >
      What this step does and why it is ordered here.
outputs:                                 # procedure-level production (INV-4)
  - type: persona_set
relations:                               # semantic links (INV-2)
  - type: enables                        # follows | enables | composes_with
    target: procedure.co-design.storyboard
quality_gates:
  - "Research findings reviewed by design-lead before handoff."
evidence:
  - "docs/research/<project>/findings.md"
failure_modes:
  - "Stakeholders unavailable — halt, do not assume requirements."
```

### Field rules (validated at L1/L2)

| Field | Required | Rules |
|---|---|---|
| `schema_version` | yes | literal `"1.0"` |
| `procedure_id` | yes | `^co-[a-z0-9]+-[a-z0-9-]+$`, unique across workspace |
| `variant` | yes | existing `templates/co-<name>` directory |
| `version` | yes | semver `x.y.z` |
| `title` | yes | non-empty string |
| `phase` | yes | integer 0–6 |
| `status` | yes | `draft` \| `active` \| `deprecated` |
| `owner_agent` | yes | existing agent key (L4) |
| `purpose` | yes | non-empty string |
| `inputs` | yes | array of registered output types (L3); may be empty `[]` |
| `preconditions` | yes | non-empty string array |
| `steps` | yes | ≥1 step; unique ids; ascending order |
| `steps[].agent_key` | yes | existing agent file (L4) |
| `steps[].skill_key` | yes | existing skill directory (L5) |
| `steps[].output_type` | yes | registered output type (L3) |
| `steps[].description` | yes | non-empty string |
| `outputs` | yes | array of `{type}`; types registered (L3); may be empty `[]` |
| `relations` | yes | array of `{type, target}`; may be empty `[]` |
| `relations[].type` | yes | `follows` \| `enables` \| `composes_with` (L6) |
| `relations[].target` | yes | `procedure.<variant>.<kebab-name>` or `skill.<key>` (L7) |
| `quality_gates` | yes | non-empty string array |
| `evidence` | yes | string array; may be empty `[]` |
| `failure_modes` | yes | non-empty string array |

### Output-type vocabulary

Each variant owns `templates/<variant>/procedures/_output-types.yaml`:

```yaml
schema_version: "1.0"
variant: co-design
output_types:
  research_findings: { description: "Synthesized research findings" }
  persona_set: { description: "Validated persona set" }
```

Closed vocabulary: every `input`, `output`, and `output_type` must be
registered (L3). Types may be shared across variants (kebab/snake-case keys
are global strings); no workspace-level registry in v1.

### File layout

```
templates/<variant>/procedures/
  _output-types.yaml
  <kebab-name>/schema.yaml     # one directory per procedure
```

`templates/common/procedures/_template/schema.yaml` is the authoring skeleton,
and `templates/common/docs/procedure-schema-spec.md` is the author-facing spec
(1:1 with this document).

## 5. Validation Rules (L1–L8)

`scripts/validate-procedures.ts` is a **repository consistency checker**, not
a syntax linter. Layers, all mandatory, fail-closed (exit 1 on any ERROR):

| Layer | Check |
|---|---|
| L1 | YAML parses; top level matches schema shape |
| L2 | Required fields present; enums (`status`, relation `type`, `phase` range); id format |
| L3 | Every input/output/output_type registered in the variant's `_output-types.yaml` |
| L4 | `agent_key`/`owner_agent` resolves to `agents/<key>.md` (variant, falling back to common) |
| L5 | `skill_key` resolves to `skills/<key>/SKILL.md` (variant, falling back to common) |
| L6 | relation `type` in enum |
| L7 | relation `target` resolves: `procedure.<variant>.<name>` to an existing procedure, `skill.<key>` to L5 |
| L8 | Cross-reference consistency: `procedure_id` prefix matches `variant`; duplicate `procedure_id` detection; step `output_type` not silently duplicated against `outputs[]` (warning-level only) |

CLI: `bun scripts/validate-procedures.ts [--variant co-design] [--all]`.
Test fixtures (valid + invalid) live in `tests/procedures-fixtures/`.

## 6. Graph Integration

`generate-skill-graph.ts` gains:

- Node type `procedure` (layer = variant name; also `common` if ever needed).
- Node type `output_type` (layer = variant).
- Edge types: `step_uses_skill`, `step_by_agent`, `produces`,
  `follows`, `enables`, `composes_with` (the latter three only for
  procedure→procedure/skill relation targets).
- Discovery source: `templates/*/procedures/*/schema.yaml`, parsed with the
  same YAML loader as the validator. Graph emission is **derived only** — no
  hand-authored procedure edges anywhere (INV-1).

`verify-skill-graph.ts` gains:

- Unknown-target invariant extended to new node types automatically.
- **Orphan procedure detection**: a procedure node with no
  `step_uses_skill`/`step_by_agent` edge is an error.
- **Invalid relation detection**: relation edge whose type/target fails INV-2/INV-4
  derivation is an error.
- **Regression check** (INV-5, semantic preservation) run when a committed
  `skill-graph.json` exists: existing semantic nodes/edges ⊆ regenerated set.
- **Determinism check**: `--determinism` mode runs generation twice and
  asserts exact normalized equality.

## 7. Lifecycle & /sync Ordering

`/sync` chain (Task 5 proves it end to end):

1. lifecycle registration (VERSION_MANIFEST, CHANGELOG)
2. `bun scripts/validate-procedures.ts --all`
3. `bun scripts/generate-skill-graph.ts` (regenerates derived graph)
4. `bun scripts/verify-skill-graph.ts --determinism`
5. audit
6. commit → PR

Wiring into the sync pipeline is limited to inserting steps 2–4 before the
existing audit step; no new pipeline mechanism.

## 8. v1 Scope Freeze

**In v1**: the schema above, L1–L8 validator, procedure node derivation,
regression + determinism verification, 13 variant seed procedures
(1–3 each), co-safety keeps its existing `workflows/` untouched and gains one
seed procedure under the new convention.

**Deferred to v2 (inference-driven, when real use cases emerge)**: predicate
AST (`applies_when`), 3-layer override model, kill criteria, conditional
transitions, dynamic procedure composition. Do not add speculative fields.

## 9. Delivery

Single PR (validator, 13 procedure sets, and graph generator are mutually
verifying units of one change set). Seeded procedures are derived from each
variant's `phase-definitions.md` / context docs; agents/skills referenced must
already exist in that variant template.

## 10. Acceptance Test (run at Task 5)

Add a demonstration procedure to one variant, then run the §7 chain with zero
manual fixes. The demonstration procedure may be removed before merge or kept
as a second seed; the chain run itself is the acceptance evidence.
