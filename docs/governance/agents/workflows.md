# Other Workflows — Operational Reference

> Canonical operational reference relocated from L0 `AGENTS.md` (ADR-0090 thin-dispatcher restructure, 2026-09-26).
> Content below is verbatim from the source section at extraction time; AGENTS.md points here.
> Source: `AGENTS.md §4, §8, §10`. Relocation-only move — rules unchanged (design N2).

**Load contract**: PM and specialists MUST Read this file before executing the workflow it describes. Citing a rule without reading its owning file is a process violation.

---

## §4: Other Workflows

### §4.1 PM Subagent Dispatch Protocol

The PM agent follows a three-level inheritance model: **L0 (workspace root)** → **L1 (common template)** → **L2 (variant templates)**.

> **For PM Agent Architecture**: See [CONSTITUTION.md §5.5 - PM Gateway Workflow](../../../CONSTITUTION.md#55-pm-gateway-workflow) for complete governance workflow, L0→L1→L2 extends chain resolution, and variant-specific configuration.

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

The PM uses the 3-tier model strategy defined in [§3.6 3-Tier Strategy](../../../AGENTS.md#36-3-tier-strategy) above to optimize cost and quality. This subsection adds dispatch-time adjustment rules on top of that base definition:

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

> **Agent frontmatter specification**: All agent files must include YAML frontmatter as defined in [CONSTITUTION.md §5.1](../../../docs/constitution/05-multi-agent-architecture.md#51-agent-file-format-standard-frontmatter).

#### Per-Session Worktree Convention

> Rationale and full decision: [docs/designs/2026-11-07-session-worktree-convention-design.md](../../designs/2026-11-07-session-worktree-convention-design.md) (T-20261106-010). Enforced by procedure and report duty, not by a hook or machine gate (design §7).

A dispatched session's write surface (branch pointer + working tree) is shared mutable state when sessions run concurrently. Give each write session its own branch pointer and working tree via `git worktree`.

**Concurrency evidence** (ANY one hit selects isolation): shared tree dirty (`git status --porcelain` non-empty), shared checkout not on `main`, or any open PR (`gh pr list --state open` non-empty). The PM evaluates this at dispatch time and states the result in the task brief. The specialist re-checks at start, because state can change between dispatch and start, and notes the result in the task report.

| Task shape | Rule |
|------------|------|
| Multi-file WRITE batch (code or docs) with concurrency evidence | **Worktree REQUIRED** - branch from `origin/main` |
| Read-only tasks (research, analysis, inspection) | Worktree recommended |
| Single-file write with concurrency evidence | Worktree recommended; staying on the shared checkout requires the verify-branch-before-mutate discipline before every mutating command |
| PM bookkeeping (ticket moves, memory-log-only changes, CHANGELOG entries) | **Never isolate** - stays on the shared checkout; the dev-sync session entry is workspace-scoped and scoped staging already excludes foreign dirt |
| Trivial single-file change with no concurrency evidence | Shared checkout with the existing discipline |

Landing procedure: use the sync skill's Worktree Landing Variant ([skills/sync/SKILL.md](../../../skills/sync/SKILL.md)). Path convention: a sibling directory outside the repository tree (`../<repo-name>-worktrees/<slug>`), branch `pr/<YYYYMMDD>-<slug>` from `origin/main`. Run `bun scripts/dev-sync.ts` from the worktree root - the CWD guard anchors to the script's own copy's parent directory, and each worktree owns its full checkout including `scripts/dev-sync.ts`. Write the PR body to `$(git rev-parse --git-dir)/sync-pr-body.md` - inside a worktree this resolves to the worktree's private git dir, so the file never collides. Remove the worktree after the PR opens. Record the worktree path, branch, and observed concurrency evidence in the task report.

**Checkout-recovery convention** - when the shared tree is flipped mid-flight by a foreign session:

1. Do NOT force-restore: no `git checkout -f`, no `git reset --hard`, no repointing another session's in-flight branch, no deleting foreign untracked files.
2. Stash foreign dirt ONLY if it blocks a required checkout - scoped and named (`git stash push -m "foreign-<session>-<date>" -- <paths>`). Leave it untouched otherwise.
3. Leave foreign commits alone: another session's branch and its commits are not ours to rebase, reset, or delete.
4. Re-branch from `origin/main`: `git fetch origin && git checkout -b pr/<YYYYMMDD>-<slug>-retry origin/main`, then re-apply own staged work (or move to a worktree per the rule above).
5. Report the collision in the task report and the session memory block (who flipped, when detected, what was stashed).

---

### §4.2 Harness Engineering Workflow

Following the **PM governance workflow** defined in [CONSTITUTION.md §5.5](../../../CONSTITUTION.md#55-pm-gateway-workflow):

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
  Gate passed → PM closes out (not a phase): runs /sync "type: description" → PR opened → hand-off to user
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

### §4.4 Hub-and-Spoke Topology (pointer)

Cross-variant asset ownership (hub canonical assets, spoke consumption, variant-identity protection) is declared in the `hub_topology` registry (`docs/workspace-schema.json`) and governed by `docs/designs/2026-11-01-hub-consolidation-design.md`. PM consumption duties on this topology: hub service consumption rules live in [pm-gateway-workflow.md §3.13](pm-gateway-workflow.md#313-hub-service-consumption-hub-and-spoke-topology).

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

> **For Agent Lifecycle procedures**: See [CONSTITUTION.md §5.6 - Agent Lifecycle Management](../../../CONSTITUTION.md#56-agent-lifecycle-management) for detailed lifecycle procedures.

### Variant Status Admission (ADR-0099)

Template variant status promotion follows two documented paths. **New (non-migrated) variants** follow the beta-first path: draft → beta → stable with the PROMOTION_CHECKLIST criteria evidenced (co-safety convention). **Migrated variants** (converted from a proven project per `skills/project-to-variant`) may enter directly at stable under the migration fast-track per [ADR-0099](../../adr/0099-template-migration-admission-policy.md): the source project's conversion eligibility replaces the beta-window criteria, which are explicitly waived ("N/A per ADR-0099", never "met") in the PROMOTION_CHECKLIST with a ratification row in Review History. A `stable` checklist with unwaived Pending criteria, or a short-window promotion without an ADR-0099 attestation row, is a validator finding (`validate-variant-claims.ts` checks k/l). Vocabulary: variant `stable` ≡ lifecycle-record `production`; variant `beta` ≡ `review` (mapping SSOT: `docs/lifecycle/README.md`).

---




## §9: Maintenance Rule

When a new `agents/<name>.md` is created, **the developer or AI agent responsible for the change** must:
1. Use the `agent-lifecycle-manager` skill to guide the process.
2. Add a row to the Agent Roster table above.
3. Add a row to the Subagent Roster dispatch table (with Parallelizable / Write Allowed columns).
4. Ensure the agent file follows the frontmatter specification in [CONSTITUTION.md §5.1](../../../docs/constitution/05-multi-agent-architecture.md#51-agent-file-format-standard-frontmatter).
5. If the agent uses a skill, add a row to the Skills table above.

When a new skill is created in `skills/` or `.claude/skills/`:
1. Use the `skill-lifecycle-manager` skill to guide the process.
2. Add a row to the Skills table above.
3. Ensure the skill follows the frontmatter specification in [CONSTITUTION.md §6.2](../../../docs/constitution/06-skill-lifecycle.md#62-skill-file-format-standard-frontmatter).

> **For the workspace root**: AGENTS.md is the SSOT. No separate `docs/context.md` sync required.
> **For individual projects**: Keep AGENTS.md in sync with `docs/context.md ## Agents` per [CONSTITUTION.md §1](../../../CONSTITUTION.md#1-standard-folder-structure).

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

1.5. **Triage accumulated session evidence** — review `memory/skill-review/*.md` records produced by the session-evidence loop (dev-sync step 3.96c; see `docs/constitution/06-skill-lifecycle.md` → "Session-Evidence Skill Review Loop (Observation-Based Revision)"). Fill `diagnosis`/`candidate` blocks at triage, then dispatch approved revisions through the normal PM Gateway path (§3).

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
