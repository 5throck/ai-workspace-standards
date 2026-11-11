---
status: Proposed
date: 2026-11-11
author: architect
amends: ADR-0083
---

# ADR-0104: Variant Stage-Bound Phase Axis — an Opt-In That Makes a Variant's Phases Its Pipeline Stages

## Context

ADR-0083 §1 added the procedure `stage:` axis next to the existing `phase:` axis. It froze `phase`
semantics and set a non-conflation rule: no validator may derive one field from the other or require
a fixed mapping between them. ADR-0083 §4 added DEG-P-01, which FAILs a variant whose stage→phase
mapping is bijective.

ADR-0096 §3 made phase numbering variant-specific. The variant's `docs/phase-definitions.md` and each
agent's `phases` frontmatter form the authoritative phase list.

co-deck runs an 11-stage lecture workflow (stages 1–11 plus the 1.5 and 3.5 checkpoints). Its
template compressed that workflow into delivery phases 0–6 for agent `phases`, `skill_manifest`, and
procedure `phase:`. On 2026-11-11 the co-deck project rewrote four agents' `phases` to stage numbers
(review finding H-3). The template rejected the change, and every `upgrade-project` dry-run on
`Projects/co-deck` now reports agents/ CONFLICT rows.

The design `docs/designs/2026-11-11-co-deck-phase-doctrine-design.md` offered three options. The user
selected Option A: co-deck agent `phases` use the stage numbers. The user's reason: there is no
reason to compress co-deck's workflow into 0–6.

Option A conflicts with ADR-0083 as written. If a variant's phases are its stages, then a procedure's
`phase` equals its `stage` by definition. That is exactly the derivation ADR-0083 forbids. Three
validators also hard-code the 0–6 range or the distinctness rule:

- `scripts/procedure-coverage.ts` keeps only integers 0–6.
- `scripts/validate-procedures.ts` L2 requires an integer 0–6.
- `scripts/validate-process.ts` and `scripts/bootstrap-stages.ts` run DEG-P-01.

## Decision

1. **Add an opt-in field.** A variant may declare `process_manifest.phase_axis: "stage"` in
   `variant.json`. The default, when the field is absent, is `"delivery"`. Default-axis variants keep
   every current rule unchanged.

2. **The vocabulary is the stages file.** In an opted-in variant, the phase vocabulary is the set of
   `order` values in its committed `process/stages.yaml`. Non-numeric H-stage tokens (for example
   `H-5`) stay legal in agent `phases`, as today. Stage 0 intake and post-pipeline close-out carry no
   number; ADR-0096 §3 states those PM duties by role.

3. **Stage-bound contract (DEG-P-02).** For an opted-in variant, `validate-process.ts` enforces the
   following, all FATAL:
   - `process_manifest.stages_file` is non-null and the file exists.
   - Each procedure's `phase:` equals the numeric `order` of its `stage:`.
   - Each numeric agent `phases` value is in the vocabulary.
   - Each `skill_manifest[].phases` value is in the vocabulary.

4. **Range and coverage follow the vocabulary.** `validate-procedures.ts` L2 accepts a vocabulary
   member for opted-in variants and an integer 0–6 otherwise. `procedure-coverage.ts` builds
   `(agent_key, phase)` pairs from the vocabulary. The coverage semantics of CONSTITUTION §6.7
   invariant 5 do not change. The `coverage_key` format stays `<variant>:<agent_key>:<phase>` and may
   carry a fractional phase (for example `co-deck:source-verifier:1.5`).

5. **DEG-P-01 does not apply to opted-in variants.** `validate-process.ts` and `bootstrap-stages.ts`
   report `N/A (phase_axis: stage)` for them. The two axes are identical by declaration, so a
   distinctness test carries no information.

6. **Opt-in is controlled.** A variant may opt in only with a committed stages file and a
   `docs/decisions/DEC-*.md` record that states why its workflow stages are its phases. co-deck is
   the first adopter, authorized by this ADR and the user's 2026-11-11 ruling. Opting out later also
   needs a DEC record.

7. **Procedures keep both fields.** An opted-in procedure still declares `phase:` and `stage:`. This
   keeps the procedure schema, its L2 required-field list, and the skill-graph projection unchanged
   for every namespace.

### Rejected alternatives

