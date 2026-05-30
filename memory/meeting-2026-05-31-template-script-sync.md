# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Template Script Sync — Workspace Root vs Template scripts/ Duplication Problem
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

After applying `isPlatformSkill` guard to `scripts/skill-lifecycle-audit.ts`, a new scaffold (`my-project-name2`) still showed `[FAIL] Skill audit detected issues`. Root cause: the fix was only applied to the workspace root `scripts/`, not to `templates/co-develop/scripts/skill-lifecycle-audit.ts`, which is the actual file copied into new projects.

---

## Transcript

**[architect]** (Round 1)

The problem is a structural design issue:

```
/c/git/
├── scripts/skill-lifecycle-audit.ts       ← fixed (has isPlatformSkill guard)
└── templates/co-develop/
    └── scripts/skill-lifecycle-audit.ts   ← original (no fix, copied into scaffold)
```

The scaffold copies `templates/co-develop/scripts/` into new projects. Fixes to the workspace root `scripts/` are not propagated to scaffolded projects.

Three possible designs:
- **Option A — SSOT**: Remove template `scripts/`, use workspace root `scripts/` as the source to copy. Changes needed in one place only.
- **Option B — Reverse sync**: Modifying workspace root `scripts/` auto-syncs to `templates/*/scripts/`. Both copies always identical.
- **Option C — Intentional separation**: Two files serve different purposes. Independent management.

Current state: behaves like Option C but was intended as Option B.

---

**[scaffolding-expert]** (Round 1)

Confirmed scaffold mechanism: `new-project.sh` copies all of `templates/co-develop/` into the new project. The workspace root `scripts/` serves workspace management (e.g., `new-project.sh`, `audit.ts`, `dev-sync.ts`). The `templates/co-develop/scripts/` serves as the project-level scripts installed into new projects.

Some scripts like `skill-lifecycle-audit.ts` must exist in BOTH — used by the workspace root AND installed into new projects. This is the source of duplication.

`scripts/SCRIPTS.md` mentions "reverse-sync from `templates/common/scripts/`" — suggesting `templates/common/scripts/` is the SSOT and workspace root `scripts/` is a reverse-synced copy. If so, fixes should start in `templates/common/scripts/` or `templates/co-develop/scripts/`, not the workspace root.

---

**[auditor]** (Round 1)

Current script layer hierarchy:
```
templates/common/scripts/     ← common SSOT (shared across all variants)
templates/co-develop/scripts/ ← variant-specific (extends common)
scripts/                      ← workspace root (reverse-synced from common)
```

This fix only touched the workspace root layer — not propagated to template layers. Correct fix path:
1. Fix `templates/common/scripts/skill-lifecycle-audit.ts` (common source)
2. Fix `templates/co-develop/scripts/skill-lifecycle-audit.ts` if override exists
3. Workspace root `scripts/` — update via reverse-sync or manual

**Immediate fix**: Apply `isPlatformSkill` guard to `templates/co-develop/scripts/skill-lifecycle-audit.ts`.

**Structural improvement**: Add auto-sync validation to `dev-sync.ts` or `audit.ts` to detect when workspace root and template layers diverge.

---

**[architect]** (Round 2)

Two solutions clearly separated:

**Immediate fix** (this session): Apply `isPlatformSkill` guard to `templates/co-develop/scripts/skill-lifecycle-audit.ts`. Simple and immediate.

**Structural improvement** (separate PR): Add a check to `audit.ts` or `dev-sync.ts` that verifies shared scripts are in sync between workspace root and template layers.

---

**[scaffolding-expert]** (Round 2)

Agrees with architect. Also: verify whether `templates/common/scripts/` has `skill-lifecycle-audit.ts`. If yes, that file also needs the fix. If no, only `templates/co-develop/scripts/` needs updating.

Future prevention: Add script hash comparison check to `audit.ts` — compare `scripts/<file>` hash against `templates/*/scripts/<file>` hash for shared scripts, flagging divergence automatically.

---

**[auditor]** (Synthesis)

### Points of Agreement

- **Root cause**: `skill-lifecycle-audit.ts` exists in both workspace root `scripts/` and `templates/co-develop/scripts/`; the fix was only applied to the workspace root
- **Immediate fix**: Apply `isPlatformSkill` guard to `templates/co-develop/scripts/` (and `templates/common/scripts/` if present)
- **Structural gap**: Script sync process is neither documented nor automated, causing silent divergence

### Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Check `templates/common/scripts/` for `skill-lifecycle-audit.ts`; apply `isPlatformSkill` guard to `templates/co-develop/scripts/skill-lifecycle-audit.ts` | Immediate |
| A-02 | auditor | Medium | Verify fix resolves scaffold audit failure | After A-01 |
| A-03 | architect | High | Add workspace root ↔ template script sync check to `audit.ts` | Separate PR |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | New scaffold passes skill audit with 0 failures | Re-run `bash scripts/new-project.sh "test-project"` |
| C-02 | `templates/co-develop/scripts/skill-lifecycle-audit.ts` has `isPlatformSkill` guard | File inspection |
| C-03 | Workspace root `scripts/skill-lifecycle-audit.ts` unchanged | File inspection |
