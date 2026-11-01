---
lang: ko
lang_reason: proper-noun
---

# VISION-FIRST-001 — Vision-First Space Recognition PoC

> Decision record: [ADR-018](../adr/ADR-018-vision-first-space-recognition.md) (Proposed)
> Status: implemented (PoC tooling) — 2026-09-25

## Goal

Measure room detection against user-reviewed ground truth. Then test whether "image proposes, CAD disposes" beats geometry-first detection.

## Components

| Step | Module / script | Responsibility |
|------|-----------------|----------------|
| ① image | `scripts/co-architect/cad/diagnostics/extract_plan_evidence.py`, `render_evidence_png_svg.py` | Dump DWG lines, arcs, texts and dims from the active ZWCAD drawing. Render an SVG with an exact px↔mm transform (`*.transform.json`). |
| ② proposal | vision model (external) + `docs/reports/room-scoring/reading-rules.json` | Room labels, rough polygons, and room/non-room class as JSON in image pixels. Rules marked `needs_confirmation` become human-review items. |
| ③–④ reconcile | `src/cad_intelligence/geometry/proposal_snap.py` | `register` (bbox anchors → mm). `axis_lines_from_segments` (wall face pairs → centerlines). `snap_polygon` (grid first, then walls; each distinct coordinate is snapped once so edges stay rectilinear). |
| guard | `src/cad_intelligence/geometry/room_validation.py` | Wall-mass clipping and seed-leak detection for any detector's output. |
| ⑤ score | `src/cad_intelligence/geometry/room_scoring.py`, `score_rooms.py` | One-to-one greedy IoU matching. Pass = IoU ≥ 0.5, centroid ≤ 400 mm, and area ratio in [0.8, 1.15]. Also reports merged rooms, non-room hits, and extra detections. |
| review | `render_ground_truth_overlay.py` | Overlay the ground truth (rooms, non-rooms, doors, windows) on the rendered plan for user review. |

## Data contracts

- Ground truth: `memory/drawings/<drawing>.ground-truth.json` holds `rooms[]`/`non_rooms[]` (`polygon` in absolute DWG mm), `doors[]`, `windows[]`, `pitfalls[]`, and `_meta.tolerance`.
- Detections: `SpacePolygon.to_dict()`-shaped. Only `polygon_points` is required.

## Acceptance criteria

These are the ADR-018 PoC criteria:

1. At least 8/9 rooms pass on 아파트 평면도.
2. Steps ③–⑤ are deterministic.
3. On a second drawing, the room set matches the known labels.

## Production integration (2026-09-25)

- `zwcad_generate_spaces(seed_from_proposal=true, proposal|proposal_path, grid_lines?, mirror_axis_x?, clip_to_walls?)` returns `spaces` plus `reports` (unsnapped edges, rooms crossing walls).
- `zwcad_generate_spaces(postcheck_walls=true)` adds a `postcheck` list to any mode. It does not change polygons.
- `zwcad_recognize_openings(spaces?, window_layers?, door_layers?, bbox?)` returns `wall_layers`, `doors`, `windows`, `other_glazing`, `mirror_axis`, and `needs_confirmation`.
- COM-free core: `geometry/plan_evidence.py` (evidence → openings, wall layers, mirror axis; `evidence_from_entries` bridges live scans) and `geometry/proposal_spaces.py`.
- Harness: `tests/test_space_recognition_harness.py` pins the floors.

## Round 3 additions (2026-09-25)

- `cad_io/plan_evidence_com.extract_evidence(doc)`: block-aware evidence, shared by the diagnostics script and `zwcad_recognize_openings`.
- `plan_evidence.detect_frame_doors`, `unassigned_door_targets`, `enclosed_gaps`. The MCP tool returns the last two; `seed_from_proposal` reports `PROPOSAL_ENCLOSED_GAP`.

## Out of scope

- Wiring a vision model into the MCP server (the proposal is still produced outside it).
