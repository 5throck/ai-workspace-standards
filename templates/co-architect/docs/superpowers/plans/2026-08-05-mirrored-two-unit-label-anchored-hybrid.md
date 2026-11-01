---
lang: ko
lang_reason: proper-noun
---

# Mirrored Two-Unit LABEL_ANCHORED_HYBRID Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `zwcad_generate_spaces` detect all 16 rooms on `32평형아파트.dwg` (8 per
apartment unit × 2 mirrored units) by extending the already-implemented
`LABEL_ANCHORED_HYBRID` room-detection mode's input with a mirrored copy of the
labeled unit's room labels, rather than modifying the mode itself.

**Architecture:** `LABEL_ANCHORED_HYBRID` (`geometry/space_geometry.py`) already turns
a list of `{"text", "position"}` room labels into one polygon per label (real wall
geometry when `SOLID_UNION` closes a matching polygon, Voronoi-cell approximation
otherwise), and is already wired into the live handler
(`cad_io/handlers/space.py:4003-4041`). This plan adds: (1) a new sidecar config file
telling the live handler which 8 text labels count as rooms and where the drawing's
mirror axis is, (2) a small pure-geometry helper `_mirror_room_labels` that doubles a
label list about an x-axis, and (3) a 2-line change wiring that helper into the
existing handler branch when the sidecar requests it. No change to
`LABEL_ANCHORED_HYBRID`'s own algorithm.

**Tech Stack:** Python, existing `cad_intelligence.geometry.space_geometry` /
`cad_intelligence.cad_io.handlers.space` modules, pytest.

**Design reference:**
`docs/superpowers/specs/2026-08-05-mirrored-two-unit-label-anchored-hybrid-design.md`
(Approved — Pre-Implementation Verification Gate passed 2026-08-05: 16/16 room count
confirmed via direct execution against real drawing data; all 16 currently resolve via
the `LABEL_VORONOI` fallback since `SOLID_UNION` closes no matching polygon on this
drawing — documented, safe, expected behavior, not a regression to fix here).

---

## File Structure

- Create: `memory/drawings/32평형아파트.room-labels.json` — drawing-specific sidecar
  (not code; data file consumed by the existing `_load_room_labels_sidecar` loader).
- Modify: `src/cad_intelligence/geometry/space_geometry.py` — add
  `_mirror_room_labels(room_labels, axis_x)`, co-located with
  `_build_space_polygons_label_anchored_hybrid` (same file, same neighborhood).
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — 2-line change in the
  existing `LABEL_ANCHORED_HYBRID` dispatch branch (~line 4035-4041) to call the new
  helper when the sidecar has a `mirror` block.
- Test: `tests/test_space_geometry.py` — unit tests for `_mirror_room_labels`.
- Test: `tests/handlers/test_generate_spaces_label_anchored_hybrid.py` (new, or an
  existing `LABEL_ANCHORED_HYBRID` handler test file if one already exists — **check
  first**, see Task 2 Step 1) — test for the sidecar-driven wiring.

---

