# Meeting Transcript
**Date**: 2026-06-12
**Topic**: Post-implementation consistency review — variant.context.template.md duplication, Phase A/B design docs, deployment scripts, CONSTITUTION currency, variant creation scripts
**Participants**: architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: (Round 1)

The most notable finding from the pre-scan is the gap in Area 3 and Area 5. The fact that `generateContextMd()` in `generate-variant.ts` is not called by `new-project.ts` is a structural defect. Since `templates/co-*/docs/<variant>.context.md` files are currently statically managed and `new-project.ts` copies them as-is, the SSOT intent of `variant.context.template.md` is only half-realized.

Second, Area 2 is noteworthy. The user mentioned "L1 Phase A / Phase B" but this terminology does not exist in design documents. This likely refers to the ADR-0033 `@extends` pattern (L1-A = common scaffold inheritance, L1-B = variant-specific override), but the distinction is not explicitly defined in any ADR or CONSTITUTION. The code was implemented without the terminology being formalized.

Area 4 is also critical. If `docs/constitution/07-new-project.md` and `CONSTITUTION.md` contain no mention of VARIANT-INJECT markers or `variant.context.template.md`, a new contributor has no way to discover this SSOT structure.

Core proposals: (1) Formalize Phase A/B terminology in an ADR or unify with existing numbered phases. (2) Add `generateContextMd()` call to `new-project.ts`. (3) Update `docs/constitution/07-new-project.md`.

---

**docs-writer**: (Round 1)

I agree with architect's Area 3/5 gap identification. However, I want to revisit the "no duplication" verdict on Area 1 — the scan only compared at heading level. In practice, the Agents table in `co-develop.context.md` contains Role descriptions for each agent, and the same project's `agents/pm.md` and workspace `AGENTS.md` also define Roles. There is no structural duplication, but semantic overlap exists.

More importantly, `templates/common/docs/_common/context.md` is 11KB, which means it contains substantial content. Its relationship to `variant.context.template.md` is unclear. The roles of both files — `context.md` as L2 project common context vs `variant.context.template.md` as variant overlay template — must be stated in CONSTITUTION.

On Area 2: the user's "L1 Phase A / Phase B" may actually refer to the execution stages of `l2-to-variant-pipeline.ts`. If this pipeline is not documented stage-by-stage, operators cannot understand the pipeline state.

Core proposals: (1) Define `context.md` vs `variant.context.template.md` roles in CONSTITUTION. (2) Document Agents table semantic overlap policy as "context proximity" principle. (3) Document `l2-to-variant-pipeline.ts` stages.

---

**auditor**: (Round 1)

Synthesizing both analyses: three independent problem groups.

**Problem Group 1 — Undefined Terminology (Design Docs)**: "L1 Phase A/B" terminology exists only in user conversation, not in any ADR or CONSTITUTION. Alignment with ADR-0031 and ADR-0033 terminology is needed.

**Problem Group 2 — SSOT Pipeline Gap (Scripts)**: `new-project.ts` does not call `generateContextMd()`, so variant context.md is not dynamically generated from the template during project creation. Secondary gap: `audit.ts`'s `checkVariantContextGuidelinesSection()` validates L1 templates but not L2 generated projects.

**Problem Group 3 — Documentation Not Updated (CONSTITUTION, _common/)**: VARIANT-INJECT pattern and `variant.context.template.md` are not registered in official governance documents, making them undiscoverable.

Priority: Problem Group 2 is most urgent (functional defect). Problem Groups 1 and 3 are documentation alignment issues.

---

### Round 2

**architect**: (Round 2)

Two approaches for adding `generateContextMd()` to `new-project.ts`: (a) `new-project.ts` directly imports and calls the function from `generate-variant.ts`; (b) `new-project.ts` copies context.md from templates then performs placeholder substitution. Recommendation: (a) — the SSOT pipeline concentrates in a single function.

Caveat: when `new-project.ts` calls `generateContextMd()`, it must inject project-specific values. Need to verify whether `generateContextMd()`'s placeholder substitution is currently hardcoded (e.g., `version: '1.0'`).

For Problem Group 1: using existing ADR terminology is better than defining new Phase A/B terms. ADR-0031's fork model stages — L0 (workspace SSOT) → L1 (templates/common) → L2 (generated project) — are canonical. The pm.md `@extends` pattern should be described as "L1 scaffold inheritance."

For Problem Group 3: adding one section to `docs/constitution/07-new-project.md` covering `variant.context.template.md` path and VARIANT-INJECT governance is the minimum unit of change.

---

**docs-writer**: (Round 2)

When `new-project.ts` calls `generateContextMd()`, the current passed values are insufficient. `{{VARIANT_NAME}}` must be substituted with the variant type (co-develop, co-consult, etc.) and `{{PM_ROLE_DESCRIPTION}}` should be read from each variant's pm.md. The current `generate-variant.ts` implementation's handling of these values needs review before integration.

On semantic overlap: the Agents table in variant context.md files exists for "context proximity" — fast reference in AI context windows. This principle from CLAUDE.md §9 should be documented in the context.md header comment to make the duplication policy self-documenting.

On role clarification: `templates/common/docs/_common/context.md` is the L2 project identity document (architecture, immutable standards); `variant.context.template.md` is the variant overlay template (L2 variant-specific customization layer). The distinction is already in the `co-consult.context.md` header read order — adding this pattern to CONSTITUTION is sufficient.

---

**auditor**: (Synthesis)

**Points of Agreement**:
1. Problem Group 2 (script gap) is most urgent — `new-project.ts` does not call `generateContextMd()`
2. "L1 Phase A/B" terminology has no official ADR definition — unify with existing L0/L1/L2 layer terminology
3. `variant.context.template.md` and VARIANT-INJECT governance are not registered in CONSTITUTION
4. `context.md` vs `variant.context.template.md` role distinction must be added to CONSTITUTION
5. Agents table semantic overlap is permitted under "context proximity" policy — add self-documenting comment

**Open Issue**: Whether `generateContextMd()` currently hardcodes placeholder values — must verify before `new-project.ts` integration.

**Platform Parity**: A-01 touches `scripts/new-project.ts` (L0), requiring L1 sync. A-02~A-04 are L0-only. No platform file changes.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | Add `generateContextMd()` call to `new-project.ts` + L1 sync | L0+L1 | Immediate |
| A-02 | docs-writer | Low | Add `variant.context.template.md` + VARIANT-INJECT section to `docs/constitution/07-new-project.md` | L0-only | Immediate |
| A-03 | docs-writer | Low | Add `context.md` vs `variant.context.template.md` role distinction to CONSTITUTION.md | L0-only | Immediate |
| A-04 | docs-writer | Low | Add "context proximity" comment to Agents table in all 5 variant context.md files | L0-only | After A-02 |
| A-05 | automation-engineer | Low | Verify `generateContextMd()` placeholder hardcoding + design dynamic value injection | L0-only | Before A-01 |
| N-1 | lifecycle-manager | Medium | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | L0+L1 | End |
| N | auditor | Medium | Final QA Audit (`bun scripts/audit.ts`) | L0+L1 | End |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | L2 project context.md generated dynamically from `variant.context.template.md` | Create project, verify VARIANT-INJECT markers present |
| C-02 | `docs/constitution/07-new-project.md` contains VARIANT-INJECT section | grep "VARIANT-INJECT" docs/constitution/07-new-project.md |
| C-03 | CONSTITUTION.md explicitly states context.md vs variant.context.template.md roles | File read verification |
| C-04 | `bun scripts/audit.ts` passes | exit 0 |
