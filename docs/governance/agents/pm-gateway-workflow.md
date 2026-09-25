# PM Gateway Workflow — Operational Reference

> Canonical operational reference relocated from L0 `AGENTS.md` (ADR-0090 thin-dispatcher restructure, 2026-09-26).
> Content below is verbatim from the source section at extraction time; AGENTS.md points here.
> Source: `AGENTS.md §3 (excluding §3.1, §3.6, §3.7, §3.7.5 which remain inline)`. Relocation-only move — rules unchanged (design N2).

**Load contract**: PM and specialists MUST Read this file before executing the workflow it describes. Citing a rule without reading its owning file is a process violation.

---

### §3.5 Phase Determination (Deliverable-Type Gate)

Before assigning an agent to any task, PM MUST classify the deliverable type:

| Deliverable Type | Phase | Required Agent | Tier | Notes |
|------------------|-------|----------------|------|-------|
| New file design, schema definition, ADR | Phase 1-2 | architect | High | Must precede implementation |
| New directory structure, template layout | Phase 1-2 | architect | High | Must precede implementation |
| Cross-platform convention, naming standard | Phase 1-2 | architect | High | Must precede implementation |
| Script implementation (approved plan exists) | Phase 4 | automation-engineer | Low | Plan from architect required |
| Documentation update | Phase 4 | docs-writer | Medium | |
| Documentation writing | Phase 4 | docs-writer | Medium | |
| Security configuration | Phase 6 | security-expert | Medium | |
| Project scaffolding | Phase 0 | scaffolding-expert | Low | |

**Design Gate (Row 0)**: All non-exempt deliverable types above require a design document (Row 0 in the execution plan) to be created/updated by architect before implementation begins. See §5.1.1 for exemption categories.

**Tier Ceiling Rule**: An agent's tier may NOT be elevated beyond its defined tier. `automation-engineer` is always Low — assigning it High is a governance violation.

