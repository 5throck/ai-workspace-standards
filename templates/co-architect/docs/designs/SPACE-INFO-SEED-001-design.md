---
lang: ko
lang_reason: proper-noun
---

# SPACE-INFO-SEED-001 — Non-label space-info position-hint seeding

## Status

Implemented.

## Context

`32평형아파트.dwg` has a curated `memory/drawings/32평형아파트.space-info.json`
file with `room_info[].position_hint` points, but no corresponding
`32평형아파트.rooms.json`.  CAD-only polygonization can still fail to close
usable apartment room polygons, and the caller explicitly disallowed room-label
text extraction.

## Decision

Add an opt-in `seed_from_space_info` path to `zwcad_generate_spaces`.

When enabled, the handler:

1. Loads `{file}.space-info.json` or an explicit `space_info_path`.
2. Uses only `room_info[].position_hint` points and room names from that file.
3. Casts west/east/south/north rays from each position hint to nearby
   axis-aligned CAD wall segments.
4. Allows bounded bridged-gap ray evidence so a ray can still find an enclosing
   wall when the nearest side is split by a door/opening gap.
5. Builds a provisional search window from the four ray hits, then snaps/scores
   the candidate edges against CAD wall evidence.
6. Synthesizes door/window opening spans as wall-like boundary evidence so
   missing wall gaps at detected openings can preserve room-boundary
   continuity.  Opening boundaries are conservative: they are snapped to a
   horizontal/vertical wall axis, diagonal annotation/detail strokes are ignored,
   window mullion/end-cap strokes are suppressed, arc-derived door diameters are reduced
   to the usable leaf radius and swing doors are anchored from hinge to leaf endpoint, and spans are never expanded to a larger
   flanking-wall gap.  Extracted wall segments are still
   preferred over synthesized opening boundaries for ray hits, so an interior
   opening does not prematurely stop a ray when a real enclosing wall exists
   farther out.
7. Treats that window as non-authoritative: internal wall lines are used to
   split/carve the window and the free-space component containing the seed is
   returned.  This permits non-rectangular (for example ㄱ/L-shaped) spaces and
   prevents a returned polygon from crossing a wall.
8. Returns `needs_confirmation` if any hint is invalid, ray hits are
   incomplete, the inferred rectangle is degenerate, or wall support is below
   the configured threshold.
9. Allows callers to exclude semantic categories or name keywords so exterior
   or non-room entries in `space-info.json` (for example balconies or planting
   areas) do not become interior room spaces.
10. Enforces non-overlap by default: small overlaps are clipped only when the
   seed remains in a valid component, while unsafe candidates are deferred from
   the emitted `spaces` list and reported for review.  Optional midpoint
   clipping remains available, but is opt-in because it can create artificial
   boundaries through wall/core zones in dense apartment plans.
11. Optionally reports common-core review candidates from unlabeled `COR`
    linework (`space_info_detect_core_candidates=true`): repeated parallel
    tread groups, the center landing, and upper run are merged as a stair
    candidate, while a compact wall-bounded shaft beside the stair core is
    reported as an elevator candidate.  These are returned separately from
    accepted room spaces because the drawing has no typed stair/elevator
    objects or labels.
12. In balcony-inclusive runs, skips exterior-window band subtraction and
    ignores sliding-window detail spikes so a valid room/balcony shared window
    boundary does not become an artificial empty gap.

Seeded spaces use `SpaceSource.SPACE_INFO` (`source="space_info"`) so downstream
consumers can distinguish them from exact CAD polygonization and other fallback
sources.

## Non-goals

- Do not read or infer room-name text labels from CAD entities.
- Do not change the default CAD-only polygonization path.
- Do not treat position hints as authoritative boundaries; CAD wall evidence is
  still scored and reported.
- Do not infer a semantic divider where no CAD wall/opening evidence exists;
  such candidates are reported as review-required/deferred instead of emitted
  as overlapping final spaces.
- Do not solve rotated/non-orthogonal rooms in this phase.

## Interfaces

`zwcad_generate_spaces` accepts:

- `seed_from_space_info: boolean`
- `space_info_path: string`
- `space_info_ray_cross_tol_mm: number`
- `space_info_ray_gap_bridge_tol_mm: number`
- `space_info_ray_max_distance_mm: number`
- `space_info_snap_tol_mm: number`
- `space_info_min_wall_support: number`
- `space_info_min_room_width_mm: number`
- `space_info_min_room_height_mm: number`
- `space_info_exclude_categories: string[]`
- `space_info_exclude_name_keywords: string[]`
- `space_info_resolve_overlaps: boolean`
- `space_info_split_internal_walls: boolean`
- `space_info_carve_wall_obstacles: boolean`
- `space_info_enforce_non_overlapping: boolean`
- `space_info_use_opening_boundaries: boolean`
- `space_info_opening_axis_search_tol_mm: number`
- `space_info_detect_core_candidates: boolean`
- `space_info_auto_mirror_seeds: boolean`
- `space_info_mirror_axis_x: number`
- `space_info_mirror_suffix: string`

The response includes:

- `spaces`: standard `SpacePolygon` dictionaries with `source="space_info"`
- `space_info_seed_reports`: per-room audit reports with position hint, ray
  hits, seed/snapped bbox, edge coverage, wall-carve/non-overlap actions, and
  confirmation state
- `space_info_core_candidates`: optional stair/elevator candidates with bbox,
  polygon, confidence, and COR evidence handles
- `space_info_seed_reports[].mirror_seed_report`: audit metadata when the
  caller enables automatic symmetric seed mirroring
- `exceptions`: structured warnings/blockers for missing sidecars, invalid
  hints, incomplete ray hits, degenerate rectangles, or low wall support

## Validation

COM-free regression tests cover:

- accepted seeded rooms from a full four-wall rectangle
- `needs_confirmation` behavior when a ray side is missing
- multiple hints with stable `SpaceInfoSeed-*` IDs and room-name categories
- category filtering for indoor-only space results
- non-rectangular wall-carved output when an internal partition intrudes into a
  provisional seed window
- default non-overlap enforcement that defers unsafe overlapping hints
- window/door opening boundary evidence that repairs a missing ray side when
  the extracted wall is interrupted by an opening
- full sliding-window symbol-band cleanup so final polygons do not cross drawn
  window bars
- COR-layer stair/elevator candidate detection
- balcony/planter expansion through non-structural elevation/rail bands toward
  the shared room-facing sliding-window boundary
- arc-swing door anchoring that prefers paired same-axis host-wall evidence so
  a door is not rotated onto a nearby perpendicular partition

Manual validation using the saved 32평 fixture extraction output plus
`32평형아파트.space-info.json` produced 10 emitted indoor candidates after excluding
balcony/void/hall-stair entries and applying 65 synthesized door/window opening
boundary segments after filtering 34 window detail artifacts and correcting 12
swing-door arc diameters.  `반침` and `드레스실` are emitted by prioritizing small accessory rooms before broader parent-room seeds; the broader `침실3`/`침실1` candidates are clipped where needed to preserve non-overlap.  The emitted polygons were checked to have no pairwise overlap
and no detected internal wall crossing.

Balcony-inclusive validation against the same fixture now emits 15 accepted/
reviewable spaces, including `화단`.  The `화단` seed initially stopped at an
`ELE` rail/elevation band, leaving the area above it unclaimed; the seed is now
expanded to the adjacent horizontal sliding-window boundary.  The common-core
candidate detector reports the merged stair block plus the left-side COR
X-braced elevator shaft and suppresses the previous right-side false shaft.
Room-2 door evidence BEE1 is synthesized as a horizontal host-wall opening
boundary rather than a 90-degree-rotated vertical segment.

Symmetry validation for the 32평 fixture can enable
`space_info_auto_mirror_seeds=true` with an explicit axis at
`x=26513.612493149383`.  This mirrors the curated left/center position hints to
the matching right-side unit without using room labels, while
`space_info_exclude_name_keywords=["홀"]` prevents duplicated hall/core seeds.
The latest saved review run emits 30 room/balcony candidates plus two separate
core candidates (merged stair and left-side elevator).  The living-room seeds
are intentionally processed after smaller/accessory rooms, so their broad
initial windows overlap already accepted neighboring rooms before being carved
back.  When the clipped component still contains the living-room seed, remains
above the minimum room area, and stays within the safe overlap fraction, this is
recorded as `parent_space_clipped_to_neighbors` instead of an exception.

For visual review, use
`scripts/co-architect/cad/diagnostics/render_space_seed_svg.py` with a saved
`zwcad_generate_spaces` result and the matching `zwcad_extract_cad_objects` JSON.
The renderer draws detected space polygons below the original raw `DOOR` and
`WID` line/polyline/arc entities, escapes XML text such as `주방&식당`, overlays
common-core candidates, and prints overlap/wall-intrusion diagnostics for the
rendered result.
