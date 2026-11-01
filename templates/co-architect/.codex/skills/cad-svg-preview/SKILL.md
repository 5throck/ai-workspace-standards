---
name: cad-svg-preview
description: "Previews floor plans and room elevations as SVG before anything is drawn in ZWCAD: renders the plan straight from DWG entities, overlays rooms/doors/windows from a ground truth or proposal, derives room metadata (rooms.json / walls.json / space-info.json) from the reviewed ground truth, and draws interior elevations of one room or every room at once (living room, kitchen, bedrooms, dress room ...). Supports Korean-speaking users. Use when: the user wants to see a plan or an elevation as SVG first, check an elevation before drawing it, regenerate elevation metadata, or draw all room elevations together."
version: 1.1.0
scope: co-architect
status: active
last_reviewed: "2026-09-25"
gemini-parity: sync
owner: zwcad-drafter
lang: ko
lang_reason: proper-noun
metadata: 
  type: process
  triggers:
    - svg preview
    - floor plan svg
    - elevation svg
    - preview elevation
    - all room elevations
    - 평면도 SVG
    - 입면도 SVG
    - 입면도 미리보기
    - 전개도
    - 입면도 한번에
  relates_to:
    - cad-space-recognition
    - generate-room-elevation
prerequisites: none
---

# CAD SVG Preview (Plan + Elevations)

## Context

Preview-before-draw is the review gate of the CAD workflow: this skill renders plans and 4-direction room elevations as SVG directly from DWG entities and ground-truth data, so the user validates geometry before anything is committed in ZWCAD.

## Execution Steps

1. Render the floor plan from DWG entities, overlaying rooms/doors/windows from the ground truth or the current proposal.
2. Derive room metadata (`rooms.json` / `walls.json` / `space-info.json`) from the reviewed ground truth when elevations are requested.
3. Draw interior elevations for one room or all rooms at once (living room, kitchen, bedrooms, dress room, ...) per `## Steps`.

## Output Format

SVG previews (plan overlay and per-wall elevation sheets) plus the derived metadata JSON files (`rooms.json`, `walls.json`, `space-info.json`) written next to the working drawing.

## Related Skills

- `cad-space-recognition` — produces the ground truth this skill overlays.
- `generate-room-elevation` — the ZWCAD drawing counterpart for accepted elevations.
- `zwcad-ai-drawing` — MCP drawing path in the live session.

---

## Overview

Draw nothing in ZWCAD until the user has seen it. This skill renders plans and interior elevations as SVG straight from DWG evidence and the user-reviewed ground truth. The user checks the SVG, and only then does `generate-room-elevation` draw into the DWG.

The elevation metadata (`memory/drawings/<drawing>.rooms.json`, `.walls.json`, `.space-info.json`) is **derived from the ground truth** and never hand-edited. The old hand-built sidecars were wrong: for 아파트 평면도, rooms were misplaced and C.H was 2,800 instead of the tagged 2,300.

## When to Use This Skill

- "Show me the plan / elevation as SVG first" (Korean: 평면도·입면도를 SVG로 먼저 보여줘).
- Check an elevation before drawing it in ZWCAD.
- Draw every room's elevation at once (Korean: 거실·주방·방·드레스룸 입면을 한번에).
- Regenerate `rooms.json` / `walls.json` / `space-info.json` after the ground truth changes.

Space recognition and review belong to `cad-space-recognition`. Drawing into the DWG belongs to `generate-room-elevation`.

## Language Handling

Reply in the user's language. Present review items in Korean for Korean users, following `skills/cad-space-recognition/references/GUIDE-ko.md`. Keep file contents in English. Keep room labels verbatim.

## Steps

Scripts live in `scripts/co-architect/cad/{diagnostics,pipeline}/`. Run them with `uv run python`.

### A. Plan SVG

1. Extract the evidence: `diagnostics/extract_plan_evidence.py OUT/evidence.json --doc "<name>.dwg"`. Blocks are exploded.
2. Render the plan: `diagnostics/render_evidence_png_svg.py OUT/evidence.json OUT/plan.svg --bbox X0 Y0 X1 Y1`.
3. Overlay rooms, non-rooms, doors and windows: `diagnostics/render_ground_truth_overlay.py <ground-truth.json> OUT/plan.svg OUT/overlay.svg`.

