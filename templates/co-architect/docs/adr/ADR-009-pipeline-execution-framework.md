---
lang: ko
lang_reason: source-material
---

# ADR-009: Pipeline Execution Framework & Ground Truth Evaluation

> **Spec ID**: ADR-009
> **Version**: 1.0 (design + implementation)
> **Status**: M1–M5 implemented
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: Semantic Reconstruction strengthening (1순위 priority) — artifact contracts, recognition evidence, graph query services, application spec protocols, and ground truth evaluation. Follows ADR → Contract Test → Implementation cycle. 5-milestone execution (M1–M5).
> **Supersedes**: None (new ADR)
> **Related**: [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) (Pipeline & Artifact Architecture), [`ADR-005`](ADR-005-architecture-graph-schema.md) (Graph Schema), [`ADR-007`](ADR-007-appspec-rendering-architecture.md) (ApplicationSpec), [`ADR-008`](ADR-008-command-versioning-editing.md) (Versioning)

---

## 1. Overview

This ADR defines the **execution infrastructure** for the 6-Phase CAD Intelligence Pipeline — the runtime framework that connects the phase contracts defined in ADR-004 into a functional, testable, and observable pipeline. It covers:

1. **Pipeline artifact dataclasses** — frozen, versioned contracts for phase boundaries
2. **Pipeline run metadata** — execution tracking, caching, and observability
3. **Phase plugin system** — YAML manifest-driven phase registration with Protocol-based extensibility
4. **Artifact validators** — external validation (strict/relaxed modes) with JSON Schema contracts
5. **Recognition Store & Index** — transactional evidence storage with read-only query interface
6. **Graph Query Service** — read-only query API separated from ArchitectureGraph data
7. **Application Spec Protocols** — structural subtyping for builder and mutation contracts
8. **Ground Truth evaluation** — per-phase precision/recall/F1 with KPI thresholds and regression tracking

### Design Freeze Principle

> "새로운 기능은 기존 확장점(Protocol, Builder, Registry, Store)을 이용해서 구현한다"

No new layers beyond those defined in ADR-004–008. All new functionality leverages existing extension points: Protocols for type contracts, Registries for plugin management, Stores for data persistence, Builders for spec construction.

### Architecture Principles Applied

| # | Principle | Implementation |
|---|-----------|----------------|
| AP1 | Geometry/Semantic separation | §2 — Artifacts carry only `schema_version`; execution metadata in PipelineRun |
| AP5 | Graph Query API | §6 — GraphQueryService as read-only interface separated from ArchitectureGraph |
| AP6 | Recognition evidence traceability | §5 — RecognitionStore with transactions + RecognitionIndex for read-only queries |
| AP7 | Unknown objects preserved | §2 — SemanticModel.unresolved_candidates; NOT in Graph |
| AP8 | Renderer is read-only | §7 — SupportsApplicationSpec Protocol; SupportsBuilder Protocol |

---

## 2. Pipeline Artifacts

### 2.1 Design Principle

Artifacts are **pure frozen data** with only `schema_version` as metadata. All execution metadata (run_id, timestamps, git_commit, tool_version, feature_flags) lives in `PipelineRun`, not in the artifacts themselves.

### 2.2 Artifact Contracts

```python
@dataclass(frozen=True)
class DrawingMetadata:
    schema_version: str = "1.0"
    layers: tuple = ()
    units: str = "mm"
    scale: float = 1.0
    block_table: dict = field(default_factory=dict)
    text_styles: tuple = ()

@dataclass(frozen=True)
class DefaultGeometryModel:
    schema_version: str = "1.0"
    primitive_graph: Any = None
    components: tuple = ()
    feature_store: Any = None

@dataclass(frozen=True)
class SemanticModel:
    schema_version: str = "1.0"
    semantic_objects: tuple = ()
    recognition_evidence: tuple = ()
    unresolved_candidates: tuple = ()  # UnknownCandidate — stays here, NOT in Graph
```

### 2.3 Stable Hash

All artifacts support `stable_hash()` — canonical JSON → SHA-256 for deterministic cache keys and regression detection.

### 2.4 Serialization

