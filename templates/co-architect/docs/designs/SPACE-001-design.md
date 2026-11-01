# SPACE-001: Open Plan Boundary Reconstruction

> **Spec ID**: SPACE-001
> **Version**: 1.1
> **Status**: Implemented (WP5)
> **Created**: 2026-07-05
> **Updated**: 2026-07-05
> **Authors**: architect
> **Source**: V3 completion — open-plan boundary reconstruction for LDK (living-dining-kitchen) spaces
> **Related**: [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`GRAPH-001`](GRAPH-001-design.md) (Data Model, Query API), [`REVIEW-AGENT-001`](REVIEW-AGENT-001-design.md) (Validation), [`TEST-001`](TEST-001-design.md) (Verification)
> **Implementation**: `src/cad_intelligence/common/models.py`, `src/cad_intelligence/geometry/space_geometry.py`, `tests/test_open_plan.py`

---

## Scope

This document defines the **open-plan boundary reconstruction** algorithm — how the system identifies and resolves boundaries for open-plan spaces (e.g., LDK — living-dining-kitchen) that lack full wall enclosure in the DWG.

---

## 1. Problem Statement

Korean apartment floor plans frequently feature **open-plan spaces** where living, dining, and kitchen areas share a single large polygon without full wall separation. The current polygonization pipeline (`_build_space_polygons`) produces one large polygon for the entire LDK area, which is technically correct but semantically insufficient:

- The single polygon cannot be mapped to multiple room entries in `room_info.json`
- Downstream consumers (schedules, elevations, takeoffs) need per-room boundaries
- The user expects separate room polygons for Living Room, Dining, and Kitchen

### 1.1 Current Behavior

```
_build_space_polygons(wall_segments, openings, axis_grid)
  → polygonize network
  → one large polygon for entire LDK
  → no divider detection (old placeholder removed in WP5)
```

### 1.2 WP5 Behavior

```
_build_space_polygons(wall_segments, openings, axis_grid, divider_lines=None)
  → polygonize network (divider_lines injected as temporary walls if provided)
  → sub-polygons for each open-plan zone
```

---

## 2. API Change

### 2.1 New Parameter: `divider_lines`

```python
def _build_space_polygons(
    wall_segments: list[WallSegment],
    openings: list[DoorEntity | WindowEntity],
    axis_grid: "AxisGrid | None" = None,
    divider_lines: list[LineString] | None = None,  # NEW
) -> tuple[list[SpacePolygon], list[ExceptionReport]]:
```

When `divider_lines` is provided, the polygonization pipeline inserts these lines as temporary walls before polygonization. When `None` (default), behavior is identical to before WP5.

### 2.2 DividerLine Data Model

```python
@dataclass(frozen=True)
class DividerLine:
    id: str              # Geometry-based deterministic ID (sha1 of sorted+rounded endpoints)
    start: Point          # Start point (mm)
    end: Point            # End point (mm)
    source_type: str      # "room_metadata" | "architecture_graph" | "layer" | "annotation" | "ai" | "voronoi"
    confidence: float     # 0.0–1.0 — overridden by DividerScorer
    metadata: dict        # {"room_id", "layer_name", "graph_wall", "annotation_id"}
```

**Direction-normalized ID**: `sorted(start, end)` before SHA-1 hashing ensures A→B and B→A produce the same ID.

---

## 3. Divider Source Priority

Divider lines are resolved from multiple sources in a fixed priority order. Higher-priority sources take precedence; lower-priority sources are used only if higher-priority sources return no results (first-wins mode in M3; merge mode deferred to M4+).

| Priority | Source | Confidence | Status | Description |
|----------|--------|------------|--------|-------------|
| 1 | **Room Metadata** | 0.95 | Implemented | `room_info.json` `divider_line` field — user-provided coordinates |
| 2 | **Architecture Graph** | 0.80 | Implemented | Wall adjacency + door continuity heuristics from Semantic Graph |
| 3 | **Layer** | 0.30 | Implemented (signal only) | DWG layer classified as "divider"/"open-plan" — entity geometry extraction deferred to M4 |
| 4 | **Annotation** | 0.50 | Stub | Dimension/text markers at open-plan boundary |
| 5 | **AI Inference** | 0.60 | Stub | LLM-suggested split line based on room labels and geometry |
| 6 | **Voronoi** | 0.20 | Stub | Automatic split by room-label centroid positions |

