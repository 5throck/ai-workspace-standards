# ADR-0030 Auto-Mode Value Re-analysis

**Date**: 2026-06-05
**Trigger**: User question about Auto-Mode value given Agent Manager approval constraints
**Status**: Critical re-evaluation

---

## The User's Question

> "별도의 승인없이 진행이 불가능하다고 하면 이전에 만들어놓았던 auto-mode가 큰 의미가 있을지 궁금해?"

**Translation**: If separate approvals are still required, does the previously created Auto-Mode (ADR-0030) have significant value?

---

## ADR-0030 Re-examination

### What ADR-0030 Claims to Solve

**From ADR-0030 Context**:
> "The current PM Gateway workflow requires repetitive manual dispatch of specialist agents for multi-step tasks. After a user approves an execution plan, PM must manually invoke each specialist agent sequentially, which creates friction and inefficiency."

**Current Pain Points (ADR-0030)**:
1. Manual dispatch overhead: PM outputs execution plan → user approves → PM manually calls Agent tool for each specialist
2. Repetitive confirmation loops: Each phase requires user interaction even after plan approval
3. Phase-by-phase blocking: Cannot auto-execute across phase boundaries

### What ADR-0030 Actually Provides

**From ADR-0030 Decision**:
```
Auto-Mode orchestrates task execution with checkpoint system:

1. Load parsed plan from Plan Parser
2. For each task in sequence:
   - Display current task to user
   - Prompt for checkpoint confirmation (Enter to continue, Ctrl+C to abort)
   - Dispatch agent via Platform Dispatcher
   - Wait for completion
   - On success: mark checkpoint, proceed to next task
   - On failure: offer options (retry/skip/abort)
3. Run final QA audit automatically
4. Report completion summary
```

### The Critical Constraint (ADR-0030 Line 161)

> "Antigravity limitation: Agent Manager UI cannot be automated; requires user interaction for each agent spawn"

---

## Value Analysis: Claude Code vs Antigravity

### Claude Code Environment

**Before Auto-Mode (Current)**:
```
User: "Update CLAUDE.md §5 and propagate"
 ↓
PM: Displays execution plan table
 ↓
User: "Looks good" (approves)
 ↓
PM: Manually invokes Agent tool 15 times (one per file)
 ↓
Result: 15 manual agent invocations
```

**After Auto-Mode (Hypothetical)**:
```
User: "Update CLAUDE.md §5 and propagate"
 ↓
PM: Displays execution plan table
 ↓
User: "Looks good" (approves)
 ↓
Auto-Mode:
  - Loads parsed plan
  - For each task:
    - Display "Task 1/15: Update CLAUDE.md §5"
    - User: Enter (checkpoint)
    - Auto-dispatch docs-writer
    - Wait completion
    - Mark checkpoint
  - Next task...
 ↓
Result: 15 checkpoints (user presses Enter 15 times), but automatic dispatch
```

**Value for Claude Code**:
- ✅ Eliminates manual Agent tool invocation
- ✅ Checkpoint system provides visibility
- ⚠️ Still requires 15 Enter presses (checkpoint confirmations)
- ✅ Error handling automated (retry/skip/abort options)

**Net Value**: **Moderate** - Reduces PM work but still requires user interaction

---

### Antigravity Environment (The Problem Area)

**Before Auto-Mode (Current)**:
```
User: "Update CLAUDE.md §5 and propagate"
 ↓
PM: Displays execution plan table
 ↓
Agent Manager: "Approve execution plan?" (Prompt 1)
 ↓
User: Approves
 ↓
PM: Manually invokes Agent tool (Task 1)
 ↓
Agent Manager: "Approve docs-writer spawn?" (Prompt 2)
 ↓
User: Approves
 ↓
[Docs-writer executes]
 ↓
PM: Manually invokes Agent tool (Task 2)
 ↓
Agent Manager: "Approve docs-writer spawn?" (Prompt 3)
 ↓
User: Approves
... (repeats 15 times)
 ↓
Result: 16 approval prompts (1 plan + 15 agent spawns)
```

**After Auto-Mode (With ADR-0030)**:
```
User: "Update CLAUDE.md §5 and propagate"
 ↓
PM: Displays execution plan table
 ↓
Agent Manager: "Approve execution plan?" (Prompt 1)
 ↓
User: Approves
 ↓
Auto-Mode:
  - Loads parsed plan
  - For each task:
    - Display "Task 1/15: Update CLAUDE.md §5"
    - User: Enter (checkpoint)
    - Auto-dispatch docs-writer
    - ↓
    - Agent Manager: "Approve docs-writer spawn?" (Prompt 2)
    - ↓
    - User: Approves
    - ↓
    - Wait completion
    - Mark checkpoint
  - Next task...
 ↓
Result: 16 approval prompts (1 plan + 15 agent spawns) + 15 checkpoint Enters
```

**Value for Antigravity**:
- ❌ Agent Manager prompts STILL REQUIRED (Plan + each agent spawn)
- ❌ Checkpoint Enter presses ADDED (additional 15 interactions)
- ❌ Total interactions INCREASED (16 prompts + 15 Enters = 31 interactions)
- ✅ Error handling automated (retry/skip/abort)

**Net Value**: **NEGATIVE** - Adds more interaction steps without solving the core problem

---

## The Fundamental Misunderstanding

### What We Thought Auto-Mode Would Solve

**Original Expectation**:
> "Auto-Mode enables automated plan execution for Antigravity's Agent Manager workflow."

**Interpretation**: After plan approval, everything runs automatically without further prompts.

### What Auto-Mode Actually Solves

**Reality (ADR-0030 Line 161)**:
> "Agent Manager UI cannot be automated; requires user interaction for each agent spawn"