### B. Elevation metadata (derived, never hand-edited)

4. Regenerate: `pipeline/derive_room_metadata.py [<drawing> ...]`. This writes `rooms.json`, `walls.json` and `space-info.json` from `memory/drawings/<drawing>.ground-truth.json` plus the evidence fixture:
   - Faces are measured on the inner wall faces found in the evidence.
   - C.H and F.L come from the ground-truth tags; otherwise `architectural-standards.json` defaults apply, recorded as `ch_source`.
   - Door head and window sill/head come from `architectural-standards.json` unless the ground truth gives them.
   - Doors are assigned only to the rooms named in their `from`/`to`.
5. Non-rectangular rooms (an L-shaped 거실) get `faces` but no 4-face `walls.json` entry. The ZWCAD pipeline logs and skips them.

### C. Elevation SVG

6. One room: `diagnostics/render_room_elevation_svg.py SPEC.json OUT.svg`.
7. **Every room at once:** `diagnostics/render_room_elevation_svg.py --rooms memory/drawings/<drawing>.rooms.json OUT_DIR [--only NAME ...]`. This writes one SVG per room plus `all-rooms.svg`.
8. Show the SVG in the browser pane and state every assumed value, such as a window sill that is not drawn in the source.

## Conventions

- **Elevation SVG:** interior view, unfolded clockwise from the north wall. A rectangle reads N → E → S → W; an L-shape reads N1 → E1 → N2 → …. Offsets run left → right as seen from inside.
- **`walls.json`:** the same interior view. Walls are stored and drawn N → E → S → W, and `position` runs left → right as seen from inside: NORTH left=west, EAST left=north, SOUTH left=east, WEST left=south (`rematch_openings._face_position`). Until 2026-09-25, NORTH and SOUTH were stored mirrored; the user approved the change.

## Sunken floors (욕실, 현관, 베란다, WET ZONE)

These spaces sit lower than the rooms next to them (for example, 욕실 F.L −40). Bathroom thresholds in Korean design drawings are typically 50–60 mm (대한경제, 2014). Reading rule R24 applies:
- Door threshold = max(0, neighbour F.L − room F.L), recorded as the door `sill`.
- Door head = min(threshold + standard door head 2,100, C.H − 200).
- The SVG draws the threshold as a dashed line labelled "문턱 +N" and writes F.L on every floor line.

## Open-plan spaces (living + kitchen with no wall between them)

Interior-elevation practice, checked 2026-09-25:
- NKBA *Interior Elevations for Kitchens & Baths* (ch. 12): elevations move clockwise around the room first, then clockwise into adjoining spaces; each wall is titled by the direction the viewer faces; walls appear as a borderline, and doors, windows and other openings are drawn.
- Iowa State *Visual Graphic Communication* ch. 4, as quoted in search results (the page itself could not be opened): stretches with no wall are labelled "OPEN TO KITCHEN" / "OPEN TO HALL".

Applied here (reading rule R23):
1. Kitchen/dining + living are unfolded as **one space** (`open_spaces` in `rooms.json`). The wall-less line between them is not an elevation.
2. Where one continuous wall passes from one space to the other, draw a **dash-dot boundary with both space names** (`faces[].zones`).
3. Stretches of the outline with no wall line are left blank, with a dashed outline and **"OPEN TO <space>"** (`faces[].open`).
4. "All rooms at once" draws the joined space instead of separate living and kitchen sheets.

## Expected Outputs

- `OUT/plan.svg`, `OUT/overlay.svg`
- `memory/drawings/<drawing>.rooms.json | .walls.json | .space-info.json` (derived)
- `docs/reports/elevations/<slug>/<room>.svg` and `all-rooms.svg`

## Related

- Code: `src/cad_intelligence/geometry/room_metadata.py` (`derive`, `unfolded_faces`); tests: `tests/test_room_metadata.py`
- Reference check: 아파트 평면도 ROOM #2 is 4,510 × 2,720, C.H 2,300, with D01 at the south end of the east wall and W07 from the south end of the west wall (user-approved 2026-09-25).

## Related Skills

<!-- Link related skills here -->
