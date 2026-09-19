---
status: Accepted
date: 2026-09-19
author: Architect
---

# ADR-0083: Domain Execution Graph and the Domain Stage Axis

## Context

A workspace owner proposal ("Template-level Executable SOP and Skill Graph Architecture") asked
that the Workspace standardize only a Meta-Model — schemas, contracts, validators, governance —
while each variant Template becomes a self-contained **Domain Operating System** carrying Process,
Skill, Agent Team, RACI, Artifact Model, Evidence Model, Decision Model, and a graph linking them.

A 2026-09-19 verification pass against the repository found that **most of the proposal is already
built**, and that the remaining gaps are narrower and more specific than the proposal assumed.

### What already exists

- **Activity layer.** `procedures/<name>/schema.yaml` holds 80 procedures across 13 variant
  templates, `templates/common`, and the root `l0` namespace. Steps carry
  `{id, agent_key, skill_key, output_type, description}`. ADR-0063 and CONSTITUTION §6.7 govern it;
  `validate-procedures.ts` enforces it fail-closed.
- **Graph projection.** ADR-0060 Amendment 5 already emits `procedure` and `output_type` nodes and
  `step_uses_skill`, `step_by_agent`, and `produces` edges. The proposal's core chain
  (`Activity → Agent → Skill → Artifact`) is therefore shipping today.
- **Artifact vocabulary.** `procedures/_output-types.yaml` is a closed per-namespace registry
  enforced by ADR-0063 INV-4.
- **Evidence reference.** `templates/co-safety/evidence-models/` holds working draft-07 JSON
  Schemas with `_shared/base/`, `domains/`, and `migrations/` structure.
- **Decision records.** `docs/decisions/DEC-*.md` with fail-closed `validate-decisions.ts`, at L0.
- **Stage axis, at L2 only.** `Projects/co-newbiz` procedures carry a `gate:` field with the domain
  values `Screening → Target Screening → Pre-FS → FS → DD → Entity IC → Group IC → post_close`,
  and carry **no** `phase:` field. It further holds `_committees.yaml`, `_human-roles.yaml`, and
  `_kill-criteria/*.json` rule predicates, and its `scripts/co-newbiz/graph.ts` v0.4.0 emits 9 node
  and 12 edge types including `decision`, `rule`, `artifact`, and `var`.

### The five genuine gaps

1. **No domain Stage axis at L1.** `grep -rl "^stages:" templates/` returns zero. The procedure
   `phase: 0–6` field is the PM task-execution axis, not a business stage.
2. **No Consulted or Informed roles.** `owner_agent` supplies Accountable and step `agent_key`
   supplies Responsible; the other two RACI roles and the matrix itself do not exist.
3. **Artifact types are names without contracts.** Most variant registry entries are the stub
   `description: "Registered procedure output type"` — no fields, format, owner, or retention.
4. **Evidence is unvalidated free text** outside co-safety. Procedure `evidence:` is a raw string
   array.
5. **No decision-gate definitions.** 86 `quality_gates` prose entries across 80 procedures carry
   go/no-go intent with no decider, criteria structure, or outcome vocabulary.

### The constraint that shapes the decision

Two prior decisions bound any solution. ADR-0063 invariant 1 makes procedure YAML the canonical
workflow source, so a parallel process store is forbidden. ADR-0060 §4 chose a single unified graph
file with `layer` node fields and explicitly rejected per-concern graph files, so a second graph
artifact is forbidden.

A measured fact further constrains the rollout. In six of thirteen variants (co-abap, co-develop,
co-security, co-news, co-work, co-safety) the procedure count equals the distinct phase count
exactly. Any stage derivation that groups procedures by phase would reproduce the phase axis in
those variants and deliver nothing.

## Decision

### 1. Add `stage:` as an axis independent of `phase:`

Each variant declares stages in `templates/<variant>/process/stages.yaml`. Each procedure declares
one `stage:` alongside its existing, unchanged `phase:`.

**Non-conflation rule, normative.** A procedure declares one `phase` and one `stage`. `phase`
drives `procedure-coverage.ts` `(agent_key, phase)` units. `stage` drives domain sequence. No
validator may derive one field from the other, and no validator may require a fixed mapping between
them. This rule enters CONSTITUTION §6.7 as invariant 7.

