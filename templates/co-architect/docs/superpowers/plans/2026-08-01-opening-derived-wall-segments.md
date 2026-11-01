# Opening-Derived Wall Segments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pairwise `_synthesize_opening_evidence_walls` (PR #188, empirically ineffective on the reference drawing) with `_openings_to_wall_segments`, which synthesizes one short wall `LineString` per door/window opening at its own position and merges it into the wall network before welding.

**Architecture:** A new COM-free geometry helper `_openings_to_wall_segments(lines, openings)` in `space_geometry.py` returns `(synthesized_segments, exceptions)`. It is called inside the `ENDPOINT_CLUSTER` branch of `_build_space_polygons`, after `_merge_wall_face_pairs` and before `_weld_endpoints`, so synthesized segments are corner-snapped into the real wall network. Doors orient via `rotation`; windows orient via the nearest real wall segment's axis within a tolerance. The old pairwise function, its 4 constants, its call site, and its tests are removed.

**Tech Stack:** Python 3, shapely (`LineString`, `Point as ShapelyPoint`), `unittest`, existing `DoorEntity`/`WindowEntity`/`ExceptionReport` models. `math` and `ShapelyPoint` are already imported in `space_geometry.py` (used by the function being replaced).

**Spec:** `docs/superpowers/specs/2026-08-01-opening-derived-wall-segments-design.md`

---

## File Structure

- **Modify:** `src/cad_intelligence/geometry/space_geometry.py`
  - Add constants `OPENING_DEFAULT_WIDTH_MM`, `OPENING_AXIS_SEARCH_TOL_MM`.
  - Add function `_openings_to_wall_segments` (after `_synthesize_opening_evidence_walls`, which is removed in Task 3).
  - Rewire the `_build_space_polygons` ENDPOINT_CLUSTER call site (line ~2569-2594).
  - Remove (Task 3): `_synthesize_opening_evidence_walls`, constants `OPENING_EVIDENCE_MIN_DIST_MM`/`MAX_DIST_MM`/`ANGLE_TOL_DEG`/`WALL_PROXIMITY_TOL_MM`.
- **Modify:** `tests/test_space_geometry.py`
  - Add `TestOpeningsToWallSegments` (7 unit tests).
  - Replace the 2 tests in `TestBuildSpacePolygonsOpeningEvidenceSynthesis` with per-opening integration assertions.
  - Remove (Task 3): `TestSynthesizeOpeningEvidenceWalls` class, stale imports.
- **Modify:** `CHANGELOG.md` — add `[Unreleased]` entry (English only; describe Korean-named drawing/layers in English, never quote literal Hangul — the pre-commit hook blocks Hangul in CHANGELOG.md).

---

## Task 1: Add `_openings_to_wall_segments` + constants + unit tests (additive, no removal)

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (constants block ~line 216; new function after `_synthesize_opening_evidence_walls` ~line 1536)
- Test: `tests/test_space_geometry.py` (new class after `TestSynthesizeOpeningEvidenceWalls` ~line 406)

- [ ] **Step 1: Add the two new constants**

In `space_geometry.py`, immediately after the `OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM` definition (~line 216), add:

```python
#: Default width (mm) for openings whose own ``width`` is <= 0 (e.g.
#: curved-cluster-detected doors). Used by ``_openings_to_wall_segments``.
OPENING_DEFAULT_WIDTH_MM: float = 800.0

#: Max distance (mm) from a window opening's position to search for a real
#: wall segment whose axis direction the window will borrow (windows have no
#: ``rotation`` field). Beyond this, the window's axis is undeterminable and
#: it is skipped. Used by ``_openings_to_wall_segments``.
OPENING_AXIS_SEARCH_TOL_MM: float = 500.0
```

- [ ] **Step 2: Write the 7 failing unit tests**

In `tests/test_space_geometry.py`, add to the import block from `src.cad_intelligence.geometry.space_geometry` (line 27-54) the two new constants and the new function. Also add `math` import at top if not present (it is not currently imported by the test file — add `import math` after line 15):

```python
import math
```

Add to the `space_geometry` import list (alphabetical, before `OPENING_PROXIMITY_TOL`):

```python
    OPENING_AXIS_SEARCH_TOL_MM,
    OPENING_DEFAULT_WIDTH_MM,
    _openings_to_wall_segments,
```

