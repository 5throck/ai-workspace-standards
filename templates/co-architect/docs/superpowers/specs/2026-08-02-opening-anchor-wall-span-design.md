---
lang: ko
lang_reason: proper-noun
---

# Opening-Derived Virtual Wall Synthesis v2 — Anchor-Based Gap Span Design

**Status:** Approved (user, 2026-08-03); implementation plan reviewed and revised
per reviewer feedback (infinite-line projection, `OPENING_GAP_SPAN_MIN_MM` noise
floor, `OpeningWallSynthesisContext` TypedDict, misaligned-opening test).
**Related:**
- `docs/superpowers/specs/2026-08-01-opening-derived-wall-segments-design.md`
  (superseded mechanism — v1 per-opening stub at raw position)
- `docs/reference/opening-dimensions-reference.md` (domain reference: frame vs
  wall vs opening spans, layer naming conventions)
- `docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md` (the
  face-pair merge this synthesis runs after)

## Problem

`_openings_to_wall_segments` (v1, `space_geometry.py`) synthesizes one wall stub
per door/window opening at the opening's *raw* position, sized by `opening.width`
and oriented by `rotation` (door) or the nearest wall's axis (window). On the
reference drawing (`32평형아파트.dwg`) this produces two failure modes:

1. **Frame-width stubs**: `WID`-layer windows resolved via the AcDbLine
   sleeve-line fallback get `width = line length` = 14–100mm — the window *frame
   profile depth* (which is necessarily thinner than the wall; see the reference
   doc §2/§4). Synthesizing a 50mm "wall" cannot close any room polygon.
2. **Unanchored stubs**: the stub is centered at the raw opening position, which
   may be a few cm off the wall line. It only connects to the wall network if the
   welder (`CORNER_SNAP_TOL` = 150mm) happens to snap it — otherwise it floats.

## Canonical Principles (spec-level)

1. **Anchor selection uses only explicit wall segment endpoints. Interior wall
   split inference is intentionally out of scope for v2.**
2. **Stub orientation follows the resolved opening axis** (window: wall axis;
   door: `rotation`).
3. **v2 reconstructs boundary continuity, not physical opening geometry.**

## Algorithm

For every `DoorEntity` / `WindowEntity`, independently:

### 1. Resolve the opening axis (`stub_theta`)
- Doors: `rotation` field directly (radians; 0 = +X).
- Windows: no `rotation` — borrow the axis angle of the nearest real wall segment
  within `OPENING_AXIS_SEARCH_TOL_MM` (500mm), point-to-segment distance via
  shapely. No qualifying wall → **skip** with
  `OPENING_WALL_SEGMENT_SKIPPED_NO_AXIS` (never guessed; unchanged from v1).

### 2. Project onto the wall's infinite line (v2 alignment)
- `base = _project_point_to_infinite_line(opening.position, nearest_seg)` —
  orthogonal projection onto the **infinite line** through the nearest segment,
  `t = dot(pt − a, axis_unit)`, `base = a + t·axis_unit`.
- ⚠️ NOT `closest_point_on_segment()`: segment-projection clamps to the nearest
  segment *endpoint* when the opening's perpendicular foot falls outside the
  bounded segment; the unbounded projection snaps a misaligned opening onto the
  wall's axis instead (a wall-end opening keeps its wall position).
- No qualifying wall (doors only, windows already skipped): `base` = raw position
  (v1 fallback preserved).

### 3. Anchor-based gap span (primary mechanism)

`_flanking_anchor_span(base, axis_unit, lines) → (left, right)` — 4-step filter:

1. **Collect** only explicit wall-segment endpoints (principle 1) whose
   perpendicular distance from the wall line ≤ `WALL_FACE_MAX_THICKNESS` (250mm)
   and whose axis coordinate lies within `OPENING_GAP_SPAN_MAX_MM` of `base`.
2. **Transform** to axis coordinates (`base` = origin).
3. **Split** left (`proj < 0`) / right (`proj > 0`).
4. **Pick** nearest on each side: `left = max(...)`, `right = min(...)`.

