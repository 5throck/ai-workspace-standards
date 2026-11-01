# Synthesize Opening-Evidence Walls Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `_synthesize_opening_evidence_walls` to `_build_space_polygons`'s `ENDPOINT_CLUSTER` pipeline, synthesizing wall `LineString`s between pairs of door/window openings when distance/angle/real-wall-proximity evidence supports it, guarded by a wall-crossing exclusion gate that prevents connecting openings across an existing real party wall — working around missing source-drawing wall data (rather than fixing wall extraction/welding, already attempted and abandoned).

**Architecture:** One new pure function in `space_geometry.py`, four new module-level constants, one new call site in `_build_space_polygons` gated to `ENDPOINT_CLUSTER` mode only. Reuses the existing `_angle_diff_deg` helper and the existing crossing-check pattern from `_validate_dividers` (not a new idiom).

**Tech Stack:** Python, `shapely.geometry.LineString`/`Point`, existing `DoorEntity`/`WindowEntity`/`ExceptionReport` dataclasses.

---

## Reference

Spec (approved after 2 revision rounds — round 1 promoted same-room disambiguation from Non-Goal to a required v1 wall-crossing gate after review caught a real false-positive class; round 2 aligned the gate's implementation with this file's existing `_validate_dividers` crossing-check pattern instead of introducing a new shapely idiom): `docs/superpowers/specs/2026-08-01-opening-evidence-wall-synthesis-design.md`

Key verified facts (from spec review, both rounds):
- `_bridge_door_window_gaps` (`space_geometry.py:1360-1401`) is the existing small-gap bridging step this new function complements, not replaces.
- Constants confirmed at current line numbers: `CORNER_SNAP_TOL=150.0` (143), `DOOR_BRIDGE_TOL=1200.0` (149), `OPENING_PROXIMITY_TOL=200.0` (157).
- `_build_space_polygons` (line ~2364): `_bridge_door_window_gaps` call at lines ~2446-2448, `_polygonize_network` call at line ~2450 — insertion point is between them. `mode` parameter is in scope throughout.
- `_angle_diff_deg` (`space_geometry.py:550-556`): `abs(a-b) % 180.0` then `min(d, 180-d)` — reuse directly, don't reimplement.
- `_validate_dividers`'s crossing-check pattern (`space_geometry.py` ~2040-2059, inside its "3. Cross-wall check" block): `div_line.intersects(wall)` → `div_line.intersection(wall)` → if the intersection is a `Point`, check whether it equals one of the candidate line's own endpoints (endpoint touch = OK, interior crossing = reject); handle the `LineString`/multi-point overlap case similarly. **Copy this exact pattern**, don't introduce `.crosses()`/`.overlaps()`.
- `ExceptionReport` fields: `code`, `severity` (`"blocking"`/`"warning"` only — use `"warning"`), `message`, `context`, `suggested_action`.
- Residual known limitation (explicitly documented in the spec, not silently missing): two openings near different-but-collinear real wall stubs with a gap between them can produce a crossing-free candidate line whether the gap is a real missing wall run OR two genuinely unrelated wall pieces — not solved in v1, acceptable given every synthesized wall is still recorded via the exception report for downstream auditability.

---

### Task 1: `_synthesize_opening_evidence_walls` + constants

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — new constants near `CORNER_SNAP_TOL`/`DOOR_BRIDGE_TOL`/`OPENING_PROXIMITY_TOL` (~line 143-166); new function placed near `_bridge_door_window_gaps` (after its closing line, ~1401).
- Test: `tests/test_space_geometry.py` (read the file first to confirm existing fixture-construction conventions for `DoorEntity`/`WindowEntity`/`LineString` test data before writing new tests — match whatever helper/style already exists for testing `_bridge_door_window_gaps`, if any).

- [ ] **Step 1: Read existing test coverage for `_bridge_door_window_gaps`** in `tests/test_space_geometry.py` (search for it) to confirm the exact fixture-construction style (direct `DoorEntity(...)`/`WindowEntity(...)` construction? a helper function?) — match it for the new tests rather than inventing a new style.

- [ ] **Step 2: Write the failing tests**