Then add a new test class after `TestSynthesizeOpeningEvidenceWalls` (after line ~413, before the `TestWeldEndpoints`/next class):

```python
class TestOpeningsToWallSegments(unittest.TestCase):
    def test_door_rotation_zero_produces_horizontal_segment(self):
        """Door at origin, rotation=0 (+X), width=900 -> horizontal
        segment from (-450, 0) to (450, 0), plus one warning."""
        openings = [
            DoorEntity(handle="D1", layer="A-DOOR", position=(0.0, 0.0), width=900.0, rotation=0.0),
        ]
        synthesized, exceptions = _openings_to_wall_segments([], openings)
        self.assertEqual(len(synthesized), 1)
        seg = synthesized[0]
        self.assertAlmostEqual(seg.coords[0][0], -450.0)
        self.assertAlmostEqual(seg.coords[0][1], 0.0)
        self.assertAlmostEqual(seg.coords[1][0], 450.0)
        self.assertAlmostEqual(seg.coords[1][1], 0.0)
        self.assertEqual(len(exceptions), 1)
        self.assertEqual(exceptions[0].code, "SYNTHESIZED_OPENING_WALL_SEGMENT")
        self.assertEqual(exceptions[0].severity, "warning")

    def test_door_rotation_90_produces_vertical_segment(self):
        """Door at origin, rotation=pi/2 (+Y), width=1000 -> vertical
        segment from (0, -500) to (0, 500)."""
        openings = [
            DoorEntity(handle="D2", layer="A-DOOR", position=(0.0, 0.0), width=1000.0, rotation=math.pi / 2),
        ]
        synthesized, _ = _openings_to_wall_segments([], openings)
        self.assertEqual(len(synthesized), 1)
        seg = synthesized[0]
        self.assertAlmostEqual(seg.coords[0][0], 0.0)
        self.assertAlmostEqual(seg.coords[0][1], -500.0)
        self.assertAlmostEqual(seg.coords[1][0], 0.0)
        self.assertAlmostEqual(seg.coords[1][1], 500.0)

    def test_door_zero_width_uses_default_800mm(self):
        """Door with width=0.0 (curved-cluster limitation) gets the
        OPENING_DEFAULT_WIDTH_MM (800) default -> segment length 800."""
        openings = [
            DoorEntity(handle="D3", layer="A-DOOR", position=(0.0, 0.0), width=0.0, rotation=0.0),
        ]
        synthesized, _ = _openings_to_wall_segments([], openings)
        seg = synthesized[0]
        # length along X axis = 800, so endpoints +/- 400
        self.assertAlmostEqual(seg.coords[0][0], -400.0)
        self.assertAlmostEqual(seg.coords[1][0], 400.0)
        self.assertEqual(OPENING_DEFAULT_WIDTH_MM, 800.0)

    def test_window_near_horizontal_wall_borrows_horizontal_axis(self):
        """Window (no rotation) 100mm below a horizontal wall -> borrows
        the wall's 0-deg axis -> horizontal segment."""
        lines = [LineString([(0, 100), (2000, 100)])]
        openings = [
            WindowEntity(handle="W1", layer="A-WIND", position=(1000.0, 0.0), width=800.0),
        ]
        synthesized, exceptions = _openings_to_wall_segments(lines, openings)
        self.assertEqual(len(synthesized), 1)
        seg = synthesized[0]
        self.assertAlmostEqual(seg.coords[0][1], 0.0)  # horizontal at y=0
        self.assertAlmostEqual(seg.coords[1][1], 0.0)
        self.assertEqual(len(exceptions), 1)
        self.assertEqual(exceptions[0].code, "SYNTHESIZED_OPENING_WALL_SEGMENT")

    def test_window_near_vertical_wall_borrows_vertical_axis(self):
        """Window near a vertical wall -> borrows 90-deg axis -> vertical
        segment."""
        lines = [LineString([(0, 0), (0, 2000)])]
        openings = [
            WindowEntity(handle="W2", layer="A-WIND", position=(100.0, 1000.0), width=600.0),
        ]
        synthesized, _ = _openings_to_wall_segments(lines, openings)
        seg = synthesized[0]
        self.assertAlmostEqual(seg.coords[0][0], 100.0)  # vertical at x=100
        self.assertAlmostEqual(seg.coords[1][0], 100.0)

    def test_window_with_no_nearby_wall_is_skipped_with_exception(self):
        """Window farther than OPENING_AXIS_SEARCH_TOL_MM from any wall ->
        no segment, one OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS warning."""
        lines = [LineString([(0, 0), (1000, 0)])]
        openings = [
            # 5000mm away from the wall -> beyond the 500mm tolerance
            WindowEntity(handle="W3", layer="A-WIND", position=(5000.0, 5000.0), width=800.0),
        ]
        synthesized, exceptions = _openings_to_wall_segments(lines, openings)
        self.assertEqual(len(synthesized), 0)
        self.assertEqual(len(exceptions), 1)
        self.assertEqual(exceptions[0].code, "OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS")
        self.assertEqual(exceptions[0].severity, "warning")

    def test_mixed_openings_each_processed_independently(self):
        """One door (own rotation) + one window (wall axis) + one
        skip-only window -> 2 synthesized segments, 3 exceptions total."""
        lines = [LineString([(0, 100), (2000, 100)])]
        openings = [
            DoorEntity(handle="D1", layer="A-DOOR", position=(0.0, 0.0), width=900.0, rotation=0.0),
            WindowEntity(handle="W1", layer="A-WIND", position=(1000.0, 0.0), width=800.0),
            WindowEntity(handle="W2", layer="A-WIND", position=(9000.0, 9000.0), width=800.0),
        ]
        synthesized, exceptions = _openings_to_wall_segments(lines, openings)
        self.assertEqual(len(synthesized), 2)
        codes = sorted(e.code for e in exceptions)
        self.assertEqual(codes, [
            "OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS",
            "SYNTHESIZED_OPENING_WALL_SEGMENT",
            "SYNTHESIZED_OPENING_WALL_SEGMENT",
        ])
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestOpeningsToWallSegments -v`
Expected: FAIL — `_openings_to_wall_segments` not yet defined (ImportError).

