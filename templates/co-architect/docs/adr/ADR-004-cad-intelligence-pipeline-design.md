# ADR-004: CAD Intelligence Pipeline & Artifact Architecture

> **Spec ID**: ADR-004
> **Version**: 3.1 (design + execution framework — ADR-009 M1–M5 implemented)
> **Status**: Phase A–C implemented; Phase D design complete; Phase E design approved; ADR-009 M1–M5 implemented
> **Created**: 2026-07-05
> **Updated**: 2026-07-05
> **Authors**: architect
> **Source**: User-approved pipeline architecture for object recognition, parameter extraction, and elevation generation. v3.0 restructures the 11-stage linear pipeline into a responsibility-centered 6-Phase model with architecture principles and artifact contracts. Platform architecture details split into focused ADRs (ADR-005 through ADR-008).
> **Supersedes**: ADR-004 v2.0 (Phase D platform architecture — content split into ADR-005~008)
> **Related**: [`ADR-001-architecture-graph.md`](ADR-001-architecture-graph.md) (Architecture Graph IR principle), [`ADR-005`](ADR-005-architecture-graph-schema.md) (Graph Schema), [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) (Pattern DSL & Recognition Engine), [`ADR-007`](ADR-007-appspec-rendering-architecture.md) (ApplicationSpec & Rendering), [`ADR-008`](ADR-008-command-versioning-editing.md) (Command / Versioning / Editing), [`AI-003-v1-to-v3-migration-design.md`](../designs/AI-003-v1-to-v3-migration-design.md) (V3 migration), [`PKG-001-cad-intelligence-restructure-design.md`](../designs/PKG-001-cad-intelligence-restructure-design.md) (package structure), [`AXIS-001-design.md`](../designs/AXIS-001-design.md) (opening candidate/assignment pipeline), [`ELEV-002-design.md`](../designs/ELEV-002-design.md) (wall-centric model and elevation generation), [`memory/archive/roadmap-architecture-graph.md`](../../memory/archive/roadmap-architecture-graph.md) (authoritative roadmap source)

---

## 1. Overview

This ADR defines the **6-Phase CAD Intelligence Pipeline** — the end-to-end flow from raw DWG drawing to rendered output (DWG/SVG/IFC). Each Phase has a clear responsibility, defined input/output artifact contracts, and a cacheable boundary.

The pipeline was originally designed as an 11-stage linear chain (v1.0–v2.0). Phase E (v3.0) restructures it into **responsibility-centered phases** with architecture principles that make the pipeline a long-term maintainable platform, not just an implementation plan.

**ADR Split (v3.0)**: Platform architecture details previously in this document have been split into focused ADRs:
- **ADR-005** — Architecture Graph Schema (node/edge types, query API, evidence, coordinates)
- **ADR-006** — Pattern DSL & Recognition Engine (candidates, patterns, inference, relationship rules)
- **ADR-007** — ApplicationSpec & Rendering Architecture (ApplicationBuilder, ElevationSpec, Renderer)
- **ADR-008** — Command / Versioning / Editing Model (mutations, undo, EventBus, artifact versioning)

This ADR retains the pipeline structure, artifact contracts, architecture principles, domain namespaces, and pipeline manifest — the cross-cutting concerns that tie the system together.

---

## 2. 6-Phase Pipeline

```
DWG
  → Phase 1: Drawing Analysis          → DrawingMetadata
  → Phase 2: Geometry Foundation        → GeometryModel
  → Phase 3: Semantic Reconstruction    → SemanticModel
  → Phase 4: Domain Model               → ArchitectureGraph
  → Phase 5: Application Pipeline       → ApplicationSpec
  → Phase 6: Rendering                  → DWG / IFC / SVG / PDF
```

### Phase Table

