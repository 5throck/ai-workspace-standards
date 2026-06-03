# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-design1 Scaffold Post-Audit Failures: Lifecycle Sync, CodeGraph, Pre-commit Hook
**Participants**: architect, scaffolding-expert, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

After successful `new-project.sh --version 0.5.1` scaffold of co-design1, the post-scaffold audit reported:
- [FAIL] Lifecycle sync audit: `audit.ts @version 2.3.2` ≠ `SCRIPTS.md 2.4.0`; `hooks/pre-commit.ts @version 1.1.2` ≠ `SCRIPTS.md 1.2.0`
- CodeGraph second indexing returned 0 nodes / 0 edges (first was 741 nodes / 1218 edges)
- Pre-commit hook fired during setup.sh with "Direct git commits are restricted" + "Nothing to commit"
- 28 scripts missing `@version` headers (WARN-level in lifecycle-sync-audit.ts)

---

## Transcript

### Round 1

**architect**: Diagnosed issue 1 as a template packaging version sync failure. SCRIPTS.md records higher versions than actual script files, indicating either (a) SCRIPTS.md was updated before script file headers, or (b) script files were updated but `templates/common/scripts/` copy was skipped before tagging. The 28 missing `@version` headers are a separate pre-existing issue — should remain WARN for now but may need promotion to ERROR in future.

**scaffolding-expert**: Confirmed that the `templates/common/scripts/` copy step (per CLAUDE.md §10 lifecycle rules) was likely missed before tagging, matching architect's hypothesis (b). Identified issue 3 as a structural conflict between setup.sh's git commit attempt and the pre-commit hook policy. Proposed either removing the initial commit from setup.sh or providing a scaffold-specific bypass path.

**automation-engineer**: Agreed that `--no-verify` is forbidden. Correct fix is removing the initial commit attempt from setup.sh entirely — setup.sh's responsibility is environment preparation, not git history creation. Analyzed CodeGraph 0-node issue: second indexing is triggered by git hooks installation, which likely runs `codegraph sync` against the wrong path (empty or root), producing 0 nodes. Asked auditor whether this constitutes a runtime bug or initialization artifact.

**auditor**: Confirmed 0 nodes is a runtime bug — not a mere artifact — as subsequent git commands (commit/checkout) would trigger codegraph sync with the 0-node cache, degrading AI context quality. Prioritized issues: P0 (SCRIPTS.md version mismatch), P1 (pre-commit false fire), P2 (CodeGraph 0 nodes), P3 (@version missing 28 scripts).

### Round 2

**architect**: Clarified that lowering SCRIPTS.md version to match script files is wrong. Must first determine: (Scenario A) workspace audit.ts is already 2.4.0 → templates/common/ copy was missed; (Scenario B) workspace is also 2.3.2 → SCRIPTS.md was incorrectly advanced. The 28 missing @version headers are long-standing technical debt and should be handled in a separate Wave to avoid expanding scope.

**scaffolding-expert**: Refined setup.sh analysis: the pre-commit hook is likely triggered indirectly when CodeGraph installs git hooks (post-commit etc.) — during hook registration a `git` command triggers the existing pre-commit hook. Proposed fix: change setup.sh to initialize CodeGraph without git hook installation, leaving that choice to user after first `/sync`.

**automation-engineer**: Confirmed that `codegraph init` non-interactive flag support needs verification. Proposed workaround: pipe input or use `--preset` for non-interactive mode. Also proposed adding explicit `codegraph sync` at end of setup.sh to recover from 0-node state in WSL2 /mnt/ environments.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| B-01 | automation-engineer | High | Check workspace `audit.ts`/`pre-commit.ts` actual versions → determine Scenario A or B → sync `templates/common/scripts/` | Immediate |
| B-02 | automation-engineer | Medium | `setup.sh`: remove automatic CodeGraph git hooks installation (non-interactive flag or reorder steps) | Short-term |
| B-03 | automation-engineer | Low | `setup.sh`: add explicit `codegraph sync` at end to fix WSL2 0-node issue | Short-term |
| B-04 | scaffolding-expert | Low | Add `@version` headers to 28 scripts in bulk — separate Wave, includes re-tagging | Next Wave |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `bun scripts/lifecycle-sync-audit.ts` in new scaffold shows 0 ERRORs | Run in fresh co-design project |
| C-02 | setup.sh completes without pre-commit FAIL message | Re-run new-project.sh and observe output |
| C-03 | CodeGraph final node count matches first index count | Check setup.sh output |
| C-04 | `audit.ts` version in templates/common/ matches workspace file | File comparison |