- [ ] **Step 4: Implement `_openings_to_wall_segments`**

In `space_geometry.py`, immediately after the `_synthesize_opening_evidence_walls` function ends (~line 1535), add:

```python
def _openings_to_wall_segments(
    lines: list[LineString],
    openings: list[DoorEntity | WindowEntity],
) -> tuple[list[LineString], list[ExceptionReport]]:
    """Synthesize one short wall-like LineString per door/window opening,
    at the opening's own position, sized by its width and oriented by its
    own direction evidence. Intended to be merged into the real wall
    network BEFORE welding (see _build_space_polygons) so each synthesized
    segment is corner-snapped into the surrounding real walls.

    Direction rule:
    - Doors use their ``rotation`` field directly (radians; 0 = +X axis).
    - Windows have no ``rotation`` field, so they borrow the axis angle of
      the nearest real wall segment within ``OPENING_AXIS_SEARCH_TOL_MM``,
      measuring point-to-segment distance via shapely
      ``seg.distance(ShapelyPoint(position))``.

    Width rule: ``width`` if > 0, else ``OPENING_DEFAULT_WIDTH_MM``.

    Openings whose axis direction is undeterminable (a window with no real
    wall within tolerance) are SKIPPED with an
    OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS warning -- never guessed. Every
    successfully synthesized segment emits a
    SYNTHESIZED_OPENING_WALL_SEGMENT warning so inferred geometry is never
    silently indistinguishable from real drawing data downstream.

    See docs/superpowers/specs/2026-08-01-opening-derived-wall-segments-design.md.
    """
    synthesized: list[LineString] = []
    exceptions: list[ExceptionReport] = []

    def _nearest_wall_axis(pt: tuple[float, float]) -> float | None:
        p = ShapelyPoint(pt)
        best_seg: LineString | None = None
        best_dist = OPENING_AXIS_SEARCH_TOL_MM
        for seg in lines:
            d = seg.distance(p)
            if d <= best_dist:
                # ``<=`` (not ``<``) gives a deterministic first-in-list
                # tie-break for equidistant walls.
                best_dist = d
                best_seg = seg
        if best_seg is None:
            return None
        (x0, y0), (x1, y1) = best_seg.coords[0], best_seg.coords[-1]
        return math.atan2(y1 - y0, x1 - x0)

    for opening in openings:
        if isinstance(opening, DoorEntity):
            theta = opening.rotation
        else:
            theta = _nearest_wall_axis(opening.position)
            if theta is None:
                exceptions.append(ExceptionReport(
                    code="OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS",
                    severity="warning",
                    message=(
                        f"Skipped synthesizing a wall segment for window "
                        f"{opening.handle}: no real wall within "
                        f"{OPENING_AXIS_SEARCH_TOL_MM:.0f}mm to infer an "
                        "axis direction, so the segment orientation is "
                        "undeterminable."
                    ),
                    context={"handle": opening.handle, "layer": opening.layer},
                    suggested_action=(
                        "Confirm the window's position in the source "
                        "drawing; if a real wall is genuinely absent, this "
                        "opening contributes no synthesized segment this pass."
                    ),
                ))
                continue

        w = opening.width if opening.width > 0 else OPENING_DEFAULT_WIDTH_MM
        dx = (w / 2.0) * math.cos(theta)
        dy = (w / 2.0) * math.sin(theta)
        px, py = opening.position
        synthesized.append(LineString([(px - dx, py - dy), (px + dx, py + dy)]))
        exceptions.append(ExceptionReport(
            code="SYNTHESIZED_OPENING_WALL_SEGMENT",
            severity="warning",
            message=(
                f"Synthesized a {w:.0f}mm wall segment at opening "
                f"{opening.handle}'s position -- no real wall data exists "
                "at this opening in the source drawing, but the opening's "
                "own position/width/orientation evidence supports a wall "
                "segment here."
            ),
            context={"handle": opening.handle, "layer": opening.layer},
            suggested_action=(
                "Verify against the source drawing whether a real wall "
                "exists here; this segment was inferred, not extracted."
            ),
        ))

    return synthesized, exceptions
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestOpeningsToWallSegments -v`
Expected: PASS (7 tests).

