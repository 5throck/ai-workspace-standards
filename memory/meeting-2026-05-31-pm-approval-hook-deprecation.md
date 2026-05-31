# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Deprecation of Physical PM Approval Hooks
**Participants**: pm, architect, security-expert, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user has pointed out that the `pm approval` hook (`check-pm-approval.ts`) was previously removed from the workspace root (at least in `.claude/settings.json`), but it is still present in the template directories (like `templates/co-work/.claude/settings.json`). The user wants us to review whether it should be removed from the templates as well, and to conduct a comprehensive review of this issue.

**[architect]**: (Round 1)
This is an excellent point. The physical `PreToolUse` hooks (`check-pm-approval.ts` and `clear-pm-approval.ts`) were our original attempt to enforce the PM Gateway policy by blocking Write/Edit tools if a `.pm-approved` flag wasn't present. However, we discovered that `PreToolUse` hooks do NOT fire in the Claude Code Desktop App or in Antigravity sessions. Because of this fatal platform fragmentation, we recently shifted to the **Double-Lock Strategy**: strictly enforcing the PM Gateway via Markdown boilerplate (`GEMINI.md`, `CLAUDE.md`) and Agent Constraints (`pm.md`).

**[security-expert]**: (Round 1)
Since the Double-Lock Strategy successfully enforces the sequence at the system prompt level, maintaining the physical hooks creates dead code and configuration drift. If the root `.claude/settings.json` has already removed it, leaving it in `templates/*/settings.json` will cause inconsistencies for newly scaffolded projects. Furthermore, `check-pm-approval.ts` and `clear-pm-approval.ts` are now obsolete and should be deprecated across the entire workspace.

**[lifecycle-manager]**: (Round 1)
I agree. If we deprecate those two scripts, I will need to update `SCRIPTS.md` to mark them as `deprecated`, set a removal date, and we should delete them from the `templates/common/scripts` folder so they aren't propagated to new projects.

**[pm]**: (Round 2)
Let's synthesize a plan. 
First, we need to strip `check-pm-approval.ts` and `clear-pm-approval.ts` from all `.claude/settings.json` and `.gemini/settings.json` files, both in the root and in every template variant (`co-design`, `co-develop`, `co-security`, `co-work`, `common`).
Second, we must deprecate the scripts themselves. We can remove them from the `templates/common/scripts` and update the status in `SCRIPTS.md`.
Third, we should clean up any references to these hooks in `CLAUDE.md` and `GEMINI.md` to avoid confusing future agents about a mechanism that no longer exists.

**[architect]**: (Round 2)
I fully support this. Removing obsolete architectural fragments is just as important as adding new ones. By entirely deprecating the physical hooks, we declare the "System Prompt + Boilerplate Double-Lock" as our Single Source of Truth for PM Governance. 

**[security-expert]**: (Round 2)
Make sure to check if `setup.sh` or `setup.ps1` make any references to `.pm-approved` flags, though they probably don't. We should just cleanly rip out `check-pm-approval.ts` and `clear-pm-approval.ts` from the settings files and deprecate the scripts.

**[lifecycle-manager]**: (Synthesis)
We have a consensus.
1. **Root Cause**: The physical PM approval hooks are platform-inconsistent and were rendered obsolete by the new Double-Lock Strategy, but were left dangling in template configurations and root `.gemini/settings.json`.
2. **Action Plan**:
   - Remove `check-pm-approval` and `clear-pm-approval` from all `settings.json` files (root + templates).
   - Deprecate `check-pm-approval.ts` and `clear-pm-approval.ts` (update `SCRIPTS.md` status to `deprecated`).
   - Remove the scripts from `templates/common/scripts`.
   - Remove references to `.pm-approved` from `CLAUDE.md`, `GEMINI.md`, and `AGENTS.md`.
3. **Execution**: PM will generate an Implementation Plan to perform this comprehensive cleanup.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Create Implementation Plan to remove and deprecate PM hooks globally | Planning |
| A-02 | pm | High | Present plan to user for approval | Planning |