All artifacts implement `to_dict()` / `from_dict()` for JSON round-tripping. Backward compatibility: `from_dict()` ignores unknown fields.

### 2.5 JSON Schema Contracts

External validation schemas in `contracts/`:
- `contracts/geometry.schema.json` — Phase 2 output (GeometryModel)
- `contracts/semantic.schema.json` — Phase 3 output (SemanticModel)

---

## 3. Pipeline Run Metadata

### 3.1 PipelineRun

Execution metadata tracking for observability and reproducibility:

```python
@dataclass
class PipelineRun:
    run_id: str
    random_seed: int        # reproducibility
    git_commit: str          # code version
    tool_version: str       # platform version
    config: PipelineConfig  # includes feature_flags
    started_at: float
    finished_at: float
    phase_results: list[PhaseResult]

@dataclass
class PhaseResult:
    phase: int
    name: str
    status: str             # "success" | "skipped" | "failed"
    duration_ms: float
    input_count: int
    output_count: int
    memory_mb: float
    warnings: list[str]
```

### 3.2 PipelineContext

Minimal context — no God Object. Contains `run` + `services` container:

```python
@dataclass
class PipelineContext:
    run: PipelineRun
    services: PipelineServices

@dataclass
class PipelineServices:
    logger: logging.Logger
    metrics: SupportsMetricsCollector | None  # null-safe
    cache: SupportsCacheBackend | None        # null-safe
```

**Note**: EventBus deferred to M6+ (ADR-008 §3). PipelineServices uses null-safe pattern — consumers check for None.

---

## 4. Phase Plugin System

### 4.1 Phase Protocol

```python
@runtime_checkable
class SupportsPipelinePhase(Protocol):
    input_type: type
    output_type: type
    def execute(self, context: PipelineContext, input: Any) -> Any: ...
```

### 4.2 Phase Manifest (YAML)

Phase registration is data-driven, not code-driven:

```yaml
version: "1.0"
entries:
  - phase: 1
    name: Drawing Analysis
    input_type: DrawingMetadata
    output_type: DrawingMetadata
    depends_on: []
    cacheable: false
    parallel: false
  - phase: 2
    name: Geometry Foundation
    input_type: DrawingMetadata
    output_type: DefaultGeometryModel
    depends_on: [1]
    cacheable: true
    parallel: false
```

### 4.3 PhaseRegistry

```python
class PhaseRegistry:
    def register(self, phase_id: int, phase: SupportsPipelinePhase) -> None: ...
    def load_manifest(self, manifest: PhaseManifest) -> None: ...
    def load_manifest_file(self, path: Path) -> None: ...
    def get(self, phase_id: int) -> SupportsPipelinePhase | None: ...
    def all_sorted(self) -> list[tuple[int, SupportsPipelinePhase]]: ...
    def execute_pipeline(self, context: PipelineContext, initial_input: Any) -> Any: ...
```

### 4.4 Artifact Validators

External validation with strict/relaxed modes:

```python
class ArtifactValidator(ABC):
    mode: StrictValidationMode  # STRICT | RELAXED
    def validate(self, artifact: Any) -> list[str]: ...  # returns issue list
```

Concrete validators: `DrawingMetadataValidator`, `GeometryModelValidator`, `SemanticModelValidator`.

---

## 5. Recognition Store & Index

### 5.1 Design Principle

Evidence stored in `RecognitionStore` (with transactions), NOT in Graph. `RecognitionIndex` provides read-only queries over the store. `UnknownCandidate` stays in `SemanticModel`, NOT in ArchitectureGraph.

### 5.2 RecognitionEvidence

```python
@dataclass
class RecognitionEvidence:
    evidence_id: str
    object_id: str          # "Door:0056"
    candidate_id: str       # "candidate:0045"
    features_used: dict[str, float]
    pattern_scores: dict[str, float]
    inference_reason: str
    confidence: float
    created_at: float
```

### 5.3 RecognitionStore (ABC)

Transactional storage backend:

```python
class RecognitionStore(ABC):
    def begin(self) -> None: ...      # start transaction
    def save(self, evidence: RecognitionEvidence) -> None: ...
    def commit(self) -> None: ...     # persist transaction
    def rollback(self) -> None: ...  # discard uncommitted
    def get(self, evidence_id: str) -> RecognitionEvidence | None: ...
    def get_all(self) -> list[RecognitionEvidence]: ...
```

Implementation: `MemoryRecognitionStore` with snapshot-based transactions.

### 5.4 RecognitionIndex

Read-only query interface — consumers must call `refresh()` after store changes:

```python
class RecognitionIndex:
    def get_for_object(self, object_id: str) -> list[RecognitionEvidence]: ...
    def get_for_candidate(self, candidate_id: str) -> list[RecognitionEvidence]: ...
    def get_by_confidence_range(self, min_conf: float, max_conf: float) -> list[RecognitionEvidence]: ...
    def refresh(self) -> None: ...  # rebuild from store
```

---

## 6. Graph Query Service

### 6.1 Design Principle

`GraphQueryService` is **read-only** — it never mutates `ArchitectureGraph`. It is a separate class from ArchitectureGraph itself, providing a clean query interface for all consumers.

### 6.2 API

```python
class GraphQueryService:
    def __init__(self, graph: ArchitectureGraph, index: RecognitionIndex | None = None): ...
    # Node queries
    def get_node(self, node_id: str) -> Any: ...
    def find_rooms(self) -> list[Room]: ...
    def find_walls(self, room_id: str | None = None) -> list[Wall]: ...
    def find_openings(self, wall_id: str | None = None) -> list[Opening]: ...
    def find_by_type(self, type_name: str) -> list[Any]: ...
    def find_semantic_objects(self, semantic_type: str | None = None) -> list[SemanticObject]: ...
    def find_walls_by_direction(self, direction: str) -> list[Wall]: ...
    # Traversal
    def neighbors(self, node_id: str, edge_type: str | None = None) -> list[Any]: ...
    def children(self, parent_id: str) -> list[Any]: ...
    def shortest_path(self, from_id: str, to_id: str) -> list[str]: ...
    def subgraph(self, node_ids: set[str]) -> ArchitectureGraph: ...
    # Evidence (optional)
    def get_evidence(self, node_id: str) -> RecognitionEvidence | None: ...
    # Aggregates
    def count_by_type(self) -> dict[str, int]: ...
    def count_edges_by_type(self) -> dict[str, int]: ...
```

---

## 7. Application Spec Protocols

### 7.1 SupportsApplicationSpec

Structural subtyping via `typing.Protocol` (not ABC):

```python
@runtime_checkable
class SupportsApplicationSpec(Protocol):
    spec_type: str
    version: str
    created_at: float
    metadata: dict
    def validate(self) -> list[str]: ...
```

### 7.2 SupportsBuilder

```python
@runtime_checkable
class SupportsBuilder(Protocol):
    def build(self, graph: ArchitectureGraph, query: GraphQueryService,
              context: PipelineContext) -> SupportsApplicationSpec: ...
```

### 7.3 SupportsGraphMutation (M6+ stub)

```python
@runtime_checkable
class SupportsGraphMutation(Protocol):
    def mutate(self, graph: ArchitectureGraph, command: Any) -> ArchitectureGraph: ...
```

### 7.4 ElevationSpec Compliance

`ElevationSpec` now satisfies `SupportsApplicationSpec` Protocol:
- Added: `spec_type`, `version`, `created_at` fields (with backward-compatible defaults)
- Added: `.validate()` method (checks floor_height > 0, faces not empty)
- Updated: `to_dict()` / `from_dict()` for new fields

---

## 8. Ground Truth Evaluation

### 8.1 Design Principle

Ground Truth is **GT-centered** — it defines what the pipeline SHOULD produce, per-phase. Evaluation computes precision/recall/F1 per entity type. Not snapshot-based comparison.

### 8.2 Ground Truth Format

```json
{
  "drawing_id": "test_apt",
  "schema_version": "1.0",
  "phases": {
    "3": {
      "phase": 3,
      "name": "Semantic Reconstruction",
      "expected": {"wall": 12, "door": 6, "window": 8, "room": 8},
      "min_confidence": {"door": 0.8, "window": 0.7, "room": 0.85}
    }
  }
}
```

