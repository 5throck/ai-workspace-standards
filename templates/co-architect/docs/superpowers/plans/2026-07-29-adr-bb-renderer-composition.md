# ADR-bb Renderer + RenderStyle Composition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two hardcoded renderer classes (`ZWCADSimpleFaceRenderer`, `ZWCADDetailedFaceRenderer`) with a single `Renderer` composed of `WallRenderer`/`DoorRenderer`/`WindowRenderer`, parameterized by a `RenderStyle` capability/policy object, per `docs/designs/ADR-face-elevation-architecture.md` (ADR-bb, lines 642-768).

**Architecture:** Introduce `RenderCapabilities` (bool switches) and `RenderPolicies` (enum/strategy choices) frozen dataclasses composed into `RenderStyle`. Build `SIMPLE`/`DETAILED` as `dataclasses.replace()`-derived preset constants. Consolidate the existing simple/detailed drawing code paths into element renderers (`WallRenderer`, `DoorRenderer`, `WindowRenderer`) that branch on `style.capabilities.*`/`style.policies.*` instead of being duplicated per class. `ZWCADRendererFactory` continues to return one `Renderer` type, now parameterized by style instead of selecting between classes.

**Tech Stack:** Python, `dataclasses`, `StrEnum`, pytest (existing `tests/test_elevation_renderers.py`, `tests/test_elevation_pipeline*.py`), existing golden fixture harness (`tests/golden/`).

