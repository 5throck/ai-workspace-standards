# Agent Handoff Specification

This document defines the JSON-based handoff format between agents in the multi-agent workflow.

## Handoff Format

All agent handoffs use a structured JSON format to ensure clear communication and traceability.

### Basic Structure

```json
{
  "handoff_version": "1.0",
  "task_id": "unique-identifier",
  "from_agent": "agent-name",
  "to_agent": "agent-name",
  "timestamp": "ISO-8601-timestamp",
  "phase": "phase-name",
  "status": "in_progress | completed | blocked | failed",
  "data": {
    // Agent-specific data
  }
}
```

### Standard Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `handoff_version` | string | Yes | Format version (default: "1.0") |
| `task_id` | string | Yes | Unique task identifier |
| `from_agent` | string | Yes | Name of the sending agent |
| `to_agent` | string | Yes | Name of the receiving agent |
| `timestamp` | string | Yes | ISO-8601 timestamp |
| `phase` | string | Yes | Current workflow phase |
| `status` | string | Yes | Task status |
| `data` | object | Yes | Agent-specific payload |

## Agent-Specific Handoff Formats

The sequential handoff chain is `pm → architect → (designer, optional) → code-writer → test-runner → security-monitor → pm`. Phase names follow `docs/phase-definitions.md`.

### PM → Architect

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "pm",
  "to_agent": "architect",
  "timestamp": "2025-01-15T10:30:00Z",
  "phase": "analysis",
  "status": "in_progress",
  "data": {
    "request": "User request description",
    "acceptance_criteria": [
      {
        "id": "AC-001",
        "description": "Criteria description",
        "priority": "must-have"
      }
    ],
    "context": {
      "user": "username",
      "priority": "high"
    },
    "expected_output": {
      "implementation_plan": true,
      "adr": true
    }
  }
}
```

### Architect → Designer (optional, Phase 3 only)

Dispatched only when a UI/UX component is in scope; skipped otherwise.

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "architect",
  "to_agent": "designer",
  "timestamp": "2025-01-15T11:00:00Z",
  "phase": "ui-ux-design",
  "status": "in_progress",
  "data": {
    "implementation_plan": {
      "title": "Feature title",
      "requirements": ["Requirement 1", "Requirement 2"],
      "design_scope": ["registration flow", "dashboard layout"],
      "adr": "docs/adr/0001-feature-title.md"
    },
    "expected_output": {
      "design_specification": true,
      "wireframes": true,
      "design_tokens": true
    }
  }
}
```

### Designer → Code Writer

When the designer is skipped (no UI/UX component in scope), the architect hands off directly to the code-writer using this format with the implementation plan in place of the design specification.

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "designer",
  "to_agent": "code-writer",
  "timestamp": "2025-01-15T11:30:00Z",
  "phase": "implementation",
  "status": "in_progress",
  "data": {
    "design_specification": "docs/specs/0001-feature-title-ui-spec.md",
    "implementation_plan_ref": "docs/specs/0001-feature-title-design.md",
    "constraints": {
      "surgical_changes_only": true,
      "no_scope_creep": true,
      "require_tests": true
    }
  }
}
```

### Code Writer → Test Runner

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "code-writer",
  "to_agent": "test-runner",
  "timestamp": "2025-01-15T12:00:00Z",
  "phase": "implementation",
  "status": "in_progress",
  "data": {
    "implemented_changes": [
      {
        "file": "src/routes/auth.py",
        "action": "create | modify | delete",
        "summary": "Added /register and /login endpoints"
      }
    ],
    "acceptance_criteria": [
      {
        "id": "AC-001",
        "description": "Criteria description",
        "verification_method": "unit_test | integration_test | manual"
      }
    ],
    "test_instructions": {
      "test_command": "bun test",
      "colocated_tests": ["src/routes/auth.test.py"]
    }
  }
}
```

### Test Runner → Security Monitor

Dispatched when the QA gate passes and the change touches auth, secrets, or infrastructure (the pre-PR advisory check is required for those changes per `docs/co-develop.context.md § Domain Rules`).

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "test-runner",
  "to_agent": "security-monitor",
  "timestamp": "2025-01-15T12:15:00Z",
  "phase": "security-review",
  "status": "in_progress",
  "data": {
    "qa_verdict": "READY_FOR_PR | BLOCKED",
    "test_results": {
      "total": 10,
      "passed": 10,
      "failed": 0
    },
    "acceptance_criteria_met": true,
    "change_summary": "Auth endpoints touching secret handling - advisory check required"
  }
}
```

### Security Monitor → PM

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "security-monitor",
  "to_agent": "pm",
  "timestamp": "2025-01-15T12:30:00Z",
  "phase": "finalization",
  "status": "completed",
  "data": {
    "security_report": {
      "critical": 0,
      "high": 0,
      "medium": 2,
      "low": 5
    },
    "advisory_verdict": "clear | findings_attached",
    "blockers": [],
    "recommendations": [
      "Address medium-severity findings in a follow-up"
    ]
  }
}
```

## Error Status Handoff

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "code-writer",
  "to_agent": "pm",
  "timestamp": "2025-01-15T11:45:00Z",
  "phase": "implementation",
  "status": "blocked",
  "data": {
    "error": {
      "type": "test_failure | build_error | runtime_error | dependency_error",
      "message": "Error description",
      "file": "path/to/file.ext",
      "line_number": 123
    },
    "recovery_attempts": 1,
    "escalation_required": true
  }
}
```

## Handoff Rules

1. **Version Control**: Always include `handoff_version`
2. **Task Continuity**: Use the same `task_id` throughout the workflow
3. **Timestamp**: Use ISO-8601 format for all timestamps
4. **Status Updates**: Update `status` field at each handoff
5. **Error Handling**: Use `status: blocked` for issues requiring escalation
6. **Completion**: Final handoff to PM should have `status: completed`

## Validation

When receiving a handoff, agents should:

1. Verify `handoff_version` is supported
2. Check `task_id` matches expected workflow
3. Validate required fields are present
4. Log the handoff for traceability
5. Return acknowledgment on successful receipt

---

*Handoff specification v1.0 - subject to change as workflow evolves*
