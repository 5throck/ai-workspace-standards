# FACADE-002: Multi-Floor Facade with Roof & Typical Floor Patterns

> **Spec ID**: FACADE-002
> **Version**: 1.1
> **Status**: Implemented
> **Created**: 2026-07-08
> **Updated**: 2026-07-08 — implementation complete: `facade_assembler.py` (BuildingAssembler), `facade_pattern.py` (FacadePatternApplier), 10 new types added to `facade_model.py`
> **Authors**: architect
> **Source**: FACADE-001 extension — user-proposed multi-floor stacking with pattern-based facade differentiation.
> **Supersedes**: None (extends FACADE-001)
> **Related**: [`FACADE-001`](FACADE-001-facade-mesh-pipeline.md) (single-floor facade mesh pipeline), [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md) (Phase 5b), [`ADR-a`](../adr/ADR-016-face-elevation-architecture.md) (Surface Protocol)

---

## 1. Overview

FACADE-002 extends the Facade Mesh Pipeline (FACADE-001) from single-floor to multi-floor buildings. Given a single-floor template FacadeModel and a config-driven building specification, it produces a complete multi-story 3D facade mesh with:

- **Floor stacking**: Clone + Z-translate template walls per floor
- **Pattern differentiation**: Ground floor (lobby/entrance) vs typical residential vs penthouse
- **Roof parapet**: Flat roof with parapet walls following building footprint exterior
- **Config-driven input**: No graph Floor nodes required — all multi-floor info from BuildingConfig

**Design thesis**: Korean apartments are 15-25 story buildings where 90%+ of floors are identical "typical" residential floors. Rather than modeling each floor individually, the pipeline clones a template floor and applies per-floor patterns for the few floors that differ (ground, penthouse, mechanical).

---

## 2. Pipeline Integration

```
FACADE-001 (unchanged):
  ArchitectureGraph → FacadeBuilder → FacadeModel (single-floor template)

FACADE-002 (new, optional):
  FacadeModel (template) + BuildingConfig
    → FacadePatternApplier (apply patterns to FloorFacade)
    → BuildingAssembler (clone, Z-translate, parapet, assemble)
    → FacadeModel (multi-floor)

Full pipeline:
  ArchitectureGraph → FacadeBuilder → [optional: PatternApplier + Assembler] → MeshBuilder → Exporter
```

The assembler is inserted between Builder and MeshBuilder. When `building_config=None`, behavior is identical to FACADE-001.

---

## 3. Architecture

```
BuildingConfig (config-driven input)
  ├─ BuildingGeometryConfig
  │    ├─ num_floors, slab_thickness
  │    ├─ ground_template: FloorTemplate
  │    ├─ typical_template: FloorTemplate
  │    └─ roof: RoofConfig (parapet)
  └─ BuildingAppearanceConfig
       ├─ wall_material
       └─ glass_material

FacadePipeline.run(graph, building_config=None)
  │
  ├─ FacadeBuilder.build() → FacadeModel (single-floor template)
  │
  ├─ [if building_config]:
  │    ├─ BuildingAssembler._create_floor_facades(template, geo_config)
  │    │    └─ For each floor: clone template → FloorFacade (Z-translated walls)
  │    │       └─ FloorTemplate.label → FloorMetadata.label (C1)
  │    ├─ FacadePatternApplier.apply(floor_facade)
  │    │    └─ Adjust wall height, openings per FacadePattern
  │    ├─ BuildingAssembler._build_parapet(footprint, parapet_config, elevation)
  │    │    └─ Trace footprint.exterior only (C3)
  │    └─ BuildingAssembler._assemble_model(all_facades, parapet)
  │         └─ Concat: 1F → 2F → … → top floor → parapet (C4)
  │
  ├─ FacadeMeshBuilder.build(facade_model)  ← unchanged
  ├─ FacadeExporter.export(mesh, path, format, appearance)  ← appearance consumed here (C5)
  └─→ FacadeResult
```

---

## 4. Module Structure

