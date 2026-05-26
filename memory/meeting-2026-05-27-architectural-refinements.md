# Meeting Transcript
**Date**: 2026-05-27
**Topic**: Architectural Refinements & Lifecycle Automation
**Participants**: PM, Template Architect, Consistency Auditor, Automation Engineer
**Rounds**: 2
**Language**: English
**Status**: Complete

---

## Transcript

**PM**: (Round 1)
Let's begin. We have four critical architectural items to resolve today. First, `CONSTITUTION.md` and related files use slow absolute GitHub URLs instead of relative paths. Second, our agent/skill lifecycle scripts (`sync-agent-status`, `sync-skill-status`) are written in shell/PowerShell, violating our rule that complex orchestration belongs in TypeScript/Bun. Third, `scripts/README.md` constantly falls out of date. Finally, we need to compare the workspace root and the template directory to identify discrepancies. Architect, let's start with the URL issue and the Root vs Template comparison.

**Template Architect**: (Round 1)
PM, the URL issue is a low-hanging fruit with high impact. Using absolute GitHub raw URLs in `AGENTS.md` and `docs/context.md` causes unnecessary network latency when AI tools fetch context. We must convert all `https://raw.githubusercontent.com/.../CONSTITUTION.md` links to relative paths like `[CONSTITUTION.md §5](CONSTITUTION.md#5-multi-agent-architecture)`. 
Regarding the Root vs Template comparison, I've noticed that core scripts in `C:\git\scripts\` (L1) and `C:\git\templates\common\scripts\` (L0) have diverged in size and logic. For example, bug fixes applied to root scripts during daily operations are not automatically backported to the templates. We need a process or tool to ensure L0 and L1 stay aligned so new projects don't inherit old bugs.

**Consistency Auditor**: (Round 1)
Architect, I agree on the URLs. For the Root vs Template sync, `validate-templates.ts` currently checks folder structure and `docs/context.md`, but it doesn't do a rigorous checksum or diff on the scripts themselves. We should introduce an automated L0 vs L1 script diffing check to prevent silent divergence. 
As for the `scripts/README.md`, it's manually maintained, which is why it's outdated. Since we already maintain `SCRIPTS.md` as the SSOT registry, we should write an automation script that regenerates `scripts/README.md` dynamically from `SCRIPTS.md`.

**Automation Engineer**: (Round 1)
Auditor, auto-generating the README is a great idea. I can write a `generate-scripts-readme.ts` utility that parses `SCRIPTS.md` and injects the updated script list into `scripts/README.md`, and we can hook this into `dev-sync`. 
Regarding the lifecycle scripts, you are correct: `sync-agent-status` and `sync-skill-status` handle complex JSON/Markdown parsing, which is brittle in `.sh` and `.ps1`. I will migrate them to `sync-agent-status.ts` and `sync-skill-status.ts` using Bun, ensuring cross-platform stability. We can then deprecate the shell versions.

**PM**: (Round 2)
Excellent breakdown. So the execution strategy is: 
1) Replace all absolute GitHub URLs with relative paths across the workspace.
2) Rewrite `sync-agent-status` and `sync-skill-status` to `.ts`.
3) Automate `scripts/README.md` generation using `SCRIPTS.md` as the source.
4) Backport necessary script fixes from root to templates and add a diff check.
Automation Engineer, how much time do you need for the TS migration?

**Template Architect**: (Round 2)
Before we finalize, I want to emphasize that for point 4 (Root vs Template), we must be careful. Some scripts in the root (like `new-project` and `validate-templates`) intentionally do not exist in the templates, and some scripts like `audit.ps1` intentionally differ because root checks all folders while template versions are project-scoped. The diff check must use an exclusion list or explicit pairing.

**Automation Engineer**: (Round 2)
Understood, Architect. I will limit the backporting to explicitly shared utility scripts (like `agent-create.ts`, `dev-sync`) and use a controlled whitelist for the L0 vs L1 diff check. The TS migration for the sync scripts is straightforward, as I can leverage our existing `fs` and `path` logic from `readme-lifecycle-audit.ts`.

**Consistency Auditor**: (Synthesis)
Let's synthesize the final plan. We have unanimous agreement on the architectural goals:
1. **Relative URLs**: Replace all `https://raw.githubusercontent.com/...` links in `AGENTS.md` and template contexts with local relative paths to eliminate network lag.
2. **TS Lifecycle Scripts**: Migrate `sync-agent-status` and `sync-skill-status` to Bun (`.ts`) and delete the `.sh/.ps1` pairs.
3. **Automated README**: Create a utility to auto-generate `scripts/README.md` from `SCRIPTS.md`.
4. **L0 vs L1 Alignment**: Compare shared scripts between `C:\git\scripts\` and `templates/common/scripts/`, backport fixes, and add a whitelist-based diff check to `validate-templates.ts` to prevent future drift.

No unresolved disagreements. We are ready to proceed to Implementation once the PM approves the concrete plan.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Automation Engineer | Regex replace absolute GitHub URLs with relative paths | Implementation |
| A-02 | Automation Engineer | Rewrite `sync-agent-status` and `sync-skill-status` in `.ts` | Implementation |
| A-03 | Automation Engineer | Create `generate-scripts-readme.ts` and update `dev-sync` | Implementation |
| A-04 | Template Architect | Audit L0 vs L1 shared scripts, backport fixes to templates | Implementation |
| A-05 | Consistency Auditor | Add L0 vs L1 script diffing logic to `validate-templates.ts` | QA Gate |
