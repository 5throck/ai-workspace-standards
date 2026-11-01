---
lang: ko
lang_reason: proper-noun
---

# Label-Anchored Hybrid Room Reconstruction (v2) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a `LABEL_ANCHORED_HYBRID` room-detection mode that returns exactly the labeled rooms (9 on the reference drawing), each polygon sourced from `SOLID_UNION`'s real geometry when a confident match exists, and from `LABEL_VORONOI`'s approximation otherwise.

**Architecture:** A new COM-free builder `_build_space_polygons_label_anchored_hybrid(room_labels, doors, wall_segments, leader_lines)` in `space_geometry.py` calls the two existing, unmodified builders (`_build_space_polygons_solid_union`, `_build_space_polygons_label_voronoi`) and merges their output via a 3-tier, globally-resolved match (leader-line → direct containment → nearest-fallback). `handle_extract_text_labels` gains an additive `leader_lines` field. A new `WallProcessingMode.LABEL_ANCHORED_HYBRID` dispatches from `handle_generate_spaces`.

**Tech Stack:** Python 3, shapely (`Polygon.contains`, `Polygon.distance`), `unittest`/`MagicMock`, existing `SpacePolygon`/`SpaceSource`/`WallProcessingMode`/`ExceptionReport`.

**Spec:** `docs/superpowers/specs/2026-08-01-label-anchored-hybrid-room-reconstruction-design.md`

---

## File Structure

- **Modify:** `src/cad_intelligence/geometry/space_geometry.py`
  - Add `WallProcessingMode.LABEL_ANCHORED_HYBRID`.
  - Add constants `LABEL_ANCHOR_MATCH_MAX_DIST_MM`, `LEADER_LABEL_ASSOCIATION_MAX_DIST_MM`.
  - Add builder `_build_space_polygons_label_anchored_hybrid` (after `_build_space_polygons_label_voronoi`).
- **Modify:** `src/cad_intelligence/cad_io/handlers/space.py`
  - Extend `handle_extract_text_labels` to also scan `AcDbLeader` entities and return `leader_lines`.
  - Add dispatch branch in `handle_generate_spaces` for `LABEL_ANCHORED_HYBRID`.
- **Modify:** `tests/test_space_geometry.py` — unit tests for the new builder (COM-free).
- **Modify:** `tests/handlers/test_extract_text_labels.py` — unit tests for the `leader_lines` addition.
- **Modify:** `CHANGELOG.md` — `[Unreleased]` entry (English only).

---

## Task 1: `handle_extract_text_labels` — add `leader_lines` (additive, TDD)

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py:2750-2787` (`handle_extract_text_labels`)
- Test: `tests/handlers/test_extract_text_labels.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/handlers/test_extract_text_labels.py`, inside `TestHandleExtractTextLabels`:

```python
    def _make_mock_leader(self, handle, layer, coords):
        ent = MagicMock()
        ent.ObjectName = "AcDbLeader"
        ent.Handle = handle
        ent.Layer = layer
        # Flat [x1,y1,x2,y2,...] tuple, stride 2 -- the CONFIRMED pattern
        # for entity.Coordinates in this codebase (see
        # _detect_curved_cluster_doors's docstring: "vertex count must
        # be computed as len(entity.Coordinates) // 2"). Do NOT use
        # stride 3 (x,y,z) -- that was an earlier, incorrect draft of
        # this plan, corrected after code review.
        ent.Coordinates = coords
        return ent

    def test_leader_entity_on_matching_layer_returned_in_leader_lines(self):
        leader = self._make_mock_leader("2B1", "7TXT", (1000.0, 2000.0, 1500.0, 2500.0))
        bridge = self._make_mock_bridge([leader])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        leaders = result.data["leader_lines"]
        assert len(leaders) == 1
        assert leaders[0]["handle"] == "2B1"
        assert leaders[0]["layer"] == "7TXT"
        assert leaders[0]["points"] == [[1000.0, 2000.0], [1500.0, 2500.0]]

    def test_leader_lines_present_and_empty_when_no_leaders(self):
        ent = self._make_mock_text("1A1", "7TXT", "AcDbText", "거실", (1000.0, 2000.0, 0.0))
        bridge = self._make_mock_bridge([ent])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        assert result.data["leader_lines"] == []
        # text_labels contract is unaffected by this addition
        assert len(result.data["text_labels"]) == 1

    def test_leader_on_non_matching_layer_excluded(self):
        leader = self._make_mock_leader("2B2", "OTHER", (0.0, 0.0, 1.0, 1.0))
        bridge = self._make_mock_bridge([leader])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        assert result.data["leader_lines"] == []
