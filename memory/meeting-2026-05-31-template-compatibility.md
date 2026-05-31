# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Template Compatibility with Hardcoded Dispatch Boilerplate
**Participants**: pm, architect, scaffolding-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript always saved in English)
**Status**: Complete

---

## Transcript

**[pm]**: (Round 1)
The user has raised a critical architectural issue. We successfully hardcoded `lifecycle-manager` and `auditor` into the Execution Task Plan boilerplate in `GEMINI.md` and `CLAUDE.md`. However, these files are propagated exactly as they are to all variant templates (like `co-design`, `co-work`). When a new project is scaffolded using these templates, the PM agent in that new project will be forced to dispatch the `auditor` agent at Phase 6. The problem is, `auditor` does not exist in the scaffolded projects!

**[scaffolding-expert]**: (Round 1)
That is exactly right. Scaffolded projects only receive the agents defined in `templates/<variant>/agents` and `templates/common/agents`. `templates/common/agents` only contains `pm.md` and `lifecycle-manager.md`. The `auditor.md` agent is a "Workspace Root" agent used for developing this framework, it is NOT copied to scaffolded projects. Therefore, any PM in a new project attempting to follow the hardcoded boilerplate will crash when trying to dispatch `auditor`.

**[architect]**: (Round 1)
This is a classic case of tight coupling. We tightly coupled our workspace-specific governance agents to the universal system prompts (`GEMINI.md` / `CLAUDE.md`) which are meant to be agnostic templates for new projects. 
Actually, `bun scripts/audit.ts` *is* copied to scaffolded projects (it's in `templates/common/scripts`), so the QA gate exists, but the *agent* who runs it doesn't. 
We have two ways to fix this:
Option A: Make `auditor.md` a common agent by moving it to `templates/common/agents/`. This means every scaffolded project gets an auditor agent.
Option B: Keep the boilerplate agnostic by NOT hardcoding specific agent names, or by having a separate version of `GEMINI.md`/`CLAUDE.md` for the workspace root vs. templates. 
Wait, `GEMINI.md` and `CLAUDE.md` are currently copied directly from the root to the templates. 

**[auditor]**: (Round 1)
If you move me to `templates/common/agents/`, then I become available to all new projects. QA and auditing are universal needs. `audit.ts` already ships with every new project to verify parity and standards. If the script is there, the agent should be there too! It makes perfect architectural sense for `auditor` to be a Common Agent just like `lifecycle-manager` and `pm`.

**[scaffolding-expert]**: (Round 2)
If we move `auditor.md` to `templates/common/agents/`, we solve the missing agent crash. But wait, what about `automation-engineer`, `docs-writer`, `security-expert`, `architect`? If you look at `templates/co-work/AGENTS.md`, it lists all these agents under the "Specialist Agent Roster", but they aren't actually in the templates!

**[architect]**: (Round 2)
Oh no. The template `AGENTS.md` files are severely bloated with root workspace agents that they don't actually possess. 
But regarding the boilerplate issue: the immediate fix is that any agent hardcoded into the system prompt boilerplate MUST be a Common Agent.
Since we hardcoded `lifecycle-manager` and `auditor`, they both must live in `templates/common/agents/`.
`lifecycle-manager.md` is already there. `auditor.md` is currently at the root `agents/auditor.md`.
We must move `agents/auditor.md` to `templates/common/agents/auditor.md` and register it in `templates/common/common-contract.json`. 

**[pm]**: (Synthesis)
We have a consensus.
1. **Root Cause**: The `GEMINI.md`/`CLAUDE.md` boilerplate mandates the use of the `auditor` agent, but `auditor` is not currently distributed to new projects via the templates.
2. **Solution**: Promote `auditor` to a Common Agent. Move `agents/auditor.md` to `templates/common/agents/auditor.md` so that it is scaffolded into every new project alongside `audit.ts`.
3. **Execution**: The PM will generate an Implementation Plan to perform this promotion, update the registries, and resolve the template compatibility issue.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | pm | High | Create Implementation Plan to promote `auditor` to Common Agent | Planning |
| A-02 | pm | High | Present plan to user for approval | Planning |
