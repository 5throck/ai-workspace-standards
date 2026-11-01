# ADR-ff (Phase 2): MatplotlibBackend — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second `RenderBackend` implementation (`MatplotlibBackend`) backed by a real rasterizer, a shared test suite proving `RenderBackend`'s shape generalizes across both backends with zero backend-specific branching, and a `RecordingBackend`→`MatplotlibBackend` replay path. This satisfies ADR-ff Exit Criterion 1 (reinterpreted — see spec).

**Architecture:** New `matplotlib_backend.py` implements `RenderBackend` via `matplotlib.axes.Axes`. A shared, non-test fixture module (`tests/backend_shared_suite.py`) provides one draw-call sequence both backend test files exercise identically. A `replay()` free function walks a `RecordingBackend.commands` list and re-invokes the matching `MatplotlibBackend` method per command.

**Tech Stack:** Python 3.11+, `matplotlib>=3.8.0` (new dependency), `pytest`.

**Spec:** `docs/superpowers/specs/2026-07-30-adr-ff-matplotlib-backend-design.md` (reviewed, fixed for a blocking `pyplot` import bug and headless-CI safety, re-reviewed and approved).

---

## Reference Conventions (read once, apply throughout)

- Module docstring header format — see `src/cad_intelligence/elevation/renderers/render_backend.py:1-9`. Apply the same pattern to `matplotlib_backend.py`.
- `RenderBackend`'s five primitive signatures and the `Line`/`Arc`/`Hatch`/`Text`/`Dimension` dataclass field names are fixed by the already-merged `render_backend.py` — do not invent new field names; import and reuse exactly what's there.
- Run tests from project root: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_matplotlib_backend.py tests/test_backend_shared_suite.py tests/test_backend_replay.py -v`.
- **TDD is mandatory**: write the failing test first, confirm it fails for the right reason, then implement.
- **Critical: `matplotlib.use("Agg")` MUST be called before `import matplotlib.pyplot`** anywhere it's imported, or a GUI-toolkit backend could be auto-selected instead and fail on a headless machine. The spec's exact code (§Design, "New module") has this ordering right — copy it verbatim, do not reorder the imports.
- **Do not overclaim completion.** Exit Criterion 1 is satisfied only in a reinterpreted sense (see spec's Exit Criteria Disposition table) — the ADR doc update in Task 2 must say "Satisfied (reinterpreted, see note)", never a bare "Satisfied" or "Implemented". Criteria 2-4 stay unchecked; this project has twice shipped premature completion claims (ADR-bb, ADR-cc/jj) and a third instance is not acceptable.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `pyproject.toml` | Modify | Add `matplotlib>=3.8.0` to `[project] dependencies` |
| `src/cad_intelligence/elevation/renderers/matplotlib_backend.py` | Create | `MatplotlibBackend` + `replay()` |
| `tests/backend_shared_suite.py` | Create | Shared `run_sample_calls()` fixture (not a test file — no `test_` prefix, not collected) |
| `tests/test_matplotlib_backend.py` | Create | `MatplotlibBackend` unit tests |
| `tests/test_backend_shared_suite.py` | Create | Parametrized cross-backend suite (Exit Criterion 1) |
| `tests/test_backend_replay.py` | Create | `RecordingBackend` → `MatplotlibBackend` replay test |
| `docs/designs/ADR-face-elevation-architecture.md` | Modify | ADR-ff status/dashboard/exit-criteria updates |
| `CHANGELOG.md` | Modify | Entry for this phase |

---

### Task 0: Add matplotlib dependency

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add the dependency**

In `pyproject.toml`, under `[project] dependencies` (the same list containing
`"shapely>=2.0.0"`), add a new line: `"matplotlib>=3.8.0",` — match the existing
`>=X.Y.Z` version-constraint style and list formatting exactly.

- [ ] **Step 2: Install it into the active environment**

Run: `pip install matplotlib>=3.8.0` (or `pip install -e .` from project root to pick up
the updated `pyproject.toml` if the project is installed editable).

- [ ] **Step 3: Verify import works**

Run: `python -c "import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot; print(matplotlib.__version__)"`
Expected: prints a version string ≥ 3.8.0, no error.

---

### Task 1: MatplotlibBackend implementation

**Files:**
- Create: `src/cad_intelligence/elevation/renderers/matplotlib_backend.py`
- Create: `tests/backend_shared_suite.py`
- Test: `tests/test_matplotlib_backend.py`

- [ ] **Step 1: Write the shared draw-call fixture (not a test file itself)**

Create `tests/backend_shared_suite.py` exactly as specified in
`docs/superpowers/specs/2026-07-30-adr-ff-matplotlib-backend-design.md` §"New module:
tests/backend_shared_suite.py" — copy the `run_sample_calls(backend)` function verbatim.
This file must NOT be named `test_*.py` (pytest would try to collect it as a test module
and fail — it has no `test_` functions).

- [ ] **Step 2: Write the failing MatplotlibBackend tests**

Create `tests/test_matplotlib_backend.py`:

```python
"""Unit tests for MatplotlibBackend (ADR-ff Phase 2)."""

