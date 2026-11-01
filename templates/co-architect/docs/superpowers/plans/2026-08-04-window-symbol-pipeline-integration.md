# Window Symbol Pipeline — Live Extraction Wiring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `zwcad_extract_cad_objects`'s window pass return clustered, style-classified
window symbols (using the already-implemented `OpeningSymbolPipeline`) instead of one raw
CAD line per fragment.

**Architecture:** Insert `OpeningSymbolPipeline` into `ZWCADBridge.extract_cad_objects`
(`src/cad_intelligence/cad_io/com_bridge.py`), fed by a zero-COM-cost `ModelSpaceScanResult`
adapter built from the handler's already-collected `scanned_entities` list. Legacy per-line
fallback stays as a safety net for any window-layer line the pipeline's clustering does not
consume. Output schema is additive only — no existing key removed or renamed.

**Tech Stack:** Python, `cad_intelligence.semantic.opening_pipeline.OpeningSymbolPipeline`,
`cad_intelligence.common.models.{Entry, ModelSpaceScanResult, LayerMeta}`, pytest.

**Design reference:** `docs/superpowers/specs/2026-08-04-window-symbol-pipeline-integration-design.md`
(Approved — Pre-Implementation Verification Gate passed;
`_PIPELINE_MIN_CONFIDENCE=0.5`, `_CLUSTER_PROXIMITY_MM=500mm` default, both final).

**Meeting references:**
- `memory/meeting-2026-08-04-window-symbol-pipeline-integration-review.md`
- `memory/meeting-2026-08-04-window-symbol-pipeline-clustering-radius-resolution.md`

---

## File Structure

- Modify: `src/cad_intelligence/cad_io/com_bridge.py`
  - **Scoping note (found in plan review, 2026-08-04):** `handle_extract_cad_objects`
    (`com_bridge.py:5092`) is not a top-level function — it's a `def` nested inside the
    `_try_build_elevation_spec()` closure (starts `com_bridge.py:333`), alongside dozens of
    other `handle_*` closures. Inside that closure, `_WindowEntity`/`_ExceptionReport`/etc.
    (`com_bridge.py:4455-4456`) are **local aliases** (`_WindowEntity = _elev002_models.WindowEntity`)
    for the real, directly-importable classes `cad_intelligence.common.models.WindowEntity` and
    `.ExceptionReport` — a genuine module-level function cannot see the closure-local aliases.
    Both new helpers below must therefore be true module-level functions that import
    `WindowEntity`/`ExceptionReport`/`Entry`/`ModelSpaceScanResult`/`LayerMeta` directly from
    `cad_intelligence.common.models` (add one new top-of-file import block — there is currently
    no top-level import from `cad_intelligence.common.models` at all, only
    `from cad_intelligence.common.paths import memory_path`). The nested
    `handle_extract_cad_objects` closure then calls the new module-level `_build_windows(...)`.
  - New module-level helper `_entries_by_layer_from_scanned_entities` — pure Python, maps
    `scanned_entities` dict records to `Entry` objects grouped by layer, wrapped in a
    `ModelSpaceScanResult`.
  - New module-level helper `_build_windows` — the window-building logic, callable from
    `handle_extract_cad_objects` without needing anything from the enclosing closure.
  - `ZWCADBridge.extract_cad_objects`'s window pass (currently `com_bridge.py:5386-5458`)
    rewritten to call `_build_windows(...)`; legacy fallback logic moves into that function,
    gated by `clustered_handles`.
- Test: `tests/handlers/test_extract_cad_objects_window_pipeline.py` (new) — unit tests for the
  adapter and the rewritten window pass, following the `_make_scan_result` /
  `Entry`/`ModelSpaceScanResult` convention already used in
  `tests/handlers/test_extract_cad_objects_door_patterns.py`.
- Modify: `tests/golden/windows/` — add one large-span balcony-assembly fixture
  (`balcony_assembly_01/geometry.json`), following the existing
  `sliding_01`/`fixed_01`/`casement_01`/`awning_01` fixture format.
- Modify: `CHANGELOG.md` — `[Unreleased]` entry (via `/changelog`, not by hand — see final task).

---

### Task 1: `scanned_entities` → `ModelSpaceScanResult` adapter

