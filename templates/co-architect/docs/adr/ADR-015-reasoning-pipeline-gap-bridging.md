# ADR-015: Reasoning Pipeline Gap-Bridging (Two-Representation Fork)

**Status**: Accepted — Implemented (steps 3–5 of the roadmap, all landed. Step 4 — apartment fixture upgrade to realistic wall gaps + golden re-pin — and step 5 — calibration re-run confirming `door_access_weight` now has a measurable effect — both shipped as follow-up PRs, see Verification)
**Date**: 2026-08-02
**Related**: ADR-004 (CAD-Intelligence Pipeline), ELEV-002-design.md (`build_space_polygons`, where the bridge already lives), AXIS-001-design.md §3 (`find_wall_discontinuities`), PR #207 (DOOR_ACCESS end-to-end activation, which surfaced this limitation)

---

## Context

The reasoning pipeline (`ModularReasoningPipeline._build_evidence_repository`,
`pipeline_modular.py:282`) consumes **one** line set for two purposes that
demand contradictory geometry:

| Consumer | Wants | Why |
|---|---|---|
| `shapely.ops.polygonize_full` (line 358) | **closed** loops | A door gap in a room's exterior wall breaks the loop → `component_polygons` comes back empty for that room → no CLOSED_LOOP evidence, no room hypothesis, and every polygon-derived generator (CONTAINMENT, ROOM_RATIO, SYMMETRY, ADJACENCY, DOOR_ACCESS) loses its input. |
| `find_wall_discontinuities` (line 408, via `generate_opening_synth_evidence`) | **open** gaps | Door/window openings *are* gaps. If the gap is closed, OPENING_SYNTH finds nothing → no `OPENING_SLOT` feature → DOOR_ACCESS / WINDOW_EXTERNALITY never fire. |

Today both consumers are fed the **same** per-component `shapely_lines` built at
`pipeline_modular.py:350` (raw `LineString`s — not welded, not bridged). So a
real door-in-exterior-wall is a lose/lose: the loop breaks *and* the gap that
would have classified the door is the same break that destroyed the room
polygon. PR #207 worked around this by placing the test door as an **interior**
gap (its midpoint falls inside a separately-closing rectangle), which keeps the
outer loop intact. That workaround cannot represent a real apartment's doors,
which sit *in* the exterior walls.

### Notable finding: the bridge already exists

The geometry layer solved this exact tension long ago.
`build_space_polygons` (`geometry/space_geometry.py:2760`) runs the pipeline:

```
raw_lines → _weld_endpoints → _bridge_door_window_gaps → polygonize_full
                                              │
                 (same welded, UN-bridged lines also feed
                  find_wall_discontinuities for gap classification)
```

`_bridge_door_window_gaps` (`space_geometry.py:1641`) inserts synthetic
`LineString`s across gaps that are **explained by a nearby
`DoorEntity`/`WindowEntity`** (gap within `DOOR_BRIDGE_TOL` = 1200mm, larger
than `CORNER_SNAP_TOL` = 150mm, with an opening position within
`OPENING_PROXIMITY_TOL` = 200mm of the gap segment). Gaps with *no* nearby
opening are deliberately left open so genuine drafting errors surface as
UNCLOSED_WALLS rather than being silently papered over. `find_wall_discontinuities`
reuses the *same* `_find_gaps` scan on the welded-but-un-bridged network to
classify those gaps as door/window/unknown.

So this is **not** a "design a new bridging algorithm" decision. The algorithm
exists, is tested, and ships in production geometry code. The decision is how
the **reasoning** package shares it without duplicating it.

## Decision

**Reuse the geometry layer's existing `_weld_endpoints` + `_bridge_door_window_gaps`
inside `_build_evidence_repository` to produce two representations per
component — do not write a new bridge in the reasoning package.**

### 1. Where to fork — per component, inside the evidence repository

The fork happens at the single point both consumers diverge today:
`pipeline_modular.py:350`, immediately after `shapely_lines` is built for a
component. Compute two line sets there:

```python
# (resolve doors/windows ONCE, before the per-component loop — see §3)
welded = _weld_endpoints(shapely_lines, CORNER_SNAP_TOL)
bridged_lines, _bridges = _bridge_door_window_gaps(
    welded, component_openings, CORNER_SNAP_TOL, DOOR_BRIDGE_TOL
)
```

- `polygonize_full(bridged_lines)` replaces `polygonize_full(shapely_lines)` (line 358).
- `compute_component_features(component_id, primitives, shapely_lines=bridged_lines)`
  also receives `bridged_lines` (line 354) — CLOSED_LOOP confidence should
  reflect "this is a closed room *through* its door", not be penalized for the
  gap. (See §4 for the one generator that must NOT take bridged lines.)
- The original `shapely_lines` stay alive for the opening-detection path (§4).

The fork is **per-component** (not global) because `component_polygons`,
`compute_component_features`, and the component evidence are all already
scoped per connected component — bridging must not weld across component
boundaries (two unrelated rooms must not get bridged together).

### 2. Cache bridged geometry? — No new cache

`bridged_lines` is a **local variable**, consumed once by `polygonize_full`
(and `compute_component_features`) in the same loop iteration. The
already-existing `component_polygons: dict[str, list[Polygon]]` *is* the
cached derived form every polygon-consuming generator reads. Introducing a
separate persisted bridged-line cache would duplicate that with no consumer —
the bridge is cheap (one `_find_gaps` pass, the same scan
`find_wall_discontinuities` already does) and runs once per component per
pipeline invocation. Reuse `component_polygons` as the single derived cache;
do not add another.

### 3. Which representation does each generator use?

Door/window entity resolution must be **hoisted** out of the post-loop block
(`pipeline_modular.py:389-402`) to *before* the per-component loop, because the
bridge now needs `openings` inside that loop. Resolution stays a single pass
over `point_features`; each component passes the openings whose position is
near it. `_bridge_door_window_gaps` decides proximity itself
(`OPENING_PROXIMITY_TOL`), so passing a component a few extra far-away openings
is harmless — but resolving per-component (by the same buffer-containment test
`generate_door_access_evidence` already uses) keeps the door↔room mapping
deterministic and avoids a global list bleeding across components.

Representation assignment (the answer to "which lines does each generator
consume?"):

| Generator | Representation | Source | Change? |
|---|---|---|---|
| `generate_component_evidence` (CLOSED_LOOP, PARALLEL_LINES, TOPOLOGY, PAIR_MERGE) | **bridged** | via `compute_component_features(..., shapely_lines=bridged_lines)` | input swapped |
| `polygonize_full` → `component_polygons` | **bridged** | `polygonize_full(bridged_lines)` | input swapped |
| ROOM_RATIO / SYMMETRY / ADJACENCY / CONTAINMENT / DOOR_ACCESS | **bridged** (transitively) | consume `component_polygons` | **none** — automatically pick up bridged polygons |
| `generate_opening_synth_evidence` → `find_wall_discontinuities` | **original gapped** | the original **un-welded** gapped lines, passed straight through to `find_wall_discontinuities` (which filters `≤ CORNER_SNAP_TOL` gaps at `space_geometry.py:3045`, so upstream welding is unnecessary) | **none** — this is the whole point: gaps preserved |
| CLEARANCE | **original** | consumes `line_features` | none |
| LAYER_ROLE / FURNITURE_LAYOUT | n/a (no line geometry) | — | none |

The invariant this table enforces: **OPENING_SYNTH is the only consumer of the
gapped representation; everything that derives "room-ness" takes the bridged
representation.** This is what makes a door simultaneously close a room
(bridged) and register as an opening (gapped) — the dual representation the
geometry layer already maintains.

### 4. The bridge is opening-evidenced, not gap-evidenced

Reuse means reusing the bridge's *semantics* too: a gap is bridged **only if**
a `DoorEntity`/`WindowEntity` explains it. A gapped wall with no nearby opening
block stays open, surfaces as a closed-loop failure downstream, and produces no
spurious CLOSED_LOOP. This preserves the geometry layer's "don't paper over
drafting errors" guarantee inside reasoning — a deliberate non-goal to bridge
*every* gap.

## Consequences

### Positive

- **DOOR_ACCESS activates on realistic data.** A door in a room's exterior wall
  no longer destroys the room polygon: the bridge closes the loop (room
  survives), the gapped lines feed OPENING_SYNTH (opening detected), and the
  opening's midpoint falls inside the now-closed polygon so
  `generate_door_access_evidence` fires. PR #207's interior-gap workaround is no
  longer the only way to exercise the factor.
- **The apartment fixture can stop lying.** `_apartment_fixture.py` currently
  represents each room as an idealized closed rectangle with the door as a
  *dead* point block on the wall (no gap → OPENING_SYNTH finds nothing → the
  door is ignored, which is why the golden pins `door_factor_count==0`). Once
  the fork lands, the fixture can represent doors as real wall gaps + door
  blocks, and the apartment's actual doors become live DOOR_ACCESS evidence —
  making the golden dataset exercise the factor it was meant to.
- **No new algorithm, no new dependency.** The bridge is already shipped,
  tested geometry code. The reasoning package imports two more functions from
  `geometry/space_geometry.py` (which it already imports
  `find_wall_discontinuities` from) — no new module, no new abstraction.
- **Most generators need zero changes.** Five of the polygon-consuming
  generators pick up bridged geometry transitively through `component_polygons`
  with no code edit.

### Negative / Known limitations

- **Re-pins the apartment golden.** Closing loops through doors changes which
  rooms produce CLOSED_LOOP evidence → hypothesis count and confidence shift.
  `test_golden_apartment.py`'s pinned values (`overall_confidence`,
  `graph_variable_count`, `unary_only_accepts`, etc.) MUST be re-derived and
  re-pinned. This is expected and is tracked as roadmap step 4 — it is the
  signal the change worked, not a regression.