```
src/cad_intelligence/facade/
  __init__.py               # add new exports
  facade_model.py           # + FloorUsage, FacadePattern, FloorMetadata, FloorFacade,
                             #   FloorTemplate, ParapetConfig, RoofConfig,
                             #   BuildingGeometryConfig, BuildingAppearanceConfig, BuildingConfig
  facade_pattern.py          # NEW: FacadePatternApplier
  facade_assembler.py        # NEW: BuildingAssembler
  facade_builder.py          # unchanged
  facade_mesh_builder.py     # unchanged
  facade_exporter.py         # unchanged
  facade_pipeline.py         # + building_config parameter
  errors.py                  # unchanged

tests/facade/
  test_facade_model.py       # +12 tests (new data models)
  test_facade_assembler.py   # NEW: ~12 tests
  test_facade_pattern.py     # NEW: ~8 tests
  test_facade_pipeline.py   # +2 tests (backward compat)
```

---

## 5. Data Models

### 5.1 FloorUsage

```python
class FloorUsage(str, Enum):
    """Building floor purpose — what the floor IS, not how it looks."""
    GROUND = "ground"
    RESIDENTIAL = "residential"
    OFFICE = "office"
    COMMERCIAL = "commercial"
    HOTEL = "hotel"
    RETAIL = "retail"
    PARKING = "parking"
    AMENITY = "amenity"
    MECHANICAL = "mechanical"
    PENTHOUSE = "penthouse"
```

`FloorUsage` describes purpose. `FacadePattern` describes expression. The same pattern can apply across different usages.

### 5.2 FacadePattern

```python
@dataclass(frozen=True)
class FacadePattern:
    """Opening/appearance configuration for one floor's exterior.

    FACADE-003 decomposition note: as balcony, mullion, curtain wall, louver,
    shading are added, this class should decompose into composed sub-patterns
    (OpeningPattern, EntrancePattern, WindowBandPattern, etc.). For v2
    (FACADE-002), all fields are opening-related — single cohesive responsibility.
    """
    pattern_id: str              # identifier for logging/debugging ONLY (C2)
    wall_height_ratio: float     # fraction of floor_height used for wall (0.0–1.0)
    sill_height: float | None = None       # override default sill height (mm)
    window_height: float | None = None     # override default window height (mm)
    door_height: float | None = None       # override default door height (mm)
    has_entrance: bool = False             # large entrance opening
    entrance_width: float | None = None     # entrance opening width (mm)
    entrance_height: float | None = None    # entrance opening height (mm)
```

**C2 — pattern_id contract**: `pattern_id` is an identifier for debugging and logging. Code MUST NOT branch on `pattern_id` string values (e.g., `if pattern.pattern_id == "lobby"`). Pattern behavior is determined entirely by its field values.

### 5.3 FloorMetadata

```python
@dataclass(frozen=True)
class FloorMetadata:
    """Typed metadata for a FloorFacade. Replaces untyped dict."""
    label: str = ""               # e.g. "1F", "2F", "RF"
    notes: str = ""
    is_top_floor: bool = False
    is_bottom_floor: bool = False
```

### 5.4 FloorFacade

```python
@dataclass(frozen=True)
class FloorFacade:
    """Per-floor facade aggregate — the clone unit for multi-floor assembly.

    Relationship to FacadeModel:
    - FacadeModel is the FINAL assembled building (all floors flattened).
    - FloorFacade is an INTERMEDIATE per-floor aggregate (assembly-internal).
    - BuildingAssembler: template FacadeModel → FloorFacade[] → assembled FacadeModel.
    - The assembled FacadeModel.walls = concat of all FloorFacade.walls + parapet.
    - FacadeModel does NOT have a `floors` field.
    """
    floor_id: str
    usage: FloorUsage
    pattern: FacadePattern
    walls: Tuple[FacadeWall, ...]
    elevation: float               # Z base of this floor (mm)
    metadata: FloorMetadata = field(default_factory=FloorMetadata)
```

**C1 — label contract**: `FloorTemplate.label` is copied into `FloorMetadata.label` during floor facade creation. Template label is the config input; metadata label is the assembled floor's record.

### 5.5 FloorTemplate

```python
@dataclass(frozen=True)
class FloorTemplate:
    """Template for one floor type. Used as from_defaults() input."""
    usage: FloorUsage
    floor_height: float            # floor-to-floor height (mm)
    pattern: FacadePattern
    label: str = ""               # copied to FloorMetadata.label (C1)
```

### 5.6 Roof & Parapet

```python
@dataclass(frozen=True)
class ParapetConfig:
    height: float = 1200.0         # mm
    thickness: float = 150.0       # mm

@dataclass(frozen=True)
class RoofConfig:
    """v1: flat roof only. No RoofType enum — add when 2nd roof type is needed."""
    parapet: ParapetConfig = field(default_factory=ParapetConfig)
```

