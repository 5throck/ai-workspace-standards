---
name: zod-contract-gate
description: >
  Defines Zod runtime schema validation patterns, interface boundaries,
  and contract safety rules for multi-agent architecture, IPC channels,
  and API endpoints.
version: 1.0.0
last_reviewed: 2026-08-06
status: active
scope: common
l2_propagate: true
owner: architect
prerequisites: Bun runtime, Zod library (^3.25 || ^4.0)
metadata:
  type: contract-safety
  triggers:
    - zod-contract-gate
    - /zod-contract-gate
    - zod contract validation
    - schema contract gate
    - runtime schema validation
---

# Skill: zod-contract-gate

## Context

In multi-agent architectures and complex TypeScript applications, untyped or loosely typed data boundaries across IPC channels, agent payloads, configuration inputs, and internal APIs can cause silent data corruption or downstream runtime failures.

`zod-contract-gate` provides the standard specification and execution rules for enforcing **runtime contract safety** using Zod schemas at all boundary points.

## Core Contract Safety Principles

1. **Boundary Validation First**: Validate every incoming payload, configuration object, IPC message, and API request at the system boundary before processing.
2. **Explicit Schema Definitions**: Define Zod schemas alongside TypeScript type definitions (`type T = z.infer<typeof TSchema>`).
3. **No Silent Swallowing**: If validation fails, throw or return structured `ZodError` diagnostics. Never silently substitute partial or corrupted default values.
4. **Strict Schema Constraints**: Use strict objects (`z.object({...}).strict()`), non-empty strings, bounded arrays, and discriminated unions to enforce contract constraints.

## Contract Safety Boundaries

| Boundary Type | Enforcement Target | Validation Mechanism | Fail Behavior |
|---------------|--------------------|----------------------|---------------|
| **Agent IPC Messages** | Inter-agent payloads & task parameters | `AgentPayloadSchema.safeParse()` | Reject message with `[CONTRACT_ERROR]` diagnostic |
| **API Endpoints** | Request parameters & response DTOs | `z.object({...}).parse()` | Exit with exit code 1 or return 400 Bad Request |
| **Configuration Files** | `JSON` / `YAML` settings & manifests | `ConfigSchema.parse()` | Halt initialization with field-level schema errors |
| **CLI Arguments** | Command options & environment variables | `CLIOptionsSchema.safeParse()` | Print usage & exit code 1 |

## Canonical Implementation Patterns

### Pattern 1: Inter-Agent Payload Gate

```typescript
import { z } from "zod";

export const AgentTaskPayloadSchema = z.object({
  taskId: z.string().uuid(),
  agentRole: z.enum(["pm", "architect", "code-writer", "designer", "security-monitor", "stack-setup", "test-runner"]),
  action: z.string().min(1),
  parameters: z.record(z.unknown()),
  contextFiles: z.array(z.string()).default([]),
}).strict();

export type AgentTaskPayload = z.infer<typeof AgentTaskPayloadSchema>;

export function validateAgentPayload(input: unknown): AgentTaskPayload {
  const result = AgentTaskPayloadSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`[CONTRACT_ERROR] Invalid agent task payload: ${issues}`);
  }
  return result.data;
}
```

### Pattern 2: API Contract Request/Response Gate

```typescript
import { z } from "zod";

export const ServiceTicketRequestSchema = z.object({
  ticketId: z.string().min(1),
  serviceName: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]),
  payload: z.object({
    repoUrl: z.string().url(),
    branch: z.string().default("main"),
  }),
});

export type ServiceTicketRequest = z.infer<typeof ServiceTicketRequestSchema>;

export function processServiceTicket(rawRequest: unknown): ServiceTicketRequest {
  const parsed = ServiceTicketRequestSchema.parse(rawRequest);
  return parsed;
}
```

### Pattern 3: Discriminated Union for State Transitions

```typescript
import { z } from "zod";

export const EventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("TASK_STARTED"),
    taskId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal("TASK_COMPLETED"),
    taskId: z.string(),
    resultSummary: z.string(),
    exitCode: z.number(),
  }),
  z.object({
    type: z.literal("TASK_FAILED"),
    taskId: z.string(),
    errorMessage: z.string(),
  }),
]);

export type SystemEvent = z.infer<typeof EventSchema>;
```

## Quality Gate Checklist

Before completing feature implementation or submitting a pull request, verify:

- [ ] All exported interfaces and API parameters have corresponding Zod runtime schemas.
- [ ] No `any` or untyped `unknown` data is passed through boundary functions without Zod parsing.
- [ ] Error messages output precise Zod validation issues without truncating or swallowing stack trace diagnostics.
- [ ] Unit tests cover both valid payload parsing and expected validation error throwing for invalid schema inputs.
