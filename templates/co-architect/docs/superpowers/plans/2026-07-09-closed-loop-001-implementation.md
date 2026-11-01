# CLOSED-LOOP-001 Implementation Plan

> **Spec ID**: CLOSED-LOOP-001
> **Date**: 2026-07-09
> **Status**: Implemented (all 7 phases complete, 179 tests passing)
> **Design Doc**: [`CLOSED-LOOP-001-design.md`](../../designs/CLOSED-LOOP-001-design.md)
> **Pattern**: Rule 3 — Composite Orchestrator (ADR-007 §13.3)

---

## Overview

7-phase sequential implementation, each phase producing one PR. Contracts first, then components, then integration, then MCP tool. Test-first, COM-free for all phases except Phase 7's mocked-COM integration tests.

---

## Phase 1: Contracts + Package Skeleton

**PR**: `feat(closed-loop): add data model contracts`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/closed_loop/__init__.py` | Package init — re-exports all public classes |
| `src/cad_intelligence/closed_loop/model.py` | `FixIntent`, `FixAction`, `FixProposal`, `ProposalStatus`, `ApplyResult`, `ApplyStatus`, `VerificationReport`, `ClosedLoopResult` |
| `tests/closed_loop/__init__.py` | Test package |
| `tests/closed_loop/test_model.py` | Frozen dataclass construction, `to_dict()`, status enum values, edge cases |

### Scope

Data models only — no logic, no imports from other `cad_intelligence` packages. Every class is either `frozen=True` or has clearly mutable fields documented.

### Tests (~15-20)

- FixIntent: construction, kind/payload access, frozen immutability, empty payload
- FixAction: all 6 action_type values, params access, target_handle nullable for create
- FixProposal: construction, status transitions (draft → approved → executing → completed), action list access
- ProposalStatus: enum values, valid transitions
- ApplyResult: all 4 status values, verification present/absent
- VerificationReport: pass/fail logic, resolved/remaining/introduced lists
- ClosedLoopResult: summary fields

---

## Phase 2: SuggestionEngine

**PR**: `feat(closed-loop): add rule-based SuggestionEngine`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/closed_loop/suggestion.py` | `RuleBasedSuggestionEngine` |
| `tests/closed_loop/test_suggestion.py` | Per-category strategy tests |

### Design

```
RuleBasedSuggestionEngine.suggest(issues: list[ReviewIssue]) -> list[FixIntent]
```

Strategy per `ReviewIssue.category`:
- `omission` → `ReconnectBoundary`, `DeleteEntity`
- `conflict` → `MoveOpening`, `ResizeOpening`, `UpdateAnnotation`
- `inconsistency` → `NormalizeLayer`, `UpdateAnnotation`

Rules:
- Confidence gate: skip issues with `confidence < 0.5`
- One issue may produce multiple intents (1:N mapping)
- `FixIntent.confidence` inherited from source issue; low-confidence intents (0.5–0.7) flagged for human approval downstream
- `FixIntent.source_issue` = `ReviewIssue.description` (traceability)
- `FixIntent.source_evidence` = copy of `ReviewIssue.evidence`

### Tests (~20-25)

- Per category: at least 2 issue types per category
- Confidence threshold: below 0.5 → no intent; 0.5–0.7 → intent with low confidence; above 0.7 → intent with high confidence
- One issue → multiple intents (MoveOpening + ResizeOpening for overlapping door)
- Empty input → empty output
- Multi-issue input → correct count of intents
- Source traceability: source_issue and source_evidence preserved
- Deterministic: same input → same output (no randomness)

---

## Phase 3: Planner

