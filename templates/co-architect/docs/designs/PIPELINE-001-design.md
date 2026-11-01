# PIPELINE-001: Pipeline Execution Framework

> **Spec ID**: PIPELINE-001
> **Version**: 1.1
> **Status**: Implemented — ADR-009 M1–M5 complete (`pipeline/` package, 189 tests)
> **Created**: 2026-07-05
> **Updated**: 2026-07-08 — implementation of ADR-009 M1–M5 confirmed complete
> **Authors**: architect
> **Source**: V3 completion — pipeline execution framework as the authoritative "flow" document
> **Related**: [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md) (Pipeline & Artifact Architecture), [`ADR-009`](../adr/ADR-009-pipeline-execution-framework.md) (Implementation), [`GRAPH-001`](GRAPH-001-design.md) (Data Model), [`API-001`](API-001-design.md) (Interface Standard), [`TEST-001`](TEST-001-design.md) (Verification)

---

## Scope

This document describes **how data flows through the pipeline** — execution order, phase contracts, error handling, recovery, and orchestration.

**Explicitly NOT in scope**: Graph data model (node/edge definitions) — see [`GRAPH-001`](GRAPH-001-design.md). MCP tool interface — see [`API-001`](API-001-design.md). Transaction semantics — see [`TRANSACTION-001`](TRANSACTION-001-design.md).

This is the **onboarding entry point**: new developers should read this document first to understand the end-to-end flow, then consult the other design documents for specific concerns.

---

## 1. Phase Sequence

The pipeline transforms raw DWG data into actionable outputs through a sequence of phases. Each phase has a clear input contract, output contract, and responsibility.

```
DWG File
  │
  ▼
Phase 1: Drawing Analysis
  │  → DrawingMetadata
  ▼
Phase 2: Geometry Foundation
  │  → DefaultGeometryModel
  ▼
Phase 3: Semantic Reconstruction
  │  → SemanticModel (includes ArchitectureGraph)
  ▼
Phase 4: Application Pipeline
  │  → ApplicationSpec(s)
  ▼
Phase 5: Output / Rendering
     → DWG entities, Excel, CSV, JSON
```

### 1.1 Phase 1 — Drawing Analysis

**Responsibility**: Extract raw metadata and entity data from the DWG file via COM bridge.

| Aspect | Detail |
|--------|--------|
| **Input** | DWG file path (opened via ZWCAD COM) |
| **Output** | `DrawingMetadata` — layer list, entity type histogram, drawing bounds, unit system |
| **Key operations** | `zwcad_analyze_layers`, `zwcad_classify_layers`, `zwcad_extract_cad_objects` |
| **Error handling** | COM connection failure → abort with `_ERR_ZWCAD_CONNECTION`; corrupted DWG → abort |
| **Dependencies** | ZWCAD COM bridge (external process) |

### 1.2 Phase 2 — Geometry Foundation

**Responsibility**: Convert raw entities into geometric primitives — wall centerlines, axis grids, opening candidates, space polygons.

| Aspect | Detail |
|--------|--------|
| **Input** | `DrawingMetadata` + raw entity list |
| **Output** | `DefaultGeometryModel` — wall segments, axis grid, opening candidates, space polygons |
| **Key operations** | `zwcad_generate_spaces` (wall→polygonize), `zwcad_generate_axis_grid` (AXIS-001), `zwcad_find_opening_candidates` (AXIS-001 B1), `zwcad_group_openings` |
| **Error handling** | `UNCLOSED_WALLS` (blocking — polygonization failure), `AXIS_SNAP_AMBIGUOUS` (warning) |
| **Dependencies** | Phase 1 output; shapely for geometry |

### 1.3 Phase 3 — Semantic Reconstruction

**Responsibility**: Build the Architecture Graph with identified nodes (rooms, walls, doors, windows) and their relationships. Assign openings to walls/rooms. Match space info.

| Aspect | Detail |
|--------|--------|
| **Input** | `DefaultGeometryModel` + `DrawingMetadata` |
| **Output** | `SemanticModel` — ArchitectureGraph with confirmed identity nodes, confidence scores, opening assignments |
| **Key operations** | `zwcad_build_feature_store` (AXIS-001 B1), `zwcad_build_object_candidates` (ADR-004 ④⑤⑥⑫), `zwcad_assign_openings` (AXIS-001 B2), `zwcad_map_space_info` |
| **Error handling** | `LOW_CONFIDENCE_OPENING` (warning — below threshold), `ORPHAN_OPENING_NO_WALL` (warning) |
| **Dependencies** | Phase 2 output; Pattern Library DSL; Graph schema per GRAPH-001 |