**Scope note (ADR-cc deferred):** ADR-bb's target shape references `swing_symbol`/`window_symbol` strategies that ADR-cc formally defines. This plan implements `RenderPolicies.swing_symbol`/`window_symbol` as simple fields holding today's existing behavior wrapped in a single default strategy object (`VSwingStrategy`, `RectangleWindowStrategy`) — it does NOT build the full pluggable strategy registry (that is ADR-cc's own plan, next in the roadmap sequence). This keeps ADR-bb self-contained and unblocks ADR-cc afterward.

---

## Current State (read before starting)

- `src/cad_intelligence/elevation/renderers/base.py` — `BaseFaceRenderer(Renderer, ABC)`: traverses `LayoutScene` → `RoomBlock` → faces, calls abstract `render_face(fg, wx, wy)`.
- `src/cad_intelligence/elevation/renderers/simple_face_renderer.py` — `ZWCADSimpleFaceRenderer`: plain rectangles for walls/openings, `WxH` text labels, no hatch/frame/dimension.
- `src/cad_intelligence/elevation/renderers/detailed_face_renderer.py` — `ZWCADDetailedFaceRenderer`: same outline logic (duplicated from simple), plus delegates to `WallDetailRenderer`, `OpeningDetailRenderer` (→ `DoorDetailRenderer`/`WindowDetailRenderer`), `DimensionRenderer`, `AnnotationRenderer`.
- `src/cad_intelligence/elevation/renderers/detailed/{wall,opening,door,window,dimension,annotation}.py` — the actual detailed drawing logic, currently only invoked in detailed mode.
- `src/cad_intelligence/elevation/zwcad_renderer.py:180-259` — `ZWCADRendererFactory` (class-keyed `_registry` dict), `ZWCADFaceRenderer` back-compat wrapper (hardcodes `ZWCADRenderMode.SIMPLE`).
- Tests: `tests/test_elevation_renderers.py`, `tests/test_elevation_pipeline.py`, `tests/test_elevation_pipeline_v2.py`, `tests/test_elevation_integration.py`, `tests/test_elevation_spec.py`.

## File Structure (target)

- Create: `src/cad_intelligence/elevation/renderers/render_style.py` — `RenderCapabilities`, `RenderPolicies`, `RenderStyle`, `DimensionPolicy`, `SIMPLE`/`DETAILED` presets, default strategy classes.
- Create: `src/cad_intelligence/elevation/renderers/wall_renderer.py` — `WallRenderer` (outline + solid parts + hatch gated by `show_hatch`).
- Create: `src/cad_intelligence/elevation/renderers/door_renderer.py` — `DoorRenderer` (outline, frame gated by `show_frame`, handle gated by `show_handle`, swing symbol via policy, dimension gated by `show_dimension`).
- Create: `src/cad_intelligence/elevation/renderers/window_renderer.py` — `WindowRenderer` (outline, frame, glass gated by `show_glass`, dimension gated by `show_dimension`).
- Create: `src/cad_intelligence/elevation/renderers/composed_renderer.py` — `ComposedFaceRenderer(BaseFaceRenderer)`: single `Renderer` class wiring `WallRenderer`/`DoorRenderer`/`WindowRenderer`, replaces both `ZWCADSimpleFaceRenderer` and `ZWCADDetailedFaceRenderer`.
- Modify: `src/cad_intelligence/elevation/zwcad_renderer.py:180-259` — `ZWCADRendererFactory` registry maps `ZWCADRenderMode.SIMPLE`/`DETAILED` to `ComposedFaceRenderer` + the matching `RenderStyle` preset (not two classes); `ZWCADFaceRenderer` wrapper unchanged in behavior.
- Delete (final task, after parity confirmed): `simple_face_renderer.py`, `detailed_face_renderer.py`.
- Test: `tests/test_elevation_renderers.py` (extend), new `tests/test_render_style.py`.

---

### Task 1: `RenderStyle` / `RenderCapabilities` / `RenderPolicies` dataclasses

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/render_style.py`
- Test: `tests/test_render_style.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_render_style.py
from cad_intelligence.elevation.renderers.render_style import (
    RenderCapabilities, RenderPolicies, RenderStyle, DimensionPolicy,
    SIMPLE, DETAILED,
)

def test_simple_has_all_capabilities_off():
    assert SIMPLE.capabilities == RenderCapabilities()

def test_detailed_enables_hatch_frame_handle_dimension_annotation():
    caps = DETAILED.capabilities
    assert caps.show_hatch and caps.show_frame and caps.show_handle
    assert caps.show_dimension and caps.show_annotation

def test_detailed_built_from_simple_via_replace():
    # DETAILED must differ from SIMPLE only in the documented fields
    assert DETAILED.policies.dimension_style == DimensionPolicy.ARCHITECTURAL

def test_detailed_uses_title_block_header_simple_uses_plain():
    from cad_intelligence.elevation.renderers.render_style import HeaderStyle
    assert SIMPLE.policies.header_style == HeaderStyle.PLAIN
    assert DETAILED.policies.header_style == HeaderStyle.TITLE_BLOCK
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_render_style.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.elevation.renderers.render_style'`

- [ ] **Step 3: Write minimal implementation**

```python
# src/cad_intelligence/elevation/renderers/render_style.py
"""render_style.py — Renderer Domain: RenderStyle capability/policy model.

Defines the capability/policy split from ADR-bb (docs/designs/ADR-face-elevation-architecture.md).
Capabilities are binary "does this render at all" switches; policies are
"which convention does it follow" choices. SIMPLE/DETAILED are preset
constants built via dataclasses.replace(), not classes.

This module is COM-free and shapely-free.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from enum import StrEnum
from typing import Protocol


class DimensionPolicy(StrEnum):
    ARCHITECTURAL = "architectural"
    CONSTRUCTION = "construction"
    PRESENTATION = "presentation"


class HeaderStyle(StrEnum):
    """Room-block header rendering: PLAIN mirrors simple_face_renderer.py's
    rg.header-on-text_layer output; TITLE_BLOCK mirrors detailed_face_renderer.py's
    '{room_id} Elevations'-on-title_layer output. Added because this content/layer
    difference is not an annotation-presence question — do not fold into
    show_annotation."""

    PLAIN = "plain"
    TITLE_BLOCK = "title_block"


class SwingSymbolStrategy(Protocol):
    """Draws (or omits) a door swing symbol. Full strategy registry is ADR-cc's scope;
    this plan only needs a no-op and a single default implementation."""

    def draw(self, ctx, layer, color, og, wx: float, wy: float) -> None: ...


class WindowSymbolStrategy(Protocol):
    def draw(self, ctx, layer, color, og, wx: float, wy: float) -> None: ...


class NoSwingStrategy:
    """SIMPLE-tier default: draws nothing."""

    def draw(self, ctx, layer, color, og, wx: float, wy: float) -> None:
        return None


class VSwingStrategy:
    """DETAILED-tier default: today's two-straight-line swing approximation,
    moved from detailed/door.py without behavior change."""

    def draw(self, ctx, layer, color, og, wx: float, wy: float) -> None:
        from .detailed.door import draw_v_swing_lines  # existing logic, extracted in Task 3
        draw_v_swing_lines(ctx, layer, color, og, wx, wy)


class RectangleWindowStrategy:
    """SIMPLE-tier default: plain rectangle, no mullions."""

    def draw(self, ctx, layer, color, og, wx: float, wy: float) -> None:
        return None


class MullionWindowStrategy:
    """DETAILED-tier default: today's 4-pane sliding/mullion/glass-diagonal symbol."""

    def draw(self, ctx, layer, color, og, wx: float, wy: float) -> None:
        from .detailed.window import draw_mullion_symbol  # existing logic, extracted in Task 4
        draw_mullion_symbol(ctx, layer, color, og, wx, wy)


@dataclass(frozen=True)
class RenderCapabilities:
    show_hatch: bool = False
    show_frame: bool = False
    show_handle: bool = False
    show_glass: bool = False
    show_dimension: bool = False
    show_annotation: bool = False
    show_material: bool = False


@dataclass(frozen=True)
class RenderPolicies:
    dimension_style: DimensionPolicy = DimensionPolicy.ARCHITECTURAL
    header_style: HeaderStyle = HeaderStyle.PLAIN
    swing_symbol: SwingSymbolStrategy = field(default_factory=NoSwingStrategy)
    window_symbol: WindowSymbolStrategy = field(default_factory=RectangleWindowStrategy)


@dataclass(frozen=True)
class RenderStyle:
    capabilities: RenderCapabilities = field(default_factory=RenderCapabilities)
    policies: RenderPolicies = field(default_factory=RenderPolicies)


SIMPLE = RenderStyle()
DETAILED = replace(
    SIMPLE,
    capabilities=replace(
        SIMPLE.capabilities,
        show_hatch=True,
        show_frame=True,
        show_handle=True,
        show_glass=True,
        show_dimension=True,
        show_annotation=True,
    ),
    policies=replace(
        SIMPLE.policies,
        header_style=HeaderStyle.TITLE_BLOCK,
        swing_symbol=VSwingStrategy(),
        window_symbol=MullionWindowStrategy(),
    ),
)
```

Note: `show_glass=True` is added here (not left for Task 4) so `DETAILED`'s full capability set is defined in one place from the start; Task 4 only adds the `WindowRenderer` code that reads it.

Note: the `from .detailed.door import draw_v_swing_lines` / `from .detailed.window import draw_mullion_symbol` imports inside `VSwingStrategy.draw`/`MullionWindowStrategy.draw` are forward references to functions that Tasks 3-4 extract. Task 1's tests only exercise the dataclass shape, not `.draw()`, so this is safe to land first — mark it with a `# TODO(Task 3/4): extracted below` comment.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_render_style.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/render_style.py tests/test_render_style.py
git commit -m "feat(elevation): add RenderStyle capability/policy model (ADR-bb)"
```

---

### Task 2: `WallRenderer` — consolidate outline/solid/hatch drawing

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/wall_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/detailed/wall.py` (keep `_draw_brick_hatch`, called from new `WallRenderer`)
- Test: `tests/test_elevation_renderers.py` (extend)

- [ ] **Step 1: Write the failing test**

```python
# tests/test_elevation_renderers.py (add to existing file)
# NOTE: this file has NO pytest fixtures — reuse its existing helpers instead:
# the FakeDrawingContext class (records into .lines/.texts/.mtexts/.dimensions/.history),
# DEFAULT_LAYER_MAP / DEFAULT_GEOMETRY_STYLE constants (imported from cad_intelligence.elevation),
# and _make_test_scene() for a full scene, or build a single FaceRenderGeometry directly
# via RenderGeometryAssembler for a face-level test. Instantiate a fresh FakeDrawingContext()
# per test — do not add a shared fixture or a .reset()/.calls API that doesn't exist today.
from cad_intelligence.elevation.renderers.wall_renderer import WallRenderer
from cad_intelligence.elevation.renderers.render_style import SIMPLE, DETAILED

def test_wall_renderer_simple_style_skips_hatch():
    ctx = FakeDrawingContext()
    scene = _make_test_scene()
    fg = scene.room_blocks[0].faces[0].face_geometry
    renderer = WallRenderer(ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE)
    renderer.render(fg, wx=0.0, wy=0.0, render_style=SIMPLE)
    assert not any(l["layer"] == DEFAULT_LAYER_MAP.brick_layer for l in ctx.lines)

def test_wall_renderer_detailed_style_draws_hatch():
    ctx = FakeDrawingContext()
    scene = _make_test_scene()
    fg = scene.room_blocks[0].faces[0].face_geometry
    renderer = WallRenderer(ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE)
    renderer.render(fg, wx=0.0, wy=0.0, render_style=DETAILED)
    assert any(l["layer"] == DEFAULT_LAYER_MAP.brick_layer for l in ctx.lines)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_elevation_renderers.py -k wall_renderer -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

`WallRenderer.render(fg, wx, wy)` = the outline-drawing block copied verbatim from `simple_face_renderer.py:49-76` (identical in both old classes) + solid-parts block (lines 78-103, also identical in both) + `if self._style.capabilities.show_hatch: self._wall_detail_renderer.render(fg, wx, wy)` delegating to the existing `WallDetailRenderer` from `detailed/wall.py` (unchanged).

```python
# src/cad_intelligence/elevation/renderers/wall_renderer.py
from __future__ import annotations
from typing import TYPE_CHECKING
from .detailed.wall import WallDetailRenderer
from .render_style import RenderStyle

if TYPE_CHECKING:
    from ..zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap
    from ..render_geometry import FaceRenderGeometry


class WallRenderer:
    """Draws wall outline, solid parts, and (if style permits) hatch fill."""

    def __init__(self, ctx: DrawingContext, layer_map: ZWCADLayerMap, style: ZWCADGeometryStyle) -> None:
        self._ctx = ctx
        self._layer_map = layer_map
        self._style = style
        self._wall_detail_renderer = WallDetailRenderer(ctx, layer_map, style)

    def render(self, fg: FaceRenderGeometry, wx: float, wy: float, render_style: RenderStyle) -> None:
        # outline block: copy verbatim from simple_face_renderer.py:49-76
        ...
        # solid parts block: copy verbatim from simple_face_renderer.py:78-103
        ...
        if render_style.capabilities.show_hatch:
            self._wall_detail_renderer.render(fg, wx, wy)
```

(Full outline/solid-parts code is identical between the two existing renderers — copy exactly, do not rewrite; this preserves golden-fixture pixel parity.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_elevation_renderers.py -k wall_renderer -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/wall_renderer.py tests/test_elevation_renderers.py
git commit -m "feat(elevation): add WallRenderer consolidating outline/solid/hatch (ADR-bb)"
```

---

### Task 3: `DoorRenderer` — consolidate + extract swing symbol into `VSwingStrategy`

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/door_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/detailed/door.py` — extract the existing two-straight-line swing-drawing code into a standalone function `draw_v_swing_lines(ctx, layer, color, og, wx, wy)` (referenced by `VSwingStrategy` from Task 1), keep `DoorDetailRenderer` calling the same function so no behavior changes.
- Test: `tests/test_elevation_renderers.py` (extend)

- [ ] **Step 1: Write the failing test**

```python
# Reuse FakeDrawingContext / DEFAULT_LAYER_MAP / DEFAULT_GEOMETRY_STYLE / _make_test_scene()
# as in Task 2 — no shared fixtures exist in this file.
def test_door_renderer_simple_style_line_count_matches_plain_rectangle():
    ctx = FakeDrawingContext()
    scene = _make_test_scene()
    door_og = next(o for o in scene.room_blocks[0].faces[0].face_geometry.openings
                    if o.opening_type == FaceOpeningType.DOOR)
    renderer = DoorRenderer(ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE)
    renderer.render(door_og, wx=0.0, wy=0.0, render_style=SIMPLE)
    door_lines = [l for l in ctx.lines if l["layer"] == DEFAULT_LAYER_MAP.door_layer]
    assert len(door_lines) == 4  # outline only, no frame/swing

def test_door_renderer_detailed_style_draws_more_than_plain_rectangle():
    ctx = FakeDrawingContext()
    scene = _make_test_scene()
    door_og = next(o for o in scene.room_blocks[0].faces[0].face_geometry.openings
                    if o.opening_type == FaceOpeningType.DOOR)
    renderer = DoorRenderer(ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE)
    renderer.render(door_og, wx=0.0, wy=0.0, render_style=DETAILED)
    door_lines = [l for l in ctx.lines if l["layer"] == DEFAULT_LAYER_MAP.door_layer]
    assert len(door_lines) > 4  # outline + frame + handle + swing
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_elevation_renderers.py -k door_renderer -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

`DoorRenderer.render(og, wx, wy, render_style)`:
- Always: `draw_outline()` — copy from `simple_face_renderer.py:_render_opening` (rectangle).
- `if render_style.capabilities.show_frame`: double-frame drawing, copied from `detailed/door.py`'s existing frame logic.
- `if render_style.capabilities.show_handle`: handle drawing, copied from `detailed/door.py`.
- Always: `render_style.policies.swing_symbol.draw(self._ctx, layer, color, og, wx, wy)` — for `SIMPLE` this is `NoSwingStrategy` (no-op), for `DETAILED` this is `VSwingStrategy` which calls the extracted `draw_v_swing_lines`.
- `if render_style.capabilities.show_dimension`: delegate to existing `DimensionRenderer` for this opening (unchanged).

Extract in `detailed/door.py`: pull the swing-line-drawing statements out of `DoorDetailRenderer.render()`'s body into a module-level `draw_v_swing_lines(ctx, layer, color, og, wx, wy)` function; have `DoorDetailRenderer.render()` call it (this is the only change to `detailed/door.py` — verify `tests/test_elevation_renderers.py`'s existing detailed-mode tests still pass after this extraction, since `DoorDetailRenderer` itself remains referenced by `OpeningDetailRenderer` until Task 6 deletes the old classes).

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_elevation_renderers.py -k door_renderer -v`
Expected: PASS

- [ ] **Step 5: Run full existing elevation test suite to check no regression from the door.py extraction**

Run: `pytest tests/test_elevation_renderers.py tests/test_elevation_pipeline.py tests/test_elevation_pipeline_v2.py tests/test_elevation_integration.py -v`
Expected: all PASS (no behavior change to `DoorDetailRenderer`, only extraction)

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/door_renderer.py src/cad_intelligence/elevation/renderers/detailed/door.py tests/test_elevation_renderers.py
git commit -m "feat(elevation): add DoorRenderer, extract swing-line drawing for reuse (ADR-bb)"
```

