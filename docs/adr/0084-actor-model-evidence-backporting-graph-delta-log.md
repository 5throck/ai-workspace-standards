---
status: Accepted
date: 2026-09-19
author: Architect
---

# ADR-0084: Actor Model, Evidence Backporting, and Graph Delta Log

**Deciders**: architect, workspace owner
**Supersedes**: —
**Related**: ADR-0083 (Domain Execution Graph and Stage Axis), ADR-0043 (L1 agent layer and promotion threshold), ADR-0031 (project-versus-template boundary), ADR-0061 (evidence chain and overlay contract), ADR-0079 (instruction writing standard)
**Design of record**: `docs/designs/2026-09-19-actor-model-and-evidence-backport-design.md`

---

## Context

ADR-0083 closed the Domain Operating Model Core at four groups — Process, Governance, Execution,
Graph — and named three Future Extensions as explicitly undesigned: an **Actor Model** formalizing
`actor_type: human|agent`, a richer **Evidence Model** beyond the specified-but-unclaimed DEG-E-01..03,
and a **SkillHone Evolution Loop**.

Three facts make those extensions actionable now, and all three were verified against the repository
on 2026-09-19:

1. **The Actor Model is half built already.** The Domain Operating Model design §6.4 adopted
   `_human-roles.yaml` at L1, and `scripts/validate-raci.ts` implements DEG-R-04 against it today
   (`loadHumanRoles()` lines 73–90; resolution check lines 216–228). No template ships the file, and
   `raci.schema.json` carries no actor field. Actor type is therefore derivable but never recorded.
2. **Evidence practice accumulates in projects with no route back to templates.** Three legitimate,
   mutually incompatible forms run in the fleet — co-news's prose ledger overlay, co-newbiz's
   registry-backed evidence-variable plane, and co-safety's draft-07 evidence models. The common
   `evidence-ledger` skill explicitly authorizes this diversity, so unification is forbidden by
   existing contract. `project-resync` Step 2 performs selective backport review but evidence is not
   one of its named surfaces.
3. **Graph change history is unqueryable.** `docs/skill-graph.json` is regenerated every `/sync`, and
   its structural diff is a machine-observable record of how the operating model itself evolved.
   `verify-skill-graph.ts --determinism` computes no diff — it compares two builds for exact equality
   and prints only counts on failure (lines 519–530) — and nothing is persisted.

A separate ADR is warranted rather than an amendment to ADR-0083, because this adds two new normative
invariants, widens ADR-0083's `evidenced` contract with a project→template promotion route, and binds
both the workspace schema layer and the `project-resync` pipeline.

---

## Decision

### 1. Actor type is derived, materialized, and optional

Actor type MUST be resolved by the generator, never hand-authored: registry membership in
`governance/_human-roles.yaml` types a key as `human`; resolution to an agent file types it as
`agent`; resolving to neither remains DEG-R-04 FATAL, unchanged. The registry MUST take precedence
over a same-named agent file.

The resolved type is materialized into the committed RACI matrix as an optional per-row
`actor_types` map (flat key→enum, so it cannot desynchronize on array append and the row's
`additionalProperties: false` survives), and into the skill graph as an `actor_type` edge attribute
plus a distinct `human_role` node kind.

`raci.schema.json` `schema_version` widens from `const: "1.0"` to the enum `["1.0", "1.1"]`.

### 2. Two new invariants

| ID | Rule | Level |
|---|---|---|
| DEG-R-06 | An activity whose `accountable` key types as `human` MUST have a matching gate in `decisions/gates.yaml` whose `decider_agent` is that key. | FATAL at `governed`, only for variants shipping `_human-roles.yaml` |
| DEG-R-07 | When `actor_types` is present, its key set MUST equal the union of the row's R/A/C/I keys. | FATAL whenever present |

DEG-R-06 carries co-newbiz's proven error-level consistency rule into the template layer. DEG-R-05
already covers `actor_types` drift with no change, because the map is generated.

### 3. Promote the Actor Model now, opt-in; do not mandate it

ADR-0043's threshold — Jaccard ≥ 80% across 3 or more variants — governs **agent Markdown body
content**, not workspace-layer schema fields, and the Domain Operating Model design §11.1 assigns
schemas and contracts to the Workspace layer by construction. The registry half is already promoted.
With no registry file present, nothing changes for any of the nine variants holding
`governance/raci.yaml`.

Mandating is the step that would be promoting on an N of 1. `actor_types` MUST NOT become required,
and `_human-roles.yaml` MUST NOT become mandatory at any conformance level, until a second variant
adopts the registry. Whether a second adopter is expected at all is left open for the owner.

