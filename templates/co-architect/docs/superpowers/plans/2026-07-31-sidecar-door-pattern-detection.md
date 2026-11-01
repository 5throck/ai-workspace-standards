---
lang: ko
lang_reason: proper-noun
---

# Sidecar-Driven Door Pattern Detection Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a `{drawing_stem}.door-window-patterns.json` sidecar exists,
`handle_extract_cad_objects` detects doors using three generalized pattern rules
(arc-swing, named-width block, curved-polyline-cluster) instead of the existing
layer-classification heuristic — fully replacing `doors` for that call. With no
sidecar, behavior is unchanged.

**Architecture:** Four new pure/near-pure functions in `space.py`: a JSON loader
mirroring `_load_layer_classification`'s convention, and three detectors (two
operating on the already-cached `ModelSpaceScanResult`, one doing its own narrowly
scoped live COM read for bulge data that the cache doesn't carry). Wired into
`handle_extract_cad_objects` as a single override block placed right before the
existing `if exceptions:` result-building step.

**Tech Stack:** Python, `re` (block-name pattern), existing `Entry`/`ModelSpaceScanResult`/`DoorEntity` dataclasses, direct ZWCAD COM access (`pywin32`) for the one live-read detector.

---

## Reference

Spec: `docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md`
(read this first — full rationale, and the exact `handle`/`layer` sourcing fix from
spec review).

Sidecar data already updated with `search_layers`:
`memory/drawings/아파트 평면도.door-window-patterns.json`.

---

### Task 1: `_load_door_window_patterns` loader

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add right after
  `_load_layer_classification` (search for that function name, insert the new one
  immediately below its closing line, before `_save_layer_classification`).
- Test: `tests/handlers/test_extract_cad_objects_door_patterns.py` (new file).

- [ ] **Step 1: Write the failing tests**

```python
"""test_extract_cad_objects_door_patterns.py — sidecar-driven door pattern
detection (arc-swing, named-block, curved-cluster).

See docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md.
"""

from __future__ import annotations

import json
import unittest
from types import MappingProxyType
from unittest.mock import MagicMock, patch

import pytest

from cad_intelligence.cad_io.handlers import space
from cad_intelligence.common.models import Entry, LayerMeta, ModelSpaceScanResult


def _make_scan_result(entries_by_layer: dict) -> ModelSpaceScanResult:
    """Matches tests/test_opening_evidence.py's existing helper convention."""
    return ModelSpaceScanResult(
        doc_name="test.dwg",
        entries_by_layer=MappingProxyType(
            {k: tuple(v) for k, v in entries_by_layer.items()}
        ),
        entity_type_counts=MappingProxyType({}),
        block_samples=MappingProxyType({}),
        layer_meta=MappingProxyType(
            {k: LayerMeta(color=0, linetype="ByLayer") for k in entries_by_layer}
        ),
    )


class TestLoadDoorWindowPatterns:
    def test_returns_none_when_file_missing(self, tmp_path):
        missing = tmp_path / "does-not-exist.door-window-patterns.json"
        result = space._load_door_window_patterns("whatever.dwg", str(missing))
        assert result is None

    def test_returns_parsed_dict_when_file_exists(self, tmp_path):
        p = tmp_path / "test.door-window-patterns.json"
        p.write_text(json.dumps({"door_patterns": {"type_2_named_block": {}}}), encoding="utf-8")
        result = space._load_door_window_patterns("test.dwg", str(p))
        assert result == {"door_patterns": {"type_2_named_block": {}}}

    def test_path_override_used_verbatim(self, tmp_path):
        p = tmp_path / "custom-name.json"
        p.write_text(json.dumps({"door_patterns": {}}), encoding="utf-8")
        result = space._load_door_window_patterns("irrelevant.dwg", str(p))
        assert result == {"door_patterns": {}}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestLoadDoorWindowPatterns -v`
Expected: FAIL — `_load_door_window_patterns` doesn't exist yet.