```

**IMPORTANT NOTE for the implementer**: the mock's `ent.Coordinates` is a *guess* at the real COM property `AcDbLeader` exposes for its vertices, based on the pattern this codebase already uses for `AcDbPolyline`/`AcDb2dPolyline`. **The confirmed precedent is stride-2 (flat `[x1,y1,x2,y2,...]`), not stride-3** — `_detect_curved_cluster_doors`'s docstring (`space.py` ~line 495-498) states this explicitly, confirmed against live COM this session: *"vertex count must be computed as `len(entity.Coordinates) // 2` — `entity.NumberOfVertices` does not exist."* Use stride 2 in both the mock fixtures and the implementation (Step 3) — do NOT use stride 3. **This has still NOT been confirmed against a live ZWCAD COM object for `AcDbLeader` specifically** (only for `AcDbPolyline`/`AcDb2dPolyline`) — Step 5 of this task requires a live-drawing check before treating this as final. If `AcDbLeader` turns out to use a different stride or property, update both the mock in these tests and the implementation in Step 2, and re-verify.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_text_labels.py -v`
Expected: FAIL — `result.data["leader_lines"]` raises `KeyError` (not yet implemented).

- [ ] **Step 3: Implement the leader scan**

In `space.py`, modify `handle_extract_text_labels` (currently ends at line 2787 with `return HandlerResult.success(text_labels=labels)`):

```python
def handle_extract_text_labels(params: dict) -> HandlerResult:
    """Extract AcDbText/AcDbMText content + position, and AcDbLeader
    vertex geometry, from caller-specified layers (ELEV-002/room-labeling
    follow-up; leader_lines added for LABEL_ANCHORED_HYBRID, see
    docs/superpowers/specs/2026-08-01-label-anchored-hybrid-room-reconstruction-design.md).
    Does its own narrowly-scoped live COM read (mirrors
    _detect_curved_cluster_doors's style) since no shared
    Entry/ModelSpaceScanResult cache carries text/leader content today.
    """
    if not _PYWIN32_AVAILABLE:
        raise ZWCADConnectionError(_STUB_MSG)

    search_layers = params.get("search_layers")
    if not search_layers:
        raise ValueError("search_layers is required and must be non-empty")
    layer_set = set(search_layers)

    bridge = _get_bridge()
    doc = bridge.app.ActiveDocument
    ms = doc.ModelSpace

    labels: list[dict] = []
    leader_lines: list[dict] = []
    for i in range(ms.Count):
        entity = ms.Item(i)
        if entity.Layer not in layer_set:
            continue
        if entity.ObjectName in ("AcDbText", "AcDbMText"):
            try:
                position = list(entity.InsertionPoint)[:2]
            except Exception:
                position = None
            labels.append({
                "handle": entity.Handle,
                "layer": entity.Layer,
                "object_name": entity.ObjectName,
                "text": entity.TextString,
                "position": position,
            })
        elif entity.ObjectName == "AcDbLeader":
            try:
                flat = list(entity.Coordinates)
                points = [list(flat[j:j + 2]) for j in range(0, len(flat), 2)]
            except Exception:
                points = []
            leader_lines.append({
                "handle": entity.Handle,
                "layer": entity.Layer,
                "points": points,
            })
    return HandlerResult.success(text_labels=labels, leader_lines=leader_lines)
```

