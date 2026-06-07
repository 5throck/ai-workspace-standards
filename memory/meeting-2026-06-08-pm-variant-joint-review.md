# Meeting Transcript
**Date**: 2026-06-08
**Topic**: Joint Review Meeting: pm.md variant characteristics not reflected — Comprehensive 4-layer root cause & final action plan
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]** (Round 1)
We have met to synthesize all findings from prior sessions and establish a final, production-ready design to solve the "pm.md variant characteristic omission" issue.
Our goal is to ensure that when a new variant project is scaffolded, the generated `agents/pm.md` strictly adheres to that variant's context (role, workflow, agents, and constraints) and contains absolutely no leakage from the workspace root (L0) definitions.

To summarize the problem landscape, we have identified 4 layers of failure:
1. **Layer 1 — Body/Role leakage**: The L0 base text references "ai-workspace-standards" and workspace root domains. If not removed, the variant PM acts as if it is the root workspace PM.
2. **Layer 2 — Frontmatter stagnation**: Top-level frontmatter variables (e.g. `description`, `examples`) are not overridden by `variant_overrides` structure.
3. **Layer 3 — Constraints parsing failure**: The section containing Phase Determination is a bold bullet (`- **Phase Determination (Deliverable-Type Gate)**:`), which `removeSections()` ignores because it only searches for `#` headings.
4. **Layer 4 — Agent Roster misplacement & leakage**: `## Agent Roster` is appended at the very end of the file. Meanwhile, L0 agent names (`docs-writer`, `automation-engineer`, etc.) remain hard-coded in early body sections (`ROLE CLARIFICATION`, `⚠️ CRITICAL`, `Boilerplate examples`).

I propose the following architecture:
- **Immediate (this PR)**:
  1. Upgrade `merge-frontmatter.ts` to v1.4.0. It will support a new `frontmatter_overrides` section under `variant_overrides` to dynamically replace top-level frontmatter keys.
  2. Implement a layout restructuring in `merge-frontmatter.ts`. Instead of appending variant sections, we will restructure the generated document layout so that:
     - `## Role` (templated from `variant_overrides.role`) and `## Agent Roster` (constructed from `variant_overrides.agent_roster`) are injected at the *very top* of the document.
     - A dynamically reconstructed `## ⚠️ CRITICAL: PM Direct Execution Constraints` is generated based on the variant's active agent list and placed right after the roster.
  3. Expand `remove_sections` in `templates/common/agents/pm.md` to prune all L0-specific sections.
  4. Explicitly rewrite the bold bullet in L0 `agents/pm.md` to a proper `### Phase Determination (Deliverable-Type Gate)` heading so that the parser can clean it up.

---

**[automation-engineer]** (Round 1)
I fully agree with the proposed architecture. Let's trace how `merge-frontmatter.ts` v1.4.0 will process this.

For Layer 2, in `processFile()`:
```typescript
const frontmatterOverrides = mergedFrontmatter.variant_overrides?.frontmatter_overrides;
if (frontmatterOverrides) {
  for (const [key, value] of Object.entries(frontmatterOverrides)) {
    mergedFrontmatter[key] = value;
  }
  delete mergedFrontmatter.variant_overrides.frontmatter_overrides;
}
```
This cleanly lifts any nested overrides to the root of the frontmatter.

For Layer 4 (Layout & Injection):
We will update `injectVariantSections()` to return an object of generated sections rather than a single appended string:
```typescript
interface InjectedSections {
  roleSection: string;
  rosterSection: string;
  constraintsSection: string;
  workflowSection?: string;
  protocolSection?: string;
}
```
We will then assemble the final markdown by prepending the critical context (Role, Roster, Constraints) at the beginning, followed by the cleaned L0 base body.
Specifically, for the constraints section, we will map the variant's agent roster to the direct execution restrictions. For example, if the roster defines `code-writer`, `designer`, `test-runner`, the generated direct execution constraints will explicitly command:
"All file modifications MUST be dispatched to: **code-writer** (implementation), **designer** (design), **test-runner** (QA)."

This completely removes the hard-coded L0 agent names (`automation-engineer`, `docs-writer`) from the constraints.

---

**[auditor]** (Round 1)
This is a highly robust solution. I want to highlight the QA and verification aspect of this plan.
If we prepend `## Role`, `## Agent Roster`, and the regenerated `## ⚠️ CRITICAL: PM Direct Execution Constraints`, and then clean up L0's `ROLE CLARIFICATION` and old constraints, the resulting `pm.md` will look clean and well-structured.

