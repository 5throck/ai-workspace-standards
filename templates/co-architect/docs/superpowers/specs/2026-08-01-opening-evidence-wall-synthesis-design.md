# Synthesize Opening-Evidence Walls from Door/Window Pairs — Design Spec

> **Status**: Approved (brainstorming session, 2026-08-01)
> **Created**: 2026-08-01
> **Related**: `docs/superpowers/specs/2026-07-30-weld-endpoints-self-chaining-design.md` (ABANDONED — the underlying wall-welding defect this spec works around, not fixes), `docs/designs/SPACE-001-design.md` §7.1 (the pipeline this inserts into)

## Problem

`_build_space_polygons`'s `ENDPOINT_CLUSTER` pipeline (welding → `_bridge_door_window_gaps` → polygonization) can only close a room boundary where wall geometry already exists, possibly with small gaps. On a real drawing investigated this session, wall data itself is incomplete in large stretches (not just small welding gaps) — `zwcad_generate_spaces` currently detects only 4 of the drawing's 8 real rooms (confirmed via room-name labels), even after fixing several layer-misclassification defects earlier in this session. `_bridge_door_window_gaps` (space_geometry.py:1360-1401) already uses door/window positions as evidence for *small* gaps between *existing* wall segments — but it cannot help where no wall segment exists at all on one or both sides of a genuinely missing wall run.

Doors and windows are directly-observed, high-confidence CAD data (unlike the wall layer classification issues fixed earlier this session) — a door or window can only exist embedded in a wall. Per user direction, this session inverts the usual priority: rather than trying once more to fix wall welding/extraction (already attempted 3 times in an earlier session and abandoned, see the linked ABANDONED design doc), use door/window positions as primary evidence to synthesize the missing wall runs between them, when the evidence is strong enough to be trustworthy.

## Goal

Add a new pipeline step, `_synthesize_opening_evidence_walls`, inserted between `_bridge_door_window_gaps` and `_polygonize_network` in `_build_space_polygons`'s `ENDPOINT_CLUSTER` path. For every pair of door/window openings meeting the evidence criteria below, synthesize a `LineString` connecting their positions and add it to the wall network before polygonization. Every synthesized wall is recorded via a new `ExceptionReport` (`code="SYNTHESIZED_OPENING_EVIDENCE_WALL"`, `severity="warning"`) so a synthesized wall is never silently indistinguishable from real drawing data.

## Non-Goals

- **`SOLID_UNION` mode is out of scope** — it represents walls as thickness-aware solid polygons, not centerline `LineString`s; converting a synthesized centerline into a solid with a plausible thickness is a different, unscoped problem. `ENDPOINT_CLUSTER` (the default mode, and the one that's been the source of this session's investigation) is the sole target.
- **Not re-attempting to fix `_weld_endpoints_v2`'s self-chaining defect** — this spec works around missing wall data by synthesizing evidence-backed replacements, it does not touch the welding algorithm itself (already investigated and abandoned once).
- **Not deduplicating/merging with `_bridge_door_window_gaps`'s output** — that function already ran earlier in the pipeline for the small-gap case; this new step operates independently on the (already-bridged) line set. A rare double-bridge (both this and the earlier step connecting the same two points) is geometrically harmless — `polygonize_full`/`unary_union` collapse duplicate/overlapping lines naturally.

**Revision note (post spec-review):** an earlier draft listed "same-room disambiguation" as an explicit Non-Goal, deferred to a hypothetical future iteration. Spec review correctly identified this as a real, non-hypothetical failure mode — not an edge case — and it has been promoted to a required v1 guard below (§ "Wall-crossing exclusion gate"), since the most geometrically "cheap" way to satisfy the distance/angle/proximity criteria is often two openings on *opposite sides of the same real party wall* between two already-separate, unrelated rooms. Without this guard, the algorithm would systematically cut synthesized walls across real room boundaries — directly undermining the room-count goal this spec exists to serve.

## Design