Bridge condition:
```
OPENING_GAP_SPAN_MIN_MM (300) ≤ gap ≤ OPENING_GAP_SPAN_MAX_MM (1200)
```
where `gap = right_t − left_t`. When both anchors exist and the gap is in range,
synthesize a virtual wall between the anchors **projected onto the wall axis**
(never a chord between raw anchor coordinates):
```
bridge_start = project(anchor_left,  wall_axis)
bridge_end   = project(anchor_right, wall_axis)
```
This fills the real boundary gap and lets `polygonize_full` close the room.

Gap guards:
- `< OPENING_GAP_SPAN_MIN_MM` → CAD noise (double-line dimension marker, window
  mullion, drafting tick) → stub fallback. Also guards the wall-end case where
  one anchor sits essentially at the opening (a near-zero-length "wall").
- `> OPENING_GAP_SPAN_MAX_MM` → the two flanking runs are unrelated walls (e.g.
  the far ends of one long continuous wall) → stub fallback.

### 4. Stub fallback

Centered on `base`, oriented along `stub_theta` (principle 2), length:
```
width  if  width ≥ OPENING_MIN_VIRTUAL_WALL_MM (300)
OPENING_DEFAULT_WIDTH_MM (800) otherwise
```
The minimum guard prevents a window-FRAME profile width (14–100mm) from being
used as a wall span (principle 3 — reconstruct boundary continuity, not frame
geometry).

### 5. Reporting

Every emitted segment records `SYNTHESIZED_OPENING_WALL_SEGMENT` with a
structured `context` (see `OpeningWallSynthesisContext` below) so inferred
geometry is never silently indistinguishable from real data downstream and the
emission decisions can be audited/tuned.

## Data model

```python
class OpeningWallSynthesisContext(TypedDict):
    handle: str
    layer: str
    reason: Literal["opening_gap_bridge", "stub_fallback"]
    opening_type: Literal["WID", "DOOR"]
    original_width: float
    generated_span: float
    anchor_left: bool
    anchor_right: bool
```

## Constants (new, `space_geometry.py`)

| Constant | Value | Meaning |
|---|---|---|
| `OPENING_GAP_SPAN_MAX_MM` | 1200.0 | Max bridged gap (door+window common). Independent of legacy `DOOR_BRIDGE_TOL` (which stays for `_bridge_door_window_gaps`). |
| `OPENING_GAP_SPAN_MIN_MM` | 300.0 | Min bridged gap; below = noise → stub. |
| `OPENING_MIN_VIRTUAL_WALL_MM` | 300.0 | `width` below this = frame/fixture detail → default 800 stub. |

## Pipeline placement

Unchanged from v1: `_build_space_polygons` ENDPOINT_CLUSTER calls
`_openings_to_wall_segments` AFTER `_merge_wall_face_pairs` (so anchors and the
window axis reference face-pair-deduped centerlines) and BEFORE `_weld_endpoints`
(so synthesized segments are corner-snapped into the network). SOLID_UNION /
LEGACY unaffected.

## Testing

- v1 behavior preserved for empty wall inputs (door stubs at raw position with
  own rotation; width `<= 0` → 800 default).
- Updated: window-near-wall tests now assert the stub is projected onto the wall
  line (y=100 / x=0), not the raw opening position.
- New:
  - **WID frame-width regression**: `WID width=60`, wall gap=900 →
    virtual wall length 900 (not 60), `generated_span=900`, `reason=opening_gap_bridge`.
  - **Frame-width on continuous wall**: `WID width=60`, no gap → stub length 800.
  - **Connected wall** (Case 3): opening mid-wall on an intact wall → no bridge,
    stub fallback (`anchor_left/right=False`).
  - **Misaligned opening**: wall y=100, opening y=130 → projection y=100.
  - **Gap below min**: 150mm gap → stub fallback (noise guard).
  - **Door stub projection**: door 70mm off wall → stub on wall line, own rotation.

## Live-drawing verification

`zwcad_generate_spaces` re-run on `32평형아파트.dwg`. KPI priority:

| Priority | Metric |
|---|---|
| P0 | polygon closure rate / rooms generated |
| P1 | WID synthesized avg length / <300mm synthesized segment count |
| P2 | exception metadata (reason distribution) |

## Out of scope

- CONC-layer zigzag double-line face-pair merging / cross-layer false-pair fixes
  (polygonization engine; separate effort).
- `DOOR_BRIDGE_TOL` rename (legacy bridge behavior preserved untouched).
- Interior wall-split inference (principle 1).