---

### Task 4: `WindowRenderer` — consolidate + extract mullion symbol into `MullionWindowStrategy`

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/window_renderer.py`
- Modify: `src/cad_intelligence/elevation/renderers/detailed/window.py` — extract mullion/glass-diagonal drawing into `draw_mullion_symbol(ctx, layer, color, og, wx, wy)`.
- Test: `tests/test_elevation_renderers.py` (extend)

Same shape as Task 3, mirrored for windows (`show_frame` for outer+mullion frame, `show_glass` for diagonal glass marks, `window_symbol` policy for the sliding-sash pane pattern, `show_dimension` for dimension delegation).

**Important — this is not a verbatim split like Task 2/3.** In `detailed/window.py:60-71`, `draw_pane()` draws the pane frame (lines 64-67) and the glass diagonals (lines 70-71) back-to-back in one closure, with no existing seam between them. When extracting into `MullionWindowStrategy`/`WindowRenderer`, split `draw_pane()` into two steps: `draw_pane_frame(px, py)` (lines 64-67 content, gated by `show_frame`) and `draw_pane_glass(px, py)` (lines 70-71 content, gated by `show_glass`) called in sequence from the same pane-position loop (lines 74-79 stay as coordinate calculation, unchanged). `DETAILED` already sets both `show_frame=True` and `show_glass=True` (Task 1), so behavior is preserved: both still draw together under `DETAILED`, but are now independently gate-able.

- [ ] **Step 1: Write the failing test** (mirror Task 3's pattern for window capabilities)
- [ ] **Step 2: Run test, verify fails**
- [ ] **Step 3: Implement `WindowRenderer`, extract `draw_mullion_symbol` from `detailed/window.py`**
- [ ] **Step 4: Run test, verify passes**
- [ ] **Step 5: Run full elevation suite, verify no regression**

Run: `pytest tests/test_elevation_renderers.py tests/test_elevation_pipeline.py tests/test_elevation_pipeline_v2.py tests/test_elevation_integration.py -v`

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/window_renderer.py src/cad_intelligence/elevation/renderers/detailed/window.py tests/test_elevation_renderers.py
git commit -m "feat(elevation): add WindowRenderer, extract mullion drawing for reuse (ADR-bb)"
```

