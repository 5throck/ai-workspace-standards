# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Discrepancy of skills between skills/, .claude/skills/, and .gemini/skills/ during new project creation
**Participants**: scaffolding-expert, architect, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**scaffolding-expert**: (Round 1)
I've noticed that when we scaffold new L2 projects, there is a discrepancy in the skill configurations. The local `skills/` folder, `.claude/skills/`, and `.gemini/skills/` folders end up having different or missing skills. Since `new-project.ps1` and `new-project.sh` rely on `robocopy` and `cp` from `templates/common/`, this suggests that either the template itself has a mismatch, or our L0/L2 boundary cleanup logic is improperly deleting platform-specific skills. We need to ensure that the L2 projects start with a consistent and correct set of skills across both AI platforms.

**architect**: (Round 1)
@scaffolding-expert, that's a critical observation. Architecturally, the `skills/` directory is meant for workspace-level (L0) utilities or project-local skills, while `.claude/skills/` and `.gemini/skills/` represent platform-specific capabilities. According to our SSOT design and CONSTITUTION.md §10 (Platform Parity), `.claude` and `.gemini` skills must maintain 1-to-1 parity unless explicitly marked with `gemini-parity: skip`. If there is a discrepancy in new projects, it implies our L1 (`templates/common/`) is out of sync, or the exclusion logic we recently implemented is inadvertently targeting one platform's skills over the other.

**auditor**: (Round 1)
@architect and @scaffolding-expert, adding to the compliance perspective: our `validate-templates.ts` and `audit.ts` scripts actively check for platform parity (Check F and H). If those checks are passing at the L0/L1 level, the discrepancy MUST be occurring during the actual execution of the `new-project` scripts (the Snapshot Flow). We need to verify if the post-copy cleanup loops in `new-project.ps1/sh` are accidentally removing `.gemini/skills` without removing the corresponding `.claude/skills`, or if they are leaving behind orphaned governance skills in the root `skills/` folder.

**scaffolding-expert**: (Round 2)
@auditor, you make a great point about the cleanup logic. I will review `new-project.ps1` and `new-project.sh`. Currently, the script loops through predefined lists of L0-only skills (like `lifecycle-manager`, `simulate-project-creation`) and deletes them from the newly copied project directory. If we only specified the paths for `.claude/skills` and forgot to specify `.gemini/skills` for deletion, or vice versa, that would directly cause the exact discrepancy the user reported.

**architect**: (Round 2)
@scaffolding-expert, if that's the case, the fix is straightforward but requires structural consistency. We must ensure that the cleanup arrays in both shell and PowerShell scripts use parameterized platform paths or iterate over both `.claude` and `.gemini` directories symmetrically. Furthermore, we should clarify the role of the `skills/` folder in L2 projects: it should ideally start empty for project-specific skills, or only contain explicitly designated L2-compatible skills.

**auditor**: (Round 2)
@architect, I completely agree. Let me synthesize our findings so we can act on them immediately.

---

## Synthesis

**Points of Agreement**:
1. The discrepancy between `.claude/skills/` and `.gemini/skills/` in new projects is likely caused by asymmetric cleanup logic in the `new-project` scaffolding scripts.
2. The L1 templates (`templates/common/`) are likely in sync (as our audits pass), meaning the Snapshot Flow (L1 -> L2) is where the desynchronization occurs.
3. The root `skills/` folder in L2 projects needs strict definition regarding what it should contain upon initialization.

**Open Disagreements or Unresolved Questions**:
- None.

**Next Action Items**:
1. Review `new-project.ps1` and `new-project.sh` to ensure cleanup logic is perfectly symmetric for both `.claude` and `.gemini` directories.
2. Verify the intended state of the root `skills/` directory for L2 projects and update the scaffolding scripts to enforce it.
3. Run a test scaffolding to manually validate that platform parity is maintained in the generated L2 project.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | scaffolding-expert | Low | Symmetric platform skill cleanup in `new-project.ps1` and `new-project.sh` | Execution |
| A-02 | architect | High | Clarify L2 `skills/` directory initial state requirements | Execution |
| A-03 | auditor | Medium | Validate L2 project scaffolding parity | QA |
