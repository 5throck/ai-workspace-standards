---
lang: ko
lang_reason: proper-noun
---

# `zwcad_extract_text_labels` Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new MCP tool `zwcad_extract_text_labels` returning text content + position of `AcDbText`/`AcDbMText` entities on caller-specified layers, so room-name labels (e.g. on layer `7TXT`) can be correlated with detected rooms/doors/windows.

**Architecture:** One new handler function `handle_extract_text_labels` in `src/cad_intelligence/cad_io/handlers/space.py`, registered via the existing `@register_tool(default_registry, ...)` decorator pattern (same as `handle_extract_cad_objects`). Does its own live COM read (`doc.ModelSpace`, `ms.Count`/`ms.Item(i)` iteration) mirroring `_detect_curved_cluster_doors`'s style, since no shared cache carries text content today.

**Tech Stack:** Python, existing `HandlerResult`/`register_tool`/`default_registry`/`_get_bridge`/`ZWCADConnectionError` machinery already used by every other handler in this file.

---

## Reference

Spec (approved, 1 addition required and applied): `docs/superpowers/specs/2026-07-31-extract-text-labels-design.md`

Key verified facts (from spec review):
- `register_tool`/`default_registry` imported at `space.py:60`.
- `_get_bridge`, `ZWCADConnectionError`, `_PYWIN32_AVAILABLE`, `_STUB_MSG` already module-scope in `space.py` (used at `handle_extract_cad_objects` and `_detect_curved_cluster_doors`).
- `HandlerResult.success(**payload)` (`common.py:97-108`) merges kwargs straight into `.data` — `text_labels=labels` is a safe key, no restriction.
- `_detect_curved_cluster_doors` (`space.py:414-465`) is the exact COM-iteration style to mirror: `ms.Count`/`ms.Item(i)` loop, try/except around a COM property read that might be fragile.
- `com_bridge.py` has an older, apparently-unregistered duplicate `handle_extract_cad_objects` from a prior architecture generation — confirmed out of scope, not touched by this plan.
- **Unverified assumption flagged by spec review**: `AcDbMText.TextString` COM behavior on this ZWCAD binding has no prior pitfall precedent (unlike `NumberOfVertices`, which silently doesn't exist for polylines) — Task 3's manual verification step is not optional busywork, it's the first real check of this assumption.

---

### Task 1: Schema + handler skeleton

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add a new schema constant near the other `_..._SCHEMA`/`_..._DESC` constants (search for `_EXTRACT_CAD_OBJECTS_SCHEMA`/`_EXTRACT_CAD_OBJECTS_DESC` and place the new ones nearby), and the new handler right after `handle_extract_cad_objects`'s closing line (or any other convenient spot near related handlers — read the file's structure first to pick a clean insertion point, e.g. right after the sidecar-override block ends).
- Test: `tests/handlers/test_extract_text_labels.py` (new file).

- [ ] **Step 1: Write the failing tests**

```python
"""test_extract_text_labels.py -- zwcad_extract_text_labels: extracts
AcDbText/AcDbMText content + position from caller-specified layers.

See docs/superpowers/specs/2026-07-31-extract-text-labels-design.md.
"""

from __future__ import annotations

import unittest
from unittest.mock import MagicMock, patch

import pytest

from cad_intelligence.cad_io.handlers import space


class TestHandleExtractTextLabels(unittest.TestCase):
    def _make_mock_text(self, handle, layer, object_name, text, insertion_point):
        ent = MagicMock()
        ent.ObjectName = object_name
        ent.Handle = handle
        ent.Layer = layer
        ent.TextString = text
        ent.InsertionPoint = insertion_point
        return ent

    def _make_mock_bridge(self, entities):
        bridge = MagicMock()
        doc = MagicMock()
        doc.ModelSpace.Count = len(entities)
        doc.ModelSpace.Item.side_effect = entities
        bridge.app.ActiveDocument = doc
        return bridge

    def test_text_entity_on_matching_layer_returned(self):
        ent = self._make_mock_text("1A1", "7TXT", "AcDbText", "거실", (1000.0, 2000.0, 0.0))
        bridge = self._make_mock_bridge([ent])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        labels = result.data["text_labels"]
        assert len(labels) == 1
        assert labels[0]["handle"] == "1A1"
        assert labels[0]["text"] == "거실"
        assert labels[0]["position"] == [1000.0, 2000.0]

    def test_mtext_entity_also_returned(self):
        ent = self._make_mock_text("1A2", "7TXT", "AcDbMText", "침실 1", (500.0, 600.0, 0.0))
        bridge = self._make_mock_bridge([ent])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        labels = result.data["text_labels"]
        assert len(labels) == 1
        assert labels[0]["object_name"] == "AcDbMText"

    def test_layer_not_in_search_layers_excluded(self):
        ent = self._make_mock_text("1A3", "OTHER", "AcDbText", "무시됨", (0.0, 0.0, 0.0))
        bridge = self._make_mock_bridge([ent])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        assert result.data["text_labels"] == []

    def test_non_text_entity_excluded(self):
        ent = MagicMock()
        ent.ObjectName = "AcDbLine"
        ent.Layer = "7TXT"
        bridge = self._make_mock_bridge([ent])
        with patch.object(space, "_get_bridge", return_value=bridge):
            result = space.handle_extract_text_labels({"search_layers": ["7TXT"]})
        assert result.data["text_labels"] == []

    def test_empty_search_layers_raises(self):
        with pytest.raises(ValueError):
            space.handle_extract_text_labels({"search_layers": []})

    def test_missing_search_layers_raises(self):
        with pytest.raises(ValueError):
            space.handle_extract_text_labels({})
```