---

### Task 5: `ComposedFaceRenderer` — single `Renderer` wiring Wall/Door/Window

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/composed_renderer.py`
- Test: `tests/test_elevation_renderers.py` (extend)

- [ ] **Step 1: Write the failing test**

```python
from cad_intelligence.elevation.renderers.composed_renderer import ComposedFaceRenderer
from cad_intelligence.elevation.renderers.render_style import SIMPLE, DETAILED
from cad_intelligence.elevation.renderers.simple_face_renderer import ZWCADSimpleFaceRenderer
from cad_intelligence.elevation.renderers.detailed_face_renderer import ZWCADDetailedFaceRenderer

def _drawn_entities(ctx: FakeDrawingContext) -> tuple:
    # Compare recorded entities, not object identity — two separate
    # FakeDrawingContext instances (old vs new renderer) never share .lines/.texts.
    return (tuple(ctx.lines), tuple(ctx.texts), tuple(ctx.mtexts), tuple(ctx.dimensions))

def test_composed_renderer_simple_matches_old_simple_output():
    scene = _make_test_scene()

    new_ctx = FakeDrawingContext()
    ComposedFaceRenderer(new_ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE, SIMPLE).render(scene)

    old_ctx = FakeDrawingContext()
    ZWCADSimpleFaceRenderer(old_ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE).render(scene)

    assert _drawn_entities(new_ctx) == _drawn_entities(old_ctx)  # parity check

