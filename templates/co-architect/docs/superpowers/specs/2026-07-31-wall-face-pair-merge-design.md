---
lang: ko
lang_reason: proper-noun
---

# Wall-Face-Pair Pre-Merge — Design Spec

**Status:** Approved (user, 2026-07-31); Revision 2 (2026-07-31) after
spec-review found 4 issues, all fixed below — see "Revision Notes" at the end.
**Related:** `docs/superpowers/specs/2026-07-30-weld-endpoints-self-chaining-design.md`
(ABANDONED — self-chaining guard, forbidden-pair, mutual-nearest-neighbor all failed),
`memory/meeting-2026-07-31-weld-endpoints-defect.md` (meeting that also disproved a
cluster-diameter-cap hypothesis by direct execution before any spec was written for it)

## Problem

`_weld_endpoints_v2` (`space_geometry.py:666`) welds endpoints purely by proximity
within `CORNER_SNAP_TOL` (150mm), with no concept of "these two lines are the two
opposite faces of one physical wall." When a wall's thickness is smaller than
`CORNER_SNAP_TOL` (verified common: interior walls 70-100mm, exterior 150-200mm, in
Korean apartment drawings) **and** one end of that wall is uncapped in the source
drawing (a real, if imperfect, drafting pattern), Union-Find's transitive chaining
incorrectly welds the two faces together at the uncapped end. This has been directly
reproduced and root-caused on the minimal 3-line case (`157F`/`15EC`/`15ED`,
documented in the referenced ABANDONED spec): the wrong line (`15EC`, not `157F` as
originally miswritten) gets duplicated onto the other face's coordinates, and the
short capping segment (`15ED`) collapses to zero length.

**Three previous fix attempts, each operating on the *union-find output* trying to
detect/prevent the specific bad merge, all failed** (see the ABANDONED spec's
Post-Mortem): self-chaining guard (wrong line identified), forbidden-pair (bypassed
via an alternate transitive path), mutual-nearest-neighbor (the defective pair has no
other candidate, so it trivially satisfies "mutual nearest despite being wrong"). A
follow-up meeting (2026-07-31) proposed and then **directly disproved** a fourth
attempt (cluster-diameter cap) before writing any spec for it: the defective cluster's
diameter (90mm) is smaller than `test_transitive_cluster`'s legitimate diameter
(160mm), so no diameter threshold can separate the two cases.

**Root cause, restated:** every attempt so far tried to fix this *after* welding, by
inspecting or filtering the clusters the algorithm produced. But endpoint welding
fundamentally cannot distinguish "two points that are the same corner" from "two
points that are two faces of the same wall, 90mm apart" using proximity alone —
both are the same order of magnitude apart. The fix must happen *before* welding:
recognize wall-face pairs as a *pairing* problem (which two lines represent one
physical wall) rather than an *endpoint-proximity* problem.

## Scope Decision

Add a new pre-processing step, `_merge_wall_face_pairs`, that runs **before**
`_weld_endpoints_v2` in the wall-processing pipeline. It identifies pairs of
near-parallel, closely-spaced, overlapping-projection line segments (the two faces
of one physical wall) and replaces each matched pair with a single centerline
segment. Unmatched lines pass through unchanged. `_weld_endpoints_v2` itself is
**not modified** — it receives a cleaner input (centerlines instead of face pairs)
where the specific failure mode (face-to-face welding across a thin wall) can no
longer occur, because there is only one line per wall instead of two.

## Design

### New constant (`space_geometry.py`, alongside `WALL_PAIR_TOL`)

```python
#: Maximum perpendicular distance (mm) between two near-parallel line
#: segments for them to be considered the two opposite faces of one
#: physical wall (see _merge_wall_face_pairs). Wide enough to cover
#: the full observed range of Korean apartment wall thickness
#: (interior 70-100mm, exterior 150-200mm) with margin, while staying
#: well under DOOR_BRIDGE_TOL so it can't be confused with a door gap.
WALL_FACE_MAX_THICKNESS: float = 250.0

#: Minimum fraction of a candidate pair's shorter segment that must
#: project onto the other segment's axis for the pair to be accepted
#: as one wall's two faces (as opposed to two unrelated parallel walls
#: that happen to be nearby but don't run alongside each other).
WALL_FACE_MIN_OVERLAP_RATIO: float = 0.5

#: Maximum angle difference (degrees) between two line segments for
#: them to be considered parallel enough to be one wall's two faces.
#: This is an INDEPENDENT constant from AXIS_ALIGN_TOLERANCE_DEG
#: (wall_model.py) even though both currently happen to be 5.0 —
#: AXIS_ALIGN_TOLERANCE_DEG answers "is this one line's angle close to
#: a fixed 0/90 grid axis?" (a single-line, absolute-grid question);
#: this constant answers "are these two lines' angles close to EACH
#: OTHER?" (a pairwise, relative question). Reusing the grid-alignment
#: constant here would be a semantic coincidence, not a justified
#: reuse — drafting error between two faces of the same physical wall
#: is expected to be small (near-perfectly parallel by construction),
#: so 5.0 is chosen independently as a tight pairwise tolerance, not
#: borrowed from the grid-snapping domain.
WALL_FACE_PARALLEL_TOLERANCE_DEG: float = 5.0
```

