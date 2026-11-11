# co-deck Phase/Stage Doctrine for Agent Frontmatter — Design (Row 0)

- **Spec ID**: `2026-11-11-co-deck-phase-doctrine-design`
- **Date**: 2026-11-11 (revised 2026-11-11 after the user decision)
- **Status**: approved — **Option A selected by the user** (2026-11-11). The implementation tickets in §9 still need PM approval. ADR-0104 is `Proposed` and needs user acceptance before T2 starts.
- **Author**: architect (PM-dispatched, user decision request)
- **Tracking**: U-20261111-004 (phase-frontmatter part, rejected in [`2026-11-11-co-deck-upstream-fixes-design.md`](2026-11-11-co-deck-upstream-fixes-design.md) §2 U-004); co-deck project review finding H-3 (`Projects/co-deck/docs/reports/2026-11-11-project-review-full.md`)
- **Decision record**: [`docs/adr/0104-variant-stage-bound-phase-axis.md`](../adr/0104-variant-stage-bound-phase-axis.md) (Proposed; amends ADR-0083 for opted-in variants)
- **Scope**: design only. This document changes no template, project, or script file.
- **Boundary note (CLAUDE.md §9)**: the work splits into a workspace-root (L0) PR, a `templates/common/` PR, a `templates/co-deck/` PR, and a project PR that the co-deck PM runs. §9.2 lists the order.

## 0. Revision summary

The first revision recommended Option C (keep delivery phases 0–6 and relabel the template prose). The user selected **Option A**. The stated reason: co-deck has an 11-stage lecture workflow, and there is no reason to compress it into delivery phases 0–6.

This revision does five things:

1. It records Option A as the decision and lists its full cost (§4).
2. It scopes the mechanism as a variant opt-in, `process_manifest.phase_axis: "stage"` (§5).
3. It specifies the validator rules (§6) and the measured coverage impact (§7).
4. It drafts ADR-0104 (§8).
5. It replaces the Option C tickets with an ordered Option A breakdown (§9).

The handbook-reviewer CONFLICT stays a separate item (T8).

## 1. Problem

co-deck has two numbering systems. Delivery phases 0–6 are the current agent/skill contract. Pipeline stages 1–11 (plus 1.5 and 3.5) are the slide production sequence. `templates/co-deck/docs/phase-definitions.md` is the declared authority. It says that agent frontmatter `phases:` uses delivery phases and is "never renumbered".

On 2026-11-11 the co-deck project fixed review finding H-3. It rewrote four agents' `phases:` to stage numbers. It did not change the authority file. The project then filed U-20261111-004 and asked the template to adopt the same values. The workspace rejected the template change because the authority file disagreed.

Result: the template and the project disagree. Every `upgrade-project` dry-run on `Projects/co-deck` reports agents/ CONFLICT errors and exits non-zero. The user resolved the doctrine question in favor of stage numbers.

| Agent | Template `phases` (delivery) | Project `phases` (after H-3) | Owned stages (`process/stages.yaml`) |
|---|---|---|---|
| design | `[3]` | `[4]` | S4 |
| html-build | `[4]` | `[5, 6, 7, 8]` | S5–S8 |
| measure | `[4]` | `[9, 10]` | S9–S10 |
| pdf-export | `[4, 5]` | `[11]` | S11 |

## 2. Evidence

### 2.1 Measured upgrade impact

`bun scripts/upgrade-project.ts Projects/co-deck --dry-run` (read-only, run 2026-11-11) exits 1 with five agents/ `CONFLICT DISPOSITION (SKIP)` rows. Each row is "equal-version drift" (`scripts/lib/upgrade-policy.ts` `resolveConflictDisposition`, verdict `CONFLICT`, severity ERROR).

| File | Version | Cause |
|---|---|---|
| `agents/design.md` | 1.1.2 | H-3 `phases` rewrite |
| `agents/html-build.md` | 1.4.0 | H-3 `phases` rewrite |
| `agents/measure.md` | 2.1.2 | H-3 `phases` rewrite |
| `agents/pdf-export.md` | 2.2.2 | H-3 `phases` rewrite |
| `agents/handbook-reviewer.md` | 1.1.2 | **Unrelated.** The project moved to the unified `validate-handbook.ts` chain (`bun run ci`). Out of scope; see T8. |