**PR**: `feat(closed-loop): add FixPlanner with approval policy`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/closed_loop/planner.py` | `FixPlanner`, internal `_ApprovalPolicy` helper |
| `tests/closed_loop/test_planner.py` | Intent grouping, conflict resolution, action ordering, approval, risk |

### Design

```
FixPlanner.plan(intents: list[FixIntent], graph: ArchitectureGraph) -> list[FixProposal]
```

Strategy:
- Groups intents by target entity handle
- Resolves conflicting intents on same handle (choose by confidence)
- Orders actions: deletions first, then moves/resizes, then creations, then layer/annotation updates
- Sets `requires_human_approval` via `_ApprovalPolicy` (private helper class)
- Sets `risk_level` from number of affected entities and action diversity

**`_ApprovalPolicy`** (private to `planner.py`):
- Encapsulates approval routing logic separate from grouping/ordering
- Inputs: `FixIntent.confidence`, `SEVERITY_POLICY` (from review_agent)
- Output: `requires_human_approval: bool`
- Testable in isolation within the planner test file

### Tests (~20-25)

- Single intent → single proposal
- Multiple intents for different handles → multiple proposals
- Conflicting intents on same handle → resolved by confidence
- Action ordering: deletions before moves before creates
- _ApprovalPolicy: CRITICAL → always approve required; HIGH → default required; MEDIUM/LOW → auto-approved; low confidence → approve required regardless of severity
- Risk assessment: single entity/low risk; multiple entities/high risk
- Empty intents → empty proposals
- Rationale and rollback_plan populated

---

## Phase 4: FixExecutor + TransactionManager Integration

**PR**: `feat(closed-loop): add FixExecutor with atomic rollback`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/closed_loop/executor.py` | `FixExecutor` |
| `tests/closed_loop/test_executor.py` | Single action, multi-action, atomic rollback, COM-free |

### Design

```
FixExecutor.apply(proposal: FixProposal, executor_fn: Callable[[dict], ActionResult]) -> ApplyResult
```

- Each `FixAction.action_type` dispatched to `executor_fn` callback
- Wraps entire proposal in `TransactionManager` (one transaction per proposal)
- On any action failure → rollback, `proposal.status = ROLLED_BACK`
- COM-free via `NullRollbackExecutor` for tests
- Production uses `UndoRollbackExecutor` (injected by MCP handler layer)

`FixAction.action_type` → executor mapping:

| action_type | Executor callback param |
|-------------|------------------------|
| `move` | `{"action": "move", "handle": "...", "vector": [...]}` |
| `resize` | `{"action": "resize", "handle": "...", "field": "width", "value": 900.0}` |
| `delete` | `{"action": "delete", "handle": "..."}` |
| `create` | `{"action": "create", "type": "line", "params": {...}}` |
| `reassign_layer` | `{"action": "reassign_layer", "handle": "...", "layer": "A-WALL"}` |
| `update_annotation` | `{"action": "update_annotation", "handle": "...", "text": "..."}` |

### Tests (~15-20)

- Single action → ApplyResult with status=applied
- Multi-action proposal → all executed in order
- Mid-proposal failure → atomic rollback, status=rolled_back
- Empty proposal → skipped
- Artifacts (handles) captured in result
- Duration tracked
- `NullRollbackExecutor` integration: begin/commit/rollback called correctly

---

## Phase 5: VerificationLoop

**PR**: `feat(closed-loop): add VerificationLoop`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/closed_loop/verification.py` | `VerificationLoop` |
| `tests/closed_loop/test_verification.py` | Resolved, remaining, introduced, pass/fail |

### Design

```
VerificationLoop.verify(original_report: ReviewReport, new_report: ReviewReport) -> VerificationReport
```

- **Pure comparison logic** — does NOT call ReviewAgent directly
- The orchestrator handles ReviewAgent re-invocation; this component only compares two reports
- Compares original issue descriptions against new report descriptions
- Classifies: resolved, remaining, introduced
- `pass = True` iff all original issues resolved AND no new CRITICAL/HIGH introduced

### Tests (~10-15)

- All original issues resolved → pass=True
- Some original issues remain → pass=False
- New CRITICAL issue introduced → pass=False
- New LOW issue introduced → pass=True (only CRITICAL/HIGH block)
- Empty original report → pass=True
- Empty new report with non-empty original → pass=False

---

## Phase 6: ClosedLoopOrchestrator

**PR**: `feat(closed-loop): add ClosedLoopOrchestrator state machine`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/closed_loop/orchestrator.py` | `ClosedLoopOrchestrator`, `ProcessState` enum |
| `tests/closed_loop/test_orchestrator.py` | Full state machine, dry_run, approval routing, retry, E2E happy path |

