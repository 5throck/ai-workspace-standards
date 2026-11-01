---
lang: ko
lang_reason: proper-noun
---

# `_weld_endpoints_v2` Self-Chaining Fix — Design Spec

**Status:** ABANDONED (2026-07-30) — see "Post-Mortem: Why This Was Not Implemented"
at the end of this document. Kept for historical record and to prevent re-attempting
the same failed approaches. Originally: Approved (user, 2026-07-30).
**Related:** ELEV-002-design.md §2 (endpoint welding), AXIS-001-design.md §3

## Problem

`handle_generate_spaces` produced only 6 of ~8 expected rooms on the real drawing, with
10 `UNCLOSED_WALLS` exceptions. Root-caused to a genuine bug in
`_weld_endpoints_v2`/`_cluster_endpoints` (`space_geometry.py:588-745`), confirmed by
direct minimal reproduction:

Three real wall segments from the drawing (`3SEC` layer, correctly classified — this is
NOT a layer-classification problem):
- `157F`: (18136,19381)→(18136,17706), length 1675mm (one face of a wall)
- `15EC`: (18226,17706)→(18226,19381), length 1675mm (the OTHER face of the same wall,
  90mm away — normal double-line wall-thickness representation)
- `15ED`: (18226,19381)→(18136,19381), length 90mm (the cap connecting the two faces at
  ONE end — the other end has no cap in the source drawing)

`CORNER_SNAP_TOL` (150mm) is larger than this wall's thickness (90mm). Because
`157F.end` and `15EC.start` happen to be only 90mm apart (the two faces at the
uncapped end), they get unioned together. Since Union-Find clustering is transitive,
and `157F.start`/`15ED.end` are already unioned (0mm, the real capped corner), the
whole chain collapses: **`157F`'s own two endpoints (1675mm apart) end up in the same
cluster**, both snapped to one medoid. This destroys `157F` (collapses it to a point),
duplicates `15EC` onto `157F`'s original position, and collapses `15ED` to a
zero-length segment — verified by direct reproduction: `polygonize_full` on the welded
output produces 0 polygons and the network is destroyed at that location.

**This is a structural defect in ANY union-find-based endpoint welder**, not specific
to this drawing: it manifests whenever a wall's thickness is less than
`CORNER_SNAP_TOL` AND one end of that wall is uncapped (a real, if imperfect, drafting
pattern — the far end is genuinely open in the source CAD, e.g. missing a short
finishing segment). It will recur on any drawing with thin walls and open ends,
independent of layer classification correctness.

## Scope Decision

Add a **self-chaining guard** inside `_weld_endpoints_v2`, immediately after
`_cluster_endpoints` returns its clusters: for each original line, check whether its own
start-endpoint-index and end-endpoint-index landed in the same cluster. If so, that
line's two ends were destructively merged by transitive chaining — this is never
legitimate (a real closed loop would need at least 3 distinct lines forming a cycle, not
a single line's own two ends colliding). When detected:

1. Split that line's two endpoint indices out of the offending cluster (each becomes its
   own singleton, keeping its ORIGINAL coordinate — not the shared medoid) so this one
   line is left unwelded at both ends rather than being destroyed.
2. Log a warning (not silently fixed) so the underlying drafting gap (missing cap
   segment) remains visible — the existing `UNCLOSED_WALLS` exception path (in
   `_build_space_polygons`, downstream of welding) will then correctly report BOTH of
   this line's ends as unclosed dangles, which is the honest, already-existing mechanism
   for surfacing "there's a gap here" to the caller.

This is a **local safety net**, not a redesign of the clustering algorithm: it does not
change behavior for any cluster where no line's own two ends collide (the overwhelming
majority of legitimate corner/junction welds), and it turns silent data corruption
(duplicated/collapsed geometry) into an honest, already-supported "unclosed" signal
instead.

## Non-Goals

- No change to `_cluster_endpoints`'s core Union-Find/STRtree/medoid algorithm — the
  fix is a post-hoc validation pass on its output, not a rewrite.
