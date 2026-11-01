# ADR-ff (Phase 3): RenderBackend Protocol Redesign + ZWCADBackend Promotion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape `RenderBackend` to match what `Renderer` actually calls (`draw_line`/`draw_text`/`draw_dimension` with real signatures), make `COMDrawingContext` satisfy it via one method rename, migrate all `Renderer` classes' type annotations from `DrawingContext` to `RenderBackend`, and verify zero behavior change.

**Architecture:** No new `ZWCADBackend` class — `COMDrawingContext` (`zwcad_face_elevation_context.py`) is promoted in place by renaming `draw_aligned_dimension` → `draw_dimension` and adding a `capability` attribute, satisfying `RenderBackend` via Python's `Protocol` structural typing. `Renderer` subclasses change only their constructor's type annotation (`ctx: DrawingContext` → `ctx: RenderBackend`); the internal attribute name `self._ctx` is unchanged, keeping the diff minimal. `detailed/dimension.py` additionally renames its 3 call sites from `draw_aligned_dimension` to `draw_dimension`.

**Tech Stack:** Python 3.11+, `typing.Protocol`/`@runtime_checkable`, `pytest`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-30-adr-ff-zwcad-backend-design.md` (reviewed twice — first pass found and fixed a factual error about which file constructs `COMDrawingContext`; second pass approved).

---

## Reference Conventions (read once, apply throughout)

- Every `Renderer` subclass constructor already imports its type-only dependencies inside
  a `if TYPE_CHECKING:` block (see `wall_renderer.py:9-18`, `door_renderer.py:12-18`,
  `window_renderer.py:12-18`, `detailed/annotation.py:10-13`, `detailed/dimension.py:9-13`,
  `composed_renderer.py:12-28`) — because `from __future__ import annotations` is present
  everywhere, changing `DrawingContext` → `RenderBackend` in these blocks has **zero
  runtime effect**; it only changes what a type checker sees. This is why the migration is
  low-risk: no runtime import cycle risk, no behavior change from the type-annotation
  edits themselves.
- `Renderer`'s actual draw calls are `self._ctx.draw_line(...)`,
  `self._ctx.draw_text(...)`, `self._ctx.draw_aligned_dimension(...)` — confirmed via grep
  (see spec §Problem table). The rename in this plan ONLY touches
  `draw_aligned_dimension` call sites (all 3 are in `detailed/dimension.py`); every other
  `self._ctx.draw_*` call is unchanged text.
- Run tests from project root: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/ -k "backend or elevation or render or dimension" -v` (adjust per-task as directed below).
- **TDD is mandatory** for the new structural-typing test and the parity test. The
  type-annotation-only changes (Task 3) don't need new tests per se — they're covered by
  running the FULL existing suite unchanged and expecting it to still pass (a passing
  suite after a type-annotation-only change is itself the verification).
- **Do not overclaim completion.** ADR-ff Exit Criterion 2 (pixel-equivalence against live
  ZWCAD) stays unchecked — no live ZWCAD session exists in this environment. Criterion 3
  (`zero import win32com` in Renderer) must be verified via `grep` BEFORE this phase's
  changes to establish whether it was already true — do not claim this phase "achieved"
  something that may have pre-existed. Criterion 4 stays unchecked (still blocked). This
  project has shipped two premature-completion incidents already (ADR-bb, ADR-cc/jj); a
  third is not acceptable.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/cad_intelligence/elevation/renderers/render_backend.py` | Modify | Protocol reshape: `draw_text` gains `rotation`, `draw_dimension` gains `text_override`/optional `layer`/`color`; `Text`/`Dimension` dataclasses gain matching fields; `@runtime_checkable` added |
| `src/cad_intelligence/elevation/renderers/matplotlib_backend.py` | Modify | Match new `draw_text`/`draw_dimension` signatures |
| `tests/backend_shared_suite.py` | Modify | `run_sample_calls` exercises new params |
| `tests/test_render_backend.py` | Modify | New field/param tests |
| `tests/test_matplotlib_backend.py`, `tests/test_backend_shared_suite.py`, `tests/test_backend_replay.py` | Modify | Adjust for new signatures where they construct `Text`/`Dimension` directly |
| `src/cad_intelligence/cad_io/handlers/zwcad_face_elevation_context.py` | Modify | `COMDrawingContext.draw_aligned_dimension` → `draw_dimension`; add `capability` attribute |
| `tests/test_com_drawing_context_satisfies_render_backend.py` | Create | Structural-typing test, no live ZWCAD |
| `src/cad_intelligence/elevation/renderers/composed_renderer.py`, `wall_renderer.py`, `door_renderer.py`, `window_renderer.py`, `detailed/annotation.py` | Modify | Type-annotation only: `DrawingContext` → `RenderBackend` |
| `src/cad_intelligence/elevation/renderers/detailed/dimension.py` | Modify | Type annotation + 3 call-site renames (`draw_aligned_dimension` → `draw_dimension`) |
| `docs/designs/ADR-face-elevation-architecture.md`, `CHANGELOG.md` | Modify | Status/exit-criteria updates |

---

### Task 1: Reshape RenderBackend Protocol + RecordingBackend

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/render_backend.py`
- Modify: `tests/test_render_backend.py`