Apart from `phases`, the four H-3 files differ from the template only in the project-name substitution and the `last_updated` dates.

### 2.2 The project is internally inconsistent after H-3

- The project bodies still state delivery-phase doctrine. `agents/design.md` says "You own Phase 3 — Design (pipeline Stage 4 ...)". `agents/measure.md` says "You own Phase 4 (Stages 9-10 ...)".
- The project Dispatch Protocol lines still say `**Can Lead Phases**: [3]` (design), `[4]` (html-build, measure), and `[4, 5]` (pdf-export).
- `Projects/co-deck/docs/phase-definitions.md` is byte-identical to the template copy.
- `version` keeps `[0, 1, 2, 3, 4, 5, 6]`. The other agents look like stages only because stages 1, 1.5, 2, 3, and 3.5 share numbers with phases.
- All 12 project procedures keep delivery-phase `phase:` values (0–6) next to `stage:` values (S1–S11).

Option A resolves this by making the whole variant use the stage axis, not only four agents.

### 2.3 The template prose already uses stage numbers as "Phase"

- `templates/co-deck/agents/README.md` (and `README_ko.md`) has a **Phases** column that holds stage numbers (Design `4`, Build `5-8`, Measure `9-10`, Export `11`).
- `templates/co-deck/docs/user-guide.md` §4 (and `user-guide_ko.md`) has a **Phase** column that holds stage numbers. It cites "`AGENTS.md` §3.5 and §4.1.5". The template `AGENTS.md` has no §4.1.5. That section exists only in the project `AGENTS.md`.

Under Option A these column labels become correct. Only the dangling §4.1.5 citation still needs a fix (T4).

### 2.4 Validators and governance that depend on delivery-phase numbering

| Surface | Dependency | Change under Option A |
|---|---|---|
| ADR-0083 §1 (Accepted) | "`phase` semantics are frozen." Non-conflation rule: no validator may derive one field from the other. | Amended by ADR-0104 for opted-in variants only. |
| ADR-0083 §4 | DEG-P-01 FATAL when the stage→phase mapping is bijective. | Not applicable to opted-in variants (axes are identical by declaration). |
| ADR-0096 §3 (Accepted) | Phase numbering is variant-specific; the variant `phase-definitions.md` plus agent `phases` is authoritative. | Unchanged. Option A is an instance of it. |
| ADR-0063 invariant 3 / CONSTITUTION §6.7 invariant 5 | Coverage is per `(agent_key, phase)`, satisfied by a procedure step. | Semantics unchanged. The phase domain widens to the variant vocabulary. |
| `scripts/procedure-coverage.ts` (L0 only) | Keeps only integers 0–6 (lines 94–96). | Read the vocabulary from the variant (T2). |
| `scripts/validate-procedures.ts` (ships to L1) | L2 rule: `phase must be an integer 0–6` (lines 189–190). | Accept the stage vocabulary for opted-in variants (T2). **The first revision missed this surface.** |
| `scripts/validate-process.ts`, `scripts/bootstrap-stages.ts` (ship to L1) | DEG-P-01 `checkDistinctness`. | Report N/A for opted-in variants; add DEG-P-02 (T2). |
| `scripts/regenerate-agents-md.ts` (ships to L1) | Renders `VARIANT-PHASE-GATE` as `Phase <phases>` (line 252). | **No code change.** The renderer is generic. Only the regenerated co-deck block changes. |
| `scripts/generate-skill-graph.ts` (ships to L1) | Emits `phase:<scope>/<n>` nodes from `skill_manifest[].phases`; labels from the `phase-definitions.md` table (`phaseLabel`, line 1505). | **No code change.** Numbering is already per scope. The graph regenerates. |
| `scripts/validate-variant-claims.ts` | Owners in the `phase-definitions.md` table must be roster agents. | No code change. The rewritten table keeps an Owning Agent(s) column. |
| `templates/co-deck/variant.json` `skill_manifest` | Ten skill rows carry delivery `phases`. | Renumbered (T4). |
| `templates/co-deck/procedures/*/schema.yaml` | Twelve procedures carry `phase:` 0–6 and `stage:` S1–S11. | `phase:` becomes the stage order (T4). |
| Archived coverage tickets `co-deck:version:0..6` (`tickets/governance/archive/T-20260829-003..008`) | Keys on delivery phases. | Historical only; no action. |

