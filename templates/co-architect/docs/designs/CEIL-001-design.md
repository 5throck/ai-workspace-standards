# CEIL-001: Ceiling Zone Model & Reflected Ceiling Plan

> **Spec ID**: CEIL-001
> **Version**: 1.1
> **Status**: Implemented (M5 basic scope — downlight grids only, no HVAC/sloped ceilings)
> **Created**: 2026-07-05
> **Updated**: 2026-07-09 — M5 basic scope implemented (`src/cad_intelligence/ceiling/`, `zwcad_generate_rcp` MCP tool); previous: 2026-07-05 design-only stub
> **Authors**: architect
> **Pattern**: Rule 1
> **Rationale**: deterministic geometry computation (per-room polygon derivation, grid-layout fixture placement, point-in-polygon/obstruction filtering) + drawing/view generation (RCP outline, grid, fixtures, dimensions, labels) — matches ADR-007 §13.1, mirroring `section/`'s (SECT-001) already-approved Rule 1 fit.
> **Source**: V3 completion — feature specification for ceiling modeling
> **Related**: [`GRAPH-001`](GRAPH-001-design.md) (Data Model), [`SPACE-001`](SPACE-001-design.md) (Room Boundaries), [`TEST-001`](TEST-001-design.md) (Verification), [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md) §13.1 (Rule 1 — Self-Contained Orchestrator)

---

## 0. Implementation Notes (2026-07-09)

M5 basic scope implemented under `src/cad_intelligence/ceiling/` (`model.py`, `builder.py`, `exporter.py`), following the Rule 1 self-contained orchestrator shape of `facade/` (`FacadePipeline`) and `section/` (`SectionBuilder`). MCP tool `zwcad_generate_rcp` registered as a COM-free handler in `src/cad_intelligence/cad_io/handlers/ceiling.py`, following the same COM-free convention already used by `handlers/section.py` and `handlers/takeoff.py`.

Scope actually built: per-room `CeilingZone` derivation (zone polygon = room floor polygon via `BoundaryBuilder`, with a bounding-box-rectangle fallback for degenerate boundaries; no bulkhead/raised-ceiling subtraction), downlight-only fixture grid placement (bounding-box grid layout, point-in-polygon filtering for non-rectangular rooms, column-obstruction avoidance), and RCP drawing entity generation (`A-CEIL-OUTLINE`, `A-CEIL-GRID`, `A-CEIL-FIXT`, `A-CEIL-DIMS`, `A-CEIL-LBL`, `A-CEIL-TEXT`), offset below the floor plan bounding box per §4.2 step 1. `HVACZone` (§3.1) is defined for data-model parity but never constructed by `CeilingBuilder` — `include_hvac=True` is accepted by the MCP tool for schema parity but is a documented no-op (a note is appended to `exceptions`). Sloped/coffered ceilings and non-downlight fixture types (fluorescent, pendant, spotlight) raise a validation error / are simply out of scope, per §7.

Implementation-driven, additive (non-breaking) adjustments to the design stub, none of which change the Rule 1 fit:

1. **`CeilingZone` is not `frozen`** — the design stub marks it `@dataclass(frozen=True)`, but the builder attaches `light_fixtures` after the zone geometry is resolved (mirrors `WallIntersection.opening` in `section/model.py`, assigned post-construction for the same reason).
2. **`boundary: list[Point]` instead of `polygon: Polygon`** — a raw shapely `Polygon` field would make `CeilingResult` non-trivially JSON-serializable for the MCP response; `CeilingBuilder` reconstructs a shapely `Polygon` internally wherever point-in-polygon tests are needed (mirrors why `SectionEntity` never carries shapely geometry either).
3. **MCP tool `rooms` param split into `rooms` (full `Room.to_dict()` list, required) + `room_names` (optional name/id filter)** — the design stub's terse `rooms: list[str]` (§6) would collide with the `rooms` = `Room.to_dict()` list convention every other Application-layer MCP tool in this codebase already uses (`zwcad_generate_section`, `zwcad_generate_schedule`, `zwcad_generate_takeoff`).

---

## Scope

Ceiling zone model — defining ceiling regions, light fixture placement, HVAC zone boundaries, and reflected ceiling plan (RCP) output.

---

## 1. Ceiling Zone Model

### 1.1 CeilingZone Data Model

```python
@dataclass(frozen=True)
class CeilingZone:
    uid: str                     # "CEIL:NNNN"
    room_uid: str                # Parent room reference
    polygon: Polygon             # Ceiling boundary (may differ from floor plan)
    ceiling_height_mm: float    # Ceiling height from floor
    ceiling_type: str            # "flat" | "sloped" | "coffered" | "exposed"
    finish: str | None           # Ceiling finish material
    light_fixtures: list         # Embedded light fixture positions
    hvac_zones: list             # HVAC zone references
```

