---
name: project-review
status: active
description: >
  Performs a comprehensive parallel review of the current project using all
  available specialist agents. Auto-detects project type and agent roster,
  generates an execution plan, dispatches agents in parallel, and produces
  a prioritized improvement plan (Critical/High/Medium/Low).
  Use when: user requests a full project review ("/project-review" or
  "do a full project review"); PM detects structural changes (3+ agent files modified,
  phase schema changes, workspace-schema.json modified, new variant added);
  QA escalation from auditor (audit.ts ERROR >= 3 or security Critical finding).
owner: pm
version: 1.0.0
last_reviewed: 2026-05-30
metadata:
  type: process
  triggers:
    - project review
    - review project
    - audit project
    - quality review
---

# project-review

Comprehensive parallel review of the current project by all available specialist agents.

## When to Use

- User explicitly requests a full project review
- PM detects structural changes requiring cross-domain validation
- QA escalation: `audit.ts` exits with 3+ ERRORs, or security-expert finds a Critical issue

## Step 1 — Detect Project Context

Before dispatching agents, determine the execution context:

1. **List available agents**: scan `agents/` directory for `*.md` files (excluding README)
2. **Determine project type**: check for `docs/context.md` (variant project) or `CONSTITUTION.md` (workspace root)
3. **Announce context**:
   ```
   Project type: [workspace-root | co-develop | co-design | co-work | co-security | custom]
   Available agents: [list]
   Review domains: [mapped domains]
   ```

## Step 2 — Generate Execution Plan

Map available agents to review domains. Present the plan table and wait for user approval before proceeding:

| # | Domain | Agent | Tier | Focus |
|---|--------|-------|------|-------|
| 1 | Architecture | architect (if available, else PM) | High | Structure, phase consistency, variant contracts |
| 2 | Standards compliance | auditor (if available, else PM) | Medium | audit.ts, validate-templates.ts, SCRIPTS.md |
| 3 | Automation | automation-engineer (if available, else PM) | Medium | Hooks, scripts, package.json, CI |
| 4 | Documentation | docs-writer (if available, else PM) | Medium | References, language policy, cross-links |
| 5 | Security | security-expert or security-monitor | Medium | Secrets, CI permissions, injection risks |
| 6 | Lifecycle | lifecycle-manager | Medium | Agent/skill/script health, sync parity |
| 7 | Scaffolding | scaffolding-expert (workspace only) | Medium | Template structure, variant contract |

> If an agent is not available for a domain, PM covers that domain directly with a lightweight check.

## Step 3 — Dispatch Agents in Parallel

### Claude Code (Platform: claude)

Dispatch all agents simultaneously using the `Agent` tool with `run_in_background: true`:

```
For each agent in the execution plan:
  Agent(
    description = "[Domain] review",
    prompt = "You are the [agent] for this project at [path].
              Review your domain and report: Critical Issues, High Issues,
              Moderate Issues, Strengths. Include file paths and line numbers.
              Research only — do NOT modify any files.",
    run_in_background = true
  )
```

Wait for all agents to complete, then proceed to Step 4.

### Antigravity / Gemini CLI (Platform: antigravity)

Use the `/meeting` skill with all available agents in dialogue mode:

```
/meeting "Comprehensive project review" --agents [comma-separated agent list] --rounds 2 --dialogue
```

Each agent reviews their domain in the meeting. PM synthesizes findings after Round 2.

### Fallback (no Agent tool available)

Role-play each agent sequentially using the inline meeting approach:
```
/meeting "Comprehensive project review" --agents [list] --rounds 2
```

## Step 4 — Collect and Synthesize Results

After all agents complete, PM synthesizes findings into a prioritized improvement table:

```markdown
## Review Results — [Project Name] — [Date]

### 🔴 Critical (fix immediately)
| # | Issue | Agent | File | Fix |
|---|-------|-------|------|-----|

### 🟡 High (fix within 1 week)
| # | Issue | Agent | File | Fix |
|---|-------|-------|------|-----|

### 🟢 Moderate (fix within 2 weeks)
| # | Issue | Agent | File | Fix |
|---|-------|-------|------|-----|

### ℹ️ Low / Improvements
| # | Suggestion | Agent | Notes |
|---|-----------|-------|-------|

### ✅ Strengths
- [What is working well]
```

## Step 5 — Generate Action Items

Create a prioritized action item table:

| # | Owner | Deliverable | Priority | Phase |
|---|-------|-------------|----------|-------|

> Pass `--tasks` flag to automatically convert action items into tracked tasks via `TaskCreate`.

## Platform Execution Notes

| Platform | Agent Dispatch | Parallel? | Notes |
|----------|--------------|-----------|-------|
| Claude Code (CLI) | `Agent` tool | ✅ Yes | Use `run_in_background: true` for all agents |
| Claude Code (Desktop) | `Agent` tool | ✅ Yes | Same as CLI |
| Antigravity / Gemini CLI | `/meeting --dialogue` | Inline sequential | Agents speak in turn; PM synthesizes |
| Any platform (fallback) | Inline roleplay | Sequential | `/meeting "project review" --agents [list]` |

## Trigger Reference

| Trigger | Invoker | Condition |
|---------|---------|-----------|
| T-01: User request | User | `/project-review` or natural language equivalent |
| T-02: PM autonomous | PM agent | 3+ agent files modified; phase schema changed; `workspace-schema.json` modified; new variant added |
| T-03: QA escalation | auditor / security-monitor | `audit.ts` ERROR ≥ 3; or security-expert Critical finding |
