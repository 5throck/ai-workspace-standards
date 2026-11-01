---
name: cad-space-recognition
description: "Recognizes rooms, non-room zones, doors, and windows in a ZWCAD floor plan with the vision-first workflow (ADR-018): render the plan from DWG entities, propose spaces from the image using reading rules, snap to CAD evidence, review with the user, and score against ground truth. Supports Korean-speaking users end-to-end. Use when: recognizing spaces or rooms in a DWG, building or correcting a room ground truth, detecting doors/windows, handling mirrored units and shared cores, or scoring room detection."
version: 1.6.0
scope: co-architect
status: active
last_reviewed: "2026-09-26"
gemini-parity: sync
owner: zwcad-drafter
lang: ko
lang_reason: proper-noun
metadata: 
  type: process
  triggers:
    - space recognition
    - recognize rooms in dwg
    - room ground truth
    - score room detection
    - detect doors and windows
    - vision-first
    - 공간 인식
    - 공간 파악
    - 실 인식
    - 정답 데이터
    - 창과 문 판독
    - 도면 공간 채점
  relates_to:
    - zwcad-ai-drawing
    - cad-svg-preview
prerequisites: none
---

# CAD Space Recognition (Vision-First)

## Context

This skill implements the vision-first space recognition workflow (ADR-018): it renders the DWG to an image, proposes rooms/zones from the image under the Korean reading rules, snaps proposals to CAD-exact evidence, reviews the result with the user, and scores the final ground truth. It is the co-architect identity skill for turning Korean apartment floor plans into reviewable room data.

## Execution Steps

1. Render the floor plan from DWG entities and propose spaces from the image (vision-first; see `## Steps`).
2. Apply the Korean reading rules and language handling for mirrored units, shared cores, and expanded balconies.
3. Snap proposals to CAD evidence, then review the result with the user before committing ground truth.
4. Score the accepted ground truth against the pinned expectations.

## Output Format

`rooms.json` (accepted rooms with Korean space labels), `doors.json` / `windows.json` (opening inventories), and a scored review summary (per-room confidence against ground truth) — the input contracts consumed by `cad-svg-preview` and `generate-room-elevation`.

## Related Skills

- `cad-svg-preview` — renders the accepted ground truth as plan/elevation previews.
- `generate-room-elevation` — draws 4-direction elevations from the reviewed rooms.
- `zwcad-ai-drawing` — MCP drawing path for corrections in the live session.

---

## Overview

Wall linework alone cannot tell what a space *is*. Geometry-first detection scored 1/9 rooms on `tests/아파트 평면도.dwg`. This skill applies the ADR-018 split: **the image proposes the layout, the CAD file disposes the numbers, and the user confirms the semantics.** Every run leaves a reusable ground truth, which lets later detector changes be scored objectively.

Korean text in this file consists of trigger keywords and proper nouns (drawing, room, and layer names). The Korean user guide, with message templates and a glossary, is [`references/GUIDE-ko.md`](references/GUIDE-ko.md).

## When to Use This Skill

- The user asks to recognize or "find" spaces, rooms, doors, or windows in a DWG (Korean: 공간 인식/파악, 실 인식, 창·문 판독).
- A room ground truth must be built or corrected for a drawing.
- A room-detection change must be measured (`score_rooms.py`).
- A plan has repeated or mirrored units, or a shared core (elevator, stair, hall).

Not for drawing new geometry (use `zwcad-ai-drawing`) or for elevations (use `generate-room-elevation`).

## Language Handling (Korean support)

1. **Reply in the user's language.** When the user writes in Korean, send every status update, review table, and question in Korean, following `references/GUIDE-ko.md`. Keep file contents (JSON keys, code, commit and PR text) in English, as project policy requires.
2. **Keep Korean labels verbatim** in data, for example `침실1`, `주방&식당`, and `욕실` written `욕   실` with extra spaces. Normalize whitespace only when you compare labels.
3. **Use the glossary** in `references/GLOSSARY-ko.md` for Korean architectural terms (건축용어): spaces, doors and windows, and area/regulation terms mapped to ontology concepts and reading rules. Review-table shorthand (실, 비실 영역, 통심, 확장형) stays in `GUIDE-ko.md`.
4. **Write user-facing IDs** exactly as they appear in the data (`D08`, `W06`, `침실1_R`), so the user can point at them.
5. **Country profile.** Building codes and terminology differ per country. The active profile comes from `CAD_COUNTRY` (default `KR`) in `src/cad_intelligence/ontology/profiles/` — it supplies Korean concept labels (`terminology`) and the glossary above. State the active country when starting a recognition run for a new drawing, and never mix another country's terminology into a Korean ground truth.

