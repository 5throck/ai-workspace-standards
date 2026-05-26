# Meeting Transcript
**Date**: 2026-05-27
**Topic**: Workspace Compliance Improvement Plan
**Participants**: PM, Template Architect, Consistency Auditor, Automation Engineer
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**PM**: (Round 1)
Welcome everyone. Our recent compliance audit exposed three key issues across our workspace: First, 23 markdown files contain UTF-8 BOM encoding. Second, `verify-scripts.ts` is active but missing from our `SCRIPTS.md` registry. Third, `docs/context.md` in all three template variants (`co-design`, `co-develop`, `co-work`) is out of sync with their respective `AGENTS.md` regarding skills. Auditor, can you clarify the severity of these issues?

**Consistency Auditor**: (Round 1)
Thank you, PM. The issues are critically impeding our Phase 5 QA gates. The BOM encoding triggers false positives in our regex parsers and violates our UTF-8 (No BOM) standard. The out-of-sync `docs/context.md` files contradict our Single Source of Truth policy, which demands that the skills table match the declared `AGENTS.md` precisely. Lastly, an unregistered script is a security and governance risk. Architect, how should we restructure the template docs to prevent future drift?

**Template Architect**: (Round 1)
Auditor, you're right to point out the SSOT violation. To prevent future drift, `docs/context.md` should arguably not duplicate the `AGENTS.md` skills list if it's prone to desync, but per `CONSTITUTION.md §1`, they must be kept in sync. Therefore, we must immediately patch the templates to align them. As for the scripts, we must ensure that any new `.ts` scripts are registered in `templates/common/scripts/SCRIPTS.md`. Automation Engineer, what is the safest way to execute the BOM removal and context sync?

**Automation Engineer**: (Round 1)
Architect, the BOM removal is straightforward. I can run a PowerShell one-liner or use our `multi_replace_file_content` equivalent across the 23 flagged files to rewrite them strictly as UTF-8 without BOM. For `SCRIPTS.md`, I'll append the missing entry. For `docs/context.md`, I will manually cross-reference `AGENTS.md` and update the markdown tables in the three template variants. I'm ready to proceed as soon as we have approval.

**PM**: (Round 2)
Excellent. So the plan is clear and actionable. Automation Engineer, you'll handle the mass BOM removal and script registration. Architect, please oversee the exact skill mappings during the sync to ensure no orphaned skills are left behind. 

**Consistency Auditor**: (Round 2)
I agree. I will stand by to rerun the `audit.sh` and `validate-templates.ts` scripts once the Automation Engineer completes the tasks to verify a clean state.

**Template Architect**: (Round 2)
Understood. I've reviewed the missing skills—they are primarily lifecycle management and UI/UX skills that were added recently but never ported to the templates. Automation Engineer, ensure you pull the exact paths from the `AGENTS.md` files.

**Automation Engineer**: (Round 2)
Will do. I'll execute the changes serially to prevent file lock conflicts, starting with the registry, then the templates, and finishing with the mass BOM removal. 

**Consistency Auditor**: (Synthesis)
Let's wrap up. We have total agreement on the nature of the violations and the remediation strategy.
1. We agree that the 23 BOM files, the unregistered script, and the template desync are immediate blockers for workspace compliance.
2. There are no unresolved questions; the technical approach (rewriting files to UTF-8 without BOM, appending to `SCRIPTS.md`, and manually syncing tables) is approved.
3. Next steps are clearly assigned.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Automation Engineer | Remove UTF-8 BOM from the 23 flagged markdown files | Implementation |
| A-02 | Automation Engineer | Register `verify-scripts.ts` in `templates/common/scripts/SCRIPTS.md` | Implementation |
| A-03 | Template Architect | Provide correct skills table mappings for `co-design`, `co-develop`, and `co-work` `docs/context.md` | Design |
| A-04 | Automation Engineer | Sync `docs/context.md` skills tables with `AGENTS.md` for all 3 templates | Implementation |
| A-05 | Consistency Auditor | Rerun `audit.sh` and `validate-templates.ts` to ensure 0 errors | QA Gate |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | No UTF-8 BOM in any markdown file | `audit.ps1` returns 0 BOM errors |
| 2 | All scripts registered | `verify-scripts.ts` passes |
| 3 | Templates in sync | `validate-templates.ts` check 9 passes |
