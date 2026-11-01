---
lang: ko
lang_reason: proper-noun
---

# Sidecar-Driven Door Pattern Detection — Design Spec

**Status:** Approved (user, 2026-07-31); Revision 2 (2026-07-31) after
spec-review found the detector functions omitted `DoorEntity`'s required
`handle`/`layer` fields — fixed below, see "Revision Notes" at the end.
**Related:** `memory/drawings/아파트 평면도.door-window-patterns.json` (the pattern data
this spec wires into detection logic), `docs/superpowers/specs/2026-07-31-wall-face-pair-merge-design.md`
and `docs/superpowers/specs/2026-07-31-solid-union-room-detection-design.md` (this
session's other sidecar/opt-in-mode precedents)

## Problem

This session identified three real door symbol patterns for "아파트 평면도.dwg" through
direct COM investigation (arc + member grouping, named block references like
`D900`/`D1000`, and curved-polyline clusters detected via `GetBulge`) that the
current `handle_extract_cad_objects` (`src/cad_intelligence/cad_io/handlers/space.py`)
does not detect at all — it only extracts doors via layer-role classification
(`door_layers`), preferring `AcDbBlockReference` when present on a door-classified
layer, falling back to a polygon/sleeve-line heuristic otherwise. None of the three
newly-discovered patterns match that existing approach:

1. Arc-swing doors are plain `AcDbLine`/`AcDbPolyline`/`AcDbArc` entities, not block
   references, and the swing-radius member grouping has no equivalent in the current
   code.
2. Named-width blocks (`D900`, `D1000`) are found on layers (`7dim`, `252`) that are
   NOT classified as door layers at all — the current door-layer-restricted search
   would never see them.
3. Curved-polyline-cluster doors require checking `GetBulge()` per vertex, which the
   current extraction pipeline (and the underlying `ModelSpaceScanResult`/`Entry`
   snapshot it's built from) does not do anywhere.

These three patterns were verified only against this ONE drawing, but their
*detection rules* (an arc, a `D`+digits block name, a bulged polyline) are drawing-
convention-level, not drawing-specific — the one genuinely drawing-specific fact is
*which layer(s)* to search for patterns 1 and 3 (this drawing: `DOOR`; a user
correction during this session explicitly confirmed the layer name must not be
hardcoded, since another drawing could use a different name or split the convention
across multiple layers).

## Scope Decision

Add sidecar-driven door detection: when a `{drawing_stem}.door-window-patterns.json`
file exists next to the drawing, its three pattern definitions (including their
`search_layers` lists) drive three new, independently-testable detector functions
whose combined output **completely replaces** `handle_extract_cad_objects`'s existing
`doors` list for that request. When no sidecar exists, behavior is **byte-for-byte
unchanged** — this is purely additive, matching this session's established pattern
for optional, sidecar/config-driven behavior (see `AxisGrid`/`divider_lines` in
`_build_space_polygons`, and the `layers.json` manual-override precedent in
`handle_classify_layers`).

**Explicitly out of scope (per user's confirmed phased approach):** window pattern
detection. The window patterns recorded in the sidecar (parallel-line families with a
drawing-specific thickness value) are far more likely to produce false positives if
generalized without further validation on a second drawing — deferred to a follow-up
spec. `windows` extraction is entirely untouched by this spec.

## Design

### Sidecar schema addition: `search_layers`

The existing `memory/drawings/아파트 평면도.door-window-patterns.json` (written in a
prior session step) is extended with an explicit `search_layers` list on each pattern
that needs one:

```json
"door_patterns": {
  "type_1_arc_swing": {
    "search_layers": ["DOOR"],
    ...
  },
  "type_2_named_block": {
    "search_layers": null,
    ...
  },
  "type_3_curved_cluster": {
    "search_layers": ["DOOR"],
    ...
  }
}
```

`search_layers: null` for `type_2_named_block` reflects that this pattern is
layer-agnostic by design (named blocks were found on `7dim` and `252` — searching
"any layer" is the correct, general behavior, not an oversight to fix). This list is
a **list** (not a single string) per this session's explicit confirmation that a
future drawing could split the convention across two or more layers.

### `_load_door_window_patterns(doc_name, path_override=None) -> dict | None`

New loader in `src/cad_intelligence/cad_io/handlers/space.py`, mirroring
`_load_layer_classification`'s existing stem-based-filename + optional
`path_override` convention: builds the path
`memory/drawings/{doc_name_without_extension}.door-window-patterns.json` (or uses
`path_override` when given, matching the existing `layers_json_path` test-override
pattern). One deliberate divergence from `_load_layer_classification` (which
returns `{}` on a missing/unreadable file): this loader returns `None` on missing
file, not `{}` — so `handle_extract_cad_objects` can distinguish "no sidecar
present" (fall through to existing behavior) from "sidecar present but empty"
(an edge case not expected to occur in practice, but `None` vs `{}` keeps the
distinction available). No new external dependency — plain `json.load`.

### `_detect_arc_swing_doors(scan_result, search_layers) -> list[DoorEntity]`

Reuses the exact grouping logic validated this session:

1. Filter `scan_result.entities()` to `object_name == "AcDbArc"` and `layer in search_layers`.
2. For each arc, find every OTHER entity (any type, same `search_layers`
   restriction) whose centroid is within `radius * 1.3` of the arc's center — these
   are the door's frame/leaf/jamb-mark members (no further use is made of the
   members' geometry in this function; grouping is purely to confirm door
   completeness contour and left for future width-estimation refinement).
3. Each arc produces one `DoorEntity`: `handle = arc.handle`, `layer = arc.layer`,
   `position = arc.center`, `width = 2 * radius` (a swing arc's radius approximates
   the door leaf length, so diameter approximates a reasonable order-of-magnitude
   door width — flagged as an estimate, not a precise measurement, consistent with
   this codebase's existing practice of deriving width from `XScaleFactor`/block
   name when more precise data isn't available), `rotation = 0.0` (not derivable
   from an arc alone), `block_name = None`, `swing_direction = None`.
   (`DoorEntity`'s `handle`/`layer` fields have no defaults and are required by the
   dataclass constructor — both are directly available on the `Entry` the arc came
   from.)

### `_detect_named_block_doors(scan_result) -> list[DoorEntity]`

1. Filter `scan_result.entities()` to `object_name == "AcDbBlockReference"` with
   `block_name` matching `^D\d+$` (case-insensitive), **no layer restriction**
   (matches `search_layers: null`).
2. Each match produces one `DoorEntity`: `handle = entry.handle`,
   `layer = entry.layer` (the block reference's own actual layer — e.g. `"7dim"`
   or `"252"` for this drawing, NOT a fixed value, since this pattern is
   layer-agnostic by design), `position = entry.position`,
   `width = float(digits in block_name)` (e.g. `"D1000"` → `1000.0`),
   `rotation = entry.rotation`, `block_name = entry.block_name`,
   `swing_direction = None`.

### `_detect_curved_cluster_doors(doc, search_layers) -> list[DoorEntity]`

This is the one detector that **cannot** be built purely from the cached
`ModelSpaceScanResult`, since `Entry` does not carry bulge data (see "Non-Goals"
below for why this spec does not extend `Entry`). It performs its own narrowly-scoped
live COM read:

1. Iterate `doc.ModelSpace`, filtering to `ObjectName in ("AcDbPolyline",
   "AcDb2dPolyline")` and `Layer in search_layers` — bounded by the sidecar's
   explicit layer list, not a full-document walk, to avoid the exact
   per-property-COM-round-trip performance problem this project already fixed once
   (see `docs/superpowers/specs/2026-07-30-opening-evidence-scan-optimization-design.md`... equivalent concern, new context).
2. For each matching polyline, compute vertex count as `len(entity.Coordinates) // 2`
   (NOT `entity.NumberOfVertices` — confirmed this session that property does not
   exist on this COM object and silently produces false negatives if used), then
   call `entity.GetBulge(v)` for each vertex index directly.
3. Any polyline with `abs(bulge) > 1e-6` for at least one vertex is a curve-cluster
   door candidate. Its position is the centroid of that polyline's coordinates
   (matching this session's "approx_center" convention in the sidecar).
4. Width is not derived in this pass (no reliable general formula was established
   for this pattern this session) — `width = 0.0`, flagged inline as an explicit
   known limitation, not silently guessed.
5. Each qualifying polyline produces one `DoorEntity`: `handle = entity.Handle`,
   `layer = entity.Layer` (the actual COM property value, one of `search_layers`
   by construction of the filter), `position` = centroid, `width = 0.0` (see point
   4), `rotation = 0.0`, `block_name = None`, `swing_direction = None`. No
   member-grouping is needed — the polyline itself, via its bulge, IS the
   identifying signal, unlike pattern 1 where the arc is a separate entity from
   its frame members.

### Integration into `handle_extract_cad_objects`

After the function's existing `doors`/`windows` extraction completes (unchanged
code path), add:

```python
patterns = _load_door_window_patterns(doc.Name, params.get("door_window_patterns_json_path"))
if patterns is not None:
    door_patterns = patterns.get("door_patterns", {})
    new_doors: list[DoorEntity] = []
    t1 = door_patterns.get("type_1_arc_swing", {})
    if t1.get("search_layers"):
        new_doors.extend(_detect_arc_swing_doors(scan_result, t1["search_layers"]))
    t2 = door_patterns.get("type_2_named_block", {})
    if "type_2_named_block" in door_patterns:
        new_doors.extend(_detect_named_block_doors(scan_result))
    t3 = door_patterns.get("type_3_curved_cluster", {})
    if t3.get("search_layers"):
        new_doors.extend(_detect_curved_cluster_doors(doc, t3["search_layers"]))
    doors = [d.to_dict() for d in new_doors]
```

`doors` is fully replaced (per the user's confirmed "overwrite, not merge" decision)
only when a sidecar is present and at least one pattern is enabled in it. `windows`
is never touched by this code path.

## Non-Goals

- No change to `windows` extraction — deferred to a follow-up spec once a second
  drawing's window patterns are available to validate generalization.
- No change to `Entry`/`ModelSpaceScanResult` to add a `bulges` field — the curved-
  cluster detector's narrowly-scoped, layer-filtered live query is preferred to
  avoid re-touching the shared COM-scan cache (ADR-014) and reopening
  the exact "unconditional expensive COM walk" performance risk this project already
  fixed once for opening-evidence scanning.
- No change to `_load_layer_classification`, `handle_classify_layers`, or any
  existing layer-role-based extraction path — this is a fully separate, additive
  sidecar lookup with its own file name and loader function.
- No attempt to derive door width for the curved-cluster pattern (type 3) — flagged
  as an explicit `width = 0.0` limitation rather than guessed.
- No merge-with-existing-doors behavior — per the user's explicit choice, sidecar
  patterns replace, they do not merge with layer-based extraction.

## Testing

1. **`_load_door_window_patterns`**: returns `None` when no sidecar file exists;
   returns the parsed dict when it does; respects `path_override`.
2. **`_detect_arc_swing_doors`**: given a fixture with one `AcDbArc` plus 2 member
   entities within `radius*1.3` and one entity outside that radius, returns exactly
   one `DoorEntity` with `width == 2*radius`; the out-of-radius entity does not
   affect the result (grouping is for future use, not currently gating).
3. **`_detect_named_block_doors`**: given block references named `"D900"`,
   `"d1000"` (lowercase, must still match case-insensitively), and `"WATER3"`
   (must NOT match), returns exactly 2 `DoorEntity` objects with correct widths
   (900.0, 1000.0).
4. **`_detect_curved_cluster_doors`**: this needs a live-COM-shaped test double
   (mock `doc.ModelSpace` iteration, `ObjectName`/`Layer`/`Coordinates`/`GetBulge`)
   since it does not go through `scan_modelspace`. Verify: a polyline with a
   nonzero bulge on layer `"DOOR"` is detected; a polyline with all-zero bulges is
   not; a polyline with nonzero bulge but on a layer NOT in `search_layers` is not
   detected (regression test for the "must not hardcode DOOR" requirement).
5. **`handle_extract_cad_objects` integration**: with a sidecar present and all 3
   patterns enabled, `doors` in the result reflects ONLY the sidecar-detected doors
   (existing layer-based doors from the same fixture are NOT present in the
   output) — proving the "overwrite" behavior. Without a sidecar, output is
   byte-for-byte identical to the pre-this-spec behavior (regression test).
6. **Real-drawing manual verification** (not automated): re-run against
   "아파트 평면도.dwg" and confirm 9 doors detected, matching this session's
   user-verified total.

## Files Touched

- Modify: `memory/drawings/아파트 평면도.door-window-patterns.json` — add
  `search_layers` to `type_1_arc_swing` and `type_3_curved_cluster`; add an
  explicit (even if `null`) `search_layers` key to `type_2_named_block` for
  schema consistency.
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — add
  `_load_door_window_patterns`, `_detect_arc_swing_doors`,
  `_detect_named_block_doors`, `_detect_curved_cluster_doors`; wire into
  `handle_extract_cad_objects`.
- Modify: `tests/handlers/test_extract_cad_objects_door_patterns.py` (new file) —
  tests per the Testing section above.
- Modify: `CHANGELOG.md`.

## Open Questions

None outstanding — the two points raised during brainstorming (layer name must not
be hardcoded; must support 2+ layers per pattern) are both resolved via the
`search_layers: list[str] | None` schema field, sourced entirely from the sidecar,
never hardcoded in `space.py`.

## Revision Notes

**Revision 2 (2026-07-31)** — a spec-document-reviewer subagent verified every
"current behavior" and sidecar-schema claim against the real code and real JSON
file (all confirmed accurate) but found one concrete defect: `DoorEntity`'s
`handle` and `layer` fields have no defaults and are required by the dataclass
constructor, but all three detector functions' descriptions omitted them
entirely — as originally written, every `DoorEntity(...)` construction in the
spec would have raised a `TypeError`. Fixed by explicitly specifying
`handle`/`layer` sourcing for each detector (the underlying `Entry`'s own
`.handle`/`.layer`, which for the layer-agnostic type 2 pattern is the block
reference's own actual layer, e.g. `"7dim"` or `"252"`, not a fixed value). Also
clarified that `_load_door_window_patterns` returning `None` (vs.
`_load_layer_classification`'s `{}`) on a missing file is a deliberate, noted
divergence from the mirrored convention, not an inconsistency.
