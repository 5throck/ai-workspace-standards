# Confidence-Guided Two-Pass Opening Clustering Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `OpeningSymbolPipeline` from merging two physically distinct windows
into one candidate when they share a wall run separated by a narrow masonry pier,
without reintroducing fragmentation of genuinely single symbols — by replacing the
detector's flat 500mm radius with a tight Pass-1 radius plus a confidence-guided,
order-independent Pass-2 re-merge.

**Architecture:** Pass 1 lowers `OpeningSymbolDetector._CLUSTER_PROXIMITY_MM`
(500→200mm) so it intentionally under-clusters. Pass 1.5 runs the pipeline's existing
Evidence→Features→Classifier→Confidence stages on each sub-cluster unchanged. Pass 2
(new, lives in `OpeningSymbolPipeline.run()` — never inside the detector, preserving
its "no classification responsibility" boundary) builds a merge-eligibility graph over
only the *incomplete* sub-clusters (`final_confidence < _SUBCLUSTER_COMPLETE_CONFIDENCE`),
computes connected components (order-independent batch merge, not pairwise greedy),
merges each component's geometry in one step, re-classifies, and rolls the merge back only
if re-merging would make confidence worse than the best original sub-cluster's (a tie or
improvement accepts the merge — relaxed from strict `>` to `>=` after a real regression
where a single unclassifiable symbol's fragments tied the merged confidence). Edge eligibility uses PCA
principal-axis collinearity for normal sub-clusters, and an orientation-agnostic
point-to-bbox touch-distance rule for sparse (≤1-entity) sub-clusters (e.g. an AWNING's
diagonal brace line, which is never parallel to its frame).

**Tech Stack:** Python, `cad_intelligence.semantic.{opening_detector,opening_pipeline}`,
`math` (PCA via 2×2 covariance closed form — no numpy dependency), pytest.

**Design reference:**
`docs/superpowers/specs/2026-08-05-confidence-guided-two-pass-clustering-design.md`
(Approved — Pre-Implementation Verification Gate PASSED 2026-08-05: all 9 fixtures
correct at the confirmed constants below.)

---

## Confirmed constants (from the Verification Gate — do NOT re-tune)

| Constant | Location | Old | Final |
|---|---|---|---|
| `_CLUSTER_PROXIMITY_MM` | `opening_detector.py` | 500.0 | **200.0** |
| `_SUBCLUSTER_COMPLETE_CONFIDENCE` | `opening_pipeline.py` (new) | — | **0.4** |
| `_MERGE_RADIUS_MM` | `opening_pipeline.py` (new) | — | **500.0** |
| `_MERGE_COLLINEARITY_DEG` | `opening_pipeline.py` (new) | — | **15.0** |
| `_MERGE_TOUCH_TOLERANCE_MM` | `opening_pipeline.py` (new) | — | **75.0** |

---

## Commit Policy (this workspace — overrides the per-task `git commit` in TDD)

Per `CLAUDE.md`: **direct `git commit` / `git push` are forbidden, `--no-verify` is
forbidden, and env-var bypass of the SYNC_ACTIVE gate is forbidden.** All commits go
through the `/sync` pipeline (`scripts/dev-sync.ts`), which stages CHANGELOG, runs the
audit, commits, pushes, and opens the PR. The prior feature on this branch
(mirrored-two-unit) landed as a single `/sync`-produced commit, and this feature should
do the same.

**Therefore:** each task below ends with a **scoped test checkpoint** (run the listed
pytest command, confirm green), NOT a `git commit`. Accumulate all changes across tasks
6 → the final task runs one `/sync`. If a task's tests fail, fix before moving on (do
not commit red).

---

## File Structure

- **Modify:** `src/cad_intelligence/semantic/opening_detector.py` — change the value of
  the module-level `_CLUSTER_PROXIMITY_MM` constant only (200mm). No logic change.
- **Modify:** `src/cad_intelligence/semantic/opening_pipeline.py` — add 4 module-level
  constants; add module-level pure helpers (`_candidate_points`, `_centroid`,
  `_entity_count`, `_principal_axis`, `_point_to_bbox_distance`); add `_standard_eligible`,
  `_sparse_eligible`, `_merge_eligible`; refactor `run()` into `_classify_once` +
  `_two_pass_merge`; add `_merge_candidates` instance method.
- **Create:** `tests/test_opening_pipeline_two_pass.py` — all new tests (Pass-1
  fragmentation, each helper, merge rules, end-to-end on 4 synthetic scans, end-to-end
  golden regression on all 5 `tests/golden/windows/*`). Defines its own local
  `_FakeEntry` / `_FakeScanResult` (mirroring `tests/test_opening_detector.py` — kept
  duplicated, not cross-imported, so test modules stay decoupled).

The detector's `_build_candidate` is **reused as-is** by the new pipeline-level
`_merge_candidates` (it already consumes the entity-dict shape that `OpeningCandidate`
preserves verbatim in `.lines/.arcs/.closed_polylines`), so no geometry-building logic
is duplicated.

---

