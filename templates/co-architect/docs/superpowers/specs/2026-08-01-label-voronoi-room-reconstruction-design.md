---
lang: ko
lang_reason: proper-noun
---

# Label-Anchored Voronoi Room Reconstruction (v1) — Design Spec

## Context

Every geometry-based room-detection approach plateaus at 4-5 rooms on the reference drawing `아파트 평면도` (target 9 — see `memory/apartment-floorplan-9-rooms-ground-truth.md` and `memory/geometry-plateaus-at-5-rooms.md`). Root cause verified 2026-08-01: the wall data is over-fragmented (456 segments, median 450mm) AND polluted with non-apartment context walls (wall bbox 780 m² vs ~120 m² apartment), so no layer subset or welding/bridging variant forms polygons matching the room-name labels — 543 raw polygon fragments, **zero** containing any room label.

The user's confirmed strategy (this session): use the room-name **text labels as the backbone** (they are the ground truth — 8-9 rooms), with a two-case structure — enclosed rooms validated by door presence (future), open rooms (LIVING/DINING) covered by labels. The user explicitly approved label usage as "a very useful strategy" and chose **Voronoi approximation for v1** (correct room count now; boundary refinement deferred to a later PR).

A local prototype validated the core: Voronoi partition of the 9 room-label seeds (clipped to the labels' convex hull) yields exactly 9 cells, each containing its label, each room-scale. Boundaries over-estimate ~2.5x (no tight apartment outline yet) — acceptable for v1.

## Goal

Add a new label-anchored room-detection path (`LABEL_VORONOI` mode) that produces **one room polygon per room-name text label** via a Voronoi partition, giving the correct room count (9) with straight-line-approximated boundaries. This is the first path to reach the target room count on this drawing.

## Non-Goals (v1)

- No boundary refinement (wall-snapping, true apartment-outline extraction). Voronoi straight-line cells only — deferred to a follow-up PR.
- No geometric enclosure detection / "closed room" path. The door-presence **validation gate** ("an enclosed room must contain a door") is for the future enclosed-room path; in v1, door presence is recorded only as informational metadata, not a gate.
- No change to ENDPOINT_CLUSTER / SOLID_UNION / LEGACY modes.
- No auto-discovery of which labels are room names — that is sidecar-driven (drawing-specific data).

## Algorithm

### Step 1 — Identify room-name labels (sidecar-driven)
Read room-name text labels via the existing `zwcad_extract_text_labels`. The text layer(s) come from the sidecar (the handler **requires** `search_layers` and has no default), so the sidecar schema carries them. Filter to room names using a new sidecar `{stem}.room-labels.json`:
```json
{
  "text_layers": ["7TXT", "4TXT"],
  "room_name_includes": ["LIVING ROOM", "DINING ROOM", "MAIN ROOM", "ROOM #1", "ROOM #2", "욕실", "파우더 & 드레스룸", "ENTRANCE"],
  "room_name_excludes": ["WET ZONE"]
}
```
Matching is case-insensitive, whitespace-normalized substring/exact against the label's `text`. A label qualifies if its text matches an `includes` entry (or, when `includes` is absent, matches no `excludes` entry). Multiple instances of the same name (e.g. two `욕실`) each become a separate seed (keyed by position, not text). When no sidecar exists, the mode raises a clear `LABEL_VORONOI_NO_SIDECAR` blocking exception (it cannot guess which labels are rooms or which layer they live on — see PR #188's lesson: don't infer drawing-specific facts).

### Step 2 — Build the clip region (v1: label convex hull)
Compute the convex hull of the seed positions, buffered by `LABEL_VORONOI_HULL_MARGIN_MM` (2000.0). This is the v1 apartment-region proxy. (A true apartment outline from wall data is deferred — the wall data is context-polluted; deriving it is the follow-up PR's scope.)

### Step 3 — Voronoi partition
`shapely.voronoi_polygons(MultiPoint(seeds), extend_to=clip_region.buffer(LABEL_VORONOI_HULL_MARGIN_MM))`, then intersect each resulting polygon with the clip region. Discard cells with area below `MIN_SPACE_AREA_MM2`. Assign each remaining cell to the seed it contains (point-in-polygon). If a seed has no containing cell (degenerate Voronoi edge case), raise `LABEL_VORONOI_SEED_UNASSIGNED` warning and skip it.

### Step 4 — Emit rooms
Each cell becomes a `SpacePolygon` with:
- `polygon_points` from the cell's exterior coords.
- `source = SpaceSource.LABEL_VORONOI` — a **new member of the existing `SpacePolygon.source: SpaceSource` enum** (`GEOMETRY`, `RECONSTRUCTED` today). This reuses the existing field; `confidence_state` is NOT used (it lives only on `BoundaryCandidate`, not `SpacePolygon`).
- `room_name` = the room-name text (reuses the existing `SpacePolygon.room_name: str | None` field — no model change).
- `has_door` (boolean, informational) — whether any extracted `DoorEntity.position` falls inside the cell. **Not** a gate in v1. Carried **only** in the `LABEL_VORONOI_ROOM` exception's `context` (`SpacePolygon` has no metadata/extension field).

Each room also emits `ExceptionReport(code="LABEL_VORONOI_ROOM", severity="info", context={"room_name": <text>, "has_door": <bool>, "area_mm2": <float>})` so label-derived rooms are distinguishable from geometry-derived ones downstream.

## Integration

New `WallProcessingMode.LABEL_VORONOI`. `handle_generate_spaces` dispatches to a new builder `_build_space_polygons_label_voronoi(room_labels, doors, clip_hint=None)` when `wall_processing_mode="label_voronoi"`. Because this mode needs text labels (not just walls/openings), `handle_generate_spaces` fetches labels internally via the **live-COM path** `handle_extract_text_labels` uses (filtered by the sidecar) — so, unlike the COM-free `_build_space_polygons`, the label-fetch is COM-bound (requires pywin32 + a live doc). The builder `_build_space_polygons_label_voronoi` itself stays COM-free and unit-testable directly with synthetic seeds. Walls are NOT required input for this mode (doors are used only for the `has_door` tag). Mirroring the SOLID_UNION branch's `SOLID_UNION_UNSUPPORTED_PARAM` guard, the LABEL_VORONOI dispatch branch raises `LABEL_VORONOI_UNSUPPORTED_PARAM` if caller-supplied `axis_grid`/`divider_lines` are non-null (meaningless for label partitioning).

## Constants (new)

- `LABEL_VORONOI_HULL_MARGIN_MM = 2000.0`

## Testing

Unit tests for `_build_space_polygons_label_voronoi`:
1. 3 seeds in a triangle → 3 cells, each containing its seed, count == seeds.
2. Two seeds with the same label text at different positions → 2 distinct rooms.
3. Clip region: a seed near the hull edge still gets a bounded cell (not an infinite Voronoi ray).
4. `has_door`: a cell containing a door position → True; without → False.
5. Empty seeds → returns no rooms, no crash.
6. Sidecar exclude: a label matching `room_name_excludes` (e.g. "WET ZONE") is not seeded.

Integration: `handle_generate_spaces` with `wall_processing_mode="label_voronoi"` and the reference drawing's sidecar → 9 rooms, each label assigned, all `source=SpaceSource.LABEL_VORONOI`. This path is COM-bound (the label-fetch needs pywin32 + a live doc), so it is covered by the **manual verification** checklist below, not an automated unit test.

Manual verification (post-merge, MCP restart): re-run on the reference drawing; confirm **9 rooms** (the target) — the first path to reach it. Record the `LABEL_VORONOI_ROOM` count and the `has_door` distribution. Report honestly.

## Known limitations (v1)

- Boundaries are Voronoi straight-line approximations, over-estimated ~2.5x (no tight outline). Cells extend beyond real walls. Acceptable for count/anchor purposes; refinement is the follow-up PR.
- The clip region (convex hull of labels) is a rough proxy; for strongly non-convex apartments (e.g. L-shaped), the hull over-covers and cells bleed outside the unit. Accepted for v1.
- Room-name identification is drawing-specific (sidecar). Generalization to other drawings requires their own sidecar.
