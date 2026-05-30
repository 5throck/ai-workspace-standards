# Meeting Transcript
**Date**: 2026-05-30
**Topic**: Scaffolding TS Migration and Global Plugin/Extension Strategy
**Participants**: PM, architect, lifecycle-manager
**Rounds**: 1
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[PM]**: (Facilitator Opening)
"Welcome everyone. Today we are discussing the integration of global tools (the superpowers plugin and ui-ux-pro-max skill) into our template scaffolding. The user correctly pointed out that blindly copying these files into the local `skills/` directory is flawed. Claude uses plugins, and Antigravity uses extensions, so we should inject or configure them dynamically during project creation. Also, the user suggested rewriting our `new-project.sh` and `.ps1` scaffolding scripts into a single unified `new-project.ts` script to handle this properly. Architect and Lifecycle Manager, I need your perspectives on this architectural pivot."

**[architect]**: (Round 1)
"Thanks, PM. This is a brilliant insight from the user. Continuing to maintain `.sh` and `.ps1` in parallel has been a significant technical debt, especially with cross-platform quirks. Consolidating the scaffolding logic into a single `scripts/new-project.ts` running on Bun perfectly aligns with our recent git-hooks migration strategy. Regarding the plugin/extension architecture: local workspaces shouldn't bloat their SSOT with global tools. Instead, `new-project.ts` should dynamically update the generated project's configuration to register these global resources natively depending on whether the user targets Claude or Antigravity."

**[lifecycle-manager]**: (Round 1)
"I completely agree with Architect. From a governance perspective, copying 15 generic skills into every single project's `skills/` directory violates our variant purity. By using `new-project.ts` to dynamically register them as native extensions/plugins, we maintain a clean `common-contract.json` that focuses only on project-specific rules, while still guaranteeing the availability of standard developer tools. We should deprecate `new-project.sh` and `.ps1` immediately and remove their parity checks from `validate-templates.ts`."

**[architect]**: (Synthesis)
"To synthesize our discussion:
1. **Agreement**: We all agree to deprecate the dual bash/powershell scaffolding scripts and replace them with a unified `new-project.ts`. We also agree that global skills (`superpowers`, `ui-ux-pro-max`) should be dynamically linked as plugins/extensions rather than copied as raw files.
2. **Open Disagreements**: None.
3. **Next Action Items**:
   - Create `scripts/new-project.ts` with cross-platform plugin/extension injection logic. (Owner: Architect)
   - Deprecate/Delete `new-project.sh` and `new-project.ps1` from the repository. (Owner: Lifecycle-Manager)
   - Update `validate-templates.ts` to remove shell script parity checks. (Owner: Architect)"

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Architect | Create scripts/new-project.ts | Planning & Architecture |
| A-02 | Lifecycle-Manager | Delete new-project.sh and .ps1 | Planning & Architecture |
| A-03 | Architect | Update validate-templates.ts checks | Planning & Architecture |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | TS Scaffolding Works | `test-new-project.ts` passes successfully |
| 2 | Platform Parity | Script handles Claude (plugin) and Antigravity (extension) |
