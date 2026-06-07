# Meeting Transcript

**Date**: 2026-06-08
**Topic**: Create-l2-scaffold.ts and new-project.ps1 Logic Consistency
**Participants**: pm, automation-engineer
**Rounds**: 2
**Language**: Korean (Transcript in English)
**Status**: Complete

---

## Transcript

### Round 1

**[Automation Engineer]**:

Good. I've analyzed the logic differences between the two scripts.

**Logic applied in create-l2-scaffold.ts:**
1. CLAUDE.md/GEMINI.md direct copy (removed `.template` files)
2. memory folder created as empty (removed MEMORY.md file generation)
3. Copy only docs/_common/ (exclude docs/_templates/, docs/_examples/)

**Current state of new-project.ps1:**
1. CLAUDE.md/GEMINI.md — No `.template` file handling logic (copies everything via robocopy)
2. memory folder — No handling logic (copies everything via robocopy, so memory/MEMORY.md is also copied)
3. docs/ — Copies everything, then removes L1-only directories

**Issues:**
1. new-project.ps1 also copies memory/MEMORY.md (should start with empty folder)
2. new-project.ps1 doesn't recognize docs/_common/ structure (removes entire docs/_templates/)
3. new-project.ps1 needs `.template` file handling logic

PM colleague, do you agree with this analysis?

**[PM]**:

I agree with Automation Engineer's analysis. Specifically:

**memory/MEMORY.md issue:**
- create-l2-scaffold.ts creates empty folder only
- new-project.ps1 copies everything via robocopy /E, so memory/MEMORY.md is also copied
- New projects should start with empty memory folder

**docs/_common/ issue:**
- create-l2-scaffold.ts copies only docs/_common/
- new-project.ps1 copies entire docs/ then removes docs/_templates/
- Need explicit logic to copy files from docs/_common/

**CLAUDE.md/GEMINI.md issue:**
- create-l2-scaffold.ts removed `.template` files and copies directly
- new-project.ps1 has no `.template` file handling (no impact since already removed)

**Proposed fixes:**
1. Add logic to remove memory/MEMORY.md file
2. Add explicit logic to copy docs/_common/
3. docs/_templates/ removal logic already applied

Automation Engineer, what are your thoughts on the implementation approach?

### Round 2

**[Automation Engineer]**:

I agree with PM colleague's proposed fixes. Let me propose an implementation approach.

**new-project.ps1 modifications:**

**1. Remove memory/MEMORY.md file**
Add after workspace file removal loop (around line 245-252):
```powershell
# Remove memory/MEMORY.md if it exists (new projects should start with empty memory folder)
$memoryIndexPath = Join-Path $ProjectDir "memory\MEMORY.md"
if (Test-Path $memoryIndexPath) {
    Remove-Item $memoryIndexPath -Force
    Write-Host "  [SKIP] Removed memory/MEMORY.md (new projects start with empty memory folder)"
}
```

**2. Add explicit docs/_common/ copy logic**
Add after L1-only directory removal loop (around line 254-262):
```powershell
# Ensure docs/_common/ files are copied (already copied by robocopy, just verify)
$commonDocsDir = Join-Path $ProjectDir "docs\_common"
if (Test-Path $commonDocsDir) {
    Write-Host "  [OK] docs/_common/ files present in new project"
} else {
    Write-Host "  [WARN] docs/_common/ not found - docs files may be missing" -ForegroundColor Yellow
}
```

**Advantages:**
- Minimal modification to ensure consistency
- Maintain existing robocopy logic
- Add explicit verification logic

PM colleague, do you agree with this modification plan? Shall I proceed with implementation?

**[PM]**:

I agree with Automation Engineer's modification plan.

**Final agreement:**
1. Add logic to remove memory/MEMORY.md file
2. Add logic to verify docs/_common/ presence
3. Maintain existing robocopy and L1-only removal logic

Consistency between new-project.ps1 and create-l2-scaffold.ts will be ensured. Let's proceed with implementation.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Add memory/MEMORY.md removal logic to new-project.ps1 | Both | 4 |
| A-02 | automation-engineer | Low | Add docs/_common/ verification logic to new-project.ps1 | Both | 4 |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| A-01 | New projects created via new-project.ps1 have no memory/MEMORY.md file | Test new-project.ps1 and check memory/ contents |
| A-02 | New projects created via new-project.ps1 have docs/_common/ files | Test new-project.ps1 and check docs/_common/ contents |
