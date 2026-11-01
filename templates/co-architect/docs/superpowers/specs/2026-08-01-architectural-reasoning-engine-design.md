# Architectural Reasoning Engine Platform — Design Spec

> **Spec ID**: `DESIGN-2026-08-01-ARCHITECTURAL-REASONING-ENGINE`  
> **Status**: Approved & Finalized (user, 2026-08-01)  
> **Created**: 2026-08-01  
> **Updated**: 2026-08-01 (v2.0: Feature Lineage, Knowledge Plugins, Snapshot Replay, Solver Registry, ReasoningConfig)  
> **Authors**: PM, Architect  
> **Related ADRs**: `ADR-004` (Pipeline Update), `ADR-005` (Evidence & Feature Layer), `ADR-006` (Reasoning Engine Abstraction), `ADR-007` (Explainability & Traceability)

---

## 1. Executive Summary & Architectural Paradigm Shift

The `co-architect` CAD Intelligence engine is transitioning from a **Geometry-centric pipeline** (where geometric algorithms made direct boolean decisions) to an **Architectural Reasoning Platform**.

In this new paradigm:
1. **Geometry produces Evidence ONLY**: Geometric algorithms are demoted to score-emitting Evidence Generators.
2. **Feature Store is a Versioned Graph**: Features carry lineage (`version`, `parent_ids`) as they evolve (`Primitive` ➔ `Centerline` ➔ `Merged Centerline` ➔ `Wall Segment`).
3. **Knowledge Base is a Plugin Architecture**: Domain knowledge (`apartment_kr`, `office`, `bim`, `layer_rules`) is pluggable and loaded before Evidence generation.
4. **Objective Function is Pure & Stateless**: Solvers optimize a global objective energy landscape without stateful side-effects.
5. **Reasoning outputs Replayable Immutable Artifacts**: Every inference run produces a fully reproducible, replayable snapshot (`ReasoningResult`) with visualization artifacts (`graph.svg`, `graph.dot`, `geojson`, `events.jsonl`).

---

## 2. Explicit Non-Goals (Architecture Boundaries & Strict Bans)

* **NG1**: The Reasoner MUST NOT modify the Geometry Engine or raw DWG primitives.
* **NG2**: Solvers MUST NOT generate Evidence directly.
* **NG3**: Evidence Generators MUST NOT mutate CAD Geometry.
* **NG4**: Objective Functions MUST NOT depend on specific Solver implementations and MUST remain 100% pure/stateless.
* **NG5**: Solvers MUST NOT invoke CAD COM APIs (`pywin32` / ZWCAD COM) directly under any circumstances.
* **NG6**: `ArchitectureGraph` (Domain IR) MUST NOT carry Solver-specific implementation details.

---

## 3. High-Level System Architecture & Data Flow

```
                             ReasoningConfig
       (solver="factor_graph", knowledge_profile="apartment_kr", seed=42)
                                       │
                                       ▼
                     Geometry Engine (COM / Vector Scans)
                                       │
                                       ▼
             Phase 2: Versioned Geometry Feature Store (Graph)
         (Feature ID, Version, Parent IDs, Segment, Centerline, Loop)
                                       │
                                       ▼
                            Knowledge Base Plugins
            (apartment_kr, office, bim, iso, client_rules, layer_rules)
                                       │
                                       ▼
                              Evidence Generators
                  (Pair Merge, Opening Synth, Topology, Layer Role)
                                       │
                                       ▼
                     Phase 3A: Evidence Repository
                     (FeatureID-anchored Confidence Distributions)
                                       │
                                       ▼
                             Hypothesis Generator
                     (Wall, Room, Opening Candidate Hypotheses)
                                       │
                                       ▼
                              Constraint Builder
                        (Hard / Soft / Preference Rules)
                                       │
                                       ▼
                    Phase 3B: Stateless Objective Function
                    (Energy Landscape & Penalty Terms)
                                       │
                                       ▼
                Reasoning Engine Strategy (Solver Registry)
     ├── Lifecycle: prepare() ➔ optimize() ➔ explain() ➔ diagnostics()
     ├── [Primary] FactorGraphSolver (Max-Product / Global Energy Optimization)
     ├── [Baseline] WeightedLinearSolver
     ├── [Constraint] Z3SMTSolver
     ├── [Linear] ILPSolver
     └── [AI] GNNClassifierSolver
                                       │
                                       ▼
            Phase 4: ReasoningResult Artifact & Replay System
     ├── graph.json          (ArchitectureGraph IR)
     ├── evidences.json      (Raw Evidence Repository)
     ├── hypotheses.json     (Generated Hypotheses)
     ├── objective.json      (Objective Terms & Weights)
     ├── solver.json         (Solver Metadata & Execution State)
     ├── trace.json          (Step-by-step Reasoning Trajectory)
     ├── events.jsonl        (Fine-grained Event Stream)
     ├── diagnostics.json    (Warnings & Exceptions)
     ├── explanation.md      (Human & LLM Explainability Report)
     ├── graph.dot           (GraphViz visualization format)
     ├── graph.svg           (Rendered SVG visualization)
     └── candidates.geojson  (GIS/VSCode spatial overlay)
```