Add a new test class (or extend an existing one matching Step 1's findings) with these cases, mirroring the spec's Testing section exactly:

1. `test_plausible_pair_with_real_wall_evidence_synthesizes_wall` — two doors ~3000mm apart, aligned with a nearby real wall segment's axis (within `OPENING_EVIDENCE_ANGLE_TOL_DEG`), one within `OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM` of that wall's endpoint, candidate line crosses no existing wall → `_synthesize_opening_evidence_walls` returns 1 synthesized `LineString` + 1 `ExceptionReport(code="SYNTHESIZED_OPENING_EVIDENCE_WALL", severity="warning")`.
2. `test_openings_too_close_not_connected` — two openings 100mm apart (below `OPENING_EVIDENCE_MIN_DIST_MM`) → not connected, empty result.
3. `test_openings_too_far_not_connected` — two openings 10000mm apart (above `OPENING_EVIDENCE_MAX_DIST_MM`) → not connected.
4. `test_no_nearby_wall_axis_match_not_connected` — plausible distance, but no real wall segment nearby at a matching angle → not connected (angle-evidence gate).
5. `test_neither_opening_near_real_wall_not_connected` — plausible distance/angle, but neither opening is near any real wall segment → not connected (embedding-evidence gate).
6. `test_wall_crossing_gate_rejects_party_wall_case` — **the most important test**: two openings positioned on opposite sides of a single real wall segment (e.g. a door and a window each ~1000mm from the same wall's midpoint, on opposite perpendicular sides), satisfying distance/angle/proximity criteria independently, but the candidate connecting line crosses that real wall segment at an interior point → rejected, not connected. Directly reproduces the failure mode spec review caught.
7. `test_wall_crossing_gate_does_not_over_reject_legitimate_case` — same setup as test 1 (a genuinely evidence-backed pair) but explicitly asserting the candidate line does NOT cross any wall — confirms the new gate doesn't accidentally reject the legitimate case it's meant to allow.

Before finalizing, verify against the actual `DoorEntity`/`WindowEntity` dataclass fields in `common/models.py` (required fields, no defaults) — same discipline as this session's earlier door/window detector work, which caught a real bug from skipping this check.

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py -v -k "opening_evidence or synthesize"` (adjust `-k` filter to match your actual test names)
Expected: FAIL — `_synthesize_opening_evidence_walls` doesn't exist yet.

- [ ] **Step 4: Add the constants**

Near `CORNER_SNAP_TOL`/`DOOR_BRIDGE_TOL`/`OPENING_PROXIMITY_TOL` (~space_geometry.py:143-166):

```python
#: Minimum distance (mm) between two door/window openings for a
#: synthesized connecting wall to be plausible -- below this, the
#: openings are likely on the same short wall segment already handled
#: by _bridge_door_window_gaps, not evidence of a missing wall run.
OPENING_EVIDENCE_MIN_DIST_MM: float = 500.0

#: Maximum distance (mm) between two door/window openings for a
#: synthesized connecting wall to be plausible -- above this, a
#: connection is more likely a false positive spanning unrelated parts
#: of the drawing than a single missing wall run.
OPENING_EVIDENCE_MAX_DIST_MM: float = 6000.0

#: Angle tolerance (degrees, mod 180) between a candidate opening-pair
#: connection direction and a nearby real wall segment's own axis --
#: the "this direction is a real wall axis in this drawing" evidence.
OPENING_EVIDENCE_ANGLE_TOL_DEG: float = 15.0

#: Proximity (mm) an opening must have to a real wall segment endpoint
#: to count as "embedded in a real wall, not floating" evidence.
#: Deliberately distinct from OPENING_PROXIMITY_TOL (200mm, a different
#: physical question -- "is this gap explained by this opening") per
#: this module's one-constant-per-question principle.
OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM: float = 500.0
```

- [ ] **Step 5: Implement `_synthesize_opening_evidence_walls`**

Add after `_bridge_door_window_gaps`'s closing line (~space_geometry.py:1401):

```python
def _synthesize_opening_evidence_walls(
    lines: list[LineString],
    openings: list[DoorEntity | WindowEntity],
    min_dist: float,
    max_dist: float,
    angle_tol_deg: float,
    real_wall_proximity_tol: float,
) -> tuple[list[LineString], list[ExceptionReport]]:
    """Synthesize wall LineStrings connecting pairs of door/window
    openings, when the connection is geometrically well-evidenced by
    a nearby real wall segment's axis direction, AND the candidate
    connecting line does not cross any existing real wall segment
    (which would indicate the two openings are on opposite sides of
    an unrelated party wall, not a genuine missing-wall gap -- see
    docs/superpowers/specs/2026-08-01-opening-evidence-wall-synthesis-design.md).

    A pair (A, B) is connected only if ALL of:
    - distance(A.position, B.position) is within [min_dist, max_dist].
    - the A->B direction is within angle_tol_deg (mod 180, via
      _angle_diff_deg) of SOME real wall segment's axis direction,
      where that wall segment lies within real_wall_proximity_tol of
      EITHER A or B.
    - at least ONE of A, B lies within real_wall_proximity_tol of a
      real wall segment endpoint.
    - the candidate LineString(A.position, B.position) does not cross
      any real wall segment at a non-endpoint point (the wall-crossing
      exclusion gate -- reuses the same intersects/intersection +
      endpoint-check pattern as _validate_dividers's cross-wall check).

    Every accepted pair produces one synthesized LineString and one
    ExceptionReport(code="SYNTHESIZED_OPENING_EVIDENCE_WALL",
    severity="warning") recording the opening handles involved, so a
    synthesized wall is never silently indistinguishable from real
    drawing data downstream.
    """
    synthesized: list[LineString] = []
    exceptions: list[ExceptionReport] = []

    def _wall_axis_angle(seg: LineString) -> float:
        (x0, y0), (x1, y1) = seg.coords[0], seg.coords[-1]
        return math.degrees(math.atan2(y1 - y0, x1 - x0))

    def _pair_axis_angle(p0: tuple[float, float], p1: tuple[float, float]) -> float:
        return math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0]))

    def _near_real_wall(pt: tuple[float, float]) -> list[LineString]:
        p = ShapelyPoint(pt)
        return [seg for seg in lines if seg.distance(p) <= real_wall_proximity_tol]

    def _crosses_any_wall(candidate: LineString) -> bool:
        cx0, cy0 = candidate.coords[0]
        cx1, cy1 = candidate.coords[-1]
        for wall in lines:
            if not candidate.intersects(wall):
                continue
            intersection = candidate.intersection(wall)
            if isinstance(intersection, ShapelyPoint):
                ip = (intersection.x, intersection.y)
                if ip != (cx0, cy0) and ip != (cx1, cy1):
                    return True
            elif hasattr(intersection, "is_empty") and not intersection.is_empty:
                if isinstance(intersection, LineString):
                    interior = candidate.intersection(intersection)
                    if not interior.is_empty:
                        return True
        return False

    for i, a in enumerate(openings):
        for b in openings[i + 1:]:
            d = math.dist(a.position, b.position)
            if not (min_dist <= d <= max_dist):
                continue

            pair_angle = _pair_axis_angle(a.position, b.position)
            near_a = _near_real_wall(a.position)
            near_b = _near_real_wall(b.position)
            if not near_a and not near_b:
                continue

            angle_evidence = any(
                _angle_diff_deg(pair_angle, _wall_axis_angle(seg)) <= angle_tol_deg
                for seg in (near_a + near_b)
            )
            if not angle_evidence:
                continue

            candidate = LineString([a.position, b.position])
            if _crosses_any_wall(candidate):
                continue

            synthesized.append(candidate)
            exceptions.append(ExceptionReport(
                code="SYNTHESIZED_OPENING_EVIDENCE_WALL",
                severity="warning",
                message=(
                    f"Synthesized a wall connecting openings {a.handle} and "
                    f"{b.handle} -- no wall data exists between them in the "
                    "source drawing, but door/window position evidence "
                    "supports a real wall run here."
                ),
                context={"handles": [a.handle, b.handle]},
                suggested_action=(
                    "Verify against the source drawing whether a real wall "
                    "exists here; this segment was inferred, not extracted."
                ),
            ))

    return synthesized, exceptions