`phase` semantics are frozen. Retiring or redefining it would invalidate ADR-0063 invariant 5 and
the 20 `N/A_JUSTIFIED` coverage tickets that depend on it.

### 2. Name the vocabulary Domain Execution Graph; keep one graph file

The **Domain Execution Graph (DEG)** is a vocabulary profile spanning Stage, Activity, Agent,
Skill, Artifact, Evidence, Decision, and RACI. It is **not** a new artifact. It is emitted into the
existing `docs/skill-graph.json` under a new top-level marker `graph_profile: "deg/v1"`.

"Skill graph" continues to name the file ADR-0060 governs. "Domain Execution Graph" names the wider
node and edge vocabulary carried inside it. The DEG neither supersedes nor wraps
`skill-graph.json`.

New node types: `stage`, `decision_gate`, `evidence_model`.
New edge types: `in_stage`, `stage_follows`, `accountable_for`, `consulted_on`, `informed_of`,
`gated_by`, `decides_on`, `evidenced_by`.

No existing node or edge type is renamed. The proposal's `performed_by`, `executes`, and `produces`
edges map onto the shipping `step_by_agent`, `step_uses_skill`, and `produces`.

### 3. Derive everything; forbid hand-authoring

Every DEG node and edge carries a `source` value (`process_schema`, `raci_matrix`,
`artifact_model`, `evidence_model`, `decision_model`). `verify-skill-graph.ts` rejects any
`skill-graph.overrides.json` entry whose endpoints carry a DEG `source`, extending the rule
Amendment 5 already applies to `source: procedure_schema`.

`governance/raci.yaml` is a generated, committed, drift-checked verification artifact — never a
source of truth.

### 4. Bootstrap stages mechanically; route judgment to tickets

`bootstrap-stages.ts` derives stages from the **artifact handoff graph** (`outputs` to `inputs`)
and typed `relations` (`follows`, `enables`), never from `phase`. It layers by longest path, cuts
at articulation points, merges undersized segments, and falls back to a procedure-name-prefix
tiebreak.

A **distinctness check is a mandatory acceptance criterion**, not an optional report. Rule DEG-P-01
fails a variant when the stage-to-phase mapping is bijective, because that means the stage axis is
a relabeling of the phase axis. DEG-P-01 is FATAL.

**Scope decision.** The six zero-slack variants — co-abap, co-develop, co-news, co-safety,
co-security, co-work — target **`core` conformance only**. Uplift to `governed` for these six is
explicitly **out of scope for this rollout**. It becomes future work, gated on a human
Stage-authoring pass that this decision does not commit to delivering.

Each of the six registers a governance ticket keyed `stage_bootstrap:<variant>`. That ticket is a
**record of deferred work, not a blocking dependency**: no phase exit gate references it, and the
programme completes with all six open. This reuses the ADR-0063 disposition pattern — repetition
goes to scripts, judgment goes to tickets — while keeping the rollout unblocked.

A scope holding an open `stage_bootstrap` ticket declares `deg_conformance: "core"` with
`process_manifest.stages_file: null`, commits no stages file, and is exempt from the `stage:` field
requirement. DEG-P-01 therefore applies only to a stages file actually committed, so no degenerate
stage set can enter the repository and no scope is left permanently failing validation.

`templates/common` is likewise exempt from the stage requirement and from DEG-P-01; it holds one
procedure, so a stage axis over it carries no information. It still reaches `governed` on the
artifact, RACI, and decision-gate axes.

### 5. Require `governed` conformance for eight of fourteen scopes

`variant.json` declares `deg_conformance: "core" | "governed" | "evidenced"`.

- `core` — stages, `stage:` on every procedure, RACI Accountable and Responsible derivable. A
  transient checkpoint for the governed set; the **permanent resting state for the six deferred
  variants** during this programme.
- `governed` — **required for 8 of the 14 scopes** (co-consult, co-deck, co-design, co-export,
  co-game, co-hr, co-price, `templates/common`) plus the `l0` root namespace. Adds artifact
  contracts, decision gates, and RACI Consulted and Informed.
- `evidenced` — optional and domain-specific. **Ships with no adopter in this rollout**: co-safety
  owns the only working evidence models but sits in the deferred set, so the level is specified and
  implemented yet unclaimed until co-safety's later Stage-authoring pass.

Downgrading a declared level requires a `DEC-*` record. The six deferred scopes are not a
downgrade — they never declare `governed` here, so no record is needed.

