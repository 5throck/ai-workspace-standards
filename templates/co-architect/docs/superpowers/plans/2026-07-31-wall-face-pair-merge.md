---
lang: ko
lang_reason: proper-noun
---

# Wall-Face-Pair Pre-Merge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pre-processing step to the v2 wall-processing pipeline that recognizes
pairs of near-parallel, closely-spaced wall lines as the two faces of one physical
wall and replaces each pair with a single centerline, before endpoint welding runs —
so `_weld_endpoints_v2` never sees two faces of a thin wall as independently
clusterable points and can no longer weld them together incorrectly.

**Architecture:** One new pure-function pipeline step, `_merge_wall_face_pairs`, added
to `src/cad_intelligence/geometry/space_geometry.py` and wired into
`_build_space_polygons` behind the existing `WALL_PROCESSING_MODE ==
ENDPOINT_CLUSTER` flag. No existing function is modified — `_weld_endpoints_v2`,
`_cluster_endpoints`, and the LEGACY (v1) path are all untouched.

**Tech Stack:** Python, `shapely` (`LineString`, `STRtree`, `Point`), existing
`_segment_angle_deg` helper from `axis_grid.py`.

---

## Reference

Spec: `docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md` (read this
first — it has the full rationale, the minimal-repro coordinates, and the exact
matching/tie-break/cap-removal rules this plan implements).

