# De-globalize WallProcessingMode + Wire SOLID_UNION into handle_generate_spaces — Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-07-31
> **Related**: `docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md`, `docs/superpowers/specs/2026-07-31-solid-union-room-detection-design.md`, `docs/designs/SPACE-001-design.md`

## Problem

Two concerns were flagged during this session's architecture review of `space_geometry.py`/`space.py`:

1. **`WALL_PROCESSING_MODE` is a mutable module-level global**, read directly inside `_weld_endpoints`, `_build_space_polygons` (`space_geometry.py`), and twice more inside `handle_generate_spaces`/`_get_v2_pipeline` (`space.py`). Any test or caller that wants a different mode for one call must mutate global state and remember to restore it — a source of test-isolation bugs and a blocker to ever handling concurrent requests with different modes.
2. **`WallProcessingMode.SOLID_UNION` (PR #170) has no caller.** `_build_space_polygons_solid_union` exists and is unit-tested, but nothing in `handle_generate_spaces` (the only handler that builds space polygons from extracted CAD objects) can reach it. It's real, tested code with no path to production use.

## Goals

- Make wall-processing mode an explicit parameter everywhere it's currently a global read, while keeping every existing caller's behavior byte-for-byte identical (the global becomes the *default value* of the parameter, not removed).
- Let `handle_generate_spaces` accept a `wall_processing_mode` param so a caller can opt into `SOLID_UNION` per-request.
- No change to `WallProcessingMode.LEGACY`/`ENDPOINT_CLUSTER`'s actual algorithms — this is a plumbing change, not an algorithm change.

## Non-Goals

- Not changing which mode is used by default (`ENDPOINT_CLUSTER` stays default everywhere).
- Not adding `axis_grid`/`divider_lines` support to the `SOLID_UNION` path — `_build_space_polygons_solid_union` doesn't accept them today, and adding that is a separate, larger scope (SOLID_UNION would need its own axis-snap/divider-injection story). If a caller requests `SOLID_UNION` together with `axis_grid`/`divider_lines`, `handle_generate_spaces` raises a clear `ExceptionReport` rather than silently ignoring the unsupported params.
- Not resolving the live-drawing room-detection reproducibility mystery or the `19AF` polyline door-status question from earlier in this session — those require a live ZWCAD session, out of scope here.
- Not removing the module-level `WALL_PROCESSING_MODE` constant — kept as the shared default so callers that never think about mode continue to get today's behavior with zero code change.

## Design

### 1. `space_geometry.py`: mode becomes an explicit parameter

```python
def _weld_endpoints(
    lines: list[LineString], tol: float,
    mode: "WallProcessingMode" = WALL_PROCESSING_MODE,
) -> list[LineString]:
    """Dispatch to v1 or v2 welding based on ``mode``."""
    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        ...  # unchanged body, just reads `mode` instead of the global
    return _weld_endpoints_v1(lines, tol)


def _build_space_polygons(
    wall_segments: list[WallSegment],
    openings: list[DoorEntity | WindowEntity],
    axis_grid: "AxisGrid | None" = None,
    divider_lines: list[LineString] | None = None,
    mode: "WallProcessingMode" = WALL_PROCESSING_MODE,
) -> tuple[list[SpacePolygon], list[ExceptionReport]]:
    ...
    if mode == WallProcessingMode.ENDPOINT_CLUSTER:
        raw_lines = _merge_wall_face_pairs(...)
    welded_lines = _weld_endpoints(raw_lines, CORNER_SNAP_TOL, mode=mode)
    ...
```

Both functions' bodies are otherwise unchanged — every internal `WALL_PROCESSING_MODE ==` comparison becomes `mode ==`. The module-level `WALL_PROCESSING_MODE` constant stays exactly as it is today (still importable, still the fallback default) — this is purely additive: any caller not passing `mode=` sees identical behavior to today.

### 2. `space.py`: thread the mode through the handler

`_get_v2_pipeline()` already returns `_sg.WALL_PROCESSING_MODE` as one of its 4 items — no change to its return shape. `handle_generate_spaces` gains one new optional param:

```python
wall_processing_mode_in = params.get("wall_processing_mode")  # str | None
```

Accepted string values: `"endpoint_cluster"` (default when omitted), `"solid_union"`, `"legacy"` — matched case-insensitively against `WallProcessingMode`'s member names. An unrecognized string is a hard `ValueError` at the handler boundary (fail loud, not silently fall back — this is a caller-facing param, not internal plumbing).

Two of the three existing internal reads of the global (`_WALL_MODE == _WPM.ENDPOINT_CLUSTER` at the soft-filter and dedup steps, lines ~3284/3330 today) **stay reading the module global**, not the new per-call param. Rationale: the soft-filter/dedup steps are about which walls get fed into polygon-building at all (upstream of mode selection), not about how those walls get turned into polygons — conflating them would mean requesting `SOLID_UNION` also silently changes wall-filtering behavior, which is a bigger surface change than this spec's goal. Only the actual `_build_space_polygons`/`_build_space_polygons_solid_union` dispatch (§3 below) uses the per-call mode.

### 3. `handle_generate_spaces`: dispatch to the right builder

```python
resolved_mode = _resolve_wall_processing_mode(wall_processing_mode_in)  # helper, see below

if resolved_mode == _WPM.SOLID_UNION:
    if parsed_axis_grid is not None or params.get("divider_lines"):
        exceptions = [_ExceptionReport(
            code="SOLID_UNION_UNSUPPORTED_PARAM", severity="blocking",
            context={"reason": "axis_grid/divider_lines not supported with SOLID_UNION"},
        )]
        space_polygons = []
    else:
        space_polygons, exceptions = _elev002_build_space_polygons_solid_union(
            wall_segments, openings
        )
else:
    space_polygons, exceptions = _elev002_build_space_polygons(
        wall_segments, openings, axis_grid=parsed_axis_grid, mode=resolved_mode,
    )
```

`_resolve_wall_processing_mode(value: str | None) -> WallProcessingMode`: a small new helper (co-located with `_get_v2_pipeline`) — returns `_WPM[value.upper()]` if `value` is a valid member name (case-insensitive), the module default (`_sg.WALL_PROCESSING_MODE`) if `value is None`, else raises `ValueError` with the invalid value and the list of accepted names in the message.

`_elev002_build_space_polygons_solid_union` is a new import alias for `_sg._build_space_polygons_solid_union`, added next to the existing `_elev002_build_space_polygons` alias at the top of `space.py` (same pattern, not a new import mechanism).

### 4. Backward compatibility

- No caller passes `wall_processing_mode` today → `resolved_mode` is always the module default (`ENDPOINT_CLUSTER`) → `handle_generate_spaces` output is byte-for-byte identical to before this change.
- `_build_space_polygons`/`_weld_endpoints` direct callers elsewhere are unaffected — they pass no `mode=` argument and get the global default. This includes (verified during spec review): existing tests in `tests/test_space_geometry.py`/`tests/test_open_plan.py` (which call these with ≤2 positional args + keyword `axis_grid=`/`divider_lines=`), **and** the third handler-internal caller `com_bridge.py:5775` (`_elev002_build_space_polygons(wall_segments, openings, axis_grid=parsed_axis_grid)`) — it also passes no `mode=`, so it transparently inherits the global default. Adding `mode=` as the last parameter with a default breaks none of these.

> **Note on the `divider_lines` guard (§3):** the `params.get("divider_lines")` check in the `SOLID_UNION` guard branch is *defensive against a future caller* — `handle_generate_spaces` at `space.py:3350` currently threads only `axis_grid` (not `divider_lines`) into `_elev002_build_space_polygons`. The guard is still correct (it must reject the unsupported combination whenever it could occur), but the implementation should carry a one-line comment noting this so a future reader doesn't search for existing `divider_lines` plumbing that isn't there.

## Testing

1. `_weld_endpoints`/`_build_space_polygons` accept an explicit `mode=` override that differs from the current module-level `WALL_PROCESSING_MODE`, and produce the result appropriate to that mode (not the global's) — proves the parameter, not the global, now controls behavior for an explicit call.
2. `_weld_endpoints`/`_build_space_polygons` called with no `mode=` argument behave identically to before this change (regression: run against 2-3 existing fixtures from `tests/test_space_geometry.py` and diff output).
3. `_resolve_wall_processing_mode`: `None` → module default; `"solid_union"`/`"SOLID_UNION"`/`"Solid_Union"` → `WallProcessingMode.SOLID_UNION` (case-insensitivity); invalid string → `ValueError` mentioning the bad value and valid options.
4. `handle_generate_spaces` with `wall_processing_mode="solid_union"` and valid wall/door/window input dispatches to `_build_space_polygons_solid_union` (mock/patch it and assert it was called, not `_build_space_polygons`).
5. `handle_generate_spaces` with `wall_processing_mode="solid_union"` AND `axis_grid` provided together → returns a blocking `SOLID_UNION_UNSUPPORTED_PARAM` exception, does not call either builder with mismatched params.
6. `handle_generate_spaces` with no `wall_processing_mode` param (existing test suite) → unchanged output, full regression pass.
7. `handle_generate_spaces` with `wall_processing_mode="not_a_real_mode"` → raises `ValueError`.

## Files Touched

- `src/cad_intelligence/geometry/space_geometry.py`: `_weld_endpoints`, `_build_space_polygons` gain `mode` param (default = module global, unchanged behavior).
- `src/cad_intelligence/cad_io/handlers/space.py`: new `_resolve_wall_processing_mode` helper; new `_elev002_build_space_polygons_solid_union` import alias; `handle_generate_spaces` gains `wall_processing_mode` param handling + dispatch branch.
- `tests/test_space_geometry.py`: new tests for `mode=` param (items 1-2 above).
- `tests/handlers/` (existing space handler test file, or a new one if none fits): new tests for `_resolve_wall_processing_mode` + `handle_generate_spaces` dispatch (items 3-7 above).
- `CHANGELOG.md`: entry.
