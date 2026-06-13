> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §5 Multi-Agent Architecture
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 5. Multi-Agent Architecture {#multi-agent-architecture}

Every project uses a role-based agent structure. Agents are defined as markdown files in `agents/`.

> **Workspace Root vs. Individual Projects**:
> - **Workspace Root** (`ai-workspace-standards`): Specialized agents for template maintenance (pm, architect, automation-engineer, security-expert, docs-writer, auditor, scaffolding-expert). See [AGENTS.md](AGENTS.md) for the complete roster.
> - **Individual Projects**: Generic agents for development workflows (pm, architect, designer, code-writer, test-runner). These are generated from `templates/agents/` at project init.

#### 5.1 Agent File Format (Standard Frontmatter)

```yaml
---
name: <agent-name>
tier:
  claude: high|medium|low        # claude-opus-4-7 | claude-sonnet-4-6 | claude-haiku-4-5
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
| Orchestration | Team assembly, design validation, lifecycle finalization | High | `pm.md` |
| Analysis | Read-only investigation, codebase exploration, data gathering | Medium | `*-analyst.md`, `auditor.md` |
| Design | Architecture decisions, implementation planning, technical spec | High | `architect.md` |
| Design | UI/UX specifications, wireframes, component and interaction design | Medium | `designer.md` |
| Execution | Code implementation and automated test verification | Medium | `automation-engineer.md`, `docs-writer.md`, `scaffolding-expert.md` |
| Quality | Independent QA gate, security validation | Medium | `auditor.md`, `security-expert.md` |

#### 5.3 PM Orchestrator Rules

- When no specific orchestrator is assigned, **always create `agents/pm.md`** - PM orchestrates Phases 0, 2, and 6 only.
- PM dispatches independent tasks as **parallel agents in a single message** (never sequential).
- **Autonomous Agent Handoffs**: Agents can dispatch each other directly via JSON contracts for routine workflows without PM intervention
- **Independent QA Gate**: Auditor owns Phase 6 QA gate autonomously using qa-gate.sh/.ps1 scripts
- Agents communicate via **structured JSON Input Contracts**:

```json
{
  "task": "<task description>",
  "phase": "<one of: Triage | Analysis | Design | Implementation | Lifecycle Finalization | QA & Finalization>",
  "context_file": "agents/<name>.md",
  "input": {}
}
```

- **Tool Abstraction**: The PM spawns child agent processes using the host tool's native subagent dispatching mechanism. The underlying tool handles process lifecycle and workspace sandboxing.

#### 5.4 PM Governance Workflow (6 Phases)

```
Phase 0 - Project Initiation (PM-owned)
  PM assesses workspace requirements
  scaffolding-expert creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1-2 - Planning & Architecture (specialist-autonomous)
  architect classifies the request and produces implementation plan + ADR
  PM validates design approach and obtains explicit user approval → GATE

Phase 3 - Design Handoff (variant-specific)
  Variant-specific specialist produces design artifacts
  Agents can dispatch each other directly for routine handoffs

Phase 4 - Execution (specialist-autonomous)
  automation-engineer implements per approved plan
  docs-writer updates documentation as needed

Phase 5 - Lifecycle Finalization (PM-owned)
  PM logs decisions to memory/YYYY-MM-DD.md
  lifecycle-manager updates governance records

Phase 6 - Quality Assurance & Finalization (specialist-autonomous)
  security-expert reviews for vulnerabilities and compliance
  auditor executes qa-gate.sh/.ps1 autonomously
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE
  PM runs /sync "type: description" → PR opened
```

#### 5.5 L0→L1→L2 PM.md Variant Handling (added 2026-06-08)

The workspace supports variant-specific PM agents for different project types (co-consult, co-design, co-develop, co-security, co-work). These variants use the **Layout Reconstruction** architecture to ensure L2 pm.md files contain only variant-specific content.

**L0→L1→L2 Content Propagation Rules**:
- **L0** (workspace root/agents/pm.md) provides skeleton structure only (not full content duplication)
- **L1** (templates/common/agents/pm.md) acts as base template that defines extends chain
- **L2** (templates/co-*/agents/pm.md) generates variant-specific content from scratch
- Layout Reconstruction triggers at L2 generation time and project scaffold time
- L2 pm.md target size: ~50-100 lines (not 384 lines like L0)

**Layout Reconstruction Architecture** (6 components):
1. **Agent Type Extraction** — Extract agent types from variant_overrides.agent_roster using Group → Type mapping
2. **Group → Type Mapping** — Define comprehensive Group → Type mapping for all 5 variants
3. **Agent Roster Table Generation** — Generate 4-column table: Phase | Group | Agent file | Responsibility
4. **Phase Determination Table Generation** — Generate variant-specific agent mapping (no L0 agents)
5. **L0-Only Content Removal** — Remove Platform Note, replace CONSTITUTION.md references
6. **MANDATORY Dispatch List Generation** — Generate variant-specific dispatch list

**CONSTITUTION.md Reference Handling**:
- **L0 references**: "CONSTITUTION.md" → "context.md and <variant>.context.md"
- **Platform Notes**: Removed from L2 variants
- **Configuration Changes**: "Root Configuration Changes" → "Configuration Changes"
- **L0-specific terminology**: Removed (e.g., "workspace root", "ai-workspace-standards")

**Acceptance Criteria**:
- **AC-01**: No L0 agent names in Phase Determination table (automation-engineer, docs-writer, architect, auditor, security-expert, scaffolding-expert)
- **AC-02**: All roster entries have non-empty responsibility field
- **AC-03**: Platform Note removed from L2 variants
- **AC-04**: MANDATORY Dispatch List contains only variant agents
- **AC-05**: L2 pm.md file size under 150 lines (target: ~50-100 lines)

**Related Documentation**:
- [ADR-0031: L1-L2 Fork Model](../adr/0031-l1-l2-fork-model.md) — Layout Reconstruction trigger points
- [ADR-0039: L0→L1→L2 Hierarchy and Extends Pattern](../adr/0039-l0-l1-l2-hierarchy-and-extends.md) — Layout Reconstruction architecture
- [PM.md Variant-Specific Content Injection Design](../designs/pm-md-variant-specific-content-injection-design.md) — Complete design specification

#### 5.6 3-Tier Cost Optimization Model

The workspace enforces a **3-tier model strategy** to optimize cost and quality:

| Tier | Models | Role | Example Agents |
|------|--------|------|----------------|
| **High** | claude-opus-4-7, gemini-3.1-pro | Complex reasoning, architecture, PM orchestration | PM, Architect |
| **Medium** | claude-sonnet-4-6, gemini-3.5-flash | Review, QA, analysis, supervision | Auditor, Security Expert |
| **Low** | claude-haiku-4-5, gemini-3.5-flash | Fast coding, boilerplate, scoped tasks | Automation Engineer |

> **Model Registry**: Current model assignments are maintained in `docs/workspace-schema.json` (`models` block). The table above reflects those values.

**Tier Enforcement Rules:**
- All agents must specify tier in frontmatter for all platforms (claude, antigravity, gemini-cli)
- PM agent MUST leverage platform-appropriate agent dispatch mechanisms for 3-tier enforcement
- Audit scripts validate tier compliance on every run

---

See [§5.6 Agent Lifecycle Management](05.6-agent-lifecycle.md) for agent creation, modification, and deprecation procedures.
