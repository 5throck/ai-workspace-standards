---
lang: ko
lang_reason: proper-noun
---

# ADR-018 Vision-First Space Recognition (Image Proposes, CAD Disposes)

> **Status**: Adopted (review-augmented) — the vision-first path is the primary recognition path per ADR-019; the blind-PoC criterion 1 (≥ 8/9 unsupervised) remains open
> **Date**: 2026-09-25
> **Deciders**: Co-Architect PM, Architect, user

---

## Context

`handle_generate_spaces` finds rooms from wall linework alone. On the reference drawing `tests/아파트 평면도.dwg`, scored with the new `room_scoring` tool against the user-reviewed ground truth (`memory/drawings/아파트 평면도.ground-truth.json`), it passes **1/9 rooms**. It misses LIVING, DINING, ROOM #1/#2, MAIN ROOM, and ENTRANCE entirely (`docs/reports/room-scoring/baseline-2026-09-25.*`).

Every failure cause found during the 2026-09-24/25 review was *semantic*, not numeric:

- Expanded balconies have no inner wall.
- The party wall (X5) is open.
- A door arc sits on a furniture layer (`6fur`).
- The entrance door has jambs only, with no swing arc.
- Room names sit in tag boxes outside the plan.
- WET ZONE, PD/AD shafts, and the stair core are not rooms.

The review workflow that did succeed ran the other way round:

1. Read the room layout from an image.
2. Pull exact numbers from the DWG: grid, dimensions, wall faces, door arcs.
3. Have a person correct the result.

Almost all user corrections were about layout (which room, where it ends). Numbers were rarely corrected. The image-only estimate, however, was 14% off in overall size.

## Decision

Evaluate, and adopt if the PoC criteria are met, a **vision-first** pipeline:

```
① image of the plan (rendered from DWG entities, or a capture with anchors)
② vision proposal: room labels, rough polygons, room/non-room class (JSON)
③ targeted CAD queries: grid lines, wall faces, openings near the proposal
④ reconcile: snap proposal vertices to CAD evidence, report confidence
⑤ score with room_scoring against ground truth
```

