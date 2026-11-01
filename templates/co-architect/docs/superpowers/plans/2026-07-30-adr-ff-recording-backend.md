# ADR-ff (Phase 1): RenderBackend Protocol + RecordingBackend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the `RenderBackend` Protocol, `BackendCapability`, and `RecordingBackend` (ADR-ff Phase 1 / ADR-hh's core artifact) as a standalone, independently-tested module — no `Renderer` migration in this phase.

**Architecture:** New `render_backend.py` module. `RenderBackend` is a `Protocol` with five backend-neutral drawing primitives (`draw_line`/`draw_arc`/`draw_hatch`/`draw_text`/`draw_dimension`) plus a `capability: BackendCapability` attribute. `RecordingBackend` implements it by appending a `DrawCommand` (a union of five frozen dataclasses: `Line`/`Arc`/`Hatch`/`Text`/`Dimension`) to a `commands` list instead of drawing anything.

**Tech Stack:** Python 3.11+, `dataclasses`, `typing.Protocol`, `pytest`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-30-adr-ff-recording-backend-design.md` (reviewed and approved — see spec for full Exit Criteria disposition and Non-Goals).

---

## Reference Conventions (read once, apply throughout)

- Module docstring header format — see `src/cad_intelligence/elevation/renderers/render_pass.py:1-13` for the exact pattern: `"""<file>.py — Renderer Domain: <summary>.\n\n<body>\n\nThis module is COM-free and shapely-free."""`. Apply it to `render_backend.py`.
- `RecordingBackend` deliberately mirrors `FakeDrawingContext` (`tests/test_elevation_renderers.py:39-63`) — a plain (non-frozen) class accumulating draw calls into a list. Do NOT make `RecordingBackend` frozen.
- Run tests from project root: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_render_backend.py -v`.
- **TDD is mandatory**: write the failing test first, confirm it fails for the right reason, then implement.
- **Do not overclaim completion.** This project has twice landed premature "Implemented" claims (ADR-bb's fabricated parity tests; ADR-cc/jj's documentation-only commit that claimed source changes that didn't exist). Every doc update in Task 2 must say "Partially Implemented" and leave all four ADR-ff Exit Criteria unchecked, each with the specific reason from the spec's Exit Criteria Disposition table. Do not check a box unless the thing it describes is literally true of the code in this PR.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/cad_intelligence/elevation/renderers/render_backend.py` | Create | `RenderBackend` Protocol, `BackendCapability`, `DrawCommand` variants, `RecordingBackend` |
| `tests/test_render_backend.py` | Create | Unit tests for all of the above |
| `docs/designs/ADR-face-elevation-architecture.md` | Modify | ADR-ff status → "Partially Implemented", exit criteria left unchecked with reasons, dashboard row updated |
| `CHANGELOG.md` | Modify | Entry describing exactly what shipped (Protocol + RecordingBackend only) |

---

### Task 1: RenderBackend Protocol + BackendCapability + RecordingBackend

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/render_backend.py`
- Test: `tests/test_render_backend.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_render_backend.py`:

```python
"""Unit tests for RenderBackend / BackendCapability / RecordingBackend (ADR-ff Phase 1)."""

import pytest

from cad_intelligence.elevation.renderers.render_backend import (
    Arc,
    BackendCapability,
    Dimension,
    Hatch,
    Line,
    RecordingBackend,
    Text,
)


def test_backend_capability_defaults_all_true():
    cap = BackendCapability()
    assert cap.supports_hatch is True
    assert cap.supports_alpha is True
    assert cap.supports_arc is True
    assert cap.supports_pattern is True


def test_recording_backend_has_default_capability_instance():
    backend = RecordingBackend()
    assert isinstance(backend.capability, BackendCapability)
    assert backend.capability.supports_hatch is True


def test_recording_backend_starts_with_empty_commands():
    backend = RecordingBackend()
    assert backend.commands == []


def test_draw_line_appends_line_command():
    backend = RecordingBackend()
    backend.draw_line((0.0, 0.0, 0.0), (100.0, 0.0, 0.0), layer="A-WALL", color=7)
    assert backend.commands == [
        Line((0.0, 0.0, 0.0), (100.0, 0.0, 0.0), "A-WALL", 7)
    ]


def test_draw_line_color_defaults_to_none():
    backend = RecordingBackend()
    backend.draw_line((0.0, 0.0, 0.0), (1.0, 1.0, 0.0), layer="A-ELEV")
    assert backend.commands[0].color is None


def test_draw_arc_appends_arc_command():
    backend = RecordingBackend()
    backend.draw_arc((0.0, 0.0, 0.0), radius=50.0, start_angle=0.0, end_angle=90.0, layer="A-DOOR")
    assert backend.commands == [Arc((0.0, 0.0, 0.0), 50.0, 0.0, 90.0, "A-DOOR")]


def test_draw_hatch_appends_hatch_command_with_tuple_boundary():
    backend = RecordingBackend()
    boundary = [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (10.0, 10.0, 0.0)]
    backend.draw_hatch(boundary, pattern="BRICK", layer="A-WALL-BRICK")
    assert backend.commands == [
        Hatch(tuple(boundary), "BRICK", "A-WALL-BRICK")
    ]
    assert isinstance(backend.commands[0].boundary, tuple)


def test_draw_text_appends_text_command():
    backend = RecordingBackend()
    backend.draw_text("900x2100", (5.0, 5.0, 0.0), height=250.0, layer="A-ANNO")
    assert backend.commands == [Text("900x2100", (5.0, 5.0, 0.0), 250.0, "A-ANNO")]


def test_draw_dimension_appends_dimension_command():
    backend = RecordingBackend()
    backend.draw_dimension(
        (0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (50.0, -20.0, 0.0), layer="A-DIMS"
    )
    assert backend.commands == [
        Dimension((0.0, 0.0, 0.0), (100.0, 0.0, 0.0), (50.0, -20.0, 0.0), "A-DIMS")
    ]


def test_multiple_calls_accumulate_in_order():
    backend = RecordingBackend()
    backend.draw_line((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), layer="L1")
    backend.draw_text("hi", (0.0, 0.0, 0.0), height=10.0, layer="L2")
    backend.draw_line((1.0, 0.0, 0.0), (2.0, 0.0, 0.0), layer="L1")
    assert [type(c).__name__ for c in backend.commands] == ["Line", "Text", "Line"]
    assert backend.commands[0].layer == "L1"
    assert backend.commands[2].layer == "L1"


def test_two_recording_backend_instances_do_not_share_commands_list():
    """Regression guard: dataclass field(default_factory=list) must be used, not a
    shared mutable default, or two instances would alias the same list."""
    b1 = RecordingBackend()
    b2 = RecordingBackend()
    b1.draw_line((0.0, 0.0, 0.0), (1.0, 0.0, 0.0), layer="X")
    assert b1.commands != b2.commands
    assert b2.commands == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_render_backend.py -v`
Expected: collection error / `ImportError: cannot import name 'RecordingBackend'` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/cad_intelligence/elevation/renderers/render_backend.py` exactly as specified in
`docs/superpowers/specs/2026-07-30-adr-ff-recording-backend-design.md` §Design (the full
module source is written out there — copy it verbatim, including the module docstring).

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_render_backend.py -v`
Expected: PASS (11 tests).

- [ ] **Step 5: Run the full elevation regression suite**

Run:
```
python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py tests/test_render_style.py tests/test_elevation_symbols.py tests/test_normalized_snapshot_parity.py tests/test_render_backend.py -v
```
Expected: all PASS, no import errors. This is a purely additive module — nothing existing
should change. If any pre-existing test fails, `render_backend.py` introduced an import
cycle or naming collision; investigate before proceeding.

- [ ] **Step 6: Self-review**

Confirm: `RecordingBackend` is NOT `@dataclass(frozen=True)` (must stay mutable, matching
`FakeDrawingContext`'s convention); `capability` and `commands` both use
`field(default_factory=...)` (never a bare mutable default); `Hatch.boundary` is a `tuple`
in the stored command even though the Protocol/method signature accepts `list`; no
`Renderer`/`ComposedFaceRenderer`/`DrawingContext` files were touched.

---

### Task 2: Update ADR-ff documentation status (honestly, partial)

**Files:**
- Modify: `docs/designs/ADR-face-elevation-architecture.md`

**This task must not claim more than what Task 1 actually built.** Re-read the spec's
"Exit Criteria Disposition" table before writing anything — all four ADR-ff Exit Criteria
stay **unchecked**. Status is "Partially Implemented," not "Implemented" or "Completed."

- [ ] **Step 1: Read the current ADR-ff section and compliance dashboard**

Read `docs/designs/ADR-face-elevation-architecture.md` around line 163 (dashboard row for
ADR-ff) and lines 1186-1291 (ADR-ff section) to find exact strings to edit.

- [ ] **Step 2: Update the ADR-ff status line**

Change:
```
**Status**: Proposed (target — extends ADR-z's `Renderer` ABC; added 2026-07-12 per second
architecture review)
```
to:
```
**Status**: Partially Implemented (2026-07-30) — Phase 1 of the ADR's own 5-step reference
implementation order (RecordingBackend → MatplotlibBackend → ZWCADBackend → SVGBackend →
PDFBackend) is done: `RenderBackend` Protocol, `BackendCapability`, and `RecordingBackend`
exist in `render_backend.py` and are independently unit-tested. `Renderer`
(`ComposedFaceRenderer`/`WallRenderer`/`DoorRenderer`/`WindowRenderer`) has NOT been
migrated off `DrawingContext` onto `RenderBackend` — that is Phase 3 in the ADR's order,
after `MatplotlibBackend` (Phase 2) proves the Protocol against a second real backend. All
four Exit Criteria below remain unchecked because each requires either a second backend or
the Renderer migration, neither of which exists yet.
```

- [ ] **Step 3: Update the Exit Criteria checklist — leave ALL FOUR unchecked, add reason notes**

Find the four `- [ ]` items (~line 1281-1290) and annotate each with a one-line reason
(do NOT check any of them):

```
- [ ] `RecordingBackend` and `MatplotlibBackend` both implement `RenderBackend` and both
      pass the same `Renderer`-level test suite with no backend-specific test branches.
      *(Partially blocked 2026-07-30 — RecordingBackend exists and is unit-tested;
      MatplotlibBackend does not exist yet, so there is no second backend to compare
      against, and no Renderer-level suite runs against either since Renderer hasn't been
      migrated onto RenderBackend.)*
- [ ] `ZWCADBackend` (promoted from `DrawingContext`) renders the same `LayoutScene`
      pixel-equivalently (via `RecordingBackend` replay through `MatplotlibBackend`) to
      what live ZWCAD produces, for at least one fixture room.
      *(Blocked 2026-07-30 — depends on MatplotlibBackend and ZWCADBackend, both
      unimplemented; not attempted.)*
- [ ] `Renderer`'s source contains zero `import win32com` — every ZWCAD-specific import is
      confined to `ZWCADBackend`.
      *(Not applicable yet 2026-07-30 — Renderer still uses DrawingContext, not
      RenderBackend; this criterion's premise doesn't hold until the Phase 3 migration
      happens.)*
- [ ] A `BackendCapability`-gated degrade path (e.g. hatch → solid fill) is exercised by at
      least one test using a backend with `supports_hatch=False`.
      *(Blocked 2026-07-30 — no Renderer code path reads `.capability` yet, since no
      Renderer calls RenderBackend at all.)*
```

- [ ] **Step 4: Update the compliance dashboard row**

Find the dashboard table row for ADR-ff (`| ADR-ff | Proposed | 0/4 | 0/4 |`) and change to:

```
| ADR-ff | Partially Implemented (2026-07-30) | 0/4 | 0/4 |
```

(0/4 is intentional and correct — Task 1 built real code, but zero of ADR-ff's own Exit
Criteria are satisfiable yet, per the disposition above. Do not change the fraction to
imply otherwise.)

- [ ] **Step 5: Self-review**

Re-read the whole diff. Confirm: no checkbox was checked; "Partially Implemented" (not
"Implemented"/"Completed") appears in both the status line and dashboard; ADR-hh's section
was NOT touched (it remains fully `Proposed`, unrelated to this phase); the dashboard
fraction is `0/4`, matching the four unchecked boxes.

---

### Task 3: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an entry under `[Unreleased]` → `### Changed`**

Add (as the newest entry, above the ADR-cc/jj entry):

```
- **[2026-07-30]**: **Started ADR-ff (Renderer Output Backend Abstraction) — Phase 1 of 5: RenderBackend Protocol + RecordingBackend** — Added `src/cad_intelligence/elevation/renderers/render_backend.py` defining the `RenderBackend` Protocol (`draw_line`/`draw_arc`/`draw_hatch`/`draw_text`/`draw_dimension`, backend-neutral primitives Renderer will eventually call instead of `DrawingContext`/`win32com`), `BackendCapability` (declares which primitives a backend can honor at full fidelity), and `RecordingBackend` (ADR-hh's core artifact — records draw calls as `DrawCommand`s — `Line`/`Arc`/`Hatch`/`Text`/`Dimension` — instead of drawing them). This is Phase 1 of the ADR's own 5-step reference order (RecordingBackend → MatplotlibBackend → ZWCADBackend → SVGBackend → PDFBackend); `Renderer` has NOT been migrated onto `RenderBackend` in this phase (still uses `DrawingContext`) — that's Phase 3, after `MatplotlibBackend` (Phase 2) proves the Protocol against a second real backend, per the ADR's own stated rationale for this ordering. All four of ADR-ff's Exit Criteria remain unchecked (0/4) since each requires either a second backend or the Renderer migration; see `docs/designs/ADR-face-elevation-architecture.md` (ADR-ff, marked "Partially Implemented") for the per-criterion disposition. 11 new unit tests in `tests/test_render_backend.py`; full existing elevation suite (renderers, render_pass, render_style, symbols, snapshot parity) re-verified green with no regressions.
```

- [ ] **Step 2: Self-review**

Confirm the entry says "Started" / "Phase 1 of 5" / "Partially Implemented" / "0/4" —
not "Implemented" or "Completed". This is a hard requirement per this project's history of
two prior premature-completion incidents.

---

### Task 4: Final whole-implementation review

**Files:** Read-only across Task 1-3 changes.

- [ ] **Step 1: Verify the full test suite is green**

Run:
```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py tests/test_render_style.py tests/test_elevation_symbols.py tests/test_normalized_snapshot_parity.py tests/test_render_backend.py -v
```
Expected: all PASS (no count decrease from before this plan — this plan is purely
additive, 11 new tests, zero deleted).

- [ ] **Step 2: Verify only the intended files changed**

Run: `git status --short` and confirm exactly these are modified/added:
`src/cad_intelligence/elevation/renderers/render_backend.py` (new),
`tests/test_render_backend.py` (new),
`docs/designs/ADR-face-elevation-architecture.md` (modified),
`CHANGELOG.md` (modified).
No `Renderer`/`ComposedFaceRenderer`/`DrawingContext`/`door_renderer.py`/`window_renderer.py`
files should appear — this phase never touches them.

- [ ] **Step 3: Run the workspace audit**

Run: `bun scripts/audit.ts` — must exit clean (all `[PASS]`, no `[FAIL]`).

- [ ] **Step 4: Adversarial self-review of the honesty requirement**

Re-read the ADR-ff section diff and the CHANGELOG entry one more time, specifically
hunting for any sentence that could be read as claiming `Renderer` now uses
`RenderBackend`, or that `MatplotlibBackend`/`ZWCADBackend` exist, or that any Exit
Criterion is satisfied. If found, fix it. This step exists because this project has
twice shipped exactly this failure mode (ADR-bb fabricated tests; ADR-cc/jj
documentation-only commit) — the bar here is "would a skeptical reviewer, given only
this diff and no other context, agree with every claim in it."

---

## Completion

After Task 4 passes, run `/sync` with a message matching the CHANGELOG entry's framing,
e.g.:

```
/sync "feat(elevation): start ADR-ff Phase 1 — RenderBackend Protocol + RecordingBackend"
```

Use "start"/"feat" language, not "implement"/"complete" — this is an intentionally partial
phase of a 5-phase ADR.

## Risk Notes

- **The single biggest risk in this plan is documentation overclaiming**, not code
  correctness — the code itself (Task 1) is small and low-risk (pure dataclasses + a
  Protocol, no integration point yet). Task 2/3's exit-criteria and CHANGELOG wording
  need the same scrutiny the code gets. If executing via subagents, the doc-writing task
  (Task 2/3) should get an explicit spec-compliance review pass checking specifically for
  overclaiming, not just "did the text get written."
- **`Hatch.boundary` type mismatch (list in, tuple stored)** is intentional (spec
  rationale: Protocol signature vs. storage), not a bug — don't "fix" it into matching
  types across both.