def test_composed_renderer_detailed_matches_old_detailed_output():
    scene = _make_test_scene()

    new_ctx = FakeDrawingContext()
    ComposedFaceRenderer(new_ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE, DETAILED).render(scene)

    old_ctx = FakeDrawingContext()
    ZWCADDetailedFaceRenderer(old_ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE).render(scene)

    assert _drawn_entities(new_ctx) == _drawn_entities(old_ctx)  # parity check
```

This parity test is the load-bearing check for ADR-bb's exit criterion "Existing golden fixtures render pixel-identically under SIMPLE/DETAILED before and after the migration" — it directly diffs old-vs-new drawing entity lists using two independent `FakeDrawingContext` instances (this fixture class has no `.reset()`/`.calls` API, so use separate instances rather than resetting one).

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_elevation_renderers.py -k composed_renderer -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write minimal implementation**

```python
# src/cad_intelligence/elevation/renderers/composed_renderer.py
from __future__ import annotations
from typing import TYPE_CHECKING
from ...common.room_face import FaceOpeningType
from .base import BaseFaceRenderer
from .wall_renderer import WallRenderer
from .door_renderer import DoorRenderer
from .window_renderer import WindowRenderer
from .render_style import RenderStyle, HeaderStyle

if TYPE_CHECKING:
    from ..zwcad_renderer import DrawingContext, ZWCADGeometryStyle, ZWCADLayerMap
    from ..layout_engine import RoomBlock
    from ..render_geometry import FaceRenderGeometry