### Task 1: Lower the detector radius and add the pipeline constants

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_detector.py:96`
- Modify: `src/cad_intelligence/semantic/opening_pipeline.py` (module level, near the top)
- Test: `tests/test_opening_pipeline_two_pass.py` (new file)

- [ ] **Step 1: Write the failing test (and the new test file's shared fakes)**

Create `tests/test_opening_pipeline_two_pass.py`. Start with the local fakes (copy of
the pattern in `tests/test_opening_detector.py:11-25`) and a Pass-1 fragmentation test:

```python
"""Two-pass confidence-guided clustering — Pass 1 fragmentation + Pass 2 re-merge.

Validates docs/superpowers/specs/2026-08-05-confidence-guided-two-pass-clustering-design.md.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from cad_intelligence.semantic.opening_detector import OpeningSymbolDetector
from cad_intelligence.semantic.opening_pipeline import (
    OpeningSymbolPipeline,
    _MERGE_COLLINEARITY_DEG,
    _MERGE_RADIUS_MM,
    _MERGE_TOUCH_TOLERANCE_MM,
    _SUBCLUSTER_COMPLETE_CONFIDENCE,
)
from cad_intelligence.semantic.window_classifier import WindowStyle

GOLDEN_DIR = Path(__file__).resolve().parent / "golden" / "windows"


class _FakeEntry:
    """ModelSpaceScanResult Entry stub (mirrors tests/test_opening_detector.py)."""

    def __init__(self, layer, obj_name, **kwargs):
        self.layer = layer
        self.object_name = obj_name
        for k, v in kwargs.items():
            setattr(self, k, v)


class _FakeScanResult:
    def __init__(self, entries):
        self.entries_by_layer: dict[str, list] = {}
        for e in entries:
            self.entries_by_layer.setdefault(e.layer, []).append(e)


def _line(handle, x1, y1, x2, y2, layer="A-WIND"):
    return _FakeEntry(
        layer, "AcDbLine", handle=handle,
        start=(float(x1), float(y1)), end=(float(x2), float(y2)),
        length=((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5,
    )


def _scan(*entries):
    return _FakeScanResult(list(entries))


def test_pass1_fragments_two_windows_with_pier():
    """At 200mm, two complete windows 2500mm apart form 2 Pass-1 clusters (was 1 at 500mm
    for any pair under 500mm). Proves the radius change without depending on Pass 2."""
    scan = _scan(
        # Window A
        _line("A1", 0, 0, 2000, 0),
        _line("A2", 0, 50, 2000, 50),
        _line("A3", 0, 25, 2000, 25),
        # Window B, shifted +2500mm in x (well beyond any radius tested here)
        _line("B1", 2500, 0, 4500, 0),
        _line("B2", 2500, 50, 4500, 50),
        _line("B3", 2500, 25, 4500, 25),
    )
    candidates = OpeningSymbolDetector().detect(scan, search_layers={"A-WIND"})
    assert len(candidates) == 2


def test_pipeline_constants_have_confirmed_values():
    """Lock the five confirmed constants so a future edit can't drift silently."""
    from cad_intelligence.semantic import opening_detector as od
    assert od._CLUSTER_PROXIMITY_MM == 200.0
    assert _SUBCLUSTER_COMPLETE_CONFIDENCE == 0.4
    assert _MERGE_RADIUS_MM == 500.0
    assert _MERGE_COLLINEARITY_DEG == 15.0
    assert _MERGE_TOUCH_TOLERANCE_MM == 75.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: FAIL — `ImportError: cannot import name '_MERGE_RADIUS_MM'` (etc.) from
`opening_pipeline`, and `test_pass1_fragments_two_windows_with_pier` may already pass
incidentally (the two windows are 2500mm apart, so even 500mm splits them) — that is fine;
the import error is the real failure this step pins.

- [ ] **Step 3: Change the detector radius**

In `src/cad_intelligence/semantic/opening_detector.py:96`, change:

```python
_CLUSTER_PROXIMITY_MM: float = 500.0  # max distance for two entities to belong to the same cluster
```

to:

```python
_CLUSTER_PROXIMITY_MM: float = 200.0  # Pass 1 tight-clustering radius (see two-pass design)
```

- [ ] **Step 4: Add the four pipeline constants**

At the top of `src/cad_intelligence/semantic/opening_pipeline.py`, immediately after the
existing imports and before `__all__`, add:

```python
# ---------------------------------------------------------------------------
# Two-pass clustering constants (see spec:
# docs/superpowers/specs/2026-08-05-confidence-guided-two-pass-clustering-design.md).
# All five values were confirmed against 4 synthetic + 5 golden fixtures in the
# Pre-Implementation Verification Gate (2026-08-05). Do not re-tune blindly.
# ---------------------------------------------------------------------------
_SUBCLUSTER_COMPLETE_CONFIDENCE: float = 0.4   # < this → eligible for Pass-2 re-merge
_MERGE_RADIUS_MM: float = 500.0                # Pass-2 outer centroid distance (standard rule)
_MERGE_COLLINEARITY_DEG: float = 15.0          # Pass-2 axis/centroid-direction agreement
_MERGE_TOUCH_TOLERANCE_MM: float = 75.0        # Pass-2 point-to-bbox touch (sparse rule)
```

Add these four names to the module's `__all__` list (they are imported by the test).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: PASS (2 tests).

- [ ] **Step 6: Confirm no existing detector test broke from the radius change**

Run: `pytest tests/test_opening_detector.py tests/test_window_pipeline.py -v`
Expected: PASS. (`test_opening_detector.py`'s `_sliding_scan`/`_mixed_scan` geometries
have intra-cluster spreads ≤50mm and inter-cluster gaps ≥1000mm, so the 500→200 change
does not alter their results. `test_window_pipeline.py` builds `OpeningCandidate`s
directly via `_candidate_from_geometry` and never invokes the detector, so it is
unaffected — this is the latent coverage gap Task 5 closes.)

- [ ] **Checkpoint (no commit):** all tests green; do not commit yet (see Commit Policy).

