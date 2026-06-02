# Meeting Transcript
**Date**: 2026-06-02
**Topic**: Retaining and adapting governance tools (agent/skill/script lifecycle) for L2 projects
**Participants**: architect, lifecycle-manager, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**architect**: (Round 1)
The user raises a highly valid architectural point. If an L2 project is meant to evolve independently, it will eventually need to create its own project-specific agents, skills, and scripts. Stripping out all the lifecycle managers means the L2 project loses the ability to safely update `AGENTS.md`, `SCRIPTS.md`, or register new skills using our established SSOT workflows. We must retain these governance tools in L2.

**lifecycle-manager**: (Round 1)
@architect, exactly. The `agent-lifecycle-manager`, `skill-lifecycle-manager`, and `script-lifecycle-manager` skills are designed to maintain internal registries. If we retain them in L2, developers can seamlessly add local agents and scripts. However, there's a technical hurdle: these tools and their underlying scripts currently assume they are running in the L0 Workspace Root. For example, they attempt to propagate changes to `templates/common/`. If they run in an L2 project where `templates/` doesn't exist, they will crash or throw errors.

**scaffolding-expert**: (Round 1)
@lifecycle-manager, that means if we decide to keep them, the `new-project` scaffolding script doesn't need that massive blacklist we just discussed! But we have a new problem. Any retained script that executes `publish-to-template.ts` or runs `bun run agent:verify` (which checks template variants) will fail in L2. 

**auditor**: (Round 1)
@scaffolding-expert, precisely. The `audit.ts` and lifecycle scripts are tightly coupled to the 3-Layer SSOT architecture's "Propagation Flow". If we retain them in L2, we must ensure they can operate in a "Standalone" or "Project" mode. They must gracefully skip Tier 2 (template) checks when running in an isolated L2 environment.

**architect**: (Round 2)
@auditor, to resolve this, we need to refactor our lifecycle skills and core audit scripts. They should dynamically detect if they are running in L0 (Workspace Root) or L2 (Standalone Project)—for instance, by checking for the existence of the `templates/` directory or `docs/workspace-schema.json`. If it's an L2 environment, they bypass the L0->L1 propagation steps and only update the local L2 registries (`AGENTS.md`, `SCRIPTS.md`, etc.).

**lifecycle-manager**: (Round 2)
@architect, this approach is elegant. It means we keep the core lifecycle managers (`agent`, `skill`, `script`) in `.claude/skills` and `.gemini/skills` during scaffolding. We also keep `audit.ts`. But we must strictly classify which tools are "Universal" (L0/L2 compatible) and which are "Strictly L0" (like `publish-to-template.ts`, `validate-templates.ts`, `propagate-to-templates.ts`). The strictly L0 tools should still be deleted during scaffolding.

**scaffolding-expert**: (Round 2)
@lifecycle-manager, this significantly narrows down the blacklist. We only delete scripts and skills explicitly related to template management and cross-platform parity synchronization, leaving the core development governance intact. I can adjust the cleanup logic once we finalize the list of "Universal" vs "Strictly L0" tools.

**auditor**: (Round 2)
@scaffolding-expert, I will lead the effort to review `audit.ts` and the lifecycle managers to ensure they have this environment-awareness logic built in. Let's synthesize these findings so we have a clear action plan.

---

## Synthesis

**Points of Agreement**:
1. L2 projects require agent, skill, and script lifecycle management to safely evolve and maintain their own registries.
2. Core lifecycle skills and audit scripts must be retained in L2 projects, contradicting our previous strategy of aggressive deletion.
3. Retained governance tools must be refactored to dynamically detect their environment (L0 vs L2) and disable template-sync behaviors when running in an L2 project.
4. Only purely template-centric tools (e.g., `publish-to-template.ts`) should be deleted during scaffolding.

**Open Disagreements or Unresolved Questions**:
- None.

**Next Action Items**:
1. Categorize all governance scripts and skills into "Universal" vs "Strictly L0".
2. Refactor Universal scripts (e.g., `audit.ts`) and lifecycle-manager skills to support "Standalone/L2 mode" (bypassing template checks if `templates/` is absent).
3. Update the L2 scaffolding blacklist to only target "Strictly L0" tools.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Define Universal vs Strictly L0 categorization list | Execution |
| A-02 | auditor | Medium | Refactor `audit.ts` and lifecycle scripts for L2 environment awareness | Execution |
| A-03 | scaffolding-expert | Low | Update `new-project` scripts with the revised L0-only blacklist | Execution |