- **Bridge quality now bounds room detection.** If `_bridge_door_window_gaps`
  fails to bridge a real door (e.g. the opening block is >200mm from the gap, or
  the gap exceeds 1200mm), the room still breaks. The reasoning pipeline inherits
  the geometry layer's tolerance constants (`OPENING_PROXIMITY_TOL`,
  `DOOR_BRIDGE_TOL`) as its door-detection ceiling — tuning those is a geometry-
  layer change, out of scope here.
- **Welding may merge lines the reasoning layer currently keeps separate.**
  `_weld_endpoints(CORNER_SNAP_TOL)` snaps endpoints within 150mm. The current
  reasoning path builds raw `LineString`s with no welding and relies on
  connected-component partitioning upstream. Introducing welding per component
  is localized (welding happens inside the already-isolated component), but the
  CLOSED_LOOP / PARALLEL_LINES confidence values for components whose endpoints
  sit near (but not on) each other may shift slightly. The golden re-pin (step 4)
  captures this; the per-component scope prevents cross-component welding.
- **`compute_component_features` now sees bridged lines.** Its CLOSED_LOOP
  metric (`polygon_validity_ratio`) will read higher for rooms whose only
  "break" was an explained door. This is the *correct* reading (a room with a
  door is closed), but it means CLOSED_LOOP confidence is no longer a pure
  measure of "were the input lines literally closed" — it becomes "were the
  input lines closed after explained-opening bridging". The diagnostic
  distinction (literal vs. bridged closure) is deferred; if it matters for
  calibration, a future `bridged: bool` flag on the CLOSED_LOOP evidence
  metadata is the additive way to expose it without changing the score.

### Out of scope (explicit)

- SOLID_UNION bridging (`_bridge_door_window_gaps_solid`) — the reasoning
  pipeline uses `polygonize_full`, not `unary_union`; the line-bridging variant
  is sufficient.
- AXIS-001 axis-grid snapping (`snap_to_axis_grid`) and SPACE-001 divider lines
  — orthogonal geometry-pipeline features; not needed for evidence generation.
- A `bridged: bool` flag on CLOSED_LOOP evidence metadata — additive, deferred
  unless calibration needs to distinguish literal vs. bridged closure.
- Re-running the *live* `ReasoningInputAdapter` against a live ZWCAD session —
  no ZWCAD instance this session; the apartment JSON fixture + unit tests cover
  the contract.

## Verification