### 6. Migrate `quality_gates` in governed scopes; deprecate the field elsewhere

Of the 86 prose entries across 80 procedures, **54 migrate** into
`templates/<variant>/decisions/gates.yaml` definitions carrying `decider_agent`, `criteria`, and a
closed `outcomes` enum — 49 from the 8 governed scopes plus 5 from the `l0` namespace. The
remaining **32 entries stay** in the six deferred scopes, where the field is marked deprecated and
gated at WARN only.

Removing the field globally would leave the deferred six with neither prose gates nor structured
gates — a capability regression. DEG-D-05 is therefore level-scoped: FATAL at `governed`, WARN at
`core`.

Entries that state no verifiable condition, name an undefined actor, or bundle two conditions route
to `gate_migration:` tickets for a human pass. Entries expressing a continuous invariant rather than
a point decision **retire** as `N/A_JUSTIFIED` with a written reason; they are **not** converted
into artifact-level validation rules. Removing the field must never force invented gates.

Gate **definitions** (template layer, this ADR) and decision **records** (`docs/decisions/DEC-*.md`,
ADR-0061) are separate artifacts and never merge. A gate is a type; a record is an instance.

### 7. Add the Structural Convergence Rule

> When 50 percent or more of variants declare a structurally identical stage set, artifact type,
> evidence model, or decision-gate kind, promote the definition to `templates/common/`. Do not
> duplicate it per variant.

`validate-templates.ts` enforces the threshold, mirroring the Anti-Swelling Rule in CONSTITUTION
§7.5. This is the safety valve preventing 14 scopes from accumulating divergent near-identical
structure.

### 8. Treat `Projects/co-newbiz` as donor, then alignment target

co-newbiz already implements the Stage axis under the name `gate:`. This ADR generalizes that field
into the L1 `stage:` field and adopts its `_human-roles.yaml` pattern for human decision authority
at L1, following the upstreaming precedent of ADR-0060 Amendment 7.

co-newbiz consumes the same `templates/common/schemas/*.schema.json` contracts through a thin
`process/stage-aliases.yaml` adapter, not a separate schema. Its `scripts/co-newbiz/graph.ts` is
**extended in place, not replaced** — its `decision`, `rule`, `artifact`, and `var` node types are
a superset the common generator lacks, and replacing it would lose capability.

Whether other `Projects/*` L2 instances are later aligned to DEG is **explicitly not decided
here**. They are separate repositories and remain out of scope until the owner raises the question.

### Rejected alternatives

| Alternative | Reason for rejection |
|---|---|
| A parallel `templates/co-*/process/activities/` store | Contradicts ADR-0063 invariant 1, the Canonical Source Invariant. |
| A separate `domain-graph.json` file | ADR-0060 §4 already rejected per-concern graph files; a second file triples gate count and turns cross-layer edges into joins. |
| Replace `phase:` with `stage:` | Breaks ADR-0063 invariant 5 and the coverage ticket corpus. |
| Rename shipping edges to the proposal's wording | Breaks every Amendment 5 consumer for cosmetic gain. |
| RACI authored as a source of truth | Repeats the drift failure ADR-0060 §1 exists to end. |
| Group stages by `phase` | Arithmetically degenerate in six of thirteen variants. |
| Single-variant pilot | Rejected by the owner. |
| `core` as a permanent level chosen for *convenience* | Rejected. The six deferred variants rest at `core` for an arithmetic reason (no procedure-to-phase slack), not because the ceremony was judged unnecessary. |
| Removing `quality_gates` globally at P5 | Rejected. It would strip the six deferred scopes of gates entirely, with nothing replacing them. |
| Softening DEG-P-01 to a warning for the six | Rejected. A warning would let a degenerate stage set enter the repository. Deferring the scope is the correct lever, not weakening the check. |

## Consequences

**Positive**

- The domain business process becomes machine-readable and graph-queryable for the first time,
  without a new source of truth and without a new graph file.
- The proposal is satisfied by extending proven infrastructure rather than duplicating it. Four of
  the seven proposed layers required no new design at all.
- Backward compatibility is structural rather than negotiated: every addition is a new `type`
  value, so existing consumers see a superset and the pre/post node-set diff must equal zero.
- co-newbiz's independently proven stage and governance patterns reach the template layer instead
  of staying trapped in one L2 project.