---

### Task 2: Pure geometry primitives

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_pipeline.py` (add module-level helpers)
- Test: `tests/test_opening_pipeline_two_pass.py`

These are pure functions over `OpeningCandidate` so they can be unit-tested in isolation.
Add them as module-level functions in `opening_pipeline.py`, alphabetically after the
constants.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_opening_pipeline_two_pass.py`:

```python
from cad_intelligence.semantic.opening_detector import OpeningCandidate
from cad_intelligence.semantic.opening_pipeline import (
    _candidate_points,
    _centroid,
    _entity_count,
    _point_to_bbox_distance,
    _principal_axis,
)


def _cand(lines=(), arcs=(), polys=(), bbox=None):
    """Minimal OpeningCandidate builder for helper-level unit tests."""
    return OpeningCandidate(
        handle="h", layer="A-WIND",
        bbox=bbox or (0.0, 0.0, 0.0, 0.0),
        lines=tuple(lines), arcs=tuple(arcs), closed_polylines=tuple(polys),
    )


def _ln(x1, y1, x2, y2, h="L"):
    return {"handle": h, "start": (float(x1), float(y1)),
            "end": (float(x2), float(y2)), "length": 0.0}


class TestGeometryPrimitives:
    def test_candidate_points_collects_line_endpoints_and_polyline_vertices(self):
        c = _cand(
            lines=[_ln(0, 0, 10, 10, "L1")],
            polys=[{"handle": "P1", "coordinates": [0, 0, 5, 0, 5, 5, 0, 5]}],
        )
        pts = _candidate_points(c)
        assert (0.0, 0.0) in pts and (10.0, 10.0) in pts
        assert (5.0, 5.0) in pts and (0.0, 5.0) in pts

    def test_centroid_of_two_points_is_their_midpoint(self):
        c = _cand(lines=[_ln(0, 0, 10, 0)])
        assert _centroid(c) == pytest.approx((5.0, 0.0))

    def test_entity_count_sums_lines_arcs_polys(self):
        c = _cand(
            lines=[_ln(0, 0, 1, 0)],
            arcs=[{"handle": "A1", "center": (0, 0), "radius": 1.0,
                   "start_angle": 0.0, "end_angle": 1.0}],
            polys=[{"handle": "P1", "coordinates": [0, 0, 1, 0, 1, 1]}],
        )
        assert _entity_count(c) == 3

    def test_principal_axis_of_horizontal_pair_is_x_axis(self):
        # Two horizontal lines → principal axis ≈ (±1, 0).
        c = _cand(lines=[_ln(0, 0, 400, 0, "L1"), _ln(0, 50, 400, 50, "L2")])
        ax = _principal_axis(c)
        assert ax is not None
        assert abs(ax[0]) == pytest.approx(1.0, abs=1e-9)
        assert abs(ax[1]) == pytest.approx(0.0, abs=1e-9)

    def test_principal_axis_of_vertical_pair_is_y_axis(self):
        c = _cand(lines=[_ln(500, 0, 500, 300, "L3"), _ln(550, 0, 550, 300, "L4")])
        ax = _principal_axis(c)
        assert ax is not None
        assert abs(ax[1]) == pytest.approx(1.0, abs=1e-9)
        assert abs(ax[0]) == pytest.approx(0.0, abs=1e-9)

    def test_principal_axis_none_for_single_point(self):
        # One degenerate line (both endpoints identical) → <2 distinct points → None.
        c = _cand(lines=[_ln(3, 3, 3, 3)])
        assert _principal_axis(c) is None

    def test_point_to_bbox_distance_zero_when_inside(self):
        assert _point_to_bbox_distance((5, 5), (0, 0, 10, 10)) == 0.0

    def test_point_to_bbox_distance_to_corner(self):
        assert _point_to_bbox_distance((0, 0), (0, 0, 400, 50)) == 0.0

    def test_point_to_bbox_distance_above_box(self):
        assert _point_to_bbox_distance((200, 800), (0, 0, 400, 50)) == pytest.approx(750.0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_opening_pipeline_two_pass.py::TestGeometryPrimitives -v`
Expected: FAIL with `ImportError: cannot import name '_candidate_points'` (etc.).

- [ ] **Step 3: Write the helpers**

Add to `opening_pipeline.py` (module level, after the constants):

