# ADR-gg: Render Pass Pipeline — Design Spec

**Status:** Approved (user, 2026-07-29)
**Depends on:** ADR-bb (Renderer + RenderStyle Composition — implemented, PR #158)
**Related ADR text:** `docs/designs/ADR-face-elevation-architecture.md` lines 794-863

## Problem

ADR-bb defines *what* draws (`WallRenderer`/`DoorRenderer`/`WindowRenderer` gated by
`RenderStyle`) but not *in what order*. `ComposedFaceRenderer.render_face()` currently
draws wall → openings → dimensions → annotations → label in the correct visual order, but
that order is implicit in the method body (a sequence of calls), not a named, inspectable,
extensible artifact. Real CAD drawings depend on this order for correctness (e.g. a
dimension line must not draw behind a hatch fill), and a future `RenderBackend` (ADR-ff)
will want a natural batching boundary along pass lines.

## Scope Decision: Approach A (explicit pass registry, single-face scope)

Two approaches were considered:

- **A. Explicit pass registry, single-face scope (chosen).** Add an open, `order`-keyed
  `RenderPass` registry. Refactor `ComposedFaceRenderer.render_face()` to build
  `(RenderPass, Callable)` work items in today's order, then execute them sorted by
  `.order`. Preserves current visual output exactly (parity-tested). Low risk, no behavior
  change, sets up the data structure ADR-ff/hh will need later.
- **B. Full cross-face batching pipeline** (draw all walls across all faces/blocks, then
  all openings, etc.) — rejected. Bigger rewrite, higher regression risk, and nothing
  consumes the batching benefit yet since `RenderBackend` (ADR-ff) doesn't exist.
  Violates YAGNI.

**Rationale for building ADR-gg before ADR-cc:** the roadmap dependency graph
(`ADR-face-elevation-architecture.md` lines 116-130) places ADR-gg directly after ADR-bb
and before ADR-cc. ADR-cc's future symbol strategies (`ArcSwingStrategy`, `SlidingStrategy`,
etc.) will be invoked from the SYMBOL pass; defining that pass first means ADR-cc's work
lands on a stable draw-order contract instead of ADR-gg later reshuffling call sites ADR-cc
just built.

## Design

### New module: `src/cad_intelligence/elevation/renderers/render_pass.py`

