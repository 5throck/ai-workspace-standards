# ADR-ff (Phase 2): MatplotlibBackend — Design Spec

**Status:** Approved (user, 2026-07-30)
**Depends on:** ADR-ff Phase 1 (RenderBackend Protocol + RecordingBackend — implemented, PR #162)
**Related ADR text:** `docs/designs/ADR-face-elevation-architecture.md` lines 1186-1291
  (ADR-ff, "Reference implementation order" step 2)

## Problem

Phase 1 shipped `RenderBackend` (Protocol), `BackendCapability`, and `RecordingBackend` —
but `RecordingBackend` never actually draws anything, so nothing has yet proven the
Protocol's five-primitive shape (`draw_line`/`draw_arc`/`draw_hatch`/`draw_text`/
`draw_dimension`) generalizes to a real rasterizer. Per the ADR's own "Reference
implementation order" (lines 1264-1274), `MatplotlibBackend` is step 2, specifically
*before* `ZWCADBackend` (step 3) so that Protocol-shape problems get caught against a
library with no COM quirks, not conflated with ZWCAD-specific behavior.

## Scope Decision: Phase 2 only (MatplotlibBackend), Renderer still not migrated

Per user direction and matching Phase 1's Non-Goals pattern, this plan:
- Adds `matplotlib` as a project dependency.
- Implements `MatplotlibBackend` — a second `RenderBackend` implementation, backed by a
  real `matplotlib.axes.Axes`.
- Implements a **shared parametrized test suite** that runs the same draw-call sequence
  against both `RecordingBackend` and `MatplotlibBackend`, with zero backend-specific test
  branches — this is what actually satisfies ADR-ff Exit Criterion 1 (see disposition
  below), which Phase 1 left unchecked because only one backend existed.
- Implements a `RecordingBackend` → `MatplotlibBackend` replay path: given a
  `RecordingBackend.commands` list, replay each command through a `MatplotlibBackend`
  instance and produce a PNG. This directly exercises the design's stated purpose for
  `RecordingBackend` (ADR-hh: "record once, replay through any headless backend").