import pytest

from cad_intelligence.elevation.renderers.render_backend import BackendCapability
from cad_intelligence.elevation.renderers.matplotlib_backend import MatplotlibBackend
from tests.backend_shared_suite import run_sample_calls


@pytest.fixture
def backend():
    b = MatplotlibBackend()
    yield b
    b.close()


def test_construction_has_axes_and_capability(backend):
    assert backend.axes is not None
    assert isinstance(backend.capability, BackendCapability)


def test_draw_line_adds_a_line_artist(backend):
    before = len(backend.axes.get_lines())
    backend.draw_line((0.0, 0.0, 0.0), (10.0, 0.0, 0.0), layer="A-WALL")
    assert len(backend.axes.get_lines()) == before + 1


def test_draw_arc_adds_a_patch(backend):
    before = len(backend.axes.patches)
    backend.draw_arc((0.0, 0.0, 0.0), radius=10.0, start_angle=0.0, end_angle=90.0, layer="A-DOOR")
    assert len(backend.axes.patches) == before + 1


def test_draw_hatch_adds_a_patch(backend):
    before = len(backend.axes.patches)
    backend.draw_hatch(
        [(0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (10.0, 10.0, 0.0)], pattern="BRICK", layer="A-WALL-BRICK"
    )
    assert len(backend.axes.patches) == before + 1


def test_draw_text_adds_a_text_artist(backend):
    before = len(backend.axes.texts)
    backend.draw_text("900x2100", (5.0, 5.0, 0.0), height=250.0, layer="A-ANNO")
    assert len(backend.axes.texts) == before + 1


def test_draw_dimension_adds_a_text_artist(backend):
    """matplotlib stores Annotation objects (from axes.annotate) in axes.texts."""
    before = len(backend.axes.texts)
    backend.draw_dimension((0.0, 0.0, 0.0), (10.0, 0.0, 0.0), (5.0, -2.0, 0.0), layer="A-DIMS")
    assert len(backend.axes.texts) == before + 1


def test_run_sample_calls_does_not_raise(backend):
    run_sample_calls(backend)


def test_save_writes_a_nonzero_size_png(backend, tmp_path):
    run_sample_calls(backend)
    out = tmp_path / "out.png"
    backend.save(str(out))
    assert out.exists()
    assert out.stat().st_size > 0


def test_close_does_not_raise():
    b = MatplotlibBackend()
    b.close()  # no exception
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_matplotlib_backend.py -v`
Expected: collection error / `ModuleNotFoundError: No module named
'cad_intelligence.elevation.renderers.matplotlib_backend'`.

- [ ] **Step 4: Write the implementation**

Create `src/cad_intelligence/elevation/renderers/matplotlib_backend.py` exactly as
specified in the spec's §Design "New module:
src/cad_intelligence/elevation/renderers/matplotlib_backend.py" section — copy the module
verbatim, INCLUDING the `matplotlib.use("Agg")` call placed before `import
matplotlib.pyplot`, and the `draw_dimension` method WITHOUT the empty-string `axes.text()`
call (this was removed during spec review — the spec file already reflects the corrected
version, copy from there, not from memory).

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_matplotlib_backend.py -v`
Expected: PASS (9 tests).

- [ ] **Step 6: Self-review**

Confirm: `matplotlib.use("Agg")` appears before any `import matplotlib.pyplot` line
anywhere in the file; `close()` is called in every test via the `backend` fixture's
teardown (no leaked figures across the test run — check with `python -c "import
matplotlib.pyplot as plt; ...; print(len(plt.get_fignums()))"` after running the suite if
in doubt); `_resolve_color`/`_resolve_hatch` exist but are explicitly placeholder (per
spec's Design notes) — do not "improve" them with real ACI mapping, that's out of scope.

---

### Task 2: Shared cross-backend test suite (Exit Criterion 1)

**Files:**
- Test: `tests/test_backend_shared_suite.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_backend_shared_suite.py`:

```python
"""Cross-backend parametrized suite (ADR-ff Exit Criterion 1).

Runs the SAME draw-call sequence against both RecordingBackend and MatplotlibBackend with
zero backend-specific branching in the calls made, proving RenderBackend's shape
generalizes beyond a single implementation.
"""

import pytest

from cad_intelligence.elevation.renderers.render_backend import RecordingBackend
from cad_intelligence.elevation.renderers.matplotlib_backend import MatplotlibBackend
from tests.backend_shared_suite import run_sample_calls


def _make_recording_backend():
    return RecordingBackend()


def _make_matplotlib_backend():
    return MatplotlibBackend()


@pytest.fixture(params=[_make_recording_backend, _make_matplotlib_backend])
def any_backend(request):
    backend = request.param()
    yield backend
    close = getattr(backend, "close", None)
    if close is not None:
        close()


def test_run_sample_calls_succeeds_on_any_backend(any_backend):
    """No backend-specific branching here — the same call sequence runs on both."""
    run_sample_calls(any_backend)


def test_all_five_calls_are_recorded_by_any_backend(any_backend):
    run_sample_calls(any_backend)
    if isinstance(any_backend, RecordingBackend):
        assert len(any_backend.commands) == 5
    else:
        artifact_count = (
            len(any_backend.axes.get_lines())
            + len(any_backend.axes.patches)
            + len(any_backend.axes.texts)
        )
        assert artifact_count == 5
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_backend_shared_suite.py -v`
Expected: fails at import (`ModuleNotFoundError` for `matplotlib_backend`) until Task 1 is
complete. If Task 1 is already done when this task starts, this step instead confirms both
parametrized cases run — proceed straight to Step 3's real run.

- [ ] **Step 3: Run tests to verify they pass**

Run: `python -m pytest tests/test_backend_shared_suite.py -v`
Expected: PASS — 4 test instances total (2 tests × 2 backend params via `[_make_recording_backend]`/`[_make_matplotlib_backend]` parametrize IDs).

- [ ] **Step 4: Self-review — confirm no backend-specific branching in the CALLS made**

Re-read `test_run_sample_calls_succeeds_on_any_backend`: it must call
`run_sample_calls(any_backend)` with no `if isinstance(...)` branching before or during
that call. The `if isinstance(...)` in the second test is for *assertion*, not for
*varying what gets drawn* — that distinction is what the spec's Exit Criterion 1
disposition relies on. If any branching appears before/during the draw calls themselves
(not just in the post-hoc assertion), this criterion is not actually satisfied — fix it.

---

### Task 3: RecordingBackend → MatplotlibBackend replay

**Files:**
- Test: `tests/test_backend_replay.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_backend_replay.py`:

```python
"""RecordingBackend -> MatplotlibBackend replay test (ADR-hh's core use case, ADR-ff Phase 2).

Proves the design-doc claim "record once, replay through any headless backend" is
actually executable, not just asserted in prose.
"""

from cad_intelligence.elevation.renderers.render_backend import RecordingBackend
from cad_intelligence.elevation.renderers.matplotlib_backend import MatplotlibBackend, replay
from tests.backend_shared_suite import run_sample_calls


def test_replay_reproduces_direct_draw_artifact_counts(tmp_path):
    recording = RecordingBackend()
    run_sample_calls(recording)
    assert len(recording.commands) == 5

    direct = MatplotlibBackend()
    run_sample_calls(direct)
    direct_count = (
        len(direct.axes.get_lines()) + len(direct.axes.patches) + len(direct.axes.texts)
    )
    direct.close()

    replayed = MatplotlibBackend()
    replay(recording.commands, replayed)
    replayed_count = (
        len(replayed.axes.get_lines()) + len(replayed.axes.patches) + len(replayed.axes.texts)
    )

    assert replayed_count == direct_count

    out = tmp_path / "replayed.png"
    replayed.save(str(out))
    assert out.exists()
    assert out.stat().st_size > 0
    replayed.close()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_backend_replay.py -v`
Expected: fails until `matplotlib_backend.py`'s `replay()` function exists (Task 1 must be
complete; if `replay()` wasn't included in Task 1's copy from the spec, this is where the
gap surfaces — go back and add it, it IS part of the spec's module design).

- [ ] **Step 3: Run test to verify it passes**

Run: `python -m pytest tests/test_backend_replay.py -v`
Expected: PASS.

- [ ] **Step 4: Self-review**

Confirm `replay()`'s `isinstance` dispatch in `matplotlib_backend.py` covers all 5
`DrawCommand` variants (`Line`/`Arc`/`Hatch`/`Text`/`Dimension`) with correct field names
matching `render_backend.py`'s actual dataclasses — re-check against
`src/cad_intelligence/elevation/renderers/render_backend.py` directly, don't trust memory.

---

### Task 4: Regression check across the whole elevation suite

**Files:** none (verification only)

- [ ] **Step 1: Run the full elevation + backend test suite**

Run:
```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_elevation_renderers.py tests/test_render_pass.py tests/test_render_style.py tests/test_elevation_symbols.py tests/test_normalized_snapshot_parity.py tests/test_render_backend.py tests/test_matplotlib_backend.py tests/test_backend_shared_suite.py tests/test_backend_replay.py -v
```
Expected: all PASS. Count should be 43 (pre-existing, per Phase 1's final count) + 9
(Task 1) + 2 test functions × 2 params = 4 instances (Task 2) + 1 (Task 3) = 57 total.
Adjust the exact expected count if any step above added more assertions than listed, but
the key check is: zero failures, zero unexpected skips.

- [ ] **Step 2: Confirm no matplotlib figures leak across the test session**

Run:
```
python -c "
import subprocess
subprocess.run(['python', '-m', 'pytest', 'tests/test_matplotlib_backend.py', 'tests/test_backend_shared_suite.py', 'tests/test_backend_replay.py', '-q'])
import matplotlib.pyplot as plt
print('open figures after suite:', len(plt.get_fignums()))
"
```
Expected: `open figures after suite: 0` printed in the SAME process only reflects figures
opened in *this* script's own process, not the subprocess — so this exact snippet won't
catch leaks from the pytest subprocess. Instead, grep the test files for every
`MatplotlibBackend()` construction and confirm each has a matching `.close()` call (via
fixture teardown or explicit call) — this is the real verification method; the printed
figure count trick only works if run in-process, which pytest fixtures already do
correctly via the `backend` fixture's `yield`/teardown pattern from Task 1.

---

### Task 5: Update ADR-ff documentation status

**Files:**
- Modify: `docs/designs/ADR-face-elevation-architecture.md`

- [ ] **Step 1: Read the current ADR-ff section**

Read the section as it stands after Phase 1's edits (status line says "Partially
Implemented (2026-07-30)", all 4 Exit Criteria unchecked with disposition notes, dashboard
row `| ADR-ff | Partially Implemented (2026-07-30) | 0/4 | 0/4 |`).

- [ ] **Step 2: Update the status line to reflect Phase 2**

Amend the existing "Partially Implemented" status paragraph (do not replace it wholesale —
append a new sentence) to note Phase 2 is also done:

```
Phase 2 (2026-07-30) added `MatplotlibBackend` — a second `RenderBackend` implementation
backed by a real rasterizer — plus a shared parametrized test suite proving the Protocol's
shape generalizes across both backends with zero backend-specific branching, and a working
`RecordingBackend` → `MatplotlibBackend` replay path. `Renderer` STILL has not been
migrated onto `RenderBackend` (Phase 3, unstarted).
```

- [ ] **Step 3: Update Exit Criterion 1 — check it, with the reinterpretation note**

Change:
```
- [ ] `RecordingBackend` and `MatplotlibBackend` both implement `RenderBackend` and both
      pass the same `Renderer`-level test suite with no backend-specific test branches.
      *(Partially blocked 2026-07-30 — RecordingBackend exists and is unit-tested;
      MatplotlibBackend does not exist yet, so there is no second backend to compare
      against, and no Renderer-level suite runs against either since Renderer hasn't been
      migrated onto RenderBackend.)*
```
to:
```
- [x] `RecordingBackend` and `MatplotlibBackend` both implement `RenderBackend` and both
      pass the same `Renderer`-level test suite with no backend-specific test branches.
      *(Satisfied (reinterpreted, see note) 2026-07-30 — NOT a literal reading of this
      criterion: "Renderer-level" is read as "RenderBackend-level" since no Renderer has
      been migrated onto RenderBackend yet (still Phase 3, unstarted).
      `tests/test_backend_shared_suite.py` runs an identical draw-call sequence against
      both RecordingBackend and MatplotlibBackend via parametrization with zero
      backend-specific branching in the calls made. See
      docs/superpowers/specs/2026-07-30-adr-ff-matplotlib-backend-design.md §Exit Criteria
      Disposition for the full disclosure.)*
```

Leave Exit Criteria 2, 3, 4 exactly as Phase 1 left them (unchecked, with their existing
notes) — do not touch those three bullets.

- [ ] **Step 4: Update the compliance dashboard row**

Change `| ADR-ff | Partially Implemented (2026-07-30) | 0/4 | 0/4 |` to:
```
| ADR-ff | Partially Implemented (2026-07-30) | 1/4 | 1/4 |
```

- [ ] **Step 5: Self-review**

Confirm: exactly one checkbox (`[x]`) now exists in the ADR-ff section, and it carries the
"(reinterpreted, see note)" qualifier inline, not just in a footnote that could be missed;
dashboard fraction is `1/4` matching the single checked box; ADR-hh section is untouched.

---

### Task 6: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add an entry under `[Unreleased]` → `### Changed`, above the Phase 1 entry**

```
- **[2026-07-30]**: **Continued ADR-ff (Renderer Output Backend Abstraction) — Phase 2 of 5: MatplotlibBackend** — Added `matplotlib>=3.8.0` as a project dependency and `src/cad_intelligence/elevation/renderers/matplotlib_backend.py` implementing `MatplotlibBackend`, the second `RenderBackend` implementation (after Phase 1's `RecordingBackend`), backed by a real `matplotlib.axes.Axes` (headless-safe via explicit `matplotlib.use("Agg")`). Added a shared, backend-agnostic draw-call fixture (`tests/backend_shared_suite.py`) and a parametrized cross-backend test suite (`tests/test_backend_shared_suite.py`) that runs the identical call sequence against both `RecordingBackend` and `MatplotlibBackend` with zero backend-specific branching — this satisfies ADR-ff Exit Criterion 1, under an explicitly-disclosed reinterpretation ("Renderer-level" read as "RenderBackend-level," since `Renderer` itself has not been migrated onto `RenderBackend` — that remains Phase 3, unstarted). Also added `replay()`, letting a `RecordingBackend`'s captured command list be replayed through a `MatplotlibBackend` to produce a PNG — the first executable proof of ADR-hh's "record once, replay through any headless backend" design claim (`tests/test_backend_replay.py`). ADR-ff Exit Criteria: 1/4 now satisfied (up from 0/4); Criteria 2-4 remain blocked on the still-unstarted `ZWCADBackend` (Phase 3) and `Renderer` migration. See `docs/designs/ADR-face-elevation-architecture.md` (ADR-ff).
```

- [ ] **Step 2: Self-review**

Confirm the entry says "Continued" / "Phase 2 of 5" / "1/4" / explicitly names the
reinterpretation — not "Implemented" or "Completed" for the whole ADR.

---

### Task 7: Final whole-implementation review

**Files:** Read-only across Tasks 0-6.

- [ ] **Step 1: Full regression run**

Run the Task 4 Step 1 command again as a final gate. All PASS required.

- [ ] **Step 2: Verify only intended files changed**

`git status --short` should show exactly: `pyproject.toml`,
`src/cad_intelligence/elevation/renderers/matplotlib_backend.py` (new),
`tests/backend_shared_suite.py` (new), `tests/test_matplotlib_backend.py` (new),
`tests/test_backend_shared_suite.py` (new), `tests/test_backend_replay.py` (new),
`docs/designs/ADR-face-elevation-architecture.md` (modified), `CHANGELOG.md` (modified).
No `Renderer`/`ComposedFaceRenderer`/`DrawingContext`/`render_backend.py` (Phase 1's
already-merged file) changes.

- [ ] **Step 3: Run the workspace audit**

Run: `bun scripts/audit.ts` — must exit clean.

- [ ] **Step 4: Adversarial overclaiming re-read**

Re-read the full diff of `docs/designs/ADR-face-elevation-architecture.md` and the
CHANGELOG entry one more time. Confirm every "Satisfied"/"[x]" is qualified with
"(reinterpreted, see note)" where applicable, and nothing implies `Renderer` now uses
`RenderBackend`, or that `ZWCADBackend` exists, or that Criteria 2-4 are satisfied. This
project has shipped this exact failure mode twice (ADR-bb, ADR-cc/jj) — the bar is "would
a skeptical reviewer, given only this diff, agree with every claim in it."

---

## Completion

After Task 7 passes, run:

```
/sync "feat(elevation): continue ADR-ff Phase 2 — MatplotlibBackend + cross-backend test suite"
```

Use "continue" language (this is phase 2 of 5), not "implement"/"complete".

## Risk Notes

- **The `matplotlib.use("Agg")` ordering is the single most likely place to introduce a
  real bug** if the spec's exact import order isn't copied verbatim — `Agg` must be set
  before `matplotlib.pyplot` is imported anywhere in the process (including by unrelated
  code that might import pyplot first in some future test-collection order). If CI or a
  local run ever shows a `Tk`/`Qt`-backend-related error, this ordering is the first thing
  to check.
- **Documentation overclaiming remains the top risk**, same as Phase 1 — the code itself is
  low-risk (already reviewed twice at the spec level). Task 5/6's wording needs the same
  scrutiny as Task 1-3's code.
