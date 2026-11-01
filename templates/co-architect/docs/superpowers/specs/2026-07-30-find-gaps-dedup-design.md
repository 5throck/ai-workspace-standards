# `_find_gaps` Duplicate-Endpoint Fix — Design Spec

**Status:** Approved (user, 2026-07-30)
**Related:** AXIS-001-design.md §3 (wall-gap opening candidate detection)

## Problem

`handle_find_opening_candidates` produced 3,943 candidates from a 231-segment wall
network where the real drawing has ~84 doors/windows total — a combinatorial blowup,
confirmed to be duplicate `gap_endpoints` (max 82x duplication of a single gap).

**Root cause, confirmed by direct investigation:**

`_weld_endpoints` (v2: STRtree + Union-Find + Medoid clustering, `space_geometry.py:666`)
works correctly — it snaps every endpoint within `CORNER_SNAP_TOL` (150mm) of each other
to an identical medoid coordinate. Verified directly: of 462 post-weld endpoints, only
152 unique coordinates exist — up to 12 different wall segments legitimately share the
exact same welded endpoint coordinate (e.g. multiple wall segments meeting at one
T-junction or corner, which is architecturally normal, not a data-quality defect).

`_find_gaps` (`space_geometry.py:746`) then builds its own flat `endpoints` list by
iterating every line's start/end **without deduplicating by coordinate**, and does an
O(N²) all-pairs distance comparison over that list. When K different lines share the
same welded endpoint coordinate, that one physical point contributes K entries to the
list — so a single real gap between two "point clusters" of size K₁ and K₂ gets
reported K₁×K₂ times as separate `(p1, p2, dist)` tuples, all with numerically identical
coordinates. This is the 82x/35x duplication observed.

**This time the duplication was pre-existing wall data in the source drawing being
correctly interpreted as multiple distinct wall segments meeting at shared points** —
NOT a data-quality defect like the previous overlapping-line issue investigated earlier
in this session (that one really was duplicate CAD entities; this one is normal
multi-segment wall junctions). The fix belongs in `_find_gaps`, which is the one place
that fails to account for "many lines can legitimately share one endpoint."

## Scope Decision

Fix `_find_gaps` to deduplicate its `endpoints` list by exact coordinate before running
the O(N²) comparison — this is safe because `_weld_endpoints` has already normalized
"the same physical point" to numerically identical float coordinates (confirmed: no
rounding needed, exact tuple equality works). Deduplicating collapses K coincident
endpoints into one representative, so the O(N²) loop runs over 152 unique points instead
of 462 raw ones, and each real inter-cluster gap is reported exactly once.

## Design

### Modified `_find_gaps` (`src/cad_intelligence/geometry/space_geometry.py:746`)

```python
def _find_gaps(lines: list[LineString], tol: float) -> list[tuple[ShapelyPoint, ShapelyPoint, float]]:
    """Find pairs of line endpoints that are close (<= tol, a wide
    net so DOOR_BRIDGE_TOL-scale gaps are found) but not already
    coincident, returning (endpoint_a, endpoint_b, distance) triples.

    We only need this to *propose* candidate bridges; each candidate is
    subsequently validated against nearby opening positions before a
    synthetic segment is actually inserted.

    Endpoints are deduplicated by exact coordinate before the O(N^2)
    comparison: multiple wall segments legitimately share one welded
    endpoint (e.g. a T-junction or corner where several segments meet,
    or party-wall segments split at a shared point) — without this
    dedup, a single real gap between a cluster of K1 coincident
    endpoints and a cluster of K2 coincident endpoints would be
    reported K1*K2 times, all numerically identical. _weld_endpoints
    already normalizes "the same physical point" to identical float
    coordinates, so exact-tuple dedup here is lossless (no rounding/
    tolerance needed — coincident points are already bit-identical).
    """
    seen_coords: dict[tuple[float, float], ShapelyPoint] = {}
    for line in lines:
        coords = list(line.coords)
        for c in (coords[0], coords[-1]):
            key = (c[0], c[1])
            if key not in seen_coords:
                seen_coords[key] = ShapelyPoint(c)
    endpoints = list(seen_coords.values())

    gaps: list[tuple[ShapelyPoint, ShapelyPoint, float]] = []
    seen: set[tuple[int, int]] = set()
    for i, p1 in enumerate(endpoints):
        for j, p2 in enumerate(endpoints):
            if i >= j:
                continue
            dist = p1.distance(p2)
            if 1e-6 < dist <= tol:
                key = (i, j)
                if key not in seen:
                    seen.add(key)
                    gaps.append((p1, p2, dist))
    return gaps
```

**What changes**: only the endpoint-collection loop (dict-based dedup by exact
coordinate instead of a flat list). The O(N²) comparison loop, the `seen` dedup-by-index
guard, the `1e-6 < dist <= tol` filter, and the return shape are all UNCHANGED.

**What this does NOT fix**: the earlier-in-session finding of literally-overlapping wall
CAD entities (multiple `WallSegment`s with near-identical start/end from the raw
extraction, e.g. handles `1603`/`1F5D`/`1FDD`/`1FDE`) is a separate, upstream
data-quality issue in the source drawing — this fix does not attempt to detect or
collapse duplicate *wall segments*, only duplicate *endpoint coordinates* after welding.
In practice, deduplicating endpoints substantially reduces the observed candidate count
regardless of whether the duplication's origin is legitimate multi-segment junctions or
literal overlapping source geometry, because both manifest identically as "many list
entries share one coordinate" from `_find_gaps`'s point of view.

## Non-Goals

- No change to `_weld_endpoints`/`_weld_endpoints_v2`/`_cluster_endpoints` — confirmed
  working correctly (they already produce the deduplication opportunity this fix
  exploits).
- No change to `find_wall_discontinuities`'s door/window matching logic, `CORNER_SNAP_TOL`/
  `DOOR_BRIDGE_TOL`/`OPENING_PROXIMITY_TOL` constants, or `OpeningCandidate`'s shape.
- No attempt to deduplicate the raw *wall segment* input (the separate overlapping-CAD-
  entity issue) — out of scope; that's a source-drawing data-quality concern, not this
  function's job.

## Testing

1. **Unit test reproducing the exact bug**: construct `LineString`s such that multiple
   lines share one endpoint coordinate on each side of a gap (e.g. 3 lines ending at
   point A, 2 lines starting at point B, `dist(A,B)` within `tol`) — assert
   `_find_gaps` returns exactly ONE `(A, B, dist)` tuple, not 3×2=6.
2. **Regression**: a simple two-line case with no shared endpoints (the original,
   already-covered behavior) must still produce the same single gap it did before.
3. **Real-drawing verification** (manual, not automated — requires the live drawing):
   re-run `handle_find_opening_candidates` against the same walls/doors/windows input
   used during investigation and confirm the candidate count drops from ~3,943 to
   something in the range of the ~526 unique gaps already observed by post-hoc
   deduplication, and that max per-gap duplication drops to 1.

## Files Touched

- Modify: `src/cad_intelligence/geometry/space_geometry.py` (`_find_gaps` only)
- Modify: `tests/test_space_geometry.py` — this file already exists with an existing
  `TestFindGaps` class (including `test_no_duplicate_gaps`, `test_coincident_endpoints_excluded`,
  etc.); add the new shared-endpoint-cluster test as a new method on that class, not a
  new file.
- Modify: `CHANGELOG.md`
