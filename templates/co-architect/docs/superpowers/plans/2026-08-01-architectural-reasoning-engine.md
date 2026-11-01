# Architectural Reasoning Engine Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Architectural Reasoning Engine Platform in `src/cad_intelligence/reasoning/`, separating Geometry into Versioned Feature Graphs and Evidence Generators, adding Knowledge Plugins, FactorGraph optimization, and replayable `ReasoningResult` immutable snapshot artifacts.

**Architecture:** Pipeline flow: `ReasoningConfig` ➔ `VersionedGeometryFeatureStore` ➔ `KnowledgeRegistry` ➔ `EvidenceRepository` ➔ `HypothesisGenerator` ➔ `ReasoningContext` ➔ `ConstraintBuilder` ➔ Stateless `ObjectiveFunction` ➔ `SolverRegistry` (`FactorGraphSolver`) ➔ Replayable `ReasoningResult` (Snapshot directory with `graph.json`, `events.jsonl`, `graph.svg`, `candidates.geojson`).

**Tech Stack:** Python 3.13, Dataclasses, Protocol, NumPy/Shapely, Pytest.

---

## File Structure & Dependencies

```
src/cad_intelligence/reasoning/
├── __init__.py                # Package exports
├── config.py                  # ReasoningConfig dataclass (solver, profile, seed, snapshot, trace)
├── features.py                # VersionedGeometryFeatureStore & Lineage tracking
├── evidence.py                # Evidence & EvidenceRepository dataclasses (confidence_mean/sigma)
├── knowledge/                 # Knowledge Plugin directory
│   ├── __init__.py
│   ├── base.py                # KnowledgePlugin Protocol & KnowledgeRegistry
│   ├── apartment_kr.py        # Korean apartment design rules & wall thickness standards
│   └── office.py             # Commercial office building rules
├── hypothesis.py              # Hypothesis & HypothesisGenerator
├── context.py                 # ReasoningContext dataclass
├── constraints.py             # Constraint, ConstraintTier (HARD, SOFT, PREFERENCE), ConstraintBuilder
├── objective.py               # Pure/Stateless ObjectiveFunction Protocol & ArchitecturalEnergyObjective
├── solver.py                  # Solver Protocol & SolverRegistry
├── solvers/
│   ├── __init__.py
│   ├── factor_graph.py        # FactorGraphSolver (Max-Product Energy Optimization)
│   └── weighted.py            # WeightedLinearSolver baseline
├── snapshot.py                # ReasoningResultSnapshot Exporter & SnapshotImporter (Replay system)
├── visualization.py           # Snapshot visualizer (graph.dot, graph.svg, candidates.geojson)
└── pipeline.py                # ArchitecturalReasoningPipeline orchestrator & Replay entrypoint
```

---

## Tasks

### Task 0: ReasoningConfig Configuration Model

**Files:**
- Create: `src/cad_intelligence/reasoning/config.py`
- Test: `tests/test_reasoning_config.py`

- [ ] **Step 1: Write failing test for ReasoningConfig**

```python
# tests/test_reasoning_config.py
from cad_intelligence.reasoning.config import ReasoningConfig

def test_reasoning_config_defaults():
    cfg = ReasoningConfig()
    assert cfg.solver == "factor_graph"
    assert cfg.knowledge_profile == "apartment_kr"
    assert cfg.random_seed == 42
    assert cfg.snapshot is True
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_config.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement ReasoningConfig**

Implement `src/cad_intelligence/reasoning/config.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_config.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 1: VersionedGeometryFeatureStore & Lineage Tracking

**Files:**
- Create: `src/cad_intelligence/reasoning/features.py`
- Create: `src/cad_intelligence/reasoning/evidence.py`
- Test: `tests/test_reasoning_features.py`

- [ ] **Step 1: Write failing test for VersionedGeometryFeature lineage and Evidence**