Note: `entity.Coordinates` for a polyline-like entity in this codebase is a **flat stride-2 tuple** (`[x1,y1,x2,y2,...]`, no z) — confirmed against live COM for `AcDbPolyline`/`AcDb2dPolyline` by `_detect_curved_cluster_doors`'s docstring ("vertex count must be computed as `len(entity.Coordinates) // 2`"). The code above uses stride 2 to match this confirmed precedent. `AcDbLeader` itself is NOT yet confirmed to use the same property/stride — Step 5's manual check is required before treating this as final.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_text_labels.py -v`
Expected: all pass (9 tests: 6 pre-existing + 3 new).

- [ ] **Step 5: Manual verification note (deferred, not blocking)**

This step cannot run in this task (requires a live ZWCAD MCP connection). Record in the task's completion notes: "Leader-vertex COM property (`Coordinates`, assumed stride-2 flat x,y pairs, matching the confirmed `AcDbPolyline`/`AcDb2dPolyline` precedent) is unconfirmed against live ZWCAD for `AcDbLeader` specifically; must be verified during Task 4's manual verification step before this mode is considered production-ready. If wrong, fix here and re-run this task's tests."

- [ ] **Step 6: Run the full handlers test suite — confirm no regressions**

Run: `python -m pytest tests/handlers/ -q`
Expected: all pass (85+ tests, same pre-existing unrelated skip as before).

- [ ] **Step 7: Commit (or stage if policy-blocked)**

```bash
git add src/cad_intelligence/cad_io/handlers/space.py tests/handlers/test_extract_text_labels.py
git commit -m "feat(cad-io): add leader_lines to handle_extract_text_labels"
```
If the pre-commit hook rejects direct commits (mandates `/sync`), leave staged — do NOT use `--no-verify`.

---

## Task 2: Builder `_build_space_polygons_label_anchored_hybrid` (TDD, COM-free)

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (constants near `LABEL_VORONOI_HULL_MARGIN_MM`; new builder after `_build_space_polygons_label_voronoi`)
- Test: `tests/test_space_geometry.py` (new class `TestBuildSpacePolygonsLabelAnchoredHybrid`)

- [ ] **Step 1: Add the two constants and the new `WallProcessingMode` member**

In `space_geometry.py`, in the `WallProcessingMode` enum (where `LABEL_VORONOI = 4` was added in the prior PR), add:
```python
    LABEL_ANCHORED_HYBRID = 5
```

Near `LABEL_VORONOI_HULL_MARGIN_MM`, add:
```python
#: Ceiling (mm) for the nearest-fallback tier when matching a room label
#: to a SOLID_UNION polygon with no leader/containment match. Used by
#: _build_space_polygons_label_anchored_hybrid.
LABEL_ANCHOR_MATCH_MAX_DIST_MM: float = 1000.0

