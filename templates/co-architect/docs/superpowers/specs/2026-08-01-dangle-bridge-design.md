# Collinear Dangle-Bridge — Design Spec

## Context

`_build_space_polygons` (ENDPOINT_CLUSTER mode) detects only 4 of 8 known real rooms on the reference drawing. Two prior approaches to close the gap both failed:
- PR #188 (`_synthesize_opening_evidence_walls`, pairwise opening connection): empirically ineffective — only 1 of 46 candidate pairs survived the crossing gate, no new rooms.
- PR #190 (`_openings_to_wall_segments`, per-opening wall synthesis): synthesizes 13 segments correctly but closes no new rooms (still 4).

A diagnostic this session established that the problem is **not the detection algorithm** but **gaps in the wall data itself**: both ENDPOINT_CLUSTER (endpoint-welding) and SOLID_UNION (area-union) — two fundamentally different algorithms — converge on the same 4 small rooms. The walls are severely over-fragmented (456 segments / 257 lines for an 8-room apartment; the median segment is tiny) and leave ~100 dangling endpoints that fail to connect.

Critically, the dangle-gap analysis shows the missed connections are **just above the welding threshold**:
- `CORNER_SNAP_TOL` (the weld tolerance) = **150mm**
- Dangle-gap median = **250mm**; 86% of dangle gaps are ≤ 500mm; 96% are ≤ 1000mm.

The welding tolerance cannot simply be raised globally — that re-triggers the `_weld_endpoints_v2` self-chaining defect (thin-wall opposite faces wrongly merge) abandoned after 3 failed attempts in an earlier session, which is why `_merge_wall_face_pairs` exists as a separate pre-weld step. A **targeted collinear-continuation bridge** sidesteps that defect: it heals in-line wall breaks only, never merges parallel wall faces.

## Goal

Add `_bridge_collinear_dangles`: a post-weld step that connects pairs of wall endpoints that are the broken tips of one collinear wall run, closing the small gaps the welder (correctly, for safety) refuses to close globally.

## Non-Goals

- No global change to `CORNER_SNAP_TOL` or `_weld_endpoints` behavior.
- No connecting of perpendicular/L-shaped corners (those within 150mm are already welded; beyond that is deferred — user explicitly chose collinear-only for v1 safety).
- No merging of parallel-offset wall face pairs (that is `_merge_wall_face_pairs`'s job; this step's facing-direction gate explicitly excludes them).
- No removal of PR #190's `_openings_to_wall_segments` (complementary — targets a different gap class; kept).
- SOLID_UNION mode is unchanged (its own gap-bridging is separate).

## Algorithm

Operating on the welded-and-bridged line network (`bridged_lines`, after `_bridge_door_window_gaps`), for every pair of line endpoints `(A, B)` from distinct line segments, connect them with a new `LineString([A, B])` only if the precondition and ALL FIVE gates pass.

### Precondition — degree-1 (free) endpoints
A and B must each be a *free* tip: an endpoint of exactly one input line segment (i.e., not already welded into a T-junction or mid-span). This prevents an already-connected endpoint from acquiring a spurious second bridge. Computed once at the start by tallying endpoint occurrences across the network within `CORNER_SNAP_TOL`.

### Gate 1 — Distance (cheap pre-filter)
`math.dist(A, B) <= DANGLE_BRIDGE_MAX_DIST_MM` (500.0). Applied first to keep the pair evaluation tractable.

### Gate 2 — Collinear axes
Let `axis_A = deg(atan2(S_A.far_end - S_A.tip))` and `axis_B = deg(atan2(S_B.far_end - S_B.tip))` — the axis angle of each candidate's own line segment, where `tip` is the endpoint being bridged (A for S_A, B for S_B) and `far_end` is its other endpoint. Require `_angle_diff_deg(axis_A, axis_B) <= DANGLE_BRIDGE_AXIS_TOL_DEG` (15.0). This confirms both segments lie on the same axis (direction-agnostic, mod 180 — the file's standard helper).

### Gate 3 — Facing direction (the break-vs-face discriminator)
Let `gap_axis = deg(atan2(B - A))`. Require `_angle_diff_deg(gap_axis, axis_A) <= DANGLE_BRIDGE_AXIS_TOL_DEG`. This is the key gate that distinguishes a **break** (gap runs *along* the wall axis → angle_diff ≈ 0°, bridge it) from a **parallel face pair** (gap runs *perpendicular* to the axis → angle_diff ≈ 90°, must NOT bridge — that is exactly the thin-wall-face case `_merge_wall_face_pairs` handles and `_weld_endpoints_v2` mishandles). It also rejects collinear-but-overlapping side-by-side segments, whose gap would be perpendicular.

### Gate 4 — Crossing exclusion
The candidate `LineString([A, B])` must not cross any existing line segment at a non-endpoint point. Reuse the `intersects()` → `intersection()` → endpoint-equality idiom from `_validate_dividers` (`space_geometry.py:2157-2189`). This prevents bridging across an unrelated wall.