## Steps

All scripts live in `scripts/co-architect/cad/diagnostics/`. Run them with `uv run python`. Put the working files in `docs/reports/room-scoring/<drawing-slug>/`.

### Phase A — Evidence and image

0. **Before opening, fix missing SHX fonts once:** `fix_missing_shx.py tests/*.dwg --apply` copies substitutes under the missing names into the user Support folder (big fonts get `ZHangul.shx`; other fonts get `simplex.shx`). The "SHX files are missing" dialog blocks COM until someone answers it. Run it again with `--active` after opening a drawing whose DWG compresses its style table.
1. **Open the drawing** with `zwcad_open_drawing`. If an MCP call times out, ask the user to check that ZWCAD is running and has no modal dialog open. Do not retry blindly.
1a. **First look without the screen:** `inventory_drawing.py OUT/inventory --doc "<name>.dwg"` lists sheet frames and their titles, large or XCLIP-ed or XREF-bound blocks, and far-away content, and writes one thumbnail PNG per sheet. Blocks over `--max-block` entities are drawn as labelled boxes, not exploded. Use it to choose the sheet `--bbox` or the block handle (`extract_block_evidence.py`) before a full extraction. Computer Use is only needed for dialogs.
2. **Extract evidence** with `extract_plan_evidence.py OUT/evidence.json --doc "<name>.dwg"`. Pass `--doc` whenever several drawings are open. The script explodes blocks, honouring the insert normal (R19). Cores and doors are often blocks, so never report something as "not drawn" without checking the blocks. This dumps lines, arcs, texts, and dims per layer in absolute mm. Read the layer list to identify the wall, window, door, core, and text layers. Layer names vary per drawing.
3. **Render the image** with `render_evidence_png_svg.py OUT/evidence.json OUT/plan.svg --bbox X0 Y0 X1 Y1`. Use the wall-layer extents and include the core. Always render from DWG (rule R12); never trust a screen capture for coordinates. The transform is written to `plan.svg.transform.json`.
4. **Check for repeated units and a shared core (R10).** Look for symmetric wall mass and a single elevator or stair block. Record the mirror axis if one exists.

### Phase B — Proposal (blind first)

5. **Load the reading rules** from `docs/reports/room-scoring/reading-rules.json` (R01–R26) and apply them while reading the image.
6. **Write the proposal *before* any ground truth exists** (`vision-proposal.json`): labels, rough polygons in image pixels, non-rooms, the anchor px bbox, and the anchor mm bbox. A proposal made after seeing ground truth is not a measurement; say so if that is the case.
   - **Geometry candidates as a starting point (ADR-019 option C).** If the drawing has no ground truth, `zwcad_generate_spaces` without a seed returns geometry-first spaces tagged `confidence_state: candidate` (`GEOMETRY_CANDIDATES_UNREVIEWED`). You may overlay them as a rough first draft, but they never replace the image proposal or the review. The tools that treat spaces as fact (`zwcad_map_space_info`, `zwcad_generate_wall_model`) refuse candidates with `SPACES_UNREVIEWED` unless the user explicitly passes `accept_candidate_spaces=true`.
7. **Snap and check.** Live: `zwcad_generate_spaces(seed_from_proposal=true, proposal_path=..., grid_lines=..., mirror_axis_x=...)` returns spaces plus `reports`. Offline: Register the proposal and snap it (`proposal_snap.register` + `snap_polygon`, tolerance 600 mm, grid first, then wall centerlines). Report unsnapped coordinates and any move over 300 mm as review items. Check that each label text sits inside exactly one proposed room.

### Phase C — Openings