| Alternative | Reason for rejection |
|---|---|
| Keep delivery phases and relabel the co-deck prose (design Option C) | Rejected by the user as an artificial compression of an 11-stage workflow. |
| Add a separate derived `stages:` frontmatter field (design Option B) | Keeps the 0–6 compression the user rejected; adds a third copy of stage ownership. |
| Branch validators on the variant name `co-deck` | Hides policy in code. Breaks the ADR-0083 layering: the workspace owns contracts, the template owns content. |
| Require every variant to declare a phase vocabulary | Edits 12 variants that asked for no change. Duplicates `phase-definitions.md` and `process/stages.yaml`. |
| Drop `phase:` from opted-in procedures | Changes the required-field contract for every namespace for no functional gain. |
| Leave DEG-P-01 active and rely on its current PASS | The PASS for co-deck holds only because procedures use 6 of 13 stages. It would FAIL as soon as procedures cover all stages. |

## Supersedes

For variants that declare `phase_axis: "stage"` **only**:

- ADR-0083 §1, the sentence "`phase` semantics are frozen", and the non-conflation rule ("No validator
  may derive one field from the other, and no validator may require a fixed mapping between them").
  DEG-P-02 replaces it with the opposite rule for these variants.
- ADR-0083 §4, the applicability of DEG-P-01.

ADR-0083 stays Accepted and fully in force for default-axis variants. ADR-0096 and ADR-0063 are
applied, not changed.

## Consequences

**Positive**

- co-deck's agents, skills, procedures, and PM phase-gate table use one numbering, the one its users
  and its prose already use.
- The four upgrade CONFLICT rows on `Projects/co-deck` clear after one template delivery.
- Three coverage pairs that `procedure-coverage.ts` drops today (`source-verifier` 1.5,
  `image-curator` 3.5, `diagram-specialist` 3.5) become visible.
- The other 12 variants see no change. Their validator output stays byte-identical.
- `regenerate-agents-md.ts` and `generate-skill-graph.ts` need no code change; both already render
  per-scope phase numbers.

**Negative and trade-offs**

- **The axis contract is no longer uniform.** Readers of a procedure must check the variant's
  `phase_axis` before reading `phase:` as a delivery phase.
- **Coverage gaps rise for co-deck from 0 to 18** (design §7). Each needs a human disposition.
  CONSTITUTION §6.7 invariant 6 forbids per-stage checklist procedures, so most will be
  `N/A_JUSTIFIED`.
- **Four L0 scripts change, three of them shipped to L1.** Every project receives new validator
  copies, though default-axis behavior does not change.
- **About 26 co-deck template files change**, including all 12 procedures (10 values change), five
  agents, `variant.json`, and `phase-definitions.md`.
- **The procedure validators are not gated** by `audit.ts`, `dev-sync.ts`, or CI today. The new rules
  protect only when someone runs them. Wiring them in is out of scope here.
- **CONSTITUTION §6.7 never received ADR-0083's invariant 7.** The implementing PR must add it
  together with this exception.

## Platform Impact

**Claude Code.** No hook, command, or settings change. Generated agent mirrors do not carry
`phases`. The co-deck presenter-mode skill mirror regenerates when its canonical body changes.

**Antigravity.** Same as Claude Code. Hooks do not fire there, but none of the affected validators is
hook-driven. Each runs as a plain `bun scripts/<name>.ts` call on every surface. No slash command is
added, so `.claude/commands/` and `.gemini/commands/` parity is unaffected.

**templates/common.** `validate-procedures.ts`, `validate-process.ts`, and `bootstrap-stages.ts`
ship to L1 and reach it through `/sync` propagation. `templates/common/docs/procedure-schema-spec.md`
documents the field in its own templates-only PR. `templates/common` itself declares no
`phase_axis` and stays on the default axis.

## Accessibility Impact

No accessibility impact. Governance, frontmatter, procedure fields, and validator rules only; no UI.
CLI output remains plain text.

## References

- Design of record: `docs/designs/2026-11-11-co-deck-phase-doctrine-design.md` (§5 scope, §6 rules,
  §7 coverage, §9 tickets)
- Amends: `docs/adr/0083-domain-execution-graph-and-stage-axis.md` (§1, §4)
- Applies: `docs/adr/0096-variant-phase-ownership-and-qa-gate.md` (§3),
  `docs/adr/0063-procedure-schema-canonical-workflow-source.md`
- Constitution: `docs/constitution/06.7-procedure-lifecycle.md` (invariants 5 and 7)
- Scripts: `procedure-coverage.ts`, `validate-procedures.ts`, `validate-process.ts`,
  `bootstrap-stages.ts`
- Tracking: U-20261111-004; co-deck project review finding H-3