**Opt-in adoption does not mean an incomplete mechanism.** The design of record specifies a five-step
adoption runbook (§3.7) that a variant can execute mechanically with no further design work, and the
template-layer registry path is **resolved** to `templates/<variant>/governance/_human-roles.yaml`
(§3.6) — settled by the fact that `validate-raci.ts:75` already reads exactly that path, so choosing
otherwise would mean changing working code to match a project-layer convention.
`Projects/co-newbiz/procedures/_human-roles.yaml` stays where it is; the two layers do not collide.

Migration for the nine existing `governance/raci.yaml` files MUST be zero-touch, guaranteed by three
independently checkable properties: widening an enum that already contains the only value in use
cannot reject a previously passing file; `actor_types` is optional; and DEG-R-06/07 are vacuous absent
a registry file. The verification is to apply the schema change, run `validate-raci.ts` across all
nine scopes with no edits, and confirm `git status` reports zero modifications under
`templates/*/governance/`. A single modified file falsifies the claim and blocks the change.

### 4. The evidence backport unit is a (schema, procedure) pair

A schema constrains a record that already exists; it never causes one to exist. Every promotion
therefore MUST land both halves in the same change:

- `templates/co-<x>/evidence-models/<record-type>.schema.json` — draft-07, validating against the
  existing `templates/common/schemas/evidence-model.schema.json`, in F3 form regardless of source form
- `templates/co-<x>/.claude/skills/evidence-collection-<name>/SKILL.md` — generalized from the project
  skill that actually produced the mature records
- `templates/co-<x>/evidence-models/README.md` — provenance for both halves

A schema promoted without its companion procedure is an incomplete backport and MUST be rejected at
review. The co-safety pair is the proof: `finding.schema.json` fixes the fields, while
`audit-preparation/SKILL.md` fixes that a documentation gap becomes a `FIND-YYYY-NNNN`, that
remediation is tracked through a linked `CA-YYYY-NNNN`, and that a Critical finding escalates
immediately — none of which the schema can express.

### 5. A six-test maturity bar, with a procedure test

Promotion requires a recognized form (F1/F2/F3) and all of M1–M6: ≥ 3 decision records citing the
plane (records with empty `evidence_refs` excluded from the denominator, not counted as failures);
≥ 90 days span; no open supersession dispute; no breaking contract change in 30 days; template-grade
with no country mark; and **M6 — a real, identifiable, repeatedly-used collection procedure exists**.

M6 matches on a step referencing the evidence target, not on a section heading, because heading names
are not uniform (`## Execution Steps` in co-safety's audit-preparation, `## Operational Steps` in its
hazop-analysis). A single bulk import or one script run MUST NOT satisfy M6. Form passing with
practice failing reports `SCHEMA-ONLY`, which MUST NOT be promoted.

### 6. Backporting extends `project-resync` and feeds the existing `evidenced` path

A new Step 2b and a read-only sibling script `scripts/evidence-backport-scan.ts` supply detection and
measurement; the existing Step 2 human judgment promotes. The scanner MUST NOT write into
`templates/`. DEG-E-01..03 apply unchanged, co-safety remains the reference implementation and is
untouched, and **no second Evidenced-level path is created**. The practical consequence is that the
currently-unclaimed `evidenced` level gains its first adopter from a real project rather than from a
design.

### 7. A Graph Delta Log is persisted, and it has an immediate consumer

Per-scope structural diffs between the committed and freshly built graph are persisted to
`docs/graph-deltas/<YYYY>/<YYYY-MM-DD>-<commit-short>-<scope>.json`, governed by a new L1 schema
`templates/common/schemas/graph-delta.schema.json`. Records carry counts by node and edge type, plus
explicit IDs when the change is ≤ 50 elements. Writes happen on every `/sync` but only when the diff
is non-empty, and MUST be non-blocking — a delta-write failure is a WARN, never a FATAL.

**The log is not speculative substrate.** Its immediate consumer is decision 5's maturity bar:
`evidence-backport-scan.ts` reads the project's delta log to measure M2 (≥ 90-day survival), M4 (no
breaking contract change in 30 days), and one limb of M6b. Those tests are claims about time and have
no mechanism without it. Decision 6 therefore **depends on** this decision.

Because the maturity bar inspects a *project*, the log MUST exist at two layers. The root generator
does not scan `Projects/` (verified: zero references; live graph layers are only `L0`, `common`, and
`variant:co-*`), while each project ships its own `generate-skill-graph.ts` — so `graph-delta-log.ts`
MUST be upgrade-delivered rather than `L0`-only, and each layer keeps its own log over its own graph.
The schema is shared; the logs are never merged.

Any future retention policy MUST NOT delete history the scanner still needs: each plane's earliest
establishing delta MUST survive compaction, and a flat age-based prune is unsafe at the project layer
because M2's span originates arbitrarily far back.

**This ADR does not design the SkillHone Evolution Loop.** Recording deltas is in scope; synthesizing
them into Knowledge and feeding a loop are explicitly out of scope and named as follow-on work.

---

## Alternatives Considered

### Alt A: Store actor type as parallel arrays alongside each role slot