### 2.5 Additional facts found in this revision

- **CONSTITUTION §6.7 has no invariant 7.** ADR-0083 §1 says the non-conflation rule "enters CONSTITUTION §6.7 as invariant 7". `docs/constitution/06.7-procedure-lifecycle.md` lists invariants 1–6 only. T1 adds invariant 7 together with the ADR-0104 exception.
- **The procedure validators are not gated.** `audit.ts`, `dev-sync.ts`, `.githooks/`, and `.github/` do not invoke `validate-procedures.ts`, `validate-process.ts`, or `procedure-coverage.ts` (grep, 2026-11-11). The test plan must run them explicitly. Wiring them into audit is out of scope.
- **DEG-P-01 would pass by accident.** After the renumber, the procedures use 6 of the 13 co-deck stages. `checkDistinctness` requires `stageCount === phaseCount` for a FAIL, so it returns PASS. That PASS depends on stage count, not on design. ADR-0104 makes the rule explicitly not applicable instead.
- **co-deck already carries fractional phases.** `source-verifier [1.5]`, `image-curator [3.5]`, and `diagram-specialist [3.5]` exist today. `procedure-coverage.ts` silently drops them. Three coverage pairs are invisible now and become visible under Option A.

## 3. Options (decision record)

### Option A — Adopt stage numbering as the co-deck `phases` doctrine — **SELECTED**

The variant's phase vocabulary becomes its pipeline stage numbers. Agent `phases`, `skill_manifest` `phases`, and procedure `phase:` all use stage numbers. §4–§9 hold the decision and the design.

### Option B — Dual axis: keep `phases` (delivery), add `stages` (pipeline) — not selected

Agent frontmatter keeps `phases` and gains a derived, validated `stages:` field. It was offered as the medium-risk choice. The user did not select it because it keeps the 0–6 compression the user rejected.

### Option C — Keep the doctrine; co-deck reverts; fix the template labels — not selected

`phases` stays the delivery contract, the project reverts H-3, and the template relabels its prose. It was the first revision's recommendation (smallest change, no ADR). The user rejected it as an artificial squeeze of an 11-stage workflow.

### Comparison (updated with this revision's findings)

| Criterion | A (selected) | B | C |
|---|---|---|---|
| Clears the four CONFLICTs | yes | yes | yes |
| Conforms to ADR-0083 as written | no — ADR-0104 amends it | partly | yes |
| L0 script changes | 3 scripts + 1 shared (`validate-procedures`, `validate-process`, `procedure-coverage`, `bootstrap-stages`) | 2 | 0 (1 optional) |
| Template files touched | about 26 (co-deck) + 1 (common) | about 8 | 5 |
| New coverage gaps to adjudicate | 18 (§7) | 0 | 0 |
| Matches the user's model of the workflow | yes | partly | no |

## 4. Decision and honest cost

**Option A, selected by the user on 2026-11-11.** The design below delivers it with the smallest blast radius that still meets the user's intent.

The cost, stated in full:

1. **Governance.** ADR-0104 amends ADR-0083 §1 ("phase semantics are frozen") and the non-conflation rule for opted-in variants. It also makes ADR-0083 §4 DEG-P-01 not applicable to them. CONSTITUTION §6.7 changes: invariant 5 gains a phase-vocabulary clause, and the missing invariant 7 is written with the exception.
2. **`procedure-coverage.ts`.** The fixed 0–6 integer filter becomes a per-variant vocabulary. Fractional coverage keys appear (`co-deck:source-verifier:1.5`).
3. **`validate-procedures.ts`.** The L2 phase range becomes per-variant. This script ships to L1, so every project receives the change.
4. **`validate-process.ts` / `bootstrap-stages.ts`.** DEG-P-01 gains an N/A branch. A new rule DEG-P-02 enforces the stage-bound contract.
5. **`regenerate-agents-md.ts` PM phase-gate table.** No code change. The co-deck `VARIANT-PHASE-GATE` block regenerates with stage numbers (`Phase 4`, `Phase 5, 6, 7, 8`, `Phase 9, 10`, `Phase 11`).
6. **Skill-graph phase nodes.** No code change. `phase:co-deck/0` and `phase:co-deck/6` disappear. New nodes appear for the stage numbers used in `skill_manifest`. Labels come from the rewritten `phase-definitions.md` table.
7. **Procedure renumber.** All 12 procedures get `phase:` equal to their stage order. Ten values change; two already match (§9 T4).
8. **Template files.** About 26 files in `templates/co-deck/` plus one in `templates/common/` (§9). This exceeds the architect high-risk threshold of three template files. The user confirmed the option; the PM must still confirm the T4 file list.
9. **Coverage.** Gaps for co-deck go from 0 to 18 under unchanged coverage semantics (§7). Each gap needs a human disposition (`PROCEDURE_REQUIRED` or `N/A_JUSTIFIED`). Invariant 6 forbids per-stage checklist procedures, so most gaps will be `N/A_JUSTIFIED`.
10. **Precedent.** Other variants with stage-like numbering (co-news, co-game, co-price) can opt in. ADR-0104 requires a DEC record for each opt-in, so the precedent stays controlled.

## 5. Scope decision: a variant opt-in bound to the stages file

### 5.1 Candidates

| Candidate | What it is | Blast radius | Verdict |
|---|---|---|---|
| S1 — co-deck name hardcode | Validators branch on `variant === "co-deck"`. | Smallest code diff. | **Rejected.** It hides policy in code. It breaks the ADR-0083 layering rule: the workspace owns contracts and the template owns content. |
| S2 — workspace-wide phase vocabulary | Every variant declares its phase list in `variant.json`; all validators read it. | 13 variants + every validator + `workspace-schema.json`. | **Rejected.** It duplicates `phase-definitions.md` and `process/stages.yaml`. It edits 12 variants that did not ask for a change. The user's intent covers co-deck only. |
| **S3 — opt-in stage-bound axis** | One `variant.json` field, `process_manifest.phase_axis: "stage"`. It declares that the variant's phase vocabulary is the `order` set of its committed `process/stages.yaml`. Absent or `"delivery"` keeps today's behavior. | co-deck only; 3 validators + 1 shared script gain one branch. | **Selected.** |

### 5.2 Why S3

1. **No new vocabulary list.** The vocabulary already exists in `process/stages.yaml` (`order: 1, 1.5, 2, ... 11`). S3 points at it. Nothing can drift between two lists.
2. **Zero change for the other 12 variants.** The field defaults to `"delivery"`. Their files, coverage, and validator output stay byte-identical.
3. **Validators branch on a declared contract, not a variant name.** The mechanism is generic in form but adopted by one variant.
4. **Controlled precedent.** Another variant may opt in only with a committed stages file and a DEC record. It needs no new ADR.
5. **It matches the user's intent exactly.** co-deck phases become its stage numbers 1–11, including the 1.5 and 3.5 checkpoints it already uses.

### 5.3 What the vocabulary contains

- **Numeric phases** for co-deck: `{1, 1.5, 2, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11}`. This is the `order` set of `templates/co-deck/process/stages.yaml`.
- **H-stage tokens** (`H-2`, `H-5`, ...) stay legal for the handbook agents. Coverage ignores non-numeric values today and keeps ignoring them.
- **Stage 0 (PM intake) and post-pipeline close-out carry no number.** ADR-0096 §3 states PM duties by role (initiation, every approval gate, finalization). PM is coverage-exempt. The Phase 6 QA-gate contract (ADR-0096 §4) runs at close-out.

## 6. Normative rules (for opted-in variants)