```

Confirmed during plan review: `ExceptionReport` (plain name, no underscore prefix) is the correct import alias in this file (used at lines 1452, 2184, 2217) — the code above already uses it correctly. `math` is already imported at module level (line 54) — no new import needed.

- [ ] **Step 6: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py -v -k "opening_evidence or synthesize"`
Expected: PASS (7 tests).

- [ ] **Step 7: Do NOT commit.**

---

### Task 2: Wire into `_build_space_polygons`

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (`_build_space_polygons`, ~line 2364, insertion between the `_bridge_door_window_gaps` call ~2446-2448 and `_polygonize_network` call ~2450).
- Test: `tests/test_space_geometry.py` (integration test).

- [ ] **Step 1: Write the failing integration test**

```python
def test_build_space_polygons_uses_opening_evidence_synthesis_in_endpoint_cluster_mode():
    """Confirms the new step is wired into the ENDPOINT_CLUSTER pipeline
    and produces SYNTHESIZED_OPENING_EVIDENCE_WALL exceptions when
    applicable -- an integration-level proof, not just the unit tests
    for the function in isolation."""
    # Construct wall_segments with a genuine gap (no wall data) between
    # two points, plus two DoorEntity/WindowEntity openings positioned
    # and spaced to satisfy the synthesis criteria (mirror Task 1's
    # test 1 fixture, adapted to WallSegment/opening list inputs).
    ...
    polygons, exceptions = _build_space_polygons(wall_segments, openings, mode=WallProcessingMode.ENDPOINT_CLUSTER)
    synth_exceptions = [e for e in exceptions if e.code == "SYNTHESIZED_OPENING_EVIDENCE_WALL"]
    assert len(synth_exceptions) >= 1


def test_build_space_polygons_solid_union_unaffected_by_opening_evidence_synthesis():
    """SOLID_UNION mode's output must be byte-for-byte unaffected --
    proves the Non-Goals scoping holds in the actual dispatch, not
    just in the code's `if mode == ENDPOINT_CLUSTER` guard."""
    # Same fixture as above, but call _build_space_polygons_solid_union
    # directly (or _build_space_polygons with mode=SOLID_UNION) and
    # confirm no SYNTHESIZED_OPENING_EVIDENCE_WALL exception appears.
    ...
```

