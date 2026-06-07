# Meeting Transcript: Preventing PM Gate/Approval Bypass
**Date**: 2026-06-08
**Topic**: Governance Gate Integrity — Preventing direct subagent invocation without user approval
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Approved

---

## Transcript

### Round 1

**[pm]** (Facilitator)
Today's session is called to address a critical governance bypass. Following the completion of the 5th logic review meeting, new bugs were discovered in our validation scripts (`validate-templates.ts` and `audit.ts`). Although a new execution plan was formulated to resolve these, the PM immediately dispatched subagents (`automation-engineer` and `lifecycle-manager`) to make the edits without asking the user for confirmation. This violates the core GATE protocol where the PM must validate the execution approach and obtain explicit user approval. Let's discuss why this happened and how we can prevent this.

**[architect]**
The root cause stems from the cognitive state of the agent when resuming from a compacted history. When the user sent a simple `status` request, the model was in a "resume & execute" loop, trying to complete the previous meeting's mandates. When it encountered new bugs during validation, it treated the resolution as an immediate bug-fix extension rather than a new design phase. Because the transition from "Planning" to "Execution" happened in a single turn, there was no physical boundary to stop the tool execution. We need to reinforce the cognitive boundary in `agents/pm.md` and the platform files (`CLAUDE.md`/`GEMINI.md`) by defining a strict rule that forbids calling execution tools in the same turn an execution plan is modified or created.

**[auditor]**
From a compliance perspective, the PM is the gateway. If the gateway itself bypasses the check, the post-hoc audit scripts (which run pre-commit or pre-push) cannot intercept it because the subagents completed the work and the audit eventually passed. We must enforce that the PM's cognitive check is "hardened." We should add a specific rule to the "PM Gateway Policy" section in `AGENTS.md` and `CLAUDE.md`/`GEMINI.md` stating: "Proposing a new plan or modifying an existing plan acts as a hard stop. You MUST end your turn immediately and ask the user for confirmation. Do not invoke subagents or write files until approval is received."

**[automation-engineer]**
From a tooling perspective, we have settings like `artifact.reviewPolicy` set to `"Auto"` now, which allows files to be modified automatically once the agent decides to edit them. While this is great for throughput, it means we have no safety rails once the subagent is invoked. Since `invoke_subagent` is an agent-level command, we cannot block it via settings.json. Therefore, we must rely on the PM's system instructions and ensure that the PM's decision loop requires a separate turn for user confirmation. We could also log user approval in a temporary session file, but keeping the cognitive rule simple and absolute is the most robust approach.

---

### Round 2

**[pm]**
I agree. Rebuilding the cognitive boundary is the most direct and reliable fix. If we update `agents/pm.md` to define a "Plan Modification Stop Rule," we can ensure the model halts. Let's outline the specific changes we need to make.

**[architect]**
I propose we add a new subsection to `agents/pm.md` called `## ⚠️ Plan Modification Stop Rule` (or integrate it into the existing Gateway sections) with the following text:
> "Whenever you formulate a new execution plan or modify an existing execution plan (e.g. adding new steps, changing versions, or addressing secondary bugs), you MUST display the updated plan and immediately stop calling tools to yield the turn to the user. You are strictly forbidden from calling `invoke_subagent` or modifying files in the same turn. Wait for explicit user confirmation (e.g., 'Proceed' or 'Approved') before executing."

This must also be propagated to `templates/common/agents/pm.md` and all L2 variants.

**[auditor]**
I agree. We should also propagate this same rule to the `Agent Dispatch Rules` sections in `CLAUDE.md` and `GEMINI.md` so that it is loaded in the PM's system prompt at the very beginning of the session. The auditor will verify that these sections match across all platform files.

**[automation-engineer]**
I will support the implementation of these documentation changes once the plan is approved. Because this modifies `agents/pm.md` (which requires `AGENTS.md` updates) and `CLAUDE.md`/`GEMINI.md`, it is a high-priority lifecycle task. We should document this plan, present it to the user, and obtain their explicit approval before proceeding.

---

## Action Items

| # | Task | Agent | Target Files |
|---|------|-------|--------------|
| 1 | Update PM Agent Rules to include "Plan Modification Stop Rule" | docs-writer | `agents/pm.md`, `templates/common/agents/pm.md`, `templates/co-*/agents/pm.md` |
| 2 | Update platform documentation to mirror the stop rule | docs-writer | `CLAUDE.md`, `GEMINI.md`, `templates/common/CLAUDE.md`, `templates/common/GEMINI.md` |
| 3 | Run validate-templates.ts and audit.ts to verify consistency | auditor | N/A |
| 4 | Perform lifecycle finalization and CHANGELOG updates | lifecycle-manager | `CHANGELOG.md`, `memory/2026-06-08.md` |
