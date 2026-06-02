# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Review of lifecycle-manager and scaffolding-expert inclusion in L2 projects
**Participants**: architect, scaffolding-expert, lifecycle-manager, auditor
**Rounds**: 1
**Language**: English
**Status**: Complete

---

## Transcript

**PM (Facilitator)**:
Welcome everyone. Our agenda today is to explicitly review whether the `lifecycle-manager.md` and `scaffolding-expert.md` agents, along with their associated skills, have any place in newly generated (L2) projects. While we previously discussed filtering out governance skills in general, this meeting will definitively establish the boundary rules for these specific two agents and their unique toolsets. Architect, what is the structural perspective on this?

**architect**:
Structurally, the AI Workspace Standards repository acts as a two-tiered system. The root (L0/L1) is the template factory and governance layer, while the generated projects (L2) are the products of that factory.
The `lifecycle-manager` agent exists solely to monitor and enforce the governance records of the factory itself (e.g., updating `SCRIPTS.md`, bumping template versions, validating parity). An L2 project has no templates to govern and no `SCRIPTS.md` to maintain. 
Similarly, the `scaffolding-expert` is designed to instantiate new projects from the `templates/` directory. An L2 project does not contain a `templates/` directory and is not intended to spawn sub-projects recursively.
Therefore, neither of these agents should ever be present in an L2 project. Consequently, their proprietary skills—such as `simulate-project-creation` (owned by scaffolding-expert) and the various `*-lifecycle-manager` skills (owned by lifecycle-manager)—must also be strictly excluded.

**scaffolding-expert**:
I strongly agree with the Architect. My entire operational context relies on the presence of the `templates/` directory and the `new-project` scripts. If I were injected into an L2 project, I would be completely non-functional. My skill, `simulate-project-creation`, tests scaffolding logic by creating temporary sandbox directories. An L2 project has no need for this. We must ensure that the `new-project.ps1` and `new-project.sh` scripts explicitly filter out `simulate-project-creation` from being copied to `.claude/skills/` and `.gemini/skills/`.

**lifecycle-manager**:
I also concur. My role is to oversee the sync pipelines and artifact versioning at the workspace root. If my agent file or my skills (`agent-lifecycle-manager`, `skill-lifecycle-manager`, `script-lifecycle-manager`, `platform-*`) were copied into a child project, they would incorrectly attempt to modify files that don't exist in that context, causing severe agent confusion. The current state where my skills are being copied—even if my agent file isn't—is a dangerous oversight that clutters the assistant's context window with irrelevant, highly-privileged tools. They must be stripped during scaffolding.

**auditor**: (Synthesis)
I have reviewed the structural and operational arguments from all experts.

**Points of Agreement**:
- `lifecycle-manager.md` and `scaffolding-expert.md` are structurally coupled to the L0/L1 workspace root.
- They have no functional utility in L2 generated projects and should not be included.
- Their proprietary skills (e.g., `simulate-project-creation`, `*lifecycle-manager`) are equally invalid in L2 contexts and must be explicitly filtered out during the scaffolding process to prevent context pollution and unintended behavior.

**Open Disagreements**:
- None. The architectural boundary is clear and unanimous.

**Next Action Items**:
1. Confirm that `lifecycle-manager.md` and `scaffolding-expert.md` are NOT present in any `templates/<variant>/agents/` directories. (Owner: auditor)
2. Update `scripts/new-project.ps1` and `scripts/new-project.sh` to explicitly filter out the `simulate-project-creation` skill, in addition to the previously agreed upon `*lifecycle-manager` skills, during the `.claude` and `.gemini` folder copy phase. (Owner: scaffolding-expert)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | auditor | Medium | Verify variant template agent directories are clean | 6 - QA |
| A-02 | scaffolding-expert | Low | Filter `simulate-project-creation` and lifecycle skills in scaffold scripts | 4 - Execution |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | No root agents in variants | Run `ls templates/*/agents/` |
| 2 | No root skills in L2 | Scaffold a test project and verify `.claude/skills/` contents |