| Phase | Name | Input | Output | Status | Cacheable |
|-------|------|-------|--------|--------|-----------|
| 1 | Drawing Analysis | DWG file | DrawingMetadata | ✅ Implemented | ✗ |
| 2 | Geometry Foundation | DrawingMetadata | GeometryModel | ✅ Implemented | ✓ |
| 3 | Semantic Reconstruction | GeometryModel | SemanticModel | ✅ Implemented | ✓ |
| 4 | Domain Model | SemanticModel | ArchitectureGraph | ✅ Implemented | ✓ |
| 5 | Application Pipeline | ArchitectureGraph | ApplicationSpec | 🔨 Phase D design | ✓ |
| 6 | Rendering | ApplicationSpec | DWG / IFC / SVG / PDF | 🔨 Phase D design | ✗ |

### Phase Responsibilities

**Phase 1 — Drawing Analysis**: Extract drawing-level metadata from DWG via COM. Layer names, units, scale, UCS, block table, text styles. Does NOT extract geometry — only the metadata needed to interpret it.

**Phase 2 — Geometry Foundation**: Convert DWG primitives into structured geometry. Primitive extraction (COM scan), connected components (BFS grouping), feature extraction (per-component geometry/topology/metadata). Output: `GeometryModel` = PrimitiveGraph + ConnectedComponents + FeatureStore. **Geometry Layer is independent of Semantic Layer** (AP1) — no semantic types, no classification, no relationships.

**Phase 3 — Semantic Reconstruction**: Convert geometry features into typed semantic objects. Object Candidate Layer → Pattern Engine → Inference Engine → Semantic Objects with parameters. See **ADR-006** for full specification.

**Phase 4 — Domain Model**: Build the ArchitectureGraph from semantic objects. Relationship Builder adds semantic edges (HOSTS, BOUNDED_BY, ACCESSED_BY, etc.). SpatialIndex constructed. Graph is the single source of truth — no separate WallModel. See **ADR-005** for full specification.

**Phase 5 — Application Pipeline**: Transform ArchitectureGraph into task-specific outputs. Two parallel paths:
  - **Path A**: ApplicationBuilder (ABC) → ApplicationSpec (ElevationSpec / SectionSpec / IFCSpec / ValidationSpec). ConstraintEngine validates before rendering. See **ADR-007** for full specification.
  - **Path B**: FacadePipeline → [BuildingAssembler] → FacadeExporter → OBJ/DAE mesh files. Produces 3D exterior facade geometry directly (no ApplicationSpec). Multi-floor assembly via optional BuildingConfig. See **FACADE-001** (single-floor) and **FACADE-002** (multi-floor) for full specification.

**Phase 6 — Rendering**: Convert ApplicationSpec into format-specific output. Renderer (read-only) → DWGAdapter / SVGAdapter / DXFAdapter / PDFAdapter. See **ADR-007 §7** for full specification.

---

## 3. Architecture Principles

| # | Principle | Phase Impact |
|---|-----------|-------------|
| AP1 | **Geometry Layer is independent of Semantic Layer.** Semantic objects are derived from geometry, never embedded into geometry artifacts. | Phase 2 produces pure geometry; Phase 3 adds semantics. GeometryModel has no type annotations, no relationships. |
| AP2 | **ApplicationSpec is an abstract contract (ABC/Protocol).** Builders introduce new specifications without modifying Renderers. | Phase 5 produces specs; Phase 6 renders any spec type. New spec = new builder + adapter, no existing code changes. |
| AP3 | **Pattern Engine scores candidates; Inference Engine decides.** Pattern never makes the final classification decision. | Phase 3: PatternEngine produces scores; InferenceEngine resolves conflicts and defers ambiguous cases. |
| AP4 | **All relationship rules are declarative (DSL/YAML).** New object types require zero code changes. | Phase 4: RelationshipBuilder loads YAML rules; new node types add YAML rules only. |
| AP5 | **ArchitectureGraph provides a Query API.** `find_rooms()`, `neighbors()`, `shortest_path()`. | Phase 4: Graph API used by all downstream consumers (Phase 5 builders, AI, validation). |
| AP6 | **Recognition evidence is bidirectionally traceable from Graph nodes.** | Phase 3→4: Every SemanticObject node links to RecognitionEvidence answering "why was this classified?" |
| AP7 | **Unknown objects are preserved as Graph nodes.** | Phase 3→4: Unresolved candidates become Unknown nodes, not discarded. AI resolves later. |
| AP8 | **Renderer is read-only.** Never mutates ApplicationSpec or ArchitectureGraph. | Phase 6: Renderer is a pure function — Spec → DrawingEntity[]. Mutations flow through Command pattern (ADR-008). |
| AP9 | **Global coordinates are canonical.** Wall LCS, Room LCS are derived projections. | Phase 2: All geometry in global WCS. LCS computed on demand for rendering. |
| AP10 | **Ontology Layer sits above Semantic Objects.** Wall → BearingWall → FireWall. | Long-term concept (Phase 4). Current flat taxonomy unchanged; Ontology is a classification overlay. |