### New function: `_synthesize_opening_evidence_walls`

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
    a nearby real wall segment's axis direction.

    A pair (A, B) is connected only if ALL of:
    - distance(A.position, B.position) is within [min_dist, max_dist]
      (plausible room-wall-run scale, not adjacent-hardware noise or
      a cross-drawing false connection).
    - the A->B direction is within angle_tol_deg of SOME nearby real
      wall segment's axis direction (the "this direction is a real
      wall axis in this drawing" evidence).
    - at least ONE of A, B lies within real_wall_proximity_tol of a
      real wall segment endpoint (the "this opening is actually
      embedded in a wall, not floating" evidence) -- requiring only
      one, not both, per this session's explicit design decision:
      the other opening may be the far end of the missing run.
    - the candidate connecting LineString(A.position, B.position)
      does NOT cross or overlap any existing real wall segment
      (endpoint-touching excluded) -- rejects the common false-positive
      case of two openings on opposite sides of the same real party
      wall, which would otherwise satisfy the three criteria above
      "for free" (each is near *a* real wall -- the one separating
      them -- at a trivially-matching angle).

    Every accepted pair produces one synthesized LineString AND one
    ExceptionReport(code="SYNTHESIZED_OPENING_EVIDENCE_WALL",
    severity="warning") recording which openings/handles produced it,
    so a synthesized wall is never silently indistinguishable from
    real drawing data downstream.
    """
```

### Default tolerance constants

New constants alongside the module's existing tolerance constants (`space_geometry.py`, near `CORNER_SNAP_TOL`/`DOOR_BRIDGE_TOL`/`OPENING_PROXIMITY_TOL`):

```python
OPENING_EVIDENCE_MIN_DIST_MM: float = 500.0
OPENING_EVIDENCE_MAX_DIST_MM: float = 6000.0
OPENING_EVIDENCE_ANGLE_TOL_DEG: float = 15.0
OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM: float = 500.0
```

Distinct from the existing `OPENING_PROXIMITY_TOL = 200.0` (used by `_bridge_door_window_gaps` for the "is this gap explained by a door/window" check) — this is a different physical question ("is this opening embedded in a real wall run") with a looser, deliberately-wider tolerance, matching this module's established one-constant-per-question principle (see the module docstring's existing rationale for `CORNER_SNAP_TOL`/`DOOR_BRIDGE_TOL`/`WALL_PAIR_TOL` being kept separate).

### Nearby-real-wall axis direction lookup

Reuses the same style as `_bridge_door_window_gaps`'s opening-proximity check: for a candidate pair, find real wall segments (the `lines` list, pre-synthesis) within `OPENING_EVIDENCE_WALL_PROXIMITY_TOL_MM` of either opening's position, and check whether ANY such segment's axis angle — via `_angle_diff_deg` (space_geometry.py:550-556, `abs(a-b) % 180.0` then `min(d, 180-d)`, this module's existing angle-comparison helper already used for wall-pair/parallel matching elsewhere, e.g. `_merge_wall_face_pairs`) — is within `OPENING_EVIDENCE_ANGLE_TOL_DEG` of the candidate A→B direction.

### Wall-crossing exclusion gate (required v1 guard, added post spec-review)

Before accepting a candidate pair, construct the candidate `LineString(A.position, B.position)` and reject the pair if it crosses any existing real wall segment in `lines` at a non-endpoint point. **Reuse `_validate_dividers`'s existing crossing-check pattern** (space_geometry.py ~2040-2059) — `.intersects()` + `.intersection()`, then explicitly checking whether the intersection point coincides with one of the candidate's own endpoints (endpoint-touching is expected/harmless, only an interior crossing is rejected) — rather than introducing `.crosses()`/`.overlaps()` as a second, differently-behaved idiom for the same kind of check already solved once in this file. Scope the check to real wall segments within the candidate's own bounding box first (a cheap pre-filter before the exact geometric check, avoiding an O(n²) full scan).

This directly addresses the failure mode spec review identified: two openings on opposite sides of the same real party wall would otherwise satisfy the distance/angle/proximity criteria "for free," since each opening is independently near *a* real wall (the wall separating them) at a matching angle (parallel or perpendicular to it, trivially, since the opening is embedded in it). A synthesized `LineString` connecting them would necessarily cross that same separating wall — which this gate now explicitly forbids. A genuinely evidence-backed connection (bridging a real gap where wall data is missing) does not cross any existing wall segment, by construction, since there is no wall in the gap to cross.

**Known residual risk (acceptable for v1, explicitly named rather than left implicit):** this gate cannot distinguish a legitimate gap between two collinear (or near-collinear) real wall stubs from a candidate line that happens to pass *between* two unrelated wall segments without touching either — both produce a crossing-free candidate line. This is narrower and rarer than the party-wall case just fixed (it requires two segments on nearly the same axis with a gap, not just any two nearby walls), and every synthesized wall is still recorded via `SYNTHESIZED_OPENING_EVIDENCE_WALL` for downstream auditability regardless. Not solved in this v1; a future iteration could add same-room disambiguation if this residual case proves to matter in practice.

### Insertion point in `_build_space_polygons`

```python
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
```

`SOLID_UNION` mode's separate code path (`_build_space_polygons_solid_union`) is untouched — the `if mode == WallProcessingMode.ENDPOINT_CLUSTER:` guard is the Non-Goals scoping enforced in code, not just documentation.

## Testing

1. Two doors at a plausible room-wall distance (e.g. 3000mm apart), aligned with a nearby real wall segment's axis (within angle tolerance), one of them within proximity of a real wall endpoint → a synthesized `LineString` is produced, plus one `SYNTHESIZED_OPENING_EVIDENCE_WALL` exception.
2. Two openings too close together (e.g. 100mm, below `min_dist`) → not connected (guards against false positives from openings on the same short wall segment already covered by `_bridge_door_window_gaps`).
3. Two openings too far apart (e.g. 10000mm, above `max_dist`) → not connected (guards against spanning the whole drawing).
4. Two openings at a plausible distance but with NO nearby real wall segment at a matching angle → not connected (the angle-evidence gate rejects it).
5. Two openings at a plausible distance and angle, but NEITHER is near any real wall segment → not connected (the "at least one embedded in a real wall" gate rejects it).
6. **Wall-crossing exclusion gate (the required v1 guard)**: two openings on opposite sides of a single real wall segment — positioned so they'd otherwise pass distance/angle/proximity — must NOT be connected, because the candidate connecting line crosses that real wall segment. This is the single most important test in this plan, directly reproducing the failure mode spec review caught.
7. A genuinely evidence-backed pair (plausible distance/angle/proximity, connecting line crosses no existing wall) → still connected; confirms the new gate doesn't over-reject legitimate cases.
8. `WallProcessingMode.SOLID_UNION` mode's output is byte-for-byte unaffected by this change (regression, proving the Non-Goals scoping holds in practice, not just in the code's `if` guard).
9. Live-drawing verification (required, not optional, matching this session's established discipline): re-run `zwcad_generate_spaces` (ENDPOINT_CLUSTER, default) after this change and report the actual room count/areas honestly — this is expected to detect meaningfully more of the drawing's known 8 real rooms, but report the real observed number, not an assumed target.

## Files Touched

- `src/cad_intelligence/geometry/space_geometry.py`: new constants, new `_synthesize_opening_evidence_walls` function, one new call site in `_build_space_polygons`.
- `tests/test_space_geometry.py`: new tests per the Testing section above.
- `CHANGELOG.md`.