### Gate 5 — Midpoint clearance (junction avoidance)
No endpoint of any other line segment (besides A and B themselves) lies within `DANGLE_BRIDGE_MIDPOINT_CLEARANCE_MM` (50.0) of the bridge segment's midpoint. A genuine broken-wall gap has empty space at its midpoint; an endpoint cluster near the midpoint signals a wall junction (where the gap is more likely an intentional opening between two rooms than a broken single wall). The radius is deliberately conservative — far smaller than `CORNER_SNAP_TOL` (150mm) and the 250mm median gap — so it rejects only truly junction-adjacent midpoints, not the dense fragmentation noise of this drawing. **This is the gate most likely to need tuning** after live verification: raise it if false rooms appear near junctions; lower it (toward 0) if legitimate breaks are being over-rejected.

### On accept
Append `LineString([A, B])` to the network and emit `ExceptionReport(code="SYNTHESIZED_DANGLE_BRIDGE", severity="warning", context={...})` so synthesized bridges are never silently indistinguishable from real drawing data.

### Pairing policy
Each endpoint bridges at most once per pass (greedy): once A is bridged to B, neither participates in a later pair this pass. Process candidate pairs in ascending distance order (shortest gaps first — the most certain breaks). One pass only (no iteration to fixed point — avoids runaway chaining).

## Pipeline change

ENDPOINT_CLUSTER sequence becomes:
```
wall segments + openings-to-wall-segments -> merge-wall-face-pairs -> weld -> axis snap -> bridge door/window gaps -> bridge collinear dangles (NEW) -> polygonize
```
`_bridge_collinear_dangles(lines)` runs on `bridged_lines`, returns `(bridged_lines + new_bridges, exceptions)`, fed to `_polygonize_network`. Called inside the `if mode == WallProcessingMode.ENDPOINT_CLUSTER:` branch only.

## Constants (new)

- `DANGLE_BRIDGE_MAX_DIST_MM = 500.0`
- `DANGLE_BRIDGE_AXIS_TOL_DEG = 15.0`
- `DANGLE_BRIDGE_MIDPOINT_CLEARANCE_MM = 50.0`

## Reused helpers (already in `space_geometry.py`)

- `_angle_diff_deg(a, b)` (~line 550) — axis/gap angle comparison.
- The crossing-check pattern (`.intersects()` → `.intersection()` → endpoint-equality) — same idiom as `_validate_dividers` (~line 2020).
- `math`, `LineString`, `ShapelyPoint`, `ExceptionReport` — all already imported.

## Testing

Unit tests for `_bridge_collinear_dangles`:
1. Two collinear stubs end-to-end with a 300mm gap → 1 bridge, 1 warning.
2. Two stubs 600mm apart (> 500mm threshold) → no bridge.
3. Two perpendicular stubs (90° axis diff) → no bridge (gate 2).
4. Two parallel-offset face-pair stubs (gap perpendicular to axis) → no bridge (gate 3 — the critical thin-wall exclusion).
5. Collinear pair whose bridge would cross a third, unrelated wall → no bridge (gate 4).
6. Endpoint bridges at most once: three collinear stubs in a row, two gaps — both gaps bridged, each endpoint used once.
7. Empty / single-line input → no bridge, no crash.
8. Midpoint clearance (Gate 5): a collinear-facing pair whose bridge midpoint has a third, unrelated endpoint within `DANGLE_BRIDGE_MIDPOINT_CLEARANCE_MM` → no bridge (junction avoidance).
9. Degree-1 precondition: an endpoint already welded into a T-junction (appears as a shared endpoint of two segments) is not eligible → not bridged even if a collinear partner exists nearby.

Integration test: `_build_space_polygons` with a synthetic near-closed rectangle whose top edge has a 300mm collinear break (two stubs + gap) → the dangle bridge heals it → 1 closed room (without the bridge, the open chain yields no room / a dangle exception).

Removal: none (this is purely additive; PR #188's code was already removed by PR #190).

Manual verification (post-merge, MCP restart): re-run on the reference drawing; record room count, `SYNTHESIZED_DANGLE_BRIDGE` count, `UNCLOSED_WALLS` count vs the current 4 rooms / 96 `UNCLOSED_WALLS`. Report honestly — do not assert 8 rooms will be reached; the share of the 86% small gaps that are truly collinear-facing is unknown until measured.

## Known residual risk

A linear chain of 3+ collinear stubs (S1–S2–S3–…) bridges fully in one greedy pass — each gap consumes two fresh endpoints, so the "at most once per endpoint" rule only binds at branching junctions, which collinear geometry cannot form. The real residual risks are (a) Gate 5's clearance radius needing tuning for this drawing's fragmentation density (see Gate 5), and (b) a collinear in-axis gap that is genuinely an intentional opening between two rooms being closed — surfaced as a `SYNTHESIZED_DANGLE_BRIDGE` warning so it is auditable, and bounded by the live room-count/shape check.