Let's double-check the other variants (e.g., `co-design`, `co-consult`, `co-research`, `co-write`).
We must ensure that:
1. All variant pm.md files (`templates/co-*/agents/pm.md`) are updated to the new YAML schema, converting `updated_role` to `role` and adding `frontmatter_overrides`.
2. The L1 common template `templates/common/agents/pm.md` lists the exact sections to be removed.
3. The L0 `agents/pm.md` file is refactored so that `- **Phase Determination (Deliverable-Type Gate)**:` becomes `### Phase Determination (Deliverable-Type Gate)`.

I also recommend adding template validation assertions in `scripts/validate-templates.ts` to ensure that:
- Any variant `pm.md` does NOT contain L0 agent names in the body.
- The `description` frontmatter field is appropriately overridden and does not contain L0's default "Orchestrates Phases 0, 2, 5, 6" description.

This will act as our regression gate to ensure this issue never reoccurs.

---

**[architect]** (Round 2)
Excellent points. Let's detail the exact additions to `templates/common/agents/pm.md` `remove_sections`:
```yaml
remove_sections:
  - "## Role"
  - "## ⚠️ ROLE CLARIFICATION"
  - "## 🚨 YOU ARE THE SINGLE ENTRY POINT"
  - "## Governance Workflow"
  - "## Updated Role"
  - "## Agent Roster"
  - "## Dispatch Protocol"
  - "## ⚠️ CRITICAL: PM Direct Execution Constraints"
  - "### Phase Determination (Deliverable-Type Gate)"
```
By adding these, we strip out the entire top portion of L0 `pm.md` containing L0 roles, L0 roster, and L0 execution constraints, leaving only general-purpose sections like `## Consensus-Driven Facilitation Model`, `## Permission Denial Protocol`, and `## Execution Plan Boilerplate Policy`.

Then, we inject our restructured, variant-specific sections. The final generated file will flow logically:
1. `## Role` (Variant-specific)
2. `## Agent Roster` (Variant-specific)
3. `## ⚠️ CRITICAL: PM Direct Execution Constraints` (Variant-specific, regenerated)
4. [L0 Base Content - Consensus-Driven Model, Denial Protocol, Boilerplate Policy]
5. `## Governance Workflow` (Variant-specific, injected at end or after Roster)
6. `## Dispatch Protocol` (Variant-specific, injected at end)

This is a clean, logical flow. Let's proceed with this design.

---

**[automation-engineer]** (Round 2)
I will prepare the changes to `merge-frontmatter.ts` v1.4.0.
I will also update all 5 variant `pm.md` files:
- `templates/co-develop/agents/pm.md`
- `templates/co-design/agents/pm.md`
- `templates/co-consult/agents/pm.md`
- `templates/co-research/agents/pm.md`
- `templates/co-write/agents/pm.md`

Let's make sure the lifecycle update registers the bumps for `merge-frontmatter.ts` and template updates, and then runs the auditor to verify.

---

**[auditor]** (Synthesis)
We have a consensus. The joint analysis is complete and we have addressed all 4 layers plus validation.

### Joint Review Summary

| Layer | Issue | Root Cause | Resolution |
|---|---|---|---|
| **L1 (Role)** | L0 workspace root PM role remains | L0 role headers not in `remove_sections` | Add to `remove_sections`, inject variant role |
| **L2 (Frontmatter)** | `description`/`examples` remain L0 | `variant_overrides` doesn't lift top-level keys | Support `frontmatter_overrides` in `merge-frontmatter.ts` |
| **L3 (Workflow)** | Phase Determination has L0 agents | Bold bullet not heading, skipped by parser | Change bullet to `### Phase Determination` in L0 |
| **L4A (Roster placement)** | `## Agent Roster` at end of file | `injectVariantSections()` appends sections | Restructure layout: prepend role & roster at top |
| **L4B (L0 Agent Leakage)** | Body contains L0 agent names | `⚠️ CRITICAL` and `ROLE CLARIFICATION` are static | Remove L0 sections, dynamically generate variant `## ⚠️ CRITICAL` |

We are ready to translate this plan into immediate execution tasks.
```

**[PM - Facilitator]**: 회의를 종료합니다. 최종 검토와 동의가 완료되었습니다. 본 계획을 실행 단계로 전환합니다.

---