### 1.4 Phase 4 — Application Pipeline

**Responsibility**: Transform the semantic model into application-specific specifications (elevation specs, schedules, takeoffs, etc.).

| Aspect | Detail |
|--------|--------|
| **Input** | `SemanticModel` (ArchitectureGraph) |
| **Output** | `ApplicationSpec` subclass instances (e.g., `ElevationSpec`, `ScheduleSpec`) |
| **Key operations** | `zwcad_generate_wall_model` (ELEV-002 P3), `zwcad_generate_wall_elevations` |
| **Error handling** | Application-specific; follows `SupportsApplicationSpec.validate()` contract |
| **Dependencies** | Phase 3 output; ApplicationSpec protocol per ADR-007 |

### 1.5 Phase 5 — Output / Rendering

**Responsibility**: Write application specs back into the DWG file or export to external formats.

| Aspect | Detail |
|--------|--------|
| **Input** | `ApplicationSpec` instances |
| **Output** | DWG entities (drawn via COM), Excel/CSV files, JSON reports |
| **Key operations** | Drawing primitives (draw_line, draw_polyline, etc.), export handlers |
| **Error handling** | Transaction-wrapped (see TRANSACTION-001) |
| **Dependencies** | Phase 4 output; ZWCAD COM for drawing |

---

## 2. Phase Dependencies and Ordering

Phases must execute in strict sequence — each depends on the output contract of the previous phase.

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

**Within-phase parallelism** (future):
- Phase 2 sub-operations (`generate_axis_grid`, `find_opening_candidates`, `generate_spaces`) are independent and could run in parallel if the dependency DAG permits.
- Phase 4 sub-operations (multiple ApplicationSpec builders) are independent of each other — they can run concurrently.

**Cross-phase constraints**:
- Phase 3 cannot start until Phase 2's `DefaultGeometryModel` is complete.
- Phase 4 cannot start until Phase 3's `SemanticModel` is committed.
- Phase 5 can begin as soon as any single `ApplicationSpec` is ready (streaming output).

---

## 3. Pipeline Artifacts

Pipeline artifacts are frozen dataclasses with `schema_version` for serialization stability. Defined in ADR-009.

| Artifact | Module | Purpose |
|----------|--------|---------|
| `DrawingMetadata` | `pipeline/artifacts.py` | DWG file metadata (layers, bounds, units) |
| `DefaultGeometryModel` | `pipeline/artifacts.py` | Geometric primitives (walls, axes, candidates) |
| `SemanticModel` | `pipeline/artifacts.py` | ArchitectureGraph with semantic identity |

Each artifact supports:
- `to_dict() → dict` — canonical JSON serialization
- `from_dict(data: dict) → Self` — deserialization (backward-compatible)
- `stable_hash() → str` — SHA-256 of canonical JSON for cache keys

---

## 4. Pipeline Execution Metadata

### 4.1 PipelineRun

Every pipeline execution creates a `PipelineRun` record:

```python
@dataclass(frozen=True)
class PipelineRun:
    run_id: str          # UUID
    random_seed: int     # for reproducibility
    git_commit: str      # code version at time of run
    tool_version: str    # ZWCAD version
    config: PipelineConfig  # includes feature_flags
    phase_results: list[PhaseResult]
```

### 4.2 PhaseResult

Each phase records its outcome:

```python
@dataclass(frozen=True)
class PhaseResult:
    phase_name: str
    status: Literal["success", "skipped", "failed"]
    duration_ms: int
    artifact_hash: str | None  # stable_hash of output artifact
    error: str | None
```

### 4.3 PipelineContext

Minimal context propagated through phases:

```python
@dataclass
class PipelineContext:
    run: PipelineRun
    services: PipelineServices  # logger, metrics, cache
```

---

## 5. Error Handling and Recovery

### 5.1 Error Severity Levels

| Severity | Meaning | Action |
|----------|---------|--------|
| `blocking` | Phase cannot produce valid output | Abort phase, report error |
| `warning` | Phase produces output but quality is degraded | Continue, log warning |
| `info` | Observational | Log only |

### 5.2 Phase Failure Strategy

When a phase fails:

1. **Log** the failure with full context (phase name, input artifact hash, error message, traceback)
2. **Record** a `PhaseResult(status="failed", error=...)` in the PipelineRun
3. **Decide**: based on phase criticality and configuration
   - **Critical phase** (Phase 2, 3): abort pipeline — downstream phases cannot proceed without valid input
   - **Optional phase** (Phase 4 sub-operations): skip that sub-operation, continue with others
4. **Recovery options**:
   - **Retry**: re-run the failed phase with the same input (configurable max retries)
   - **Partial**: skip the failed sub-operation, produce degraded output with warnings
   - **Abort**: stop the entire pipeline

### 5.3 ExceptionReport Convention

All pipeline exceptions use the `ExceptionReport` dataclass:

```python
@dataclass
class ExceptionReport:
    code: str           # e.g., "UNCLOSED_WALLS", "AXIS_POSITION_DRIFT"
    severity: str       # "blocking" | "warning" | "info"
    message: str
    context: dict       # structured metadata for debugging
```

Exception codes are declared at module level (see `axis_grid.py:74-78`, `space_geometry.py:155`).

---

## 6. Pipeline Services

`PipelineServices` provides shared infrastructure to all phases:

```python
@dataclass
class PipelineServices:
    logger: logging.Logger
    metrics: SupportsMetricsCollector | None  # optional
    cache: SupportsCacheBackend | None        # optional
```

Protocols (defined in `pipeline/run.py`):
- `SupportsCacheBackend`: `get(key) → bytes | None`, `set(key, value, ttl)`
- `SupportsMetricsCollector`: `record(phase, name, value)`, `increment(phase, counter)`

---

## 7. Phase Plugin System (Future)

Currently phases are called directly. Future: YAML manifest + PhaseRegistry for pluggable phases.

```yaml
# pipeline.manifest.yaml (future)
phases:
  - name: drawing_analysis
    module: cad_intelligence.pipeline.phases.drawing_analysis
    class: DrawingAnalysisPhase
    depends_on: []
  - name: geometry_foundation
    module: cad_intelligence.pipeline.phases.geometry_foundation
    class: GeometryFoundationPhase
    depends_on: [drawing_analysis]
```

Phase registry supports `SupportsPipelinePhase` protocol:

```python
class SupportsPipelinePhase(Protocol):
    def execute(self, context: PipelineContext) -> PhaseResult: ...
    def name(self) -> str: ...
```

---

## 8. Recognition Evidence (Phase 2–3)

The `RecognitionStore` provides transactional evidence accumulation during object recognition phases.

```
RecognitionStore (ABC)
  ├── begin()          — start a recognition transaction
  ├── save(evidence)   — record recognition evidence
  ├── commit()         — finalize transaction
  └── rollback()       — discard transaction
```

Evidence flows into the Architecture Graph during Phase 3, where each node carries:
- `confidence: float` — inherited from the recognition phase that created it
- `evidence: list[RecognitionEvidence]` — chain of evidence supporting the identification

---

## 9. Ground Truth Evaluation

Per-phase evaluation against known-good reference data (see ADR-009 §5).

| Metric | Threshold |
|--------|-----------|
| Wall Recall | ≥ 98% |
| Door Recall | ≥ 94% |
| Window Recall | ≥ 91% |
| Room Recall | ≥ 97% |
| Pattern Precision | ≥ 96% |

Structural check: zero actual entities against non-zero expected always fails (design decision D43).

---

## 10. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D47 | Pipeline document scope = "flow" only | Separates execution concerns from data model (GRAPH-001) and interface (API-001) |
| D48 | Strict phase ordering | Simplicity; each phase's output is the next's contract — parallelism is an optimization, not a requirement |
| D49 | ExceptionReport as structured data | Machine-parseable for REVIEW-AGENT-001 severity routing |
| D50 | PipelineRun metadata for reproducibility | Enables regression testing, cache invalidation, and audit trail |
| D51 | Feature flags in PipelineConfig | Allows gradual rollout of new phases without breaking existing pipelines |

---

## Document Dependency Graph

This document is the first in the WP3A dependency chain:

```
PIPELINE-001 (this doc) ← Onboarding entry point
      ↓
GRAPH-001                ← Node/edge definitions before API DTOs
      ↓
API-001                  ← Handler DTOs depend on Graph data model
      ↓
TRANSACTION-001          ← Command execution depends on API conventions
      ↓
TEST-001                 ← Tests reference Graph model, API contracts
      ↓
REVIEW-AGENT-001         ← Review rules check against Graph + API
      ↓
SPACE-001                ← Space reconstruction uses Graph Query API
```
