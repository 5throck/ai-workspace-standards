# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Consolidating Template Sync Scripts & Mitigating Read-Only Inheritance in New Projects
**Participants**: pm, architect, scaffolding-expert, automation-engineer
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[pm]**: (Facilitator)
We have two critical issues raised by the user. First, we have functional overlap between `publish-to-template.ts` and `propagate-to-templates.ts` which needs consolidation. Second, and more urgently, our recent fix to make L1 (`templates/common/`) strictly read-only introduces a severe side-effect: when creating a new project, the `cp` and `robocopy` commands preserve file attributes. This means all files in the newly scaffolded project will inherit the read-only lock, preventing developers from editing their own project files. Let's discuss solutions.

**[architect]**: (Round 1)
You are absolutely right. We enforced the read-only lock at the L1 boundary to protect the SSOT, but we forgot the L1 -> L2 boundary (template to project instantiation). L2 projects MUST be read-write. As for the scripts, the M-10 consolidation is overdue. We need a single, unified synchronizer that uses both `SCRIPTS.md` and `propagation-map.json` as configuration sources, applies hash comparisons, and manages the L1 read-only locks centrally.

**[scaffolding-expert]**: (Round 1)
The scaffolding bug is a P0 blocker because it breaks project creation right now. When `new-project.ps1` uses `robocopy`, and `new-project.sh` uses `cp -r`, they inherently copy the read-only metadata. We must explicitly strip the read-only lock from the destination directory immediately after the copy operation concludes. It's a simple fix but absolutely vital.

**[automation-engineer]**: (Round 1)
I agree. I can patch the `new-project` scripts immediately. For Unix (`new-project.sh`), we add `chmod -R u+w "$PROJECT_DIR"`. For Windows (`new-project.ps1`), we add a PowerShell command to recursively set `IsReadOnly` to `$false` on all copied files. Once that's stable, we can tackle the script consolidation by migrating the `SCRIPTS.md` parsing logic from `publish-to-template.ts` into `propagate-to-templates.ts`.

**[architect]**: (Round 2)
Let's sequence this correctly. Phase 1 is the hotfix for the `new-project` scripts to unblock project creation. Phase 2 is the script consolidation. Deprecating `publish-to-template.ts` will require updating `SCRIPTS.md`, `README.md`, and potentially any GitHub Actions or Git Hooks that rely on it. We need to be careful with the consolidation.

**[scaffolding-expert]**: (Round 2)
For `new-project.ps1`, the exact line after robocopy should be: `Get-ChildItem -Path $ProjectDir -Recurse -File | Set-ItemProperty -Name IsReadOnly -Value $false`. For `new-project.sh`: `find "$PROJECT_DIR" -type f -exec chmod u+w {} +`. This ensures directories aren't accidentally messed up, only files.

**[automation-engineer]**: (Round 2)
Perfect. I'll implement those exact commands. For the consolidation, I will draft an Implementation Plan mapping out how `propagate-to-templates.ts` will absorb the `SCRIPTS.md` parsing logic, and we can review it before making the massive structural changes.

**[pm]**: (Synthesis)
**Points of Agreement**: 
- The read-only attribute inheritance is a P0 bug that breaks new project creation and must be hotfixed immediately.
- `publish-to-template.ts` and `propagate-to-templates.ts` must be consolidated into a single unified script to remove operational overlap and confusion.

**Concrete Next Action Items**:
- A-01 (Hotfix) | automation-engineer | Low | Update `scripts/new-project.sh` and `scripts/new-project.ps1` to strip read-only attributes after copying templates.
- A-02 | architect | High | Draft an Implementation Plan for consolidating `publish-to-template.ts` into `propagate-to-templates.ts`.
- A-03 | pm | High | Review and execute the consolidation plan (update hooks, docs, and deprecate the old script).

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Hotfix `new-project.sh/ps1` to remove read-only locks post-copy | 4 |
| A-02 | architect | High | Draft Implementation Plan for script consolidation | 1 |
| A-03 | pm | High | Execute consolidation and deprecation workflow | 4 |
