# Design: Template Domain Operating System

**Date**: 2026-09-19
**Status**: Approved
**Spec ID**: 2026-09-19-template-domain-operating-system
**Scope**: `templates/common/schemas/`, `templates/common/process/`, `templates/co-*/process/`, `templates/co-*/governance/`, `templates/co-*/decisions/`, `templates/co-*/evidence-models/`, `templates/*/procedures/`, `procedures/`, `Projects/co-newbiz/procedures/`, `scripts/generate-skill-graph.ts`, `scripts/verify-skill-graph.ts`, `scripts/validate-procedures.ts`, `scripts/validate-templates.ts`, `docs/adr/0082-domain-execution-graph-and-stage-axis.md`

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Decision Summary](#2-decision-summary)
3. [Architecture Overview](#3-architecture-overview)
4. [Process Layer — Stage and Activity](#4-process-layer--stage-and-activity)
5. [Stage Bootstrap Algorithm](#5-stage-bootstrap-algorithm)
6. [RACI Layer](#6-raci-layer)
7. [Artifact Model](#7-artifact-model)
8. [Evidence Model](#8-evidence-model)
9. [Decision Model](#9-decision-model)
10. [Domain Execution Graph](#10-domain-execution-graph)
11. [Workspace and Template Boundary](#11-workspace-and-template-boundary)
12. [Validation and Governance](#12-validation-and-governance)
13. [Implementation Phases](#13-implementation-phases)
14. [Backward Compatibility](#14-backward-compatibility)
15. [Risks and Open Questions](#15-risks-and-open-questions)
16. [Platform Impact](#16-platform-impact)
17. [References](#17-references)

---

## 1. Problem Statement

### 1.1 The proposal

A workspace owner proposal ("Template-level Executable SOP and Skill Graph Architecture") states
one principle: the Workspace standardizes only a Meta-Model — schemas, contracts, validators, and
governance. Each variant Template becomes a **Domain Operating System** that carries its own
Process, Skill, Agent Team, RACI, Artifact Model, Evidence Model, Decision Model, and a graph that
links them.

### 1.2 What already exists (verified 2026-09-19)

The proposal is substantially built. Designing these layers from scratch would duplicate live,
ADR-governed infrastructure. The table below records the verified state.

| Proposal layer | State in repository | Gap |
|---|---|---|
| Process — Activity | **Built.** `procedures/<name>/schema.yaml`: 80 procedures across 13 variant templates, `templates/common`, and the root `l0` namespace. Steps are `{id, agent_key, skill_key, output_type, description}`. Governed by ADR-0063 and CONSTITUTION §6.7. | none |
| Process — **Stage** | **Absent at L1.** `grep -rl "^stages:" templates/` returns zero. The procedure `phase: 0–6` field is the PM task-execution axis, annotated in the schema template as `# integer 0–6 (common phase vocabulary)`. | **primary gap** |
| Skill as executable SOP | **Built.** `skills/*/SKILL.md`; every step `skill_key` must resolve to a real skill directory (`validate-procedures.ts`). | no declared exit criteria |
| Agent Team | **Built.** Per-variant rosters in `variant.json`; CONSTITUTION §7.5 L0 Agent Non-Propagation. | none |
| RACI | **Partial.** `owner_agent:` carries Accountable; step `agent_key` carries Responsible. | **Consulted and Informed absent; no matrix; no validator** |
| Artifact Model | **Partial.** `procedures/_output-types.yaml` is a closed per-namespace vocabulary enforced by INV-4. Most variant entries are the stub `description: "Registered procedure output type"`. | **no fields, format, owner, retention, or evidence link** |
| Evidence Model | **Partial.** `templates/co-safety/evidence-models/` holds real draft-07 JSON Schemas (`_shared/base/`, `_shared/`, `emergency/`, `domains/`, `migrations/`). Procedure `evidence:` is an unvalidated free string array. | **no meta-schema; no typed artifact-to-evidence link** |
| Decision Model | **Partial.** `docs/decisions/DEC-*.md` exists at L0 only, governed by ADR-0061 with fail-closed `validate-decisions.ts`. Procedure `quality_gates:` holds 86 free-prose entries across 80 procedures. | **no decision-gate definitions at template level** |
| Skill Graph | **Built and already procedure-aware.** ADR-0060 Amendment 5 added `procedure` and `output_type` nodes plus `step_uses_skill`, `step_by_agent`, and `produces` edges. | needs Stage, RACI, Evidence, and Decision types |

The proposal's core chain — `Activity → performed_by → Agent`, `→ executes → Skill`,
`→ produces → Artifact` — is therefore **already shipping** as `step_by_agent`,
`step_uses_skill`, and `produces`.

### 1.3 The genuine deltas

Five gaps remain, and they are the whole subject of this design:

1. No **Stage** axis. Domain business process is invisible; only the PM phase axis exists.
2. No **Consulted** or **Informed** roles, and no RACI matrix artifact.
3. **Artifact types are names without contracts** — no fields, format, owner, or retention.
4. **Evidence is unvalidated free text** outside co-safety.
5. **No decision-gate definitions**; go/no-go criteria sit in prose.

### 1.4 `Projects/co-newbiz` is the existing reference implementation

`Projects/co-newbiz` already solves the Stage gap. Its procedures carry a `gate:` field with the
domain values `Screening → Target Screening → Pre-FS → FS → DD → Entity IC → Group IC →
post_close`, and they carry **no** `phase:` field at all. It further holds
`procedures/_committees.yaml` (composition, chair, rounds, decision modes, `veto_dissent`),
`procedures/_human-roles.yaml` (a closed registry of human decision-authority keys), and
`procedures/_kill-criteria/*.json` (rule predicates per gate). Its `scripts/co-newbiz/graph.ts`
v0.4.0 emits 9 node types and 12 edge types, including `decision`, `rule`, `artifact`, and `var`.

co-newbiz is therefore **not a rollout target that must be raised to the standard**. It is the
upstream donor. This design generalizes its `gate:` field into the L1 `stage:` field, following
the precedent ADR-0060 Amendment 7 already set for upstreaming co-newbiz adaptations.

---

## 2. Decision Summary

| ID | Decision |
|---|---|
| **D1** | Extend the existing Procedure Schema layer. Do not create a parallel Process store. |
| **D2** | Add `stage:` as an axis independent of `phase:`. Never conflate the two. |
| **D3** | Name the union vocabulary the **Domain Execution Graph (DEG)**. Emit it into the existing `docs/skill-graph.json` under `graph_profile: "deg/v1"`. Do not create a second graph file. |
| **D4** | Keep backward compatibility structural. Add only new node and edge `type` values. |
| **D5** | Derive every DEG node and edge. Forbid hand-authoring and override entries. |
| **D6** | Require `governed` conformance for the 8 scopes that have procedure-to-phase slack, plus the `l0` root namespace. Defer the 6 zero-slack variants at `core` (§5.5, S1). Keep `evidenced` optional and unclaimed this rollout. |
| **D7** | Add a Structural Convergence Rule that mirrors the §7.5 Anti-Swelling threshold. |
| **D8** | Place schemas and validators in the Workspace layer. Place domain content in the Template layer. |
| **D9** | Bootstrap stages mechanically from artifact flow and typed relations. Route failures of the distinctness check to governance tickets for a human pass. |
| **D10** | Migrate every `quality_gates` entry into a decision gate. Remove the field. |
| **D11** | Generalize co-newbiz `gate:` into `stage:`. Adopt its `_human-roles.yaml` pattern for RACI decision authority. |

### 2.1 Rejected alternatives

| Alternative | Reason for rejection |
|---|---|
| A new `templates/co-*/process/activities/` store | Contradicts CONSTITUTION §6.7 invariant 1, the Canonical Source Invariant. Procedure YAML is the canonical workflow source. |
| A separate `domain-graph.json` file | ADR-0060 §4 already rejected per-concern graph files. A second file triples gate count and converts cross-layer edges into joins. |
| Replace `phase:` with `stage:` | Breaks ADR-0063 invariant 5. `procedure-coverage.ts` computes `(agent_key, phase)` units, and 20 coverage tickets depend on them. |
| Rename `step_by_agent` to `performed_by` | Breaks every ADR-0060 Amendment 5 consumer for cosmetic alignment with proposal wording. |
| Author RACI as a hand-maintained source of truth | Repeats the drift failure ADR-0060 §1 was written to end. |
| Single-variant pilot | Rejected by the owner. |

---

## 3. Architecture Overview

### 3.1 Two independent axes

The design's central structural claim is that a workspace has two orthogonal process axes, and
that today only one of them is machine-readable.

```
                    DOMAIN STAGE AXIS  (business process — NEW)
                    S1 ──► S2 ──► S3 ──► S4 ──► S5
                     │      │      │      │      │
   PM PHASE AXIS     │      │      │      │      │
   (task execution   ▼      ▼      ▼      ▼      ▼
    — UNCHANGED)   ┌──────────────────────────────┐
   Phase 0..6 ────►│         A C T I V I T Y      │
                   │  (procedures/<n>/schema.yaml)│
                   └──────────────────────────────┘
                     │        │         │
              step_by_agent   │    step_uses_skill
                     ▼        ▼         ▼
                  Agent    output_type  Skill
                              │
                        evidenced_by
                              ▼
                       evidence_model
```

An Activity carries exactly one `phase` and exactly one `stage`. The mapping between the two axes
is many-to-many. The design asserts no rule linking them; the relation is observable in the graph
and is never enforced.

### 3.2 Layer ownership

| Layer | Owns | Example |
|---|---|---|
| Workspace (L0 / `templates/common`) | Schemas, contracts, validators, vocabularies, governance | `templates/common/schemas/process.schema.json` |
| Template (L1 `templates/co-*`) | Domain content only | `templates/co-consult/process/stages.yaml` |
| Project (L2 `Projects/*`) | Instance records and execution evidence | `docs/decisions/DEC-*.md` |

---

## 4. Process Layer — Stage and Activity

### 4.1 Stage definition file

Each variant declares its stages in `templates/<variant>/process/stages.yaml`.

```yaml
schema_version: "1.0"
variant: co-consult
stages:
  - id: S1                        # pattern ^S[0-9]+$
    title: Current State Diagnosis
    order: 1                      # unique integer, contiguous from 1
    purpose: >
      Establish a fact-based picture of the client organization.
    entry_criteria:
      - "Engagement kickoff completed."
    exit_criteria:
      - "Diagnosis findings reviewed by the accountable agent."
    decision_point: DG-CONSULT-01 # optional; resolves in decisions/gates.yaml
    owner_agent: strategy-analyst # resolves to a real agent file
```

### 4.2 Procedure schema additions

Three fields are added to `procedures/<name>/schema.yaml`. One field is removed.

```yaml
stage: S1                         # ADDED. Resolves in process/stages.yaml.
phase: 1                          # UNCHANGED. PM execution axis.
raci:                             # ADDED. A and R derive from existing fields.
  consulted: [ sme ]
  informed:  [ delivery-manager ]
decision_points: [ DG-CONSULT-01 ] # ADDED. Replaces quality_gates.
evidence:                          # WIDENED. Accepts string or object.
  - type: tbm_record
    model: evidence-models/_shared/tbm-record.json
    required: true
quality_gates: []                  # REMOVED at P5 completion. See §9.3.
```

### 4.3 Normative non-conflation rule

Write this rule into CONSTITUTION §6.7 as invariant 7:

> A procedure declares one `phase` and one `stage`. `phase` drives coverage units. `stage` drives
> domain sequence. No validator may derive one field from the other. No validator may require a
> fixed mapping between them.

### 4.4 Skill executability contract

A step's `skill_key` already resolves to a real skill. This design adds no new frontmatter to
SKILL.md. Executability is expressed by the step, not by the skill: a step declares the agent that
runs it, the skill it executes, and the output type it produces. That triple is the executable SOP
contract. Adding a parallel contract inside SKILL.md would create a second source of truth and is
rejected.

---

## 5. Stage Bootstrap Algorithm

### 5.1 Why a naive algorithm fails

The owner selected mechanical bootstrap over hand-authoring. A naive rule that groups procedures by
`phase` cannot work. Measured cardinality per variant:

| Variant | Procedures | Distinct phases | Slack |
|---|---:|---:|---:|
| co-abap | 6 | 6 | 0 |
| co-develop | 6 | 6 | 0 |
| co-security | 6 | 6 | 0 |
| co-news | 5 | 5 | 0 |
| co-work | 4 | 4 | 0 |
| co-safety | 3 | 3 | 0 |
| co-hr | 4 | 3 | 1 |
| co-consult | 5 | 4 | 1 |
| co-design | 5 | 4 | 1 |
| co-export | 5 | 4 | 1 |
| co-game | 7 | 6 | 1 |
| co-price | 7 | 6 | 1 |
| co-deck | 11 | 7 | 4 |

In six of thirteen variants the procedure-to-phase mapping is **already exactly 1:1**. Grouping
those procedures by phase reproduces the phase axis exactly and defeats D2. The algorithm must use
a different signal.

### 5.2 Available signals

| Signal | Coverage | Usable |
|---|---|---|
| `inputs:` / `outputs:` artifact flow | 51 of 75 procedures carry non-empty `inputs` | yes — primary |
| Typed `relations:` | 49 `follows`, 30 `enables`, 5 `composes_with` | yes — secondary |
| Procedure name prefix | Visible in co-deck (`version-*-control`) | yes — tiebreak only |
| `phase:` | All | **forbidden as a grouping key** |

### 5.3 Algorithm (normative)

Run per variant. Name the script `bootstrap-stages.ts`.

**Input.** All `templates/<variant>/procedures/*/schema.yaml` and
`templates/<variant>/procedures/_output-types.yaml`.

**Step 1 — Build the handoff graph.** Create one node per procedure. Add a directed edge
`P → Q` when any type in `P.outputs` appears in `Q.inputs`, or when `Q.relations` contains
`follows` or `enables` targeting `P`.

**Step 2 — Compute the longest-path layering.** Assign each procedure a level equal to the length
of the longest path reaching it from any source node. Sources take level 1.

**Step 3 — Draw stage boundaries at articulation points.** Cut the graph at every node whose
removal disconnects the handoff graph, and at every node that consumes an output type produced by
two or more procedures in earlier levels. Each resulting segment becomes one candidate stage.

**Step 4 — Merge undersized segments.** Merge any segment holding one procedure into its
predecessor segment when both share at least one output type in `_output-types.yaml`. Stop merging
when a segment reaches three procedures.

**Step 5 — Apply the name-prefix tiebreak.** When Step 3 yields no cut for a variant, split on the
longest shared procedure-name prefix of length two tokens or more. co-deck splits
`version-*-control` from the content procedures by this rule.

**Step 6 — Derive `order`.** Set `order` to the ascending minimum level of each segment's members.
Break ties by the lexical order of the segment's lowest procedure id.

**Step 7 — Emit.** Write `process/stages.yaml`. Set `title` from the segment's highest-level
procedure `title`. Leave `purpose`, `entry_criteria`, and `exit_criteria` as `PENDING_REVIEW`
markers. Set `owner_agent` to the most frequent `owner_agent` among the segment's procedures.

### 5.4 Distinctness acceptance check (mandatory for P2)

Add `--distinctness` mode to `validate-process.ts`. For each variant compute the stage-to-phase
mapping cardinality.

**Rule DEG-P-01 (FATAL).** Reject a variant when every stage maps to exactly one distinct phase
**and** every phase maps to exactly one distinct stage. That condition means the stage axis is a
relabeling of the phase axis.

**Rule DEG-P-02 (WARN).** Flag a variant when the count of stages equals the count of distinct
phases, even if the mapping is not bijective. Review the flag at the Design Gate.

**Report.** Emit a per-variant mapping-cardinality table into the P2 pull request body:
`variant | stages | distinct phases | max phases per stage | bijective? | DEG-P-01`.

### 5.5 Handling bootstrap failure — the deferred set

DEG-P-01 stays FATAL. A variant that fails it does **not** receive a hand-written stage set inside
this rollout.

**Scope decision (owner, 2026-09-19).** The six zero-slack variants — co-abap, co-develop,
co-security, co-news, co-work, co-safety — remain at `deg_conformance: "core"` for the entire
duration of this programme. Uplift to `governed` is explicitly **out of scope** here. It becomes
future work, gated on a human Stage-authoring pass that this design does not commit to delivering.

Register a governance ticket keyed `stage_bootstrap:<variant>`, source `bootstrap-stages`, kind
`manual`, for each of the six. That ticket is a **record of deferred work, not a blocking
dependency**. P5, P6, and P7 complete with all six tickets open. No phase exit gate references
them. Read the phase table in §13.2 accordingly: nothing in this rollout is blocked on six open
tickets.

### 5.6 `core (stage-pending)` disposition

A variant that fails DEG-P-01 cannot commit a stages.yaml at all, so it cannot satisfy the plain
`core` requirement either. Define the disposition explicitly:

> A scope holding an open `stage_bootstrap:<variant>` ticket declares
> `deg_conformance: "core"` with `process_manifest.stages_file: null`, commits no `stages.yaml`,
> and is exempt from the `stage:` field requirement on its procedures. DEG-P-01 applies only to a
> stages.yaml that is actually committed, so no degenerate stage set can enter the repository.

This keeps the six variants valid rather than permanently failing, and it keeps the FATAL rule
intact for everyone else.

---

## 6. RACI Layer

### 6.1 Derivation rules

| Role | Source | Status |
|---|---|---|
| Accountable | procedure `owner_agent` | exists |
| Responsible | each step `agent_key` | exists |
| Consulted | procedure `raci.consulted` | new, explicit |
| Informed | procedure `raci.informed` | new, explicit |

### 6.2 Matrix artifact

Generate `templates/<variant>/governance/raci.yaml` from the procedures, commit it, and drift-check
it. It is a verification artifact, never a source of truth.

```yaml
schema_version: "1.0"
variant: co-consult
generated_from: procedures/
rows:
  - stage: S1
    activity: co-consult-current-state-diagnosis
    accountable: strategy-analyst
    responsible: [ industry-expert, sme, change-management-partner ]
    consulted:   [ sme ]
    informed:    [ delivery-manager ]
```

### 6.3 Invariants

| ID | Rule | Level |
|---|---|---|
| DEG-R-01 | Each activity declares exactly one accountable agent. | FATAL |
| DEG-R-02 | Each activity declares at least one responsible agent. | FATAL |
| DEG-R-03 | No agent holds both accountable and informed on one activity. | FATAL |
| DEG-R-04 | Every RACI agent key resolves to an agent file or a human-role registry entry. | FATAL |
| DEG-R-05 | The committed matrix matches a fresh regeneration. | FATAL |

### 6.4 Human decision authority

Adopt the co-newbiz `_human-roles.yaml` pattern at L1. A variant that assigns accountability to a
person rather than an AI agent registers the key in
`templates/<variant>/governance/_human-roles.yaml`. DEG-R-04 then skips the agent-file existence
check for that key only. The registry is the anti-gaming surface: a key earns the skip only by
being listed.

---

## 7. Artifact Model

### 7.1 Enriched output types

Keep `procedures/_output-types.yaml` as the single artifact registry. Keep the vocabulary closed.
Replace the stub value with a contract object.

```yaml
schema_version: "1.1"
variant: co-consult
output_types:
  diagnosis_findings:
    description: "Fact-based picture of the client organization."
    owner_agent: strategy-analyst
    format: markdown            # markdown|json|yaml|xlsx|pptx|docx|pdf|mixed
    fields:
      - { name: source_refs, type: array, required: true }
      - { name: as_of_date,  type: string, required: true }
    evidence_model: null        # or a path under evidence-models/
    retention: engagement       # session|engagement|permanent|regulated
```

### 7.2 Invariants

| ID | Rule | Level |
|---|---|---|
| DEG-A-01 | Every `output_type` referenced by a step or procedure exists in the registry. | FATAL (exists today) |
| DEG-A-02 | Every registry entry declares `owner_agent`, `format`, and `retention`. | FATAL at `governed` |
| DEG-A-03 | Every `owner_agent` resolves to an agent file or human-role entry. | FATAL |
| DEG-A-04 | A `retention: regulated` entry declares a non-null `evidence_model`. | FATAL |
| DEG-A-05 | The single-produces-edge rule (ADR-0063 INV-4) holds unchanged. | FATAL (exists today) |

`schema_version` moves from `"1.0"` to `"1.1"`. The parser accepts both. A `"1.0"` file passes at
`core` and fails DEG-A-02 at `governed`.

---

## 8. Evidence Model

### 8.1 Generalize the co-safety pattern

co-safety already runs a working evidence model. This design lifts its structure verbatim as the
contract and changes none of its files.

| Path | Role |
|---|---|
| `evidence-models/_shared/base/*.schema.json` | Cross-domain bases (`common`, `finding`, `corrective-action`) |
| `evidence-models/_shared/*.schema.json` | Cross-industry record types |
| `evidence-models/domains/<axis>/` | Domain specialization |
| `evidence-models/migrations/` | Versioned schema change |

### 8.2 Meta-schema

The Workspace publishes `templates/common/schemas/evidence-model.schema.json`. Every variant
evidence model must validate against it. Required top-level keys: `$schema`, `$id`, `title`,
`version`, `type`, `required`, `properties`. The meta-schema requires draft-07 and requires a
`record_id` property carrying a `pattern`.

### 8.3 Binding evidence to artifacts

Two binding points exist, and they serve different purposes.

| Binding | Meaning |
|---|---|
| `_output-types.yaml` `evidence_model` | The artifact type is always backed by this evidence schema. |
| Procedure `evidence[]` entries | This activity must collect this evidence, independent of its outputs. |

### 8.4 Invariants

| ID | Rule | Level |
|---|---|---|
| DEG-E-01 | Every `evidence.model` path exists and validates against the meta-schema. | FATAL at `evidenced` |
| DEG-E-02 | A string-form `evidence` entry resolves to a real repository path. | WARN at `governed`, FATAL at `evidenced` |
| DEG-E-03 | No evidence model carries a country mark in its filename. | FATAL (extends ADR-0057/0058) |

---

## 9. Decision Model

### 9.1 Gate definitions versus decision records

Two distinct artifacts. Never merge them.

| Artifact | Layer | Meaning | Governance |
|---|---|---|---|
| `templates/<variant>/decisions/gates.yaml` | Template (L1) | The gate **definition** — a reusable decision point in the domain process | this design, ADR-0082 |
| `docs/decisions/DEC-*.md` | Workspace and project | The decision **record** — one ruling actually made | ADR-0061, `validate-decisions.ts` |

A gate is a type. A record is an instance. `record_kind: DEC` links the two.

### 9.2 Gate schema

```yaml
schema_version: "1.0"
variant: co-consult
gates:
  - id: DG-CONSULT-01           # pattern ^DG-[A-Z0-9]+-[0-9]{2}$
    title: Diagnosis accepted
    stage: S1
    decider_agent: strategy-analyst   # must equal the stage owner_agent
    inputs: [ diagnosis_findings ]    # output_type references
    criteria:
      - "Every finding cites a verifiable source."
    outcomes: [ proceed, rework, stop ]  # closed enum, minimum two
    record_kind: DEC
```

### 9.3 `quality_gates` migration

The field is deprecated everywhere and **removed only from scopes that reach `governed`**.

The §5.5 scope decision forces this split. Six variants stay at `core` and keep 32 prose entries.
Removing the field globally would leave them with neither prose gates nor decision gates — a
capability regression. Measured distribution of the 86 entries:

| Set | Scopes | Procedures | `quality_gates` entries | Disposition |
|---|---:|---:|---:|---|
| Governed | 8 | 45 | **49** | migrate to `gates.yaml`, then remove the field |
| Deferred (`core`) | 6 | 30 | **32** | field retained, marked deprecated, WARN only |
| `l0` root namespace | 1 | 5 | **5** | migrate with the governed set (workspace-owned) |
| **Total** | | **80** | **86** | |

All 54 entries in the governed and `l0` sets migrate into gate definitions.

**Mechanical conversion rule.** An entry converts mechanically when it states a verifiable
condition. Set `criteria` to the original sentence, `stage` to the procedure's bootstrapped stage,
`decider_agent` to the procedure `owner_agent`, `inputs` to the procedure `outputs`, and `outcomes`
to `[proceed, rework]`.

**Manual conversion required.** An entry needs a human pass when it names no verifiable condition,
names an actor the procedure does not list, or bundles two conditions in one sentence. Observed
examples that will need a human pass:

| Entry | Problem |
|---|---|
| `"Implementation plan approved at the design gate."` | Names an external gate this design does not define. |
| `"No open P0/P1 defects at go/no-go."` | Names a go/no-go gate with no defined decider or outcomes. |
| `"Post-release security follow-ups are recorded or explicitly waived."` | Two outcomes bundled; the waiver path needs its own outcome value. |
| `"Every exported artifact maps to an auditable source revision."` | A continuous invariant, not a point decision. Candidate for retirement rather than conversion. |

Route every non-mechanical entry to a governance ticket keyed
`gate_migration:<variant>:<procedure>`. Do not auto-convert.

**Retirement path — decided, not recommended.** The owner settled this on 2026-09-19. An entry that
expresses a continuous invariant rather than a point decision **retires** as `N/A_JUSTIFIED` with a
written reason, mirroring the ADR-0063 coverage-gap disposition. It is **not** converted into an
artifact-level validation rule. Removing the field must never force invented gates. The four
entries named in the table above are the known members of this set; the migration pass may find
more.

### 9.4 Invariants

| ID | Rule | Level |
|---|---|---|
| DEG-D-01 | Every `decision_points` id resolves in `gates.yaml`. | FATAL |
| DEG-D-02 | Every gate `stage` resolves in `stages.yaml`. | FATAL |
| DEG-D-03 | Every gate declares two or more `outcomes`. | FATAL |
| DEG-D-04 | A gate `decider_agent` equals its stage `owner_agent`. | FATAL |
| DEG-D-05 | No procedure in a `governed` scope retains a `quality_gates` field after P5. A `core` scope may retain it. | FATAL at `governed`, WARN at `core` |
| DEG-D-06 | Every gate `inputs` entry exists in `_output-types.yaml`. | FATAL |

---

## 10. Domain Execution Graph

### 10.1 Naming

The **Domain Execution Graph (DEG)** is a vocabulary profile, not a file. It spans Stage, Activity,
Agent, Skill, Artifact, Evidence, Decision, and RACI. The existing `docs/skill-graph.json` remains
the only graph file and gains a top-level marker `graph_profile: "deg/v1"`.

This separation resolves the naming collision directly. "Skill graph" names the artifact that
ADR-0060 governs. "Domain Execution Graph" names the wider node and edge vocabulary carried inside
it. Nothing supersedes `skill-graph.json`, and nothing wraps it.

A human view `docs/execution-graph.md` is emitted beside the existing `docs/skill-graph.md`.

### 10.2 New node types

| Type | Id form | `source` |
|---|---|---|
| `stage` | `stage.<variant>.<id>` | `process_schema` |
| `decision_gate` | `gate.<variant>.<id>` | `decision_model` |
| `evidence_model` | `evidence.<variant>.<name>` | `evidence_model` |

### 10.3 New edge types

| Type | From → To | `source` |
|---|---|---|
| `in_stage` | procedure → stage | `process_schema` |
| `stage_follows` | stage → stage | `process_schema` (from `order`) |
| `accountable_for` | agent → procedure | `raci_matrix` |
| `consulted_on` | agent → procedure | `raci_matrix` |
| `informed_of` | agent → procedure | `raci_matrix` |
| `gated_by` | stage → decision_gate | `decision_model` |
| `decides_on` | decision_gate → output_type | `decision_model` |
| `evidenced_by` | output_type → evidence_model | `artifact_model` |

### 10.4 Mapping to the owner's proposal

| Proposal edge | DEG edge | State |
|---|---|---|
| `Activity → performed_by → Agent` | `step_by_agent` | exists |
| `Activity → executes → Skill` | `step_uses_skill` | exists |
| `Activity → produces → Artifact` | `produces` | exists |
| `Activity → supported_by → Evidence` | `evidenced_by` (via output_type) | new |
| `Activity → contributes_to → Decision` | `gated_by` + `decides_on` | new |
| `Activity → governed_by → RACI` | `accountable_for` / `consulted_on` / `informed_of` | new |

No existing edge is renamed.

### 10.5 Generator decision

Extend `generate-skill-graph.ts` `buildGraph()` and `buildScopeGraph()`. Do not add a sibling
generator. Rationale: per-scope graphs must stay self-contained (ADR-0060 Amendment 2), and a
sibling generator would need to re-read the same procedure corpus and re-implement scope resolution.

### 10.6 Provenance and override exclusion

Every DEG node and edge carries a `source` value from §10.2 and §10.3. `verify-skill-graph.ts`
rejects any `skill-graph.overrides.json` entry whose endpoints carry a DEG `source`. This extends
the Amendment 5 rule that already bars overrides on `source: procedure_schema`.

---

## 11. Workspace and Template Boundary

### 11.1 Workspace layer

| File | Content |
|---|---|
| `templates/common/schemas/process.schema.json` | Stage and Activity contract |
| `templates/common/schemas/raci.schema.json` | RACI matrix contract |
| `templates/common/schemas/artifact-model.schema.json` | Enriched output-type contract |
| `templates/common/schemas/evidence-model.schema.json` | Evidence meta-schema |
| `templates/common/schemas/decision-model.schema.json` | Gate contract |
| `templates/common/process/_template/stages.yaml` | Authoring skeleton |
| `templates/common/decisions/_template/gates.yaml` | Authoring skeleton |
| `scripts/validate-process.ts`, `scripts/validate-raci.ts`, `scripts/bootstrap-stages.ts` | Validators and bootstrap |

`templates/common/` ships **zero** domain stages and **zero** domain gates. It ships skeletons only,
matching how `templates/common/procedures/_template/` works today.

**Settled decision (owner, 2026-09-19): `templates/common` is exempt from the stage requirement and
from DEG-P-01.** It holds exactly one procedure, so a stage axis over it carries no information.
It declares `process_manifest.stages_file: null` and carries no `stage:` field. It still reaches
`governed` for the artifact, RACI, and decision-gate requirements, which do not depend on stages.

### 11.2 Template layer

| File | Content |
|---|---|
| `templates/<variant>/process/stages.yaml` | Domain stages |
| `templates/<variant>/governance/raci.yaml` | Generated matrix |
| `templates/<variant>/governance/_human-roles.yaml` | Human decision-authority keys (optional) |
| `templates/<variant>/decisions/gates.yaml` | Domain decision gates |
| `templates/<variant>/evidence-models/**` | Domain evidence schemas (optional) |
| `templates/<variant>/procedures/**` | Extended activities and artifact registry |

### 11.3 `variant.json` additions

Two keys only.

```json
{
  "deg_conformance": "governed",
  "process_manifest": {
    "stages_file": "process/stages.yaml",
    "raci_file": "governance/raci.yaml",
    "gates_file": "decisions/gates.yaml",
    "evidence_models_dir": "evidence-models/"
  }
}
```

Inline stage or RACI arrays inside `variant.json` are rejected. The file already carries 15 keys,
and `variant-json-validator.ts` would grow a second large schema surface.

### 11.4 Conformance levels

| Level | Requires | Target in this rollout |
|---|---|---|
| `core` | stages, `stage:` on every procedure, RACI A and R derivable | transient P2 checkpoint for the 8 governed scopes; **permanent resting state for the 6 deferred scopes** (§5.5) |
| `core (stage-pending)` | `stages_file: null`, no `stage:` field, open `stage_bootstrap` ticket | the 6 zero-slack variants (§5.6) |
| `governed` | core, plus artifact contracts (DEG-A-02), decision gates, RACI C and I | **8 of 14 scopes**, plus the `l0` root namespace |
| `evidenced` | governed, plus evidence models bound to artifact types | optional; co-safety is the reference, but co-safety sits in the deferred set and stays at `core` this programme |

Downgrading a declared level requires a `DEC-*` record. The six deferred scopes are not a
downgrade — they never declare `governed` in this programme, so no record is needed.

**Note on co-safety.** co-safety owns the only working evidence models in the workspace, yet it is
one of the six zero-slack variants and therefore stays at `core`. Its evidence models are
**unchanged and untouched** by this rollout. The `evidenced` level is defined here and stays
unclaimed until co-safety completes its Stage-authoring pass in later, separately scoped work. §15
records this as an accepted consequence.

---

## 12. Validation and Governance

### 12.1 Validator assignment

| Check family | Script | Status |
|---|---|---|
| DEG-P-* (stages, distinctness) | `validate-process.ts` | new |
| DEG-R-* (RACI) | `validate-raci.ts` | new |
| DEG-A-* (artifacts) | `validate-procedures.ts` | extend |
| DEG-D-* (gates) | `validate-procedures.ts` | extend |
| DEG-E-* (evidence) | `validate-procedures.ts` | extend |
| Graph drift and determinism | `verify-skill-graph.ts` | extend |
| Structural Convergence | `validate-templates.ts` | extend |

### 12.2 Structural Convergence Rule

> When 50 percent or more of variants declare a structurally identical stage set, artifact type,
> evidence model, or decision-gate kind, promote the definition to `templates/common/`. Do not
> duplicate it per variant.

`validate-templates.ts` enforces the threshold and lists the affected files. This mirrors the
existing Anti-Swelling Rule in CONSTITUTION §7.5 and is the safety valve that stops 14 scopes from
accumulating divergent near-identical structure.

Structural identity means: for stages, the same ordered set of `title` values; for artifact types,
the same `format` plus the same `fields` name set; for gates, the same `outcomes` set plus the same
`criteria` text.

### 12.3 Sync gating

Wire `validate-process.ts` and `validate-raci.ts` into the audit layer beside
`validate-procedures.ts`. `/sync` step 4.65 already regenerates and verifies the graph; the DEG
additions ride that existing gate with no new step.

### 12.4 ADR requirement

This design needs one new ADR and two amendments to existing ADRs.

| Document | Content | Produced here |
|---|---|---|
| **ADR-0082** | Stage axis, DEG vocabulary, conformance levels, Structural Convergence Rule | **yes** |
| ADR-0060 Amendment 10 | DEG node and edge vocabulary inside `skill-graph.json` | no — belongs to the P3 pull request |
| ADR-0063 amendment | `stage:` field, `evidence` widening, `quality_gates` removal | no — belongs to the P2 and P5 pull requests |

Amendments edit ADRs that other work depends on. Writing them now, before the implementation lands,
would record decisions whose implementation may still shift. They are listed as required follow-up.

**Settled per S4:** each amendment lands **inside its own implementing phase** — Amendment 10 with
P3, the ADR-0063 amendment with P5 — rather than being bundled into a single governance pull
request after P5. This keeps each amendment reviewable against the code that realizes it.

---

## 13. Implementation Phases

### 13.1 Scope count and split

Fourteen scopes: 13 variant templates plus `templates/common`. The root `l0` namespace
(`procedures/`, 5 procedures) is workspace-owned and rides the governed track without being counted
as one of the 14. `Projects/co-newbiz` participates as donor and late alignment target (§13.3).

Per the §5.5 scope decision, the 14 split as follows.

| Set | Count | Scopes | Procedures | Target |
|---|---:|---|---:|---|
| **Governed** | **8** | co-consult, co-deck, co-design, co-export, co-game, co-hr, co-price, `templates/common` | **45** | `governed` |
| **Deferred** | **6** | co-abap, co-develop, co-news, co-safety, co-security, co-work | **30** | `core` / `core (stage-pending)` |
| `l0` root | — | `procedures/` | 5 | `governed` |
| | | **Total** | **80** | |

The deferred six are exactly the zero-slack variants measured in §5.1. The split is arithmetic, not
editorial: those six have no procedure-to-phase slack, so mechanical bootstrap cannot produce a
distinct stage axis for them.

### 13.2 Phase table

| Phase | Scope | Files to change | Exit gate |
|---|---|---|---|
| **P1 Contracts** | common only | 5 schemas in `templates/common/schemas/`, 2 skeletons in `templates/common/{process,decisions}/_template/` | Schemas self-validate. Zero variant files change. |
| **P2 Stage axis** | all 14 scopes (bootstrap runs everywhere) | `bootstrap-stages.ts`; `process/stages.yaml` ×7 (governed variants); `stage:` on 45 procedures; `variant.json` `deg_conformance` ×13 | `validate-process.ts` green. **DEG-P-01 distinctness report attached to the PR body.** The 6 expected failures declare `core (stage-pending)` per §5.6 and register `stage_bootstrap:<variant>` tickets. `templates/common` is exempt from DEG-P-01 and from the stage requirement (§11.1). |
| **P3 Graph** | scripts | `generate-skill-graph.ts`, `verify-skill-graph.ts`, `validate-procedures.ts`, new `validate-process.ts`, `validate-raci.ts`, `bootstrap-stages.ts`; SCRIPTS.md `@version` rows. **Lands ADR-0060 Amendment 10.** | Pre/post node-set diff equals zero for pre-existing types. `--determinism` green. |
| **P4 RACI** | 8 governed scopes + `l0` | `governance/raci.yaml` ×8 generated; `raci.consulted` / `raci.informed` on 45 procedures; optional `_human-roles.yaml` | DEG-R-01..05 green for governed scopes. Deferred scopes derive A and R only; no matrix authored. |
| **P5 Governed** | 8 governed scopes + `l0` | `decisions/gates.yaml` ×8; **54** `quality_gates` entries migrated (49 governed + 5 `l0`); `_output-types.yaml` enriched to `schema_version: "1.1"` ×8; `quality_gates` removed from governed scopes only. **Lands the ADR-0063 amendment.** | DEG-A-02, DEG-D-01..06 green. **8 of 14 scopes declare `deg_conformance: "governed"`.** The 6 deferred scopes remain `core` and retain 32 prose entries under a deprecation WARN. |
| **P6 Evidenced** | **none in this rollout** | — | **Deferred.** co-safety was the only candidate and now sits in the deferred set (§11.4). The `evidenced` level and DEG-E-01..03 are specified and validated but unclaimed. P6 activates when co-safety completes its Stage-authoring pass in later work. |
| **P7 co-newbiz alignment** | `Projects/co-newbiz` | `gate:` to `stage:` adapter; `graph.ts` reconciliation | See §13.3. Not blocked by any `stage_bootstrap` ticket. |

**No phase exit gate depends on a `stage_bootstrap:<variant>` ticket.** The programme completes at
P7 with all six tickets open by design.

### 13.3 `Projects/co-newbiz`

co-newbiz sits outside `templates/`, carries its own remote, and already implements the Stage axis
under the name `gate:`. Three questions, answered.

**(a) Contract consumption.** co-newbiz consumes the same
`templates/common/schemas/*.schema.json` contracts, through a thin field adapter rather than a
separate schema. The adapter maps `gate: "Pre-FS"` to `stage: S3` using a committed
`process/stage-aliases.yaml`. Writing a second co-newbiz-only schema would fork the meta-model and
contradict the owner's stated principle that the Workspace standardizes one meta-model.

**(b) `graph.ts` reconciliation.** Extend `scripts/co-newbiz/graph.ts` in place. Do not replace it
with the common generator. Its 9 node and 12 edge types are a **superset** in the areas that
matter — it already emits `decision`, `rule`, `artifact`, and `var` nodes that the common generator
lacks. Replacing it would lose capability. The alignment task is to make its output carry
`graph_profile: "deg/v1"` and to rename only the edges that collide semantically with DEG names.
A later pass may upstream its `rule` and `var` node types into the common generator under the
ADR-0060 Amendment 7 upstreaming precedent.

**(c) Precedent for other `Projects/*`.** Pulling co-newbiz in does create a precedent that other
L2 project instances could later be aligned to DEG. **This design does not decide that.** Other
`Projects/*` instances are separate repositories with their own remotes and remain out of scope
until the owner raises the question.

### 13.4 Pull-request batching

`dev-sync.ts` touches shared pipeline files on every commit, and every phase regenerates
`skill-graph.json`. Parallel branches conflict by default. CONSTITUTION §3.3 sequential-branch
dependency therefore applies to the entire rollout: **merge each pull request before opening the
next.**

Batching resized for **8** scopes at `governed` rather than 14:

| Phase | Pull requests | Grouping |
|---|---:|---|
| P1 | 1 | common contracts |
| P2 | 3 | bootstrap script; then 14 scopes in batches of 7 and 7 |
| P3 | 2 | generator and verifier (with ADR-0060 Amendment 10); then validators |
| P4 | 2 | RACI for 8 governed scopes in batches of 4 and 4 |
| P5 | 4 | gates in batches of 4 and 4; artifact enrichment; field removal last (with the ADR-0063 amendment) |
| P6 | 0 | deferred — no target in this rollout |
| P7 | 2 | adapter; then graph reconciliation |

**Total: 14 sequential pull requests**, down from 18 in the pre-decision draft. P4 loses one PR and
P5 loses one because the authoring set shrank from 14 scopes to 8. P6 drops out entirely. P2 keeps
all 14 scopes because the bootstrap must still run everywhere to produce the distinctness report.

Per S4, each ADR amendment lands inside its implementing phase — Amendment 10 in P3, the ADR-0063
amendment in P5 — rather than being bundled into a separate governance PR after P5.

### 13.5 Authoring cost — measured

The pre-decision draft estimated this as "roughly 20 gate definitions and 19 procedures" across
four low-ceremony variants. Both numbers were estimates. The measured counts follow, and the honest
result is that the cost went **up** for the variants that remain, even though the scope set shrank.
The original estimate undercounted.

**Programme totals.**

| Item | This rollout (8 scopes + `l0`) | If all 14 had reached `governed` | Deferred |
|---|---:|---:|---:|
| Gate definitions to author | **54** | 86 | 32 |
| Procedures needing RACI C and I | **50** | 80 | 30 |
| `stages.yaml` files to author | **7** | 13 | 6 |
| `_output-types.yaml` enrichments | **8** | 14 | 6 |

**Low-ceremony cost, recomputed.** co-news leaves this set — it is one of the six zero-slack
variants and stays at `core`. Three low-ceremony variants remain:

| Variant | Procedures | Gate definitions |
|---|---:|---:|
| co-deck | 11 | 12 |
| co-design | 5 | 5 |
| co-game | 7 | 7 |
| **Total** | **23** | **24** |

The low-ceremony burden is therefore **24 gate definitions across 23 procedures**, against the
draft's estimated 20 gates and 19 procedures for four variants. Dropping co-news removed 5
procedures and 6 gates, but the three remaining variants were undercounted by more than that —
co-deck alone carries 11 procedures and 12 gates. The cost is real and unbudgeted. §15 records it
as accepted rather than hidden.

---

## 14. Backward Compatibility

| Consumer | Impact | Mitigation |
|---|---|---|
| `verify-skill-graph.ts` | Sees new node and edge types | Filters by `type`; new types are additive |
| ADR-0060 tooling | Unchanged node ids for existing types | Pre/post node-set diff must equal zero (P3 exit gate) |
| `procedure-coverage.ts` | None — `phase` untouched | D2 non-conflation rule |
| 20 `N/A_JUSTIFIED` coverage tickets | None | `phase` semantics frozen |
| `_output-types.yaml` parsers | `schema_version` moves to `"1.1"` | Parser accepts `"1.0"` and `"1.1"` |
| `validate-decisions.ts` (ADR-0061) | None — gate definitions are a separate artifact | §9.1 separation |
| co-safety evidence models | None — zero files changed | co-safety is the reference implementation |
| `skill-graph.overrides.json` | DEG endpoints barred | Extends the existing Amendment 5 rule |

The single breaking change in the whole rollout is the removal of `quality_gates`, and per S1 it is
now **partial**: the field is removed from the 8 governed scopes and the `l0` namespace at P5, and
**retained** in the 6 deferred scopes under a deprecation WARN. DEG-D-05 is level-scoped
accordingly (§9.4). Any consumer reading `quality_gates` must therefore tolerate the field being
present or absent depending on the scope's declared conformance level, rather than assuming a clean
cutover.

---

## 15. Risks, Settled Decisions, and Open Questions

### 15.1 Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | ~~Mechanical bootstrap cannot produce a distinct stage axis in the six zero-slack variants.~~ **Closed — converted to a scope decision, not a risk.** | **Closed** | See §15.2 S1. The six variants intentionally stay at `core`; no phase depends on them. |
| R2 | `governed` forces ceremony onto three low-ceremony variants (co-deck, co-design, co-game). | Medium | Accepted by owner decision. Cost measured in §13.5: 24 gates across 23 procedures. |
| R3 | Some `quality_gates` entries cannot convert mechanically. | Medium | §9.3 conversion rule, `gate_migration:` tickets, and a retirement path settled per S3. |
| R4 | 14 sequential pull requests is a long serialized chain. | Medium | Phases are independently valuable; the rollout may pause after any merged phase. |
| R5 | co-newbiz `graph.ts` and the common generator drift after P7. | Medium | Both emit `graph_profile: "deg/v1"`; add a cross-scope profile check. |
| R6 | Structural Convergence Rule fires early and forces premature promotion to common. | Low | Threshold matches the proven §7.5 precedent; structural identity is defined narrowly in §12.2. |
| **R7** | **The `evidenced` level ships with no adopter.** co-safety is the only variant with working evidence models and it sits in the deferred set, so DEG-E-01..03 are specified and implemented but never exercised in this rollout. | **Medium** | Accepted. P6 is deferred (§13.2). Validate DEG-E-* against co-safety's existing models in read-only mode during P3 so the rules are not shipped wholly untested. |
| **R8** | **`quality_gates` survives in six scopes**, so the workspace carries two gate representations — prose at `core`, structured at `governed` — until the deferred set is uplifted. | Low | DEG-D-05 is level-scoped (§9.4). The deprecation WARN keeps the split visible rather than silent. |

### 15.2 Settled decisions (owner, 2026-09-19)

| ID | Decision | Recorded in |
|---|---|---|
| **S1** | The six zero-slack variants (co-abap, co-develop, co-news, co-safety, co-security, co-work) target **`core` only**. Uplift to `governed` is out of scope for this programme and becomes future work gated on a human Stage-authoring pass. DEG-P-01 stays FATAL; the `stage_bootstrap:<variant>` tickets are records of deferred work, never blocking dependencies. | §5.5, §5.6, §11.4, §13.1, §13.2 |
| **S2** | `templates/common` is exempt from the stage requirement and from DEG-P-01. It still reaches `governed` on the artifact, RACI, and gate axes. | §11.1, §13.2, §16 |
| **S3** | Continuous-invariant `quality_gates` entries **retire** as `N/A_JUSTIFIED`. They are not converted into artifact-level validation rules. | §9.3 |
| **S4** | ADR-0060 Amendment 10 lands with P3; the ADR-0063 amendment lands with P5. Neither is bundled into a separate governance pull request. | §12.4, §13.2, §13.4 |

### 15.3 Open questions

None outstanding. Q-A through Q-D are settled above as S1 through S4.

Two items surfaced **by** those decisions are recorded as risks rather than questions, because each
has a stated disposition that needs no owner input to proceed: R7 (the `evidenced` level ships
unadopted) and R8 (two gate representations coexist). Raise either to a question only if the owner
wants a different disposition.

---

## 16. Platform Impact

### Claude Code

Each phase in §13.2 becomes one PM Gateway execution-plan row with an explicit `model` alias per
the agent's tier. No hook changes. The GateGuard PreToolUse hook already covers first-edit
investigation for the new files. `bootstrap-stages.ts` runs under `bun` like every other workspace
script and requires a SCRIPTS.md registry row plus an in-file `@version`, per the known dev-sync
FATAL on modified scripts without a version bump.

### Antigravity

Hooks do not fire in Antigravity, so `validate-process.ts` and `validate-raci.ts` must be reachable
as plain `bun scripts/<name>.ts` invocations and must be added to the GEMINI.md manual-fallback
table alongside the existing manual lifecycle-check entry. This design adds no slash command, so
`.claude/commands/` and `.gemini/commands/` parity is unaffected. Agents self-enforce the pre-edit
quality gate when authoring stage and gate files.

### templates/common

`templates/common` is the primary carrier. All five schemas and both authoring skeletons ship there
and reach every new scaffold through the existing propagation map. It ships zero domain stages and
zero domain gates — skeletons only.

`templates/common` also holds one procedure of its own and participates in P2, P4, and P5 as one of
the 8 governed scopes. **Settled per S2: it is exempt from the stage requirement and from
DEG-P-01**, because a stage axis over a single procedure carries no information. It declares
`process_manifest.stages_file: null` and reaches `governed` on the artifact, RACI, and
decision-gate axes only.

---

## 17. References

- **ADR-0082** — [Domain Execution Graph and Stage Axis](../adr/0082-domain-execution-graph-and-stage-axis.md) (this design's decision record)
- ADR-0060 — [Skill Relationship Graph as Generated Projection](../adr/0060-skill-relationship-graph-generated-projection.md), Amendments 1–9
- ADR-0061 — Decision Record Chain
- ADR-0063 — [Procedure Schema as Canonical Workflow Source](../adr/0063-procedure-schema-canonical-workflow-source.md)
- ADR-0079 — Simplified English Development Instructions
- CONSTITUTION §5.7 Additive Template Architecture, §6 Skill Lifecycle, §6.7 Procedure Lifecycle, §7.5 Common Layer Governance
- `docs/designs/2026-08-29-procedure-schema-design.md`
- `docs/designs/2026-08-29-procedure-coverage-and-l0-design.md`
- `docs/designs/variant-registry-architecture-design.md` (structural precedent)
- `templates/co-safety/evidence-models/` (evidence reference implementation)
- `Projects/co-newbiz/procedures/`, `Projects/co-newbiz/scripts/co-newbiz/graph.ts` (stage-axis reference implementation)