### 3.1 Priority Change from v1.0

v1.0 had Layer as the highest priority. This was revised after review:
- **Layer names are unreliable** — no standardized naming convention across drawings
- **Room metadata is authoritative** — user-provided, explicit intent
- **Architecture Graph is deterministic** — derived from confirmed semantic nodes

---

## 4. Divider Pipeline Architecture

```
DividerProvider (Priority 1–6, Protocol)
       ↓
DividerResolver (mode="first" | mode="merge")
       ↓
DividerScorer (ScoringStrategy — pluggable)
       ↓
DividerValidator (per-divider rejection with DividerValidation)
       ↓
DividerProcessor (Normalize → Snap → Merge → Inject)
       ↓
DividerPipelineResult (generated_lines, warnings, statistics)
```

### 4.1 DividerProvider Protocol

```python
class DividerProvider(Protocol):
    def provide(self, context: SpaceDetectionContext) -> list[DividerLine]: ...
```

Concrete providers (M3):
- `RoomMetadataDividerProvider` — extracts `divider_line` from room_info entries
- `GraphConstraintDividerProvider` — uses Semantic Graph (Wall `bounded_by` Room adjacency, Door continuity)
- `LayerDividerProvider` — uses `drawing_metadata.layer_roles` for "divider"/"open-plan" classified layers
- `AnnotationDividerProvider` — stub
- `AIInferenceDividerProvider` — stub
- `VoronoiDividerProvider` — stub

### 4.2 GraphConstraintDividerProvider — Implemented

Uses the Semantic Graph to infer divider positions from wall adjacency and room connectivity:

1. Find `Wall` nodes bounded by two `Room` nodes (via `BOUNDED_BY` edges)
2. Check if those rooms are connected by a `OPENS_TO`/`CONNECTED_TO` door edge
3. If no door: place a perpendicular divider at the shared wall's midpoint
4. Returns `DividerLine` with `source_type="architecture_graph"`, raw confidence 0.80

### 4.3 DividerResolver

Runs providers in priority order. Two modes:

```python
class DividerResolver:
    def __init__(self, providers, mode="first"): ...

    # mode="first" (M3 default): return first non-empty provider result
    # mode="merge" (M4+): collect all, deduplicate by ID
```

### 4.4 ScoringStrategy — Pluggable Scoring Interface

```python
class ScoringStrategy(Protocol):
    def score(self, divider: DividerLine) -> float: ...

# M3 default:
class WeightedScoringStrategy:
    SOURCE_CONFIDENCE = {
        "room_metadata": 0.95, "architecture_graph": 0.80,
        "layer": 0.30, "annotation": 0.50,
        "ai": 0.60, "voronoi": 0.20,
    }
    def score(self, divider): return 0.7 * base + 0.3 * raw
```

`DividerScorer` holds a `ScoringStrategy` instance — swappable for future `MLScoringStrategy`.

### 4.5 DividerValidator — Per-Divider Rejection

```python
@dataclass(frozen=True)
class DividerValidation:
    divider_id: str
    accepted: bool
    reason: str | None    # None if accepted; "crosses_wall" | "too_short" | "duplicate" | "insufficient_confidence"
    detail: str           # Additional diagnostic info
```

Rejection rules (in order):
1. `too_short` — length < `divider_min_length_mm` (500mm default)
2. `insufficient_confidence` — scorer confidence < `divider_confidence_accept` (0.5 default)
3. `crosses_wall` — divider intersects a wall at an interior point (not at endpoint)
4. `duplicate` — within snap tolerance of another accepted divider

### 4.6 DividerPipelineResult

```python
@dataclass
class DividerPipelineResult:
    generated_lines: list[LineString]     # Divider LineStrings for wall injection
    warnings: list[ExceptionReport]        # Non-blocking warnings
    statistics: dict                      # Diagnostic counters
    # Pre-filled statistics keys:
    #   "candidates": int, "accepted": int, "rejected": int,
    #   "reasons": {"crosses_wall": 2, "too_short": 1, ...},
    #   "provider": str, "resolver_mode": str, "scoring_strategy": str
```

