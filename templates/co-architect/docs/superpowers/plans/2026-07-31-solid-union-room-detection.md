---
lang: ko
lang_reason: proper-noun
---

# Solid Wall-Union Room Detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new, opt-in `WallProcessingMode.SOLID_UNION` room-detection path that
represents walls as thickness-aware solid polygons, unions them, and reads room
polygons directly off the union's interior rings — avoiding the coordinate-proximity
endpoint-welding judgments that caused the defect class fixed in PR #169.

**Architecture:** A new set of pure functions in `space_geometry.py`
(`_line_to_solid`, a solid-strip door/window bridging variant, `_nest_columns_into_rooms`,
and `_build_space_polygons_solid_union`) reuse PR #169's wall-face-pair matching for
thickness sourcing and the existing `_bridge_door_window_gaps`'s gap-detection
*decision* logic (not its line-based bridging). `LEGACY`/`ENDPOINT_CLUSTER` are
untouched; `SOLID_UNION` is a third, explicitly-selected mode.

**Tech Stack:** Python, `shapely` (`Polygon`, `unary_union`, `set_precision`), reuses
PR #169's `_find_mutual_best_pairs`/`_perp_distance_and_overlap`/`_compute_centerline`.

---

## Reference

Spec: `docs/superpowers/specs/2026-07-31-solid-union-room-detection-design.md` (read
this first — full rationale, the float-precision risk mitigation requirement, and the
exact `_extract_holes_and_filter`-is-NOT-reused correction from spec review).

Minimal repro coordinates (from PR #169's spec, reused here to prove `SOLID_UNION`
needs no cap segment at all):

```python
L_157F = LineString([(18136, 19381), (18136, 17706)])  # face A, 1675mm
L_15EC = LineString([(18226, 17706), (18226, 19381)])  # face B, 1675mm
# NOTE: no 15ED cap segment in this plan's tests — that's the point.
```

---

### Task 1: New enum member and constants

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add `SOLID_UNION = 3`
  to the `WallProcessingMode` enum (search for `class WallProcessingMode`, around
  line 266); add `SOLID_UNION_DEFAULT_THICKNESS_MM` and
  `SOLID_UNION_PRECISION_GRID_MM` constants near `WALL_FACE_PARALLEL_TOLERANCE_DEG`.

- [ ] **Step 1: Add `SOLID_UNION` to the enum**

Locate:
```python
class WallProcessingMode(enum.Enum):
    LEGACY = 1
    ENDPOINT_CLUSTER = 2
```

Change to:
```python
class WallProcessingMode(enum.Enum):
    LEGACY = 1
    ENDPOINT_CLUSTER = 2
    SOLID_UNION = 3
```

Do NOT change `WALL_PROCESSING_MODE`'s value (stays `ENDPOINT_CLUSTER` — `SOLID_UNION`
is opt-in only, selected explicitly by tests/callers).

- [ ] **Step 2: Add the two new constants**

Insert after `WALL_FACE_PARALLEL_TOLERANCE_DEG`'s definition (added by PR #169):

```python
#: Fallback wall thickness (mm) used by SOLID_UNION mode when a line has
#: no matched face-pair partner (see _find_mutual_best_pairs) to measure
#: thickness from directly. Chosen as the midpoint of this session's
#: observed exterior-wall thickness range (150-200mm) — a reasonable
#: single guess for an unmatched face.
SOLID_UNION_DEFAULT_THICKNESS_MM: float = 150.0

#: Precision grid (mm) applied to wall solids via shapely.set_precision
#: before unary_union, so touching solids merge deterministically instead
#: of leaking through sub-mm floating-point gaps at corners (see design
#: spec's "Risk, acknowledged directly" section — unary_union is not
#: actually tolerance-free; this constant is that relocated tolerance,
#: named and controlled rather than left to GEOS's default precision).
SOLID_UNION_PRECISION_GRID_MM: float = 1.0
```

- [ ] **Step 3: Add the missing `set_precision` import**

