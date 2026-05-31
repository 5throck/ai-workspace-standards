# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Skills and scripts impact of auditor/lifecycle-manager removal from templates
**Participants**: architect, lifecycle-manager, auditor
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Continuation of**: meeting-2026-06-01-auditor-lifecycle-removal.md

---

## Context

Follow-up to the agent removal meeting. Previous meeting covered agent-level decisions.
This meeting covers the skills and scripts layer impact.

---

## Key Findings at Meeting Start

- `templates/common/skills/audit-workspace/SKILL.md`: `owner: auditor` — orphan risk in variant projects
- `validate-templates.ts` line 704: checks for `agent-lifecycle-manager` skill in variant AGENTS.md
- `validate-skills.ts` lines 159, 253: hardcodes `auditor` in owner example text
- `upgrade-project.sh` line 397 / `.ps1` line 375: `agents/auditor.md` in update target list
- `agent-lifecycle-manager` skill trigger example: `"Add an auditor agent"`
- Other orphaned skill owners in common: `security-expert`, `scaffolding-expert`, `docs-writer`, `architect`

---

## Transcript

### architect (Round 1)

Identified the full skill and script impact. Core skill issue: `audit-workspace` has `owner: auditor` in `templates/common/skills/`. Without auditor in variant projects, this skill becomes orphaned. Three script issues: (1) `validate-templates.ts` line 704 forces `agent-lifecycle-manager` skill in variant AGENTS.md; (2) `validate-skills.ts` hardcodes `auditor` as a valid owner example; (3) `upgrade-project` scripts include `agents/auditor.md` in update targets. Asked auditor who should own `audit-workspace` after removal.

### auditor (Round 1)

Three options for `audit-workspace` owner: PM (most logical — PM already owns audit via /sync), automation-engineer (also logical but misaligned with its implementation focus), or remove from common entirely. Recommended PM ownership. Also noted: `validate-skills.ts` owner example text should remove `auditor` reference. Asked lifecycle-manager whether `agent-lifecycle-manager` skill should remain in variant AGENTS.md after agent removal.

### lifecycle-manager (Round 1)

Confirmed `agent-lifecycle-manager` skill must remain in variant projects — it is a procedural guide for PM to use directly, not an agent dispatch mechanism. The `validate-templates.ts` line 704 check is therefore correct and should not be changed. Only the skill's owner needs review (already `pm` — no change needed). Raised a more serious issue: upgrade-project strategy for existing projects that already have auditor.md. Proposed "keep if present, don't add if absent" strategy. Also asked architect about the cascading orphan problem.

### architect (Round 2)

Clarified: cascading orphan problem only affects newly scaffolded projects, not existing ones (existing projects still have auditor.md, so audit-workspace skill owner resolves). Finalized upgrade-project strategy: remove `agents/auditor.md` and `agents/lifecycle-manager.md` from inclusion lists only — existing files are untouched. Identified full script change list. Asked auditor to give final opinion on whether `auditor` should be removed from `validate-skills.ts` owner allow-list logic.

### auditor (Round 2)

Must keep `auditor` in validate-skills.ts owner allow-list logic for two reasons: (1) workspace root `skills/audit-workspace/SKILL.md` retains `owner: auditor` — removing from allow-list would cause workspace audit failures; (2) backward compatibility for existing scaffolded projects. Change only the example text, not the validation logic. Also flagged: `agent-lifecycle-manager` skill trigger example contains `"Add an auditor agent"` — should be generalized to avoid misleading variant project users.

### lifecycle-manager (Round 2)

Endorsed auditor's allow-list/example-text distinction. Raised an additional pattern: four other skills in common have non-PM owners (`security-scan: security-expert`, `simulate-project-creation: scaffolding-expert`, `validate-docs-links: docs-writer`, `ui-ux-pro-max: architect`). Proposed two-tier owner policy: Tier 1 = PM-owned (most skills in common), Tier 2 = variant-specific (must NOT be in common). Asked architect whether to include this in current PR or separate.

### architect (Round 3)

Decided: include only audit-workspace owner change in current PR (directly caused by auditor removal). Other four skills (security-scan, simulate-project-creation, validate-docs-links, ui-ux-pro-max) go to a separate owner policy refactor PR. Confirmed validate-templates.ts line 704 check stays unchanged. Finalized the complete in-scope change list for this PR.

### auditor (Synthesis)

**Points of Agreement:**
- `templates/common/skills/audit-workspace/SKILL.md`: `owner: auditor` → `owner: pm` (workspace root unchanged)
- `upgrade-project.sh`/`.ps1`: remove `agents/auditor.md` and `agents/lifecycle-manager.md` from inclusion lists
- `validate-skills.ts`: remove `auditor` from example text only; keep in allow-list logic
- `agent-lifecycle-manager` skill: generalize `"Add an auditor agent"` trigger example
- `validate-templates.ts` line 704 check: no change — correct as-is

**Out of Scope (separate PR):**
- Common skill owner policy simplification: security-scan, simulate-project-creation, validate-docs-links, ui-ux-pro-max

---

## Action Items (continuation of previous meeting A-01~A-05)

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-06 | PM | Medium | `templates/common/skills/audit-workspace/SKILL.md`: owner auditor → pm |
| A-07 | PM | Medium | `upgrade-project.sh` and `upgrade-project.ps1`: remove auditor.md and lifecycle-manager.md from inclusion lists |
| A-08 | PM | Low | `validate-skills.ts`: remove `auditor` from owner example text (keep in allow-list logic) |
| A-09 | PM | Low | `skills/agent-lifecycle-manager/SKILL.md` (both workspace and common): generalize auditor trigger example |
| A-10 | PM | Low | Separate PR: common skill owner policy simplification for security-scan, simulate-project-creation, validate-docs-links, ui-ux-pro-max |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-04 | audit-workspace skill has no orphan in new co-work scaffold | Run skill-lifecycle-audit in new project |
| C-05 | upgrade-project does not add auditor.md or lifecycle-manager.md | Run upgrade on existing project |
| C-06 | validate-skills.ts audit passes on workspace root | bun scripts/validate-skills.ts at C:/git |
