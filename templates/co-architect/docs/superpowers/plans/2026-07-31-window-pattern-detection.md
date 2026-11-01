---
lang: ko
lang_reason: proper-noun
---

# Sidecar-Driven Window Pattern Detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `handle_extract_cad_objects`'s sidecar-override (currently doors-only, PR #171) to also detect windows via 2 new pattern detectors, fully replacing `windows` when the sidecar's `window_patterns` key is present. No sidecar / no `window_patterns` key → unchanged behavior.

**Architecture:** Two new functions in `space.py`, mirroring the door detectors' style: `_detect_framed_windows` (rectangle-frame + enclosed lines) and `_detect_parallel_line_windows` (orientation-agnostic parallel-line clustering via union-find over the cached `scan_result` — no live COM read needed, unlike the door Type-3 curved-cluster detector). Both operate on `ModelSpaceScanResult`/`Entry`, same cache-reuse discipline as the door work.

**Tech Stack:** Python, existing `Entry`/`ModelSpaceScanResult`/`WindowEntity`/`ExceptionReport` dataclasses.

---

## Reference

Spec (approved after 1 revision round): `docs/superpowers/specs/2026-07-31-window-pattern-detection-design.md`
Precedent: `docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md`, `docs/superpowers/plans/2026-07-31-sidecar-door-pattern-detection.md`

