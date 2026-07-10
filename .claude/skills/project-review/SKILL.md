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
  phase schema changes, workspace-schema.json modified, new variant added);
  QA escalation from auditor (audit.ts ERROR >= 3 or security Critical finding).
owner: pm
version: 1.1.0
last_reviewed: 2026-07-10
prerequisites: []
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

## Step 0 — Detect Optional Enhancements

Before starting, check for **optional MCP tool availability**. These tools enhance the review but are **NOT required** — the skill works fully without them.

### base-map MCP Availability Check

Check if any `mcp__base-map__*` tools are available in the current session:
- `mcp__base-map__ask_local_llm` — local model for analysis, summarization, cross-validation
- `mcp__base-map__review_code` — automated code review
- `mcp__base-map__generate_tests` — test generation
- `mcp__base-map__implement_code` — code generation from requirements

**Detection method**: Attempt to list or call any `mcp__base-map__*` tool. If the tool set exists, set a session flag `BASE_MAP_AVAILABLE = true`. If not (tool not found, timeout, or error), set `BASE_MAP_AVAILABLE = false` and proceed without MCP enhancement.

```
BASE_MAP_AVAILABLE = (mcp__base-map__models or mcp__base-map__ask_local_llm exists)
```

> **Important**: Not all users have base-map MCP configured. The review MUST complete successfully regardless of availability. base-map is a performance enhancer, not a dependency.

### When base-map MCP IS Available

Use it for the following enhancements throughout the review:
- **Large file summarization**: `ask_local_llm` to summarize files too large to read in full
- **Cross-validation**: `ask_local_llm` to validate findings across domains (e.g., "Does this code issue also appear in the architecture?")
- **Code review**: `review_code` on critical scripts during automation-engineer review
- **Synthesis**: `ask_local_llm` to deduplicate and prioritize findings from all agents

### When base-map MCP is NOT Available

Skip all `mcp__base-map__*` calls. The review proceeds using only the native Agent tool and direct file reads. Results are equivalent — base-map only adds secondary validation efficiency.

## Step 1 — Detect Project Context

Before dispatching agents, determine the execution context:

1. **List available agents**: scan `agents/` directory for `*.md` files (excluding README)
2. **Determine project type**: check for `docs/context.md` (variant project) or workspace root indicators
3. **Announce context**:
   ```
   Project type: [workspace-root | co-develop | co-design | co-work | co-security | custom]
   Available agents: [list]
   Review domains: [mapped domains]
   base-map MCP: [available | not available]
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

### Claude Code / ZCode (Platform: claude)

Dispatch all agents simultaneously using the `Agent` tool with `run_in_background: true`:

```
For each agent in the execution plan:
  Agent(
    description = "[Domain] review",
    prompt = "You are the [agent] for this project at [path].
              Review your domain and report: Critical Issues, High Issues,
              Moderate Issues, Strengths. Include file paths and line numbers.
              Research only — do NOT modify any files.

              [IF BASE_MAP_AVAILABLE]:
              You have access to base-map MCP tools (mcp__base-map__ask_local_llm,
              mcp__base-map__review_code). Use them to:
              - Summarize large files before detailed analysis
              - Cross-validate findings with a secondary model
              - Review critical code files with mcp__base-map__review_code
              - Ask mcp__base-map__ask_local_llm for pattern analysis across files

              [ENDIF]",
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

After all agents complete, PM synthesizes findings into a prioritized improvement table.

### 4a — Collect Raw Findings

Gather all agent reports from Step 3. Each report should contain:
- 🔴 Critical Issues (with file paths and line numbers)
- 🟡 High Issues (with file paths and line numbers)
- 🟢 Moderate Issues (with file paths and line numbers)
- ✅ Strengths

### 4b — Cross-Domain Deduplication

Multiple agents may report the same issue from different perspectives (e.g., architecture finds a phase numbering error that documentation also flags). Deduplicate by merging:

```
For each issue found by multiple agents:
  Merge into a single entry
  Credit all discovering agents
  Use the most specific file path / line number
  Use the highest severity rating among duplicates
```

### 4c — base-map MCP Enhanced Validation (Optional)

**Only if `BASE_MAP_AVAILABLE = true`:**

Use `mcp__base-map__ask_local_llm` for additional cross-validation:

```
mcp__base-map__ask_local_llm(
  prompt = "You are a cross-domain review validator. I have findings from 7 review
            domains for this project. Analyze these findings for:
            1. False positives — findings that may be incorrect
            2. Missing issues — obvious problems not caught by any domain
            3. Root cause chains — multiple findings that share a root cause
            4. Priority conflicts — findings whose severity may be misrated

            Here are the findings:
            [concatenated findings from all agents]

            Return: validated findings with adjustments, grouped by root cause."
)
```

For critical code files, use `mcp__base-map__review_code`:
```
mcp__base-map__review_code(
  code = "[content of critical script file]"
)
```

> **If base-map MCP is NOT available**: Skip 4c entirely. The agent reports from Step 3 are authoritative.

### 4d — Final Report Format

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

### 4e — Domain Summary Table

```markdown
| Domain | 🔴 Critical | 🟡 High | 🟢 Moderate | ✅ Strengths |
|--------|:-----------:|:-------:|:------------:|:------------:|
| Architecture | | | | |
| Standards | | | | |
| Automation | | | | |
| Documentation | | | | |
| Security | | | | |
| Lifecycle | | | | |
| Scaffolding | | | | |
| **Total** | | | | |
```

## Step 5 — Generate Action Items

Create a prioritized action item table:

| # | Owner | Deliverable | Priority | Phase |
|---|-------|-------------|----------|-------|

> Pass `--tasks` flag to automatically convert action items into tracked tasks via `TaskCreate`.

## Platform Execution Notes

| Platform | Agent Dispatch | Parallel? | base-map MCP | Notes |
|----------|--------------|-----------|:------------:|-------|
| Claude Code (CLI) | `Agent` tool | ✅ Yes | if configured | Use `run_in_background: true` for all agents |
| Claude Code (Desktop) | `Agent` tool | ✅ Yes | if configured | Same as CLI |
| ZCode | `Agent` tool | ✅ Yes | if configured | Same as CLI |
| Antigravity / Gemini CLI | `/meeting --dialogue` | Inline seq. | ❌ No | Agents speak in turn; PM synthesizes |
| Any platform (fallback) | Inline roleplay | Sequential | ❌ No | `/meeting "project review" --agents [list]` |

## base-map MCP Integration Reference

| Step | MCP Tool | Purpose | Required? |
|------|----------|---------|:----------:|
| 0 | `mcp__base-map__models` | Check MCP availability | Detection |
| 3 | `mcp__base-map__review_code` | Review critical scripts during agent dispatch | Optional |
| 3 | `mcp__base-map__ask_local_llm` | Summarize large files for agents | Optional |
| 4c | `mcp__base-map__ask_local_llm` | Cross-domain deduplication & validation | Optional |
| 4c | `mcp__base-map__review_code` | Second-opinion review on flagged files | Optional |

### Recommended base-map Usage Patterns

**Pattern 1 — Large File Summary (before agent reads)**
```
mcp__base-map__ask_local_llm(
  prompt = "Summarize this file's structure, key functions, and potential issues:
            [first 200 lines of large file]"
)
```

**Pattern 2 — Cross-Validation (after agent reports)**
```
mcp__base-map__ask_local_llm(
  prompt = "Review these findings for false positives and missing issues:
            [all agent findings concatenated]"
)
```

**Pattern 3 — Code Review (for critical scripts)**
```
mcp__base-map__review_code(
  code = "[file content]",
  model = "google/gemma-4-e4b"
)
```

## Trigger Reference

| Trigger | Invoker | Condition |
|---------|---------|-----------|
| T-01: User request | User | `/project-review` or natural language equivalent |
| T-02: PM autonomous | PM agent | 3+ agent files modified; phase schema changed; `workspace-schema.json` modified; new variant added |
| T-03: QA escalation | auditor / security-monitor | `audit.ts` ERROR ≥ 3; or security-expert Critical finding |
