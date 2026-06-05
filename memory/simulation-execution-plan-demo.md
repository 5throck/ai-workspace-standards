# Claude Code Execution Plan Simulation

**Date**: 2026-06-05
**Scenario**: Multi-agent task requiring execution plan table
**Platform**: Claude Code (Native Agent Tool)

---

## Scenario Setup

**User Request Example**:
```
"CLAUDE.md와 GEMINI.md의 §5 PM Gateway 섹션을 최신 ADR-0030과 일치하도록 업데이트하고,
모든 variant 템플릿에 전파해주세요."
```

**Context**:
- Multiple files involved (CLAUDE.md, GEMINI.md, templates/*/CLAUDE.md, templates/*/GEMINI.md)
- Platform parity changes required
- Template propagation required
- Root configuration files affected

**Mandatory Criteria Check** (CLAUDE.md §5):
1. ✅ Multi-agent Dispatch: 2+ specialists (docs-writer × N files)
2. ✅ Breaking Changes: Yes (PM Gateway section update)
3. ✅ Platform Parity Changes: Yes (CLAUDE.md ↔ GEMINI.md sync)
4. ✅ Root Configuration Changes: Yes (CLAUDE.md, GEMINI.md)

**Result**: **Execution plan table REQUIRED** before any Agent tool invocation.

---

## PM Agent Execution Plan

| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Update CLAUDE.md §5 PM Gateway section | docs-writer | Medium | claude-sonnet-4-6 |
| 2 | Update GEMINI.md §5 PM Gateway section | docs-writer | Medium | claude-sonnet-4-6 |
| 3 | Update templates/common/CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 4 | Update templates/common/GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 5 | Update templates/co-consult/CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 6 | Update templates/co-consult/GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 7 | Update templates/co-design/CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 8 | Update templates/co-design/GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 9 | Update templates/co-develop/CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 10 | Update templates/co-develop/GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 11 | Update templates/co-security/CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 12 | Update templates/co-security/GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 13 | Update templates/co-work/CLAUDE.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 14 | Update templates/co-work/GEMINI.md §5 | docs-writer | Medium | claude-sonnet-4-6 |
| 15 | Update scripts/SCRIPTS.md (lifecycle sync) | docs-writer | Medium | claude-sonnet-4-6 |
| 16 | Lifecycle Update (Version, Timestamp, SCRIPTS.md) | docs-writer | Medium | claude-sonnet-4-6 |
| 17 | Final QA Audit (bun scripts/audit.ts) | auditor | Medium | claude-sonnet-4-6 |

**Execution Order**: Parallel for tasks 1-14 (docs-writer can update all CLAUDE.md/GEMINI.md files simultaneously), then sequential for 16-17

---

## How PM Agent Works in Claude Code

### Step 1: Request Analysis
```
User: "Update CLAUDE.md §5 and propagate to all templates"

PM Agent Internal Process:
├─ Check task type → Multi-file documentation update
├─ Count files → 14 files (7 variants × 2 platforms)
├─ Check mandatory criteria:
│  ├─ Multi-agent dispatch? → YES (2+ files)
│  ├─ Platform parity changes? → YES (CLAUDE.md ↔ GEMINI.md)
│  ├─ Root config changes? → YES (CLAUDE.md, GEMINI.md)
│  └─ Template propagation? → YES
└─ Determine: EXECUTION PLAN TABLE REQUIRED
```

### Step 2: Table Construction
```
PM Agent generates table with:
├─ Each file update as separate row
├─ Agent assignment based on deliverable type (docs-writer for documentation)
├─ Tier based on agent definition (docs-writer = Medium)
├─ Model selection based on 3-tier strategy (Medium = sonnet-4-6)
└─ Lifecycle Update + QA Audit as final two rows (MANDATORY)
```

### Step 3: Display to User
```
[PM displays execution plan table]

Then asks:
"Does this plan look correct? I'll dispatch the specialists once approved."
```