```python
# tests/test_reasoning_features.py
from cad_intelligence.reasoning.features import VersionedGeometryFeature, FeatureType, VersionedGeometryFeatureStore
from cad_intelligence.reasoning.evidence import Evidence, EvidenceType, EvidenceRepository

def test_feature_lineage_and_versioning():
    store = VersionedGeometryFeatureStore()
    f1 = VersionedGeometryFeature(feature_id="f1", feature_type=FeatureType.SEGMENT, version=1, parent_ids=(), geometry_data={})
    store.add(f1)
    
    # Evolve feature
    f2 = VersionedGeometryFeature(feature_id="f2", feature_type=FeatureType.CENTERLINE, version=2, parent_ids=("f1",), geometry_data={})
    store.add(f2)
    
    assert store.get_lineage("f2") == [f2, f1]
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_features.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement VersionedGeometryFeatureStore and EvidenceRepository**

Implement `features.py` and `evidence.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_features.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 2: Knowledge Plugin Architecture & Profiles

**Files:**
- Create: `src/cad_intelligence/reasoning/knowledge/base.py`
- Create: `src/cad_intelligence/reasoning/knowledge/apartment_kr.py`
- Test: `tests/test_reasoning_knowledge.py`

- [ ] **Step 1: Write failing test for KnowledgeRegistry and apartment_kr plugin**

```python
# tests/test_reasoning_knowledge.py
from cad_intelligence.reasoning.knowledge.base import KnowledgeRegistry
from cad_intelligence.reasoning.knowledge.apartment_kr import KoreanApartmentKnowledgePlugin

def test_knowledge_registry():
    reg = KnowledgeRegistry()
    plugin = KoreanApartmentKnowledgePlugin()
    reg.register(plugin)
    
    loaded = reg.get("apartment_kr")
    assert 150.0 in loaded.get_wall_thickness_standards()
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_knowledge.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement KnowledgeRegistry and KoreanApartmentKnowledgePlugin**

Implement `knowledge/base.py` and `knowledge/apartment_kr.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_knowledge.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 3: HypothesisGenerator & ReasoningContext

**Files:**
- Create: `src/cad_intelligence/reasoning/hypothesis.py`
- Create: `src/cad_intelligence/reasoning/context.py`
- Test: `tests/test_reasoning_context.py`

- [ ] **Step 1: Write failing test for ReasoningContext**

```python
# tests/test_reasoning_context.py
from cad_intelligence.reasoning.context import ReasoningContext
from cad_intelligence.reasoning.config import ReasoningConfig

def test_reasoning_context_creation():
    ctx = ReasoningContext(config=ReasoningConfig())
    assert ctx.config.solver == "factor_graph"
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_context.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement hypothesis.py and context.py**

Implement `hypothesis.py` and `context.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_context.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 4: ConstraintTier & Stateless ObjectiveFunction

**Files:**
- Create: `src/cad_intelligence/reasoning/constraints.py`
- Create: `src/cad_intelligence/reasoning/objective.py`
- Test: `tests/test_reasoning_objective.py`

- [ ] **Step 1: Write failing test for pure/stateless ArchitecturalEnergyObjective**

```python
# tests/test_reasoning_objective.py
from cad_intelligence.reasoning.objective import ArchitecturalEnergyObjective
from cad_intelligence.reasoning.context import ReasoningContext
from cad_intelligence.reasoning.config import ReasoningConfig

def test_stateless_objective_evaluation():
    obj = ArchitecturalEnergyObjective()
    ctx = ReasoningContext(config=ReasoningConfig())
    score1 = obj.evaluate(ctx)
    score2 = obj.evaluate(ctx)
    assert score1 == score2  # Pure function requirement
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_objective.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement constraints.py and objective.py**

Implement `constraints.py` and `objective.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_objective.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 5: SolverRegistry & FactorGraphSolver Strategy

**Files:**
- Create: `src/cad_intelligence/reasoning/solver.py`
- Create: `src/cad_intelligence/reasoning/solvers/factor_graph.py`
- Create: `src/cad_intelligence/reasoning/solvers/weighted.py`
- Test: `tests/test_reasoning_solver.py`

- [ ] **Step 1: Write failing test for SolverRegistry and FactorGraphSolver lifecycle**

