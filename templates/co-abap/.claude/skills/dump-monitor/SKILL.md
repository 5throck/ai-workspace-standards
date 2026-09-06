---
name: dump-monitor
description: Use when checking SAP system health, investigating reported errors, or performing a periodic operational health check. Provides a standardized workflow using ListDumps/GetDump to detect ABAP short dumps and route new findings into /triage for investigation.
version: 1.0.0
last_reviewed: 2026-08-15
status: active
scope: co-abap
owner: devops-admin
prerequisites: vsp MCP server
relates_to:
  - skill: sap-fi
    type: composes_with
  - skill: sap-co
    type: composes_with
  - skill: sap-sd
    type: composes_with
  - skill: sap-mm
    type: composes_with
  - skill: sap-le
    type: composes_with
  - skill: abap-dev
    type: follows
  - skill: research-analysis
    type: composes_with
metadata:
  type: core
  triggers:
    - dump-monitor
    - ListDumps
    - GetDump
    - short dump
    - system health
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

## Context

This skill provides a standardized workflow for detecting and triaging ABAP short dumps in an SAP system. Without it, dumps are only found reactively when users report errors. The workflow uses `ListDumps` and `GetDump` to proactively identify runtime errors and route actionable findings into the triage process for investigation and resolution.

## Execution Steps

1. **List recent dumps** — Call `ListDumps` with a time window (default: last 24 hours or last check timestamp).
2. **Retrieve details** — For each new dump not already triaged, call `GetDump` to capture program, exception, call stack, timestamp, and user/client.
3. **Classify** — Determine if the dump is in a custom Z* object (actionable) or SAP standard (note only). Flag repeated dumps for escalation.
4. **Route** — Actionable dumps are routed to `/triage` for investigation; already-tracked dumps are skipped to avoid duplicates.
5. **Record** — Append a Dump Monitoring Report to the current session's `memory/YYYY-MM-DD.md`.

## Output Format

A structured Dump Monitoring Report appended to the session memory log, containing:
- Window checked (timestamp range)
- Total dumps found and breakdown of new vs. previously triaged
- Summary table with program, exception, timestamp, occurrences, and action taken
- Overall verdict (Clean or N actionable dumps routed)

## Related Skills

- [post-write-chain](../post-write-chain/SKILL.md) — QA gate that may catch syntax errors before they become dumps
- [abap-dev](../abap-dev/SKILL.md) — Core development workflows that produce the code under observation
- [performance-tuning](../performance-tuning/SKILL.md) — Use in conjunction when dumps indicate performance-related timeouts
