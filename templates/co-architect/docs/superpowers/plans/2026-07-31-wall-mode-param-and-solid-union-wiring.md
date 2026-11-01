---
lang: ko
lang_reason: proper-noun
---

# De-globalize WallProcessingMode + Wire SOLID_UNION Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `WALL_PROCESSING_MODE` an explicit parameter (default = today's global, so all current callers are byte-for-byte unchanged) through `_weld_endpoints`/`_build_space_polygons`, and let `handle_generate_spaces` accept a `wall_processing_mode` param so a caller can opt into `SOLID_UNION` per-request — finally giving the PR #170 SOLID_UNION path a production entry point.

**Architecture:** Pure plumbing — add a `mode` keyword param (default `WALL_PROCESSING_MODE`) to two `space_geometry.py` functions and replace their internal global reads with `mode`; add one small resolver helper + one dispatch branch in `space.py`'s `handle_generate_spaces`. No algorithm changes.

**Tech Stack:** Python, existing `WallProcessingMode` enum, existing `_build_space_polygons_solid_union`.

---

## Reference

Spec (reviewer-approved ✅): `docs/superpowers/specs/2026-07-31-wall-mode-param-and-solid-union-wiring-design.md`

Key verified facts (from spec review):
- `_weld_endpoints` (`space_geometry.py:1053`) and `_build_space_polygons` (`:2391`) read the module global internally — these become `mode` reads.
- `_build_space_polygons_solid_union` (`:929`) signature is `(wall_segments, openings)` only — no `axis_grid`/`divider_lines`, justifying the unsupported-combo guard.
- `_get_v2_pipeline()` (`space.py:148`) returns `(WallProcessingMode, WALL_PROCESSING_MODE, _dedup, _validate)` — unchanged.
- `_elev002_build_space_polygons` (`space.py:2922`) is a direct alias of `_build_space_polygons` → transitively gains `mode=`.
- The two `_WALL_MODE == _WPM.ENDPOINT_CLUSTER` reads in `handle_generate_spaces` (`:3284` soft-filter, `:3330` dedup) are wall-filtering steps upstream of the polygon-build dispatch (`:3350`) — they stay reading the global.
- Existing tests call `_weld_endpoints`/`_build_space_polygons` with ≤2 positional args + keyword `axis_grid=`/`divider_lines=` → adding trailing `mode=` breaks nothing. Third caller `com_bridge.py:5775` also passes no `mode=`.

---

### Task 1: `mode` param on `_weld_endpoints` + `_build_space_polygons`

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (`_weld_endpoints` ~line 1053, `_build_space_polygons` ~line 2328).
- Test: `tests/test_space_geometry.py` (append).

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_space_geometry.py`:

```python
class TestWallProcessingModeParam:
    """Concern #1: WALL_PROCESSING_MODE must be overridable per-call via
    an explicit `mode=` param, not only via the module global."""

    def test_weld_endpoints_accepts_explicit_mode(self):
        from cad_intelligence.geometry import space_geometry as sg
        lines = [LineString([(0, 0), (100, 0)]), LineString([(100, 0), (200, 0)])]
        # Explicit mode = each value should not raise and should return a list
        for m in sg.WallProcessingMode:
            result = sg._weld_endpoints(lines, 150.0, mode=m)
            assert isinstance(result, list)

    def test_build_space_polygons_accepts_explicit_mode(self):
        from cad_intelligence.geometry import space_geometry as sg
        from cad_intelligence.common.models import WallSegment
        seg = WallSegment(handle="w1", layer="W", start=(0, 0), end=(0, 1000),
                          length=1000.0)
        for m in sg.WallProcessingMode:
            polys, excs = sg._build_space_polygons([seg], [], mode=m)
            assert isinstance(polys, list)
            assert isinstance(excs, list)

    def test_build_space_polygons_solid_union_reachable_via_mode(self):
        """A caller passing mode=SOLID_UNION exercises the solid-union
        builder path (not the endpoint-cluster path). Construct input
        where SOLID_UNION yields at least one room that ENDPOINT_CLUSTER
        does not, to prove the param actually selects the path."""
        from cad_intelligence.geometry import space_geometry as sg
        from cad_intelligence.common.models import WallSegment
        # Four walls forming a simple closed room (a 2000x2000 box).
        segs = [
            WallSegment(handle="w1", layer="W", start=(0, 0), end=(2000, 0), length=2000.0),
            WallSegment(handle="w2", layer="W", start=(2000, 0), end=(2000, 2000), length=2000.0),
            WallSegment(handle="w3", layer="W", start=(2000, 2000), end=(0, 2000), length=2000.0),
            WallSegment(handle="w4", layer="W", start=(0, 2000), end=(0, 0), length=2000.0),
        ]
        su_polys, _ = sg._build_space_polygons(segs, [], mode=sg.WallProcessingMode.SOLID_UNION)
        assert len(su_polys) >= 1, "SOLID_UNION mode should detect the enclosed room"
