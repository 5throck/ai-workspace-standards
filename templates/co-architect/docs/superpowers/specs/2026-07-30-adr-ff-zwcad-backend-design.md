# ADR-ff (Phase 3): RenderBackend Protocol Redesign + ZWCADBackend Promotion — Design Spec

**Status:** Approved (user, 2026-07-30)
**Depends on:** ADR-ff Phase 1/2 (RenderBackend Protocol, RecordingBackend, MatplotlibBackend — implemented, PR #162/#163)
**Related ADR text:** `docs/designs/ADR-face-elevation-architecture.md` lines 1186-1291

## Problem: the Phase 1/2 Protocol doesn't match what Renderer actually calls

Investigation (this session, 2026-07-30) found the `RenderBackend` Protocol built in
Phases 1-2 (`draw_line`/`draw_arc`/`draw_hatch`/`draw_text`/`draw_dimension`) does not
match what `Renderer` (`ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/
`WindowRenderer`/`AnnotationRenderer`/`DimensionRenderer`) actually calls today via
`DrawingContext`:

| Method actually called by Renderer today | Callers | In Phase 1/2 `RenderBackend`? |
|---|---|---|
| `draw_line(start, end, layer, color)` | all renderers | Yes — signature matches |
| `draw_text(text, position, height, layer, rotation, color)` | composed_renderer, annotation | Partial — Phase 1/2's `draw_text` lacks `rotation`, has different param order |
| `draw_aligned_dimension(p1, p2, text_position, text_override, layer, color)` | detailed/dimension.py | No — Phase 1/2 has `draw_dimension(p1, p2, text_position, layer)`, missing `text_override`/`color` |
| `draw_mtext(text, position, width, height, layer, color)` | **nobody** — defined on `DrawingContext`/`COMDrawingContext` but never called by any current Renderer | No |
| `draw_arc` | **nobody** | Yes — but unused by real renderers |
| `draw_hatch` | **nobody** — hatch fill is drawn via `draw_line` calls forming brick-pattern lines (`wall_renderer.py`, `MaterialStrategy.draw()`) | Yes — but unused by real renderers |

Building `ZWCADBackend` against the Phase 1/2 Protocol as-is would either (a) silently drop
`text_override`/`rotation`/`color` fidelity when `Renderer` is migrated onto it, or (b)
require `ZWCADBackend` to implement a Protocol shape that doesn't reflect reality. Neither
is acceptable — this is exactly the kind of gap this project's post-mortem culture (ADR-bb
fabricated tests, ADR-cc/jj documentation-only commit) means we should catch and fix before
building on top of it, not paper over.

## Scope Decision: redesign RenderBackend to match real usage, then migrate Renderer + build ZWCADBackend

Per user direction, this phase:

1. **Redesigns `RenderBackend`** to have the three methods `Renderer` actually needs,
   with the actual signatures `Renderer` actually calls:
   - `draw_line(p1, p2, layer, color=None)` — unchanged from Phase 1/2.
   - `draw_text(text, position, height, layer, rotation=0.0, color=None)` — adds `rotation`
     to match `DrawingContext.draw_text`'s real signature.
   - `draw_dimension(p1, p2, text_position, text_override="", layer=None, color=None)` —
     renamed/reshaped from Phase 1/2's `draw_dimension` to match
     `DrawingContext.draw_aligned_dimension`'s real signature (kept the shorter name
     `draw_dimension` rather than `draw_aligned_dimension`, since "aligned" is a ZWCAD-COM
     implementation detail the Protocol shouldn't leak — `RecordingBackend`/
     `MatplotlibBackend`/`ZWCADBackend` all implement "dimension," not specifically
     "aligned dimension").
   - `draw_arc` and `draw_hatch` are **kept, unchanged**, even though no current `Renderer`
     calls them — they were exercised by Phase 2's shared test suite and
     `MatplotlibBackend`, and removing them would be backward-incompatible with already-
     merged, already-tested code for no benefit. They're simply unused by `Renderer`
     today, which is now stated explicitly in the Protocol's docstring instead of left
     implicit.
   - `draw_mtext` is **NOT added to `RenderBackend`** — it's genuinely dead code on
     `DrawingContext` today (zero callers found via `grep`), so the Protocol should not
     grow a method to match dead code. If a future `Renderer` change starts calling
     multi-line text, `draw_mtext` gets added to `RenderBackend` then, backed by a real
     caller.
2. **Updates `RecordingBackend` and `MatplotlibBackend`** (Phase 1/2, already merged) to
   the new `draw_text`/`draw_dimension` signatures. This is a breaking change to those two
   classes' method signatures — acceptable because nothing outside this repo depends on
   them yet (both shipped within the last day, in this same ADR chain).
3. **Adds `ZWCADBackend`** — wraps the same `ms.AddLine`/`ms.AddText`/`ms.AddDimAligned`
   COM calls `COMDrawingContext` already has (in
   `src/cad_intelligence/cad_io/handlers/zwcad_face_elevation_context.py`), but typed
   against `RenderBackend` instead of `DrawingContext`. Given `COMDrawingContext` already
   implements structurally-compatible methods (same param names/order, once `draw_text`
   gains `rotation` and `draw_aligned_dimension`→`draw_dimension` is aligned), `COMDrawingContext`
   itself satisfies the new `RenderBackend` Protocol via structural typing — **no new COM
   class is needed**; `COMDrawingContext` IS `ZWCADBackend`, once the Protocol names/shapes
   line up. This spec proposes renaming `COMDrawingContext` methods where needed to match,
   NOT writing a parallel `ZWCADBackend` class that wraps `COMDrawingContext` (that would
   be a redundant indirection layer).
4. **Migrates `Renderer`** (`ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/
   `WindowRenderer`/`AnnotationRenderer`/`DimensionRenderer`) from `ctx: DrawingContext` to
   `backend: RenderBackend` as the constructor parameter type and internal attribute name
   (`self._ctx` → `self._backend`, or keep `self._ctx` as the attribute name for a smaller
   diff — **decision: keep `self._ctx` as the internal attribute name**, only change its
   *type annotation* from `DrawingContext` to `RenderBackend`; this is a type-level
   migration, not a rename-every-call-site migration, minimizing diff size and regression
   risk).
5. **Parity-verifies** the migration produces byte-identical `RecordingBackend.commands`
   output before/after, same technique as ADR-bb/gg.

## Non-Goals

- `SVGBackend`, `PDFBackend` — Phases 4-5, not started.
- Removing `DrawingContext` from `zwcad_renderer.py` entirely — `DrawingContext` can stay
  defined (other non-elevation code may still reference the Protocol name conceptually via
  `legacy/backend.py`'s separate `DrawingContext` ABC, which is unrelated and untouched),
  but `Renderer`'s constructors stop being typed against it.
- Removing `draw_mtext` from `DrawingContext`/`COMDrawingContext` — out of scope; it's
  dead from `Renderer`'s perspective but might still be used elsewhere (not verified, and
  removing unrelated dead code is not this phase's job).
- Changing `legacy/backend.py`'s separate `RenderBackend`/`DrawingContext` ABCs — these are
  a distinct, pre-existing legacy system (`ElevationService` etc.) unrelated to ADR-ff's
  `RenderBackend` Protocol; confirmed via `grep` that `legacy/` is only imported from
  `elevation/__init__.py`'s legacy re-exports, not from any ADR-bb/cc/ff code path.

## Design

### 1. Redesigned `RenderBackend` Protocol (`render_backend.py`, modified)

```python
class RenderBackend(Protocol):
    """Backend-neutral drawing primitives. Renderer implementations call only these —
    never win32com or any target-format-specific module directly (ADR-ff).

    draw_line/draw_text/draw_dimension are the three primitives Renderer actually calls
    today. draw_arc/draw_hatch exist on the Protocol (exercised by RecordingBackend/
    MatplotlibBackend's shared test suite, ADR-ff Phase 2) but are NOT currently called by
    any Renderer — hatch fill is drawn via draw_line calls (see MaterialStrategy.draw()),
    and no Renderer draws arcs directly. They remain part of the Protocol for backends
    that may want them, not because Renderer needs them yet.
    """

    capability: BackendCapability

    def draw_line(self, p1: Point3, p2: Point3, layer: str, color: int | None = None) -> None: ...
    def draw_text(
        self, text: str, position: Point3, height: float, layer: str,
        rotation: float = 0.0, color: int | None = None,
    ) -> None: ...
    def draw_dimension(
        self, p1: Point3, p2: Point3, text_position: Point3,
        text_override: str = "", layer: str | None = None, color: int | None = None,
    ) -> None: ...
    def draw_arc(
        self, center: Point3, radius: float, start_angle: float, end_angle: float, layer: str
    ) -> None: ...
    def draw_hatch(self, boundary: list[Point3], pattern: str, layer: str) -> None: ...
```

`Text` and `Dimension` `DrawCommand` dataclasses gain the new fields (`rotation` on
`Text`; `text_override` on `Dimension`) with the same defaults.

### 2. `RecordingBackend`/`MatplotlibBackend` updated to match

`RecordingBackend.draw_text`/`draw_dimension` gain the new parameters, append the updated
`Text`/`Dimension` dataclass instances. `MatplotlibBackend.draw_text` uses `rotation` (via
`self.axes.text(..., rotation=rotation)`); `draw_dimension` uses `text_override` (drawn as
the annotation's label text if non-empty, matching what a real dimension would show).

### 3. `COMDrawingContext` → renamed to also satisfy `RenderBackend`

`COMDrawingContext` (`zwcad_face_elevation_context.py`) needs exactly one change:
`draw_text`'s signature already has `rotation`; `draw_aligned_dimension` needs no rename
(the *Protocol* method is `draw_dimension`, but Python structural typing via `Protocol`
does NOT require the method be *named* `draw_dimension` on the implementer — **correction**:
actually it DOES, `Protocol` matching is by attribute name, not just signature. So
`COMDrawingContext.draw_aligned_dimension` must be renamed to `draw_dimension` (or a thin
alias `draw_dimension = draw_aligned_dimension` added) to satisfy the Protocol.

**Decision: rename `draw_aligned_dimension` → `draw_dimension` on `COMDrawingContext`**,
updating its one caller (`detailed/dimension.py`, which is also being migrated to call the
new name as part of the `Renderer` migration in this same phase — see Non-Goals: this
doesn't touch `legacy/backend.py`'s unrelated `DrawingContext`/`RenderBackend` ABCs which
use different method names entirely and were never `AddDimAligned`-based).

`COMDrawingContext` also needs `capability: BackendCapability` as a class/instance
attribute (defaulting to `BackendCapability()` — ZWCAD/COM supports everything at full
fidelity for the primitives that exist) to structurally satisfy `RenderBackend`.

No new `ZWCADBackend` class file is created — `COMDrawingContext` (already the sole COM
implementation, already draw-only per its own docstring) becomes `RenderBackend`'s ZWCAD
implementation directly, satisfying ADR-ff's "promote `DrawingContext`/
`ZWCADDrawingContextAdapter` to `ZWCADBackend`" language via renaming methods on the
existing class rather than introducing a new wrapper class — this avoids the "duplicated
implementation" anti-pattern ADR-bb's cleanup was about.

### 4. `Renderer` migration

Every `Renderer` subclass constructor changes its `ctx: DrawingContext` parameter's type
annotation to `ctx: RenderBackend` (import from `.render_backend` instead of
`..zwcad_renderer`). The attribute name `self._ctx` is UNCHANGED (see Scope Decision point
4's rationale) — this keeps the diff to import-line and type-annotation changes only,
touching zero method bodies in `composed_renderer.py`/`wall_renderer.py`/
`door_renderer.py`/`window_renderer.py`/`detailed/annotation.py`, **except**
`detailed/dimension.py`, whose three `self._ctx.draw_aligned_dimension(...)` calls must be
renamed to `self._ctx.draw_dimension(...)` to match the renamed Protocol method — this is
the one real call-site change in the whole migration.

Files touched for the migration (type annotations + one import line each, unless noted):
- `composed_renderer.py`
- `wall_renderer.py`
- `door_renderer.py`
- `window_renderer.py`
- `detailed/annotation.py`
- `detailed/dimension.py` (+ 3 method-name call-site changes)

### 5. `ZWCADRendererFactory` / handler wiring

**Correction (post-review, verified against actual source):** the real construction call
site is `src/cad_intelligence/cad_io/handlers/space.py` (around line 4053-4067), NOT
`zwcad_face_elevation_context.py` (which only shows this construction in an architecture
comment in its module docstring — it contains no executable construction code itself).
`space.py` does:

```python
ctx = COMDrawingContext(doc)
for layer_name in {...}:
    ctx.ensure_layer(layer_name)
...
renderer = ZWCADFaceRenderer(ctx, renderer_config)
renderer.render(pipeline_result.scene)
```

Note `ctx.ensure_layer(...)` is also called directly on the `COMDrawingContext` instance
before the layer-name-driven loop — `ensure_layer` is NOT part of `RenderBackend` and
doesn't need to be; `COMDrawingContext` can (and does) have additional methods beyond what
`RenderBackend` requires. `Protocol` structural typing only requires the *listed* methods
to exist with matching names — extra methods on the implementer are fine and irrelevant to
Protocol satisfaction.

Since `COMDrawingContext` now structurally satisfies `RenderBackend` (after the rename in
§3), **no change is needed at this construction call site in `space.py`** — Python's duck
typing means passing a `COMDrawingContext` instance into a `ZWCADFaceRenderer`/
`ComposedFaceRenderer(ctx: RenderBackend, ...)` constructor works with zero code change
there, only the type annotation on the receiving end changed. Verify this by direct code
inspection (already done) — no runtime behavior changes at this wiring point, and
`space.py` itself needs zero edits in this phase.

## Testing

1. **`RenderBackend` Protocol tests** (`tests/test_render_backend.py`, modified): update
   `Text`/`Dimension` construction tests for the new fields; add tests for
   `draw_text(..., rotation=45.0)` and `draw_dimension(..., text_override="1200")`
   round-tripping into the command objects correctly.
2. **`RecordingBackend`/`MatplotlibBackend` tests** (existing files, modified): update
   `backend_shared_suite.py`'s `run_sample_calls` to exercise the new params; re-run the
   Phase 2 cross-backend suite to confirm it still passes with zero backend-specific
   branching.
3. **`COMDrawingContext` structural-typing test** (new): a test that does NOT require a
   live ZWCAD COM session — construct a lightweight test double for `doc`/`ModelSpace` (or
   verify via `typing.get_type_hints`/`isinstance(obj, RenderBackend)` at a Protocol level
   — Python `Protocol`s support `isinstance` checks if `@runtime_checkable`; add that
   decorator to `RenderBackend` if not already present) confirming `COMDrawingContext`
   satisfies `RenderBackend`'s shape without needing to actually call ZWCAD.
4. **`Renderer` migration parity test** (temporary, same pattern as ADR-bb Task 5 / ADR-gg
   Task 2): capture `ComposedFaceRenderer`'s draw-call sequence via `RecordingBackend`
   BEFORE the `ctx: DrawingContext` → `ctx: RenderBackend` type-annotation migration
   (since `FakeDrawingContext` already structurally satisfies the new Protocol too — the
   parity check is about behavior, not the type annotation itself, which has zero runtime
   effect in Python). Since this migration changes ZERO method bodies (only type
   annotations + the `dimension.py` method-name rename), the "before" and "after" behavior
   should be trivially identical for every caller except `detailed/dimension.py` — that
   file's rename is the one place an actual behavior-preserving verification matters: a
   test confirming `DimensionRenderer.render()`'s output is unchanged after
   `draw_aligned_dimension`→`draw_dimension` rename (same call, same arguments, just
   renamed).
5. **Full regression**: run the entire elevation suite plus all new/modified backend
   tests.

## Exit Criteria Disposition (ADR-ff)

| # | Criterion | Disposition |
|---|---|---|
| 1 | `RecordingBackend`/`MatplotlibBackend` pass same suite, no backend-specific branches | Already satisfied (Phase 2); re-verified after the Protocol reshape in this phase (shared suite updated for new signatures, still zero branching). |
| 2 | `ZWCADBackend` renders pixel-equivalently to live ZWCAD via `RecordingBackend`→`MatplotlibBackend` replay | **Still not satisfiable in this phase** — this requires an actual pixel comparison against a live ZWCAD render, which needs a running ZWCAD COM session (not available in this environment/CI). This phase makes `COMDrawingContext` structurally satisfy `RenderBackend` and verified via type-level tests, but does NOT run it against live ZWCAD and compare pixels. Left unchecked, honestly. |
| 3 | `Renderer`'s source contains zero `import win32com` | **Satisfiable and will be verified.** `Renderer` classes already don't import `win32com` directly (they call `self._ctx.draw_*`); this phase's migration doesn't change that. A `grep -rn "import win32com" src/cad_intelligence/elevation/renderers/` check confirming zero matches is the verification — this criterion may already have been true even before this phase, in which case this phase's contribution is *confirming and codifying* it, not creating it from scratch. State this honestly in the doc update, don't claim this phase "achieved" something that may have already been the case. |
| 4 | `BackendCapability`-gated degrade path exercised by a test | **Still not attempted** — no `Renderer` code reads `.capability` anywhere yet; this phase doesn't add that logic (it's about wiring the Protocol correctly, not adding capability-aware degradation behavior to `WallRenderer`/etc., which would be a separate, larger change). Left unchecked. |

**Honest framing:** Criterion 3 needs careful wording — grep BEFORE this phase's changes
to establish the baseline, so the doc update doesn't claim this phase caused something that
may have already been true.

## Files Touched

- Modify: `src/cad_intelligence/elevation/renderers/render_backend.py` (Protocol reshape,
  `Text`/`Dimension` new fields, `@runtime_checkable` if not present)
- Modify: `src/cad_intelligence/elevation/renderers/matplotlib_backend.py` (match new
  signatures)
- Modify: `tests/backend_shared_suite.py`, `tests/test_render_backend.py`,
  `tests/test_matplotlib_backend.py`, `tests/test_backend_shared_suite.py`,
  `tests/test_backend_replay.py` (updated for new signatures)
- Modify: `src/cad_intelligence/cad_io/handlers/zwcad_face_elevation_context.py`
  (`COMDrawingContext.draw_aligned_dimension` → `draw_dimension`, add `capability`
  attribute)
- Create: `tests/test_com_drawing_context_satisfies_render_backend.py` (structural-typing
  test, no live ZWCAD needed)
- Modify: `src/cad_intelligence/elevation/renderers/composed_renderer.py`,
  `wall_renderer.py`, `door_renderer.py`, `window_renderer.py`, `detailed/annotation.py`
  (type-annotation only)
- Modify: `src/cad_intelligence/elevation/renderers/detailed/dimension.py` (type
  annotation + 3 method-name call-site renames)
- Modify: `docs/designs/ADR-face-elevation-architecture.md`, `CHANGELOG.md`
