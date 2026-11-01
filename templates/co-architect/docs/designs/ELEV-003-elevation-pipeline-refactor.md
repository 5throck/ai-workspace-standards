# ELEV-003: Elevation Pipeline Refactoring — Projection/Annotation/Layout/Render Separation

> **Spec ID**: ELEV-003
> **Version**: 1.1
> **Status**: **Superseded** — Elevation code moved to `elevation/legacy/` subpackage (2026-07-07). Replaced by four-domain face-centered pipeline (`ADR-016-face-elevation-architecture.md`). ELEV-003 code remains importable via backward-compatible re-exports but is feature-frozen.
> **Created**: 2026-07-06
> **Updated**: 2026-07-07
> **Authors**: architect
> **Supersedes**: ELEV-002 building elevation handlers in `com_bridge.py`
> **Superseded by**: [`ADR-016-face-elevation-architecture.md`](../adr/ADR-016-face-elevation-architecture.md) (four-domain face-centered elevation pipeline, 2026-07-07)
> **Related**: ADR-001 (Architecture Graph), ADR-004 (CAD Intelligence Pipeline), ELEV-001 (deprecated), ELEV-002 (current wall-model, elevation superseded)

---

## 1. Overview

This ADR refactors the elevation generation pipeline in `com_bridge.py` (lines 2310–3286) into a clean, separated architecture. The refactoring resolves structural coupling issues where Projection, Annotation, Layout, and Rendering responsibilities were mixed across `handle_project_to_elevation`, `handle_draw_elevation`, and `handle_generate_all_elevations`.

### Core Problems Addressed

| # | Problem | Solution |
|---|---------|----------|
| 1 | Coordinate system was Z-axis (XZ plane), invisible in Top View | Switch to XY plane (Z=0) as default |
| 2 | `offset` parameter semantics changed between modes | Removed; replaced by `translate()` on entities |
| 3 | Draw function knew about coordinate axes | Draw receives pre-transformed World Coordinate entities only |
| 4 | GL/FL/Dimension generated in Draw, not Projection | Separated into Annotation Pipeline |
| 5 | Layout mixed with projection in Generate | Separated into LayoutManager |
| 6 | 4 directions hardcoded | Driven by `GenerationConfig.directions` list |
| 7 | `height_axis` parameter propagated across all functions | Eliminated; XY plane only (Phase 1) |
| 8 | Dictionary entities with string roles | Replaced by typed dataclasses and Enum |
| 9 | Projection knew CAD layers | Projection uses `SourceMetadata`; Renderer maps Role→Layer |
| 10 | No service layer; MCP handler contained business logic | ElevationService introduced as orchestrator |

### Architecture Principles

| ID | Principle | Implementation |
|----|-----------|----------------|
| AP1 | Single Responsibility | Each pipeline stage has exactly one concern |
| AP2 | Local Coordinate Projection | Projection outputs geometry at origin (0,0), ignorant of placement |
| AP3 | Immutable Entities | `translate(dx, dy)` returns new entity; no mutation |
| AP4 | Role-based Layer Mapping | Renderer maps `ElevationRole` → CAD layer, not Projection |
| AP5 | Composable Annotation | AnnotationPass pipeline; passes are independently registrable |
| AP6 | Service Layer | `ElevationService` orchestrates; MCP handler is a thin adapter |

---

## 2. Pipeline Architecture

```
Building Analysis (existing classify)
        │
        ▼
Projection (Local Coordinate, Z=0)
        │  Input:  ProjectionInput, ProjectionConfig
        │  Output: ProjectionOutput (walls, openings, slabs)
        ▼
Annotation Pass Pipeline
        │  Input:  ProjectionOutput, AnnotationConfig, AnnotationContext
        │  Output: list[ElevationEntity]
        ▼
Layout Manager (Local → World)
        │  Input:  annotated entities, LayoutConfig, placement_origin
        │  Output: list[ElevationEntity] (World Coordinate)
        ▼
ElevationService (orchestrator)
        │  Combines all stages + render + title block
        ▼
ZWCAD COM (direct render)
```