| ID | Rule | Host | Severity |
|---|---|---|---|
| R1 | `phase_axis: "stage"` requires `process_manifest.stages_file` to be non-null and the stages file to exist. | `validate-process.ts` | FATAL |
| R2 | Each procedure's `phase:` equals the numeric `order` of its `stage:`. | `validate-process.ts` (DEG-P-02) | FATAL |
| R3 | Each numeric value in agent frontmatter `phases` is a member of the vocabulary. | `validate-process.ts` (DEG-P-02) | FATAL |
| R4 | Each `skill_manifest[].phases` value is a member of the vocabulary. | `validate-process.ts` (DEG-P-02) | FATAL |
| R5 | Procedure L2 `phase` check: a member of the vocabulary (opted-in) or an integer 0–6 (default). | `validate-procedures.ts` | ERROR (L2, as today) |
| R6 | DEG-P-01 reports `N/A (phase_axis: stage)` and never FAILs. | `validate-process.ts`, `bootstrap-stages.ts` | — |
| R7 | Coverage pairs use the vocabulary. The `coverage_key` format stays `<variant>:<agent_key>:<phase>`. | `procedure-coverage.ts` | report / tickets |

R2 is the inverse of the non-conflation rule. In an opted-in variant, `phase` and `stage` carry the same information by declaration. The procedure keeps both fields so that the procedure schema, the graph, and the L2 required-field list stay unchanged. Dropping `phase:` was considered and rejected: it would change the required-field contract for every namespace.

Default-axis variants keep every current rule, including non-conflation and DEG-P-01.

## 7. Coverage impact (measured baseline, projected result)

Baseline: `bun scripts/procedure-coverage.ts --variant co-deck` reports 15 pairs and **0 gaps** (2026-11-11). The three fractional pairs are invisible today.

Projected after T4, with procedure `phase:` equal to stage order and the agent values below:

| Agent | Proposed `phases` | Covered by | New gaps |
|---|---|---|---|
| research | `[1]` | source-research, lecture-deck-production | — |
| source-verifier | `[1.5]` | — | 1.5 |
| storyline | `[2, 3]` | storyline-development (2) | 3 |
| image-curator | `[3.5]` | — | 3.5 |
| diagram-specialist | `[3.5]` | — | 3.5 |
| design | `[4]` | — (its step sits in lecture-deck-production, stage S1) | 4 |
| html-build | `[5, 6, 7, 8]` | deck-build-and-export (5) | 6, 7, 8 |
| measure | `[9, 10]` | — (its step sits in deck-build-and-export, stage S5) | 9, 10 |
| pdf-export | `[11]` | deck-publish-and-version | — |
| version | all 13 values (see open question 1) | kickoff (1), research-control (2), storyline-control (3), production-control (4), export/retrospective/publish (11) | 1.5, 3.5, 5, 6, 7, 8, 9, 10 |

**Total: 18 new gaps** (10 non-version + 8 version). T6 adjudicates them. The gaps are real: no procedure starts at stages 6–10. Under invariant 6 the right answer is usually `N/A_JUSTIFIED` with the multi-stage procedure named as the reason.

## 8. ADR

**ADR-0104 — "Variant Stage-Bound Phase Axis"** (`docs/adr/0104-variant-stage-bound-phase-axis.md`, status `Proposed`).

- It **amends ADR-0083** for opted-in variants. It supersedes, for those variants only, the ADR-0083 §1 sentence "phase semantics are frozen" and the non-conflation rule. It makes ADR-0083 §4 DEG-P-01 not applicable to them.
- It **applies ADR-0096 §3** without change.
- ADR-0083 stays Accepted and fully in force for default-axis variants.
- Registration: ADRs in this repo have no hand-maintained index. `generate-skill-graph.ts` adds the `adr:0104` node once the file is git-tracked, at the next `/sync`. `verify-adr-governance.ts` requires a governance-doc pointer only for Accepted ADRs; T1 adds that pointer in CONSTITUTION §6.7 when the user accepts the ADR.

## 9. Implementation breakdown (ordered tickets; not created)

### 9.1 Tickets