### 5.7 BuildingConfig

```python
@dataclass
class BuildingGeometryConfig:
    """Structural/geometry parameters for building assembly."""
    num_floors: int
    slab_thickness: float = 150.0  # mm
    ground_template: FloorTemplate = field(default_factory=lambda: FloorTemplate(
        usage=FloorUsage.GROUND,
        floor_height=3500.0,
        pattern=FacadePattern(pattern_id="lobby", wall_height_ratio=1.0, has_entrance=True),
        label="1F",
    ))
    typical_template: FloorTemplate = field(default_factory=lambda: FloorTemplate(
        usage=FloorUsage.RESIDENTIAL,
        floor_height=2800.0,
        pattern=FacadePattern(pattern_id="typical", wall_height_ratio=1.0),
        label="",
    ))
    roof: RoofConfig = field(default_factory=RoofConfig)

    @classmethod
    def from_defaults(
        cls,
        num_floors: int,
        ground_template: FloorTemplate | None = None,
        typical_template: FloorTemplate | None = None,
        roof: RoofConfig | None = None,
        slab_thickness: float = 150.0,
    ) -> "BuildingGeometryConfig": ...

@dataclass
class BuildingAppearanceConfig:
    """Visual parameters. Consumed only by Pipeline → Exporter (C5)."""
    wall_material: FacadeMaterial = FacadeMaterial.WALL
    glass_material: FacadeMaterial = FacadeMaterial.GLASS

@dataclass
class BuildingConfig:
    """Top-level building assembly configuration."""
    geometry: BuildingGeometryConfig
    appearance: BuildingAppearanceConfig = field(default_factory=BuildingAppearanceConfig)

    @classmethod
    def from_defaults(cls, num_floors: int, **kwargs) -> "BuildingConfig":
        return cls(geometry=BuildingGeometryConfig.from_defaults(num_floors, **kwargs))
```

---

## 6. Implementation Contracts

| # | Contract | Rationale |
|---|----------|-----------|
| C1 | `FloorTemplate.label` → `FloorMetadata.label` (copied, not duplicated) | Prevents confusion about two label fields |
| C2 | `pattern_id` is identifier only — no string-based dispatch | Pattern behavior = field values, not name |
| C3 | Parapet uses `footprint.exterior` only; interior rings ignored | Prevents interior parapet in courtyard buildings |
| C4 | Assembly order: 1F → 2F → … → top floor → parapet (deterministic) | Easier debugging/testing |
| C5 | `BuildingAppearanceConfig` consumed only by Pipeline → Exporter | Geometry layers must not reference appearance |

---

## 7. FacadePatternApplier

```python
class FacadePatternApplier:
    """Applies FacadePattern to FloorFacade walls.

    Responsibilities (and ONLY these):
    - Adjust wall height via wall_height_ratio × floor_height
    - Override sill_height, window_height, door_height if pattern specifies
    - Add entrance opening if has_entrance

    Does NOT: clone walls, Z-translate, build parapet, or reference appearance.
    Uses dataclasses.replace() — never mutates input.
    """

    def apply(self, floor_facade: FloorFacade) -> FloorFacade: ...
```

---

## 8. BuildingAssembler

```python
class BuildingAssembler:
    """Composes multi-floor building from single-floor FacadeModel + BuildingConfig.

    Responsibilities (and ONLY these):
    1. Generate FloorFacade per floor by cloning template
    2. Z-translate each FloorFacade's walls to correct elevation
    3. Build parapet from footprint exterior at roof level (C3)
    4. Concatenate all walls into final FacadeModel (C4)

    Does NOT: modify openings, patterns, or materials.
    """

    def __init__(self, pattern_applier: FacadePatternApplier | None = None): ...
    def assemble(self, template: FacadeModel, config: BuildingConfig) -> FacadeModel: ...

    # Private:
    def _create_floor_facades(self, template, geo_config) -> List[FloorFacade]: ...
    @staticmethod
    def _translate_wall(wall: FacadeWall, elevation: float, height: float) -> FacadeWall: ...
    def _build_parapet(self, footprint, parapet, total_elevation) -> Tuple[FacadeWall, ...]: ...
    def _assemble_model(self, template, facades, parapet, config) -> FacadeModel: ...
```

### Parapet Generation (C3)