### `_merge_wall_face_pairs(lines: list[LineString], max_thickness: float, min_overlap_ratio: float) -> list[LineString]`

Algorithm:

1. Build an `STRtree` over all input lines. For each line, query candidates within
   `max_thickness` (buffer search) to keep the search sub-quadratic.
2. For each candidate pair `(a, b)` not yet matched:
   - **Parallel check**: angle difference between `a` and `b` within
     `WALL_FACE_PARALLEL_TOLERANCE_DEG` (new, independently-justified constant —
     see above; NOT a reuse of `AXIS_ALIGN_TOLERANCE_DEG`, which answers a
     different question about a single line's angle relative to a fixed grid).
   - **Distance check**: perpendicular distance between the two lines' supporting
     infinite lines is `<= max_thickness`.
   - **Overlap check**: project both segments onto the shared axis (the average of
     the two angles); the length of their overlapping interval divided by the
     shorter segment's length must be `>= min_overlap_ratio`.
   - If all three pass, the pair is a candidate match with score = perpendicular
     distance (closer = better).
3. Resolve candidates via **mutual-best matching** (not plain greedy-by-score):
   for each line `a`, let `best(a)` be the candidate `b` with the lowest score
   (perpendicular distance) among `a`'s candidates. **Tie-break** (needed since
   CAD coordinates are frequently snapped/rounded, making exact-distance ties
   plausible, not just theoretical): if two or more candidates tie on score,
   prefer the one with the smaller angle difference from `a`; if still tied,
   prefer the one with the larger overlap ratio; if still tied (fully identical
   candidates, only possible with duplicate geometry), prefer the one with the
   lower index in the input `lines` list — this final tie-break is arbitrary but
   deterministic, which is all that's required since a remaining tie at this
   point means the two candidates are geometrically indistinguishable for this
   algorithm's purposes. Accept pair `(a, b)` only if `best(a) == b` AND
   `best(b) == a` — i.e., each line must be the other's single closest valid
   candidate, not merely *a* valid candidate accepted greedily. This prevents a
   "starvation" failure mode where a wall face's true partner is instead claimed
   by a closer but unrelated line (e.g., an undeduplicated hatch/fill line or a
   decorative parallel line): if line `A`'s true partner `B` is 90mm away but `B`
   is only 5mm from an unrelated line `C`, then `best(B) == C`, so `(A, B)` fails
   mutual-best and `A` correctly passes through unmatched (surfaced by the
   existing `UNCLOSED_WALLS` mechanism downstream if this leaves a real gap)
   rather than being silently mismatched. Lines with no mutual-best partner pass
   through unmatched — this is the same "honest fallback over silent guessing"
   principle already used by `_bridge_door_window_gaps` (gaps with no nearby
   opening are left unbridged, not guessed).
4. For each accepted pair, compute the **centerline**: the overlapping projected
   interval's midline (average of the two segments' projected overlap endpoints,
   at the perpendicular midpoint between the two faces). This is a new
   synthesized segment — the design intentionally accepts this as the one
   justified exception to the codebase's "avoid inventing new geometry" convention
   (see `_cluster_endpoints`'s docstring), because a wall centerline derived from
   two known, confirmed faces is a well-defined physical quantity, unlike a guessed
   bridge or corner position.
5. Any line involved in an accepted pair is replaced by its pair's centerline (both
   lines of a pair collapse to the *same* one centerline, so the pair contributes
   exactly one segment to the output, not two). Unmatched lines pass through as-is.