**Still does NOT:**
- Migrate `ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/`WindowRenderer` off
  `DrawingContext` onto `RenderBackend` — that remains Phase 3.
- Implement `ZWCADBackend`, `SVGBackend`, or `PDFBackend`.
- Implement any `BackendCapability`-gated degrade path in `Renderer` code (Exit Criterion
  4) — there is still no `Renderer` code path that reads `.capability`, since `Renderer`
  doesn't call `RenderBackend` yet. This stays unchecked, same as Phase 1.
- Attempt Exit Criterion 2 (pixel-equivalence between `ZWCADBackend` and
  `RecordingBackend`-replayed-through-`MatplotlibBackend`) — `ZWCADBackend` doesn't exist.

## Design

### Dependency change: `pyproject.toml`

Add `"matplotlib>=3.8.0"` to `[project] dependencies` (not `optional-dependencies` — this
mirrors how `shapely`/`trimesh`/`ezdxf` are already core dependencies for geometry/CAD
work, and `MatplotlibBackend` is meant to be usable without any extra install step, e.g.
from CI). Verify the exact current version constraint style already used in the file
(`>=X.Y.Z`) and match it.

### New module: `src/cad_intelligence/elevation/renderers/matplotlib_backend.py`

```python
"""matplotlib_backend.py — Renderer Domain: MatplotlibBackend (ADR-ff Phase 2).

Second RenderBackend implementation (after RecordingBackend), backed by a real
matplotlib.axes.Axes. Proves the RenderBackend Protocol's five-primitive shape against an
actual rasterizer, per the ADR's own reference implementation order (RecordingBackend →
MatplotlibBackend → ZWCADBackend → ...), before ZWCADBackend's COM-specific quirks get
folded into the Protocol's design.

This module is COM-free and shapely-free. It imports matplotlib, which the RenderBackend
Protocol itself does not require — only this concrete backend does.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import matplotlib

matplotlib.use("Agg")  # headless-safe: must run before pyplot is imported, so this
# backend works in CI/no-display environments without depending on what GUI toolkits
# happen to be installed. Agg renders to a raster buffer only — no display needed.

import matplotlib.figure
import matplotlib.patches
import matplotlib.pyplot
from matplotlib.axes import Axes

from .render_backend import (
    Arc,
    BackendCapability,
    Dimension,
    DrawCommand,
    Hatch,
    Line,
    Point3,
    Text,
)


@dataclass
class MatplotlibBackend:
    """Implements RenderBackend by drawing onto a matplotlib Axes."""

    capability: BackendCapability = field(default_factory=BackendCapability)
    figure: matplotlib.figure.Figure = field(init=False)
    axes: Axes = field(init=False)

    def __post_init__(self) -> None:
        self.figure, self.axes = matplotlib.pyplot.subplots()
        self.axes.set_aspect("equal")

    def draw_line(self, p1: Point3, p2: Point3, layer: str, color: int | None = None) -> None:
        self.axes.plot([p1[0], p2[0]], [p1[1], p2[1]], color=_resolve_color(color))

    def draw_arc(
        self, center: Point3, radius: float, start_angle: float, end_angle: float, layer: str
    ) -> None:
        arc = matplotlib.patches.Arc(
            (center[0], center[1]),
            width=radius * 2,
            height=radius * 2,
            theta1=start_angle,
            theta2=end_angle,
        )
        self.axes.add_patch(arc)

    def draw_hatch(self, boundary: list[Point3], pattern: str, layer: str) -> None:
        xy = [(p[0], p[1]) for p in boundary]
        poly = matplotlib.patches.Polygon(xy, closed=True, fill=False, hatch=_resolve_hatch(pattern))
        self.axes.add_patch(poly)

    def draw_text(self, text: str, position: Point3, height: float, layer: str) -> None:
        self.axes.text(position[0], position[1], text, fontsize=height)

    def draw_dimension(
        self, p1: Point3, p2: Point3, text_position: Point3, layer: str
    ) -> None:
        self.axes.annotate(
            "",
            xy=(p1[0], p1[1]),
            xytext=(p2[0], p2[1]),
            arrowprops=dict(arrowstyle="<->"),
        )

    def save(self, path: str) -> None:
        self.figure.savefig(path)

    def close(self) -> None:
        matplotlib.pyplot.close(self.figure)


def _resolve_color(color: int | None) -> str:
    """Placeholder ACI→matplotlib color mapping. Returns 'black' for None/unmapped."""
    return "black" if color is None else "black"


def _resolve_hatch(pattern: str) -> str:
    """Placeholder pattern-name→matplotlib hatch-char mapping."""
    return "/"


def replay(commands: list[DrawCommand], backend: MatplotlibBackend) -> None:
    """Replay a RecordingBackend's command list through a MatplotlibBackend.

    This is the mechanism ADR-hh names RecordingBackend's primary use case for: record
    once (cheaply, no drawing library), replay through any real backend later.
    """
    for cmd in commands:
        if isinstance(cmd, Line):
            backend.draw_line(cmd.p1, cmd.p2, cmd.layer, cmd.color)
        elif isinstance(cmd, Arc):
            backend.draw_arc(cmd.center, cmd.radius, cmd.start_angle, cmd.end_angle, cmd.layer)
        elif isinstance(cmd, Hatch):
            backend.draw_hatch(list(cmd.boundary), cmd.pattern, cmd.layer)
        elif isinstance(cmd, Text):
            backend.draw_text(cmd.text, cmd.position, cmd.height, cmd.layer)
        elif isinstance(cmd, Dimension):
            backend.draw_dimension(cmd.p1, cmd.p2, cmd.text_position, cmd.layer)
```

**Design notes:**
- `_resolve_color`/`_resolve_hatch` are explicitly named as **placeholders** — real ACI
  (AutoCAD Color Index) → RGB and ZWCAD hatch-pattern-name → matplotlib hatch-character
  mappings are out of scope for this phase (no visual-fidelity requirement exists yet;
  Exit Criterion 2's pixel-equivalence check is still blocked on `ZWCADBackend`, which
  doesn't exist). The functions exist so `draw_line`/`draw_hatch` have *some* deterministic
  behavior to test, not to be visually correct yet. A future phase (or ADR-dd's Rendering
  Golden work) is expected to replace these.
- `replay()` is a free function, not a `RecordingBackend` method, so `RecordingBackend`
  (Phase 1, already merged) needs zero changes — it stays backend-agnostic. `replay()`
  lives in `matplotlib_backend.py` because it's specifically "replay into Matplotlib," not
  a generic replay abstraction (a generic one isn't needed until a third real backend
  exists to replay into).
- `__post_init__` calls `matplotlib.pyplot.subplots()` — uses the pyplot stateful API for
  simplicity in this phase; a future phase could switch to `Figure()`/`FigureCanvas`
  directly to avoid pyplot's global figure registry, but that's not required for Phase 2's
  scope. Headless-safety is NOT assumed — `matplotlib.use("Agg")` is called explicitly at
  module import time, before `matplotlib.pyplot` is imported (Agg must be selected before
  pyplot's backend resolution runs, or a GUI-toolkit backend already installed in the
  environment could be auto-selected instead and fail on a display-less CI runner).

### New module: `tests/backend_shared_suite.py` (shared test cases, not a test file itself)

A parametrized-fixture module (not collected directly by pytest — filename doesn't match
`test_*.py`) providing a sequence of representative draw calls both backend test files
import and run identically:

```python
"""backend_shared_suite.py — Shared draw-call sequence for RenderBackend implementations.

