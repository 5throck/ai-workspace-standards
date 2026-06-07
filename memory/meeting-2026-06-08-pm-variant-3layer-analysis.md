# Meeting Transcript
**Date**: 2026-06-08
**Topic**: pm.md variant characteristics not reflected — comprehensive 3-layer root cause analysis (Role, Workflow, Frontmatter)
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]** (Round 1)

The problem exists across three distinct layers:

**Layer 1 — Body section problem**: Already diagnosed in the previous meeting. `## Role`, `## ⚠️ ROLE CLARIFICATION`, and `## 🚨 YOU ARE THE SINGLE ENTRY POINT` are not in `remove_sections`. Variant sections are appended to the end instead of prepended.

**Layer 2 — Frontmatter problem**: `description: 'Orchestrates Phases 0, 2, 5, 6'` and `examples` are L0 frontmatter values. The L2 file only contains `variant_overrides` and has no `description` or `examples` keys, so the L0 skeleton values remain unchanged. `variant_overrides` has no mechanism to override top-level frontmatter fields.

**Layer 3 — Constraints internal hardcoding**: `## Constraints` section contains a Phase Determination table referencing L0 agents (architect, automation-engineer, etc.). This is not in `remove_sections` so L0 content survives.

Proposed approach: Address the three layers separately:
- Layer 1: Expand `remove_sections` + prepend (immediate)
- Layer 2: Add `frontmatter_overrides` support to `variant_overrides` (immediate)
- Layer 3: Requires refactoring L0 `agents/pm.md` `- **Phase Determination...**:` bullet → `### Phase Determination` heading (separate issue)

---

**[automation-engineer]** (Round 1)

Confirmed Layer 3 root cause: The `- **Phase Determination (Deliverable-Type Gate)**:` in L0 `agents/pm.md` is a **bold bullet list item**, not a markdown heading. Therefore, `removeSections()` cannot detect or remove it. The `"### Phase Determination (Deliverable-Type Gate)"` entry in `remove_sections` is currently **ineffective**.

Layer 2 implementation via `frontmatter_overrides`:
```yaml
variant_overrides:
  frontmatter_overrides:
    description: "PM orchestrator for co-develop. Full workflow Phase 0-6."
    examples:
      - user: "Start feature implementation"
        assistant: "I'll triage and dispatch architect + code-writer"
```
In `merge-frontmatter.ts`, after merging, lift `frontmatter_overrides` keys to top-level frontmatter.

Priority order: Layer 1 + Layer 2 immediately; Layer 3 as separate refactoring issue.

---

**[auditor]** (Round 1)

Verified automation-engineer's finding: line 165 of L0 `agents/pm.md`:
```
- **Phase Determination (Deliverable-Type Gate)**:
```
No `##` prefix. The `remove_sections` entry `"### Phase Determination (Deliverable-Type Gate)"` is **non-functional**.

Impact ranking on AI behavior:
1. 🔴 CRITICAL: `## Role` section says "ai-workspace-standards repository PM" — AI misidentifies itself as workspace root PM
2. 🟠 HIGH: `description` frontmatter "Orchestrates Phases 0, 2, 5, 6" contradicts co-develop's all-phases workflow
3. 🟡 MEDIUM: `## Constraints` Phase table references L0 agents

`examples` frontmatter is also important — AI tools use it for agent identification. "Phase 0 (Team Assembly) and Phase 2 (Design approval)" contradicts co-develop's all-phases workflow.

---

**[architect]** (Round 2)

Final solution architecture:

**Immediate (this PR)**:
1. `merge-frontmatter.ts` v1.4.0:
   - Add `## Role`, `## ⚠️ ROLE CLARIFICATION`, `## 🚨 YOU ARE THE SINGLE ENTRY POINT` to matched sections
   - Rename `## Updated Role` → `## Role` in `injectVariantSections()`
   - Change injection from append to **prepend**
   - Add `frontmatter_overrides` support

2. L2 templates (5 files):
   - `updated_role` → `role`
   - Add `frontmatter_overrides.description`, `frontmatter_overrides.examples`

3. `templates/common/agents/pm.md`: add 3 sections to `remove_sections`

**Medium-term (separate issue)**:
- Refactor L0 `agents/pm.md` `- **Phase Determination...**:` bullet → `### Phase Determination` heading

---

**[automation-engineer]** (Round 2)

Concrete code plan for `merge-frontmatter.ts` v1.4.0:

```typescript
// injectVariantSections(): ## Updated Role → ## Role, return prepend-ready string
// processFile(): finalContent = injected + finalContent  (prepend)

// frontmatter_overrides processing (new):
const frontmatterOverrides = mergedFrontmatter.variant_overrides?.frontmatter_overrides;
if (frontmatterOverrides) {
  for (const [key, value] of Object.entries(frontmatterOverrides)) {
    mergedFrontmatter[key] = value;
  }
  delete mergedFrontmatter.variant_overrides.frontmatter_overrides;
}
```

---

**[auditor]** (Synthesis)

**3-Layer Root Cause Summary**:

| Layer | Problem | Root Cause | Impact |
|-------|---------|-----------|--------|
| Body - Role section | L0 "ai-workspace-standards" text remains | `## Role` not in `remove_sections` | 🔴 Critical |
| Frontmatter description/examples | L0 "Phases 0, 2, 5, 6" values remain | No frontmatter override support in `variant_overrides` | 🟠 High |
| Body - Constraints Phase table | L0 agent/phase mapping remains | Bold bullet, not heading — `removeSections()` cannot detect | 🟡 Medium |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | `templates/common/agents/pm.md` — add `## Role`, `## ⚠️ ROLE CLARIFICATION`, `## 🚨 YOU ARE THE SINGLE ENTRY POINT` to `remove_sections` | Both | Phase 4 |
| A-02 | automation-engineer | Low | `merge-frontmatter.ts` v1.4.0 — ① rename `## Updated Role` → `## Role` ② prepend injection ③ add `frontmatter_overrides` support | Both | Phase 4 |
| A-03 | automation-engineer | Low | 5 L2 variant pm.md files — rename `updated_role` → `role`, add `frontmatter_overrides.description`/`examples` | Both | Phase 4 |
| A-04 | automation-engineer | Low | SCRIPTS.md version bump + common sync | Both | Phase 4 |
| A-05 | lifecycle-manager | Medium | CHANGELOG.md + memory log update | L0-only | Phase 5 |
| B-01 | architect | High | Refactor L0 `agents/pm.md` — `- **Phase Determination...**:` bullet → `### Phase Determination` heading (separate issue) | Both | Phase 1-2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------| 
| AC-1 | First `##` section in generated pm.md is `## Role` containing "PM orchestrator for co-develop" | `head -90 test-co-develop/agents/pm.md \| grep "## Role"` |
| AC-2 | Frontmatter `description` contains "co-develop" or "Phase 0-6" | `head -20 test-co-develop/agents/pm.md \| grep "co-develop"` |
| AC-3 | "ai-workspace-standards" and "workspace root" absent from body | `grep "ai-workspace-standards" test-co-develop/agents/pm.md` → empty |
| AC-4 | `bun scripts/audit.ts` passes | exit 0 |
