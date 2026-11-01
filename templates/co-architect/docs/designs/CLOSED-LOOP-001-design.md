# CLOSED-LOOP-001: Closed Loop Automation

> **Spec ID**: CLOSED-LOOP-001
> **Version**: 1.0
> **Status**: Implemented — see `src/cad_intelligence/closed_loop/`
> **Created**: 2026-07-09
> **Authors**: architect
> **Pattern**: Rule 3-adjacent orchestration — composite pipeline over Review Agent + Transaction Layer
> **Rationale**: Review Agent (REVIEW-AGENT-001) can detect and report issues but nothing consumes `ReviewReport` to propose, apply, and verify corrections. This spec closes that loop.
> **Source**: Production Readiness Program §2.2 — `docs/firm-governance/production-readiness-program.md`
> **Predecessor**: `MCP-001` §5 (historical closed-loop batch correction protocol, deferred)
> **Related**: [`REVIEW-AGENT-001`](REVIEW-AGENT-001-design.md) (Input), [`TRANSACTION-001`](TRANSACTION-001-design.md) (Atomicity), [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md) §13.3 (Rule 3 — Composite Orchestrator)
> **Implementation** (planned): `src/cad_intelligence/closed_loop/`

---

## Scope

This document defines the **closed loop automation pipeline** — a structured system for transforming review findings into diagnosed repair intents, concrete fix proposals, atomic application, and post-fix verification. The design is intentionally **rule-based for v1**, with extension points for LLM and Constraint Solver providers in future revisions.

The pipeline answers one question the Review Agent deliberately left open: **given a problem, what should we change, and how do we know it worked?**

---

## 1. Data Flow

```
ReviewIssue
    ↓  SuggestionEngine (Rule-based v1)
FixIntent (kind + payload, extensible)
    ↓  Planner (stable, provider-agnostic)
FixProposal (draft → approved → executing → completed | rolled_back)
    ↓  FixExecutor (via TransactionManager)
ApplyResult
    ↓  VerificationLoop (re-run ReviewAgent)
VerificationReport
```

Four contracts, four handoff points. Each contract has a single owner.

---

## 2. Contracts

### 2.1 ReviewIssue (existing — REVIEW-AGENT-001)

Input to the closed loop. Already defined in `src/cad_intelligence/review_agent/model.py`.

```python
@dataclass(frozen=True)
class ReviewIssue:
    severity: Severity           # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO"
    category: Category           # "omission" | "conflict" | "inconsistency"
    description: str              # Human-readable issue description
    evidence: list[str]          # Graph node UIDs / entity handles involved
    confidence: float            # 0.0–1.0 certainty
    suggested_fix: str | None    # Free-text remediation hint
    location: str | None         # DWG coordinate / entity handle reference
```

Key fields for the closed loop:
- `category` — drives SuggestionEngine strategy (omission needs creation/add, conflict needs reconciliation, inconsistency needs normalization)
- `evidence` — graph node UIDs and entity handles tell the fix pipeline *what* to operate on
- `confidence` — low-confidence issues may not warrant auto-fix; threshold gate for SuggestionEngine
- `severity` — determines human-approval routing via `SEVERITY_POLICY`

### 2.2 FixIntent (new — extensible intent contract)

Represents *what we want to achieve*, not *how to achieve it*. A single `ReviewIssue` may produce multiple `FixIntent`s (one-to-many: "Door overlaps wall" could be `MoveOpening`, `ResizeDoor`, `MoveWall`, or `DeleteOpening`).

```python
@dataclass(frozen=True)
class FixIntent:
    kind: str                     # Intent classifier — extensible, not a fixed enum
    payload: dict                 # Intent-specific parameters (open schema)
    source_issue: str             # ReviewIssue.description (traceability)
    source_evidence: list[str]    # Copied from ReviewIssue.evidence
    confidence: float             # Inherited / computed confidence for this intent
```

**Kind examples** (v1 rule-based):

| Kind | Category | Payload Fields | Example |
|------|----------|---------------|---------|
| `MoveOpening` | conflict | `{"handle": "...", "vector": [dx, dy]}` | Door shifted outside wall boundary |
| `ResizeOpening` | conflict | `{"handle": "...", "field": "width", "value": 900.0}` | Door too narrow per constraint |
| `ReconnectBoundary` | omission | `{"room_id": "...", "gap_point": [x, y]}` | Wall segment missing at room closure |
| `NormalizeLayer` | inconsistency | `{"handle": "...", "target_layer": "A-WALL"}` | Entity on wrong layer |
| `UpdateAnnotation` | inconsistency | `{"handle": "...", "correct_value": 3600.0}` | Dimension annotation mismatch |
| `DeleteEntity` | omission | `{"handle": "...", "reason": "orphan"}` | Orphan node with no graph connections |

