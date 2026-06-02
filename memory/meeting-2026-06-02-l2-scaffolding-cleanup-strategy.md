# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Strategy for filtering skills and scripts during L2 project creation
**Participants**: scaffolding-expert, architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**scaffolding-expert**: (Round 1)
To ensure our L2 projects are clean and independent, we need to decide exactly which skills and scripts to exclude during the scaffolding process. Currently, because we copy the entire `templates/common/` folder, we end up bringing over a lot of L0 governance tools. I propose we aggressively remove all lifecycle-management skills (like `agent-lifecycle-manager`, `skill-lifecycle-manager`) and template-management scripts because they are only meant for maintaining the L0 workspace.

**architect**: (Round 1)
@scaffolding-expert, that aligns perfectly with our architecture. L2 projects should only contain functional or general-purpose skills, such as `project-review`, `meeting-facilitation`, `translate`, and `ui-ux-pro-max`. Similarly, the `scripts/` directory in L2 should only retain scripts needed for the project's own workflow (like test runners), stripping out all L0 management scripts (`publish-to-template.ts`, `audit.ts`, `validate-templates.ts`, etc.). The root `skills/` directory should also probably start empty to encourage project-local skill definition.

**automation-engineer**: (Round 1)
@architect, from an implementation standpoint, how should we handle this? We could either maintain a whitelist of allowed files to copy, or stick to our `robocopy/cp -r` approach and use a blacklist array in the `new-project` scripts to delete them post-copy. Given how the Snapshot Flow is currently designed, a hardcoded deletion array in `new-project.ps1` and `new-project.sh` is the most robust and backward-compatible method. We just need a definitive list of what to delete.

**auditor**: (Round 1)
@automation-engineer, a blacklist array in the scaffolding scripts is indeed the most compliant approach as it ensures we don't break the existing template inheritance model. However, we must ensure this array explicitly targets BOTH `.claude/skills/` and `.gemini/skills/` symmetrically to prevent the parity drift we discussed earlier. We also need to cross-reference our `SCRIPTS.md` to identify every script marked as L0-only.

**scaffolding-expert**: (Round 2)
@auditor, agreed. Here is the proposed blacklist for skills: `agent-lifecycle-manager`, `script-lifecycle-manager`, `skill-lifecycle-manager`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager`, `simulate-project-creation`, `audit-workspace`, `security-scan`, and `validate-docs-links`. We will loop over this list and delete them from both `.claude/skills` and `.gemini/skills`. For the root `skills/` folder, we can simply empty its contents.

**architect**: (Round 2)
@scaffolding-expert, that list is comprehensive. The remaining platform skills (`meeting-facilitation`, `project-review`, `finishing-a-development-branch`, `translate`, `ui-ux-pro-max`) are perfectly suited for L2 development. 

**automation-engineer**: (Round 2)
For the scripts, the blacklist should include all audit and lifecycle management tools: `audit.ts`, `qa-gate.ts`, `validate-templates.ts`, `agent-*.ts`, `skill-*.ts`, `propagate-to-templates.ts`, `publish-to-template.ts`, etc. Basically, we strip out everything that governs the workspace itself. I can implement these arrays in both `new-project.ps1` and `new-project.sh`.

**auditor**: (Round 2)
@automation-engineer, perfect. Let's synthesize this strategy into actionable items so we can implement the exact cleanup boundaries immediately.

---

## Synthesis

**Points of Agreement**:
1. All L0 governance skills (lifecycle managers, platform managers, workspace audits) must be deleted from L2 projects during scaffolding.
2. Both `.claude/skills/` and `.gemini/skills/` must be symmetrically cleaned using the same blacklist array.
3. The root `skills/` folder should be emptied for L2 projects.
4. L0-only management scripts (audits, template syncs, lifecycle tools) must be deleted from the L2 `scripts/` folder.

**Open Disagreements or Unresolved Questions**:
- None.

**Next Action Items**:
1. Define the exact array of skills to delete in `new-project.ps1` and `new-project.sh`.
2. Define the exact array of scripts to delete in the same scaffolding scripts.
3. Implement the symmetric deletion logic and test it on a dummy L2 project.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Update `new-project` scripts with skill and script deletion arrays | Execution |
| A-02 | scaffolding-expert | Low | Empty the root `skills/` directory logic in scaffolding scripts | Execution |
| A-03 | auditor | Medium | Validate L2 project scaffolding behavior | QA |
