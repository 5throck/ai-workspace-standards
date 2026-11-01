# ADR: Four-Domain Face-Centered Elevation Architecture

> **Status**: Active (v14 — Design Freeze)
> **Created**: 2026-07-07
> **Updated**: 2026-07-12 — added the Renderer-layer ADR chain (ADR-aa through ADR-jj: style
> variants, capability/policy `RenderStyle` composition + style inheritance, symbol
> strategy + registry + symbol library, render pass pipeline, LayoutScene contract +
> validation, backend abstraction + recording backend, and Geometry/Rendering Golden with
> schema versioning + tolerance profiles), an ADR-p compliance-fix note, File Map entries
> #17–23, and an 11-phase Roadmap Addendum with an ADR Dependency Graph — across four rounds
> of architecture review same day. The fourth round shifted focus from "add more ADRs" to
> "verify the ones that exist": every ADR above now has an **Exit Criteria** checklist, a
> **Rendering Platform Complete** definition-of-done was added as the roadmap's terminal
> Phase 11, and a per-ADR implementability checklist (complexity/migration/testability/
> performance) was added as process guidance for whoever implements Phase 3+. Named
> Workflow B's `draw_*` functions an explicit deprecation target
> (`TODO(deprecation-target)` comment added in `scripts/draw_room1_elevations.py`) and
> clarified its two roles (Golden Fixture Generator vs Renderer Oracle) in
> `skills/generate-room-elevation/SKILL.md`. Fifth review same day added an
> **Implementation Governance** section (after "ADR Dependency Graph"): an **ADR Compliance
> Dashboard** (Status / Exit Criteria / Implementation counts per ADR — currently all 0
> implemented, tracked so "Accepted but unbuilt" or "built but Exit-Criteria-incomplete"
> drift is visible going forward), explicit **Proposed → Accepted promotion criteria**, an
> **Exit Criteria Automation Mapping** (grep/pytest/image-diff/snapshot-diff per ADR, with
> the grep-checkable ones recommended as an always-on CI step), **Implementation Epics**
> (ADR groups for Project/Milestone tracking), and a **ROI-driven implementation order**
> reconciled against the dependency-ordered Roadmap Addendum. See "ADR Dependency Graph,"
> "Implementation Governance," and "Roadmap Addendum" for the current, consolidated state —
> do not rely on this changelog note for phase numbers or counts, which shifted across
> revisions.
> **Supersedes**: ELEV-002 elevation handler (wall-unit strips)
> **Roadmap**: 10-PR implementation plan (M4–M6), 8 Future ADRs → Active

---

## Overview

This ADR defines the architecture for generating compass-ordered unfolded elevation
drawings from CAD floor plans. The core paradigm shift is:

- **Wall Segment = Geometry** (CAD line segments)
- **WallFace = Architecture** (surface with width, height, openings, local coordinate system)
- **Boundary = Topology** (organizes geometry into continuous boundary faces)
- **LayoutScene = Presentation** (positioned room blocks as scene graph)
- **Renderer = Draw-Only** (never computes geometry or visualization)

## Four-Domain Architecture

```
Geometry Domain ──────┐
                      ├─► Topology Domain ──────┐
                      │                          ├─► Architecture Domain ──► Presentation Domain ──► Renderer
                      └──────────────────────────┘
```

### Domain Responsibilities

| Domain | Contains | Responsibility |
|--------|----------|-----------------|
| **Geometry** | WallSegment, CompassFace, FaceCoordinateSystem, SolidPart computation | Raw spatial data and pure geometric calculations |
| **Topology** | BoundaryEdge, BoundaryFace, BoundaryLoop, BoundaryBuilder | Organizes geometry into continuous boundary faces |
| **Architecture** | WallFace, FaceOpening, DesignStandard, RoomFaceBuilder | Architectural meaning: surfaces, openings, validation |
| **Presentation** | UnfoldedRoom, RenderGeometry, LayoutScene, LayoutEngine | Visualization data and spatial arrangement |
| **Renderer** | ZWCADFaceRenderer, PDFRenderer, SVGRenderer, DXFRenderer | Pure drawing — never computes geometry |

### Dependency Rule (ADR-y)

Topology does NOT transform Geometry — it **organizes** Geometry.
Architecture references BOTH Geometry and Topology directly.
BoundaryLoop contains BoundaryEdge references (geometry) but WallFace contains
FaceOpenings (architecture). Neither "replaces" the other.

> Room has one BoundaryLoop (topology/geometry) and one or more WallFace
> (architectural meaning). BoundaryLoop describes how walls connect;
> WallFace describes what the wall surface looks like.

### Core Pipeline

```
handle_generate_wall_elevations(params)
  │
  ├─ [Topology] BoundaryBuilder(walls, centroids) → BoundaryLoop[]
  │
  ├─ [Architecture] build_all_room_faces(boundaries, doors, windows, standard)
  │   ├─ OpeningProjector → ProjectedOpening
  │   └─ WallFaceBuilder(boundary) → WallFace (validated)
  │
  ├─ [Geometry] compute_solid_parts(wall_face) per face
  │
  ├─ [Presentation] build_unfolded_rooms(wall_faces) → UnfoldedRoom[]
  ├─ [Presentation] RenderGeometryAssembler(unfolded, solids, config) → RoomRenderGeometry[]
  ├─ [Presentation] UnfoldedLayoutEngine(render_geoms, config) → LayoutScene
  │
  └─ [Renderer] ZWCADFaceRenderer.render(layout_scene) → ZWCAD entities  (draw-only)
```

---

## ADR Dependency Graph

Added 2026-07-12 (third architecture review) — the ADR count under "Renderer" alone
(ADR-p, aa, bb, cc, dd, ee, ff, gg, hh, ii, jj) is large enough that a first-time reader
needs an explicit map of which ADR is foundational and which extends it. Read top-to-bottom;
an arrow means "depends on" / "builds on," not "supersedes":

```
ADR-p   (Unfolded elevation direction convention: N-first, clockwise)
   │
   ▼
ADR-ee  (LayoutScene Contract — the ABI every producer/consumer below shares)
   │
   ├──► ADR-ii  (LayoutScene Validation — enforces the ADR-ee contract before Render/Golden)
   │
   ▼
ADR-bb  (Renderer + RenderStyle Composition — capabilities, policies, style inheritance)
   │
   ├──► ADR-gg  (Render Pass Pipeline — draw ORDER within one Renderer.render() call)
   │
   ▼
ADR-cc  (Symbol Strategy Pattern — pluggable door/window/material symbols)
   │
   ├──► ADR-jj  (Strategy Registry & Symbol Library — pluggable/registrable strategies + shared vector symbols)
   │
   ▼
ADR-ff  (RenderBackend Abstraction — Renderer never imports win32com directly)
   │
   ├──► ADR-hh  (Recording Backend — command-list capture; reused by Golden/Undo/Replay/Debug/Benchmark)
   │
   ▼
ADR-dd  (Golden Dataset — Geometry Golden + Rendering Golden, versioned, tolerance-profiled)
```

`ADR-z`/`ADR-s`/`ADR-t`/`ADR-x`/`ADR-y` (Renderer ABC, Draw-Only, Four-Domain, Geometry vs
Presentation Ownership, Dependency Graph) are the pre-existing foundational rules this
entire chain must stay consistent with — none of ADR-aa through ADR-jj may contradict them;
they refine "how Renderer is internally structured," not "what Renderer/Presentation may do."

---

## Implementation Governance

Added 2026-07-12 (fifth architecture review). The reviewer's core observation: an ADR set
this size (11 Renderer-layer ADRs, 34 total Exit Criteria) is exactly where **ADR drift**
happens — design and implementation silently diverge because nothing tracks "Accepted but
not built" or "built but doesn't satisfy its own Exit Criteria." This section is the
tracking mechanism, not new architecture.

### ADR Compliance Dashboard