- [ ] **Step 6: Run full suite to confirm no regressions**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: PASS — old `_synthesize_opening_evidence_walls` tests still pass (untouched).

- [ ] **Step 7: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): add _openings_to_wall_segments per-opening wall synthesis"
```

---

## Task 2: Rewire `_build_space_polygons` call site + replace integration tests

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py:2569-2594` (ENDPOINT_CLUSTER call site)
- Test: `tests/test_space_geometry.py:608-651` (`TestBuildSpacePolygonsOpeningEvidenceSynthesis`)

- [ ] **Step 1: Rewire the call site**

In `_build_space_polygons` (`space_geometry.py` ~line 2569-2594), replace this block:

```python
    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        raw_lines = _merge_wall_face_pairs(
            raw_lines, WALL_FACE_MAX_THICKNESS, WALL_FACE_MIN_OVERLAP_RATIO
        )

    welded_lines = _weld_endpoints(raw_lines, CORNER_SNAP_TOL, mode=mode)

    if axis_grid is not None:
        welded_lines, snap_exceptions = snap_to_axis_grid(welded_lines, axis_grid)
        exceptions.extend(snap_exceptions)

    bridged_lines, _bridges = _bridge_door_window_gaps(
        welded_lines, openings, CORNER_SNAP_TOL, DOOR_BRIDGE_TOL
    )

    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        synthesized_lines, synth_exceptions = _synthesize_opening_evidence_walls(
            bridged_lines, openings,
            OPENING_EVIDENCE_MIN_DIST_MM, OPENING_EVIDENCE_MAX_DIST_MM,
            OPENING_EVIDENCE_ANGLE_TOL_DEG, OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM,
        )
        bridged_lines = bridged_lines + synthesized_lines
        exceptions.extend(synth_exceptions)

    polygons, dangle_exceptions = _polygonize_network(bridged_lines)
    exceptions.extend(dangle_exceptions)
```

with:

```python
    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        raw_lines = _merge_wall_face_pairs(
            raw_lines, WALL_FACE_MAX_THICKNESS, WALL_FACE_MIN_OVERLAP_RATIO
        )
        # Synthesize one short wall segment per door/window opening, at the
        # opening's own position, BEFORE welding so the synthesized segments
        # are corner-snapped into the real wall network by the welder. See
        # docs/superpowers/specs/2026-08-01-opening-derived-wall-segments-design.md.
        opening_segments, opening_exceptions = _openings_to_wall_segments(
            raw_lines, openings
        )
        raw_lines = raw_lines + opening_segments
        exceptions.extend(opening_exceptions)

    welded_lines = _weld_endpoints(raw_lines, CORNER_SNAP_TOL, mode=mode)

    if axis_grid is not None:
        welded_lines, snap_exceptions = snap_to_axis_grid(welded_lines, axis_grid)
        exceptions.extend(snap_exceptions)

    bridged_lines, _bridges = _bridge_door_window_gaps(
        welded_lines, openings, CORNER_SNAP_TOL, DOOR_BRIDGE_TOL
    )

    polygons, dangle_exceptions = _polygonize_network(bridged_lines)
    exceptions.extend(dangle_exceptions)
```