#: Max distance (mm) between a leader's terminal vertex and a room
#: label's own position for the leader to be considered "belonging to"
#: that label. Used by _build_space_polygons_label_anchored_hybrid.
LEADER_LABEL_ASSOCIATION_MAX_DIST_MM: float = 300.0
```

- [ ] **Step 2: Write the failing unit tests (TDD)**

In `tests/test_space_geometry.py`, add imports (mirror the `TestBuildSpacePolygonsLabelVoronoi` imports already present): `_build_space_polygons_label_anchored_hybrid`, `LABEL_ANCHOR_MATCH_MAX_DIST_MM`, `LEADER_LABEL_ASSOCIATION_MAX_DIST_MM` from `space_geometry`. Add a new test class after `TestBuildSpacePolygonsLabelVoronoi`:

```python
class TestBuildSpacePolygonsLabelAnchoredHybrid(unittest.TestCase):
    def _label(self, text, x, y):
        return {"text": text, "position": (float(x), float(y))}

    def _square_wall_segments(self, x0, y0, x1, y1, prefix):
        """A closed square of 4 WallSegments -- SOLID_UNION closes this."""
        from src.cad_intelligence.common.models import WallSegment
        corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
        segs = []
        for i in range(4):
            a, b = corners[i], corners[(i + 1) % 4]
            segs.append(WallSegment(
                handle=f"{prefix}{i}", layer="A-WALL", start=a, end=b,
                length=math.dist(a, b), thickness=200.0,
            ))
        return segs

    def test_leader_terminal_inside_solid_polygon_matches_via_leader_tier(self):
        # Room A: closed square (0,0)-(10000,10000) via real walls.
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        # Label text-anchor sits OUTSIDE the room; its leader terminates INSIDE.
        labels = [self._label("A", -5000, -5000)]
        leaders = [{"handle": "L1", "layer": "7TXT", "points": [[-5000.0, -5000.0], [5000.0, 5000.0]]}]
        spaces, exceptions = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=leaders,
        )
        self.assertEqual(len(spaces), 1)
        self.assertEqual(spaces[0].source, SpaceSource.GEOMETRY)
        self.assertEqual(spaces[0].room_name, "A")
        match_codes = [e.code for e in exceptions if e.code == "LABEL_ANCHORED_GEOMETRY_MATCH"]
        self.assertEqual(len(match_codes), 1)

    def test_direct_containment_when_no_leader(self):
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        labels = [self._label("A", 5000, 5000)]  # inside the square, no leader
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=[],
        )
        self.assertEqual(len(spaces), 1)
        self.assertEqual(spaces[0].source, SpaceSource.GEOMETRY)

    def test_leader_misses_every_polygon_falls_through_to_direct_containment(self):
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        # Leader terminates far outside the square (misses); label's OWN
        # position is inside -- tier 1 must not block tier 2.
        labels = [self._label("A", 5000, 5000)]
        leaders = [{"handle": "L1", "layer": "7TXT", "points": [[5000.0, 5000.0], [-90000.0, -90000.0]]}]
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=leaders,
        )
        self.assertEqual(len(spaces), 1)
        self.assertEqual(spaces[0].source, SpaceSource.GEOMETRY)

    def test_nearest_fallback_within_1000mm(self):
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        # Label sits 500mm outside the square boundary (x=10500,y=5000);
        # no leader, not contained -- must use nearest-fallback tier.
        labels = [self._label("A", 10500, 5000)]
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=[],
        )
        self.assertEqual(len(spaces), 1)
        self.assertEqual(spaces[0].source, SpaceSource.GEOMETRY)

    def test_beyond_1000mm_falls_back_to_voronoi(self):
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        # Label sits 5000mm outside the square -- beyond LABEL_ANCHOR_MATCH_MAX_DIST_MM.
        labels = [self._label("A", 20000, 5000)]
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=[],
        )
        self.assertEqual(len(spaces), 1)
        self.assertEqual(spaces[0].source, SpaceSource.LABEL_VORONOI)

    def test_global_tier_resolution_leader_match_wins_over_earlier_direct_match(self):
        # One SOLID_UNION polygon. Label A (processed first) sits directly
        # inside it (tier-2 candidate). Label B (processed second) has a
        # leader terminating inside the SAME polygon (tier-1 candidate).
        # Tier 1 must be resolved globally BEFORE tier 2, so B -- not A --
        # gets the polygon, even though A was processed first.
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        labels = [
            self._label("A", 5000, 5000),       # inside square: tier-2 candidate
            self._label("B", -5000, -5000),      # outside; leader points inside: tier-1 candidate
        ]
        leaders = [{"handle": "L1", "layer": "7TXT", "points": [[-5000.0, -5000.0], [5000.0, 5000.0]]}]
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=leaders,
        )
        by_name = {s.room_name: s for s in spaces}
        self.assertEqual(by_name["B"].source, SpaceSource.GEOMETRY, "leader match (B) must win the polygon")
        self.assertEqual(by_name["A"].source, SpaceSource.LABEL_VORONOI, "A must fall back to Voronoi, not steal the polygon")

    def test_unmatched_solid_polygon_excluded_from_result(self):
        # Two disjoint closed squares; only ONE label exists. The
        # unmatched square must not appear in the final result.
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W1") + \
                self._square_wall_segments(50000, 50000, 60000, 60000, "W2")
        labels = [self._label("A", 5000, 5000)]
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=[],
        )
        self.assertEqual(len(spaces), 1)  # not 2 -- the unmatched square is dropped

    def test_result_length_always_equals_label_count(self):
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        labels = [self._label("A", 5000, 5000), self._label("B", 90000, 90000)]  # B has no nearby geometry
        spaces, _ = _build_space_polygons_label_anchored_hybrid(
            labels, doors=[], wall_segments=walls, leader_lines=[],
        )
        self.assertEqual(len(spaces), len(labels))
        by_name = {s.room_name: s for s in spaces}
        self.assertEqual(by_name["A"].source, SpaceSource.GEOMETRY)
        self.assertEqual(by_name["B"].source, SpaceSource.LABEL_VORONOI)

    def test_empty_labels_returns_no_rooms_no_crash(self):
        walls = self._square_wall_segments(0, 0, 10000, 10000, "W")
        spaces, exceptions = _build_space_polygons_label_anchored_hybrid(
            [], doors=[], wall_segments=walls, leader_lines=[],
        )
        self.assertEqual(spaces, [])