```python
# tests/test_reasoning_solver.py
from cad_intelligence.reasoning.solver import SolverRegistry
from cad_intelligence.reasoning.solvers.factor_graph import FactorGraphSolver

def test_solver_registry_and_lifecycle():
    reg = SolverRegistry()
    reg.register("factor_graph", FactorGraphSolver)
    
    solver = reg.get("factor_graph")
    assert solver is not None
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_solver.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement SolverRegistry and FactorGraphSolver**

Implement `solver.py`, `solvers/factor_graph.py`, `solvers/weighted.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_solver.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 6: Replayable Snapshot & Visualization Exporters

**Files:**
- Create: `src/cad_intelligence/reasoning/snapshot.py`
- Create: `src/cad_intelligence/reasoning/visualization.py`
- Test: `tests/test_reasoning_snapshot.py`

- [ ] **Step 1: Write failing test for Snapshot Export, Import, and Replay**

```python
# tests/test_reasoning_snapshot.py
from cad_intelligence.reasoning.snapshot import ReasoningResultSnapshot, SnapshotImporter

def test_snapshot_export_and_replay(tmp_path):
    out_dir = tmp_path / "snapshot_01"
    snapshot = ReasoningResultSnapshot(snapshot_dir=str(out_dir))
    snapshot.export(...)
    
    importer = SnapshotImporter()
    replayed_ctx = importer.load(str(out_dir))
    assert replayed_ctx is not None
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_snapshot.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement snapshot.py and visualization.py**

Implement `snapshot.py` and `visualization.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_snapshot.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

### Task 7: Architectural Reasoning Pipeline Orchestrator & End-to-End Replay Integration

**Files:**
- Create: `src/cad_intelligence/reasoning/pipeline.py`
- Test: `tests/test_reasoning_pipeline.py`

- [ ] **Step 1: Write failing end-to-end and replay pipeline test**

```python
# tests/test_reasoning_pipeline.py
from cad_intelligence.reasoning.pipeline import ArchitecturalReasoningPipeline

def test_pipeline_execution_and_replay(tmp_path):
    pipeline = ArchitecturalReasoningPipeline(snapshot_base_dir=str(tmp_path))
    result = pipeline.run(...)
    
    # Test Replay capability
    replayed_result = pipeline.replay(result.snapshot_dir)
    assert replayed_result.overall_confidence == result.overall_confidence
```

- [ ] **Step 2: Run pytest to verify failure**

Run: `pytest tests/test_reasoning_pipeline.py -v`  
Expected: FAIL

- [ ] **Step 3: Implement ArchitecturalReasoningPipeline**

Implement `pipeline.py`.

- [ ] **Step 4: Run pytest to verify pass**

Run: `pytest tests/test_reasoning_pipeline.py -v`  
Expected: PASS

- [ ] **Step 5: Commit**

---

## Implementation Note (2026-08-01) — actual delivery vs. this plan

Tasks 0–2 (`config.py`, `features.py`/`evidence.py`, `knowledge/`) and Tasks 6–7 (`snapshot.py`, `visualization.py`, `pipeline.py`) were delivered exactly as scoped above, plus `constraints.py` — but Tasks 3–5 landed differently than originally drafted:

- **Task 3** (`hypothesis.py`, `context.py` hypotheses field): delivered as planned — `HypothesisGenerator` derives `possible_room`/`possible_wall` hypotheses from `EvidenceRepository`, grouped by feature + evidence type.
- **Task 4** (`objective.py`): delivered as planned — `ArchitecturalEnergyObjective` is a frozen, stateless `evaluate(ctx) -> float`.
- **Task 5** (`solver.py`): delivered as `SupportsSolver` (4-method lifecycle: `prepare`/`optimize`/`explain`/`diagnostics`) + `BaselineLinearSolver` under `solvers/baseline_linear.py`, **not** `FactorGraphSolver`/`weighted.py` as originally sketched — `BaselineLinearSolver` is the reference implementation; a Max-Product `FactorGraphSolver` remains unimplemented and is a candidate follow-up.
- **Task 7** (pipeline integration): rather than modifying `pipeline.py` in place (which carries a verified 100% deterministic replay guarantee — see `tests/test_reasoning_pipeline.py`), a new parallel entrypoint `pipeline_modular.py` (`ModularReasoningPipeline`) was added. It wires the full modular stack end-to-end and reuses the **unmodified** `ReasoningResultSnapshot`/`SnapshotVisualizer` via adapter functions that translate the new frozen dataclasses into the legacy `models.py` shapes at the export boundary. `pipeline.py`'s `replay()` is untouched.

