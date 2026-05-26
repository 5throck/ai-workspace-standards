# Error Recovery Protocol

This document defines the error recovery protocol for multi-agent workflows.

## Overview

When an agent encounters an error during task execution, it follows a structured recovery process before escalating to the user.

## Error Classification

Errors are classified into one of four categories:

| Type | Description | Examples |
|------|-------------|----------|
| **Tool Error** | MCP tool or command execution failure | File not found, permission denied |
| **Context Error** | Insufficient or ambiguous information | Missing requirements, unclear spec |
| **Logic Error** | Agent reasoning or implementation bug | Wrong pattern selected, incorrect analysis |
| **External Error** | Third-party service or dependency failure | API timeout, dependency conflict |

## Recovery Process

### Phase 1: Error Analysis

When an error occurs, the agent must:

1. **Log the error**: Record error type, message, and context
2. **Classify the error**: Determine which category it belongs to
3. **Identify root cause**: Understand why the error occurred
4. **Determine recoverability**: Decide if the error can be fixed automatically

### Phase 2: Automatic Recovery

For recoverable errors, the agent may attempt up to **3 automatic retries**:

```typescript
interface RetryConfig {
  maxRetries: 3;
  initialDelay: 1000;      // 1 second
  backoffMultiplier: 2;    // Exponential backoff
  maxDelay: 10000;         // 10 second cap
}
```

#### Retry Strategy by Error Type

| Error Type | Retry Strategy | Max Retries |
|------------|---------------|-------------|
| Tool Error | Wait and retry with same parameters | 3 |
| Context Error | Ask clarifying question, then retry | 2 |
| Logic Error | Correct approach, then retry | 1 |
| External Error | Wait (exponential backoff), retry | 3 |

### Phase 3: Escalation

If automatic recovery fails after max retries, escalate to the user:

```json
{
  "escalation": {
    "task_id": "TASK-2025-001",
    "agent": "agent-name",
    "error": {
      "type": "tool | context | logic | external",
      "message": "Error description",
      "attempts": 3
    },
    "context": {
      "phase": "current-phase",
      "recent_actions": ["action1", "action2"]
    },
    "suggestions": [
      "Suggestion 1",
      "Suggestion 2"
    ],
    "requires_user_input": true
  }
}
```

## Error Recovery Templates

### Template 1: Tool Error Recovery

```
## Tool Error Detected

**Tool**: tool-name
**Error**: error-message
**Attempt**: 1/3

### Recovery Action
- Retrying with same parameters...
- Waiting 2s before retry...

[If retry fails]
- Attempt 2/3 failed
- Escalating to PM for guidance
```

### Template 2: Context Error Recovery

```
## Context Error Detected

**Issue**: Insufficient information to proceed
**Missing**: requirement-specification

### Clarification Needed
- What is the expected behavior for [specific-case]?
- Should the system handle X or Y in this scenario?

[Awaiting user response before retry]
```

### Template 3: Logic Error Recovery

```
## Logic Error Detected

**Issue**: Analysis resulted in contradictory conclusions
**Root Cause**: Applied wrong pattern for [scenario]

### Correction
- Re-evaluating using [correct-pattern]
- Adjusting approach based on new understanding

[Proceed with corrected logic]
```

### Template 4: External Error Recovery

```
## External Error Detected

**Service**: service-name
**Error**: connection-timeout
**Attempt**: 1/3

### Recovery Action
- Waiting 2s (exponential backoff)...
- Retrying service connection...

[If all retries fail]
- External service unavailable after 3 attempts
- Suggesting user check service status
- Escalating for manual intervention
```

## Integration with Scripts

The `scripts/retry-handler.ts` provides automated retry logic:

```typescript
import { withRetry, escalateToHuman } from "./retry-handler";

const result = await withRetry(
  () => dispatchSubagent(task),
  {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000
  },
  "Task Description"
);

if (!result.success) {
  escalateToHuman(
    "Task Description",
    result.lastError!,
    result.attempts
  );
  process.exit(1);
}
```

## Best Practices

1. **Fail Fast**: If an error is clearly unrecoverable, escalate immediately
2. **Context Preservation**: Maintain full context across retry attempts
3. **Progressive Enhancement**: Each retry should have more information than the last
4. **Clear Communication**: Always explain what failed and why to the user
5. **Learning**: Document error patterns in `memory/` for future reference

## Error Prevention

To minimize errors:

- **Pre-flight checks**: Verify all prerequisites before starting
- **Incremental validation**: Check each step before proceeding
- **Clear contracts**: Use handoff-spec.md for agent communication
- **Defensive coding**: Handle edge cases explicitly

---

*Error recovery protocol v1.0 - part of the multi-agent workflow*