### 8.3 Evaluation Metrics

Per-entity-type: `expected`, `actual`, `true_positives`, `false_positives`, `false_negatives`, `precision`, `recall`, `f1`.

### 8.4 KPI Thresholds

| Entity Type | Metric | Threshold |
|-------------|--------|-----------|
| Wall | Recall | ≥ 98% |
| Door | Recall | ≥ 94% |
| Window | Recall | ≥ 91% |
| Room | Recall | ≥ 97% |
| All | Pattern Precision | ≥ 96% |

### 8.5 Regression Tracking

- Stable hash (`canonical JSON → SHA-256`) for artifact regression detection
- Baseline files committed to repo (`tests/test_data/*.baseline.json`)
- Structural check: zero actual against non-zero expected always fails

---

## 9. Implementation Milestones

### M1: Pipeline Artifacts ✓
- `src/cad_intelligence/pipeline/artifacts.py` — DrawingMetadata, DefaultGeometryModel, SemanticModel
- `src/cad_intelligence/pipeline/run.py` — PipelineRun, PhaseResult, PipelineContext, PipelineServices
- `src/cad_intelligence/pipeline/phases.py` — SupportsPipelinePhase, PhaseManifest, PhaseRegistry
- Tests: 41 tests (serialization, roundtrip, stable hash, frozen immutability, phase registry)

### M2: Artifact Validators ✓
- `src/cad_intelligence/pipeline/validation.py` — StrictValidationMode, ArtifactValidator ABC, 3 concrete validators
- `contracts/geometry.schema.json`, `contracts/semantic.schema.json` — JSON Schema
- Tests: 19 tests (strict/relaxed modes, Protocol satisfaction)

### M3: Recognition Store & Evidence ✓
- `src/cad_intelligence/graph/evidence.py` — RecognitionEvidence, UnknownCandidate, RecognitionStore ABC, MemoryRecognitionStore, RecognitionIndex
- `src/cad_intelligence/patterns/registry.py` — PatternRegistry (YAML + programmatic)
- Tests: 32 tests (CRUD, transactions, commit/rollback, index queries, pattern registry)

### M4: Graph Query Service & Application Spec ✓
- `src/cad_intelligence/graph/query_service.py` — GraphQueryService (read-only, 20+ query methods)
- `src/cad_intelligence/application/__init__.py` — SupportsApplicationSpec, SupportsBuilder, SupportsGraphMutation
- `src/cad_intelligence/graph/elevation_spec.py` — Updated ElevationSpec to satisfy Protocol
- Tests: 37 tests (node queries, traversal, subgraph, evidence lookup, read-only, Protocol satisfaction)

### M5: Ground Truth & KPI Regression ✓
- `src/cad_intelligence/pipeline/ground_truth.py` — GroundTruth, PhaseGroundTruth, EvaluationResult, TypeMetrics, KpiThresholds
- `tests/test_data/test_apt.ground_truth.json`, `tests/test_data/minimal.ground_truth.json` — sample fixtures
- `tests/test_ground_truth.py` — 42 tests (loading, evaluation, KPI thresholds, confidence filtering)
- `tests/test_regression.py` — 18 tests (stable hash determinism, regression baseline tracking, KPI regression)

### Test Summary

| Milestone | Tests | Status |
|-----------|-------|--------|
| M1 | 41 | ✓ All pass |
| M2 | 19 | ✓ All pass |
| M3 | 32 | ✓ All pass |
| M4 | 37 | ✓ All pass |
| M5 | 60 | ✓ All pass |
| **Total new** | **189** | **✓ All pass** |
| **Full regression** | **1291** | **✓ 1291 pass, 1 pre-existing flaky** |

---

