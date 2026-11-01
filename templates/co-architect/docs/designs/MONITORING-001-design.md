# MONITORING-001: Structured Telemetry for CAD Intelligence Pipeline

> **Spec ID**: MONITORING-001
> **Version**: 1.0
> **Status**: Implemented
> **Created**: 2026-07-10
> **Updated**: 2026-07-10
> **Authors**: architect
> **Source**: Pipeline observability — structured telemetry for execution monitoring, performance diagnostics, and benchmark analysis
> **Related**: [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`WORKFLOW-001`](WORKFLOW-001-design.md) (Workflow Orchestrator), [`API-001`](API-001-design.md) (MCP Tool), [`TEST-001`](TEST-001-design.md) (Verification)
> **Implementation**: `src/cad_intelligence/platform/telemetry.py`, `src/cad_intelligence/platform/telemetry_writers.py`, `src/cad_intelligence/cad_io/handlers/telemetry.py`, `tests/test_telemetry.py`, `tests/test_telemetry_writers.py`, `tests/test_telemetry_mcp.py`, `tests/workflow/test_orchestrator_telemetry.py`

---

## Scope

This document defines the **structured telemetry system** for the CAD Intelligence pipeline — observability into pipeline execution, step performance, and error diagnostics. Enables Golden Dataset analysis, Benchmark bottleneck identification, and post-Packaging operational diagnostics.

---

## 1. Overview

```
Pipeline / MCP Handler / Direct API call
    -> PipelineTelemetry.span(stage)
    -> SpanBuilder (mutable context manager)
    -> .finish() [automatic on __exit__]
    -> PipelineTelemetry._on_span_completed(frozen_span)
        |-- TelemetryStore.append(span)       <- ALWAYS (source of truth)
        +-- TelemetryRecorder.notify(span)    <- OPTIONAL (fan-out coordinator)
                |-- JSONWriter.write_span(span)     <- exception isolated
                |-- MetricsReporter.record(span)    <- exception isolated
                +-- EventBus.publish(event)        <- subscriber exceptions logged, not propagated
```

**Key invariants:**

1. Every completed span is always appended to `TelemetryStore` — this is the source of truth.
2. Optional writers (`JSONWriter`, `MetricsReporter`, `EventBus`) receive spans for fan-out. Writer failures are isolated and never propagated.
3. MCP tool `zwcad_get_telemetry` reads from the in-memory store — no COM involvement.
4. The system is COM-free, has zero external dependencies beyond stdlib, and adds negligible overhead.

---

## 2. Components

### 2.1 TelemetryStage (StrEnum)

Unified stage enum for pipeline and system spans. Bare strings are never used — all stages are values of this enum (D6, D14).

```python
class TelemetryStage(StrEnum):
    # Pipeline stages (correspond to orchestrator workflow step names)
    BUILD_GRAPH = "build_graph"
    REVIEW = "review"
    CLOSED_LOOP = "closed_loop"
    SECTION = "section"
    ELEVATION = "elevation"
    FACADE = "facade"
    SCHEDULE = "schedule"
    TAKEOFF = "takeoff"
    COLLECT = "collect"
    # System stages
    MCP_DISPATCH = "mcp_dispatch"
    SERVER_STARTUP = "server_startup"
    SERVER_SHUTDOWN = "server_shutdown"
```

### 2.2 SpanStatus (StrEnum)

Terminal states for a completed `TelemetrySpan` (D18). State machine: `STARTED -> SUCCESS | ERROR | SKIPPED`. No transitions between terminal states.

```python
class SpanStatus(StrEnum):
    SUCCESS = "success"
    ERROR = "error"
    SKIPPED = "skipped"
```

### 2.3 TelemetrySpan

Frozen immutable record of a completed pipeline stage execution. Produced by `SpanBuilder.finish()`. All fields are read-only. Supports `to_dict()` / `from_dict()` round-trip serialization with `schema_version` in every record (D13).

```python
@dataclass(frozen=True)
class TelemetrySpan:
    span_id: str
    run_id: str
    stage: str
    status: str
    started_at: float
    finished_at: float
    duration_ms: float
    metadata: tuple[tuple[str, Any], ...] = ()
    messages: tuple[str, ...] = ()
    parent_id: str | None = None
    trace_id: str | None = None
    schema_version: int = 1
```

