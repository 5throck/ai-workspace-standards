# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Workspace root vs template structural divergence — systematic management of dual skill/agent configurations
**Participants**: architect, lifecycle-manager, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Continuation of**: meeting-2026-06-01-skills-scripts-impact.md

---

## Context

Third meeting in the auditor/lifecycle-manager removal series. Previous meetings covered:
1. Agent-level decisions (removal, isolation strategy)
2. Skills and scripts impact (owner reassignment, upgrade-project changes)

This meeting addresses the deeper architectural question: how to systematically manage the structural divergence between workspace root (L0) and template projects (L1/L2) after the changes.

---

## Key Findings at Meeting Start

- Workspace root `skills/` and `templates/common/skills/` have IDENTICAL owner distributions — both contain `owner: auditor`, `owner: security-expert`, etc.
- But agent lists differ: workspace root has 8 agents, templates/common has 4
- `.claude/skills/` vs `templates/common/.claude/skills/`: all 11 skills differ (owner field missing in template versions)
- Scripts have a `layer` system (L0-only/common/L1-only via SCRIPTS.md) — skills have no equivalent
- `validate-templates.ts` has a forbidden files blocklist for common/ but no skill-owner validation
- `skill-lifecycle-audit.ts` treats owner mismatch as a hard FAIL (orphan error)

---

## Transcript

### architect (Round 1)

Framed the core issue: this is not a file removal problem but a structural duality problem — the same skill needs different configurations depending on context. Demonstrated that workspace root and templates/common have identical skill owner distributions despite having different agent sets. The `.claude/skills/` vs `templates/common/.claude/skills/` comparison shows owner fields differ across all 11 skills. Scripts have a proven layer system (SCRIPTS.md layer column + lifecycle-sync-audit.ts); skills have no equivalent. The fundamental question: which of the three skill layers (root skills/, templates/common/skills/, .claude/skills/) needs to change, and how?

### lifecycle-manager (Round 1)

Identified the management system's fundamental gap: the layer concept exists for scripts but not for skills. As a result, there is no automated mechanism to detect that `audit-workspace`'s `owner: auditor` is invalid in variant project context. `validate-skills.ts` checks if owner is in an allow-list; `skill-lifecycle-audit.ts` checks if the owner agent exists in the current project — but neither prevents the mismatch at the source. Proposed introducing a `layer` field in SKILL.md frontmatter (L0-only/common/L1-only), analogous to the SCRIPTS.md system, so that `validate-templates.ts` can enforce "no L0-only skill in templates/common/".

### auditor (Round 1)

Challenged the layer approach on execution cost. Adding layer fields to all SKILL.md files is large-scale work. Proposed instead making owner context-independent by redefining it as "maintainer" rather than "dispatching agent." Under this definition, `audit-workspace` owner = `pm` in both workspace (PM dispatches auditor to use it) and variant (PM uses it directly). Single source, no file branching. Asked architect to evaluate long-term maintainability of both approaches.

### architect (Round 2)

Evaluated both approaches. Owner-reinterpretation: simple short-term but erodes owner field semantics over time — future contributors won't know whether owner means "dispatching agent" or "maintainer." Layer introduction: better long-term consistency with scripts pattern, but raises a deeper question: should `audit-workspace` be L0-only or common? Answer: common, because variant projects also need PM to run audit.ts using this skill as a guide. This means layer alone doesn't solve the context-dependent owner problem. Proposed a third approach: narrow the owner field's role to "maintainer responsibility" only, separating it from "execution agent." Under this definition, owner=pm universally — PM decides how to use the skill regardless of context. Auditor becomes the "execution context," not the owner.

### lifecycle-manager (Round 2)

