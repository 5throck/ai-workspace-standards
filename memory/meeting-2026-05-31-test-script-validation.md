# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Review of Project Scaffolding Testing and Synchronization Scripts
**Participants**: pm, architect, auditor, test-runner
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: 
The user requested a review of the scripts that validate our test coverage for `new-project.sh` and `new-project.ps1`. Currently, `scripts/test-new-project.ts` performs the E2E testing, while `scripts/verify-new-project-tests.ts` enforces that every step in the scaffolding scripts is linked to a test case. Are these scripts functioning properly?

**[auditor]**: 
No. We have a significant flaw in `verify-new-project-tests.ts`. It attempts to parse `new-project.sh` and `new-project.ps1` to extract `# TEST: Test N` tags. However, the regex it uses is hardcoded to look for the unicode box-drawing character `──` (e.g., `# ── step ── # TEST: ...`). 

While `new-project.sh` uses `──`, `new-project.ps1` uses standard ASCII dashes `--`. As a result, the parser completely misses every test tag in the PowerShell script, leading to false positives like: "TEST: numbers in sh but not ps1: 1, 18, 8...".

**[test-runner]**: 
In addition to the parsing flaw, we also found technical debt in `test-new-project.ts`. Test cases `0c` and `0d` were built to check specific PowerShell functions (`Initialize-UTF8Environment` and `Validate-TemplateSync`). However, those functions were recently refactored out of the `.ps1` script entirely! The tests were failing because the functions no longer exist. I temporarily commented them out during the metadata migration, but they need to be permanently removed or rewritten.

**[architect]**:
The overarching problem is brittleness. The parsing logic shouldn't be so strict about the exact comment characters (dashes vs box-drawing). 

We should:
1. Loosen the regex in `verify-new-project-tests.ts` to match both `-` and `─`. For example: `const match = line.match(/^#\s*[-─]+\s*(.+?)\s*#\s*TEST:\s*(.+)/i);`.
2. Clean up `test-new-project.ts` by removing the obsolete Test 0c and 0d checks entirely, rather than just commenting them out.
3. Fix the "unlinked step" warning in `new-project.sh` where Step 3.6 currently lacks a `# TEST:` tag.

**[pm]**: 
Excellent findings. This directly addresses the user's suspicion that the verification scripts were not robust. I will compile an Implementation Plan to apply these fixes to the testing infrastructure and present it to the user.

---

## Action Items

| # | Owner | Deliverable |
|---|-------|-------------|
| A-01 | architect | Update regex in `verify-new-project-tests.ts` to support both `─` and `-`. |
| A-02 | test-runner | Clean up deprecated tests (0c/0d) in `test-new-project.ts`. |
| A-03 | pm | Propose the Implementation Plan to the user for approval. |