Minimal repro coordinates (used throughout testing, from the spec's Problem section):

```python
L_157F = LineString([(18136, 19381), (18136, 17706)])  # face A, 1675mm
L_15EC = LineString([(18226, 17706), (18226, 19381)])  # face B, 1675mm
L_15ED = LineString([(18226, 19381), (18136, 19381)])  # cap at one end, 90mm
```

---

### Task 1: New constants

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py:159` (immediately after
  `WALL_PAIR_TOL`'s definition and docstring comment)

- [ ] **Step 1: Add the three new constants**

Insert immediately after the existing `WALL_PAIR_TOL: float = 50.0` block (around
line 159, before the `MIN_SPACE_AREA_MM2` constant):

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
#: OTHER?" (a pairwise, relative question). Drafting error between two
#: faces of the same physical wall is expected to be small, so 5.0 is
#: chosen independently as a tight pairwise tolerance.
WALL_FACE_PARALLEL_TOLERANCE_DEG: float = 5.0
```

- [ ] **Step 2: Verify the module still imports cleanly**

Run: `python -c "from cad_intelligence.geometry import space_geometry"` (from
`src/`, or via `python -c "import sys; sys.path.insert(0,'src'); from
cad_intelligence.geometry import space_geometry"` from the repo root)
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py
git commit -m "feat(geometry): add wall-face-pair matching constants"
```

---

### Task 2: Geometry helpers (angle diff, perpendicular distance + overlap ratio)

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (add new private
  functions right before `_weld_endpoints_v1`, i.e. after the "Step 2: endpoint
  welding" section header, around line 469 — before `_weld_endpoints_v1`)
- Test: `tests/test_space_geometry.py` (new `TestWallFaceGeometryHelpers` class;
  add near the existing `TestFindGaps`/`TestClusterEndpoints` classes)

These are small, independently-testable geometry primitives used by
`_merge_wall_face_pairs` (Task 3). `_segment_angle_deg` already exists in
`axis_grid.py` and is already imported into `space_geometry.py` — reuse it, don't
redefine it.

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_space_geometry.py`:

```python
class TestWallFaceGeometryHelpers(unittest.TestCase):
    def test_angle_diff_parallel_lines_is_zero(self):
        from cad_intelligence.geometry.space_geometry import _angle_diff_deg
        self.assertAlmostEqual(_angle_diff_deg(90.0, 90.0), 0.0)

    def test_angle_diff_wraps_around_180(self):
        # 179 deg and 2 deg are only 3 deg apart (near the 0/180 seam)
        from cad_intelligence.geometry.space_geometry import _angle_diff_deg
        self.assertAlmostEqual(_angle_diff_deg(179.0, 2.0), 3.0)

    def test_perp_distance_and_overlap_full_overlap(self):
        from cad_intelligence.geometry.space_geometry import (
            _perp_distance_and_overlap,
        )
        a = LineString([(18136, 19381), (18136, 17706)])  # 157F
        b = LineString([(18226, 17706), (18226, 19381)])  # 15EC
        dist, overlap = _perp_distance_and_overlap(a, b)
        self.assertAlmostEqual(dist, 90.0, places=1)
        self.assertAlmostEqual(overlap, 1.0, places=2)

    def test_perp_distance_and_overlap_no_overlap(self):
        from cad_intelligence.geometry.space_geometry import (
            _perp_distance_and_overlap,
        )
        a = LineString([(0, 0), (0, 1000)])
        b = LineString([(90, 2000), (90, 3000)])  # parallel, but far away in Y
        dist, overlap = _perp_distance_and_overlap(a, b)
        self.assertAlmostEqual(overlap, 0.0, places=2)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestWallFaceGeometryHelpers -v`
Expected: FAIL — `ImportError` / `AttributeError` (`_angle_diff_deg`,
`_perp_distance_and_overlap` don't exist yet).

- [ ] **Step 3: Implement the helpers**

Add to `space_geometry.py`, right before the `_weld_endpoints_v1` function
(after the "Step 2: endpoint welding" section comment, around line 469):

```python
# ---------------------------------------------------------------------------
# Step 1d: wall-face-pair pre-merge (before endpoint welding) — see
# _merge_wall_face_pairs below and docs/superpowers/specs/
# 2026-07-31-wall-face-pair-merge-design.md for the full rationale.
# ---------------------------------------------------------------------------


def _angle_diff_deg(a: float, b: float) -> float:
    """Smallest angular difference (degrees) between two 0-180 line
    angles (as returned by ``_segment_angle_deg``), correctly handling
    wraparound at the 0/180 seam (e.g. 179 and 2 are 3 degrees apart,
    not 177)."""
    d = abs(a - b) % 180.0
    return min(d, 180.0 - d)


def _line_direction_unit(line: LineString) -> tuple[float, float]:
    """Unit vector along ``line``'s start->end direction."""
    coords = list(line.coords)
    dx = coords[-1][0] - coords[0][0]
    dy = coords[-1][1] - coords[0][1]
    length = math.hypot(dx, dy)
    return (dx / length, dy / length)


def _perp_distance_and_overlap(a: LineString, b: LineString) -> tuple[float, float]:
    """Perpendicular distance and projected-overlap ratio between two
    near-parallel segments ``a`` and ``b``.

    Uses ``a``'s own direction as the shared projection axis (valid
    because callers only invoke this after an angle-parallel check
    has already passed, so it doesn't matter which of the two nearly-
    identical directions is used as the reference).

    Returns
    -------
    tuple[float, float]
        (perpendicular_distance_mm, overlap_ratio) where overlap_ratio
        is the overlapping projected interval length divided by the
        SHORTER segment's own projected length (0.0 if there is no
        overlap or either segment has zero projected length).
    """
    a_coords = list(a.coords)
    ax0, ay0 = a_coords[0]
    ux, uy = _line_direction_unit(a)
    nx, ny = -uy, ux  # unit normal to a

    def project(pt: tuple[float, float]) -> tuple[float, float]:
        dx, dy = pt[0] - ax0, pt[1] - ay0
        return dx * ux + dy * uy, dx * nx + dy * ny  # (along, perp)

    a_along = [project(p)[0] for p in a_coords]
    b_proj = [project(p) for p in b.coords]
    b_along = [p[0] for p in b_proj]
    b_perp = [p[1] for p in b_proj]

    perp_distance = sum(abs(v) for v in b_perp) / len(b_perp)

    a_lo, a_hi = min(a_along), max(a_along)
    b_lo, b_hi = min(b_along), max(b_along)
    overlap_lo, overlap_hi = max(a_lo, b_lo), min(a_hi, b_hi)
    overlap_len = max(0.0, overlap_hi - overlap_lo)

    shorter_len = min(a_hi - a_lo, b_hi - b_lo)
    overlap_ratio = overlap_len / shorter_len if shorter_len > 0 else 0.0

    return perp_distance, overlap_ratio
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestWallFaceGeometryHelpers -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): add wall-face pairwise angle/distance/overlap helpers"
```

---

### Task 3: Candidate matching — mutual-best with tie-break

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (add
  `_find_mutual_best_pairs` right after the Task 2 helpers)
- Test: `tests/test_space_geometry.py` (new `TestFindMutualBestPairs` class)

This isolates the matching logic (candidate discovery + mutual-best + tie-break)
from centerline computation and cap removal (Task 4), so the starvation and
tie-break scenarios from the spec can be tested directly against index pairs
without needing to also verify centerline geometry in the same test.

- [ ] **Step 1: Write the failing tests**

```python
class TestFindMutualBestPairs(unittest.TestCase):
    def test_minimal_repro_pairs_157f_15ec(self):
        from cad_intelligence.geometry.space_geometry import (
            _find_mutual_best_pairs,
        )
        lines = [
            LineString([(18136, 19381), (18136, 17706)]),  # 0: 157F
            LineString([(18226, 17706), (18226, 19381)]),  # 1: 15EC
            LineString([(18226, 19381), (18136, 19381)]),  # 2: 15ED (cap)
        ]
        pairs = _find_mutual_best_pairs(lines, 250.0, 0.5, 5.0)
        self.assertEqual(pairs, [(0, 1)])

    def test_starvation_scenario_b_prefers_closer_c(self):
        from cad_intelligence.geometry.space_geometry import (
            _find_mutual_best_pairs,
        )
        # A/B: true wall-face pair, 90mm apart, full overlap.
        # C: unrelated line, parallel to B, only 5mm away, full overlap with B.
        a = LineString([(0, 0), (0, 1000)])
        b = LineString([(90, 0), (90, 1000)])
        c = LineString([(95, 0), (95, 1000)])
        pairs = _find_mutual_best_pairs([a, b, c], 250.0, 0.5, 5.0)
        self.assertEqual(pairs, [(1, 2)])  # (B, C) matched; A unmatched

    def test_tie_break_prefers_smaller_angle_diff(self):
        from cad_intelligence.geometry.space_geometry import (
            _find_mutual_best_pairs,
        )
        # a's two candidates b1/b2 are at the SAME perpendicular
        # distance (100mm) but b1 is perfectly parallel to a while b2
        # is angled slightly — b1 must win.
        a = LineString([(0, 0), (0, 1000)])
        b1 = LineString([(100, 0), (100, 1000)])  # perfectly parallel, dist=100
        b2 = LineString([(-100, 0), (-97, 1000)])  # ~0.17deg off, dist~=100 avg
        pairs = _find_mutual_best_pairs([a, b1, b2], 250.0, 0.5, 5.0)
        self.assertIn((0, 1), pairs)
        self.assertNotIn((0, 2), pairs)

    def test_no_candidates_returns_empty(self):
        from cad_intelligence.geometry.space_geometry import (
            _find_mutual_best_pairs,
        )
        a = LineString([(0, 0), (0, 1000)])
        b = LineString([(1000, 0), (1000, 1000)])  # far away, no pair
        pairs = _find_mutual_best_pairs([a, b], 250.0, 0.5, 5.0)
        self.assertEqual(pairs, [])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestFindMutualBestPairs -v`
Expected: FAIL — `_find_mutual_best_pairs` doesn't exist yet.

- [ ] **Step 3: Implement `_find_mutual_best_pairs`**

Add to `space_geometry.py`, right after `_perp_distance_and_overlap`:

```python
def _find_mutual_best_pairs(
    lines: list[LineString],
    max_thickness: float,
    min_overlap_ratio: float,
    parallel_tol_deg: float,
) -> list[tuple[int, int]]:
    """Find index pairs that are each other's single best wall-face
    match (mutual-best matching with a deterministic tie-break).

    A candidate pair (i, j) must pass all three checks: parallel
    (angle diff <= parallel_tol_deg), close (perpendicular distance
    <= max_thickness), and overlapping (projected overlap ratio >=
    min_overlap_ratio). Among a line's valid candidates, its "best" is
    the one with lowest (perp_distance, angle_diff, -overlap_ratio,
    candidate_index) — this tuple ordering IS the tie-break chain
    (distance first, then angle, then overlap, then a deterministic
    index fallback). A pair is accepted only if each line is the
    other's best candidate (prevents a closer-but-unrelated line from
    "starving" a line's true partner — see design spec Testing item 5).

    Returns a list of (i, j) index pairs with i < j, each index
    appearing in at most one pair.
    """
    n = len(lines)
    if n < 2:
        return []

    angles = [
        _segment_angle_deg(list(line.coords)[0], list(line.coords)[-1])
        for line in lines
    ]

    tree = STRtree(lines)
    # candidates[i]: list of (perp_dist, angle_diff, -overlap_ratio, j)
    candidates: dict[int, list[tuple[float, float, float, int]]] = {
        i: [] for i in range(n)
    }
    checked: set[tuple[int, int]] = set()

    for i, line in enumerate(lines):
        nearby = tree.query(line.buffer(max_thickness))
        for raw_j in nearby:
            j = int(raw_j)
            if j == i:
                continue
            key = (min(i, j), max(i, j))
            if key in checked:
                continue
            checked.add(key)

            angle_diff = _angle_diff_deg(angles[i], angles[j])
            if angle_diff > parallel_tol_deg:
                continue

            perp_dist, overlap_ratio = _perp_distance_and_overlap(lines[i], lines[j])
            if perp_dist > max_thickness or overlap_ratio < min_overlap_ratio:
                continue

            candidates[i].append((perp_dist, angle_diff, -overlap_ratio, j))
            candidates[j].append((perp_dist, angle_diff, -overlap_ratio, i))

    def best_of(idx: int) -> int | None:
        opts = candidates.get(idx)
        if not opts:
            return None
        return min(opts)[-1]

    matched: set[int] = set()
    pairs: list[tuple[int, int]] = []
    for i in range(n):
        if i in matched:
            continue
        b = best_of(i)
        if b is None or b in matched:
            continue
        if best_of(b) == i:
            matched.add(i)
            matched.add(b)
            pairs.append((min(i, b), max(i, b)))

    return pairs
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestFindMutualBestPairs -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): add mutual-best wall-face-pair matching"
```

---

### Task 4: Centerline computation + cap-segment removal + `_merge_wall_face_pairs`

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (add
  `_compute_centerline`, `_remove_cap_segments`, and the public
  `_merge_wall_face_pairs` entry point)
- Test: `tests/test_space_geometry.py` (new `TestMergeWallFacePairs` class —
  covers spec Testing items 1-4 and 6-7 for this module; items 5 and part of 6
  are already covered by Task 3's tests at the pairing level)

- [ ] **Step 1: Write the failing tests**

```python
class TestMergeWallFacePairs(unittest.TestCase):
    def test_minimal_repro_merges_and_drops_cap(self):
        from cad_intelligence.geometry.space_geometry import _merge_wall_face_pairs
        lines = [
            LineString([(18136, 19381), (18136, 17706)]),  # 157F
            LineString([(18226, 17706), (18226, 19381)]),  # 15EC
            LineString([(18226, 19381), (18136, 19381)]),  # 15ED (cap)
        ]
        result = _merge_wall_face_pairs(lines, 250.0, 0.5)
        self.assertEqual(len(result), 1)
        self.assertAlmostEqual(result[0].length, 1675.0, delta=1.0)

    def test_overlap_rejection_no_merge(self):
        from cad_intelligence.geometry.space_geometry import _merge_wall_face_pairs
        # Parallel, within thickness, but essentially no projected overlap.
        a = LineString([(0, 0), (0, 100)])
        b = LineString([(90, 5000), (90, 5100)])
        result = _merge_wall_face_pairs([a, b], 250.0, 0.5)
        self.assertEqual(len(result), 2)

    def test_angle_rejection_no_merge(self):
        from cad_intelligence.geometry.space_geometry import _merge_wall_face_pairs
        a = LineString([(0, 0), (0, 1000)])       # vertical
        b = LineString([(0, 100), (1000, 100)])   # horizontal, close by
        result = _merge_wall_face_pairs([a, b], 250.0, 0.5)
        self.assertEqual(len(result), 2)

    def test_distance_rejection_no_merge(self):
        from cad_intelligence.geometry.space_geometry import _merge_wall_face_pairs
        a = LineString([(0, 0), (0, 1000)])
        b = LineString([(400, 0), (400, 1000)])  # 400mm > 250mm cap
        result = _merge_wall_face_pairs([a, b], 250.0, 0.5)
        self.assertEqual(len(result), 2)

    def test_unmatched_stub_wall_not_removed_as_cap(self):
        """A short stub wall abutting only ONE face of a merged pair
        must survive (regression for the tightened cap-removal rule —
        see spec Revision 2, issue 2)."""
        from cad_intelligence.geometry.space_geometry import _merge_wall_face_pairs
        face_a = LineString([(0, 0), (0, 2000)])
        face_b = LineString([(90, 0), (90, 2000)])
        # Stub wall: both its endpoints are near face_a only (a closet
        # partition abutting one face), never touches face_b.
        stub = LineString([(0, 1000), (-500, 1000)])
        result = _merge_wall_face_pairs([face_a, face_b, stub], 250.0, 0.5)
        # 1 centerline (face_a+face_b merged) + the stub, unmodified.
        self.assertEqual(len(result), 2)
        lengths = sorted(round(l.length) for l in result)
        self.assertIn(500, lengths)  # the stub survived at its own length
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestMergeWallFacePairs -v`
Expected: FAIL — `_merge_wall_face_pairs` doesn't exist yet.

- [ ] **Step 3: Implement centerline computation, cap removal, and the entry point**

Add to `space_geometry.py`, right after `_find_mutual_best_pairs`:

```python
def _compute_centerline(a: LineString, b: LineString) -> LineString:
    """Centerline of a matched wall-face pair: the midline of the two
    faces' overlapping projected interval, at the perpendicular
    midpoint between them. Uses ``a``'s direction as the reference
    axis (see _perp_distance_and_overlap for why this is valid here).
    """
    a_coords = list(a.coords)
    ax0, ay0 = a_coords[0]
    ux, uy = _line_direction_unit(a)
    nx, ny = -uy, ux

    def project(pt: tuple[float, float]) -> tuple[float, float]:
        dx, dy = pt[0] - ax0, pt[1] - ay0
        return dx * ux + dy * uy, dx * nx + dy * ny

    a_along = [project(p)[0] for p in a_coords]
    b_proj = [project(p) for p in b.coords]
    b_along = [p[0] for p in b_proj]
    b_perp_avg = sum(p[1] for p in b_proj) / len(b_proj)

    lo = max(min(a_along), min(b_along))
    hi = min(max(a_along), max(b_along))
    mid_perp = b_perp_avg / 2.0  # a's own perpendicular offset is 0

    def unproject(along: float, perp: float) -> tuple[float, float]:
        return (ax0 + ux * along + nx * perp, ay0 + uy * along + ny * perp)

    return LineString([unproject(lo, mid_perp), unproject(hi, mid_perp)])


def _remove_cap_segments(
    passthrough_lines: list[tuple[int, LineString]],
    original_lines: list[LineString],
    accepted_pairs: list[tuple[int, int]],
    max_thickness: float,
) -> list[LineString]:
    """Drop any unmatched original line that connects the two faces of
    an accepted pair (a short capping segment like 15ED). A line
    qualifies for removal only if one of its endpoints is near face
    `a` AND its other endpoint is near face `b`, for some accepted
    pair (a, b) — one endpoint per face, not both near one face (see
    design spec §"Cap-segment removal" for why this precise rule
    matters — a looser rule would delete legitimate stub walls).
    """
    if not accepted_pairs:
        return [line for _, line in passthrough_lines]

    faces = [
        (original_lines[i], original_lines[j]) for i, j in accepted_pairs
    ]

    def near(pt: tuple[float, float], face: LineString) -> bool:
        return ShapelyPoint(pt).distance(face) <= max_thickness

    result: list[LineString] = []
    for _, line in passthrough_lines:
        coords = list(line.coords)
        p0, p1 = coords[0], coords[-1]
        if line.length > max_thickness:
            result.append(line)
            continue
        is_cap = False
        for face_a, face_b in faces:
            near_a0, near_b0 = near(p0, face_a), near(p0, face_b)
            near_a1, near_b1 = near(p1, face_a), near(p1, face_b)
            one_per_face = (near_a0 and near_b1) or (near_b0 and near_a1)
            if one_per_face:
                is_cap = True
                break
        if not is_cap:
            result.append(line)
    return result


def _merge_wall_face_pairs(
    lines: list[LineString],
    max_thickness: float = WALL_FACE_MAX_THICKNESS,
    min_overlap_ratio: float = WALL_FACE_MIN_OVERLAP_RATIO,
) -> list[LineString]:
    """Pre-merge pairs of near-parallel, closely-spaced, overlapping
    line segments (the two faces of one physical wall) into a single
    centerline, before endpoint welding runs.

    See docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md
    for full rationale: this exists because endpoint welding
    (_weld_endpoints_v2) cannot distinguish "two points that are the
    same corner" from "two points that are two faces of a thin wall"
    using proximity alone. Recognizing wall-face pairs BEFORE welding
    removes the ambiguity at its source instead of trying to filter
    bad welds after the fact (three prior attempts at the latter all
    failed — see the ABANDONED weld-endpoints-self-chaining spec).
    """
    n = len(lines)
    if n < 2:
        return list(lines)

    pairs = _find_mutual_best_pairs(
        lines, max_thickness, min_overlap_ratio, WALL_FACE_PARALLEL_TOLERANCE_DEG
    )

    merged: list[LineString] = [
        _compute_centerline(lines[i], lines[j]) for i, j in pairs
    ]

    matched_indices = {idx for pair in pairs for idx in pair}
    passthrough = [
        (i, line) for i, line in enumerate(lines) if i not in matched_indices
    ]
    passthrough_lines = _remove_cap_segments(passthrough, lines, pairs, max_thickness)

    return merged + passthrough_lines
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestMergeWallFacePairs -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): implement _merge_wall_face_pairs (centerline + cap removal)"
```

---

### Task 5: Pipeline integration (gated on `WALL_PROCESSING_MODE`)

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py:1845-1853`
  (inside `_build_space_polygons`)
- Test: `tests/test_space_geometry.py` (extend `TestMergeWallFacePairs` with an
  integration-level test)

- [ ] **Step 1: Write the failing test**

Add to `TestMergeWallFacePairs`:

```python
    def test_build_space_polygons_closes_previously_unclosed_wall(self):
        """End-to-end: feeding the minimal-repro thin-wall case (plus
        two bounding walls to actually close a room) into
        _build_space_polygons must now produce >= 1 polygon, where the
        pre-fix pipeline produced 0 (see the referenced ABANDONED spec)."""
        from cad_intelligence.common.models import WallSegment
        from cad_intelligence.geometry.space_geometry import _build_space_polygons

        segs = [
            WallSegment(handle="157F", layer="3SEC", start=(18136, 19381), end=(18136, 17706), length=1675, thickness=None),
            WallSegment(handle="15EC", layer="3SEC", start=(18226, 17706), end=(18226, 19381), length=1675, thickness=None),
            WallSegment(handle="15ED", layer="3SEC", start=(18226, 19381), end=(18136, 19381), length=90, thickness=None),
            # Bounding walls to close a room using the merged centerline
            # (x~18181) as one side.
            WallSegment(handle="north", layer="3SEC", start=(18181, 17706), end=(20181, 17706), length=2000, thickness=None),
            WallSegment(handle="east", layer="3SEC", start=(20181, 17706), end=(20181, 19381), length=1675, thickness=None),
            WallSegment(handle="south", layer="3SEC", start=(20181, 19381), end=(18181, 19381), length=2000, thickness=None),
        ]
        polygons, exceptions = _build_space_polygons(segs, [])
        self.assertGreaterEqual(len(polygons), 1)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest "tests/test_space_geometry.py::TestMergeWallFacePairs::test_build_space_polygons_closes_previously_unclosed_wall" -v`
Expected: FAIL — `assertGreaterEqual(0, 1)` (the pipeline doesn't call
`_merge_wall_face_pairs` yet, so the pre-fix defect still reproduces: 0 polygons).

- [ ] **Step 3: Wire the new step into `_build_space_polygons`**

In `space_geometry.py`, locate this exact block (around line 1845):

```python
    raw_lines = _wall_segments_to_linestrings(wall_segments)
    if not raw_lines:
        return [], exceptions

    # Inject divider lines as temporary walls if provided
    if divider_lines:
        raw_lines = list(raw_lines) + list(divider_lines)

    welded_lines = _weld_endpoints(raw_lines, CORNER_SNAP_TOL)
```

Replace it with:

```python
    raw_lines = _wall_segments_to_linestrings(wall_segments)
    if not raw_lines:
        return [], exceptions

    # Inject divider lines as temporary walls if provided
    if divider_lines:
        raw_lines = list(raw_lines) + list(divider_lines)

    if WALL_PROCESSING_MODE == WallProcessingMode.ENDPOINT_CLUSTER:
        raw_lines = _merge_wall_face_pairs(
            raw_lines, WALL_FACE_MAX_THICKNESS, WALL_FACE_MIN_OVERLAP_RATIO
        )

    welded_lines = _weld_endpoints(raw_lines, CORNER_SNAP_TOL)
```

Also update the module-level pipeline docstring's numbered list at the top of
`_build_space_polygons` (around line 1806) — change:

```
    1. Wall segments -> LineStrings.
    2. Weld endpoints onto the nearest *segment* within CORNER_SNAP_TOL.
```

to:

```
    1. Wall segments -> LineStrings.
    1.5. (ENDPOINT_CLUSTER mode only) Merge near-parallel, closely-spaced
         line pairs (the two faces of one physical wall) into a single
         centerline via _merge_wall_face_pairs, before welding — see
         docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md.
    2. Weld endpoints onto the nearest *segment* within CORNER_SNAP_TOL.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest "tests/test_space_geometry.py::TestMergeWallFacePairs::test_build_space_polygons_closes_previously_unclosed_wall" -v`
Expected: PASS.

- [ ] **Step 5: Run the FULL existing test suite to confirm no regressions**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: PASS — every existing test (`TestClusterEndpoints`, `TestWeldEndpointsV2`,
`TestFindGaps`, etc.) passes unmodified, plus all new tests from Tasks 2-5.

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): wire _merge_wall_face_pairs into _build_space_polygons (gated on ENDPOINT_CLUSTER)"
```

---

### Task 6: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an `[Unreleased]` → `### Fixed` (or `### Added`, project
  convention permitting) entry**

Follow the existing `CHANGELOG.md` format used by the referenced prior fixes
(`_find_gaps` dedup, opening-evidence-scan-optimization). Suggested entry:

```
### Fixed
- **[2026-07-31]**: **Wall-face-pair pre-merge fixes thin-wall endpoint-welding
  defect** — `_weld_endpoints_v2` could incorrectly weld two opposite faces of a
  thin wall (thickness < CORNER_SNAP_TOL) together at an uncapped end, corrupting
  wall geometry (duplicated/collapsed segments). Three prior post-hoc fix
  attempts on the welding algorithm itself all failed (see the ABANDONED
  weld-endpoints-self-chaining spec). Fixed at the root instead: a new
  `_merge_wall_face_pairs` pre-processing step recognizes wall-face pairs
  before welding and replaces each with one centerline, so the ambiguity never
  reaches the weld step. Gated behind `WALL_PROCESSING_MODE == ENDPOINT_CLUSTER`
  — the LEGACY (v1) path is unaffected.
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add CHANGELOG entry for wall-face-pair pre-merge fix"
```

---

### Task 7: Manual real-drawing verification (not automated — requires live ZWCAD session)

This is spec Testing item 8 — it cannot be scripted as a unit test because it
requires a live "아파트 평면도.dwg" ZWCAD session. Perform this manually after
Tasks 1-6 are complete and merged:

- [ ] Open "아파트 평면도.dwg" in ZWCAD.
- [ ] Run `handle_extract_cad_objects` then `handle_generate_spaces` (as done
  throughout the investigation this design originated from).
- [ ] Confirm room count moves from 6 toward the expected 8.
- [ ] Confirm the specific `UNCLOSED_WALLS` dangles previously observed in the
  x<14000 region (where `CORNER_SNAP_TOL` tuning was tried and failed) are
  resolved or replaced by a different, more localized (genuinely missing wall)
  report.
- [ ] Report the before/after room count and any remaining `UNCLOSED_WALLS`
  exceptions to the user.

This task has no code changes and no commit — it's a verification checklist.

---

## Post-Plan Note

Per this workspace's `CLAUDE.md`, direct `git commit`/`git push` are forbidden —
all commits in Tasks 1-6 above must go through the `/sync` pipeline
(`bun scripts/dev-sync.ts "<message>"`), not raw `git commit`. The `git commit`
commands shown in each task's "Commit" step are illustrative of *what* to
commit and a suggested message; run them via `/sync` in practice, and add a
`CHANGELOG.md` entry (Task 6) before the final `/sync` of this feature, since
`/sync` blocks if `[Unreleased]` is empty.