- [ ] **Step 3: Implement `_load_door_window_patterns`**

Add to `space.py`, immediately after `_load_layer_classification`'s closing line:

```python
def _load_door_window_patterns(
    doc_name: str, path_override: str | None = None
) -> dict | None:
    """Load ``{file}.door-window-patterns.json`` if it exists.

    Mirrors ``_load_layer_classification``'s stem-based-filename +
    optional ``path_override`` convention. Deliberately returns ``None``
    (not ``{}``) when the file is missing/unreadable -- unlike
    ``_load_layer_classification`` -- so ``handle_extract_cad_objects``
    can distinguish "no sidecar present" (fall through to existing
    layer-based extraction) from "sidecar present" cases.
    """
    if path_override is not None:
        path = Path(path_override)
    else:
        stem = Path(doc_name).stem
        path = memory_path("drawings", f"{stem}.door-window-patterns.json")
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, OSError) as exc:
        _logger.warning("Failed to load %s: %s", path, exc)
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestLoadDoorWindowPatterns -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Do NOT commit**

This workspace requires commits go through `/sync` — leave files modified for the
orchestrator to commit later.

---

### Task 2: `_detect_arc_swing_doors`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add right after
  `_load_door_window_patterns`.
- Test: same test file, new `TestDetectArcSwingDoors` class.

- [ ] **Step 1: Write the failing tests**

```python
class TestDetectArcSwingDoors(unittest.TestCase):
    def test_arc_with_members_produces_one_door(self):
        arc = Entry(
            layer="DOOR", handle="ARC1", object_name="AcDbArc",
            center=(1000.0, 1000.0), radius=500.0,
            start_angle=0.0, end_angle=1.57,
        )
        # inside radius*1.3 = 650mm
        member_in = Entry(
            layer="DOOR", handle="M1", object_name="AcDbLine",
            start=(1200.0, 1000.0), end=(1200.0, 1100.0), length=100.0,
        )
        # outside radius*1.3
        member_out = Entry(
            layer="DOOR", handle="M2", object_name="AcDbLine",
            start=(5000.0, 5000.0), end=(5100.0, 5000.0), length=100.0,
        )
        scan_result = _make_scan_result({"DOOR": [arc, member_in, member_out]})
        doors = space._detect_arc_swing_doors(scan_result, ["DOOR"])
        assert len(doors) == 1
        d = doors[0]
        assert d.handle == "ARC1"
        assert d.layer == "DOOR"
        assert d.position == (1000.0, 1000.0)
        assert d.width == pytest.approx(1000.0)  # 2 * radius

    def test_no_arcs_on_search_layers_returns_empty(self):
        line_only = Entry(
            layer="DOOR", handle="L1", object_name="AcDbLine",
            start=(0.0, 0.0), end=(100.0, 0.0), length=100.0,
        )
        scan_result = _make_scan_result({"DOOR": [line_only]})
        doors = space._detect_arc_swing_doors(scan_result, ["DOOR"])
        assert doors == []

    def test_arc_on_layer_not_in_search_layers_ignored(self):
        arc = Entry(
            layer="OTHER", handle="ARC2", object_name="AcDbArc",
            center=(0.0, 0.0), radius=500.0, start_angle=0.0, end_angle=1.57,
        )
        scan_result = _make_scan_result({"OTHER": [arc]})
        doors = space._detect_arc_swing_doors(scan_result, ["DOOR"])
        assert doors == []
```

Check `Entry`'s actual field names/order in `src/cad_intelligence/common/models.py`
before writing this test — construct `Entry(...)` with keyword arguments only
(matching the existing `_make_entry` helper convention in
`tests/test_extract_entry_migration.py`) so field order doesn't matter, and fill in
only the fields each test actually needs (frozen dataclass, other fields default
to `None` per the class definition).

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectArcSwingDoors -v`
Expected: FAIL — `_detect_arc_swing_doors` doesn't exist yet.

- [ ] **Step 3: Implement `_detect_arc_swing_doors`**