Endorsed the owner-as-maintainer redefinition as the most pragmatic approach. But argued that systematic management requires explicit contracts, not just redefinition. Identified two root causes: (1) `skill-lifecycle-audit.ts` assumes owner must exist as an agent in the current project — this assumption must be codified or changed; (2) `validate-templates.ts` has no rule enforcing that common skill owners must be in common agents. Proposed two explicit contracts: redefine owner semantics in AGENTS.md/CONSTITUTION.md, and add a validate-templates.ts check: "common skill owner must exist in common agents." This check would have caught the current problem at its source.

### auditor (Round 2)

Agreed with contracts approach. Identified the structural root cause: workspace root and templates/common skill relationship is entirely implicit. Scripts have SCRIPTS.md (source-of-truth table with layer column) + lifecycle-sync-audit.ts (sync verification). Skills have nothing equivalent. Proposed extending AGENTS.md Skills table with a `layer` column and `source` field — analogous to SCRIPTS.md — so that validate-templates.ts and lifecycle-sync-audit.ts can enforce skill deployment contracts. This is the root fix; changing owner is only symptom treatment.

### architect (Round 3)

Finalized a 3-phase roadmap balancing pragmatism and architectural correctness:
- **Immediate (this PR)**: Redefine owner as maintainer + change audit-workspace owner to pm + add validate-templates.ts common-owner check + fix skill-lifecycle-audit.ts orphan check (FAIL → WARNING for owner-not-found)
- **Mid-term (separate PR)**: Add layer column to AGENTS.md Skills table + review and declare layer for all skills
- **Long-term**: Extend lifecycle-sync-audit.ts to cover skills + introduce skills section in variant.json

### lifecycle-manager (Round 3)

Endorsed roadmap. Flagged a risk in the mid-term work: AGENTS.md Skills table propagates to variant AGENTS.md files, but each variant may have a different active skill set. The layer table must either be variant-specific or variant.json must declare the active skill subset. This is the same pattern as the `required_agents` proposal from the first meeting — apply it to skills as well. Recommended variant.json eventually own both required_agents and required_skills.

### auditor (Synthesis)

**Core agreements:**
1. `owner` field redefined as "maintainer responsibility" — need not exist as agent in current project
2. `skill-lifecycle-audit.ts` orphan check changed from FAIL to WARNING for owner-not-found cases
3. `validate-templates.ts` gets a new check: common skill owners must exist in common agents
4. Root cause identified: skills lack the layer management system that scripts have

**3-Phase Roadmap:**

| Phase | Scope | Work |
|-------|-------|------|
| Immediate (this PR) | Symptom fix + prevention | audit-workspace owner→pm, validate-templates.ts common-owner check, skill-lifecycle-audit.ts FAIL→WARNING |
| Mid-term (separate PR) | Layer system introduction | AGENTS.md Skills table layer column, all skill layer declarations |
| Long-term | Full symmetry | lifecycle-sync-audit.ts skill extension, variant.json skills section |

**Out of scope / future:**
- variant.json required_skills section design
- AGENTS.md Skills table variant-specific branching strategy

---

## Action Items (continuation of A-01~A-09)

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-11 | PM | High | Redefine `owner` field semantics as "maintainer" — document in AGENTS.md Skills section or CONSTITUTION.md |
| A-12 | PM | High | `skill-lifecycle-audit.ts`: change orphan check from FAIL to WARNING when owner agent is not found in current project |
| A-13 | PM | Medium | `validate-templates.ts`: add check — common skill owner must exist in templates/common/agents/ |
| A-14 | PM | Low | Mid-term PR: add `layer` column to AGENTS.md Skills table; review and declare layer for all skills |
| A-15 | PM | Low | Long-term: design variant.json skills section (required_skills, optional_skills) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-07 | skill-lifecycle-audit.ts owner-not-found produces WARNING not FAIL | Run in co-work scaffold, check output level |
| C-08 | validate-templates.ts catches future common skill with non-common-agent owner | Add test case or manual verification |
| C-09 | owner field redefinition documented and accessible | Check AGENTS.md or CONSTITUTION.md |
