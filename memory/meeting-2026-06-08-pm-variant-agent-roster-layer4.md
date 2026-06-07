# Meeting Transcript
**Date**: 2026-06-08
**Topic**: pm.md agent roster not reflected — Layer 4 discovery: L0 agent references scattered throughout body and Agent Roster misplacement
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context (Pre-Meeting Data)

From scaffolding test of `test-co-develop --variant co-develop`:

- `## Agent Roster` located at **line 365 of 379** (file end)
- co-develop agents (`designer`, `code-writer`, `test-runner`) only appear in frontmatter YAML (lines 48-76) and file-end sections
- L0 agents scattered throughout body:
  - Line 106: "All specialist agents (architect, automation-engineer, security-expert, scaffolding-expert, docs-writer, auditor)"
  - Line 175: "dispatching automation-engineer for script modifications"
  - Lines 192-195: Phase table — `automation-engineer`, `docs-writer`, `security-expert`, `scaffolding-expert`
  - Lines 246-248: Execution Plan examples — `docs-writer`, `lifecycle-manager`, `auditor`
  - Lines 302-305: Direct execution prohibition list — `docs-writer`, `automation-engineer`, `auditor`
  - Lines 345-350: Korean example — `docs-writer`

---

## Transcript

**[architect]** (Round 1)

This is **Layer 4**, completely missed in the two previous meetings.

**Layer 4A — `## Agent Roster` placement**: Located at line 365 of 379 lines (file end). AI tools prioritize content at the beginning of context. co-develop agents at the end will be effectively ignored in favor of L0 agents mentioned earlier.

**Layer 4B — Body-wide L0 agent references**: The following sections contain L0-specific agent names:
- `## ⚠️ ROLE CLARIFICATION` (planned for removal) — contains L0 agent list
- `## Constraints` interior — "automation-engineer", "docs-writer", "scaffolding-expert", "security-expert"
- `## Execution Plan Boilerplate Policy` examples — "docs-writer", "lifecycle-manager", "auditor"
- `## ⚠️ CRITICAL: PM Direct Execution Constraints` — "docs-writer", "automation-engineer", "auditor"
- `## User Communication for Specialist Tasks` — "docs-writer" example

**Structural conclusion**: L0 `agents/pm.md` hard-codes L0 agent names throughout the body. The "remove + inject" pattern cannot fundamentally solve this without removing almost all content. Root fix requires making L0 `agents/pm.md` variant-agnostic (placeholder substitution).

---

**[automation-engineer]** (Round 1)

| Section | L0 agent references | Removable? |
|---------|---------------------|------------|
| `## ⚠️ ROLE CLARIFICATION` | "docs-writer", "architect" | ✅ (planned for removal) |
| `## Constraints` Phase table | `automation-engineer`, `docs-writer`, `security-expert`, `scaffolding-expert` | ❌ bold bullet, not heading |
| `### Examples` (Execution Plan) | `docs-writer`, `lifecycle-manager`, `auditor` | ⚠️ removing would lose boilerplate |
| `## ⚠️ CRITICAL: PM Direct Execution Constraints` | `docs-writer`, `automation-engineer`, `auditor` | ⚠️ content needed, only agent names wrong |
| `## User Communication for Specialist Tasks` | `docs-writer` | ⚠️ generic-izable |

Key finding: `## ⚠️ CRITICAL` and `## User Communication` contain **necessary rules** for variant PM, but with L0-specific agent names. Removing entire sections loses critical governance rules.

Recommendation: Remove `## ⚠️ CRITICAL: PM Direct Execution Constraints`, regenerate it with variant agent names from `agent_roster`. Leave `## Execution Plan Boilerplate Policy` and `## User Communication` for mid-term L0 refactoring.

---

**[auditor]** (Round 1)

AI behavior impact assessment:

1. `## Role` (line 81): "ai-workspace-standards repository PM" → AI self-identifies as workspace PM 🔴
2. `## ⚠️ ROLE CLARIFICATION` (line 85): "(architect, automation-engineer, security-expert, scaffolding-expert, docs-writer, auditor) are forbidden..." → AI treats these as valid agents 🔴
3. `## Constraints` (line 167): Phase table with `automation-engineer`, `docs-writer` as phase owners 🟠
4. `### Examples` (line 240): Execution Plan with `docs-writer`, `lifecycle-manager`, `auditor` 🟡
5. `## Agent Roster` (line 365): co-develop agents defined but at file END 🟡