`Polygon`/`unary_union` are already imported in this file (used by
`_build_space_polygons`/`_extract_holes_and_filter`), but `set_precision` (needed by
Task 5) is not. Find the line `from shapely import STRtree` near the top of the file
and change it to:

```python
from shapely import STRtree, set_precision
```

- [ ] **Step 4: Verify the module still imports cleanly**

Run: `python -c "import sys; sys.path.insert(0,'src'); from cad_intelligence.geometry import space_geometry"`
Expected: no output, exit code 0.

- [ ] **Step 5: Do NOT commit**

This workspace requires commits go through `/sync` — leave files modified for the
orchestrator to commit later.

---

### Task 2: `_line_to_solid` — buffer a centerline into a rectangular solid

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add `_line_to_solid`
  in a new section right before `_weld_endpoints_v1` (after PR #169's wall-face-pair
  functions end, i.e. right after `_merge_wall_face_pairs`).
- Test: `tests/test_space_geometry.py` — new `TestSolidUnionRoomDetection` class
  (this task's tests are its first members).

- [ ] **Step 1: Write the failing tests**

```python
class TestSolidUnionRoomDetection(unittest.TestCase):
    def test_line_to_solid_produces_rectangle_of_correct_area(self):
        from cad_intelligence.geometry.space_geometry import _line_to_solid
        line = LineString([(0, 0), (1000, 0)])  # 1000mm long
        solid = _line_to_solid(line, thickness=100.0)
        # 1000mm x 100mm rectangle = 100,000 mm^2
        self.assertAlmostEqual(solid.area, 100_000.0, delta=1.0)

    def test_line_to_solid_flat_cap_does_not_extend_past_endpoints(self):
        from cad_intelligence.geometry.space_geometry import _line_to_solid
        line = LineString([(0, 0), (1000, 0)])
        solid = _line_to_solid(line, thickness=100.0)
        minx, miny, maxx, maxy = solid.bounds
        # flat cap_style: no rounded/extended stub past x=0 or x=1000
        self.assertAlmostEqual(minx, 0.0, delta=0.01)
        self.assertAlmostEqual(maxx, 1000.0, delta=0.01)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestSolidUnionRoomDetection -v`
Expected: FAIL — `_line_to_solid` doesn't exist yet.

- [ ] **Step 3: Implement `_line_to_solid`**

Add to `space_geometry.py`, in a new section right after `_merge_wall_face_pairs`
(PR #169's last function) and before `_weld_endpoints_v1`:

```python
# ---------------------------------------------------------------------------
# SOLID_UNION mode: area-based room detection (no endpoint-proximity
# judgments) — see docs/superpowers/specs/
# 2026-07-31-solid-union-room-detection-design.md.
# ---------------------------------------------------------------------------


def _line_to_solid(line: LineString, thickness: float) -> Polygon:
    """Buffer a centerline into a thickness-aware rectangular solid.

    Uses cap_style="flat" so wall ends don't grow rounded/extended
    stubs beyond their true endpoints — solids from adjoining walls
    are expected to overlap/touch at corners, which unary_union
    resolves automatically (this is the whole point: no
    endpoint-matching judgment is needed, overlapping solids just
    merge).
    """
    return line.buffer(thickness / 2.0, cap_style="flat")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestSolidUnionRoomDetection -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Do NOT commit** (per Task 1, Step 4).

---

### Task 3: Wall thickness sourcing — reuse PR #169's face-pair matching

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add
  `_lines_to_solids_with_thickness` right after `_line_to_solid`.

- [ ] **Step 1: Write the failing tests**

```python
    def test_matched_pair_uses_measured_thickness(self):
        from cad_intelligence.geometry.space_geometry import (
            _lines_to_solids_with_thickness,
        )
        # Two faces 90mm apart, full overlap -> matched pair.
        a = LineString([(0, 0), (0, 1000)])
        b = LineString([(90, 0), (90, 1000)])
        solids = _lines_to_solids_with_thickness([a, b])
        self.assertEqual(len(solids), 1)  # one wall, one solid
        # A 1000mm x 90mm rectangle = 90,000 mm^2 (approximately;
        # centerline-buffered solid should match the measured gap).
        self.assertAlmostEqual(solids[0].area, 90_000.0, delta=100.0)

    def test_unmatched_line_uses_default_thickness(self):
        from cad_intelligence.geometry.space_geometry import (
            _lines_to_solids_with_thickness,
            SOLID_UNION_DEFAULT_THICKNESS_MM,
        )
        lone = LineString([(0, 0), (0, 1000)])  # no partner nearby
        solids = _lines_to_solids_with_thickness([lone])
        self.assertEqual(len(solids), 1)
        expected_area = 1000.0 * SOLID_UNION_DEFAULT_THICKNESS_MM
        self.assertAlmostEqual(solids[0].area, expected_area, delta=1.0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_matched_pair_uses_measured_thickness" "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_unmatched_line_uses_default_thickness" -v`
Expected: FAIL — function doesn't exist yet.

- [ ] **Step 3: Implement `_lines_to_solids_with_thickness`**

Add right after `_line_to_solid`:

```python
def _lines_to_solids_with_thickness(
    lines: list[LineString],
    max_thickness: float = WALL_FACE_MAX_THICKNESS,
    min_overlap_ratio: float = WALL_FACE_MIN_OVERLAP_RATIO,
) -> list[Polygon]:
    """Convert wall lines to solids, reusing PR #169's face-pair
    matching to measure each matched pair's real thickness. A matched
    pair (i, j) becomes ONE solid, built on the pair's centerline at
    the pair's measured thickness. Unmatched (single-face) lines
    become their own solid at SOLID_UNION_DEFAULT_THICKNESS_MM.
    """
    n = len(lines)
    matchable = [(i, line) for i, line in enumerate(lines) if line.length > 0.0]
    matchable_lines = [line for _, line in matchable]

    pairs: list[tuple[int, int]] = []
    if len(matchable_lines) >= 2:
        pairs = _find_mutual_best_pairs(
            matchable_lines, max_thickness, min_overlap_ratio,
            WALL_FACE_PARALLEL_TOLERANCE_DEG,
        )

    solids: list[Polygon] = []
    matched_indices = {idx for pair in pairs for idx in pair}
    for i, j in pairs:
        centerline = _compute_centerline(matchable_lines[i], matchable_lines[j])
        thickness, _ = _perp_distance_and_overlap(matchable_lines[i], matchable_lines[j])
        solids.append(_line_to_solid(centerline, thickness))

    for idx, line in enumerate(matchable_lines):
        if idx not in matched_indices:
            solids.append(_line_to_solid(line, SOLID_UNION_DEFAULT_THICKNESS_MM))

    return solids
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_matched_pair_uses_measured_thickness" "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_unmatched_line_uses_default_thickness" -v`
Expected: PASS.

- [ ] **Step 5: Do NOT commit.**

---

### Task 4: Solid-strip door/window gap bridging

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add
  `_bridge_door_window_gaps_solid` right after `_lines_to_solids_with_thickness`.

This reuses `_find_gaps` (existing, unmodified) for gap *detection*, and
`OPENING_PROXIMITY_TOL` for the "is this gap actually a door/window" decision —
exactly as `_bridge_door_window_gaps` already does — but inserts a solid strip
instead of a `LineString` bridge.

- [ ] **Step 1: Write the failing tests**

```python
    def test_door_gap_without_bridging_leaks(self):
        """Two rooms separated by a wall with an unbridged gap and no
        nearby door evidence merge into ONE hole, not two."""
        from cad_intelligence.geometry.space_geometry import (
            _lines_to_solids_with_thickness,
        )
        from shapely.ops import unary_union
        # Two side-by-side square rooms (2000x2000) sharing a middle
        # wall with a 500mm unbridged gap in the middle, no door evidence.
        lines = [
            # outer boundary (one big rectangle ring split into 4 walls)
            LineString([(0, 0), (4000, 0)]),        # south
            LineString([(4000, 0), (4000, 2000)]),  # east
            LineString([(4000, 2000), (0, 2000)]),  # north
            LineString([(0, 2000), (0, 0)]),         # west
            # middle divider wall, WITH a 500mm gap (no door evidence)
            LineString([(2000, 0), (2000, 750)]),
            LineString([(2000, 1250), (2000, 2000)]),
        ]
        solids = _lines_to_solids_with_thickness(lines)
        merged = unary_union(solids)
        holes = list(merged.interiors) if hasattr(merged, "interiors") else []
        # Gap unbridged -> the two room voids merge into ONE hole
        self.assertEqual(len(holes), 1)

    def test_door_gap_with_bridging_separates_rooms(self):
        """Same setup, but with a DoorEntity near the gap -- the solid
        strip closes it, producing two separate holes."""
        from cad_intelligence.common.models import DoorEntity
        from cad_intelligence.geometry.space_geometry import (
            _lines_to_solids_with_thickness,
            _bridge_door_window_gaps_solid,
        )
        from shapely.ops import unary_union
        lines = [
            LineString([(0, 0), (4000, 0)]),
            LineString([(4000, 0), (4000, 2000)]),
            LineString([(4000, 2000), (0, 2000)]),
            LineString([(0, 2000), (0, 0)]),
            LineString([(2000, 0), (2000, 750)]),
            LineString([(2000, 1250), (2000, 2000)]),
        ]
        door = DoorEntity(
            handle="D1", layer="DOOR", position=(2000, 1000), width=900,
        )
        solids = _lines_to_solids_with_thickness(lines)
        bridge_solids = _bridge_door_window_gaps_solid(
            lines, [door], CORNER_SNAP_TOL, DOOR_BRIDGE_TOL,
            wall_thickness=SOLID_UNION_DEFAULT_THICKNESS_MM,
        )
        merged = unary_union(solids + bridge_solids)
        holes = list(merged.interiors) if hasattr(merged, "interiors") else []
        self.assertEqual(len(holes), 2)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_door_gap_without_bridging_leaks" "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_door_gap_with_bridging_separates_rooms" -v`

Expected: `test_door_gap_without_bridging_leaks` FAILS or ERRORS (function doesn't
exist for the second test; the first test only needs
`_lines_to_solids_with_thickness`, which already exists from Task 3 — if it FAILS
on the hole-count assertion instead of erroring, that's fine, it's testing
expected-without-fix behavior). `test_door_gap_with_bridging_separates_rooms` FAILS
— `_bridge_door_window_gaps_solid` doesn't exist yet.

- [ ] **Step 3: Implement `_bridge_door_window_gaps_solid`**

Add right after `_lines_to_solids_with_thickness`:

```python
def _bridge_door_window_gaps_solid(
    lines: list[LineString],
    openings: list["DoorEntity | WindowEntity"],
    corner_tol: float,
    bridge_tol: float,
    wall_thickness: float = SOLID_UNION_DEFAULT_THICKNESS_MM,
) -> list[Polygon]:
    """Solid-strip variant of _bridge_door_window_gaps: reuses the same
    gap-detection (_find_gaps) and opening-proximity decision
    (OPENING_PROXIMITY_TOL) to decide WHICH gaps are real doors/
    windows, but returns solid strip Polygons spanning each bridged
    gap instead of synthetic LineStrings -- so SOLID_UNION's
    unary_union doesn't leak room voids through door/window openings.
    """
    opening_points = [ShapelyPoint(o.position) for o in openings]
    gaps = _find_gaps(lines, bridge_tol)

    bridge_solids: list[Polygon] = []
    for p1, p2, dist in gaps:
        if dist <= corner_tol:
            continue
        gap_segment = LineString([(p1.x, p1.y), (p2.x, p2.y)])
        has_opening_nearby = any(
            gap_segment.distance(op) <= OPENING_PROXIMITY_TOL
            for op in opening_points
        )
        if has_opening_nearby:
            bridge_solids.append(_line_to_solid(gap_segment, wall_thickness))

    return bridge_solids
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_door_gap_without_bridging_leaks" "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_door_gap_with_bridging_separates_rooms" -v`
Expected: PASS (2 tests). If `test_door_gap_without_bridging_leaks` doesn't produce
exactly 1 hole, adjust the fixture geometry (not the implementation) until it does
— the point of this test is to document the *expected* leak, so the fixture must
actually leak for the test to mean anything.

- [ ] **Step 5: Do NOT commit.**

---

### Task 5: Precision snapping + room/column extraction (`_nest_columns_into_rooms`)

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add
  `_nest_columns_into_rooms` and `_build_space_polygons_solid_union` right after
  `_bridge_door_window_gaps_solid`.

Per the spec's Revision 2 correction: `_extract_holes_and_filter` is **not** reused
here (its flat-`Polygon`-list input shape and column-in-room semantics don't match
`.interiors`-derived rings). This task builds the actual room/column separation from
scratch, as a new, explicitly-named function.

- [ ] **Step 1: Write the failing tests**

```python
    def test_no_cap_needed_minimal_repro(self):
        """The exact 157F/15EC two-face case, open at one end, NO cap
        segment at all -- must still close via 2 bounding walls,
        proving SOLID_UNION needs no cap-removal logic in the first
        place (unlike ENDPOINT_CLUSTER + _merge_wall_face_pairs)."""
        from cad_intelligence.common.models import WallSegment
        from cad_intelligence.geometry.space_geometry import (
            _build_space_polygons_solid_union,
        )
        segs = [
            WallSegment(handle="157F", layer="3SEC", start=(18136, 19381), end=(18136, 17706), length=1675, thickness=None),
            WallSegment(handle="15EC", layer="3SEC", start=(18226, 17706), end=(18226, 19381), length=1675, thickness=None),
            # NOTE: no 15ED cap segment here at all.
            WallSegment(handle="north", layer="3SEC", start=(18181, 17706), end=(20181, 17706), length=2000, thickness=None),
            WallSegment(handle="east", layer="3SEC", start=(20181, 17706), end=(20181, 19381), length=1675, thickness=None),
            WallSegment(handle="south", layer="3SEC", start=(20181, 19381), end=(18181, 19381), length=2000, thickness=None),
        ]
        polygons, exceptions = _build_space_polygons_solid_union(segs, [])
        self.assertGreaterEqual(len(polygons), 1)

    def test_column_inside_room_not_a_false_room(self):
        """A small wall solid (column) entirely inside a room, touching
        no surrounding wall, must not appear as its own SpacePolygon."""
        from cad_intelligence.common.models import WallSegment
        from cad_intelligence.geometry.space_geometry import (
            _build_space_polygons_solid_union,
        )
        segs = [
            WallSegment(handle="s", layer="3SEC", start=(0, 0), end=(4000, 0), length=4000, thickness=None),
            WallSegment(handle="e", layer="3SEC", start=(4000, 0), end=(4000, 4000), length=4000, thickness=None),
            WallSegment(handle="n", layer="3SEC", start=(4000, 4000), end=(0, 4000), length=4000, thickness=None),
            WallSegment(handle="w", layer="3SEC", start=(0, 4000), end=(0, 0), length=4000, thickness=None),
            # A tiny column near the room's center, far from all walls.
            WallSegment(handle="col", layer="3SEC", start=(2000, 2000), end=(2200, 2000), length=200, thickness=None),
        ]
        polygons, exceptions = _build_space_polygons_solid_union(segs, [])
        # Exactly 1 real room -- the column must not produce a 2nd space.
        self.assertEqual(len(polygons), 1)

    def test_full_regression_legacy_and_endpoint_cluster_unaffected(self):
        """SOLID_UNION is purely additive -- existing test suite for
        LEGACY/ENDPOINT_CLUSTER paths must be unaffected. This is a
        sanity check that WallProcessingMode still has exactly the
        expected 3 members and the default is unchanged."""
        from cad_intelligence.geometry.space_geometry import (
            WallProcessingMode, WALL_PROCESSING_MODE,
        )
        self.assertEqual(
            {m.name for m in WallProcessingMode},
            {"LEGACY", "ENDPOINT_CLUSTER", "SOLID_UNION"},
        )
        self.assertEqual(WALL_PROCESSING_MODE, WallProcessingMode.ENDPOINT_CLUSTER)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_no_cap_needed_minimal_repro" "tests/test_space_geometry.py::TestSolidUnionRoomDetection::test_column_inside_room_not_a_false_room" -v`
Expected: FAIL — `_build_space_polygons_solid_union` doesn't exist yet.
(`test_full_regression_legacy_and_endpoint_cluster_unaffected` should already PASS
since Task 1 added `SOLID_UNION` to the enum — run it too and confirm.)

- [ ] **Step 3: Implement `_nest_columns_into_rooms` and `_build_space_polygons_solid_union`**

Add right after `_bridge_door_window_gaps_solid`:

```python
def _nest_columns_into_rooms(
    room_candidates: list[Polygon],
    other_solids: list[Polygon],
) -> list[Polygon]:
    """Convert small solids fully contained within a room candidate
    (e.g. a structural column) into holes of that room, so they don't
    appear as separate SpacePolygons.

    Unlike _extract_holes_and_filter (which reconciles polygonize_full's
    flat sibling-polygon output), this operates on SOLID_UNION's
    different shape: room_candidates are polygons built from
    Polygon.interiors rings (already-formed voids), and other_solids
    are OTHER polygons unary_union returned that are NOT room voids
    (e.g. a column that doesn't touch any surrounding wall, so GEOS
    keeps it as its own disjoint output polygon rather than nesting it
    as a second interior ring inside the room).
    """
    result: list[Polygon] = []
    for room in room_candidates:
        holes: list[list[tuple[float, float]]] = []
        for candidate in other_solids:
            if room.contains(candidate):
                holes.append(list(candidate.exterior.coords[:-1]))
        if holes:
            room = Polygon(list(room.exterior.coords), holes=holes)
        result.append(room)
    return result


def _build_space_polygons_solid_union(
    wall_segments: list["WallSegment"],
    openings: list["DoorEntity | WindowEntity"],
) -> tuple[list["SpacePolygon"], list["ExceptionReport"]]:
    """SOLID_UNION mode: build room polygons via wall-solid union
    instead of endpoint-welded polygonization. See design spec
    docs/superpowers/specs/2026-07-31-solid-union-room-detection-design.md.
    """
    exceptions: list["ExceptionReport"] = []

    raw_lines = _wall_segments_to_linestrings(wall_segments)
    if not raw_lines:
        return [], exceptions

    wall_solids = _lines_to_solids_with_thickness(raw_lines)
    # NOTE: bridge strips use SOLID_UNION_DEFAULT_THICKNESS_MM (the
    # function's default), not a per-gap adjacent-wall thickness
    # lookup. The spec's stated intent was "the thickness of whichever
    # gap-adjacent wall has a known thickness" -- deliberately
    # simplified here since a bridge strip's exact thickness only
    # affects how much it visually protrudes past the two wall faces
    # it connects, not whether the gap is correctly closed (the
    # room-separation outcome this step exists for). Revisit if a
    # real-drawing comparison (Task 7) shows this simplification
    # producing visibly wrong bridge geometry.
    bridge_solids = _bridge_door_window_gaps_solid(
        raw_lines, openings, CORNER_SNAP_TOL, DOOR_BRIDGE_TOL,
    )
    all_solids = wall_solids + bridge_solids

    # Snap to a fixed precision grid BEFORE union so touching solids
    # merge deterministically instead of leaking through sub-mm
    # floating-point gaps at corners (required mitigation per design
    # spec's "Risk, acknowledged directly" section).
    snapped_solids = [
        set_precision(s, SOLID_UNION_PRECISION_GRID_MM) for s in all_solids
    ]

    merged = unary_union(snapped_solids)
    merged_polygons: list[Polygon] = (
        [merged] if isinstance(merged, Polygon)
        else [p for p in merged.geoms if isinstance(p, Polygon)]
    )

    room_candidates: list[Polygon] = []
    for poly in merged_polygons:
        for ring in poly.interiors:
            room_candidates.append(Polygon(ring.coords))

    # "Other solids" for column detection: every top-level polygon
    # unary_union returned. merged_polygons IS the wall mass (exterior
    # boundary + interiors) -- a free-standing column that touches no
    # other wall shows up as its OWN separate polygon in
    # merged_polygons (not nested inside anything), so passing the
    # full list through and letting _nest_columns_into_rooms's
    # containment check filter it is correct and requires no
    # pre-filtering here.
    other_solids = list(merged_polygons)

    filtered = _nest_columns_into_rooms(room_candidates, other_solids)
    filtered = [p for p in filtered if p.area >= MIN_SPACE_AREA_MM2]

    used_ids: set[str] = set()
    space_polygons = [
        _polygon_to_space_polygon(p, used_ids) for p in filtered
    ]

    return space_polygons, exceptions
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestSolidUnionRoomDetection -v`
Expected: PASS (all tests added in Tasks 2-5 so far — 8 tests).

- [ ] **Step 5: Run the FULL existing test suite to confirm no regressions**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: PASS — all pre-existing tests (105 before this plan) plus this plan's new
tests, no regressions.

- [ ] **Step 6: Do NOT commit.**

---

### Task 6: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an `[Unreleased]` → `### Added` entry**

Follow the existing `CHANGELOG.md` format (see the PR #169 entry already present
under `### Fixed` for house style). Suggested entry:

```
### Added
- **[2026-07-31]**: **Added `WallProcessingMode.SOLID_UNION` — an opt-in, area-based
  room-detection path** (`src/cad_intelligence/geometry/space_geometry.py`) — an
  alternative to the endpoint-welding-based `LEGACY`/`ENDPOINT_CLUSTER` modes that
  represents walls as thickness-aware solid polygons (reusing PR #169's wall-face-pair
  matching for thickness), unions them via `shapely.ops.unary_union`, and reads room
  polygons directly off the union's interior rings. Because this is an area/topological
  operation rather than a coordinate-proximity graph operation, it is structurally
  immune to the specific self-chaining defect class fixed in PR #169 (though not to
  floating-point union precision in general — mitigated via `shapely.set_precision`
  before union). `LEGACY`/`ENDPOINT_CLUSTER` are entirely unmodified; `WALL_PROCESSING_MODE`'s
  default remains `ENDPOINT_CLUSTER` — `SOLID_UNION` must be explicitly selected. See
  `docs/superpowers/specs/2026-07-31-solid-union-room-detection-design.md` and
  `docs/superpowers/plans/2026-07-31-solid-union-room-detection.md`.
```

- [ ] **Step 2: Do NOT commit** — commits in this workspace go through `/sync`
  (`bun scripts/dev-sync.ts "<message>"`), not raw `git commit`.

---

### Task 7: Manual real-drawing comparison (not automated)

This is spec Testing item 8 — requires a live ZWCAD session. Perform manually after
Tasks 1-6 are complete:

- [ ] Open "아파트 평면도.dwg" in ZWCAD.
- [ ] Extract walls/doors/windows using the SAME extraction call/parameters used for
  any prior `ENDPOINT_CLUSTER` comparison run (to keep the comparison apples-to-apples
  — if the exact original extraction methodology can't be reconstructed, note that
  explicitly rather than presenting a mismatched comparison as conclusive).
- [ ] Run `_build_space_polygons_solid_union` on the same wall/door/window data.
- [ ] Compare room count and any leaked/merged holes against the `ENDPOINT_CLUSTER`
  result from the same extraction.
- [ ] Report results as exploratory data, not a pass/fail gate (per spec Testing
  item 8 — this session's earlier live-drawing verification attempts were
  inconclusive due to layer-filtering methodology issues unrelated to either
  algorithm; this comparison should not repeat that mistake by conflating layer-
  filtering noise with an algorithm-quality signal).

This task has no code changes and no commit — it's a verification checklist.

---

## Post-Plan Note

Per this workspace's `CLAUDE.md`, all commits must go through the `/sync` pipeline
(`bun scripts/dev-sync.ts`), never raw `git commit`. Add the `CHANGELOG.md` entry
(Task 6) before the final `/sync` of this feature, since `/sync` blocks if
`[Unreleased]` is empty.