- The naming collision the proposal risked is resolved cleanly: the file keeps its name, the
  vocabulary gets a new one.
- Scoping the rollout to 8 of 14 scopes keeps every phase unblocked. No exit gate waits on a human
  authoring pass, so the programme can complete on schedule with the deferred work recorded rather
  than pending.

**Negative and trade-offs**

- **This decision does not deliver a stage axis for six of thirteen templates.** co-abap,
  co-develop, co-news, co-safety, co-security, and co-work have zero slack between procedure count
  and distinct phase count, so mechanical bootstrap cannot produce a distinct stage axis for them.
  They rest at `core`, and their uplift is deferred to separately scoped future work. Anyone
  reading this ADR as "the workspace now has a domain stage axis" would be wrong for those six.
- **Real unbudgeted authoring cost for the governed set.** Measured, not estimated: 54 gate
  definitions to author, 50 procedures needing RACI Consulted and Informed, 7 stage files, and 8
  artifact-registry enrichments. Three low-ceremony variants (co-deck, co-design, co-game) carry 24
  gates across 23 procedures between them for domains previously judged to need little ceremony.
- **A partial, not clean, breaking change.** `quality_gates` is removed from 8 governed scopes and
  the `l0` namespace but retained in 6 deferred scopes. The workspace therefore carries two gate
  representations — prose at `core`, structured at `governed` — until the deferred set is uplifted.
  Consumers must tolerate the field being present or absent by scope.
- **The `evidenced` level ships with no adopter.** co-safety owns the only working evidence models
  and sits in the deferred set, so DEG-E-01..03 are specified and implemented but never exercised
  in this rollout. Mitigation: validate them against co-safety's existing models in read-only mode
  during P3 so the rules are not shipped wholly untested.
- **A long serialized rollout.** Every phase regenerates `skill-graph.json`, so CONSTITUTION §3.3
  sequential-branch dependency applies across the whole programme: approximately 14 pull requests
  that must merge in order, down from 18 before the scope decision.
- **Two ADR amendments become mandatory follow-ups** — ADR-0060 Amendment 10 (DEG vocabulary) with
  P3, and an ADR-0063 amendment (`stage:`, evidence widening, scoped `quality_gates` removal) with
  P5. Each lands inside its implementing phase rather than in advance or bundled afterward.
- **Six new files per variant at `governed`** increases the template surface. The Structural
  Convergence Rule is the counterweight, but it adds a validator that can fire disruptively if
  structural identity is defined too loosely.

## Platform Impact

**Claude Code.** Each rollout phase becomes one PM Gateway execution-plan row with an explicit
`model` alias per agent tier. No hook changes. The GateGuard PreToolUse hook already covers
first-edit investigation for the new files. The three new scripts require SCRIPTS.md registry rows
and in-file `@version` values, since dev-sync blocks fatally on modified scripts without a version
bump.

**Antigravity.** Hooks do not fire there, so `validate-process.ts` and `validate-raci.ts` must run
as plain `bun scripts/<name>.ts` invocations and must be listed in the GEMINI.md manual-fallback
table beside the existing manual lifecycle check. This ADR adds no slash command, so
`.claude/commands/` and `.gemini/commands/` parity is unaffected. Agents self-enforce the pre-edit
quality gate when authoring stage and gate files.

**templates/common.** The primary carrier. Five schemas and two authoring skeletons ship there and
reach every new scaffold through the existing propagation map. `templates/common` ships zero domain
stages and zero domain gates — skeletons only, matching `templates/common/procedures/_template/`.
It holds one procedure of its own and participates as a scope, with a proposed exemption from the
stage requirement.

## Governance

- **Design of record**: [`docs/designs/2026-09-19-template-domain-operating-system-design.md`](../designs/2026-09-19-template-domain-operating-system-design.md)
- **Constitution**: §6.7 Procedure Lifecycle (new invariant 7), §7.5 Common Layer Governance
  (Structural Convergence Rule)
- **Amends (as follow-up, not in this ADR)**: ADR-0060 Amendment 10, ADR-0063 amendment
- **Related**: ADR-0060, ADR-0061, ADR-0063, ADR-0079
- **Scripts**: `generate-skill-graph.ts`, `verify-skill-graph.ts`, `validate-procedures.ts`,
  `validate-templates.ts`, new `validate-process.ts`, `validate-raci.ts`, `bootstrap-stages.ts`