**Rejected.** Parallel arrays couple to slot ordering and desynchronize silently when a role array is
appended to. A map keyed by the agent key cannot.

### Alt B: Wait for a third variant before touching the RACI schema at all

**Rejected.** This applies ADR-0043's agent-content threshold to a workspace-layer schema field, a
category it was not written for, and it ignores that the registry half already landed via design §6.4
and DEG-R-04. The opt-in shape makes the adoption cost zero, so waiting buys nothing. The part of
ADR-0043's caution that *does* apply — do not force a pattern on domains that may never need it — is
preserved by refusing to mandate.

### Alt C: Unify the three evidence forms into one canonical format

**Rejected, and forbidden by existing contract.** `templates/common/.claude/skills/evidence-ledger/SKILL.md`
defines only the 5-column base plus Append-versus-Supersede, and explicitly blesses registry-backed
overlays as a legitimate alternative form. The three forms serve genuinely different domains.

### Alt D: Backport the schema alone and let each scaffold invent its own collection procedure

**Rejected.** This produces structure with no substance: a new project can satisfy the schema with
hollow, inconsistent records because nothing defines what a record *is*, when it opens, or when it
closes. The comparability that makes evidence useful across engagements lives in the procedure.

### Alt E: Append graph deltas to a single growing log file

**Rejected.** A shared file that every `/sync` mutates is this workspace's established conflict
source — the Sequential Branch Dependency Rule exists because `dev-sync.ts` already touches such
files. Per-commit files never conflict.

### Alt F: Skip the graph-delta schema; a plain JSONL log is cheaper

**Rejected.** The records exist to be consumed by a mechanism that does not exist yet, and a versioned
contract is the only protection a future consumer has against silently drifting producer output.

---

## Consequences

### Positive

- The human-versus-agent distinction becomes visible in the artifact humans read and queryable in the
  graph tooling reads, instead of being recoverable only by a validation-time registry join.
- "Which activities in this domain are human-gated" becomes a single graph traversal.
- Real, proven evidence practice gains a route from projects into templates, with a checkable bar
  rather than case-by-case judgment.
- The `evidenced` conformance level gets a realistic path to its first adopter.
- Graph evolution becomes a structured, queryable record instead of a diff over a large generated JSON
  file.

### Negative / Risks

- **Three new invariants and two new scripts enlarge the validation surface.** DEG-R-06 in particular
  encodes an assumption (§8 open question 2) that every human accountability corresponds to a decision
  gate; a human accountable for a deliverable rather than a decision would fail it with no defect
  present.
- **The Actor Model may never gain a second adopter**, in which case the opt-in field is permanent
  dead weight in the schema. This is accepted deliberately and flagged for the owner.
- **The (schema, procedure) pair raises the backport bar**, and an F2 source skill inseparable from a
  database the template layer does not ship may prove impossible to generalize. Some evidence practice
  may simply not be backportable until project storage is itself templated.
- **Decisions 5–6 now depend on decision 7.** Wiring M2/M4/M6b to the delta log removes hand-waving
  but couples the evidence-backport pipeline to an artifact that does not exist yet. Until projects
  accumulate delta history, the scanner falls back to `git log` and marks results
  `UNVERIFIED-BY-DELTA` — a weaker signal, because a git diff cannot distinguish a removed edge from
  a reformatted file.
- **`evidence_model` nodes are currently absent from the live graph** (verified: zero present, though
  the node and edge types are declared), so the delta queries resolve through the collection
  procedure's `procedure` and `skill` nodes instead. This fallback is specified, but it means the
  queries measure the *procedure's* stability as a proxy for the plane's.
- **Delta retention is now a correctness constraint, not housekeeping.** A pruning policy that
  deletes a plane's earliest establishing delta would silently break M2. The policy itself is still
  deferred.
- **Two-layer delivery enlarges the surface**: `graph-delta-log.ts` must exist at the workspace root
  and in every upgraded project, with SCRIPTS.md rows at both layers.

### Neutral

- Zero impact on the nine existing `governance/raci.yaml` files, on co-safety's evidence models, on
  `docs/skill-graph.json`'s format, and on `resync-audit.ts`.

---

## Compliance

- Implementation work MUST bump the in-file `@version` and the SCRIPTS.md row for every modified
  script (`generate-raci.ts`, `validate-raci.ts`, `generate-skill-graph.ts`, `dev-sync.ts`) and MUST
  register both new scripts (`evidence-backport-scan.ts`, `graph-delta-log.ts`).
- `graph-delta.schema.json` is a single workspace-layer contract shared by both log layers.
  `graph-delta-log.ts` MUST be upgrade-delivered so projects can produce the logs the maturity bar
  reads. `docs/graph-deltas/` exists at the workspace root and inside each project; the two describe
  different graphs and MUST NOT be merged or cross-read.
- All normative sentences in the design of record follow ADR-0079.
