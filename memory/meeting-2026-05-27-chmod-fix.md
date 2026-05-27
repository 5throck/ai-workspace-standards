# Meeting Transcript
**Date**: 2026-05-27
**Topic**: Root Cause Analysis and Concrete Fix Plan for git update-index --chmod=+x Error in new-project.ps1
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Facilitator — PM (Opening)

Today's agenda is the `git update-index --chmod=+x` failure in `new-project.ps1` lines 206–219, which produces the error: `cannot add to the index - missing --add option?`. The script continues but git hook execute permissions are not set. Architect will analyze the structural cause, Automation-Engineer will evaluate concrete implementation options, and Auditor will review overall consistency.

---

### Round 1

**Architect**:
The structural cause is clear. Line 208 runs `git init` to create an empty repository, then lines 211–218 immediately call `git update-index --chmod=+x`. The problem: `git update-index --chmod=+x` only works on files already present in the index (staging area). Immediately after `git init`, the index is completely empty. Files like `.githooks/commit-msg` exist on the filesystem but not in the index. Git therefore refuses to set the chmod bit without the `--add` flag.

This is a script ordering design problem. The current sequence is: (1) git init → (2) copy files → (3) chmod. But chmod requires files to be in the index first. Two design directions: (A) minimal fix — add `--add` flag to `git update-index`; (B) flow redesign — run `git add .` first to populate the index, then chmod. Option B is more robust because calling chmod per-file on unstaged files is a recurring source of this type of error.

**Automation-Engineer**:
Evaluating Architect's two options from an implementation standpoint.

Option A — `git update-index --add --chmod=+x $rel`: Change scope is exactly two lines (212, 217). Preserves existing logic. One hidden risk: if `git add .` is called later, it could overwrite chmod bits. On Windows with `core.fileMode=false` (default), `git add` does not reset permission bits — so it's safe, but this assumption is undocumented and fragile.

Option B — `git add .` then chmod: Guarantees index state. However, running `git add .` before `audit.ps1` and `setup.ps1` means not all files will be staged if setup.ps1 creates additional files after staging.

I propose Option C: use `git update-index --add --chmod=+x` (no preceding `git add .`), but move the chmod loop to after `setup.ps1` completes, just before the initial commit. Sequence: (1) git init → (2) copy files → (3) audit → (4) setup → (5) `git add .` → (6) chmod → (7) initial commit. With index fully populated by step 5, `--add` is not even needed. Auditor, please check if this flow change conflicts with other script sections.

**Auditor**:
Automation-Engineer's Option C is logically sound but has a conflict: the current script has no initial commit step. Lines 224 (`audit.ps1`) and 236 (`setup.ps1`) are the final steps — the script exits after that. Option C requires adding an initial commit step, which is a larger scope change.

Also, `C:\test\scripts\new-project.ps1` contains the same code and is a deployed copy from `C:\git`. Having two separate files is itself a consistency risk. If this fix is applied only to `C:\git`, `C:\test` will again be left on the old version.

My recommendation: separate immediate fix from future redesign. **Immediate (this PR)**: add `--add` flag — minimal, safe, verifiable. **Follow-up (separate issue)**: introduce initial commit step + Option C flow redesign. Architect, does the immediate fix create technical debt, or is it sufficient?

---

### Round 2

**Architect**:
Auditor's finding about the missing initial commit step is important — it confirms Option C is out of scope for this PR. I agree on limiting immediate scope to `--add --chmod=+x`.

However, Automation-Engineer's concern about `git add` resetting chmod bits can be eliminated by explicitly setting `core.fileMode false`. Line 209 currently has `git config core.hooksPath .githooks`. Adding `git config core.fileMode false` immediately after removes the risk on Windows.

Concrete changes for this PR:
1. Lines 212 and 217: `git update-index --chmod=+x` → `git update-index --add --chmod=+x`
2. After line 209: add `git config core.fileMode false`
3. Remove `2>$null` error suppression and add `$LASTEXITCODE` checks — currently the script continues silently through the error while still printing it to the user, which is the worst of both worlds. Removing the suppression lets `$ErrorActionPreference = 'Stop'` work correctly.

**Automation-Engineer**:
Confirming implementation details for Architect's three changes.

Change 1 — `--add` flag (lines 212, 217):
```powershell
# Before
git update-index --chmod=+x $rel 2>$null
# After
git update-index --add --chmod=+x $rel
if ($LASTEXITCODE -ne 0) { Write-Warning "chmod +x failed for: $rel" }
```

Change 2 — `core.fileMode false` (after line 209):
```powershell
git config core.hooksPath .githooks
git config core.fileMode false  # Windows: prevent git add from resetting +x bits
```

Change 3 — remove `2>$null`: Architect is correct. The current `2>$null` redirects stderr but does not suppress PowerShell's native error stream, causing the error to still print. Removing it lets `$ErrorActionPreference = 'Stop'` behave correctly.

`C:\test` sync: same fix applied to `C:\test\scripts\new-project.ps1` this PR.

Pre-test cleanup: `C:\test\tetris` was created by the failed run and must be manually deleted before retesting — line 67's `Test-Path $ProjectDir` check will block re-execution otherwise.

**Auditor** (Synthesis):
See synthesis section below.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Change `git update-index --chmod=+x` to `git update-index --add --chmod=+x` in both loops (lines 212, 217) | Immediate |
| A-02 | automation-engineer | Remove `2>$null` from both chmod calls; add `if ($LASTEXITCODE -ne 0) { Write-Warning }` | Immediate |
| A-03 | automation-engineer | Add `git config core.fileMode false` after line 209 (`git config core.hooksPath`) | Immediate |
| A-04 | automation-engineer | Apply identical fix to `C:\test\scripts\new-project.ps1` | Immediate |
| A-05 | user | Manually delete `C:\test\tetris` directory before retesting | Pre-test |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `.\scripts\new-project.ps1 "tetris"` runs with no error output | Run from `C:\test` and observe output |
| C-02 | `.githooks/commit-msg` has execute bit set in git index | Run `git ls-files -s .githooks/` inside new project and verify mode `100755` |
| C-03 | `$LASTEXITCODE` is 0 after chmod loop | Observe no `Write-Warning` output during scaffold |
| C-04 | PowerShell parse check passes | `[Parser]::ParseFile(...)` returns 0 errors |