## 10. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D35 | Artifacts carry only schema_version | Execution metadata (run_id, git_commit, tool_version) belongs in PipelineRun, not artifacts. Artifacts are pure data. |
| D36 | Evidence in RecognitionStore, not Graph | Store has transactions; Graph is structural. Evidence is append-only log, not graph topology. |
| D37 | UnknownCandidate in SemanticModel, not Graph | Graph represents resolved architecture; Unknown is a pipeline residual. Design decision D28 preserved. |
| D38 | GraphQueryService is separate class | Read-only query API as distinct class prevents accidental mutation. Clean separation of concerns. |
| D39 | SupportsApplicationSpec uses Protocol | Structural subtyping (typing.Protocol) over ABC. Duck typing — ElevationSpec satisfies without inheritance. |
| D40 | PipelineContext is minimal (run + services) | No God Object. Services container holds only logger, metrics, cache. EventBus deferred to M6. |
| D41 | Phase Manifest is YAML data-driven | New phases = YAML entry + handler class. No registry code changes for phase additions. |
| D42 | Ground Truth is GT-centered | Defines expected output, not current output. Per-phase precision/recall/F1 per entity type. |
| D43 | Stable hash for regression detection | Canonical JSON → SHA-256. Deterministic across runs. No floating-point comparison issues. |
| D44 | Zero-actual structural failure | If expected > 0 and actual = 0, always fails regardless of KPI thresholds. Safety net. |
| D45 | RecognitionStore transactions | begin/save/commit/rollback pattern for atomicity. Even MemoryStore implements snapshot-based transactions. |
| D46 | RecognitionIndex is read-only | Never mutates store. Consumers must call refresh() after store changes. Eventual consistency model. |

---

## 11. Acceptance Criteria

- [x] Pipeline artifacts (DrawingMetadata, GeometryModel, SemanticModel) — frozen, versioned, serializable
- [x] PipelineRun with execution metadata (run_id, random_seed, git_commit, tool_version, config with feature_flags)
- [x] PipelineContext (minimal: run + services container)
- [x] Phase plugin system with YAML manifest and PhaseRegistry
- [x] Artifact validators with strict/relaxed modes + JSON Schema contracts
- [x] RecognitionStore with transactional support (begin/save/commit/rollback)
- [x] RecognitionIndex (read-only query over store)
- [x] GraphQueryService (read-only, separated from ArchitectureGraph)
- [x] SupportsApplicationSpec Protocol (structural subtyping)
- [x] SupportsBuilder Protocol
- [x] SupportsGraphMutation Protocol (M6+ stub)
- [x] ElevationSpec satisfies SupportsApplicationSpec
- [x] Ground Truth framework with per-phase precision/recall/F1
- [x] KPI thresholds (Wall 98%, Door 94%, Window 91%, Room 97%, Pattern 96%)
- [x] Regression tracking with stable hash baselines
- [x] 189 new tests, all passing
- [x] Full regression: 1291 existing tests, no regressions

---

## 12. Out of Scope

1. **Pipeline executor** — PhaseRegistry.execute_pipeline() is a simple sequential loop. Parallel execution (phase 5/6), DAG scheduling, and retry logic deferred.
2. **Persistent RecognitionStore** — Currently MemoryRecognitionStore only. SQLite/File-backed store for production deferred.
3. **Ground truth from real DWG** — Fixtures are synthetic. Human-counted ground truth from actual test drawings (per ELEV-002 convention) deferred.
4. **EventBus** — Deferred to M6 per ADR-008 §3. PipelineServices uses null-safe pattern.
5. **Builder Registry** — PatternRegistry exists for patterns. Application builder registration deferred.
6. **Ontology Layer** — ADR-005 §7 conceptual only. Not implemented.

---

## 13. Related

- [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) — Pipeline & Artifact Architecture (phase contracts, domain namespaces, manifest)
- [`ADR-005`](ADR-005-architecture-graph-schema.md) — Architecture Graph Schema (node/edge schema, evidence, unknown objects)
- [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) — Pattern DSL & Recognition Engine (pattern matching, inference)
- [`ADR-007`](ADR-007-appspec-rendering-architecture.md) — ApplicationSpec & Rendering (ElevationSpec, ApplicationBuilder)
- [`ADR-008`](ADR-008-command-versioning-editing.md) — Command / Versioning / Editing (EventBus, artifact versioning)