---

## 4. Layer Specifications

### 4.1. Versioned Geometry Feature Store & Lineage

`VersionedGeometryFeature` tracks lineage as features evolve across pipeline stages:

```python
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any

class FeatureType(Enum):
    SEGMENT = auto()
    CENTERLINE = auto()
    MERGED_CENTERLINE = auto()
    WALL_SEGMENT = auto()
    LOOP = auto()
    JUNCTION = auto()
    OPENING_SLOT = auto()
    TEXT_ANCHOR = auto()

@dataclass(frozen=True)
class VersionedGeometryFeature:
    feature_id: str
    feature_type: FeatureType
    version: int
    parent_ids: tuple[str, ...]          # Lineage tracking
    geometry_data: dict[str, Any]

@dataclass(frozen=True)
class Evidence:
    evidence_id: str
    evidence_type: str
    supports_feature_ids: tuple[str, ...]  # Refers to VersionedGeometryFeature IDs
    confidence_mean: float               # Gaussian/Beta mean (0.0 to 1.0)
    confidence_sigma: float              # Standard deviation
    metadata: dict[str, Any] = field(default_factory=dict)
```

### 4.2. Knowledge Base Plugin Architecture

Knowledge Base modules live in `src/cad_intelligence/reasoning/knowledge/`:

```python
class KnowledgePlugin(Protocol):
    @property
    def profile_name(self) -> str: ...
    def get_wall_thickness_standards(self) -> list[float]: ...
    def get_space_grammar_rules(self) -> dict[str, Any]: ...
    def get_layer_role_rules(self, drawing_id: str) -> dict[str, str]: ...

class KnowledgeRegistry:
    """Registry for loading profiles (e.g. 'apartment_kr', 'office', 'bim')."""
    def register(self, plugin: KnowledgePlugin) -> None: ...
    def get(self, profile_name: str) -> KnowledgePlugin: ...
```

### 4.3. Stateless Objective Function & ReasoningContext

`ReasoningContext` encapsulates state; `ObjectiveFunction` is pure and stateless:

```python
@dataclass
class ReasoningContext:
    config: "ReasoningConfig"
    feature_store: "VersionedGeometryFeatureStore"
    knowledge_profile: KnowledgePlugin
    evidences: list[Evidence]
    hypotheses: list["Hypothesis"]
    constraints: list["Constraint"]

class ObjectiveFunction(Protocol):
    def evaluate(self, ctx: ReasoningContext) -> float:
        """Pure function computing scalar energy score for current hypothesis state in ctx."""
        ...
```

### 4.4. Deterministic Solver Protocol & SolverRegistry

```python
class Solver(Protocol):
    def prepare(self, ctx: ReasoningContext, objective: ObjectiveFunction) -> None: ...
    def optimize(self) -> list["Hypothesis"]: ...
    def explain(self) -> dict[str, str]: ...
    def diagnostics(self) -> list[dict[str, Any]]: ...

class SolverRegistry:
    def register(self, name: str, solver_cls: type[Solver]) -> None: ...
    def get(self, name: str) -> Solver: ...
```

### 4.5. Replayable Snapshot System & Visualization

The `SnapshotImporter` allows any past run to be replayed deterministically:

