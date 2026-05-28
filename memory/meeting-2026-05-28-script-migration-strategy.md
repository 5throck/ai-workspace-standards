# Meeting Transcript
**Date**: 2026-05-28
**Topic**: Hybrid Script Migration and Governance Strategy considering Bootstrap Dependencies
**Participants**: PM, Architect, Automation-Engineer, Auditor
**Rounds**: 2
**Language**: English (Translated from original Korean discussion)
**Status**: Complete

---

## Transcript

**[PM]**: (Round 1)
Hello. A critical edge case has been reported regarding our previous decision to delete all wrapper scripts and fully transition to TypeScript. If we convert entry-point scripts like `install-bun` or `new-project`—which users must run before any environment is set up—into TypeScript, we create a bootstrapping paradox ("we need Bun to install Bun") and degrade the UX. Furthermore, this change has not been reflected in the `templates/` directory, and significant updates to the script lifecycle management guidelines are required. Moving forward, please also consider additional matters such as mandating the 3-Tier strategy for PM-led improvements.

**[Architect]**: (Round 1)
That is an excellent point. An extreme unification where all scripts are forced into a single runtime (Bun) can become an architectural anti-pattern. Therefore, I propose a **Hybrid Architecture** that separates scripts into two distinct tiers:
- **Tier 1 (Bootstrap & User-Facing)**: Scripts for environment setup and initial entry, such as `install-*` and `new-project`. These MUST maintain their native OS shells (Bash `.sh` and PowerShell `.ps1`).
- **Tier 2 (Workspace Operations)**: Internal pipeline scripts repeatedly used by developers after the environment is built, such as `audit` and `dev-sync`. These should be unified into Bun/TypeScript + `package.json` entry points for maintainability.
Additionally, adding a mandatory 3-Tier clause to `pm.md` is a great governance enhancement. As the script architecture changes, the **role definitions in `AGENTS.md`** must also adapt. We must explicitly state in the `automation-engineer`'s role that they manage "Tier 2 `.ts` scripts and `package.json`."

**[Automation-Engineer]**: (Round 1)
I 100% agree with the tier-based hybrid architecture. From a UX perspective, users should still be able to intuitively call `new-project.ps1`.
Also, looking at the `templates/` directory, **modifying the `new-project.ps1/.sh` script** is inevitable. When a new project is created, the bootstrapping process of `new-project` must include logic to correctly copy and initialize the `package.json` script mappings within the project so that Tier 2 scripts function properly.

**[Auditor]**: (Round 2)
Let me point out a risk. If we forcefully inject the workspace standard `package.json` when copying a new project template, it might **conflict** with the user's actual `package.json` intended for their Node.js application.
Therefore, when copying templates, the `new-project` script MUST include logic to safely merge workspace commands (like `dev-sync` or `audit`) into the user's `package.json`, or handle them in a way that avoids runtime conflicts.

**[Architect]**: (Round 2)
A very crucial finding. The `new-project` script must be designed to smartly merge or isolate the workspace tooling dependencies from the user's `package.json` to ensure a safe bootstrap. Moreover, since this bifurcated strategy must become the official standard of the workspace, we must explicitly document the tech stack selection criteria (the Tier 1/2 separation principle) in governance documents like `SCRIPTS.md` and `CONSTITUTION.md`.

**[Auditor]**: (Synthesis)
I will synthesize the entire discussion.

**Agreements:**
1. **Establish a Tier-based Hybrid Script Architecture**:
   - **Tier 1 (Bootstrap/User-Facing)**: Zero runtime dependencies. Native implementation in Bash (.sh) and PowerShell (.ps1) (e.g., `install-bun`, `new-project`).
   - **Tier 2 (Workspace Operations)**: High maintainability. Implemented via Bun/TypeScript + `package.json` (e.g., `dev-sync`, `audit`).
2. **Template Architecture Synchronization and `new-project` Enhancement**: Apply the policy to the scripts under `templates/` as well. Modify the `new-project` script to merge workspace tooling dependencies safely into the user's `package.json` without conflicts.
3. **Governance Overhaul**: Explicitly document the Tier 1/2 separation principles and the expanded agent permissions in `CONSTITUTION.md`, `SCRIPTS.md`, `context.md`, and `AGENTS.md`.
4. **PM Governance Codification**: Mandate the application of the High-Medium-Low 3-Tier strategy for any improvement tasks led by the PM in `pm.md`.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Architect | Draft governance revisions for `CONSTITUTION.md`, `SCRIPTS.md`, `context.md`, `AGENTS.md`, and `pm.md` | Design |
| A-02 | Automation-Engineer | Add `package.json` conflict-prevention and workspace script merge logic to `new-project.ps1` and `.sh` | Implementation |
| A-03 | Auditor | Verify that the revised documents and the `new-project` bootstrap logic function correctly without impacting existing projects | QA |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Bootstrapping Test | Verify that running `new-project` in an environment without Bun successfully scaffolds the folder structure |
| 2 | Package Conflict Prevention | Ensure `bun run dev-sync` and existing user app build scripts co-exist without conflicts within the generated project |