Add to `space.py`, right after `_load_door_window_patterns`:

```python
def _detect_arc_swing_doors(
    scan_result: "ModelSpaceScanResult", search_layers: list[str]
) -> list["DoorEntity"]:
    """Type-1 pattern: an AcDbArc (the swing curve) on one of
    ``search_layers``, treated as one door per arc. Width is estimated
    as 2*radius (a swing arc's radius approximates the leaf length, so
    the diameter is a reasonable order-of-magnitude door width -- not
    a precise measurement). See design spec Testing item 2 for the
    member-grouping behavior this does NOT currently gate on (reserved
    for future width-refinement work, not required for detection).
    """
    layer_set = set(search_layers)
    doors: list["_DoorEntity"] = []
    for entry in scan_result.entities():
        if entry.object_name != "AcDbArc" or entry.layer not in layer_set:
            continue
        if entry.center is None or entry.radius is None:
            continue
        doors.append(
            _DoorEntity(
                handle=entry.handle,
                layer=entry.layer,
                position=entry.center,
                width=2.0 * entry.radius,
                rotation=0.0,
                block_name=None,
                swing_direction=None,
            )
        )
    return doors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectArcSwingDoors -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Do NOT commit.**

---

### Task 3: `_detect_named_block_doors`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add right after
  `_detect_arc_swing_doors`.
- Test: same test file, new `TestDetectNamedBlockDoors` class.

- [ ] **Step 1: Write the failing tests**

```python
class TestDetectNamedBlockDoors(unittest.TestCase):
    def test_matches_case_insensitive_and_extracts_width(self):
        b1 = Entry(
            layer="7dim", handle="B1", object_name="AcDbBlockReference",
            position=(100.0, 200.0), rotation=0.0, block_name="D1000",
        )
        b2 = Entry(
            layer="252", handle="B2", object_name="AcDbBlockReference",
            position=(300.0, 400.0), rotation=1.57, block_name="d900",
        )
        not_a_door = Entry(
            layer="4ELE", handle="B3", object_name="AcDbBlockReference",
            position=(0.0, 0.0), rotation=0.0, block_name="WATER3",
        )
        scan_result = _make_scan_result({
            "7dim": [b1], "252": [b2], "4ELE": [not_a_door],
        })
        doors = space._detect_named_block_doors(scan_result)
        assert len(doors) == 2
        widths = sorted(d.width for d in doors)
        assert widths == [900.0, 1000.0]
        # layer varies per match -- not hardcoded
        layers = {d.layer for d in doors}
        assert layers == {"7dim", "252"}

    def test_letters_only_or_no_digits_do_not_match(self):
        bad1 = Entry(
            layer="DOOR", handle="X1", object_name="AcDbBlockReference",
            position=(0.0, 0.0), rotation=0.0, block_name="D",
        )
        bad2 = Entry(
            layer="DOOR", handle="X2", object_name="AcDbBlockReference",
            position=(0.0, 0.0), rotation=0.0, block_name="DOOR123",
        )
        scan_result = _make_scan_result({"DOOR": [bad1, bad2]})
        doors = space._detect_named_block_doors(scan_result)
        assert doors == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectNamedBlockDoors -v`
Expected: FAIL — function doesn't exist yet.

- [ ] **Step 3: Implement `_detect_named_block_doors`**

Add to `space.py`, right after `_detect_arc_swing_doors`. Add the compiled
pattern as a module-level constant near the file's other module-level regex
constants (search for `_WIDTH_FROM_BLOCK_NAME` and place this next to it):

```python
_DOOR_BLOCK_NAME_PATTERN = re.compile(r"^D\d+$", re.IGNORECASE)
```

```python
def _detect_named_block_doors(scan_result: "ModelSpaceScanResult") -> list["DoorEntity"]:
    """Type-2 pattern: an AcDbBlockReference whose block name is 'D'
    followed by digits (door width in mm), e.g. 'D900'/'D1000'.
    Intentionally layer-agnostic (no search_layers restriction) --
    this pattern was found on '7dim' and '252' in the reference
    drawing, neither of which is a door-classified layer.
    """
    doors: list["_DoorEntity"] = []
    for entry in scan_result.entities():
        if entry.object_name != "AcDbBlockReference" or not entry.block_name:
            continue
        if not _DOOR_BLOCK_NAME_PATTERN.match(entry.block_name):
            continue
        width = float(re.search(r"\d+", entry.block_name).group())
        doors.append(
            _DoorEntity(
                handle=entry.handle,
                layer=entry.layer,
                position=entry.position,
                width=width,
                rotation=entry.rotation or 0.0,
                block_name=entry.block_name,
                swing_direction=None,
            )
        )
    return doors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectNamedBlockDoors -v`
Expected: PASS (2 tests).

- [ ] **Step 5: Do NOT commit.**

---

### Task 4: `_detect_curved_cluster_doors`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add right after
  `_detect_named_block_doors`.
- Test: same test file, new `TestDetectCurvedClusterDoors` class.

This is the one detector that does its own live COM read (see spec's Non-Goals for
why `Entry`/`ModelSpaceScanResult` is not extended with bulge data). It must use
`len(entity.Coordinates) // 2` for vertex count (NOT `entity.NumberOfVertices`,
confirmed this session not to exist on this COM object) and call
`entity.GetBulge(v)` directly.