```python
import math
# NOTE: `math` is the only new import — no numpy. Add it to the stdlib import block
# at the top of the file (alongside `from __future__ import annotations` etc.).


def _candidate_points(c: OpeningCandidate) -> list[tuple[float, float]]:
    """All 2D sample points of a candidate's geometry (line endpoints, polyline
    vertices, arc centers). Used by centroid/PCA/touch-distance helpers."""
    pts: list[tuple[float, float]] = []
    for ln in c.lines:
        pts.append(tuple(ln["start"]))
        pts.append(tuple(ln["end"]))
    for p in c.closed_polylines:
        coords = p["coordinates"]
        for i in range(0, len(coords) - 1, 2):
            pts.append((float(coords[i]), float(coords[i + 1])))
    for a in c.arcs:
        cx, cy = a["center"]
        pts.append((float(cx), float(cy)))
    return pts


def _centroid(c: OpeningCandidate) -> tuple[float, float]:
    pts = _candidate_points(c)
    if not pts:
        return (0.0, 0.0)
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def _entity_count(c: OpeningCandidate) -> int:
    """Total geometry items — a proxy for 'does this sub-cluster have a shape of its
    own to compare?' A single line (count 1) is 'sparse' under the merge rules."""
    return len(c.lines) + len(c.arcs) + len(c.closed_polylines)


def _principal_axis(c: OpeningCandidate) -> tuple[float, float] | None:
    """Unit PCA principal axis of the candidate's point cloud, or None if fewer than
    2 distinct points (no definable axis). Computed via the closed-form eigenvector of
    the 2x2 covariance matrix — atan2 handles the 180° sign ambiguity that defeats a
    naive mean-of-line-angles (the 0°/179° → ~90° failure called out in the spec)."""
    pts = _candidate_points(c)
    if len(pts) < 2:
        return None
    cx = sum(p[0] for p in pts) / len(pts)
    cy = sum(p[1] for p in pts) / len(pts)
    sxx = syy = sxy = 0.0
    for x, y in pts:
        dx, dy = x - cx, y - cy
        sxx += dx * dx
        syy += dy * dy
        sxy += dx * dy
    theta = 0.5 * math.atan2(2.0 * sxy, sxx - syy)
    return (math.cos(theta), math.sin(theta))


def _point_to_bbox_distance(pt: tuple[float, float],
                            bbox: tuple[float, float, float, float]) -> float:
    """Min distance from a point to an axis-aligned bbox (0 if inside)."""
    x, y = pt
    minx, miny, maxx, maxy = bbox
    dx = max(minx - x, 0.0, x - maxx)
    dy = max(miny - y, 0.0, y - maxy)
    return math.hypot(dx, dy)
```

Add `_candidate_points, _centroid, _entity_count, _principal_axis, _point_to_bbox_distance`
to `__all__`. `OpeningCandidate` is already imported.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_opening_pipeline_two_pass.py::TestGeometryPrimitives -v`
Expected: PASS (9 tests).

- [ ] **Checkpoint (no commit):** all green.

---

### Task 3: Merge-eligibility rules and `_merge_candidates`

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_pipeline.py`
- Test: `tests/test_opening_pipeline_two_pass.py`

- [ ] **Step 1: Write the failing tests**

Append:

```python
from cad_intelligence.semantic.opening_pipeline import (
    _standard_eligible,
    _sparse_eligible,
    _merge_eligible,
)


def _horiz_pair(x0=0, y0=0, span=400, gap=50, h1="L1", h2="L2"):
    """Two parallel horizontal lines (an incomplete sub-cluster)."""
    return _cand(lines=[_ln(x0, y0, x0 + span, y0, h1),
                        _ln(x0, y0 + gap, x0 + span, y0 + gap, h2)],
                 bbox=(x0, y0, x0 + span, y0 + gap))


def _vert_pair(x0=500, y0=0, span=300, gap=50, h1="L3", h2="L4"):
    return _cand(lines=[_ln(x0, y0, x0, y0 + span, h1),
                        _ln(x0 + gap, y0, x0 + gap, y0 + span, h2)],
                 bbox=(x0, y0, x0 + gap, y0 + span))


def _single_line(x1, y1, x2, y2, h="LX"):
    c = _cand(lines=[_ln(x1, y1, x2, y2, h)], bbox=(min(x1, x2), min(y1, y2),
                                                     max(x1, x2), max(y1, y2)))
    return c


class TestStandardEligible:
    def test_two_collinear_pairs_within_radius_merge(self):
        # fragmented_single shape: pair at x=0..400, single center aside handled under
        # sparse; here two horizontal pairs offset along x within 500mm.
        a = _horiz_pair(0, 0)                       # centroid (200, 25)
        b = _horiz_pair(450, 0, h1="L3", h2="L4")   # centroid (650, 25); 450mm apart
        assert _standard_eligible(a, b) is True

    def test_perpendicular_pairs_do_not_merge(self):
        # corner_windows shape: x-aligned pair vs y-aligned pair, centroids within 500mm.
        a = _horiz_pair(0, 0)                       # centroid (200, 25), axis x
        b = _vert_pair(500, 0)                      # centroid (525, 150), axis y; ~348mm
        assert _standard_eligible(a, b) is False

    def test_beyond_radius_does_not_merge(self):
        a = _horiz_pair(0, 0)
        b = _horiz_pair(1000, 0, h1="L3", h2="L4")  # 1000mm apart
        assert _standard_eligible(a, b) is False

    def test_single_line_not_standard_eligible(self):
        a = _horiz_pair(0, 0)
        b = _single_line(200, 25, 650, 25)          # sparse → _principal_axis None
        assert _standard_eligible(a, b) is False


class TestSparseEligible:
    def test_touching_endpoint_merges(self):
        # awning_01 shape: sparse diagonal endpoint (0,0) on the frame bbox corner.
        frame = _horiz_pair(0, 0, span=2000, gap=50, h1="L6", h2="L7")  # bbox (0,0,2000,50)
        diagonal = _single_line(0, 0, 1000, 500, "L8")  # endpoint (0,0) on corner
        assert _sparse_eligible(diagonal, frame) is True

    def test_distant_stray_does_not_merge(self):
        # far_stray_line shape: sparse line 750mm above the group.
        group = _horiz_pair(0, 0, span=400, gap=50, h1="L1", h2="L2")  # bbox (0,0,400,50)
        stray = _single_line(200, 800, 600, 800, "L3")  # nearest pt 750mm from bbox
        assert _sparse_eligible(stray, group) is False


class TestMergeEligibleDispatch:
    def test_sparse_node_routes_to_sparse_rule(self):
        frame = _horiz_pair(0, 0, span=2000, gap=50, h1="L6", h2="L7")
        diagonal = _single_line(0, 0, 1000, 500, "L8")
        assert _merge_eligible(diagonal, frame) is True   # sparse dispatch

    def test_two_normal_nodes_route_to_standard_rule(self):
        a = _horiz_pair(0, 0)
        b = _vert_pair(500, 0)
        assert _merge_eligible(a, b) is False             # standard dispatch


class TestMergeCandidates:
    def test_reuses_detector_build_candidate(self):
        from cad_intelligence.semantic.opening_pipeline import OpeningSymbolPipeline

        a = _cand(lines=[_ln(0, 0, 400, 0, "L1"), _ln(0, 50, 400, 50, "L2")],
                  bbox=(0, 0, 400, 50))
        b = _cand(lines=[_ln(450, 25, 850, 25, "L3")], bbox=(450, 25, 850, 25))
        merged = OpeningSymbolPipeline()._merge_candidates([a, b])
        assert len(merged.lines) == 3
        assert merged.handle == "L1"            # lexicographically-lowest
        assert merged.bbox == (0.0, 0.0, 850.0, 50.0)
        assert merged.summary is not None and merged.summary.line_count == 3
        assert merged.signature is not None and merged.signature.content_hash
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_opening_pipeline_two_pass.py::TestStandardEligible tests/test_opening_pipeline_two_pass.py::TestSparseEligible tests/test_opening_pipeline_two_pass.py::TestMergeEligibleDispatch tests/test_opening_pipeline_two_pass.py::TestMergeCandidates -v`
Expected: FAIL with `ImportError`.