This uses `unittest.mock.patch.object(space, "_get_bridge", return_value=bridge)`, matching the exact established style in `tests/handlers/test_extract_cad_objects_door_patterns.py` (confirmed during plan review) — not `pytest.MonkeyPatch`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_extract_text_labels.py -v`
Expected: FAIL — `handle_extract_text_labels` doesn't exist.

- [ ] **Step 3: Implement the schema constants and handler**

Add near the other schema/description constants in `space.py`:

```python
_EXTRACT_TEXT_LABELS_DESC = (
    "Extract text content and position from AcDbText/AcDbMText entities "
    "on caller-specified layers (e.g. room-name label layers). Generalized -- "
    "search_layers is required and never defaults to a hardcoded layer name."
)

_EXTRACT_TEXT_LABELS_SCHEMA = {
    "type": "object",
    "properties": {
        "search_layers": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Layer names to scan for AcDbText/AcDbMText entities. Required.",
        },
    },
    "required": ["search_layers"],
}
```

Add the handler (placement: right after `handle_extract_cad_objects`'s closing line, or another clean spot near related handlers — use your judgment on exact line, the important thing is it's registered):

```python
@register_tool(
    default_registry,
    name="zwcad_extract_text_labels",
    description=_EXTRACT_TEXT_LABELS_DESC,
    input_schema=_EXTRACT_TEXT_LABELS_SCHEMA,
    requires_com=True,
)
def handle_extract_text_labels(params: dict) -> HandlerResult:
    """Extract AcDbText/AcDbMText content + position from caller-
    specified layers (ELEV-002/room-labeling follow-up). Does its own
    narrowly-scoped live COM read (mirrors _detect_curved_cluster_doors's
    style) since no shared Entry/ModelSpaceScanResult cache carries text
    content today.
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
    for i in range(ms.Count):
        entity = ms.Item(i)
        if entity.ObjectName not in ("AcDbText", "AcDbMText"):
            continue
        if entity.Layer not in layer_set:
            continue
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
    return HandlerResult.success(text_labels=labels)
```

Before finalizing, confirm `HandlerResult`'s import name/alias already used in `space.py` (search for `HandlerResult` to find how it's imported) and confirm `ZWCADConnectionError`/`_STUB_MSG`/`_PYWIN32_AVAILABLE`/`_get_bridge`/`register_tool`/`default_registry` are all reachable at this point in the file without new imports (per the plan's Reference section — spec review already confirmed this, but verify the exact names/casing before writing).

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_extract_text_labels.py -v`
Expected: PASS (6 tests).

- [ ] **Step 5: Run the broader regression**

Run: `python -m pytest tests/handlers/ -v`
Expected: PASS, no regressions (this is a purely additive new handler, touches no existing function).

- [ ] **Step 6: Do NOT commit.**

---

### Task 2: CHANGELOG entry

- [ ] Add an `[Unreleased]` → `### Added` entry describing the new `zwcad_extract_text_labels` tool, its motivation (correlating room-name labels with detected rooms/doors/windows), and its generalized `search_layers` design. Reference this spec/plan. No commit — `/sync` handles it.

---

### Task 3: Manual real-drawing verification (REQUIRED, not optional)

- [ ] Call `zwcad_extract_text_labels` (via the MCP tool, once the live ZWCAD connection has been restarted to pick up this change) with `search_layers: ["7TXT"]` against the live "아파트 평면도.dwg" drawing.
- [ ] Confirm `entity.TextString` does NOT raise or return something unexpected for `AcDbMText` entities specifically (the flagged unverified COM-property assumption from spec review) — if it fails or behaves oddly, this is a real finding to report, not something to silently work around.
- [ ] Confirm the returned labels contain plausible Korean room-name text (e.g. 거실, 침실, 주방, 화장실) at sensible positions.
- [ ] If results look correct, optionally cross-reference a few labels' positions against the room polygons already obtained from `zwcad_generate_spaces` in this session, to sanity-check the eventual room-naming use case this tool exists for.
- [ ] Report any discrepancy honestly rather than assuming success.

No code change in this task — verification only.