- No attempt to auto-insert a synthetic cap segment to "fix" the drafting gap — that
  would be inventing geometry that isn't in the source drawing, which the codebase's
  own conventions avoid (see `_cluster_endpoints`'s docstring: "the medoid... avoids
  inventing new geometry").
- No change to `CORNER_SNAP_TOL`'s value — lowering it would just shift which walls are
  thin enough to trigger this, not fix the underlying algorithmic chaining defect; the
  guard is tolerance-independent.
- No change to `_weld_endpoints_v1` (the legacy non-default path, dispatched only when
  `WALL_PROCESSING_MODE` is explicitly set away from `ENDPOINT_CLUSTER`) — out of scope,
  this drawing/pipeline uses v2.

## Design

### Modified `_weld_endpoints_v2` (`space_geometry.py:666`)

After the existing `_cluster_endpoints(endpoints, tol)` call inside the per-pass loop,
insert a self-chaining check before computing `rep_coords`-based line rewriting:

```python
clusters, rep_coords = _cluster_endpoints(endpoints, tol)

# Self-chaining guard: a line's own two endpoints must never land in the
# same cluster. If they do, transitive Union-Find chaining merged two
# genuinely distinct corners (usually via a thin wall's uncapped end,
# see space_geometry.py module docstring / design notes) — silently
# accepting this would collapse/duplicate real geometry. Instead, split
# the offending line's two endpoint indices back out to their own
# original coordinates (singleton "clusters" of size 1), leaving this
# line's two ends unwelded so the existing UNCLOSED_WALLS reporting
# downstream can surface the real drafting gap honestly.
cluster_of: dict[int, int] = {}
for root, members in ((m[0], m) for m in clusters):
    pass  # placeholder — see full implementation below
```

(The exact implementation, written out in full below, builds an
`endpoint_index -> cluster_id` map, then for each line checks its two endpoint indices
against that map.)

Full replacement of the relevant section:

```python
        # Cluster
        clusters, rep_coords = _cluster_endpoints(endpoints, tol)

        # Self-chaining guard (see module-level design note): a single
        # line's own two endpoints must never end up in the same
        # cluster — if they do, transitive Union-Find chaining merged
        # two genuinely distinct corners (typically via a thin wall
        # whose thickness is smaller than tol, with one end uncapped in
        # the source drawing). Detect and undo this specific case by
        # restoring both of that line's endpoints to their original
        # (pre-cluster) coordinates, leaving the line unwelded at both
        # ends rather than silently destroyed. The line's real gap is
        # then reported by the existing UNCLOSED_WALLS mechanism
        # downstream in _build_space_polygons, instead of being hidden.
        endpoint_to_cluster: dict[int, int] = {}
        for cluster_id, members in enumerate(clusters):
            for idx in members:
                endpoint_to_cluster[idx] = cluster_id

        self_chained_endpoints: set[int] = set()
        for line_idx in range(len(current)):
            start_idx = line_idx * 2
            end_idx = line_idx * 2 + 1
            if endpoint_to_cluster.get(start_idx) == endpoint_to_cluster.get(end_idx):
                _logger.warning(
                    "Self-chaining detected welding line %d: both endpoints "
                    "(%s, %s) landed in the same cluster — likely a thin "
                    "wall (thickness < tol=%s) with an uncapped end. "
                    "Restoring original coordinates for both ends instead "
                    "of collapsing this line.",
                    line_idx, endpoints[start_idx], endpoints[end_idx], tol,
                )
                self_chained_endpoints.add(start_idx)
                self_chained_endpoints.add(end_idx)

        for idx in self_chained_endpoints:
            rep_coords[idx] = (endpoints[idx].x, endpoints[idx].y)
```

This block replaces the existing `_, rep_coords = _cluster_endpoints(endpoints, tol)`
line; everything after it (the `moved_count`/`welded` line-rewriting loop) is unchanged
— it already reads from `rep_coords`, which now has the guard's corrections applied
before use.

**Why restoring original coordinates (not re-running clustering) is correct and
sufficient**: the guard only ever touches endpoints belonging to a provably-bad
self-chained cluster. Restoring those specific indices to their pre-cluster coordinates
means this line's ends simply don't weld to anything in this pass — which is exactly
the correct, honest outcome (the source drawing genuinely has an unclosed gap there).
Other lines' endpoints in that same original (over-merged) cluster are unaffected by
this operation — only the self-chained line's own two indices are touched, so a
same cluster might still correctly weld other members together that don't have the
guard's problem (e.g. `15EC`/`15ED`'s shared endpoint, which is a genuine corner, keeps
its normal medoid treatment; only `157F`'s two ends get their guard-restore).

### Multi-pass behavior

`_weld_endpoints_v2` runs up to `MAX_WELD_PASSES` passes with early-stop on
`moved_count == 0`. The guard runs inside each pass, so if a later pass's clustering
(operating on already-partially-welded coordinates) produces a NEW self-chaining
instance, it's caught there too — the guard is not a one-shot fix bolted onto pass 1
only.

## Testing

1. **Direct regression test reproducing the exact bug**: construct the 3-line scenario
   from this investigation (`157F`/`15EC`/`15ED`'s exact coordinates) as a minimal
   `_weld_endpoints_v2` input; assert:
   - The long line (`157F`-equivalent) is NOT collapsed to a zero/near-zero-length
     segment after welding (its post-weld length must still be close to 1675mm).
   - The short connector (`15ED`-equivalent) is NOT collapsed to zero length either —
     it should retain its true 90mm length (it has one genuinely-shared corner with
     `15EC`, so ITS shared end still welds normally; only the OTHER line's — `157F`'s —
     two ends get restored).
   - `polygonize_full` on the guarded output, when combined with the third and fourth
     bounding walls needed to actually close a room in a slightly larger fixture,
     produces a valid polygon where the unguarded version produces zero polygons.
2. **Regression**: existing `TestWeldEndpointsV2`/`TestClusterEndpoints` tests
   (`test_nearby_endpoints_clustered`, `test_transitive_cluster`, etc.) must still pass
   unmodified — the guard must not affect any cluster where no line's own two ends
   collide, which is what those existing tests cover.
3. **Manual real-drawing verification**: re-run the same manual `handle_generate_spaces`
   invocation from this session's investigation against the real "아파트 평면도.dwg"
   wall/door/window data and confirm: (a) the specific `UNCLOSED_WALLS` exception for
   `(18136,19380.92)-(18136,17705.92)` either disappears (if this was the ONLY defect
   at that location) or is replaced by a DIFFERENT, more localized unclosed-wall report
   (if a genuine drafting gap remains, which is expected and correct — the guard fixes
   the ALGORITHM's incorrect collapsing, not the SOURCE DRAWING's actual missing cap
   segments); (b) room count increases from 6 toward the expected 8, and/or the
   previously-anomalous `Room-02c7f3a3` (3.13m² area, 35.5m perimeter) either
   disappears or resolves into more plausible-shaped rooms.

## Files Touched

- Modify: `src/cad_intelligence/geometry/space_geometry.py` (`_weld_endpoints_v2` only)
- Modify: `tests/test_space_geometry.py` (`TestWeldEndpointsV2` class — add the
  self-chaining regression test)
- Modify: `CHANGELOG.md`

---

## Post-Mortem: Why This Was Not Implemented (2026-07-30)

This spec's "self-chaining guard" (same-line's-own-two-ends check) was reviewed and
found factually wrong about which line gets destroyed: independent verification (spec
review agent + direct re-investigation) showed the line that actually collapses is
**not** the long wall (`157F`) as this spec's Problem section claims, but the short
90mm connector (`15ED`) — and worse, the guard as designed does not prevent the
long-wall duplication (`15EC` ends up duplicated onto `157F`'s coordinates) at all,
because `15EC`'s own two endpoint indices land in *different* clusters by construction
(the guard only checks same-line self-collision).

**Two further redesigns were attempted and also failed:**

1. **"Forbidden pair" approach** — detect line-pairs where both ends are mutually
   within `tol` in reversed order (a "parallel wall face" signature) and block that
   specific endpoint-pair from being unioned directly. This correctly separated one
   corner (17706-side) but the *other* corner (19381-side) suffered the identical
   defect via a different transitive path (`0→4→3`, bypassing the direct `0-3`
   forbidden pair) — forbidding a *pair* does not stop transitive chaining that
   reaches the same result through a longer path via other legitimately-shared
   points.

2. **Mutual-nearest-neighbor requirement** — require that two endpoints only union if
   each is the other's nearest neighbor. Failed because the defective pair (`157F.end`
   ↔ `15EC.start`, 90mm apart) has NO other candidates within `tol` — they are each
   other's *only* neighbor, so they trivially satisfy "mutual nearest" despite being a
   spurious match. This criterion cannot distinguish "the only candidate happens to be
   wrong" from "the only candidate is right."

**The actual root cause is a fundamental, unresolved tension, not a fixable bug**:
`tests/test_space_geometry.py::TestClusterEndpoints::test_transitive_cluster`
explicitly specifies and locks in transitive chaining (A—B—C merges into one cluster
even though A and C are not directly within `tol`) as **intentional** behavior — it
exists to absorb real drafting/rounding noise across a chain of nearly-coincident
points. Every fix attempted above either reduces to disabling transitive chaining
outright (breaking that intentional, tested behavior) or fails to catch the specific
failure mode where a thin wall's thickness (90mm here) is smaller than
`CORNER_SNAP_TOL` (150mm) AND one end of that wall is uncapped in the source drawing.

**No safe, general fix was found within the time invested.** The specific trigger
condition (`wall_thickness < CORNER_SNAP_TOL` combined with an uncapped end) is now
well-understood and documented here for any future attempt, but implementing a fix
requires either:
- A wholesale redesign of the clustering approach (e.g. line-aware clustering that
  never merges two points belonging to what are recognizably two faces of the same
  wall, tracking wall-face identity through the weld — a bigger change than "add a
  guard"), or
- Accepting a scoped, drawing-specific workaround (e.g. lowering `CORNER_SNAP_TOL`
  for drawings with known thin walls, verified not to break other legitimate
  corner welds in that same drawing) rather than a general library fix.

**Decision (user, 2026-07-30):** stop here. Proceed with the 6 rooms (5 practically
valid) already detected on the real drawing via the existing `handle_generate_spaces`
pipeline; do not implement any of the three attempted fixes. This document is kept as
a record of the investigation and the three specific approaches already shown not to
work, so a future attempt does not repeat them from scratch.