class ComposedFaceRenderer(BaseFaceRenderer):
    """Single Renderer implementation composed of Wall/Door/Window element
    renderers, parameterized by RenderStyle (ADR-bb). Replaces
    ZWCADSimpleFaceRenderer and ZWCADDetailedFaceRenderer."""

    def __init__(
        self,
        ctx: DrawingContext,
        layer_map: ZWCADLayerMap,
        style: ZWCADGeometryStyle,
        render_style: RenderStyle,
    ) -> None:
        self._ctx = ctx
        self._layer_map = layer_map
        self._style = style
        self._render_style = render_style
        self._wall_renderer = WallRenderer(ctx, layer_map, style)
        self._door_renderer = DoorRenderer(ctx, layer_map, style)
        self._window_renderer = WindowRenderer(ctx, layer_map, style)

    def render_header(self, block: RoomBlock) -> None:
        # SIMPLE draws rg.header on text_layer (simple_face_renderer.py:37-47);
        # DETAILED draws f"{rg.room_id} Elevations" on title_layer
        # (detailed_face_renderer.py:48-59). These differ in both text content
        # and target layer — NOT an "annotation present/absent" question, so do
        # NOT reuse capabilities.show_annotation for this (that flag already
        # means something else: dimension/annotation sub-renderer gating).
        # Add a dedicated policy field instead: RenderPolicies.header_style:
        # HeaderStyle enum (PLAIN | TITLE_BLOCK), added to render_style.py in
        # this task. PLAIN -> rg.header on text_layer; TITLE_BLOCK ->
        # f"{rg.room_id} Elevations" on title_layer. SIMPLE uses PLAIN,
        # DETAILED uses TITLE_BLOCK.
        rg = block.room_geometry
        hx, hy = block.header_position
        if self._render_style.policies.header_style == HeaderStyle.TITLE_BLOCK:
            self._ctx.draw_text(
                f"{rg.room_id} Elevations", (hx, hy, 0.0), self._style.header_height,
                layer=self._layer_map.title_layer, color=self._style.text_color,
            )
        else:
            self._ctx.draw_text(
                rg.header, (hx, hy, 0.0), self._style.header_height,
                layer=self._layer_map.text_layer, color=self._style.text_color,
            )

    def render_face(self, fg: FaceRenderGeometry, wx: float, wy: float) -> None:
        self._wall_renderer.render(fg, wx, wy, self._render_style)
        for og in fg.openings:
            if og.opening_type == FaceOpeningType.DOOR:
                self._door_renderer.render(og, wx, wy, self._render_style)
            else:
                self._window_renderer.render(og, wx, wy, self._render_style)
        # face label — copy from whichever of the two old classes matches
        # (verify identical between simple/detailed; if they differ, gate
        # on a capability, do not hardcode a style check)
        ...