- [ ] **Step 3: Write the merge rules and `_merge_candidates`**

Add to `opening_pipeline.py` (module level, after the Task 2 helpers):

```python
def _standard_eligible(a: OpeningCandidate, b: OpeningCandidate) -> bool:
    """Standard Pass-2 edge rule (neither node sparse): within _MERGE_RADIUS_MM AND
    PCA-collinear (principal axes agree within _MERGE_COLLINEARITY_DEG AND the
    centroid-to-centroid vector is parallel to that shared axis within the same
    tolerance). Returns False if either node lacks a definable principal axis."""
    ca, cb = _centroid(a), _centroid(b)
    d = math.hypot(ca[0] - cb[0], ca[1] - cb[1])
    if d > _MERGE_RADIUS_MM:
        return False
    ua, ub = _principal_axis(a), _principal_axis(b)
    if ua is None or ub is None:
        return False
    # Acute angle between axes (|dot| collapses the 180° sign ambiguity).
    axis_agree = math.degrees(math.acos(min(1.0, abs(ua[0] * ub[0] + ua[1] * ub[1]))))
    if axis_agree > _MERGE_COLLINEARITY_DEG:
        return False
    if d < 1e-6:
        return True  # coincident centroids — treat as parallel (degenerate but safe)
    du = ((cb[0] - ca[0]) / d, (cb[1] - ca[1]) / d)
    connect_ang = math.degrees(math.acos(min(1.0, abs(du[0] * ua[0] + du[1] * ua[1]))))
    return connect_ang <= _MERGE_COLLINEARITY_DEG


def _sparse_eligible(a: OpeningCandidate, b: OpeningCandidate) -> bool:
    """Sparse Pass-2 edge rule (at least one node has ≤1 entity): replace both the
    centroid-distance gate and the collinearity check with a single orientation-
    agnostic point-to-bbox touch-distance check (≤ _MERGE_TOUCH_TOLERANCE_MM). For each
    sparse side, measure its sample points' min distance to the OTHER node's bbox and
    take the overall min."""
    best = float("inf")
    if _entity_count(a) <= 1:
        best = min(best, min(
            (_point_to_bbox_distance(p, b.bbox) for p in _candidate_points(a)),
            default=float("inf"),
        ))
    if _entity_count(b) <= 1:
        best = min(best, min(
            (_point_to_bbox_distance(p, a.bbox) for p in _candidate_points(b)),
            default=float("inf"),
        ))
    return best <= _MERGE_TOUCH_TOLERANCE_MM


def _merge_eligible(a: OpeningCandidate, b: OpeningCandidate) -> bool:
    """Dispatch: sparse nodes use the touch rule; normal nodes use the collinearity rule."""
    if _entity_count(a) <= 1 or _entity_count(b) <= 1:
        return _sparse_eligible(a, b)
    return _standard_eligible(a, b)
```

Add the instance method to `OpeningSymbolPipeline` (it reuses the detector's own
candidate-builder so no geometry logic is duplicated):

```python
    def _merge_candidates(self, parts: list[OpeningCandidate]) -> OpeningCandidate:
        """Combine several Pass-1 sub-clusters into one candidate (Pass-2 batch merge).

        Reuses ``OpeningSymbolDetector._build_candidate`` — the entity dicts stored on
        each candidate (``.lines/.arcs/.closed_polylines``) still carry the
        ``type``/``object_name``/``handle``/``layer`` keys that builder reads, so bbox,
        signature, and summary are recomputed exactly as in Pass 1."""
        entities: list[dict] = []
        for c in parts:
            entities.extend(c.lines)
            entities.extend(c.arcs)
            entities.extend(c.closed_polylines)
        return self._detector._build_candidate(entities)
```

Add `_standard_eligible, _sparse_eligible, _merge_eligible` to `__all__`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: PASS (all classes so far).

- [ ] **Checkpoint (no commit):** all green.

---