6. **Cap-segment removal**: after computing all accepted pairs, remove from the
   output any *other* input line that directly connects the two faces of an
   accepted pair (i.e., a short connector like `15ED`). Precise rule — a line `c`
   qualifies for removal only if **one** of its endpoints lies within
   `max_thickness` of face `a` AND its **other** endpoint lies within
   `max_thickness` of face `b`, for some accepted pair `(a, b)` — i.e., one
   endpoint near each face, not both endpoints near the same face. This is
   strictly narrower than "both endpoints near one face" (the ambiguous phrasing
   in the original draft, corrected here): a short perpendicular stub wall (e.g.,
   a closet partition or pilaster abutting only ONE face) has both its endpoints
   near that single face and is correctly NOT removed, because it never has an
   endpoint near the *other* face `b`. `15ED`'s endpoints — one at `15EC`'s end,
   one at `157F`'s start — satisfy "one near `a`, one near `b`" exactly. The
   `<= max_thickness` length cap from the original draft is kept as an additional
   guard (a one-endpoint-per-face connector should also be short, on the order of
   the wall thickness, not a long wall that merely happens to touch both faces'
   extended lines by coincidence).

### Pipeline integration

In `_build_space_polygons` (`space_geometry.py:1845-1853`), the new step is
inserted between `_wall_segments_to_linestrings` and `_weld_endpoints`, **gated on
`WALL_PROCESSING_MODE`** so the LEGACY (v1) path's input is byte-for-byte
unaffected, matching this design's actual scope (a v2/`ENDPOINT_CLUSTER`-only fix):

```python
raw_lines = _wall_segments_to_linestrings(wall_segments)
if divider_lines:
    raw_lines = list(raw_lines) + list(divider_lines)

if WALL_PROCESSING_MODE == WallProcessingMode.ENDPOINT_CLUSTER:
    raw_lines = _merge_wall_face_pairs(
        raw_lines, WALL_FACE_MAX_THICKNESS, WALL_FACE_MIN_OVERLAP_RATIO
    )

welded_lines = _weld_endpoints(raw_lines, CORNER_SNAP_TOL)
# ... unchanged from here (gap bridging, polygonize, etc.)
```

This preserves the existing A/B-comparison guarantee (per `WallProcessingMode`'s
own docstring: "Both paths coexist for A/B comparison and instant rollback") —
switching `WALL_PROCESSING_MODE` back to `LEGACY` reverts to pre-this-design
behavior exactly, with no partial effect from the new step leaking in.

## Non-Goals

- No change to `_weld_endpoints_v1`, `_weld_endpoints_v2`, or `_cluster_endpoints` —
  the fix is entirely upstream; the weld step's algorithm is untouched. The new
  pre-merge step is explicitly gated on `WALL_PROCESSING_MODE == ENDPOINT_CLUSTER`
  (see Pipeline Integration) so `_weld_endpoints_v1`'s effective input is also
  unaffected — this design does not change LEGACY-mode behavior at all, not just
  its algorithm.
- No change to `CORNER_SNAP_TOL`, `DOOR_BRIDGE_TOL`, or `OPENING_PROXIMITY_TOL`.
- Does not attempt to merge more than 2 faces into one wall (e.g. a wall drawn as 3+
  parallel lines for hatching/fill) — only exactly-2-line pairs are matched; extra
  lines remain unmatched and pass through, surfaced via existing `UNCLOSED_WALLS` if
  they cause a real gap.
- Does not handle curved/arc walls — this pipeline already only processes straight
  `LineString` segments (arcs are out of scope for the whole v2 pipeline, not just
  this step).
