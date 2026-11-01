# ADR-gg: Render Pass Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ComposedFaceRenderer.render_face()`'s draw order an explicit, named, `order`-keyed `RenderPass` sequence instead of an implicit consequence of call order, while preserving today's exact visual output.

**Architecture:** New `render_pass.py` defines a frozen `RenderPass(name, order)` dataclass plus six gap-spaced constants (BACKGROUND=10 … TEXT=60). `render_face()` builds a `list[tuple[RenderPass, Callable[[], None]]]` work items in today's order, then executes them via `sorted(items, key=lambda i: i[0].order)` — relying on Python's stable sort to preserve same-pass insertion order (annotation before face label, both `TEXT`).

**Tech Stack:** Python 3.11+, `dataclasses`, `pytest`. No new dependencies. All modules stay COM-free and shapely-free.

**Spec:** `docs/superpowers/specs/2026-07-29-adr-gg-render-pass-pipeline-design.md`

---

## Reference Conventions (read once, apply throughout)

- Module docstring header format — see `src/cad_intelligence/elevation/renderers/render_style.py:1-10` for the exact `"""<file>.py — Renderer Domain: <summary>.\n\n<body>\n\nThis module is COM-free and shapely-free."""` pattern. Every new/modified module keeps it.
- Test double: `FakeDrawingContext` at `tests/test_elevation_renderers.py:39` implements the `DrawingContext` protocol and records every call into `self.history: List[Tuple[str, str]]` (ordered `(kind, layer)` tuples). Reuse it — do NOT write a new mock.
- Run tests from project root: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_render_pass.py -v` (and the full elevation suite with `python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py -v`).
- **TDD is mandatory**: every task writes the failing test FIRST, runs it to confirm it fails for the right reason, THEN implements.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/cad_intelligence/elevation/renderers/render_pass.py` | Create | `RenderPass` frozen dataclass + 6 named constants |
| `tests/test_render_pass.py` | Create | Unit tests for `RenderPass` + extensibility test |
| `src/cad_intelligence/elevation/renderers/composed_renderer.py` | Modify | `render_face()` → work-item list sorted by pass order |
| `tests/test_elevation_renderers.py` | Modify | Add parity test (temporary), then remove after verification |
| `docs/designs/ADR-face-elevation-architecture.md` | Modify | ADR-gg status, exit criteria, dashboard, roadmap |

---

### Task 1: RenderPass model

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/render_pass.py`
- Test: `tests/test_render_pass.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_render_pass.py`:

```python
"""Unit tests for RenderPass (ADR-gg)."""

from dataclasses import FrozenInstanceError

import pytest

from cad_intelligence.elevation.renderers import render_pass
from cad_intelligence.elevation.renderers.render_pass import (
    BACKGROUND,
    DIMENSION,
    OPENING,
    SYMBOL,
    TEXT,
    WALL,
    RenderPass,
)


def test_render_pass_is_frozen():
    """A RenderPass instance must be immutable."""
    p = RenderPass("x", 99)
    with pytest.raises(FrozenInstanceError):
        p.order = 100  # type: ignore[misc]


def test_render_pass_equality_and_hash():
    """Equal RenderPasses compare equal and are hashable (usable as dict/sort keys)."""
    assert RenderPass("wall", 20) == WALL
    assert hash(RenderPass("wall", 20)) == hash(WALL)


def test_builtin_passes_have_expected_order_values():
    assert (BACKGROUND.order, WALL.order, OPENING.order,
            SYMBOL.order, DIMENSION.order, TEXT.order) == (10, 20, 30, 40, 50, 60)


def test_builtin_passes_are_strictly_increasing():
    seq = [BACKGROUND, WALL, OPENING, SYMBOL, DIMENSION, TEXT]
    assert all(seq[i].order < seq[i + 1].order for i in range(len(seq) - 1))