> **Execution Plan Boilerplate Policy**: For boilerplate mandatory/discretionary cases, see [CLAUDE.md §5](CLAUDE.md#5-agent-dispatch-rules) or [GEMINI.md §5](GEMINI.md#5-agent-dispatch-rules).

### §3.8 Permission Denial Protocol

When a specialist agent's required tool is denied, PM must **not** substitute for the specialist. Instead:

1. Identify the denial Type (A/B/C/D) using the classification in [`agents/pm.md`](agents/pm.md#permission-denial-protocol)
2. Output the Escalation Template immediately
3. Log the denial to `memory/YYYY-MM-DD.md`
4. Halt the blocked task — do not proceed without the required tool

### §3.9 LLM Work Routing Policy (ADR-0078)

Substantive LLM-assisted development work — generation or modification of code, documents, designs, tests, or scripts — MUST be routed through the project's agent team: `user → PM triage → Design Gate (unless exempt) → specialist dispatch → QA gate → /sync PR`. Querying an external LLM directly (e.g. a web chat) and landing its output in the repository is a policy violation.

- **Exemptions**: trivial assistance not landing in the repository (IDE inline completions, one-off Q&A) is exempt; repository-landing work uses the existing E1–E5 exemption codes (§5.1.1) only.
- **PM single entry point**: all specialist dispatch goes through PM (§3.1); Phases 3/4/6 remain specialist-autonomous per the existing workflow.
- **Runtime LLM integration**: an application calling LLM APIs at runtime is an architecture concern covered by the Design Gate (ADR-0074) — no additional ceremony.
- **Enforcement**: structural, via the existing hard gates (spec-check, pre-commit audit, QA gate). See ADR-0078 (workspace root, `docs/adr/0078-agent-mediated-llm-work-routing.md`).

### §3.10 Instruction Writing Standard (ASD-STE100, ADR-0079)

Development-facing instruction text follows ASD-STE100 (Simplified Technical English) structural rules. **Applies to**: requirement statements, task briefs, execution-plan task descriptions, agent dispatch prompts, design-doc requirement/acceptance sections, API endpoint documentation, and how-to steps — in every development domain (web, app, API, scripts, documents). API development routes through the agent team identically to web/app development (§3.9).

**Rules** (STE dictionary not adopted; technical vocabulary stays as-is):

1. One instruction per sentence — ≤ 20 words for procedures, ≤ 25 for descriptions.
2. Active voice; imperative mood for steps ("Run the audit").
3. Present tense for procedures and current-state statements.
4. One term = one meaning; use glossary/registry terms (agent, script, tier names) exactly.
5. No idioms, slang, or culture-specific phrasing.
6. Prefer positive phrasing; use negatives only for prohibitions.
7. Minimal pronouns — repeat the noun when ambiguity is possible.
8. Lists for parallel items; tables for structured data (§5 conventions).

**Enforcement**: advisory — PM conforms task briefs and execution-plan rows at triage (flagging substantive rewrites); architect checks requirement sections at Design Gate review; specialists author new docs in the standard. See ADR-0079 (workspace root, `docs/adr/0079-simplified-english-development-instructions.md`).

### §3.11 PM Team-Management Authority (ADR-0080)

PM owns the composition of the agent team and rules on skill changes:

- **Hiring/firing (top-down, PM-decided)**: PM judges timing and target from workflow signals — recurring unmatched work types, role overload, absorbed roles, the quarterly roster review (§10 cadence) — without a blocking user approval. Every decision emits a gate-moment decision record (ADR-0061) before dispatch. Default exit is `status: deprecated`; hard delete requires an explicit user request. Procedure: `agent-lifecycle-manager` skill (Hiring H1–H6, Firing F1–F5).
- **Skill requests (bottom-up, agent-initiated, PM-approved)**: agents file structured request blocks (`create|attach|remove` + evidence) in their task reports and memory logs; PM triages and only approved requests are dispatched for execution. Agents never create, attach, or remove skills unilaterally. Procedure: `skill-lifecycle-manager` skill (Requests R1–R3, Deprecation & Removal).

**Enforcement**: governance, not code — the audits (`agent-lifecycle-audit.ts`, `lifecycle-sync-audit.ts`) catch structural drift, and decision records capture the judgment trail. See ADR-0080 (workspace root, `docs/adr/0080-pm-team-management-authority.md`).

---


---


---

### §3.1 Operational Detail (relocated from AGENTS.md, ADR-0090 W1b remainder)

#### §3.1.2 PM Role Boundaries

**What PM Does**:
- Orchestrate multi-agent workflows
- Create execution plans
- Dispatch specialist agents
- Enforce quality gates
- Track progress

**What PM Does NOT Do**:
- Directly Edit/Write files (except `memory/*.md`, `CHANGELOG.md`)
- Implement code or scripts
- Perform documentation updates (delegate to docs-writer)
- Perform design work (delegate to architect)

**Task Owner vs Executor Distinction**:
- **Task owner (PM)**: PM is accountable for task progress and final delivery
- **Task executor (specialist)**: Agent who performs the actual work
- PM creates tasks (owner: pm), dispatches specialists (executor: docs-writer/architect/automation-engineer), and updates task status upon completion

**User Communication for Specialist Tasks**:
When work requires specialist delegation, PM uses the following template:
```
PM: 🔍 [Task Analysis] This task falls within the [specialist] domain of expertise.
   Task: [description]
   Specialist: [specialist name]
   Reason: [why specialist needed]
PM: Shall I dispatch [specialist]?
User: "Yes"
PM: ▶️ [specialist] dispatch...
```

See [agents/pm.md](agents/pm.md) for complete role definition and delegation protocols.

#### §3.1.3 Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 6 QA

#### §3.1.4 Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

#### §3.1.5 Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **scaffolding-expert** | 0 | "Creating new projects", "Template validation", "Scaffolding tasks" |
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **automation-engineer** | 4 | "Creating scripts", "Cross-platform automation", "Implementation tasks" |
| **docs-writer** | 4 | "Updating documentation", "README creation", "CHANGELOG updates" |
| **security-expert** | 6 | "Security review", "Hook configuration", "Secret detection" |
| **lifecycle-manager** | 5 | "Lifecycle finalization", "Governance record sync", "L0->L1 template publishing", "L1->L2 explicit skill/script sync" — invoked on-demand for governance changes; lifecycle finalization runs automatically via `/sync` (**Workspace root only — L0-only agent, NOT available in variant templates**) |
| **auditor** | 6 | "Quality verification", "Documentation consistency check", "QA gate required" (Workspace root only) |
| **skill-graph-analyst** | 6 | "Fleet skill-graph analytics", "skill graph report", "skill convergence triage", "weekly analytics cadence" (Workspace root only — L0-only agent; triage only, tickets for promotion candidates) |


---

### §3.1 Operational Detail (relocated from AGENTS.md, ADR-0090 W1b remainder)

**User Communication for Specialist Tasks**:
When work requires specialist delegation, PM uses the following template:
```
PM: 🔍 [Task Analysis] This task falls within the [specialist] domain of expertise.
   Task: [description]
   Specialist: [specialist name]
   Reason: [why specialist needed]
PM: Shall I dispatch [specialist]?
User: "Yes"
PM: ▶️ [specialist] dispatch...
```

See [agents/pm.md](agents/pm.md) for complete role definition and delegation protocols.

#### §3.1.3 Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 6 QA

#### §3.1.4 Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

#### §3.1.5 Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **scaffolding-expert** | 0 | "Creating new projects", "Template validation", "Scaffolding tasks" |
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **automation-engineer** | 4 | "Creating scripts", "Cross-platform automation", "Implementation tasks" |
| **docs-writer** | 4 | "Updating documentation", "README creation", "CHANGELOG updates" |
| **security-expert** | 6 | "Security review", "Hook configuration", "Secret detection" |
| **lifecycle-manager** | 5 | "Lifecycle finalization", "Governance record sync", "L0->L1 template publishing", "L1->L2 explicit skill/script sync" — invoked on-demand for governance changes; lifecycle finalization runs automatically via `/sync` (**Workspace root only — L0-only agent, NOT available in variant templates**) |
| **auditor** | 6 | "Quality verification", "Documentation consistency check", "QA gate required" (Workspace root only) |
| **skill-graph-analyst** | 6 | "Fleet skill-graph analytics", "skill graph report", "skill convergence triage", "weekly analytics cadence" (Workspace root only — L0-only agent; triage only, tickets for promotion candidates) |


---

### §3.1 Operational Detail (relocated from AGENTS.md, ADR-0090 W1b remainder)

**User Communication for Specialist Tasks**:
When work requires specialist delegation, PM uses the following template:
```
PM: 🔍 [Task Analysis] This task falls within the [specialist] domain of expertise.
   Task: [description]
   Specialist: [specialist name]
   Reason: [why specialist needed]
PM: Shall I dispatch [specialist]?
User: "Yes"
PM: ▶️ [specialist] dispatch...
```

See [agents/pm.md](agents/pm.md) for complete role definition and delegation protocols.

#### §3.1.3 Enforcement Layers
1. **Tool-Level**: Agent tool rejects non-PM specialist calls (hard enforcement)
2. **System Prompt-Level**: CLAUDE.md/GEMINI.md rules loaded first
3. **Agent File-Level**: All specialists have "PM-ONLY INVOCATION" section
4. **QA Gate-Level**: Auditor detects bypass in Phase 6 QA

#### §3.1.4 Specialist Agent Dispatch Flow
```
User Request → PM Triage → Design Approval → Specialist Dispatch → QA Gate → Finalization
```

#### §3.1.5 Specialist Agent Roster (PM-ONLY INVOCATION)

All specialist agents below are dispatched ONLY through PM:

| Agent | Phase | Dispatch Trigger |
|-------|-------|-------------------|
| **scaffolding-expert** | 0 | "Creating new projects", "Template validation", "Scaffolding tasks" |
| **architect** | 1-2 | "Architecture design needed", "Project structure planning", "Technical decision making" |
| **automation-engineer** | 4 | "Creating scripts", "Cross-platform automation", "Implementation tasks" |
| **docs-writer** | 4 | "Updating documentation", "README creation", "CHANGELOG updates" |
| **security-expert** | 6 | "Security review", "Hook configuration", "Secret detection" |
| **lifecycle-manager** | 5 | "Lifecycle finalization", "Governance record sync", "L0->L1 template publishing", "L1->L2 explicit skill/script sync" — invoked on-demand for governance changes; lifecycle finalization runs automatically via `/sync` (**Workspace root only — L0-only agent, NOT available in variant templates**) |
| **auditor** | 6 | "Quality verification", "Documentation consistency check", "QA gate required" (Workspace root only) |
| **skill-graph-analyst** | 6 | "Fleet skill-graph analytics", "skill graph report", "skill convergence triage", "weekly analytics cadence" (Workspace root only — L0-only agent; triage only, tickets for promotion candidates) |