```

Note: `math` must be imported at the top of `tests/test_space_geometry.py` (it already is, added for the `TestOpeningsToWallSegments` class in a prior PR — confirm, don't re-add if present).

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestBuildSpacePolygonsLabelAnchoredHybrid -v`
Expected: FAIL — `_build_space_polygons_label_anchored_hybrid` not defined.

- [ ] **Step 4: Implement the builder**

Add to `space_geometry.py`, after `_build_space_polygons_label_voronoi`:

```python
def _build_space_polygons_label_anchored_hybrid(
    room_labels: list[dict],
    doors: list[Any],
    wall_segments: list["WallSegment"],
    leader_lines: list[dict],
) -> tuple[list["SpacePolygon"], list["ExceptionReport"]]:
    """LABEL_ANCHORED_HYBRID mode: combines SOLID_UNION's real geometry
    with LABEL_VORONOI's guaranteed room count. Every room label ends up
    with exactly one polygon: SOLID_UNION's real polygon where a
    confident match exists (source=GEOMETRY), LABEL_VORONOI's
    approximation otherwise (source=LABEL_VORONOI unchanged).

    Matching is a 3-tier, globally-resolved process (leader-line ->
    direct containment -> nearest-fallback within
    LABEL_ANCHOR_MATCH_MAX_DIST_MM) -- each tier is fully resolved
    across ALL labels before the next tier runs, so a strong match for
    one label can never be blocked by a weaker match another label
    claimed first. SOLID_UNION polygons with no matching label are
    dropped from the result (this mode's contract is "exactly the
    labeled rooms," not "every polygon SOLID_UNION can find").

    See docs/superpowers/specs/2026-08-01-label-anchored-hybrid-room-reconstruction-design.md.
    """
    from shapely.geometry import Polygon as ShapelyPolygon, Point as ShapelyPoint

    solid_rooms, _ = _build_space_polygons_solid_union(wall_segments, doors)
    voronoi_rooms, voronoi_exceptions = _build_space_polygons_label_voronoi(room_labels, doors)

    if not room_labels:
        return [], []

    solid_polys = [ShapelyPolygon(r.polygon_points) for r in solid_rooms]
    unclaimed_polygon_idx = set(range(len(solid_polys)))
    unmatched_label_idx = set(range(len(room_labels)))
    label_match: dict[int, tuple[int, str, float]] = {}  # label_idx -> (poly_idx, tier, dist)

    def _leader_terminal_for_label(label_idx: int) -> tuple[float, float] | None:
        lx, ly = room_labels[label_idx]["position"]
        best = None
        best_dist = LEADER_LABEL_ASSOCIATION_MAX_DIST_MM
        for leader in leader_lines:
            pts = leader.get("points") or []
            if not pts:
                continue
            # Leader is "associated" with the label if EITHER endpoint
            # (start, the label side) is within tolerance of the label
            # position; the terminal is the far endpoint.
            start, terminal = pts[0], pts[-1]
            d = math.dist((lx, ly), tuple(start))
            if d <= best_dist:
                best_dist = d
                best = tuple(terminal)
        return best

    # Tier 1: leader-line match, resolved globally.
    tier1_candidates = []  # (label_idx, poly_idx)
    for li in list(unmatched_label_idx):
        terminal = _leader_terminal_for_label(li)
        if terminal is None:
            continue
        term_pt = ShapelyPoint(terminal)
        for pi in unclaimed_polygon_idx:
            if solid_polys[pi].contains(term_pt):
                tier1_candidates.append((li, pi))
                break
    for li, pi in tier1_candidates:
        if li in unmatched_label_idx and pi in unclaimed_polygon_idx:
            label_match[li] = (pi, "leader", 0.0)
            unmatched_label_idx.discard(li)
            unclaimed_polygon_idx.discard(pi)

    # Tier 2: direct containment, resolved globally.
    tier2_candidates = []
    for li in list(unmatched_label_idx):
        lx, ly = room_labels[li]["position"]
        pt = ShapelyPoint(lx, ly)
        for pi in unclaimed_polygon_idx:
            if solid_polys[pi].contains(pt):
                tier2_candidates.append((li, pi))
                break
    for li, pi in tier2_candidates:
        if li in unmatched_label_idx and pi in unclaimed_polygon_idx:
            label_match[li] = (pi, "direct", 0.0)
            unmatched_label_idx.discard(li)
            unclaimed_polygon_idx.discard(pi)

    # Tier 3: nearest-fallback within LABEL_ANCHOR_MATCH_MAX_DIST_MM, globally.
    tier3_candidates = []  # (dist, label_idx, poly_idx), sorted so closest matches commit first
    for li in list(unmatched_label_idx):
        lx, ly = room_labels[li]["position"]
        pt = ShapelyPoint(lx, ly)
        for pi in unclaimed_polygon_idx:
            d = solid_polys[pi].distance(pt)
            if d <= LABEL_ANCHOR_MATCH_MAX_DIST_MM:
                tier3_candidates.append((d, li, pi))
    tier3_candidates.sort(key=lambda x: x[0])
    for d, li, pi in tier3_candidates:
        if li in unmatched_label_idx and pi in unclaimed_polygon_idx:
            label_match[li] = (pi, "nearest", d)
            unmatched_label_idx.discard(li)
            unclaimed_polygon_idx.discard(pi)

    # Build a per-label-index alignment to LABEL_VORONOI's output rooms.
    # _build_space_polygons_label_voronoi preserves room_labels order
    # and only ever SKIPS an entry (emitting LABEL_VORONOI_SEED_UNASSIGNED
    # with the skipped label's own text+position in its context), never
    # reorders. Walking both lists in lockstep -- using the skip
    # exceptions to detect gaps -- gives an exact per-label-index
    # correspondence WITHOUT grouping by room_name text. This matters
    # because room names are not unique: the reference drawing has two
    # "욕   실" labels at different positions, and a naive
    # group-by-text-then-pop lookup would silently hand one label's
    # Voronoi cell to the wrong label whenever only one of a duplicate
    # pair gets geometry-matched in the tiers above.
    unassigned_positions = {
        tuple(e.context["position"])
        for e in voronoi_exceptions
        if e.code == "LABEL_VORONOI_SEED_UNASSIGNED"
    }
    voronoi_room_by_label_index: dict[int, "SpacePolygon"] = {}
    vi = 0
    for li, lbl in enumerate(room_labels):
        lbl_pos = tuple(float(c) for c in lbl["position"])
        if lbl_pos in unassigned_positions:
            continue  # LABEL_VORONOI itself skipped this label -- no room to align.
        if vi < len(voronoi_rooms):
            voronoi_room_by_label_index[li] = voronoi_rooms[vi]
            vi += 1

    # Assemble result: matched labels get the SOLID_UNION polygon
    # (renamed/sourced), unmatched labels get their Voronoi polygon,
    # looked up by INDEX (not by text) via the alignment above.
    spaces: list["SpacePolygon"] = []
    exceptions: list["ExceptionReport"] = []

    for li, lbl in enumerate(room_labels):
        text = lbl.get("text")
        if li in label_match:
            pi, tier, dist = label_match[li]
            sp = solid_rooms[pi]
            sp.room_name = text
            sp.source = SpaceSource.GEOMETRY
            spaces.append(sp)
            exceptions.append(ExceptionReport(
                code="LABEL_ANCHORED_GEOMETRY_MATCH",
                severity="info",
                message=(
                    f"Room {text!r} matched to real SOLID_UNION geometry via "
                    f"{tier} tier (distance={dist:.0f}mm)."
                ),
                context={"room_name": text, "tier": tier, "distance_mm": round(dist, 1)},
            ))
        else:
            vr = voronoi_room_by_label_index.get(li)
            if vr is not None:
                spaces.append(vr)
            else:
                # LABEL_VORONOI itself couldn't seed this label (degenerate
                # layout) AND no SOLID_UNION match exists -- surface this
                # rather than silently shrinking the result below
                # len(room_labels).
                exceptions.append(ExceptionReport(
                    code="LABEL_ANCHORED_HYBRID_NO_ROOM",
                    severity="warning",
                    message=(
                        f"Room {text!r} has neither a SOLID_UNION match nor a "
                        "LABEL_VORONOI fallback; no polygon emitted for it."
                    ),
                    context={"room_name": text},
                ))

    return spaces, exceptions
```