AI will likely learn the first agent list (line 85) as the effective roster, treating the `## Agent Roster` at line 365 as supplementary.

---

**[architect]** (Round 2)

3-tier solution strategy:

**Immediate (this PR)**:
- Add to `remove_sections`: `## Role`, `## ⚠️ ROLE CLARIFICATION`, `## 🚨 YOU ARE THE SINGLE ENTRY POINT`, `## ⚠️ CRITICAL: PM Direct Execution Constraints`
- `injectVariantSections()`: prepend all variant sections; regenerate `## ⚠️ CRITICAL` with variant roster agents

**Medium-term (separate issue)**:
- L0 `agents/pm.md`: `- **Phase Determination...**:` bullet → `### Phase Determination` heading
- L0 `agents/pm.md`: `### Examples` and `## User Communication` agent names → `[specialist]` placeholders

**Long-term**:
- `variant_overrides.constraints.allowed_agents` key for dynamic body text substitution

---

**[automation-engineer]** (Round 2)

Final short-term `remove_sections` additions:
```yaml
- "## Role"
- "## ⚠️ ROLE CLARIFICATION"
- "## 🚨 YOU ARE THE SINGLE ENTRY POINT"
- "## Governance Workflow"
- "## Updated Role"
- "## Agent Roster"
- "## Dispatch Protocol"
- "## ⚠️ CRITICAL: PM Direct Execution Constraints"
```

`## Execution Plan Boilerplate Policy` and `## User Communication for Specialist Tasks` — defer to mid-term L0 refactoring (too risky to remove entire sections).

---

**[auditor]** (Synthesis)

**Complete 4-Layer Problem Map**:

| Layer | Problem | Location | Short-term | Mid-term |
|-------|---------|----------|------------|----------|
| L1 | `## Role` L0 text | line 81 | `remove_sections` + prepend inject | — |
| L2 | frontmatter `description`/`examples` L0 values | frontmatter | `frontmatter_overrides` support | — |
| L3 | `## Constraints` Phase table L0 agents | lines 167-197 | — (bold bullet, undetectable) | L0 refactoring |
| L4A | `## Agent Roster` at file end | line 365/379 | prepend variant sections | — |
| L4B | Body-wide L0 agent references | lines 85,106,175,192,246,302,345 | Remove `## ⚠️ ROLE CLARIFICATION`, `## ⚠️ CRITICAL` + regenerate | L0 placeholder refactoring |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | `templates/common/agents/pm.md` — add `## Role`, `## ⚠️ ROLE CLARIFICATION`, `## 🚨 YOU ARE THE SINGLE ENTRY POINT`, `## ⚠️ CRITICAL: PM Direct Execution Constraints` to `remove_sections` | Both | Phase 4 |
| A-02 | automation-engineer | Low | `merge-frontmatter.ts` v1.4.0 — ① prepend inject ② generate `## Role` ③ place `## Agent Roster` at front ④ regenerate `## ⚠️ CRITICAL` with variant agents ⑤ `frontmatter_overrides` support | Both | Phase 4 |
| A-03 | automation-engineer | Low | 5 L2 variant pm.md files — `updated_role` → `role`, add `frontmatter_overrides` | Both | Phase 4 |
| A-04 | automation-engineer | Low | SCRIPTS.md version bump + common sync | Both | Phase 4 |
| A-05 | lifecycle-manager | Medium | CHANGELOG.md + memory log | L0-only | Phase 5 |
| B-01 | architect | High | L0 `agents/pm.md` — Phase Determination bullet → heading refactoring | Both | Phase 1-2 |
| B-02 | architect | High | L0 `agents/pm.md` — `### Examples`, `## User Communication` agent names → `[specialist]` placeholders | Both | Phase 1-2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------| 
| AC-1 | First `##` section is `## Role` containing "co-develop" | `head -10 agents/pm.md \| grep "co-develop"` |
| AC-2 | `## Agent Roster` in first 100 lines | `grep -n "## Agent Roster" agents/pm.md` → < 100 |
| AC-3 | Minimal L0 agent references in body | `grep "docs-writer\|automation-engineer\|scaffolding-expert" agents/pm.md` → minimal |
| AC-4 | frontmatter `description` contains "co-develop" | check frontmatter |
| AC-5 | `bun scripts/audit.ts` passes | exit 0 |
