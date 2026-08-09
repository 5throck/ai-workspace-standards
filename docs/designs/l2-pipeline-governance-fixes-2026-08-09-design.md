# Design: L2 Pipeline Governance Fixes (2026-08-09)

**Architect**: architect
**Status**: Proposed — pending PM/user approval
**Date**: 2026-08-09
**Related**: ADR-0046 (L2 pipeline pre-flight checks), ADR-0042 (Wave 1.5 golden reference), ADR-0050 (this change's ADR)
**Source commits under review**: c9cbd25, b5b3c3f, 20e039d (co-export promotion, 2026-08-09)

---

## Problem Statement

The 2026-08-09 co-export variant promotion required three same-day fix commits to `scripts/l2-to-variant-pipeline.ts`. A follow-up audit found five additional latent bugs in that same file (Issue Set A), a content-loss regression in the root `AGENTS.md` §4.3 Role Boundary Matrix introduced by one of the fix commits (Issue Set B), and a structural gap in test coverage that let all of the above ship same-day instead of being caught pre-commit (Issue Set C).

This document specifies the fix for each numbered item and breaks the work into implementation tasks.

---

## Issue Set A — `scripts/l2-to-variant-pipeline.ts` bugs

### A.1 — Duplicate, drifted exclusion lists (`README_ko.md` scanned as an agent file)

**Finding**: Phase 4.5's structural-gap scan (line 766) filters agent files with:
```ts
if (!file.endsWith('.md') || ['pm.md', 'README.md'].includes(file)) continue;
```
The agent-roster extractor (line 1068) uses the correct, broader list:
```ts
const SKIP_AGENT_FILES = new Set(['pm.md', 'README.md', 'README_ko.md']);
```
Phase 4.5 always runs `README_ko.md` (Korean README present in several variants) through `checkStructuralGaps()` against the agent golden structure, where it always fails (a README has none of the required `## Role` / `## Responsibilities` / etc. sections).

**Decision**: Consolidate into a single exported constant, `SKIP_AGENT_FILES`, in `scripts/helpers/golden-reference-loader.ts` (the module that already owns the golden-structure concept). Both call sites (`l2-to-variant-pipeline.ts` line 766 and line 1068) import and use it. This also incidentally fixes `loadDynamicLayer2Agents()` in the same file, which independently hardcodes `['pm.md', 'README.md']` at line ~122 — three call sites collapse to one constant.

**Files touched**:
- `scripts/helpers/golden-reference-loader.ts` — add `export const SKIP_AGENT_FILES = new Set(['pm.md', 'README.md', 'README_ko.md']);`; use it in `loadDynamicLayer2Agents()`.
- `scripts/l2-to-variant-pipeline.ts` — replace both inline filters (line ~766, line ~1068) with the imported constant.

### A.2 — JSON report field name mismatch (`extraSections` vs `missingOptionalSections`)

**Finding**: Line ~810 writes `extraSections: r.extraSections` (falling back to an empty array when undefined) into the CI-facing `_pipeline_report.json`. `StructuralGapReport` (defined in `golden-reference-loader.ts`) has no `extraSections` field; the real field is `missingOptionalSections`. `r.extraSections` is always `undefined`, so the JSON always reports `extraSections: []` regardless of actual Layer-2 gaps — silently dropping that information from the CI-facing artifact (the markdown report via `formatGapReport()` is unaffected, since it reads `missingOptionalSections` directly).

**Decision**: Fix the field name to match the real type: `missingOptionalSections: r.missingOptionalSections` (with the same empty-array fallback).

**Files touched**:
- `scripts/l2-to-variant-pipeline.ts` line ~810.

### A.3 — `process.exit(1)` inside the exported pipeline function

**Finding**: `executeL2ToVariantPipeline()` is exported for programmatic use (confirmed: `main()` at the bottom of the file calls it and is guarded by `if (import.meta.main)`, meaning the function is a legitimate library entry point for other scripts/tests). Three `process.exit(1)` calls exist inside it — Phase 3.5's auto-fix failure path (line 450), Phase 3.5's BLOCKING path (line 458), and Phase 4.5's BLOCKING path (line 845). Each of these kills the entire host process, which is correct behavior for the CLI (`main()`, lines 1137–1208, which legitimately calls `process.exit` after inspecting the `PipelineResult`) but wrong for a caller that invoked `executeL2ToVariantPipeline()` programmatically (e.g. a future test harness per Issue C, or another script composing pipelines) — that caller's own process dies with no chance to catch, log, or clean up.

**Decision**: Replace all three internal `process.exit(1)` calls with `return buildFailureResult(phases, errors, startTime)`, matching the pattern already used at line 741 (`if (!phases.generate.success) return buildFailureResult(...)`). Add an `errors.push({ phase: '3.5' | '4.5', error: ... })` before each return so the failure reason survives in `PipelineResult.errors`. `process.exit` remains reserved for `main()` only, which is already correctly scoped as the sole CLI entrypoint.

Note: the `catch` block wrapping Phase 3.5 (line ~464) currently has a workaround — `if ((error as NodeJS.ErrnoException).code === undefined) throw error; // re-throw process.exit` — to let a thrown `process.exit` propagate past its own try/catch. Once `process.exit` is replaced with `return`, this workaround becomes dead and should be removed in the same change (a `return` inside a `try` still runs enclosing `finally` blocks correctly and does not trigger the `catch`).

**Files touched**:
- `scripts/l2-to-variant-pipeline.ts` lines ~450, ~458, ~465 (remove workaround), ~845.

### A.4 — Hardcoded `templates/co-deck/variant.json` for `lecture`-type extension fields

**Finding**: Line 686 hardcodes `templates/co-deck/variant.json` as the source of `agent_manifest` / `theme_manifest` / `lecture_profile` extension fields whenever `config.variantType === 'lecture'`. This assumes co-deck is *the* canonical lecture-type variant forever, and breaks if a second lecture-type variant is promoted (its own extension fields would be silently overwritten by co-deck's). `scripts/helpers/registries/variant-type-registry.ts` is confirmed to be the SSOT for variant type metadata (`VARIANT_TYPE_REGISTRY`), but currently only carries `{ name, description }` — no canonical-variant-per-type or extension-field-source mapping exists there or anywhere else in `scripts/helpers/registries/`.

**Decision**: Extend `VariantTypeDefinition` with an optional field, `canonicalExtensionSource?: string` (a `templates/<dir>/variant.json` path, relative to workspace root), and set it for `lecture: { ..., canonicalExtensionSource: 'templates/co-deck/variant.json' }`. Leave it `undefined` for all other types. Replace the hardcoded path at line 686 with a lookup: `getVariantTypeDefinition(config.variantType).canonicalExtensionSource`; skip the extension-field injection block entirely if the field is unset. This keeps today's behavior identical for `lecture` (co-deck stays canonical) while making the mapping declarative, discoverable, and centrally overridable instead of buried in pipeline control flow — the minimal registry-driven fix without inventing a new registry file.

**Files touched**:
- `scripts/helpers/registries/variant-type-registry.ts` — add optional field + value for `lecture`.
- `scripts/l2-to-variant-pipeline.ts` line ~684–696 — read from registry instead of hardcoding.

### A.5 — `VariantPlugin.goldenReference()` is dead code that conflicts with the real enforcement path

**Finding**: All 7 plugins (`scripts/helpers/plugins/*-plugin.ts`) implement `goldenReference(): GoldenReference`, returning per-type required/optional section lists. Confirmed via workspace-wide search: the only call sites are JSDoc `@example` comments (`const ref = plugin.goldenReference();`) inside the plugin files and `variant-plugin.ts`'s interface doc — there is no real invocation anywhere in `scripts/`. Meanwhile, the actually-enforced path is `scripts/helpers/golden-reference-loader.ts`: `AGENT_LAYER1_SECTIONS` (hardcoded required sections, 7 entries including `## ⚠️ PM-ONLY INVOCATION`, `## Constraints`, `## Meeting Participation`, `## Dispatch Protocol`) plus `getValidationPolicy(type).optionalAgentSections` (from `scripts/helpers/registries/validation-policy.ts`, itself a real registry) plus a dynamic scan of existing variant agent files. Comparing the two for `consulting`: the plugin's `goldenReference()` declares only 3 required sections (`## Role`, `## Responsibilities`, `## Engagement Protocol`) — missing 4 of the 7 sections the real enforcement path requires. The plugin definitions are stale relative to the live schema, not just redundant with it.

**Decision**: Delete `goldenReference()` — the method from the `VariantPlugin` interface (`variant-plugin.ts`), its 7 implementations, and the now-unused `GoldenReference` type (if not referenced elsewhere) — rather than wiring it up as the source of truth. Rationale: `validation-policy.ts` is already a real, actively-used registry (also backs `requiredCapabilities`/`requiredAgents` checks elsewhere in the pipeline) plus a dynamic-scan fallback that keeps golden structures in sync with actual variant content over time — a strictly better design than 7 static per-plugin lists that already drifted out of date once. Reconciling `goldenReference()` to match current required sections across 7 files, then rewiring `golden-reference-loader.ts` to call plugins instead of `validation-policy.ts`, would be strictly more invasive than deleting dead code, for no behavior change (nothing calls it today).

**Files touched**:
- `scripts/helpers/plugins/variant-plugin.ts` — remove `goldenReference?(): GoldenReference;` from the interface; remove/relocate `GoldenReference` type if orphaned.
- `scripts/helpers/plugins/{consulting,collaboration,design,development,game,lecture,security}-plugin.ts` — remove each `goldenReference()` method and its JSDoc `@example`.

---

## Issue Set B — `AGENTS.md` §4.3 Role Boundary Matrix regression

**Finding**: `git show c9cbd25 -- AGENTS.md` confirms commit c9cbd25 replaced the root `AGENTS.md` §4.3 table's 6 workspace-specific rows (architect / automation-engineer / docs-writer / scaffolding-expert / security-expert / auditor disambiguation guidance) with nothing, leaving only the `pm` row plus an empty `<!-- VARIANT-ROLE-BOUNDARY-START -->` / `<!-- VARIANT-ROLE-BOUNDARY-END -->` marker pair.

Root cause traced to `scripts/propagate-to-templates.ts`, transformation **B-A10** (`§4.3 Role Boundary Matrix`, ~line 970): this transformation is *correct* when applied to produce `templates/common/AGENTS.md` — variant templates don't have `architect`/`automation-engineer`/`docs-writer`/`scaffolding-expert`/`security-expert`/`auditor` as real agents (each variant defines its own specialist roster), so stripping those workspace-specific rows down to the generic `pm` row + a variant-injectable marker is the intended behavior for that *target* file (`templates/common/AGENTS.md`, confirmed to already carry exactly this pm-only + empty-marker pattern, and correctly so). The regression is that the same transformed content ended up written back into the **source** file, root `AGENTS.md`, during the c9cbd25 fix session — root `AGENTS.md` documents the real, current workspace agent roster (all 6 removed rows correspond to real files under `agents/*.md`) and was never meant to be a propagation *target*. The `<!-- VARIANT-* -->` markers are meaningless on root `AGENTS.md`: `injectVariantPlaceholders()` (`scripts/helpers/generate-variant.ts`) only ever operates on generated *variant* `AGENTS.md` files, never on root.

**Decision**: Restore the original 6 rows to root `AGENTS.md` §4.3, ABOVE the `pm` row (matching the original commit-diff order), and remove the `<!-- VARIANT-ROLE-BOUNDARY-START/END -->` marker pair from root `AGENTS.md` entirely — it does not belong on a non-propagation-target file. `templates/common/AGENTS.md` is untouched by this fix; its current pm-only + marker content is correct per `propagate-to-templates.ts` B-A10 and per the 5 co-* variant templates that already carry populated marker content (co-consult, co-security, co-develop, etc., confirmed via grep).

Restored table (verbatim from pre-c9cbd25 `AGENTS.md`):

```markdown
| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the implementation approach and folder structure | `architect` | `automation-engineer` |
| Write or modify automation scripts (.ts, package.json) per ADR-0036 | `automation-engineer` | `architect` |
| Update documentation files | `docs-writer` | `architect` |
| Create new project from template | `scaffolding-expert` | `automation-engineer` |
| Security review, Git hooks configuration | `security-expert` | `architect` |
| Cross-validate documentation consistency | `auditor` | `docs-writer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |
```

**Follow-up guard**: `propagate-to-templates.ts` should assert `sourcePath !== targetPath` (or equivalently, that `targetPath` always contains `templates/`) before any B-A* content transformation runs, so a future accidental write-back to a non-template source file fails loudly instead of silently corrupting the SSOT. This is a small defensive addition, included as Task 3 below.

**Files touched**:
- `AGENTS.md` (root) — restore 6 rows, remove marker pair.
- `scripts/propagate-to-templates.ts` — add source/target path guard (defensive; prevents recurrence).

---

## Issue Set C — No E2E test for L2→variant promotion path

**Finding**: `skills/simulate-project-creation/SKILL.md` (`last_reviewed: 2026-05-30`) covers only L1 project scaffolding (`new-project.ts`), and is itself stale — its Execution Steps reference `scripts/new-project.ps1` and `scripts/new-project.sh`, neither of which exists; per ADR-0036 only `.ts` scripts exist (`scripts/new-project.ts`, run via `bun scripts/new-project.ts`). There is no skill or script-level test exercising `scripts/create-l2-scaffold.ts` (both confirmed to exist) end-to-end. This gap is plausibly why 3 same-day fix commits were needed for co-export: nothing ran the pipeline against a disposable fixture before promotion.

**Decision**: Add a new, minimal skill — `skills/simulate-l2-promotion/SKILL.md` — rather than extending `simulate-project-creation` in place. Rationale: the two pipelines exercise structurally different scripts (`new-project.ts` vs. `create-l2-scaffold.ts` + `l2-to-variant-pipeline.ts`), different owners in practice (scaffolding-expert for L1, architect/automation-engineer for L2→variant), and conflating them into one skill's Execution Steps would make both harder to follow. Keep it deliberately small per the ask ("just enough to catch classification/parsing regressions like the ones fixed today") — a smoke test, not a full test suite:

1. Scaffold a disposable L2 fixture project via `bun scripts/create-l2-scaffold.ts` into a scratch folder (mirroring step 1 of `simulate-project-creation`).
2. Add a `README_ko.md` and at least one non-`pm`/`README` agent file with an intentionally incomplete section set to the fixture's `agents/` dir (regression bait for A.1/A.2).
3. Run `bun scripts/l2-to-variant-pipeline.ts --l2-path=<fixture> --name=co-e2etest --type=collaboration --description="..."` against it.
4. Assert: (a) pipeline does not classify `README_ko.md` as a structural-gap failure (A.1 regression check), (b) `_pipeline_report.json` contains a populated `missingOptionalSections` array where expected, not an always-empty `extraSections` (A.2 regression check), (c) pipeline result / exit code correctly reflects failure for the intentionally-incomplete agent file without killing the invoking process when called programmatically (A.3 regression check, if run via a small `.ts` harness that imports `executeL2ToVariantPipeline` directly rather than shelling out).
5. Clean up the scratch folder.

Also fix `skills/simulate-project-creation/SKILL.md` Execution Steps in the same change: replace the `.ps1`/`.sh` invocation lines with `bun scripts/new-project.ts "e2e-test-scaffold"` (single cross-platform command per ADR-0036), and bump `last_reviewed`.

**Files touched**:
- `skills/simulate-l2-promotion/SKILL.md` — new file.
- `skills/simulate-project-creation/SKILL.md` — fix stale `.ps1`/`.sh` references, bump `last_reviewed`.

---

## Implementation Task Breakdown

| # | Task | Files | Depends on |
|---|------|-------|------------|
| 1 | A.1 + A.2: consolidate `SKIP_AGENT_FILES`, fix `missingOptionalSections` field name | `golden-reference-loader.ts`, `l2-to-variant-pipeline.ts` | — |
| 2 | A.3: replace 3 `process.exit(1)` calls inside `executeL2ToVariantPipeline` with `buildFailureResult` returns; remove dead re-throw workaround | `l2-to-variant-pipeline.ts` | — |
| 3 | A.4: add `canonicalExtensionSource` to variant-type registry; use it instead of hardcoded co-deck path | `variant-type-registry.ts`, `l2-to-variant-pipeline.ts` | — |
| 4 | A.5: delete `goldenReference()` from `VariantPlugin` interface and all 7 plugins | `variant-plugin.ts`, 7 `*-plugin.ts` files | — |
| 5 | B: restore 6-row Role Boundary Matrix to root `AGENTS.md`, remove marker pair; add source/target guard to `propagate-to-templates.ts` | `AGENTS.md`, `propagate-to-templates.ts` | — |
| 6 | C: new `simulate-l2-promotion` skill; fix stale refs in `simulate-project-creation` | `skills/simulate-l2-promotion/SKILL.md` (new), `skills/simulate-project-creation/SKILL.md` | Tasks 1–3 (test asserts on their fixed behavior) |

Tasks 1–5 are independent of each other and can be dispatched in parallel. Task 6 should land last since its assertions target the fixed behavior from Tasks 1–3.

---

## Open Questions

None blocking — all five Issue-A items, Issue B, and Issue C have a concrete decision above. The one soft judgment call is A.5 (delete vs. wire up `goldenReference()`); flagged for explicit PM/user sign-off in the execution plan since it removes an existing (if unused) public interface method from `VariantPlugin`.