NOTE for the implementer: `ExceptionReport`, `SpaceSource`, `Any`, `math` are already imported/available in `space_geometry.py` (used by `_build_space_polygons_label_voronoi`). Verify `WallSegment` type-hint string reference resolves the same way `_build_space_polygons_solid_union` already does it (both take `wall_segments: list["WallSegment"]`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestBuildSpacePolygonsLabelAnchoredHybrid -v`
Expected: 9 passed.

- [ ] **Step 6: Run the full test file — confirm no regressions**

Run: `python -m pytest tests/test_space_geometry.py -q`
Expected: all pass (145+ tests).

- [ ] **Step 7: Commit (or stage if policy-blocked)**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): add _build_space_polygons_label_anchored_hybrid (LABEL_ANCHORED_HYBRID mode)"
```

---

## Task 3: Dispatch branch in `handle_generate_spaces`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py:3801-3860` (dispatch block)
- Test: `tests/handlers/test_wall_processing_mode_dispatch.py` (mode-resolution test only — this mode is COM-bound for label/leader fetch, like `LABEL_VORONOI`)

- [ ] **Step 1: Add the import alias**

Find where `_build_space_polygons_label_voronoi` is imported/aliased in `space.py` (as `_elev002_build_space_polygons_label_voronoi`, in the same dual-import-block pattern used throughout this file). Add `_build_space_polygons_label_anchored_hybrid as _elev002_build_space_polygons_label_anchored_hybrid` to **both** import blocks (the primary and the fallback path), mirroring exactly how `_build_space_polygons_label_voronoi`'s alias was added.

- [ ] **Step 2: Add the dispatch branch**

In `handle_generate_spaces`, insert an `elif resolved_mode == _WPM.LABEL_ANCHORED_HYBRID:` branch after the existing `elif resolved_mode == _WPM.LABEL_VORONOI:` block (`space.py:3818-3856`) and before the final `else:`:

```python
    elif resolved_mode == _WPM.LABEL_ANCHORED_HYBRID:
        # LABEL_ANCHORED_HYBRID doesn't use axis_grid/divider_lines.
        if parsed_axis_grid is not None or params.get("divider_lines"):
            space_polygons = []
            exceptions = [_ExceptionReport(
                code="LABEL_ANCHORED_HYBRID_UNSUPPORTED_PARAM",
                severity="blocking",
                context={"reason": "axis_grid/divider_lines not supported with LABEL_ANCHORED_HYBRID"},
            )]
        else:
            doc_name = params.get("doc_name") or ""
            sidecar = _load_room_labels_sidecar(doc_name, params.get("room_labels_path"))
            if not sidecar:
                space_polygons = []
                exceptions = [_ExceptionReport(
                    code="LABEL_ANCHORED_HYBRID_NO_SIDECAR",
                    severity="blocking",
                    context={"reason": f"no room-labels sidecar for {doc_name!r}; cannot identify room-name labels"},
                )]
            else:
                label_result = handle_extract_text_labels({"search_layers": sidecar.get("text_layers", [])})
                raw_labels = label_result.data.get("text_labels", [])
                raw_leaders = label_result.data.get("leader_lines", [])
                includes = [s.lower() for s in sidecar.get("room_name_includes", [])]
                excludes = [s.lower() for s in sidecar.get("room_name_excludes", [])]

                def _qualifies(text):
                    t = " ".join(str(text).lower().split())
                    if includes:
                        return any(inc in t for inc in includes)
                    return not any(exc in t for exc in excludes)

                room_labels = [
                    {"text": l["text"], "position": tuple(l["position"])}
                    for l in raw_labels if _qualifies(l.get("text", ""))
                ]
                space_polygons, exceptions = _elev002_build_space_polygons_label_anchored_hybrid(
                    room_labels, doors=openings, wall_segments=wall_segments, leader_lines=raw_leaders,
                )
```

Note: this branch duplicates the sidecar-loading and `_qualifies` filter logic already present in the `LABEL_VORONOI` branch verbatim (both need "which labels are room names" from the same sidecar). This duplication is acceptable for now — the two branches are independent modes; extracting a shared helper is a reasonable follow-up but out of scope for this plan (YAGNI: wait for a third consumer before abstracting).

- [ ] **Step 3: Add a mode-resolution unit test**

In `tests/handlers/test_wall_processing_mode_dispatch.py`, find the existing test(s) confirming `"label_voronoi"` resolves to `WallProcessingMode.LABEL_VORONOI` (added in the prior PR) and add a sibling assertion for `"label_anchored_hybrid"` → `WallProcessingMode.LABEL_ANCHORED_HYBRID`, following the exact same test structure.

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/handlers/ -q`
Expected: all pass (86+ passed, 1 pre-existing unrelated skip).

Run: `python -m pytest tests/test_space_geometry.py -q`
Expected: all pass (sanity check — unaffected by this task).

- [ ] **Step 5: Stage (commit likely policy-blocked)**

```bash
git add src/cad_intelligence/cad_io/handlers/space.py tests/handlers/test_wall_processing_mode_dispatch.py
```
Do NOT commit directly (workspace mandates `/sync`). Do NOT use `--no-verify`.

---

## Task 4: CHANGELOG + manual verification + `/sync`

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry** (English only — no literal Korean room-name text; describe in English, per this workspace's established Hangul-in-CHANGELOG pre-commit block)

Under `[Unreleased]` → `### Added`:
```markdown
- **[2026-08-01]**: **Added `LABEL_ANCHORED_HYBRID` room-detection mode** (`src/cad_intelligence/geometry/space_geometry.py`, `src/cad_intelligence/cad_io/handlers/space.py`) — combines `SOLID_UNION`'s real wall geometry with `LABEL_VORONOI`'s guaranteed room count. For each room-name label, a 3-tier globally-resolved match (leader-line terminal → direct containment → nearest-fallback within 1000mm) looks for a corresponding `SOLID_UNION` polygon; when found, that room gets real geometry (`source=SpaceSource.GEOMETRY`); otherwise it keeps `LABEL_VORONOI`'s approximation (`source=SpaceSource.LABEL_VORONOI`). Tier resolution is global across all labels, not per-label, so a strong (leader) match for one label can never be blocked by a weaker (containment/nearest) match another label claimed first. `SOLID_UNION` polygons with no matching label (unnamed fragments — corridors, structural voids) are dropped; the result always contains exactly the labeled room count. `handle_extract_text_labels` gained an additive `leader_lines` field (AcDbLeader vertex geometry) to support the leader-line match tier — the existing `text_labels` contract is unchanged. 9 new COM-free unit tests for the hybrid builder, 3 new tests for the `leader_lines` addition, 1 new mode-resolution dispatch test. See `docs/superpowers/specs/2026-08-01-label-anchored-hybrid-room-reconstruction-design.md` and `docs/superpowers/plans/2026-08-01-label-anchored-hybrid-room-reconstruction.md`.
```

- [ ] **Step 2: Manual verification checklist (post-merge, requires MCP restart)**

After merge, restart the ZWCAD MCP connection and run on the reference drawing:
- **First, confirm the `AcDbLeader` COM property assumption from Task 1 Step 5** — call `zwcad_extract_text_labels` with `search_layers: ["7TXT", "4TXT"]` and inspect `leader_lines`. If `points` are empty/malformed for known leaders, fix the `Coordinates` read in `handle_extract_text_labels` before proceeding.
- Call `zwcad_generate_spaces` with `wall_processing_mode="label_anchored_hybrid"`.
- Record: room count (expected 9, unchanged from `LABEL_VORONOI`), how many rooms got `source="geometry"` vs `source="label_voronoi"`, and which match tier each geometry-sourced room used (from the `LABEL_ANCHORED_GEOMETRY_MATCH` exceptions).
- **Report honestly**: at most 4 rooms can upgrade to real geometry on this drawing (since `SOLID_UNION` only closes 4 there per this session's earlier diagnostic) — do not assume all 4 will upgrade; a label might not spatially correspond to any of the 4 closed rooms.

- [ ] **Step 3: Run `/sync`** — final step (lifecycle + audit + commit + push + PR). No manual `git commit`/`git push`.