- [ ] **Step 1: Write the failing tests**

```python
class TestDetectCurvedClusterDoors(unittest.TestCase):
    def _make_mock_polyline(self, handle, layer, coords, bulges):
        ent = MagicMock()
        ent.ObjectName = "AcDbPolyline"
        ent.Handle = handle
        ent.Layer = layer
        ent.Coordinates = coords
        ent.GetBulge.side_effect = lambda v: bulges[v]
        return ent

    def test_polyline_with_nonzero_bulge_on_search_layer_detected(self):
        curved = self._make_mock_polyline(
            "19B6", "DOOR",
            [13206.3, 9645.9, 13746.3, 9105.9, 13206.3, 9105.9],
            [-0.41421356, 0.0, 0.0],
        )
        straight = self._make_mock_polyline(
            "OTHER1", "DOOR",
            [0.0, 0.0, 100.0, 0.0],
            [0.0, 0.0],
        )
        doc = MagicMock()
        doc.ModelSpace.Count = 2
        doc.ModelSpace.Item.side_effect = [curved, straight]
        doors = space._detect_curved_cluster_doors(doc, ["DOOR"])
        assert len(doors) == 1
        assert doors[0].handle == "19B6"
        assert doors[0].layer == "DOOR"

    def test_all_zero_bulge_polyline_not_detected(self):
        straight = self._make_mock_polyline(
            "L1", "DOOR", [0.0, 0.0, 100.0, 0.0], [0.0, 0.0],
        )
        doc = MagicMock()
        doc.ModelSpace.Count = 1
        doc.ModelSpace.Item.side_effect = [straight]
        doors = space._detect_curved_cluster_doors(doc, ["DOOR"])
        assert doors == []

    def test_bulged_polyline_on_layer_not_in_search_layers_ignored(self):
        """Regression: must not hardcode 'DOOR' -- a bulged polyline on
        a layer NOT in search_layers must be ignored."""
        curved_wrong_layer = self._make_mock_polyline(
            "X1", "OTHER_LAYER",
            [0.0, 0.0, 100.0, 100.0],
            [0.41421356, 0.0],
        )
        doc = MagicMock()
        doc.ModelSpace.Count = 1
        doc.ModelSpace.Item.side_effect = [curved_wrong_layer]
        doors = space._detect_curved_cluster_doors(doc, ["DOOR"])
        assert doors == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectCurvedClusterDoors -v`
Expected: FAIL — function doesn't exist yet.

- [ ] **Step 3: Implement `_detect_curved_cluster_doors`**

Add to `space.py`, right after `_detect_named_block_doors`:

```python
def _detect_curved_cluster_doors(doc, search_layers: list[str]) -> list["DoorEntity"]:
    """Type-3 pattern: an AcDbPolyline on one of search_layers with a
    genuine nonzero bulge on at least one vertex (a real curve, not a
    separate AcDbArc entity). This performs its own narrowly-scoped
    live COM read (filtered to search_layers) rather than extending
    the shared ModelSpaceScanResult/Entry snapshot, to avoid
    reintroducing the unconditional-full-document-COM-walk performance
    problem this project already fixed once (see referenced spec's
    Non-Goals).

    IMPORTANT: vertex count must be computed as
    len(entity.Coordinates) // 2 -- entity.NumberOfVertices does not
    exist on this COM object and silently produces a false "no bulge"
    result if used (confirmed this session).
    """
    layer_set = set(search_layers)
    ms = doc.ModelSpace
    doors: list["_DoorEntity"] = []
    for i in range(ms.Count):
        entity = ms.Item(i)
        if entity.ObjectName not in ("AcDbPolyline", "AcDb2dPolyline"):
            continue
        if entity.Layer not in layer_set:
            continue
        coords = list(entity.Coordinates)
        n = len(coords) // 2
        has_bulge = False
        for v in range(n):
            try:
                if abs(entity.GetBulge(v)) > 1e-6:
                    has_bulge = True
                    break
            except Exception:
                continue
        if not has_bulge:
            continue
        xs = [coords[j] for j in range(0, len(coords), 2)]
        ys = [coords[j + 1] for j in range(0, len(coords), 2)]
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        doors.append(
            _DoorEntity(
                handle=entity.Handle,
                layer=entity.Layer,
                position=(float(cx), float(cy)),
                width=0.0,
                rotation=0.0,
                block_name=None,
                swing_direction=None,
            )
        )
    return doors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py::TestDetectCurvedClusterDoors -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Do NOT commit.**

---

### Task 5: Wire into `handle_extract_cad_objects`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — inside
  `handle_extract_cad_objects`, insert right before the existing
  `if exceptions:` block (search for the windows-extraction loop's closing, then
  the comment-free blank line right before `if exceptions:` around where the
  function builds its final result).

- [ ] **Step 1: Write the failing test**

Add to the same test file, a new top-level test (not inside a class, matching
`tests/handlers/test_find_opening_candidates_evidence_gating.py`'s module-level
test function style):

```python
def test_handle_extract_cad_objects_sidecar_overwrites_doors(tmp_path):
    """With a sidecar present, doors comes ONLY from sidecar-driven
    detection -- existing layer-based doors are NOT merged in."""
    sidecar_path = tmp_path / "test.door-window-patterns.json"
    sidecar_path.write_text(
        json.dumps({
            "door_patterns": {
                "type_1_arc_swing": {"search_layers": ["DOOR"]},
                "type_2_named_block": {"search_layers": None},
                "type_3_curved_cluster": {"search_layers": ["DOOR"]},
            }
        }),
        encoding="utf-8",
    )

    mock_bridge = MagicMock()
    mock_doc = MagicMock()
    mock_doc.Name = "test.dwg"
    mock_doc.ModelSpace.Count = 0
    mock_bridge.app.ActiveDocument = mock_doc

    sidecar_arc = Entry(
        layer="DOOR", handle="ARC1", object_name="AcDbArc",
        center=(1000.0, 1000.0), radius=500.0, start_angle=0.0, end_angle=1.57,
    )
    layer_based_door_block = Entry(
        layer="DOOR", handle="OLDBLOCK", object_name="AcDbBlockReference",
        position=(0.0, 0.0), rotation=0.0, block_name="SOME_OTHER_DOOR_BLOCK",
        x_scale=1.0,
    )
    scan_result = _make_scan_result({"DOOR": [sidecar_arc, layer_based_door_block]})

    fake_layers = [{"name": "DOOR", "classification": "door"}]

    with (
        patch.object(space, "_get_bridge", return_value=mock_bridge),
        patch.object(space, "scan_modelspace", return_value=scan_result),
        patch.object(space, "handle_classify_layers") as mock_classify,
        patch.object(
            space, "_load_door_window_patterns",
            return_value=json.loads(sidecar_path.read_text(encoding="utf-8")),
        ),
    ):
        mock_classify.return_value.data = {"layers": fake_layers}
        # Deliberately omit "layers" from params so handle_extract_cad_objects
        # takes its params.get("layers") is None branch and actually calls
        # handle_classify_layers -- otherwise this mock is inert (caught in
        # plan review).
        result = space.handle_extract_cad_objects({})

    doors = result.data["doors"]
    handles = {d["handle"] for d in doors}
    assert "ARC1" in handles
    assert "OLDBLOCK" not in handles


