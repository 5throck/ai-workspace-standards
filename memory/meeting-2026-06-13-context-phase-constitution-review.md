# Meeting Transcript
**Date**: 2026-06-13
**Topic**: 5-item diagnostic — context.md duplication, Phase A/B distinction, L0→L1 deployment verification, CONSTITUTION.md reflection, variant creation script changes
**Participants**: architect, auditor, automation-engineer, docs-writer, scaffolding-expert, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: Reviewed all 5 items.

Item 1 (context.md duplication): The Agents table in `variant.context.template.md` / `<variant>.context.md` and the roster in `AGENTS.md` are intentional duplication for "context proximity" — not a design error. The `co-develop.context.md` already has a `<!-- context-proximity -->` comment explaining this. The gap is that `variant.context.template.md` lacks this comment, causing confusion for newcomers. Recommend docs-writer add the comment to the template.

Item 2 (Phase A/B in design docs): `docs/templates/QUALITY_GATES-template.md` and ADR-0029 define Phase A/B clearly, but `CONSTITUTION.md` and `docs/constitution/07-new-project.md` have zero Phase A/B references. The gap between design documents and operational reality is real. Asked automation-engineer to confirm whether `create-l2-scaffold.ts` Phase A/B logic aligns with ADR-0039's L0→L1→L2 hierarchy.

**automation-engineer**: Item 3 (L0→L1 deployment Phase A/B): `propagate-to-templates.ts --apply` handles L0→L1 sync (effectively "L1: Phase A" — common template script installation). "L1: Phase B" definition is ambiguous — unclear whether it means L1 variant reconcile or L2 project refinement. `propagate-to-templates.ts --docs` injects COMMON markers into L1 variants but is not labeled as "Phase B" anywhere. Flag mapping to Layer/Phase is undocumented.

**scaffolding-expert**: Item 5 (variant creation scripts): Two pathways exist:
- New variant: `new-project.ts` → L2 → `create-l2-scaffold.ts` → `l2-to-variant-pipeline.ts` → L1
- Existing project → variant: `l2-to-variant-pipeline.ts` directly

Wave 1 C-03 fix (conditional overwrite guard) makes `new-project.ts` preserve existing `context.md`. This is correct behavior but undocumented — users needing to force-regenerate must manually delete context.md first. Raised: does `create-l2-scaffold.ts` recognize the new `variant.context.template.md` SSOT?

**docs-writer**: Item 4 (CONSTITUTION.md and `_common` reflection): `_common/context.md` may still have `publish-to-template` references. `CONSTITUTION.md` has no Phase A/B/C definitions. `07-new-project.md` mentions `variant.context.template.md` but main CONSTITUTION.md does not. `docs/constitution/06.5-script-lifecycle.md` propagate lifecycle table is partially updated from Wave 2 but not complete.

**lifecycle-manager**: Phase A/B and Layer L0/L1/L2 are two independent dimensions that are currently conflated in documentation. "L1: Phase A" is ambiguous — does it mean "Phase A work at the L1 layer" or "L1 state after Phase A"? This term confusion is the root of the user's inspection point 2. Also: `06.5-script-lifecycle.md` lifecycle table needs updating for `propagate-to-templates.ts`.

**auditor (Round 1)**: Identified three problem layers:
1. Intentional duplication (acceptable) — context proximity strategy, just needs documentation
2. Terminology confusion (fix needed) — Phase A/B mixed with L0/L1/L2 layering
3. Undocumented changes (fix needed) — CONSTITUTION.md, `_common/context.md`, `06.5-script-lifecycle.md`, `creating-a-variant.md`

---

### Round 2

**architect**: Recommended two concrete solutions:
- Add context-proximity comment to `variant.context.template.md` Agents section
- Separate Phase terminology into two dimensions: Layer (L0/L1/L2) and Stage (Phase A/B/C), add explicit table to CONSTITUTION.md §7 or new §10

**scaffolding-expert**: Confirmed `create-l2-scaffold.ts` uses `generate-variant.ts` as helper, and `generate-variant.ts` was already updated in Wave 1 to reference `variant.context.template.md` — scaffold is working correctly. Also flagged: Wave 1 C-09 fix enforces `co-` prefix on `l2-to-variant-pipeline.ts` variantName, but this constraint is not documented in `docs/creating-a-variant.md`.

**automation-engineer**: Mapped `propagate-to-templates.ts` flags to Layer/Phase:
- `--apply`: L0→L1(common) sync — layer propagation, phase-agnostic
- `--governance-l1`: L0 governance → L1(common) — layer propagation
- `--docs`: L1(common) COMMON markers → L1(co-*) injection — effectively "L1 Phase B preparation"
- `--prune`: cleanup of L0-only orphans from L1
Recommended: add Phase/Layer mapping to each flag's description in SCRIPTS.md or `--help` output.

**docs-writer**: Proposed Layer×Stage matrix for CONSTITUTION.md:

| | Phase A (Scaffold) | Phase B (Refinement) | Phase C (Promotion) |
|---|---|---|---|
| L0 | `create-l2-scaffold.ts` / `new-project.ts` | no changes | `propagate:apply` trigger |
| L1 common | `propagate:apply` installs scripts | `propagate:docs` injects COMMON | — |
| L1 variant | scaffold output created | manual reconcile | — |
| L2 | `new-project.ts` output | customization | `l2-to-variant-pipeline.ts` |

Also proposed: `docs/creating-a-variant.md` needs `co-` prefix constraint + conditional context.md generation behavior documented.

**lifecycle-manager**: Corrected Layer×Stage matrix (swapped L0 script positions), confirmed Wave 3 scope for `06.5-script-lifecycle.md` and `generate-version-manifest.ts` JSDoc fix.

**auditor (Synthesis)**: See below.

---

## Key Findings

### Agreements
1. Agents table duplication in context.md is intentional (context proximity) — needs comment annotation only
2. Phase A/B is an independent dimension from L0/L1/L2 layers — terminology conflation is the core confusion
3. `generate-variant.ts` correctly references `variant.context.template.md` after Wave 1 — no script change needed
4. Wave 1/2 left specific docs unupdated (see action items)
5. `co-` prefix enforcement in `l2-to-variant-pipeline.ts` is undocumented

### Unresolved
- Whether `propagate-to-templates.ts --docs` should be formally labeled "L1 Phase B preparation"
- Actual presence of stale references in `_common/context.md` (needs grep verification)

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | docs-writer | Medium | Add context-proximity comment to `variant.context.template.md` Agents section; add Layer×Stage matrix to `CONSTITUTION.md` §7 | L0-only | Wave 3 |
| B-02 | lifecycle-manager | Low | Fix `06.5-script-lifecycle.md` propagate lifecycle table; fix `generate-version-manifest.ts` JSDoc @version regex (H-01) | L0-only | Wave 3 |
| B-03 | scaffolding-expert | Low | Document `co-` prefix constraint + conditional context.md generation in `docs/creating-a-variant.md` and `07-new-project.md` | L0-only | Wave 3 |
| B-04 | automation-engineer | Low | Add Layer/Phase mapping annotation to each `propagate-to-templates.ts` flag in SCRIPTS.md | L0-only | Wave 3 |
| B-05 | auditor | Low | Grep and fix stale references in `templates/common/docs/_common/context.md` | L0-only | Wave 3 |
