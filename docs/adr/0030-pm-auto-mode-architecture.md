# ADR-0030: PM Auto-Mode Architecture

**Status**: Proposed
**Date**: 2026-06-05
**Deciders**: PM, architect
**Supersedes**: —

## Context

The current PM Gateway workflow requires repetitive manual dispatch of specialist agents for multi-step tasks. After a user approves an execution plan, PM must manually invoke each specialist agent sequentially, which creates friction and inefficiency.

**Current pain points**:

1. **Manual dispatch overhead**: PM outputs execution plan table → user approves → PM manually calls Agent tool for each specialist
2. **Repetitive confirmation loops**: Each phase requires user interaction even after plan approval
3. **Phase-by-phase blocking**: Cannot auto-execute across phase boundaries (e.g., Phase 4 → Phase 6)

**User expectation**: When a user approves an execution plan, they expect automatic execution of the approved tasks with appropriate checkpoints, not manual step-by-step dispatch.

**Platform Impact**: PM auto-mode requires cross-platform support (Claude Code + Antigravity). The architecture must handle both native Agent tool dispatch (Claude Code) and Agent Manager UI-based dispatch (Antigravity).

## Decision

### Architecture Overview

PM auto-mode introduces a layered orchestration system for automatic plan execution:

```
┌─────────────────────────────────────────────────────┐
│                   PM Auto-Mode                       │
├─────────────────────────────────────────────────────┤
│  1. Plan Parser (Markdown → Structured Tasks)       │
│  2. Auto-Executor (Checkpoint-based Orchestration)  │
│  3. Platform Dispatcher (Cross-platform Agent Spawn) │
│  4. Checkpoint Manager (Session-only State)         │
└─────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Platform Dispatcher (`scripts/lib/platform-dispatcher.ts`)

**Purpose**: Abstraction layer for spawning agents across Claude Code and Antigravity platforms.

**Responsibilities**:
- Detect current platform (Claude Code CLI vs Antigravity)
- Dispatch agents using appropriate mechanism:
  - **Claude Code**: Native `Agent` tool with role-based prompts
  - **Antigravity**: Agent Manager UI-based spawning (requires user interaction)
- Return agent completion status for checkpoint tracking

**Interface**:
```typescript
interface PlatformDispatcher {
  dispatch(agent: AgentConfig): Promise<AgentResult>;
  getPlatform(): 'claude' | 'antigravity';
}
```

#### 2. Plan Parser (`scripts/lib/plan-parser.ts`)

**Purpose**: Convert Markdown execution plan table into structured task objects.

**Input format** (Markdown table):
```markdown
| # | Task | Agent | Tier | Model | Platform |
|---|------|-------|------|-------|----------|
| 1 | Design component | architect | High | opus | Claude |
```

**Output format** (Structured task list):
```typescript
interface ParsedTask {
  sequence: number;
  description: string;
  agentType: string;
  tier: 'High' | 'Medium' | 'Low';
  model: string;
  platform: 'Claude' | 'Antigravity' | 'Both' | 'L0-only';
}
```

**Decision rationale**: Markdown format chosen for:
- Backward compatibility with existing PM workflow
- Human-readable plan files
- Easy editing during review phase
- No migration burden for existing plans

#### 3. Auto-Executor (`scripts/lib/auto-executor.ts`)

**Purpose**: Orchestrate task execution with checkpoint system and error handling.

**Execution flow**:
1. Load parsed plan from Plan Parser
2. For each task in sequence:
   - Display current task to user
   - Prompt for checkpoint confirmation (Enter to continue, Ctrl+C to abort)
   - Dispatch agent via Platform Dispatcher
   - Wait for completion
   - On success: mark checkpoint, proceed to next task
   - On failure: offer options (retry/skip/abort)
3. Run final QA audit automatically (last 2 steps)
4. Report completion summary

**Error handling**:
- Agent failure: Offer retry (max 3 attempts) or skip
- Permission denial: Halt and escalate per PM protocol
- User abort: Graceful shutdown with state cleanup

#### 4. Checkpoint Manager (`scripts/lib/checkpoint-manager.ts`)

**Purpose**: Track execution progress and enable resumption after failures.

**Checkpoint data** (session-only, in-memory):
```typescript
interface CheckpointState {
  planId: string;
  completedTasks: number[];
  currentTask: number | null;
  failures: Map<number, FailureReason>;
  lastUpdate: Date;
}
```

**State persistence**: Session-only (no disk persistence). Reasons:
- **Security**: Prevents state manipulation or stale checkpoint reuse
- **Simplicity**: In-memory maps are sufficient for single-session runs
- **Freshness**: Each run starts clean; no legacy state corruption

**Rollback capability**:
- **File state**: Git-based rollback (user can `git checkout` files from before execution)
- **Checkpoint state**: Clear from memory on abort/failure
- **No database**: Avoids persistence complexity and security risks

### User Decisions Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Plan format** | Markdown | Backward compatibility, human-readable, no migration |
| **Checkpoint storage** | Session-only (in-memory) | Security, simplicity, avoids stale state |
| **Rollback mechanism** | Git-based (files) + memory clear (checkpoints) | Balanced approach; leverages existing git workflow |
| **Confirmation model** | Checkpoint prompts between tasks | User control without overwhelming UI |

## Consequences

**Positive**:

- PM workflow automation reduces manual dispatch overhead
- Improved user experience: approve once, execute automatically
- Checkpoint system maintains control and visibility
- Cross-platform support enables Antigravity integration
- Session-only checkpoints avoid security risks and state pollution
- Git-based rollback leverages existing safety mechanisms

**Negative / Trade-offs**:

- **Complexity increase**: 4 new TypeScript modules in `scripts/lib/`
- **Testing burden**: Cross-platform dispatch requires testing on both Claude Code and Antigravity
- **Maintenance overhead**: Plan parser must stay synchronized with PM table format
- **Antigravity limitation**: Agent Manager UI cannot be automated; requires user interaction for each agent spawn

**Requirements**:

- [ ] Implement `scripts/lib/platform-dispatcher.ts`
- [ ] Implement `scripts/lib/plan-parser.ts`
- [ ] Implement `scripts/lib/auto-executor.ts`
- [ ] Implement `scripts/lib/checkpoint-manager.ts`
- [ ] L0 → L1 propagation: Copy modules to `templates/common/scripts/lib/`
- [ ] L1 → L2 propagation: Update all 4 variants (`templates/co-*/scripts/lib/`)
- [ ] Update PM agent workflow to support `/auto` flag for auto-mode activation
- [ ] Add unit tests for plan parser (Markdown → structured tasks)
- [ ] Add integration tests for platform dispatcher (mock Agent tool)

## Alternatives Considered

### Option A: YAML/JSON Plan Format

**Approach**: Store execution plans in YAML or JSON instead of Markdown tables.

**Rejected because**:
- Breaking change: Requires migrating existing Markdown plans
- UX degradation: YAML/JSON less human-readable for non-technical users
- Tooling gap: No built-in YAML/JSON editor in standard CLI tools
- Plan parser complexity: YAML parsing adds dependency (e.g., `js-yaml`)

### Option B: Full Git Rollback with Auto-Revert

**Approach**: On failure, automatically `git reset --hard` to pre-execution state.

**Rejected because**:
- **Destructive**: Hard reset discards user's uncommitted work
- **Surprising**: Users may not expect automatic git reversal
- **Complex**: Requires detecting which files were modified by which agent
- **Risk of data loss**: Auto-rollback could destroy valuable intermediate state

**Current approach (Git-based manual rollback)** is safer: Users can choose to revert files selectively after reviewing changes.

### Option C: Persistent Checkpoints with Database

**Approach**: Store checkpoints in a SQLite database or JSON file for resumption across sessions.

**Rejected because**:
- **Security risk**: Persistent state can be manipulated or stale
- **Complexity**: Requires schema design, migration path, and cleanup logic
- **Limited benefit**: Most PM workflows complete in single session
- **Recovery edge cases**: Handling "resume after 3 days" scenarios is complex

**Current approach (session-only checkpoints)** balances simplicity and safety: Each run is self-contained; failures require manual review anyway.

## References

**Related Documentation**:
- [CONSTITUTION.md §5 - Multi-Agent Architecture](../../CONSTITUTION.md#5-multi-agent-architecture)
- [agents/pm.md - PM Gateway Workflow](../../agents/pm.md)
- [CLAUDE.md §5 - Agent Dispatch Rules](../../CLAUDE.md#5-agent-dispatch-rules)

**Implementation Files**:
- `scripts/lib/platform-dispatcher.ts` (to be created)
- `scripts/lib/plan-parser.ts` (to be created)
- `scripts/lib/auto-executor.ts` (to be created)
- `scripts/lib/checkpoint-manager.ts` (to be created)

**Example Plan** (for parser testing):
- `C:\Users\USER\.claude\plans\sparkling-jingling-journal.md` (Markdown execution plan format)

**Related ADRs**:
- [ADR-0027: Domain Flag Extension Strategy](0027-domain-flag-extension-strategy.md) — Example of script governance pattern
