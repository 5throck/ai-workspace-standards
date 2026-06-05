# Parallel Dispatch Template

Use this template when dispatching multiple read-only subagents simultaneously.

---

## When to Use

- Read-only research (codebase scan, schema inspection, data queries)
- Independent analysis tasks that don't share state
- Phase 1 triage and investigation

---

## Template

```
Agent(
  description = "Brief description of subagent 1",
  prompt = """You are a [role]. Your task is to [specific task].

Context: [relevant context, file paths, expectations]

Output format: [expected output format]
""",
  subagent_type = "claude"
)

Agent(
  description = "Brief description of subagent 2",
  prompt = """You are a [role]. Your task is to [specific task].

Context: [relevant context, file paths, expectations]

Output format: [expected output format]
""",
  subagent_type = "claude"
)
```

---

## Important

- Dispatch all parallel agents in a **single message** (multiple tool calls)
- Wait for **ALL** to return before proceeding
- Merge results before next step
- Only parallelize **read-only** tasks—never parallelize writes

---

## Example: Investigation Phase

```
Agent(
  description = "Codebase scan for similar patterns",
  prompt = """Search the codebase for files related to authentication.
  Look for: auth, login, session, token keywords.
  Return: List of relevant files with brief descriptions.""",
  subagent_type = "claude"
)

Agent(
  description = "Dependency analysis",
  prompt = """Analyze the dependency graph for the auth module.
  Identify: What depends on auth, what auth depends on.
  Return: Dependency tree with risk assessment.""",
  subagent_type = "claude"
)

Agent(
  description = "Security review",
  prompt = """Review recent security-related commits and issues.
  Identify: Any known vulnerabilities or pending fixes.
  Return: Summary of security concerns.""",
  subagent_type = "claude"
)
```

---
*Template version: 1.0 — 2026-05-25*