### Step 4: User Approval
```
User: "Looks good, proceed"

PM Agent:
├─ For each task:
│  ├─ Invoke Agent tool with subagent_type="docs-writer"
│  ├─ Pass specific task prompt (e.g., "Update CLAUDE.md §5...")
│  └─ Wait for completion
└─ After all tasks: Run QA audit (bun scripts/audit.ts)
```

---

## Key Differences: Claude Code vs Antigravity

### Claude Code (Native Agent Tool)
```
Step 1: PM displays execution plan table
   ↓
Step 2: User approves (or modifies)
   ↓
Step 3: PM invokes Agent tool for each specialist
   ↓
Step 4: Subagents execute in parallel/sequence as planned
   ↓
Step 5: PM runs final QA audit
```

**Characteristics**:
- Execution plan table is **informational only**
- User approval **not enforced by system** (workflow convention, not technical constraint)
- PM agent follows convention voluntarily
- Agent tool calls proceed regardless of user response

### Antigravity (Agent Manager)
```
Step 1: PM displays execution plan table
   ↓
Step 2: Agent Manager **BLOCKS** until user approves
   ↓
Step 3: User must explicitly approve (UI interaction)
   ↓
Step 4: Agent Manager unblocks execution
   ↓
Step 5-7: Same as Claude Code
```

**Characteristics**:
- Execution plan table is **enforced by system**
- User approval is **mandatory technical constraint**
- Agent Manager literally stops workflow until approval
- No way to bypass without changing Agent Manager settings

---

## Why Claude Code Doesn't Have This Problem

**Claude Code's Approach**:
- Execution plan display = **PM agent convention**, not system enforcement
- User can ignore the plan and PM still proceeds (voluntary adherence)
- Native Agent tool spawns subagents without blocking
- Permission mode controls tool access, not agent spawn approval

**Result**:
- Auto-mode in Claude Code = "set permission mode to auto" → agents spawn freely
- No separate approval loop for agent dispatch
- PM Gateway is a **workflow pattern**, not a **system gate**

---

## Simulation: What User Sees

### Claude Code Session (Auto-mode ON)
```
User: "Update CLAUDE.md §5 and propagate to templates"

[PM Agent displays execution plan table]

[PM Agent immediately begins dispatching docs-writer agents]

[No approval prompt - execution proceeds automatically]

[15 parallel docs-writer subagents spawn]

[QA audit runs automatically]

Result: Complete execution without interruption
```

### Antigravity Session (Auto-mode ON - Current Problem)
```
User: "Update CLAUDE.md §5 and propagate to templates"

[PM Agent displays execution plan table]

[Agent Manager UI pops up: "Approve execution plan?"]

[User must click "Approve"]

[Agent Manager unblocks]

[PM Agent dispatches first docs-writer]

[Agent Manager UI pops up: "Approve agent spawn?"]

[User must click "Approve"]

[Repeat for each of 15 agents]

Result: 16 approval prompts despite auto-mode setting
```

---

## Solution: Antigravity Configuration

To make Antigravity behave like Claude Code, configure:

**Option 1: Agent Manager Settings**
```
.gemini/settings.json:
{
  "agentManager": {
    "autoApproveExecutionPlans": true,
    "autoApproveAgentSpawns": true,
    "requireApprovalOnlyForDestructiveOps": true
  }
}
```

**Option 2: Environment Variable**
```bash
ANTIGRAVITY_AUTO_MODE=1
# Should suppress all non-destructive approval prompts
```

**Option 3: Agent Manager UI**
- Settings → Permissions → Auto-approve non-destructive operations: ON

---

## Conclusion

**Claude Code**: Execution plan display is a PM workflow pattern, not a system gate
**Antigravity**: Agent Manager enforces approval at multiple points (execution plan + each agent spawn)

**Fix needed**: Configure Antigravity Agent Manager to auto-approve in auto-mode, similar to how Claude Code's permission mode works.