### Task 1: `_mirror_room_labels` helper

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py`
- Test: `tests/test_space_geometry.py`

- [ ] **Step 1: Write the failing test**

First, open `src/cad_intelligence/geometry/space_geometry.py` and find
`_build_space_polygons_label_anchored_hybrid` (search for that exact function name —
as of this plan's writing it's around line 1314, but confirm by search since the file
changes over time). You'll add the new helper near it, so read that function and its
docstring first for context and style (dataclass-free, plain dict in/out, matching the
`room_labels: list[dict]` shape used throughout this mode).

Append to `tests/test_space_geometry.py` (check the file's existing import block at
the top first — it should already import from `cad_intelligence.geometry.space_geometry`;
add `_mirror_room_labels` to that import list rather than adding a new import line):

```python
class TestMirrorRoomLabels:
    def test_mirrors_position_about_axis(self):
        labels = [{"text": "침실1", "position": (100.0, 50.0)}]
        result = _mirror_room_labels(labels, axis_x=200.0)
        assert len(result) == 1
        assert result[0]["text"] == "침실1"
        assert result[0]["position"] == (300.0, 50.0)  # 2*200 - 100

    def test_preserves_extra_keys_via_shallow_copy(self):
        labels = [{"text": "거실", "position": (0.0, 0.0), "layer": "TEX", "confidence": 0.9}]
        result = _mirror_room_labels(labels, axis_x=100.0)
        assert result[0]["layer"] == "TEX"
        assert result[0]["confidence"] == 0.9
        assert result[0]["position"] == (200.0, 0.0)

    def test_does_not_mutate_input(self):
        labels = [{"text": "욕실1", "position": (10.0, 10.0)}]
        original_position = labels[0]["position"]
        _mirror_room_labels(labels, axis_x=50.0)
        assert labels[0]["position"] == original_position

    def test_empty_input_returns_empty_list(self):
        assert _mirror_room_labels([], axis_x=100.0) == []

    def test_multiple_labels_each_mirrored_independently(self):
        labels = [
            {"text": "침실1", "position": (0.0, 10.0)},
            {"text": "침실2", "position": (50.0, 20.0)},
        ]
        result = _mirror_room_labels(labels, axis_x=25.0)
        assert result[0]["position"] == (50.0, 10.0)
        assert result[1]["position"] == (0.0, 20.0)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_space_geometry.py::TestMirrorRoomLabels -v`
Expected: FAIL with `ImportError: cannot import name '_mirror_room_labels'` (or a
`NameError` if the test file imports the module rather than the name directly — match
whichever style the existing import block already uses).

- [ ] **Step 3: Write minimal implementation**

Add this function in `src/cad_intelligence/geometry/space_geometry.py`, near
`_build_space_polygons_label_anchored_hybrid` (module-level, same indentation
convention as that function — this file is not a giant closure like `com_bridge.py`,
so no scoping trap here, just place it as a normal top-level function):

```python
def _mirror_room_labels(
    room_labels: list[dict], axis_x: float
) -> list[dict]:
    """Reflect a list of room labels about a vertical axis at ``x = axis_x``.

    Used for floor plans containing two mirrored apartment units where only
    one unit's rooms carry text labels (see
    docs/superpowers/specs/2026-08-05-mirrored-two-unit-label-anchored-hybrid-design.md).
    Shallow-copies each label dict so any keys beyond ``text``/``position``
    (e.g. a future ``layer`` or ``confidence`` field) survive unchanged.
    Does not mutate the input list or its dicts.
    """
    mirrored: list[dict] = []
    for lbl in room_labels:
        x, y = lbl["position"]
        mirrored_label = dict(lbl)
        mirrored_label["position"] = (2 * axis_x - x, y)
        mirrored.append(mirrored_label)
    return mirrored
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_space_geometry.py::TestMirrorRoomLabels -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): add _mirror_room_labels for two-unit mirrored floor plans"
```

---

### Task 2: Wire the sidecar `mirror` block into `handle_generate_spaces`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py`
- Test: new or existing `LABEL_ANCHORED_HYBRID` handler test file (see Step 1)

- [ ] **Step 1: Find existing test coverage first**

Before writing new tests, search for existing ones: `grep -rn "LABEL_ANCHORED_HYBRID\|label_anchored_hybrid" tests/` to find any test file already exercising this handler
branch. If one exists, add your new tests there, matching its existing fixture/mocking
conventions (likely constructs a fake `_load_room_labels_sidecar` return value and
fake wall/door data, without a live COM connection — this whole mode is COM-free once
`room_labels`/`wall_segments`/`doors` are supplied). If none exists, create
`tests/handlers/test_generate_spaces_label_anchored_hybrid.py` following the
conventions in `tests/handlers/test_extract_cad_objects_door_patterns.py` (the
`_make_scan_result`/mocking style used elsewhere in this `tests/handlers/` directory)
— but note this test targets `handle_generate_spaces`, not `extract_cad_objects`, so
you'll be mocking/monkeypatching `_load_room_labels_sidecar` and
`handle_extract_text_labels` (or `handle_extract_cad_objects`, whichever this handler
auto-chains for `wall_segments`/`doors` when not explicitly passed — read
`handle_generate_spaces`'s full signature and auto-chain logic first, around
`handlers/space.py:3947` onward, to confirm exactly what needs mocking vs. what can be
passed directly as params).

- [ ] **Step 2: Write the failing test**

