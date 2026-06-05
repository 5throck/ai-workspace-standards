# Antigravity Auto-Mode Documentation Check Report

**Date**: 2026-06-05
**Investigator**: automation-engineer
**Phase**: 1 - Documentation Verification
**Status**: Complete

---

## Executive Summary

**Finding**: Antigravity does **NOT** support `.gemini/settings.json`-based `autoMode` configuration for agent spawn auto-approval.

**Conclusion**: The proposed `.gemini/settings.json` `autoMode` section approach is **not feasible**. Alternative methods must be used.

---

## Documentation Sources Checked

### 1. Local Documentation (`.gemini/`)

**`.gemini/settings.json`**:
- Current structure: `mcpServers`, `hooks`
- No `autoMode`, `autoApprove`, or permission-related settings for agent spawning
- No schema comments or examples

**`.gemini/commands/`**:
- Contains command definitions only (changelog, commit-push-pr, meeting, memlog, new-task, sync)
- No configuration documentation

**GEMINI.md**:
- References ADR-0030 for Auto-Mode architecture
- Contains permission denial protocol documentation
- No `.gemini/settings.json` auto-approval configuration

### 2. Architecture Documentation (ADR-0030)

**ADR-0030: Auto-Mode for Antigravity Platform**:
- **Scope**: Defines Auto-Mode as **execution plan automation** (TypeScript modules)
- **Key Finding (Line 161)**: "Agent Manager UI cannot be automated; requires user interaction for each agent spawn"
- **Components**:
  - `scripts/lib/platform-dispatcher.ts` (Agent dispatch abstraction)
  - `scripts/lib/auto-mode.ts` (Plan execution orchestration)
  - `scripts/lib/plan-parser.ts` (Markdown → structured tasks)
  - `scripts/lib/checkpoint-manager.ts` (Execution progress tracking)

**Critical Distinction**:
- ADR-0030's Auto-Mode automates **execution plan dispatch** after plan approval
- It does **NOT** automate **Agent Manager's agent spawn approval prompts**

### 3. Official Antigravity Documentation

**Web Search Results**:

**Configuration File Location**:
```
~/.gemini/antigravity-cli/settings.json
```

**Auto-Approval Methods**:

**Option A: YOLO Mode (Command-Line Only)**
- **Command**: `--yolo` or `--approval-mode=yolo`
- **Scope**: Auto-approves all actions
- **Limitation**: CLI-only flag, NOT configurable in `settings.json`

**Option B: Terminal Execution Policy (UI Only)**
- **Path**: Settings → Antigravity → Terminal Execution Policy
- **Scope**: Terminal command auto-execution
- **Limitation**: IDE UI setting, NOT stored in `settings.json`

**Available Settings**:
- `enableTerminalSandbox` - Terminal sandbox behavior (configurable in settings.json)
- MCP configurations - Stored in separate `~/.gemini/antigravity-cli/mcp_config.json`