### Stage Responsibilities

| Stage | Knows | Does NOT Know |
|-------|-------|---------------|
| **Projection** | Wall/door/window geometry, floor height | CAD layers, placement, annotations |
| **Annotation** | ProjectionOutput bbox, floor height | CAD layers, world position |
| **Layout** | Direction, spacing, placement origin | CAD layers, annotation content |
| **Service** | All configs, ZWCAD document | (thin orchestration only) |
| **ZWCAD Render** | CAD entity creation, Role→Layer map | Coordinate systems, projection logic |

---

## 3. Package Structure (Phase 1)

```
src/cad_intelligence/elevation/
    __init__.py          # Public API exports
    models.py            # Enum, dataclass, Config definitions
    projection.py        # Pure geometry projection (Local Coordinate)
    annotation.py        # AnnotationPass pipeline
    layout.py            # LayoutManager (Local → World via translate)
    service.py           # ElevationService (orchestrator + ZWCAD render)
```

---

## 4. Data Models

### 4.1 Enum

```python
class ElevationDirection(str, Enum):
    SOUTH = "south"
    NORTH = "north"
    EAST  = "east"
    WEST  = "west"

class ElevationRole(str, Enum):
    GROUND_WALL      = "ground_wall"
    ROOF_WALL        = "roof_wall"
    VERTICAL_WALL    = "vertical_wall"
    OPENING_FRAME    = "opening_frame"
    OPENING_HEADER   = "opening_header"
    GL_MARK          = "gl_mark"
    FL_MARK          = "fl_mark"
    DIMENSION        = "dimension"
    LEVEL_TEXT       = "level_text"
```

### 4.2 Source Metadata

```python
@dataclass
class SourceMetadata:
    """Tracks the origin of a projected entity. Projection produces this;
    Renderer consumes it for layer resolution."""
    layer: str = ""
    component_id: str | None = None
```

### 4.3 Geometry Entities (Immutable)

All geometry entities are `frozen=True` dataclasses with a `translate(dx, dy)` method that returns a new instance with offset coordinates. This eliminates the need for a separate `WorldElevationEntity` wrapper.

```python
@dataclass(frozen=True)
class ElevationLine:
    start: Point3D
    end: Point3D
    role: ElevationRole
    lineweight: float = 0.25
    metadata: SourceMetadata = field(default_factory=SourceMetadata)

    def translate(self, dx: float, dy: float) -> "ElevationLine": ...

@dataclass(frozen=True)
class ElevationText:
    position: Point3D
    text: str
    height: float = 150.0
    role: ElevationRole = ElevationRole.LEVEL_TEXT
    metadata: SourceMetadata = field(default_factory=SourceMetadata)

    def translate(self, dx: float, dy: float) -> "ElevationText": ...

@dataclass(frozen=True)
class ElevationDimension:
    p1: Point3D
    p2: Point3D
    text_position: Point3D
    text_override: str = ""
    role: ElevationRole = ElevationRole.DIMENSION
    metadata: SourceMetadata = field(default_factory=SourceMetadata)

    def translate(self, dx: float, dy: float) -> "ElevationDimension": ...

ElevationEntity = ElevationLine | ElevationText | ElevationDimension
```

### 4.4 Projection Output

```python
@dataclass
class ProjectionOutput:
    direction: ElevationDirection
    walls: list[ElevationLine]
    openings: list[ElevationLine]
    floor_height: float

    @property
    def all_lines(self) -> list[ElevationLine]: ...

    @property
    def bbox(self) -> dict:
        """Computed on demand — no stored bbox fields (avoids stale data)."""
        ...
```

### 4.5 Projection Input

