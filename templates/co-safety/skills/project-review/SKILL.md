---
name: project-review
status: active
scope: common
description: >
  Performs a comprehensive parallel review of the current project using all
  available specialist agents. Auto-detects project type and agent roster,
  generates an execution plan, dispatches agents in parallel, and produces
  a prioritized improvement plan (Critical/High/Medium/Low).
  Use when: user requests a full project review ("/project-review" or
  "do a full project review"); PM detects structural changes (3+ agent files modified,
  phase schema changes, variant.json modified, new domain added);
  QA escalation from auditor (safety-audit.ts ERROR >= 3 or Critical finding).
owner: pm
version: 1.1.0
last_reviewed: 2026-07-08
metadata:
  type: process
  triggers:
    - project review
    - review project
    - audit project
    - quality review
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# project-review

Comprehensive parallel review of the current project by all available specialist agents.

## When to Use

- User explicitly requests a full project review
- PM detects structural changes requiring cross-domain validation
- QA escalation: `safety-audit.ts` exits with 3+ ERRORs, or audit-agent finds a Critical issue

## Step 1 — Detect Project Context

Before dispatching agents, determine the execution context:

1. **List available agents**: scan `agents/` directory recursively for `*.md` files (excluding README)
2. **Determine project type**: check for `variant.json` (variant project like Safety OS) or workspace root indicators
3. **Announce context**:
   ```
   Project type: [variant: co-safety | workspace-root | custom]
   Available agents: [list]
   Review domains: [mapped domains]
   ```

## Step 2 — Generate Execution Plan

Map available agents to review domains. Present the plan table and wait for user approval before proceeding:

| # | Domain | Agent | Tier | Focus |
|---|--------|-------|------|-------|
| 1 | Safety Governance | safety-governance-manager | High | Strategy, KPIs, SAPA compliance objectives |
| 2 | Regulatory Compliance | compliance-agent | Medium | OSHA-KR/SAPA validation, legal_basis gate |
| 3 | Risk Management | risk-assessment-agent | Medium | Risk register, hazard identification |
| 4 | Process Safety | psm-agent | Medium | OSHA-KR Article 44, PHA, MOC, LOTO |
| 5 | Emergency Preparedness | emergency-agent | High | Emergency protocols, incident escalation |
| 6 | Documentation & Audit | audit-agent | Medium | Evidence traceability, audit readiness |
| 7 | Training & Operations | training-agent | Medium | Training records, compliance tracking |

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
| T-02: PM autonomous | PM agent | 3+ agent files modified; domain/workflow changes; `variant.json` modified; new domain added |
| T-03: QA escalation | audit-agent / compliance-agent | `safety-audit.ts` ERROR ≥ 3; or Critical finding in domain review |
