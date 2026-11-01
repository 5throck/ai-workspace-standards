---
lang: ko
lang_reason: proper-noun
---

# Solid Wall-Union Room Detection — Design Spec

**Status:** Approved (user, 2026-07-31); Revision 2 (2026-07-31) after
spec-review found 2 issues, both fixed below — see "Revision Notes" at the end.
**Related:** `docs/superpowers/specs/2026-07-30-weld-endpoints-self-chaining-design.md`
(ABANDONED — three endpoint-welding fix attempts failed),
`docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md` (merged, PR #169 —
fixed the specific thin-wall self-chaining defect at the endpoint-graph level),
`memory/meeting-2026-07-31-weld-endpoints-defect.md` (meeting that flagged this
solid-union approach as the long-term fallback if graph-based fixes proved fragile)

## Problem

The current room-detection pipeline (`_build_space_polygons`, both `LEGACY` and
`ENDPOINT_CLUSTER` modes) represents walls as centerline `LineString`s and derives
room polygons via `polygonize_full` on a *welded* line network — endpoints within
`CORNER_SNAP_TOL` are merged by coordinate proximity. This is fundamentally a
**graph/tolerance-based** operation: whether two points count as "the same corner"
depends on a distance threshold, and every defect investigated in this session
(the self-chaining bug fixed by PR #169, the previously-abandoned fix attempts, the
disproven cluster-diameter-cap hypothesis) traces back to this tolerance-based
proximity judgment producing an ambiguous or wrong answer at some specific distance
scale. PR #169's wall-face-pair pre-merge fixes the *specific* failure mode where a
thin wall's two faces get welded together — but it is still a tolerance-based
mitigation layered in front of a tolerance-based algorithm, not an approach that is
structurally immune to the whole class of proximity-judgment defects.

## Scope Decision