---

## 5. Configuration

```python
@dataclass(frozen=True)
class SpaceDetectionConfig:
    open_plan_area_threshold_mm2: float = 40_000_000  # 40 m²
    divider_snap_tolerance_mm: float = 150.0
    divider_confidence_accept: float = 0.5
    divider_min_length_mm: float = 500.0
```

Provider-specific settings (e.g. `LayerDividerProvider.layer_confidence=0.3`) are scoped to each Provider's constructor, not to the pipeline config.

---

## 6. Context Object

```python
@dataclass
class SpaceDetectionContext:
    room_info: list[dict]
    drawing_metadata: dict | None
    graph: ArchitectureGraph | None
    space_polygons: list
    # Future expansion (M4+): door_candidates, window_candidates, layer_map, wall_graph, snap_cache
```

---

## 7. Algorithm: Open-Plan Boundary Reconstruction

### 7.1 Overview

```
_build_space_polygons(wall_segments, openings, axis_grid, divider_lines)
  Step 1: Wall segments → LineStrings
  Step 2: Inject divider_lines as temporary walls (if provided)
  Step 2.5: Merge thin-wall face pairs into centerlines (WallProcessingMode.ENDPOINT_CLUSTER only — see below)
  Step 3: Weld endpoints onto nearest segment
  Step 3.5: Axis snap (if axis_grid provided)
  Step 4: Bridge door/window gaps
  Step 5: polygonize_full(); dangles → UNCLOSED_WALLS
  Step 6: Filter slivers; assign deterministic auto_ids
  Step 7: Extract holes; normalize contained polygons
```

> **2026-07-31 update (post-implementation):** Two additions to this algorithm, both scoped to `src/cad_intelligence/geometry/space_geometry.py`, orthogonal to the divider pipeline described in this document:
> - **Step 2.5 (`_merge_wall_face_pairs`)** — fixes a defect where `_weld_endpoints_v2`/`_cluster_endpoints`'s transitive Union-Find chaining could incorrectly merge a thin wall's two opposite faces when the wall's thickness was smaller than `CORNER_SNAP_TOL` and one end was uncapped. A new pre-processing step recognizes near-parallel, closely-spaced, overlapping line-segment pairs as the two faces of one physical wall (mutual-best matching, 4-level deterministic tie-break) and replaces each matched pair with a single centerline *before* welding runs, so the ambiguity never reaches Step 3. Gated behind `WallProcessingMode.ENDPOINT_CLUSTER` (the default) — the legacy `LEGACY` mode is unaffected.
> - **`WallProcessingMode.SOLID_UNION`** — a structurally different, opt-in alternative to the entire Steps 3–7 endpoint-welding pipeline above: walls are represented as thickness-aware solid polygons, unioned via `shapely.ops.unary_union` (with `shapely.set_precision` for numerical stability), and room polygons are read directly off the union's interior rings — an area/topological operation with no endpoint-proximity graph step to confuse in the first place. A `_nest_columns_into_rooms` step prevents free-standing wall solids (e.g. structural columns) from appearing as false rooms. Entered via `_build_space_polygons_solid_union` — a separate, standalone entry point, not yet wired into `_build_space_polygons`'s main dispatcher.
>
> See `docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md` and `docs/superpowers/specs/2026-07-31-solid-union-room-detection-design.md` for full rationale.

### 7.2 Divider Resolution (External to _build_space_polygons)

The divider pipeline (`_create_default_divider_processor()`) runs externally
and produces `DividerPipelineResult` with `generated_lines`. These are
passed as `divider_lines` to `_build_space_polygons` for polygonization.

```python
processor = _create_default_divider_processor()
result = processor.process(context, wall_lines)
polygons, exceptions = _build_space_polygons(walls, openings, divider_lines=result.generated_lines)
```

---

## 8. Impact on Downstream Consumers

### 8.1 Direct Consumers

| Consumer | Impact | Change Required |
|----------|--------|----------------|
| Room mapping (`room_mapping.py`) | Receives multiple polygons per open-plan zone | Handle polygon-to-multi-room mapping |
| Elevation generation (`ELEV-002`) | More room polygons → more elevation strips | No change (per-polygon processing) |
| Schedules | Per-room area/volume calculations become accurate | Use sub-polygon areas |