**Post-Task-7 follow-up (2026-08-01, same day)** — three further increments landed on top of the above, none of which were in the original Task 0–7 scope:

1. **`ModularReasoningPipeline.replay(snapshot_dir)`** — added to close the parity gap with legacy `pipeline.py.replay()`. Reconstitutes modular `Hypothesis`/`Constraint` from a legacy on-disk snapshot via new reverse-adapter functions (`_from_legacy_hypothesis`, `_from_legacy_constraint`), re-runs `BaselineLinearSolver`, and raises `ValueError` on confidence (tol 1e-6) or graph-edge-count mismatch — the same contract as legacy `replay()`.
2. **Geometry-driven CLOSED_LOOP/PARALLEL_LINES evidence** — `_build_evidence_repository` was rewritten to call `features/geometry.py`'s `compute_component_features()` (real `shapely.ops.polygonize_full` loop closure + `compute_parallel_ratio()`) instead of the hardcoded 0.9/0.7 demo evidence originally shipped with Task 7. `raw_lines` entries gained `start`/`end` coordinate fields to make this possible.
3. **All remaining `EvidenceType` members + real connected-component partitioning** — a new module `reasoning/evidence_generators.py` (not in the original file-structure sketch above) holds one pure mapping function per evidence family:
   - `generate_component_evidence()` — CLOSED_LOOP, PARALLEL_LINES, PAIR_MERGE, TOPOLOGY, all derived from a single `compute_component_features()` call per component (never recomputed per-type).
   - `generate_layer_role_evidence()` — LAYER_ROLE, via `SupportsKnowledgePlugin.get_layer_role_rules()`.
   - `generate_containment_evidence()` — CONTAINMENT, via `shapely.ops.polygonize_full` + `polygon.buffer(1mm).contains(point)` (CAD boundary tolerance).
   - `generate_clearance_evidence()` — CLEARANCE, via `shapely` `.distance()`; confidence is a **violation** signal (`max(0, 1 - distance/threshold)`), not a positive-evidence score.
   - `generate_opening_synth_evidence()` — OPENING_SYNTH, reusing `geometry/space_geometry.py`'s `find_wall_discontinuities()` as-is (not reimplemented), adapting point-shaped features into `DoorEntity`/`WindowEntity`; adds `FeatureType.OPENING_SLOT` features to the store as a side effect.

   `pipeline_modular.py`'s `_build_evidence_repository` now calls `graph/primitive_graph.py`'s `build_primitive_graph()`/`extract_connected_components()` for real BFS-based component partitioning (replacing the earlier single-"component_all" simplification), with deterministic `component_<min(feature_id)>` ids (not BFS-order-dependent) and evidence ids following a `{component_id}:{type}:{index}` / `layer_role:{layer}` / `clearance:{point}:{line}` naming convention. `_build_feature_store` now also accepts point-shaped entities (`position` field — door/window blocks) alongside line-shaped ones.

Still open / explicitly deferred: a Max-Product `FactorGraphSolver` (Task 5's original target) remains unimplemented — `BaselineLinearSolver` is still the only registered solver. Connected-component detection uses `graph/primitive_graph.py`'s existing endpoint-coincidence + bbox-containment edges as-is; no new spatial-relationship types were added.

Final count: 106/106 `tests/test_reasoning_*.py` pass (52 original + 54 added across all Task-3-7 and post-Task-7 increments: `test_reasoning_hypothesis.py`, `test_reasoning_objective.py`, `test_reasoning_solver.py`, `test_reasoning_pipeline_modular.py`, `test_reasoning_evidence_generators.py`, plus `context.py` hypotheses-field tests). See `docs/reference/cad-intelligence-status.md`'s Reasoning Engine row for the current state summary.
