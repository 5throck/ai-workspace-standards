---
name: Dump Monitoring
description: Use when checking SAP system health, investigating reported errors, or performing a periodic operational health check. Provides a standardized workflow using ListDumps/GetDump to detect ABAP short dumps and route new findings into /triage for investigation.
metadata:
  type: core
version: 1.0.0
---

# Dump Monitoring Workflow

Closes an observability gap: without this skill, ABAP short dumps are only found reactively
when a user reports an error. Owned by **DevOps/Admin** (`agents/devops-admin.md`); any agent
may run it as part of a health check.

## When to Use

- User asks for a system health check ("is anything broken", "check for dumps", "system status")
- Before a release/transport window, as a pre-flight sanity check
- Periodically, if the operator has wired this workflow into an external scheduler (see below)
- After a user reports intermittent errors with no clear repro steps — check for a matching dump first

## Workflow

```
1. List recent dumps
   ListDumps(since=<last-check-timestamp or 24h ago>)

2. For each new dump not already triaged (cross-reference against
   scratch/qa-reports/ or memory/ logs from prior checks):
   GetDump(dump_id) → capture: program, exception, call stack, timestamp, user/client

3. Classify
   - Runtime error in a Z*/custom object → candidate for /triage with classification "Debug"
   - Runtime error in an SAP standard object → note only, do not modify standard code
   - Repeated dump (same program/exception, multiple occurrences) → escalate priority

4. Route
   - New, actionable dump → run `/triage "Investigate dump: <program> — <exception>"`
   - Already-tracked dump → skip (avoid duplicate task files)

5. Record
   Append a Dump Monitoring Report (below) to the current session's memory/YYYY-MM-DD.md
```

## Dump Monitoring Report Format

```markdown
### Dump Monitoring — <date/time of check>

**Window checked**: <since timestamp> → now
**Dumps found**: <N> (<M> new, <N-M> previously triaged)

| # | Program | Exception | Timestamp | Occurrences | Action |
|---|---------|-----------|-----------|--------------|--------|
| 1 | ZCL_EXAMPLE | UNCAUGHT_EXCEPTION | 2026-07-10 14:02 | 3 | Routed to /triage |

**Verdict**: <Clean / N actionable dump(s) routed to triage>
```

## Scheduling Note

This harness has no built-in cron. To run this check periodically, wire an external scheduler
(OS cron / Windows Task Scheduler / a CI scheduled workflow) to invoke the AI tool with a fixed
prompt such as *"Run the Dump Monitoring workflow from skills/dump-monitor/SKILL.md"* — this
keeps the mechanism portable across Claude Code, Gemini CLI, and Antigravity rather than tying
it to one platform's session-level scheduler.

## Related

- [agents/devops-admin.md](../../agents/devops-admin.md) — primary owner
- [.claude/commands/triage.md](../../.claude/commands/triage.md) — destination for actionable findings
- [skills/performance-tuning/SKILL.md](../performance-tuning/SKILL.md) — use together when a dump indicates a performance-related timeout
