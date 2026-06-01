# PM Orchestrator Mode — Control Parameters (PM-02)

> **Purpose**: Document when and how the PM agent switches between Orchestrator mode and Direct Management mode, with concrete usage examples and decision criteria.  
> **Owner**: pm  
> **Related**: [agents/pm.md](../../agents/pm.md), [phase-definitions.md](../../templates/common/docs/phase-definitions.md)

---

## Overview

The PM agent operates in one of two modes at any given time:

| Mode | When Used | PM Role |
|------|-----------|---------|
| **Orchestrator** | Default — multi-step or multi-agent tasks | Facilitates, nominates specialists, synthesizes outputs |
| **Direct Management** | Exception — trivial tasks or specialist unavailable | Executes directly without dispatching agents |

---

## Parameter: Orchestrator Mode (Default)

### Activation Conditions

Orchestrator mode activates automatically when **any** of the following is true:

| Condition | Example |
|-----------|---------|
| Task spans 2+ files | "Update AGENTS.md and CHANGELOG.md" |
| Task requires 2+ sequential phases | Phase 4 execution → Phase 5 QA |
| Task dispatches a specialist agent | Architectural review, security scan |
| Task involves a meeting or structured decision | `/meeting` command invoked |
| Task modifies governance documents | Editing CONSTITUTION.md, variant.json |

### Behavior in Orchestrator Mode

1. **Execution Plan Display** (mandatory before Agent dispatch):
   ```
   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | [task] | [agent] | High/Medium/Low | opus/sonnet/haiku |
   ```

2. **Specialist Nomination**: PM states which agent owns each sub-task and why.

3. **Synthesis**: After each specialist completes work, PM synthesizes findings into a single provisional decision before proceeding.

4. **Quality Gate**: PM enforces the audit check before any commit or PR.

### Orchestrator Mode — What PM Must NOT Do

- ❌ Write implementation code directly (`Write`, `Edit` on source files without PM-approval flag)
- ❌ Invoke specialist agents without displaying the execution plan table first
- ❌ Skip the QA gate (Phase 6) before finalizing
- ❌ Override specialist findings without documented justification

---

## Parameter: Direct Management Mode (Exception)

### Activation Conditions

Direct Management mode is justified **only** when ALL of the following are true:

| Criterion | Check |
|-----------|-------|
| Task is single-step | One file, one change, no downstream effects |
| No specialist needed | Change requires no domain expertise beyond PM |
| Urgency is high | Blocking CI, broken hook, active incident |
| Specialist is unavailable | Agent dispatch would add >30 min delay |

If **any** criterion fails → use Orchestrator mode.

### Triggering Examples

```
✅ Direct Management appropriate:
  - Fix a typo in CHANGELOG.md
  - Bump a version number in variant.json
  - Respond to a simple factual question about workspace structure

❌ Direct Management NOT appropriate:
  - Add a new phase to phase-definitions.md   → orchestrate (docs-writer)
  - Fix a failing pre-commit hook             → orchestrate (automation-engineer)
  - Update multiple AGENTS.md files          → orchestrate (docs-writer + audit)
```

### Behavior in Direct Management Mode

1. PM states: `"Using Direct Management mode — reason: [single-step trivial fix / active incident]"`
2. PM executes the change directly.
3. PM runs `bun scripts/audit.ts` after the change to confirm no standards violations.
4. PM logs the direct action in the session memory log.

---

## Mode Switch Procedure

### Orchestrator → Direct Management

```
Trigger: User reports CI is broken and asks for an immediate fix.
PM states: "Switching to Direct Management mode (active CI incident, single-file fix)."
PM executes the fix.
PM runs audit to confirm clean.
PM switches back to Orchestrator mode for subsequent work.
```

### Direct Management → Orchestrator

Mode switches back to Orchestrator automatically when:
- The immediate exception is resolved
- The next task involves 2+ steps or requires a specialist
- No explicit "stay in Direct Management" instruction is given

---

## Usage Examples

### Example 1 — Normal Orchestrator Flow

```
User: "Update the PM orchestrator docs and sync them to all variants."

PM (Orchestrator mode):
| # | Task                          | Agent             | Tier   | Model  |
|---|-------------------------------|-------------------|--------|--------|
| 1 | Update docs/governance/pm-*.md | docs-writer       | Medium | sonnet |
| 2 | Sync to templates/common/      | automation-engineer| Low   | haiku  |
| 3 | Audit and QA                  | auditor           | Medium | sonnet |

Sequential: 1 → 2 → 3
```

### Example 2 — Direct Management Exception

```
User: "Quick fix — CHANGELOG.md has a typo in the [Unreleased] heading."

PM (Direct Management mode):
"Using Direct Management mode — reason: single-line typo fix, no specialist needed."
[Edits CHANGELOG.md directly]
[Runs bun scripts/audit.ts → PASS]
"Fixed. Returning to Orchestrator mode."
```

### Example 3 — Mode Decision Flowchart

```
New task received
       │
       ▼
  2+ files OR 2+ steps?
       │ Yes                  No
       ▼                      │
 Orchestrator mode            ▼
                         Specialist needed?
                              │ Yes          No
                              ▼              │
                         Orchestrator    Trivial fix?
                            mode            │ Yes
                                            ▼
                                      Direct Mgmt mode
                                      (state reason)
```

---

## Governance

| Field | Value |
|-------|-------|
| Created | 2026-05-29 |
| Owner | PM agent |
| Review trigger | PM agent role definition updated |
| Related document | [agents/pm.md](../../agents/pm.md) |

## Phase History

| Date | Version | Change |
|------|---------|--------|
| 2026-05-29 | 1.0.0 | Initial creation (A-05 from PM Facilitator Transition Review meeting) |

## Acceptance Criteria

- AC-05: This file documents PM orchestrator parameters with activation conditions and usage examples ✅

