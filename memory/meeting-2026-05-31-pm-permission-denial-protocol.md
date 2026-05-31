# Meeting Transcript
**Date**: 2026-05-31
**Topic**: PM Role Scope Expansion Due to Permission Denials — Agent Role and Responsibility Rebalancing
**Participants**: architect, auditor, automation-engineer, security-expert
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

Permission denials during task execution have caused PM to act as a fallback executor, performing work intended for specialist agents. This erodes the PM Gateway design and creates accountability and security gaps.

---

## Key Findings

### Root Cause
`agents/pm.md` has no defined protocol for permission denial scenarios. The absence of explicit rules caused PM to implicitly become a fallback executor whenever specialist agents are blocked.

### Core Principle Agreed
> **PM is an escalation gateway, not an executor.** When a specialist agent is blocked, PM does not substitute — PM escalates.

### Permission Denial Type Classification (agreed)

| Type | Blocked Tool | PM Action |
|------|-------------|-----------|
| A | Read/Grep/Glob (read-only) | Full escalation — analysis impossible |
| B | Edit/Write (write) | Report analysis result, escalate as unapplied |
| C | Bash (execution) | Provide manual execution instructions, request user to run directly |
| D | Agent spawn | Hold entire task, explicitly report spawn intent to user |

---

## Transcript

**[Architect]**: (Round 1)

The PM Gateway model is designed for PM to act as orchestrator only, with specialist agents handling execution. When permission denials occur, specialist agents cannot proceed, and PM naturally intervenes directly. This is not a design violation but a natural fallback to system failure.

Two core problems: (1) No classification of why permission denials occur — whether user intentionally blocks a tool, permission mode misconfiguration, or specialist agent requesting broader tools than needed. (2) Accountability is unclear when PM performs fallback execution — PM-executed work bypasses the specialist audit path, creating a quality assurance gap.

Proposed: Create a permission denial type classification system first, then define clear fallback paths per type. Asked automation-engineer which tool categories PM most frequently takes over.

**[Automation Engineer]**: (Round 1)

Three most frequent denial categories: Bash execution, Write/Edit file modification, and Agent tool spawning.

Bash execution denials are most common. When specialist agent tries to run validation commands (e.g., `bun scripts/audit.ts`) and is blocked, the agent cannot complete its work and PM retries the same command. This results in PM and specialist performing identical work with identical tools — inefficient and dilutes PM's role definition.

Write/Edit denials are more severe. When specialist is blocked mid-modification, the change is lost and PM must reconstruct context from scratch, losing the specialist's detailed analysis.

Proposal: tool-level permission matrix — specify in `agents/*.md` which tools each specialist type requires, with PM presenting this matrix to users upfront. Asked security-expert about security risks of pre-declaring permission scope.

**[Security Expert]**: (Round 1)

Tool-level permission matrix is a good direction but raises a key paradox: pre-approving permissions broadly conflicts with the principle of least privilege. "Allow all tools needed for this task upfront" leads users to grant blanket approvals without context, potentially enabling unintended file modifications or system command execution.

Alternative analysis: When PM performs fallback execution, PM becomes an execution path with no audit trail. Specialist agent execution applies role-based constraints, but PM direct execution removes those constraints. Example: security-expert handles `.githooks/` modifications carefully, but PM fallback editing bypasses that care.

Two recommendations: (1) Explicitly limit PM's direct execution scope in `agents/pm.md` — tools PM may use directly in fallback, everything else escalates. (2) Automation-engineer's permission matrix should be designed as "per-task minimum privilege specification" not "upfront blanket approval."

**[Auditor]**: (Round 1)

PM fallback execution is a complete blind spot in audit.ts. The script checks file state consistency, not who modified the file. PM-executed changes and specialist-executed changes produce identical audit results — this creates ambiguity in accountability.

More fundamental: there is no explicit escalation path when permission denial occurs. Specialist blocked → PM intervenes → user may not be aware of the transition. Users may believe specialists performed work when PM actually did it — a transparency problem.

Three improvement directions: (1) Explicit declaration on permission denial — PM must immediately inform user of fallback transition. (2) Document PM fallback execution scope in `agents/pm.md`. (3) Record fallback context in commit messages or PR body. Asked architect whether adding permission matrix to agent definitions is feasible given current `agents/*.md` structure.

**[Architect]**: (Round 2)

Two problem layers identified: Layer 1 is operational transparency — PM fallback happens without declaration. Layer 2 is structural accountability — scope and auditability of fallback execution.

Adding `## Required Tools` section to `agents/*.md` is fully feasible. Currently each agent file defines roles, responsibilities, and dispatch conditions but tool usage is implicit. This section addition is straightforward.

Core design principle: **When a specialist agent's required tool is denied, the task must stop — not be substituted by PM.** PM's role is escalation, not execution. Specifically, `agents/pm.md` needs: (1) Permission Denial Protocol — ordered actions PM takes when denial occurs, (2) PM Direct Execution Scope — explicit whitelist of tools PM may use directly, (3) Escalation Template — standard format for reporting to user.

**[Automation Engineer]**: (Round 2)

Strongly agree with architect's principle — "blocked specialist → stop, not PM substitution." Three-type classification for practical implementation:

- Type A (Read-only blocked): Immediate escalation — task itself is impossible
- Type B (Write blocked): Report analysis, escalate as unapplied state
- Type C (Bash blocked): Provide manual execution instructions, request user to run directly

Under this classification, PM fallback execution is not allowed in any Type. Instead, PM escalation message format differs per Type.

**[Security Expert]**: (Round 2)

Automation-engineer's Type classification is practical and aligned with security principles. Addition: **Type D — Agent spawn blocked**. When PM attempts to spawn a specialist agent and the Agent tool itself is denied, this is the point of greatest temptation for PM to execute directly, and it is undefined in any current protocol.

Type D recommendation: If Agent spawn is blocked, PM holds the entire task and explicitly reports "which agent was being spawned and for what purpose." PM performing the work directly without spawning an agent is not permitted.

The entire discussion converges on one principle: **PM is an escalation gateway, not an executor.** The absence of this principle in `agents/pm.md` is the root cause.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | docs-writer | High | Add Permission Denial Protocol section to `agents/pm.md` — 4 Type classifications, PM Direct Execution Scope whitelist, Escalation Template | Immediate |
| A-02 | docs-writer | Medium | Add `## Required Tools` section to each `agents/*.md` — list of tools each agent requires for task execution | Immediate |
| A-03 | automation-engineer | Medium | Add Permission Denial Protocol reference to `CLAUDE.md` §5 Agent Dispatch Rules and sync to GEMINI.md | After A-01 |
| A-04 | auditor | Low | Add `agents/*.md` Required Tools section existence check to `audit.ts` (WARN level) | Phase 2 |
| A-05 | docs-writer | Low | Add "PM Direct Execution Scope" section to `AGENTS.md` | After A-01 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `agents/pm.md` has Permission Denial Protocol with 4 Types and PM Direct Execution Scope whitelist | Manual review |
| C-02 | All `agents/*.md` files have `## Required Tools` section | File check × 8 |
| C-03 | CLAUDE.md §5 references Permission Denial Protocol | Manual review |
| C-04 | GEMINI.md synchronized with CLAUDE.md §5 change | Diff check |
| C-05 | `bun scripts/audit.ts` passes | Run audit |