### 2.4 SpanBuilder

Mutable context manager that collects data during execution and produces a `TelemetrySpan` on `finish()`.

- `__enter__` returns self; `__exit__` calls `finish()` exactly once on all exit paths (D17).
- Double `finish()` is a no-op with a warning — no duplicate store entries.
- `child(stage)` creates a child builder that auto-inherits `run_id` and `trace_id` (D15).
- `add_message()` and `set_attribute()` accumulate data during execution.
- Reserved metadata keys (e.g. `run_id`, `span_id`, `stage`) are rejected to prevent collision.

```python
with telemetry.span(stage=TelemetryStage.BUILD_GRAPH) as b:
    b.add_message("graph built successfully")
    b.set_attribute("node_count", 42)
# b.finished_span is the frozen TelemetrySpan
```

### 2.5 TelemetryStore

Thread-safe ring buffer (`collections.deque` with `maxlen=10000`), source of truth for all completed spans (D2).

- **Completeness tracking**: per-run span counts and a `_run_evicted` set detect whether any spans were lost due to buffer overflow. `RunSummary.completeness` reflects `"full"` or `"partial"`.
- **Lock scope (D9, D19)**: single `threading.Lock` covering data-structure operations only. Never calls Writer / EventBus / IO inside the lock.
- **Query API**: filter by `run_id`, `stage`, `status`, and `limit`. All queries hold the lock for full iteration.
- **`prune(run_id)`**: removes all spans for a given run, returns count of removed spans.

### 2.6 PipelineTelemetry

Server-level singleton that owns the `TelemetryStore` and optional writer fan-out (D1).

- **Lifecycle**: `begin_run(run_id?)` -> `span(stage)` -> `end_run()` -> `RunSummary`. Nested `begin_run` raises `RuntimeError` (D11) — one active run per instance.
- **`span(stage)`**: creates a `SpanBuilder` linked to the active run. If no run is active, a standalone `run_id` is generated.
- **`_on_span_completed(span)`**: appends to store (always), then fans out to writers (optional). Writer exceptions are logged and never propagated.
- **`close()`**: flushes and closes all writers.

### 2.7 TelemetryWriter Protocol

Protocol for telemetry fan-out consumers. All implementations must be safe to call from any thread.

```python
class TelemetryWriter(Protocol):
    def write_span(self, span: TelemetrySpan) -> None: ...
    def flush(self) -> None: ...
    def close(self) -> None: ...
```

### 2.8 JSONWriter

JSON-lines file writer with `RotatingFileHandler` (D3). Each span is written as a single JSON line with `schema_version=1` (D13).

- **Flush modes**: per-span immediate write (default), per-run explicit `flush()`, shutdown `flush()` on `close()`.
- **`flush()` flushes Python file buffers but does NOT call `os.fsync()`** — flush differs from fsync (D3).
- Default log path: `logs/telemetry.jsonl` (overridable via `TELEMETRY_LOG_DIR` env var).
- Rotation: 10 MB per file, 5 backup files.

### 2.9 MetricsReporter

Store snapshot-based percentile computation (D4, D22). v1 reads from the `TelemetryStore` on each `snapshot()` call — does not maintain separate duration lists, so memory is bounded by the store's ring buffer.

- Returns: `span_count`, duration stats (`min`, `max`, `avg`, `p50`, `p95`, `p99`), and per-stage breakdown.
- Percentile: sort-on-query using nearest-rank method (D12). Upgrade path to t-digest/CKMS documented.
- `write_span()` is a no-op — reads from the store, not from individual spans.

### 2.10 TelemetryRecorder

Fan-out coordinator that wraps a list of `TelemetryWriter` instances (D20).

- All writers receive every span. Writer exceptions are isolated — one failure never blocks others (D20).
- Tracks per-writer error counts in `_error_counts`.
- Does NOT own the `TelemetryStore` — source of truth lives in `PipelineTelemetry`.

### 2.11 RunSummary

Per-run aggregated statistics produced by `TelemetryStore.run_summary()` or `PipelineTelemetry.end_run()`. Frozen immutable dataclass with `to_dict()` serialization.

