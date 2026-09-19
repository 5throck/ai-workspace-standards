# Design: Actor Model, Evidence Backporting, and Graph Delta Log

**Date**: 2026-09-19
**Status**: Approved
**Spec ID**: 2026-09-19-actor-model-and-evidence-backport
**Scope**: `templates/common/schemas/raci.schema.json`, `templates/common/schemas/graph-delta.schema.json` (new), `templates/co-*/governance/`, `scripts/generate-raci.ts`, `scripts/validate-raci.ts`, `scripts/generate-skill-graph.ts`, `scripts/verify-skill-graph.ts`, `scripts/dev-sync.ts`, `skills/project-resync/SKILL.md`, `scripts/evidence-backport-scan.ts` (new), `scripts/graph-delta-log.ts` (new), `templates/co-*/evidence-models/`, `docs/graph-deltas/` (new)
**ADR of record**: [ADR-0084](../adr/0084-actor-model-evidence-backporting-graph-delta-log.md)
**Extends**: ADR-0083 (Domain Execution Graph and Stage Axis), design `2026-09-19-template-domain-operating-system`
**Related**: ADR-0043 (L1 agent layer and promotion threshold), ADR-0031 (project-versus-template boundary), ADR-0061 (evidence chain and overlay contract), ADR-0079 (instruction writing standard)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Decision Summary](#2-decision-summary)
3. [Actor Model](#3-actor-model)
4. [Evidence Backporting](#4-evidence-backporting)
5. [Graph Delta Log](#5-graph-delta-log) — consumed by §4.5
6. [Backward Compatibility](#6-backward-compatibility)
7. [Platform Impact](#7-platform-impact)
8. [Open Questions](#8-open-questions)
9. [References](#9-references)

---

## 1. Problem Statement

The Domain Operating Model design registers three Future Extensions in §1.5.3 and marks all three
as named but not designed: an **Actor Model**, a richer **Evidence Model**, and a **SkillHone
Evolution Loop**.

This design covers the first two in full, and builds **only the evidence-collection substrate** for
the third. The SkillHone Evolution Loop itself stays undesigned and out of scope — §5 records graph
deltas so that a future loop has raw material to consume, and stops there.

### 1.1 What already exists — Actor side

The human-versus-agent distinction is **half built**, further along than ADR-0083's "not designed"
label suggests. Verified 2026-09-19:

| Element | State | Location |
|---|---|---|
| Human-role registry concept | Proven in one project | `Projects/co-newbiz/procedures/_human-roles.yaml` — 3 entries (`entity-ic-reviewer`, `bau-exit-certifier`, `venture-portfolio-ic`), each with a description and a governing design reference |
| Registry promoted to L1 | **Already decided** | Domain Operating Model design §6.4 adopts the pattern at `templates/<variant>/governance/_human-roles.yaml` |
| Registry read by the validator | **Already implemented** | `scripts/validate-raci.ts` `loadHumanRoles()` (lines 73–90) and DEG-R-04 (lines 216–228): a RACI key resolves to an agent file **or** a human-role entry |
| Any template shipping the file | **None** | `find templates -name "_human-roles.yaml"` returns zero results |
| Actor type in the RACI schema | **Absent** | `templates/common/schemas/raci.schema.json` types `accountable` as one agent-key string and `responsible`/`consulted`/`informed` as agent-key arrays, with `additionalProperties: false` at the row level and no actor field anywhere |
| Actor type on graph edges | **Absent** | `scripts/generate-skill-graph.ts` emits `step_by_agent`, `accountable_for`, `consulted_on`, `informed_of` with no actor attribute and no distinct node kind for a human role |

So the gap is **not** "invent a human-role mechanism". The gap is that actor type is currently an
**implicit fact recoverable only by a registry join at validation time**. It is absent from the
committed artifact that humans read, absent from the graph that tooling queries, and enforced by
exactly one rule (DEG-R-04 existence) rather than by the stronger consistency rule co-newbiz
actually runs: *a human-role key used on a step that is not marked as a human decision is a
modeling defect*. That consistency rule has no template-layer analogue today.

### 1.2 What already exists — Evidence side

Three genuinely different evidence practices run in the fleet. All three are legitimate. Verified
2026-09-19:

| Form | Instance | Shape |
|---|---|---|
| **F1 — prose ledger** | `templates/co-news/skills/source-verification-ledger/SKILL.md` | Overlay on the common 5-column base (`claim \| source \| url/ref \| verification \| status`); adds a second source column and a receipt-number column to enforce `NEWS-R1` (2+ independent sources per material claim); owned by `fact-checker`; blocks handoff while any claim is `UNVERIFIED` |
| **F2 — registry-backed (formal-var)** | `Projects/co-newbiz/docs/evidence/README.md` | Not a ledger. An `evidence_var` registry (migrations 0017–0019+, `db/lib/snapshot-filler.ts`, run-scoped snapshots), executable gate predicates in `procedures/_kill-criteria/<procedure>__<criterion>.json`, a calibration corpus with 5-year retirement, and F-NNNN finding files under `docs/pilots/` and `docs/audits/` |
| **F3 — schema-typed** | `templates/co-safety/evidence-models/` | draft-07 JSON Schemas (`_shared/`, `domains/`, `migrations/`, `emergency/`) giving structural validation of evidence records. This is the reference implementation for the P6 `evidenced` conformance level |

The common skill `templates/common/.claude/skills/evidence-ledger/SKILL.md` deliberately authorizes
this diversity: it fixes only the 5-column base plus the Append-versus-Supersede discipline, and its
"Registry-backed overlays (formal-var form)" section explicitly blesses F2 as a legitimate overlay
form. Unifying the three forms is therefore **forbidden by an existing contract**, not merely
undesirable.

Two further facts constrain the design:

- **Evidence is not mandatory on every decision.** `Projects/co-newbiz/docs/decisions/DEC-20260909-01.md`
  carries `evidence_refs: []` because it is an architecture choice that cites ADRs through
  `knowledge_refs`. Any maturity metric that counts "decisions with empty `evidence_refs`" as
  failures will mis-measure a healthy plane.
- **The `evidenced` level ships with no adopter.** ADR-0083 §5 and design §11.4 state that DEG-E-01..03
  are specified and implemented but unclaimed, because co-safety owns the only working evidence models
  and sits in the six-variant deferred set at `core`.
- **A schema never collects anything; a procedure does.** In every working instance the schema is
  inert without a companion skill whose steps actually produce conforming records. Verified:
  `templates/co-safety/.claude/skills/audit-preparation/SKILL.md` lines 56–57 log each documentation
  gap as a record conforming to `evidence-models/_shared/base/finding.schema.json` (`FIND-YYYY-NNNN`)
  and track remediation through `corrective-action.schema.json` (`CA-YYYY-NNNN`);
  `hazop-analysis/SKILL.md` step 8 generates a record conforming to
  `evidence-models/domains/functional/psm/psm-pha-record.json`, step 7 registers the FIND/CA pair, and
  step 6 bands risk against `risk-assessment-record.json` as the declared single source of truth.
  co-news is the same pattern in prose form: the five numbered Execution Steps of
  `source-verification-ledger/SKILL.md` are what actually populate the ledger.

### 1.3 What already exists — graph-evolution side

`docs/skill-graph.json` is a generated projection, rebuilt from canonical sources (procedures, RACI,
gates, stages) on every `/sync`. The node and edge diff between two consecutive generations is
therefore a machine-observable record of how the Domain Operating Model **itself** changed — a
different kind of thing from domain Evidence, which is evidence about the business, safety, or
compliance world a template operates in. This is evidence about the model's own structural change.

**Correction to a common assumption.** `scripts/verify-skill-graph.ts --determinism` does **not**
compute a node-set diff. Verified at lines 519–530: it calls `buildGraph()` twice, compares
`JSON.stringify` of the two results for exact equality, and on failure prints only edge and node
**counts** as a bounded hint. There is no diff engine to reuse, and nothing is persisted. What the
flag does establish — and what this design reuses — is that `buildGraph()` is cheap, pure, and safe
to call repeatedly in-process. The diff itself must be built.

### 1.4 The genuine gaps

- **G1 (Actor).** Actor type is derivable but never recorded, never visible in the graph, and the
  human-executor consistency rule proven in co-newbiz has no template-layer expression.
- **G2 (Evidence).** Real evidence practice accumulates inside `Projects/co-*` instances and has no
  route back to `templates/co-*/`. `skills/project-resync/SKILL.md` Step 2 performs selective
  backport review across a 5-surface method, but evidence is not one of its named surfaces, there is
  no detector for which of F1/F2/F3 an instance runs, and there is no maturity bar deciding when an
  instance's practice is reusable rather than engagement-specific.
- **G3 (Graph evolution).** The graph's change history exists only as a git diff over a large
  generated JSON file — unqueryable in practice. Nothing records, in structured form, that a given
  commit added four procedures and eleven `accountable_for` edges to `co-hr`. The SkillHone Evolution
  Loop named in design §1.5.3 has no raw material to consume, and cannot be designed until it does.

---

## 2. Decision Summary

1. **Actor type is derived, never hand-authored.** Registry membership in
   `governance/_human-roles.yaml` types a key as `human`; resolution to an agent file types it as
   `agent`; resolving to neither remains DEG-R-04 FATAL, unchanged.
2. **The derived type is materialized into the committed RACI matrix** as an optional per-row
   `actor_types` map, and into the skill graph as an edge attribute plus a distinct `human_role`
   node kind.
3. **Two new invariants** carry the co-newbiz consistency rule into the template layer: DEG-R-06
   (human accountability must match a human-decided gate) and DEG-R-07 (`actor_types` coverage).
4. **Promote the mechanism now as strictly opt-in; do not mandate it at any conformance level until
   a second variant adopts it.** §3.5 justifies this against ADR-0043's 3-variant threshold.
5. **Evidence backporting extends `project-resync`, it does not replace it.** A new Step 2b and a
   new sibling script `scripts/evidence-backport-scan.ts` detect the overlay form, apply a five-test
   maturity bar, and emit a promotion candidate.
6. **The backport unit is a (schema, procedure) PAIR, never a schema alone.** Every promotion lands a
   draft-07 JSON Schema under `templates/co-<x>/evidence-models/` **together with** a companion
   `evidence-collection-<name>` skill generalized from the project skill that actually produced the
   records. A schema with no companion procedure is an incomplete backport, not a partial success.
7. **This feeds the existing `evidenced` path (DEG-E-01..03). It creates no second path.** co-safety
   remains the reference implementation and is untouched.
8. **A Graph Delta Log persists the per-`/sync` structural diff of the skill graph** into
   `docs/graph-deltas/`, governed by a new L1 schema. This is substrate only: recording deltas is in
   scope, synthesizing them into Knowledge and feeding SkillHone are explicitly out of scope.

---

## 3. Actor Model

### 3.1 Derivation rule (normative)

For every agent key appearing in any RACI role slot, the generator MUST resolve the key in this
order and MUST stop at the first match:

1. The key appears in `templates/<variant>/governance/_human-roles.yaml` under `human_roles:` →
   `actor_type: human`.
2. An agent file exists for the key → `actor_type: agent`.
3. Neither → DEG-R-04 FATAL, exactly as today.

Precedence order matters. A human role MUST take precedence over an accidental same-named agent
file, because the registry is the deliberate, human-curated surface and the agent file is not.

A variant that ships no `_human-roles.yaml` types every key as `agent`. That is the current state of
all nine variants holding `governance/raci.yaml`.

### 3.2 Schema extension — exact field shape

`templates/common/schemas/raci.schema.json` gains one optional row-level property. `schema_version`
moves from the current `const: "1.0"` to an enum accepting `"1.0"` and `"1.1"`.

```yaml
schema_version: "1.1"
variant: co-newbiz
generated_from: procedures/
rows:
  - stage: S4
    activity: co-newbiz-entity-ic-gate
    accountable: entity-ic-reviewer
    responsible: [deal-analyst, industry-lead]
    consulted: [region-lead]
    actor_types:
      entity-ic-reviewer: human
      deal-analyst: agent
      industry-lead: agent
      region-lead: agent
```

Schema fragment:

```json
"actor_types": {
  "type": "object",
  "additionalProperties": { "enum": ["human", "agent"] },
  "propertyNames": { "pattern": "^[a-z][a-z0-9]*(-[a-z0-9]+)*$" },
  "description": "Generated map from every agent key used in this row's R/A/C/I slots to its resolved actor type. Derived from governance/_human-roles.yaml; never hand-authored. Optional at schema_version 1.0."
}
```

Three properties of this shape are deliberate:

- **A flat key→enum map, not parallel arrays.** Parallel arrays couple to slot ordering and break
  silently when a role array is appended to. A map keyed by the agent key cannot desynchronize.
- **One named property, so `additionalProperties: false` survives intact** at the row level. No
  relaxation of the existing row contract is required.
- **Keys repeat across rows rather than being hoisted to a document-level table.** Rows stay
  independently readable and independently diffable, which is what a generated, drift-checked
  artifact needs.

A document-level `human_roles:` summary block was considered and rejected: it would duplicate the
registry file, and DEG-R-05 regeneration already guarantees the per-row map stays truthful.

### 3.3 New invariants

| ID | Rule | Level |
|---|---|---|
| DEG-R-06 | An activity whose `accountable` key types as `human` MUST have a matching gate in `decisions/gates.yaml` whose `decider_agent` is that same key. | FATAL at `governed`, and only for variants that ship `_human-roles.yaml` |
| DEG-R-07 | When `actor_types` is present, its key set MUST equal the union of the row's `accountable`, `responsible`, `consulted`, and `informed` keys — no missing entry, no extra entry. | FATAL whenever the property is present |

DEG-R-06 is the template-layer expression of co-newbiz's error-level consistency rule ("a registry
key used on a step without `decision_authority: human` is a modeling defect"). The template layer has
no per-step `decision_authority` field, so the equivalent anchor is the decision gate that ADR-0083
P5 already generates. A human role that is accountable for an activity with no human-decided gate is
the same defect in a different vocabulary: a person recorded as an executor rather than as a
decider.

DEG-R-06 is scoped to variants that ship the registry. A variant with no `_human-roles.yaml` can
never produce a `human` actor type, so the rule is vacuously satisfied and costs nothing.

DEG-R-05 (committed matrix matches a fresh regeneration) already covers `actor_types` drift with no
change: the map is generated, so a stale map fails regeneration comparison.

### 3.4 Downstream consumers

| Consumer | Change |
|---|---|
| `scripts/generate-raci.ts` | Load `governance/_human-roles.yaml` when present; resolve each row's key set per §3.1; emit `actor_types`; write `schema_version: "1.1"` only when the variant ships the registry, otherwise keep `"1.0"` and omit the map |
| `scripts/validate-raci.ts` | Already loads the registry for DEG-R-04. Add DEG-R-06 and DEG-R-07. Reuse `loadHumanRoles()` unchanged |
| `scripts/generate-skill-graph.ts` | Add `actor_type` as an attribute on `accountable_for`, `consulted_on`, `informed_of`, and `step_by_agent` edges. Add a `human_role` node kind distinct from `agent`, sourced from the registry. Register both in the generated edge-vocabulary documentation block |

Adding the `human_role` node kind is what makes the graph answer "which activities in this domain are
human-gated" as a single traversal, with no registry join. That query is the practical payoff of the
whole extension and is unanswerable today.

### 3.5 Promotion recommendation — promote now, opt-in, do not mandate

**Recommendation: promote the mechanism now as an optional schema addition. Do not raise it to a
requirement at any conformance level until a second variant ships `_human-roles.yaml`.**

Justification, addressing ADR-0043's threshold directly:

1. **ADR-0043's threshold does not govern this artifact.** ADR-0043 §4 gates promotion on Jaccard
   similarity ≥ 80% of `## Role` + `## Responsibilities` sections across 3 or more variants, measured
   by `agent-similarity-analyzer.ts`. That is a rule about **agent Markdown body content**, where
   premature promotion freezes prose that variants then fight. A workspace-layer JSON Schema field is
   a different kind of object, and the Domain Operating Model design §11.1 already assigns schemas and
   contracts to the Workspace layer by construction.
2. **The registry half is already promoted.** Design §6.4 adopted `_human-roles.yaml` at L1 and
   `validate-raci.ts` implements DEG-R-04 against it today. Asking whether to promote the actor
   concept is asking about a decision that has already landed. What remains is only whether the
   resolved type is *visible* in the artifact and the graph.
3. **Opt-in carries zero adoption cost.** With no registry file, nothing changes for any of the nine
   variants: no new file, no `schema_version` bump, no new output bytes, no new failing rule.
4. **The honest limit is mandating it.** One working instance is genuinely not evidence that every
   domain needs human-role modeling — co-deck and co-game plausibly never will. Making
   `actor_types` required, or making `_human-roles.yaml` mandatory at `governed`, would be promoting
   on an N of 1. That step MUST wait for a second adopter.

Concretely: ship §3.2 and §3.3 as optional; revisit mandating at `governed` when a second variant
ships the registry; keep `evidenced` silent on actor typing entirely.

---

### 3.6 Registry path — resolved

**The template-layer path is `templates/<variant>/governance/_human-roles.yaml`.** This is settled,
not a preference, because the implemented validator already reads exactly that path: verified at
`scripts/validate-raci.ts:75`, `loadHumanRoles()` resolves
`join(variantDir, 'governance', '_human-roles.yaml')`. Choosing `procedures/` would require changing
working, shipped code to match a project-layer convention, which inverts the dependency.

`Projects/co-newbiz/procedures/_human-roles.yaml` **stays where it is and is not migrated.** It is a
project-layer file read by project-local consumers (`scripts/co-newbiz/graph-map.ts`,
`procedures/_validate.ts`), and the two layers do not collide — the template-layer validator never
looks inside a project. The residual question is only what happens if co-newbiz is ever promoted to a
variant template, which §8 keeps open.

### 3.7 Adoption runbook for a variant opting in

A variant adopting the Actor Model MUST complete these five steps in order. No further design work is
required; every artifact and validator named here exists today or is specified in §3.2–§3.4.

1. **Create `templates/<variant>/governance/_human-roles.yaml`** following the co-newbiz registry
   format: a `human_roles:` mapping whose keys are kebab-case role keys, each with a `description`
   and a `reference` pointing at the governing design document or ADR. Every key MUST name a person
   role for which no `agents/<key>.md` file exists — the missing agent file is the point.
2. **Mark the corresponding procedure steps** with `decision_authority: human`, and ensure each such
   activity has a gate in `decisions/gates.yaml` whose `decider_agent` is the registry key. This is
   what DEG-R-06 checks; skipping it produces a human role recorded as an executor rather than a
   decider, which is the defect the invariant exists to catch.
3. **Regenerate the matrix**: `bun scripts/generate-raci.ts --scope <variant>`. The generator resolves
   each key per §3.1, emits `actor_types` for every row, and writes `schema_version: "1.1"`.
4. **Validate**: `bun scripts/validate-raci.ts --scope <variant>`. DEG-R-04 (keys resolve to an agent
   file or a registry entry), DEG-R-06 (human accountability matches a human-decided gate), and
   DEG-R-07 (`actor_types` covers exactly the row's R/A/C/I key set) MUST all pass, as MUST the
   pre-existing DEG-R-01/02/03/05.
5. **Regenerate and inspect the graph**: `bun scripts/generate-skill-graph.ts`, then confirm the
   registry keys appear as `human_role` nodes rather than `agent` nodes, and that the
   `accountable_for` edges leaving them carry `actor_type: human`. `bun scripts/verify-skill-graph.ts`
   MUST pass.

Adoption remains entirely opt-in. A variant that never performs step 1 is unaffected by every
subsequent step.

### 3.8 Zero-touch migration for the nine existing matrices

The nine committed `templates/*/governance/raci.yaml` files (co-abap, co-consult, co-deck, co-design,
co-export, co-game, co-hr, co-price, co-security) MUST validate **unchanged** against the widened
schema. Three properties guarantee this and each is independently checkable:

- `schema_version` moves from `const: "1.0"` to `enum: ["1.0", "1.1"]`. Widening an enum that already
  contains the only value in use cannot reject a file that previously passed.
- `actor_types` is an **optional** property, so its absence is valid. Row-level
  `additionalProperties: false` is untouched, because the addition is a named property rather than a
  relaxation.
- DEG-R-06 activates only for variants shipping `_human-roles.yaml`, and none of the nine does, so it
  is vacuous. DEG-R-07 activates only when `actor_types` is present, which it is not.

**Verification method** (to be run at implementation time, not now): apply the schema change, then run
`bun scripts/validate-raci.ts` across all nine scopes with **no edits to any `raci.yaml`**, and
confirm every scope passes and `git status` reports zero modifications under
`templates/*/governance/`. A single modified file falsifies the zero-touch claim and blocks the
change.

---

## 4. Evidence Backporting

### 4.1 Hook point — extend `project-resync`, do not replace it

`skills/project-resync/SKILL.md` v1.3.1 Step 2 already performs selective backport review, diffing
each project's committed LOCAL-WORK against `templates/co-<x>/` using the 5-surface method, and
already carries the governing gate (Safety Rule 6: promote only template-grade reusable content;
engagement output, domain stacks, and VARIANT-INJECT content stay in the project, per ADR-0031).

Evidence backporting MUST be added as **Step 2b**, a named surface inside that existing review, and
MUST NOT be built as a parallel promotion pipeline. A new script
`scripts/evidence-backport-scan.ts` supplies the machine half, mirroring `resync-audit.ts` in shape:
read-only, per-project verdict tables, `--json` output, no mutation.

```bash
bun scripts/evidence-backport-scan.ts                      # whole fleet
bun scripts/evidence-backport-scan.ts --project Projects/co-newbiz --json
```

The script MUST NOT write into `templates/`. It emits candidates; the Step 2 human judgment promotes
them.

### 4.2 Form detection

The scanner MUST classify each project into exactly one form, and MUST report `F0` rather than guess.

| Form | Detection signals (all read-only) |
|---|---|
| **F1 prose ledger** | A `SKILL.md` under `skills/**` or `.claude/skills/**` that names the common `evidence-ledger` base or reproduces the 5-column header, plus at least one materialized ledger table in `docs/**` |
| **F2 registry-backed** | `docs/evidence/README.md` declaring a registry-backed or formal-var overlay, **or** a migration under `db/migrations/**` creating an evidence-variable table together with predicate files under `procedures/_kill-criteria/*.json` |
| **F3 schema-typed** | One or more `evidence-models/**/*.schema.json` that validate against `templates/common/schemas/evidence-model.schema.json` |
| **F0 unrecognized** | Evidence-shaped content is present (a path or filename matching evidence, ledger, or finding conventions) but no form fingerprint matches |
| **none** | No evidence-shaped content at all — reported, not flagged |

A project MAY exhibit signals for more than one form. In that case the scanner MUST report every
matching form and MUST mark the project `MIXED` for human triage, because a mixed plane usually means
a migration is half-finished and backporting either half would ship a partial contract.

`F0` MUST always route to human triage and MUST NEVER produce an auto-generated candidate.

### 4.3 Maturity bar — "mature enough to backport"

A candidate is promotable only when its form is F1, F2, or F3 **and all five tests pass**. Any
failure MUST be reported with the failing test named and MUST block auto-candidate status.

| ID | Test | Threshold | How it is checked |
|---|---|---|---|
| **M1** | Decision uptake | ≥ 3 decision records cite the plane | Count `docs/decisions/DEC-*.md` whose `evidence_refs[]` is non-empty and resolves inside the plane. **Records with empty `evidence_refs` are excluded from the denominator, not counted as failures** — `DEC-20260909-01` is empty by design, citing ADRs through `knowledge_refs` |
| **M2** | Age and survival | ≥ 90 days between the first and the most recent delta establishing or touching the plane | **Graph Delta Log query** (§4.5) with a `git log` fallback. Proves the plane survived more than a single engagement |
| **M3** | No open supersession dispute | Zero unresolved `CONTESTED` entries, and every `SUPERSEDED` entry has a successor | F1: ledger `status` column. F2: registry reversal/amendment records. F3: `migrations/` completeness |
| **M4** | Contract stability | No breaking change to the plane's own contract in the last 30 days | **Graph Delta Log query** (§4.5) with a `git log` fallback |
| **M5** | Template-grade | No engagement-specific content, no client identifiers, no country mark in any filename (DEG-E-03), and passes the ADR-0031 stays-project filter | Static scan plus the existing Step 2 judgment |
| **M6** | **Identifiable collection procedure** | A real, repeatedly-used skill or procedure produced the records — not records that satisfy a shape in retrospect | §4.4 |

M1, M2, and M6 together are the substantive bar: a plane that three real decisions leaned on, across
more than one quarter, **produced by a named repeatable procedure**, is practice. Anything less is a
draft. M3–M5 are hygiene gates that prevent shipping a broken or non-generic artifact.

### 4.4 M6 — the collection procedure must exist and must be repeatedly used

M6 is the test that a schema is not being harvested from accidental regularity. It has two parts and
**both MUST pass**.

**M6a — a collection procedure exists.** At least one `SKILL.md` or procedure schema in the project
MUST reference the evidence plane's own target from within its step body: the schema path, the
registry table, or the ledger artifact. The scanner MUST match on the reference, not on a section
heading, because heading names are not uniform — verified: co-safety's `audit-preparation/SKILL.md`
uses `## Execution Steps` while `hazop-analysis/SKILL.md` uses `## Operational Steps`, and both are
valid. Reference forms the scanner MUST recognize:

| Form | Signal | Verified example |
|---|---|---|
| F1 | A step instructs construction of the ledger with its column contract | `source-verification-ledger/SKILL.md` step 3, "Build the Ledger … claim \| source 1 \| source 2 \| receipt number \| status" |
| F2 | A step writes to the registry table or evaluates a `_kill-criteria` predicate | co-newbiz `evidence_var` + `procedures/_kill-criteria/*.json` |
| F3 | A step names a schema path and the record ID pattern it emits | `audit-preparation/SKILL.md` line 56, records conforming to `finding.schema.json` as `FIND-YYYY-NNNN`; `hazop-analysis/SKILL.md` step 8, conforming to `psm-pha-record.json` |

**M6b — the procedure is repeatedly used, not a one-off.** The scanner MUST confirm at least one of:

- ≥ 3 distinct records exist whose IDs match the pattern the procedure declares (three `FIND-YYYY-NNNN`
  files, three ledger rows across ≥ 2 documents, three registry snapshot rows); **or**
- the procedure is referenced by ≥ 2 distinct procedure steps or invoked in ≥ 2 distinct commits.

A single bulk import, a migration backfill, or one script run MUST NOT satisfy M6b. The point of the
test is that a *human-or-agent workflow* runs this repeatedly, which is the only thing that makes the
procedure worth generalizing.

When M6a passes and M6b fails, the scanner MUST report `SCHEMA-ONLY` rather than `PROMOTABLE`. That
verdict is informative — it says the shape is real but the practice is not yet — and MUST NOT be
promoted.

### 4.5 How M2, M4, and M6b are actually measured — the Graph Delta Log dependency

M2 and M4 are stability claims about time. Without a mechanism they are assertions. **The project's
own Graph Delta Log (§5) is that mechanism**, and this is a load-bearing dependency of §4 on §5, not
an optional enrichment.

The scanner reads the delta log of the **project under inspection** — not the workspace root log.
This distinction is essential and is grounded in a verified fact: `scripts/generate-skill-graph.ts`
does not scan `Projects/` at all (zero references; the live graph's layers are only `L0`, `common`,
and `variant:co-*`). Each project, however, ships its own `generate-skill-graph.ts` and
`verify-skill-graph.ts` — confirmed present in both `Projects/co-newbiz/scripts/` and
`Projects/co-safety/scripts/` — so each project generates and can log deltas over its own graph. §5.8
specifies the two-layer arrangement this requires.

| Test | Query over the project's delta log |
|---|---|
| **M2** | Find the earliest delta whose `ids` or type breakdown introduces the plane's governing nodes, and the most recent delta touching them. The span MUST be ≥ 90 days |
| **M4** | Select deltas in the last 30 days touching those nodes. Any **removal** — a removed `evidence_model` node, a removed `produces` or `evidenced_by` edge, a removed procedure step node — is a candidate breaking change and MUST fail M4. Pure additions MUST NOT fail it |
| **M6b** | Count distinct deltas that touch the collection procedure's nodes. ≥ 2 such deltas independently satisfies the "referenced in ≥ 2 distinct commits" limb of M6b |

**Which nodes count as "the plane's governing nodes".** `evidence_model` is a declared node type and
`evidenced_by` a declared edge type (verified in `generate-skill-graph.ts` lines 128–129 and 146), but
**the live workspace graph currently contains zero `evidence_model` nodes** — consistent with ADR-0083
recording the `evidenced` level as unclaimed. The scanner MUST therefore resolve governing nodes in
this order and MUST accept the first that exists:

1. `evidence_model` nodes for the plane, plus their `evidenced_by` edges;
2. otherwise, the `procedure` and `skill` nodes of the collection procedure identified by M6a — these
   always exist, since a skill that produces records is a graph node by construction.

**Fallback when no delta log exists.** A project that has not yet accumulated delta history MUST fall
back to `git log --format=%cI -- <plane paths>` for M2 and M4, and the scanner MUST mark the result
`UNVERIFIED-BY-DELTA`. The fallback is weaker — a git diff cannot distinguish a removed edge from a
reformatted file — so a `PROMOTABLE` verdict resting only on it MUST carry that mark into the Step 2b
report for human attention.

### 4.6 What gets produced, and where it lands — the pair

The backported artifact is a **pair**, and both halves MUST land in the same change:

```
templates/co-<x>/evidence-models/<record-type>.schema.json        # the shape: draft-07, validates against the meta-schema
templates/co-<x>/.claude/skills/evidence-collection-<name>/SKILL.md   # the substance: how records are actually produced
templates/co-<x>/evidence-models/README.md                        # provenance for both halves
```

**Why the pair and not the schema alone.** A schema constrains a record that already exists; it never
causes one to exist. Shipping `finding.schema.json` into a new scaffold without shipping the
audit-preparation workflow that fills it produces structure with no substance: a fresh project can
satisfy the schema with hollow, inconsistent records, because nothing tells it what a finding *is*,
when to open one, or when it closes. The co-safety pair makes this concrete — `finding.schema.json`
fixes the fields, and `audit-preparation/SKILL.md` fixes that a documentation gap becomes a
`FIND-YYYY-NNNN`, that remediation is tracked by a linked `CA-YYYY-NNNN`, and that a Critical finding
escalates immediately. None of that is expressible in the schema, and all of it is what makes the
records comparable across engagements.

The schema half MUST be **F3 regardless of source form**, because the meta-schema
`templates/common/schemas/evidence-model.schema.json` is the only machine-checkable evidence contract
the template layer has. Backporting an F1 prose ledger therefore means extracting the record shape the
ledger implies — for co-news, a record carrying `record_id`, `claim`, two source references, a receipt
number, and a status enum — not copying the prose. Backporting an F2 registry means extracting the row
contract of the evidence variable, not the migrations.

The procedure half is a **generalization, not a copy**. It MUST preserve the step sequence, the record
ID convention, and the status or closure discipline of the source skill, and it MUST drop
engagement-specific scope, client names, and project-local tool paths. Where the source skill is
F2 and depends on a database the template layer does not ship, the generalized skill MUST state the
storage form as a requirement rather than assuming the project's implementation.

`README.md` is mandatory and MUST record: the source project, the source form (F1/F2/F3), the source
skill path that satisfied M6, the commit range the maturity bar was measured over, and the M1–M6
results. Without it, a future reader cannot tell whether a model in `evidence-models/` was designed or
harvested.

### 4.7 Relationship to the existing `evidenced` machinery

**This feeds the existing path. It creates no second path.** Specifically:

- A backported model is an ordinary evidence model. DEG-E-01 (model path exists and validates against
  the meta-schema), DEG-E-02 (string-form evidence entries resolve), and DEG-E-03 (no country mark)
  apply unchanged, at their existing levels.
- Binding follows §8.3 of the Domain Operating Model design unchanged: `_output-types.yaml`
  `evidence_model` for always-backed artifact types, procedure `evidence[]` entries for
  activity-scoped collection.
- **co-safety stays the reference implementation and stays untouched.** It remains one of the six
  deferred variants resting at `core`, exactly as design §11.4 records.
- The practical consequence is that the currently-unclaimed `evidenced` level gets its **first
  adopter from a real project rather than from a design**. A variant receiving a backported model may
  then declare `deg_conformance: "evidenced"` in its `variant.json`. It MUST NOT be forced to — the
  level stays optional and domain-specific, per ADR-0083 §5.

### 4.8 Step 2b in the skill

`skills/project-resync/SKILL.md` gains, between Step 2 and Step 3:

> **Step 2b — Evidence plane review.** Run `bun scripts/evidence-backport-scan.ts`. For each project:
> record the detected form, the M1–M6 results, and the verdict. Promote only `PROMOTABLE` candidates,
> and only by authoring the **pair** — the F3 schema, its companion `evidence-collection-<name>`
> skill, and the provenance README — under `templates/co-<x>/`. A schema promoted without its
> companion procedure is an incomplete backport and MUST be rejected at review. Route `F0`, `MIXED`,
> `SCHEMA-ONLY`, and any failing maturity test to the cycle report as human-triage rows. Never
> auto-write into `templates/`.

Safety Rule 6 already covers the promotion gate and needs no amendment. The skill version bumps to
1.4.0.

---

## 5. Graph Delta Log

### 5.1 Scope — and its immediate consumer

This section designs **the recording of graph deltas and nothing else**.

**The Graph Delta Log is not speculative substrate.** It has a concrete, immediate consumer inside
this same design: `evidence-backport-scan.ts`'s maturity bar (§4.5) reads it to decide M2 (≥ 90 days
survival), M4 (no breaking contract change in 30 days), and one limb of M6b (repeated use). Those
three tests are stability claims about time, and without the delta log they are assertions with no
stated mechanism. §4 therefore **depends on** §5; the two components ship together or M2 and M4 fall
back to a weaker git-log approximation (§4.5).

That the log would *also* be raw material for the SkillHone Evolution Loop is a secondary, future
benefit, not the justification.

| In scope | Out of scope — named future work |
|---|---|
| Computing the structural diff between the committed graph and a fresh build | Synthesizing deltas into Knowledge nodes |
| Persisting that diff as a governed artifact tagged to its commit | Feeding deltas to a SkillHone loop |
| A schema fixing the delta record's shape | Any automated change to Skills based on deltas |
| Serving §4.5's maturity queries | Any judgment about whether a change was good |

The discipline mirrors the other two components: the Actor Model is derived rather than authored,
Evidence Backporting extends an existing pipeline rather than inventing one, and the Graph Delta Log
records a fact rather than acting on it. **No part of this section may be read as designing the
SkillHone Evolution Loop.** That extension stays undesigned.

### 5.2 Why this is a distinct kind of evidence

Domain Evidence (§4) is evidence about the world a template operates in — a hazard was found, a claim
was verified, a variable was measured. Graph deltas are evidence about **the operating model itself**:
that `co-hr` grew four procedures and eleven `accountable_for` edges in one change, or that
`co-consult` lost a stage. The two must not be merged into one plane. They have different subjects,
different producers (a human-or-agent workflow versus a generator), and different consumers.

This is also why the Graph Delta Log is **not** an evidence model and MUST NOT live under
`evidence-models/`: it is not domain evidence, it is not bound to an artifact type, and DEG-E-01..03
do not apply to it.

### 5.3 What must be built — there is no diff engine today

Per §1.3, `--determinism` is an equality check, not a diff. The reusable part is that `buildGraph()`
is pure and cheap to call twice. A new module MUST compute the actual diff:

```
scripts/graph-delta-log.ts        # compute + persist; importable by dev-sync.ts
```

The diff MUST be computed between the **committed** `docs/skill-graph.json` and the **freshly built**
graph, which is exactly the pair `verify-skill-graph.ts` already loads (lines 510–513). Reusing that
load path keeps one definition of "current versus committed" in the codebase.

### 5.4 Shape — counts by type, plus IDs under a threshold

A delta record MUST carry aggregate counts by node type and edge type. It MUST additionally carry
explicit IDs when the change is small enough for IDs to be informative.

```json
{
  "schema_version": "1.0",
  "generated_at": "2026-09-19T14:02:11Z",
  "commit": "846076e8",
  "pr": 975,
  "scope": "co-hr",
  "totals": { "nodes_added": 4, "nodes_removed": 0, "edges_added": 11, "edges_removed": 2 },
  "by_node_type": { "procedure": { "added": 4, "removed": 0 } },
  "by_edge_type": {
    "accountable_for": { "added": 11, "removed": 0 },
    "consulted_on": { "added": 0, "removed": 2 }
  },
  "ids": {
    "nodes_added": ["co-hr-onboarding-intake", "co-hr-offer-approval"],
    "truncated": false
  }
}
```

**The ID threshold is a real decision, so it is stated normatively.** A delta MUST include explicit
IDs when the total changed element count is ≤ 50, and MUST set `"truncated": true` and omit the ID
arrays above that. Rationale: a template-authoring change to one variant typically moves a handful of
nodes, where IDs are the whole value; a workspace-wide regeneration moves thousands, where IDs would
bloat the repository for no analytical gain that the counts do not already give. Fifty is chosen as
roughly the largest change a single human-reviewable PR produces in one scope, and it MUST be
revisited once real logs exist — §8 records this as an open question.

Deltas MUST be recorded **per scope**, not as one workspace-wide blob. Per-scope records are what make
"how did co-hr's operating model evolve" answerable without filtering.

### 5.5 Where it lives and what triggers it

**Location**: `docs/graph-deltas/<YYYY>/<YYYY-MM-DD>-<commit-short>-<scope>.json`.

A directory of small append-only files is chosen over appending to one growing log file, for one
concrete reason verified in this workspace's own history: shared pipeline files that every `/sync`
touches are the workspace's established conflict source, and the Sequential Branch Dependency Rule
exists precisely because `dev-sync.ts` mutates shared files on every commit. A single
`graph-delta-log.jsonl` would be exactly such a file and would conflict on every parallel branch.
Per-commit files never conflict.

**Trigger**: on every `/sync`, **but written only when the diff is non-empty.** Writing an empty
delta on every sync would add a file per sync with no information. Given how often procedures, RACI,
and gates are touched, non-empty deltas will be common but far from universal — a documentation-only
sync produces nothing.

The write MUST be non-blocking: a failure to compute or persist a delta MUST NOT fail `/sync`. The log
is an observation, and losing one observation is strictly less harmful than blocking delivery.
Failures MUST be reported as a WARN.

### 5.6 Schema — warranted, and why

A schema `templates/common/schemas/graph-delta.schema.json` IS warranted, despite these being
machine-written records that no human authors. Three reasons:

1. The records exist to be **consumed by a future mechanism that does not exist yet**. The only
   protection a future consumer has against silently drifting producer output is a versioned contract.
2. The same F3 discipline is asserted twice elsewhere in this design; exempting the one artifact type
   that is purely machine-produced would be arbitrary.
3. `schema_version` gives a migration handle when the ID threshold or the type breakdown changes,
   which §8 already anticipates.

The counter-argument — that a simple JSONL log is cheaper — is real but loses on point 1. A cheaper
format MUST NOT be chosen here.

This schema is **not** an evidence model and MUST NOT validate against
`evidence-model.schema.json`; it is a peer L1 schema alongside `raci.schema.json`.

### 5.7 Two layers — the root log and the project log

§4.5 reads the **project's** delta log, so the log MUST exist at two layers. This corrects an earlier
assumption in this design that the artifact is workspace-root-only.

| Layer | Path | Graph it describes | Consumer |
|---|---|---|---|
| **Root (`L0`)** | `docs/graph-deltas/` at the workspace root | `docs/skill-graph.json` — covers `L0`, `common`, and `variant:co-*` | Workspace-evolution history; future SkillHone work |
| **Project** | `docs/graph-deltas/` inside each `Projects/co-*` | that project's own generated graph | **`evidence-backport-scan.ts` §4.5** |

The two-layer arrangement is possible because each project already ships its own graph tooling:
`generate-skill-graph.ts` and `verify-skill-graph.ts` are present in `Projects/co-newbiz/scripts/` and
`Projects/co-safety/scripts/`, delivered by `upgrade-project`. The root generator does not scan
`Projects/` (verified: zero references), so a root-only log could never answer a question about a
project's evidence practice.

Consequences for delivery:

- `graph-delta-log.ts` MUST be written as an upgrade-delivered script, not an `L0`-only one, so
  projects receive it. It therefore needs a `templates/common/` presence and a SCRIPTS.md row at both
  layers.
- The **schema** `graph-delta.schema.json` stays a single workspace-layer contract, shared by both
  layers. Two layers of data, one contract.
- Each log describes only its own repository's graph. Logs MUST NOT be merged or cross-read.

### 5.8 Connection to Evidence→Knowledge synthesis

There is a live precedent in the fleet for evidence being synthesized into reusable knowledge:
`Projects/co-newbiz/docs/decisions/calibration-corpus/` holds bounded-analogy cases with membership
properties and a 5-year retirement policy, and decision records cite that body through
`knowledge_refs` rather than `evidence_refs` — the distinction being that a calibration case is
generalized learning, not a raw observation.

The Graph Delta Log occupies the same position one layer up: raw observations that some future
mechanism could generalize into knowledge about how domains evolve. **This design deliberately stops
at the observation.** The synthesis mechanism — what a Knowledge node derived from deltas would look
like, who curates it, what retirement policy it carries — is not designed here and is named as
follow-on work in §8 and §9.

### 5.9 Retention — a hard constraint any future policy MUST satisfy

Retention is not resolved here (§8, open question 10), but the §4.5 dependency now imposes a floor
that any future pruning policy MUST respect:

> **A pruning policy MUST NOT delete delta history that `evidence-backport-scan.ts` still needs.**
> Since M2 measures a ≥ 90-day span and M4 inspects a 30-day window, a project's delta log MUST
> retain **at minimum** the full history back to the earliest delta establishing any evidence plane
> that has not yet been promoted. A flat "prune older than N days" rule is therefore unsafe for
> project-layer logs at any N, because M2's span is measured from an arbitrarily old origin.

Two consequences follow. First, compaction MUST preserve the *earliest* establishing delta for each
plane even if intermediate deltas are compacted away. Second, the root-layer log and the project-layer
log may safely carry **different** retention policies, because only the project layer has this
constraint — the root log has no §4 consumer.

This is why the retention question matters more concretely than when it was first raised: it is now a
correctness constraint on a live dependency, not a housekeeping preference.

---

## 6. Backward Compatibility

| Surface | Impact |
|---|---|
| The 9 existing `templates/*/governance/raci.yaml` files | **None.** `actor_types` is optional, `schema_version` accepts both `"1.0"` and `"1.1"`, and no variant ships `_human-roles.yaml`, so every key types as `agent` and nothing is emitted |
| `validate-raci.ts` DEG-R-01..05 | Unchanged. DEG-R-04 keeps its current registry-or-agent-file semantics |
| DEG-R-06 | Vacuous for every variant today — it activates only alongside a registry file |
| `docs/skill-graph.json` consumers | Additive only. New optional edge attribute, new node kind. Existing edge types and node kinds are unchanged |
| `Projects/co-newbiz/procedures/_human-roles.yaml` | Untouched. It stays at the project path it occupies today; the template-layer path `governance/_human-roles.yaml` is the L1 location, per design §6.4 |
| co-safety `evidence-models/` | Untouched, as design §11.4 already commits |
| `resync-audit.ts` | Untouched. The new scanner is a sibling, not a modification |
| `verify-skill-graph.ts --determinism` | Untouched. The delta module reuses its committed-versus-derived load pattern but does not modify the flag |
| `docs/skill-graph.json` format | Untouched by §5. Deltas are computed *over* the graph, never stored *in* it |
| `/sync` behavior | Additive and non-blocking. A delta-write failure produces a WARN, never a FATAL |

---

## 7. Platform Impact

### Claude Code

- `project-resync` gains Step 2b. The skill remains PM-orchestrated and the PM Gateway still requires
  an execution plan table before dispatching the implementation work.
- `evidence-backport-scan.ts` is read-only and safe to run under the PreToolUse GateGuard hook with no
  special handling, because it performs no writes.
- Implementation work on `generate-raci.ts`, `validate-raci.ts`, and `generate-skill-graph.ts` touches
  three registered scripts, so each requires an in-file `@version` bump **and** a matching SCRIPTS.md
  row update before `/sync`, or `dev-sync.ts` FATAL-blocks.
- `evidence-backport-scan.ts` and `graph-delta-log.ts` are new scripts and MUST both be added to
  SCRIPTS.md in the same change.
- `dev-sync.ts` gains the delta-log call and is itself a registered script, so it needs the same
  `@version` plus SCRIPTS.md row treatment.
- The companion `evidence-collection-<name>` skills are ordinary variant skills and go through the
  standard skill-lifecycle validation; they are authored by humans at review time, never generated.

### Antigravity

- No hooks fire. The agent self-enforces the Pre-Edit Quality Gate before first edits to the schema
  and the three generator/validator scripts.
- Both new scripts run identically under `bun`, with no platform-specific behavior.

### templates/common

- `schemas/raci.schema.json` gains the optional `actor_types` property and the widened
  `schema_version` enum. This is an L1 schema change and propagates to every variant on the next
  `upgrade-project` pass.
- `schemas/graph-delta.schema.json` is a **new L1 schema** (§5.6), a peer of `raci.schema.json`. It is
  a workspace-layer contract; variants neither author nor override it.
- `graph-delta-log.ts` is **upgrade-delivered, not `L0`-only** (§5.7): projects need it to produce the
  logs `evidence-backport-scan.ts` reads. It requires a `templates/common/` presence and SCRIPTS.md
  rows at both layers.
- `docs/graph-deltas/` exists at two layers — the workspace root and inside each project. The
  directories are peers describing different graphs, never merged.
- `schemas/evidence-model.schema.json` is **unchanged**. Backported artifacts validate against it as
  it stands.
- `.claude/skills/evidence-ledger/SKILL.md` is **unchanged**. Its overlay-diversity contract is what
  this design relies on, so weakening it would be self-defeating.
- L2/L3 propagation follows the standard path; no variant is required to act on either extension.

---

## 8. Open Questions

1. **What happens to co-newbiz's registry if co-newbiz is promoted to a variant template?** The
   template-layer path is now **resolved** to `governance/_human-roles.yaml` (§3.6), because
   `validate-raci.ts:75` already reads it. The open residue is narrower: promotion would require
   relocating `Projects/co-newbiz/procedures/_human-roles.yaml`, which breaks the two project-local
   consumers that read it statically (`scripts/co-newbiz/graph-map.ts`, `procedures/_validate.ts`).
   Is dual-path support during promotion acceptable, or should those consumers be migrated first?
2. **Does DEG-R-06's gate anchor hold for non-gate human involvement?** DEG-R-06 assumes every human
   accountability corresponds to a decision gate. A human who is accountable for a *deliverable*
   rather than a *decision* — a named legal signatory on an export filing, for instance — would fail
   the rule with no modeling defect present. Is that shape real in any planned domain, and if so,
   should DEG-R-06 accept a second anchor?
3. **Is M1's threshold of 3 decision records right for low-volume domains?** A domain producing two
   decisions a year would need eighteen months to clear the bar. Accept the slowness as the price of
   evidence, or add a domain-declared threshold override in `variant.json`?
4. **Who owns a backported evidence model after promotion?** The source project keeps evolving its
   plane. Does the template copy diverge freely, or does a later resync cycle re-measure and refresh
   it, and if so, what happens when the project's contract has broken compatibility?
5. **Should `MIXED` ever be promotable?** A project mid-migration from F1 to F3 arguably has its most
   mature artifact in the target form. The current design blocks it outright. Is a narrow exception
   worth the complexity?
6. **Does the `human_role` graph node kind need its own verification rule in
   `verify-skill-graph.ts`,** or is DEG-R-04 at the RACI layer sufficient coverage?
7. **Is a second adopter for the Actor Model actually expected?** §3.5 recommends waiting for one
   before mandating. If the owner's roadmap has no second human-gated domain in view, the honest
   alternative is to keep the extension permanently optional and say so in ADR-0083. This question is
   left open deliberately and MUST NOT be resolved without the owner.
8. **Can the companion procedure always be generalized?** §4.5 requires the pair, but an F2 source
   skill may be inseparable from a database the template layer does not ship. Is a "storage-form
   requirement" skill genuinely useful to a new scaffold, or does an F2 source effectively mean the
   evidence practice is not backportable at all until the project's storage is itself templated?
9. **Does M6b's threshold of 3 records double-count M1?** M1 counts decisions citing the plane and M6b
   counts records produced by the procedure. In a domain where every record is cited by a decision,
   the two tests collapse into one. Should M6b require records *not* already counted by M1?
10. **Is the Graph Delta Log's ID threshold of 50 right, and does §4.5 make IDs mandatory?** §5.4
    picks 50 as roughly the largest change one human-reviewable PR makes in one scope, with no data
    behind it. The §4.5 dependency sharpens the question: M2 and M4 need to know *which* nodes a
    delta touched, so a `truncated: true` delta is partly opaque to the scanner. Should the ID
    threshold be raised, or should IDs for evidence-plane nodes be exempt from truncation?
11. **What retention policy do graph deltas carry?** §5.9 fixes the floor any policy MUST satisfy —
    never delete history the scanner still needs, preserve each plane's earliest establishing delta,
    and allow the root and project layers to differ. Within that floor, is unbounded retention
    acceptable, or should compaction be specified now? co-newbiz's calibration corpus and its 5-year
    retirement is the nearest precedent.

**Resolved since the first draft:** the former question 12 ("who consumes graph deltas first — is this
speculative generality?") is **closed**. The consumer is `evidence-backport-scan.ts`'s maturity bar,
wired as a load-bearing dependency in §4.5 and §5.1. The former question 1 is **narrowed**: the
template-layer registry path is resolved in §3.6; only the co-newbiz promotion case remains open.

---

## 9. References

- `docs/designs/2026-09-19-template-domain-operating-system-design.md` — §1.5 Terminology, §6.4 human
  decision authority, §8 Evidence Model, §11.4 conformance levels
- `docs/adr/0083-domain-execution-graph-and-stage-axis.md` — Future Extensions, conformance levels
- `docs/adr/0043-l1-agent-layer-hybrid-override.md` — §4 promotion gate criteria
- `templates/common/schemas/raci.schema.json`, `templates/common/schemas/evidence-model.schema.json`
- `templates/common/.claude/skills/evidence-ledger/SKILL.md` — base contract and overlay forms
- `templates/co-news/skills/source-verification-ledger/SKILL.md` — F1 reference
- `Projects/co-newbiz/docs/evidence/README.md`, `Projects/co-newbiz/procedures/_human-roles.yaml` — F2
  and Actor Model references
- `templates/co-safety/evidence-models/` — F3 reference
- `templates/co-safety/.claude/skills/audit-preparation/SKILL.md` (lines 56–57) and
  `templates/co-safety/.claude/skills/hazop-analysis/SKILL.md` (steps 6–8) — the companion-procedure
  half of the (schema, procedure) pair; the proof that a schema alone is inert
- `scripts/verify-skill-graph.ts` (lines 505–530) — the `--determinism` equality check and the
  committed-versus-derived load pattern the delta module reuses
- `Projects/co-newbiz/docs/decisions/calibration-corpus/` — live precedent for evidence synthesized
  into knowledge and cited through `knowledge_refs`; the analogue one layer up that §5.7 stops short of

- `skills/project-resync/SKILL.md`, `scripts/resync-audit.ts` — the pipeline being extended
- `scripts/generate-raci.ts`, `scripts/validate-raci.ts`, `scripts/generate-skill-graph.ts`
- `scripts/validate-raci.ts:75` — the line that settles the registry path (§3.6)
- `Projects/co-newbiz/scripts/`, `Projects/co-safety/scripts/` — per-project graph tooling, the basis
  for the two-layer delta log (§5.7)

### Named follow-on work, not designed here

- **SkillHone Evolution Loop** (design §1.5.3) — a *secondary, future* consumer of the Graph Delta
  Log. The primary consumer is `evidence-backport-scan.ts` (§4.5), which is designed here.
- **Delta→Knowledge synthesis** — what a Knowledge node derived from graph deltas contains, who
  curates it, and what retirement policy it carries.
- **Graph delta retention and compaction** — deferred, but now constrained by §5.9.
- **Mandating the Actor Model at `governed`** — blocked on a second adopter (§3.5, open question 7).