```

Fill in `render_header`/face-label bodies by diffing `simple_face_renderer.py` vs `detailed_face_renderer.py` line-by-line for exactly what differs, and express every difference as a capability/policy read — this is the step where ADR-bb's exit criterion #2 (`grep`ing for `if.*style.*==.*"detailed"` returns nothing) is actually enforced. Do not special-case by checking `render_style is DETAILED`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_elevation_renderers.py -k composed_renderer -v`
Expected: PASS (both parity tests pass — this is the proof that consolidation didn't change output)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/composed_renderer.py tests/test_elevation_renderers.py
git commit -m "feat(elevation): add ComposedFaceRenderer unifying simple/detailed (ADR-bb)"
```

---

### Task 6: Wire `ZWCADRendererFactory` to `ComposedFaceRenderer`, run full regression, delete old classes

**Files:**
- Modify: `src/cad_intelligence/elevation/zwcad_renderer.py:180-259`
- Delete: `src/cad_intelligence/elevation/renderers/simple_face_renderer.py`
- Delete: `src/cad_intelligence/elevation/renderers/detailed_face_renderer.py`
- Modify: `src/cad_intelligence/elevation/__init__.py` (remove now-dead exports of the two deleted classes if present, check lines around 105/182)

- [ ] **Step 1: Update the factory registry to construct `ComposedFaceRenderer` with the matching preset**

```python
# zwcad_renderer.py — replace lines 203-210
from .renderers.composed_renderer import ComposedFaceRenderer
from .renderers.render_style import SIMPLE, DETAILED

_RENDER_STYLE_BY_MODE = {
    ZWCADRenderMode.SIMPLE: SIMPLE,
    ZWCADRenderMode.DETAILED: DETAILED,
}


class _ComposedRendererFactory:
    """Adapter so ZWCADRendererFactory._registry[mode](ctx, layer_map, style)
    still works with a 3-arg constructor while ComposedFaceRenderer needs a 4th
    (render_style) argument."""

    def __init__(self, mode: ZWCADRenderMode) -> None:
        self._mode = mode

    def __call__(self, ctx, layer_map, style):
        return ComposedFaceRenderer(ctx, layer_map, style, _RENDER_STYLE_BY_MODE[self._mode])


ZWCADRendererFactory._registry = {
    ZWCADRenderMode.SIMPLE: _ComposedRendererFactory(ZWCADRenderMode.SIMPLE),
    ZWCADRenderMode.DETAILED: _ComposedRendererFactory(ZWCADRenderMode.DETAILED),
}
```

- [ ] **Step 2: Run the full elevation regression suite**

Run: `pytest tests/test_elevation_renderers.py tests/test_elevation_pipeline.py tests/test_elevation_pipeline_v2.py tests/test_elevation_integration.py tests/test_elevation_spec.py -v`
Expected: all PASS

- [ ] **Step 3: Confirm there is no elevation golden fixture suite (verified during plan review — `tests/golden/` only has `ceiling/`, `facade/`, `schedule/`, `section/`, `takeoff/`, `review/`, no `elevation/`)**

ADR-bb's exit criterion #4 ("existing golden fixtures render pixel-identically... before and after migration") cannot be verified by a golden-image diff because no such fixture suite exists for elevation today. The Task 5 parity tests (`test_composed_renderer_*_matches_old_*_output`) are the closest available substitute — they diff the full recorded drawing-entity sequence (lines/texts/mtexts/dimensions) between old and new renderers, which is a stronger check than a pixel diff for this migration (catches any geometry/layer/text difference, not just visual ones). Treat those two tests, already green from Task 5, as satisfying this exit criterion's *intent* for this migration. Do not attempt to build a new golden-image fixture suite as part of this task — that is out of scope (see "Out of scope" section) and belongs to ADR-dd (Golden Dataset), later in the roadmap sequence.

- [ ] **Step 4: Delete the old renderer classes**

```bash
git rm src/cad_intelligence/elevation/renderers/simple_face_renderer.py
git rm src/cad_intelligence/elevation/renderers/detailed_face_renderer.py
```

Update `src/cad_intelligence/elevation/__init__.py` to remove any now-broken imports/exports of the deleted classes.

- [ ] **Step 5: Run `grep` to confirm ADR-bb exit criterion #2**

Run: `grep -rn 'style.*==.*"detailed"\|style.*==.*"simple"' src/cad_intelligence/elevation/renderers/`
Expected: no matches (empty output)

- [ ] **Step 6: Run full test suite one more time**

Run: `pytest tests/test_elevation_renderers.py tests/test_elevation_pipeline.py tests/test_elevation_pipeline_v2.py tests/test_elevation_integration.py tests/test_elevation_spec.py tests/golden/ -k elevation -v`
Expected: all PASS

- [ ] **Step 7: Run project audit**

Run: `bun scripts/audit.ts`
Expected: exit 0 / all checks green

- [ ] **Step 8: Commit**

```bash
git add src/cad_intelligence/elevation/zwcad_renderer.py src/cad_intelligence/elevation/__init__.py
git commit -m "feat(elevation): wire ZWCADRendererFactory to ComposedFaceRenderer, delete old classes (ADR-bb)"
```

---

### Task 7: Update ADR-bb exit criteria checkboxes in the design doc

**Files:**
- Modify: `docs/designs/ADR-face-elevation-architecture.md:757-767` (ADR-bb Exit Criteria) and line 643 (Status)

- [ ] **Step 1: Check off exit criteria 1-3 (lines 759, 761, 764)** — verified true by Tasks 1-6 (old classes deleted, no style-name string comparisons per Task 6 Step 5's grep, `CONSTRUCTION`-style additions require zero renderer changes per the `replace()`-based preset design). **Check off criterion 4 (line 766) with an annotation**, not silently: append "(verified via entity-sequence parity tests in `tests/test_elevation_renderers.py::test_composed_renderer_*_matches_old_*_output`, not a pixel-image golden diff — no elevation golden fixture suite exists yet; see ADR-dd)" so a future reader knows this used a substitute check, not the literal image-diff the criterion originally implied.
- [ ] **Step 2: Update ADR-bb Status line 643** from `Proposed (target...)` to `Implemented (2026-07-29) — see src/cad_intelligence/elevation/renderers/{render_style,wall_renderer,door_renderer,window_renderer,composed_renderer}.py`.
- [ ] **Step 3: Update Roadmap Addendum** (search the doc for "Phase 4" reference near line 1503-1513) to mark Phase 4 complete, unblocking Phase 5 (ADR-gg, next in the roadmap sequence).
- [ ] **Step 4: Commit**

```bash
git add docs/designs/ADR-face-elevation-architecture.md
git commit -m "docs(elevation): mark ADR-bb implemented, update roadmap Phase 4 status"
```

---

## Out of scope (explicitly deferred to their own plans)

- ADR-cc's full pluggable Strategy Registry (this plan only ships single default strategies, not a registry) — next plan in the roadmap sequence.
- ADR-gg Render Pass Pipeline, ADR-dd Golden Dataset infra, ADR-ff RenderBackend abstraction, ADR-hh RecordingBackend, ADR-jj Strategy Registry — each gets its own brainstorming → plan cycle per the user's approved roadmap order (bb → gg → cc → jj → ff → hh → dd).
