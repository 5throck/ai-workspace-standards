# Sidecar-Driven Window Pattern Detection — Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-07-31
> **Related**: `docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md` (door detectors this mirrors), `memory/drawings/` reference drawing's `door-window-patterns.json` sidecar (already has `window_patterns` recorded, deferred from the door-detection pass)

## Problem

The door-pattern sidecar (PR #171) deliberately deferred window detection. The sidecar already documents 3 window symbol patterns found on the reference apartment floor plan, none of which match `handle_extract_cad_objects`'s existing block-name/sleeve-line heuristic for windows:

- **Type 1 — horizontal parallel lines**: ≥2 parallel lines, consistent perpendicular spacing (~440mm in this drawing), no surrounding frame. 4 instances.
- **Type 2 — framed parallel lines**: a rectangular bracket polyline enclosing ≥2 parallel lines. 1 instance.
- **Type 3 — vertical parallel lines**: same rule as Type 1, rotated 90°. 1 instance, **flagged by the user as a possible exception** — not fully confirmed equivalent to Type 1/2.

## Goals

- Add 2 new detectors (Type 1 and Type 3 are the same rule at different orientations — one detector, not two) that reuse the existing `_load_door_window_patterns` sidecar/`search_layers` convention from the door work.
- Extend `handle_extract_cad_objects`'s existing sidecar-override block (currently doors-only) to also override `windows` when `window_patterns` is present in the sidecar.
- Keep the Type 3 "possible exception" instance detectable but not silently promoted to full confidence — surfaced via a non-blocking `ExceptionReport`, not excluded outright (excluding it would contradict the sidecar's own instance list; the user hasn't said it's wrong, only unconfirmed).

## Non-Goals

- Not touching door detection (already shipped, PR #171).
- Not adding a `thickness` field to `WindowEntity` — its dataclass only has `handle`/`layer`/`position`/`width`/`block_name`; detected thickness is used internally for clustering, not persisted.
- Not attempting to resolve whether Type 3's flagged instance is a real window — it's surfaced with a distinct exception code so a human can decide later, same spirit as the door work's `19AF` (which *was* later confirmed — this is intentionally the same "flag now, resolve later" pattern).
- Not running live-drawing verification as part of this spec's implementation — that happens after, as a separate manual step (per the user's own two-part request: implement windows, then verify `SOLID_UNION`).

## Design

### 1. `_detect_parallel_line_windows(scan_result, search_layers, thickness_tol_mm=500.0, angle_tol_deg=3.0, min_lines=2)`

Generalizes Type 1 + Type 3 into one orientation-agnostic detector (never hardcodes "horizontal" or "vertical" — the sidecar's own two entries are the same rule at 90° apart, so encoding orientation would be overfitting to this one drawing).

Algorithm:
1. Filter `scan_result.entities()` to `AcDbLine` entries on a layer in `search_layers`.
2. For every pair of candidate lines, they're in the same cluster if:
   - Their angles (mod 180°) differ by ≤ `angle_tol_deg` (parallel), **and**
   - Perpendicular distance between the two infinite lines is ≤ `thickness_tol_mm`, **and**
   - Their projections onto the shared direction overlap by > 0 (they run alongside each other, not just parallel but spatially disjoint elsewhere in the drawing).
3. Union-Find these pairwise matches into clusters.
4. Keep clusters with ≥ `min_lines` members.
5. Each surviving cluster → one `WindowEntity`:
   - `handle`: the lexicographically-lowest member handle (deterministic).
   - `layer`: shared layer of the cluster.
   - `position`: centroid of all member line midpoints.
   - `width`: the longest member line's length (the "distinguishing dimension" per the sidecar description — thickness is the clustering criterion, not the reported dimension).
   - `block_name`: `None`.

This is the same style as the door arc-swing detector (proximity/parallelism clustering over the cached `scan_result`, no live COM read needed — `Entry` already carries `start`/`end`/`length` for `AcDbLine`; angle is *derived* per-line via `atan2(dy, dx) mod 180°`, not a stored field).

**Reference-axis convention** (needed once `angle_tol_deg` permits genuinely non-parallel pairs, e.g. 2.9° apart): for any candidate pair, always use the **lexicographically-lower-handle line's** direction as the reference axis for both the perpendicular-distance projection and the overlap check. This makes the pairwise test asymmetric-but-deterministic (same result regardless of iteration order) rather than ambiguous about whose angle "wins".

### 2. `_detect_framed_windows(scan_result, search_layers)`

Implements Type 2 directly:
1. Filter to `AcDbPolyline`/`AcDb2dPolyline` entries on `search_layers` whose vertex count and shape resemble a closed rectangle/bracket (4–8 vertices, axis-aligned bounding box — reuse the same "coordinates form an axis-aligned rectangle" check style already used elsewhere in this codebase for bracket shapes, e.g. the door sidecar's own `19BB`/`19BC` bracket note).
2. For each candidate frame, count `AcDbLine` entries (same `search_layers`) whose midpoint falls inside the frame's bounding box.
3. If ≥ 2 such lines are found → one `WindowEntity`:
   - `handle`: the frame polyline's handle.
   - `layer`: the frame's layer.
   - `position`: the frame's bounding-box centroid.
   - `width`: the frame's longer bounding-box dimension.
   - `block_name`: `None`.
4. Lines consumed by a confirmed frame match are excluded from `_detect_parallel_line_windows`'s candidate pool (§1 step 1) — a line inside a confirmed frame shouldn't *also* be double-counted as part of an unframed Type-1/3 cluster. Framed detection runs first; its member line handles are passed to the parallel-line detector as an exclusion set.

### 3. Sidecar schema addition

`window_patterns` in the sidecar JSON gains `search_layers` (mirroring the door work's schema correction — list of layer names, never hardcoded in Python):

```json
"window_patterns": {
  "type_1_horizontal_parallel_lines": {"search_layers": ["DOOR"], ...},
  "type_2_framed_parallel_lines": {"search_layers": ["DOOR"], ...},
  "type_3_vertical_parallel_lines": {"search_layers": ["DOOR"], "confidence_note": "..."}
}
```

At runtime, `type_1_horizontal_parallel_lines` and `type_3_vertical_parallel_lines`'s `search_layers` are **merged into one set** and passed to the single `_detect_parallel_line_windows` call (since it's one detector, not two) — if either key is present with non-empty `search_layers`, its layers are included.

### 4. `handle_extract_cad_objects` wiring

Extends the existing sidecar-override block (added in PR #171, currently doors-only):

```python
if patterns is not None:
    ...  # existing door detector calls, unchanged
    window_patterns = patterns.get("window_patterns", {})
    t1_layers = set((window_patterns.get("type_1_horizontal_parallel_lines") or {}).get("search_layers") or [])
    t3_layers = set((window_patterns.get("type_3_vertical_parallel_lines") or {}).get("search_layers") or [])
    parallel_layers = sorted(t1_layers | t3_layers)
    t2 = window_patterns.get("type_2_framed_parallel_lines")

    sidecar_windows: list["_WindowEntity"] = []
    consumed_handles: set[str] = set()
    if t2 and t2.get("search_layers"):
        framed, consumed_handles = _detect_framed_windows(scan_result, t2["search_layers"])
        sidecar_windows.extend(framed)
    if parallel_layers:
        sidecar_windows.extend(
            _detect_parallel_line_windows(scan_result, parallel_layers, exclude_handles=consumed_handles)
        )
    if window_patterns:
        windows = [w.to_dict() for w in sidecar_windows]
```

Same full-overwrite semantics as doors: if `window_patterns` key exists in the sidecar at all, `windows` is fully replaced (empty list is valid output, not "fall back to heuristic"). If the sidecar has no `window_patterns` key (or no sidecar at all), `windows` is untouched — existing behavior. **Explicit regression note**: a sidecar containing `door_patterns` but no `window_patterns` key (e.g. the current PR #171-era sidecar, before this spec's schema addition lands) must leave `windows` completely untouched — the outer `if patterns is not None:` gate alone is NOT sufficient to guarantee this; the window-override logic must be gated on its own `if window_patterns:` check (shown in the snippet above), separate from the door logic's gate, so doors-only sidecars don't regress window output.

### 5. Type 3 "possible exception" handling

This check is deliberately **position-based, not type-based** — it does not need to know which of Type 1/Type 3's `search_layers` a cluster came from (the merge in §1 discards that provenance on purpose, since orientation isn't a meaningful distinction to carry forward). Instead: after `_detect_parallel_line_windows` returns its clusters, `handle_extract_cad_objects` separately checks each cluster's `position` against the sidecar's `type_3_vertical_parallel_lines.instances[].approx_center` (within a loose tolerance, e.g. 200mm) **only if** that sidecar entry has a `confidence_note` field present. On a match, it appends one non-blocking `ExceptionReport(code="WINDOW_PATTERN_UNCONFIRMED", severity="warning", context={"handle": ..., "note": <the sidecar's confidence_note text>})` alongside the normal `windows` list — the window IS included in `windows` (detection is real), but flagged for human review, mirroring how `19AF` was flagged-then-later-confirmed for doors. If the sidecar has no `confidence_note` on any window pattern, this check is a no-op — no windows are ever excluded by it.

## Testing

1. `_detect_parallel_line_windows`: a 2-line parallel cluster within tolerance → 1 `WindowEntity`; lines outside `angle_tol_deg` or `thickness_tol_mm` → not clustered; a single line with no partner → no window (min_lines=2 not met); layer outside `search_layers` → ignored (regression: must not hardcode any layer name).
2. `_detect_framed_windows`: rectangular polyline + 2 enclosed lines → 1 `WindowEntity`; polyline with < 2 enclosed lines → no window; frame lines correctly excluded from a subsequent `_detect_parallel_line_windows` call via `exclude_handles`.
3. `handle_extract_cad_objects` sidecar integration: sidecar with `window_patterns` present → `windows` fully replaced; sidecar with door patterns only (no `window_patterns` key) → `windows` unchanged (regression against PR #171 behavior); no sidecar → unchanged (full regression).
4. Type 3 exception surfacing: a detected cluster near the sidecar's flagged Type 3 `approx_center` → both included in `windows` AND produces a `WINDOW_PATTERN_UNCONFIRMED` warning exception.
5. Manual real-drawing verification (after implementation, same pattern as the door work's Task 7): confirm 5 or 6 windows detected against the live drawing, matching the sidecar's `verified_totals.windows` note.

## Files Touched

- `memory/drawings/` reference sidecar JSON: add `search_layers` to all 3 `window_patterns` entries (mirrors the door schema fix).
- `src/cad_intelligence/cad_io/handlers/space.py`: `_detect_parallel_line_windows`, `_detect_framed_windows`, sidecar-override extension in `handle_extract_cad_objects`.
- `tests/handlers/test_extract_cad_objects_door_patterns.py` (existing file from PR #171 — window tests appended here since it's the same sidecar-detection test suite) or a new `test_extract_cad_objects_window_patterns.py` if the reviewer prefers separation (open question for spec review).
- `CHANGELOG.md`.