Implemented in `pipeline_modular.py:_build_evidence_repository` + a new public
`weld_and_bridge_for_polygonization` wrapper in `geometry/space_geometry.py`
(keeps the import clean — no cross-package import of `_`-private bridge/weld
functions; the reasoning package calls one documented public entry point).

- New unit test `test_factor_graph_exterior_door_gap_closes_room_through_bridge`
  (+ its replay-determinism pair): a room whose door gap is in the
  **closure-critical exterior** south wall now produces `opening_count == 1`,
  `door_factor_count == 1`, and an accepted room hypothesis. Pre-fork this
  fixture killed the room (broken polygonize boundary). This is the PR #207
  interior-gap test promoted to the realistic exterior-gap case.
- Reasoning regression: `pytest tests/test_reasoning_*.py tests/golden/reasoning/ -q`
  → **205 passed** (203 prior + 2 new). The existing interior-gap DOOR_ACCESS
  test and all snapshot-replay determinism tests are unchanged.
- Full project suite: **4077 passed, 6 skipped** (skips are unrelated
  optional-dependency/env — collada, psutil, ZWCAD). The fork is non-breaking
  across geometry, MCP-handler, and facade layers.
- **Apartment golden was unchanged by the fork alone** (as originally shipped
  in this PR): the apartment fixture represented each room as an idealized
  closed rectangle with doors as *dead* point blocks on intact walls (no wall
  gaps), so `_find_gaps` found nothing to bridge and the bridged
  representation collapsed to the original — `door_factor_count` stayed 0.
- **Step 4 (follow-up, now landed)**: `_apartment_fixture.py` cuts a real
  900mm gap in each door's wall face (the face splits into two segments
  around the gap) plus the door block at the gap center; windows stay as
  inert points because the geometry bridge ceiling (`DOOR_BRIDGE_TOL` =
  1200mm) cannot close this drawing's 1200–3300mm windows — cutting them
  would break room closure instead of exercising DOOR_ACCESS. Result on the
  re-run golden: `opening_count` 0 → **9**, `door_factor_count` 0 → **2**, the
  same 5 rooms (`R0/R1/R3/R5/R6`) still resolve and accept (no room-acceptance
  regression), and the `OPENING_SYNTH → opening hypothesis → DOOR_ACCESS →
  room acceptance` chain is now exercised end-to-end on real measured data,
  not just the synthetic exterior-gap unit test. `adjacency_factor_count`
  dropped from ≥1 to 0 (the bridged room polygons no longer sit within the
  250mm ADJACENCY tolerance of each other) — a factor-composition shift, not
  a regression, since no previously-accepted room stopped accepting.
  `test_golden_apartment.py` re-pinned accordingly (see
  `tests/golden/reasoning/test_golden_apartment.py`,
  `tests/golden/reasoning/test_apartment_fixture.py`).