```python
@dataclass(frozen=True)
class RunSummary:
    run_id: str
    started_at: float
    finished_at: float
    total_duration_ms: float
    span_count: int
    success_count: int
    error_count: int
    skipped_count: int
    stages: tuple[str, ...]
    completeness: str = "full"   # "full" | "partial"
    schema_version: int = 1
```

### 2.12 sanitize_for_mcp()

Separate serialization layer for MCP tool security (D24). Not embedded in `TelemetrySpan.to_dict()` so that redaction policy can evolve independently.

- **Non-debug mode**: redacts `metadata["stack"]` and `metadata["source"]`. Retains `metadata["exception_type"]` for AI agent self-diagnosis.
- **Debug mode**: returns the span dict unchanged (full fidelity).

---

## 3. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Server-level singleton lifecycle; `run_id` per workflow | `PipelineTelemetry` lives for the server lifetime; each workflow invocation gets its own `run_id` via `begin_run()`. Per-run isolation without separate telemetry instances |
| D2 | Ring buffer (10 000) + completeness tracking, `prune()` API | Bounded memory for long-running servers. Completeness flag on `RunSummary` tells consumers whether data may be partial. `prune()` allows explicit cleanup of completed runs |
| D3 | JSONWriter flush = per-span immediate, per-run, shutdown. Flush != fsync | Per-span immediate write ensures no data loss on crash. Python buffer flush is fast; `os.fsync()` would be a bottleneck |
| D4 | MetricsReporter v1 = TelemetryStore snapshot-based, O(1) snapshot | No duplicate duration storage — memory bounded by the store ring buffer. Query-time sort is acceptable for current span volumes |
| D5 | EventBus schema: `telemetry.span.started`/`completed`, `telemetry.run.completed` with `schema_version` | Consistent event naming and versioning enables future consumers to evolve without breaking existing subscribers |
| D6 | TelemetryStage StrEnum — bare strings never used | Enum prevents typos, enables IDE autocompletion, and provides a single source of truth for all stage names |
| D7 | MCP tool: `zwcad_get_telemetry(mode, run_id?, limit?)` | COM-free read-only tool. Three modes (`spans`, `summary`, `metrics`) cover the main diagnostic use cases |
| D8 | Dual clock: `time.time()` for timestamps, `time.perf_counter()` for duration | `time.time()` gives wall-clock timestamps for log correlation. `time.perf_counter()` is monotonic and high-resolution, avoiding clock skew in duration |
| D9 | Store lock: single `threading.Lock`, scope = data-structure ops only (never Writer/EventBus/IO) | Prevents lock contention from slow I/O. Writers and event bus operate outside the critical section |
| D10 | Stack trace: `metadata["stack"]` defaults `None`, only with `debug=True` | Stack traces are large and sensitive. Default omission keeps spans compact. Debug mode opt-in for development diagnostics |
| D11 | `begin_run`/`end_run`: nested `begin_run` raises `RuntimeError`. One active run per instance | Simplicity over flexibility. Nesting runs would complicate run_id ownership without a clear use case |
| D12 | Percentile: sort-on-query now. t-digest/CKMS upgrade path documented | Nearest-rank on sorted list is correct and simple. Documented upgrade path ensures revisiting when volumes warrant streaming quantiles |
| D13 | JSONL `schema_version`: 1 in every record | Forward-compatible serialization. Consumers can version-gate parsing without breaking on older data |
| D14 | Stage extension: new stages added to TelemetryStage StrEnum | Centralized stage registry. Adding a new stage is a single-line enum addition — no string literals scattered across the codebase |
| D15 | Child inheritance: `SpanBuilder.child()` auto-inherits `run_id`, `trace_id` | Parent-child span relationships are automatic. Callers never forget to propagate context |
| D16 | Event payload `schema_version` | Consistent with JSONL schema versioning. Future event schema changes are backwards-compatible |
| D17 | Double finish guarantee: `__exit__` calls `finish()` exactly once. Double finish = no-op + warning | Prevents duplicate store entries from manual `finish()` + context manager exit. Warning surfaces accidental double-finish bugs |
| D18 | Span state machine: `STARTED -> SUCCESS | ERROR | SKIPPED` (terminal, no transitions) | A completed span is immutable. No retry/revert semantics — if a step fails, the span records the error and downstream logic decides recovery |
| D19 | Store snapshot consistency: all queries hold lock for full iteration | Prevents torn reads — a query never sees a partially-updated buffer. The lock is short-lived (in-memory iteration only) |
| D20 | Writer exception isolation: one writer failure never blocks others | Telemetry must not break the pipeline. A slow or broken JSONWriter must not prevent MetricsReporter from recording |
| D21 | EventBus subscriber exceptions: logged (debug), not silently swallowed | `EventBus.publish()` already logs at `_logger.debug`. Zero production imports needed — existing contract is correct. Subscribers can add their own error handling |
| D22 | MetricsReporter strategy: v1 fixed to TelemetryStore snapshot-based only | No separate metric accumulation. Simplicity over flexibility for v1. Rolling cache is documented future work |
| D23 | Store persistence: out of scope for v1. `to_dict()` exists. `save()`/`load()` future work | Persistence adds complexity (file format, atomicity, large-store handling). Defer until there is a concrete need |
| D24 | MCP tool security: `sanitize_for_mcp()` separate function. Non-debug: redacts stack + source, retains `exception_type` | AI agents see enough to self-diagnose (exception type) but not full stack traces in production. Separate function allows redaction policy to evolve independently |
| D25 | Future work: copy-then-release lock, rolling percentile cache, store persistence, async spans, OpenTelemetry bridge | Documented upgrade paths prevent design drift. Each item has a clear trigger condition and minimal disruption path |

