# ADR-ff (Phase 1): RenderBackend Protocol + RecordingBackend — Design Spec

**Status:** Approved (user, 2026-07-30)
**Depends on:** ADR-bb/gg/cc/jj (all implemented)
**Related ADR text:** `docs/designs/ADR-face-elevation-architecture.md` lines 1186-1334
  (ADR-ff: Renderer Output Backend Abstraction, ADR-hh: Recording Backend)

## Problem

Today's `Renderer` implementations (`ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/
`WindowRenderer`) call `DrawingContext` (`src/cad_intelligence/elevation/zwcad_renderer.py`),
a Protocol whose only real implementation talks to ZWCAD via `win32com`. ADR-ff's full goal
is generalizing this into a `RenderBackend` Protocol with pluggable backends (ZWCAD,
Matplotlib, SVG, PDF), built in a specific reference order (RecordingBackend →
MatplotlibBackend → ZWCADBackend → SVGBackend → PDFBackend) so the Protocol's shape gets
validated against something other than ZWCAD's COM quirks before ZWCAD is promoted to it.

## Scope Decision: Phase 1 only (RecordingBackend)

Per user direction, this plan implements **only step 1 of the ADR's 5-step reference
order**: the `RenderBackend` Protocol, `BackendCapability`, and `RecordingBackend`. It does
**NOT**:
- Migrate `ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/`WindowRenderer` off
  `DrawingContext` onto `RenderBackend` — that's step 3 (`ZWCADBackend` promotion) in the
  ADR's own order, and doing it before `MatplotlibBackend` (step 2) exists would validate
  the Protocol shape against ZWCAD's COM quirks first, exactly what the ADR's own
  "Reference implementation order" section says to avoid.
- Build `MatplotlibBackend`, `SVGBackend`, or `PDFBackend`.
- Implement any part of ADR-hh's replay/undo/benchmark consumers of `RecordingBackend` —
  ADR-hh remains a separate, still-`Proposed` ADR; this plan only makes `RecordingBackend`
  exist and be independently testable as a `RenderBackend` implementation.

This means `RecordingBackend` is built and tested standalone (constructed and called
directly in tests), not wired into the real rendering pipeline yet.

## Design

### New module: `src/cad_intelligence/elevation/renderers/render_backend.py`

```python
"""render_backend.py — Renderer Domain: RenderBackend Protocol + RecordingBackend (ADR-ff).

Defines the backend-neutral drawing primitive Protocol Renderer implementations will
eventually call instead of DrawingContext (ADR-ff), plus RecordingBackend, the first
reference implementation (ADR-ff Phase 1) — records draw calls as DrawCommands instead of
drawing them, per ADR-hh.

This module is COM-free and shapely-free.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


Point3 = tuple[float, float, float]


@dataclass(frozen=True)
class BackendCapability:
    """Declares which drawing primitives a RenderBackend can honor at full fidelity."""

    supports_hatch: bool = True
    supports_alpha: bool = True
    supports_arc: bool = True
    supports_pattern: bool = True


class RenderBackend(Protocol):
    """Backend-neutral drawing primitives. Renderer implementations call only these —
    never win32com or any target-format-specific module directly (ADR-ff)."""

    capability: BackendCapability

    def draw_line(self, p1: Point3, p2: Point3, layer: str, color: int | None = None) -> None: ...
    def draw_arc(
        self, center: Point3, radius: float, start_angle: float, end_angle: float, layer: str
    ) -> None: ...
    def draw_hatch(self, boundary: list[Point3], pattern: str, layer: str) -> None: ...
    def draw_text(self, text: str, position: Point3, height: float, layer: str) -> None: ...
    def draw_dimension(
        self, p1: Point3, p2: Point3, text_position: Point3, layer: str
    ) -> None: ...


@dataclass(frozen=True)
class Line:
    p1: Point3
    p2: Point3
    layer: str
    color: int | None = None


@dataclass(frozen=True)
class Arc:
    center: Point3
    radius: float
    start_angle: float
    end_angle: float
    layer: str


@dataclass(frozen=True)
class Hatch:
    boundary: tuple[Point3, ...]
    pattern: str
    layer: str


@dataclass(frozen=True)
class Text:
    text: str
    position: Point3
    height: float
    layer: str


@dataclass(frozen=True)
class Dimension:
    p1: Point3
    p2: Point3
    text_position: Point3
    layer: str


DrawCommand = Line | Arc | Hatch | Text | Dimension


@dataclass
class RecordingBackend:
    """Implements RenderBackend by recording calls instead of drawing them (ADR-hh)."""

    capability: BackendCapability = field(default_factory=BackendCapability)
    commands: list[DrawCommand] = field(default_factory=list)

    def draw_line(self, p1: Point3, p2: Point3, layer: str, color: int | None = None) -> None:
        self.commands.append(Line(p1, p2, layer, color))

    def draw_arc(
        self, center: Point3, radius: float, start_angle: float, end_angle: float, layer: str
    ) -> None:
        self.commands.append(Arc(center, radius, start_angle, end_angle, layer))

    def draw_hatch(self, boundary: list[Point3], pattern: str, layer: str) -> None:
        self.commands.append(Hatch(tuple(boundary), pattern, layer))

    def draw_text(self, text: str, position: Point3, height: float, layer: str) -> None:
        self.commands.append(Text(text, position, height, layer))

    def draw_dimension(
        self, p1: Point3, p2: Point3, text_position: Point3, layer: str
    ) -> None:
        self.commands.append(Dimension(p1, p2, text_position, layer))
```

**Design notes:**
- `boundary: list[Point3]` is converted to a `tuple` in the `Hatch` command so the command
  itself stays hashable/frozen like its siblings (`RenderBackend.draw_hatch`'s Protocol
  signature keeps `list` since Protocols describe the caller-facing signature, not storage).
- `DrawCommand` is a plain union type alias, not a base class — matches the ADR's own
  sketch (`commands: list[DrawCommand]`) and keeps each command a minimal frozen dataclass
  with no shared mutable state.
- `RecordingBackend` itself is *not* frozen (its `commands` list mutates on every draw
  call) — this mirrors `FakeDrawingContext` in `tests/test_elevation_renderers.py`, the
  existing test-double convention in this codebase.

### Files Touched

- Create: `src/cad_intelligence/elevation/renderers/render_backend.py`
- Create: `tests/test_render_backend.py`
- Modify: `docs/designs/ADR-face-elevation-architecture.md` (ADR-ff status/exit-criteria —
  see disposition below; ADR-hh is NOT touched, remains fully `Proposed`)
- Modify: `CHANGELOG.md`

## Testing

1. **`BackendCapability` defaults** — all four fields default `True`.
2. **`RecordingBackend` implements `RenderBackend`** — structural check: calling each of
   the five `draw_*` methods with representative arguments appends the correctly-typed
   `DrawCommand` to `.commands`, in call order.
3. **Multiple calls accumulate in order** — call `draw_line` then `draw_text` then
   `draw_line` again; assert `.commands == [Line(...), Text(...), Line(...)]` (order
   matters for future replay use cases, even though replay itself is out of scope here).
4. **`capability` is a real `BackendCapability` instance** by default (not `None`), so
   downstream code can always read `.capability.supports_hatch` etc. without a null check.
5. **No regression**: run the full existing elevation suite
   (`tests/test_elevation_renderers.py`, `tests/test_render_pass.py`,
   `tests/test_render_style.py`, `tests/test_elevation_symbols.py`,
   `tests/test_normalized_snapshot_parity.py`) to confirm this purely-additive module
   introduces no import cycles or breakage — none of these files should need edits.

## Exit Criteria Disposition (ADR-ff)

| # | Criterion | Disposition |
|---|---|---|
| 1 | `RecordingBackend` and `MatplotlibBackend` both implement `RenderBackend` and pass the same `Renderer`-level test suite with no backend-specific branches | **Partially satisfied.** Only `RecordingBackend` exists; `MatplotlibBackend` is out of scope for this phase. `RecordingBackend`'s own unit tests pass; there is no shared "Renderer-level test suite" run against two backends yet since no `Renderer` has been migrated onto `RenderBackend` at all (see Non-Goals). Left unchecked. |
| 2 | `ZWCADBackend` renders pixel-equivalently to live ZWCAD via `RecordingBackend` replay through `MatplotlibBackend` | Not attempted — depends on steps 2 and 3, both out of scope. Left unchecked. |
| 3 | `Renderer`'s source contains zero `import win32com` | **Not applicable yet in the intended sense** — `Renderer` still uses `DrawingContext`, not `RenderBackend`, so this criterion's premise (Renderer migrated onto the new Protocol) doesn't hold. Left unchecked; will only become meaningful after step 3. |
| 4 | A `BackendCapability`-gated degrade path is exercised by a test using `supports_hatch=False` | Not attempted — no `Renderer` code path reads `capability` yet, since no `Renderer` calls `RenderBackend`. Left unchecked. |

**Honest framing:** this phase delivers the *Protocol and its first reference
implementation*, which is real, standalone-tested progress and unblocks step 2
(`MatplotlibBackend`) — but none of ADR-ff's own Exit Criteria are fully satisfied yet,
since all four require either a second backend or `Renderer` migration, both later phases.
The ADR doc update must say "Partially Implemented" or equivalent, not "Implemented" —
this is the exact category of premature-completion claim this project was burned by twice
already (ADR-bb's fabricated parity tests, ADR-cc/jj's documentation-only commit).