| # | Size | Layer / PR | Title | Files | Validator / test changes | Acceptance |
|---|---|---|---|---|---|---|
| T1 | S | Root — PR-A | Accept ADR-0104 and amend CONSTITUTION §6.7 | `docs/adr/0104-variant-stage-bound-phase-axis.md` (status → Accepted, after user acceptance); `docs/constitution/06.7-procedure-lifecycle.md` (invariant 5 vocabulary clause; new invariant 7 with the opt-in exception; pointer to ADR-0104); `docs/adr/0083-domain-execution-graph-and-stage-axis.md` (one `Amended by: ADR-0104` line in its Governance section) | `verify-adr-governance.ts --strict` passes (ADR-0104 is linked from §6.7) | §6.7 lists invariants 1–7; ADR-0083 points to ADR-0104 |
| T2 | M | Root — PR-A | Phase-axis support in the procedure validators | `scripts/validate-procedures.ts` (R5); `scripts/validate-process.ts` (R1–R4 as DEG-P-02, R6); `scripts/bootstrap-stages.ts` (R6); `scripts/procedure-coverage.ts` (R7); `@version` bumps; `scripts/SCRIPTS.md`; `docs/VERSION_MANIFEST.md`; `docs/lifecycle/scripts/*.md` for each script | Extend `tests/validate-procedures.test.ts` (opted-in fixture accepts `phase: 9` and `1.5`, rejects `12`; default fixture rejects `9`). New `tests/unit/validate-process-phase-axis.test.ts` (R1–R4 pass/fail fixtures; DEG-P-01 N/A). New `tests/unit/procedure-coverage-phase-axis.test.ts` (fractional pair, key format, default variant unchanged). | All 12 default-axis variants: byte-identical output from all three validators before and after. `bun run test:unit` passes. `/sync` publishes the L1-shipped copies to `templates/common/scripts/`. |
| T3 | S | `templates/common/` only — PR-B | Document `phase_axis` in the L1 procedure spec | `templates/common/docs/procedure-schema-spec.md` (L2 row: "phase 0–6, or the variant stage vocabulary when `phase_axis: stage`"; a short `phase_axis` section citing ADR-0104); optional one-line note in `templates/common/docs/phase-definitions.md` | `validate-docs-links.ts` passes | Spec matches T2 behavior |
| T4 | L | `templates/co-deck/` only — PR-C | Adopt the stage-bound axis in co-deck | `variant.json` (`process_manifest.phase_axis: "stage"`; `skill_manifest` phases renumbered from stage ownership); 5 agents with changed values — `design.md [4]`, `html-build.md [5,6,7,8]`, `measure.md [9,10]`, `pdf-export.md [11]`, `version.md` (open question 1) — with body and `Can Lead Phases` lines and version bumps; 10 procedures renumbered (`deck-build-and-export 4→5`, `deck-publish-and-version 5→11`, `lecture-deck-production 3→1`, `slidedata-derived-doc-sync 4→2`, `version-export-control 4→11`, `version-kickoff-control 0→1`, `version-production-control 3→4`, `version-research-control 1→2`, `version-retrospective-control 6→11`, `version-storyline-control 2→3`) with procedure version bumps; `docs/phase-definitions.md` rewritten as one axis (a `\| Phase \| Name \| Owning Agent(s) \| Key Outputs \|` table keyed 1…11, H-stage section kept, gates keyed by phase); `AGENTS.md` `VARIANT-PHASE-GATE` regenerated with `regenerate-agents-md.ts`; `docs/user-guide.md` and `docs/user-guide_ko.md` (replace the dangling "§4.1.5" citation with a link to `docs/phase-definitions.md`); `skills/presenter-mode/SKILL.md` "Phase 4" → stages 5–8, then regenerate its 5 platform mirrors. Historical files under `docs/designs/` stay unchanged. | Run explicitly (they are not gated): `validate-procedures.ts --all`, `validate-process.ts --variant co-deck --determinism` (DEG-P-02 PASS, DEG-P-01 N/A), `procedure-coverage.ts --variant co-deck` (exactly the 18 gaps in §7), `validate-variant-claims.ts`, `generate-skill-graph.ts` then `verify-skill-graph.ts`, `validate-docs-links.ts` | Upgrade dry-run on a copy of `Projects/co-deck` shows no agents/ CONFLICT for the four H-3 files; translation pairs stay in sync |
| T5 | M | `Projects/co-deck` repo — PR-D (co-deck PM) | Receive the template and close H-3 | Run `upgrade-project` from the released template. If the four H-3 agents still report drift, use `--disposition adopt-template=` for those four paths. Reconcile the project-local `AGENTS.md` §4.1.5 table with the regenerated block. Record a project DEC. | Project runs its new L1 copies of `validate-procedures.ts` and `validate-process.ts`, then `bun scripts/audit.ts` | Upgrade dry-run exits 0 for agents/ apart from T8's file |
| T6 | M | Root — PR-E | Adjudicate the 18 co-deck coverage gaps | `bun scripts/procedure-coverage.ts --variant co-deck --tickets` creates 18 `kind: manual` tickets; a human disposes each as `PROCEDURE_REQUIRED` or `N/A_JUSTIFIED` | Confirm the ticket schema accepts a `.` in `coverage_key` (fractional phases); fix in T2 if it does not | Zero open co-deck coverage tickets without a disposition |
| T7 | S | Root — PR-E | Close U-20261111-004 phase part | Reply on U-20261111-004 with this design, ADR-0104, and the T5 steps; transition per the ticket flow | — | Ticket history cites this spec |
| T8 | S–M | Separate (out of scope) | `agents/handbook-reviewer.md` CONFLICT | The project replaced `handbook-doctor` + `check-authoring` with `validate-handbook.ts` (`bun run ci`). Decide port-to-template or revert through the adjudicated-port path. | — | Upgrade dry-run shows no agents/ CONFLICT for this file |

