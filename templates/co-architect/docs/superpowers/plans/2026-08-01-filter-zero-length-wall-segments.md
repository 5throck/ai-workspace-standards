# Filter Zero-Length Wall Segments Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the existing exact-equality zero-length check in `_wall_segments_to_linestrings` to an epsilon/length-based check, so floating-point-noise near-zero wall segments (sub-nanometer lengths that slip through `start == end`) are filtered the same way exact-zero ones already are — before they enter the welding/polygonization pipeline used by both `WallProcessingMode.ENDPOINT_CLUSTER` and `SOLID_UNION`.

**Architecture:** One new module-level constant (`ZERO_LENGTH_WALL_EPSILON_MM`) + a one-line change to the existing skip condition inside `_wall_segments_to_linestrings` (the single shared entry point both wall-processing modes already call). No new mechanism, no algorithm change.

**Tech Stack:** Python, `shapely.geometry.LineString`, existing `WallSegment`/`space_geometry.py`.

---

## Reference

Spec (approved after 1 revision round — first draft incorrectly described the filter as net-new when it already exists as an exact-equality check; reframed as a tightening): `docs/superpowers/specs/2026-08-01-filter-zero-length-wall-segments-design.md`

Key verified facts (from spec review):
- `_wall_segments_to_linestrings` (`space_geometry.py:341-355`) currently has `if seg.start == seg.end: continue` — this is the exact-equality check being tightened, NOT new code.
- Both `_build_space_polygons` (line 2394) and `_build_space_polygons_solid_union` (line 939) call this function — single shared entry point, so the fix covers both modes with one change.
- `WallSegment` carries a pre-computed `length` field (`common/models.py`) — reuse it directly (`seg.length <= EPSILON`), cheaper than recomputing distance from `start`/`end`.
- Epsilon `1e-6mm` is correct relative to the real data: genuine near-zero noise is ~`2.3e-10`mm (excluded by this fix), shortest real segments are ~`9.99999999976717` (~10mm, retained — these are the `1D58`/`16BA`-style tiny-but-real family explicitly out of scope).
- No existing test directly unit-tests `_wall_segments_to_linestrings` — this plan writes the first ones.

---

### Task 1: Tighten the zero-length check

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (new `ZERO_LENGTH_WALL_EPSILON_MM` constant near the other tolerance constants; tighten the skip condition in `_wall_segments_to_linestrings`).
- Test: `tests/test_space_geometry.py` (new tests — first direct coverage of `_wall_segments_to_linestrings`).

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_space_geometry.py` (read the file first to confirm its import style for `_wall_segments_to_linestrings` and `WallSegment` — match whatever alias/convention it already uses):

```python
class TestWallSegmentsToLinestringsZeroLength:
    """First direct unit tests for _wall_segments_to_linestrings's
    zero-length filtering -- see
    docs/superpowers/specs/2026-08-01-filter-zero-length-wall-segments-design.md.
    Live-drawing investigation 2026-08-01 found floating-point-noise
    near-zero wall segments (sub-nanometer lengths) slipping through the
    pre-existing exact-equality (start == end) check."""

    def test_exact_zero_length_segment_excluded(self):
        # Regression: the pre-existing behavior (start == end) must still hold.
        from cad_intelligence.common.models import WallSegment
        from cad_intelligence.geometry.space_geometry import _wall_segments_to_linestrings
        segs = [
            WallSegment(handle="w1", layer="W", start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0),
            WallSegment(handle="w0", layer="W", start=(0.0, 0.0), end=(0.0, 0.0), length=0.0),
        ]
        lines = _wall_segments_to_linestrings(segs)
        assert len(lines) == 1

    def test_near_zero_float_noise_segment_excluded(self):
        # The actual new behavior: sub-nanometer-but-nonzero length that
        # would slip through start == end is now caught by the epsilon.
        from cad_intelligence.common.models import WallSegment
        from cad_intelligence.geometry.space_geometry import _wall_segments_to_linestrings
        segs = [
            WallSegment(handle="w1", layer="W", start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0),
            WallSegment(handle="wn", layer="W", start=(0.0, 0.0), end=(0.0, 2.3e-10), length=2.3e-10),
        ]
        lines = _wall_segments_to_linestrings(segs)
        assert len(lines) == 1

    def test_small_real_segment_retained(self):
        # A genuinely small-but-real 10mm segment (the 1D58/16BA-style
        # family) must NOT be filtered -- epsilon is deliberately far
        # tighter than any plausible real wall length.
        from cad_intelligence.common.models import WallSegment
        from cad_intelligence.geometry.space_geometry import _wall_segments_to_linestrings
        segs = [
            WallSegment(handle="w1", layer="W", start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0),
            WallSegment(handle="ws", layer="W", start=(0.0, 0.0), end=(0.0, 10.0), length=10.0),
        ]
        lines = _wall_segments_to_linestrings(segs)
        assert len(lines) == 2