- [ ] **Step 1: Write the failing tests for the new fields/params**

Add to `tests/test_render_backend.py` (append; do not remove existing tests):

```python
def test_draw_text_accepts_rotation():
    backend = RecordingBackend()
    backend.draw_text("hi", (0.0, 0.0, 0.0), height=10.0, layer="A-ANNO", rotation=45.0)
    assert backend.commands[0].rotation == 45.0


def test_draw_text_rotation_defaults_to_zero():
    backend = RecordingBackend()
    backend.draw_text("hi", (0.0, 0.0, 0.0), height=10.0, layer="A-ANNO")
    assert backend.commands[0].rotation == 0.0


def test_draw_dimension_accepts_text_override():
    backend = RecordingBackend()
    backend.draw_dimension(
        (0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (5.0, -2.0, 0.0),
        text_override="1200", layer="A-DIMS", color=7,
    )
    assert backend.commands[0].text_override == "1200"
    assert backend.commands[0].layer == "A-DIMS"
    assert backend.commands[0].color == 7


def test_draw_dimension_text_override_defaults_to_empty_string():
    backend = RecordingBackend()
    backend.draw_dimension((0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (5.0, -2.0, 0.0))
    assert backend.commands[0].text_override == ""


def test_render_backend_is_runtime_checkable():
    """A plain object with the right method names should satisfy isinstance()."""
    from cad_intelligence.elevation.renderers.render_backend import RenderBackend

    backend = RecordingBackend()
    assert isinstance(backend, RenderBackend)
```

Add the `RecordingBackend` import if not already present at the top of the file (it
should already be there from Phase 1).

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_render_backend.py -v`
Expected: `TypeError` (unexpected keyword argument `rotation`/`text_override`) or
`AttributeError` on the new fields, and the `isinstance` test fails with `TypeError:
Instance and class checks can only be used with @runtime_checkable protocols` (since
`@runtime_checkable` isn't added yet).

- [ ] **Step 3: Modify `render_backend.py`**

Apply these changes to `src/cad_intelligence/elevation/renderers/render_backend.py`:

1. Add `from typing import Protocol, runtime_checkable` (or `Protocol` already imported —
   add `runtime_checkable` to the import).
2. Add `@runtime_checkable` decorator directly above `class RenderBackend(Protocol):`.
3. Update the `RenderBackend` Protocol's docstring to the version specified in the spec's
   §Design "1. Redesigned RenderBackend Protocol" section (explains `draw_arc`/`draw_hatch`
   are unused-by-Renderer-today, kept for `RecordingBackend`/`MatplotlibBackend`).
4. Change `draw_text`'s Protocol signature to:
   ```python
   def draw_text(
       self, text: str, position: Point3, height: float, layer: str,
       rotation: float = 0.0, color: int | None = None,
   ) -> None: ...
   ```
5. Change `draw_dimension`'s Protocol signature to:
   ```python
   def draw_dimension(
       self, p1: Point3, p2: Point3, text_position: Point3,
       text_override: str = "", layer: str | None = None, color: int | None = None,
   ) -> None: ...
   ```
6. Update the `Text` dataclass to add `rotation: float = 0.0` and `color: int | None =
   None` fields (matching the Protocol's new params — the DrawCommand should carry
   everything the call received).
7. Update the `Dimension` dataclass to add `text_override: str = ""`, change `layer: str`
   to `layer: str | None = None`, add `color: int | None = None`.
8. Update `RecordingBackend.draw_text` and `.draw_dimension` method bodies to accept and
   forward the new params into the `Text(...)`/`Dimension(...)` constructors.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_render_backend.py -v`
Expected: PASS (all previous + 5 new tests).

- [ ] **Step 5: Self-review**

Confirm: `draw_arc`/`draw_hatch` signatures are UNCHANGED (only `draw_text`/
`draw_dimension` change); `@runtime_checkable` is present; existing Phase 1 tests
(`test_backend_capability_defaults_all_true`, etc.) still pass unmodified.

