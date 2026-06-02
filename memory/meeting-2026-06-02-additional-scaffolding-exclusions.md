# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Additional scaffolding exclusions (Commands and Local Skills)
**Participants**: architect, scaffolding-expert, auditor
**Rounds**: 1
**Language**: English
**Status**: Complete

---

## Transcript

**PM (Facilitator)**:
Welcome to this final review session. The user has asked if there are any additional artifacts leaking into L2 projects that we missed in our previous reviews. We've already addressed platform skills and scripts, but are there other governance artifacts within `templates/common/` that shouldn't propagate? Architect, what does the directory analysis show?

**architect**:
Yes, there are two major oversights. Because `new-project.ps1` performs a blanket `robocopy` of `templates/common/`, we are inadvertently copying root-only artifacts from two other directories:
1. **Commands**: `.claude/commands/new-project.md` is being copied. This slash command is used to spawn new projects. Since L2 projects do not spawn sub-projects, this command is invalid and clutters the assistant UI in L2.
2. **Local Skills**: Our previous meeting focused on filtering `.claude/skills/` and `.gemini/skills/`. However, `templates/common/skills/` (which provisions the local `skills/` directory) *also* contains `agent-lifecycle-manager`, `script-lifecycle-manager`, and `skill-lifecycle-manager`. 
These must be completely stripped from the L2 project during scaffolding to ensure the boundary is fully respected.

**scaffolding-expert**:
I see the gap. Our exclusion logic in `new-project.ps1` and `new-project.sh` needs to be more comprehensive. I will expand the post-copy cleanup routines to not only target `.claude/skills` and `.gemini/skills`, but also `.claude/commands/` (to remove `new-project.md`) and the project's local `skills/` folder (to remove all `*lifecycle-manager` directories). This will completely sanitize the L2 context.

**auditor**: (Synthesis)
I have reviewed the findings.

**Points of Agreement**:
- The `new-project.md` slash command is a factory-level (L0/L1) construct and must be excluded from L2 projects.
- The `*lifecycle-manager` skills exist in the local `skills/` directory as well as platform directories, and must be purged from all locations during scaffolding.

**Open Disagreements**:
- None.

**Next Action Items**:
1. Update `scripts/new-project.ps1` and `scripts/new-project.sh` to delete `new-project.md` from any `commands/` directory. (Owner: scaffolding-expert)
2. Update `scripts/new-project.ps1` and `scripts/new-project.sh` to ensure `*lifecycle-manager` and `simulate-project-creation` are deleted from the local `skills/` directory as well. (Owner: scaffolding-expert)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | scaffolding-expert | Low | Add commands exclusion to scaffolding scripts | 4 - Execution |
| A-02 | scaffolding-expert | Low | Add local skills exclusion to scaffolding scripts | 4 - Execution |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `new-project.md` is absent in L2 | Scaffold a test project and verify `.claude/commands/` |
| 2 | `*lifecycle-manager` absent from local `skills/` | Scaffold a test project and verify `skills/` |
