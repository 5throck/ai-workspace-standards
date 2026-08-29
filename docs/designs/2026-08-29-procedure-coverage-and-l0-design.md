# Procedure Coverage & L0 Graph Integration — Design Document

- **Spec ID**: 2026-08-29-procedure-coverage-and-l0
- **Date**: 2026-08-29
- **Status**: Approved
- **Owner**: architect
- **Decision record**: ADR-0063 (`docs/adr/0063-procedure-schema-canonical-workflow-source.md`)
- **Predecessor**: `2026-08-29-procedure-schema-design.md` (Procedure Schema v1.0 — merged via PR #758)

---

## 1. Positioning

Procedure Schema v1.0 made procedures machine-validatable and graph-derivable
across the 13 variant templates. This increment does two things:

- **(A) Apply the feature to the workspace root (L0) itself.** The most
  repeated work in this workspace is variant lifecycle work (create, promote,
  project-to-variant conversion, upgrade, de-commonization) — yet L0 has no
  procedures. L0 lifecycle becomes a first-class, graph-native procedure set.
- **(B) Promote procedures to first-class workflow objects in variants.**
  Procedures are designed from each variant's actual business workflow
  boundaries (not per-agent decomposition) and verified by an automated
  coverage engine. A procedure is a **workflow specification** from which
  graph realizations are derived — not a validation checklist artifact.

## 2. Normative Rules

1. **Coverage unit**: Coverage is per `(agent_key, phase)` pair and is
   satisfied only by an actual procedure **step** (procedure existence alone
   does not count).
   - `RequiredCoverage(variant) = {(agent_key, phase) | agent frontmatter phases contains phase}`
   - `CoveredByProcedure(variant) = {(step.agent_key, step.phase) | procedure belongs to variant}`
   - `Gap = RequiredCoverage − CoveredByProcedure`. Multiple coverage of the
     same pair across procedures is legitimate duplicate coverage; ≥1 step
     suffices.
2. **Gaps are human judgment targets.** The engine discovers gaps but NEVER
   auto-generates procedures. Each gap is classified by a human as
   `PROCEDURE_REQUIRED` or `N/A_JUSTIFIED` (recorded via governance ticket).
   This rule appears in both this document and the ticket schema.
3. **`--tickets` is idempotent.** Ticket identity is a deterministic
   `coverage_key: <variant>:<agent_key>:<phase>` (source:
   `procedure-coverage`). If a ticket with the same coverage_key exists, skip.
   Title-duplicate checking is only a fallback minimum.
4. **L0 Lifecycle Coverage is conceptually separate from Variant Coverage**
   (L0 agents carry no `phases` frontmatter). One script
   (`procedure-coverage.ts`) checks both: Variant Coverage as the agent×phase
   matrix; L0 Lifecycle Coverage as "the five lifecycle procedures exist and
   their typed relation chain is complete."
5. **Procedures are workflow-shaped, not agent-shaped.** Decomposing
   procedures per agent×phase (`researcher-phase1`) is forbidden. One
   procedure connects multiple agents/phases across a natural workflow
   boundary (e.g. discovery → analysis → recommendation). Creating
   procedures just to close coverage numbers is forbidden.
6. **Canonical Source Invariant (inherited)**: procedure YAML is the
   canonical source; procedure-derived graph nodes/edges MUST NOT be manually
   maintained.

## 3. (A) L0 Root Skill-Graph Integration

### 3.1 Root procedures

New `procedures/` at the workspace root with five lifecycle procedures
(`_output-types.yaml` + one `schema.yaml` each):

| procedure_id | Maps to script/skill | Chain |
|---|---|---|
| `l0-create-variant` | `create-l3-scaffold.ts` / create-variant skill | —enables→ `l0-promote-variant` |
| `l0-promote-variant` | `l3-to-variant-pipeline.ts` / promote-variant skill | —follows→ from create |
| `l0-project-to-variant` | `project-to-variant.ts` / project-to-variant skill | —composes_with→ `l0-create-variant` |
| `l0-upgrade-project` | `upgrade-project.ts` / upgrade-project skill | —follows→ `l0-promote-variant` |
| `l0-de-commonization-review` | context-commonization-review skill | —follows→ `l0-promote-variant` |

Each step references existing root agents (architect, scaffolding-expert,
automation-engineer, lifecycle-manager, pm, auditor) and existing root skills.
This makes the "repeat = script, judgment = guideline + ticket" division
explicit: the procedure describes the flow; the referenced script executes it.

### 3.2 Naming rules

- Root procedures use pseudo-variant `root` and `procedure_id` prefix `l0-`
  (validator rule: `^(l0|co-[a-z0-9]+)-[a-z0-9-]+$`).
- Agent/skill fallback for `root` resolves to the root `agents/` and
  `skills/` directories.

### 3.3 Graph integration

`buildGraph()` additionally scans root `procedures/*/schema.yaml` and emits
the same node/edge derivation as variant procedures (INV-4 produces rule).
Scope graphs (`buildScopeGraph`) gain the same capability for their own
`templates/<scope>/procedures/`, extracted into a shared helper so both use
identical logic.

### 3.4 L0 Lifecycle Coverage check

`procedure-coverage.ts` asserts: all five lifecycle procedures exist with
`status: active` (or a registered N/A ticket), and every `enables`/`follows`
relation target among them resolves. Missing ones are reported as L0 gaps
(human judgment; tickets allowed with `coverage_key: l0:<procedure_id>`).

## 4. (B) Variant Coverage Engine

### 4.1 Algorithm

```
for each variant:
  required  := {(a.name, p) | a in agents/*.md frontmatter.phases, p in a.phases}
  covered   := {(s.agent_key, procedure.phase) | s in procedures/*/steps}
               # step coverage attributes the PROCEDURE's phase, not a per-step phase
  gap       := required − covered
```

The procedure's top-level `phase` field attributes all its steps. (Per-step
phases are deliberately not introduced in v1; a procedure crossing phases is
registered under its dominant phase and the remaining pairs remain explicit,
honest gaps — consistent with Normative Rule 2 rather than silently
auto-covered.)

