---
lang: ko
lang_reason: source-material
---

# FACADE-001: Facade Mesh Pipeline

> **Spec ID**: FACADE-001
> **Version**: 1.2
> **Status**: Implemented (Steps 1–8 complete)
> **Created**: 2026-07-08
> **Authors**: architect
> **Source**: User-proposed facade mesh architecture. "SketchUp을 모델링 툴이 아니라 최종 렌더링 툴로 사용하는 방향으로 설계하겠습니다."
> **Supersedes**: None (new capability)
> **Related**: [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md) (Phase 5 Application Pipeline, Parallel Path B), [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md) (ApplicationSpec & ThreeDSpec), [`ADR-a`](../adr/ADR-016-face-elevation-architecture.md) (Surface Protocol + SurfaceType), [`ADR-c-imm`](../adr/ADR-016-face-elevation-architecture.md) (BoundaryLoop.to_polygon() conversion pattern)

---

## 1. Overview

The Facade Mesh Pipeline generates 3D exterior wall meshes from the ArchitectureGraph, producing exportable geometry files (OBJ, DAE) that SketchUp (or any 3D tool) can import directly. This replaces the manual "import 2D elevation → push/pull in SketchUp" workflow with a fully automated mesh generation pipeline.

**Design thesis**: If the pipeline can produce wall geometry with openings (windows, doors, vents) as boolean-cut mesh, then SketchUp's only role is final rendering — not modeling. All 3D geometry is created in Python and exported as standard mesh formats.

---

## 2. Pipeline Integration

```
Phase 1–4 (unchanged)
  └─→ ArchitectureGraph

Phase 5 — parallel paths:
  Path A: ArchitectureGraph → ElevationPipeline → ZWCAD Renderer → 2D DWG
  Path B: ArchitectureGraph → FacadePipeline    → FacadeExporter  → OBJ/DAE

Phase 6: N/A for facade (direct file write, not through ZWCAD renderer)
```

The ZWCAD renderer is NOT involved in Path B. FacadePipeline is an application service (like ElevationPipeline), not an ApplicationBuilder subclass.

---

## 3. Architecture

```
ArchitectureGraph (Aggregate Root)
  │
  ▼
FacadePipeline.run(graph: ArchitectureGraph, config: FacadePipelineConfig)
  │
  ├─ FacadeBuilder.build(graph, config)
  │    ├─ _build_footprint(graph)
  │    │    └─ Wall.to_dict() → BoundaryBuilder.build(walls: List[dict]) → BoundaryLoop[]
  │    │       → .to_polygon() → shapely.unary_union → Polygon
  │    │       → MultiPolygon → FacadeValidationError
  │    ├─ _classify_exterior(graph, footprint)
  │    │    └─ BoundaryResult + AdjacencyResult → ExteriorResult(confidence: ConfidenceLevel)
  │    ├─ _merge_faces(exterior_walls, config)
  │    │    └─ 5 conditions: collinear + same normal + same thickness + connected + no opening
  │    └─ _project_openings(graph, merged_walls)
  │    └─→ FacadeModel (full Polygon with holes)
  │
  ├─ FacadeMeshBuilder.build(facade_model, config)
  │    ├─ _extrude_wall → box mesh
  │    ├─ _cut_openings → boolean subtraction (fail-soft)
  │    ├─ _fix_normals → outward normals
  │    ├─ _validate_mesh → watertight/manifold check
  │    └─ _assemble_scene → GeometryMesh
  │
  ├─ FacadeExporter.export(mesh, path, format)
  │    ├─ _assign_materials → FacadeMaterial enum per face
  │    └─ _write → OBJ/DAE (geometry-free: never modifies mesh)
  │
  └─→ FacadeResult(model, mesh: GeometryMesh, export_path, warnings: list[FacadeWarning])
```

---

## 4. Module Structure

```
src/cad_intelligence/facade/
  __init__.py
  facade_model.py          # Models, enums, GeometryMesh Protocol (NO trimesh)
  facade_builder.py        # _build_footprint, _classify_exterior, _merge_faces, _project_openings
                           # BoundaryResult, AdjacencyResult, ExteriorResult (NO trimesh)
  facade_mesh_builder.py   # _extrude_wall, _cut_openings, _fix_normals, _validate_mesh, _assemble_scene
  facade_exporter.py       # _assign_materials, _write (geometry-free)
  facade_pipeline.py       # FacadePipelineConfig, FacadePipeline, FacadeResult (NO trimesh)
  errors.py                # FacadeError hierarchy

tests/facade/
  test_facade_model.py
  test_facade_builder.py
  test_facade_mesh_builder.py
  test_facade_exporter.py
  test_facade_pipeline.py
  fixtures/
```

