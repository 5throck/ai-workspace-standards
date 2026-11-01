---
lang: ko
lang_reason: proper-noun
---

# Opening-Derived Wall Segments — Design Spec

## Context

`_build_space_polygons` (ENDPOINT_CLUSTER mode, `space_geometry.py`) reconstructs room polygons from wall `LineString`s. On the reference drawing ("아파트 평면도"), only 4 of 8 known real rooms are detected because the source wall geometry is genuinely incomplete around door/window openings — not a classification bug.

PR #188 (`_synthesize_opening_evidence_walls`) attempted to close this gap by pairwise-connecting door/window openings that appeared to belong to the same wall run (distance + angle-match + real-wall-proximity + a mandatory wall-crossing exclusion gate). Live-drawing verification after merge showed **zero effect**: 46 candidate pairs pass distance, 18 pass angle-match, but only 1 survives the crossing gate — this drawing's walls are dense enough that most opening-to-opening connecting lines cross an unrelated real wall. The approach is empirically dead on this drawing and is being replaced, not extended.

The user identified the root design flaw: pairing is the wrong primitive. Rooms don't require a door-window pair — every room has a door, but a window may be absent. The correct primitive is a single opening (door or window) treated independently: each opening implies a short wall-like segment at its own location, which should be merged directly into the same wall network as real structural walls (`2sec`/`3SEC`/`4ELE`), not connected to any other opening.

## Goal

Replace `_synthesize_opening_evidence_walls` with `_openings_to_wall_segments`: for each door and each window individually, synthesize a short `LineString` at the opening's own position, sized by its width and oriented by its own direction evidence, and merge it into the wall network before welding/polygonization.

## Non-Goals