### Task 4: Wire Pass 2 into `run()` and verify the 4 synthetic scans end-to-end

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_pipeline.py` (refactor `run()`)
- Test: `tests/test_opening_pipeline_two_pass.py`

- [ ] **Step 1: Write the failing end-to-end tests**

Append the four synthetic scans (coordinates calibrated in the Verification Gate — each
comment records the expected Pass-1 / Pass-2 behavior):

```python
class TestTwoPassEndToEnd:
    """Full OpeningSymbolPipeline.run() on synthetic scans with known ground truth."""

    def _results(self, scan):
        return OpeningSymbolPipeline().run(scan, search_layers={"A-WIND"})

    def _styles(self, result):
        return [m.style for m in result.classification.matches]

    def test_paired_windows_stay_two(self):
        # Two complete SLIDING symbols 2500mm apart. Each classifies confidently (>=0.4)
        # → complete → never a merge-graph node → 2 final candidates.
        scan = _scan(
            _line("A1", 0, 0, 2000, 0), _line("A2", 0, 50, 2000, 50), _line("A3", 0, 25, 2000, 25),
            _line("B1", 2500, 0, 4500, 0), _line("B2", 2500, 50, 4500, 50), _line("B3", 2500, 25, 4500, 25),
        )
        results = self._results(scan)
        assert len(results) == 2
        for r in results:
            assert WindowStyle.SLIDING in self._styles(r)

    def test_fragmented_single_reassembles_to_one(self):
        # A SLIDING symbol split into a 2-line frame group {L1,L2} (centroid 200,25) and
        # a lone center line {L3} (centroid 650,25). Pass 1 (>200mm) splits them; each
        # half alone has no style match → confidence ~0.36 (<0.4) → both incomplete.
        # L3 is sparse → sparse-touch: its endpoint (450,25) is 50mm from the frame bbox
        # (0,0,400,50) → merge. Combined = SLIDING → accept (beats 0.36). → 1 candidate.
        scan = _scan(
            _line("L1", 0, 0, 400, 0),
            _line("L2", 0, 50, 400, 50),
            _line("L3", 450, 25, 850, 25),
        )
        results = self._results(scan)
        assert len(results) == 1
        assert WindowStyle.SLIDING in self._styles(results[0])

    def test_corner_windows_stay_two(self):
        # x-aligned pair {L1,L2} (axis x) and y-aligned pair {L3,L4} (axis y), centroids
        # ~348mm apart (within 500mm). Both incomplete, but PCA axes differ by 90° >
        # 15° → standard rule rejects → 2 candidates (no merge).
        scan = _scan(
            _line("L1", 0, 0, 400, 0), _line("L2", 0, 50, 400, 50),
            _line("L3", 500, 0, 500, 300), _line("L4", 550, 0, 550, 300),
        )
        results = self._results(scan)
        assert len(results) == 2  # collinearity blocks the merge

    def test_far_stray_line_stays_separate(self):
        # Incomplete pair {L1,L2} and a sparse stray line 750mm above it. Sparse-touch
        # distance (750mm) > 75mm tolerance → no merge → 2 candidates.
        scan = _scan(
            _line("L1", 0, 0, 400, 0), _line("L2", 0, 50, 400, 50),
            _line("L3", 200, 800, 600, 800),
        )
        results = self._results(scan)
        assert len(results) == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pytest tests/test_opening_pipeline_two_pass.py::TestTwoPassEndToEnd -v`
Expected: FAIL — currently `run()` does no Pass-2 merge, so `fragmented_single` yields 2
(not 1); the others may already pass since the old single-pass flow with the new 200mm
radius happens to leave them at 2. The `fragmented_single` assertion is the pinning
failure.

- [ ] **Step 3: Refactor `run()` into `_classify_once` + `_two_pass_merge`**

In `opening_pipeline.py`, replace the body of `run()` (currently lines ~125-153) with
this structure (keep the exact same signature and docstring; only change the body and add
two new methods):

```python
    def run(self, scan_result, search_layers=None, *, layer_confidence=1.0,
            block_confidence=0.0, geometry_quality=0.8):
        # (keep the existing signature, docstring, and the `candidates = ...detect(...)` line)
        candidates = self._detector.detect(scan_result, search_layers)
        if not candidates:
            return []

        # Pass 1.5 — classify each Pass-1 sub-cluster through the unchanged stages.
        per_candidate: list[tuple[OpeningCandidate, OpeningPipelineResult]] = []
        for candidate in candidates:
            result = self._classify_once(
                candidate, layer_confidence, block_confidence, geometry_quality
            )
            per_candidate.append((candidate, result))

        # Pass 2 — confidence-guided, order-independent re-merge.
        return self._two_pass_merge(
            per_candidate, layer_confidence, block_confidence, geometry_quality
        )

    def _classify_once(self, candidate, layer_confidence, block_confidence,
                       geometry_quality) -> OpeningPipelineResult:
        """Run Evidence → Features → Classifier → Confidence on one candidate. Factored
        out of run() so Pass 2 can re-run it on merged geometry unchanged."""
        evidence = self._evidence_extractor.extract(candidate)
        features = self._feature_extractor.extract(evidence, candidate)
        classification = self._classifier.classify(features)
        rule_score = (
            classification.matches[0].score if classification.matches else 0.0
        )
        final_confidence = self._fuser.fuse(ConfidenceInputs(
            rule_score=rule_score,
            geometry_quality=geometry_quality,
            layer_confidence=layer_confidence,
            block_confidence=block_confidence,
        ))
        return OpeningPipelineResult(
            candidate=candidate, evidence=evidence, features=features,
            classification=classification, final_confidence=final_confidence,
        )

    def _two_pass_merge(self, per_candidate, layer_confidence, block_confidence,
                        geometry_quality) -> list[OpeningPipelineResult]:
        """Pass 2: build a merge-eligibility graph over incomplete sub-clusters, take
        connected components (order-independent batch merge), re-classify each merged
        component, and roll it back only when it would make confidence worse than the best
        original (a tie or improvement accepts the merge)."""
        n = len(per_candidate)
        complete = {i for i, (_, r) in enumerate(per_candidate)
                    if r.final_confidence >= _SUBCLUSTER_COMPLETE_CONFIDENCE}
        incomplete = [i for i in range(n) if i not in complete]

        # Union-Find over incomplete nodes only.
        parent = list(range(n))

        def find(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for ii in range(len(incomplete)):
            for jj in range(ii + 1, len(incomplete)):
                a, b = incomplete[ii], incomplete[jj]
                if _merge_eligible(per_candidate[a][0], per_candidate[b][0]):
                    union(a, b)

        components: dict[int, list[int]] = {}
        for i in incomplete:
            components.setdefault(find(i), []).append(i)

        results: list[OpeningPipelineResult] = []
        # Complete sub-clusters pass through unchanged — they are never merge nodes.
        for i in sorted(complete):
            results.append(per_candidate[i][1])

        for members in components.values():
            if len(members) == 1:
                results.append(per_candidate[members[0]][1])
                continue
            merged_cand = self._merge_candidates([per_candidate[m][0] for m in members])
            merged_result = self._classify_once(
                merged_cand, layer_confidence, block_confidence, geometry_quality
            )
            best_original = max(per_candidate[m][1].final_confidence for m in members)
            if merged_result.final_confidence >= best_original:
                results.append(merged_result)          # merge helped or tied → keep it
            else:
                for m in members:                      # rollback → keep originals
                    results.append(per_candidate[m][1])
        return results
```

Keep the original `for candidate in candidates:` loop's *body* out of `run()` — it is now
`_classify_once`. Do not change `OpeningPipelineResult` or any stage class.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: PASS (all classes, including all 4 end-to-end cases).

If `test_fragmented_single_reassembles_to_one` fails because the merged 3-line set does
not classify as SLIDING, the most likely cause is `OpeningFeatureExtractor`'s
center-line / parallel heuristic not firing for the `L3` center at x=450..850 (it sits
between the L1(y=0)/L2(y=50) frame lines but is offset in x). Adjust the **fixture**
coordinates only (e.g. extend L3's x-range or nudge it under the frame span so the
feature extractor recognizes the center line) — do NOT change production classifier
behavior to satisfy a synthetic fixture. Record the final coordinates in the test
comment. The gate prototype confirmed a reassembling configuration exists at these
constants.

- [ ] **Checkpoint (no commit):** all green.

---

### Task 5: Golden end-to-end regression (closes the latent coverage gap)

**Files:**
- Test: `tests/test_opening_pipeline_two_pass.py`

The existing `tests/test_window_pipeline.py::test_golden_classification` builds
`OpeningCandidate`s directly and **bypasses `OpeningSymbolDetector`**, so it never
exercised clustering — the gap the Verification Gate surfaced (awning_01's diagonal brace
is structurally unclusterable by the shipped single-pass code, which is why that test
passed for the wrong reason). This task adds a true end-to-end golden regression through
the full `OpeningSymbolPipeline.run()`.

- [ ] **Step 1: Write the failing test**

Append:

```python
def _scan_from_geometry(geom):
    """golden geometry.json → _FakeScanResult (full detector path)."""
    entries = []
    for ln in geom.get("lines", []):
        entries.append(_FakeEntry(
            "A-WIND", "AcDbLine", handle=ln["handle"],
            start=tuple(ln["start"]), end=tuple(ln["end"]),
            length=float(ln.get("length", 2000.0)),
        ))
    for a in geom.get("arcs", []):
        entries.append(_FakeEntry(
            "A-WIND", "AcDbArc", handle=a["handle"],
            center=tuple(a["center"]), radius=float(a["radius"]),
            start_angle=float(a["start_angle"]), end_angle=float(a["end_angle"]),
        ))
    for p in geom.get("closed_polylines", []):
        entries.append(_FakeEntry(
            "A-WIND", "AcDbPolyline", handle=p["handle"],
            coordinates=list(p["coordinates"]), is_closed=p.get("is_closed", True),
        ))
    return _FakeScanResult(entries)


def _golden_cases():
    if not GOLDEN_DIR.exists():
        return []
    out = []
    for case_dir in sorted(GOLDEN_DIR.iterdir()):
        geom_file = case_dir / "geometry.json"
        if geom_file.is_file():
            with open(geom_file, "r", encoding="utf-8") as f:
                geom = json.load(f)
            style = geom.get("style", "")
            if style:
                out.append((case_dir.name, geom, style))
    return out


_STYLE_ENUM = {
    "sliding": WindowStyle.SLIDING, "fixed": WindowStyle.FIXED,
    "casement": WindowStyle.CASEMENT, "awning": WindowStyle.AWNING,
}


@pytest.mark.parametrize(
    "name,geom,expected_style", _golden_cases(), ids=[c[0] for c in _golden_cases()]
)
class TestGoldenEndToEnd:
    def test_one_candidate_correctly_classified(self, name, geom, expected_style):
        """Each golden fixture must produce exactly 1 candidate through the FULL
        two-pass pipeline (detector + Pass 2), classified as its expected style.
        awning_01 is the critical sparse-node case: its diagonal brace line must
        touch-merge back into the frame via the sparse rule."""
        results = OpeningSymbolPipeline().run(_scan_from_geometry(geom),
                                              search_layers={"A-WIND"})
        assert len(results) == 1, f"{name}: expected 1 candidate, got {len(results)}"
        expected = _STYLE_ENUM[expected_style]
        styles = [m.style for m in results[0].classification.matches]
        assert expected in styles, (
            f"{name}: expected {expected.value} in {[s.value for s in styles]}"
        )
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pytest tests/test_opening_pipeline_two_pass.py::TestGoldenEndToEnd -v`
Expected: PASS (5 cases: sliding_01, fixed_01, casement_01, awning_01, balcony_assembly_01).

If `awning_01` fails to reach 1 candidate, the sparse-node rule is not firing — re-check
`_sparse_eligible` against the bbox of the `{L6,L7}` frame ((0,0,2000,50)) and the L8
endpoint (0,0) (touch distance must compute to 0). If `balcony_assembly_01` splits into 2,
its 240mm y-spread chain (L1↔L4 = 240mm directly) relies on Union-Find transitivity
through L1↔L2↔L3↔L4 — confirm Pass 1 yields 1 cluster; if it splits, Pass 2's standard
rule must re-merge the two horizontal groups (they are collinear and within 500mm).

- [ ] **Step 3: Re-run the legacy golden test to confirm it still passes too**

Run: `pytest tests/test_window_pipeline.py -v`
Expected: PASS unchanged (it bypasses the detector, so the two-pass change is invisible
to it — but confirming it stays green guards against accidental signature drift).

- [ ] **Checkpoint (no commit):** all green.

---

### Task 6: Broad regression and `/sync`

**Files:** none (verification + commit only).

- [ ] **Step 1: Run the full opening/window test surface**

```
pytest tests/test_opening_pipeline_two_pass.py tests/test_opening_detector.py \
       tests/test_opening_evidence.py tests/test_window_pipeline.py \
       tests/handlers/test_extract_cad_objects_window_pipeline_v3.py -v
```
Expected: all PASS. The handler test
(`test_extract_cad_objects_window_pipeline_v3.py`) exercises the live `_build_windows_v3`
path that calls `OpeningSymbolPipeline().run()` — if it constructs a multi-window scan,
it confirms the end-to-end handler path still emits the right window count after the
radius change.

- [ ] **Step 2: Run the full test suite to catch any non-obvious caller**

```
pytest tests/ -q
```
Expected: all PASS (or only pre-existing failures unrelated to opening clustering —
investigate any failure that names `opening_detector` / `opening_pipeline` / `_CLUSTER_PROXIMITY_MM`).

- [ ] **Step 3: Update CHANGELOG and commit via `/sync`**

Per the Commit Policy, do NOT run `git commit` directly. Run:

```
/changelog "fix(cad_intelligence): confidence-guided two-pass opening clustering — tight 200mm Pass-1 radius + order-independent Pass-2 re-merge with PCA collinearity, sparse-node touch-distance, and merge rollback; stops two pier-separated windows merging into one candidate without fragmenting single symbols"
```

then:

```
/sync "fix(cad_intelligence): confidence-guided two-pass opening clustering"
```

`/sync` stages CHANGELOG, runs the audit gate, commits, pushes, and opens the PR on the
current `feat/window-symbol-recognition` branch. Confirm the PR opens against `main` with
an English title/body (required).

- [ ] **Step 4: Record the outcome**

Append a short note to `memory/2026-08-05.md` (today's session log) recording: the
two-pass clustering fix shipped, all 9 fixtures (4 synthetic + 5 golden) green, and the
PR URL from `/sync`. This closes Backlog item #13.

---

## Notes for the implementer

- **Do not** modify `OpeningSymbolDetector`'s logic, `WindowClassifier`,
  `ConfidenceFuser`, `OpeningEvidenceExtractor`, `OpeningFeatureExtractor`, or
  `OpeningPipelineResult` — the design's Non-Goals. Pass 2 only changes *when* and
  *what* gets fed into those unchanged stages. The only detector edit is the constant
  value on line 96.
- **Do not** add wall-axis / wall-segment input to the detector or pipeline — confirmed
  out of scope (pure-geometry fix). The sparse-node touch-distance rule is the
  orientation-agnostic substitute for the wall-context signal.
- **Order-independence is the point of the merge graph.** Do NOT collapse Pass 2 back
  into a pairwise-greedy loop — the A–B–C chain case is exactly where greedy diverges.
  Connected components over the eligibility graph is load-bearing.
- **Rollback is load-bearing too.** A merge that would make confidence worse than
  `max(original)` must emit the originals; otherwise combining mismatched evidence would silently produce
  lower-quality candidates than Pass 1.5 already had.
- **Reuse, don't duplicate, candidate construction.** `_merge_candidates` must call
  `self._detector._build_candidate(...)` so bbox/signature/summary stay consistent with
  Pass 1. Do not hand-roll a parallel candidate builder.
- The five constants are **confirmed by the Verification Gate**, not candidate values —
  do not re-sweep them as part of this implementation. If a test fails, fix the test or
  the production *logic*, not the constants (escalate to the user before changing any
  constant, per the spec's gate-promise).
- The `com_bridge.py` references to `OpeningSymbolPipeline` (lines ~42, 5414, 7058-7191)
  are the confirmed **dead path** (ADR-010 registry-first dispatch); the live path is
  `handlers/space.py:_build_windows_v3` (~line 2302). Do not edit `com_bridge.py`.
