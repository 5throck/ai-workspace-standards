# TRANSACTION-001: Transaction Layer

> **Spec ID**: TRANSACTION-001
> **Version**: 1.2
> **Status**: Implemented (WP4 + Stage D)
> **Created**: 2026-07-05
> **Updated**: 2026-07-09
> **Authors**: architect
> **Source**: V3 completion — transaction semantics for DWG-modifying operations
> **Related**: [`API-001`](API-001-design.md) (Handler Convention), [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`TEST-001`](TEST-001-design.md) (Verification)
> **Implementation**: `src/cad_intelligence/platform/transaction.py`, `src/cad_intelligence/platform/undo_rollback.py`, `tests/test_transaction.py`

---

## Scope

This document defines the **transaction lifecycle** for DWG-modifying operations — atomicity, rollback, pre/post validation, and the recovery report schema.

---

## 1. Transaction Lifecycle

```
TransactionManager.execute(commands, executor, pre_validate, post_validate)
  │
  ▼
PreValidation
  │  Caller-supplied callback: check preconditions before execution
  │  → If failed: return RecoveryReport(status="failed"), no DWG changes
  │
  ▼ [pre-checks pass]
RollbackExecutor.begin()
  │  Acquire undo scope (ZWCAD UndoMark in production, no-op in tests)
  │
  ▼
CommandExecutor
  │  Execute command(s) one by one via caller-supplied executor callback
  │  Track each command result (success, warnings, artifacts, duration)
  │  ATOMIC mode: stop on first failure
  │  PARTIAL mode: continue after failure
  │
  ▼
PostValidation
  │  Caller-supplied callback: check DWG integrity after execution
  │  → If any check fails: trigger rollback
  │
  ▼ [all checks pass]
RollbackExecutor.commit()
  │  Accept the changes
  │  Return RecoveryReport(status="committed")
  │
  ▼ [any failure]
RollbackExecutor.rollback()
  │  Revert changes (UNDO in production, no-op in tests)
  │  Return RecoveryReport(status="rolled_back")
```

---

## 2. Components

### 2.1 TransactionManager

Entry point for all transactional operations. COM-free — orchestrates
pure-Python callbacks; the actual COM undo logic lives in handler code
(e.g. `handle_execute_batch`).

```python
class TransactionManager:
    def __init__(self, rollback=None, policy="atomic"):
        """rollback: RollbackExecutor (default: NullRollbackExecutor)
           policy: "atomic" | "partial" """

    def execute(self, commands, executor, pre_validate=None, post_validate=None):
        """Full lifecycle. Returns RecoveryReport."""
```

### 2.2 ActionResult

Structured return type from each command in the batch. Every handler
should return an `ActionResult` so the manager can aggregate uniformly.

```python
@dataclass
class ActionResult:
    success: bool = True
    warnings: list[str]
    artifacts: list[str]      # e.g. entity handles created
    duration_ms: float
```

### 2.3 ValidationResult

Result of a pre-flight or post-flight validation check.

```python
@dataclass
class ValidationResult:
    passed: bool = True
    errors: list[str]         # Blocking issues
    warnings: list[str]       # Non-fatal issues
```

### 2.4 RollbackExecutor Protocol

Abstracts the undo mechanism so tests use `NullRollbackExecutor`
without ZWCAD.

```python
class RollbackExecutor(Protocol):
    def begin(self) -> None: ...
    def commit(self) -> None: ...
    def rollback(self) -> None: ...

# Implementations:
# - UndoRollbackExecutor (Stage D — implemented; src/cad_intelligence/platform/undo_rollback.py)
#     Wraps ZWCAD StartUndoMark()/EndUndoMark() on begin()/commit(), and
#     EndUndoMark() + SendCommand("UNDO ") on rollback() — same sequence
#     used by handle_execute_batch (cad_io/handlers/drawing.py). Resolves
#     the COM bridge lazily via cad_io.com_primitives_v3._get_bridge(), so
#     construction never requires a live ZWCAD connection; begin()/commit()/
#     rollback() raise ZWCADConnectionError if COM is unavailable, matching
#     the failure mode used elsewhere in the codebase. Kept out of
#     transaction.py itself to preserve its COM-free design (D67).
# - NullRollbackExecutor   (tests, non-COM environments)
```

### 2.5 RecoveryReport

