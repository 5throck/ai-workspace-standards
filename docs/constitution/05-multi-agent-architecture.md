> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §5 Multi-Agent Architecture
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 5. Multi-Agent Architecture

Every project uses a role-based agent structure. Agents are defined as markdown files in `agents/`.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** (`ai-workspace-standards`): Specialized agents for template maintenance (pm, architect, automation-engineer, security-expert, docs-writer, auditor, scaffolding-expert). See [AGENTS.md](AGENTS.md) for the complete roster.
> - **Individual Projects**: Generic agents for development workflows (pm, architect, designer, code-writer, test-runner). These are generated from `templates/agents/` at project init.

#### 5.1 Agent File Format (Standard Frontmatter)

```yaml
---
name: <agent-name>
tier:
  claude: high|medium|low        # claude-opus-4-7 | claude-sonnet-4.6 | claude-haiku-4-5
  antigravity: high|medium|low   # gemini-3.1-pro | gemini-3.5-flash
  gemini-cli: high|medium|low    # gemini-3.1-pro | gemini-3.5-flash
model: inherit
color: yellow | blue | green | red | magenta | cyan | purple  # Claude Code only
description: 'One-sentence role. Use when: "...", "...", "..."'
examples:
  - user: "..."
    assistant: "..."
---
```

The `description` field is how the AI tool selects the right agent - always write **when to use it** explicitly. The `tier` field enforces cost optimization across platforms.

#### 5.2 Role Groups

| Group | Responsibility | Tier | Core agents |
|-------|---------------|------|-------------|
| Orchestration | Team assembly, design validation, finalization | High | `pm.md` |
| Analysis | Read-only investigation, codebase exploration, data gathering | Medium | `*-analyst.md`, `auditor.md` |
| Design | Architecture decisions, implementation planning, technical spec | High | `architect.md` |
| Design | UI/UX specifications, wireframes, component and interaction design | Medium | `designer.md` |
| Execution | Code implementation and automated test verification | Low | `automation-engineer.md`, `docs-writer.md`, `scaffolding-expert.md` |
| Quality | Independent QA gate, security validation | Medium | `auditor.md`, `security-expert.md` |

#### 5.3 PM Orchestrator Rules

- When no specific orchestrator is assigned, **always create `agents/pm.md`** - PM orchestrates Phases 0, 2, and 6 only.
- PM dispatches independent tasks as **parallel agents in a single message** (never sequential).
- **Autonomous Agent Handoffs**: Agents can dispatch each other directly via JSON contracts for routine workflows without PM intervention
- **Independent QA Gate**: Auditor owns Phase 5 QA gate autonomously using qa-gate.sh/.ps1 scripts
- Agents communicate via **structured JSON Input Contracts**:

```json
{
  "task": "<task description>",
  "phase": "<one of: Triage | Analysis | Design | Implementation | QA | Finalization>",
  "context_file": "agents/<name>.md",
  "input": {}
}
```

- **Tool Abstraction**: The PM spawns child agent processes using the host tool's native subagent dispatching mechanism. The underlying tool handles process lifecycle and workspace sandboxing.

#### 5.4 PM Governance Workflow (6 Phases)

```
Phase 0 - Team Assembly & Skill Orchestration (Kickoff)
  PM assesses workspace requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1 - Analysis & Triage
  PM classifies the request
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria

Phase 2 - Design
  Architect produces implementation plan + ADR
  PM validates design approach and obtains explicit user approval → GATE

Phase 3 - Implementation (serial)
  Automation Engineer implements per approved plan
  Documentation Writer updates docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 4 - QA Gate (Independent Auditor)
  Auditor executes qa-gate.sh/.ps1 autonomously
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE

Phase 5 - Finalization
  PM logs decisions to memory/YYYY-MM-DD.md
  PM runs /sync "type: description" → PR opened
```

#### 5.5 3-Tier Cost Optimization Model

The workspace enforces a **3-tier model strategy** to optimize cost and quality:

| Tier | Models | Role | Example Agents |
|------|--------|------|----------------|
| **High** | claude-opus-4-7, gemini-3.1-pro | Complex reasoning, architecture, PM orchestration | PM, Architect |
| **Medium** | claude-sonnet-4.6, gemini-3.5-flash | Review, QA, analysis, supervision | Auditor, Security Expert |
| **Low** | claude-haiku-4-5, gemini-3.5-flash | Fast coding, boilerplate, scoped tasks | Automation Engineer, Docs Writer |

**Tier Enforcement Rules:**
- All agents must specify tier in frontmatter for all platforms (claude, antigravity, gemini-cli)
- PM agent MUST leverage superpowers plugin for 3-tier enforcement
- Audit scripts validate tier compliance on every run

---

See [§5.6 Agent Lifecycle Management](05.6-agent-lifecycle.md) for agent creation, modification, and deprecation procedures.