**Why `kind + payload` instead of a fixed Enum:**

`FixIntent` must remain open-ended. Future SuggestionEngine providers (LLM, ConstraintSolver, Hybrid) may introduce intent types that do not exist in v1. The Planner consumes `FixIntent` generically — it reads `kind` and `payload` and maps them to `FixAction`s. Adding a new `kind` requires only a new Planner mapping rule, not a contract change.

### 2.3 FixProposal (new — executable plan with lifecycle)

A concrete, ordered set of atomic fix actions ready for execution. The Planner transforms one or more `FixIntent`s into a single `FixProposal`.

```python
@dataclass
class FixProposal:
    proposal_id: str                    # UUID
    status: ProposalStatus               # Lifecycle status (see §3.2)
    source_intents: list[str]            # FixIntent.kind values (traceability)
    source_issues: list[str]             # ReviewIssue descriptions (traceability)
    target_handles: list[str]            # Entity handles this proposal modifies
    actions: list[FixAction]             # Ordered atomic fix actions
    requires_human_approval: bool         # Per SEVERITY_POLICY + risk assessment
    risk_level: str                      # "low" | "medium" | "high"
    rationale: str                       # Human-readable explanation of why these actions
    rollback_plan: str                   # How to undo if application fails

class ProposalStatus(str):
    DRAFT = "draft"                      # Planner output, awaiting approval
    APPROVED = "approved"                # Approved (auto or human), ready for execution
    EXECUTING = "executing"              # FixExecutor is running
    COMPLETED = "completed"              # All actions succeeded, verification passed
    ROLLED_BACK = "rolled_back"          # Execution failed or verification failed

@dataclass(frozen=True)
class FixAction:
    action_type: str                     # "move" | "resize" | "delete" | "create" | "reassign_layer" | "update_annotation"
    target_handle: str | None            # Entity handle (None for "create")
    params: dict                         # Action-specific parameters
    # Examples:
    #   move: {"vector": [dx, dy, dz]}
    #   resize: {"field": "width", "value": 900.0}
    #   reassign_layer: {"layer": "A-WALL"}
    #   update_annotation: {"text": "3,600", "position": [x, y, z]}
```

**Why `FixProposal` is mutable (`dataclass`, not frozen):**

`status` changes during the proposal lifecycle (draft → approved → executing → completed). The proposal *plan* (actions, rationale, etc.) is set once by the Planner and never modified — only the status field transitions.

### 2.4 ApplyResult (new — post-application verification)

```python
@dataclass(frozen=True)
class ApplyResult:
    proposal_id: str
    status: ApplyStatus                  # Terminal outcome
    actions_executed: list[str]          # Action types that succeeded
    actions_failed: list[str]            # Action types that failed
    verification: VerificationReport | None  # Re-review results (None if skipped)
    transaction_id: str | None           # TransactionManager ID (for audit / rollback)
    artifacts: list[str]                # New or modified entity handles
    duration_ms: float
    error_message: str | None            # Set when status=failed

class ApplyStatus(str):
    APPLIED = "applied"                  # All actions succeeded, verification passed
    ROLLED_BACK = "rolled_back"          # Execution or verification failed, changes reverted
    SKIPPED = "skipped"                  # Proposal rejected or not eligible
    FAILED = "failed"                    # Execution failed and rollback itself failed

@dataclass(frozen=True)
class VerificationReport:
    original_issues_resolved: list[str]  # Source issue descriptions that are now clean
    original_issues_remaining: list[str] # Source issue descriptions still present
    new_issues_introduced: list[str]     # New ReviewIssue descriptions caused by the fix
    pass: bool                           # True = all source resolved AND no new CRITICAL/HIGH
```

---

## 3. Architecture

### 3.1 Component Overview