---

## 4. Artifact Contracts

### Contract Principle

Phase-to-phase connections are defined by **contracts** (input/output types), not by class dependencies. A Phase may replace its internal implementation as long as it satisfies its output contract.

### Artifact Definitions

```python
@dataclass
class DrawingMetadata:
    """Phase 1 output. Drawing-level metadata extracted from DWG."""
    layers: list[LayerInfo]
    units: str                 # "mm" | "cm" | "m"
    scale: float
    ucs: CoordinateSystem
    block_table: dict[str, BlockDef]
    text_styles: list[TextStyle]
    version: ArtifactVersion

@dataclass
class GeometryModel:
    """Phase 2 output. Structured geometry from DWG primitives."""
    primitive_graph: PrimitiveGraph
    components: list[ConnectedComponent]
    feature_store: FeatureStore
    version: ArtifactVersion

@dataclass
class SemanticModel:
    """Phase 3 output. Typed semantic objects with parameters."""
    semantic_objects: list[SemanticObject]
    object_relationships: list[Relationship]
    recognition_evidence: list[RecognitionEvidence]
    unresolved_candidates: list[UnknownCandidate]
    version: ArtifactVersion

# Phase 4 output: ArchitectureGraph (see ADR-005)
# Phase 5 output: ApplicationSpec (see ADR-007)
```

### Artifact Version Metadata

Every artifact carries version metadata (see ADR-008 §6):

```python
@dataclass
class ArtifactVersion:
    schema_version: str       # "1.0" — allows schema evolution
    created_at: float         # creation timestamp
    source_phases: list[int]  # which phases produced this artifact
    pipeline_run_id: str      # unique pipeline execution identifier
```

### Immutability Rule

**Every artifact is immutable once created.** A Phase never mutates its input — it creates a new output artifact. This enables:
- Safe caching (artifact can be reused across pipeline runs)
- Parallel execution (no shared mutable state)
- Undo/redo (old artifacts preserved in version history)

---

## 5. Domain Namespaces

```
src/cad_intelligence/
├── analysis/            Phase 1: Drawing/layer analysis
├── geometry/            Phase 2: Primitives, components, features
│   ├── primitives.py
│   ├── topology.py
│   └── features/
├── semantic/             Phase 3: Candidates, patterns, inference, evidence
│   ├── candidates.py
│   ├── patterns/
│   ├── inference.py
│   └── parameters.py
├── graph/                Phase 4: Architecture Graph, relationships, query API
│   ├── arch_graph.py
│   ├── relationship_builder.py
│   ├── spatial_index.py
│   └── evidence.py
├── application/          Phase 5: TaskQuery, builders, ApplicationSpec
│   ├── builder.py
│   ├── task_query.py
│   ├── constraint_engine.py
│   └── specs/
├── renderer/             Phase 6: Renderer, adapters (DWG/SVG/DXF/IFC/PDF)
│   ├── base.py
│   ├── dwg_adapter.py
│   └── adapters/
├── platform/             Cross-phase: EventBus, Cache, Diagnostics, Metrics
│   ├── event_bus.py
│   ├── diagnostics.py
│   └── metrics.py
└── commands/             Cross-phase: Command pattern, mutations
    ├── command.py
    └── mutations.py
```