Fill in the exact `WallSegment`/opening fixture construction matching Task 1 Step 1's established test-fixture style, adapted for the full pipeline's input shape (`wall_segments: list[WallSegment]`, not raw `LineString`s).

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py -v -k "uses_opening_evidence or solid_union_unaffected"`
Expected: FAIL — the new step isn't wired in yet.

- [ ] **Step 3: Wire the call site**

In `_build_space_polygons`, locate:

```python
bridged_lines, _bridges = _bridge_door_window_gaps(
    welded_lines, openings, CORNER_SNAP_TOL, DOOR_BRIDGE_TOL
)
```

immediately followed (per current code structure) by the `_polygonize_network` call. Insert between them:

```python
    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        synthesized_lines, synth_exceptions = _synthesize_opening_evidence_walls(
            bridged_lines, openings,
            OPENING_EVIDENCE_MIN_DIST_MM, OPENING_EVIDENCE_MAX_DIST_MM,
            OPENING_EVIDENCE_ANGLE_TOL_DEG, OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM,
        )
        bridged_lines = bridged_lines + synthesized_lines
        exceptions.extend(synth_exceptions)
```

Confirm the exact local variable name holding the running exceptions list at this point in the function (likely `exceptions`, per the pattern already used for `dangle_exceptions`/`snap_exceptions` elsewhere in this function) before finalizing — read the surrounding code first.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py -v -k "uses_opening_evidence or solid_union_unaffected"`
Expected: PASS (2 tests).

- [ ] **Step 5: Full regression**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: PASS, no regressions (all existing `_build_space_polygons`/`_bridge_door_window_gaps` tests unaffected, since `ENDPOINT_CLUSTER` is still the default mode and existing test fixtures presumably don't accidentally satisfy the new synthesis criteria — if any DO regress, investigate whether that's a genuine new synthesis behavior change in an existing test's fixture, not a bug, before assuming it's wrong).

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions elsewhere.

- [ ] **Step 6: Do NOT commit.**

---

### Task 3: CHANGELOG entry

- [ ] Add an `[Unreleased]` → `### Added` entry describing: the motivation (wall data in the source drawing is incomplete in ways that 3 prior welding-algorithm fix attempts couldn't address, per the linked ABANDONED design doc; doors/windows are high-confidence directly-observed evidence), the mechanism (`_synthesize_opening_evidence_walls`, inserted into the `ENDPOINT_CLUSTER` pipeline between gap-bridging and polygonization), the required wall-crossing exclusion gate (added after spec review caught a real false-positive class — party-wall openings), the `SYNTHESIZED_OPENING_EVIDENCE_WALL` exception code ensuring synthesized walls are always distinguishable from real drawing data, and the explicit `SOLID_UNION`-mode exclusion. Reference the spec/plan. No commit — `/sync` handles it.

---

### Task 4: Manual real-drawing verification (REQUIRED, not optional)

- [ ] Call `zwcad_generate_spaces` (default `ENDPOINT_CLUSTER` mode) against the live drawing (once the MCP connection has been restarted to pick up this change) and report the actual room count/areas honestly.
- [ ] Cross-reference the detected rooms against the 8 known real room-name labels from `zwcad_extract_text_labels` (LIVING ROOM, MAIN ROOM, DINING ROOM, ENTRANCE, 2x WET ZONE, ROOM #1, ROOM #2) — report how many are now captured by a detected room polygon, honestly, without assuming a specific target number.
- [ ] Inspect the `SYNTHESIZED_OPENING_EVIDENCE_WALL` exceptions in the result — spot-check a few against the actual drawing coordinates to sanity-check they look like plausible real walls, not obviously-wrong connections (e.g. crossing through a room's interior).
- [ ] Confirm `wall_processing_mode="solid_union"` output is unaffected (matches the pre-this-change baseline).
- [ ] Report any discrepancy or surprising result honestly rather than assuming success.

No code change in this task — verification only.