| Component | Module | Contract Owner | Responsibility |
|-----------|--------|---------------|----------------|
| **SuggestionEngine** | `closed_loop/suggestion.py` | `ReviewIssue → FixIntent` | Maps detected issues to repair intents |
| **Planner** | `closed_loop/planner.py` | `FixIntent → FixProposal` | Converts intents into ordered, executable action plans |
| **FixExecutor** | `closed_loop/executor.py` | `FixProposal → ApplyResult` | Applies actions atomically via TransactionManager |
| **VerificationLoop** | `closed_loop/verification.py` | `ApplyResult → VerificationReport` | Re-runs Review Agent to confirm fix integrity |
| **ClosedLoopOrchestrator** | `closed_loop/orchestrator.py` | Phase coordination | Pure state machine — sequences phases, routes approval, manages retry |

### 3.2 Component Details

#### SuggestionEngine

Rule-based v1: pattern-matches `ReviewIssue.category` + `ReviewIssue.evidence` to produce `FixIntent`s.

```
Input:  list[ReviewIssue]
Output: list[FixIntent]

Strategy per category:
  omission     → ReconnectBoundary, DeleteEntity, CreateEntity
  conflict     → MoveOpening, ResizeOpening, UpdateAnnotation
  inconsistency → NormalizeLayer, UpdateAnnotation, ReassignAttribute
```

Confidence threshold: issues with `confidence < 0.5` are skipped (too uncertain to generate reliable intents). Issues with `0.5 ≤ confidence < 0.7` generate intents but the resulting `FixProposal` is flagged `requires_human_approval=True`.

> **Future Note (v2)**: SuggestionEngine may support multiple providers — `RuleBased`, `LLM`, `ConstraintSolver`, `Hybrid`. All produce `FixIntent` via the same contract; the Planner remains unchanged.

#### Planner

Maps `FixIntent.kind` + `FixIntent.payload` to ordered `FixAction`s. This is the stable core — regardless of how `FixIntent`s were generated, the Planner produces the same executable plan format.

```
Input:  list[FixIntent]
Output: list[FixProposal]

Strategy:
  - Group intents by target entity handle
  - Resolve conflicting intents (e.g. MoveOpening + ResizeOpening on same handle)
  - Order actions: deletions first, then moves/resizes, then creations
  - Set requires_human_approval from SEVERITY_POLICY + intent confidence
  - Set risk_level based on number of affected entities and action types
```

#### FixExecutor

Wraps each `FixProposal` in a `TransactionManager` call (TRANSACTION-001). Each `FixAction` maps to an existing `Command` subclass or MCP tool operation:

| FixAction.action_type | Maps to |
|----------------------|---------|
| `move` | `MoveWindow` command / `zwcad_move_entity` MCP tool |
| `resize` | `ResizeDoor` command |
| `delete` | `DeleteOpening` command / `zwcad_delete_entity` MCP tool |
| `create` | `zwcad_draw_line` / `zwcad_draw_polyline` MCP tools |
| `reassign_layer` | `zwcad_set_entity_layer` MCP tool |
| `update_annotation` | `zwcad_draw_text` / `zwcad_draw_aligned_dimension` MCP tools |

Rollback: `TransactionManager` + `UndoRollbackExecutor` (TRANSACTION-001) provides atomic all-or-nothing rollback per proposal. On failure, `FixProposal.status` transitions to `ROLLED_BACK`.

#### VerificationLoop

After a `FixProposal` is applied, the VerificationLoop re-runs the Review Agent (`ReviewOrchestrator.run()`) on the modified graph. It compares the new `ReviewReport` against the original issues:

