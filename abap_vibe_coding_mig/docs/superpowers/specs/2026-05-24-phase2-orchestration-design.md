# Phase 2: Orchestration Layer Design

**Date:** 2026-05-24
**Status:** Implemented
**Phase:** 2 - Orchestration Layer

## Overview

Phase 2 focuses on agent coordination improvements and skill system enhancement. This layer provides the orchestration primitives that enable efficient multi-agent workflows while maintaining reliability through error recovery and auto-discovery mechanisms.

## Components

### 1. Dispatch Automation

**Files:**
- `scripts/dispatch.ts` - Main CLI dispatcher with mode selection
- `scripts/dispatch-parallel.ts` - Parallel dispatcher for read-only agents
- `scripts/dispatch-serial.ts` - Serial pipeline executor for write operations

**Features:**
- Parallel dispatch for read-only tasks (research, analysis)
- Serial dispatch for write operations (implementation, testing)
- Template-based agent creation from `agents/*.md` files
- Result aggregation and reporting
- Mode selection via CLI arguments

**Usage:**
```bash
bun scripts/dispatch.ts parallel   # Multiple read-only agents
bun scripts/dispatch.ts serial     # Sequential workflow
```

**Dispatch Decision Tree:**
```
Request received
  │
  ├─ Read-only? (analyze, search, query, inspect)
  │    └─► PARALLEL SKILLS — Primary Agent dispatches research subagents
  │          ├── sap-investigator   → codebase scan
  │          ├── read-only-analyst  → business data queries
  │          └── schema-inspector   → table/CDS structure
  │
  └─ Write? (EditSource, WriteSource, SyntaxCheck)
       └─► SERIAL SUBAGENTS — delegate to specialized execution subagents
             ├── code-writer  → ABAP implementation
             └── test-runner  → Stability verification
```

### 2. Error Recovery

**File:**
- `scripts/retry-handler.ts`

**Features:**
- 3-retry limit with exponential backoff (1s, 2s, 4s, max 10s)
- Error classification (tool, context, logic, external)
- Recovery suggestions based on error type
- Human escalation with formatted output after retries exhausted

**Error Types:**
| Type | Description | Recovery Strategy |
|------|-------------|-------------------|
| Tool | MCP tool invocation failure | Retry with alternative tool, escalate if persistent |
| Context | Insufficient or ambiguous context | Clarify prompt, add more specific instructions |
| Logic | Incorrect reasoning or approach | Provide corrected approach, retry |
| External | System or network issues | Backoff and retry, escalate after limit |

**Integration Example:**
```typescript
import { withRetry, escalateToHuman } from "./retry-handler";

const result = await withRetry(
  () => dispatchSubagent(task),
  { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2, maxDelay: 10000 },
  "Task Description"
);

if (!result.success) {
  escalateToHuman("Task Description", result.lastError!, result.attempts);
  process.exit(1);
}
```

### 3. Skill Auto-Discovery

**Files:**
- `scripts/verify-skills.ts` (enhanced with metadata extraction)
- `skills/SKILLS.md` (auto-generated index)

**Features:**
- Frontmatter extraction (name, description, metadata.type)
- Trigger detection from skill content (## Trigger / When to Use sections)
- Metadata catalog with type-based grouping
- Verification reporting with status indicators

**Metadata Structure:**
```typescript
interface SkillMetadata {
  name: string;        // From frontmatter name field
  description: string; // From frontmatter description field
  type: string;        // From frontmatter metadata.type
  triggers: string[];  // Extracted from ## Trigger or When to Use sections
}
```

**Verification Workflow:**
1. Scan `skills/` directory for all `SKILL.md` files
2. Parse frontmatter and extract metadata
3. Validate required fields (name, description, metadata)
4. Extract trigger phrases from content
5. Generate `skills/SKILLS.md` index grouped by type
6. Report verification status (PASS/FAIL/WARN)

**Usage:**
```bash
bun scripts/verify-skills.ts
```

## Integration Points

### AGENTS.md Updates

The orchestration patterns are documented in `AGENTS.md` under the "Phase 2: Orchestration Layer" section, including:
- Dispatch automation usage
- Error recovery protocol
- Skill auto-discovery mechanics
- Orchestration patterns for parallel vs serial workflows

### Agent Dispatch Protocol

The PM agent follows the enhanced dispatch protocol:
1. Classify task type (read-only vs write)
2. Select appropriate dispatch mode (parallel vs serial)
3. Apply error recovery wrapper with retry logic
4. Aggregate results and escalate if needed

## Success Criteria

- [x] Dispatch automation implemented (dispatch.ts, dispatch-parallel.ts, dispatch-serial.ts)
- [x] Error recovery mechanisms in place (retry-handler.ts)
- [x] Skill auto-discovery enhanced (verify-skills.ts with metadata extraction)
- [x] AGENTS.md updated with Phase 2 patterns
- [x] Design spec documented (this file)

## Next Steps

Phase 3 will focus on:
- Advanced coordination patterns (dynamic agent selection)
- Performance optimization (caching, batching)
- Monitoring and observability (execution traces, metrics)

---

*Plan Version: 1.0*
*Created: 2026-05-24*
*Last Updated: 2026-06-01*
