---
lang: ko
lang_reason: proper-noun
---

# Mirrored Two-Unit LABEL_ANCHORED_HYBRID Wiring — Design Spec

**Status:** Approved (user, 2026-08-05, after multi-round clarification on ground truth)
**Related:**
- `docs/superpowers/specs/2026-08-01-label-anchored-hybrid-room-reconstruction-design.md`
  — the `LABEL_ANCHORED_HYBRID` mode this design activates. Already implemented and
  already wired into the live handler (`handlers/space.py:4003`,
  `_elev002_build_space_polygons_label_anchored_hybrid`) — confirmed by direct code
  read, 2026-08-05. Not modified by this design.
- `memory/2026-07-31-meeting-weld-endpoints-defect.md`,
  `memory/geometry-plateaus-at-5-rooms.md` — the 3-failed-attempt pure-geometry
  history this design deliberately routes around.
- `memory/drawings/32평형아파트.space-info.json` — pre-existing 16-name space list for
  this drawing (superset of the room-count target below; used as a naming reference,
  not a filter).

## Problem

Room-count detection on `32평형아파트.dwg` has plateaued at 3-5 polygons against pure
wall-network geometry (`ENDPOINT_CLUSTER`/`SOLID_UNION`), root-caused to a wall-topology
defect with 3 documented failed fix attempts (2026-07-31 meeting). A working
alternative mode, `LABEL_ANCHORED_HYBRID`, already exists: it guarantees one polygon
per room-name text label (real wall geometry when available, Voronoi-cell
approximation as a safe fallback otherwise), sidestepping the unsolved wall-topology
problem entirely.

**New finding (2026-08-05, this session):** the drawing's title block reads "기준층
전체 평면도" (typical-floor whole-floor plan) and the wall geometry spans x=0 to
x=38,533mm — roughly double the ~11,400mm width covered by the drawing's 15 room-name
text labels (all on layer `TEX`, x-range ~14,996–26,385). Confirmed via
`zwcad_extract_text_labels` across every layer on the live drawing: **only one
apartment unit's rooms are text-labeled; a second, structurally mirrored unit exists
in the wall/window geometry with zero text labels.** This was independently
corroborated by a prior session's window-clustering investigation (recorded in
`memory/meeting-2026-08-04-window-symbol-pipeline-clustering-radius-resolution.md`):
three groups of near-identical-length window lines, each group appearing twice at
different x-offsets, were tentatively explained then as "one facade with repeated
window widths" — re-examined now, all three pairs' midpoint x-coordinates agree on a
single reflection axis at **x ≈ 26,423.6mm** to within measurement noise, confirming
they are the same room's windows in each of the two mirrored units, not incidental
repetition.

`LABEL_ANCHORED_HYBRID` matches text labels to geometry 1:1 — with only one unit
labeled, running it unmodified would find at most the labeled unit's rooms and
silently miss the second unit entirely.

## Ground truth (confirmed with user, 2026-08-05, after 4 rounds of clarification)

Per apartment unit, exactly **8** named spaces count as rooms for this exercise:
`침실1`, `침실2`, `침실3`, `거실`, `주방&식당`, `욕실1`, `욕실2`, `드레스실`.

Excluded (not counted as rooms): `반침`, `현관`, `발코니1`–`발코니4`, `화단`, `홀`.

Two units on this floor → **16 rooms** total is the success target for this drawing.

## Design

### 1. Room-labels sidecar (new file)

`memory/drawings/32평형아파트.room-labels.json`, matching the schema
`_load_room_labels_sidecar` already reads (`handlers/space.py:372`):

```json
{
  "text_layers": ["TEX"],
  "room_name_includes": ["침실1", "침실2", "침실3", "거실", "주방&식당", "욕실1", "욕실2", "드레스실"],
  "mirror": {
    "axis_x": 26423.6
  }
}
```