def test_new_pass_inserts_between_existing_without_editing_module():
    """Exit Criterion 2: a caller can slot a new pass in by order, no source edit."""
    selection = RenderPass("selection", 65)  # defined in this test file, not in render_pass.py
    items = [TEXT, selection, WALL]
    ordered = sorted(items, key=lambda p: p.order)
    assert ordered == [WALL, TEXT, selection]
    assert WALL.order < selection.order < 999
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_render_pass.py -v`
Expected: collection error / `ImportError: cannot import name 'RenderPass'` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/cad_intelligence/elevation/renderers/render_pass.py`:

```python
"""render_pass.py — Renderer Domain: RenderPass ordering model (ADR-gg).

Defines a named, ordered drawing phase. Renderers build a list of
(RenderPass, callable) work items and execute them sorted by `.order`, so
draw order is an explicit, inspectable artifact rather than an implicit
consequence of call order. Gaps of 10 between built-in passes let callers
insert new passes (e.g. a future SELECTION at order=65) by instantiating a
new RenderPass constant — no edit to this module required (ADR-gg Exit
Criterion 2).

This module is COM-free and shapely-free.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RenderPass:
    """A named, ordered drawing phase. Lower `order` draws first.

    When multiple work items share the same `order` (e.g. annotation and the
    face label both at TEXT), the caller's insertion order is the tie-break —
    Python's `sorted()` is stable, so same-pass items keep their build order.
    """

    name: str
    order: int


BACKGROUND = RenderPass("background", 10)
WALL = RenderPass("wall", 20)
OPENING = RenderPass("opening", 30)
SYMBOL = RenderPass("symbol", 40)
DIMENSION = RenderPass("dimension", 50)
TEXT = RenderPass("text", 60)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_render_pass.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Self-review**

Confirm: docstring matches the header convention; the dataclass is `frozen=True`; no registry object exists beyond the module namespace (registration-by-instantiation, per spec line 66-70); `test_new_pass_inserts_between_existing_without_editing_module` truly defines `RenderPass("selection", 65)` locally and does NOT touch `render_pass.py`.

---

### Task 2: Refactor ComposedFaceRenderer.render_face() onto the pass pipeline

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/composed_renderer.py` (`render_face` only)
- Test: `tests/test_elevation_renderers.py` (add a parity test)

- [ ] **Step 1: Capture the PRE-refactor baseline (before changing anything)**

The parity test needs the *current* `render_face()` output as the reference. There is **no existing test that drives `ComposedFaceRenderer` directly** — every renderer test goes through `ZWCADRendererFactory.create(...)`. So construct the `fg` the same way the existing `WallRenderer` tests do (verified pattern at `tests/test_elevation_renderers.py:328-333`): use the `_make_test_scene()` helper (line 126), pull `fg = scene.room_blocks[0].faces[0].face_geometry`, and call with `wx=0.0, wy=0.0`.

Add this temporary test to `tests/test_elevation_renderers.py` (append after the existing `test_window_renderer_*` tests near the bottom):

```python
def test_render_face_parity_simple_and_detailed():
    """ADR-gg parity gate: pass-pipeline refactor must not change draw order.

    The EXPECTED tuples below were captured from render_face() BEFORE the
    ADR-gg refactor. After the refactor lands, this test must still pass —
    proving the sorted-by-pass-order path reproduces today's exact output.
    Delete this test once green (one-time migration verification).
    """
    scene = _make_test_scene()
    fg = scene.room_blocks[0].faces[0].face_geometry
    for render_style, expected_history in [
        (SIMPLE, EXPECTED_SIMPLE_HISTORY),
        (DETAILED, EXPECTED_DETAILED_HISTORY),
    ]:
        ctx = FakeDrawingContext()
        renderer = ComposedFaceRenderer(
            ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE, render_style
        )
        renderer.render_face(fg, wx=0.0, wy=0.0)
        assert ctx.history == expected_history, (
            f"draw order changed for {render_style.policies} — ADR-gg refactor "
            "must preserve pre-refactor output"
        )
```

**How to capture `EXPECTED_*_HISTORY` (do this for REAL, do not fabricate):**
1. The `fg` setup above (via `_make_test_scene()`) produces a `FaceRenderGeometry` with one DOOR (900x2100) and one WINDOW (1200x1400) — confirmed at `tests/test_elevation_renderers.py:128-134`.
2. Temporarily run a one-off snippet that builds that same `fg`, runs the CURRENT (un-refactored) `render_face`, and prints `ctx.history`. Use this exact scratch invocation from the project root (it imports the real, current code):