Agents exempt from the matrix: `pm` (orchestrator, present in every variant by
construction) — its pairs are reported but never gated.

### 4.2 Report & tickets

`bun scripts/procedure-coverage.ts [--variant <name>] [--tickets] [--all]`

- Prints per-variant matrix: `Agent | Phase | Covering procedure(s) | Covered`.
- Prints L0 Lifecycle Coverage section.
- `--tickets`: for each uncovered pair, create a governance ticket
  (`kind: manual`) via `scripts/helpers/ticket-store.ts` with:
  - `source: procedure-coverage`
  - `coverage_key: <variant>:<agent_key>:<phase>` (or `l0:<procedure_id>`)
  - body: the pair, covering-candidate procedures, and the two allowed
    resolutions (`PROCEDURE_REQUIRED` → author a workflow-shaped procedure;
    `N/A_JUSTIFIED` → record rationale).
  - Idempotent by coverage_key.

### 4.3 Variant workflow analysis (design method, not a script)

For each variant, procedures are designed by reading its phase-definitions,
context, agents, and skills to answer: "If this variant took on a job, in
what order would it do what?" The resulting workflow skeleton (e.g. discovery
→ analysis → recommendation; intake → technical/commercial assessment →
decision) is mapped to agents/phases, then cut into 1–4 procedures at natural
workflow boundaries. Only gaps that genuinely represent unfinished workflow
design become `PROCEDURE_REQUIRED`; gaps inherent to the variant's identity
(e.g. a monitoring-only agent whose work is continuous) become
`N/A_JUSTIFIED`.

## 5. Documentation & Governance Reflection

Both the already-merged v1.0 and this increment are reflected in governance
docs:

- New `docs/constitution/06.7-procedure-lifecycle.md`: procedure SSOT
  locations, the six normative rules (§2 + Canonical Source), validator/sync
  gate role, coverage principle ("repetition → scripts; judgment → guidelines
  + tickets"), L0/variant coverage split, and the shipped v1.0 state.
- `CONSTITUTION.md`: delegated §6.7 header (following the 6.5 style) +
  Terminology entries for procedure/procedure_id.
- `templates/common/docs/context.md`: `### Procedure Graph` under Lifecycle
  Management (structure, validator usage, coverage/ticket flow).
- `templates/common/docs/variant.context.template.md`: optional
  `## Procedures` section for variants.
- `docs/constitution/06-skill-lifecycle.md`: one-line cross-reference that
  the skill graph also derives procedure/output_type nodes from procedures.
- Skills `create-variant` and `ticket-run`: reference the procedure/coverage
  layer.

## 6. Workflow Recommendations (recorded, not implemented here)

From August 2026 memory-log analysis: (1) the 30-session backlog execution
series bypassed `variant-feature.ts` — future backlog work should route
through the ticket queue (`ticket-run`) with `variant-feature.ts` as the
executor; (2) the governance ticket backlog is nearly unused — the
`--tickets` coverage flow gives it a systematic intake; (3) the recurring
"audit → manual decision → scripted remediation" pattern (e.g. skill
de-commonization) is exactly the `N/A_JUSTIFIED` judgment flow — decisions
should land in tickets so rationale survives sessions. Restructuring
implementation is deferred to a follow-up.

## 7. Delivery

Single PR. Sequential: design → validator/graph integration → coverage
engine → L0 procedures → variant workflow analysis & authoring → governance
docs → skill docs → `/sync` (lifecycle + audit + graph regeneration +
verification + CI).

---

## Addendum (2026-08-29, post-merge review)

Phase-declaration review across all 13 variants corrected three
under-declarations to match actual workflow participation (`co-develop
code-writer` [4]→[3,4], `co-game game-developer` [4]→[3,4], `co-abap
test-runner` [4]→[3,4] — the extra pairs were already step-covered) and
closed three coverable gaps with workflow-natural steps (co-design
`visual-implementation` design-lead review, co-hr `hr-solution-design`
labor-relations impact review, co-game `game-concept-design` prototyping
environment). Resolved tickets T-20260829-009/014/015 moved to done. The
remaining 17 uncovered pairs are continuous/cross-cutting roles
(security-monitor 0/5, stack-setup@0, version 0–6, co-security phase-6
retest) legitimately held as `N/A_JUSTIFIED` tickets. Agent `phases:`
frontmatter is hereby normative as the machine-readable coverage requirement
source (ADR-0063 §Governance); declarations must be reviewed whenever
procedures change.