---

### Task 2: Update MatplotlibBackend + shared suite for new signatures

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/matplotlib_backend.py`
- Modify: `tests/backend_shared_suite.py`
- Modify: `tests/test_matplotlib_backend.py`, `tests/test_backend_shared_suite.py`, `tests/test_backend_replay.py` (only if they break — see Step 3)

- [ ] **Step 1: Update `run_sample_calls` in `tests/backend_shared_suite.py`**

Change the `draw_text` call to pass `rotation=15.0`, and the `draw_dimension` call to pass
`text_override="100"`, so the shared suite actually exercises the new params:

```python
def run_sample_calls(backend) -> None:
    """Exercise all five RenderBackend primitives once each, in a realistic order."""
    backend.draw_line((0.0, 0.0, 0.0), (100.0, 0.0, 0.0), layer="A-WALL", color=7)
    backend.draw_arc((50.0, 0.0, 0.0), radius=20.0, start_angle=0.0, end_angle=90.0, layer="A-DOOR")
    backend.draw_hatch(
        [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (10.0, 10.0, 0.0)], pattern="BRICK", layer="A-WALL-BRICK"
    )
    backend.draw_text("900x2100", (5.0, 5.0, 0.0), height=250.0, layer="A-ANNO", rotation=15.0)
    backend.draw_dimension(
        (0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (50.0, -20.0, 0.0),
        text_override="100", layer="A-DIMS",
    )
```

- [ ] **Step 2: Update `MatplotlibBackend.draw_text`/`.draw_dimension`**

In `matplotlib_backend.py`:

```python
def draw_text(
    self, text: str, position: Point3, height: float, layer: str,
    rotation: float = 0.0, color: int | None = None,
) -> None:
    self.axes.text(position[0], position[1], text, fontsize=height, rotation=rotation)

def draw_dimension(
    self, p1: Point3, p2: Point3, text_position: Point3,
    text_override: str = "", layer: str | None = None, color: int | None = None,
) -> None:
    self.axes.annotate(
        text_override,
        xy=(p1[0], p1[1]),
        xytext=(p2[0], p2[1]),
        arrowprops=dict(arrowstyle="<->"),
    )
```

(Note: `draw_dimension` now passes `text_override` as the annotate label instead of `""` —
this is a minor behavior improvement, not required by any test, but keeps the backend
honest about what it draws.)

- [ ] **Step 3: Run the full backend test suite, fix any breakage**

Run: `python -m pytest tests/test_matplotlib_backend.py tests/test_backend_shared_suite.py tests/test_backend_replay.py tests/test_render_backend.py -v`
Expected: PASS. If any test constructs `Text(...)`/`Dimension(...)` directly with
positional args that no longer match the new field order, fix that test's construction
call (add the new fields explicitly or use keyword args) — do not change the dataclass
field order to avoid touching a test; fix the test.

- [ ] **Step 4: Self-review**

Confirm zero backend-specific branching was introduced into
`tests/test_backend_shared_suite.py`'s cross-backend tests — the whole point of that file
is testing the SAME call sequence against both backends.

---

### Task 3: Promote COMDrawingContext to satisfy RenderBackend

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/zwcad_face_elevation_context.py`
- Create: `tests/test_com_drawing_context_satisfies_render_backend.py`

- [ ] **Step 1: Write the failing structural-typing test**

Create `tests/test_com_drawing_context_satisfies_render_backend.py`:

```python
"""Structural-typing test: COMDrawingContext satisfies RenderBackend without a live ZWCAD
COM session (ADR-ff Phase 3 — promotes COMDrawingContext in place, no new ZWCADBackend
class).
"""

from unittest.mock import MagicMock

from cad_intelligence.cad_io.handlers.zwcad_face_elevation_context import COMDrawingContext
from cad_intelligence.elevation.renderers.render_backend import RenderBackend


def test_com_drawing_context_satisfies_render_backend_protocol():
    fake_doc = MagicMock()
    ctx = COMDrawingContext(fake_doc)
    assert isinstance(ctx, RenderBackend)


def test_com_drawing_context_has_capability_attribute():
    fake_doc = MagicMock()
    ctx = COMDrawingContext(fake_doc)
    assert ctx.capability is not None
    assert ctx.capability.supports_hatch is True  # default BackendCapability()


def test_com_drawing_context_has_draw_dimension_not_draw_aligned_dimension():
    """The rename from draw_aligned_dimension to draw_dimension is what makes structural
    typing against RenderBackend succeed — Protocol matches by method NAME."""
    fake_doc = MagicMock()
    ctx = COMDrawingContext(fake_doc)
    assert hasattr(ctx, "draw_dimension")
    assert not hasattr(ctx, "draw_aligned_dimension")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_com_drawing_context_satisfies_render_backend.py -v`
Expected: `isinstance(ctx, RenderBackend)` returns `False` (method name mismatch —
`draw_aligned_dimension` vs required `draw_dimension`, and no `capability` attribute), or
`AttributeError` if `hasattr` checks run first — either way, failing for the right reason.

- [ ] **Step 3: Modify `COMDrawingContext`**

In `src/cad_intelligence/cad_io/handlers/zwcad_face_elevation_context.py`:

1. Add the import: `from cad_intelligence.elevation.renderers.render_backend import
   BackendCapability` near the top (outside any `TYPE_CHECKING` block — this needs to be a
   real runtime import since `capability` is a real instance attribute, not just a type
   annotation).
2. In `COMDrawingContext.__init__`, add: `self.capability = BackendCapability()`.
3. Rename the method `draw_aligned_dimension` to `draw_dimension` — keep the exact same
   body/logic, only the `def` line's method name changes:
   ```python
   def draw_dimension(
       self,
       p1: Tuple[float, float, float],
       p2: Tuple[float, float, float],
       text_position: Tuple[float, float, float],
       text_override: str = "",
       layer: str | None = None,
       color: int | None = None,
   ) -> Any:
       """Draw an aligned dimension via ms.AddDimAligned()."""
       ...  # body unchanged
   ```
4. Update the class docstring (currently says "Wraps a ZWCAD COM document's ModelSpace to
   provide draw_line, draw_text, draw_mtext, and draw_aligned_dimension methods compatible
   with ZWCADFaceRenderer") to say `draw_dimension` instead of `draw_aligned_dimension`,
   and note it now satisfies `RenderBackend` (ADR-ff Phase 3) in addition to
   `DrawingContext`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_com_drawing_context_satisfies_render_backend.py -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Self-review**

Confirm `draw_mtext` is UNCHANGED (spec's Non-Goals: it's dead code from `Renderer`'s
perspective but out of scope to remove); `ensure_layer`/`ensure_layers`/other
`COMDrawingContext` methods beyond the Protocol's five are untouched — extra methods don't
break Protocol satisfaction.

---

### Task 4: Fix the one real call-site rename in detailed/dimension.py

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/detailed/dimension.py`

**Note on approach (fixed after plan review):** the original draft of this task tried to
capture a "pre-rename baseline" by calling `DimensionRenderer.render()` against a
`RecordingBackend` — but `RecordingBackend` (Phase 1) never defined
`draw_aligned_dimension` (only the reshaped `draw_dimension`, added in Task 1 of THIS
plan), so that call would raise `AttributeError` immediately and produce no baseline at
all — a self-contradiction caught in plan review. The correct approach: capture the
PRE-rename baseline using `FakeDrawingContext` (`tests/test_elevation_renderers.py:39`,
already has `draw_aligned_dimension` and records into `.dimensions: list[dict]` — this is
the ADR-bb-era test double, unrelated to and untouched by this plan's `RecordingBackend`
changes), THEN make the rename, THEN capture the POST-rename output using
`RecordingBackend`'s (now-renamed) `draw_dimension`, and compare the two captures'
*argument values* (not object identity — one produces dicts, the other `Dimension`
dataclass instances) for equality.

- [ ] **Step 1: Capture the PRE-rename baseline via `FakeDrawingContext`**

Run this from project root (uses the CURRENT, un-renamed `dimension.py` —
`FakeDrawingContext.draw_aligned_dimension` already exists and works today):
```bash
python -c "
from tests.test_elevation_renderers import _make_test_scene, FakeDrawingContext, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE
from cad_intelligence.elevation.renderers.detailed.dimension import DimensionRenderer
scene = _make_test_scene()
fg = scene.room_blocks[0].faces[0].face_geometry
ctx = FakeDrawingContext()
DimensionRenderer(ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE).render(fg, wx=0.0, wy=0.0)
for d in ctx.dimensions:
    print(d)
"
```
Expected: prints 3 dicts (one per `draw_aligned_dimension` call in `dimension.py`'s
`render()` — overall height, overall width, one per opening). Save these printed dicts —
they are the PRE-rename baseline, expressed as `{p1, p2, text_position, text_override,
layer, color}` keys (matching `FakeDrawingContext.draw_aligned_dimension`'s recording
shape at `tests/test_elevation_renderers.py:114-121`).

- [ ] **Step 2: Write the failing test comparing pre/post captures**

Append to `tests/test_elevation_renderers.py`:

```python
def test_dimension_renderer_draw_dimension_rename_preserves_output():
    """ADR-ff Phase 3: draw_aligned_dimension -> draw_dimension rename on
    COMDrawingContext/RenderBackend must not change DimensionRenderer's output.

    Compares FakeDrawingContext's pre-rename recording shape (dicts, from the
    still-existing draw_aligned_dimension test double) against RecordingBackend's
    post-rename recording shape (Dimension dataclasses, from the renamed draw_dimension)
    — same argument VALUES, different capture mechanisms, since RecordingBackend never
    had draw_aligned_dimension in the first place (only the reshaped draw_dimension,
    Task 1 of this same plan).
    """
    scene = _make_test_scene()
    fg = scene.room_blocks[0].faces[0].face_geometry

    fake_ctx = FakeDrawingContext()
    DimensionRenderer(fake_ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE).render(
        fg, wx=0.0, wy=0.0
    )

    recording_ctx = RecordingBackend()
    DimensionRenderer(recording_ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE).render(
        fg, wx=0.0, wy=0.0
    )

    assert len(fake_ctx.dimensions) == len(recording_ctx.commands) == 3
    for fake_dim, recorded_cmd in zip(fake_ctx.dimensions, recording_ctx.commands):
        assert isinstance(recorded_cmd, Dimension)
        assert fake_dim["p1"] == recorded_cmd.p1
        assert fake_dim["p2"] == recorded_cmd.p2
        assert fake_dim["text_position"] == recorded_cmd.text_position
        assert fake_dim["text_override"] == recorded_cmd.text_override
        assert fake_dim["layer"] == recorded_cmd.layer
        assert fake_dim["color"] == recorded_cmd.color
```

Add `RecordingBackend`, `Dimension` imports from `cad_intelligence.elevation.renderers.render_backend`
at the top of the test file if not already present (Task 1/2 of this plan should have
already added `RecordingBackend` for other tests — check before duplicating the import).

- [ ] **Step 3: Run test to verify it fails for the right reason**

Run: `python -m pytest tests/test_elevation_renderers.py::test_dimension_renderer_draw_dimension_rename_preserves_output -v`
Expected: `AttributeError: 'RecordingBackend' object has no attribute
'draw_aligned_dimension'` — because `dimension.py` still calls
`self._ctx.draw_aligned_dimension(...)` (not yet renamed) against `recording_ctx`, which
only has `draw_dimension`. This is the correct, expected failure — confirming the test
setup is exercising the right code path before the rename lands.

- [ ] **Step 4: Make the 3 call-site renames**

In `src/cad_intelligence/elevation/renderers/detailed/dimension.py`, change all 3
`self._ctx.draw_aligned_dimension(` calls to `self._ctx.draw_dimension(` — no other
argument changes. Also update the `TYPE_CHECKING` import block: replace `from
...zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap` with:
```python
from ...zwcad_renderer import ZWCADGeometryStyle, ZWCADLayerMap
from ..render_backend import RenderBackend
```
(`detailed/dimension.py` is one level deeper than `renderers/`, matching
`detailed/annotation.py`'s import depth from Task 5 — `..render_backend`, two dots, NOT
one). Change the constructor's `ctx: DrawingContext` type annotation to `ctx:
RenderBackend`.

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_elevation_renderers.py::test_dimension_renderer_draw_dimension_rename_preserves_output -v`
Expected: PASS — `FakeDrawingContext`'s pre-rename-shape capture and `RecordingBackend`'s
post-rename-shape capture agree on every argument value across all 3 dimension calls.
`FakeDrawingContext` itself is untouched by this task (it still has
`draw_aligned_dimension` — it's a Phase-1-era/ADR-bb-era test double used by many other
tests in this file, not something this plan modifies).

- [ ] **Step 6: Self-review**

Confirm no argument values changed (`layer=layer, color=color` etc. are passed identically
— only the method NAME changed at each of the 3 call sites in `dimension.py`); confirm
`FakeDrawingContext` was not edited.

---

### Task 5: Migrate remaining Renderer type annotations

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/composed_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/wall_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/door_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/window_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/detailed/annotation.py`

- [ ] **Step 1: Change each file's `TYPE_CHECKING` import and constructor annotation**

For each of the 5 files, make the SAME mechanical change (no method-body changes — these
files call `draw_line`/`draw_text` only, which didn't rename). **`render_backend.py`
lives directly in `renderers/`** (same directory as `composed_renderer.py`/
`wall_renderer.py`/`door_renderer.py`/`window_renderer.py`, but ONE level shallower than
`detailed/annotation.py`) — so the import depth for `RenderBackend` differs by file from
the existing `zwcad_renderer` import depth (which lives one level further up, in
`elevation/`). Use the exact per-file imports below — do NOT copy one template for all 5:

| File | Existing `zwcad_renderer` import | New `RenderBackend` import (add) |
|---|---|---|
| `composed_renderer.py` | `from ..zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap` | `from .render_backend import RenderBackend` |
| `wall_renderer.py` | `from ..zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap` | `from .render_backend import RenderBackend` |
| `door_renderer.py` | `from ..zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap` | `from .render_backend import RenderBackend` |
| `window_renderer.py` | `from ..zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap` | `from .render_backend import RenderBackend` |
| `detailed/annotation.py` | `from ...zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap` | `from ..render_backend import RenderBackend` |

For each file, in the `if TYPE_CHECKING:` block:
1. Remove `DrawingContext` from the existing `zwcad_renderer` import line (keep
   `ZWCADGeometryStyle, ZWCADLayerMap`).
2. Add the `RenderBackend` import line from the table above (note: 4 of 5 files use a
   single dot `.render_backend`, only `detailed/annotation.py` uses `..render_backend` —
   this is DIFFERENT from the existing `zwcad_renderer` import's dot count for those same
   4 files, since `render_backend.py` and the 4 sibling renderer files are in the same
   directory).

Example for `wall_renderer.py` (apply the analogous edit to `composed_renderer.py`/
`door_renderer.py`/`window_renderer.py` — same dot count, `.render_backend`):
```python
if TYPE_CHECKING:
    from ..layout_engine import RoomBlock  # (if present — leave unrelated imports alone)
    from ..zwcad_renderer import ZWCADGeometryStyle, ZWCADLayerMap
    from .render_backend import RenderBackend
```

Example for `detailed/annotation.py` (the one file needing `..render_backend`):
```python
if TYPE_CHECKING:
    from ...zwcad_renderer import ZWCADGeometryStyle, ZWCADLayerMap
    from ..render_backend import RenderBackend
```

- In the constructor's parameter list, change `ctx: DrawingContext` to `ctx:
  RenderBackend`.
- Do NOT touch anything else — no method bodies, no `self._ctx` attribute renames, no
  other logic.

- [ ] **Step 2: Run the full elevation regression suite**

Run:
```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py tests/test_render_style.py tests/test_elevation_symbols.py tests/test_normalized_snapshot_parity.py tests/test_render_backend.py tests/test_matplotlib_backend.py tests/test_backend_shared_suite.py tests/test_backend_replay.py tests/test_com_drawing_context_satisfies_render_backend.py -v
```
Expected: ALL PASS, same count as before Task 5 plus whatever Task 1-4 added — since Task
5's changes are type-annotation-only (zero runtime effect, per the Reference Conventions
note about `from __future__ import annotations`), no test should behave differently. A
failure here means a typo in an import path, not a real logic bug — investigate the
traceback for `ImportError`/`SyntaxError` first.

- [ ] **Step 3: Self-review**

Grep each of the 5 files for `DrawingContext` — should return ZERO matches (fully
replaced). Grep for `self._ctx` — should show the SAME call sites as before this task
(unchanged, since only the import/annotation changed, not `self._ctx`'s name or usage).

---

### Task 6: Verify Exit Criterion 3 baseline honestly

**Files:** none (verification only, informs Task 7's doc wording)

- [ ] **Step 1: Check whether `import win32com` was already absent from Renderer BEFORE this phase**

Run: `git stash` (to temporarily revert this phase's uncommitted changes), then:
```
grep -rn "import win32com" src/cad_intelligence/elevation/renderers/
```
Note the result (expected: no matches, since `Renderer` always called `self._ctx.draw_*`,
never `win32com` directly — even before this phase). Then `git stash pop` to restore this
phase's changes.

- [ ] **Step 2: Re-run the same grep AFTER this phase's changes**

```
grep -rn "import win32com" src/cad_intelligence/elevation/renderers/
```
Expected: still no matches — confirms the criterion holds both before and after.

- [ ] **Step 3: Record the finding for Task 7's doc wording**

If Step 1 and Step 2 both show zero matches, Task 7 must word the ADR update as
"criterion was already true before this phase; this phase confirms and codifies it via the
Protocol formalization, not as something this phase caused." Do not claim this phase
"achieved zero win32com imports" if it was already zero.

---

### Task 7: Update ADR-ff documentation status

**Files:**
- Modify: `docs/designs/ADR-face-elevation-architecture.md`

- [ ] **Step 1: Read the current ADR-ff section**

Read post-Phase-2 state: status line mentions Phase 1+2, Exit Criterion 1 checked
(reinterpreted), dashboard `1/4`.

- [ ] **Step 2: Append a Phase 3 paragraph to the status line**

Add after the existing Phase 2 sentence:

```
Phase 3 (2026-07-30) redesigned `RenderBackend` to match Renderer's actual call surface
(`draw_line`/`draw_text`/`draw_dimension` with real signatures — `draw_arc`/`draw_hatch`
remain on the Protocol but unused by Renderer), promoted `COMDrawingContext`
(`zwcad_face_elevation_context.py`) to satisfy `RenderBackend` via a method rename
(`draw_aligned_dimension` → `draw_dimension`) rather than a new wrapper class, and migrated
all `Renderer` subclasses' constructor type annotations from `DrawingContext` to
`RenderBackend` (zero runtime behavior change — verified via parity test and full
regression). No new `ZWCADBackend` class exists; `COMDrawingContext` IS the ZWCAD backend
now, typed against `RenderBackend`.
```

- [ ] **Step 3: Update Exit Criterion 3 — check it, with the honest pre-existing-condition note**

Change:
```
- [ ] `Renderer`'s source contains zero `import win32com` — every ZWCAD-specific import is
      confined to `ZWCADBackend`.
      *(Not applicable yet 2026-07-30 — Renderer still uses DrawingContext, not
      RenderBackend; this criterion's premise doesn't hold until the Phase 3 migration
      happens.)*
```
to:
```
- [x] `Renderer`'s source contains zero `import win32com` — every ZWCAD-specific import is
      confined to `ZWCADBackend`.
      *(Satisfied 2026-07-30 — verified via `grep -rn "import win32com"
      src/cad_intelligence/elevation/renderers/` returning zero matches, BOTH before and
      after Phase 3's changes (Renderer classes always called `self._ctx.draw_*`, never
      `win32com` directly). Phase 3's contribution is confirming this via the completed
      Protocol migration — `COMDrawingContext` (the one class that DOES import COM
      internals, via `com_primitives_v3`) now formally satisfies `RenderBackend`, making
      "ZWCAD-specific import confined to the backend" a checked architectural property, not
      just an incidental fact.)*
```

**Only write this if Task 6 actually confirmed zero matches both before and after — if
Task 6 found a match, STOP and do not check this box; report the finding to the user
instead.**

- [ ] **Step 4: Update the compliance dashboard row**

Change `| ADR-ff | Partially Implemented (2026-07-30) | 1/4 | 1/4 |` to:
```
| ADR-ff | Partially Implemented (2026-07-30) | 2/4 | 2/4 |
```

- [ ] **Step 5: Self-review**

Confirm: exactly 2 checkboxes now checked in ADR-ff (Criteria 1 and 3); Criteria 2 and 4
remain unchecked with their existing notes untouched; dashboard fraction is `2/4`.

---

### Task 8: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entry above the Phase 2 entry**

```
- **[2026-07-30]**: **Continued ADR-ff (Renderer Output Backend Abstraction) — Phase 3 of 5: RenderBackend Protocol reshape + ZWCADBackend promotion** — Reshaped the `RenderBackend` Protocol (`src/cad_intelligence/elevation/renderers/render_backend.py`) to match what `Renderer` actually calls: `draw_text` gained `rotation`, `draw_dimension` gained `text_override`/optional `layer`/`color` (matching `DrawingContext.draw_aligned_dimension`'s real signature). `draw_arc`/`draw_hatch` are unchanged and remain on the Protocol (exercised by `RecordingBackend`/`MatplotlibBackend`'s Phase 2 test suite) despite no current `Renderer` calling them. Promoted `COMDrawingContext` (`src/cad_intelligence/cad_io/handlers/zwcad_face_elevation_context.py`) to satisfy `RenderBackend` by renaming `draw_aligned_dimension` → `draw_dimension` and adding a `capability` attribute — **no new `ZWCADBackend` class was created**; `COMDrawingContext` structurally satisfies `RenderBackend` via Python's `Protocol` typing (verified with `@runtime_checkable` + `isinstance()`, no live ZWCAD session needed). Migrated all `Renderer` subclasses (`ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/`WindowRenderer`/`AnnotationRenderer`/`DimensionRenderer`) from `ctx: DrawingContext` to `ctx: RenderBackend` type annotations — a zero-runtime-effect change (all imports are under `TYPE_CHECKING`) except `detailed/dimension.py`'s 3 call sites, which were renamed from `draw_aligned_dimension` to `draw_dimension` to match; parity-verified via `RecordingBackend` that this produces byte-identical output. ADR-ff Exit Criterion 3 (zero `win32com` imports in `Renderer`) is now checked — verified true both before and after this phase (Renderer never imported `win32com` directly; this phase formalizes that as a checked architectural property via the completed Protocol migration, not something newly caused by it). ADR-ff Exit Criteria: 2/4 now satisfied (up from 1/4); Criteria 2 (live-ZWCAD pixel comparison) and 4 (capability-gated degrade path) remain blocked — no live ZWCAD session available, and no `Renderer` code reads `.capability` yet. See `docs/designs/ADR-face-elevation-architecture.md` (ADR-ff).
```

- [ ] **Step 2: Self-review**

Confirm the entry doesn't claim Criterion 2/4 progress, correctly states the "already true
before this phase" nuance for Criterion 3, and says "2/4" not "half" or any rounded-up
framing.

---

### Task 9: Final whole-implementation review

**Files:** Read-only across Tasks 1-8.

- [ ] **Step 1: Full regression run**

Run:
```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py tests/test_render_style.py tests/test_elevation_symbols.py tests/test_normalized_snapshot_parity.py tests/test_render_backend.py tests/test_matplotlib_backend.py tests/test_backend_shared_suite.py tests/test_backend_replay.py tests/test_com_drawing_context_satisfies_render_backend.py -v
```
All PASS required. (The Task 4 temporary parity test may or may not still be present —
decide in Task 4 whether it's redundant with the existing `TestZWCADDetailedFaceRenderer`
suite's coverage; if redundant, remove it per the ADR-bb/gg disposable-test pattern; if it
adds unique coverage of the rename specifically, keep it — document the decision either
way in this step's notes.)

- [ ] **Step 2: Verify only intended files changed**

`git status --short` should show exactly the files in the File Structure table above, plus
possibly the Task 4 temporary test file's net-zero diff if removed. No changes to
`space.py`, `legacy/backend.py`, or any file outside the elevation renderer chain.

- [ ] **Step 3: Run the workspace audit**

Run: `bun scripts/audit.ts` — must exit clean.

- [ ] **Step 4: `grep` for zero remaining `DrawingContext` references in migrated files**

Run:
```
grep -rln "DrawingContext" src/cad_intelligence/elevation/renderers/composed_renderer.py src/cad_intelligence/elevation/renderers/wall_renderer.py src/cad_intelligence/elevation/renderers/door_renderer.py src/cad_intelligence/elevation/renderers/window_renderer.py src/cad_intelligence/elevation/renderers/detailed/annotation.py src/cad_intelligence/elevation/renderers/detailed/dimension.py
```
Expected: no output (zero matches) — confirms Task 5's migration is complete across all 6
files.

- [ ] **Step 5: Adversarial overclaiming re-read**

Re-read the full `ADR-face-elevation-architecture.md` diff and `CHANGELOG.md` entry.
Confirm: Criterion 2 is NOT checked anywhere; Criterion 4 is NOT checked anywhere; the
Criterion 3 "already true before this phase" nuance is preserved, not smoothed over into a
cleaner-sounding "this phase achieved X" claim. This is the third ADR-ff doc update in this
project — the bar is the same as Phases 1-2: "would a skeptical reviewer, given only this
diff, agree with every claim in it."

---

## Completion

After Task 9 passes, run:

```
/sync "feat(elevation): continue ADR-ff Phase 3 — RenderBackend Protocol reshape + ZWCADBackend promotion (COMDrawingContext)"
```

## Risk Notes

- **The single highest-value verification in this plan is Task 5 Step 2's full regression
  run** — because the migration touches 6 files' type annotations plus one real rename, a
  single typo in an import path (wrong relative-import depth, e.g. `..` vs `...`) would
  surface immediately as an `ImportError` there. Do not skip straight to Task 6 without
  this passing.
- **Exit Criterion 3's honest wording (Task 6/7) is the second highest risk** — it would be
  easy to accidentally write "this phase achieved zero win32com imports," which is false;
  the phase's actual contribution is architectural formalization, not a behavior change.
  Get this wrong and it's a fourth instance of this project's premature-completion pattern.
- **`COMDrawingContext`'s rename (Task 3) has exactly one real caller to update**
  (`detailed/dimension.py`, Task 4) — verified via grep in the spec review. If a future
  grep during implementation finds a SECOND caller of `draw_aligned_dimension` that wasn't
  caught during spec review, stop and re-verify the spec's claim before proceeding — do not
  silently patch around an unexpected caller.