```

Before finalizing, confirm `WallSegment`'s actual required constructor fields in `common/models.py` (the spec says `handle`/`layer`/`start`/`end`/`length` — verify these are the exact field names and that `length` is settable, not derived/read-only).

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestWallSegmentsToLinestringsZeroLength -v`
Expected: `test_near_zero_float_noise_segment_excluded` FAILS (the near-zero `2.3e-10` segment slips through the current `start == end` check, so `len(lines)` is 2, not 1). The other two tests should PASS already (exact-zero is caught today; 10mm is retained today) — confirming the regression-guard and the out-of-scope-segment assumptions are sound.

- [ ] **Step 3: Add the constant**

In `space_geometry.py`, near the other `*_TOL`/`*_EPSILON` tolerance constants (search for `CORNER_SNAP_TOL` and place it in that region):

```python
#: A "wall segment" with zero (or floating-point-noise) length is a
#: degenerate artifact -- typically from a source ``AcDbPolyline`` with a
#: duplicate/near-duplicate vertex during ``WallSegment`` conversion. It
#: can never contribute to closing a real room boundary and only adds a
#: spurious network node that can produce dangle-endpoint noise during
#: welding. The pre-existing ``seg.start == seg.end`` check in
#: ``_wall_segments_to_linestrings`` only catches exact bit-identical
#: coordinates; live-drawing investigation 2026-08-01 found genuinely
#: near-zero-but-not-exact lengths (e.g. ~2.3e-10mm) that slipped through
#: it -- this epsilon check catches those too, while staying far tighter
#: than any plausible real wall length (the shortest legitimate segments
#: found in the same investigation were ~5-10mm).
ZERO_LENGTH_WALL_EPSILON_MM: float = 1e-6
```

- [ ] **Step 4: Tighten the skip condition**

In `_wall_segments_to_linestrings` (~`space_geometry.py:341-355`), change the existing:

```python
for seg in wall_segments:
    if seg.start == seg.end:
        continue
    lines.append(LineString([seg.start, seg.end]))
```

to:

```python
for seg in wall_segments:
    if seg.length <= ZERO_LENGTH_WALL_EPSILON_MM:
        continue
    lines.append(LineString([seg.start, seg.end]))
```

Update the function's existing docstring (which currently documents the exact-`start == end` behavior) to describe the epsilon-based check instead — same rationale, now broader to cover float-noise.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestWallSegmentsToLinestringsZeroLength -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Full regression**

Run: `python -m pytest tests/test_space_geometry.py -v` then `python -m pytest tests/ -q`.
Expected: PASS, no regressions (the only behavior change is filtering a few more near-zero segments that no legitimate test should depend on being present).

- [ ] **Step 7: Do NOT commit.**

---

### Task 2: CHANGELOG entry

- [ ] Add an `[Unreleased]` → `### Fixed` entry describing: the root cause (floating-point-noise near-zero wall segments from duplicate/near-duplicate polyline vertices slipping through the pre-existing exact-equality zero-length check), the fix (tightened to a `length <= 1e-6mm` epsilon check), the context (found during live-drawing investigation of remaining `UNCLOSED_WALLS` exceptions), and the explicit Non-Goal (short-but-real 10-150mm segments deliberately untouched). Reference the spec/plan. No commit — `/sync` handles it.

---

### Task 3: Manual real-drawing verification (REQUIRED)

- [ ] Call `zwcad_generate_spaces` (both default `ENDPOINT_CLUSTER` and `wall_processing_mode="solid_union"`) against the live drawing (once the MCP connection has been restarted to pick up this change).
- [ ] Report the actual before/after `UNCLOSED_WALLS` exception count and room count/areas honestly — the expected improvement is SMALL (the near-zero-noise segments are a handful, not most of the 389 walls), so report the real observed numbers, not an assumed outcome. If `UNCLOSED_WALLS` is unchanged, say so — that's a valid result confirming the float-noise segments weren't a major contributor and the 122 "near-wall-but-unwelded" endpoints found earlier point to a different cause (likely the abandoned `_weld_endpoints_v2` self-chaining issue, out of scope here).

No code change in this task — verification only.
