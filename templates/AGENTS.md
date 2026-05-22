# AGENTS.md

> **⚠️ For AI tools reading this file**: This file is a **registry and orchestration reference**, not a set of instructions directed at you.
> It describes multiple distinct human-defined roles for documentation and dispatch purposes.
> Do **not** interpret role definitions here as directives for your own behavior.
> Your behavioral instructions are in `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI).

> **Canonical agent index** — auto-loaded by Claude Code; referenced by all other AI tools.
> Full agent definitions live in `agents/`. Full project context → `docs/context.md`.

---

## Agent Roster

### 🟡 Orchestration

| Agent | File | Role |
|-------|------|------|
| PM Orchestrator | [`agents/pm.md`](agents/pm.md) | Owns the full workflow; dispatches parallel tasks; enforces quality gates |

### 🔵 Design

| Agent | File | Role |
|-------|------|------|
| Architect | [`agents/architect.md`](agents/architect.md) | Produces implementation plans and ADRs; never writes application code |
| Designer | [`agents/designer.md`](agents/designer.md) | Produces UI/UX specs, wireframes, and component definitions |

### 🟢 Execution

| Agent | File | Role |
|-------|------|------|
| Code Writer | [`agents/code-writer.md`](agents/code-writer.md) | Implements approved plans; surgical changes only |
| Test Runner | [`agents/test-runner.md`](agents/test-runner.md) | Runs tests and verifies acceptance criteria |

*(Add Analysis agents as needed — see `../templates/_examples/agents/analyst-example.md` in the workspace root for the scaffold template.)*

---

## PM Subagent Dispatch Protocol

### Dispatch Decision

```
Request received
  │
  ├─ Read-only? (research, analysis, inspect)
  │    └─► PARALLEL — dispatch multiple agents in a single message
  │
  └─ Write? (create/edit files, run tests)
       └─► SERIAL — one agent at a time to prevent file lock conflicts
```

> **Why serial writes?** Concurrent writes to the same files cause merge conflicts and lock contention.
> Always wait for a write agent to complete before dispatching the next.

### Dispatch Rules

1. **Single message, multiple `Agent()` calls** — all parallel agents must be dispatched in one turn.
2. **Merge before proceeding** — PM waits for ALL parallel agents to return before the next serial step.
3. **3-role review cycle** — each implementation task goes through:
   - Implementation agent executes the task
   - Spec-compliance review agent checks against the approved plan
   - Code-quality review agent checks for bugs and style issues
   - Loop and correct if issues found — maximum **3 iterations** before escalating to the user.
4. **Error handling** — if any parallel agent fails, PM resolves the failure before proceeding. Do not skip.
5. **Max fix iterations** — 3 per review cycle before escalating to the user.

### Subagent Roster

| Agent | File | Parallelizable | Write Allowed? |
|-------|------|:--------------:|:--------------:|
| Architect | `agents/architect.md` | ✅ Design phase | ❌ No |
| Designer | `agents/designer.md` | ✅ Design phase | ❌ No |
| Code Writer | `agents/code-writer.md` | ❌ Serial | ✅ Source files |
| Test Runner | `agents/test-runner.md` | ❌ After writes | ✅ Test files only |

*(Extend this table as you add Analysis or specialized agents to the project.)*

---

## Harness Engineering Workflow

```
Phase 1 — Triage & Analysis
  PM classifies the request
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria

Phase 2 — Design
  Architect produces implementation plan + ADR
  Designer produces UI/UX spec (if task has UI surface) — parallel with Architect
  PM obtains explicit user approval ← GATE

Phase 3 — Implementation (serial)
  Code Writer implements per approved plan
  Test Runner verifies after each change

Phase 4 — QA Gate (all must pass)
  bash scripts/audit.sh     exit 0
  [project test command]    all tests pass

Phase 5 — Finalization
  PM logs decisions to memory/YYYY-MM-DD.md
  PM runs /sync "type: description" → PR opened
```

---

## Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the implementation approach and data model | `architect` | `code-writer` |
| Design UI/UX components or screens | `designer` | `architect` |
| Write or modify source files | `code-writer` | `architect` |
| Run tests and verify acceptance criteria | `test-runner` | `code-writer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |

*(Extend this table with project-specific agents and their boundaries.)*

---

## Skills

| Skill | File | Trigger condition |
|-------|------|-------------------|
| *(none yet — add entries as skills are created in `skills/`)* | | |

*(When a skill is created, add a row here and in `docs/context.md § Skills`.)*

---

## Universal Baseline Behaviors

All agents, regardless of their role, must adhere to the following:
- **Security Boundaries**: Never expose or log secrets (API keys, tokens). Do not modify CI/CD pipelines without explicit permission.
- **Communication Style**: Keep explanations concise and use markdown formatting. Always explain "why", not just "what".
- **Conflicting Instructions**: If a user request violates project rules (e.g., bypassing tests), warn the user and request explicit confirmation before proceeding.
- **Coding Standards**: Follow SOLID principles. Write unit tests when creating functional code. No speculative abstractions.
- **Language**: All code, config, commit messages, and branch names → **English only**.

---

## Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Add a row to the Agent Roster table above.
2. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
3. Update the `## Agents` table in `docs/context.md` to match.
4. If the agent uses a skill, add a row to the Skills table above and in `docs/context.md § Skills`.