---

## 6. Pipeline Manifest

```yaml
# pipeline.yaml — authoritative pipeline configuration
version: "1.0"

phases:
  - phase: 1
    name: Drawing Analysis
    input: DWG
    output: DrawingMetadata
    depends_on: []
    cacheable: false
    parallel: false
    namespace: analysis

  - phase: 2
    name: Geometry Foundation
    input: DrawingMetadata
    output: GeometryModel
    depends_on: [1]
    cacheable: true
    parallel: false
    namespace: geometry

  - phase: 3
    name: Semantic Reconstruction
    input: GeometryModel
    output: SemanticModel
    depends_on: [2]
    cacheable: true
    parallel: false
    namespace: semantic

  - phase: 4
    name: Domain Model
    input: SemanticModel
    output: ArchitectureGraph
    depends_on: [3]
    cacheable: true
    parallel: false
    namespace: graph

  - phase: 5a
    name: Application Pipeline (Path A)
    input: ArchitectureGraph
    output: ApplicationSpec
    depends_on: [4]
    cacheable: true
    parallel: true
    namespace: application
    spec: ADR-007

  - phase: 5b
    name: Facade Mesh Pipeline (Path B)
    input: ArchitectureGraph + BuildingConfig (optional, FACADE-002)
    output: OBJ / DAE
    depends_on: [4]
    cacheable: true
    parallel: true
    namespace: facade
    spec: FACADE-001, FACADE-002

  - phase: 6
    name: Rendering
    input: ApplicationSpec
    output: DWG / IFC / SVG / PDF
    depends_on: [5]
    cacheable: false
    parallel: true
    namespace: renderer
```

---

## 7. Phase Mapping (11-Stage → 6-Phase)

The original 11-stage pipeline maps to the new 6-Phase model:

| Original Stage | New Phase | Notes |
|---------------|-----------|-------|
| ① Primitive Extraction | 2 | |
| ② Connected Components | 2 | |
| ③ Feature Extraction | 2 | |
| ④ Object Candidate Layer | 3 | See ADR-006 §2 |
| ⑤ Pattern Library (DSL) | 3 | See ADR-006 §3–4 |
| ⑥ Semantic Objects | 3 | See ADR-006 §5 |
| ⑦ Parameter Extraction | 3 | See ADR-006 §7 |
| ⑧ Architecture Graph | 4 | See ADR-005 |
| ⑨ Application Layer | 5 | See ADR-007 |
| ⑩ Platform Services | 5–6 | Split across Application + Rendering |
| ⑪ Rendering + AI | 6 | See ADR-007 §7 |

Stage ①–③ consolidate into **Phase 2** (Geometry Foundation).
Stage ④–⑦ consolidate into **Phase 3** (Semantic Reconstruction).
Stage ⑧ becomes **Phase 4** (Domain Model).
Stage ⑨ becomes **Phase 5** (Application Pipeline).
Stage ⑩–⑪ become **Phase 5–6** (Application + Rendering).

---

## 8. Design Decisions