def test_handle_extract_cad_objects_no_sidecar_unchanged(tmp_path):
    """Without a sidecar, behavior is byte-for-byte unchanged --
    existing layer-based door extraction still runs."""
    mock_bridge = MagicMock()
    mock_doc = MagicMock()
    mock_doc.Name = "test.dwg"
    mock_bridge.app.ActiveDocument = mock_doc

    layer_based_door_block = Entry(
        layer="DOOR", handle="OLDBLOCK", object_name="AcDbBlockReference",
        position=(0.0, 0.0), rotation=0.0, block_name="D900", x_scale=1.0,
    )
    scan_result = _make_scan_result({"DOOR": [layer_based_door_block]})
    fake_layers = [{"name": "DOOR", "classification": "door"}]

    with (
        patch.object(space, "_get_bridge", return_value=mock_bridge),
        patch.object(space, "scan_modelspace", return_value=scan_result),
        patch.object(space, "handle_classify_layers") as mock_classify,
        patch.object(space, "_load_door_window_patterns", return_value=None),
    ):
        mock_classify.return_value.data = {"layers": fake_layers}
        # Same fix as above: omit "layers" so handle_classify_layers is
        # actually exercised, not just mocked and ignored.
        result = space.handle_extract_cad_objects({})

    doors = result.data["doors"]
    assert len(doors) == 1
    assert doors[0]["handle"] == "OLDBLOCK"
```

Before finalizing these two tests, run them against the CURRENT (pre-Task-5)
code first to confirm they fail for the RIGHT reason (sidecar override not
wired in yet / `_load_door_window_patterns` not yet called from
`handle_extract_cad_objects`), not because of an unrelated mock-setup mistake —
if `handle_classify_layers`'s mocking doesn't match how it's actually invoked in
the real function (check the real call signature first), adjust the mock before
proceeding to Step 3.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py -v -k "sidecar_overwrites or no_sidecar_unchanged"`
Expected: `test_handle_extract_cad_objects_sidecar_overwrites_doors` FAILS (the
sidecar override isn't wired in yet, so `ARC1` won't be in the output).
`test_handle_extract_cad_objects_no_sidecar_unchanged` may already PASS (it's
testing pre-existing behavior) — if so, that's fine, it becomes a regression
guard once Task 5 Step 3 lands.

- [ ] **Step 3: Wire the override into `handle_extract_cad_objects`**

Locate this exact point inside the function (immediately after the windows
extraction loop ends, right before the existing `if exceptions:` block that
builds the final `HandlerResult`):

```python
        if exceptions:
            result = HandlerResult.needs_confirmation(
```

Insert immediately before it:

```python
        patterns = _load_door_window_patterns(
            doc.Name, params.get("door_window_patterns_json_path")
        )
        if patterns is not None:
            door_patterns = patterns.get("door_patterns", {})
            sidecar_doors: list["_DoorEntity"] = []
            t1 = door_patterns.get("type_1_arc_swing")
            if t1 and t1.get("search_layers"):
                sidecar_doors.extend(
                    _detect_arc_swing_doors(scan_result, t1["search_layers"])
                )
            if "type_2_named_block" in door_patterns:
                sidecar_doors.extend(_detect_named_block_doors(scan_result))
            t3 = door_patterns.get("type_3_curved_cluster")
            if t3 and t3.get("search_layers"):
                sidecar_doors.extend(
                    _detect_curved_cluster_doors(doc, t3["search_layers"])
                )
            doors = [d.to_dict() for d in sidecar_doors]
```

