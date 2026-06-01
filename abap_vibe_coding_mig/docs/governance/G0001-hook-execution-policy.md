# Governance Policy G0001: Hook Execution Policy

**Version**: 1.0
**Effective**: 2026-06-01
**Status**: Active
**Owner**: pm

## Policy Statement

This policy establishes the principle of **redundancy by design** in hook execution for the co-develop migration project.

## Background

During the co-develop template migration planning (meeting-2026-06-01), a technical design decision was made to allow certain hooks to execute multiple times within a single workflow. This document governance-approves this design as **intentional redundancy** rather than accidental duplication.

## Redundancy by Design

### Definition

**Redundancy by design** means: Multiple hook executions within a single workflow cycle are intentional, serving defense-in-depth quality assurance, not accidental duplication.

### Example Execution Flow

```
Step 4: auditor agent execution
├─ Pre-Hook: audit.ts (full workspace validation)
│  └─ Purpose: Verify workspace compliance before independent verification
└─ Output: Auditor report

Step 5: test-runner agent execution
├─ Pre-Hook: vsp-sync.ps1
│  ├─ Internal call: audit.ts (re-executed)
│  └─ Purpose: Verify workspace compliance before domain testing
└─ Output: Test results
```

In this example, `audit.ts` executes **twice**:
- Step 4: Before auditor execution (Governance Layer)
- Step 5: Before test-runner execution (Quality Assurance Layer)

## Rationale

### Defense-in-Depth

**Reasoning**: Multiple validation layers catch different classes of errors that a single validation might miss.

**Examples**:
1. **Step 4 audit.ts**: Detects pre-existing workspace issues
2. **Step 5 audit.ts**: Detects workspace changes introduced during Step 4 (agent execution)

### State Verification

**Reasoning**: Agent executions may modify workspace state. Re-validation ensures no unintended side effects.

**Detection Pattern**:
```
Time T0 (Step 4 start): audit.ts → workspace clean ✅
Time T1 (Step 4 end): auditor executes → may create temp files
Time T2 (Step 5 start): audit.ts → detects T1 artifacts ❌ if dirty
```

### Cost-Benefit Analysis

**Token Cost**: ~1,000 tokens per redundant execution (audit.ts twice per workflow)
**Annual Impact**: ~2,500,000 tokens/year ≈ $10-15/year at current Anthropic pricing

**Quality Benefit**: Guaranteed workspace compliance, zero blind spots in validation

**Decision**: Token cost is negligible compared to quality assurance value

## Compliance

### Auditable

All hook executions are logged in:
- PM execution plan table (pre-hook/post-hook columns)
- Individual agent execution reports
- Session memory logs (memory/YYYY-MM-DD.md)

### Review Process

Quarterly governance review (Q1, Q2, Q3, Q4) to assess:
1. Redundant hook execution frequency
2. Token cost trends
3. Quality incidents (did redundancy catch errors single validation missed?)

### Optimization Path

**Phase 2 (Q3)**: Evaluate `audit.ts --incremental` flag implementation
- **Purpose**: Reduce token cost while maintaining redundancy benefits
- **Approach**: Full validation (Step 4) + incremental validation (Step 5)
- **Decision**: Governed by A-12 (devops-admin readiness assessment)

## Exceptions

### When to Skip Redundant Execution

Redundant hook execution may be skipped if:

1. **Fast Iteration Mode**: Development workflow where workspace state is guaranteed unchanged
   - **Requirement**: Explicit user opt-in via PM execution plan flag
   - **Example**: `/fast-iteration` command disables redundant audit.ts

2. **Cached Validation**: Implementation of caching mechanism (deferred to Phase 2)
   - **Current**: Not implemented
   - **Future**: Cache key = hook script + workspace state hash
   - **Governance**: G0002 (Hook Classification Guidelines) defines cacheable hooks

## References

- **Meeting**: meeting-2026-06-01-resolve-remaining-issues.md
- **Related**: G0002 (Hook Classification Guidelines)
- **Related**: G0003 (Phase Completion Governance)

## Change History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-06-01 | 1.0 | Initial policy creation | pm |