Two placement rules satisfied: (1) `_openings_to_wall_segments` is inside the `ENDPOINT_CLUSTER` branch only; (2) it runs after `_merge_wall_face_pairs` and before `_weld_endpoints`.

- [ ] **Step 2: Replace the two integration tests**

In `tests/test_space_geometry.py`, replace the entire `TestBuildSpacePolygonsOpeningEvidenceSynthesis` class (~line 608-680) with:

```python
class TestBuildSpacePolygonsOpeningWallSegments(unittest.TestCase):
    def _make_wall_segment(self, handle, x1, y1, x2, y2):
        # WallSegment requires handle/layer/length (no defaults); reuse the
        # same helper shape the replaced class used.
        return WallSegment(
            handle=handle, layer="A-WALL",
            start=(float(x1), float(y1)), end=(float(x2), float(y2)),
            length=(((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5),
            thickness=200.0,
        )

    def test_build_space_polygons_synthesizes_per_opening_wall_segments(self):
        """In ENDPOINT_CLUSTER mode, a door whose position fills a gap in
        the wall network causes a synthesized segment to be emitted (one
        SYNTHESIZED_OPENING_WALL_SEGMENT warning), and the segment feeds
        welding/polygonization."""
        # A near-closed square with a gap on the right edge centered at
        # (2000, 500). A door sits exactly in that gap.
        wall_segments = [
            self._make_wall_segment("L", 0, 0, 0, 1000),          # left
            self._make_wall_segment("B", 0, 0, 2000, 0),          # bottom
            self._make_wall_segment("T", 0, 1000, 2000, 1000),    # top
            self._make_wall_segment("RL", 2000, 0, 2000, 100),    # right lower stub
            self._make_wall_segment("RU", 2000, 900, 2000, 1000), # right upper stub
        ]
        openings = [
            DoorEntity(handle="D1", layer="A-DOOR", position=(2000.0, 500.0), width=800.0, rotation=math.pi / 2),
        ]
        spaces, exceptions = _build_space_polygons(
            wall_segments, openings, mode=WallProcessingMode.ENDPOINT_CLUSTER
        )
        codes = [e.code for e in exceptions]
        self.assertIn("SYNTHESIZED_OPENING_WALL_SEGMENT", codes)

    def test_build_space_polygons_solid_union_unaffected_by_opening_segments(self):
        """SOLID_UNION mode is dispatched to a different builder and must
        not emit SYNTHESIZED_OPENING_WALL_SEGMENT (the new step is
        ENDPOINT_CLUSTER-scoped)."""
        wall_segments = [
            self._make_wall_segment("L", 0, 0, 0, 1000),
            self._make_wall_segment("B", 0, 0, 1000, 0),
            self._make_wall_segment("T", 0, 1000, 1000, 1000),
            self._make_wall_segment("R", 1000, 0, 1000, 1000),
        ]
        openings = [
            DoorEntity(handle="D1", layer="A-DOOR", position=(500.0, 0.0), width=900.0, rotation=0.0),
        ]
        # SOLID_UNION is normally dispatched at the handler layer; calling
        # _build_space_polygons directly with SOLID_UNION falls through to
        # the non-ENDPOINT_CLUSTER path, which must not synthesize.
        spaces, exceptions = _build_space_polygons(
            wall_segments, openings, mode=WallProcessingMode.SOLID_UNION
        )
        codes = [e.code for e in exceptions]
        self.assertNotIn("SYNTHESIZED_OPENING_WALL_SEGMENT", codes)
```

- [ ] **Step 3: Run the new integration tests**

Run: `python -m pytest tests/test_space_geometry.py::TestBuildSpacePolygonsOpeningWallSegments -v`
Expected: PASS (2 tests).