**Files:**
- Modify: `src/cad_intelligence/cad_io/com_bridge.py`
- Test: `tests/handlers/test_extract_cad_objects_window_pipeline.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/handlers/test_extract_cad_objects_window_pipeline.py
from __future__ import annotations

import pytest

from cad_intelligence.cad_io.com_bridge import _entries_by_layer_from_scanned_entities
from cad_intelligence.common.models import Entry, ModelSpaceScanResult


class TestEntriesByLayerFromScannedEntities:
    def test_maps_line_fields_grouped_by_layer(self):
        scanned_entities = [
            {
                "layer": "WID", "type": "AcDbLine", "handle": "A1",
                "start": (0.0, 0.0), "end": (100.0, 0.0), "length": 100.0,
            },
            {
                "layer": "WID", "type": "AcDbLine", "handle": "A2",
                "start": (0.0, 50.0), "end": (100.0, 50.0), "length": 100.0,
            },
            {
                "layer": "DOOR", "type": "AcDbLine", "handle": "B1",
                "start": (0.0, 0.0), "end": (10.0, 0.0), "length": 10.0,
            },
        ]

        result = _entries_by_layer_from_scanned_entities(scanned_entities)

        assert isinstance(result, ModelSpaceScanResult)
        assert set(result.entries_by_layer.keys()) == {"WID", "DOOR"}
        wid_entries = result.entries_by_layer["WID"]
        assert len(wid_entries) == 2
        assert all(isinstance(e, Entry) for e in wid_entries)
        assert wid_entries[0].object_name == "AcDbLine"
        assert wid_entries[0].start == (0.0, 0.0)
        assert wid_entries[0].end == (100.0, 0.0)
        assert wid_entries[0].length == 100.0
        assert wid_entries[0].handle == "A1"

    def test_maps_block_reference_fields(self):
        scanned_entities = [
            {
                "layer": "WID", "type": "AcDbBlockReference", "handle": "C1",
                "position": (10.0, 20.0), "rotation": 1.57,
                "block_name": "W900", "x_scale": 1.0,
            },
        ]
        result = _entries_by_layer_from_scanned_entities(scanned_entities)
        e = result.entries_by_layer["WID"][0]
        assert e.object_name == "AcDbBlockReference"
        assert e.position == (10.0, 20.0)
        assert e.block_name == "W900"

    def test_empty_input_returns_empty_scan_result(self):
        result = _entries_by_layer_from_scanned_entities([])
        assert result.entries_by_layer == {}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/handlers/test_extract_cad_objects_window_pipeline.py -v`
Expected: FAIL with `ImportError: cannot import name '_entries_by_layer_from_scanned_entities'`

- [ ] **Step 3: Write minimal implementation**

Add near the top of the file (true module level — see the File Structure scoping note above;
this must NOT go inside `_try_build_elevation_spec()` or any other closure). Add a new import
block after the existing `from cad_intelligence.common.paths import memory_path` line
(`com_bridge.py:31`) — this is a genuinely new top-level import, not an extension of an
existing one:

```python
from types import MappingProxyType

from cad_intelligence.common.models import (
    Entry,
    ExceptionReport,
    LayerMeta,
    ModelSpaceScanResult,
    WindowEntity,
)
```

Then, module-level (e.g. near the bottom of the file's helper-function section, or any
top-level location — NOT nested inside `_try_build_elevation_spec()`):

```python
def _entries_by_layer_from_scanned_entities(
    scanned_entities: list[dict],
) -> ModelSpaceScanResult:
    """Adapt the flat ``scanned_entities`` records (built by the single
    ``ms.Count`` COM scan in ``extract_cad_objects``) into the
    ``ModelSpaceScanResult``/``Entry`` shape ``OpeningSymbolDetector.detect()``
    expects — with zero additional COM calls (see
    docs/superpowers/specs/2026-08-04-window-symbol-pipeline-integration-design.md
    Principle 3 amendment: a naive ``scan_modelspace(doc)`` call here would be a
    redundant third full COM traversal).
    """
    by_layer: dict[str, list[Entry]] = {}
    for rec in scanned_entities:
        entry = Entry(
            layer=rec["layer"],
            handle=rec.get("handle"),
            object_name=rec["type"],
            start=rec.get("start"),
            end=rec.get("end"),
            length=rec.get("length"),
            coordinates=tuple(rec["coordinates"]) if rec.get("coordinates") else None,
            closed=rec.get("closed"),
            area=rec.get("area"),
            position=rec.get("position"),
            rotation=rec.get("rotation"),
            block_name=rec.get("block_name"),
            x_scale=rec.get("x_scale"),
        )
        by_layer.setdefault(rec["layer"], []).append(entry)

    return ModelSpaceScanResult(
        doc_name="",
        entries_by_layer=MappingProxyType(
            {k: tuple(v) for k, v in by_layer.items()}
        ),
        entity_type_counts=MappingProxyType({}),
        block_samples=MappingProxyType({}),
        layer_meta=MappingProxyType(
            {k: LayerMeta(color=0, linetype="ByLayer") for k in by_layer}
        ),
    )
```

