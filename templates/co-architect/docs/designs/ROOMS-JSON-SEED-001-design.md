# ROOMS-JSON-SEED-001 — Non-label rooms.json space seeding

## Status

Implemented.

## Context

The active apartment reference drawing can contain enough CAD geometry to
extract wall, door, and window candidates, while still failing to close real
room polygons through CAD-only polygonization. In that failure mode the
geometry pipeline emits only small void/core pockets, and room-label seeding is
not always allowed by the caller.

The project already supports a `{file}.rooms.json` sidecar containing room
coordinate seeds and expected openings. That file can be used as a non-label
fallback, but only if the result remains auditable and clearly distinguished
from exact CAD-derived geometry.

## Decision

Add an opt-in `seed_from_rooms_json` path to `zwcad_generate_spaces`.

When enabled, the handler:

1. Loads `{file}.rooms.json` or an explicit `rooms_json_path`.
2. Converts each room record into an axis-aligned rectangular seed from
   `x_min`, `y_min`, `x_segments`/`x_size`, and `y_segments`/`y_size`.
3. Snaps each seed edge to nearby parallel CAD wall evidence within a bounded
   tolerance.
4. Computes per-edge wall coverage and stores the average as the
   `confidence_score`.
5. Matches expected rooms.json openings to extracted CAD door/window entities by
   declared face and distance tolerance.
6. Returns `needs_confirmation` when any room falls below the configured wall
   support threshold.

Seeded spaces use a new `SpaceSource.ROOMS_JSON` value so downstream consumers
can distinguish them from `geometry`, `reconstructed`, and `label_voronoi`
spaces.

## Non-goals

- Do not use room-name text label extraction in this path.
- Do not change default CAD polygonization behavior.
- Do not treat rooms.json seeds as authoritative geometry without CAD support
  scoring.
- Do not solve arbitrary rotated room geometry in this phase; rooms.json seed
  boxes remain axis-aligned.

## Interfaces

`zwcad_generate_spaces` accepts:

- `seed_from_rooms_json: boolean`
- `rooms_json_path: string`
- `rooms_json_snap_tol_mm: number`
- `rooms_json_min_wall_support: number`
- `rooms_json_opening_tol_mm: number`

The response includes:

- `spaces`: standard `SpacePolygon` dictionaries with `source="rooms_json"`
- `rooms_json_seed_reports`: per-room audit reports with seed bbox, snapped
  bbox, edge coverage, opening matches, and confirmation state
- `exceptions`: structured warning/info reports for low wall support or
  unmatched expected openings

## Validation

COM-free regression tests cover:

- accepted seeded rooms with full wall support
- snapping seed edges to nearby CAD wall evidence
- `needs_confirmation` behavior for low wall support

Manual validation against the active apartment floor plan produced eight
rooms.json-seeded room candidates without invoking room-label extraction.

## Addendum 2026-09-25 — walls.json interior-view ordering

The derived sidecar contracts changed with the ground-truth-derived metadata
pipeline (`room_metadata.derive()`):

- `walls.json` follows the interior (unfolded-elevation) view: walls are
  ordered **N → E → S → W**, and each wall's openings are read from the same
  unfolded faces as the elevation SVG (via the facts-graph `placements()`
  query, ADR-020 step 2). North and south are no longer mirrored, which fixes
  a mirrored door landing on the wrong wall. `generate_wall_elevations`
  default order is now N → E → S → W.
- Sunken-floor door levels (rule R24) apply in both `rooms.json` and
  `walls.json`: the threshold covers the level drop (neighbour F.L − room
  F.L) and the head stays ≤ C.H − 200. Elevation SVGs draw F.L and the
  threshold.
- `rooms.json` / `walls.json` / `space-info.json` are regenerated from the
  reviewed ground truths by `derive_room_metadata.py`; the legacy hand-built
  sidecars were removed (stale-sidecar cleanup, 2026-09-25).

