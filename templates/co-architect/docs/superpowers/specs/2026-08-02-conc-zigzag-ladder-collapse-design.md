---
lang: ko
lang_reason: proper-noun
---

# CONC Zigzag Double-Line Ladder Collapse — Design Spec

**Status:** Approved (user, 2026-08-03); implemented with two documented
deviations from the reviewed design (see "Implementation Deviations" below).
**Nature:** CONC importer/exporter topology-artifact normalization adapter —
NOT a general boundary-algorithm improvement. LEGACY / SOLID_UNION / reasoning
pipeline are untouched.
**Related:**
- `docs/superpowers/specs/2026-08-02-opening-anchor-wall-span-design.md` (v2
  opening synthesis that runs downstream of this step)
- `docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md` (the
  face-pair merge this step runs BEFORE — see pipeline position)

## Problem

The reference drawing (`32평형아파트.dwg`) renders CONC walls as a zigzag
"ladder": two interleaved, NON-overlapping parallel face chunks (15mm apart)
joined by ~18mm diagonal rungs. Live measurements of the CONC layer
(793 segments):

| Signal | Count |
|---|---|
| segments < 30mm (18mm diagonal rungs) | 304 |
| segments 30-120mm (80mm face chunks) | 277 |
| non-axis-aligned segments | 282 (35.6%) |
| face pairs at 15mm spacing | 15 |

Failure chain: the two faces' chunks never overlap, so
`_merge_wall_face_pairs` (`WALL_FACE_MIN_OVERLAP_RATIO=0.5`) can never pair
them → the 15mm face spacing is far below `CORNER_SNAP_TOL` (150mm) so welding
fuses the faces into a fragmented graph → `polygonize_full` cannot close rooms
(`UNCLOSED_WALLS=127`, 0 non-void rooms).

## Fix

New topology-normalization step 1.5 in `_build_space_polygons`
(ENDPOINT_CLUSTER only), BEFORE face-pair merging:

```
segments -> LineStrings
  -> _collapse_zigzag_ladders()          (NEW)
  -> _merge_wall_face_pairs()
  -> _openings_to_wall_segments (v2)
  -> weld -> bridge -> polygonize
```

### `_collapse_zigzag_ladders(lines) -> (list[LineString], LadderCollapseStats)`

**Rung detection** (conservative):
- `length < LADDER_CONNECTOR_MAX_MM` (60) AND non-axis-aligned AND angle in the
  diagonal band `[20,70] ∪ [110,160]` deg (excludes leader ticks ~10deg,
  dimension slashes 70-90deg, arbitrary hatch lines).
- Nearest axis-aligned neighbor within `LADDER_NEIGHBOR_TOL_MM` (40) of each
  endpoint (rung self excluded); the two neighbors must be near-parallel
  (`WALL_FACE_PARALLEL_TOLERANCE_DEG`) with perpendicular offset in
  `[LADDER_MIN_FACE_OFFSET_MM, WALL_FACE_MAX_THICKNESS]` (the two faces of one
  wall).

**Group validation (fixed order)**: Union-Find over rung edges →
`len(group) >= 3` (corner-artifact guard) → single axis family (±5°) →
perpendicular spread ≤ `WALL_FACE_MAX_THICKNESS` (250) → gap split →
collapse. Any failed group is kept ORIGINAL including its rungs (geometry
preservation).

**Centerline**: midpoint of the two faces' perpendicular positions
(robust to unbalanced chunk counts; see deviations). Axis extent = [min, max]
of member endpoint projections, split into sub-runs at gaps >
`LADDER_GAP_MAX_MM` (250) so real openings (door 900 / window 1500 / partition
400mm) are preserved. Output is NOT re-snapped.

**Stats** (`LadderCollapseStats` TypedDict): detected_groups, removed_rungs,
collapsed_segments, rejected_groups, input_segments, output_segments,
removed_length_mm (rounded). Logged at `debug`; `warning` when rejected_groups
> 0.

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `LADDER_CONNECTOR_MAX_MM` | 60.0 | Max candidate-rung length |
| `LADDER_NEIGHBOR_TOL_MM` | 40.0 | Rung→face adjacency radius (jitter < 10mm, face offset 15mm, chunk pitch 80-100mm) |
| `LADDER_MIN_FACE_OFFSET_MM` | 3.0 | Min face offset for a rung (collinear ticks excluded) |
| `LADDER_GAP_MAX_MM` | 250.0 | Max intra-run axis gap (opening preservation) |
| `LADDER_RUNG_BAND_MIN/MAX_DEG` | 20 / 70 | Diagonal band half-range |

## Implementation Deviations (documented)

1. **Degree-2 adjacency replaced.** The reviewed "exactly one axis-aligned
   neighbor per endpoint" rule cannot hold for the real 15mm-spaced faces:
   every rung endpoint is within ~18mm (one rung length) of BOTH faces, so an
   endpoint-level degree count always sees two neighbors and would reject every
   real rung. Replaced with nearest-neighbor parallelism + face-offset range;
   safety is carried by the group-level guards (≥3 members, single family,
   spread ≤ 250mm) which reject isolated false positives (a lone 45deg tick
   between parallel walls forms a 2-member group).
2. **Centerline = face midpoint, not median.** A ladder naturally alternates
   A-B-A-B and typically ends on face A, so chunk counts are unbalanced
   (e.g. 3A+2B) and the median lands on the majority face. `(min+max)/2` of the
   validated group's perpendicular positions always sits exactly between the
   two faces; spread outliers beyond 250mm are rejected by validation anyway.

## Testing

- 10 unit tests + 1 integration test in `tests/test_space_geometry.py`
  (`TestCollapseZigzagLadders`): clean ladder collapse, door/window/partition
  gap preservation (900/1500/400mm), clean rectangle unchanged, T-junction,
  chamfer (perpendicular neighbors), single segment, two parallel walls with
  door (regression guard), two independent ladders 300mm apart, angle-band
  filter (10deg tick + geometry-preservation assert), 2-member group rejected.
- Integration: a room whose right wall is a full zigzag ladder + 3 clean walls
  → exactly 1 space polygon, with `removed_rungs > 0` and
  `collapsed_segments > 0` asserted (coincidental polygonization excluded).
- Full suite: 168 `test_space_geometry.py` + 203 related geometry/handler
  tests pass.

## Live verification (2026-08-03)

| Metric | Before | After |
|---|---|---|
| collapse input → output | 1020 | 456 |
| removed_rungs | — | 282 |
| collapsed_segments | — | 7 |
| remaining short non-axis-aligned segments | ~304 | 0 |
| longest centerline | — | 9460mm |
| rooms(non-void) | 0 | **0** (unchanged) |
| UNCLOSED_WALLS | 127 | 126 |

**Conclusion (per the approved diagnostic matrix):** `removed_rungs` in the
hundreds with rooms unchanged ⇒ **downstream problem**, not a detection
failure. The ladder normalization is validated as working; room closure is
blocked by the remaining wall network (24 connected components, no closed
room-sized cycles after welding — the interior walls do not form closed rings
in this drawing even after the artifact is removed).

## Out of scope

- Interior wall network connectivity / room-ring reconstruction (downstream).
- Reasoning pipeline (`weld_and_bridge_for_polygonization`) normalization.
- Layer-info preservation refactor.