Full diagnostics for every transaction.

```python
@dataclass
class RecoveryReport:
    transaction_id: str       # UUID first 12 hex chars
    status: str              # "committed" | "rolled_back" | "failed"
    duration_ms: float        # Total wall-clock time
    commands: int             # Number of commands in batch
    rollback: bool            # Whether rollback was performed
    warnings: list[str]       # Non-fatal issues (from all sources)
    artifacts: list[str]      # Entity handles produced
    snapshot_path: str | None # M4+: DWG snapshot path for manual recovery
```

### 2.6 RollbackPolicy

```python
class RollbackPolicy(str):
    ATOMIC = "atomic"       # Default: full rollback on any failure
    PARTIAL = "partial"     # Opt-in: preserve successful commands (M4+)
```

---

## 3. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D65 | ATOMIC as default rollback policy | Safety first — partial rollback is risky for CAD data |
| D66 | PreValidation / PostValidation split | Pre-checks catch errors before DWG modification; post-checks catch corruption |
| D67 | RollbackExecutor as Protocol (not class) | Tests use NullRollbackExecutor; production uses UndoRollbackExecutor. No COM dependency in the module itself |
| D68 | RecoveryReport with transaction_id | Enables log correlation across distributed systems |
| D69 | Callback-based executor/validators | TransactionManager doesn't know about ZWCAD; callers inject executor logic |
| D70 | No DWGSnapshot in M3 | Snapshot via SaveAs deferred to M4+; current rollback relies on ZWCAD undo marks |
| D71 | `UndoRollbackExecutor` lives in `platform/undo_rollback.py`, not `transaction.py` | Keeps `transaction.py` COM-free (D67); the COM bridge (`cad_io.com_primitives_v3._get_bridge`) is imported lazily inside method bodies only |

---

## Exit Criteria (WP4 — Met ✓)

- ✓ `TransactionManager` with begin → pre-validate → execute → post-validate → commit/rollback
- ✓ `ActionResult`, `ValidationResult`, `RecoveryReport` dataclasses with `to_dict()`
- ✓ `RollbackExecutor` protocol with `NullRollbackExecutor` (tests) and interface for `UndoRollbackExecutor`
- ✓ `RollbackPolicy`: ATOMIC (default) and PARTIAL (interface ready)
- ✓ Pre-validation blocks execution on failure; post-validation triggers rollback
- ✓ Warnings aggregated from pre-validation, commands, and post-validation
- ✓ 28 COM-free unit tests covering all scenarios
- ✓ COM-free module — zero ZWCAD/pywin32 imports

## Exit Criteria (Stage D — Met ✓)

- ✓ `UndoRollbackExecutor` implemented in `src/cad_intelligence/platform/undo_rollback.py`, satisfying the `RollbackExecutor` Protocol exactly (`begin`/`commit`/`rollback`, no signature changes)
- ✓ Wraps ZWCAD COM `StartUndoMark()`/`EndUndoMark()` (begin/commit) and `EndUndoMark()` + `SendCommand("UNDO ")` (rollback), reusing the existing `cad_io.com_primitives_v3` bridge singleton (`_get_bridge()`) and `ZWCADConnectionError`
- ✓ Graceful no-COM-connection handling: construction never touches COM; `begin()`/`commit()`/`rollback()` raise `ZWCADConnectionError` (the established project convention) when no live ZWCAD instance is reachable, rather than crashing with an unhandled exception
- ✓ 12 additional COM-mocked unit tests in `tests/test_transaction.py` covering Protocol conformance, mocked begin/commit/rollback COM calls, no-connection behavior, and full `TransactionManager` integration
- ⚠️ Real ZWCAD COM undo behavior (actual `StartUndoMark`/`EndUndoMark`/`UNDO` round-trip against a live document) is **not** verified by this test suite — no live ZWCAD instance is available in CI/dev; only the COM call sequence against a mocked bridge is verified. Manual/live-environment verification is still needed before relying on this in production (see `tests/test_live_zwcad_closed_loop.py` for the existing live-instance test pattern this could extend).

---

## Document Dependencies

```
PIPELINE-001
      ↓
GRAPH-001
      ↓
API-001              ← Handler convention for command interface
      ↓
TRANSACTION-001      ← Commands follow API-001 convention (this doc)
      ↓
TEST-001             ← Tests verify transaction behavior
```
