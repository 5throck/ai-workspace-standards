# ADR-019 Deprecate Geometry-First Room Detection

> **Status**: Accepted — steps 1, 2, 3a and 3b (option C) done; deletion gated on the exit criterion (review by 2026-12-31)
> **Date**: 2026-09-25
> **Deciders**: Co-Architect PM, user
> **Related**: ADR-018 (vision-first space recognition)

---

## Context

`handle_generate_spaces` has two families of room detection:

1. **Geometry-first.** Rooms are closed regions found from wall linework alone. This is every `WallProcessingMode` (`LEGACY`, `ENDPOINT_CLUSTER`, `SOLID_UNION`, `LABEL_VORONOI`, `LABEL_ANCHORED_HYBRID`) on the path that runs without a seed.
2. **Seeded.** Rooms come from a reviewed or proposed source and are snapped to CAD evidence. This covers `seed_from_proposal` (ADR-018), `seed_from_rooms_json` and `seed_from_space_info`.

Results against the user-reviewed ground truths:

| Drawing | Geometry-first | Vision-first (ADR-018) |
|---|---|---|
| Reference apartment plan (9 rooms) | 1/9 | 4/9 from a screenshot alone; 9/9 after review |
| 32-pyeong apartment (16 spaces) | 0 | 14/16 |
| Third drawing, run blind (14 spaces) | not run | 12/14 |

Geometry-first detection plateaus at 4–5 rooms whatever the welding or opening strategy (see the memory note "geometry plateaus at 5 rooms"). The causes are semantic, and linework cannot resolve them:
- Expanded balconies have no inner wall.
- Door arcs sit on furniture layers.
- Party walls are open.
- Non-room zones are enclosed like rooms.

## Decision

Deprecate geometry-first room detection. Keep the geometry **primitives**, because the vision-first path depends on them for evidence and validation:
- wall layer classification and wall centerlines;
- grid and centerline snapping (`proposal_snap`);
- opening recognition (`recognize_openings`);
- mirror checks and coverage checks (`unassigned_door_targets`, `enclosed_gaps`);
- inner-face measurement for elevation metadata (`room_metadata`).

### Step 1 — deprecation (done 2026-09-25)

- `handle_generate_spaces` emits a `DeprecationWarning` and a log warning when it runs the unseeded geometry-first path.
- `WallProcessingMode` is documented as deprecated.
- Callers are inventoried:
  - Scripts: `generate_floorplan_svg.py`, `verify_opening_synthesis_v2.py`, `verify_v3_pipeline.py`.
  - About 9 test modules.

### Step 2 — remove the experimental room builders (done 2026-09-25)

Removed from the code:
- The `SOLID_UNION`, `LABEL_VORONOI` and `LABEL_ANCHORED_HYBRID` modes and their builders (`_build_space_polygons_solid_union`, `_build_space_polygons_label_voronoi`, `_build_space_polygons_label_anchored_hybrid`), plus the helpers used only by them (`_bridge_door_window_gaps_solid`, `_nest_columns_into_rooms`, `_mirror_room_labels`, the `room-labels.json` sidecar loader, and `SpaceSource.LABEL_VORONOI`).
- The handler branches and their tests. The two `*.room-labels.json` sidecars.

Asking for a removed mode now raises `ValueError`. Wall solids (`_line_to_solid`, `_lines_to_solids_with_thickness`) stay because `room_validation` uses them.

### Step 3a — reviewed spaces for every consumer (done 2026-09-25)

Six handlers fall back to `handle_generate_spaces` when they are given no spaces: `assign_openings`, `map_space_info`, `generate_wall_model`, `discover_boundary_evidence`, `validate_boundary_candidates` and `reconstruct_boundary_polygons`. The diagnostics scripts do the same. All of them go through the unseeded path. That path now seeds from `memory/drawings/{drawing}.ground-truth.json` whenever the file exists, snapping it to wall centerlines through the ADR-018 proposal path. The new `seed_from_ground_truth` parameter requests this explicitly; if the file is missing, it returns the blocking `GROUND_TRUTH_MISSING`.

Geometry-first detection now runs only for a drawing with no ground truth and no seed, and it still warns.

### Step 3b — option C: demote to a candidate generator (decided 2026-09-25)

A structured review (`memory/meeting-2026-09-25-adr019-step3b.md`) weighed three options: A (delete now), B (keep with a warning) and C (demote). The user chose **C**. `_build_space_polygons` is not deleted; its role changes:
1. **Candidates only.** The no-ground-truth, no-seed path returns `needs_confirmation`. Every space carries `confidence_state: "candidate"` and the report `GEOMETRY_CANDIDATES_UNREVIEWED`.
2. **No silent use as fact.** `map_space_info` and `generate_wall_model` return the blocking `SPACES_UNREVIEWED`, with the candidates attached, unless the caller passes `accept_candidate_spaces=true`. `assign_openings` does not label openings with candidate names. The three BOUNDARY-001 repair tools (`discover_boundary_evidence`, `validate_boundary_candidates`, `reconstruct_boundary_polygons`) still take candidates, because reviewing and repairing geometry candidates is their purpose.
3. **Starting proposal.** `cad-space-recognition` may show candidates as a rough first draft for drawings with no image review yet. They never replace the review.
4. **Exit criterion.** Delete the builder, together with `divider_lines`, the axis-grid snapping inside it and its direct tests, once vision-first reaches ≥ 80 % room match on ≥ 5 reviewed drawings. **Review by 2026-12-31 at the latest.**
   - Open point from the meeting: must one of the 5 drawings be a non-apartment plan? The analyst says yes; the architect says the scope is residential only. The user has not decided yet.

## Consequences

- Positive: a single room-detection path, less code to maintain, and results that match reviewed ground truth.
- Negative: detection now needs a proposal, either from an image or a reviewed seed. A fully unattended run with no image is no longer supported.
- Callers of the default path get reviewed spaces when a ground truth exists. Otherwise they get candidates that must be reviewed, or explicitly accepted, before tools that treat spaces as fact will use them.
