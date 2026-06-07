# Meeting Transcript
**Date**: 2026-06-08
**Topic**: pm.md variant section injection — root cause analysis and fix direction
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]** (Round 1)

The core issue stems from a structural misunderstanding of the inheritance architecture. The L2 template (`templates/co-develop/agents/pm.md`) is a pure YAML frontmatter file with no body content. `merge-frontmatter.ts` uses the skeleton (L0 `agents/pm.md`) body when the variant body is empty. As a result, L0's `## Role` section — "You are the PM orchestrator for the **ai-workspace-standards repository**" — is copied verbatim into the variant file.

The `injectVariantSections()` approach of appending sections to the end is fundamentally flawed because L0-specific sections like `## Role` (not in `remove_sections`) remain at the top of the body.

Two solution options:
- **Option A (quick fix)**: Add `## Role` to `remove_sections`, rename the injected section from `## Updated Role` to `## Role`, and prepend instead of append.
- **Option B (structural)**: Write actual variant body content in L2 templates. This is the original ADR-0033 intent but introduces DRY violations since `variant_overrides` YAML already serves as SSOT.

---

**[automation-engineer]** (Round 1)

Confirmed the root cause by tracing the code path:

```typescript
const useCurrentContent = parsed.content.trim().length > 0;
let finalContent = useCurrentContent ? parsed.content : skeletonResolved.content;
```

Since L2 body is empty, `useCurrentContent = false`, so L0 full body is used. After `removeSections()` strips 5 sections, `injectVariantSections()` appends variant content at the end. The resulting structure is:

```
[L0 ## Role - "ai-workspace-standards" text]  ← NOT removed
[L0 ## ⚠️ ROLE CLARIFICATION]
[L0 ## 🚨 YOU ARE THE SINGLE ENTRY POINT]
... (other L0 sections)
[variant ## Updated Role]  ← appended at end
[variant ## Governance Workflow]
[variant ## Agent Roster]
[variant ## Dispatch Protocol]
```

Option A implementation difficulty: Very Low. Add `## Role` to `remove_sections` in L1, rename generated section to `## Role`, prepend variant sections instead of append.

Option B implementation difficulty: Medium. Requires writing variant-specific body in 5 L2 template files, violating DRY.

**Recommendation**: Option A immediately, with long-term `variant_overrides` schema extension.

---

**[auditor]** (Round 1)

The `## Role` section content "You are the PM orchestrator for the **ai-workspace-standards repository**" is a clear L0-specific identifier — this is L0 Leakage. `audit.ts` has an `L0 Leakage check` but it does not inspect `agents/pm.md` body content.

Additional discovery: `## ⚠️ ROLE CLARIFICATION` and `## 🚨 YOU ARE THE SINGLE ENTRY POINT` also contain L0-specific content ("ai-workspace-standards", "your domain is maintaining cross-platform template scripts"). These must also be added to `remove_sections`.

Conclusion: Option A + expanded `remove_sections` is correct.

---

**[architect]** (Round 2)

Full updated remove/inject list:

**Sections to remove** (expanded `remove_sections`):
```yaml
remove_sections:
  - "## Role"                                # NEW
  - "## ⚠️ ROLE CLARIFICATION"              # NEW
  - "## 🚨 YOU ARE THE SINGLE ENTRY POINT"  # NEW (emoji prefix matching)
  - "## Governance Workflow"                 # existing
  - "## Updated Role"                        # existing
  - "## Agent Roster"                        # existing
  - "## Dispatch Protocol"                   # existing
  - "### Phase Determination (Deliverable-Type Gate)"  # existing
```

**Section injection change**: `## Updated Role` → `## Role`, injected at **beginning** of content (prepend), not end.

---

**[automation-engineer]** (Round 2)

Concrete code changes:

1. `templates/common/agents/pm.md` — add 3 entries to `remove_sections`
2. `scripts/helpers/merge-frontmatter.ts` v1.4.0:
   - Rename `## Updated Role` → `## Role` in `injectVariantSections()`
   - Change injection position: `content + injected` → `injected + content` (prepend)
3. Each L2 variant pm.md: rename `updated_role` key → `role` in `variant_overrides`
4. SCRIPTS.md version bump + common sync

---

**[auditor]** (Synthesis)

**Root Cause**: `remove_sections` does not include `## Role`, `## ⚠️ ROLE CLARIFICATION`, and `## 🚨 YOU ARE THE SINGLE ENTRY POINT` — three L0-specific sections that remain in variant pm.md body. Additionally, variant sections are appended at the end, making L0 Role effectively primary.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Add `## Role`, `## ⚠️ ROLE CLARIFICATION`, `## 🚨 YOU ARE THE SINGLE ENTRY POINT` to `remove_sections` in `templates/common/agents/pm.md` | Both | Phase 4 |
| A-02 | automation-engineer | Low | `merge-frontmatter.ts` v1.4.0 — rename `## Updated Role` → `## Role`, change injection to prepend | Both | Phase 4 |
| A-03 | automation-engineer | Low | Rename `updated_role` → `role` in `variant_overrides` for all 5 L2 variant pm.md templates | Both | Phase 4 |
| A-04 | automation-engineer | Low | SCRIPTS.md version bump, common sync | Both | Phase 4 |
| A-05 | lifecycle-manager | Medium | CHANGELOG.md update, memory log | L0-only | Phase 5 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------| 
| AC-1 | Generated `agents/pm.md` `## Role` section contains "PM orchestrator for co-develop project" | `grep "co-develop" test-co-develop/agents/pm.md` |
| AC-2 | "ai-workspace-standards" and "workspace root" strings absent from body | `grep "ai-workspace-standards" test-co-develop/agents/pm.md` → empty |
| AC-3 | `bun scripts/audit.ts` passes | exit 0 |