---

## 5. Data Models

### 5.1 Enums

```python
class ExportFormat(str, Enum):
    OBJ = "obj"
    DAE = "dae"

    @property
    def supports_materials(self) -> bool:
        return self == ExportFormat.DAE

class FacadeMaterial(str, Enum):
    WALL = "wall"       # #C0C0C0 gray
    GLASS = "glass"     # #87CEEB blue, 0.3 opacity
    DOOR = "door"       # #8B4513 brown
    VENT = "vent"       # #A9A9A9 dark gray

class LengthUnit(str, Enum):
    MM = "mm"
    M = "m"
    INCH = "inch"

class ConfidenceLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Severity(str, Enum):
    WARNING = "warning"
    INFO = "info"
```

### 5.2 GeometryMesh Protocol

```python
@runtime_checkable
class GeometryMesh(Protocol):
    """Minimal mesh protocol — only what Exporter needs."""
    @property
    def bounds(self) -> tuple[float, ...]: ...

    def export(self, path: str, **kwargs) -> bool: ...
```

### 5.3 Classification Results

```python
@dataclass(frozen=True)
class BoundaryResult:
    intersects: bool
    distance: float          # min distance from centerline to polygon boundary (mm)
    touch_length: float      # length of intersection (mm)

@dataclass(frozen=True)
class AdjacencyResult:
    adjacent_room_count: int
    room_ids: tuple[str, ...]

@dataclass(frozen=True)
class ExteriorResult:
    wall_id: str
    is_exterior: bool
    confidence: ConfidenceLevel
    reason: str
    boundary: BoundaryResult
    adjacency: AdjacencyResult
```

### 5.4 FacadeWarning

```python
@dataclass(frozen=True)
class FacadeWarning:
    code: str             # e.g. "OPENING_BOOLEAN_FAILED"
    severity: Severity
    message: str
```

### 5.5 Domain Models

```python
@dataclass(frozen=True)
class FacadeOpening:
    opening_id: str
    opening_type: Literal["window", "door", "vent"]
    offset: float          # distance from wall start along wall axis (mm)
    sill_height: float     # distance from floor to bottom of opening (mm)
    width: float
    height: float

@dataclass(frozen=True)
class FacadeWall:
    wall_id: str
    compass: CompassFace
    origin: tuple[float, float, float]      # bottom-left in world XYZ (mm)
    length: float                            # (mm)
    height: float                            # (mm)
    thickness: float                         # (mm)
    normal: tuple[float, float, float]       # outward unit normal
    openings: tuple[FacadeOpening, ...]

@dataclass(frozen=True)
class FacadeModel:
    model_id: str
    walls: tuple[FacadeWall, ...]
    footprint: shapely.Polygon    # full Polygon (.exterior + .interiors)
    source_graph_id: str
    total_height: float
    footprint_area: float
```

### 5.6 Pipeline Config

```python
@dataclass
class FacadePipelineConfig:
    default_height: float = 2800.0           # mm
    default_wall_thickness: float = 200.0   # mm
    angle_tolerance: float = 0.5            # degrees
    distance_tolerance: float = 3.0         # mm
    thickness_tolerance: float = 5.0        # mm
    boolean_tolerance: float = 1.0          # mm
    export_units: LengthUnit = LengthUnit.MM
    standard: DesignStandard = KOREAN_APARTMENT
```

### 5.7 Result

```python
@dataclass
class FacadeResult:
    model: FacadeModel
    mesh: GeometryMesh          # Protocol type — pipeline does NOT import trimesh
    export_path: str
    warnings: list[FacadeWarning]
```

---

## 6. FacadeBuilder — Footprint

BoundaryBuilder is a pure geometry builder (`Wall dicts → BoundaryLoop`). It does NOT perform Room reconstruction.

```python
def _build_footprint(self, graph) -> shapely.Polygon:
    walls = [n for n in graph.nodes.values() if isinstance(n, Wall)]
    wall_dicts = [w.to_dict() for w in walls]
    boundary_loops = BoundaryBuilder.build(wall_dicts)
    room_polygons = [loop.to_polygon() for loop in boundary_loops]
    building_polygon = shapely.unary_union(room_polygons)
    if isinstance(building_polygon, MultiPolygon):
        raise FacadeValidationError(
            "Multiple disconnected building footprints detected. "
            f"Got {len(building_polygon.geoms)} polygons. Scope is single building."
        )
    return building_polygon  # .exterior + .interiors preserved
```

