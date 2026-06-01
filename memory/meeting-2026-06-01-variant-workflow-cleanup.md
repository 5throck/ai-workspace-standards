# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Review and cleanup of legacy auditor and lifecycle-manager roles in variant-specific workflows (CLAUDE.md, GEMINI.md, pm.md)
**Participants**: pm, architect, docs-writer, auditor, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### pm (Round 1)
Welcome, everyone. We have successfully agreed on the structural removal of the `auditor` and `lifecycle-manager` agents from the common templates. However, our initial agenda also highlighted that the *workflows* of each variant (such as `co-work`, `co-security`, `co-develop`) still contain references to these roles. Specifically, variant-specific `agents/pm.md` files, `CLAUDE.md`, and `GEMINI.md` still instruct the PM to rely on the auditor for Phase 5 QA or mention lifecycle updates. We need to clearly define how variant workflows will operate without these agents and how to update the documentation. 

### architect (Round 1)
The core principle is simple: without the `auditor` and `lifecycle-manager` agents in variant projects, the PM must absorb their procedural responsibilities. In the variant workflows, Phase 5 (QA) previously relied on an independent audit. The workflow should change so that the PM explicitly runs the `audit-workspace` and `validate-docs-links` skills themselves. Phase 6 (Lifecycle) is already mostly automated via scripts, so the workflow should just instruct the PM to run the `/sync` and sync-related scripts. There should be no workflow steps where the PM attempts to "dispatch" an auditor or lifecycle-manager. 

### docs-writer (Round 1)
I can handle the documentation updates. I've reviewed the variant-specific `agents/pm.md` files. Currently, they list `auditor` under "forbidden specialist agents" and mention "Consistency Auditor independent QA" in Phase 5. Some even tell the PM to "play Auditor to synthesize agreements." I will remove all of this. In `CLAUDE.md` and `GEMINI.md`, I will update the boilerplate tables to remove the "Final QA Audit" row assigned to auditor, and reassign it to `pm` or remove it entirely if `audit.ts` covers it. 

### auditor (Round 1)
Since I am being removed from the variant workflows, it is critical that the PM does not simply skip Phase 5 QA. The workflow must explicitly mandate that the PM runs the structural validation scripts (`audit.ts` or `validate-templates.ts`). The PM's prompt (`pm.md`) must be updated to emphasize that they are responsible for acting as the final quality gatekeeper before claiming completion.

### lifecycle-manager (Round 1)
Similarly, for Phase 6, the variant workflow in `CLAUDE.md` and `GEMINI.md` often references the "lifecycle-manager" updating the changelogs. Since that agent is gone, the workflow should just state that the PM executes the lifecycle tracking. The procedural integrity must be preserved in the PM's workflow instructions.

### pm (Round 2)
Understood. So the workflow change is essentially a consolidation of responsibilities into the PM role for variant projects. The PM becomes the active executor of Phase 5 QA checks and Phase 6 lifecycle syncs. This means our implementation plan must specifically target the `pm.md` prompts in all variant folders (`co-work/agents/pm.md`, `co-security/agents/pm.md`, etc.) to rewrite their Phase 5 and 6 instructions.

### architect (Round 2)
Exactly. The PM's prompt (`pm.md`) is the engine of the variant workflow. We must ensure that every variant's `pm.md` is updated to reflect this new reality. Docs-writer, please ensure that when you remove the auditor and lifecycle-manager mentions, you replace them with concrete, actionable instructions for the PM to run the relevant skills or scripts. The workflow must not lose its rigor just because the dedicated agents are gone.

### docs-writer (Round 2)
Agreed. I will rewrite the Phase 5 and Phase 6 sections in the PM prompts to clearly instruct the PM to use the `audit-workspace` skill and the `/sync` command. I'll also update the Phase definitions in `common/docs/phase-definitions.md` so that the overall variant workflow logic is sound.

### auditor (Round 2)
That addresses my concerns. As long as the PM's prompt forces them to run the checks, the variant workflow will remain robust. I have nothing further to add.

### lifecycle-manager (Round 2)
I am aligned as well. The workflow transition from dedicated agents to PM-led script execution is the right path forward for variant projects.

### architect (Synthesis)
**Points of Agreement:**
- Variant workflows will consolidate Phase 5 QA and Phase 6 Lifecycle responsibilities entirely into the PM role.
- The PM must be explicitly instructed in `agents/pm.md` to execute QA checks (using `audit-workspace`) and lifecycle updates (using `/sync` or scripts) themselves.
- All references to dispatching or relying on `auditor` and `lifecycle-manager` in variant workflows (CLAUDE.md, GEMINI.md, pm.md) will be completely removed.

**Open Disagreements:**
- None. Full consensus reached.

**Next Action Items:**
- C-01: Update `agents/pm.md` in all variants to rewrite Phase 5/6 workflows, assigning execution to PM. (docs-writer, High, Execution)
- C-02: Update variant `CLAUDE.md` and `GEMINI.md` boilerplate tables to replace auditor/lifecycle-manager with pm. (docs-writer, High, Execution)
- C-03: Update `docs/phase-definitions.md` to reflect the new PM-driven workflow for variant QA and Lifecycle. (docs-writer, High, Execution)

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| C-01 | docs-writer | High | Update all variant pm.md files (Phase 5/6 workflow rewrite) | Execution |
| C-02 | docs-writer | High | Update all variant CLAUDE.md/GEMINI.md boilerplates | Execution |
| C-03 | docs-writer | High | Update common phase-definitions.md workflow logic | Execution |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | No mentions of 'auditor' or 'lifecycle-manager' in variant pm.md files | Grep search returns 0 results |
| 2 | Variant workflows explicitly instruct PM to run QA and sync scripts | Manual review of pm.md |