```python
@dataclass
class ProjectionInput:
    """Wraps classified entity data for projection."""
    walls: list[dict]
    structure: list[dict]
    building_bbox: dict

    @classmethod
    def from_classified(cls, entities: list[dict]) -> "ProjectionInput": ...
    # from_graph(cls, graph) deferred to Phase 2
```

### 4.6 Configs (Separated by Concern)

```python
@dataclass
class ProjectionConfig:
    floor_height: float = 2800.0

@dataclass
class LayoutConfig:
    layout: str = "horizontal"   # "horizontal" | "vertical"
    spacing: float = 5000.0

@dataclass
class AnnotationConfig:
    draw_level_marks: bool = True
    draw_dimensions: bool = True

@dataclass
class RenderConfig:
    draw_title_block: bool = True
    material: str = ""

@dataclass
class GenerationConfig:
    """Top-level orchestration config. Composes all sub-configs."""
    directions: list[ElevationDirection] = field(default_factory=lambda: [...])
    projection: ProjectionConfig = field(default_factory=ProjectionConfig)
    layout: LayoutConfig = field(default_factory=LayoutConfig)
    annotation: AnnotationConfig = field(default_factory=AnnotationConfig)
    render: RenderConfig = field(default_factory=RenderConfig)

    @classmethod
    def from_dict(cls, params: dict) -> "GenerationConfig": ...
```

---

## 5. Projection (`projection.py`)

```python
def project_elevation(
    model: ProjectionInput,
    direction: ElevationDirection,
    config: ProjectionConfig,
) -> ProjectionOutput:
```

- Always outputs **Local Coordinate**: origin (0,0), Y-axis = height, Z = 0
- `base_point` is NOT a parameter — Projection is placement-agnostic
- Returns `ProjectionOutput` with `walls` and `openings` lists separated
- All coordinates are direct `[x, y, 0]` — no closure helpers needed
- Opening entities carry `SourceMetadata.layer` (e.g., "A-DOOR", "A-WIND") from classified source

### Coordinate Mapping

| Plan Feature | X (Local) | Y (Local) | Z (Local) |
|---|---|---|---|
| Wall width (horizontal span) | ✓ | — | 0 |
| Height (ground → roof) | — | ✓ | 0 |
| Opening position | ✓ | ✓ | 0 |

---

## 6. Annotation Pass Pipeline (`annotation.py`)

```python
class AnnotationPass(ABC):
    @abstractmethod
    def annotate(self, output: ProjectionOutput,
                 config: AnnotationConfig) -> list[ElevationEntity]: ...

class LevelAnnotationPass(AnnotationPass):
    """Generates GL mark line, FL mark line, and level text entities."""

class DimensionAnnotationPass(AnnotationPass):
    """Generates floor height dimension line."""

class AnnotationContext:
    """Shared context for passes to communicate. Empty in Phase 1."""

class AnnotationPipeline:
    def __init__(self): self.passes: list[AnnotationPass] = []
    def register(self, p: AnnotationPass): ...
    def run(self, output, config, context=None) -> list[ElevationEntity]: ...
```

---

## 7. Layout Manager (`layout.py`)

```python
@dataclass
class LayoutManager:
    def layout(
        self,
        annotated: list[tuple[ElevationDirection, list[ElevationEntity]]],
        config: LayoutConfig,
        origin: Point3D,
    ) -> list[ElevationEntity]:
        """Apply translate(dx, dy) to all entities. Returns World Coordinate entities."""
```

- **Coordinate transformation only** — no layer mapping, no rendering
- `horizontal` layout: elevations placed side-by-side along X axis
- `vertical` layout: elevations stacked along Y axis
- Uses `entity.translate(dx, dy)` for each entity

---

## 8. ElevationService (`service.py`)

```python
class ElevationService:
    """Business logic orchestrator. Shared by MCP / CLI / Python API."""

    def __init__(self, doc, config: GenerationConfig): ...

    def generate(self, classified_entities: list[dict]) -> dict:
        # 1. Build ProjectionInput
        # 2. Project each direction (Local Coordinate)
        # 3. Annotate via AnnotationPipeline
        # 4. Layout (Local → World via translate)
        # 5. Render to ZWCAD with Undo protection
        # 6. Title blocks
```

