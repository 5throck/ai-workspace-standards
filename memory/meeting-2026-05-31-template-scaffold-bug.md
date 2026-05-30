# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Template Scaffolding Bug Fix
**Participants**: scaffolding-expert, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[scaffolding-expert]** (Round 1)

Two failures were identified in the audit log. Context summary:

**Failure 1 — README.md:24 stale reference**
`templates/co-develop/README.md` line 24 references `bash scripts/new-project.sh "project-name" --variant co-develop`. The script exists at the workspace root (`/c/git/scripts/new-project.sh`). The audit flagged this as a failure because the audit ran *inside the scaffolded project* (`my-project-name1/`), where `scripts/new-project.sh` does not exist — which is correct behavior. The project doesn't need that script internally.

Key question: How should the Quick Start command in the template README be expressed? Currently using a relative path, but since this README is copied into the scaffolded project, it creates confusion. Options: clarify it runs from workspace root, or revise/remove the Quick Start section.

**Failure 2 — Skill audit**
Deferred to Architect — likely a structural issue.

---

**[architect]** (Round 1)

scaffolding-expert correctly identified that Failure 1 is an **audit script context issue**. When `audit.ts` runs inside the new project, it interprets `scripts/new-project.sh` as a project-local path. Two fix directions:

**Option A** — Clarify workspace root context in template README Quick Start:
```bash
# From workspace root (C:\git):
bash scripts/new-project.sh "project-name" --variant co-develop
```
Improves clarity but audit script may still flag it.

**Option B** — Add exception handling in `audit.ts` for workspace-root-only scripts, or exclude shell command code blocks from file existence checks.
The audit script should check markdown links `[text](path)`, not bash commands inside code blocks. This is the root cause.

Recommendation: **Option B** — the "stale shell reference" check incorrectly parses code block commands as file paths.

---

**[auditor]** (Round 1)

Agreed with architect's analysis. The check name "stale shell reference" suggests it intentionally scans script paths in code blocks — but the check uses project-local existence as the criterion, which is wrong for workspace-root scripts in template READMEs.

Two fix directions:
1. **`audit.ts`**: Add workspace-root scripts (`scripts/new-project.sh`, `scripts/upgrade-project.sh`) to an exception list
2. **Template README**: Add `<!-- audit-ignore -->` hint in code blocks

For the Skill audit failure: requires running `bun scripts/skill-lifecycle-audit.ts` inside the scaffolded project. Due to WSL path issues blocking direct execution, recommend analyzing `skill-lifecycle-audit.ts` logic directly first.

---

**[scaffolding-expert]** (Round 2)

Endorses Option 1 (exception list in `audit.ts`) over comment-based hints — the latter requires changes across all template files, increasing maintenance burden.

Additional analysis on Skill audit failure: the scaffold log shows `[FAIL] Skill audit detected issues`. The skill audit checks `skills/` in the scaffolded project. Template `co-develop/skills/*.md` files likely fail audit criteria. Most common causes:
- Missing `version` field
- Invalid `status` field value
- Missing required sections

**Action**: Cross-reference each SKILL.md in `templates/co-develop/skills/` against `skill-lifecycle-audit.ts` validation criteria.

---

**[architect]** (Round 2)

Aligned with scaffolding-expert. Three fix targets:

1. **`scripts/audit.ts`**: Exception handling for workspace-root-only script paths in stale shell reference check
2. **`templates/co-develop/skills/*.md`**: Patch metadata fields to meet skill-lifecycle-audit criteria
3. **(Optional)** `templates/co-develop/README.md`: Clarify "run from workspace root" context in Quick Start — improves UX

Priority: 1 → 2 → 3. Item 3 is not required to pass audit but recommended for documentation clarity.

---

**[auditor]** (Synthesis)

### Points of Agreement

- Root cause of Failure 1: `audit.ts` stale shell reference check **incorrectly interprets workspace-root scripts in code blocks as project-local file paths**
- Failure 2: Template `skills/*.md` files likely **missing required metadata fields** per skill-lifecycle-audit criteria
- Both failures are **template file issues**; scaffolding logic itself is functioning correctly

### Open Questions

- Exact validation criteria of `skill-lifecycle-audit.ts` (direct execution blocked by WSL path issue)
- Exact parsing logic of stale reference check in `audit.ts`

### Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | auditor | Medium | Inspect and fix stale shell reference exception logic in `scripts/audit.ts` | Immediate |
| A-02 | scaffolding-expert | Low | Validate and patch metadata fields in `templates/co-develop/skills/*.md` | After A-01 |
| A-03 | docs-writer | Low | Clarify workspace root context in `templates/co-develop/README.md` Quick Start | After A-02 |

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/audit.ts` passes with 0 failures on a freshly scaffolded project | Re-run scaffold and audit |
| C-02 | `bun scripts/skill-lifecycle-audit.ts` passes inside scaffolded project | Run audit in project dir |
| C-03 | Template README Quick Start is unambiguous about execution context | Manual review |