Add a new wall-processing mode, `WallProcessingMode.SOLID_UNION`, that avoids
proximity-based endpoint judgments entirely by reframing room detection as an
**area/topological operation**: each wall becomes a thickness-aware solid polygon
(a rectangle along its centerline), all wall solids are combined via
`shapely.ops.unary_union`, and room polygons are read directly off the union
result's interior rings (holes) — a `shapely` topological primitive with no
coordinate-distance tolerance involved. This mode is **additive**: `LEGACY` and
`ENDPOINT_CLUSTER` (including PR #169's wall-face-pair merge) are entirely
unmodified and remain the default/production path. `SOLID_UNION` is a third,
selectable option for A/B comparison and future promotion, following the same
pattern `WallProcessingMode` already established for `LEGACY` vs `ENDPOINT_CLUSTER`.

## Design

### New enum member

```python
class WallProcessingMode(enum.Enum):
    LEGACY = 1
    ENDPOINT_CLUSTER = 2
    SOLID_UNION = 3
```

`WALL_PROCESSING_MODE` (the active-mode module constant) is unchanged — it still
defaults to `ENDPOINT_CLUSTER`. `SOLID_UNION` must be explicitly selected (e.g. in
a test, or a future config change) to activate this path.

### Wall thickness sourcing — reuse PR #169's face-pair matching

`_find_mutual_best_pairs` (from PR #169, `space_geometry.py`) already identifies
which pairs of input lines are the two faces of one physical wall and computes
their perpendicular distance. `SOLID_UNION` reuses this directly:

1. Run `_find_mutual_best_pairs(lines, WALL_FACE_MAX_THICKNESS, WALL_FACE_MIN_OVERLAP_RATIO, WALL_FACE_PARALLEL_TOLERANCE_DEG)`
   on the raw input lines (before any centerline merging).
2. For each matched pair `(i, j)`, the wall's thickness is `perp_distance` from
   `_perp_distance_and_overlap(lines[i], lines[j])`, and its centerline is
   `_compute_centerline(lines[i], lines[j])` (both already exist from PR #169 — no
   new geometry math needed for the matched case).
3. For unmatched single-face lines, fall back to a new constant,
   `SOLID_UNION_DEFAULT_THICKNESS_MM = 150.0` (chosen as the midpoint of this
   session's observed exterior-wall thickness range, 150-200mm — a reasonable
   single guess when no second face is available to measure from directly).

### Solid construction

```python
def _line_to_solid(line: LineString, thickness: float) -> Polygon:
    """Buffer a centerline into a thickness-aware rectangular solid.

    Uses shapely's buffer with cap_style="flat" so wall ends don't
    grow rounded stubs beyond their true endpoints — solids from
    adjoining walls are expected to overlap/touch at corners, which
    unary_union resolves automatically (this is the whole point: no
    endpoint-matching judgment is needed, overlapping solids just
    merge).
    """
    return line.buffer(thickness / 2.0, cap_style="flat")
```

### Door/window gap bridging (solid strips, not lines)

A real door/window opening is a genuine gap in the drawn wall geometry — if left
unfilled, the wall-solid union would leak through it and merge two rooms into one
hole, exactly the failure `_bridge_door_window_gaps` already exists to prevent for
the graph-based modes. `SOLID_UNION` needs the equivalent for solids:

**Risk, acknowledged directly (not claimed away)**: `unary_union` on independently-
buffered solids is not actually free of tolerance judgments — it moves them into
GEOS's internal floating-point precision model instead of an explicit named
constant. Two wall solids meeting at a corner can fail to overlap by a sub-mm
float-rounding gap (silently leaking two rooms into one hole) or produce a
self-touching/pinched ring GEOS treats as invalid. This is the same *class* of
problem the graph-based modes have, just relocated — `SOLID_UNION` is immune to
*this session's specific* defect (a proximity judgment between two DISTINCT wall
faces mistaken for one corner), but not to floating-point precision issues in
general. Mitigation: `shapely.set_precision()` (or an equivalent snap-to-grid
pass on solid vertices before union, at a fixed small grid e.g. 1mm) must be
applied before `unary_union` to guarantee touching solids merge deterministically
— this is a required implementation detail, not deferred, since skipping it would
silently reintroduce a tolerance-scale failure mode under a different name.

1. Reuse the *existing* `_find_gaps`/opening-proximity logic (`_bridge_door_window_gaps`'s
   gap-detection and `OPENING_PROXIMITY_TOL` check) unchanged to decide *which*
   gaps are real openings.
2. Instead of inserting a synthetic `LineString` bridge (as the graph-based modes
   do), insert a synthetic solid strip: a thin rectangle spanning the gap, using
   the thickness of whichever of the two gap-adjacent walls has a known thickness
   (or `SOLID_UNION_DEFAULT_THICKNESS_MM` if neither does).

### Union and room extraction

```python
merged = unary_union(all_wall_solids)
# merged is a Polygon or MultiPolygon. Each polygon's .interiors
# (interior linear rings) are candidate rooms.
```

**Correction from spec review**: `.interiors` entries are `LinearRing` objects, not
`Polygon`s — they have no `.area`/`.contains()` and are not valid input to
`_extract_holes_and_filter`, which expects a flat `list[Polygon]` and determines
holes itself via pairwise `outer.contains(inner)` containment (its actual purpose:
folding a column/shaft's separately-returned polygon into its containing room,
`polygonize_full`'s output shape — a different semantic than "this ring already IS
the room void"). Reusing that function here would be a category error, not a
"reuse the existing hole-merging logic" — this design does NOT reuse
`_extract_holes_and_filter`. Instead:

1. For each interior ring, construct a standalone room polygon:
   `room_poly = Polygon(interior_ring.coords)`.
2. Apply `MIN_SPACE_AREA_MM2` directly as an area filter on each `room_poly` — this
   part of the original reuse claim was correct and is kept.
3. **Columns/structural obstacles inside a room void**: if a separate wall solid
   (e.g. a column) sits entirely inside a room's interior ring without touching the
   surrounding walls, GEOS's `unary_union` places it as its own disjoint polygon in
   the union result, not as a second interior ring nested inside the room's ring —
   so it does NOT automatically appear as a hole-within-a-hole. Detecting "this
   small polygon is a column inside that room" for `SOLID_UNION`'s output requires
   the same containment check `_extract_holes_and_filter` performs, but applied
   between the room polygons constructed in step 1 and any OTHER small polygons
   the union produced (columns) — this is a new, explicit step (`_nest_columns_into_rooms`,
   structurally identical to `_extract_holes_and_filter`'s containment loop but
   operating on `SOLID_UNION`'s different input shape), not a reuse of the existing
   function's flat-list signature.

### What disappears: `UNCLOSED_WALLS`

Because this is an area operation, not a graph operation, the concept of a
"dangling" wall segment doesn't apply — there is no traversal that can fail to
close a loop. The only remaining failure mode is a real gap in the source wall
data that isn't a detected door/window (the `_bridge_door_window_gaps`-equivalent
step didn't find opening evidence nearby) — in that case, the union simply
doesn't have a hole there at all (the "room" silently merges with its neighbor or
the building exterior), which is a **different, narrower** failure signature than
`UNCLOSED_WALLS`'s per-dangle reporting. This spec does NOT invent a new exception
code for this case (see Non-Goals) — a follow-up spec should address whether/how
to detect "expected room count doesn't match hole count" as a signal.

## Non-Goals

- No change to `_weld_endpoints_v1`, `_weld_endpoints_v2`, `_cluster_endpoints`,
  `_merge_wall_face_pairs`, `_find_gaps`, or `_polygonize_network` — all graph-based
  logic is reused only for its *decision* outputs (which lines pair up, which gaps
  are real openings), never modified.
- No change to `WALL_PROCESSING_MODE`'s default value — `SOLID_UNION` is opt-in only
  in this spec's scope; promoting it to default is a separate future decision after
  real-drawing comparison data exists.
- Does not add a replacement for `UNCLOSED_WALLS`-style diagnostics for
  `SOLID_UNION`'s different failure mode (missing-hole vs. dangling-segment) — flagged
  as a follow-up, not solved here.
- Does not change opening candidate detection (`AXIS-001`'s evidence scan) or
  `handle_extract_cad_objects`'s layer classification — this spec is scoped to the
  wall-solid → room-polygon step only.
- Does not attempt automatic mode selection (e.g. "try `ENDPOINT_CLUSTER`, fall back
  to `SOLID_UNION` if X rooms detected") — out of scope; a human explicitly picks
  the mode for now.

## Testing

1. **Minimal repro, no cap needed**: the exact `157F`/`15EC` two-face case (open at
   one end, no `15ED` cap segment at all) must still produce a closed room when
   combined with 2 bounding walls — proving `SOLID_UNION` doesn't need the cap that
   `_merge_wall_face_pairs`'s cap-removal logic exists to handle, since there's no
   endpoint-matching step to confuse in the first place.
2. **Door gap without bridging leaks (expected)**: two rooms separated by a wall
   with an unbridged gap and no nearby door evidence produce ONE merged hole, not
   two — documenting the expected (different) failure signature.
3. **Door gap with bridging separates rooms**: same setup, but with a `DoorEntity`
   near the gap — the solid strip closes it, producing two separate holes.
4. **Thickness reuse correctness**: a matched wall-face pair's solid thickness
   equals the pair's measured perpendicular distance (not
   `SOLID_UNION_DEFAULT_THICKNESS_MM`).
5. **Unmatched single-face fallback**: a lone line with no pairing partner produces
   a solid of `SOLID_UNION_DEFAULT_THICKNESS_MM` thickness.
6. **Regression**: full `LEGACY`/`ENDPOINT_CLUSTER` test suites unaffected —
   `SOLID_UNION` is purely additive.
7. **Column inside a room does not become a false room**: a small wall solid (e.g.
   a structural column) placed entirely inside a larger room's interior ring,
   touching none of the surrounding walls, must NOT itself appear as a separate
   `SpacePolygon` — `_nest_columns_into_rooms` must correctly exclude it (as a hole
   within the room, matching `_extract_holes_and_filter`'s existing column-handling
   *intent*, via the new containment step rather than that function directly).
8. **Real-drawing comparison** (manual): run `SOLID_UNION` against
   "아파트 평면도.dwg" using the same wall/door/window extraction, and compare its
   room count/exception profile against `ENDPOINT_CLUSTER`'s — this is exploratory
   data collection, not a pass/fail gate, since this session's live-drawing runs
   were inconclusive due to layer-filtering methodology issues unrelated to either
   algorithm.

## Files Touched

- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add `SOLID_UNION` to
  `WallProcessingMode`; add `SOLID_UNION_DEFAULT_THICKNESS_MM` constant; add
  `_line_to_solid`, a solid-strip variant of door/window gap bridging,
  `_nest_columns_into_rooms` (the new containment step — see "Union and room
  extraction" Revision 2 correction; not a reuse of `_extract_holes_and_filter`),
  and `_build_space_polygons_solid_union` (or an internal branch inside
  `_build_space_polygons` dispatching on mode — implementer's choice, to be
  resolved in the implementation plan).
- Modify: `tests/test_space_geometry.py` — new `TestSolidUnionRoomDetection` class.
- Modify: `CHANGELOG.md`.

## Open Questions

- Whether `SOLID_UNION`'s dispatch belongs as a branch inside the existing
  `_build_space_polygons` or as a fully separate function is left to the
  implementation plan — both keep the public API (`_build_space_polygons`'s
  signature) unchanged, so this is an internal-structure choice, not a design
  decision requiring user input.
- The follow-up "missing-hole diagnostic" (Non-Goals) is intentionally deferred —
  raise it as a separate brainstorming topic if/when `SOLID_UNION` is promoted
  toward production use.

## Revision Notes

**Revision 2 (2026-07-31)** — a spec-document-reviewer subagent verified all
function-reuse claims against the actual (PR #169-merged) code and found the core
geometric approach sound, but identified 2 issues, both fixed above:

1. The Problem section's claim that `unary_union` is "structurally immune to the
   whole class of proximity-judgment defects" overstated the case — floating-point
   precision at solid-union boundaries is a relocated, not eliminated, tolerance
   judgment. Fixed by adding an explicit risk acknowledgment and a required
   mitigation (`shapely.set_precision()` / vertex snap-to-grid before union) in the
   Design section, rather than letting the Problem section's framing stand
   unqualified.
2. The claim that `_extract_holes_and_filter` is "directly reusable" for
   `SOLID_UNION`'s `.interiors`-derived room candidates was a category error —
   `.interiors` entries are `LinearRing`s, not the `Polygon`s that function expects,
   and its actual logic (folding a *separately-returned sibling polygon* into its
   container) doesn't match `SOLID_UNION`'s output shape (rings already nested
   inside their room). Fixed by removing the reuse claim, keeping only the
   `MIN_SPACE_AREA_MM2` filter (which genuinely does apply directly), and adding a
   new, explicitly-named `_nest_columns_into_rooms` step plus Testing item 7 for
   the column-inside-room case this correction surfaced.