- [ ] **Step 4: Run full suite**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: PASS — note that `TestSynthesizeOpeningEvidenceWalls` (old unit tests for the still-present old function) still passes because the old function still exists; it is removed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "refactor(geometry): rewire _build_space_polygons to per-opening wall synthesis"
```

---

## Task 3: Remove the superseded pairwise function, constants, and tests

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (remove `_synthesize_opening_evidence_walls` ~line 1428-1535; remove 4 constants ~line 197-216)
- Modify: `tests/test_space_geometry.py` (remove `TestSynthesizeOpeningEvidenceWalls` ~line 274-413; remove stale imports)

- [ ] **Step 1: Remove the 4 superseded constants**

In `space_geometry.py`, delete the constant definitions and their docstring comments for:
- `OPENING_EVIDENCE_MIN_DIST_MM` (~line 197-198)
- `OPENING_EVIDENCE_MAX_DIST_MM` (~line 203-204)
- `OPENING_EVIDENCE_ANGLE_TOL_DEG` (~line 208-209)
- `OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM` (~line 215-216)

Keep `OPENING_DEFAULT_WIDTH_MM` and `OPENING_AXIS_SEARCH_TOL_MM` (added in Task 1).

- [ ] **Step 2: Remove the superseded function**

Delete the entire `_synthesize_opening_evidence_walls` function (~line 1428-1535), including its docstring.

- [ ] **Step 3: Remove old unit tests and stale imports**

In `tests/test_space_geometry.py`:
- Delete the entire `TestSynthesizeOpeningEvidenceWalls` class (~line 274-406).
- Remove these now-unused names from the `space_geometry` import block (lines 27-54): `_synthesize_opening_evidence_walls`, `OPENING_EVIDENCE_ANGLE_TOL_DEG`, `OPENING_EVIDENCE_MAX_DIST_MM`, `OPENING_EVIDENCE_MIN_DIST_MM`, `OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM`.

- [ ] **Step 4: Run full suite to confirm clean removal**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: PASS — no remaining references to the removed symbols. If an `ImportError` appears, a stale import was missed (grep for `OPENING_EVIDENCE` and `_synthesize_opening_evidence_walls` across `tests/` and `src/`).

Run: `python -m pytest tests/ -q`
Expected: PASS (whole test suite).

- [ ] **Step 5: Grep for orphan references**

Run: `grep -rn "OPENING_EVIDENCE\|_synthesize_opening_evidence_walls\|SYNTHESIZED_OPENING_EVIDENCE_WALL" src/ tests/ docs/`
Expected: only matches in `docs/superpowers/specs/2026-08-01-opening-evidence-wall-synthesis-design.md` (the old PR #188 spec, retained for history). No matches in `src/` or `tests/`.

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "chore(geometry): remove superseded pairwise opening-evidence synthesis (PR #188)"
```

---

## Task 4: CHANGELOG + manual verification checklist

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry**

Under `CHANGELOG.md` `[Unreleased]`, add (English only — do NOT quote literal Korean drawing/layer names; the pre-commit hook blocks Hangul in this file):

```markdown
### Changed
- Room-boundary reconstruction (`_build_space_polygons`, ENDPOINT_CLUSTER mode) now synthesizes one short wall segment per door/window opening at the opening's own position and merges it into the wall network before welding, replacing the pairwise opening-connection approach that proved ineffective on densely-walled drawings. Doors orient via their `rotation` field; windows borrow the nearest real wall's axis. Removed the superseded `_synthesize_opening_evidence_walls` and its four `OPENING_EVIDENCE_*` constants.
```

- [ ] **Step 2: Manual verification checklist (post-merge, requires MCP restart)**

After the PR merges and the user restarts the ZWCAD MCP connection, run on the reference drawing and record actual numbers honestly:
- `zwcad_classify_layers` → `zwcad_extract_cad_objects` → `zwcad_generate_spaces` (ENDPOINT_CLUSTER) → `zwcad_extract_text_labels`.
- Record: room count (was 4), `SYNTHESIZED_OPENING_WALL_SEGMENT` exception count (was 0 synthesized in PR #188), `OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS` count, total exception count (was 100).
- Compare against the 8 known real rooms. Do NOT assert 8 will be reached — the drawing may still have wall gaps this approach does not cover. Report the delta truthfully.

- [ ] **Step 3: Run `/sync` to commit + push + open PR**

This is the final step — handled by the sync pipeline (lifecycle + audit + commit + push + PR). No manual `git commit`/`git push` (workspace forbids it; use `/sync`).