### Pipeline-Level Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Opening as independent object | Door/Window both fill wall gaps — the gap exists before the filler. Empty openings handled by same framework. |
| D2 | Pattern Library as interpreter, not creator | Object Candidate Layer precedes Pattern Library. Pattern interprets candidates, does not create from scratch. *(see ADR-006)* |
| D3 | DSL-based pattern definitions (YAML) | Adding new object types = new YAML file, no code changes. *(see ADR-006)* |
| D4 | Deterministic first, AI second | Pattern Matching handles regular cases (majority in Korean CAD). AI handles only ambiguous edge cases. *(see ADR-006)* |
| D5 | Persistent Object Identity | Stable IDs (Wall:0012, Door:0056) enable targeted AI mutations, BIM cross-reference, change tracking. *(see ADR-005)* |
| D6 | Wall Local Coordinate System | Each Wall has origin, direction, normal. Child positions as offset along wall. Elevation generation becomes trivial. |
| D7 | View Graph for AI | AI receives task-specific sub-graph, not full Architecture Graph. *(see ADR-005)* |
| D8 | Flat Semantic Object Taxonomy | All objects share same parent level. Category grouping is organizational, not hierarchical. *(see ADR-006)* |
| D17 | Opening Detection before Pattern Engine | Opening detection is geometry-level (gap in wall network); Pattern Engine classifies the filler. Geometry before Semantic. |
| D18 | Feature Store as Phase boundary | GeometryModel = PrimitiveGraph + ConnectedComponents + FeatureStore. Phase 2 output, Phase 3 input. |
| D19 | Room after Opening | Opening-aware room polygonization — rooms defined with knowledge of openings in their bounding walls. |
| D25 | Artifact Contracts | Phase connections defined by contracts (input/output types), not class dependencies. |
| D30 | Geometry Layer independent of Semantic Layer | Semantic objects derived from geometry, never embedded. GeometryModel has no semantic annotations. |

### Decisions Moved to Focused ADRs

| Decision | Moved To | Topic |
|----------|----------|-------|
| D9, D10, D11 | ADR-007 | ApplicationBuilder, ElevationSpec, TaskQuery |
| D12 | ADR-008 | EventBus |
| D13 | ADR-005 | SpatialIndex |
| D14 | ADR-007 | ConstraintEngine |
| D15 | ADR-008 | Command Pattern |
| D16 | ADR-005 | ArchitectureGraph as center |
| D20 | ADR-005 | Relationship Builder order |
| D21 | ADR-005 | Graph replaces WallModel |
| D22 | ADR-005 | Persistent ID format |
| D23 | ADR-008 | Metadata/Cache separation |
| D24 | ADR-008 | Immutable artifacts |
| D26 | ADR-005 | BIM as projection |
| D27 | ADR-005 | Evidence traceability |
| D28 | ADR-005 | Unknown objects preserved |
| D29 | ADR-008 | Artifact versioning |
| D31 | ADR-007 | ApplicationSpec ABC |
| D32 | ADR-006 | Relationship rules declarative |
| D33 | ADR-005 | Evidence bidirectional links |
| D34 | ADR-005 | Canonical coordinates |

---

## 9. Acceptance Criteria

### Phase A — Pattern Library *(see ADR-006)*
- [ ] `PatternEngine` evaluates YAML pattern constraints against `ObjectCandidate` features
- [ ] Door and Window patterns produce correct match/miss results on known test components
- [ ] New pattern addition (e.g., `SlidingDoor`) requires only a YAML file
- [ ] `handle_build_feature_store` outputs pattern match results alongside component features

### Phase B — Parameter Extraction *(see ADR-006 §7)*
- [ ] Host wall detection assigns each Door/Window to the correct Wall (within 200mm tolerance)
- [ ] Wall-local offset computed correctly (projection onto wall centerline)
- [ ] Swing direction inferred from arc geometry (hinge side + inward/outward)
- [ ] All parameters (width, offset, host_wall, sill_height) stored on `ObjectFeatures`

### Phase C — Architecture Graph *(see ADR-005)*
- [ ] `feature_store_to_arch_graph()` produces a populated `ArchitectureGraph` with typed edges
- [ ] Opening nodes exist as first-class nodes (Wall → Opening → Door/Window)
- [x] `_build_graph()` in `draw_v3.py` uses Feature Store instead of V2 handler chain (V2 fallback removed 2026-07-05; V3-only dispatch)
- [ ] Persistent IDs survive the full pipeline (candidate_id → object_id)

