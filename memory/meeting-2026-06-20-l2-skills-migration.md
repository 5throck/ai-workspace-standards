# Meeting Transcript
**Date**: 2026-06-20
**Topic**: L2 existing projects SKILLS.md layer column handling — upgrade-project.ts migration design
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Follow-up to meeting-2026-06-20-skills-propagation-ssot.md, which resolved SKILL.md frontmatter as the propagation SSOT but deferred L2 project SKILLS.md handling.

---

## Transcript

### Round 1

**[Lifecycle-Manager]**

Three options for handling `layer` column in L2 SKILLS.md (e.g., `co-deck/skills/SKILLS.md`):
1. Do nothing — column becomes dead field; functional impact none, cognitive confusion remains
2. Immediate manual cleanup — remove `layer` column from existing L2 projects now
3. `upgrade-project.ts` migration — script detects and removes column on project upgrade

The column is functionally harmless in L2 (no `propagate-to-templates.ts` runs inside L2), but leaving it creates the same "edit this field thinking it does something" confusion that caused this bug.

---

**[Architect]**

Do nothing is not an option — dead column is same bug structure recurring in L2 scope.

Short-term vs long-term separation is the right approach:
- Immediate: manual cleanup of current L2 projects (only co-deck exists)
- Long-term: `upgrade-project.ts` handles schema migration

Key question for `upgrade-project.ts`: does it have schema migration capability? Need Automation-engineer's assessment.

---

**[Automation-Engineer]**

`upgrade-project.ts` is currently file-copy and version-comparison oriented. No structural schema transformation logic exists.

Two approaches for migration:
1. **Schema version management**: `<!-- schema-version: 2 -->` comment triggers versioned migration
2. **Column detection**: detect `layer` column in header row and remove it

Schema versioning is more explicit but potentially over-engineered. Column detection is simpler and precise for current problem. The downside of column detection (can't distinguish intentional `layer` column additions) is not a real risk after A-01 — nobody has reason to add `layer` column to L2 SKILLS.md when it has no effect.

---

**[Auditor]**

Support column detection approach. Schema versioning adds overhead not justified by frequency of SKILLS.md schema changes.

Additional proposal: `verify-skills.ts` should WARN (not ERROR) if L2 SKILLS.md has `layer` column — "this column has no effect on propagation; run upgrade-project.ts to migrate."

For immediate action: co-deck is currently the only L2 project — manual cleanup is appropriate and should be an explicit action item.

---

### Round 2

**[Lifecycle-Manager]**

Migration logic for `upgrade-project.ts`:
1. Find `skills/SKILLS.md` in target L2 project
2. Check header row for `layer` column
3. If present: remove column and all corresponding data cells from every row
4. Add header comment: `<!-- propagation controlled via SKILL.md l2_propagate/scope -->`

This runs as a new "schema migration" step after existing file-copy and validation phases. No version flag needed — column presence determines whether migration is required.

Scope clarification: individual `SKILL.md` files in L2 are NOT touched — their `l2_propagate`/`scope` fields are irrelevant inside L2 and should not be changed.

---

**[Architect]**

Three-layer design:
- **Immediate (manual)**: Remove `layer` column from co-deck `skills/SKILLS.md` manually via `/sync` PR
- **Mid-term (automated)**: `upgrade-project.ts` migration step — detects and removes `layer` column; new projects from `new-project.ts` start correct (L1 SKILLS.md already has no `layer` column)
- **Ongoing (audit)**: `verify-skills.ts` WARN check for L2 SKILLS.md with `layer` column

Additional design principle: SKILLS.md is **registry-only** (name, version, status, owner, last_reviewed). Columns beyond registry metadata are explicitly prohibited in the design docs. Prevents this issue recurring in other forms.

---

**[Auditor]**

Decisions converged. Synthesizing.

**Consensus**:
- Do nothing rejected — dead column recreates same bug structure in L2
- Short-term: manual co-deck cleanup now
- Mid-term: `upgrade-project.ts` adds SKILLS.md migration step (column detection and removal)
- Ongoing: `verify-skills.ts` WARN for L2 SKILLS.md with `layer` column
- Design principle added: SKILLS.md registry-only, no propagation control columns, documented in `06-skill-lifecycle.md`

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | automation-engineer | Low | `co-deck/skills/SKILLS.md` — remove `layer` column immediately | L0-only | Immediate |
| B-02 | automation-engineer | Medium | `upgrade-project.ts` — add SKILLS.md migration step: detect and remove `layer` column | L0-only | Mid-term |
| B-03 | automation-engineer | Low | `verify-skills.ts` — WARN if L2 SKILLS.md has `layer` column, prompt to run upgrade-project.ts | L0-only | With B-02 |
| B-04 | docs-writer | Low | `docs/constitution/06-skill-lifecycle.md` — document SKILLS.md as registry-only, explicitly prohibit propagation control columns | L0-only | Merge with A-05 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-06 | `co-deck/skills/SKILLS.md` has no `layer` column | `grep "layer" co-deck/skills/SKILLS.md` returns no table column match |
| C-07 | `bun scripts/upgrade-project.ts co-deck --dry-run` detects and reports `layer` column removal | Manual test with dry-run flag |
| C-08 | After `upgrade-project.ts` runs, `verify-skills.ts` produces no WARN about `layer` column | `bun scripts/verify-skills.ts` |
| C-09 | `06-skill-lifecycle.md` explicitly states SKILLS.md is registry-only | Doc review |