### 9.2 PR boundaries and order (mandatory)

CLAUDE.md §9 forbids root and template changes in one task. CONSTITUTION §3.3 requires each PR to merge before the next `/sync`.

1. **PR-A (workspace root): T1 + T2.** Starts only after the user accepts ADR-0104. `/sync` publishes the L1-shipped script copies to `templates/common/scripts/`. That is pipeline propagation, not a hand edit (precedent: the ADR-0101 PR).
2. **PR-B (`templates/common/` only): T3.** After PR-A merges.
3. **PR-C (`templates/co-deck/` only): T4.** After PR-B merges. It cannot land before PR-A: the current `validate-procedures.ts` rejects `phase: 11`. The pipeline regenerates `docs/skill-graph.json` in this PR, as in every template PR.
4. **PR-D (`Projects/co-deck` repo, co-deck PM): T5.** After PR-C merges. Until then the project keeps its H-3 values, and the dry-run keeps the five SKIP rows. The co-deck PM must not force-adopt agents/ before PR-C lands.
5. **PR-E (workspace root): T6 + T7.** After PR-C merges. T6 can run in parallel with T5.
6. **T8** is independent and follows its own path.

## 10. Platform Impact

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | No hook or command change. Generated agent mirrors (`.claude/agents/*.md`) do not carry `phases`. The presenter-mode skill mirror regenerates in T4. | `templates/co-deck/.claude/skills/presenter-mode/SKILL.md` (generated) |
| Antigravity (GEMINI.md) | Same as Claude Code. Hooks do not fire there, but none of these validators is hook-driven; they run as plain `bun scripts/<name>.ts` on every surface. | `templates/co-deck/.gemini/skills/presenter-mode/SKILL.md` (generated) |
| Codex / Hermes / `.agents` | Generated presenter-mode mirrors only. | `templates/co-deck/{.codex,.hermes,.agents}/skills/presenter-mode/SKILL.md` (generated) |
| templates/common | T2 changes three L1-shipped scripts, propagated by `/sync`. T3 edits one L1 doc. Default-axis projects see no behavior change. | `templates/common/scripts/{validate-procedures,validate-process,bootstrap-stages}.ts`, `templates/common/docs/procedure-schema-spec.md` |

## 11. Accessibility exemption note

Doctrine text, frontmatter values, procedure fields, and validator rules. No UI change. No accessibility review required.

## 12. Open questions for the user

1. **`version` agent phases.** Declare all 13 stage values (faithful to "snapshot before every edit"; adds 8 coverage gaps to adjudicate), or only the five stages where a version-control procedure runs (1, 2, 3, 4, 11; no version gaps)? Recommendation: all 13, because the narrower list would understate the agent's real scope.

Resolved in this revision (no user input needed): the option (A); the scope (S3 opt-in); procedure `phase:` is kept and equals stage order; Stage 0 intake and close-out stay unnumbered PM duties.