### Phase D — Platform Architecture *(see ADR-005~008)*
- [ ] `ApplicationBuilder` ABC with `build(graph, query)` interface *(ADR-007)*
- [ ] `ElevationBuilder` produces `ElevationSpec` from Architecture Graph *(ADR-007)*
- [ ] `TaskQuery` extracts task-specific sub-graph *(ADR-007)*
- [ ] `Renderer` traverses `ElevationSpec` → `DrawingEntity`; `DWGAdapter` converts to ZWCAD format *(ADR-007)*
- [ ] `RelationshipBuilder` adds semantic edges *(ADR-005)*
- [ ] `ConstraintEngine` validates graph with `FixSuggestion` *(ADR-007)*
- [ ] `SpatialIndex` provides O(log N) queries *(ADR-005)*
- [ ] `EventBus` decouples Command → downstream handlers *(ADR-008)*
- [ ] `GraphVersionHistory` provides immutable snapshots *(ADR-008)*
- [ ] `Command` ABC + `CommandHistory` for undo/redo *(ADR-008)*
- [ ] `Diagnostics` records provenance; `Metrics` tracks quality *(ADR-008)*

### Phase E — Pipeline Restructuring *(this document)*
- [ ] Pipeline restructured from 11-stage to 6-Phase model
- [ ] Architecture principles AP1–AP10 documented and applied
- [ ] Artifact contracts defined for all 6 phases
- [ ] Pipeline manifest (YAML) created
- [ ] Domain namespaces assigned to all phases
- [ ] ADR-005~008 created with redistributed design decisions
- [ ] ADR-004 updated to reference focused ADRs

---

## 10. Out of Scope

1. **BIM / 3D / IFC export** — this ADR defines the pipeline that *enables* these, but does not design the export formats or 3D extrusion logic. See ADR-007 §3 (IFCSpec defined, export logic future).
2. **M4 regulatory compliance v2** — FAR/height/sunlight checks are downstream consumers of the Architecture Graph, not part of its construction.
3. **M5 production readiness** — transactional operations, audit trail, auto-recovery are orthogonal to this pipeline design.
4. **Stair/Slab data model extension** — remains out of scope per ADR-002 §5; no CAD extraction path for these exists today.
5. **Ontology Layer implementation** — conceptual design only (ADR-005 §7). Deferred to M2–M3.
6. **Delta Versioning** — snapshot-based first (ADR-008 §5). Delta computation deferred.
7. **Workflow Engine** — linear pipeline flow sufficient; parallel execution deferred (ADR-008 §11).

---

## 11. Related

### Focused ADRs (v3.0 Split)
- [`ADR-005`](ADR-005-architecture-graph-schema.md) — Architecture Graph Schema (node/edge types, query API, evidence, coordinates, Ontology Layer concept)
- [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) — Pattern DSL & Recognition Engine (candidates, patterns, inference, relationship rules DSL)
- [`ADR-007`](ADR-007-appspec-rendering-architecture.md) — ApplicationSpec & Rendering Architecture (ApplicationBuilder, ElevationSpec, ConstraintEngine, Renderer)
- [`ADR-008`](ADR-008-command-versioning-editing.md) — Command / Versioning / Editing Model (Command pattern, undo/redo, EventBus, artifact versioning)
- [`ADR-009`](ADR-009-pipeline-execution-framework.md) — Pipeline Execution Framework (artifact dataclasses, run metadata, phase plugins, validators, recognition store, graph query service, application spec protocols, ground truth evaluation)

### Existing ADRs
- [`ADR-001`](ADR-001-architecture-graph.md) — Architecture Graph as mandatory IR; this ADR defines the pipeline that *populates* it
- [`ADR-002`](ADR-002-com-bridge-v3-versioning-design.md) — V3 handler decomposition; this pipeline builds within the V3 package structure
- [`AI-003`](../designs/AI-003-v1-to-v3-migration-design.md) — Gap A (live-drawing → Architecture Graph extraction)

### Design Docs
- [`PKG-001`](../designs/PKG-001-cad-intelligence-restructure-design.md) — Package structure (`features/`, `graph/`, `patterns/` directories)
- [`AXIS-001`](../designs/AXIS-001-design.md) — Existing opening candidate/assignment pipeline reused in Parameter Extraction
- [`ELEV-002`](../designs/ELEV-002-design.md) — Existing wall-centric model and elevation generation
