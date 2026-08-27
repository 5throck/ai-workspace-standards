Arguments: $ARGUMENTS

Comprehensive parallel review of the current project by all available specialist agents.

## When to Use

- User explicitly requests a full project review (`/project-review`)
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

## Tool Guidance (Optional — base-map MCP)

> **If `mcp__base-map__*` tools are available** in the current environment, use them as an
> **optional enhancement** alongside specialist agents. If not available, skip silently —
> specialist agents already provide full domain coverage.
>
> | Tool | When | Purpose |
> |------|------|---------|
> | `mcp__base-map__review_code` | Step 3 | Parallel code review of key scripts |
> | `mcp__base-map__generate_tests` | Step 3 (optional) | Test coverage analysis for reviewed scripts |
> | `mcp__base-map__implement_code` | Step 5 (remediation plans) | Preferred code generation for action items |

## Step 3 — Dispatch Agents in Parallel

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

### Optional: Parallel base-map Code Review

If `mcp__base-map__review_code` is available, run it in parallel alongside agent dispatch:

```
Key scripts to review (adjust based on project structure):
- scripts/dev-sync.ts (sync pipeline orchestrator)
- scripts/safety-audit.ts (audit tool)
- scripts/sync-skills.ts (skill sync)
- scripts/generate-version-manifest.ts (version management)
```

Call `mcp__base-map__review_code` for each key script with a prompt like:
```
"Review this script for code quality, error handling, security, and maintainability.
Report Critical/High/Moderate/Low findings with file paths and line numbers."
```

If `mcp__base-map__review_code` is **not available**, skip this subsection entirely —
the dispatched specialist agents already cover code review in their domains.

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

### Remediation Plan Execution Method

When producing the remediation plan (as a separate document or inline), include this header:

```
> **Execution method:** If available, use base-map MCP (`mcp__base-map__implement_code`)
> for code generation tasks; otherwise, use direct file Edit/Write for all changes.
```

This ensures workers can leverage `mcp__base-map__implement_code` when present while falling back
to standard tools when it is not. Non-code changes (docs, configs, frontmatter) always use
direct Edit/Write regardless of base-map availability.
