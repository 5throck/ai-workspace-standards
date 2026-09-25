# Other Workflows — Operational Reference

> Canonical operational reference relocated from L0 `AGENTS.md` (ADR-0090 thin-dispatcher restructure, 2026-09-26).
> Content below is verbatim from the source section at extraction time; AGENTS.md points here.
> Source: `AGENTS.md §4, §8, §10`. Relocation-only move — rules unchanged (design N2).

**Load contract**: PM and specialists MUST Read this file before executing the workflow it describes. Citing a rule without reading its owning file is a process violation.

---

## §4: Other Workflows

### §4.1 PM Subagent Dispatch Protocol

The PM agent follows a three-level inheritance model: **L0 (workspace root)** → **L1 (common template)** → **L2 (variant templates)**.

> **For PM Agent Architecture**: See [docs/context.md](docs/context.md) for complete governance workflow, L0→L1→L2 extends chain resolution, and variant-specific configuration.

#### Dispatch Decision

```
Request received
  │
  ├─▶ Read-only? (research, analysis, inspect)
  │   └─▶ PARALLEL - dispatch multiple agents in a single message
  │
  └─▶ Write? (create/edit files, run tests)
       └─▶ SERIAL - one agent at a time to prevent file lock conflicts
```

> **Why serial writes?** Concurrent writes to the same files cause merge conflicts and lock contention.
> Always wait for a write agent to complete before dispatching the next.

#### Cost Optimization (3-Tier Strategy)