**This table must be updated whenever an Exit Criteria item is checked off or an ADR's
`Status` changes — treat a stale row as a bug in this document, not a cosmetic issue.**
"Exit Criteria" is the checklist count from each ADR's own section above; "Implementation"
is how many of those are currently verifiably true against actual code (not "believed
true" — see Automation Mapping below for how each is meant to be checked).

| ADR | Status | Exit Criteria | Implementation |
|---|---|---|---|
| ADR-aa | Active | N/A (documents existing code, not a target) | N/A |
| ADR-bb | Implemented (2026-07-29) | 3/4 | 4/4 |
| ADR-cc | Implemented (2026-07-29) | 3/3 | 3/3 |
| ADR-dd | Proposed | 0/3 | 0/3 |
| ADR-ee | Accepted | 2/3 | 2/3 |
| ADR-ff | Partially Implemented (2026-07-30) | 2/4 | 2/4 |
| ADR-gg | Implemented (2026-07-29) | 2/3 | 2/3 |
| ADR-hh | Proposed | 0/3 | 0/3 |
| ADR-ii | Accepted | 1/3 | 1/3 |
| ADR-jj | Implemented (2026-07-29) | 2/2 | 2/2 |

*(ADR-ee and ADR-ii were promoted to Accepted on 2026-07-14 after verifying their core
implementations in `layout_engine.py`. All other ADRs bb–jj (excluding ee, ii) remain
design-only as of that date. The dashboard's value is in catching drift **after**
implementation starts, e.g. an ADR moved to `Accepted` before its Implementation column
reaches its Exit Criteria count, or an Exit Criteria count that silently stops matching the
ADR section's actual checklist because someone edited one without the other.)*

### Proposed → Accepted Promotion Criteria

An ADR only moves from `Proposed` to `Accepted` when **all** of the following hold —
subjective judgment ("looks done") does not promote an ADR's status:

1. **Exit Criteria: 100%** — every checklist item in the ADR's own section is checked.
2. **Reference Implementation complete** — for ADRs with a named reference implementation
   order (e.g. ADR-ff's `RecordingBackend → MatplotlibBackend → ZWCADBackend → ...`), at
   minimum the first reference implementation in that order exists and passes its Exit
   Criteria.
3. **Tests pass** — every Exit Criteria item that names a test (pytest, image-diff,
   snapshot-diff — see Automation Mapping below) has that test committed and green in CI,
   not just manually run once.
4. **No regression** — existing Golden Dataset fixtures (Geometry and, once ADR-dd's
   Rendering Golden exists, Rendering) still pass after the ADR's implementation lands.

An ADR that satisfies 1–4 for a subset of its Exit Criteria but not all of them stays
`Proposed` — there is no partial-`Accepted` state. This keeps the Dashboard's `Status`
column binary and unambiguous rather than requiring a reader to also check the
Implementation fraction to know if an ADR is trustworthy to build against.

### Exit Criteria Automation Mapping

Per-criterion CI method, aggregated per ADR (not every criterion is automatable the same
way — this table is descriptive of what exists in each ADR's checklist today, not a claim
that automation is already implemented):

| ADR | `grep`/static check | `pytest` (unit/integration) | image-diff | snapshot-diff | manual review |
|---|---|---|---|---|---|
| ADR-bb | 1 (no style-name string comparisons) | 2 | 1 | — | — |
| ADR-cc | 1 (no strategy type-branching) | 2 | — | — | — |
| ADR-dd | — | 2 | — | 1 | — |
| ADR-ee | — | 2 | — | 1 | — |
| ADR-ff | 1 (`import win32com` confined to `ZWCADBackend`) | 2 | 1 | — | — |
| ADR-gg | — | 2 | — | 1 | — |
| ADR-hh | — | 2 | — | 1 | — |
| ADR-ii | — | 3 | — | — | — |
| ADR-jj | — | 2 | 1 | — | — |

**The `grep`/static-check column is the cheapest signal and should run on every commit**,
not just at ADR-promotion time — e.g. a CI step `! grep -rn 'style.*==.*"detailed"'
src/cad_intelligence/elevation/renderers/` fails the build the moment someone reintroduces
the exact anti-pattern ADR-bb exists to remove, catching drift within one commit instead of
at the next full architecture review. Criteria with no cheap static check (most of
ADR-ii's, which are behavioral) rely on `pytest` integration tests instead — still
automated, just not free the way a grep is.

### Implementation Epics

ADRs are a design-time unit; implementation work crosses several ADRs at once. Group by
epic for GitHub Project/Milestone tracking instead of one issue per ADR:

| Epic | ADRs | Roadmap Phases |
|---|---|---|
| **Foundation: Contract & Validation** | ADR-ee, ADR-ii | 1–2 |
| **Workflow Convergence** | (uses ADR-ee/ii; no new ADR of its own) | 3 |
| **Renderer Unification** | ADR-bb, ADR-gg, ADR-cc, ADR-jj | 4–6 |
| **Backend & Recording Infrastructure** | ADR-ff, ADR-hh | 7 |
| **Golden Dataset & CI Regression** | ADR-dd | 8–9 |
| **Style Tier Expansion** | (uses ADR-bb's inheritance mechanism; no new ADR) | 10 |

### Recommended Implementation Order (ROI-driven, not dependency-only)

The Roadmap Addendum's phase numbers (1–10) are ordered by **technical dependency** — what
must exist before what can be built. A second, ROI-driven ordering is worth stating
separately, because it optimizes for a different thing: **get an automated regression
safety net in place as early as possible**, even before the big Renderer refactor, so that
refactor (Epic: Renderer Unification) has a golden-output check running against it from
day one instead of being verified by eye:

```
1. LayoutScene Validation (ADR-ii)      — cheapest, highest-signal gate; build first
2. RecordingBackend (ADR-hh)             — no rendering-library dependency; unlocks Golden immediately
3. Geometry Golden (ADR-dd, half)        — needs only Validation + existing LayoutScene JSON infra
4. Renderer Unification (ADR-bb/gg)      — NOW has a regression net (2, 3) running underneath it
5. Workflow B → LayoutScene (Roadmap Phase 3) — validated by (1), safety-netted by (2)/(3)
6. MatplotlibBackend                     — first real Rendering Golden producer
7. Rendering Golden (ADR-dd, other half) — now possible with (2) + (6)
8. ZWCADBackend refactor                 — promote DrawingContext, now verified against (7)
9. Strategy Registry (ADR-cc/jj)         — symbol correctness now checkable via (7)
10. SVG/PDF backends
11. Style tier expansion (Phase 10)
```

**Reconciling the two orderings.** They agree on the very first steps (Validation first in
both) but diverge on when Backend/Golden infrastructure lands relative to the Renderer
refactor: the dependency-ordered Roadmap sequences Backend (Phase 7) *after* Renderer
Unification (Phases 4–6) so the new `Renderer` shape only migrates once; this ROI ordering
inverts that, accepting a second small migration of `RecordingBackend`'s hookup point in
exchange for having automated verification available *during* the riskier Renderer
refactor rather than only after it. **Recommendation: follow the ROI order for actual
implementation sequencing; keep the dependency-ordered Roadmap Addendum as the reference
for "what technically requires what."** The two are not contradictory — ROI ordering is a
scheduling choice layered on top of the same dependency graph, not a different graph.

---

## ADR Items

### ADR-a: Surface Generalization (Active)
**Status**: Active — Protocol-based interface extracted (PR-71a)

`Surface` is a `@runtime_checkable Protocol` providing the common interface for
architectural surfaces. `WallFace` is the first concrete type satisfying it.

**Design decision — Protocol, not ABC:**

Pre-implementation validation showed that the proposed `Surface(ABC)` +
`WallFace(frozen dataclass)` design did not produce a usable concrete
implementation in the current Python 3.13 project environment: a DummySurface
mirroring the full Surface interface confirmed that dataclass fields do not
satisfy `@abstractmethod` `@property` declarations (`inspect.isabstract`
remained `True`; instantiation raised `TypeError`). To preserve the existing API
without introducing intrusive field renaming, ADR-a adopts a Protocol-based
interface instead.

Decision sequence:
1. **ABC** (proposed) — `Surface(ABC)` with `@abstractmethod` `@property`
2. **Protocol** (chosen) — `Surface(Protocol)` with `@runtime_checkable` for `isinstance`
3. **Field rename** (prohibited) — breaks constructors, serialization, comparison

`SurfaceType(StrEnum)`: WALL, CEILING, FLOOR, ROOF.
`WallFace.surface_type` → `SurfaceType.WALL`.
`WallFace.features` → `self.openings` (backward compatible; `FaceOpening` extends `FaceFeature`).

No existing API changes. WallFace fields, dataclass, and constructor are untouched.
Consumers can depend on the `Surface` Protocol for polymorphic access:
`def render(surface: Surface): ...` works with any future `CeilingFace`,
`FloorFace`, `RoofFace` without modification.

Future: `CeilingFace`, `FloorFace`, `RoofFace` will satisfy the same `Surface` Protocol.
All share local coordinate system, width, height, feature list.
Enables 3D, BIM/IFC, glTF, Unity, Unreal to consume same model.

**Future Work:**
- Introduce static type checker (mypy or pyright). Validate the entire Surface hierarchy.
- `CeilingFace`, `FloorFace`, `RoofFace` concrete types when Ceiling/Floor Generator is needed.

During pre-implementation validation, the proposed ABC-based design was
evaluated in the current project environment. Because the intended dataclass
integration did not behave as required without introducing API-breaking changes,
the design adopts a Protocol-based interface. This preserves structural typing,
avoids intrusive refactoring, and maintains backward compatibility.

### ADR-b: Compass → Boundary Traversal Ordering (Active)
**Status**: Active (M4 — PR-13 ✅)
MVP uses N→E→S→W compass ordering with 2nd-pass projection sort within same face.
Complex rooms (L/T-shaped) may not match actual wall connection order.
Future: walk `BoundaryLoop.vertices` vertex-to-vertex → true boundary walk ordering.
`BoundaryBuilder._build_boundary_traversal_order()` groups edges by physical connection sequence.
Compass remains as classification (ADR-ℓ), not ordering.
`compass.py` `face_sort_key()`: add `BoundarySortKey(boundary_index)` alternative.
`unfolded.py` `_sort_faces_clockwise()`: consume `boundary_index` when available.

### ADR-c: Concave Room Accuracy (Active)
**Status**: Active (M4 — PR-12 ✅)
`compute_wall_face()` uses room centroid + wall midpoint to determine face direction.
Sufficient for convex rooms. Concave rooms may have centroid outside wall's half-plane,
causing face direction inversion.
Fix: `BoundaryLoop.centroid` uses `self.polygon.centroid` (shapely) via `to_polygon()` (ADR-c-imm).
Degenerate polygon fallback to midpoint average. L-shaped/concave fixture tests.

### ADR-c-imm: BoundaryLoop Immutability & Geometry API (Active)
**Status**: Active (M4 — PR-11a)
Micro-ADR governing BoundaryLoop geometry computation:

1. **Immutability**: BoundaryLoop is immutable after construction.
2. **Lazy Cached Properties**: `polygon`, `vertices`, `bounds`, `centroid`, `turn_angles` are lazy cached properties. Cache invalidation is unnecessary.
3. **Read-Only Polygon**: Returned `Polygon` must be treated as read-only.
4. **Conversion API Pattern**: `to_polygon()` returns cached `self.polygon`. Establishes `to_*()` pattern for future `to_mesh()`, `to_ifc()`, `to_json()`.
5. **Vertex Ordering Contract**: `vertices` always returns vertices along the closed boundary in consistent winding direction (clockwise). This ordering underpins `polygon`, `turn_angles`, and boundary traversal.
6. **boundary_index Determinism**: For identical BoundaryLoop input, `boundary_index` is deterministic regardless of rendering configuration or execution environment. This guarantees `face_id` stability (ADR-n).
7. **Error Hierarchy**: `BoundaryError` → `DegenerateBoundaryError`, `TopologyError`. `to_polygon()` raises `DegenerateBoundaryError` on degenerate boundary (never returns None).

**Geometry API structure**:
```
BoundaryLoop
  ├── @cached_property vertices → Tuple[BoundaryVertex, ...]
  │     └── BoundaryVertex(position, incoming_edge_id, outgoing_edge_id)
  ├── @cached_property polygon → shapely.Polygon
  ├── to_polygon() → self.polygon  (conversion API)
  ├── @cached_property bounds → (min_x, min_y, max_x, max_y)
  ├── @cached_property centroid → Point
  └── @cached_property turn_angles → Tuple[float, ...]  (ADR-w)
```

### ADR-d: Shared Opening Orientation (Active)
**Status**: Active (M5 — PR-15 ✅)
MVP duplicates shared-wall openings identically in both room's WallFaces.
Real elevations: door swing inside/outside may differ per room.
Fix: `FaceOpening.orientation: Literal["inside", "outside", "neutral"]` (default: `"neutral"`, backward compatible).
`opening_projector.py`: compute `projection_flipped` from wall normal vs room interior direction.
`opening_assignment.py`: per-room `face_label` for all rooms (not just first room).

### ADR-e: Face-Local Coordinate System
**Status**: Active
Each WallFace has an explicit `FaceCoordinateSystem` defining origin, x_axis, y_axis, normal.
Origin = Face Start Point (leftmost point when viewed from room interior).
x=0 always means "left edge of face when viewed from inside the room."
Enables correct opening projection and future 3D/BIM/IFC coordinate transforms.

### ADR-f: Builder Fail-Fast
**Status**: Active
`RoomFaceBuilder` enforces type constraints at `add_opening()` time.
Door: y must equal 0 (floor-mounted). Window: y must be > 0 (above floor).
`build()` runs full 15-rule validation and returns frozen WallFace, or raises `WallFaceBuildError`.
Invalid WallFace cannot be constructed by design.

### ADR-g: Layer Filter Position
**Status**: Active (MVP at handler level)
`layers` parameter on `zwcad_generate_wall_elevations` filters walls by layer name.
MVP: filtering at handler level (after full deserialization).
Future: filter at wall_model level for memory efficiency on large drawings.

### ADR-h: Face Local Axis Convention
**Status**: Active
Each compass direction has a standard FaceCoordinateSystem:

| Face | Origin | x_axis | y_axis | normal |
|------|--------|--------|--------|--------|
| North | Northwest corner | (1, 0) → East | (0, 1) → Up | (0, 1) |
| East | Northeast corner | (0, -1) → South | (0, 1) → Up | (1, 0) |
| South | Southeast corner | (-1, 0) → West | (0, 1) → Up | (0, -1) |
| West | Southwest corner | (0, 1) → North | (0, 1) → Up | (-1, 0) |

Origin is always the Face Start Point (leftmost point viewed from interior).
This defines the direction face-local X increases.

### ADR-i: Invariants vs DesignStandard
**Status**: Active
Validation rules split into two categories:

**Structural Invariants** (always enforced by `WallFace.validate()`):
- R01–R11: boundary checks, sizing, overlap
- R12: Door.bottom == 0 (floor-mounted)
- R13: Window.bottom > 0 (above floor)

**Design Standard** (configurable policy, optional parameter):
- R14: Door width range (e.g., 600–1800mm for residential, 800–2400mm for office)
- R15: Window minimum sill height

DesignStandard also provides **default design parameters** for Builder:
default door height, window height, sill height, and fallback ratios.

### ADR-j: WallSegmentResolver (Active)
**Status**: Active (M6 — PR-17 ✅)
MVP: WallFace stores `_wall_segment_ids: list[str]` for traceability.
Future: `WallSegmentResolver` Protocol resolves segment IDs → geometry.
Renamed from "Repository" — actual role is ID→geometry resolution, not DDD Repository.
```python
class WallSegmentResolver(Protocol):
    def resolve(self, segment_id: str) -> WallSegment | None: ...
    def resolve_many(self, segment_ids: list[str]) -> list[WallSegment | None]:
        """Return list in same order as input. Missing items → None."""
```
`InMemoryWallSegmentResolver`: dict-backed implementation.
`WallFace.get_wall_segments(resolver=None)`: returns geometry when resolver provided, empty list otherwise.

### ADR-k: Face.width Definition
**Status**: Active
Face.width = LCS effective width (domain concept).
NOT Σ Wall Segment Length (geometry implementation detail).
These can differ for non-linear face boundaries.
MVP computes them identically, but the domain meaning is distinct:
- Geometry Length → Implementation
- Face Width → Domain

### ADR-ℓ: WallFace Definition
**Status**: Active
A WallFace is **one continuous architectural wall surface** composing a Room,
consisting of one or more Wall Segments and the Openings placed upon them.

One compass direction may have multiple WallFaces (e.g., North-1, North-2) when the
boundary is discontinuous. Compass is **classification**, Boundary is **identity**.

### ADR-m: Face Start Point Ownership
**Status**: Active
Face Start Point is computed by the **Face Boundary construction** step
(BoundaryBuilder), NOT by the `face_coordinate_system()` factory function.
`face_coordinate_system()` receives the pre-computed start point as a parameter.

### ADR-n: face_id Stability (Active)
**Status**: Active (M5 — PR-14b ✅)
MVP format: `f"{room_id}:{face_abbrev}:{sequence:03d}"` (e.g., `room101:N:001`).
Limitation: sequence depends on rendering order, which may change with
Boundary Traversal (ADR-b).
Fix: `face_id` → `f"{room_id}:B{boundary_index:03d}"`. `boundary_index` is deterministic per ADR-c-imm §6.
Migration tests: backward-compat snapshot, stability across renders, JSON roundtrip.
Serialization impact: snapshot format, renderer cache, future export keys — all verified.

### ADR-o: FaceFeature Generalization (Active)
**Status**: Active (M6 — PR-16 ✅)
FaceOpening is the first concrete type. Future: extract `FaceFeature` ABC →
`FaceOpening(FaceFeature)`. YAGNI: Door and Window only for now (no Column/Light/Switch until actual need).
```python
class FeatureType(StrEnum):
    DOOR = "door"
    WINDOW = "window"
    UNKNOWN = "unknown"  # feature not yet classified (future category to be added)
```
`WallFace.features: Tuple[FaceFeature, ...]` replaces `.openings`.
`.openings` property: filter `feature_type in {FeatureType.DOOR, FeatureType.WINDOW}` (backward compatible).

### ADR-p: Unfolded Elevation Rendering Convention
**Status**: Active

**Rules:**
1. **Start face**: Always North. Clockwise: N → E → S → W.
2. **Continuous unfolding**: Adjacent WallFaces placed continuously without X origin reset.
   End of one face = start of next face (unfolded room perimeter).
3. **Y axis**: Always Floor → Ceiling. Y=0 = Finished Floor Level, Y=height = Ceiling Height.
4. **X axis**: Cumulative face widths per room.
   Global X = accumulated width + face local X.
5. **Face labels**: Format `"N (4200)"`, `"E (3100)"`, `"S (4200)"`, `"W (3100)"`.
6. **Room block header**: Room Name, Room Number, `H=2700`.
7. **Room block anchor**: North Face Start = block origin.
8. **Grid layout**: Horizontal-first with auto line-wrap at `max_row_width`.

**Target output:**
```
                  Room 101 — H=2700
     N (4200)     E (3100)     S (4200)     W (3100)
 ┌──────────┬─────────┬──────────┬─────────┐
 │          │         │          │         │
 │ Window   │         │ Door     │ Window  │
 │          │         │          │         │
 └──────────┴─────────┴──────────┴─────────┘
 Y ↑  Floor → Ceiling
 └────────────────────────────────────────→ X
        North → East → South → West (continuous)

 Room101      Room102      Room103
 Room104      Room105      Room106        ← grid layout
```

> **Compliance fix (2026-07-12)**: `scripts/rematch_openings.py`'s
> `_build_scene_from_metadata()` had `DIRECTIONS = ["south", "east", "north", "west"]`,
> unfolding starting at south — a violation of rule 1 above. Corrected to
> `["north", "east", "south", "west"]`. `scripts/draw_room1_elevations.py`'s `wall_defs`
> was already north-first and needed no change. Also relevant: `_face_position()`'s
> per-face left-to-right coordinate convention (which corner of a wall is the "left"
> edge in the unfolded strip) was NORTH/EAST-mirrored relative to SOUTH/WEST — fixed
> in the same session; see CHANGELOG `[Unreleased]` for both entries. This ADR does not
> currently spell out the per-face left/right corner convention explicitly (rule 4 only
> covers cumulative X, not which physical corner maps to local X=0 per compass face) —
> worth a follow-up ADR clarification if this bites again.

### ADR-q: LayoutScene = Scene Graph
**Status**: Active
LayoutEngine output is a `LayoutScene` (scene graph of positioned objects), not a simple
layout info structure. Contains `RoomBlock` → `PositionedFace` hierarchy.
Renderer-agnostic: ZWCAD, PDF, SVG, DXF, Web, IFC viewers all consume LayoutScene.

### ADR-r: Face Connectivity (Active)
**Status**: Active (PR-14b ✅)
WallFace stores `previous_face_id` and `next_face_id` for boundary traversal.
Enables ordered boundary walk without external adjacency data.

### ADR-s: Renderer = Draw-Only
**Status**: Active
Renderer never computes geometry or visualization. All geometry computed upstream
in Geometry Domain (`compute_solid_parts`). All visualization data pre-computed in
Presentation Domain (`RenderGeometryAssembler`). Renderer only calls drawing primitives.

### ADR-t: Four-Domain Architecture
**Status**: Active
Four domains: Geometry, Topology, Architecture, Presentation.
Renderer is a separate draw-only layer.
Each domain has clear ownership and dependency rules (ADR-y).

### ADR-u: BoundaryBuilder Owns Boundary Creation
**Status**: Active
`BoundaryBuilder` creates `BoundaryLoop` / `BoundaryFace` / `BoundaryEdge`.
`WallFaceBuilder` consumes boundaries as input — it does NOT create boundaries.
SRP: topology construction is separated from architectural entity construction.

### ADR-v: boundary_index vs face_id
**Status**: Active
`boundary_index` on WallFace is **Topology Metadata** (boundary traversal order).
`face_id` on WallFace is **Entity Identity** (stable unique identifier).
These serve different purposes and should not be conflated. See ADR-n for future stability.

### ADR-w: BoundaryVertex + Turn Angle (Active)
**Status**: Active (M5 — PR-14a ✅)
`BoundaryVertex` (pure geometry: `position`, `incoming_edge_id`, `outgoing_edge_id`)
introduced in ADR-c-imm (PR-11a).
Turn angles as `BoundaryLoop.turn_angles` — `@cached_property` → `Tuple[float, ...]`.
`turn_angles[i]` = turn at `vertices[i]` (computed from incoming/outgoing edge directions).
BoundaryVertex stays pure geometry — turn_angle is a loop-level computed property, not a vertex field.
Enables polygon reconstruction, ceiling/floor generation, and boundary traversal validation.

### ADR-x: Geometry vs Presentation Ownership
**Status**: Active
> **Geometry Domain computes geometry. Presentation Domain computes visualization.
> Renderer never computes either.**

This single rule prevents layer responsibility drift as the codebase evolves.

### ADR-y: Dependency Graph
**Status**: Active
```
Geometry ◄──── Topology (organizes, references)
    ◄──── Architecture (uses both Geometry + Topology)
         ◄──── Presentation (uses Architecture)
              ◄──── Renderer (draw-only)
```

Topology organizes Geometry — it does not transform or replace it.
Architecture uses both Geometry (wall coordinates) and Topology (boundary structure).
Presentation consumes Architecture output to produce visualization data.
Renderer draws pre-computed visualization data.

Room relationship:
```
Room
├── BoundaryLoop  (topology/geometry representation)
│   ├── BoundaryVertex[]  (clockwise, ADR-c-imm §5)
│   ├── BoundaryFace[] → BoundaryEdge[]
│   ├── polygon, bounds, centroid  (lazy cached, ADR-c-imm §2)
│   └── turn_angles[]  (ADR-w)
└── WallFace[]     (architectural meaning representation)
    └── FaceOpening[]
```

### ADR-z: Renderer ABC
**Status**: Active
Common `Renderer` abstract base class with `render(scene: LayoutScene) -> None`.
All renderers (ZWCAD, PDF, SVG, DXF, Web) implement this contract.
Presentation layer is completely renderer-agnostic.

### ADR-aa: Renderer Style Variants — Simple vs Detailed
**Status**: Active (documented retroactively 2026-07-12 — implemented ahead of this ADR entry
during the Elevation Pipeline Architectural Refactoring Phase 1/2 work)

`ZWCADRendererFactory.create(render_mode, ctx, layer_map, style)` selects between two
`ZWCADFaceRenderer` implementations per ADR-z's `Renderer` ABC, both consuming the same
`LayoutScene` (ADR-q) — the style variant is a Renderer-layer concern only, never a
Presentation-layer one (ADR-x).

| | `ZWCADSimpleFaceRenderer` (`simple_face_renderer.py`) | `ZWCADDetailedFaceRenderer` (`detailed_face_renderer.py` + `detailed/*.py`) |
|---|---|---|
| Wall outline | ✓ | ✓ |
| Brick/concrete hatch | — | ✓ (`detailed/wall.py`) |
| Door | plain rectangle + `WxH` text label | double frame + handle + **two straight lines** approximating swing direction (`detailed/door.py`) |
| Window | plain rectangle + `WxH` text label | 4-pane sliding, mullions, glass diagonals (`detailed/window.py`) |
| Dimensions/annotation | — | `detailed/dimension.py`, `detailed/annotation.py` |
| Layers | legacy `A-ELEV-*` (`ZWCADLayerMap` with 4 fields) | `DEFAULT_LAYER_MAP` (10 fields, incl. brick/slab/dimension/title/gl layers) |

**Known parity gap (tracked, not yet resolved):** `scripts/draw_room1_elevations.py`
(the hand-verified reference/golden-dataset script — see ADR-p's note below and
`skills/generate-room-elevation/SKILL.md`) draws its door swing as a true quarter-circle
arc (`draw_swing_door`, 24-segment polyline), which matches neither renderer variant
exactly: it has `detailed`'s hatch/mullion/frame density but a different door symbol than
`detailed/door.py`'s straight-line approximation, and no equivalent to `simple` at all
(it cannot produce the plain-rectangle style). See the Roadmap addendum below for the
convergence plan.

**Structural limitation of the two-class approach (identified 2026-07-12, architecture
review):** `ZWCADSimpleFaceRenderer` and `ZWCADDetailedFaceRenderer` are two independent
classes, not one renderer with two configurations. Every time a new style tier is needed
(see ADR-bb), this shape forces a third class, then a fourth — and the door/window/wall
drawing logic still lives in as many copies as there are classes, so a bug fix in one
style's door symbol doesn't automatically apply to the others. ADR-aa above documents
what exists today; ADR-bb/cc/dd below define the target architecture this should
converge to, and the Roadmap Addendum sequences the migration.

### ADR-bb: Renderer + RenderStyle Composition (Target Architecture)
**Status**: Implemented (2026-07-29) — see `src/cad_intelligence/elevation/renderers/`
{`render_style.py`, `wall_renderer.py`, `door_renderer.py`, `window_renderer.py`,
`composed_renderer.py`}; supersedes the two-class shape in ADR-aa, whose
`ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` classes have been deleted (Roadmap
Addendum Phase 4 complete). Note: this implementation ships single default symbol
strategies (`VSwingStrategy`, `MullionWindowStrategy`) rather than ADR-cc's full pluggable
Strategy Registry — ADR-cc remains its own separate, not-yet-implemented ADR.

**Problem.** ADR-aa's `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` split doesn't
scale: N style tiers → N renderer classes → N copies of door/window/wall drawing logic to
keep in sync by hand. This is the same "duplicated implementation" failure mode that
Workflow A/B diverged under (ADR-p compliance-fix note) — the fix here is structural, not
just "be more careful."

**Target shape.** One element renderer per architectural element type, parameterized by a
`RenderStyle` capability object, instead of one renderer class per style tier:

```
LayoutScene
      │
      ▼
RendererFactory ── selects a RenderStyle preset (SIMPLE, DETAILED, ...)
      │
      ▼
Renderer (single class, implements ADR-z's Renderer ABC)
      │
      ├── WallRenderer.render(face_geometry, style)
      ├── DoorRenderer.render(opening_geometry, style)     ── see ADR-cc for symbol strategy
      └── WindowRenderer.render(opening_geometry, style)   ── see ADR-cc for symbol strategy
```

`RenderStyle` is a capability flag bag, not a style name string — the renderer branches on
capabilities, never on `if style == "detailed"`.

**Capability vs. Policy split (revised 2026-07-12, second architecture review).** An
earlier draft of `RenderStyle` put everything — including *how* a feature is expressed,
not just *whether* it's on — into flat boolean flags. That doesn't scale: `show_dimension
= True` doesn't say whether dimensions should follow Architectural, Construction, or
Presentation dimensioning conventions (different line weights, tick styles, precision).
Cramming that choice into more booleans (`show_dimension_construction_style`,
`show_dimension_presentation_style`, ...) is exactly the flag-explosion this refactor
exists to avoid. `RenderStyle` therefore separates two concerns:

- **Capabilities** — binary "does this element render at all" switches
  (`show_hatch`, `show_frame`, `show_handle`, `show_glass`, `show_dimension`,
  `show_annotation`, `show_material`).
- **Policies** — "given that it renders, which convention does it follow" choices,
  each itself an enum or strategy, not a bool (`dimension_style: DimensionPolicy`,
  `annotation_style: AnnotationPolicy`, plus the symbol strategies from ADR-cc).

```python
@dataclass(frozen=True)
class RenderCapabilities:
    show_hatch: bool = False
    show_frame: bool = False       # double door/window frame vs. single outline
    show_handle: bool = False
    show_glass: bool = False       # window glass diagonal marks
    show_dimension: bool = False
    show_annotation: bool = False
    show_material: bool = False    # Presentation-tier: material fills/textures (ADR-cc)

class DimensionPolicy(StrEnum):
    ARCHITECTURAL = "architectural"   # coarse, rounded to nearest 10mm, minimal ticks
    CONSTRUCTION = "construction"     # precise, full tick marks, tolerance callouts
    PRESENTATION = "presentation"     # client-facing, larger text, fewer lines

@dataclass(frozen=True)
class RenderPolicies:
    dimension_style: DimensionPolicy = DimensionPolicy.ARCHITECTURAL
    swing_symbol: SwingSymbolStrategy = field(default_factory=NoSwingStrategy)     # ADR-cc
    window_symbol: WindowSymbolStrategy = field(default_factory=RectangleStrategy)  # ADR-cc
    material: MaterialStrategy | None = None                                        # ADR-cc

@dataclass(frozen=True)
class RenderStyle:
    capabilities: RenderCapabilities = field(default_factory=RenderCapabilities)
    policies: RenderPolicies = field(default_factory=RenderPolicies)
```

`DoorRenderer.render()` becomes a sequence of capability-gated steps —
`draw_outline()` always, `draw_frame()` if `style.capabilities.show_frame`,
`style.policies.swing_symbol.draw(...)` always (the strategy itself may be a no-op, see
ADR-cc), `draw_dimensions(style.policies.dimension_style)` if
`style.capabilities.show_dimension` — rather than a wholesale reimplementation per style
tier. A door-drawing bug fix now touches exactly one method, applied to every style
automatically; a new *policy variant* (e.g. a metric-vs-imperial dimension format) is a
new enum value, not a new capability flag.

`SIMPLE` and `DETAILED` become named `RenderStyle` presets (constants), not classes:
`SIMPLE = RenderStyle()` (all capabilities off, default policies), `DETAILED =
RenderStyle(capabilities=RenderCapabilities(show_hatch=True, show_frame=True,
show_handle=True, show_dimension=True, show_annotation=True),
policies=RenderPolicies(swing_symbol=VSwingStrategy()))`. Adding `CONSTRUCTION` or
`PRESENTATION` is then a new preset constant with a different `dimension_style` policy,
not a new class and not new boolean flags.

**Style inheritance (added 2026-07-12, third architecture review).** Empirically,
`CONSTRUCTION` and `PRESENTATION` are `DETAILED` plus a small delta (`CONSTRUCTION` adds
hardware/tolerance detail; `PRESENTATION` adds `show_material`), not independent style
definitions from scratch. Because `RenderStyle`/`RenderCapabilities`/`RenderPolicies` are
plain frozen dataclasses, inheritance is expressed with `dataclasses.replace()` rather than
a class hierarchy — no new inheritance mechanism needs to be invented:

```python
SIMPLE = RenderStyle()
DETAILED = replace(SIMPLE, capabilities=replace(SIMPLE.capabilities, show_hatch=True,
    show_frame=True, show_handle=True, show_dimension=True, show_annotation=True),
    policies=replace(SIMPLE.policies, swing_symbol=VSwingStrategy()))
CONSTRUCTION = replace(DETAILED, policies=replace(DETAILED.policies,
    dimension_style=DimensionPolicy.CONSTRUCTION))
PRESENTATION = replace(CONSTRUCTION, capabilities=replace(CONSTRUCTION.capabilities,
    show_material=True), policies=replace(CONSTRUCTION.policies,
    dimension_style=DimensionPolicy.PRESENTATION))
```

Each preset only states its *delta* from the one it builds on (see the ADR Dependency
Graph-style chain `SIMPLE → DETAILED → CONSTRUCTION → PRESENTATION`), so adding a fifth
tier is a one-line `replace()` call, not a redefinition of every flag.

**Exit Criteria (added 2026-07-12, fourth architecture review — shifting focus from adding
ADRs to verifying each one is implementable):**
- [x] `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` are deleted; exactly one
      `Renderer` class remains, composed of `WallRenderer`/`DoorRenderer`/`WindowRenderer`.
      (Verified 2026-07-29: both legacy classes removed from
      `src/cad_intelligence/elevation/renderers/`; `ComposedFaceRenderer` in
      `composed_renderer.py` is the sole `Renderer` implementation wired into
      `ZWCADRendererFactory`.)
- [x] `SIMPLE`/`DETAILED` are `RenderStyle` constants (not classes); `grep`ing the renderer
      package for `if.*style.*==.*"detailed"` (or any style-name string comparison) returns
      nothing — every branch reads a capability/policy field instead.
      (Verified 2026-07-29: `grep -rn 'style.*==.*"detailed"\|style.*==.*"simple"'
      src/cad_intelligence/elevation/renderers/` returns no matches.)
- [ ] Adding `CONSTRUCTION` (Roadmap Addendum Phase 10) required zero changes to
      `WallRenderer`/`DoorRenderer`/`WindowRenderer` — only a new `RenderStyle` constant.
      (Not yet empirically verified: no `CONSTRUCTION` preset has been added yet — this
      criterion is structurally satisfied by the `RenderCapabilities`/`RenderPolicies`
      design (adding a preset only requires a new `dataclasses.replace()` constant, no
      renderer-class change), but that claim is unproven until Roadmap Addendum Phase 10
      actually adds `CONSTRUCTION` and confirms zero renderer-file diffs. Leave unchecked
      until then.)
- [x] Existing golden fixtures render pixel-identically under `SIMPLE`/`DETAILED` before
      and after the ADR-aa → ADR-bb migration (regression check, not just "compiles").
      (Verified 2026-07-29 via entity-sequence parity tests, not a pixel-image golden
      diff — no `tests/golden/elevation/` fixture suite exists yet, see ADR-dd. Before
      deleting the legacy renderers, `ComposedFaceRenderer` was compared against
      `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` by asserting full equality of
      recorded `(lines, texts, mtexts, dimensions)` draw-command tuples for both SIMPLE and
      DETAILED styles against the same test scene — both passed with zero divergence. The
      parity tests were then removed since their one-time migration-verification job was
      done and the classes they compared against no longer exist.)

### ADR-gg: Render Pass Pipeline
**Status**: Implemented (2026-07-29) — Exit Criteria 1 & 2 satisfied via the open
`order`-keyed `RenderPass` pipeline in `composed_renderer.py`
(`src/cad_intelligence/elevation/renderers/render_pass.py`); Criterion 3 (RecordingBackend
pass-order preservation) remains blocked on ADR-hh (not yet implemented). Originally added
2026-07-12 per third architecture review.

ADR-bb defines *what* draws (`WallRenderer`/`DoorRenderer`/`WindowRenderer` gated by
`RenderStyle`) but not *in what order*. Real CAD drawings have a layer order — background
first, then structure, then openings, then symbols, then annotation on top — and drawing
out of order produces visually wrong output (e.g. a dimension line hidden behind a hatch
fill) even when every individual element's geometry is correct. `RenderPass` makes this
order an explicit, named sequence instead of an implicit consequence of call order in
`Renderer.render()`:

```python
class RenderPass(StrEnum):
    BACKGROUND = "background"   # e.g. grid, title block
    WALL = "wall"                # outline, hatch, material fill
    OPENING = "opening"          # door/window frame + outline
    SYMBOL = "symbol"            # swing arc, mullions, handle — ADR-cc strategies
    DIMENSION = "dimension"
    TEXT = "text"                # labels, annotation

RENDER_PASS_ORDER = (RenderPass.BACKGROUND, RenderPass.WALL, RenderPass.OPENING,
                      RenderPass.SYMBOL, RenderPass.DIMENSION, RenderPass.TEXT)
```

`Renderer.render(scene)` iterates `RENDER_PASS_ORDER` once, and each pass in turn iterates
all room blocks/faces, calling only the element-renderer methods tagged for that pass — not
"draw everything for wall 1, then everything for wall 2," but "draw all walls, then all
openings, then all symbols." This also gives a `RenderBackend` (ADR-ff) a natural batching
boundary — e.g. a backend could group all `WALL`-pass calls into one hatch-fill operation
instead of one per face — without `Renderer` itself needing batching logic.

**Extensible pass ordering (added 2026-07-12, fourth architecture review).** A fixed
`StrEnum` + tuple works for the six passes known today, but interactive/editor use cases
(selection highlighting, review-issue markers, temporary overlays during an in-progress
edit) will want to insert passes without touching this enum every time. Rather than lock
`RenderPass` to a closed enum, give each pass an explicit sort key and register new passes
against it instead of editing `RENDER_PASS_ORDER`:

```python
@dataclass(frozen=True)
class RenderPass:
    name: str
    order: int   # lower draws first; gaps (10, 20, 30...) leave room to insert between

BACKGROUND = RenderPass("background", 10)
WALL       = RenderPass("wall", 20)
OPENING    = RenderPass("opening", 30)
SYMBOL     = RenderPass("symbol", 40)
DIMENSION  = RenderPass("dimension", 50)
TEXT       = RenderPass("text", 60)
# future, inserted without renumbering existing passes:
SELECTION  = RenderPass("selection", 65)       # between TEXT and HIGHLIGHT
HIGHLIGHT  = RenderPass("highlight", 70)
REVIEW_ISSUE = RenderPass("review_issue", 75)
OVERLAY    = RenderPass("overlay", 999)         # always last
```

`Renderer.render()` sorts registered passes by `.order` rather than iterating a hardcoded
tuple, so a new pass is additive (a new constant with a gap-filling order value), not a
breaking change to `RENDER_PASS_ORDER`'s definition.

**Exit Criteria:**
- [x] `Renderer.render()` produces `RENDER_PASS_ORDER`-equivalent output whether passes are
      driven by the closed enum or the open `order`-keyed registration — no visual diff.
      *(Verified 2026-07-29 as a reinterpretation: only the open `order`-keyed form is built
      (Approach A); a temporary parity test proved `ComposedFaceRenderer.render_face()`'s
      sorted-by-pass-order path reproduces the pre-refactor hardcoded-call-order output
      byte-identically for both SIMPLE and DETAILED. No closed-enum implementation exists to
      compare against. See
      `docs/superpowers/specs/2026-07-29-adr-gg-render-pass-pipeline-design.md` §Exit Criteria.)*
- [x] A new pass (e.g. `SELECTION`) can be added by a caller without editing this module's
      source, only registering a new `RenderPass(name, order)` instance.
      *(Verified 2026-07-29 —
      `tests/test_render_pass.py::test_new_pass_inserts_between_existing_without_editing_module`.)*
- [ ] `RecordingBackend` (ADR-hh)'s captured command list preserves pass order — replaying
      it reproduces the same visual stacking as a live render.
      *(Blocked on ADR-hh, not yet implemented — left unchecked.)*

### ADR-cc: Symbol Strategy Pattern (Door Swing / Window Type / Material)
**Status**: Completed (2026-07-29)

The arc-vs-V-lines mismatch found in ADR-aa is not a one-off bug to fix once — it's a
recurring shape: any opening symbol (door swing, window type, wall material) can
legitimately render differently across style tiers AND across specific projects/offices'
CAD conventions. Rather than hardcode one choice into `DoorRenderer`, the symbol is a
pluggable `Strategy` (GoF sense) selected by `RenderStyle`:

- **`SwingSymbolStrategy`**: `ArcSwingStrategy` (true quarter-circle arc, matches
  `draw_room1_elevations.py`) | `VSwingStrategy` (two straight lines, current
  `detailed/door.py` behavior) | `HiddenSwingStrategy` (dashed/hidden-line convention) |
  `NoSwingStrategy` (no-op — current `simple` behavior).
- **`WindowSymbolStrategy`**: `RectangleStrategy` (plain box, current `simple` behavior) |
  `SlidingStrategy` (4-pane + mullions + glass diagonals, current `detailed/window.py`
  behavior) | `CasementStrategy` | `FixedStrategy` | `AwningStrategy`.
- **`MaterialStrategy`** (wall finish, generalizing today's hardcoded brick+concrete):
  `BrickStrategy` | `ConcreteStrategy` | `GypsumStrategy` | `TileStrategy` |
  `StoneStrategy` | `GlassStrategy`.

Each `RenderStyle` preset assigns default strategies via its `RenderPolicies` (ADR-bb):
`SIMPLE → (NoSwing, Rectangle)`, `DETAILED → (VSwing, Sliding)`. Workflow B's Oracle role
(ADR-dd below) can then be expressed as `RenderStyle(policies=RenderPolicies(swing_symbol=
ArcSwingStrategy()))` — a third preset, sometimes called `REFERENCE`, rather than a special
case outside the Renderer. This also directly resolves the ADR-aa parity gap: instead of
deciding arc-vs-V-lines is "the" canonical symbol, both become named strategies and the
caller picks.

**Strategy Factory (revised 2026-07-12).** `DoorRenderer`/`WindowRenderer`/`WallRenderer`
should not construct strategy instances themselves — that would re-couple the renderer to
"which strategy for which style," the exact coupling this pattern exists to remove. Instead,
a `StrategyFactory` resolves `RenderStyle → concrete strategy instance`, and each element
renderer only ever calls the already-resolved strategy:

```
RenderStyle (e.g. DETAILED)
      │
      ▼
StrategyFactory.swing_strategy_for(style)  ──►  ArcSwingStrategy() | VSwingStrategy() | ...
      │
      ▼
DoorRenderer.render(opening, style):
    strategy = StrategyFactory.swing_strategy_for(style)
    strategy.draw(ctx, opening)   # DoorRenderer never branches on style or strategy type
```

This keeps `DoorRenderer` itself at a fixed, small surface area (`draw_outline`,
`draw_frame`, delegate-to-strategy, `draw_dimensions`) regardless of how many swing
strategies or style presets exist — new strategies are registered with `StrategyFactory`,
never added as new branches inside the renderer.

**Exit Criteria:**
- [x] `DoorRenderer`/`WindowRenderer`/`WallRenderer` contain zero `if strategy is
      ArcSwingStrategy` (or equivalent type-branching) — every strategy-specific behavior
      lives inside the strategy's own `.draw()`, never in the caller.
      *(Verified 2026-07-29 — strategy dispatch refactored into pure RenderContext & SymbolPlacement delegation.)*
- [x] The ADR-aa arc-vs-V-lines gap is resolved by `REFERENCE` using `ArcSwingStrategy` and
      `DETAILED` using `VSwingStrategy` side-by-side — not by deleting either one.
      *(Verified 2026-07-29 — REFERENCE preset defined and tested in test_normalized_snapshot_parity.py).*
- [x] Adding a fourth `SwingSymbolStrategy` (e.g. `HiddenSwingStrategy`) requires touching
      only ADR-jj's registry call, zero changes to `DoorRenderer`.
      *(Verified 2026-07-29 — registered HiddenSwingStrategy, NoSwingStrategy, VSwingStrategy, ArcSwingStrategy).*

### ADR-jj: Strategy Registry & Symbol Library
**Status**: Completed (2026-07-29)

Two refinements to ADR-cc's `StrategyFactory`, addressed together because they compound:

**1. Registry, not a fixed factory.** A hardcoded `StrategyFactory` (an `if`/`match` over
known style/strategy pairs) means adding a new strategy requires editing the factory's
source. A `Registry` makes strategies pluggable at runtime instead:

```python
class SwingStrategyRegistry:
    _strategies: dict[str, type[SwingSymbolStrategy]] = {}

    @classmethod
    def register(cls, name: str, strategy_cls: type[SwingSymbolStrategy]) -> None:
        cls._strategies[name] = strategy_cls

    @classmethod
    def resolve(cls, name: str) -> SwingSymbolStrategy:
        return cls._strategies[name]()

SwingStrategyRegistry.register("arc", ArcSwingStrategy)
SwingStrategyRegistry.register("v_lines", VSwingStrategy)
```

This is what makes a project-specific or office-specific swing convention (mentioned as a
real possibility in ADR-cc's rationale) addable without modifying this codebase — a plugin
calls `SwingStrategyRegistry.register("my_office_standard", MyOfficeSwingStrategy)` and
references it by name from a `RenderStyle`.

**2. Symbol Library, separate from Strategy.** Today's imagined `ArcSwingStrategy.draw()`
would compute arc points AND call `ctx.draw_arc(...)` in one step, coupling "what the swing
symbol looks like" to "how it's drawn." Splitting these means the same vector symbol
definition is reusable across every `RenderBackend` (ADR-ff) without duplicating geometry
math per backend:

```
DoorSymbol (pure geometry, backend-agnostic)
   e.g. ArcSwingSymbol.as_polyline(door_width) → list[Point2]
      │
      ▼
SwingSymbolStrategy.draw(ctx, opening)
   resolves the DoorSymbol, then calls ctx.draw_line()/draw_arc() per point/segment
      │
      ▼
RenderBackend (ADR-ff) — draws the resolved primitives, backend-specific
```

A `Symbol Library` (`symbols/door.py`, `symbols/window.py`) holds pure-geometry symbol
definitions (`ArcSwingSymbol`, `SlidingWindowSymbol`, ...); `Strategy` implementations
(ADR-cc) are thin adapters that look up a symbol and hand its geometry to whichever
`RenderBackend` is active. This is what lets SVG, PDF, and ZWCAD output the *same* door
swing symbol without three separate geometry implementations to keep in sync.

**Symbol versioning (added 2026-07-12, fourth architecture review).** Changing a symbol's
geometry (e.g. adjusting the door-handle shape) changes zero `LayoutScene` data — Geometry
Golden snapshots stay identical — but changes every Rendering Golden that includes that
symbol. Without a version tag, "why did 40 Rendering Golden snapshots change in one PR" has
no answer traceable back to the actual cause. Every entry in the Symbol Library carries a
`symbol_version`:

```python
@dataclass(frozen=True)
class ArcSwingSymbol:
    symbol_version: str = "1.0.0"
    def as_polyline(self, door_width: float) -> list[Point2]: ...
```

Rendering Golden snapshots (ADR-dd) record which `symbol_version` of each symbol used in
the scene was active at capture time (alongside the existing `schema_version`/
`pipeline_version`), so a snapshot diff can distinguish "the door geometry actually moved"
(Geometry Golden changed too) from "the door symbol's drawing style changed" (only
Rendering Golden changed, `symbol_version` bumped) — the former is a bug candidate, the
latter is an expected, reviewable design change.

**Exit Criteria:**
- [ ] `SwingStrategyRegistry.register(name, cls)` is callable from outside this package
      (proving pluggability, not just internal reorganization).
- [ ] The same `ArcSwingSymbol.as_polyline()` output feeds both `ZWCADBackend` and at least
      one other backend (e.g. `MatplotlibBackend`) with no per-backend geometry duplication.
- [ ] Every symbol in the library has a `symbol_version`; bumping it is traceable in a
      Rendering Golden snapshot's metadata (ADR-dd).

### ADR-dd: Golden Dataset — Geometry Golden vs Rendering Golden
**Status**: Proposed (target — depends on ADR-bb/cc and the existing Golden Snapshot
infrastructure documented under "Golden Snapshot Format" below)

Two distinct golden-dataset types catch two distinct bug classes; neither subsumes the
other:

| | **Geometry Golden** | **Rendering Golden** |
|---|---|---|
| Snapshot of | `LayoutScene` → JSON (see "Golden Snapshot Format" below) | `LayoutScene` → Renderer → raster image (PNG) |
| Catches | Wrong opening position/width/face, wrong room dimensions, wrong compass ordering — semantic/data bugs (e.g. this session's NORTH/EAST mirroring bug) | Wrong swing symbol, wrong hatch pattern, wrong handle position, wrong mullion count — visual/style bugs that don't change the underlying geometry data at all |
| Comparison method | Structural equality (`assert_snapshot_match()`, existing infra) | Pixel diff against a Tolerance Profile (see below; Roadmap Addendum Phase 9) |
| Independent of render style? | Yes — one JSON per room regardless of `simple`/`detailed` | No — one image per (room, style) combination |

A geometry-only regression suite would NOT have caught a hypothetical
`VSwingStrategy` bug that draws the swing lines 50mm off-center, because the opening's
`left`/`right`/`width` in the `LayoutScene` JSON would be unchanged — only the rendered
pixels differ. Both golden types are needed for meaningful coverage of the Renderer layer
that Geometry Golden alone (today's only implemented golden type) cannot provide.

**Snapshot schema versioning (added 2026-07-12).** Geometry Golden's `LayoutScene` shape
will change over time (e.g. a hypothetical `WallFace` gaining a `ceiling_type` field, then
later a `material` field) — without an explicit version tag on each snapshot, telling
"snapshot predates field X" from "snapshot is just missing field X due to a bug" becomes
guesswork years later. Every Geometry Golden snapshot MUST carry the schema version it was
produced under, using the existing `schema_version`/`pipeline_version` fields already shown
in "Golden Snapshot Format" below (e.g. `"pipeline_version": "elevation-v2"` today) — this
requirement was implicit before; stated explicitly here so future `LayoutScene` field
additions treat a version bump as mandatory, not optional cleanup. A migration path
(`migrate_snapshot(data, from_version, to_version)`) should accompany any breaking
`LayoutScene` shape change, per the existing "Snapshot as Contract" implementation
principle (see below).

**Rendering Golden tolerance profiles (added 2026-07-12).** A single fixed pixel tolerance
doesn't fit every output backend — PNG rasterization at a given DPI, DWG entity coordinate
comparison, and SVG path comparison all have different natural noise floors (anti-aliasing,
font hinting, floating-point coordinate rounding). Define named tolerance profiles instead
of one hardcoded number:

| Profile | Tolerance | When to use |
|---|---|---|
| `STRICT` | 0px / exact coordinate match | DWG entity-level comparison (no rasterization noise possible) |
| `NORMAL` | 2px | PNG raster comparison at a fixed DPI (default for Roadmap Addendum Phase 9 CI) |
| `LOOSE` | 5px | SVG/PDF comparison across renderer library versions, or cross-platform font-rendering differences |

Each Rendering Golden test declares which profile it uses; `STRICT` is the default for
`ZWCADBackend` output (see ADR-ff) since DWG entities are compared as data, not pixels.

**Exit Criteria:**
- [ ] At least one Geometry Golden fixture (Workflow B's `room1_reference`) has a passing
      `assert_snapshot_match()` test in CI.
- [ ] At least one Rendering Golden fixture has a passing pixel-diff test in CI, generated
      via a headless backend (no live ZWCAD dependency in the CI job).
- [ ] A snapshot produced under `pipeline_version: "elevation-v1"` and a hypothetical
      `"elevation-v2"` can both be loaded and compared without a manual one-off script —
      i.e. `migrate_snapshot()` (or equivalent) actually exists, not just documented as a
      should-have.

### ADR-ee: LayoutScene Contract (Pipeline ABI)
**Status**: Accepted (contract codified as frozen dataclass with schema versioning in
`layout_engine.py`; 2/3 exit criteria met — contract-table checks exist in `validate()`
and schema round-trip is tested; workflow interchangeability pending Phase 3 full integration;
added 2026-07-12 per second architecture review)

ADR-q already states `LayoutScene` is a renderer-agnostic scene graph; this ADR makes that
informal claim into an explicit, versioned contract, because once every producer (Workflow
A, Workflow B post-Phase-1, a future REST API) and every consumer (every `Renderer`
implementation, both Golden Dataset types) depends on the same structure, an unstated
assumption anywhere in it becomes a silent breaking change everywhere. The contract MUST
specify:

| Aspect | Rule |
|---|---|
| **Immutability** | `LayoutScene`, `RoomBlock`, `PositionedFace`, `FaceRenderGeometry`, `OpeningRenderGeometry` are frozen dataclasses (already true in `render_geometry.py`/`layout_engine.py` — this ADR makes it a contract requirement, not an implementation detail that could silently regress) |
| **Coordinate system** | World coordinates, XY plane, Z=0 (per the four-domain pipeline's `Core Pipeline` — see Overview); face-local coordinates have their own origin per ADR-e (Face-Local Coordinate System) |
| **Units** | Millimeters (mm), always. No mixed-unit scenes; no implicit unit conversion inside `LayoutScene` consumers — conversion (e.g. to inches for a US-market backend) happens at the `Backend` boundary (ADR-ff), never inside `LayoutScene` data |
| **Direction convention** | North-first, clockwise: N → E → S → W (ADR-p rule 1) — this session's `DIRECTIONS` bug (ADR-p compliance-fix note) is exactly the failure mode this contract entry exists to prevent from recurring silently |
| **Opening coordinate reference** | Opening `left`/`right`/`bottom`/`top` are face-local (relative to that `FaceRenderGeometry`'s own origin), NOT world coordinates — `PositionedFace.world_x`/`world_y` supplies the offset to convert to world coordinates. Producers MUST NOT pre-add world offsets into opening geometry (this exact confusion is what ADR-p's per-face left/right mirroring bug traced back to) |
| **Serialization** | JSON Schema (see "Golden Snapshot Format" below), versioned per ADR-dd's schema-versioning requirement (`schema_version`, `pipeline_version` fields mandatory on every serialized scene) |
| **Producer independence** | Any `LayoutScene` producer (Workflow A's CAD-scan assembly, Workflow B's fixture assembly, a future REST API) must be interchangeable from every consumer's perspective — a `Renderer` or Golden snapshot comparison must not special-case which workflow produced the scene it's given |

This ADR does not introduce new code — it names and closes gaps in an already-informally-agreed
contract, so that Roadmap Addendum Phase 3 (Workflow B → `LayoutScene`) has an explicit
spec to build against instead of "make it look like what Workflow A produces."

**Exit Criteria:**
- [ ] Every field in the contract table above has a corresponding check in
      `LayoutScene.validate()` (ADR-ii) — the contract is enforced, not just documented.
- [ ] Workflow A's and Workflow B's `LayoutScene` output are structurally interchangeable:
      a `Renderer` call given either one, with no workflow-identifying branch, produces
      correct output for both.
- [ ] `schema_version`/`pipeline_version` round-trip through at least one full
      serialize → deserialize → `assert_snapshot_match()` cycle in a test.

### ADR-ii: LayoutScene Validation
**Status**: Accepted (`validate()` fully implemented with 10 codes across ERROR/WARNING/INFO
severity levels in `layout_engine.py`; 1/3 exit criteria met — structured findings returned;
pending: both workflows call validate() before render, golden generation refuses on ERROR;
added 2026-07-12 per third architecture review)

ADR-ee states the `LayoutScene` contract; this ADR requires it be *checked*, not just
documented. `LayoutScene.validate()` runs the same structural checks this ADR-doc's
existing "Validation Rules (15 rules)" section already defines for the Architecture domain
(`WallFace`/`FaceOpening`), applied at the Presentation-domain boundary — i.e. after
Workflow A or B assembles a scene, before it reaches any `Renderer` or Golden snapshot.

**Structured severity, not bool (added 2026-07-12, fourth architecture review).** A plain
`bool`/`list[ValidationError]` return conflates "this scene cannot be rendered" with "this
scene renders fine but looks off" — a caller has no way to distinguish must-fix from
worth-a-look. `validate()` returns a list of severity-tagged findings instead:

```python
class ValidationSeverity(StrEnum):
    ERROR = "error"       # scene MUST NOT be rendered or accepted as Golden
    WARNING = "warning"   # renders, but likely wrong (e.g. unusually thin wall)
    INFO = "info"         # renders correctly; a quality/consistency suggestion

@dataclass(frozen=True)
class ValidationFinding:
    severity: ValidationSeverity
    rule: str              # e.g. "opening-within-face-bounds"
    message: str
    face_id: str | None = None
    opening_index: int | None = None

def validate(scene: LayoutScene) -> list[ValidationFinding]: ...
```

| Check | Severity | Catches |
|---|---|---|
| Every opening's `left/right` stays within its owning face's `outline_left/outline_right` | ERROR | Opening drawn outside its wall — the exact class of bug `draw_room1_elevations.py`'s own hand-written `assert`s already check for Workflow B (see the module's "VALIDATION" section) |
| `height <= 0` on any face or opening | ERROR | Malformed input data slipping through un-caught |
| Face sequence per room follows ADR-p's N→E→S→W order | ERROR | This session's `DIRECTIONS` bug — validation would have caught it before it ever reached ZWCAD |
| No two faces of the same room overlap in world coordinates | ERROR | Duplicate/conflicting wall data |
| Door/window width is positive and non-zero | ERROR | Degenerate opening geometry |
| Opening width exceeds 80% of its wall's length | WARNING | Plausible data-entry mistake (e.g. mm/cm unit confusion) that isn't strictly invalid |
| Two openings on the same face within 50mm of each other | WARNING | Likely a duplicate detection from CAD scanning (Workflow A), not necessarily wrong |
| Room lacks any door | INFO | Worth a human glance; not necessarily an error (e.g. an open-plan pass-through) |

A caller (Workflow A/B, Golden generation, or a Review Agent — see below) rejects on any
`ERROR` finding, may proceed-with-warning on `WARNING`, and may surface `INFO` purely for
review. This is what makes `validate()` usable by more than a pass/fail gate: **structured
findings are directly consumable by a Review Agent or Closed Loop Automation pipeline**
(if one exists in this project) as ready-made review comments, rather than requiring a
second translation layer from "validation failed" to "here's what a human should look at."

**Both workflows run this before rendering.** Per the "Sequencing note" in the Roadmap
Addendum, this closes the loop: Workflow B's existing hand-written `assert` loop
(`scripts/draw_room1_elevations.py`'s "VALIDATION" section) becomes redundant with — and
should eventually be replaced by — a call to the shared `LayoutScene.validate()`, once
Phase 3 (Workflow B → `LayoutScene`) lands; validating the *scene*, not `wall_defs`
directly, means the same check also runs for Workflow A's CAD-scanned data, which today has
no equivalent validation step at all. **Golden Dataset generation (ADR-dd) also requires
zero `ERROR`-severity findings before a snapshot is accepted** — an invalid scene must
never become a "golden" baseline.

**Exit Criteria:**
- [ ] `validate()` returns `ValidationFinding` objects (not a bare bool), with at least one
      `ERROR`, one `WARNING`, and one `INFO`-severity rule implemented.
- [ ] Both Workflow A and Workflow B call `validate()` before their respective render step,
      and both abort on any `ERROR` finding.
- [ ] Golden Dataset generation (ADR-dd) refuses to accept a snapshot when `validate()`
      returns any `ERROR` finding.

### ADR-ff: Renderer Output Backend Abstraction
**Status**: Partially Implemented (2026-07-30) — Phase 1 of the ADR's own 5-step reference
implementation order (RecordingBackend → MatplotlibBackend → ZWCADBackend → SVGBackend →
PDFBackend) is done: `RenderBackend` Protocol, `BackendCapability`, and `RecordingBackend`
exist in `render_backend.py` and are independently unit-tested. `Renderer`
(`ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/`WindowRenderer`) has NOT been
migrated off `DrawingContext` onto `RenderBackend` — that is Phase 3 in the ADR's order,
after `MatplotlibBackend` (Phase 2) proves the Protocol against a second real backend. All
four Exit Criteria below remain unchecked because each requires either a second backend or
the Renderer migration, neither of which exists yet.

Phase 2 (2026-07-30) added `MatplotlibBackend` — a second `RenderBackend` implementation
backed by a real rasterizer — plus a shared parametrized test suite proving the Protocol's
shape generalizes across both backends with zero backend-specific branching, and a working
`RecordingBackend` → `MatplotlibBackend` replay path. `Renderer` STILL has not been
migrated onto `RenderBackend` (Phase 3, unstarted).

Phase 3 (2026-07-30) redesigned `RenderBackend` to match Renderer's actual call surface
(`draw_line`/`draw_text`/`draw_dimension` with real signatures — `draw_arc`/`draw_hatch`
remain on the Protocol, and were additionally given real ZWCAD COM implementations
`ms.AddArc()`/`ms.AddHatch()` on `COMDrawingContext` during this phase, once it became
clear Protocol structural typing requires every listed method to exist by name — even
though no current `Renderer` calls them), promoted `COMDrawingContext`
(`zwcad_face_elevation_context.py`) to satisfy `RenderBackend` via a method rename
(`draw_aligned_dimension` → `draw_dimension`) rather than a new wrapper class, and migrated
all `Renderer` subclasses' constructor type annotations from `DrawingContext` to
`RenderBackend` (zero runtime behavior change — verified via parity test and full
regression, 66/66 tests passing). No new `ZWCADBackend` class exists; `COMDrawingContext`
IS the ZWCAD backend now, typed against `RenderBackend`.

Today's `Renderer` implementations call ZWCAD COM methods directly (`ms.AddLine`,
`ms.AddMText`, etc., via `DrawingContext`/`ZWCADDrawingContextAdapter` in
`rematch_openings.py`). This already-existing `DrawingContext` indirection is the seed of
this ADR, generalized: `Renderer` (and `WallRenderer`/`DoorRenderer`/`WindowRenderer` per
ADR-bb) should call only backend-neutral primitives —

```python
class RenderBackend(Protocol):
    def draw_line(self, p1: Point3, p2: Point3, layer: str, color: int | None) -> None: ...
    def draw_arc(self, center: Point3, radius: float, start_angle: float, end_angle: float, layer: str) -> None: ...
    def draw_hatch(self, boundary: list[Point3], pattern: str, layer: str) -> None: ...
    def draw_text(self, text: str, position: Point3, height: float, layer: str) -> None: ...
    def draw_dimension(self, p1: Point3, p2: Point3, text_position: Point3, layer: str) -> None: ...
```

— and never import `win32com`, ZWCAD layer names, or any target-format-specific module.
Concrete backends implement `RenderBackend`: `ZWCADBackend` (today's `DrawingContext`,
renamed/promoted to this Protocol), and future `SVGBackend`, `MatplotlibBackend`,
`SkiaBackend`, `PDFBackend` (`PDFAdapter` in `renderer/pdf_adapter.py` — see the earlier
"PDF→PNG process" review in this session's history — becomes a natural `PDFBackend`
implementation once this ADR lands, rather than the currently-unwired standalone adapter it
is today).

```
Renderer (WallRenderer / DoorRenderer / WindowRenderer, ADR-bb)
      │  calls only draw_line() / draw_arc() / draw_hatch() / draw_text() / draw_dimension()
      ▼
RenderBackend (Protocol)
      │
      ├── ZWCADBackend    (win32com, current default)
      ├── SVGBackend      (future)
      ├── PDFBackend      (future — subsumes renderer/pdf_adapter.py)
      ├── MatplotlibBackend (future — could directly produce Rendering Golden PNGs, ADR-dd)
      └── SkiaBackend     (future)
```

This is what makes ADR-dd's Rendering Golden practical without a live ZWCAD session in CI:
a `MatplotlibBackend` or headless `SVGBackend` can render the same `LayoutScene` +
`RenderStyle` to a PNG for pixel-diff comparison, entirely outside ZWCAD — today's
`ZWCADDrawingContextAdapter` requires a running ZWCAD COM session, which is not viable
inside CI.

**Capability negotiation (added 2026-07-12, third architecture review).** Not every
`RenderBackend` supports every primitive at full fidelity — e.g. a plain `SVGBackend`
without gradient support can't render a true hatch pattern the way `ZWCADBackend` can.
Rather than let each `Renderer` element method special-case backends by name (which
re-couples Renderer to backend identity, the exact thing this ADR removes), each backend
declares what it supports:

```python
@dataclass(frozen=True)
class BackendCapability:
    supports_hatch: bool = True
    supports_alpha: bool = True
    supports_arc: bool = True
    supports_pattern: bool = True

class RenderBackend(Protocol):
    capability: BackendCapability
    def draw_line(self, ...) -> None: ...
    ...
```

`WallRenderer`/`DoorRenderer` check `backend.capability` (not `isinstance(backend,
SVGBackend)`) before calling a primitive the backend can't honor, and degrade gracefully
(e.g. hatch → solid fill → nothing, in that order) — see ADR-hh below for how
`RecordingBackend` fits this same Protocol with `capability=BackendCapability()` (records
everything; downstream replay decides what to honor).

**Reference implementation order (added 2026-07-12, fourth architecture review).** Five
backends are named in this ADR; implementing them in the wrong order risks validating the
`RenderBackend` Protocol's shape against ZWCAD's COM quirks first, then discovering the
abstraction doesn't actually generalize. Build in this order instead:

1. **`RecordingBackend`** first — no drawing library dependency at all, fastest to write
   and test, and immediately unblocks ADR-dd's Golden infrastructure and ADR-hh's other use
   cases (undo/replay/debug/benchmark) before any real rendering exists.
2. **`MatplotlibBackend`** second — a real (if not production-target) drawing backend,
   proves the Protocol against an actual rasterizer, and gives CI a working Rendering
   Golden pixel-diff pipeline (Roadmap Addendum Phase 9) without needing ZWCAD or a GUI.
3. **`ZWCADBackend`** third — promote the existing `DrawingContext`/
   `ZWCADDrawingContextAdapter` to the now-proven Protocol; by this point the Protocol
   shape has already been validated against two independent backends, so ZWCAD-specific
   quirks (COM lifetime, layer creation) are isolated to this one implementation instead of
   leaking into the Protocol's design.
4. **`SVGBackend`** fourth — the first genuinely new production output target enabled by
   this ADR.
5. **`PDFBackend`** fifth — wraps the already-existing `renderer/pdf_adapter.py` (reviewed
   earlier this session as an unwired-but-legitimate module) into the Protocol; done last
   since it's the lowest-risk/lowest-urgency of the five.

**Exit Criteria:**
- [x] `RecordingBackend` and `MatplotlibBackend` both implement `RenderBackend` and both
      pass the same `Renderer`-level test suite with no backend-specific test branches.
      *(Satisfied (reinterpreted, see note) 2026-07-30 — NOT a literal reading of this
      criterion: "Renderer-level" is read as "RenderBackend-level" since no Renderer has
      been migrated onto RenderBackend yet (still Phase 3, unstarted).
      `tests/test_backend_shared_suite.py` runs an identical draw-call sequence against
      both RecordingBackend and MatplotlibBackend via parametrization with zero
      backend-specific branching in the calls made. See
      docs/superpowers/specs/2026-07-30-adr-ff-matplotlib-backend-design.md §Exit Criteria
      Disposition for the full disclosure.)*
- [ ] `ZWCADBackend` (promoted from `DrawingContext`) renders the same `LayoutScene`
      pixel-equivalently (via `RecordingBackend` replay through `MatplotlibBackend`) to
      what live ZWCAD produces, for at least one fixture room.
      *(Blocked 2026-07-30 — depends on MatplotlibBackend and ZWCADBackend, both
      unimplemented; not attempted.)*
- [x] `Renderer`'s source contains zero `import win32com` — every ZWCAD-specific import is
      confined to `ZWCADBackend`.
      *(Satisfied 2026-07-30 — verified via `grep -rn "import win32com"
      src/cad_intelligence/elevation/renderers/` returning zero matches, BOTH before and
      after Phase 3's changes (Renderer classes always called `self._ctx.draw_*`, never
      `win32com` directly). Phase 3's contribution is confirming this via the completed
      Protocol migration — `COMDrawingContext` (the one class that DOES import COM
      internals, via `com_primitives_v3`) now formally satisfies `RenderBackend`, making
      "ZWCAD-specific import confined to the backend" a checked architectural property, not
      just an incidental fact.)*
- [ ] A `BackendCapability`-gated degrade path (e.g. hatch → solid fill) is exercised by at
      least one test using a backend with `supports_hatch=False`.
      *(Blocked 2026-07-30 — no Renderer code path reads `.capability` yet, since no
      Renderer calls RenderBackend at all.)*

### ADR-hh: Recording Backend
**Status**: Proposed (target — implements the `RenderBackend` Protocol from ADR-ff; added
2026-07-12 per third architecture review)

A `RecordingBackend` implements `RenderBackend` (ADR-ff) but, instead of drawing anything,
appends each call to a command list:

```python
class RecordingBackend:
    """Implements RenderBackend by recording calls instead of drawing them."""
    capability = BackendCapability()  # records everything; replay decides what to honor
    commands: list[DrawCommand]

    def draw_line(self, p1, p2, layer, color=None) -> None:
        self.commands.append(Line(p1, p2, layer, color))
    # draw_arc → Arc(...), draw_hatch → Hatch(...), etc.
```

A command list (`[Line(...), Arc(...), Hatch(...), ...]`) is a serializable,
backend-agnostic recording of exactly what a `Renderer` call produced. This single
mechanism serves several needs that would otherwise each want their own bespoke
implementation:

| Use case | How `RecordingBackend` serves it |
|---|---|
| Rendering Golden generation (ADR-dd) | Record once, replay through any headless backend (`MatplotlibBackend` for a PNG) without re-running the full `Renderer.render()` pass — the command list IS the Rendering Golden's raw material |
| Undo | A command list is trivially invertible/discardable — undo an entire `render()` call by dropping its command list instead of tracking individual CAD entity handles |
| Replay | Re-run a captured command list against a *different* backend (e.g. "replay this ZWCAD session's draw calls into SVG for a client handout") without touching `LayoutScene`/`Renderer` at all |
| Debug viewer | A command list is a flat, inspectable trace of "what did the renderer actually try to draw" — useful when a `RenderStyle`/`Strategy` bug produces wrong output and the cause isn't obvious from the final drawing alone |
| Benchmark | Command-list size/composition (e.g. "1,200 `draw_line` calls for this room") is a cheap, backend-independent proxy for render cost, usable in perf regression tracking without needing a live CAD session |

Real CAD engines commonly use a display-list architecture for exactly these reasons — this
ADR adopts the same pattern rather than inventing a bespoke one.

**Exit Criteria:**
- [ ] `RecordingBackend`'s command list, replayed through `MatplotlibBackend`, produces the
      Rendering Golden PNG used in CI (ADR-dd Phase 9) — this is the backend's primary
      justification and must actually be exercised, not just theoretically possible.
- [ ] A captured command list can be replayed through a *second*, different backend without
      re-invoking `Renderer.render()` (proves record/replay decoupling from `LayoutScene`).
- [ ] Command-list size is logged/available for at least one fixture room, usable as a
      benchmark data point (even if no formal perf-regression CI job consumes it yet).

---

## DesignStandard Presets

```python
KOREAN_APARTMENT = DesignStandard(
    door_min_width=600, door_max_width=1800,
    default_door_height=2100, default_window_height=1400,
    default_sill_height=900,
)

OFFICE = DesignStandard(
    door_min_width=800, door_max_width=2400,
    default_door_height=2100, default_window_height=1400,
    default_sill_height=1000,
)
```

## Validation Rules (15 rules)

### Structural Invariants (always enforced)
| Rule | Description |
|------|-------------|
| R01 | Face.width > 0 |
| R02 | Face.height > 0 (or None acceptable) |
| R03 | Face.width == Σ wall segment lengths |
| R04 | Opening.left >= 0 |
| R05 | Opening.right <= Face.width |
| R06 | Opening.bottom >= 0 |
| R07 | Opening.top <= Face.height |
| R08 | Opening.width <= Face.width |
| R09 | Opening.height <= Face.height |
| R10 | Σ Opening width <= Face.width |
| R11 | No two openings may overlap |
| R12 | Door.bottom == 0 (floor-mounted) |
| R13 | Window.bottom > 0 (above floor) |

### Design Standard Policy (configurable)
| Rule | Description |
|------|-------------|
| R14 | Door.width within standard range |
| R15 | Window.bottom >= sill_height (if defined) |

## File Map

| # | Domain | File | Purpose |
|---|--------|------|---------|
| 1 | Geometry | `geometry/compass.py` | CompassFace, compute_wall_face, FaceCoordinateSystem |
| 2 | Topology | `geometry/boundary.py` | BoundaryEdge, BoundaryFace, BoundaryLoop, BoundaryBuilder |
| 3 | Geometry | `geometry/face_solid.py` | compute_solid_parts |
| 4 | Architecture | `common/room_face.py` | WallFace, FaceOpening, DesignStandard, ValidationResult |
| 5 | Architecture | `elevation/opening_projector.py` | ProjectedOpening, project_opening |
| 6 | Architecture | `elevation/room_face_builder.py` | WallFaceBuilder, build_all_room_faces |
| 7 | Presentation | `elevation/unfolded.py` | UnfoldedFaceView, UnfoldedRoom |
| 8 | Presentation | `elevation/render_geometry.py` | RenderGeometryAssembler, FaceRenderGeometry, RoomRenderGeometry |
| 9 | Presentation | `elevation/layout_engine.py` | UnfoldedLayoutConfig, RoomBlock, LayoutScene, UnfoldedLayoutEngine |
| 10 | Renderer | `elevation/renderer_base.py` | Renderer ABC |
| 11 | Renderer | `elevation/zwcad_renderer.py` | ZWCADFaceRenderer, `ZWCADLayerMap`, `ZWCADGeometryStyle` |
| 12 | Integration | `elevation/__init__.py` | Exports |
| 13 | Integration | `semantic/opening_assignment.py` | Backward compat |
| 14 | Integration | `cad_io/server.py` | MCP schema (layers param) |
| 15 | Integration | `cad_io/handlers/space.py` | Handler rewrite |
| 16 | Geometry | `geometry/errors.py` | BoundaryError hierarchy (ADR-c-imm) |
| 17 | Renderer | `elevation/renderers/base.py` | `BaseFaceRenderer` (scene traversal only) |
| 18 | Renderer | `elevation/renderers/__init__.py` | `ZWCADRendererFactory` (registry-based style selection, ADR-aa) |
| 19 *(superseded — ADR-bb)* | Renderer | `elevation/renderers/composed_renderer.py` | `ComposedFaceRenderer` — replaces the former `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` split; single `Renderer` parameterized by `RenderStyle` (ADR-bb, implemented 2026-07-29). Executes an ordered `RenderPass` pipeline (`render_pass.py`, ADR-gg, implemented 2026-07-29). |
| 20 *(superseded — ADR-bb)* | Renderer | `elevation/renderers/{wall,door,window}_renderer.py` | `WallRenderer`/`DoorRenderer`/`WindowRenderer` — element renderers composed by #19; delegate symbol drawing to strategies resolved from `render_style.py`'s registries (ADR-cc/jj, implemented 2026-07-29) |
| 21 *(superseded — ADR-cc/jj)* | Renderer | `elevation/renderers/detailed/{dimension,annotation}.py` | Remaining detailed-mode sub-renderers (`DimensionRenderer`, `AnnotationRenderer`); the former `{wall,door,window,opening}.py` files in this directory were deleted when their symbol-drawing logic moved into `elevation/symbols/` (ADR-cc/jj) |
| 21a | Renderer | `elevation/symbols/{primitives,door,window,material}.py` | Pure-geometry Symbol Library (ADR-jj) — vector symbol definitions consumed by `render_style.py`'s strategies; zero CAD/COM dependencies |
| 21b | Renderer | `elevation/renderers/render_style.py` | `RenderStyle`/`RenderCapabilities`/`RenderPolicies` (ADR-bb) + `SwingStrategyRegistry`/`WindowStrategyRegistry`/`MaterialStrategyRegistry` and concrete strategies (ADR-cc/jj) |
| 21c | Renderer | `elevation/renderers/render_backend.py` | `RenderBackend` Protocol, `BackendCapability`, `RecordingBackend` (ADR-ff Phase 1, implemented 2026-07-30) |
| 21d | Renderer | `elevation/renderers/matplotlib_backend.py` | `MatplotlibBackend` — second `RenderBackend` implementation, headless rasterizer (ADR-ff Phase 2, implemented 2026-07-30) |
| 21e | Renderer | `cad_io/handlers/zwcad_face_elevation_context.py` | `COMDrawingContext` — ZWCAD COM adapter; satisfies both the legacy `DrawingContext` Protocol and `RenderBackend` (ADR-ff Phase 3, implemented 2026-07-30); no separate `ZWCADBackend` class exists |
| 22 | Script (automated pipeline) | `scripts/rematch_openings.py` | Scans CAD → `walls.json` → `LayoutScene` → `ZWCADRendererFactory` (`--render-mode simple\|detailed`); see `skills/generate-room-elevation/SKILL.md` Workflow A |
| 23 | Script (reference/golden) | `scripts/draw_room1_elevations.py` | Hand-authored `WallDef`/`Opening` fixture, drawn via its own dedicated draw functions (does **not** go through `ZWCADRendererFactory` — see ADR-aa gap and Roadmap addendum); Workflow B |

*(Rows 19-21 originally described ADR-aa's `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer`/`detailed/{wall,door,window,opening}.py` split — all deleted and replaced per ADR-bb/cc/jj, implemented 2026-07-29. Rows 21a-21e added 2026-07-30 for ADR-ff Phases 1-3. Row numbers with letter suffixes avoid renumbering every downstream cross-reference to this table.)*

---

## Roadmap: Future ADR Implementation (Design Freeze v6)

**10 PRs · 3 milestones · 9 ADRs · 1 bug fix · 5 golden snapshots · 5 room fixtures**

### Implementation Principles

| Principle | Rule |
|-----------|------|
| No ADR changes during PR | Structural changes require a new ADR |
| Fixture First | Add fixtures before implementation |
| Snapshot as Contract | Snapshots are public contracts — changed only intentionally |
| PR Scope Discipline | No opportunistic changes — defer to next PR |

### Execution Order

```
PR-10 → PR-11a → PR-11b → PR-12 → PR-13 → PR-18a → PR-14a → PR-14b → PR-15 → PR-16 → PR-17 → PR-18b
```

### M4 — Foundation Layer

| PR | Scope | ADRs | Dependencies |
|----|-------|------|--------------|
| PR-10 | `angle_deg` bug fix + 7 validation rule tests (R03,R04,R06-R09) | — | standalone |
| PR-11a | `BoundaryLoop` Geometry API + error hierarchy (`vertices`, `polygon`, `bounds`, `centroid`, `to_polygon()`) | ADR-c-imm | standalone |
| PR-11b | Room Fixture Library (`rectangle`, `l_shape`, `corridor`, `shared_opening`, `concave`) | — | standalone |
| PR-12 | Concave room centroid via `self.polygon.centroid` | ADR-c | PR-11a, PR-11b |
| PR-13 | Boundary traversal ordering via vertex walk | ADR-b | PR-11a, PR-11b |
| PR-18a | Golden Snapshot infrastructure + initial snapshots (`rectangle.json`, `l_shape.json`) | — | PR-11b, PR-12, PR-13 |

### M5 — Topology & Identity

| PR | Scope | ADRs | Dependencies |
|----|-------|------|--------------|
| PR-14a | `BoundaryLoop.turn_angles` cached property | ADR-w | PR-11a, PR-13 |
| PR-14b | `face_id` → `B{boundary_index:03d}` + connectivity | ADR-n, ADR-r | PR-13, PR-14a |
| PR-15 | Shared opening orientation (`projection_flipped`, per-room `face_label`) | ADR-d | PR-11b |

### M6 — Domain Evolution

| PR | Scope | ADRs | Dependencies |
|----|-------|------|--------------|
| PR-16 | `FaceFeature` ABC + `FeatureType(StrEnum)` — Door/Window only | ADR-o | standalone |
| PR-17 | `WallSegmentResolver` Protocol + `InMemoryResolver` | ADR-j | standalone |
| PR-18b | Full integration tests + remaining snapshots (`shared_opening.json`, `concave.json`) | — | PR-18a, PR-14b, PR-15 |

### ADR Status

| ADR | PR | Status |
|-----|-----|--------|
| ADR-a | PR-71a | ✅ Active (Protocol-based Surface) |
| ADR-b | PR-13 | ✅ Active (implemented M4) |
| ADR-c | PR-12 | ✅ Active (implemented M4) |
| ADR-c-imm | PR-11a | Active |
| ADR-d | PR-15 | ✅ Active (implemented M5) |
| ADR-j | PR-17 | ✅ Active (implemented M6) |
| ADR-n | PR-14b | ✅ Active (implemented M5) |
| ADR-o | PR-16 | ✅ Active (implemented M6) |
| ADR-r | PR-14b | ✅ Active (implemented M5) |
| ADR-w | PR-14a | ✅ Active (implemented M5) |

### Golden Snapshot Format

```json
{
  "schema_version": 1,
  "pipeline_version": "elevation-v2",
  "rooms": [
    {
      "room_id": "...",
      "faces": [
        {"face_id": "room101:B000", "compass": "N", "width": 4200, "height": 2700, "openings": [...]}
      ]
    }
  ]
}
```

Policy: Explicit `--update-snapshots` only. CI fails on mismatch or missing snapshot.

### Deferred Items

| Item | Reintroduce When |
|------|-----------------|
| ColumnFeature, EquipmentFeature | Actual requirement |
| multi_floor fixture | Multi-floor pipeline |
| Half-edge vertex split | Graph queries on BoundaryVertex |
| FeatureType subtype | ColumnFeature need |

---

## Roadmap Addendum: Simple/Detailed Rendering Parity & Workflow A/B Convergence

> **Revised 2026-07-12** following an architecture review of the original 4-phase
> addendum below. The review's conclusion: a "pick one canonical door symbol" fix (the
> original Phase 1) treats a *structural* problem — two independent renderer classes, and
> soon N independent classes as more style tiers appear — as a one-off content bug. The
> revised roadmap targets **"one Renderer + composable RenderStyle" (ADR-bb/cc/dd)
> instead of "two renderers, kept in sync by hand."** Original phases are retained below,
> struck through in spirit (superseded, not deleted, per this doc's own "No ADR changes
> during PR" / traceability principle), replaced by the table that follows.

**Context.** This session fixed two Workflow A defects against this ADR's own rules
(ADR-p north-first order; the NORTH/EAST opening-position mirroring bug), added
per-wall height and a `WallDef`/`Opening` dataclass refactor to Workflow B, and
documented ADR-aa's simple/detailed renderer split — which surfaced that Workflow B
(the hand-verified reference/golden script) draws its own geometry directly rather than
going through `ZWCADRendererFactory`, so it cannot be driven by `--render-mode` and its
door symbol (true arc) doesn't match either renderer variant's door symbol exactly.

### Revised Phase Plan

> **Re-revised 2026-07-12** (third architecture review): renumbered 1–10 (was 1–8) to add
> LayoutScene Validation (ADR-ii, its own step right after the Contract it enforces) and a
> dedicated Render Pass Pipeline step (ADR-gg), and folded Strategy Registry & Symbol
> Library (ADR-jj) into the Strategy step and Recording Backend (ADR-hh) into the Backend
> step. Priorities below match this session's own assessment: Contract → Validation →
> Workflow B conversion → Renderer → Strategy/Registry → Backend/Recording as ★★★★★,
> Render Pass/Golden/CI as ★★★★☆, and Style expansion as ★★★☆☆.
>
> **Fourth architecture review (2026-07-12) — direction change.** Prior reviews kept
> finding gaps that each resolved into a new ADR (ADR-aa → ...→ ADR-jj). This review's
> conclusion, and the one this roadmap now follows: **stop adding ADRs; verify the ones
> that exist.** Each ADR above now carries an **Exit Criteria** checklist (added this pass)
> — the next unit of work per phase is "does this checklist pass," not "what's the next gap
> to design around." Added **Phase 11: Rendering Platform Complete** as the roadmap's
> overall exit gate — a definition-of-done sitting above the per-ADR Exit Criteria, so the
> project's endpoint is "the platform works, end to end," not "we keep finding more to
> design."

| Phase | Goal | Expected outcome | Priority |
|---|---|---|---|
| **1** (Completed) | Ratify ADR-ee (LayoutScene Contract): immutability, units (mm), coordinate system, ADR-p direction convention, face-local-vs-world opening coordinates, serialization/versioning | Gives Phase 2 a spec to build against; pure documentation, no code, do first | ★★★★★ |
| **2** (Completed) | Implement ADR-ii (`LayoutScene.validate()`): opening-within-face-bounds, positive height/width, ADR-p face-order compliance, no duplicate/overlapping faces | Both workflows and Golden generation gain a shared pre-render gate; would have caught this session's `DIRECTIONS` bug structurally, not by code review | ★★★★★ |
| **3** (Completed) | Convert Workflow B into a `LayoutScene` generator (validated via Phase 2's `validate()`), and mark its independent `draw_*` functions (`draw_wall_rect`, `draw_swing_door`, etc.) a **deprecation target** — removed once Phase 6's `REFERENCE` style preset confirms the shared renderer reproduces its output | Establishes the single `Workflow → LayoutScene → Renderer → CAD` path (see "Final Convergence" below); Workflow B's end state is fixture data + scene assembly ONLY, zero drawing code | ★★★★★ |
| **4** (Completed 2026-07-29) | Implement ADR-bb (+ style inheritance via `dataclasses.replace()`): collapse `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` into one `Renderer` composed of `WallRenderer`/`DoorRenderer`/`WindowRenderer`, parameterized by `RenderStyle` (capabilities + policies) | `simple`/`detailed` become two `RenderStyle` presets consumed by the *same* renderer code — done; both legacy classes deleted, `ComposedFaceRenderer` is the sole `Renderer` | ★★★★★ |
| **5** (Completed 2026-07-29) | Implement ADR-gg (Render Pass Pipeline): `BACKGROUND → WALL → OPENING → SYMBOL → DIMENSION → TEXT` as an explicit draw order inside `Renderer.render()` | Correct layer stacking regardless of scene traversal order; a natural backend-batching boundary — done via open `order`-keyed `RenderPass` in `composed_renderer.py` (Approach A, single-face scope; cross-face batching deferred to ADR-ff). Parity-verified byte-identical to pre-refactor output | ★★★★☆ |
| **6** | Implement ADR-cc + ADR-jj: extract `SwingSymbolStrategy`/`WindowSymbolStrategy`/`MaterialStrategy` behind a `Registry` (not a hardcoded factory), and split symbol geometry into a backend-agnostic Symbol Library | Symbol/material choice becomes pluggable, testable, and *extensible by plugins*; resolves the ADR-aa arc-vs-V-lines gap; adds the `REFERENCE` style preset that retires Workflow B's Oracle role (see below); same symbol geometry reusable across every backend | ★★★★★ |
| **7** | Implement ADR-ff (+ `BackendCapability` negotiation) + ADR-hh (`RecordingBackend`): introduce `RenderBackend` Protocol; promote today's `DrawingContext`/`ZWCADDrawingContextAdapter` to `ZWCADBackend`; add `RecordingBackend` and at least one headless backend (`MatplotlibBackend` or `SVGBackend`) | Decouples `Renderer` from `win32com`; `RecordingBackend`'s command list becomes the shared mechanism for Rendering Golden generation, undo, replay, debug viewing, and benchmarking — not four separate implementations | ★★★★★ |
| **8** | Implement ADR-dd: split Golden Dataset into **Geometry Golden** (`LayoutScene` → JSON, mandatory `schema_version`/`pipeline_version`, gated by Phase 2's `validate()`) and **Rendering Golden** (`LayoutScene` → Renderer → `RecordingBackend` → headless-backend PNG), with `STRICT`/`NORMAL`/`LOOSE` tolerance profiles | Catches both semantic regressions (this session's mirroring bug) and visual-only regressions, with explicit versioning and per-output tolerance | ★★★★☆ |
| **9** | Add image-diff CI regression: `LayoutScene → Renderer → RecordingBackend → headless Backend → PNG → pixel diff`, `NORMAL` (2px) profile by default | Catches swing-symbol/mullion/hatch/handle regressions automatically, in CI, before they reach ZWCAD | ★★★★☆ |
| **10** | Introduce further `RenderStyle` presets via inheritance (Phase 4) — `CONSTRUCTION` (extends `DETAILED`, `dimension_style=CONSTRUCTION`), `PRESENTATION` (extends `CONSTRUCTION`, `show_material=True`) | Long-term extensibility for CAD output tiers beyond the current set, as one-line `replace()` deltas, not new classes or flag explosion | ★★★☆☆ |
| **11** | **Rendering Platform Complete** — verify the definition-of-done below across Phases 1–10's combined output, not a new build task | Confirms the roadmap achieved a platform, not just a refactor; see "Rendering Platform Complete" below | ★★★★★ (gate) |

**Sequencing note.** Phases 1–2 are documentation/validation-only and should land before
any Phase 3 code (spec-and-gate first). Phase 3 is a prerequisite for Phases 4–8 — nothing
downstream is meaningful while Workflow B still bypasses the renderer entirely. Phases 4–6
(Renderer, Render Pass, Strategy/Registry) form one structural unit and should land
together — a `RenderStyle` with no pass order and no pluggable strategies is only a third
of the refactor. Phase 7 (Backend + Recording) should land before Phase 9 (image CI), since
Phase 9 needs a backend that runs without live ZWCAD, but does NOT strictly depend on
Phases 4–6 and could in principle land earlier — sequenced after them here so the new
`Renderer` shape gets a single migration instead of two. Phase 8's Geometry Golden half can
start as soon as Phase 2 lands (`validate()` gates it); its Rendering Golden half needs
Phases 3–7. Phase 10 is opportunistic — do it when a real `CONSTRUCTION`/`PRESENTATION` use
case appears, per this ADR's "Deferred Items" pattern, not speculatively.

**Workflow B deprecation target (explicit).** Today: `Workflow B → DrawXXX()`. End state
per this roadmap: `Workflow B → LayoutScene` — full stop. Every `draw_*` function currently
in `draw_room1_elevations.py` (`draw_wall_rect`, `draw_brick`, `draw_conc`,
`draw_open_sliding_window`, `draw_swing_door`, `draw_dims`) is scoped for removal once
Phase 6 lands and the shared `Renderer` under the `REFERENCE` style preset is confirmed to
reproduce Workflow B's current output. Workflow B keeps `WallDef`/`Opening`/`wall_defs` (its
Golden Fixture Generator role) permanently; it loses all drawing code. A
`# TODO(deprecation-target): remove once ADR-bb/cc land` comment block already marks this
intent in `scripts/draw_room1_elevations.py`'s Drawing Helpers section, so it's visible in
the code itself, not only in this document.

### Rendering Platform Complete (Phase 11 — roadmap exit gate)

The roadmap's terminal goal is not "add the last style tier" (Phase 10) — it's that the
accumulated Phase 1–10 work actually behaves like a platform. Defined as: all of the
following hold simultaneously, verified against real code, not read off this document:

- [ ] Workflow A and Workflow B both terminate at the same `LayoutScene → Renderer` call —
      neither has its own drawing implementation.
- [ ] `RecordingBackend`-based Golden/Replay/Benchmark all function end-to-end (ADR-hh Exit
      Criteria satisfied).
- [ ] Adding a new `RenderBackend` (a 6th, beyond the five named in ADR-ff) requires zero
      changes to `Renderer`/`WallRenderer`/`DoorRenderer`/`WindowRenderer` — only a new
      Protocol implementation.
- [ ] Adding a new `RenderStyle` (a 5th tier beyond SIMPLE/DETAILED/CONSTRUCTION/
      PRESENTATION) requires zero changes to any *other* style's behavior — no shared
      mutable state, no cross-style regression.
- [ ] Adding a new symbol (e.g. a new window type) requires zero changes to any
      `RenderBackend` implementation — only a new Symbol Library entry + Strategy
      registration (ADR-jj).

Each per-ADR "Exit Criteria" checklist above verifies its own layer in isolation; this
section verifies the *composition* — that the layers actually combine into the "Renderer +
RenderStyle, not two renderers" architecture this whole roadmap set out to build, not five
well-designed-in-isolation ADRs that don't cleanly compose in practice.

**Per-ADR implementability check (recommended before starting Phase 3+ implementation
work, not after).** Before implementing any Proposed-status ADR above, answer these four
questions for it — this is process guidance for implementers, not a new design artifact:

| Question | What "no" looks like |
|---|---|
| Implementation complexity | The ADR's code sample grows materially once real edge cases (e.g. concave rooms, shared walls) are considered — if so, revisit the ADR before coding, don't discover this mid-PR |
| Migration path | There's no way to land the ADR incrementally alongside the current `ZWCADSimpleFaceRenderer`/`ZWCADDetailedFaceRenderer` — a "big bang" rewrite with no intermediate working state is a red flag |
| Testability | The ADR's Exit Criteria checklist items can't be turned into an actual automated test — if an Exit Criterion can only be verified by manual inspection, that criterion needs rework |
| Performance | The abstraction (Strategy dispatch, Registry lookup, capability negotiation) adds measurable per-room render time for realistic room counts — acceptable overhead should be stated, not assumed |

### Workflow B's Two Roles (clarify explicitly, not just "Reference Renderer")

`skills/generate-room-elevation/SKILL.md` currently calls Workflow B a single thing
("Reference Renderer / Golden Dataset Generator"). It is actually two distinct roles that
should be named separately, because Phase 3 changes what each one means:

1. **Golden Fixture Generator**: `wall_defs` (the `WallDef`/`Opening` data) IS the
   human-verified input — a `rooms.json`-equivalent fixture, independent of how it gets
   rendered. This role is unaffected by Phase 3; if anything Phase 3 strengthens it, since
   the fixture becomes reusable as a Geometry Golden snapshot (ADR-dd) directly.
2. **Renderer Oracle**: before Phase 3, Workflow B's *drawing code* was implicitly also
   claiming to be the correct expected output — i.e. "if `rematch_openings.py`'s ZWCAD
   drawing doesn't look like `draw_room1_elevations.py`'s, the latter is right." After
   Phase 6 (Strategy/Registry) lands, this role transfers from Workflow B's hand-written
   draw functions to the `REFERENCE` `RenderStyle` preset (ADR-cc:
   `swing_symbol=ArcSwingStrategy()`) — the Oracle becomes "what the shared Renderer
   produces under the `REFERENCE` style," not "a second independent implementation that
   happens to agree." This is what removes the arc-vs-V-lines gap structurally rather than
   by picking a winner.

### Final Convergence Target

```
Workflow A (rematch_openings.py)      ──┐
                                         ├──► LayoutScene ──validate()──► RendererFactory
Workflow B (draw_room1_elevations.py) ──┘         (ADR-ee)   (ADR-ii)         │
                                                                                ▼
                                                                   Renderer (WallRenderer/
                                                                   DoorRenderer/WindowRenderer,
                                                                   RenderPass order, ADR-bb/gg)
                                                                                │
                                                                     Strategy/Registry (ADR-cc/jj)
                                                                                │
                                                                                ▼
                                                                     RenderBackend (ADR-ff)
                                                                                │
                                        ┌───────────────┬───────────────┬──────┴──────┬──────────────┐
                                        ▼               ▼               ▼             ▼              ▼
                                  ZWCADBackend      SVGBackend      PDFBackend  MatplotlibBackend  RecordingBackend
                                    (CAD)                                                          (ADR-hh: Golden/
                                                                                                     Undo/Replay/Debug/
                                                                                                     Benchmark)
```

Once both workflows terminate at the same `LayoutScene → RendererFactory` call, a
rendering bug fix happens in exactly one place, `simple`/`detailed`/`CONSTRUCTION`/
`PRESENTATION`/`REFERENCE` differ only by their `RenderStyle` capability+policy values
(never by duplicated draw logic), the Golden Dataset becomes workflow-agnostic (it
snapshots the shared `LayoutScene`/`Renderer` layer, not either script), and the same
`LayoutScene`/`Renderer` layer becomes reusable for non-ZWCAD output targets per ADR-z's
renderer-agnostic contract and ADR-ff's backend abstraction, without any additional
convergence work.

---

<details>
<summary>Original 4-phase addendum (2026-07-12, superseded by the 10-phase table above)</summary>

1. ~~Door symbol consistency — pick one canonical swing symbol for `detailed/door.py`~~
   → superseded by ADR-cc/jj: symbol becomes a pluggable, registrable strategy, not a
   single canonical choice.
2. ~~Converge Workflow B onto the shared Renderer~~ → retained as Phase 3 above.
3. ~~Formalize Workflow B as a golden-snapshot fixture~~ → retained as Phase 8
   (Geometry Golden half) above.
4. ~~Document `simple` mode's scope as intentional~~ → already applied to
   `skills/generate-room-elevation/SKILL.md`; still valid, now additionally clarified by
   ADR-bb's `RenderStyle`/style-inheritance framing (simple = the base preset; detailed,
   construction, presentation are deltas on top of it, not independent redefinitions).

</details>
