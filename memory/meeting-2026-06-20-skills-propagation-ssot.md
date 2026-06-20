# Meeting Transcript
**Date**: 2026-06-20
**Topic**: Dual-source propagation inconsistency — SKILLS.md layer column vs SKILL.md frontmatter (l2_propagate/scope)
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Architect]**

The bug structure: `layer-filter.ts`'s `parseSkillLayers()` reads two sources hierarchically — SKILLS.md `layer` column first, then SKILL.md frontmatter as fallback. The `audit-workspace` case demonstrates the failure perfectly: `l2_propagate: false` was added to its SKILL.md, but SKILLS.md still had `L0+L1`, so `propagate-to-templates.ts` continued propagating to L1.

Three options:
1. **SKILLS.md as SSOT** — remove frontmatter propagation control entirely
2. **SKILL.md frontmatter as SSOT** — remove `layer` column from SKILLS.md or make it derived/informational
3. **Dual validation** — read both sources and error on inconsistency

Preference: Option 2. SKILL.md is the skill's own metadata file, propagation control belongs there semantically.

---

**[Automation-Engineer]**

Implementation complexity per option:
- **Option 1**: Simple code change, but highest operational burden — two files must always be updated together
- **Option 2**: Remove SKILLS.md `layer` column parsing from `parseSkillLayers()`, always use frontmatter. Cleanest. Scope: one function change in `layer-filter.ts`, column removal in SKILLS.md, verify-skills.ts logic update
- **Option 3**: Read both sources, error on mismatch. Medium complexity, highest cognitive burden on developers

Support Option 2. Key decision: remove `layer` column entirely vs keep as `N/A`?

---

**[Lifecycle-Manager]**

The `layer` column in SKILLS.md is only read by `layer-filter.ts`'s `parseSkillLayers()`. No other scripts use it. Removing it has no downstream impact.

Concern: Option 2 requires reading all SKILL.md files directly on every propagation run — file I/O proportional to skill count. At current scale (14 workspace skills) this is negligible, but worth noting architecturally.

Critical addition needed: `verify-skills.ts` must add cross-checks — if a skill has `l2_propagate: false` or `scope: workspace`, it must NOT exist in `templates/common/skills/`. This prevents silent propagation failures. Asked Auditor for audit framework perspective.

---

**[Auditor]**

Current `audit.ts` passes `Skill audit: all skills healthy` while missing the SKILLS.md/SKILL.md inconsistency — this is an audit gap that must be closed regardless of option chosen.

Options evaluated from audit perspective:
- Option 1: SKILLS.md SSOT — compatible with existing registry-vs-filesystem audit pattern, but operational risk of dual-file edits remains
- Option 3: Fail-fast on inconsistency — the failure is actually a desirable property

Support **Option 2** with conditions:
1. Remove `layer` column entirely (keeping it "informational" misleads future developers into thinking it controls behavior)
2. Add two new checks to `verify-skills.ts`: ERROR if skill with `l2_propagate: false` exists in `templates/common/skills/`; ERROR if skill with `scope: workspace` exists in `templates/common/skills/`

---

### Round 2

**[Architect]**

Full agreement on Auditor's two audit checks — they complete Option 2.

On `layer` column: **complete removal is correct**. "Keep but ignore" gives false signal to future developers that the column controls something. This is exactly the condition that causes this bug to recur. A one-line comment in SKILLS.md header — "propagation behavior controlled via SKILL.md `l2_propagate`/`scope`" — is sufficient.

Final design: **Single source of truth is SKILL.md frontmatter**. `layer-filter.ts` always reads frontmatter directly. SKILLS.md is a registry (version, status, owner) only — no propagation control. `verify-skills.ts` audits L1 state.

---

**[Automation-Engineer]**

Implementation scope:
1. `scripts/helpers/layer-filter.ts` — remove SKILLS.md `layer` column parsing; always use `_parseSkillLayersFromFrontmatter()`; version bump
2. `skills/SKILLS.md` + `templates/common/skills/SKILLS.md` — remove `layer` column; add header comment
3. `scripts/verify-skills.ts` — add two new checks: L1 orphan detection for l2_propagate:false and scope:workspace skills
4. `templates/common/skills/audit-workspace/` — delete immediately (stale orphan)
5. Design doc `docs/constitution/06-skill-lifecycle.md` — clarify SKILL.md frontmatter as SSOT

Asked lifecycle-manager: do L2 project SKILLS.md files also need the `layer` column removed?

---

**[Lifecycle-Manager]**

L2 SKILLS.md files (e.g., `co-deck/skills/SKILLS.md`) are independent snapshots — workspace changes don't auto-sync. The `layer` column in L2 SKILLS.md is not used for propagation control (no `propagate-to-templates.ts` runs inside L2). Exclude L2 from this scope. Migration can be handled via `upgrade-project.ts` later if needed.

SKILLS.md role re-definition needed in docs: registry only (name, version, status, owner, review date). Behavior control lives exclusively in SKILL.md frontmatter.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | `layer-filter.ts` — remove SKILLS.md `layer` column parsing; always read frontmatter directly | L0-only | Immediate |
| A-02 | automation-engineer | Medium | `skills/SKILLS.md` + L1 SKILLS.md — remove `layer` column; add propagation guidance comment | L0-only | Immediate |
| A-03 | automation-engineer | Medium | `verify-skills.ts` — add L1 orphan cross-check: ERROR if l2_propagate:false or scope:workspace skill exists in templates/common/skills/ | L0-only | Immediate |
| A-04 | automation-engineer | Low | Delete `templates/common/skills/audit-workspace/` (stale L1 orphan) | L0-only | Immediate |
| A-05 | docs-writer | Medium | `docs/constitution/06-skill-lifecycle.md` — clarify SKILL.md frontmatter as propagation SSOT; remove SKILLS.md layer column references | L0-only | After A-01~A-04 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `includeSkillInL1('audit-workspace')` returns `false` | `bun -e "import {includeSkillInL1} from './scripts/helpers/layer-filter.ts'; console.log(includeSkillInL1('audit-workspace'))"` |
| C-02 | `templates/common/skills/audit-workspace/` does not exist | `ls templates/common/skills/` |
| C-03 | `bun scripts/verify-skills.ts` errors if l2_propagate:false skill exists in L1 | Manual test: temporarily add stale skill to L1, run verify-skills.ts |
| C-04 | `bun scripts/audit.ts` passes with all new checks | `bun scripts/audit.ts` exit 0 |
| C-05 | `propagate-to-templates.ts --dry-run` does not list audit-workspace as a skill to propagate | `bun scripts/propagate-to-templates.ts --dry-run` |
