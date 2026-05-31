# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Verify expansion of memory archiving and .gitignore updates to templates
**Participants**: architect, scaffolding-expert, auditor, lifecycle-manager
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**PM**: The meeting is open. The user proposed automatically moving logs older than 7 days from `memory/` to `memory/archive/`, and appending `memory/archive/` to `.gitignore` to prevent Git tracking (reducing clutter) while preserving the files locally. We need to evaluate if this change should be propagated to all project templates (`templates/co-*`), and if there are any technical or architectural constraints.

**Architect**: (Round 1)
I agree with the PM's topic. Since templates inherit the workspace standards, individual projects generated from these templates will experience the exact same `memory/` bloat. Therefore, a structural approach is needed: we should place the archiving script (e.g., `archive-memory.ts`) in `templates/common/scripts/` and add `memory/archive/` to the `.gitignore` of every template. We must also modify the 30-day rule to 7 days in `CONSTITUTION.md §2.3` to ensure structural consistency. Scaffolding-expert, are there any generation mechanics to watch out for when placing these in the common templates?

**Scaffolding-expert**: (Round 1)
As Architect mentioned, adding the script to `templates/common/scripts/` ensures it automatically gets copied to new projects via `new-project.ts`. Adding the path to the template's root `.gitignore` also works seamlessly with our scaffolding rules. However, existing projects (like Pricing-Mgmt-Simulation) won't inherit this retroactively. We must add logic to the `upgrade-project` script to patch `.gitignore` files for full backward compatibility. Auditor, will this approach conflict with any existing QA policies?

**Auditor**: (Round 1)
Reviewing Scaffolding-expert's suggestion, ignoring `memory/archive/` in Git does not violate the "Never delete logs" rule of `CONSTITUTION.md`, because the files remain intact on the local disk. However, we must decide whether QA gates like `audit.ts` should format-check the files inside the untracked `memory/archive/` folder. For performance reasons, I recommend we bypass the archive directory during memory log validation. Lifecycle-manager, are there any registry sync issues to consider?

**Lifecycle-manager**: (Round 1)
I agree with Auditor. With the introduction of a new `archive-memory.ts` script, we need to register it in `SCRIPTS.md`. Additionally, since `.gitignore` modifications affect both root and templates, we should ideally ensure our parity checks (e.g., in `validate-templates.ts`) verify that the template `.gitignore` files match the root `.gitignore` rule for the archive folder.

**Architect**: (Round 2)
Summarizing everyone's points, there are no technical hurdles. Our architecture will be:
1. Create `archive-memory.ts` and propagate it to `templates/common/scripts/`.
2. Update `.gitignore` in root and all templates.
3. Update `CONSTITUTION.md §2.3` to reflect 7-day retention.
This preserves system integrity.

**Scaffolding-expert**: (Round 2)
I agree with Architect's structural proposal, and I will ensure the `.gitignore` patch logic is added to `upgrade-project` scripts so legacy projects also benefit from auto-archiving.

**Auditor**: (Round 2)
I have validated the plans. As a concrete action item, the `audit.ts` memory log validation logic must be explicitly updated to ignore the `memory/archive/` path.

**Lifecycle-manager**: (Round 2)
The plan is clear. Once implementation is done, I will handle the Phase 6 Finalization by updating `SCRIPTS.md` and `CHANGELOG.md` to record the new workflow.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Create `archive-memory.ts` and integrate with `dev-sync.ts` | Phase 4 |
| A-02 | docs-writer | Medium | Update `.gitignore` (root + templates) and `CONSTITUTION.md` 7-day rule | Phase 4 |
| A-03 | scaffolding-expert | Low | Inject `.gitignore` patch logic into `upgrade-project` scripts | Phase 4 |
| A-04 | automation-engineer | Low | Update `audit.ts` to ignore `memory/archive/` during log checks | Phase 4 |
| A-05 | lifecycle-manager | Medium | Register script in `SCRIPTS.md` and update `CHANGELOG.md` | Phase 6 |

## Acceptance Criteria (if any)

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `memory/archive/` is ignored by Git in root and all templates | Check `.gitignore` contents |
| 2 | `audit.ts` passes without trying to validate archived logs | Run `bun scripts/audit.ts` |
| 3 | Old projects get the rule when upgraded | Inspect `upgrade-project` script |
