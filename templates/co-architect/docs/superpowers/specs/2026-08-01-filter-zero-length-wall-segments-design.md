# Filter Zero-Length Wall Segments Before Welding — Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-08-01
> **Related**: earlier session investigation `docs/superpowers/specs/2026-07-30-weld-endpoints-self-chaining-design.md` (ABANDONED after 3 failed welding-algorithm fix attempts)

## Problem

Live-drawing re-investigation of the remaining ~100 `UNCLOSED_WALLS` exceptions (after the furniture/HATCH layer-classification fixes) found the dangle points are largely NOT missing wall data — 122 of 200 dangling endpoints have another wall's endpoint within `CORNER_SNAP_TOL` (150mm), several within 5mm, yet don't weld. Investigation found the `walls` list contains segments with **sub-nanometer, floating-point-noise length** (e.g. `2.3283064365386963e-10`mm, `4.656612873077393e-10`mm — from `AcDbPolyline`-to-`WallSegment` conversion when a polyline has a repeated/near-duplicate vertex).

**Correction after spec review**: `_wall_segments_to_linestrings` (`space_geometry.py:341-355`) already skips *exactly* zero-length segments (`if seg.start == seg.end: continue`), with a docstring explicitly documenting this rationale. This is NOT a new gap. The real, narrower gap: the exact-equality check only catches bit-identical coordinates — it does NOT catch the floating-point-noise near-zero cases above (`start != end` by a sub-nanometer margin, so `==` is `False`, but the resulting `LineString` is still degenerate for any practical geometric purpose). These slip through as real-but-vanishingly-tiny segments, contributing a spurious network node.

## Goal

Tighten the existing exact-equality zero-length check in `_wall_segments_to_linestrings` to an epsilon-distance (equivalently, `seg.length <= EPSILON`) check, so floating-point-noise near-zero segments are caught the same way exact-zero ones already are — in both `WallProcessingMode.ENDPOINT_CLUSTER` and `SOLID_UNION` modes (both already funnel through this one shared function).

## Non-Goals

- **Not** filtering short-but-nonzero segments (10-150mm range) found in the same investigation (e.g. `4ELE`'s `153D-0`/`174B-1`/`174D-*` family, `2sec`'s `1609`/`1661-*`/`1664-*`/`16BA`) — these may be legitimate small jog/notch/step details from multi-vertex polylines (the `-N` handle suffixes suggest a single source polyline decomposed into several short sub-segments forming a small real feature) and removing them risks breaking legitimate topology. This is explicitly deferred pending separate, more careful per-case investigation — not bundled into this scoped, low-risk fix.
- **Not** attempting to fix `_weld_endpoints_v2`'s underlying self-chaining behavior — that was investigated and abandoned in an earlier session after 3 failed approaches (see the linked design doc); this fix is orthogonal (removing degenerate input) and doesn't touch the welding algorithm itself.
- **Not** claiming this will resolve all ~100 remaining `UNCLOSED_WALLS` exceptions — it removes provably-degenerate noise (a small fraction of the 389 walls: 5-7 measured as exactly/near-zero length). The Testing section requires honest before/after reporting, not an assumed target.

## Design

### Tighten the existing check in `_wall_segments_to_linestrings`

Current code (`space_geometry.py:341-355`):

```python
for seg in wall_segments:
    if seg.start == seg.end:
        continue
    lines.append(LineString([seg.start, seg.end]))
```

New constant near the other tolerance constants:

```python
# A "wall segment" with zero (or floating-point-noise) length is a
# degenerate artifact -- typically from a source AcDbPolyline with a
# duplicate/near-duplicate vertex during WallSegment conversion. It can
# never contribute to closing a real room boundary and only adds a
# spurious network node that can produce dangle-endpoint noise during
# welding. The pre-existing `seg.start == seg.end` check only catches
# exact bit-identical coordinates; live-drawing investigation 2026-08-01
# found genuinely near-zero-but-not-exact lengths (e.g. ~2.3e-10mm) that
# slip through it -- this epsilon check catches those too, while staying
# far tighter than any plausible real wall length (the shortest
# legitimate segments found in the same investigation were ~5-10mm).
ZERO_LENGTH_WALL_EPSILON_MM: float = 1e-6
```

Updated loop body — reuse `WallSegment.length` (already computed, cheaper than recomputing distance from `start`/`end`) instead of the exact-equality check:

```python
for seg in wall_segments:
    if seg.length <= ZERO_LENGTH_WALL_EPSILON_MM:
        continue
    lines.append(LineString([seg.start, seg.end]))
```

Update the function's docstring to describe the epsilon-based check (not the exact-equality one it currently documents). This is the single shared entry point both `_build_space_polygons` (line 2394) and `_build_space_polygons_solid_union` (line 939) already call, so no separate change is needed in either.

## Testing

No existing test directly/unit-tests `_wall_segments_to_linestrings` in isolation (confirmed during spec review — only indirect coverage via other functions' tests) — this plan writes the first direct unit tests for it.

1. `_wall_segments_to_linestrings` given a `WallSegment` with `start == end` exactly (zero-length) → still excluded (regression: confirms the tightened check doesn't break the pre-existing exact-equality behavior).
2. `_wall_segments_to_linestrings` given a `WallSegment` with a genuinely near-zero-but-nonzero length (e.g. `length=1e-10`, `start`/`end` differing by a sub-nanometer amount) → now excluded (this is the actual new behavior — the case that slipped through the old exact-equality check).
3. `_wall_segments_to_linestrings` given a `WallSegment` with a very small but genuinely real length (e.g. 5mm or 10mm, matching the `1D58`/`16BA`-style tiny-but-real segments found in this investigation) → still included (the `1e-6mm` epsilon is far tighter than any plausible real wall length, so it only catches true floating-point-degenerate cases, not the small-real-segment family explicitly out of scope above).
4. Full regression: `python -m pytest tests/ -q` — no regressions to existing `_build_space_polygons`/`_build_space_polygons_solid_union` tests.
5. **Live-drawing verification (required)**: re-run `zwcad_generate_spaces` (both modes) after this fix and report the actual before/after `UNCLOSED_WALLS` exception count and room count/areas honestly — this fix is expected to produce a small, not dramatic, improvement given the near-zero-noise segments are a small handful, not most of the 389 walls; report the real observed numbers, not an assumed outcome.

## Files Touched

- `src/cad_intelligence/geometry/space_geometry.py`: new `ZERO_LENGTH_WALL_EPSILON_MM` constant, `_wall_segments_to_linestrings`'s existing check tightened from exact equality to epsilon-based, docstring updated.
- `tests/test_space_geometry.py`: 3 new tests (first direct coverage of this function).
- `CHANGELOG.md`.