**Documentation References**:
- [Antigravity CLI Features](https://antigravity.google/docs/cli-features)
- [Gemini CLI Configuration Reference](https://geminicli.com/docs/reference/configuration/)
- [Antigravity Permissions](https://antigravity.google/docs/cli-permissions)

---

## Key Findings

### 1. No `.gemini/settings.json` Auto-Mode Support

**Confirmed**: Antigravity does **NOT** support any of these in `settings.json`:
- `autoMode.enabled`
- `autoMode.autoApproveExecutionPlans`
- `autoMode.autoApproveAgentSpawns`
- `autoMode.requireApprovalOnlyForDestructiveOps`

**Reason**: Auto-approval is implemented as:
- **Command-line flags** (`--yolo`, `--approval-mode=yolo`)
- **UI settings** (Terminal Execution Policy)

### 2. Agent Manager UI Cannot Be Automated

**ADR-0030 (Line 161) Quote**:
> "Antigravity limitation: Agent Manager UI cannot be automated; requires user interaction for each agent spawn"

**Implication**: Even if we implement ADR-0030's Auto-Mode TypeScript modules, **Agent Manager will still prompt for approval on each agent spawn**.

### 3. Architecture Mismatch

**What ADR-0030 Solves**:
- ✅ Automates execution plan → agent dispatch (after plan approval)
- ✅ Checkpoint-based error handling
- ✅ Cross-platform agent spawning

**What We Need**:
- ❌ Suppress Agent Manager's agent spawn approval prompts
- ❌ Configure auto-approval via `settings.json` (for L0/L1/L2 propagation)

**Gap**: ADR-0030's Auto-Mode does **NOT** solve the Agent Manager approval loop problem.

---

## Recommended Alternatives

### Priority 1: Command-Line Flag Approach (YOLO Mode)

**Implementation**:
```bash
# User executes:
antigravity --yolo  # Auto-approve all actions
# OR
antigravity --approval-mode=yolo
```

**Template Integration**:
- Add to `.env.example`:
  ```bash
  # Antigravity Auto-Approval (YOLO Mode)
  ANTI_GRAVITY_APPROVAL_MODE=yolo
  ```
- Document in GEMINI.md: "For auto-approval, use `--yolo` flag"

**Pros**:
- Official Antigravity feature
- Works immediately

**Cons**:
- ❌ Cannot propagate via `.gemini/settings.json`
- ❌ L0/L1/L2 templates cannot auto-configure
- ❌ Each user must manually use flag

### Priority 2: Hook-Based Approach (If Supported)

**Research Needed**: Does Antigravity support agent-spawn hooks?

**Hypothetical Implementation**:
```json
{
  "hooks": {
    "AgentSpawn": {
      "autoApprove": true
    }
  }
}
```

**Action**: Verify if Antigravity supports this hook type.

**Pros** (if supported):
- ✅ Can propagate via `.gemini/settings.json`
- ✅ L0/L1/L2 auto-propagation works

**Cons**:
- ⚠️ Support unknown (needs verification)

### Priority 3: UI Documentation Approach

**Implementation**:
- Document in GEMINI.md:
  > "First-time setup: Enable auto-approval in Agent Manager Settings"
- User manually configures UI

**Pros**:
- Most reliable (if UI supports it)

**Cons**:
- ❌ Cannot auto-propagate
- ❌ Manual setup required per user

---

## Conclusion

**Original Proposal Feasibility**: ❌ **NOT FEASIBLE**

The proposed `.gemini/settings.json` `autoMode` section approach cannot work because:
1. Antigravity doesn't support it
2. Agent Manager UI requires manual interaction (confirmed by ADR-0030)
3. Auto-approval is only available via command-line flags or UI settings

**Recommended Path Forward**:

**Immediate**:
- Use Priority 1 (Command-Line YOLO Mode) + `.env.example` documentation
- Update GEMINI.md with `--yolo` flag instructions

**Long-term** (if hook-based auto-approve is possible):
- Investigate Priority 2 (Hook-Based Approach)
- If supported, implement via `.gemini/settings.json` for L0/L1/L2 propagation

**Alternative Consideration**:
- Re-examine whether ADR-0030's Auto-Mode TypeScript modules can be extended to interact with Agent Manager's approval system (may require Antigravity platform changes)

---

## References

**Local Documentation**:
- `.gemini/settings.json` (current configuration)
- `GEMINI.md` (PM Gateway, Auto-Mode references)
- `docs/adr/0030-auto-mode-architecture.md` (Auto-Mode architecture)

**Official Documentation**:
- [Antigravity CLI Features](https://antigravity.google/docs/cli-features)
- [Gemini CLI Configuration Reference](https://geminicli.com/docs/reference/configuration/)
- [Antigravity Permissions](https://antigravity.google/docs/cli-permissions)

**Web Search Queries**:
- "Antigravity Agent Manager settings.json auto approve configuration"
- "Gemini CLI configuration auto approve yolo mode"
- "Antigravity Terminal Execution Policy settings.json"