(The import block for `Entry`/`ModelSpaceScanResult`/`LayerMeta`/`WindowEntity`/
`ExceptionReport`/`MappingProxyType` was already added at the top of the file in this same
step, above — do not add it again. `grep -n "MappingProxyType" src/cad_intelligence/cad_io/com_bridge.py`
first regardless, in case a later part of the file already imports it locally inside some
other closure, to avoid a shadowing warning.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/handlers/test_extract_cad_objects_window_pipeline.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/cad_io/com_bridge.py tests/handlers/test_extract_cad_objects_window_pipeline.py
git commit -m "feat(com_bridge): add zero-COM-cost scanned_entities-to-ModelSpaceScanResult adapter"
```

---

### Task 2: Wire `OpeningSymbolPipeline` into the window pass

**Files:**
- Modify: `src/cad_intelligence/cad_io/com_bridge.py:5386-5458` (the window pass inside
  `ZWCADBridge.extract_cad_objects`)
- Test: `tests/handlers/test_extract_cad_objects_window_pipeline.py`

- [ ] **Step 1: Write the failing test**

Append to the same test file — this test exercises the handler's window-pass logic in
isolation by calling a small helper we'll extract in Step 3 (`_build_windows`), so it doesn't
require mocking the full COM `doc`/`ms` object tree. Add the new import to the file's existing
import block first:

```python
from cad_intelligence.cad_io.com_bridge import _build_windows  # add to top-of-file imports
```

```python
class TestBuildWindows:
    """Exercises the extracted _build_windows() helper — the window pass logic
    factored out of ZWCADBridge.extract_cad_objects so it's testable without a
    live/mocked COM document."""

    def test_clustered_sliding_window_produces_one_entry_not_per_line(self):
        # 4-line sliding-window symbol: 2 long parallel frame lines +
        # 2 short rail/sash lines, all within 500mm of each other.
        scanned_entities = [
            {"layer": "WID", "type": "AcDbLine", "handle": "L1",
             "start": (0.0, 0.0), "end": (900.0, 0.0), "length": 900.0},
            {"layer": "WID", "type": "AcDbLine", "handle": "L2",
             "start": (0.0, 50.0), "end": (900.0, 50.0), "length": 900.0},
            {"layer": "WID", "type": "AcDbLine", "handle": "L3",
             "start": (0.0, 0.0), "end": (0.0, 50.0), "length": 50.0},
            {"layer": "WID", "type": "AcDbLine", "handle": "L4",
             "start": (900.0, 0.0), "end": (900.0, 50.0), "length": 50.0},
        ]
        windows, exceptions = _build_windows(
            scanned_entities, window_layers={"WID"},
        )
        assert len(windows) == 1
        w = windows[0]
        assert w["layer"] == "WID"
        assert w["width"] == pytest.approx(900.0, abs=1.0)
        assert "window_style" in w
        assert "style_confidence" in w
        assert "evidence_kinds" in w
        assert w["block_name"] is None

    def test_block_reference_path_unchanged(self):
        scanned_entities = [
            {"layer": "WID", "type": "AcDbBlockReference", "handle": "B1",
             "position": (10.0, 20.0), "block_name": "W900", "x_scale": 900.0},
        ]
        windows, exceptions = _build_windows(
            scanned_entities, window_layers={"WID"},
        )
        assert len(windows) == 1
        assert windows[0]["block_name"] == "W900"
        assert windows[0]["width"] == 900.0
        assert windows[0]["position"] == (10.0, 20.0)

    def test_singleton_line_not_clustered_falls_back_to_legacy_path(self):
        # A single isolated line far from anything else: the detector still
        # emits a 1-line candidate for it (min cluster size = 1), so this
        # exercises "the pipeline consumed it" rather than the literal legacy
        # fallback loop -- but must still produce exactly one window entry
        # with no duplication and a MISSING_BLOCK_DEF-style low-confidence
        # flag path exercised (best_match likely None for a single raw line).
        scanned_entities = [
            {"layer": "WID", "type": "AcDbLine", "handle": "Z1",
             "start": (5000.0, 5000.0), "end": (5060.0, 5000.0), "length": 60.0},
        ]
        windows, exceptions = _build_windows(
            scanned_entities, window_layers={"WID"},
        )
        assert len(windows) == 1
        assert windows[0]["handle"] == "Z1"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/handlers/test_extract_cad_objects_window_pipeline.py::TestBuildWindows -v`
Expected: FAIL with `ImportError: cannot import name '_build_windows'`

- [ ] **Step 3: Extract and rewrite `_build_windows`**

Factor the window pass out of `extract_cad_objects` into its own module-level function (this
also makes Task 2's tests possible without mocking COM), then rewrite its body:

```python
def _build_windows(
    scanned_entities: list[dict],
    window_layers: set[str],
) -> tuple[list[dict], list[dict]]:
    """Build the ``windows`` list for ``extract_cad_objects``.

    Primary path: cluster window-layer geometry with ``OpeningSymbolPipeline``
    (Detector -> Evidence -> Features -> Classifier -> Confidence). Falls back
    to the legacy 1-line-per-entity heuristic only for window-layer entities
    the pipeline's clustering did not consume, and for AcDbBlockReference
    entities on layers with no clustering-eligible geometry.

    See docs/superpowers/specs/2026-08-04-window-symbol-pipeline-integration-design.md.
    """
    windows: list[dict] = []
    exceptions: list[dict] = []
    clustered_handles: set[str] = set()

    scan = _entries_by_layer_from_scanned_entities(scanned_entities)
    pipeline_results = OpeningSymbolPipeline().run(scan, search_layers=window_layers)

    for result in pipeline_results:
        candidate = result.candidate
        if candidate.signature is not None:
            clustered_handles |= set(candidate.signature.entity_ids)
        else:
            clustered_handles.add(candidate.handle)

        best_match = (
            result.classification.matches[0]
            if result.classification.matches else None
        )
        cx = (candidate.bbox[0] + candidate.bbox[2]) / 2
        cy = (candidate.bbox[1] + candidate.bbox[3]) / 2
        width = max(
            candidate.bbox[2] - candidate.bbox[0],
            candidate.bbox[3] - candidate.bbox[1],
        )

        windows.append({
            "handle": candidate.handle,
            "layer": candidate.layer,
            "position": (cx, cy),
            "width": width,
            "block_name": candidate.block_name,
            "window_style": best_match.style.name if best_match else None,
            "style_confidence": result.final_confidence,
            "evidence_kinds": [e.kind.name for e in result.evidence.items],
        })
        if result.final_confidence < _PIPELINE_MIN_CONFIDENCE:
            exceptions.append(
                ExceptionReport(
                    code="LOW_CONFIDENCE_WINDOW_SYMBOL",
                    severity="info",
                    message=(
                        f"Window candidate on layer '{candidate.layer}' "
                        f"(handle {candidate.handle}) classified with low "
                        f"confidence ({result.final_confidence:.2f})."
                    ),
                    context={"handle": candidate.handle, "layer": candidate.layer},
                    suggested_action=(
                        "Review this window symbol visually; classification "
                        "may be unreliable."
                    ),
                ).to_dict()
            )

    # --- Legacy fallback: window-layer entities the pipeline's clustering
    #     did not consume (block-reference layers with no block on that
    #     layer's clustering path, or any edge case the detector skips) ---
    window_block_layers_have_blocks: dict[str, bool] = {
        name: False for name in window_layers
    }
    for rec in scanned_entities:
        if (
            rec["layer"] in window_layers
            and rec["type"] == "AcDbBlockReference"
        ):
            window_block_layers_have_blocks[rec["layer"]] = True

    for rec in scanned_entities:
        layer_name = rec["layer"]
        if layer_name not in window_layers:
            continue
        if rec["handle"] in clustered_handles:
            continue
        obj_name = rec["type"]
        handle = rec["handle"]

        if (
            obj_name == "AcDbBlockReference"
            and window_block_layers_have_blocks.get(layer_name)
        ):
            windows.append(
                WindowEntity(
                    handle=handle,
                    layer=layer_name,
                    position=rec["position"],
                    width=rec.get("x_scale", 0.0),
                    block_name=rec.get("block_name"),
                ).to_dict()
            )
        elif (
            obj_name == "AcDbLine"
            and not window_block_layers_have_blocks.get(layer_name)
        ):
            length = rec.get("length", 0.0)
            if length <= 0:
                continue
            sp = rec["start"]
            ep = rec["end"]
            cx = (sp[0] + ep[0]) / 2
            cy = (sp[1] + ep[1]) / 2
            windows.append(
                WindowEntity(
                    handle=handle,
                    layer=layer_name,
                    position=(float(cx), float(cy)),
                    width=length,
                    block_name=None,
                ).to_dict()
            )
            exceptions.append(
                ExceptionReport(
                    code="MISSING_BLOCK_DEF",
                    severity="warning",
                    message=(
                        f"Window on layer '{layer_name}' (handle {handle}) "
                        "has no block reference; resolved via v1's "
                        "sleeve-line heuristic fallback (pipeline clustering "
                        "did not consume this entity)."
                    ),
                    context={"handle": handle, "layer": layer_name},
                    suggested_action=(
                        "If this drawing uses a window block, verify the "
                        "block is actually inserted (AcDbBlockReference) on "
                        f"layer '{layer_name}' rather than drawn as a raw "
                        "sleeve line."
                    ),
                ).to_dict()
            )

    return windows, exceptions
```

Add module-level constant near the other `extract_cad_objects` constants:

```python
_PIPELINE_MIN_CONFIDENCE: float = 0.5  # data-derived, see design doc §Pre-Implementation Verification Gate
```

Add the import: `from cad_intelligence.semantic.opening_pipeline import OpeningSymbolPipeline`.

Then replace `extract_cad_objects`'s inline window-building block (`com_bridge.py:5386-5458`,
everything from `# --- Windows: ... ---` through the end of that loop) with:

```python
windows, window_exceptions = _build_windows(scanned_entities, window_layers)
exceptions.extend(window_exceptions)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/handlers/test_extract_cad_objects_window_pipeline.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Run the full existing test suite for regressions**

Run: `pytest tests/ -k "window or extract_cad_objects or opening" -v`
Expected: PASS — in particular, any pre-existing block-reference-path window tests must
produce byte-identical `width`/`position` output (block path is untouched logic, just moved
into `_build_windows`).

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/cad_io/com_bridge.py tests/handlers/test_extract_cad_objects_window_pipeline.py
git commit -m "feat(com_bridge): wire OpeningSymbolPipeline into extract_cad_objects window pass"
```

---

### Task 3: Golden fixture for the confirmed large-span balcony assembly class

**Files:**
- Create: `tests/golden/windows/balcony_assembly_01/geometry.json`
- Test: extend whatever golden-runner test currently iterates `tests/golden/windows/*`
  (locate via `grep -rn "tests/golden/windows" tests/test_window_pipeline.py` — follow that
  file's existing fixture-loading convention exactly; do not invent a new loader)

- [ ] **Step 1: Inspect the existing golden fixture format**

Run: `cat tests/golden/windows/sliding_01/geometry.json` (or open it) to confirm the exact
JSON schema (input geometry + expected style + manifest fields) before authoring the new one.

- [ ] **Step 2: Author the new fixture**

Base the geometry on the real, now-confirmed-legitimate pattern from
`memory/meeting-2026-08-04-window-symbol-pipeline-clustering-radius-resolution.md`
(4-line frame, width ≈ 3803–3915mm, e.g. the `BE68–BE6B` group) — same relative structure as
`sliding_01` but scaled up past the 2500mm span that the verification-gate sweep flagged, with
`expected_style: "SLIDING"` (balcony assemblies in this drawing classified as SLIDING per the
gate run's style distribution).

- [ ] **Step 3: Run the golden test suite**

Run: `pytest tests/test_window_pipeline.py -v`
Expected: PASS, including the new `balcony_assembly_01` case.

- [ ] **Step 4: Commit**

```bash
git add tests/golden/windows/balcony_assembly_01/
git commit -m "test(golden): add large-span balcony-assembly window fixture"
```

---

### Task 4: Sync

- [ ] Run `/sync "feat(cad_intelligence): wire OpeningSymbolPipeline into live extract_cad_objects window pass"`
  — this handles CHANGELOG entry, memlog, full `audit.ts` QA gate, commit, push, and PR creation
  in one pipeline (per this repo's CLAUDE.md — do not commit/push directly).

---

## Notes for the implementer

- Do not touch the wall or door passes in `extract_cad_objects` — out of scope per the design doc.
- Do not modify `space.py`'s own window heuristics (`_detect_parallel_line_windows`,
  `_detect_framed_windows`) — `OpeningSymbolPipeline`'s own docstring contract says it runs
  parallel to those, not instead of them.
- If `pytest tests/` (full suite) reveals any test asserting the *exact* old `windows` list
  length or per-line output shape for `WID`-layer fixtures, that test encoded the fragmentation
  bug as expected behavior — update it to assert the new clustered-count behavior instead of
  treating it as a regression to preserve. Flag any such test to the user before changing its
  assertions, since it means a prior test authored the bug as "correct."