### Undo Safety

```python
try:
    doc.StartUndoMark()
    # ... render all entities ...
    doc.EndUndoMark()
except Exception:
    try:
        doc.EndUndoMark()
        doc.SendCommand("UNDO ")
    except Exception:
        pass
    raise
```

### Role → Layer Mapping (in Service render phase)

```python
_ROLE_LAYER_MAP = {
    ElevationRole.GROUND_WALL: "A-WALL",
    ElevationRole.ROOF_WALL: "A-WALL",
    ElevationRole.VERTICAL_WALL: "A-WALL",
    ElevationRole.OPENING_FRAME: "<source_layer>",  # from metadata
    ElevationRole.GL_MARK: "A-ELEV-GL",
    ElevationRole.FL_MARK: "A-ELEV-GL",
    ElevationRole.LEVEL_TEXT: "A-ELEV-GL",
    ElevationRole.DIMENSION: "A-DIMS",
}
```

---

## 9. MCP Handler Changes

### `handle_generate_all_elevations`

Simplified to a thin adapter:

```python
def handle_generate_all_elevations(params: dict) -> dict:
    bridge = _get_bridge()
    doc = bridge.app.ActiveDocument
    config = GenerationConfig.from_dict(params)
    classify_result = handle_classify_entities({})
    return ElevationService(doc, config).generate(
        classified_entities=classify_result.get("entities", [])
    )
```

### Preserved Handlers

The following handlers remain unchanged — they are lower-level tools used internally:
- `handle_classify_entities`
- `handle_draw_title_block`
- `handle_apply_material_hatch`
- `handle_start_undo_marker` / `handle_end_undo_marker`

---

## 10. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | XY plane only (Z=0) for Phase 1 | Top View compatibility; removes `height_axis` branching |
| D2 | `translate()` on immutable entities instead of `WorldElevationEntity` | Avoids duplicate model; each entity type knows its own offset logic |
| D3 | `SourceMetadata` dataclass instead of raw dict | Type safety for projection metadata; extensible without breaking API |
| D4 | Role→Layer mapping in render phase, not in Projection | Projection is geometry-pure; Renderer owns presentation policy |
| D5 | `ProjectionOutput` with `@property bbox` instead of stored fields | Eliminates stale-data risk from entity mutation |
| D6 | `ElevationDirection` Enum instead of raw strings | Prevents `south`/`South`/`S` typos |
| D7 | No RenderBackend ABC in Phase 1 | Avoids over-abstraction; ZWCAD render is direct in service.py |
| D8 | `GenerationConfig` composes all sub-configs | Single config object for ElevationService; cleaner API |
| D9 | `AnnotationContext` in pipeline | Enables future pass-to-pass communication without coupling |
| D10 | ElevationService as orchestrator | Decouples MCP handler from business logic; reusable from CLI/Python |

---

## 11. Phase 2 Design Decisions

Unifies ELEV-003 `elevation/` pipeline with ADR-004 `graph/elevation_spec.py`
via ProjectionStrategy pattern, splits rendering into DrawingContext +
RenderBackend, adds annotation passes and serialization.