Key verified facts (from spec review):
- `WindowEntity` (`models.py:164-180`): `handle`, `layer`, `position`, `width`, `block_name=None` — no `thickness` field.
- `Entry` carries `start`/`end`/`length` for lines but no stored `angle` — derive via `atan2(dy, dx) mod 180°`.
- The existing sidecar-override block in `handle_extract_cad_objects` (search `if patterns is not None:`) is where door detection was wired (PR #171) — window logic extends the SAME block but with its OWN inner `if window_patterns:` gate (doors-only sidecars must not regress `windows`).
- Reference-axis convention for the parallel-line clustering: always use the lexicographically-lower-handle line's direction for perpendicular-distance/overlap checks (deterministic regardless of pair iteration order).
- The Type-3 "possible exception" check is position-based (matches a cluster's centroid against the sidecar's flagged `approx_center`), not type-based — it works even though Type 1/3 are merged into one detector.

---

### Task 1: `_detect_parallel_line_windows`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add right after the door detectors (search for `_detect_curved_cluster_doors`, insert immediately after its closing line).
- Test: `tests/handlers/test_extract_cad_objects_door_patterns.py` (existing file from PR #171 — append here since it's the same sidecar-detection suite).

- [ ] **Step 1: Write the failing tests**

Append to `tests/handlers/test_extract_cad_objects_door_patterns.py`:

```python
class TestDetectParallelLineWindows(unittest.TestCase):
    def test_two_parallel_lines_within_tolerance_form_one_window(self):
        # Two horizontal lines, 440mm apart, overlapping run direction.
        l1 = Entry(
            layer="DOOR", handle="W1", object_name="AcDbLine",
            start=(1000.0, 1000.0), end=(2200.0, 1000.0), length=1200.0,
        )
        l2 = Entry(
            layer="DOOR", handle="W2", object_name="AcDbLine",
            start=(1000.0, 1440.0), end=(2200.0, 1440.0), length=1200.0,
        )
        scan_result = _make_scan_result({"DOOR": [l1, l2]})
        windows = space._detect_parallel_line_windows(scan_result, ["DOOR"])
        assert len(windows) == 1
        w = windows[0]
        assert w.handle == "W1"  # lexicographically lower
        assert w.layer == "DOOR"
        assert w.width == pytest.approx(1200.0)

    def test_lines_outside_thickness_tolerance_not_clustered(self):
        l1 = Entry(
            layer="DOOR", handle="W3", object_name="AcDbLine",
            start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0,
        )
        l2 = Entry(
            layer="DOOR", handle="W4", object_name="AcDbLine",
            start=(0.0, 5000.0), end=(1000.0, 5000.0), length=1000.0,
        )
        scan_result = _make_scan_result({"DOOR": [l1, l2]})
        windows = space._detect_parallel_line_windows(scan_result, ["DOOR"])
        assert windows == []

    def test_single_line_no_partner_not_detected(self):
        l1 = Entry(
            layer="DOOR", handle="W5", object_name="AcDbLine",
            start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0,
        )
        scan_result = _make_scan_result({"DOOR": [l1]})
        windows = space._detect_parallel_line_windows(scan_result, ["DOOR"])
        assert windows == []

    def test_layer_not_in_search_layers_ignored(self):
        l1 = Entry(
            layer="OTHER", handle="W6", object_name="AcDbLine",
            start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0,
        )
        l2 = Entry(
            layer="OTHER", handle="W7", object_name="AcDbLine",
            start=(0.0, 440.0), end=(1000.0, 440.0), length=1000.0,
        )
        scan_result = _make_scan_result({"OTHER": [l1, l2]})
        windows = space._detect_parallel_line_windows(scan_result, ["DOOR"])
        assert windows == []

    def test_vertical_orientation_detected_same_as_horizontal(self):
        """Type 3 (vertical) uses the same rule as Type 1 (horizontal) --
        the detector must be orientation-agnostic."""
        l1 = Entry(
            layer="DOOR", handle="V1", object_name="AcDbLine",
            start=(5000.0, 0.0), end=(5000.0, 1000.0), length=1000.0,
        )
        l2 = Entry(
            layer="DOOR", handle="V2", object_name="AcDbLine",
            start=(5440.0, 0.0), end=(5440.0, 1000.0), length=1000.0,
        )
        scan_result = _make_scan_result({"DOOR": [l1, l2]})
        windows = space._detect_parallel_line_windows(scan_result, ["DOOR"])
        assert len(windows) == 1

    def test_exclude_handles_removes_lines_from_candidate_pool(self):
        l1 = Entry(
            layer="DOOR", handle="W8", object_name="AcDbLine",
            start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0,
        )
        l2 = Entry(
            layer="DOOR", handle="W9", object_name="AcDbLine",
            start=(0.0, 440.0), end=(1000.0, 440.0), length=1000.0,
        )
        scan_result = _make_scan_result({"DOOR": [l1, l2]})
        windows = space._detect_parallel_line_windows(
            scan_result, ["DOOR"], exclude_handles={"W9"}
        )
        assert windows == []  # only W8 remains, no partner
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectParallelLineWindows -v`
Expected: FAIL — function doesn't exist.

- [ ] **Step 3: Implement `_detect_parallel_line_windows`**

Add to `space.py`, right after `_detect_curved_cluster_doors`:

```python
import math


def _detect_parallel_line_windows(
    scan_result: "ModelSpaceScanResult",
    search_layers: list[str],
    thickness_tol_mm: float = 500.0,
    angle_tol_deg: float = 3.0,
    min_lines: int = 2,
    exclude_handles: set[str] | None = None,
) -> list["WindowEntity"]:
    """Orientation-agnostic parallel-line window detector (sidecar Types
    1 and 3 are the same rule at different orientations -- merged into
    one detector rather than hardcoding "horizontal"/"vertical").

    Clusters AcDbLine entries on a layer in search_layers that are
    mutually parallel (within angle_tol_deg), closely spaced
    (perpendicular distance <= thickness_tol_mm), and overlap along
    their shared run direction. Reference-axis convention: for any
    candidate pair, always use the lexicographically-lower-handle
    line's direction for the perpendicular-distance/overlap math, so
    the pairwise test is deterministic regardless of iteration order.
    """
    exclude_handles = exclude_handles or set()
    layer_set = set(search_layers)
    candidates = [
        e for e in scan_result.entities()
        if e.object_name == "AcDbLine"
        and e.layer in layer_set
        and e.handle not in exclude_handles
    ]
    if len(candidates) < min_lines:
        return []

    def _angle(e) -> float:
        dx = e.end[0] - e.start[0]
        dy = e.end[1] - e.start[1]
        return math.degrees(math.atan2(dy, dx)) % 180.0

    def _midpoint(e):
        return ((e.start[0] + e.end[0]) / 2.0, (e.start[1] + e.end[1]) / 2.0)

    def _connected(a, b) -> bool:
        ref, other = (a, b) if a.handle < b.handle else (b, a)
        angle_diff = abs(_angle(ref) - _angle(other))
        angle_diff = min(angle_diff, 180.0 - angle_diff)
        if angle_diff > angle_tol_deg:
            return False
        theta = math.radians(_angle(ref))
        ux, uy = math.cos(theta), math.sin(theta)  # ref direction (unit)
        nx, ny = -uy, ux  # normal to ref direction
        rx0, ry0 = ref.start
        # Perpendicular distance from other's midpoint to ref's line.
        mx, my = _midpoint(other)
        perp_dist = abs((mx - rx0) * nx + (my - ry0) * ny)
        if perp_dist > thickness_tol_mm:
            return False
        # Overlap check: project both segments onto ref's direction axis.
        def _proj_range(e):
            p0 = (e.start[0] - rx0) * ux + (e.start[1] - ry0) * uy
            p1 = (e.end[0] - rx0) * ux + (e.end[1] - ry0) * uy
            return (min(p0, p1), max(p0, p1))
        r_lo, r_hi = _proj_range(ref)
        o_lo, o_hi = _proj_range(other)
        return r_lo < o_hi and o_lo < r_hi

    # Union-Find clustering.
    parent = {c.handle: c.handle for c in candidates}

    def _find(h):
        while parent[h] != h:
            parent[h] = parent[parent[h]]
            h = parent[h]
        return h

    def _union(h1, h2):
        r1, r2 = _find(h1), _find(h2)
        if r1 != r2:
            parent[r2] = r1

    for i, a in enumerate(candidates):
        for b in candidates[i + 1:]:
            if _connected(a, b):
                _union(a.handle, b.handle)

    clusters: dict[str, list] = {}
    for c in candidates:
        clusters.setdefault(_find(c.handle), []).append(c)

    windows: list["_WindowEntity"] = []
    for members in clusters.values():
        if len(members) < min_lines:
            continue
        members_sorted = sorted(members, key=lambda e: e.handle)
        longest = max(members, key=lambda e: e.length)
        cx = sum(_midpoint(m)[0] for m in members) / len(members)
        cy = sum(_midpoint(m)[1] for m in members) / len(members)
        windows.append(
            _WindowEntity(
                handle=members_sorted[0].handle,
                layer=members_sorted[0].layer,
                position=(cx, cy),
                width=longest.length,
                block_name=None,
            )
        )
    return windows
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectParallelLineWindows -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Do NOT commit.**

---

### Task 2: `_detect_framed_windows`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add right after `_detect_parallel_line_windows`.
- Test: same test file, new `TestDetectFramedWindows` class.

- [ ] **Step 1: Write the failing tests**

```python
class TestDetectFramedWindows(unittest.TestCase):
    def test_frame_with_two_enclosed_lines_detected(self):
        frame = Entry(
            layer="DOOR", handle="F1", object_name="AcDbPolyline",
            # Axis-aligned rectangle, 300x240.
            coordinates=[0.0, 0.0, 300.0, 0.0, 300.0, 240.0, 0.0, 240.0, 0.0, 0.0],
        )
        inner1 = Entry(
            layer="DOOR", handle="F2", object_name="AcDbLine",
            start=(50.0, 80.0), end=(250.0, 80.0), length=200.0,
        )
        inner2 = Entry(
            layer="DOOR", handle="F3", object_name="AcDbLine",
            start=(50.0, 160.0), end=(250.0, 160.0), length=200.0,
        )
        scan_result = _make_scan_result({"DOOR": [frame, inner1, inner2]})
        windows, consumed = space._detect_framed_windows(scan_result, ["DOOR"])
        assert len(windows) == 1
        assert windows[0].handle == "F1"
        assert consumed == {"F2", "F3"}

    def test_frame_with_fewer_than_two_enclosed_lines_not_detected(self):
        frame = Entry(
            layer="DOOR", handle="F4", object_name="AcDbPolyline",
            coordinates=[0.0, 0.0, 300.0, 0.0, 300.0, 240.0, 0.0, 240.0, 0.0, 0.0],
        )
        inner1 = Entry(
            layer="DOOR", handle="F5", object_name="AcDbLine",
            start=(50.0, 80.0), end=(250.0, 80.0), length=200.0,
        )
        scan_result = _make_scan_result({"DOOR": [frame, inner1]})
        windows, consumed = space._detect_framed_windows(scan_result, ["DOOR"])
        assert windows == []
        assert consumed == set()
```

Check `Entry`'s actual field name for polyline vertex coordinates (likely `coordinates`, matching the door work's polyline-based fields) before finalizing — adjust the fixture field name if it differs.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectFramedWindows -v`
Expected: FAIL — function doesn't exist.

- [ ] **Step 3: Implement `_detect_framed_windows`**

Add to `space.py`, right after `_detect_parallel_line_windows`:

```python
def _detect_framed_windows(
    scan_result: "ModelSpaceScanResult", search_layers: list[str]
) -> tuple[list["WindowEntity"], set[str]]:
    """Type-2 pattern: a rectangular/bracket-shaped polyline enclosing
    >=2 AcDbLine entries (same search_layers). Returns (windows,
    consumed_line_handles) -- the consumed set lets the caller exclude
    these lines from _detect_parallel_line_windows so they aren't
    double-counted as an unframed cluster.
    """
    layer_set = set(search_layers)
    lines = [
        e for e in scan_result.entities()
        if e.object_name == "AcDbLine" and e.layer in layer_set
    ]
    frames = [
        e for e in scan_result.entities()
        if e.object_name in ("AcDbPolyline", "AcDb2dPolyline")
        and e.layer in layer_set
        and e.coordinates and 8 <= len(e.coordinates) <= 16
    ]

    windows: list["_WindowEntity"] = []
    consumed: set[str] = set()
    for frame in frames:
        xs = frame.coordinates[0::2]
        ys = frame.coordinates[1::2]
        x_min, x_max = min(xs), max(xs)
        y_min, y_max = min(ys), max(ys)
        enclosed = [
            ln for ln in lines
            if x_min <= (ln.start[0] + ln.end[0]) / 2.0 <= x_max
            and y_min <= (ln.start[1] + ln.end[1]) / 2.0 <= y_max
        ]
        if len(enclosed) < 2:
            continue
        width = max(x_max - x_min, y_max - y_min)
        windows.append(
            _WindowEntity(
                handle=frame.handle, layer=frame.layer,
                position=((x_min + x_max) / 2.0, (y_min + y_max) / 2.0),
                width=width, block_name=None,
            )
        )
        consumed.update(ln.handle for ln in enclosed)
    return windows, consumed
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectFramedWindows -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Do NOT commit.**

---

### Task 3: Sidecar schema + wiring into `handle_extract_cad_objects`

**Files:**
- Modify: `memory/drawings/` reference sidecar JSON (add `search_layers` to `window_patterns`' 3 entries).
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` (extend the existing `if patterns is not None:` block).
- Test: same test file, new integration tests.

- [ ] **Step 1: Update the sidecar JSON**

Add `"search_layers": ["DOOR"]` to `type_1_horizontal_parallel_lines` and `type_2_framed_parallel_lines`, and `"search_layers": ["DOOR"]` to `type_3_vertical_parallel_lines` (it already has a `confidence_note` field — keep it, just add `search_layers` alongside it). Validate via `json.load` after editing.

- [ ] **Step 2: Write the failing integration tests**

```python
def test_handle_extract_cad_objects_sidecar_overwrites_windows(tmp_path):
    sidecar_path = tmp_path / "test.door-window-patterns.json"
    sidecar_path.write_text(
        json.dumps({
            "door_patterns": {},
            "window_patterns": {
                "type_1_horizontal_parallel_lines": {"search_layers": ["DOOR"]},
                "type_2_framed_parallel_lines": {"search_layers": []},
                "type_3_vertical_parallel_lines": {"search_layers": []},
            },
        }),
        encoding="utf-8",
    )
    mock_bridge = MagicMock()
    mock_doc = MagicMock()
    mock_doc.Name = "test.dwg"
    mock_doc.ModelSpace.Count = 0
    mock_bridge.app.ActiveDocument = mock_doc

    l1 = Entry(layer="DOOR", handle="W1", object_name="AcDbLine",
               start=(0.0, 0.0), end=(1000.0, 0.0), length=1000.0)
    l2 = Entry(layer="DOOR", handle="W2", object_name="AcDbLine",
               start=(0.0, 440.0), end=(1000.0, 440.0), length=1000.0)
    old_window_block = Entry(layer="WIN", handle="OLDWIN", object_name="AcDbBlockReference",
                              position=(0.0, 0.0), rotation=0.0, block_name="W900")
    scan_result = _make_scan_result({"DOOR": [l1, l2], "WIN": [old_window_block]})
    fake_layers = [{"name": "DOOR", "classification": "door"}, {"name": "WIN", "classification": "window"}]

    with (
        patch.object(space, "_get_bridge", return_value=mock_bridge),
        patch.object(space, "scan_modelspace", return_value=scan_result),
        patch.object(space, "handle_classify_layers") as mock_classify,
        patch.object(space, "_load_door_window_patterns",
                     return_value=json.loads(sidecar_path.read_text(encoding="utf-8"))),
    ):
        mock_classify.return_value.data = {"layers": fake_layers}
        result = space.handle_extract_cad_objects({})

    windows = result.data["windows"]
    handles = {w["handle"] for w in windows}
    assert "W1" in handles
    assert "OLDWIN" not in handles


def test_handle_extract_cad_objects_doors_only_sidecar_leaves_windows_unchanged():
    """Regression: a sidecar with door_patterns but no window_patterns
    key must NOT touch windows (guards the PR #171-era sidecar shape)."""
    mock_bridge = MagicMock()
    mock_doc = MagicMock()
    mock_doc.Name = "test.dwg"
    mock_doc.ModelSpace.Count = 0
    mock_bridge.app.ActiveDocument = mock_doc

    old_window_block = Entry(layer="WIN", handle="OLDWIN", object_name="AcDbBlockReference",
                              position=(0.0, 0.0), rotation=0.0, block_name="W900")
    scan_result = _make_scan_result({"WIN": [old_window_block]})
    fake_layers = [{"name": "WIN", "classification": "window"}]

    with (
        patch.object(space, "_get_bridge", return_value=mock_bridge),
        patch.object(space, "scan_modelspace", return_value=scan_result),
        patch.object(space, "handle_classify_layers") as mock_classify,
        patch.object(space, "_load_door_window_patterns",
                     return_value={"door_patterns": {}}),  # no window_patterns key
    ):
        mock_classify.return_value.data = {"layers": fake_layers}
        result = space.handle_extract_cad_objects({})

    windows = result.data["windows"]
    assert len(windows) == 1
    assert windows[0]["handle"] == "OLDWIN"
```

Before finalizing, verify against the real `handle_extract_cad_objects` whether the existing windows-extraction path (block/sleeve heuristic) would actually produce exactly this "OLDWIN" entry from the given `Entry` fixture — adjust the fixture if needed to match the real heuristic's expected input shape (same verification style used in the door plan's Task 5).

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py -v -k "sidecar_overwrites_windows or doors_only_sidecar"`
Expected: FAIL — window override not wired yet.

- [ ] **Step 4: Wire the window override into `handle_extract_cad_objects`**

Locate the existing door sidecar-override block (search `if patterns is not None:`). Immediately after the existing door-detector calls within that block (but still inside `if patterns is not None:`), add:

```python
        window_patterns = patterns.get("window_patterns", {})
        if window_patterns:
            t1 = window_patterns.get("type_1_horizontal_parallel_lines") or {}
            t3 = window_patterns.get("type_3_vertical_parallel_lines") or {}
            parallel_layers = sorted(
                set(t1.get("search_layers") or []) | set(t3.get("search_layers") or [])
            )
            t2 = window_patterns.get("type_2_framed_parallel_lines") or {}

            sidecar_windows: list["_WindowEntity"] = []
            consumed_handles: set[str] = set()
            if t2.get("search_layers"):
                framed, consumed_handles = _detect_framed_windows(
                    scan_result, t2["search_layers"]
                )
                sidecar_windows.extend(framed)
            if parallel_layers:
                sidecar_windows.extend(
                    _detect_parallel_line_windows(
                        scan_result, parallel_layers, exclude_handles=consumed_handles
                    )
                )
            windows = [w.to_dict() for w in sidecar_windows]
```

The outer `if patterns is not None:` gate already exists from PR #171; the inner `if window_patterns:` gate is what's new here, and is what makes Task 3's second regression test pass (doors-only sidecar → `window_patterns` is `{}` → falsy → `windows` untouched).

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py -v -k "sidecar_overwrites_windows or doors_only_sidecar"`
Expected: PASS (2 tests).

- [ ] **Step 6: Full regression**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py -v`
Expected: PASS (13 existing door tests + 6 parallel-line + 2 framed + 2 integration = 23 tests).

Run: `python -m pytest tests/ -q` (full suite).
Expected: PASS, no regressions.

- [ ] **Step 7: Do NOT commit.**

---

### Task 4: CHANGELOG entry

- [ ] Add an `[Unreleased]` → `### Added` entry describing the window detector addition, mirroring the door PR's CHANGELOG style, referencing this spec/plan and PR #171's precedent. No commit — `/sync` handles it.

---

### Task 5: Manual real-drawing verification

- [ ] Call `handle_extract_cad_objects` (or `zwcad_extract_cad_objects`) against the live "아파트 평면도.dwg" drawing (already open per this session).
- [ ] Confirm 5 or 6 windows are detected, matching the sidecar's `verified_totals.windows` note.
- [ ] If the Type-3 flagged instance is detected, confirm a `WINDOW_PATTERN_UNCONFIRMED` exception is surfaced alongside it.
- [ ] Report any discrepancy rather than silently accepting a different count.

No code change in this task — verification only.

---

## Post-Plan Note

After this plan and its CHANGELOG entry land via `/sync`, proceed to the user's second request: run `handle_generate_spaces` with `wall_processing_mode="solid_union"` against the same live drawing's extracted walls/doors/windows, and compare the resulting room count/geometry against the default `ENDPOINT_CLUSTER` output — a verification task, not a code change (SOLID_UNION wiring already shipped in PR #174).
