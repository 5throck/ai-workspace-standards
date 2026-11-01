# Label-Anchored Hybrid Room Reconstruction (v2) — Design Spec

## Context

`LABEL_VORONOI` (PR #190) reconstructs the correct room count (9, see `memory/apartment-floorplan-9-rooms-ground-truth.md`) by seeding a Voronoi partition from room-name text labels. It was explicitly scoped as v1: boundaries are straight-line Voronoi approximations, measured ~2.5x over-sized versus the true footprint, because no tight apartment outline exists yet.

Separately, this session's earlier diagnostic established that `SOLID_UNION` (an existing, unmodified mode) reconstructs 4 rooms from real wall geometry with **zero exceptions** — these 4 room boundaries are geometrically accurate (real walls, not approximated). The two modes have complementary strengths: `SOLID_UNION` gives accurate boundaries for rooms whose walls are intact; `LABEL_VORONOI` gives the correct *count* and *approximate* position/size for every room, including the ~5 rooms `SOLID_UNION` cannot close.

The user's request: combine them — use `SOLID_UNION`'s accurate polygons wherever they can be matched to a room-name label, and fall back to `LABEL_VORONOI`'s approximation only for the rooms `SOLID_UNION` didn't close.

## Goal

Add `LABEL_ANCHORED_HYBRID`: a new room-detection mode that returns exactly the labeled rooms (9 on the reference drawing), each polygon sourced from `SOLID_UNION` when a confident match exists, and from `LABEL_VORONOI` otherwise — with the source recorded per room so accuracy is never silently overstated.

## Non-Goals

- No change to `SOLID_UNION` or `LABEL_VORONOI` themselves — both are called unmodified as building blocks.
- No attempt to close more `SOLID_UNION` rooms (that remains future wall-data work, out of scope here).
- Unmatched `SOLID_UNION` fragments (real geometry with no room-name label nearby — e.g. corridors, structural voids) are dropped from the final result, not surfaced as unnamed rooms — this mode's contract is "exactly the labeled rooms," not "every polygon SOLID_UNION can find."

## Algorithm

### Step 1 — Compute both sources
- `solid_rooms, _ = _build_space_polygons_solid_union(wall_segments, doors)` — unmodified call.
- `voronoi_rooms, voronoi_exceptions = _build_space_polygons_label_voronoi(room_labels, doors)` — unmodified call. `room_labels` is the same `{"text": str, "position": (x, y)}` list `LABEL_VORONOI` already consumes.

### Step 2 — Match each room label to a `solid_rooms` polygon (3-tier, globally resolved)

The three tiers differ in confidence (leader-line evidence is stronger than the label's own text-anchor position, which is stronger than a bare distance guess). To honor that ranking, matching is resolved **globally across all labels, one tier at a time** — not per-label in isolation — so a strong match for one label can never be blocked by a weaker match a different label happened to claim first:

1. **Leader-line match** (new capability, see Step 3): for every label with an associated `AcDbLeader` whose terminal vertex falls inside a `solid_rooms` polygon, record that as a candidate leader-tier match. Commit all non-conflicting leader-tier matches (each such polygon is claimed by its matching label and removed from further consideration; in the rare case two labels' leaders both terminate in the same polygon, the first in label-processing order wins — not expected given the distinct room layout, but kept deterministic). This tier is resolved first because a leader line is the drawing author's explicit "this label refers to that area" annotation, more reliable than the label's own text-anchor position (labels are frequently placed outside the room they describe, with a leader pointing at the actual room — an observed pattern on the reference drawing).
2. **Direct containment**: for every label not yet matched (no leader, or its leader missed every polygon) and every `solid_rooms` polygon not yet claimed by tier 1, check whether the label's own `position` is contained in that polygon (point-in-polygon). Commit all such matches.
3. **Nearest-fallback**: for every label still unmatched and every polygon still unclaimed, find the closest remaining polygon by point-to-polygon distance; accept it only if that distance is `<= LABEL_ANCHOR_MATCH_MAX_DIST_MM` (1000.0).

A `solid_rooms` polygon claimed in an earlier tier is never reconsidered in a later tier, and a label matched in an earlier tier does not participate in later tiers. This guarantees a tier-1 (leader) match always wins over a tier-2 (direct) or tier-3 (nearest) match for the same polygon, regardless of which label was processed first.

### Step 3 — Extend `handle_extract_text_labels` to return leader lines
Add a `leader_lines` array to the handler's response, alongside the existing `text_labels` (which is unchanged — this is purely additive, preserving the existing contract):
```python
{"handle": "<leader handle>", "layer": "<layer>", "points": [[x1,y1], [x2,y2], ...]}
```
Scanned the same way `text_labels` are (same `search_layers` COM loop), filtered to `entity.ObjectName == "AcDbLeader"`. Each leader's vertex list comes from `entity.Coordinates` (flat x,y pairs), mirroring the existing `Coordinates`-reading pattern used by `_detect_curved_cluster_doors` and the model-space scanner (`space.py`, both already read polyline-like COM entities this way) — **the exact COM property for `AcDbLeader` vertices must be confirmed against the live ZWCAD COM object during implementation**; if `Coordinates` is not populated for this entity type, the plan must fall back to the appropriate one (e.g. per-vertex `Coordinate(i)` indexing) and this note updated.

A leader is associated with a label by proximity: the leader vertex nearest a label's `position`, within `LEADER_LABEL_ASSOCIATION_MAX_DIST_MM` (300.0), pairs that leader with that label. A label with no leader within tolerance has no leader association (falls through to Step 2's direct-containment tier). This association is computed in `_build_space_polygons_label_anchored_hybrid`, not in the handler — the handler only reports raw leader geometry.

### Step 4 — Assemble the result
For each room label:
- **Matched to a `solid_rooms` polygon** (any tier): use that polygon's geometry. Set `room_name` to the label text, `source = SpaceSource.GEOMETRY`.
- **Not matched**: use the corresponding `LABEL_VORONOI` polygon for that label (same label, already computed in Step 1). `source` stays `SpaceSource.LABEL_VORONOI` (unchanged from what `_build_space_polygons_label_voronoi` already set).

Unmatched `solid_rooms` polygons (no label associated via any tier) are discarded — not included in the output, per the Non-Goals section.

Result: exactly `len(room_labels)` rooms (9 on the reference drawing, after sidecar filtering — unchanged from `LABEL_VORONOI`'s count), each tagged with its true source.

### Step 5 — Exceptions
- Reuse `voronoi_exceptions` from Step 1 (unchanged — `LABEL_VORONOI_ROOM` / `OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS` etc. as already emitted) filtered to only the labels that ended up using the Voronoi fallback (drop the `LABEL_VORONOI_ROOM` exception for any label that got upgraded to a `SOLID_UNION` match — its exception no longer describes the final polygon).
- Add one new `ExceptionReport(code="LABEL_ANCHORED_GEOMETRY_MATCH", severity="info")` per label that WAS matched to real geometry, recording which tier matched (`leader` / `direct` / `nearest`) and the match distance — so a reviewer can audit match confidence per room, particularly the `nearest` tier which is the least certain.

## Integration

New `WallProcessingMode.LABEL_ANCHORED_HYBRID`. `handle_generate_spaces` dispatches to a new builder `_build_space_polygons_label_anchored_hybrid(room_labels, doors, wall_segments, leader_lines)` when `wall_processing_mode="label_anchored_hybrid"`. Mirrors `LABEL_VORONOI`'s dispatch branch: fetches labels via `handle_extract_text_labels` (now also returning `leader_lines`), filtered by the same `{stem}.room-labels.json` sidecar. Requires `wall_segments` (from `zwcad_extract_cad_objects`, auto-run if omitted) since `SOLID_UNION` needs them — `wall_segments` is already computed earlier in `handle_generate_spaces` regardless of mode, and the `SOLID_UNION` branch already threads it into its builder the same way (`LABEL_VORONOI`'s own branch does not need `wall_segments` today and doesn't pass it, since it has no wall-based component — this new mode is the first to need both `wall_segments` and `room_labels` together). Rejects `axis_grid`/`divider_lines` like the other two v1/v2 modes do (meaningless for both underlying builders).

## Constants (new)

- `LABEL_ANCHOR_MATCH_MAX_DIST_MM = 1000.0` — nearest-fallback tier ceiling (Step 2, tier 3).
- `LEADER_LABEL_ASSOCIATION_MAX_DIST_MM = 300.0` — leader-to-label pairing tolerance (Step 3).

## Testing

Unit tests for `_build_space_polygons_label_anchored_hybrid` (COM-free — leader/wall/label data passed as plain dicts/dataclasses, no live COM dependency, matching the existing `LABEL_VORONOI` test style):
1. A label whose leader endpoint falls inside a `solid_rooms` polygon → matched via leader tier, `source=GEOMETRY`.
2. A label with no leader, but its own position falls inside a `solid_rooms` polygon → matched via direct tier.
3. A label with a leader present, but its terminal vertex falls outside every `solid_rooms` polygon, while the label's own position IS contained in one → the leader tier correctly finds no match and yields to tier 2, which succeeds (leader presence must not block fallthrough to a weaker-but-valid tier).
4. A label with no leader and position outside all `solid_rooms` polygons, but within 1000mm of one → matched via nearest tier.
5. A label further than 1000mm from every `solid_rooms` polygon → falls back to its `LABEL_VORONOI` polygon, `source=LABEL_VORONOI`.
6. Global tier resolution: label A's own position falls inside polygon P (a tier-2 candidate), while label B's leader terminates inside the same polygon P (a tier-1 candidate). Tier 1 is resolved first and claims P for B; A must NOT claim P first merely because it was processed earlier — A falls through to tier 3 or Voronoi. This is the scenario the global per-tier resolution (Step 2) exists to prevent.
7. An unmatched `solid_rooms` polygon (no label within any tier) → excluded from the final result; result length stays `len(room_labels)`.
8. Result length always equals `len(room_labels)` regardless of match mix (0 matched / all matched / partial).
9. `ExceptionReport` per matched label records the correct tier and distance; per-unmatched label the (filtered) Voronoi exception is retained.

Unit test for the leader-line addition to `handle_extract_text_labels`: mock the COM `ModelSpace` iteration to include an `AcDbLeader` entity alongside `AcDbText`, confirm `leader_lines` is populated and `text_labels` is unaffected (regression: existing callers relying on `text_labels` alone see no change).

Manual verification (post-merge, MCP restart): run `wall_processing_mode="label_anchored_hybrid"` on the reference drawing. Record, per room: which source it got (`GEOMETRY` vs `LABEL_VORONOI`) and which match tier. Expected ceiling: at most 4 rooms can upgrade to `GEOMETRY`, since `SOLID_UNION` only closes 4 on this drawing — report the actual number honestly, including if it's fewer than 4 (a label might not match any of the 4 closed rooms if none of their real positions align).

## Known limitations (v1 of this hybrid)

- Only as good as `SOLID_UNION`'s closure rate on a given drawing — if a future drawing has 0 closed rooms, this mode degrades to pure `LABEL_VORONOI` behavior (which is a safe, tested fallback, not a failure).
- The exact `AcDbLeader` COM vertex-reading property needs live confirmation during implementation (see Step 3 note) — this is the one part of the design not yet verified against the real COM object.
- Leader-to-label association is proximity-based (300mm), not a true entity-relationship lookup (ZWCAD's COM API may not expose an explicit leader→annotated-text link) — if this proves unreliable in practice, direct-containment (tier 2) still provides a working fallback path.
