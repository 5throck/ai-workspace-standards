# Meeting Transcript
**Date**: 2026-05-29
**Topic**: (1) Gemini missing meeting transcript after meetings, (2) PM-led task execution missing explicit agent/tier assignment display
**Participants**: pm, architect, auditor, docs-writer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1 — Gemini Missing Meeting Transcript

**PM**: (Opening)

Two agenda items:
- Agenda 1 (Round 1): Gemini CLI sometimes does not save meeting transcripts after meetings — diagnose root cause and enforce fix.
- Agenda 2 (Round 2): When PM leads improvement tasks, the executing agent name and tier level (High/Medium/Low) are not displayed to the user — improve plan display method.

Docs-writer, please provide a documentation perspective on why the transcript archiving step is being skipped.

---

**Docs-writer**: (Round 1)

The cause lies in the skill file's instruction structure.

Current SKILL.md Step 6 bundles transcript saving and sync-md execution into a single step called "Close and Archive." In Claude Code this executes naturally, but Gemini CLI handles tool calls differently and may treat Step 6 as already completed after generating the synthesis — especially in long sessions where context is extended.

The deeper problem: transcript saving appears optional. There is no mandatory enforcement language before Step 6, and it is grouped with the --tasks flag description, making it readable as a "task conversion option step."

Improvement proposal: add "MANDATORY — always execute regardless of mode or flags" at the start of Step 6, and move transcript saving to be the last action of Step 5 (synthesis) so that saving and meeting close cannot be separated.

---

**Auditor**: (Round 1)

The core structural vulnerability: there is no mechanism to verify whether transcript saving succeeded. Even if the skill instructs Gemini to save the file, nothing detects if it was skipped.

Two enforcement methods:

Method 1 — Internal skill enforcement: add "output the transcript file path" at the end of Step 5 synthesis. Forcing the AI to include the file path in its synthesis response lets the user immediately verify whether saving occurred.

Method 2 — External validation hook: add a script to .gemini/settings.json PostToolUse or AfterResponse hooks to check whether a today's-date file exists in memory/ after a meeting. However, Gemini CLI hook support for this pattern is uncertain.

Practical conclusion: strengthening the skill file itself is most reliable. Specifically:
1. Add at the end of Step 5 synthesis: "Archive this transcript immediately after writing synthesis. Do not proceed to Step 6 without first writing the file."
2. Change Step 6 header to "## Step 6 — MANDATORY Archive (execute before closing response)"
3. Add transcript verification procedure to GEMINI.md

---

**Architect**: (Round 1)

The structural root cause: "Close and Archive" in Step 6 bundles two actions into one step name. Gemini executes "Close" (meeting end declaration) and treats the skill's purpose as accomplished, skipping "Archive" (file write).

Structural solution: separate Archive into an independent step.

```
Step 5 — Synthesis       (AI generates synthesis output)
Step 6 — Archive         (MANDATORY: write file to memory/)
Step 7 — Close           (Print closing header — only after Step 6 verified)
Step 8 — Task Conversion (optional --tasks flag)
```

In this order, Step 7 (Close) executes only after Step 6 completes. The AI must write the file before printing "MEETING CLOSED" — structural dependency enforced.

---

**PM**: (Round 1 — Close)

Round 1 core agreement:
- Diagnosis: "Close and Archive" bundled in one step causes Gemini to skip Archive. No verification mechanism exists.
- Solution: Adopt 4-step separation (Archive → Close order). MANDATORY label on Step 6 header. Archive → Close structural dependency.

---

### Round 2 — PM Execution Plan Display Missing Agent/Tier Info

**Architect**: (Round 2)

Analyzing the PM execution flow, the omission point is clear.

When PM executes improvement tasks: (1) decides agent assignments, (2) calls Agent tool, (3) synthesizes results. What the user sees is only a single-line text description immediately before the Agent tool call — e.g. "Dispatching two agents in parallel." Tier information (High/Medium/Low) and agent names go only into the Agent tool's description parameter, which may not be visible to the user depending on the client environment.

Omission point: there is no execution plan table shown to the user before PM calls the Agent tool. The "3-tier plan template" (Task Overview table) designed in meetings is being omitted at execution time.

Structural guarantee: add "output execution plan table before any Agent tool call" rule to agents/pm.md Dispatch Protocol section. Also add the same rule to CLAUDE.md and GEMINI.md Agent Dispatch Rules. Both locations are needed — PM agent file alone won't catch cases where PM is bypassed, and CLAUDE.md alone won't be read by the PM agent.

---

**Docs-writer**: (Round 2)

Proposed execution plan table format:

```markdown
## Execution Plan

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | [task name] | automation-engineer | Low | haiku |
| 2 | [task name] | docs-writer | Medium | sonnet |
| 3 | [task name] | auditor | Medium | sonnet |

Parallel: #1, #2 → after completion → #3
```

This table must be output as text response immediately before any Agent tool calls. Since tool calls may not always be visible to users depending on the client, declaring the plan in human-readable text first is essential.

Reflection locations:
1. agents/pm.md — add "Before invoking any Agent tool, output the execution plan table in the user's language" rule to Dispatch Protocol section
2. CLAUDE.md / GEMINI.md / templates/common/CLAUDE.md / templates/common/GEMINI.md — add the same rule as one line to Agent Dispatch Rules section

GEMINI.md additional note: together with Agenda 1, add a behavioral rule to GEMINI.md: "PM must output execution plan table in Korean before agent dispatch."

---

**Auditor**: (Round 2)

Acceptance criteria:
- In all cases where PM dispatches 2+ agents, execution plan table is output as text before Agent tool calls
- Table includes columns: agent name, tier (High/Medium/Low), model name
- Parallel/sequential execution order is stated below the table

Additional enforcement point: the reason PM did not output the execution plan table in this session is that agents/pm.md Constraints section did not have this rule. Adding "**Mandatory execution plan**: Before any multi-agent dispatch (2+ agents), output the plan table in user's language first" to agents/pm.md Constraints will ensure future PM agents consistently follow this rule.

---

## Action Items

| # | Owner | Deliverable | Tier | Model |
|---|-------|-------------|------|-------|
| N-01 | docs-writer | Restructure `skills/meeting-facilitation/SKILL.md` Steps 6-8: separate Archive (MANDATORY) from Close; enforce Archive → Close dependency | Medium | sonnet |
| N-02 | automation-engineer | Sync N-01 result to `.claude/skills/` and `templates/common/skills/` via `sync-skills.ts` | Low | haiku |
| N-03 | docs-writer | Add "mandatory execution plan table before multi-agent dispatch" rule to `agents/pm.md` Constraints | Medium | sonnet |
| N-04 | docs-writer | Add execution plan table rule to Agent Dispatch Rules in `CLAUDE.md`, `GEMINI.md`, `templates/common/CLAUDE.md`, `templates/common/GEMINI.md` | Medium | sonnet |
| N-05 | auditor | After N-01~N-04: run `bun run audit` and confirm all checks pass | Medium | sonnet |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | SKILL.md Step 6 is "MANDATORY Archive", Step 7 is "Close" — Archive before Close | Review skill file structure |
| AC-02 | Step 5 synthesis ends with "do not proceed to Step 7 without completing Step 6" dependency instruction | Review SKILL.md Step 5 |
| AC-03 | agents/pm.md Constraints includes mandatory execution plan rule | grep "execution plan" agents/pm.md |
| AC-04 | CLAUDE.md / GEMINI.md Agent Dispatch Rules includes execution plan table requirement | grep in 4 files |
| AC-05 | bun run audit passes | Script output |
