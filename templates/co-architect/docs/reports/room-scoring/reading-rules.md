---
lang: ko
lang_reason: source-material
---

# Vision-First Plan Reading Rules (v2.0, 2026-09-25)

These rules were learned from user reviews of two drawings. They feed ADR-018 step ② (the vision proposal). A rule marked ⚠ produces a **human-confirmation item**, not an automatic decision. Data: [`reading-rules.json`](reading-rules.json).

Since v1.6 each rule in the JSON also records `applies_to` (concepts in `src/cad_intelligence/ontology/concepts.yaml`), `depends_on`, `enforced_by` (`code` / `prompt` / `review`) and `implemented_by` (`module:symbol`). `uv run python -m cad_intelligence.ontology` checks them (ADR-020). Since v1.7, `cad_intelligence.rules.plan_reading.check_plan()` also checks R10 (mirror consistency), R13, R22 and R24 on the recognised facts graph and reports violations as review items.

| ID | Topic | Rule | Evidence |
|----|-------|------|----------|
| R01 | room vs non-room | Balconies, 화단 (planter), WET ZONE, PD/AD shafts, elevator, stair and 홀 are non-rooms; still recognise and label them. | 아파트 평면도 WET ZONE×2; 32평형 발코니1-4, 화단, core |
| R02 | expanded balcony | If a balcony has no wall between it and the room (only sill/window lines), merge it into the room (확장형). | 아파트 평면도 X1–X2 strip, living balcony |
| R03 | open notches | Wall-less leftover spaces adjoining a room belong to that room (e.g. living-room notches in front of bedroom doors). | 32평형 거실 top-left/right notches; 아파트 평면도 거실 up to Y3a |
| R04 | window-line split | An interior window line can separate two spaces; the space beyond the kitchen window is 다용도실. | 32평형 W06 at x≈20464 |
| R05 | door-line boundaries | A bathroom / entrance boundary follows the door line, not the grid beyond it. | 아파트 평면도 공용욕실 & 현관 at Y5 |
| R06 ⚠ | window-layer lines on walls | Double window-layer lines on an interior wall MAY be a sliding door/opening or NOT a door at all → always needs_confirmation. | 32평형 D08 = door; 32평형 former D09 = not a door |
| R07 ⚠ | mis-layered / missing door evidence | Door arcs can sit on furniture layers; entrance doors may have jambs only; some doors are not drawn — look for jambs/frames and ask. | 아파트 평면도 D06 on 6fur, D09 jambs only, D10 undrawn; 32평형 D08 undrawn arc |
| R08 | windows only where glazing is | Do not assume windows on every exterior edge; place windows only where glazing runs exist (≥2 parallel window lines). | 아파트 평면도: no windows on X5/Y6/Y7 |
| R09 ⚠ | stray outlines | Not every enclosed outline is a space; leftover bays may stay unassigned. | 32평형 lower-left bay under 발코니2 |
| R10 | multi-unit plans | Detect mirror/repeat units (symmetric wall mass) and recognise every unit; shared cores are recognised once. | 32평형 mirror at x=26423.6, core shared |
| R11 | labels | Room names may sit in finish-tag boxes outside the plan — use the leader start point as the seed; normalise whitespace (욕   실). | 아파트 평면도 7TXT tags |
| R12 | image source | Render the image from DWG entities (exact px↔mm transform) instead of a screen capture. | PoC: screenshot proposal 4/9 vs DWG-render proposal 7/8 |
| R13 | glazing between room and non-room | Glazing between a room and a circulation zone (현관, 복도, 홀) is not a window; toward a utility zone (다용도실, WET ZONE) it is a window. | 32평형 ex-D09 (거실↔현관) vs W06 (주방↔다용도실) |
| R14 | qualified labels | A balcony label qualified by a room name ('발코니 (침실1 앞)') is a balcony: check non-room keywords before room keywords. | 32평형 W01 misread as a door candidate in the live run |
| R15 | glazing run position | Compute a glazing run's position only from its own lines; parallel lines elsewhere on the same axis (sliding-door tracks) must not shift it. | 아파트 평면도 W11 shifted 227 mm |
| R16 | kitchen/dining ↔ living | Kitchen/dining and living are one connected space; a jamb-only gap between them is an open connection, never a door. This holds across all reference plans. | 아파트캐드평면도 former D06 (user 2026-09-25); 32평형 and 아파트 평면도 have the same wall-less layout |
| R17 ⚠ | unlabelled small cells | A small enclosed cell with its own door but no label can still be a room (e.g. a second bathroom); ask for its use instead of leaving it unassigned. | 아파트캐드평면도 욕실-2 below 침실-1 |
| R18 ⚠ | leftover strips | A wall-less leftover strip belongs to the room it is open to, which may be the living room rather than the room first guessed (R03 refinement). | 아파트캐드평면도 strip between 침실-3 and 현관 → 거실 |
| R19 | blocks | Doors, windows and whole cores are often block inserts. Always explode blocks (with scale, rotation, AND the insert normal: sx=-1 with normal -Z is NOT mirrored) before saying something is 'not drawn'. | 아파트캐드평면도 core + entrance doors = block CO1; 아파트 평면도 W02 = PW2400, D09 = D1000, D10 = D900 |
| R20 | floor-pattern layers | Tile / pattern layers are paired linework but not walls; exclude them from wall evidence (they cut glazing runs into pieces). | 아파트캐드평면도 TILE → 0 windows until excluded |
| R21 ⚠ | frame-only doors | Two small door-layer frame stubs facing each other across 600–1,300 mm, with no arc hinged on that gap, are a door whose leaf is not drawn. Always ask for confirmation. | 아파트 평면도 D11 (MAIN ROOM ↔ 파우더) |
| R22 | coverage checks | Before review, report every door that swings into no proposed space (a missing room) and every hole enclosed by proposed spaces (a leftover strip). These are questions for the user, not decisions. | 아파트캐드평면도 blind proposal: 욕실-2 via D05, strip between 침실-3 and 현관 |
| R23 | open-plan elevations | Unfold kitchen/dining + living as one space (clockwise, NKBA). Mark the space boundary along a continuous wall with a dash-dot line and both names, and mark wall-less stretches 'OPEN TO <space>'. | User question 2026-09-25; NKBA Interior Elevations ch. 12; Iowa State VGC ch. 4 (OPEN TO labels) |
| R24 | sunken-floor door levels | Door threshold = neighbour F.L − room F.L; door head = min(threshold + 2,100, C.H − 200). Elevations show F.L and the threshold. | User review 2026-09-25 (욕실 door too tall); 대한경제 2014 (50–60 mm threshold) |
| R25 | strip between two walls | A narrow strip (about 400 mm or less) between two parallel walls is a wall cavity, not a space. Leave it unassigned; end each room on its own wall centerline. | 아파트캐드평면도: ~260 mm strip between 욕실-1 and 침실-2 (user 2026-09-25) |
| R26 | internal and unmodelled-side doors | A door inside one space (shower screen) is internal: no second space, not drawn on an elevation. A confirmed door into a space not modelled yet is marked unmodelled_side. Both need user confirmation; otherwise R22 asks. | 아파트 평면도 D04, D08 (user 2026-09-25) |
| R27 | elevation sheets define the rooms | When a drawing carries interior-elevation sheets, the spaces they unfold are the rooms. Read each key-plan marker pair (A/A′ …) and its coloured section line. | AI 작업용 공용홀: A–C hall, D 비품 창고, E passage, F ST-1 (user 2026-09-26) |
| R28 | elevations are drawn from the plan | Interior elevations are drawn from the plan sheet: each unfolds one plan space, dimensioned to the finished wall surface (structural face − finish). The drawing is consistent when every elevation reconciles with its plan space (length ±100 mm, doors ±260 mm); differences are review items, and real drafting differences are recorded. | AI 작업용 공용홀 sheets 1 → 2–3 (user 2026-09-26) |
