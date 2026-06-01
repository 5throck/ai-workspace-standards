# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Review CONSTITUTION.md: Workspace Root hardcoding and Script Lifecycle Layers (L0 vs L1)
**Participants**: architect, auditor, scaffolding-expert, docs-writer, lifecycle-manager
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**[architect]**: (Round 1)
Regarding the workspace root hardcoding, the user's point is valid. While `C:\git` or `~/git` is a common convention, a developer might clone the repository anywhere. We should update the CONSTITUTION.md to state that the workspace root is the directory where the repository was cloned, using `C:\git` merely as an example. As for the script lifecycle layers, L0 is currently defined as `templates/common/scripts/` because it serves as the ultimate source of truth across all variants. However, I can see how developers might intuitively think of the workspace root (`scripts/`) as L0. What are your thoughts on this hierarchy?

**[scaffolding-expert]**: (Round 1)
I agree with architect on the workspace path. Our scaffolding scripts (`new-project.sh/.ps1`) use relative paths to copy templates, so they already work regardless of the absolute path. We just need to correct the documentation. On the script layers, from a scaffolding perspective, the templates are indeed the origin (L0). If we change workspace root to L0 and templates to L1, it implies templates inherit from the workspace, which is technically backwards in our generation pipeline. We should probably keep templates as L0 but clarify *why* it's L0 in the documentation so it doesn't confuse users.

**[docs-writer]**: (Round 1)
Building on scaffolding-expert's point, I can easily rephrase the Workspace Overview to say "The workspace root is the directory where you cloned the repository (e.g., `C:\git` or `~/git`)." For the L0/L1 script layers, the terminology might be confusing because users interact with the workspace root first. I propose we keep the current L0 (templates) and L1 (workspace) architecture but improve the explanation in section 6.5 to emphasize that L0 represents the "upstream standard" and L1 represents the "local workspace realization."

**[lifecycle-manager]**: (Round 1)
I support docs-writer's approach. If we invert L0 and L1, we would have to rename variables and update `generate-version-manifest.ts` and `validate-templates.ts`, which currently assume L0 is the template layer. Clarifying the terminology without changing the underlying architecture is the safest route for our lifecycle tools.

**[auditor]**: (Round 1)
I will verify consistency. Changing the absolute path requirement to a relative/dynamic concept aligns with standard Git practices and won't break our audit scripts, as they run relative to the project root anyway. Keeping L0 as templates is structurally sound. 

**[architect]**: (Round 2)
Great points everyone. So we agree to: 1) Update CONSTITUTION.md to clarify that the workspace root is the clone destination, removing the strict `C:\git` requirement. 2) Retain L0 for templates and L1 for the workspace root, but have docs-writer clarify the rationale in section 6.5 so it is intuitive for the user. 

**[scaffolding-expert]**: (Round 2)
I agree. I will also double-check the `new-project` scripts to ensure there are no lingering hardcoded absolute paths, just to be completely safe, although they should be clean.

**[docs-writer]**: (Round 2)
I am ready to make these documentation updates. I'll revise the "Workspace Overview" and "6.5 Script Lifecycle Management" sections in CONSTITUTION.md.

**[lifecycle-manager]**: (Round 2)
This plan perfectly preserves our lifecycle management integrity. No changes needed to the actual lifecycle scripts.

**[auditor]**: (Round 2)
The proposal is consistent and resolves the user's concerns without introducing structural regression. I will synthesize the outcome.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | docs-writer | Medium | Update CONSTITUTION.md Workspace Overview to clarify clone directory is the root | Next |
| A-02 | docs-writer | Medium | Update CONSTITUTION.md section 6.5 to clarify why templates are L0 and workspace is L1 | Next |
| A-03 | scaffolding-expert | Low | Verify no hardcoded absolute paths exist in `new-project` scripts | Next |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | CONSTITUTION.md no longer enforces `C:\git` or `~/git` strictly | Manual Review |
| 2 | L0/L1 definitions in section 6.5 clearly explain the template-as-upstream rationale | Manual Review |