### 8.2 Backward Compatibility

- When `divider_lines=None`: behavior is identical to pre-WP5 implementation
- No API change for MCP tools (divider resolution is internal)
- `_build_space_polygons` signature change is additive (new optional parameter)

---

## 9. Exception Codes

| Code | Severity | When |
|------|----------|------|
| `OPEN_PLAN_BOUNDARY_UNRESOLVED` | warning | No divider sources produced candidates (`reason="no_sources"`) or all candidates rejected (`reason="all_rejected"`) |
| `OPEN_PLAN_AREA_MISMATCH` | warning | Sub-polygon area sum doesn't match original |

### 9.1 Enhanced Exception Context

```python
ExceptionReport(
    code=OPEN_PLAN_BOUNDARY_UNRESOLVED,
    severity="warning",
    context={
        "reason": "all_rejected",
        "candidate_dividers": 8,
        "rejected_dividers": 8,
        "reasons": {"crosses_wall": 2, "too_short": 1, "insufficient_confidence": 2, "duplicate": 3},
    },
)
```

---

## 10. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D71 | Room Metadata as highest priority | User-provided, explicit intent; Layer names unreliable |
| D72 | Graph Constraint uses Semantic Graph | Confirmed identity (Wall, Room nodes) needed for reliable inference |
| D73 | Sorted-endpoint ID (A→B == B→A) | Direction-independent identity; avoids duplicate IDs from normalization order |
| D74 | ScoringStrategy as Protocol | Pluggable scoring; M3 uses WeightedScoringStrategy, M4+ can swap MLScoringStrategy |
| D75 | DividerValidation with per-divider reasons | Debugging + Golden DWG regression benefit; tracks why each divider was rejected |
| D76 | DividerPipelineResult with statistics | `candidates: 8, accepted: 3, rejected: 5` at a glance; essential for regression testing |
| D77 | Provider-specific config in constructor | `SpaceDetectionConfig` only holds pipeline-level settings; `LayerDividerProvider.layer_confidence` scoped locally |
| D78 | Resolver mode="first"/"merge" interface | M3 uses first-wins; merge mode ready for M4+ without structural change |
| D79 | Additive API change (`divider_lines` param) | Backward compatible — existing callers unaffected |
| D80 | Re-execution of polygonization | Reuses existing proven code; no new polygonization algorithm needed |

---

## Extension Points (M3 Scope)

The Divider pipeline intentionally exposes extension points (Provider, Resolver, Scorer, Validator) but M3 implements only the default path. Additional implementations (MergeResolver, MLScoringStrategy, DividerGeometryProcessor, Provider-specific Config) are deferred until justified by production requirements.

---

## Exit Criteria (WP5 — Met ✓)

- ✓ Divider source resolution correctly applies priority chain (Room Metadata → Architecture Graph → Layer → Annotation → AI → Voronoi)
- ✓ GraphConstraintDividerProvider implemented (uses Wall bounded_by Room adjacency + Door continuity check)
- ✓ DividerLine with direction-normalized ID (sorted endpoints before SHA-1)
- ✓ DividerResolver with first/merge mode interface
- ✓ DividerScorer with pluggable ScoringStrategy (WeightedScoringStrategy default)
- ✓ DividerValidator with per-divider rejection reasons (crosses_wall, too_short, duplicate, insufficient_confidence)
- ✓ DividerPipelineResult with generated_lines, warnings, statistics
- ✓ `_build_space_polygons` accepts `divider_lines` parameter (additive, backward compatible)
- ✓ Polygonize regression pass (existing space generation tests still pass with `divider_lines=None`)
- ✓ 64 COM-free unit tests covering all pipeline components
- ✓ Full regression suite: 1449 passed, 0 failed
- ✓ No downstream failures (elevation generation, room info unchanged)

---

## Document Dependencies

```
PIPELINE-001
      ↓
GRAPH-001              ← Query API for spatial queries, node types
      ↓
API-001
      ↓
TRANSACTION-001
      ↓
TEST-001
      ↓
REVIEW-AGENT-001       ← Validation rules for topology checks
      ↓
SPACE-001 (this doc)   ← Last consumer in the dependency chain
```