Parapet walls are generated by tracing `footprint.exterior.coords`. Each exterior edge becomes a FacadeWall:
- `height = parapet.height`
- `thickness = parapet.thickness`
- `origin = (edge_start_x, edge_start_y, total_elevation)`
- No openings
- Interior rings (courtyards/holes) are explicitly ignored

### Elevation Accumulation

Floor Z positions are computed cumulatively:
```
Floor 0 (ground): Z = 0
Floor 1 (first typical): Z = ground.floor_height
Floor 2: Z = ground.floor_height + typical.floor_height
...
Floor N: Z = ground.floor_height + (N-1) × typical.floor_height
Parapet: Z = sum of all floor heights
```

---

## 9. Test Plan (~32 tests)

| Category | Tests | Focus |
|----------|-------|-------|
| Data models | 12 | Construction, frozen immutability, FloorUsage enum, FacadePattern defaults, FloorMetadata, FloorFacade, FloorTemplate, BuildingConfig.from_defaults() |
| Assembler: clone | 4 | Z-translate, deep clone (`is not`), height override |
| Assembler: parapet | 3 | Generation, continuity (closed footprint), interior ring exclusion (C3) |
| Assembler: assemble | 3 | Full pipeline, immutability (template unchanged), C1 label copy |
| Assembler: elevation | 1 | Accumulation: 3500, 2800, 2800 → Z=0, 3500, 6300 |
| Assembler: order | 1 | C4: concat sequence 1F→2F→…→parapet |
| Pattern: apply | 6 | Height adjustment, sill/window/door override, entrance |
| Pattern: isolation | 2 | Ground pattern change → typical unaffected |
| Pipeline | 2 | Backward compat (`building_config=None`), multi-floor integration |

---

## 10. Design Decisions

| DD | Decision | Rationale |
|----|----------|-----------|
| 01 | `FloorFacade` as clone unit (walls + pattern + metadata) | Higher abstraction than "clone FacadeWall list"; decorations/extension built-in |
| 02 | `FloorUsage` (purpose) separated from `FacadePattern` (expression) | Same pattern across usages; avoids enum conflation |
| 03 | `FacadePatternApplier` separate from `BuildingAssembler` | Assembler = geometry only; Pattern = expression only |
| 04 | `FloorTemplate` in `from_defaults()`, not raw heights | Extensible; add fields without changing signature |
| 05 | `BuildingConfig` split: Geometry + Appearance | Geometry grows with floors/roof; Appearance grows with materials |
| 06 | No `RoofType` enum (only flat in v1) | Add enum when 2nd roof type is needed |
| 07 | `dataclasses.replace()` for frozen clone | Explicit immutability guarantee |
| 08 | `building_config` optional in pipeline | Full backward compatibility with FACADE-001 |
| 09 | `from_defaults()` explicit params, not `**overrides` | IDE support, typo detection at compile time |
| 10 | Assembler before Pattern in implementation order | Assembler is core structure; Pattern operates on its output |

---

## 11. Scope

### In Scope (v2)
- Multi-floor stacking from single-floor template
- Config-driven floor specification (FloorTemplate, BuildingConfig)
- FacadePattern per floor (wall height, opening overrides, entrance)
- Flat roof parapet (footprint exterior only)
- BuildingAssembler (clone, Z-translate, parapet, assemble)
- FacadePatternApplier (pattern → openings)
- FloorUsage enum (purpose classification)
- FloorMetadata (typed, not dict)
- Backward compatibility with FACADE-001

### Out of Scope
- Gable/hip/complex roof types
- FloorFace/CeilingFace horizontal surfaces
- Balcony extrusion geometry (opening only)
- Graph-driven floor extraction (Floor/Building nodes)
- Curtain wall system
- Multi-building (still single Building)
- FacadePattern decomposition into sub-patterns (FACADE-003)
- MaterialConfig/ColorConfig/TextureConfig split
- `pattern_id`-based dispatch logic

### Future Extensibility
- **FACADE-003**: FacadePattern decomposition (OpeningPattern, EntrancePattern, WindowBandPattern, CurtainWallPattern, BalconyPattern)
- **FACADE-004**: FloorFace/CeilingFace horizontal surfaces for full envelope
- **FACADE-005**: Graph-driven floor extraction from ArchitectureGraph Floor/Building nodes
- **FACADE-006**: RoofType expansion (gable, hip, mansard)
- **FACADE-007**: MaterialConfig → ColorConfig → TextureConfig hierarchy
- **FACADE-008**: Multi-building assembly (campus, complex)
