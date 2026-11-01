# SECT-001: Section Cut Generation

> **Spec ID**: SECT-001
> **Version**: 1.1
> **Status**: Implemented (M4 scope — cut-line spec, shapely wall-intersection, section-view drawing generation)
> **Created**: 2026-07-05
> **Updated**: 2026-07-09 — M4 implementation landed under `src/cad_intelligence/section/`; `zwcad_generate_section` MCP tool registered.
> **Authors**: architect
> **Pattern**: Rule 1
> **Rationale**: deterministic geometry computation + drawing/view generation
> **Source**: V3 completion — feature specification for section cut generation
> **Related**: [`GRAPH-001`](GRAPH-001-design.md) (Data Sources), [`API-001`](API-001-design.md) (MCP Tool), [`TEST-001`](TEST-001-design.md) (Verification), [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md) §13.1 (Rule 1 — Self-Contained Orchestrator)

---

## 0. Implementation Notes (2026-07-09)

M4 scope implemented under `src/cad_intelligence/section/` (`model.py`, `builder.py`, `exporter.py`), following the Rule 1 self-contained orchestrator shape of `facade/` (`FacadePipeline`) and `elevation/` (`ElevationPipeline`). MCP tool `zwcad_generate_section` registered as a COM-free handler in `src/cad_intelligence/cad_io/handlers/section.py`, following the same COM-free convention already used by `handlers/takeoff.py`.

Two implementation-driven, additive (non-breaking) signature adjustments to the Stage C0 skeleton, made because the stub signatures could not carry the data the real geometry needed — neither changes the Rule 1 fit:

- `WallIntersection` gained an `offset_on_wall` field (chainage along the wall's own axis from `wall.start`, using the same convention as `Door.position_on_wall`/`Window.position_on_wall`). Door/window matching (§2.2) requires comparing against wall-local chainage, which is a different axis from `position` (chainage along the *cut line*) whenever the cut line isn't exactly perpendicular to the wall.
- `SectionBuilder.add_dimensions()` gained `intersections` and `cut_line` parameters (stub signature was `(entities, rooms)`, which had no way to reach dimension geometry — wall positions/heights — or the section label text).

No dedicated `wall_type` or `thickness` field exists on `Wall` (`common/models.py`), matching the same gap already present for `facade/facade_builder.py`. Wall type is classified heuristically from room-adjacency count (0 rooms -> structural, 1 -> exterior, 2 -> partition), mirroring facade's `AdjacencyResult` signal; wall thickness falls back to a 200mm default (same value and fallback convention as `FacadePipelineConfig.default_wall_thickness`).

Auto-generated cut lines (§1.2) use the building-footprint midline (bounding-box center) rather than actual stair/building-core detection — full structural-location detection is a reasonable M5-level extension, not specified further in this design's M4 Implementation Notes (§6).

---

## Scope

Automated generation of architectural section drawings — cutting through the building at user-specified locations and producing 2D section views.

---

## 1. Section Cut Specification

### 1.1 Cut Line Definition

| Parameter | Type | Description |
|-----------|------|-------------|
| `start` | `tuple[float, float]` | Cut line start point (mm) |
| `end` | `tuple[float, float]` | Cut line end point (mm) |
| `direction` | `str` | View direction (perpendicular to cut line) |
| `label` | `str` | Section label (e.g., "A-A", "B-B") |

### 1.2 Cut Line Input Methods

1. **User-defined**: explicit coordinates via MCP tool parameter
2. **Auto-generated**: at significant structural locations (through stairs, at building core)
3. **Room-based**: through the center of a specified room

---

## 2. Wall Intersection Algorithm

### 2.1 Process

1. For each wall segment, compute intersection with the cut line
2. At each intersection, extract:
   - Wall thickness (double-line detection)
   - Wall type (structural/partition/exterior)
   - Wall height
3. Sort intersections along the cut line
4. Fill wall sections with hatch patterns (concrete, brick)

### 2.2 Openings in Section

When the cut line passes through a door or window:
- Door: open void in wall (no fill)
- Window: glass symbol (parallel lines with gap)

---

## 3. Section View Output

### 3.1 Drawing Elements

| Element | Layer | Description |
|---------|-------|-------------|
| Cut line | `A-SECT-CUT` | Original cut line on floor plan |
| Section outline | `A-SECT-OUTLINE` | Wall outlines in section view |
| Section fill | `A-SECT-HATCH` | Hatch patterns (concrete, brick) |
| Dimensions | `A-SECT-DIMS` | Floor heights, wall heights |
| Labels | `A-SECT-LBL` | Section label, room names, level marks |

### 3.2 Layout

- Section view placed on XY plane (Z=0), visible in Top View
- Positioned at a configurable offset from the floor plan
- Floor height marks (GL/FL) at wall bases and tops

---

## 4. Data Sources

Per [`GRAPH-001`](GRAPH-001-design.md):

| Data | Graph Node | Field |
|------|-----------|-------|
| Wall geometry | `Wall` | start, end, thickness_mm, height_mm, wall_type |
| Door positions | `Door` | position, width_mm, height_mm |
| Window positions | `Window` | position, width_mm, sill_height_mm |
| Floor levels | `Floor` | level, elevation_mm |
| Room labels | `Room` | name |

---

## 5. MCP Tool

```
zwcad_generate_section
  Input:
    - cut_start: [float, float]
    - cut_end: [float, float]
    - direction: str ("left" | "right" | default: auto)
    - label: str (default: "A-A")
    - floor_height: float (default: 2800)
    - draw_dimensions: bool (default: true)
    - include_hatch: bool (default: true)
  Output:
    - status: "success"
    - section_entities: list
    - cut_intersections: list
    - exceptions: list
```

---

## 6. Implementation Notes

- **M4 scope**: Basic section through walls with hatch
- **M5 scope**: Door/window treatment, dimension automation, multi-section layout
- **Algorithm**: shapely `intersection()` for cut line ↔ wall segment

---

## 7. Test Strategy

Per [`TEST-001`](TEST-001-design.md):

- Unit: intersection computation for simple L-shaped plan
- Integration: full section generation on reference DWG
- Mutation: cut line through no walls, through single wall, through wall with door