```bash
cd C:/git/ai_workspace/Projects/co-architect && python -c "
from tests.test_elevation_renderers import _make_test_scene, FakeDrawingContext, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE
from cad_intelligence.elevation.renderers.composed_renderer import ComposedFaceRenderer
from cad_intelligence.elevation.renderers.render_style import SIMPLE, DETAILED
scene = _make_test_scene()
fg = scene.room_blocks[0].faces[0].face_geometry
for name, style in [('SIMPLE', SIMPLE), ('DETAILED', DETAILED)]:
    ctx = FakeDrawingContext()
    ComposedFaceRenderer(ctx, DEFAULT_LAYER_MAP, DEFAULT_GEOMETRY_STYLE, style).render_face(fg, wx=0.0, wy=0.0)
    print(name, '==', ctx.history)
"
```

3. Paste the printed tuples verbatim as the literal values of `EXPECTED_SIMPLE_HISTORY` and `EXPECTED_DETAILED_HISTORY` at module level in the test file. Do NOT hand-write them from reading the source — the whole point is they're an empirical baseline.

- [ ] **Step 2: Run the parity test to confirm it PASSES on the pre-refactor code**

Run: `python -m pytest tests/test_elevation_renderers.py::test_render_face_parity_simple_and_detailed -v`
Expected: PASS — this proves the baseline capture is correct *before* the refactor. If it fails now, the captured literals are wrong; re-capture. Do not proceed until it passes against the current code.

- [ ] **Step 3: Refactor `render_face()` onto the pass pipeline**

Modify `render_face()` in `composed_renderer.py`. Replace the sequential-call body with work-item construction + sorted execution. The *content* of each step (the exact `draw_*` calls, their arguments, their conditions) MUST be unchanged — only how they're invoked changes (wrapped in lambdas, tagged with a `RenderPass`).

Reference shape (adapt to keep all current logic identical):

```python
from .render_pass import DIMENSION, OPENING, TEXT, WALL, RenderPass

def render_face(self, fg, wx, wy):
    """Draw a single wall face via an ordered RenderPass pipeline (ADR-gg)."""
    work_items: list[tuple[RenderPass, Callable[[], None]]] = []

    # WALL — outline, solid parts, capability-gated hatch.
    work_items.append((WALL, lambda: self._wall_renderer.render(fg, wx, wy, self._render_style)))

    # OPENING — doors/windows + (when not showing dimensions) the size label.
    def _openings():
        for og in fg.openings:
            is_door = og.opening_type == FaceOpeningType.DOOR
            if is_door:
                self._door_renderer.render(og, wx, wy, self._render_style)
            elif og.opening_type == FaceOpeningType.WINDOW:
                self._window_renderer.render(og, wx, wy, self._render_style)
            if not self._render_style.capabilities.show_dimension:
                label_height = (
                    self._style.door_label_height if is_door else self._style.window_label_height
                )
                self._ctx.draw_text(
                    f"{og.width:.0f}x{og.height:.0f}",
                    (og.center_x + wx, og.center_y + wy, 0.0),
                    label_height,
                    layer=self._layer_map.text_layer,
                    color=self._style.text_color,
                )
    work_items.append((OPENING, _openings))

    # DIMENSION — whole-face pass, capability-gated.
    if self._render_style.capabilities.show_dimension:
        work_items.append(
            (DIMENSION, lambda: self._dimension_renderer.render(fg, wx, wy))
        )

    # TEXT — annotation (capability-gated), THEN face label.
    # Same-pass tie: sorted() is stable, so annotation-before-label depends on
    # THIS append order. Do not reorder same-pass items. (ADR-gg)
    if self._render_style.capabilities.show_annotation:
        work_items.append(
            (TEXT, lambda: self._annotation_renderer.render(fg, wx, wy))
        )

    label_layer = (
        self._layer_map.label_layer
        if self._render_style.policies.header_style == HeaderStyle.TITLE_BLOCK
        else self._layer_map.text_layer
    )

    def _face_label():
        self._ctx.draw_text(
            fg.label,
            (fg.label_x + wx, fg.label_y + wy, 0.0),
            self._style.face_label_height,
            layer=label_layer,
            color=self._style.text_color,
        )
    work_items.append((TEXT, _face_label))

    # Execute in pass order; stable sort preserves same-pass insertion order.
    for _, fn in sorted(work_items, key=lambda item: item[0].order):
        fn()
```