8. **Detect openings.** On the live drawing, call the MCP tool `zwcad_recognize_openings(spaces=<proposal spaces>)`. It returns doors, windows, the mirror axis, a `needs_confirmation` list, `unassigned_door_targets` (a door swinging into no space means a room is probably missing, R22), and `enclosed_gaps` (unassigned holes between spaces, R18/R22). Put every one of these into the review questions. Offline, use `detect_openings.py OUT/evidence.json OUT/openings-detected.json --bbox ... --zones <proposal-or-gt>`.
   - Doors: hinge = arc center, leaf = radius. Arcs found on furniture layers still count (R07).
   - Windows: runs of at least 2 parallel window-layer lines. Keep only runs on room boundaries (R08).
   - Window-layer lines on interior walls are **always** a question for the user (R06). They may be a door (D08) or nothing (the former D09).
   - Doors with no drawn evidence exist. Ask about every room that has no entrance.

### Phase D — User review loop (builds the ground truth)

9. **Show the overlay** from `render_ground_truth_overlay.py GT.json OUT/plan.svg OUT/ground-truth.overlay.svg` in the browser pane. Colors: rooms green, balconies teal, planters light green, core purple, other non-rooms orange, doors red, windows blue.
10. **Apply one correction at a time.** Re-render after every change and state exactly what moved, with coordinates and areas.
    - When the user retracts a decision, revert it exactly and write the retraction into `note`.
    - Never re-infer geometry over a user correction.
    - When an instruction is ambiguous, map it to concrete DWG walls or lines first, then act. Ask only if two readings remain.
11. **Mirror repeated units** with `mirror_ground_truth.py GT.json --axis-x <axis> --evidence OUT/evidence.json`. It must print `OK`, meaning wall support is equal on both sides. Shared core zones (`category: core` or `shared: true`) are not mirrored.
12. **Write the ground truth**:
    - `memory/drawings/<drawing>.ground-truth.json`, in absolute mm, with `_meta.tolerance`, `pitfalls[]`, and a `note` on every user decision.
    - A companion `.md` listing scope, schedules, and review decisions.
    - Set `_meta.status` to COMPLETE only after the user confirms.

### Phase E — Score and persist

13. **Score the blind proposal** with `score_rooms.py --gt GT.json --detections spaces.json`.
    - Report pass count, mean IoU, merged rooms, non-room hits, and extras.
    - If the ground truth was built by correcting the proposal, state that the score is biased.
    - A bug fix that lowers a score must be reported with both numbers.
14. **Update the reading rules.** Any new semantic lesson from the review becomes a new rule (R23 and up) in `reading-rules.json` and `.md`. Mark it `needs_confirmation` when the evidence is ambiguous.
15. **Regenerate derived files** with `derive_room_metadata.py <drawing>`. It writes `rooms.json`, `walls.json`, `space-info.json` and `{drawing}.facts.json`, the ontology facts graph (ADR-020): spaces, faces, doors and windows linked by `has_face`, `placed_on`, `connects`, `opens_to` and `open_to`. Its `review` list holds the plan-reading rule violations (R10 mirror consistency, R13, R22, R24). Put every item into the review questions; they are questions, not automatic fixes.
16. **Persist**: update the PoC report in `docs/reports/room-scoring/` and the ADR-018 Outcome section, then commit through `/sync`, never with a direct git command.

## Expected Outputs

- `docs/reports/room-scoring/<slug>/`: `evidence.json`, `plan.svg` (+ transform), `vision-proposal.json`, `vision-first.spaces.json`, `openings-detected.json`, `ground-truth.overlay.svg`, and the score JSON.
- `memory/drawings/<drawing>.ground-truth.json` + `.md`, user-reviewed.
- Reading-rules delta, plus a report and ADR-018 update.

## Honesty Rules

- A proposal made after seeing the answer is not a measurement. Say so.
- Report regressions caused by fixes, with before and after numbers.
- Do not claim a door, window, or boundary without either DWG evidence or explicit user confirmation. Label anything else `VERIFY`.

## Related

- ADR: `docs/adr/ADR-018-vision-first-space-recognition.md`; design: `docs/designs/VISION-FIRST-001-design.md`
- Modules: `src/cad_intelligence/geometry/{room_scoring,proposal_snap,room_validation,plan_evidence,proposal_spaces}.py`
- Regression floors: `tests/test_space_recognition_harness.py`. Run it after any change to recognition logic.
- Worked examples:
  - `memory/drawings/아파트 평면도.ground-truth.json`: a single unit, expanded balconies, doors on odd layers.
  - `memory/drawings/32평형아파트.ground-truth.json`: two mirrored units and a shared core.

## Related Skills

<!-- Link related skills here -->