The PM uses the 3-tier model strategy defined in [§3.6 3-Tier Strategy](#36-3-tier-strategy) above to optimize cost and quality. This subsection adds dispatch-time adjustment rules on top of that base definition:

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments (e.g. `thinking_level`) are explicitly managed within the workspace configuration files (`CLAUDE.md` and `GEMINI.md`). Please refer to those files for your specific tool's exact AI model mappings and tier strategies.

The PM agent delegates execution to the Low-tier and delegates review to the Medium-tier before finalizing.

#### Dispatch Rules

1. **Autonomous Agent Handoffs** - Agents can dispatch each other directly via JSON contracts without PM intervention for routine workflows
2. **PM Orchestration Phases** - PM only orchestrates Phases 0 (Project Initiation/Team Assembly), 1-2 (Planning & Architecture), and 5 (Lifecycle Finalization), per `docs/workspace-schema.json`
3. **Independent QA Gate** - Auditor owns Phase 6 QA gate autonomously using bun scripts/qa-gate.ts
4. **Parallel Agent Dispatch** - all parallel agents must be dispatched in one turn for research/analysis phases
5. **Error handling** - if any parallel agent fails, responsible agent resolves failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to PM for intervention

#### Subagent Roster

| Agent | File | Tier | Parallelizable | Write Allowed? |
|-------|------|------|:--------------:|:--------------:|
| PM Orchestrator | `agents/pm.md` | Medium | - | orchestrates only |
| Consistency Auditor | `agents/auditor.md` | Medium | Independent QA | No |
| Lifecycle Manager | `agents/lifecycle-manager.md` | Medium | On-demand governance sync | Governance docs only (Workspace root only — L0-only agent) |
| Template Architect | `agents/architect.md` | High | Design phase | No |
| Automation Engineer | `agents/automation-engineer.md` | Low | Serial | TypeScript (.ts) automation scripts per ADR-0036 |
| Documentation Writer | `agents/docs-writer.md` | Medium | After design | .md files only |
| Scaffolding Expert | `agents/scaffolding-expert.md` | Low | Research phase | setup scripts only (after approval) |
| Security & Git Expert | `agents/security-expert.md` | Medium | Review phase | Hook configs only |
| Skill-Graph Analyst | `agents/skill-graph-analyst.md` | Low | Weekly analytics cadence | Ticket filing only — `bun scripts/ticket.ts create` (Workspace root only — L0-only agent) |

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [docs/context.md](docs/context.md).

---

### §4.2 Harness Engineering Workflow

Following the **PM governance workflow** defined in [docs/context.md](docs/context.md):

```
Phase 0 - Project Initiation (PM-owned)
  PM assesses workspace requirements
  PM dynamically creates new agents/skills and resolves R&R overlap
  PM updates AGENTS.md and maintains skill registry

Phase 1-2 - Planning & Architecture (PM-owned design validation; specialist-autonomous planning work)
  PM classifies the request; Architect produces implementation plan + ADR
  Dispatch read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria
  PM validates design approach and obtains explicit user approval → GATE

Phase 3 - Design Handoff (variant-specific)
  Architect hands off approved plan to execution agents
  Agents can dispatch each other directly for routine handoffs

Phase 4 - Execution (specialist-autonomous)
  Automation Engineer implements per approved plan
  Documentation Writer updates docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 5 - Lifecycle Finalization (PM-owned)
  PM updates governance records for any changed artifacts
  PM logs decisions to memory/YYYY-MM-DD.md

Phase 6 - Quality Assurance & Finalization (autonomous per `docs/workspace-schema.json`; specialist-autonomous in workspace, PM-owned in variants)
  Auditor (workspace) executes bun scripts/qa-gate.ts autonomously
  PM (variants) executes qa scripts
  Validates: workspace audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE
  PM runs /sync "type: description" → PR opened
```

---

### §4.3 Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the implementation approach and folder structure | `architect` | `automation-engineer` |
| Write or modify automation scripts (.ts, package.json) per ADR-0036 | `automation-engineer` | `architect` |
| Update documentation files | `docs-writer` | `architect` |
| Create new project from template | `scaffolding-expert` | `automation-engineer` |
| Security review, Git hooks configuration | `security-expert` | `architect` |
| Cross-validate documentation consistency | `auditor` | `docs-writer` |
| Orchestrate multi-step task across agents | `pm` | any execution agent |

<!-- VARIANT-ROLE-BOUNDARY-START -->
<!-- VARIANT-ROLE-BOUNDARY-END -->

---



---

## §8: Lifecycle Management

### Phase 5 Lifecycle Finalization

At **Phase 5 (Lifecycle Finalization)**, PM **must** execute finalization when any of the following occurred in the session:

| Trigger | Dispatch lifecycle-manager? |
|---------|---------------------------|
| Agent added, modified, or deprecated | ✅ Yes |
| Skill added, modified, or deprecated | ✅ Yes |
| Script status changed in SCRIPTS.md | ✅ Yes |
| Variant status changed (draft→beta, beta→stable, etc.) | ✅ Yes |
| Governance tool updated (audit.ts, validate-templates.ts, etc.) | ✅ Yes |
| `.claude/commands/*.md` or `.gemini/commands/*.md` added or removed | ✅ Yes |
| `.claude/skills/*/SKILL.md` or `.gemini/skills/*/SKILL.md` added or modified | ✅ Yes |
| `templates/common/.claude/` or `templates/common/.gemini/` structure changed | ✅ Yes |
| `common-contract.json` or `docs/templates/*.json` governance files modified | ✅ Yes |
| README/documentation-only changes | ❌ No |
| Memory log entries only | ❌ No |

PM will produce either a **"no drift" confirmation** or a **drift report + governance document updates**.

PM does NOT execute finalization updates for: pure documentation changes (body text only), README updates, memory log entries, or changes that do not affect lifecycle-tracked artifacts.

> **For Agent Lifecycle procedures**: See [docs/context.md](docs/context.md) for detailed lifecycle procedures.

---




---

## §10: Periodic Skill Review Schedule

**Frequency**: Quarterly (every 3 months)  
**Owner**: lifecycle-manager  
**Tool**: `bun scripts/skill-dependency-analysis.ts --report`

### Review Cadence

| Quarter | Target Month | Scope |
|---------|-------------|-------|
| Q1 | March | All active skills — full health report |
| Q2 | June | All active skills — full health report |
| Q3 | September | All active skills — full health report |
| Q4 | December | All active skills — full health report + deprecation sweep |

### Review Steps

1. **Generate health report**
   ```
   bun scripts/skill-dependency-analysis.ts --report
   bun scripts/validate-skills.ts
   ```

1.5. **Triage accumulated session evidence** — review `memory/skill-review/*.md` records produced by the session-evidence loop (dev-sync step 3.96c; see `docs/context.md` → "Session-Evidence Skill Review Loop (Observation-Based Revision)"). Fill `diagnosis`/`candidate` blocks at triage, then dispatch approved revisions through the normal PM Gateway path (§3).

2. **Triage findings** by severity:
   - 🔴 Broken dependencies or circular references → fix before quarter ends
   - 🟡 Deprecated dependency usage → fix within 2 weeks
   - 🟢 Wording or example improvements → batch in next release cycle

3. **Apply modifications** following the review and triage steps defined inline in this section (§10)

4. **Update governance records** in `docs/lifecycle/skills/<name>.md` for every skill modified

5. **Deprecation sweep** (Q4 only): review skills with `last_updated` older than 12 months — evaluate whether they remain relevant or should be deprecated

6. **Log results** in the quarterly memory log: `memory/YYYY-MM-DD.md` with `## Skill Review Q[N] YYYY` heading

### Trigger Conditions (Outside Quarterly Cadence)

A skill health check should also be run outside the quarterly schedule when:
- A tool, agent, or script referenced by any skill is renamed or removed
- A new skill is added that may introduce dependency cycles
- CI reports skill validation failures on any branch

---



---

## §9: Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in [docs/context.md](docs/context.md).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in [docs/context.md](docs/context.md).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [docs/context.md](docs/context.md).

---