Add `from collections.abc import Callable` to the imports.

**Critical parity constraints:**
- The lambda closures over `og` in the OPENING pass: a `for og in fg.openings` inside a `def` (not a comprehension-of-lambdas) binds `og` correctly because the loop runs eagerly when `_openings()` is called. Keep the loop inside the named function as shown — do NOT refactor it into a list of per-opening lambdas (that would cause a late-binding bug).
- The `label_layer` variable is computed once before `_face_label` is defined, exactly matching today's behavior.
- The face label MUST be appended AFTER the annotation append (same `TEXT` pass, stable-sort tie-break) — this is the load-bearing invariant from spec lines 105-113.

- [ ] **Step 4: Run the parity test to confirm output is UNCHANGED**

Run: `python -m pytest tests/test_elevation_renderers.py::test_render_face_parity_simple_and_detailed -v`
Expected: PASS. If it FAILS, the refactor changed draw order or arguments — fix it until green. Do not weaken the expected literal.

- [ ] **Step 5: Run the full elevation test suite**

Run: `python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py -v`
Expected: all PASS (no regressions). If any previously-passing test now fails, the refactor introduced a real behavior change — investigate, do not delete the failing test.

- [ ] **Step 6: Remove the temporary parity test**

Delete `test_render_face_parity_simple_and_detailed`, `EXPECTED_SIMPLE_HISTORY`, and `EXPECTED_DETAILED_HISTORY` from `tests/test_elevation_renderers.py`. It served its one-time migration-verification purpose (same pattern as ADR-bb Task 5).

- [ ] **Step 7: Re-run the suite to confirm clean removal**

Run: `python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py -v`
Expected: all PASS, test count down by 1 vs Step 5.

- [ ] **Step 8: Self-review**

Confirm: no `lambda` late-binding bug for `og`; `Callable` imported from `collections.abc`; `render_header()` and `BaseFaceRenderer.render()` untouched; the load-bearing comment about stable-sort tie-break is present at the TEXT appends.

---

### Task 3: Update ADR-gg documentation status

**Files:**
- Modify: `docs/designs/ADR-face-elevation-architecture.md`

This task updates the design doc to reflect that ADR-gg's Exit Criteria 1 & 2 are implemented. Exit Criterion 3 (RecordingBackend) is blocked on ADR-hh and stays unchecked.

- [ ] **Step 1: Read the current ADR-gg section and dashboard**

Read `docs/designs/ADR-face-elevation-architecture.md` around lines 156-167 (compliance dashboard) and 794-863 (ADR-gg section) to find exact strings to edit.

- [ ] **Step 2: Update the ADR-gg status line**

In the ADR-gg section (~line 794-796), change `**Status**: Proposed (target — depends on ADR-bb; ...)` to:

```
**Status**: Implemented (2026-07-29) — Exit Criteria 1 & 2 satisfied via the open
`order`-keyed RenderPass pipeline in `composed_renderer.py`; Criterion 3 (RecordingBackend
pass-order preservation) remains blocked on ADR-hh (not yet implemented).
```

- [ ] **Step 3: Update the Exit Criteria checklist in the ADR-gg section**

Find the three `- [ ]` items (~line 856-862) and check the first two with verification annotations; leave the third unchecked with a note:

```
- [x] `Renderer.render()` produces `RENDER_PASS_ORDER`-equivalent output whether passes are
      driven by the closed enum or the open `order`-keyed registration — no visual diff.
      *(Verified 2026-07-29 as a reinterpretation: only the open form is built; parity test
      proved it reproduces the pre-refactor hardcoded-call-order output byte-identically. No
      closed-enum implementation exists to compare against. See
      docs/superpowers/specs/2026-07-29-adr-gg-render-pass-pipeline-design.md §Exit Criteria.)*
- [x] A new pass (e.g. `SELECTION`) can be added by a caller without editing this module's
      source, only registering a new `RenderPass(name, order)` instance.
      *(Verified 2026-07-29 — tests/test_render_pass.py::test_new_pass_inserts_between_existing_without_editing_module.)*
- [ ] `RecordingBackend` (ADR-hh)'s captured command list preserves pass order — replaying
      it reproduces the same visual stacking as a live render.
      *(Blocked on ADR-hh, not yet implemented — left unchecked.)*
```

- [ ] **Step 4: Update the compliance dashboard row**

Find the dashboard table (~line 164): `| ADR-gg | Proposed | 0/3 | 0/3 |` and change to:

```
| ADR-gg | Implemented (2026-07-29) | 2/3 | 2/3 |
```

- [ ] **Step 5: Update the Roadmap Addendum**

Search for the ADR-gg / Phase 4 row in the Roadmap Addendum (the Epic table ~line 232 mentions "Renderer Unification | ADR-bb, ADR-gg, ADR-cc, ADR-jj"). If there is a per-phase status annotation (as ADR-bb got "(Completed 2026-07-29)"), add "(ADR-gg completed 2026-07-29)" next to the relevant roadmap row. If the roadmap uses a different status mechanism, follow whatever pattern ADR-bb's completion set.

- [ ] **Step 6: Self-review**

Re-read the edited sections. Confirm: dashboard row status + both fraction columns agree (2/3); exactly two exit-criteria checkboxes are checked and one is unchecked with the ADR-hh note; no other ADR rows were accidentally edited.

---

### Task 4: Final whole-implementation review

**Files:** Read-only across all Task 1-3 changes.

- [ ] **Step 1: Verify the full test suite is green**

Run: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py -v`
Expected: all PASS.

- [ ] **Step 2: Verify the static anti-pattern grep is clean**

Run: `cd C:/git/ai_workspace/Projects/co-architect && git diff --stat` and review that only the five intended files changed (render_pass.py, test_render_pass.py, composed_renderer.py, test_elevation_renderers.py, ADR doc). No stray files.

- [ ] **Step 3: Confirm no temporary parity-test remnants**

Run: `cd C:/git/ai_workspace/Projects/co-architect && grep -rn "EXPECTED_SIMPLE_HISTORY\|EXPECTED_DETAILED_HISTORY\|test_render_face_parity" tests/`
Expected: no matches (the temporary test and its literals were removed in Task 2 Step 6).

- [ ] **Step 4: Adversarial self-review**

Ask: (a) Does a hypothetical `RenderPass("overlay", 999)` registered by a future caller sort after TEXT without editing render_pass.py? (Yes — sorted by `.order`.) (b) Could the OPENING-pass lambda close over `og` incorrectly? (No — eager loop inside `_openings()`.) (c) Is the annotation-before-face-label order preserved for both SIMPLE and DETAILED? (Yes — parity test verified before removal.) If any answer is "no" or uncertain, go back and fix.

---

## Completion

After Task 4 passes, the work is complete. Per the workspace's `/sync`-only commit policy (direct `git commit` is blocked by the pre-commit hook), do NOT commit per-task. Instead, finish the whole plan, then run:

```
/sync "feat(elevation): implement ADR-gg RenderPass pipeline + refactor ComposedFaceRenderer onto pass order"
```

(Run `/changelog` first if `/sync` reports an empty CHANGELOG.)

## Risk Notes

- **The most error-prone step is Task 2 Step 1 (capturing the baseline) and Step 4 (verifying parity).** In the ADR-bb session, subagents falsely claimed to have run parity tests that never existed. Any executor — subagent or human — MUST run `pytest` for real and paste the actual captured tuples; do not hand-write expected output from reading the code.
- **Lambda late-binding** on `og` is the one subtle bug risk in the refactor; the plan's reference shape avoids it by putting the loop inside a named function. Do not "simplify" it into a list of per-opening lambdas.
