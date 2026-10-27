# Other Workflows — Variant Lifecycle Guidance

> Variant-context operational guidance for this project's agent orchestration,
> lifecycle finalization, and skill review. Maintained at L1 (templates/common)
> and delivered to every scaffolded project; it is companion guidance to the
> thin-dispatcher sections in [`AGENTS.md`](../../../AGENTS.md) (§4, §8, §9, §10),
> not a copy of any workspace-root document.
> This project's agent roster, phases, and governance surfaces differ from the
> workspace root's. Where a root-only concept is unavoidable, it is qualified
> with "(L0 workspace root — applies to the root roster)".

**Load contract**: the PM and specialists MUST Read this file before executing the workflow it describes. Citing a rule without reading its owning file is a process violation.

---

## §4: Other Workflows

### §4.1 PM Subagent Dispatch Protocol

The PM agent in this project follows the L0→L1→L2 inheritance model: the project's PM definition extends the common layer, which extends the workspace root.

> **For PM Agent Architecture**: See [docs/context.md](../../context.md) for the project's governance workflow, the extends-chain resolution, and variant-specific configuration.

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

The PM uses the 3-tier model strategy defined in the project's `AGENTS.md §3.6` to optimize cost and quality. This subsection adds dispatch-time adjustment rules on top of that base definition:

**Tier Adjustment Rules:**
- The PM can dynamically downgrade an agent's Tier for simple tasks (Assigned <= Baseline) to save costs.
- The PM can NEVER upgrade a Tier above the baseline.
- If a downgraded task fails, the PM MUST restore the agent's baseline Tier for the retry.

> **Note on 3-Tier Strategy Models:**
> The exact model configurations and prompt arguments are managed in the project's platform instruction files (`CLAUDE.md`, `GEMINI.md`). Refer to the file for your tool's exact model mappings and tier strategies.

#### Dispatch Rules

1. **Autonomous Agent Handoffs** - Agents can dispatch each other directly via JSON contracts without PM intervention for routine workflows.
2. **PM Orchestration Phases** - PM orchestrates the phases defined in this project's `AGENTS.md §3` and [docs/phase-definitions.md](../../phase-definitions.md). The workspace-root phase schema (`docs/workspace-schema.json`) describes the root pipeline (L0 workspace root — applies to the root roster); the project's own phase definitions govern here.
3. **QA Gate Ownership** - In this project the PM owns the QA gate and executes `bun scripts/qa-gate.ts`. The root's autonomous auditor gate is an L0-only arrangement (L0 workspace root — applies to the root roster).
4. **Parallel Agent Dispatch** - Dispatch all parallel agents in one turn for research and analysis phases.
5. **Error handling** - If any parallel agent fails, the responsible agent resolves the failure before proceeding. Do not skip.
6. **Max QA iterations** - 2 per review cycle before escalating to the user.

#### Project Roster (SSOT)

This project's subagent roster is defined in **two places, in this order of authority**:

1. `AGENTS.md §1` (Agent Roster) — the human-facing roster table.
2. `variant.json` `agents[]` (with `agent_manifest`) — the machine-readable manifest the delivery pipeline validates against.

Every agent a dispatch names MUST resolve in one of these two sources. Agent files live in `agents/` and MUST carry the YAML frontmatter specified in [docs/context.md](../../context.md). The workspace root's nine-agent roster (`agents/pm.md`, `agents/auditor.md`, `agents/lifecycle-manager.md`, and siblings) does NOT apply here (L0 workspace root — applies to the root roster).

---

### §4.2 Harness Engineering Workflow

Following the PM governance workflow defined in [docs/context.md](../../context.md) and this project's phase definitions:

```
Phase 0 - Project Initiation (PM-owned)
  PM assesses project requirements against the variant's scope
  PM assembles the team from the project roster (AGENTS.md §1 + variant.json)
  PM keeps AGENTS.md and the skill registry current

Phase 1-2 - Planning & Architecture (PM-owned design validation; specialist-autonomous planning work)
  PM classifies the request; the design specialist produces the implementation plan
  PM dispatches read-only agents in parallel (analysis, research)
  PM synthesizes findings → acceptance criteria
  PM validates the design approach and obtains explicit user approval → GATE

Phase 3 - Design Handoff
  The design specialist hands the approved plan to execution agents
  Agents can dispatch each other directly for routine handoffs

Phase 4 - Execution (specialist-autonomous)
  Implementation specialists implement per the approved plan
  Documentation specialists update docs as needed
  Agents can dispatch each other directly for routine handoffs

Phase 5 - Lifecycle Finalization (PM-owned)
  PM updates the governance records for every changed artifact (see §8 below)
  PM logs decisions to memory/YYYY-MM-DD.md

Phase 6 - Quality Assurance & Finalization (PM-owned in this project)
  PM executes bun scripts/qa-gate.ts
  Validates: project audit, project tests, documentation consistency
  Maximum 2 iterations before PM escalation → GATE
  Gate passed → PM closes out (not a phase): runs /sync "type: description" → PR opened → hand-off to user
```

---

### §4.3 Role Boundary Matrix

Use this to resolve ambiguity when multiple agents could handle a request. The generic rows below apply in every project; map the role placeholders to this project's actual agent names from `AGENTS.md §1`.

| Scenario | Use | Do NOT use |
|----------|-----|------------|
| Design the implementation approach and structure | the project's design specialist | the implementation specialist |
| Write or modify automation scripts per an approved plan | the project's implementation specialist | the design specialist |
| Update documentation files | the project's docs specialist | the design specialist |
| Orchestrate a multi-step task across agents | `pm` | any execution agent |

<!-- VARIANT-ROLE-BOUNDARY-START -->
<!-- Add project-specific role boundary rules here. Example:
     | Design implementation approach | `[design specialist]` | `[implementation specialist]` |
     | Write or modify documentation | `[docs specialist]` | `[design specialist]` | -->
<!-- VARIANT-ROLE-BOUNDARY-END -->

---

## §8: Lifecycle Management

### Phase 5 Lifecycle Finalization

At **Phase 5 (Lifecycle Finalization)**, the PM MUST execute finalization when any of the following occurred in the session:

| Trigger | Finalization required? |
|---------|---------------------------|
| Agent added, modified, or deprecated (`agents/`, `AGENTS.md §1`, `variant.json`) | ✅ Yes |
| Skill added, modified, or deprecated (`skills/`, `variant.json`) | ✅ Yes |
| Script status changed in `scripts/SCRIPTS.md` | ✅ Yes |
| Project variant status fields changed (`variant.json` `status` / `promotionChecklist`) | ✅ Yes |
| Governance tooling updated (the project's `scripts/audit.ts`, `scripts/validate-templates.ts`, and siblings) | ✅ Yes |
| Platform command or skill mirrors changed (`.claude/`, `.gemini/`, `.agents/`, `.codex/` commands and skills) | ✅ Yes |
| README or documentation-only changes | ❌ No |
| Memory log entries only | ❌ No |

**Who executes it**: the project's own PM performs the finalization updates and records them in this project's `docs/lifecycle/` tree (`docs/lifecycle/agents/<name>.md`, `docs/lifecycle/skills/<name>.md`). The root's dedicated lifecycle-manager agent does not exist in variant rosters (L0 workspace root — applies to the root roster).

The PM produces either a **"no drift" confirmation** or a **drift report plus governance document updates**. The PM does NOT execute finalization updates for pure documentation changes, README updates, memory log entries, or changes that do not affect lifecycle-tracked artifacts.

> **For the frontmatter and record format**: see [docs/context.md](../../context.md).

### Variant Status Admission

Template variant status promotion follows two documented paths. **New (non-migrated) variants** follow the beta-first path: draft → beta → stable with the PROMOTION_CHECKLIST criteria evidenced. **Migrated variants** (converted from a proven project) may enter directly at stable under the migration fast-track: the source project's conversion eligibility replaces the beta-window criteria, which are recorded as waived ("N/A per the migration admission policy", never "met") in the PROMOTION_CHECKLIST with a ratification row in Review History. Vocabulary mapping: variant `stable` ≡ lifecycle-record `production`; variant `beta` ≡ `review`. Promotion decisions are made at the workspace root against the variant template; inside a project, keep `variant.json` status and `promotionChecklist` truthful so the workspace-side review reads current facts.

---

## §9: Maintenance Rule

When a new `agents/<name>.md` is created in this project, the responsible developer or AI agent must:

1. Create the agent file with the YAML frontmatter specified in [docs/context.md](../../context.md).
2. Add a row to the Agent Roster table in `AGENTS.md §1`.
3. Register the agent in `variant.json` (`agents[]` and `agent_manifest`) so the delivery pipeline and validators see it.
4. Create the lifecycle record at `docs/lifecycle/agents/<name>.md`.

When a new skill is created in this project's `skills/` (or a platform mirror such as `.claude/skills/`):

1. Create `skills/<name>/SKILL.md` with the standard frontmatter per [docs/context.md](../../context.md).
2. Register the skill in `variant.json` (`skills[]` and `skill_manifest`).
3. Create the lifecycle record at `docs/lifecycle/skills/<name>.md`.
4. Run the project's validators (`bun scripts/validate-skills.ts`, `bun scripts/audit.ts`) and fix the findings.

> **Sync duty**: keep `AGENTS.md` in sync with `docs/context.md ## Agents` so every AI tool reads the same roster.

The workspace root runs a heavier maintenance pipeline for its own roster and skills (lifecycle skills, registry sweeps — L0 workspace root — applies to the root roster). Variant projects are governed by the duties in this section.

---

## §10: Periodic Skill Review Schedule

**Frequency**: Quarterly (every 3 months)
**Owner**: this project's PM
**Scope**: this project's `skills/` set and platform-skill mirrors

### Review Cadence

| Quarter | Target Month | Scope |
|---------|-------------|-------|
| Q1 | March | All active skills — full health report |
| Q2 | June | All active skills — full health report |
| Q3 | September | All active skills — full health report |
| Q4 | December | All active skills — full health report + deprecation sweep |

### Review Steps

1. **Generate the health report**
   ```
   bun scripts/validate-skills.ts
   bun scripts/generate-skill-graph.ts
   bun scripts/verify-skill-graph.ts
   ```
   The workspace root's dedicated dependency analyzer is not shipped to variants (L0 workspace root — applies to the root roster); the project's own validators above are the health surface.

2. **Triage accumulated session evidence** — review `memory/skill-review/*.md` records produced by the session-evidence loop (see [docs/context.md](../../context.md) → "Session-Evidence Skill Review Loop"). Fill the `diagnosis`/`candidate` blocks at triage, then dispatch approved revisions through the normal PM Gateway path (`AGENTS.md §3`).

3. **Triage findings** by severity:
   - 🔴 Broken dependencies or circular references → fix before quarter ends
   - 🟡 Deprecated dependency usage → fix within 2 weeks
   - 🟢 Wording or example improvements → batch in the next release cycle

4. **Apply modifications** following the review and triage decisions.

5. **Update governance records** in `docs/lifecycle/skills/<name>.md` for every skill modified.

6. **Deprecation sweep** (Q4 only): review skills with `last_updated` older than 12 months — evaluate whether each remains relevant or should be deprecated.

7. **Log results** in the quarterly memory log: `memory/YYYY-MM-DD.md` with a `## Skill Review Q[N] YYYY` heading.

### Trigger Conditions (Outside Quarterly Cadence)

Run a skill health check outside the quarterly schedule when:
- A tool, agent, or script referenced by any skill is renamed or removed
- A new skill is added that may introduce dependency cycles
- The project's validators report skill failures on any branch

---