### 1.2 Zone Derivation

- **Default**: ceiling zone polygon = room floor polygon (from `Room.polygon`)
- **Adjustment**: subtract bulkhead zones, raised ceiling areas
- **Sloped ceilings**: polygon boundary may differ from floor boundary at ceiling height

### 1.3 Relationship to Graph

Per [`GRAPH-001`](GRAPH-001-design.md):

```
Room (node)
  └─ CONTAINS → CeilingZone (node)
                    ├─ CONTAINS → LightFixture (node)
                    ├─ CONTAINS → HVACZone (node)
                    └─ BOUNDED_BY → Bulkhead (Wall subtype)
```

---

## 2. Light Fixture Placement

### 2.1 Fixture Types

| Type | Description | Typical Size |
|------|-------------|-------------|
| `downlight` | Recessed downlight | 150mm Ø |
| `fluorescent` | Linear fluorescent | 600mm × 600mm / 1200mm × 300mm |
| `pendant` | Hanging pendant | Variable |
| `spotlight` | Directional spot | 100mm Ø |

### 2.2 Placement Algorithm

1. Compute ceiling zone polygon
2. Determine grid layout based on fixture type and room dimensions
3. Place fixtures at grid intersections (centered within zone)
4. Adjust for obstructions (bulkheads, columns, HVAC diffusers)
5. Verify illumination coverage (future: integrate with lighting calculation)

---

## 3. HVAC Zone Model

### 3.1 HVACZone Data Model

```python
@dataclass(frozen=True)
class HVACZone:
    uid: str
    zone_type: str       # "supply" | "return" | "exhaust"
    polygon: Polygon     # Zone boundary
    diffuser_positions: list[tuple[float, float]]
    thermostat_position: tuple[float, float] | None
```

### 3.2 Zone Derivation

- HVAC zones typically align with ceiling zones
- Supply zones follow room boundaries
- Return zones may span multiple rooms (common return plenum)

---

## 4. Reflected Ceiling Plan (RCP)

### 4.1 RCP Output

| Element | Layer | Description |
|---------|-------|-------------|
| Ceiling boundary | `A-CEIL-OUTLINE` | Ceiling zone outlines |
| Grid lines | `A-CEIL-GRID` | Fixture placement grid |
| Fixtures | `A-CEIL-FIXT` | Light fixture symbols |
| Diffusers | `A-CEIL-HVAC` | HVAC diffuser symbols |
| Dimensions | `A-CEIL-DIMS` | Grid spacing, zone dimensions |
| Labels | `A-CEIL-LBL` | Fixture types, zone labels |
| Ceiling height | `A-CEIL-TEXT` | Ceiling height annotation per zone |

### 4.2 RCP Generation

1. Offset ceiling zones to a reference point (below floor plan)
2. Draw zone boundaries
3. Place fixture symbols at grid positions
4. Add diffuser symbols for HVAC zones
5. Annotate with dimensions and labels

---

## 5. Data Sources

Per [`GRAPH-001`](GRAPH-001-design.md):

| Data | Source | Notes |
|------|--------|-------|
| Room boundaries | `Room.polygon` | Base for ceiling zones |
| Wall positions | `Wall.start`, `Wall.end` | Bulkhead boundaries |
| Floor height | `Room.floor_level` | Reference for ceiling height |
| Column positions | `Column.position` | Fixture placement avoidance |

---

## 6. MCP Tool

```
zwcad_generate_rcp
  Input:
    - rooms: list[str] (optional — room names; default: all rooms)
    - ceiling_height: float (optional — default per room or 2400mm)
    - fixture_type: str (default: "downlight")
    - grid_spacing: float (default: room-dependent)
    - include_hvac: bool (default: false)
  Output:
    - status: "success"
    - ceiling_zones: list
    - fixture_count: int
    - exceptions: list
```

---

## 7. Implementation Notes

- **M5 scope**: Basic ceiling zone model, downlight placement, RCP outline
- **M6+ scope**: Sloped ceilings, coffered ceilings, HVAC integration, lighting calculation
- This feature is design-only for V3; implementation begins in M5

---

## 8. Test Strategy

Per [`TEST-001`](TEST-001-design.md):

- Unit: zone polygon derivation, fixture grid calculation, boundary adjustment
- Integration: RCP generation on reference DWG
- Golden: expected RCP output for test drawing