```

**`WallSegment` required fields** (verified — `src/cad_intelligence/common/models.py:88-95`): `handle`, `layer`, `start`, `end`, `length`. Use `handle=`, not `id=`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestWallProcessingModeParam -v`
Expected: FAIL — `_weld_endpoints`/`_build_space_polygons` don't accept `mode=` yet (`TypeError: unexpected keyword argument 'mode'`).

- [ ] **Step 3: Add `mode` param to `_weld_endpoints`**

At `space_geometry.py:1053`, change signature and body:

```python
def _weld_endpoints(
    lines: list[LineString], tol: float,
    mode: "WallProcessingMode" = WALL_PROCESSING_MODE,
) -> list[LineString]:
    """Dispatch to v1 or v2 welding based on ``mode``."""
    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        return _weld_endpoints_v2(lines, tol)
    return _weld_endpoints_v1(lines, tol)
```

- [ ] **Step 4: Add `mode` param to `_build_space_polygons`**

At `space_geometry.py:2328`, add `mode: "WallProcessingMode" = WALL_PROCESSING_MODE,` as the last parameter. In the body, replace the single `if WALL_PROCESSING_MODE == WallProcessingMode.ENDPOINT_CLUSTER:` (line ~2391) with `if mode == WallProcessingMode.ENDPOINT_CLUSTER:`, and replace `_weld_endpoints(raw_lines, CORNER_SNAP_TOL)` with `_weld_endpoints(raw_lines, CORNER_SNAP_TOL, mode=mode)`. **Do NOT** route SOLID_UNION here — that stays a separate function (`_build_space_polygons_solid_union`); within `_build_space_polygons`, SOLID_UNION/LEGACY both fall through to the non-ENDPOINT_CLUSTER path (same as today's behavior for LEGACY). Add a one-line comment noting SOLID_UNION is dispatched at the handler layer, not here.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestWallProcessingModeParam -v`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full space_geometry regression**

Run: `python -m pytest tests/test_space_geometry.py tests/test_open_plan.py -v`
Expected: PASS — no regressions (proves the default-value backward-compat claim).

- [ ] **Step 7: Do NOT commit.**

---

### Task 2: `_resolve_wall_processing_mode` helper

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` (near `_get_v2_pipeline`, ~line 148).
- Test: `tests/handlers/test_wall_processing_mode_dispatch.py` (new file).

- [ ] **Step 1: Write the failing tests**

```python
"""test_wall_processing_mode_dispatch.py — _resolve_wall_processing_mode
and handle_generate_spaces wall_processing_mode dispatch (concerns #1/#2).
"""
import pytest
from cad_intelligence.cad_io.handlers import space


class TestResolveWallProcessingMode:
    def test_none_returns_module_default(self):
        from cad_intelligence.geometry import space_geometry as sg
        assert space._resolve_wall_processing_mode(None) == sg.WALL_PROCESSING_MODE

    def test_case_insensitive_lookup(self):
        from cad_intelligence.geometry import space_geometry as sg
        assert space._resolve_wall_processing_mode("solid_union") == sg.WallProcessingMode.SOLID_UNION
        assert space._resolve_wall_processing_mode("SOLID_UNION") == sg.WallProcessingMode.SOLID_UNION
        assert space._resolve_wall_processing_mode("Solid_Union") == sg.WallProcessingMode.SOLID_UNION
        assert space._resolve_wall_processing_mode("endpoint_cluster") == sg.WallProcessingMode.ENDPOINT_CLUSTER
        assert space._resolve_wall_processing_mode("legacy") == sg.WallProcessingMode.LEGACY

    def test_invalid_string_raises(self):
        with pytest.raises(ValueError, match="not_a_real_mode"):
            space._resolve_wall_processing_mode("not_a_real_mode")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_wall_processing_mode_dispatch.py::TestResolveWallProcessingMode -v`
Expected: FAIL — `_resolve_wall_processing_mode` doesn't exist.

- [ ] **Step 3: Implement `_resolve_wall_processing_mode`**

Add to `space.py` right after `_get_v2_pipeline`:

```python
def _resolve_wall_processing_mode(value):
    """Resolve a caller-supplied ``wall_processing_mode`` string (or
    ``None``) to a ``WallProcessingMode`` enum member. ``None`` returns
    the module default (``space_geometry.WALL_PROCESSING_MODE``) so
    callers that don't pass the param get today's behavior. An
    unrecognized string raises ``ValueError`` (fail loud at the handler
    boundary, not a silent fallback).
    """
    _WPM, _DEFAULT_MODE, _, _ = _get_v2_pipeline()
    if value is None:
        return _DEFAULT_MODE
    try:
        return _WPM[value.upper()]
    except KeyError as exc:
        valid = [m.name.lower() for m in _WPM]
        raise ValueError(
            f"Invalid wall_processing_mode {value!r}; accepted: {valid}"
        ) from exc
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_wall_processing_mode_dispatch.py::TestResolveWallProcessingMode -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Do NOT commit.**

---

### Task 3: Wire `wall_processing_mode` into `handle_generate_spaces` + SOLID_UNION dispatch

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` (`handle_generate_spaces` ~line 3144; add `_elev002_build_space_polygons_solid_union` import alias near the existing `_elev002_build_space_polygons` alias at ~line 2922).
- Test: `tests/handlers/test_wall_processing_mode_dispatch.py` (append).

- [ ] **Step 1: Write the failing tests**

Append to `tests/handlers/test_wall_processing_mode_dispatch.py`:

```python
from unittest.mock import patch, MagicMock


class TestHandleGenerateSpacesDispatch:
    def _base_params(self):
        # Four walls forming a closed room (enough for any mode to detect 1 room).
        # WallSegment dicts use "handle" (not "id") — matches the dataclass.
        return {
            "walls": [
                {"handle": "w1", "layer": "W", "start": (0, 0), "end": (2000, 0), "length": 2000.0},
                {"handle": "w2", "layer": "W", "start": (2000, 0), "end": (2000, 2000), "length": 2000.0},
                {"handle": "w3", "layer": "W", "start": (2000, 2000), "end": (0, 2000), "length": 2000.0},
                {"handle": "w4", "layer": "W", "start": (0, 2000), "end": (0, 0), "length": 2000.0},
            ],
            "doors": [],
            "windows": [],
        }

    def test_solid_union_dispatched_when_requested(self):
        params = dict(self._base_params(), wall_processing_mode="solid_union")
        with patch.object(space, "_elev002_build_space_polygons_solid_union") as mock_su, \
             patch.object(space, "_elev002_build_space_polygons") as mock_std:
            from cad_intelligence.common.models import SpacePolygon
            mock_su.return_value = ([SpacePolygon(auto_id="r1")], [])
            space.handle_generate_spaces(params)
        assert mock_su.called, "SOLID_UNION builder must be called when wall_processing_mode=solid_union"
        assert not mock_std.called

    def test_solid_union_with_axis_grid_returns_blocking_exception(self):
        params = dict(self._base_params(), wall_processing_mode="solid_union",
                      axis_grid={"x_axes": [], "y_axes": []})
        with patch.object(space, "_elev002_build_space_polygons_solid_union") as mock_su, \
             patch.object(space, "_elev002_build_space_polygons") as mock_std:
            result = space.handle_generate_spaces(params)
        assert not mock_su.called and not mock_std.called
        # A blocking SOLID_UNION_UNSUPPORTED_PARAM exception must be surfaced.
        # Confirm the HandlerResult exceptions path first (read
        # handlers/common.py: HandlerResult.data is the dict carrying
        # "exceptions"; if the attribute differs, adjust this access).
        excs = result.data.get("exceptions", [])
        assert any(e.get("code") == "SOLID_UNION_UNSUPPORTED_PARAM" for e in excs)

    def test_default_call_unchanged(self):
        """No wall_processing_mode param → standard builder, unchanged."""
        params = self._base_params()
        with patch.object(space, "_elev002_build_space_polygons") as mock_std, \
             patch.object(space, "_elev002_build_space_polygons_solid_union") as mock_su:
            from cad_intelligence.common.models import SpacePolygon
            mock_std.return_value = ([], [])
            space.handle_generate_spaces(params)
        assert mock_std.called and not mock_su.called

    def test_invalid_mode_raises_valueerror(self):
        params = dict(self._base_params(), wall_processing_mode="bogus")
        with pytest.raises(ValueError):
            space.handle_generate_spaces(params)
```

Before finalizing, check `SpacePolygon`'s required fields in `models.py` for the mock return value, and confirm `axis_grid`'s expected dict shape (the test uses a minimal `{"x_axes": [], "y_axes": []}` — verify `_AxisGrid.from_dict` accepts it or adjust). Confirm `handle_generate_spaces` reads `params.get("axis_grid")` (it does, at line ~3345) and that the dispatch insertion point is AFTER `parsed_axis_grid` is computed and BEFORE the current `_elev002_build_space_polygons(...)` call at line ~3350.

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/handlers/test_wall_processing_mode_dispatch.py::TestHandleGenerateSpacesDispatch -v`
Expected: FAIL — no dispatch branch / no `_elev002_build_space_polygons_solid_union` alias yet.

- [ ] **Step 3: Add the SOLID_UNION import alias**

The existing `_elev002_build_space_polygons` alias is defined at `space.py:2921-2944` via a `try/except` pair that does `from space_geometry import _build_space_polygons as _elev002_build_space_polygons` in **both** branches. Mirror that exact mechanism for the solid-union variant — add `_build_space_polygons_solid_union as _elev002_build_space_polygons_solid_union` to **both** the `try` block AND the `except` (fallback package-relative) block. The goal is a module-level callable `space._elev002_build_space_polygons_solid_union`, reachable by the handler and patchable in tests. Do NOT invent a `_sg` module-level alias — there isn't one.

- [ ] **Step 4: Add the dispatch branch in `handle_generate_spaces`**

Right before the existing `space_polygons, exceptions = _elev002_build_space_polygons(...)` call (~line 3350), insert:

```python
        resolved_mode = _resolve_wall_processing_mode(params.get("wall_processing_mode"))
        if resolved_mode == _WPM.SOLID_UNION:
            # SOLID_UNION builder doesn't accept axis_grid/divider_lines.
            # NOTE: handle_generate_spaces currently threads only axis_grid
            # (not divider_lines) into the standard builder, so the
            # divider_lines check here is defensive against a future caller.
            if parsed_axis_grid is not None or params.get("divider_lines"):
                space_polygons = []
                exceptions = [_ExceptionReport(
                    code="SOLID_UNION_UNSUPPORTED_PARAM",
                    severity="blocking",
                    context={"reason": "axis_grid/divider_lines not supported with SOLID_UNION"},
                )]
            else:
                space_polygons, exceptions = _elev002_build_space_polygons_solid_union(
                    wall_segments, openings
                )
        else:
            space_polygons, exceptions = _elev002_build_space_polygons(
                wall_segments, openings, axis_grid=parsed_axis_grid, mode=resolved_mode,
            )
```

Ensure `_WPM` is in scope (it is — `_WPM` is unpacked from `_get_v2_pipeline()` at line ~3241). Replace the old single `_elev002_build_space_polygons(...)` call at line 3350 with this branch.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/handlers/test_wall_processing_mode_dispatch.py -v`
Expected: PASS (all 7 tests: 3 resolver + 4 dispatch).

- [ ] **Step 6: Run full handler + geometry regression**

Run: `python -m pytest tests/handlers/ tests/test_space_geometry.py tests/test_open_plan.py -v`
Expected: PASS — no regressions.

- [ ] **Step 7: Do NOT commit.**

---

### Task 4: CHANGELOG entry + sidecar count correction note

**Files:**
- Modify: `CHANGELOG.md`.

- [ ] **Step 1: Add `[Unreleased]` entries**

Under `### Added`:
```
- **[2026-07-31]**: **`WALL_PROCESSING_MODE` is now overridable per-call, and `WallProcessingMode.SOLID_UNION` is wired into `handle_generate_spaces`** (`src/cad_intelligence/geometry/space_geometry.py`, `src/cad_intelligence/cad_io/handlers/space.py`) — addresses two architecture-review concerns on the room-detection pipeline. (1) `_weld_endpoints` and `_build_space_polygons` now take an explicit `mode` keyword param (default = today's module global) instead of reading the mutable module-level `WALL_PROCESSING_MODE` global internally — purely additive, every existing caller (including `com_bridge.py` and all tests) passes no `mode=` and gets byte-for-byte identical output, but tests and future concurrent callers can now select a mode per-call without mutating global state. (2) `handle_generate_spaces` accepts a new `wall_processing_mode` param (`"endpoint_cluster"` default, `"solid_union"`, `"legacy"`, case-insensitive; invalid → `ValueError`) and dispatches to `_build_space_polygons_solid_union` when `solid_union` is requested — giving the PR #170 area-based room-detection path its first production entry point. Requesting `solid_union` together with `axis_grid`/`divider_lines` (which the SOLID_UNION builder doesn't accept) surfaces a blocking `SOLID_UNION_UNSUPPORTED_PARAM` exception rather than silently ignoring the params. See `docs/superpowers/specs/2026-07-31-wall-mode-param-and-solid-union-wiring-design.md` and `docs/superpowers/plans/2026-07-31-wall-mode-param-and-solid-union-wiring.md`.
```

Under `### Fixed` (or `### Documentation`), add the sidecar count correction:
```
- **[2026-07-31]**: **Corrected `memory/drawings/아파트 평면도.door-window-patterns.json` door count from 9 to 10** — a fresh-process extraction (decisive test after the live MCP server returned the stale pre-PR-#171 baseline of 81 doors) confirmed `_detect_curved_cluster_doors` correctly detects `19AF` (a real ~88-degree bulged polyline ~365mm from the `19B6` cluster), which the sidecar had previously flagged as `unresolved_nearby_entity`. User-accepted `19AF` as the 10th door rather than tightening the detector rule; the rule ("any bulged polyline on a search_layer") is sound. Also confirmed PR #171's sidecar wiring is correct and reachable end-to-end; the earlier 81-door live result was a stale MCP server process (imported `space.py` before #171 merged), not a code bug — reconnecting the MCP server (`/mcp` or Claude Code restart) loads the merged code.
```

- [ ] **Step 2: Do NOT commit** — `/sync` handles it.

---

### Task 5: Final regression + sync

- [ ] **Step 1: Run the full test suite**

Run: `python -m pytest tests/ -q` (skip live-COM-only tests if any segment errors on missing ZWCAD).
Expected: PASS — no regressions attributable to this change.

- [ ] **Step 2: `/sync "feat(geometry): de-globalize WallProcessingMode behind a mode param and wire SOLID_UNION into handle_generate_spaces"`**

Handles CHANGELOG verification, audit, commit, push, PR.

---

## Post-Plan Note

This plan is pure plumbing (no algorithm changes); the risk surface is the two signature additions and the new dispatch branch. The TDD tasks (failing test → implement → pass) at each step catch any caller that breaks. All commits via `/sync` only.