| ID | Decision | Rationale |
|----|----------|-----------|
| D11 | `ProjectionStrategy` ABC in `projection.py` | Unifies EntityProjection (Phase 1) and SpecProjection (Phase 2) behind common interface; both produce `ProjectionOutput` |
| D12 | `DrawingContext` + `RenderBackend` ABC split | DrawingContext manages document lifecycle (layers, transactions, extents); RenderBackend handles pure drawing primitives; eliminates mixed responsibilities |
| D13 | `ElevationSerializer` replaces DictBackend concept | Serialization/export is not rendering — `ElevationSerializer` converts entities to dict/JSON, separate from `RenderBackend` |
| D14 | MCP handler auto-detects input path | `_try_build_elevation_spec()` attempts ArchitectureGraph first; falls back to classified entities; no `input_mode` parameter needed |
| D15 | Layered test strategy | Projection → SpecProjection → Annotation → Layout → Backend → Serializer; each layer testable independently without COM |
| D16 | `generate_from_classified()` / `generate_from_spec()` as separate methods | No conditional branching in service; each method delegates to `_run_pipeline(strategy)` with clear responsibility |
| D17 | `SpecProjection` inside `projection.py` (not adapter) | SpecProjection converts ElevationSpec → ProjectionOutput in the projection module; follows ProjectionStrategy pattern naturally |
| D18 | `AnnotationState` dataclass replaces `AnnotationContext.extra: dict` | Typed fields (`wall_chainages`, `opening_faces`) prevent string-key fragility as annotation passes grow |

### New Files (Phase 2)

| File | Purpose |
|------|---------|
| `elevation/annotation_passes.py` | DoorTagPass, WindowTagPass, GridPass |
| `elevation/backend.py` | DrawingContext ABC + RenderBackend ABC + ZWCADContext + ZWCADRenderer |
| `elevation/serializer.py` | ElevationSerializer (entity → dict/JSON) |
| `tests/test_elevation_pipeline.py` | 29 layered tests (Projection, SpecProjection, Annotation, Layout, Backend, Serializer) |

### Modified Files (Phase 2)

| File | Changes |
|------|---------|
| `elevation/projection.py` | Added `ProjectionStrategy` ABC, `EntityProjection`, `SpecProjection` |
| `elevation/models.py` | Added `AnnotationState` dataclass |
| `elevation/service.py` | Renamed `generate()` → `generate_from_classified()`; added `generate_from_spec()` + `_run_pipeline()` |
| `elevation/layout.py` | Added degenerate elevation warning |
| `elevation/annotation.py` | No structural change; `AnnotationContext.extra` carries `AnnotationState` |
| `elevation/__init__.py` | Exports all Phase 2 types |
| `cad_io/com_bridge.py` | `_try_build_elevation_spec()` auto-detection; handler uses dual path |
| `cad_io/server.py` | Updated MCP tool description |

---

## 12. Acceptance Criteria

**Phase 1:**
- [x] Elevation entities drawn on XY plane (Z=0), visible in Top View
- [x] 4-direction elevations placed side-by-side along X axis (horizontal layout)
- [x] `layout="vertical"` places elevations stacked along Y axis
- [x] GL/FL level marks and floor height dimensions correctly positioned
- [x] Undo protection (exception → rollback) working
- [x] `ElevationService` callable independently of MCP
- [x] No `height_axis` parameter anywhere
- [x] Projection outputs Local Coordinate (origin-based)
- [x] Renderer has no coordinate system knowledge
- [x] Role→Layer mapping in render phase only
- [x] ELEV-003 ADR document created

**Phase 2:**
- [x] `ProjectionStrategy` ABC with `EntityProjection` + `SpecProjection`
- [x] `generate_from_classified()` and `generate_from_spec()` as separate methods
- [x] `DrawingContext` ABC + `RenderBackend` ABC in `backend.py`
- [x] `ElevationSerializer` for entity export
- [x] DoorTagPass, WindowTagPass, GridPass annotation passes
- [x] `AnnotationState` dataclass replaces `extra: dict`
- [x] MCP handler auto-detects graph availability (no `input_mode` param)
- [x] All 29 new tests passing, zero regressions on existing tests

---

## 13. Related

- **ADR-001**: Architecture Graph — future input for Projection (Phase 2)
- **ADR-004**: CAD Intelligence Pipeline — overall MCP pipeline design
- **ELEV-001**: Deprecated v1 elevation design
- **ELEV-002**: Current wall-centric elevation design (handlers in com_bridge.py)