```python
class ReasoningResultSnapshot:
    def export(self, ctx: ReasoningContext, result: "ReasoningResult") -> str: ...

class SnapshotImporter:
    def load(self, snapshot_dir: str) -> ReasoningContext: ...
    def replay(self, snapshot_dir: str) -> "ReasoningResult": ...
```

### 4.6. Evidence Generation Layer (as-built, 2026-08-01)

The design above (§4.1–4.5) described the target data model; it did not specify how raw geometry becomes `Evidence`. As-built, this is a dedicated module, `reasoning/evidence_generators.py`, of pure mapping functions — no geometry algorithm lives here, only already-computed outputs from `features/geometry.py`, `features/topology.py`, and `geometry/space_geometry.py` mapped onto `Evidence`:

```python
def generate_component_evidence(component_id: str, feature_ids: tuple[str, ...], features: ComponentFeatures) -> list[Evidence]:
    """CLOSED_LOOP, PARALLEL_LINES, PAIR_MERGE, TOPOLOGY — all four read off
    ONE compute_component_features() call (never recomputed per type)."""

def generate_layer_role_evidence(features: list[VersionedGeometryFeature], knowledge_profile: SupportsKnowledgePlugin) -> list[Evidence]:
    """LAYER_ROLE — via knowledge_profile.get_layer_role_rules() exact match."""

def generate_containment_evidence(component_polygons: dict[str, list[Polygon]], point_features: list[VersionedGeometryFeature]) -> list[Evidence]:
    """CONTAINMENT — polygon.buffer(1.0mm).contains(point); the 1mm buffer
    tolerates a point sitting exactly on a wall centerline (CAD boundary case)."""

def generate_clearance_evidence(point_features, line_features, threshold_mm: float = 900.0) -> list[Evidence]:
    """CLEARANCE — a constraint-VIOLATION signal, not a positive score:
    confidence_mean = max(0, 1 - distance/threshold_mm)."""

def generate_opening_synth_evidence(shapely_lines, doors: list[DoorEntity], windows: list[WindowEntity], feature_store) -> list[Evidence]:
    """OPENING_SYNTH — reuses geometry/space_geometry.py's
    find_wall_discontinuities() unmodified; adds FeatureType.OPENING_SLOT
    features to feature_store as a side effect for later HypothesisGenerator use."""
```

Real connected-component partitioning (feeding `generate_component_evidence`'s `component_id`/`feature_ids`) reuses `graph/primitive_graph.py`'s existing `build_primitive_graph()` (endpoint-coincidence + bbox-containment edges) and `extract_connected_components()` (BFS) — no new graph-construction code. Component ids are derived deterministically as `"component_" + min(feature_ids)`, never from BFS/iteration order, so `ModularReasoningPipeline.replay()` and repeated `run()`s over identical input produce identical `evidence_id` sets (verified by `test_evidence_ids_are_deterministic`/`test_evidence_count_is_stable` in `tests/test_reasoning_pipeline_modular.py`).

`ModularReasoningPipeline._build_evidence_repository()` is pure orchestration over these five functions — it partitions components, calls `compute_component_features()` once per component, and dispatches to each generator; it contains no polygon/distance/layer-rule logic itself.

**Deferred**: `FactorGraphSolver` (§4.4's Max-Product solver) was never implemented — `BaselineLinearSolver` (deterministic threshold accept/reject) is the only registered solver as of this writing.

---

## 5. ADR Structure Alignment

1. **`ADR-004` (Pipeline Architecture Update)**: Incorporates Versioned Feature Store, Knowledge Plugins, and Phase 3A/3B pipeline.
2. **`ADR-005` (Evidence & Feature Layer)**: Defines `VersionedGeometryFeatureStore`, `EvidenceRepository`, and `KnowledgeRegistry`.
3. **`ADR-006` (Reasoning Engine & Objective Abstraction)**: Defines stateless `ObjectiveFunction`, `SolverRegistry`, and Solver lifecycle interface.
4. **`ADR-007` (Explainability & Traceability Engine)**: Defines `ReasoningResult` snapshot replay system, `events.jsonl`, and `graph.svg`/`geojson` visualizers.