---

## 4. Integration Points

### 4.1 PipelineServices

Added `telemetry` and `event_bus` optional fields to the `PipelineServices` container in `pipeline/run.py`.

```python
@dataclass
class PipelineServices:
    telemetry: Any | None = None      # PipelineTelemetry | None
    event_bus: Any | None = None      # EventBus | None
```

### 4.2 WorkflowOrchestrator

`WorkflowOrchestrator` in `workflow/orchestrator.py` accepts a `telemetry` parameter and instruments the run lifecycle:

- `begin_run(run_id)` is called before pipeline execution starts.
- `end_run()` is called after pipeline execution completes (success or failure).
- Each workflow step (`_execute_step`) and the build-graph phase (`_run_build_graph`) is wrapped in a `telemetry.span(stage=step_name)` context manager.
- If `telemetry` is `None`, all instrumentation is a no-op — zero overhead when telemetry is not configured.

### 4.3 MCP Server

Registered `zwcad_get_telemetry` as a COM-free tool in `cad_io/server.py`:

- **Tool name**: `zwcad_get_telemetry`
- **Handler**: `handle_get_telemetry` in `cad_io/handlers/telemetry.py`
- **COM requirement**: `false`
- **Modes**: `spans` (recent span dicts), `summary` (per-run summary), `metrics` (aggregated percentiles)
- **Security**: all output passes through `sanitize_for_mcp()` (D24)

### 4.4 EventBus D21

The existing `EventBus.publish()` method in `platform/event_bus.py` already catches subscriber exceptions and logs them at debug level (`_logger.debug`). This contract is correct and requires no code changes — verified as part of MONITORING-001 telemetry writer integration testing.

---

## 5. Testing

184 tests across 4 test files:

### test_telemetry.py (101 tests)

Core models, store, span builder, and concurrency:

- `TelemetryStage` and `SpanStatus` enum values and membership.
- `TelemetrySpan` construction, `to_dict()` / `from_dict()` round-trip, frozen immutability.
- `SpanBuilder` context manager, `finish()` semantics, double-finish guarantee (D17), child span inheritance (D15), reserved metadata key rejection, exception handling in `__exit__`.
- `TelemetryStore` append, query (filtered and unfiltered), ring buffer eviction, completeness tracking, `prune()`, `clear()`, `run_summary()`.
- `PipelineTelemetry` lifecycle (`begin_run`/`end_run`), nested `begin_run` rejection (D11), span creation, `_on_span_completed` fan-out, writer exception isolation.
- `RunSummary` construction from spans, `to_dict()` serialization.
- `sanitize_for_mcp()` debug/non-debug redaction behavior (D24).
- Thread-safety under concurrent span completion.

### test_telemetry_writers.py (46 tests)

Writer implementations and the fan-out coordinator:

- `JSONWriter` per-span write, `schema_version` inclusion, `flush()`/`close()` lifecycle, `RotatingFileHandler` integration.
- `MetricsReporter` snapshot computation (p50/p95/p99), per-stage breakdown, empty-store handling, store-reference updates.
- `TelemetryRecorder` fan-out to multiple writers, writer exception isolation (D20), per-writer error tracking, `add_writer`/`remove_writer`.
- EventBus subscriber exception behavior (D21).

### test_orchestrator_telemetry.py (13 tests)

Orchestrator integration with telemetry:

- `WorkflowOrchestrator` correctly calls `begin_run()`/`end_run()` around pipeline execution.
- Each step is instrumented with `telemetry.span()`.
- Telemetry `None` produces no-op behavior.
- `end_run()` returns a `RunSummary` with correct stage counts.

### test_telemetry_mcp.py (24 tests)

MCP handler and security sanitization:

- `handle_get_telemetry` modes: `spans`, `summary`, `metrics`.
- `run_id` and `limit` filtering.
- Error responses for missing `run_id` in summary mode.
- `sanitize_for_mcp()` redacts stack/source in non-debug mode, retains `exception_type`.
- Module-level singleton lifecycle: `get_telemetry_instance()` / `reset_telemetry_instance()`.
- COM-free guarantee: handler never imports or calls ZWCAD COM.

---

## 6. Future Work

| Item | Trigger Condition | Approach |
|------|-------------------|----------|
| Copy-then-release lock | Lock contention observed under high-concurrency span completion | Replace `threading.Lock` with copy-then-release pattern: copy buffer under lock, release, then iterate copy |
| Rolling percentile cache | Span volumes exceed ~100K per snapshot | Maintain a t-digest or CKMS sketch, updated incrementally on each span. O(1) snapshot queries |
| Store persistence | Benchmark comparison or historical analysis needed | Add `save(path)` / `load(path)` to `TelemetryStore` using `to_dict()` serialization. Atomic write via temp file + rename |
| Async span support | Pipeline steps become async (I/O-bound stages) | `SpanBuilder` gains `async with` support. Store append remains synchronous (ring buffer write is fast) |
| OpenTelemetry bridge | External observability stack (Jaeger, Grafana) integration | `TelemetryWriter` implementation that translates `TelemetrySpan` to OTel Span and exports via OTel SDK |

---

## 7. Files

| File | Type | Description |
|------|------|-------------|
| `src/cad_intelligence/platform/telemetry.py` | New | Core telemetry module: `TelemetryStage`, `SpanStatus`, `TelemetrySpan`, `SpanBuilder`, `TelemetryStore`, `PipelineTelemetry`, `TelemetryWriter` protocol, `RunSummary`, `sanitize_for_mcp()` |
| `src/cad_intelligence/platform/telemetry_writers.py` | New | Writer implementations: `JSONWriter`, `MetricsReporter`, `TelemetryRecorder` |
| `src/cad_intelligence/cad_io/handlers/telemetry.py` | New | MCP handler: `handle_get_telemetry`, module-level singleton accessor |
| `src/cad_intelligence/pipeline/run.py` | Modified | Added `telemetry` and `event_bus` optional fields to `PipelineServices` |
| `src/cad_intelligence/workflow/orchestrator.py` | Modified | Added `telemetry` param, instruments `_run_build_graph` and `_execute_step` with spans, `begin_run`/`end_run` lifecycle |
| `src/cad_intelligence/cad_io/server.py` | Modified | Registered `zwcad_get_telemetry` tool (COM-free) |
| `src/cad_intelligence/platform/__init__.py` | Modified | Updated module docstring to reference MONITORING-001 |
| `tests/test_telemetry.py` | New | 101 tests — core models, store, span builder, concurrency |
| `tests/test_telemetry_writers.py` | New | 46 tests — JSONWriter, MetricsReporter, TelemetryRecorder, EventBus D21 |
| `tests/workflow/test_orchestrator_telemetry.py` | New | 13 tests — orchestrator integration |
| `tests/test_telemetry_mcp.py` | New | 24 tests — MCP handler, security sanitization |

---

## Document Dependencies

```
PIPELINE-001
      |
WORKFLOW-001           <-- Orchestrator integration
      |
API-001                <-- Handler convention for MCP tool interface
      |
MONITORING-001         <-- Telemetry system (this doc)
      |
TEST-001               <-- Tests verify telemetry behavior
```
