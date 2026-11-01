---
lang: ko
lang_reason: source-material
---

# Vision-First PoC — 아파트 평면도 (2026-09-25)

ADR: [ADR-018](../../adr/ADR-018-vision-first-space-recognition.md). All runs are scored with `score_rooms` against `memory/drawings/아파트 평면도.ground-truth.json`.

## Setup (parameters fixed before scoring)

- **Proposal**: [`vision-proposal-v01.json`](vision-proposal-v01.json). These are the room rectangles Claude read from the user's screenshot *before* any DWG data was extracted, so the proposal is blind to the ground truth.
- **Registration**: plan extents in the screenshot (px 415,212–860,630) ↔ DWG wall extents (10571,7471–24571,20671).
- **Snap**: `proposal_snap.snap_polygon`, tolerance 600 mm, grid axes (`1cen`) first, then wall centerlines (`2sec`/`3SEC` face pairs).

## Results

| Pipeline | Pass | Matched | Mean IoU |
|----------|-----:|--------:|---------:|
| Geometry-first `zwcad_generate_spaces` (baseline) | 1/9 | 3 | 0.26 |
| Image only (registered, no snap) | 4/9 | 8 | 0.65 |
| **Image + CAD snap** | **5/9** | 8 | **0.76** |

- Determinism: three runs of image + snap gave identical output.
- Snapping fixes the numbers. Rooms whose layout the image read correctly snap to IoU 0.88–1.00: ROOM #1/#2, MAIN, 파우더, 부부욕실.
- The four remaining failures are **layout errors in the proposal**. They are exactly the items the user corrected during the review:
  - LIVING: the expanded balcony was not included, and the L-shape up to Y3a was missed.
  - DINING: the extent is wrong.
  - 공용욕실: too deep; the door line at Y5 was missed.
  - ENTRANCE: wrong location; the proposal put it on the stair core.

## Criteria status

| # | Criterion | Status |
|---|-----------|--------|
| 1 | At least 8/9 pass | ❌ 5/9 with a blind proposal |
| 2 | Deterministic ③–⑤ | ✅ |
| 3 | Second drawing (32평형아파트) | ⏳ not run |

## Findings

1. **The split of work is confirmed.** CAD snapping removes numeric error almost completely, but it cannot fix a wrong layout. Layout quality has to come from the vision step or a human.
2. The blind proposal came from a small, dark screenshot in which the text could not be read. Next steps to try:
   - Render the plan from DWG entities at high resolution, with room-tag leader seeds overlaid, and read the layout from that image.
   - Give the vision step explicit semantic rules in its prompt: expanded balcony, WET ZONE and stair core are non-rooms, entrance sits beside the core.
   - Add a human confirmation step for low-confidence edges (unsnapped vertices, and snaps longer than 300 mm).
3. Snapping could be pushed further with *topology* evidence, for example moving a room edge onto a door line. That work belongs to the reconcile step and is not done yet.

## Update — snap fix and second drawing (2026-09-25)

**Snap bug fixed.** Vertices used to be snapped independently, so an edge whose two ends found different evidence came out slanted. Each distinct coordinate is now snapped once (regression test `test_edge_ends_move_together`). Re-run on 아파트 평면도:

| Pipeline | Pass | Mean IoU |
|----------|-----:|---------:|
| Image + CAD snap (before fix) | 5/9 | 0.76 |
| Image + CAD snap (after fix) | **4/9** | 0.76 |

The earlier 5/9 was partly produced by the bug: a slanted edge happened to fit 부부욕실 better. **4/9 is the honest figure.** The failures are still the layout errors listed above.

**Second drawing — 32평형아파트** (`32pyeong/`)

- Evidence: `extract_plan_evidence.py`, 3,124 lines, 30 texts, 27 dims.
- Image: `render_evidence_png_svg.py`. The plan is rendered from DWG entities with an exact px↔mm transform.
- The proposal (`vision-proposal.json`) was read from that image using the semantic rules. No polygon ground truth existed yet.