- **Step 5 (follow-up, now landed)**: re-ran `scripts/calibrate_reasoning_weights.py`
  against the gap-cut fixture and pinned the result
  (`test_golden_apartment_door_access_weight_now_has_effect`). Prior to step 4,
  `door_access_weight` was untested (`door_factor_count == 0`, so the weight
  changed nothing regardless of value). It now has a real, linear effect on
  `pairwise_energy` (`door_factor_count(2) * door_access_weight`, verified
  across `0.3/0.5/0.7`). `adjacency_weight` remains untested
  (`adjacency_factor_count == 0`, matching step 4's finding).
  `accepted`/`overall_confidence` stay flat across the full grid because every
  hypothesis already accepts from unary evidence alone — this dataset still
  cannot exercise the reject→accept promotion path (only the synthetic
  `test_reasoning_factor_graph_solver.py` fixture does). No solver/script code
  changed for this step — only the fixture (step 4) and the new pinning test.
- `bun scripts/audit.ts` passes.
- Status doc + CHANGELOG updated; commit/push via `/sync` as a standalone PR
  (pipeline-behavior change, not a feature add — ships alone, per the
  Sequential Branch Dependency Rule the follow-up branches off merged main).
- **Step 6 (follow-up, now landed)**: `weld_and_bridge_for_polygonization`
  gained an opt-in `synthesize_missing_walls: bool = False` parameter,
  giving the reasoning pipeline access to the same
  `SYNTHESIZED_OPENING_WALL_SEGMENT` opening-wall synthesis
  `zwcad_generate_spaces`/`_build_space_polygons` already perform (reused
  via `_openings_to_wall_segments`, not reimplemented) — inserting a
  wall-like segment at a door/window's own position/width/rotation when a
  gap has NO real wall data at all (as opposed to steps 3–5's bridging,
  which only closes gaps ≤`DOOR_BRIDGE_TOL` where real wall data already
  exists on both sides). Diagnosed via a live ZWCAD scan of a real
  (non-golden) apartment drawing whose walls are fragmented double-line
  segments: `zwcad_generate_spaces` closed 18 rooms via this synthesis step
  while the reasoning pipeline closed effectively 0, because it never
  reused that logic. `ModularReasoningPipeline.__init__` gained a matching
  `synthesize_missing_walls: bool = False` constructor param (default
  unchanged behavior for every existing caller and the pinned golden
  apartment dataset — verified by `test_synthesize_missing_walls_is_opt_in_and_off_by_default`);
  when enabled, `FactorGraphSolver`'s diagnostics gain a
  `synthesized_wall_segment_count` field. Root-cause note: `_find_gaps`
  (used by `_bridge_door_window_gaps`) does an O(N²) all-pairs endpoint
  scan within `tol`, so calling `weld_and_bridge_for_polygonization` with
  a door/window near an UNRELATED existing gap (not the one it explains)
  can spuriously bridge that unrelated gap too, occasionally breaking
  polygonization — a pre-existing edge case (present in the default,
  non-opt-in path too, not introduced by this step) surfaced while writing
  this step's tests; not fixed here (out of scope — recorded as a known
  limitation, see `tests/test_space_geometry.py`'s
  `TestWeldAndBridgeForPolygonizationOpeningSynthesis` test comments for
  the reproduction). 154/154 `tests/test_space_geometry.py` +
  `tests/test_reasoning_pipeline_modular.py` new/existing tests pass; full
  reasoning + golden suite (`tests/test_reasoning_*.py`,
  `tests/golden/reasoning/`) unchanged at 360/360.

- **Resolution (follow-up, 2026-08-02):** the "pre-existing edge case"
  noted above is now FIXED, not just documented. Root cause refined: the
  spurious bridge is not really "a door near an *unrelated* gap" -- it is
  the all-pairs `_find_gaps` scan emitting a **composite chord** (corner
  to the door's far gap endpoint) whose straight line *passes through* a
  real wall vertex (the corner-to-door stub endpoint). The old proximity
  check (`gap_segment.distance(opening_point) <= OPENING_PROXIMITY_TOL`)
  passed for that chord too because the door lies on it, so the chord was
  bridged and the overlapping wall segment broke polygonization.
  Resolution: a new `_gap_is_atomic(p1, p2, endpoints, tol)` helper
  rejects any candidate gap whose span contains another wall vertex
  strictly interior to it (projection strictly inside, clear of both
  endpoints by more than `CORNER_SNAP_TOL`). Applied uniformly to all
  three representations that share the `_find_gaps` scan --
  `_bridge_door_window_gaps` (LineString bridges), the solid-strip
  variant `_bridge_door_window_gaps_solid`, and `find_wall_discontinuities`
  (OpeningCandidate detection) -- so none of them bridges/classifies a
  composite chord. The `_find_gaps` endpoint-dedup was extracted into
  `_unique_endpoints(lines)` so all three callers plus the new helper
  share one canonical endpoint set. Verified by three new regression
  tests (`test_no_spurious_bridge_when_door_near_corner`,
  `test_door_near_corner_does_not_break_polygonization`,
  `test_no_phantom_candidate_for_composite_corner_chord`); the existing
  apartment golden pins (`opening_count==9`, 5 accepted rooms,
  `pairwise_energy` sweep) are unchanged because mid-face doors never
  contain an interior vertex in their gaps. 151/151
  `tests/test_space_geometry.py` + 212/212 reasoning+golden pass.