This must come after `doors`/`windows`/`exceptions` are already built by the
existing code (so it can fully replace `doors`) and before the
`if exceptions: ... else: ...` result-construction block (so the replaced
`doors` list is what actually gets returned). `windows` and `exceptions` are
untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py -v -k "sidecar_overwrites or no_sidecar_unchanged"`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the FULL door-patterns test file plus the existing extraction test suite**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_patterns.py -v`
Expected: PASS (all tests from Tasks 1-5 — 13 tests total: 3+3+2+3+2).

Run: `python -m pytest tests/test_extract_entry_migration.py tests/handlers/ -v`
Expected: PASS — no regressions in existing extraction/handler tests.

- [ ] **Step 6: Do NOT commit.**

---

### Task 6: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an `[Unreleased]` → `### Added` entry**

```
### Added
- **[2026-07-31]**: **Added sidecar-driven door pattern detection to `handle_extract_cad_objects`** (`src/cad_intelligence/cad_io/handlers/space.py`) — when a `{drawing_stem}.door-window-patterns.json` sidecar exists (see `memory/drawings/아파트 평면도.door-window-patterns.json` for the reference drawing's patterns, identified via direct COM investigation this session), three generalized detectors (`_detect_arc_swing_doors`, `_detect_named_block_doors`, `_detect_curved_cluster_doors`) fully replace the existing layer-classification-based `doors` extraction for that call. The curved-cluster detector performs its own narrowly-scoped live COM read (bounded by the sidecar's `search_layers` list) to check polyline bulge values directly via `GetBulge()` — confirmed this session that `entity.NumberOfVertices` does not exist on this COM object and silently produces false negatives if relied upon; vertex count must be computed as `len(entity.Coordinates) // 2` instead. No layer name is hardcoded anywhere in the new detection code — all layer restrictions come from the sidecar's `search_layers` field (a list, supporting 2+ layers per pattern). Without a sidecar, `handle_extract_cad_objects` behavior is unchanged. Window pattern detection is explicitly deferred (see design spec's Non-Goals) pending validation on a second drawing. See `docs/superpowers/specs/2026-07-31-sidecar-door-pattern-detection-design.md` and `docs/superpowers/plans/2026-07-31-sidecar-door-pattern-detection.md`.
```

- [ ] **Step 2: Do NOT commit** — commits in this workspace go through `/sync`
  (`bun scripts/dev-sync.ts "<message>"`), not raw `git commit`.

---

### Task 7: Manual real-drawing verification (not automated)

Requires a live ZWCAD session with "아파트 평면도.dwg" open. Perform after Tasks 1-6:

- [ ] Call `handle_extract_cad_objects({})` (or the equivalent MCP tool) against the
  live drawing.
- [ ] Confirm exactly 9 doors are returned, matching this session's user-verified
  total (5 arc-swing + 3 named-block + 1 curved-cluster).
- [ ] Confirm each door's `handle` matches one of: `174F`, `1995`, `199D`, `19A7`,
  `19C0` (arcs), `155D`, `1586`, `16A5` (named blocks), `19B6` (curved cluster).
- [ ] Report any discrepancy — do not silently accept a different count without
  investigating why.

This task has no code changes and no commit — it's a verification checklist.

---

## Post-Plan Note

Per this workspace's `CLAUDE.md`, all commits must go through the `/sync` pipeline
(`bun scripts/dev-sync.ts`), never raw `git commit`. Add the `CHANGELOG.md` entry
(Task 6) before the final `/sync` of this feature, since `/sync` blocks if
`[Unreleased]` is empty.