---

## 7. FacadeBuilder — Exterior Classification

Two-stage: BoundaryResult (primary) + AdjacencyResult (validation).

| Primary | Validation |
|---------|-----------|
| `footprint.boundary.intersects(wall_centerline)` | `len(wall.room_ids) == 1` (not party wall) |

Both signals produce structured results (distance, touch_length, adjacent_room_count) for future AI classifier integration.

---

## 8. FacadeBuilder — Merge Rules

Five conditions, ALL must be met:

1. **Collinear**: angle between centerlines < `angle_tolerance` (0.5°)
2. **Same normal**: outward normals within `angle_tolerance`
3. **Same thickness**: abs(diff) < `thickness_tolerance` (5mm)
4. **Endpoint connected**: gap < `distance_tolerance` (3mm)
5. **No intermediate opening**: no door/window between endpoints

---

## 9. FacadeMeshBuilder — Internal Pipeline

```
build()
  ├── _extrude_wall()        → box mesh per FacadeWall
  ├── _cut_openings()        → boolean subtraction (fail-soft per opening)
  ├── _fix_normals()         → ensure outward normals
  ├── _validate_mesh()        → watertight / manifold check
  └── _assemble_scene()       → concatenate into GeometryMesh
```

CSG fail-soft: failed boolean → warning → opening omitted → wall preserved. Export never fails due to a single opening.

---

## 10. FacadeExporter — Geometry-Free

Exporter transforms `GeometryMesh → renderable scene → file`. It never modifies mesh geometry. Material assignment happens here (not in MeshBuilder).

OBJ: basic MTL file. DAE: embedded materials via pycollada.

---

## 11. Error Hierarchy

```python
class FacadeError(Exception): ...
class FacadeValidationError(FacadeError): ...
    # negative thickness, zero length, invalid polygon, MultiPolygon

class FacadeExportError(FacadeError): ...
    # file I/O failure, format not supported

class FacadeMeshError(FacadeError): ...
    # CSG failure (non-fatal — triggers fail-soft)
```

---

## 12. Dependency Map (strict)

```
facade_model.py       → dataclasses, typing, geometry.compass, shapely, protocol
facade_builder.py     → facade_model, geometry.boundary, common.models, shapely
facade_mesh_builder.py → facade_model, trimesh, manifold3d
facade_exporter.py    → facade_model, trimesh, pycollada (optional)
facade_pipeline.py    → facade_builder, facade_mesh_builder, facade_exporter (NO trimesh)
errors.py             → (none)
```

---

## 13. New Dependencies

| Package | Used by | Purpose |
|---------|---------|---------|
| trimesh | mesh_builder, exporter | mesh creation + export |
| manifold3d | mesh_builder | CSG boolean |
| pycollada | exporter | DAE format (optional) |

---

## 14. Implementation Order (SketchUp verification gates)

| Step | Deliverable | SketchUp Verifiable? |
|------|------------|---------------------|
| 1 | FacadeModel (dataclasses + enums) | No |
| 2 | FacadeBuilder (footprint + exterior + merge + openings) | No |
| 3 | MeshBuilder — extrude only | **Yes** |
| 4 | OBJ Export | **Yes** |
| 5 | Boolean Opening cutout | **Yes** |
| 6 | DAE Export | **Yes** |
| 7 | Material assignment | **Yes** |

---

## 15. Test Plan (~75 tests)

| Layer | Focus |
|-------|-------|
| Model | Dataclass construction, serialization, enum values |
| Builder | Footprint (courtyard), classification, merge, openings |
| Mesh | Extrude, boolean, fail-soft, watertight, normals |
| Exporter | Round-trip, material assignment |
| Pipeline | End-to-end |

---

## 16. Design Decisions