| Check | Result |
|-------|--------|
| Proposed room set = the 8 known labels (room-labels.json) | ✅ |
| Each DWG room label lies inside its own proposed room, and only there | ✅ 8/8 |
| All room edges snapped to CAD evidence (no unsnapped coordinates) | ✅ 8/8 rooms (현관, a non-room, has 2 unsnapped) |
| Deterministic snap | ✅ |

Criterion 3 passes at the level it was defined (the room set matches). Polygon accuracy for this drawing needs a user-reviewed ground truth. The overlay `32pyeong/vision-first.overlay.svg` is ready for that review.

### 32평형아파트 — polygon score after user review

The user reviewed the overlay. Their corrections were written into `memory/drawings/32평형아파트.ground-truth.json`:

- The kitchen stops at the window line (x≈20464). The strip beyond it is a **다용도실** (non-room).
- The kitchen extends right to the wall at x≈23524, above the entrance.
- The living room includes the empty notches at its top-left and top-right.
- There is a door between 드레스실 and 침실1. It is not drawn in the source.

| Pipeline | Pass | Mean IoU |
|----------|-----:|---------:|
| Vision (DWG render) + CAD snap | **7/8** | 0.95 |

The only failure is 주방&식당: IoU 0.70, caused by the utility-room / window-line semantics.

**Bias note:** this ground truth was made by correcting the proposal, so rooms the user did not correct score IoU 1.00 by construction. The result shows that the user accepted 6/8 rooms unchanged. It is not an independent measurement of their accuracy.

### 32평형아파트 — ground truth completed (2026-09-25)

After further review rounds, the ground truth covers the **whole floor**:

- Both units: the right unit mirrors the left across x=26,423.6, verified with the same wall support (0.891) on both sides.
- The shared core: 엘리베이터, 계단, 홀.
- 16 rooms, 21 non-rooms, 16 doors, 14 windows.

See `memory/drawings/32평형아파트.ground-truth.md`.

The review corrections are consolidated into **reading rules** R01–R12 (`reading-rules.md`). The next fair measurement uses these rules on an unseen third drawing, with the proposal made *before* its ground truth.

## Third drawing — 아파트캐드평면도 (blind proposal)

The proposal (`apt-cad/vision-proposal.json`) was written **before** any ground truth existed. The ground truth was then built through user review; it covers two mirrored units at x=115,443.5 plus a shared core.

| Check | Result |
|-------|--------|
| Rooms (proposal + CAD snap + mirror) | **12/14**, mean IoU 0.84 |
| Missed | 욕실-2 / 욕실-2_R: an unlabelled cell reached by its own door (new rule R17) |
| 거실 | IoU 0.90: missed the wall-less strip beside 현관 (R18) |
| Non-rooms | All 8 balcony/현관 proposals correct |
| Doors / windows (recognize_openings) | 12/12, 10/10 |

The same bias note applies: the ground truth was built by correcting this proposal. The measurement is fair in that the proposal was blind.

### Two extraction bugs found during review

1. **Blocks were never read.** The shared core, including the entrance doors (block `CO1`), was invisible, which led to the false statement that the core had no linework. `extract_plan_evidence.py` now explodes blocks recursively.
2. **The insert normal was ignored.** A block with sx=-1 and normal -Z is not mirrored. Honouring the normal put 아파트 평면도 W02 (block `PW2400`) in the right place: windows went from 6/7 to 7/7.

With blocks exploded, three earlier "not in the source" statements about 아파트 평면도 turned out wrong. D09 (the entrance leaf), D10, and W02 are all drawn inside blocks. The ground-truth notes were corrected.

Harness fixtures were re-extracted with block explosion, and a third drawing (`aptcad`) was added. Floors: apt_plan windows 7/7; aptcad doors 12/12, windows 10/10, rooms 12/14.