### Design

```
ClosedLoopOrchestrator.run(report: ReviewReport, graph: ArchitectureGraph, **options) -> ClosedLoopResult
```

Options: `dry_run: bool`, `auto_approve: list[str]`, `max_retries: int`, `executor_fn: Callable`

State machine: `SUGGESTING → PLANNING → APPROVING → EXECUTING → VERIFYING → DONE`

Constructor injection for all four components (SuggestionEngine, Planner, FixExecutor, VerificationLoop) — fully testable without real implementations.

Approval routing:
- CRITICAL: human required (unless in `auto_approve` list)
- HIGH: human required (unless in `auto_approve` list)
- MEDIUM/LOW/INFO: auto-approved (unless `risk_level="high"`)

**Retry scope** (on verification failure): `Planner → Executor → Verification` only. SuggestionEngine is NOT re-run — same ReviewIssues must produce deterministic intents for reproducibility.

### Tests (~25-30)

- State transitions: all valid paths and invalid transitions
- dry_run mode: stops at PLANNING, returns proposals at draft status
- Auto-approve routing: CRITICAL blocked, MEDIUM auto-approved
- Human approval gate: proposal status stays draft until approved
- Verification failure → rollback → retry from Planner (not SuggestionEngine)
- Max retries exhausted → proposal permanently rolled_back
- End-to-end happy path: all components mocked with MagicMock
- Component call order verification (builder pattern with side_effect)
- Empty review report → SKIPPED

---

## Phase 7: MCP Tool + Integration Tests

**PR**: `feat(closed-loop): add zwcad_apply_fixes MCP tool and integration tests`

### Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/cad_io/handlers/closed_loop.py` | `handle_apply_fixes` |
| `src/cad_intelligence/cad_io/server.py` | MCP tool registration + dispatch |
| `tests/closed_loop/test_integration.py` | End-to-end pipeline + rollback regression |

### Design

`handle_apply_fixes` is intentionally **thin** — only deserializes params and calls `ClosedLoopOrchestrator.run()`. No domain logic in the handler (following project convention: Handler → Pipeline).

MCP tool `zwcad_apply_fixes`:
- Input: `report` dict, `walls`/`rooms`/`doors`/`windows`/`semantic_objects` lists, `dry_run`, `plan_only`, `auto_approve`, `max_retries`
- Output: proposals (dry_run) or results + verification_summary

### Integration Tests (~10-15)

- Full pipeline: ReviewReport → FixProposal → ApplyResult → VerificationReport (all mocked except orchestrator)
- dry_run returns proposals at draft status
- plan_only alias works identically
- **Rollback happy path**: Action 1 OK, Action 2 fails, rollback succeeds, verify graph restored to original state
- **Rollback failure**: Rollback itself throws, verify system reports failure gracefully (ApplyResult.status=failed, error_message present, no silent data corruption)
- Auto-approve with mixed severity issues
- Verification failure → retry → second attempt succeeds

---

## Summary

| Phase | PR | Tests | Key Principle |
|-------|-----|-------|---------------|
| 1 | Contracts | ~15-20 | Data models only, no dependencies |
| 2 | SuggestionEngine | ~20-25 | Rule-based, deterministic |
| 3 | Planner | ~20-25 | _ApprovalPolicy helper for testability |
| 4 | FixExecutor | ~15-20 | Atomic via TransactionManager |
| 5 | VerificationLoop | ~10-15 | Pure comparison, no ReviewAgent coupling |
| 6 | Orchestrator | ~25-30 | State machine, retry from Planner only |
| 7 | MCP + Integration | ~10-15 | Thin handler, rollback regression tests |

**Total**: ~115-150 tests across 7 PRs. Sequential dependencies: each phase builds on prior contracts.

---

## Execution Order

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

Each PR is independently verifiable. No phase requires a live ZWCAD instance.