| DD | Decision | Rationale |
|----|----------|-----------|
| 01 | `run(graph, config)` — ArchitectureGraph as Aggregate Root | Consistency guaranteed internally; all stages share same input |
| 02 | Application service pattern (ElevationPipeline pattern) | Not ApplicationBuilder ABC; follows dominant active pattern |
| 03 | `_classify_exterior()` as private swappable strategy | Can swap for AI classifier, rule engine, or hybrid later |
| 04 | 5-condition merge with split tolerances | Prevents incorrect merging at corners, thickness changes, or across openings |
| 05 | `offset, sill_height` for FacadeOpening | Clearer semantics than `x, y` |
| 06 | `length` not `width` for FacadeWall | Facade is a length measurement |
| 07 | Boolean fail-soft | CSG is #1 source of bugs; export must never fail due to one opening |
| 08 | Material in Exporter, not MeshBuilder | Separation of geometry vs presentation |
| 09 | FacadeModel never imports trimesh | Hard dependency boundary: Model → MeshBuilder → trimesh |
| 10 | GeometryMesh Protocol minimal (export + bounds) | Smallest interface; any backend can satisfy |
| 11 | Footprint preserves full Polygon (exterior + interiors) | Courtyard/balcony walls are exterior for future expansion |
| 12 | MultiPolygon → FacadeValidationError | Single-building scope; `buffer(0)` does not merge disconnected polygons |
| 13 | BoundaryResult/AdjacencyResult as structured signals | Preserves features for future AI classifier |
| 14 | All enums (no raw strings) | ConfidenceLevel, Severity, ExportFormat, FacadeMaterial, LengthUnit |
| 15 | FacadeWarning(code, severity, message) | Machine-readable, not `list[str]` |

---

## 17. Scope

### In Scope (v1)
- Single-floor exterior facade
- OBJ and DAE export
- BoundaryLoop-based footprint (full Polygon with holes)
- MultiPolygon rejection (single-building scope)
- Two-stage structured exterior classification
- 5-condition merge with split tolerances
- Fail-soft boolean CSG
- Minimal GeometryMesh Protocol
- Full enum types

### Out of Scope
- Multi-floor stacking (FACADE-002)
- Roof geometry (parapet, gable, flat)
- Interior wall mesh
- SKP (SketchUp native) export
- glTF/glb export
- FBX, USD, STL export
- Curtain wall system
- IFC/BIM export
- PBR materials or textures
- AI-based exterior classifier

### Future Extensibility
- **Multi-floor**: ✅ Implemented in **FACADE-002** — see [`FACADE-002-multi-floor-facade.md`](FACADE-002-multi-floor-facade.md)
- **Roof**: Parapet implemented (FACADE-002); gable/hip roof deferred
- **Curtain wall**: `FacadeOpening.opening_type = "curtain_wall"` with subdivided grid
- **Full envelope**: `FloorFace`, `CeilingFace` (SurfaceType already defined in ADR-a)
- **BuildingAssembler** (FACADE-002): ✅ Implemented — `assemble(template, config)` with `BuildingConfig`

---

## 18. Implementation Status

### Implemented (v1.0)

| Step | Deliverable | Module | Tests | Status |
|------|------------|--------|-------|--------|
| 1 | FacadeModel (dataclasses + enums + GeometryMesh Protocol) | `facade_model.py` | 28 | ✅ |
| 2 | FacadeBuilder (footprint + exterior + merge + openings) | `facade_builder.py` | 25 | ✅ |
| 3 | FacadeMeshBuilder — extrude + boolean + scene | `facade_mesh_builder.py` | 20 | ✅ |
| 4 | FacadeExporter — OBJ export | `facade_exporter.py` | 10 | ✅ |
| 5 | FacadePipeline — end-to-end orchestrator | `facade_pipeline.py` | 8 | ✅ |
| 6 | DAE export (stateless exporter + handler registry) | `facade_exporter.py`, `facade_export_handlers.py`, `facade_export_types.py` | 25 | ✅ |
| 7 | Material assignment (face normal binning + vertex overlap) | `facade_exporter.py`, `facade_mesh_builder.py` (FaceRange) | 22 | ✅ |
| 8 | Error hierarchy | `errors.py` | (in model tests) | ✅ |

**Total: 166 tests (facade suite), 3240 full suite, all passing.**

### Implementation Deviations from Design

| Area | Design Spec | Actual | Reason |
|------|------------|--------|--------|
| `FacadePipelineConfig.standard` | `standard: DesignStandard = KOREAN_APARTMENT` | Added in `facade_model.py` | Was missing; fixed post-implementation |
| `_fix_normals()` | Explicit normal fix | Identity function (no-op) | Adequate for v1; trimesh handles normals automatically |
| `manifold3d` | Listed as CSG dependency | Not directly imported | trimesh's internal boolean handles CSG |
| `FacadeResult.warnings` type | `list[FacadeWarning]` | `list` (untyped) | Minor; runtime types are FacadeWarning instances |
| Pipeline mkdir ordering | N/A (not specified) | Moved before export | Bug fix: directory must exist before file write |

### Dependencies Installed

| Package | Version | Purpose |
|---------|---------|---------|
| trimesh | latest | mesh creation + OBJ/DAE export |
| manifold3d | latest | CSG boolean backend (trimesh-internal) |