- Prefer **rendering the image from DWG entities** over screen capture. The pixel→mm transform is then exact. A screen capture needs anchor-based registration (for example, the plan's outer extents).
- The vision output is a **proposal**, never final. Every vertex must snap to CAD evidence, or it is flagged for human review.
- The existing geometry code is kept as the evidence and validation library for step ④: wall thickness, `room_validation` clip and leak checks, and opening detection. It is no longer the primary room detector.

### PoC acceptance criteria

1. At least 8/9 rooms pass on `아파트 평면도` (`score_rooms.py`).
2. Deterministic: ③–⑤ give identical output over 3 runs.
3. On a second drawing (`32평형아파트`), the proposed room set matches the known labels.

If the criteria fail, record why and fall back to improving the geometry-first detector.

## Consequences

- Positive: semantic cases (expanded balconies, mis-layered doors, non-rooms) are handled where they are cheapest to recognize.
- Negative: each drawing needs a model call, which adds cost, latency, and run-to-run variance. Vision errors must be measured separately; they are not assumed away.
- Risk: overfitting to one drawing. Criterion 3 exists to catch this.

## Outcome (PoC, 2026-09-25)

Full report: `docs/reports/room-scoring/vision-first-poc-2026-09-25.md`.

| Pipeline | Pass |
|----------|-----:|
| Geometry-first (baseline) | 1/9 |
| Image only | 4/9 |
| Image + CAD snap | **4/9** (5/9 before the snap bug fix; see report) |

Image + CAD snap is deterministic across 3 runs. The remaining failures are all layout errors in the blind vision proposal; snapping fixes numeric error but cannot fix layout. Criterion 1 is not met. Criterion 3 is met on 32평형아파트: the 8/8 room set matches. Against the user-reviewed ground truth, the polygons score **7/8** (mean IoU 0.95). That ground truth was built by correcting the proposal, so this score is biased; see the report. The next iteration improves the vision input (a render from DWG with seeds and semantic rules) and adds human confirmation for low-confidence edges.

### Update 2026-09-25 — ground truth and reading rules

- `memory/drawings/32평형아파트.ground-truth.json|md` is complete: both units (mirror at x=26,423.6) plus the shared core.
- The review lessons are captured as reading rules R01–R12 (`docs/reports/room-scoring/reading-rules.md`). Rules marked ⚠ always become human-confirmation items.
- Next step: a fair measurement on an unseen third drawing (`tests/평면도.dwg` or `tests/AI 작업용 공용홀.dwg`), with the proposal made before its ground truth.

### Update 2026-09-25: recognition logic improved (implementation)

The findings are now built into the production code. The existing modes are unchanged; the new behaviour is opt-in or lives in a new tool.

| # | Change | Where |
|---|--------|-------|
| 1 | Offline harness: saved evidence + ground truth for both drawings, with scores pinned as floors | `tests/test_space_recognition_harness.py`, `tests/fixtures/plan_evidence/` |
| 2 | `zwcad_generate_spaces` `seed_from_proposal` mode (+ `mirror_axis_x`, `grid_lines`, `clip_to_walls`) | `space.py`, `geometry/proposal_spaces.py` |
| 3 | Opt-in `postcheck_walls` guard for every mode (rooms crossing walls) | `space.py` |
| 4 | Non-room categories learned in review (WET ZONE, 다용도실, PD/AD, qualified balcony labels, 드레스실/반침) | `space_category.py`, `proposal_spaces.categorize` |
| 5 | Mirror-axis detection from wall symmetry | `geometry/plan_evidence.detect_mirror_axis` |
| 6–7 | New `zwcad_recognize_openings` tool: door arcs on any layer (including polyline bulges), jamb-only gaps, glazing runs split at walls, door candidates between rooms | `space.py`, `geometry/plan_evidence.py` |
| 8 | Wall layers identified by geometry, not by name | `plan_evidence.classify_wall_layers` |

Results (the offline harness and the live in-process run agree):

| Drawing | Doors | Windows | Rooms |
|---------|------:|--------:|------:|
| 아파트 평면도 | 10/11 | 6/7 (precision 0.60) | 4/9 (screenshot proposal; baseline 1/9) |
| 32평형아파트 | 16/16 | 14/14 (precision 1.00) | 14/16 with mirroring (baseline: 0 spaces) |

The MCP server must be restarted to expose the new tool and parameters.

### Update 2026-09-25: third drawing (blind) and block extraction

- 아파트캐드평면도: the blind proposal scored **12/14** rooms. The misses were an unlabelled bathroom and its mirror. Doors and windows scored 12/12 and 10/10. This is the first proposal made before its ground truth existed.
- Evidence extraction now explodes blocks and honours the insert normal (reading rules R19 and R20). Several items previously reported as "not drawn" were inside blocks.
- **Criterion 1 status:** the fair measurements so far are 4/9 (screenshot proposal) and 12/14 (DWG-render proposal). Both ground truths were built from the proposals, so the second figure is still biased upward. Criterion 1 remains open until a proposal is scored against a ground truth built independently.

### Update 2026-09-25: logic round 3 (blocks live, frame doors, coverage checks)

- The `zwcad_recognize_openings` MCP tool now uses the shared block-aware extractor (`cad_io/plan_evidence_com.py`). Live, 아파트 평면도 W02 is found (windows 7/7).
- `detect_frame_doors` (R21): 아파트 평면도 doors 10/11 → **11/11**, with precision 0.625 → 0.647. No false frames on the other two drawings.
- Coverage checks (R22): `unassigned_door_targets` and `enclosed_gaps`, plus `PROPOSAL_ENCLOSED_GAP` in `seed_from_proposal` reports. On the blind 아파트캐드평면도 proposal they flag both review corrections (욕실-2 and the 거실 strip). On all three reviewed ground truths they report nothing.

| Drawing | Doors | Windows | Rooms (proposal) |
|---------|------:|--------:|-----------------:|
| 아파트 평면도 | 11/11 | 7/7 | 4/9 (screenshot) |
| 32평형아파트 | 16/16 | 14/14 | 14/16 (mirror) |
| 아파트캐드평면도 | 12/12 | 10/10 | 12/14 (blind) |

### Update 2026-09-26: fourth drawing (public hall) and evidence-extraction hardening

- Fourth reference drawing: `tests/AI 작업용 공용홀.dwg` — the public-hall shared core of a basement level. The user-reviewed ground truth covers 1 room (the elevator hall) and 13 core non-rooms (stair and elevator shafts, storage, passages). Its rooms are defined by its interior-elevation sheets, not the plan alone — reading rules R27/R28 (rules v2.0) encode this; see [ADR-020](ADR-020-plan-reading-ontology.md) for the ontology side.
- Evidence extraction hardened for real production drawings: `extract_evidence(doc, bbox=...)` skips far-away sheets and bound XREF plans; `extract_block_evidence.py` reads one XCLIP-ed block with per-line nested-block paths (the plan area took 31 s instead of 25 min); `render_evidence_png_svg.py` matches prefixed XREF layer names (`X-B1$0$A-WALL`); `plan_evidence` no longer treats the non-plotting DEFPOINT layer as wall. `inventory_drawing.py` gives a first screen-free look at a drawing (sheet frames, titles, large blocks, thumbnails); live-ZWCAD tests are opt-in (`CAD_LIVE_TESTS=1`).
- The ontology gained country profiles (`CAD_COUNTRY`, default `KR`): terminology and a Korean architectural glossary merge into concept examples; jurisdiction-tagged rules filter per country.
- **Exit-criterion tally (ADR-019):** reviewed drawings are now 4 — 아파트 평면도, 32평형아파트, 아파트캐드평면도, AI 작업용 공용홀. The criterion (≥ 80 % room match on ≥ 5 reviewed drawings; review by 2026-12-31) still needs one more reviewed drawing. The open question from the ADR-019 step-3b review — whether one of the 5 must be a non-apartment plan — is still with the user; the public hall is a shared core, not a unit plan, so the tally already includes one non-unit drawing.