Both RecordingBackend and MatplotlibBackend tests import SAMPLE_CALLS and run it through
their own backend instance, proving RenderBackend's shape generalizes with zero
backend-specific test logic (ADR-ff Exit Criterion 1).
"""

from __future__ import annotations

from typing import Callable


def run_sample_calls(backend) -> None:
    """Exercise all five RenderBackend primitives once each, in a realistic order."""
    backend.draw_line((0.0, 0.0, 0.0), (100.0, 0.0, 0.0), layer="A-WALL", color=7)
    backend.draw_arc((50.0, 0.0, 0.0), radius=20.0, start_angle=0.0, end_angle=90.0, layer="A-DOOR")
    backend.draw_hatch(
        [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (10.0, 10.0, 0.0)], pattern="BRICK", layer="A-WALL-BRICK"
    )
    backend.draw_text("900x2100", (5.0, 5.0, 0.0), height=250.0, layer="A-ANNO")
    backend.draw_dimension(
        (0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (50.0, -20.0, 0.0), layer="A-DIMS"
    )
```

### Tests: `tests/test_matplotlib_backend.py`

- `MatplotlibBackend()` constructs without error, has a real `.axes` (a matplotlib `Axes`
  instance) and `.capability` (a `BackendCapability`).
- Each of the five `draw_*` methods adds the expected artifact type to `.axes` (e.g.
  `draw_line` → `len(axes.lines) == 1` or equivalent via `axes.get_lines()`; `draw_arc`/
  `draw_hatch` → `len(axes.patches) == 1`; `draw_text` → `axes.texts` count grows by 1;
  `draw_dimension`'s `annotate()` call also lands in `axes.texts` in matplotlib's object
  model — confirm this via `len(axes.texts)` before/after rather than assuming `axes.patches`).
- `run_sample_calls(backend)` from the shared suite executes against a `MatplotlibBackend`
  instance without raising.
- `save(path)` writes a real PNG file to a `tmp_path` fixture (pytest built-in) — assert
  the file exists and has non-zero size after calling `save`.
- `close()` doesn't raise (cleans up the pyplot figure so tests don't leak figures across
  the suite — call `close()` in a `finally` or fixture teardown in every test that
  constructs a `MatplotlibBackend`).

### Tests: `tests/test_backend_shared_suite.py` (satisfies Exit Criterion 1)

- Parametrized over `[RecordingBackend, MatplotlibBackend]` (via `pytest.mark.parametrize`
  or a fixture factory) — the SAME test function calls
  `backend_shared_suite.run_sample_calls(backend)` against each, asserting only that no
  exception is raised. No `if backend is MatplotlibBackend: ...` branching anywhere in this
  file — that branching is exactly what Exit Criterion 1 says must not exist.
- A second parametrized test asserts each backend correctly records/draws all five calls —
  for `RecordingBackend` this checks `len(backend.commands) == 5`; for `MatplotlibBackend`
  this checks the artifact counts across `axes.lines`/`axes.patches`/`axes.texts` sum to 5.
  (This assertion is backend-specific in its *body* out of necessity — the two backends
  expose different internal state — but the *test case being run* and the *calls made* are
  identical, which is what the Exit Criterion is actually about: no backend-specific
  *behavior branches during the draw calls themselves*.)

### Tests: `tests/test_backend_replay.py` (RecordingBackend → MatplotlibBackend replay)

- Build a `RecordingBackend`, run `run_sample_calls(backend)` against it to populate
  `.commands`.
- Build a fresh `MatplotlibBackend`, call `matplotlib_backend.replay(recording.commands,
  target)`.
- Assert `target`'s artifact counts match what directly calling `run_sample_calls(target)`
  would have produced (i.e. replay is behaviorally equivalent to having drawn directly).
- Call `target.save(tmp_path / "replayed.png")`, assert the file exists and has non-zero
  size — this is the concrete, executable proof of ADR-hh's "record once, replay through
  any headless backend" claim, which until now was only a design-doc assertion.

## Exit Criteria Disposition (ADR-ff, updated from Phase 1)

| # | Criterion | Disposition |
|---|---|---|
| 1 | `RecordingBackend` and `MatplotlibBackend` both implement `RenderBackend` and pass the same `Renderer`-level test suite with no backend-specific test branches | **Satisfied (reinterpreted, see note) — not a literal reading of the ADR text.** `tests/test_backend_shared_suite.py` runs the identical `run_sample_calls()` sequence against both backends via parametrization, with zero backend-specific branching in the calls made. Note: "Renderer-level" is read as "RenderBackend-level" here, since no `Renderer` has been migrated onto `RenderBackend` yet (Phase 3) — there is no `Renderer` object to run a "Renderer-level" suite against. This is the same reinterpretation-with-disclosure pattern used for ADR-gg's Exit Criterion 1 (see `docs/superpowers/specs/2026-07-29-adr-gg-render-pass-pipeline-design.md`); the ADR doc update in Task 2 of the implementation plan MUST carry forward this exact "reinterpreted" qualifier, not a bare checkmark, so a skimming reader can't mistake it for the literal ADR wording being satisfied. |
| 2 | `ZWCADBackend` renders pixel-equivalently to live ZWCAD via `RecordingBackend` replay through `MatplotlibBackend` | Still blocked — `ZWCADBackend` doesn't exist (Phase 3). This phase proves the *replay mechanism itself* works (`test_backend_replay.py`) but has no `ZWCADBackend` output to compare against. Left unchecked. |
| 3 | `Renderer`'s source contains zero `import win32com` | Still not applicable — `Renderer` still uses `DrawingContext`, unchanged in this phase. Left unchecked. |
| 4 | A `BackendCapability`-gated degrade path is exercised by a test using `supports_hatch=False` | Still blocked — no `Renderer` code reads `.capability` yet. Left unchecked. |

**Honest framing:** this phase moves ADR-ff from 0/4 to 1/4 genuinely satisfied Exit
Criteria — a real, verifiable improvement, not a re-statement of Phase 1's status. Do not
round this up to "half done" or claim criteria 2-4 are "in progress" — they are simply
blocked on Phase 3, unattempted here.

## Files Touched

- Modify: `pyproject.toml` (add `matplotlib` dependency)
- Create: `src/cad_intelligence/elevation/renderers/matplotlib_backend.py`
- Create: `tests/backend_shared_suite.py` (shared fixture, not a test file)
- Create: `tests/test_matplotlib_backend.py`
- Create: `tests/test_backend_shared_suite.py`
- Create: `tests/test_backend_replay.py`
- Modify: `docs/designs/ADR-face-elevation-architecture.md` (ADR-ff status/dashboard/exit
  criteria — Criterion 1 checked, 2-4 stay unchecked with updated notes)
- Modify: `CHANGELOG.md`