- No pairwise opening-to-opening connection logic (supersedes and removes PR #188's `_synthesize_opening_evidence_walls`, its call site, and its `OPENING_EVIDENCE_*` constants).
- No wall-crossing exclusion gate — not applicable, since each segment is anchored at one opening's own position rather than spanning between two openings.
- SOLID_UNION mode is out of scope (unchanged).
- No attempt to determine wall *thickness* — segments are zero-width `LineString`s like all other wall geometry in this pipeline.

## Algorithm

For every `DoorEntity` and `WindowEntity` extracted for the drawing, independently:

### 1. Determine width
- Doors: use `width` if `> 0`.
- If `width <= 0` (curved-cluster-detected doors, a documented limitation): use a default of `OPENING_DEFAULT_WIDTH_MM = 800.0`.
- Windows: same rule (use `width` if `> 0`, else the 800mm default).

### 2. Determine axis direction
- **Doors**: use the entity's `rotation` field directly (radians; 0 = +X axis) as the segment's direction.
- **Windows**: `rotation` does not exist on `WindowEntity`. Find the nearest real wall `LineString` (from the `2sec`/`3SEC`/`4ELE`-derived segments already in the network) within `OPENING_AXIS_SEARCH_TOL_MM = 500.0` of the window's `position`, measuring point-to-segment distance exactly as the existing `_synthesize_opening_evidence_walls._near_real_wall` helper does (`seg.distance(ShapelyPoint(position))`). Use that wall segment's axis angle (`math.degrees(math.atan2(y1-y0, x1-x0))`, the file's existing `_wall_axis_angle` pattern) as the window's direction. Equidistant-wall ties are broken by first-in-list order (deterministic, no geometric preference) — exact float ties are rare in practice.
- If no real wall is found within tolerance for a window (or, degenerately, if a door's `rotation` were ever missing — not expected given the schema, but handled defensively), the axis direction is **undeterminable**: skip this opening for segment synthesis (do not guess) and record an `ExceptionReport(code="OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS", severity="warning")` naming the opening's handle.

### 3. Build the segment
Given center `position = (px, py)`, direction angle `theta`, and width `w`:
```
dx = (w / 2) * cos(theta)
dy = (w / 2) * sin(theta)
segment = LineString([(px - dx, py - dy), (px + dx, py + dy)])
```

### 4. Emit an exception per synthesized segment
For every successfully synthesized segment, record `ExceptionReport(code="SYNTHESIZED_OPENING_WALL_SEGMENT", severity="warning")` naming the opening's handle and layer, so synthesized geometry remains distinguishable from real drawing data in downstream review.

### 5. Merge into the wall network
The synthesized segments are added to the same list of `LineString`s that holds the real `2sec`/`3SEC`/`4ELE`-derived wall segments, **before** `_weld_endpoints` runs, so they participate in corner-snapping and polygonization exactly like real walls. This replaces the insertion point previously used by `_synthesize_opening_evidence_walls` (which ran after `_bridge_door_window_gaps`, operating on the already-welded network); the new step runs earlier, feeding the welder rather than patching its output.

## Pipeline change

Old (PR #188) ENDPOINT_CLUSTER sequence:
```
wall segments -> merge-wall-face-pairs -> weld -> axis snap -> bridge door/window gaps -> synthesize opening-evidence walls (pairwise) -> polygonize
```

New sequence:
```
wall segments -> merge-wall-face-pairs -> openings-to-wall-segments (per-opening, appended to lines) -> weld -> axis snap -> bridge door/window gaps -> polygonize
```

Two precise placement rules, matching the call-site structure in `_build_space_polygons` (`space_geometry.py:2557-2593`):
1. **Mode scope**: call `_openings_to_wall_segments` only inside the `if mode == WallProcessingMode.ENDPOINT_CLUSTER:` branch — the same scope the replaced `_synthesize_opening_evidence_walls` occupied. LEGACY and SOLID_UNION are unchanged.
2. **Stage**: call it AFTER `_merge_wall_face_pairs` (so the window axis search references face-pair-deduped real walls) and BEFORE `_weld_endpoints` (so synthesized segments are corner-snapped into the real wall network by the welder, rather than patching welded output).

`_bridge_door_window_gaps` is retained unchanged — it addresses a different problem (small gaps at wall endpoints near openings after welding) and remains useful independently of this change. It will now also see the synthesized segments in its input; where an opening sits on a fully-drawn real wall, the synthesized segment is collinear/overlapping with that wall and is harmless (welding deduplicates, the existing `MIN_SPACE_AREA_MM2` sliver filter at `_extract_holes_and_filter` removes any zero-area artifact).

## Data model notes

- `DoorEntity.rotation`: radians, always present, 0 = +X axis (confirmed in `common/models.py`).
- `WindowEntity`: no `rotation` field (confirmed).
- `width` on both: can legitimately be `0.0` for curved-cluster-detected doors — an existing, documented limitation, not missing data.

## Testing

- Unit tests for `_openings_to_wall_segments`:
  - Door with `rotation=0`, `width=900` → correct horizontal segment endpoints.
  - Door with `rotation=pi/2`, `width=1000` → correct vertical segment endpoints.
  - Door with `width=0` → 800mm default width applied.
  - Window near a horizontal real wall → segment axis matches that wall's angle.
  - Window near a vertical real wall → segment axis matches that wall's angle.
  - Window with no real wall within `OPENING_AXIS_SEARCH_TOL_MM` → skipped, `OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS` exception recorded, no segment emitted.
  - Every synthesized segment emits a `SYNTHESIZED_OPENING_WALL_SEGMENT` exception.
- Integration test: `_build_space_polygons` with a small synthetic wall network + one door + one window confirms the synthesized segments are present in the network before welding and contribute to polygon closure.
- Removal: delete `TestSynthesizeOpeningEvidenceWalls` and `TestBuildSpacePolygonsOpeningEvidenceSynthesis` (PR #188 tests) along with the function they exercised.
- Manual verification checklist item: after merge, restart the ZWCAD MCP connection and re-run `zwcad_classify_layers` → `zwcad_extract_cad_objects` → `zwcad_generate_spaces` → `zwcad_extract_text_labels` on the reference drawing; report actual room count and exception count honestly (do not assume 8 rooms will be reached — the drawing may still have wall gaps this approach doesn't cover).

## Constants (new)

- `OPENING_DEFAULT_WIDTH_MM = 800.0`
- `OPENING_AXIS_SEARCH_TOL_MM = 500.0`

## Constants removed (PR #188, superseded)

- `OPENING_EVIDENCE_MIN_DIST_MM`, `OPENING_EVIDENCE_MAX_DIST_MM`, `OPENING_EVIDENCE_ANGLE_TOL_DEG`, `OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM`
- Function `_synthesize_opening_evidence_walls` and its call site in `_build_space_polygons`.
