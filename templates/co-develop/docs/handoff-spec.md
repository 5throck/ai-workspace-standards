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

### PM → Business Analyst

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "pm",
  "to_agent": "sd-analyst",
  "timestamp": "2025-01-15T10:30:00Z",
  "phase": "business-analysis",
  "status": "in_progress",
  "data": {
    "request": "User request description",
    "trigger_keywords": ["Sales Order", "Billing"],
    "context": {
      "user": "username",
      "priority": "high"
    },
    "expected_output": {
      "prd": true,
      "acceptance_criteria": true
    }
  }
}
```

### Business Analyst → Architect

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "sd-analyst",
  "to_agent": "architect",
  "timestamp": "2025-01-15T11:00:00Z",
  "phase": "technical-design",
  "status": "in_progress",
  "data": {
    "prd": {
      "title": "Feature title",
      "requirements": ["Requirement 1", "Requirement 2"],
      "acceptance_criteria": [
        {
          "id": "AC-001",
          "description": "Criteria description",
          "priority": "must-have"
        }
      ]
    },
    "business_context": {
      "module": "SD",
      "key_tables": ["VBAK", "VBAP"],
      "constraints": []
    }
  }
}
```

### Architect → Code Writer

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "architect",
  "to_agent": "code-writer",
  "timestamp": "2025-01-15T11:30:00Z",
  "phase": "implementation",
  "status": "in_progress",
  "data": {
    "implementation_plan": {
      "pattern": "A | B | C",
      "objects": [
        {
          "type": "PROG | CLASS | TABLE | CDS",
          "name": "object_name",
          "action": "create | modify | delete",
          "description": "Object description"
        }
      ],
      "dependencies": []
    },
    "constraints": {
      "max_objects_per_iteration": 5,
      "require_syntax_check": true,
      "require_unit_test": true
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
  "phase": "verification",
  "status": "in_progress",
  "data": {
    "implemented_objects": [
      {
        "type": "PROG",
        "name": "ZPROG_SBOOK_QUERY",
        "url": "/sap/bc/adt/programs/programs/zprog_sbook_query"
      }
    ],
    "acceptance_criteria": [
      {
        "id": "AC-001",
        "description": "Criteria description",
        "verification_method": "unit_test | manual | atc_check"
      }
    ],
    "test_instructions": {
      "unit_tests": ["test_class_1", "test_class_2"],
      "atc_priority": "P1 | P2 | P3"
    }
  }
}
```

### Test Runner → PM

```json
{
  "handoff_version": "1.0",
  "task_id": "TASK-2025-001",
  "from_agent": "test-runner",
  "to_agent": "pm",
  "timestamp": "2025-01-15T12:30:00Z",
  "phase": "finalization",
  "status": "completed",
  "data": {
    "test_results": {
      "unit_tests": {
        "total": 10,
        "passed": 10,
        "failed": 0
      },
      "atc_checks": {
        "priority_1": 0,
        "priority_2": 2,
        "priority_3": 5
      }
    },
    "acceptance_criteria_met": true,
    "blockers": [],
    "recommendations": [
      "Address P2 findings before merge"
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
      "type": "syntax_error | compilation_error | runtime_error | dependency_error",
      "message": "Error description",
      "object": "object_name",
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