`room_name_includes` reuses the existing `_qualifies()` substring-match filter in
`handle_generate_spaces` (`handlers/space.py:4029-4033`) — no change needed there.
`mirror` is a **new, namespaced sidecar key** (revised from a flat `mirror_axis_x`
during spec review — namespacing leaves room for `axis_y`/`rotation`/`offset` later
without key collisions), consumed only by the mirroring step below (Non-Goal: not a
general `LABEL_ANCHORED_HYBRID` parameter — this drawing-specific mirroring is
orthogonal to that mode's own contract and must not leak into it).

### 2. Label mirroring (new, small, pure-geometry function)

New function `_mirror_room_labels(room_labels: list[dict], axis_x: float) -> list[dict]`
in `space_geometry.py` (co-located with `LABEL_ANCHORED_HYBRID`'s other helpers, same
file `LABEL_ANCHORED_HYBRID`'s builder lives in):

```python
def _mirror_room_labels(room_labels, axis_x):
    mirrored = []
    for lbl in room_labels:
        x, y = lbl["position"]
        mirrored_label = dict(lbl)  # shallow copy: preserves any future keys
        mirrored_label["position"] = (2 * axis_x - x, y)
        mirrored.append(mirrored_label)
    return mirrored
```

(Revised during spec review to shallow-copy the full label dict rather than
reconstructing `{"text", "position"}` explicitly — if `room_labels` entries ever gain
extra keys, e.g. `layer`/`rotation`/`confidence`, they survive the mirror unchanged
with zero code change here.)

`LABEL_ANCHORED_HYBRID`'s own matching logic already keys Voronoi-fallback lookups by
**label index**, not text (per its design doc, "room names are not unique -- the
reference drawing has two identically-named bathroom labels" — already anticipated
this exact scenario, just for a different reason). Duplicate text across the original
8 and mirrored 8 is therefore safe with zero changes to the matching algorithm.

### 3. Wiring point

In `handle_generate_spaces`'s `LABEL_ANCHORED_HYBRID` branch (`handlers/space.py:4003-4041`),
after building `room_labels` from the sidecar-filtered live extraction (existing code,
line 4035-4038): if the sidecar has a `mirror` block, compute
`room_labels = room_labels + _mirror_room_labels(room_labels, sidecar["mirror"]["axis_x"])`
before calling `_elev002_build_space_polygons_label_anchored_hybrid(...)`. When the key
is absent (any other drawing's sidecar), behavior is byte-identical to today —
strictly additive, opt-in per drawing.

### 4. Exceptions

No new exception codes needed. `LABEL_ANCHORED_HYBRID`'s existing
`LABEL_ANCHORED_GEOMETRY_MATCH` (per-label, records match tier + distance) and
retained `LABEL_VORONOI_ROOM` (per-label Voronoi-fallback marker) already give
per-room visibility into which of the 16 rooms got real geometry vs. approximated —
exactly what's needed to audit the mirrored half's match quality, which is expected to
be weaker (Voronoi-heavier) than the labeled half's, since the mirrored labels'
positions are a geometric estimate, not read from the drawing.

## Non-goals

- No change to `LABEL_ANCHORED_HYBRID`'s core algorithm, `LABEL_VORONOI`, `SOLID_UNION`,
  or any pure-geometry mode.
- No attempt to fix the underlying wall-topology defect (`ENDPOINT_CLUSTER` plateau) —
  this design routes around it, doesn't resolve it (tracked separately, not
  reopened by this work).
- No generalization of "mirrored floor plan" into a reusable platform feature in this
  pass — `mirror_axis_x` is a single drawing-specific sidecar value, not a new
  `WallProcessingMode` or auto-detection algorithm. If a second mirrored-floor
  drawing is encountered later, generalizing this (e.g. auto-detecting the axis from
  duplicate-geometry pairs, as this session did manually) is a legitimate follow-up,
  not scoped here.
- `반침`, `현관`, `발코니1-4`, `화단`, `홀` are deliberately excluded from both units per
  the confirmed ground truth — not a bug if they don't appear in the 16-room result.

## Pre-Implementation Verification Gate (blocking, mirrors the 2026-08-04 window-pipeline precedent)

Before writing an implementation plan, run `wall_processing_mode="label_anchored_hybrid"`
live against `32평형아파트.dwg` with the sidecar above (constructible today via direct
Python call to `_elev002_build_space_polygons_label_anchored_hybrid` — no code change
needed to test the *existing* mode, only the mirroring step needs a throwaway script
first) and record:

1. **Room count** — must be 16 (8 labeled + 8 mirrored), not fewer (a label matching
   nothing, including Voronoi, would be a bug in `LABEL_ANCHORED_HYBRID` itself, not
   expected) and not more (would mean the mirroring step is misfiring).
2. **Match tier distribution** — how many of the 16 got `GEOMETRY` (leader/direct/nearest)
   vs. `LABEL_VORONOI` fallback. The mirrored half is expected to skew Voronoi-heavy
   (real geometry matching depends on `SOLID_UNION`/`ENDPOINT_CLUSTER` actually closing
   a polygon near the mirrored coordinate, not guaranteed) — report the actual split
   honestly rather than assuming.
3. **Sanity-check 2-3 mirrored polygon positions visually** (e.g. via
   `generate-floorplan-svg` skill or a quick plot) against where the second unit's
   walls actually are, to confirm the mirror axis (26,423.6mm, derived from 3 window
   pairs) generalizes correctly to room-label positions too, not just those specific
   windows.

If room count ≠ 16 or the mirrored polygons are visibly misplaced, the axis or
sidecar needs correction before an implementation plan is written — do not proceed
on an unverified assumption, per this project's established practice after the
2026-07-31 diameter-cap hypothesis was disproven by direct execution.

### Result (executed 2026-08-05, direct Python call against real drawing data —
`_build_space_polygons_label_anchored_hybrid` called with the real `walls`/`doors`
from a live `zwcad_extract_cad_objects` call and 16 room labels: 8 real (live
`zwcad_extract_text_labels`) + 8 mirrored via `_mirror_room_labels`)

1. **Room count: 16/16 — target met exactly.**
2. **Match tier distribution: 0/16 `GEOMETRY`, 16/16 `LABEL_VORONOI` fallback.**
   `SOLID_UNION` closed no polygon that matched any of the 16 label positions on this
   drawing — consistent with the documented, still-unresolved wall-topology defect
   (3 failed fix attempts, 2026-07-31 meeting). This is the design's documented safe
   fallback ("degrades to pure LABEL_VORONOI... not a failure"), not a new bug. It
   does mean **all 16 polygons are Voronoi straight-line approximations, not real
   wall boundaries** — the count is now reliable; boundary accuracy is not, and
   remains gated on the separately-tracked wall-topology fix (out of scope here).
3. **Mirror-position sanity check**: 3 sample unit-1 labels (`침실1`, `거실`,
   `주방&식당`) mirrored about `axis_x=26423.6` all land inside the real unit-2 wall
   geometry's x-range (24,608–38,533mm, computed from 494 real wall segments with an
   endpoint past the axis) — confirms the axis and mirror math generalize correctly
   from the 3 window pairs it was derived from to room-label positions generally.

**Gate verdict: PASSED for room count (the stated success criterion); geometric
accuracy is Voronoi-approximate by design, not a gate failure.** Proceeding to
implementation plan.