```python
from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class RenderPass:
    """A named, ordered drawing phase. Lower `order` draws first.

    Gaps of 10 between built-in passes leave room to insert new passes
    (e.g. a future SELECTION pass at order=65) without renumbering existing ones.
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

No registry object is needed beyond the module's own namespace — "registering" a new pass
is simply instantiating a new `RenderPass(name, order)` constant anywhere and sorting
against `.order`; nothing in `render_pass.py` needs to know about it in advance. This
directly satisfies Exit Criterion 2 (new pass addable without editing this module's
source).

### Modified: `src/cad_intelligence/elevation/renderers/composed_renderer.py`

`render_face()` changes from direct sequential calls to building a list of
`tuple[RenderPass, Callable[[], None]]` work items in the same order as today (so the
*content* of each step is unchanged, only how it's invoked), then executing
`for _, fn in sorted(items, key=lambda item: item[0].order): fn()`.

Work item groups and their tags:
- Wall render → `WALL`
- Per-opening door/window render + opening size label → `OPENING` (the "symbol" sub-draws
  like swing lines/mullions currently happen *inside* `DoorRenderer`/`WindowRenderer`, not
  as separate top-level calls — see Non-Goals)
- Dimension render (if `capabilities.show_dimension`) → `DIMENSION`
- Annotation render (if `capabilities.show_annotation`) → `TEXT`
- Face direction label → `TEXT`

`BACKGROUND` and `SYMBOL` have no producer in this refactor (nothing today draws
face-level background, and symbol drawing is nested inside `DoorRenderer`/`WindowRenderer`
rather than being a separate top-level call) — both constants still exist in
`render_pass.py` per the ADR text, unused for now. This is additive, not dead code
requiring cleanup, since the whole point of the open registry is passes existing before
they have callers.

`render_header()` is unchanged — it operates at `RoomBlock` scope, not per-face, and was
already special-cased outside `render_face()` before this ADR; nothing here changes that.

**Scope note vs. ADR wording.** The ADR text (line 819) describes `Renderer.render(scene)`
itself iterating `RENDER_PASS_ORDER`. This spec narrows that to `ComposedFaceRenderer
.render_face()` only — `Renderer`/`BaseFaceRenderer` (in `renderer_base.py`/`base.py`) are
NOT touched. This is the intentional "Approach A, single-face scope" decision from the
Scope Decision section, not an oversight: cross-face iteration is Approach B, explicitly
deferred. `renderer_base.py` is therefore correctly absent from Files Touched.

**Sort-stability dependency (load-bearing, must be preserved).** Two work items share
`TEXT` (order=60): annotation and the face label. Python's `sorted()` is stable, so ties
preserve insertion order — annotation-before-label, matching today's behavior, is
maintained *because* annotation is appended to the work-item list before the face label,
not because of any explicit tie-break. **The implementer must preserve this insertion
order when building the work-item list; do not reorder the `.append()` calls for
same-pass items relative to today's method-call order.** The parity test (below) is what
catches a violation of this invariant, but the invariant itself must also be stated as a
comment at the `sorted(...)` call site in `composed_renderer.py`.

## Non-Goals

- **Splitting `DoorRenderer`/`WindowRenderer` internals into separate WALL/SYMBOL calls.**
  Their swing-line/mullion drawing stays nested inside the door/window render call (tagged
  `OPENING` as a whole). Elevating swing/mullion drawing to its own top-level `SYMBOL`-pass
  call is ADR-cc's concern (Symbol Strategy Pattern), not ADR-gg's — ADR-gg establishes the
  pass *ordering mechanism*, ADR-cc decides which strategies plug into which pass.
- **Cross-face/cross-block batching (Approach B).** Deferred until `RenderBackend` (ADR-ff)
  exists and something actually needs it.
- **`RecordingBackend` pass-order preservation (Exit Criterion 3).** Blocked on ADR-hh,
  which doesn't exist yet. Will be left unchecked in the ADR doc with an explicit note,
  matching the honesty pattern used for ADR-bb's CONSTRUCTION-tier criterion.

## Testing

1. **Parity test**: use the existing `FakeDrawingContext` test double already defined in
   `tests/test_elevation_renderers.py` (around line 39) — it implements the
   `DrawingContext` protocol and records every draw call into `.history: List[Tuple[str,
   str]]` (an ordered list of `(kind, layer)` tuples) plus per-kind detail lists
   (`.lines`, `.texts`, `.mtexts`, `.dimensions`). Capture `.history` from a
   `ComposedFaceRenderer` run against a `FakeDrawingContext` BEFORE the refactor (i.e. run
   it once on the current code, save the tuple as a literal/fixture), then again AFTER the
   refactor, and assert they're identical. Do this for both `SIMPLE` and `DETAILED`
   `RenderStyle` presets. This is the same "capture ordered tuples, compare" technique
   ADR-bb's Task 5 parity tests used against `FakeDrawingContext.history`.
2. **Extensibility test**: register an ad-hoc `RenderPass("selection", 65)` in a test file
   (not in `render_pass.py`), build a small work-item list mixing it with existing passes,
   sort, and assert it lands between `TEXT` (60) and nothing — proving Exit Criterion 2
   without modifying the module.
3. **Unit tests for `RenderPass`**: frozen dataclass equality/hashability, default built-in
   instances have expected `.order` values and are strictly increasing in the sequence
   `BACKGROUND < WALL < OPENING < SYMBOL < DIMENSION < TEXT`.

## Exit Criteria Disposition

| # | Criterion | Disposition |
|---|---|---|
| 1 | `Renderer.render()` output equivalent whether driven by closed enum or open `order`-keyed registration | **Reinterpreted, not literally satisfied.** No closed-enum implementation is built to compare against (Approach A only builds the open form) — the ADR's literal "compare two implementations" framing doesn't apply here. What IS satisfied and verified: the open `order`-keyed path produces output byte-identical to the PRE-refactor hardcoded-call-order implementation (the parity test). This is the practically meaningful equivalence (does the new mechanism preserve today's correct output), and is noted here explicitly as a scope narrowing rather than silently substituted. |
| 2 | New pass addable without editing this module's source | Satisfied — extensibility test. |
| 3 | `RecordingBackend`'s captured command list preserves pass order | Blocked on ADR-hh (not yet implemented). Left unchecked with a note in the ADR doc. |

## Files Touched

- Create: `src/cad_intelligence/elevation/renderers/render_pass.py`
- Create: `tests/test_render_pass.py`
- Modify: `src/cad_intelligence/elevation/renderers/composed_renderer.py`
- Modify: `tests/test_elevation_renderers.py` (parity test, temporary — same pattern as
  ADR-bb: written, run for real, removed after serving its one-time migration-verification
  purpose)
- Modify: `docs/designs/ADR-face-elevation-architecture.md` (ADR-gg status →
  Implemented/Partially Implemented, Exit Criteria checkboxes, compliance dashboard row,
  roadmap addendum)