- Does not change `WALL_PAIR_TOL` (v1's unrelated, still-used constant) or any v1
  code path (`_get_wall_boundaries` in `com_bridge.py`).

## Testing

1. **Minimal repro regression** (the decisive test): construct `157F`/`15EC`/`15ED`
   from the ABANDONED spec's exact coordinates as `_merge_wall_face_pairs` input.
   Assert:
   - Output contains exactly 1 segment where `157F`/`15EC` were 2 (the merged
     centerline), not 3 segments.
   - `15ED` (the cap) does not appear in the output.
   - The centerline's length is close to 1675mm (the shared run length), not 0 and
     not 90mm.
   - Feeding this output into `_weld_endpoints_v2` + `polygonize_full` (combined
     with the 2 additional bounding walls needed to close a room in a slightly
     larger fixture) produces >= 1 valid polygon, where the current (unfixed)
     pipeline produces 0.
2. **Overlap-ratio rejection**: two parallel lines within `max_thickness` but with
   near-zero projected overlap (e.g., offset end-to-end, not running alongside each
   other) must NOT be merged — assert both lines pass through unmatched.
3. **Angle rejection**: two lines within `max_thickness` perpendicular distance but
   at a large angle to each other (e.g., perpendicular) must NOT be merged.
4. **Distance rejection**: two parallel, overlapping lines further apart than
   `max_thickness` (e.g., two genuinely separate walls of a corridor) must NOT be
   merged.
5. **Mutual-best starvation case**: construct 3 lines `A`, `B`, `C` where `A`/`B`
   are a genuine wall-face pair 90mm apart, but `C` (an unrelated nearby line,
   e.g. simulating an undeduplicated hatch/fill artifact) is parallel to `B` and
   only 5mm away. Assert: `(B, C)` is accepted (mutual best for both), `A` passes
   through unmatched (its only candidate `B` was claimed by its own mutual-best
   `C`), and `A` is NOT silently merged with anything incorrect. This is the
   scenario identified in spec review as the greedy-matching failure mode; the
   mutual-best rule must be shown to handle it correctly, not just assumed to.
6. **Tie-break determinism**: construct a line `a` with two candidates `b1`/`b2`
   at identical perpendicular distance from `a` but differing angle difference
   (`b1` more parallel to `a` than `b2`). Assert `best(a) == b1` (smaller angle
   difference wins the tie), and that running the match twice on the same input
   produces the identical result (determinism, not just a plausible-looking
   single run).
7. **Regression**: existing `TestClusterEndpoints`/`TestWeldEndpointsV2` test suite
   must pass unmodified — `_merge_wall_face_pairs` is a new step, not a
   modification of the existing weld functions.
8. **Real-drawing verification** (manual): re-run `handle_generate_spaces` on
   "아파트 평면도.dwg" and confirm room count moves from 6 toward the expected 8, and
   the specific `UNCLOSED_WALLS` dangles previously observed in the x<14000 region
   (where `CORNER_SNAP_TOL` tuning was tried and failed) resolve.

## Files Touched

- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add
  `WALL_FACE_MAX_THICKNESS`, `WALL_FACE_MIN_OVERLAP_RATIO` constants;
  add `_merge_wall_face_pairs` function; insert its call into the pipeline
  entry point (`_build_space_polygons` or equivalent) between wall-segment
  conversion and endpoint welding.
- Modify: `tests/test_space_geometry.py` — new `TestMergeWallFacePairs` test class.
- Modify: `CHANGELOG.md`.

## Open Questions

None outstanding — all scope decisions above were confirmed with the user during
brainstorming (pre-weld pairing step; `WALL_FACE_MAX_THICKNESS=250mm` as a new,
separately-tuned constant; automatic removal of cap segments once their two faces
merge).

## Revision Notes

**Revision 2 (2026-07-31)** — a spec-document-reviewer subagent hand-traced the
minimal repro (confirming the core algorithm's claimed outcome is correct, unlike
the prior ABANDONED spec's narrative error) but found 4 issues, all fixed above:

1. `AXIS_ALIGN_TOLERANCE_DEG` reuse was a semantic mismatch (single-line-vs-grid
   question, not pairwise-angle question) → replaced with new, independently
   justified `WALL_FACE_PARALLEL_TOLERANCE_DEG` constant.
2. The cap-segment removal rule as originally worded ("both endpoints near one
   face") could wrongly delete a legitimate short stub wall abutting one face →
   tightened to require one endpoint near EACH face of the pair.
3. Plain greedy-by-score matching could "starve" a true wall-face pair if an
   unrelated closer line claims one partner first → replaced with mutual-best
   matching (each line must be the other's single best candidate), plus a new
   dedicated test (Testing item 5) for this exact scenario.
4. The pipeline integration snippet inserted the new step unconditionally, which
   would silently change `_weld_endpoints_v1` (LEGACY)'s effective input despite
   the Non-Goals section claiming v1 is untouched — the new step is now
   explicitly gated on `WALL_PROCESSING_MODE == ENDPOINT_CLUSTER`.

**Revision 3 (2026-07-31)** — re-review confirmed findings 1, 2, and 4 fully fixed,
and found finding 3 only partially fixed: the mutual-best rule itself was
correctly shown to solve the starvation case, but `best(a)`'s tie-break rule
(what happens when two candidates have identical score) was left undefined. Fixed
by adding an explicit 3-level tie-break (angle difference → overlap ratio →
input-list index) and a corresponding determinism test (Testing item 6).