- **Resolved**: original issue no longer appears in new report
- **Remaining**: original issue still present (fix didn't work)
- **Introduced**: new CRITICAL/HIGH issues not in original report (fix caused damage)

If `VerificationReport.pass` is `False`, the orchestrator triggers rollback and marks the proposal `ROLLED_BACK`.

#### ClosedLoopOrchestrator

Pure state machine — does not perform suggestion, planning, execution, or verification itself. It sequences the phases and routes between components.

---

## 4. State Machine

### 4.1 Process State (Orchestrator)

```
                ┌──────────────────────────────────────────────────┐
                │              CLOSED LOOP PROCESS                  │
                │                                                  │
  SUGGESTING ──▶│  PLANNING ──▶ APPROVING ──▶ EXECUTING ──▶ VERIFYING
                │      │            │              │              │
                │      ▼            ▼              ▼              ▼
                │  SKIPPED    REJECTED      ROLLED_BACK      FAILED
                │                                                  │
                └──────────────────────────────────────────────────┘
```

State transitions:

| From | To | Trigger |
|------|----|---------|
| SUGGESTING | PLANNING | SuggestionEngine produced ≥1 FixIntent |
| SUGGESTING | SKIPPED | SuggestionEngine produced 0 FixIntents |
| PLANNING | APPROVING | Planner produced ≥1 FixProposal |
| PLANNING | SKIPPED | Planner produced 0 FixProposals |
| APPROVING | EXECUTING | Proposal approved (auto or human) |
| APPROVING | REJECTED | Proposal rejected by human / policy |
| EXECUTING | VERIFYING | FixExecutor returned `APPLIED` |
| EXECUTING | ROLLED_BACK | FixExecutor returned `ROLLED_BACK` or `FAILED` |
| VERIFYING | DONE | VerificationReport.pass = True |
| VERIFYING | ROLLED_BACK | VerificationReport.pass = False |

### 4.2 Proposal Lifecycle (FixProposal.status)

```
draft ──▶ approved ──▶ executing ──▶ completed
              │              │
              ▼              ▼
           rejected      rolled_back
```

This status is the single source of truth for UI, Audit, Batch Retry, and Monitoring consumers.

### 4.3 Human Approval Gates

Approval routing uses `SEVERITY_POLICY` (REVIEW-AGENT-001) plus risk assessment:

| Severity | Default Approval | Override |
|----------|------------------|----------|
| CRITICAL | Human required | `auto_approve=["CRITICAL"]` explicit override |
| HIGH | Human required | `auto_approve=["HIGH"]` explicit override |
| MEDIUM | Auto-approved | Blocked if `risk_level="high"` |
| LOW | Auto-approved | Always auto |
| INFO | Auto-approved | Always auto |

In `dry_run` / `plan_only` mode, proposals are returned at `draft` status with `requires_human_approval` set, allowing the user to inspect before committing.

---

## 5. MCP Tool

### `zwcad_apply_fixes`

```
Input:
  - report: ReviewReport (serialized dict from prior zwcad_review_drawing call)
  - walls: list[dict]          # Wall.to_dict() — required for re-review
  - rooms: list[dict]          # Room.to_dict() — optional
  - doors: list[dict]          # Door.to_dict() — optional
  - windows: list[dict]       # Window.to_dict() — optional
  - semantic_objects: list[dict]  # SemanticObject.to_dict() — optional
  - dry_run: bool              # Default: false — return FixProposals at draft, do not apply
  - plan_only: bool            # Alias for dry_run
  - auto_approve: list[str]    # Severity levels to auto-approve (default: ["MEDIUM", "LOW", "INFO"])
  - max_retries: int           # Retry count for verification failures (default: 1)
  - include_llm: bool          # Pass through to ReviewAgent for verification (default: false)

Output (dry_run=true):
  {
    "status": "proposed",
    "proposals": [FixProposal as dict, ...],
    "summary": {
      "total_proposals": int,
      "requires_approval": int,
      "auto_approvable": int
    }
  }

Output (dry_run=false):
  {
    "status": "completed",
    "proposals": [FixProposal as dict, ...],
    "results": [ApplyResult as dict, ...],
    "verification_summary": {
      "resolved": int,
      "remaining": int,
      "introduced": int,
      "pass": bool
    }
  }
```

---

## 6. Integration with Existing Infrastructure

| Existing System | How Closed Loop Uses It |
|----------------|------------------------|
| `ReviewAgent` (REVIEW-AGENT-001) | Input source (`ReviewReport`) and verification re-run via `ReviewOrchestrator.run()` |
| `TransactionManager` (TRANSACTION-001) | Atomic fix application via `UndoRollbackExecutor` — one transaction per `FixProposal` |
| `Command` pattern (`commands/command.py`) | `FixAction` maps to `Command` subclasses for graph-level undo semantics |
| `execute_batch` MCP tool | CAD-level atomic execution for batch entity modifications |
| `SEVERITY_POLICY` | Drives `requires_human_approval` on `FixProposal` |
| `constraint_engine.FixSuggestion` | Structured fix data from constraint violations feeds into `FixIntent.payload` |
| `GraphVersionHistory` | Optional: snapshot graph before fix for point-in-time recovery |

---

## 7. Error Handling and Retry

### Retry Policy

When verification fails (`VerificationReport.pass = False`):
1. Trigger immediate rollback via `TransactionManager` → `FixProposal.status = ROLLED_BACK`
2. If `max_retries > 0`, the Planner may generate a revised `FixProposal` with adjusted parameters
3. Revised proposals carry the same `proposal_id` with an incrementing attempt counter (tracked in orchestrator, not in `FixProposal` itself — see Future Note in §2.3)
4. After `max_retries` exhausted, the proposal is permanently marked `ROLLED_BACK` and the orchestrator proceeds to the next proposal

### Failure Modes

| Failure | Response |
|---------|----------|
| SuggestionEngine produces no intents | Process transitions to SKIPPED — no fix needed |
| Planner cannot resolve conflicting intents | Intent dropped, logged as warning, remaining intents proceed |
| FixExecutor action fails mid-proposal | `TransactionManager` rolls back entire proposal atomically |
| Verification introduces new CRITICAL issue | Rollback proposal — fix caused damage |
| Rollback itself fails | `ApplyResult.status = FAILED`, logged as CRITICAL, manual intervention required |

---

## 8. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Four-contract chain: `ReviewIssue → FixIntent → FixProposal → ApplyResult` | One-to-many mapping (one issue, multiple possible fixes) requires an intent layer between diagnosis and planning |
| D2 | `FixIntent` uses `kind + payload` (extensible open schema), not a fixed Enum | Future SuggestionEngine providers (LLM, ConstraintSolver) can introduce new intent types without contract changes |
| D3 | SuggestionEngine stops at `FixIntent` | Separates diagnosis from planning; multiple provider types produce the same output contract |
| D4 | Planner is provider-agnostic | `FixProposal` is always an executable plan regardless of how `FixIntent` was generated |
| D5 | `FixProposal` carries its own lifecycle status (`draft → completed`) | UI, Audit, Batch Retry, and Monitoring share a single source of truth |
| D6 | ClosedLoopOrchestrator is a pure state machine | Prevents orchestrator bloat; only coordinates phase transitions, never performs domain logic |
| D7 | `FixAction` maps 1:1 to existing `Command` subclasses | Reuses the established undo/redo infrastructure (`commands/mutations.py`) |
| D8 | Human approval is opt-out, not opt-in | Safety first — CRITICAL/HIGH require explicit approval unless overridden |
| D9 | Verification re-runs full `ReviewAgent`, not just the source check | Catches cascading damage a fix may introduce to unrelated parts of the drawing |
| D10 | `TransactionManager` wraps each `FixProposal` atomically | All-or-nothing per proposal; partial fixes are never left in the drawing |
| D11 | `dry_run` / `plan_only` returns proposals at `draft` status | User inspects before committing; no DWG modification in plan-only mode |

---

## 9. Future Extensions (noted, not designed for v1)

> **1. SuggestionEngine providers**: The SuggestionEngine abstraction supports pluggable providers — `RuleBased`, `LLM`, `ConstraintSolver`, `Hybrid`. All produce `FixIntent` via the same `kind + payload` contract; the Planner remains unchanged. v2 scope would define the provider protocol and the LLM prompt template for structured intent generation.
>
> **2. ExecutionRecord separation**: Execution metadata (attempt count, timestamps, retry history) may be separated from `FixProposal` into a distinct `ExecutionRecord` if audit/history requirements grow. At current scale, embedding `status` in `FixProposal` is sufficient.
>
> **3. Batch proposal execution**: v1 processes proposals sequentially. Future versions may support parallel execution of independent proposals (non-overlapping target handles) for throughput.
>
> **4. Unified generate → fix flow**: The closed loop is a correction pipeline; the E2E workflow (§2.5) is a generation pipeline. A future unified orchestrator may chain both as a single flow: generate → review → fix → verify.

---

## 10. Out of Scope

- LLM-driven suggestion (SuggestionEngine v2)
- Constraint Solver integration (SuggestionEngine v2)
- Hybrid provider routing (SuggestionEngine v2)
- End-to-end workflow orchestration (Production Readiness §2.5)
- Continuous monitoring and live observability (Production Readiness §2.3)
- Full DWG file-level rollback via File Curator
- Parallel proposal execution
- Unified generate → review → fix → verify flow

---

## Document Dependencies

```
REVIEW-AGENT-001       ← Input: ReviewIssue, ReviewReport, ReviewOrchestrator
       ↓
GRAPH-001              ← FixAction targets: graph nodes, edges, handles
       ↓
ADR-007 §13.3          ← Pattern: Rule 3 (Composite Orchestrator)
       ↓
TRANSACTION-001         ← Atomic execution: TransactionManager, UndoRollbackExecutor
       ↓
CLOSED-LOOP-001        ← This doc: closed loop pipeline contracts and architecture
       ↓
(tests)                ← Future: test fixtures for SuggestionEngine, Planner, FixExecutor
```