The core behavior to test: when the sidecar dict returned by
`_load_room_labels_sidecar` has a `"mirror": {"axis_x": ...}` key, the room labels used
to build polygons are doubled (original + mirrored) before being passed to
`_elev002_build_space_polygons_label_anchored_hybrid`. The simplest reliable way to
test this without mocking deep internals: monkeypatch
`_elev002_build_space_polygons_label_anchored_hybrid` itself (or its import alias
inside `handlers/space.py`) to capture the `room_labels` argument it was called with,
and assert on its length/contents, rather than asserting on the final polygon output
(which depends on real geometry matching you don't want to fake in this unit test).

```python
from unittest.mock import patch
from cad_intelligence.cad_io.handlers import space as space_handlers


class TestLabelAnchoredHybridMirroring:
    def test_mirror_sidecar_doubles_room_labels(self, monkeypatch):
        fake_sidecar = {
            "text_layers": ["TEX"],
            "room_name_includes": ["침실1", "거실"],
            "mirror": {"axis_x": 100.0},
        }
        fake_text_labels = {
            "text_labels": [
                {"text": "침실1", "position": [10.0, 20.0]},
                {"text": "거실", "position": [30.0, 40.0]},
            ],
            "leader_lines": [],
        }
        captured = {}

        def fake_build_hybrid(room_labels, doors, wall_segments, leader_lines):
            captured["room_labels"] = room_labels
            return [], []

        monkeypatch.setattr(
            space_handlers, "_load_room_labels_sidecar", lambda *a, **k: fake_sidecar
        )
        monkeypatch.setattr(
            space_handlers,
            "handle_extract_text_labels",
            lambda params: space_handlers.HandlerResult.success(**fake_text_labels),
        )
        monkeypatch.setattr(
            space_handlers,
            "_elev002_build_space_polygons_label_anchored_hybrid",
            fake_build_hybrid,
        )

        space_handlers.handle_generate_spaces({
            "wall_processing_mode": "label_anchored_hybrid",
            "walls": [],
            "doors": [],
            "doc_name": "fake.dwg",
        })

        assert len(captured["room_labels"]) == 4  # 2 original + 2 mirrored
        texts = sorted(l["text"] for l in captured["room_labels"])
        assert texts == ["거실", "거실", "침실1", "침실1"]
        # mirrored x = 2*100 - x
        xs = sorted(l["position"][0] for l in captured["room_labels"])
        assert xs == [10.0, 30.0, 70.0, 170.0]

    def test_no_mirror_key_leaves_labels_unchanged(self, monkeypatch):
        fake_sidecar = {
            "text_layers": ["TEX"],
            "room_name_includes": ["침실1"],
            # no "mirror" key
        }
        fake_text_labels = {
            "text_labels": [{"text": "침실1", "position": [10.0, 20.0]}],
            "leader_lines": [],
        }
        captured = {}

        def fake_build_hybrid(room_labels, doors, wall_segments, leader_lines):
            captured["room_labels"] = room_labels
            return [], []

        monkeypatch.setattr(
            space_handlers, "_load_room_labels_sidecar", lambda *a, **k: fake_sidecar
        )
        monkeypatch.setattr(
            space_handlers,
            "handle_extract_text_labels",
            lambda params: space_handlers.HandlerResult.success(**fake_text_labels),
        )
        monkeypatch.setattr(
            space_handlers,
            "_elev002_build_space_polygons_label_anchored_hybrid",
            fake_build_hybrid,
        )

        space_handlers.handle_generate_spaces({
            "wall_processing_mode": "label_anchored_hybrid",
            "walls": [],
            "doors": [],
            "doc_name": "fake.dwg",
        })

        assert len(captured["room_labels"]) == 1  # unchanged, no mirroring
```

**Before running this**, actually read `handlers/space.py`'s
`handle_generate_spaces` signature and the exact names of `HandlerResult`,
`handle_extract_text_labels`, and how `_elev002_build_space_polygons_label_anchored_hybrid`
is imported/aliased in that module (confirmed by the earlier design's spec review as a
real alias around `handlers/space.py:3517/3535` — re-verify the exact line since the
file changes) — adjust the monkeypatch targets above to match reality if any name
differs from what's shown here. This test is illustrative of the *behavior* to prove;
match it to the actual function signatures you find.

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/handlers/test_generate_spaces_label_anchored_hybrid.py -v` (or
wherever you placed it per Step 1)
Expected: FAIL — either the mirroring doesn't happen yet (`captured["room_labels"]`
has length 2, not 4) or an `AttributeError` if a monkeypatch target name needs
adjusting first.

- [ ] **Step 4: Write minimal implementation**

In `src/cad_intelligence/cad_io/handlers/space.py`, find the `LABEL_ANCHORED_HYBRID`
branch (search for `elif resolved_mode == _WPM.LABEL_ANCHORED_HYBRID:` — around line
4003 as of this plan's writing, confirm by search). Inside it, find where
`room_labels` is built from the filtered `raw_labels` (around line 4035-4038):

```python
                room_labels = [
                    {"text": l["text"], "position": tuple(l["position"])}
                    for l in raw_labels if _qualifies(l.get("text", ""))
                ]
                space_polygons, exceptions = _elev002_build_space_polygons_label_anchored_hybrid(
                    room_labels, doors=openings, wall_segments=wall_segments, leader_lines=raw_leaders,
                )
```

Insert the mirroring step between those two statements:

```python
                room_labels = [
                    {"text": l["text"], "position": tuple(l["position"])}
                    for l in raw_labels if _qualifies(l.get("text", ""))
                ]
                mirror_config = sidecar.get("mirror")
                if mirror_config:
                    room_labels = room_labels + _mirror_room_labels(
                        room_labels, axis_x=float(mirror_config["axis_x"])
                    )
                space_polygons, exceptions = _elev002_build_space_polygons_label_anchored_hybrid(
                    room_labels, doors=openings, wall_segments=wall_segments, leader_lines=raw_leaders,
                )
```

Add the import for `_mirror_room_labels` at the top of `handlers/space.py`, alongside
whatever existing import already brings in other `space_geometry` helpers this file
uses (search for an existing `from cad_intelligence.geometry.space_geometry import`
line and add to it — do not create a second, separate import line for the same
module).

- [ ] **Step 5: Run test to verify it passes**

Run: `pytest tests/handlers/test_generate_spaces_label_anchored_hybrid.py -v`
Expected: PASS (both tests)

- [ ] **Step 6: Run the broader regression check**

```
pytest tests/ -k "label_anchored_hybrid or generate_spaces or space_geometry" -q
```
All must pass — this mode's existing tests (per the original 2026-08-01 design's own
9-case test list) must be unaffected since the change is purely additive and
conditional on a sidecar key no other drawing's sidecar has.

- [ ] **Step 7: Commit**

```bash
git add src/cad_intelligence/cad_io/handlers/space.py tests/handlers/test_generate_spaces_label_anchored_hybrid.py
git commit -m "feat(cad_io): wire sidecar mirror config into LABEL_ANCHORED_HYBRID room detection"
```

---

### Task 3: Create the `32평형아파트.room-labels.json` sidecar

**Files:**
- Create: `memory/drawings/32평형아파트.room-labels.json`

- [ ] **Step 1: Write the sidecar file**

```json
{
  "text_layers": ["TEX"],
  "room_name_includes": ["침실1", "침실2", "침실3", "거실", "주방&식당", "욕실1", "욕실2", "드레스실"],
  "mirror": {
    "axis_x": 26423.6
  }
}
```

**Important encoding note**: the live drawing's `거실` label actually reads as `"거 실"`
(with an internal space — confirmed during this design's verification gate) in raw
COM text extraction. Check whether `_qualifies()`'s substring-match filter
(`handlers/space.py:4029-4033`, does `" ".join(text.lower().split())` normalization
before matching per its own code) already normalizes internal whitespace before
comparing against `room_name_includes` — if it does (the `.split()`/`" ".join()`
pattern strongly suggests it does), `"거실"` in this include list will correctly match
the raw `"거 실"` text. If you find during Task 4's live verification that `거실`
doesn't get picked up, that normalization assumption was wrong and this file's
`room_name_includes` entry needs to become `"거 실"` (with the space) instead — verify
live, don't guess blind.

- [ ] **Step 2: Commit**

```bash
git add "memory/drawings/32평형아파트.room-labels.json"
git commit -m "feat(data): add room-labels sidecar for 32평형아파트.dwg two-unit mirroring"
```

---

### Task 4: Live verification against the real drawing

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Run `zwcad_generate_spaces` live**

With `32평형아파트.dwg` open in ZWCAD (same live MCP session used throughout this
design's brainstorming), call the `zwcad_generate_spaces` MCP tool with
`wall_processing_mode: "label_anchored_hybrid"` and `doc_name` matching the drawing
(so the sidecar resolves). Confirm:
- `spaces` array length is exactly 16.
- Each space's `room_name` is one of the 8 expected names, each appearing exactly
  twice.
- No new/unexpected exception codes beyond what the Pre-Implementation Verification
  Gate already observed (`LABEL_VORONOI` fallback for all 16, per the design doc's
  recorded gate result) — if the live run now shows a different distribution (e.g.
  some now get `GEOMETRY` matches), that's an improvement, not a problem, but note it.

- [ ] **Step 2: If `거실`/`거 실` mismatch occurs (per Task 3 Step 1's caveat)**

Fix `memory/drawings/32평형아파트.room-labels.json`'s `room_name_includes` entry per
the live result, re-run Step 1, confirm 16/16 again.

- [ ] **Step 3: Record the result**

Append a short note to `memory/2026-08-05.md` (today's session log, following its
existing `## Session Summary` format) recording the final live-verified room count
and match-tier distribution — this is the artifact that closes out Action 2 from the
2026-08-05 project-review meeting synthesis.

---

## Notes for the implementer

- Do not modify `_build_space_polygons_label_anchored_hybrid`, `LABEL_VORONOI`,
  `SOLID_UNION`, or any other `WallProcessingMode` — out of scope per the design doc's
  Non-Goals.
- Do not attempt to fix the underlying wall-topology defect (why `SOLID_UNION` closes
  0 matching polygons here) — that's a separate, much larger, previously-3x-failed
  effort, deliberately not reopened by this plan.
- The `mirror` sidecar key is intentionally drawing-specific, not a new
  `WallProcessingMode` parameter — do not add `mirror_axis_x`/`mirror` handling
  anywhere in `LABEL_ANCHORED_HYBRID`'s own core function; it belongs only in the
  handler-layer wiring (Task 2) and the sidecar data (Task 3).