**What Auto-Mode Automates**:
- ✅ Agent tool invocation (PM doesn't manually call Agent tool)
- ✅ Task sequencing (follows the plan automatically)
- ✅ Checkpoint tracking (marks progress)
- ✅ Error handling (retry/skip/abort)

**What Auto-Mode Does NOT Solve**:
- ❌ Agent Manager approval prompts (still required for each agent spawn)

---

## Comparison: Manual vs Auto-Mode

### Claude Code (where Auto-Mode has value)

| Aspect | Manual (Current) | With Auto-Mode | Improvement |
|--------|-----------------|----------------|-------------|
| PM work | 15 manual Agent calls | 0 (automated) | ✅ Eliminated |
| User checkpoints | None | 15 Enter presses | ⚠️ Added |
| Total interactions | ~20 (including approval) | ~35 (15 Enters + 20) | ⚠️ Increased |
| Error handling | Manual | Automated (retry/skip) | ✅ Improved |

**Net**: Moderate value (trades PM work for user checkpoints)

### Antigravity (where Auto-Mode has limited value)

| Aspect | Manual (Current) | With Auto-Mode | Improvement |
|--------|-----------------|----------------|-------------|
| PM work | 15 manual Agent calls | 0 (automated) | ✅ Eliminated |
| Agent Manager prompts | 16 (1 plan + 15 spawns) | 16 (unchanged) | ❌ Unchanged |
| User checkpoints | None | 15 Enter presses | ⚠️ Added |
| Total interactions | 16 prompts | 16 prompts + 15 Enters = 31 | ❌ Increased |
| Error handling | Manual | Automated (retry/skip) | ✅ Improved |

**Net**: Negative value (adds work without solving core problem)

---

## The Root Problem

### Auto-Mode Solves the Wrong Problem

**Auto-Mode addresses**: "PM manually invokes Agent tool repeatedly"
**Real problem**: "Agent Manager prompts for approval on each agent spawn"

**Why this matters**:
- In Claude Code: Agent tool doesn't require approval → Auto-Mode helps
- In Antigravity: Agent Manager requires approval → Auto-Mode doesn't help the core issue

### The ADR-0030 Contradiction

**ADR-0030 states**:
> "Auto-Mode enables automated plan execution for Antigravity's Agent Manager workflow."

**But ADR-0030 also states** (Line 161):
> "Agent Manager UI cannot be automated; requires user interaction for each agent spawn"

**This is a contradiction**: How can it be "automated plan execution" if Agent Manager still requires user interaction for each agent spawn?

---

## Honest Answer to the User's Question

### Does Auto-Mode Have Value?

**For Claude Code**: **YES, Moderate Value**
- Reduces PM manual work
- Provides checkpoint visibility
- Automates error handling
- Trade-off: Adds checkpoint interactions

**For Antigravity**: **LIMITED to NO Value**
- Does NOT solve the Agent Manager approval loop problem
- Adds checkpoint interactions on top of existing prompts
- Only value: Automates error handling

### What Auto-Mode Actually Is

**Auto-Mode is**: Task execution orchestrator with checkpoints
**Auto-Mode is NOT**: Agent Manager approval bypass

**The confusion**: "Auto-Mode" naming suggests full automation, but it only automates agent dispatch, not Agent Manager approvals.

---

## Recommendations

### Option 1: Accept Auto-Mode as-Is (Limited Value)

**Rationale**:
- Reduces PM work (no manual Agent calls)
- Provides checkpoint visibility
- Automates error handling

**Trade-off**:
- Still requires Agent Manager approvals (16 prompts in example)
- Adds checkpoint interactions (15 Enters in example)

**Best for**: Users who value checkpoint visibility and error handling over interaction count

### Option 2: Deprecate Auto-Mode for Antigravity (Honest Approach)

**Rationale**:
- Auto-Mode doesn't solve the core Antigravity problem (Agent Manager approvals)
- Adding interactions without solving the problem is net negative
- Focus on alternative solutions (command-line flags, platform changes)

**Action**:
- Document ADR-0030 as "Claude Code-only value"
- Deprecate Auto-Mode for Antigravity
- Focus on Alternative A (documentation) + Alternative C (platform feature request)

### Option 3: Rename and Clarify Auto-Mode Scope (Communication Fix)

**Rationale**:
- "Auto-Mode" is misleading (suggests full automation)
- Rename to "Task-Orchestrator" or "Checkpoint-Mode"
- Clarify in documentation that it doesn't bypass Agent Manager approvals

**Action**:
- Update ADR-0030 title and scope
- Clarify limitations
- Set appropriate user expectations

---

## Conclusion

### The Honest Answer

**For Antigravity**: **Auto-Mode has limited to no value** because it doesn't solve the Agent Manager approval problem that prompted its creation.

**The irony**: ADR-0030 was created to reduce "repetitive manual dispatch" and "repetitive confirmation loops", but in Antigravity, it adds more confirmation loops (checkpoints) without solving the real repetitive confirmation (Agent Manager approvals).

### What Actually Needs to Happen

**To truly automate Antigravity**:
1. Agent Manager needs `.gemini/settings.json` auto-approve support (Alternative C)
2. OR Agent Manager needs to support auto-approval via hooks (Alternative B)
3. OR users must use `--yolo` flag (Alternative A - but CLI-only)

**Auto-Mode (ADR-0030) is a workaround for the wrong problem.**

---

## Recommendation

**Deprecate Auto-Mode for Antigravity** and focus on:
1. **Alternative A**: Document `--yolo` flag usage (immediate value)
2. **Alternative C**: Request platform feature for `.gemini/settings.json` auto-approve (long-term solution)

**For Claude Code**: Auto-Mode can remain as-is (has moderate value)

**For Antigravity**: Auto-Mode should be marked as "limited value - doesn't solve Agent Manager approval problem"
