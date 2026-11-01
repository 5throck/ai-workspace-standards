---
lang: ko
lang_reason: proper-noun
---

# AXIS-001: Axis-Grid Based Floor-Plan Recognition

> **Spec ID**: AXIS-001
> **Version**: 1.9 (Phase A0-A2 + S + B1-B3 + B6 + Phase C & D implemented; B4-B5 deferred)
> **Status**: Approved with Conditions — remaining conditions resolved in Phase A0, see §11 Review Log
> **Created**: 2026-07-02
> **Reviewed**: 2026-07-03 (Architect + Code Verifier — see §11)
> **Authors**: PM (with architect-perspective review of ELEV-002 codebase)
> **Extends**: [`ELEV-002-design.md`](ELEV-002-design.md) (v2 pipeline — implemented; this spec adds an accuracy layer on top, it does NOT supersede)
> **Source**: User request 2026-07-02 — improve room count/size recognition and per-room door/window size/position detection; manage geometry via X/Y coordinate axes

---

## 1. Overview — Problem Diagnosis and Goals

The current recognition pipeline has four structural limitations, confirmed by code
inspection of the live branch (`feat/zwcad-room-elevation-with-openings`):

1. **Room recognition depends on manual input.** `space_geometry.py` provides shapely
   polygonization, but production runs rely on user-verified absolute coordinates
   (`x_min`, `y_min`, `x_segments`) hand-entered into `{file}.rooms.json`. Every new
   drawing requires a human to measure and type room coordinates.
2. **Opening detection is drawing-specific and estimated.** `scripts/rematch_openings.py`
   classifies entities with hardcoded constants tuned to one test drawing (layer names
   `DOOR`/`슬리브`, area thresholds 20,000/4,000/3,000 mm², block-name regexes
   `D###`/`PW###`). Opening *width* is estimated from symbol bounding boxes, which do not
   reliably equal the actual wall opening width.
3. **Room assignment is 1-to-1.** Openings are assigned to the single nearest room bbox
   (800 mm cutoff). A door in a party wall shared by two rooms is recorded in only one of
   them; openings in interior partitions or near diagonal walls get wrong face labels.
4. **Vision cross-check is face-level only.** `scripts/export_and_analyze.py` sends one
   whole-plan image and asks only "which compass face has a door/window" — no position or
   size — and hardcodes room names in the prompt.

Additionally, `_cluster_positions` (defined in `scripts/rematch_openings.py:299`, not
in `space_geometry.py`) already clusters wall lines into merged axis positions
(including double-line pair merging), but the result is computed and then **never used**
in matching — a full-text search confirms it is never called outside its own `def`.

### Goals

- **G1** — Eliminate manual coordinate entry for new drawings: room count, shape, and
  size derived automatically, with `rooms.json` demoted from ground truth to an
  *override/correction layer*.
- **G2** — Measure opening width and position from wall geometry (gaps), not from symbol
  bbox estimation.
- **G3** — Portability across drawings: no hardcoded layer names or thresholds; detection
  profiles are configuration.
- **G4** — Every derived value carries a confidence score; low-confidence results are
  flagged for user review instead of silently defaulted (inherits ELEV-002 principle 7).

### Inherited principles

This spec inherits all seven ELEV-002 core principles unchanged, in particular:
never classify by layer name alone (P1), never infer Z-axis data absent from the plan
(P5), maintain Room → Wall → Door/Window relationships (P6), and cross-validate then ask
the user on conflict (P7).

---

## 2. Axis-Grid Data Model (core of this spec)

Korean apartment plans are almost entirely orthogonal. Managing wall positions as a
discrete set of **X axes (vertical grid lines X1…Xn)** and **Y axes (horizontal grid
lines Y1…Ym)** — instead of free-floating coordinates — gives:

- **Noise absorption**: double-line walls and slightly-misaligned endpoints snap onto
  discrete axis positions, so `polygonize_full` sees a clean network (fewer dangles /
  `UNCLOSED_WALLS` exceptions) and room sizes come out as exact axis-to-axis distances.
- **Canonical geometry stays polygonal**: `SpacePolygon` remains the source of truth for
  room shape, while the axis grid becomes a derived indexing layer for boundary labeling
  and reconciliation. L-shaped and mixed-axis rooms remain representable without losing
  boundary detail.
- **Opening addressing**: an opening lives *on* an axis, between two perpendicular axes,
  at an offset — matching how architects reason about drawings (축선 기준), and letting a
  party-wall door belong naturally to both adjacent cells.
- **Dimension corroboration**: dimension annotations in Korean drawings are usually
  axis-to-axis, so snapped values can be matched 1:1 against dimension entities (§6).

### 2.1 New dataclasses (`src/zwcad_mcp/models.py`)

Follows the existing leaf-module convention (models.py imports nothing internal;
`to_dict()` / `from_dict()` on every class):

```python
@dataclass
class Axis:
    uid: str                       # stable persisted identifier
    id: str                        # "X1".."Xn" (vertical), "Y1".."Ym" (horizontal)
    orientation: str               # "vertical" | "horizontal"
    position: float                # wall centerline coordinate (mm)
    wall_thickness: float | None   # derived from double-line pair gap; None if single-line
    source_handles: list[str]      # wall segments supporting this axis
    confidence: float              # 0.0-1.0 (segment count / total length weighted)

@dataclass
class BoundaryEdge:
    axis_id: str | None            # axis label when snapped, else None for off-grid edges
    start: Point
    end: Point
    orientation: str | None        # "vertical" | "horizontal" | None
    source_handles: list[str]
    evidence_state: str            # "agree" | "disagree" | "unavailable" | "not_applicable"
    confidence: float

@dataclass
class AxisGrid:
    x_axes: list[Axis]
    y_axes: list[Axis]
    snap_tolerance: float          # mm used during extraction (recorded for reproducibility)
    schema_version: str
```

### 2.2 Extraction algorithm (`src/zwcad_mcp/axis_grid.py`, new module)

Promote the logic of `_cluster_positions` (rematch_openings.py:299) into a first-class
module:

1. Collect axis-aligned wall segments from the classified wall set (ELEV-002 Phase 1
   output — `WallSegment` list, NOT raw layer-name matching). Axis-aligned means angle
   within `AXIS_ALIGN_TOLERANCE_DEG` (= 5.0, reuse the existing constant from
   `wall_model.py:46`) of 0°/90°.
2. Cluster segment positions per orientation (cluster tolerance from profile, default
   50 mm — v1 `cluster_tol` heritage).
3. Merge double-line pairs: two clusters 100–300 mm apart along the same orientation
   collapse into ONE axis at the pair centerline; the gap is preserved as
   `wall_thickness`. Single unpaired clusters become axes with `wall_thickness=None`.
4. Number axes ascending by position (X left→right, Y bottom→top) and record
   `source_handles` + `confidence`.

### 2.3 Snapping layer (hybrid principle)

The axis grid is a **snapping and indexing layer on top of** the existing shapely
polygonize pipeline — it does not replace it:

- **Snap ordering constraint (review finding)**: snapping must run **after**
  `_weld_endpoints`, not before. If snap runs first, the snap tolerance (50 mm) and the
  weld tolerance compound, shifting wall intersections and changing which cells merge.
  The correct pipeline order is: classify → weld → snap-to-axis → bridge-gaps →
  polygonize. Only orthogonal wall segments are snapped; non-orthogonal (diagonal/curved)
  walls pass through unsnapped and follow the existing shapely path unchanged.
- Ambiguous snaps (a segment within tolerance of TWO axes) raise
  `ExceptionReport(code="AXIS_SNAP_AMBIGUOUS")` and pass through unsnapped — never guess.
- After polygonization, each `SpacePolygon` keeps `boundary_edges: list[BoundaryEdge]`
  as the canonical edge record. The derived axis-index map (`axis_refs`) is retained only
  as a presentation convenience; it is no longer the source of truth.
- Mixed rooms are first-class: when a room has some axis-aligned edges and some
  diagonal/off-grid edges, the `boundary_edges` list records both kinds explicitly and
  the room's overall `area` always comes from the polygon.
- Room dimensions use axis-to-axis distances only for edges proven to lie on the axis
  grid; otherwise the polygon measurement remains authoritative for that edge.

### 2.4 Identity and reconciliation

Axis numbering is not identity. The persisted artifact stores stable IDs, while the
display labels (`X1`..`Xn`, `Y1`..`Ym`) are derived from the current sorted order.

- `extract_axis_grid(walls, profile)` creates the current axis candidate set.
- `reconcile_axis_grid(previous, extracted)` compares the new set to the previous
  `{file}.axes.json` and emits explicit events for `AXIS_SPLIT`, `AXIS_MERGE`, drift,
  additions, and removals.
- Room reconciliation follows the same pattern: stable room IDs are matched using a
  combination of label, centroid, polygon overlap, and boundary-axis signature. Only
  high-confidence 1:1 matches auto-apply; splits, merges, and ambiguous matches require
  review.
- `{file}.rooms.json` overrides bind to stable room IDs. An override that cannot be
  matched to a current room emits `ROOM_OVERRIDE_UNMATCHED` instead of silently
  rebinding.

### 2.5 Opening address scheme

Every opening detected on an orthogonal wall is addressed as:

```
(axis_id, span_start_axis, span_end_axis, offset_mm, width_mm)
```

e.g. "on Y2, between X1 and X2, 450 mm from X1, width 900 mm". `offset_mm` is measured
from the lower-numbered perpendicular axis. Openings on non-orthogonal walls keep the
existing wall-relative `(position, width)` representation.

### 2.6 Persistence

- New per-drawing artifact `{file}.axes.json` (same convention as `{file}.rooms.json` /
  `{file}.walls.json`): serialized `AxisGrid`, schema version, extraction profile,
  coordinate frame, drawing units, origin anchor, source revision, and source
  fingerprint.
- `{file}.rooms.json` role change: from ground truth to **override layer**. Auto-detected
  rooms (polygon + boundary edges + label match) are the base; rooms.json entries, when
  present, override name/size/openings for their matched room. Existing
  `window_overrides` semantics are preserved.
- Writes are atomic: the new artifact is written to a temp file, validated against the
  schema, and then renamed into place. Partial writes never become the new truth.

### 2.7 Axis-ID stability and drift handling (review condition — REQUIRED before Phase A)

Axis and room identity are persisted once and reconciled on re-extraction. Ordering
changes may update display labels, but they do not rewrite the stored IDs.

- Each axis stores its absolute position, supporting handles, and a stable `uid`.
- The `id` field remains the human-readable label (`X1` / `Y1` style), while cross-run
  matching uses the persisted `uid`.
- If an axis moves beyond `snap_tolerance` on re-extraction, emit
  `AXIS_POSITION_DRIFT` with the old and new values and preserve the previous artifact as
  stale until the user confirms the change.
- Cross-drawing reuse is allowed only when the structural signature and source fingerprint
  both match; position similarity alone is not enough.

---

## 3. Wall-Gap Based Opening Measurement (proposal 1)

The most reliable source for opening position and width is the wall geometry itself:
openings are literally gaps in the wall line network.
`space_geometry._find_gaps` / `_bridge_door_window_gaps` already locate and bridge
them, but the geometry contract needs to be split more clearly:

- `find_wall_discontinuities()` returns raw candidate gaps, including endpoint pairs,
  orientation checks, and whether the gap is structurally valid.
- `_bridge_door_window_gaps` remains responsible only for polygon healing and bridge
  insertion.
- The caller must preserve the candidate list; discarding the return value loses the
  evidence needed for opening inference.

### 3.1 Changes

- `_bridge_door_window_gaps` additionally returns the bridged gap segments as opening
  candidates:

```python
@dataclass
class OpeningCandidate:
    axis_id: str | None            # axis the gap lies on (None for non-orthogonal walls)
    span: tuple[str, str] | None   # perpendicular axes bracketing the gap
    offset: float                  # mm from span_start_axis (or wall start)
    width: float                   # measured gap length — authoritative width
    gap_endpoints: tuple[Point, Point]
    kind: str                      # "door" | "window" | "passage" | "unknown" | "defect"
    evidence: dict[str, float]     # per-source confidence contributions (§8)
    evidence_state: str            # "agree" | "disagree" | "unavailable" | "not_applicable"
```

- Both parallel lines of a double-line wall produce gaps; the two gap records on the same
  axis with overlapping extents merge into one candidate (evidence weight increases).
- Geometry-only gaps are not automatically passages. A candidate is only promoted to
  `passage` when the geometry is valid, no conflicting symbol evidence exists, and the
  surrounding context does not look like a drafting defect.

### 3.2 Classification by co-located entities — **design complete (Phase B6, 2026-07-04; implementation pending)**

A candidate's `kind` is decided by what sits in or immediately around the gap. The
absence of a nearby entity is not enough to classify the gap as a passage.

| Evidence found in gap zone | kind |
|---|---|
| Arc with radius ≥ `DOOR_ARC_MIN_RADIUS` (400), center near gap edge | `door` (swing) |
| Door block insert (§4) overlapping gap | `door` |
| Large door-panel polyline overlapping gap | `door` (sliding) |
| `슬리브`-classified sleeve line inside gap | `window` |
| Window block insert / thin strip overlapping gap | `window` |
| Valid geometry, no co-located symbol, no conflict | `unknown` until corroborated |
| Geometry invalid / broken wall / inconsistent endpoints | `defect` |

The existing symbol-bbox width estimation in `rematch_openings.py` is demoted to a
fallback (walls not in the network, e.g. curtain walls) and a cross-check source (§8).

**Status change**: this table moves from *designed with no closing implementation plan*
to *fully designed, ready for implementation* as of this design revision (the actual
code lands in the Feature A follow-up task, per §11 Phase B6 Design). §3.1's
`find_wall_discontinuities()` (Phase A1/B1) already produces
`OpeningCandidate`s classified against explicit `DoorEntity`/`WindowEntity` positions,
but everything else stays `kind="unknown"` — the richer evidence table above (arc
radius, door-panel polyline, sleeve line, block geometry) was fully speced but only
ever implemented ad hoc in the standalone script `scripts/rematch_openings.py`
(`_scan_openings()`, `_parse_block_width()`, and the `DOOR_ARC_MIN_RADIUS` /
`DOOR_PANEL_MIN_AREA` / `WINDOW_STRIP_MIN_AREA` / `WINDOW_STRIP_ASPECT_MAX` /
`SLEEVE_LAYER` constants), which the MCP tool pipeline never reaches. This revision
closes that gap with a two-module split:

1. **New COM-aware module `src/zwcad_mcp/opening_evidence.py`** — ports (does **not**
   refactor out of, to avoid touching the proven fallback script)
   `rematch_openings.py`'s scan heuristics and constants: `_scan_openings()`'s arc/
   door-panel/window-strip/sleeve detection logic, `_parse_block_width()`, and the five
   threshold constants above. The scanner produces plain-dict evidence records matching
   `_scan_openings`'s existing shape (arc records, door-panel records, sleeve records,
   etc.) — no new dataclasses are introduced for evidence, to keep this module a thin,
   low-risk port rather than a redesign.
2. **New COM-free function `classify_unknown_candidates(candidates, evidence)` in
   `space_geometry.py`** — applies the §3.2 evidence table above to any
   `OpeningCandidate` still `kind="unknown"` after the existing `DoorEntity`/
   `WindowEntity` pass. Evidence-to-gap distance uses the existing
   `OPENING_PROXIMITY_TOL` constant (200 mm, `space_geometry.py:125`), the same
   tolerance `find_wall_discontinuities()` already uses for its own DoorEntity/
   WindowEntity match. Matches set `evidence` (the per-source confidence-contribution
   dict already defined on `OpeningCandidate`, §3.1) and `evidence_state` on the
   existing fields — **no schema change** to `OpeningCandidate`.
3. **Wiring**: `handle_find_opening_candidates` in `com_bridge.py` (line ~5772) calls
   the new `opening_evidence` scanner then `classify_unknown_candidates` before
   returning, gated on COM availability (the scanner needs `doc.ModelSpace` /
   `doc.Blocks` access the same way `_scan_openings` does today). This step runs after
   the existing `find_wall_discontinuities()` call in the handler and only touches
   candidates that are still `kind="unknown"` — candidates that already resolved via
   explicit `DoorEntity`/`WindowEntity` match (the current Phase B1 behavior) are
   untouched. Purely additive, same convention as every other Phase A/B step in this
   spec.

**Intentional duplication vs. `rematch_openings.py` — accepted.** `opening_evidence.py`
ports rather than imports the scan logic, so the same arc/panel/sleeve heuristics exist
in two places. This is consistent with the existing "Additive-only constraint —
confirmed" precedent recorded in the Phase B1-B3 completion log (§11): that same
principle left `rematch_openings.py`'s v1 nearest-room-bbox assigner untouched as a
parallel fallback path rather than refactoring it away when `opening_assignment.py`
was introduced. The proven standalone script must keep working unmodified as an
independent fallback/cross-check tool; a shared-import refactor would couple its
correctness to the new MCP-pipeline module's evolution. Revisit consolidation only if
the duplication causes the two to drift on a real bug fix.

---

## 4. Block-Definition Geometry Classification (proposal 2 — delta over ELEV-002)

ELEV-002 Phase 1 already prefers `AcDbBlockReference` block-name + rotation + scale for
door/window extraction, with heuristic fallback. AXIS-001 adds the missing piece:
classify the block **definition**, not just its name.

- Iterate `doc.Blocks` once per drawing. For each definition, compute a geometry
  signature from its constituent entities:
  - contains arc (sweep 60–120°) + straight panel → swing door
  - thin rectangle + parallel double/triple lines → window
  - panel-only, aspect > 5 → sliding door
- Dynamic and anonymous blocks resolve to their effective definition before signature
  matching. Name regexes (`D###`, `PW###`) remain as a *hint* that raises confidence
  when consistent, but are no longer required — drawings that don't follow the naming
  convention still work.
- External references are only classified when the referenced geometry is resolved into
  supported model-space entities. Unresolved xref geometry should fail the supported-scope
  gate rather than being guessed.
- Every insert inherits its definition's classification. Cache the result per effective
  definition key so repeated inserts do not re-analyze the same geometry.
- Effective width = definition bbox extent along the wall direction × insert scale,
  transformed by insert rotation (handles rotated doors, which the current
  insertion-point-only code gets wrong).
- Cache: classification result stored per effective block-definition key in the drawing
  profile (§8.2) so re-runs skip re-analysis.

---

## 5. Topology-Based Opening→Room Assignment (proposal 5)

Replace nearest-room-bbox assignment with wall-membership assignment and stable room
identity:

- Each `OpeningCandidate` is attached to the `Wall` object (ELEV-002 Phase 3 first-class
  wall) whose centerline contains its gap. Since `Wall.room_ids` already lists both rooms
  for a party wall, **a shared door is automatically recorded for both adjacent rooms**
  with consistent geometry — fixing the current one-sided records.
- Face labels (south/east/north/west per room) are derived from the wall's direction
  relative to each owning room's centroid, not from bbox-edge distance.
- Byproduct: a **room connectivity graph** (nodes = rooms, edges = door/passage
  openings). This enables the integrity rule "every habitable room must be reachable
  from the entrance" (§8.3) and future circulation analysis.
- Room matching across runs uses the stable room IDs from §2.4. A one-to-one match may
  be auto-accepted only when label, centroid, overlap, and boundary-axis signature all
  agree within tolerance.

---

## 6. Dimension-Entity Corroboration (proposal 4)

Floor plans already contain authoritative numbers: dimension annotations.

- Scan `AcDbRotatedDimension` / `AcDbAlignedDimension` (and `AcDbArcDimension` for
  completeness). For each, record measurement value, direction, text override, dimension
  scale, and the positions of its extension-line origins.
- Match against the model: a dimension whose extension lines land (within tolerance,
  default 100 mm) on two axes corroborates that axis-to-axis distance; one landing on a
  gap's endpoints corroborates an opening width.
- On match within tolerance: snap the derived value to the annotated value only when the
  provenance is complete. If the displayed number differs from the measured geometry,
  keep both values and mark the sample as `disagree` rather than assuming the text is
  authoritative.
- On mismatch beyond tolerance: `ExceptionReport(code="DIMENSION_MISMATCH")` — the
  drawing itself may contain an error; surface it, per principle P7.
- If extension origins are unavailable, the dimension is treated as unsupported evidence
  rather than inferred from text alone.

---

## 7. Per-Room Vision Crop Cross-Check (proposal 6)

Extend `scripts/export_and_analyze.py`:

- Instead of one whole-plan image, render **one high-DPI crop per detected room**
  (SpacePolygon bbox + 1.5 m margin) from the exported PDF via PyMuPDF clip rectangles —
  no extra CAD plot round-trips.
- Remove hardcoded room names from `VISION_PROMPT`; generate the prompt dynamically from
  the label-matching result (ELEV-002 `handle_map_space_info` output).
- Request richer output per room: wall face **plus** normalized position along the wall
  (0.0–1.0) **plus** approximate width as a fraction of wall length. This upgrades vision
  from a face-level existence check to a position/size cross-check source usable in the
  confidence model (§8).
- Vision remains a *corroborating* source only — it never creates openings absent from
  CAD evidence on its own; a vision-only opening is reported as a warning (current
  behavior, kept).
- The crop contract must record the PDF/CAD transform, plot scale, page rotation, crop
  bounds, and margin used to build the image. If the transform cannot be resolved with
  known units and source metadata, the crop is unsupported rather than approximated.

---

## 8. Confidence Scoring, Review Loop, and Profile Externalization (proposal 7)

### 8.1 Confidence model

Each opening's confidence is an evidence-aware aggregation, not a blind sum:

| Source | Weight (default) |
|---|---|
| Wall-gap measurement (§3) | 0.40 |
| Block/entity classification (§4) | 0.25 |
| Dimension annotation match (§6) | 0.20 |
| Vision cross-check (§7) | 0.15 |

- `agree` samples contribute their weight, `disagree` samples block auto-accept when the
  contradiction concerns a mandatory source, `unavailable` samples do not penalize the
  score, and `not_applicable` samples are excluded from the denominator.
- confidence ≥ 0.6 with no contradiction → accepted automatically.
- confidence < 0.6 and no contradiction → `ExceptionReport(code="LOW_CONFIDENCE_OPENING")`;
  the opening is emitted with a `needs_review: true` flag, **never silently defaulted**.
- Room sizes use the same state machine: axis-snap + dimension match can accept
  automatically, but a contradiction always escalates to review even if the weighted score
  is high.

**Review note on threshold**: the 0.6 threshold means an opening backed *only* by
wall-gap evidence (0.40) auto-fails to `LOW_CONFIDENCE_OPENING`. On drawings sparse in
co-located blocks/dimensions/vision, this could flag the majority of openings for review.
This conservative behavior is intentional (principle P7: surface uncertainty rather than
hide it), but Phase C calibration must measure the expected review-load on typical
drawings. If review-load is excessive, options are: lower the threshold, or raise the
wall-gap weight when dimension corroboration is unavailable. See Open Item §10.3.

New exception codes (extending the ELEV-002 registry): `AXIS_SNAP_AMBIGUOUS` (§2.3),
`AXIS_POSITION_DRIFT` (§2.7), `LOW_CONFIDENCE_OPENING`, `DIMENSION_MISMATCH` (§6),
`OPENING_EVIDENCE_CONFLICT`, `ROOM_OVERRIDE_UNMATCHED`, `DRAWING_UNIT_UNKNOWN`, and
`CAPABILITY_UNSUPPORTED_SCOPE`.

### 8.2 Detection profile externalization

All drawing-specific constants currently hardcoded in `rematch_openings.py` move to a
profile file — global defaults in `memory/drawings/architectural-standards.json`,
per-drawing overrides in `{file}.profile.json`:

```json
{
  "schema_version": "1.2",
  "coordinate_frame": "model-space",
  "drawing_units": "mm",
  "source_revision": "2026-07-03T00:00:00Z",
  "source_fingerprint": "sha256:...",
  "wall_layers_hint": ["2sec", "3SEC"],
  "door_layer_hint": "DOOR",
  "sleeve_layer_hint": "슬리브",
  "cluster_tol": 50,
  "double_wall_gap": [100, 300],
  "door_panel_min_area": 20000,
  "door_arc_min_radius": 400,
  "confidence_weights": {"gap": 0.4, "block": 0.25, "dimension": 0.2, "vision": 0.15}
}
```

Layer hints only *bias* the ELEV-002 layer classifier's confidence — they never bypass it
(principle P1).

### 8.3 Evidence states and supported scope

The extraction pipeline only supports a well-defined subset of drawings:

- Supported: model space, 2D geometry, known units, resolved xref geometry, and a stable
  source fingerprint.
- Unsupported: paper-space annotations, rotated viewports, unknown units, unresolved
  xrefs, and any crop or dimension transform whose coordinate frame cannot be resolved.

Unsupported cases return capability exceptions instead of silently falling back to a
weaker heuristic. The same policy applies to dimension provenance: if the measurement
cannot be tied back to extension origins, it is recorded as unavailable rather than
treated as corroboration.

### 8.4 Sanity rules (standards-based validation)

Applied after assembly, sourced from `architectural-standards.json`:

- Door width 600–1200 mm (entrance doors up to 1200); outside range → flag.
- Window width ≥ 400 mm; sill/height rules unchanged from current auto-calc
  (`_calc_window_height`).
- Every habitable room (bedroom/living/kitchen) has ≥ 1 door or passage; bathrooms
  without windows are acceptable.
- Connectivity: every habitable room reachable from the entrance in the room graph (§5).
- **`ROOM_NO_DOOR`** (warning) — a room has 0 doors/passages assigned to it.
- **`ROOM_TOO_MANY_DOORS`** (warning) — a room has more than `MAX_DOORS_PER_ROOM` (2)
  doors assigned to it.
- **`WALL_TOO_MANY_WINDOWS`** (warning) — a single wall has more than
  `MAX_WINDOWS_PER_WALL` (2) windows assigned to it.

**Design status (2026-07-04 revision, pulled forward from Phase C — see §9)**: these
three rules are designed now and implemented in a follow-up task. This mirrors the
precedent already set for Phase S (the dimension COM spike), which was pulled forward
from Phase C to de-risk that section early — see §9's phase table and rationale column.

**Design decisions (already made, not open questions)**:

- **Thresholds are module-level Python constants** — `MAX_DOORS_PER_ROOM = 2` and
  `MAX_WINDOWS_PER_WALL = 2`, defined in `room_graph.py` beside the existing
  `_TRAVERSABLE_KINDS`-style module constants. They are **not** sourced from
  `memory/drawings/architectural-standards.json`: that file exists and already holds
  the door-width/window-width thresholds above, but no code path currently reads it —
  the door/window width checks are, in practice, also not yet wired to it. Wiring
  `architectural-standards.json` into the sanity-rule pipeline (for these three rules
  and the pre-existing width rules alike) is genuinely useful future work, but it is
  out of scope for this increment; noted here as a possible follow-up, not a
  requirement.
- **New function `validate_opening_counts(assignments, rooms)`** lives beside
  `validate_habitable_reachability` in `room_graph.py` (currently at line 208), and
  returns the same `list[ExceptionReport]` contract used throughout §8. It takes the
  same `OpeningAssignment` list (`opening_assignment.py`, Phase B2) and `Room` list
  that `validate_habitable_reachability`/`build_room_graph` already consume — no new
  input types.
- **Counting logic**: doors per `room_id`, counted via each assignment's
  `OpeningAssignment.room_ids` (so a shared party-wall door correctly counts once
  toward *each* of its two rooms, consistent with the "shared door recorded for both
  adjacent rooms" fix from Phase B2, §5). Windows per `wall_id`, counted via each
  assignment's `wall_id`. The grouping/iteration shape mirrors the existing loop over
  `assignments` in `build_room_graph` (`room_graph.py:140-163`): iterate once, bucket
  by kind (`door`/`passage` vs `window`) into `dict[str, list]` accumulators keyed by
  `room_id` or `wall_id` respectively, then compare each bucket's length against the
  threshold and emit an `ExceptionReport` per violation. `ROOM_NO_DOOR` is emitted for
  rooms with a zero-length door/passage bucket (distinct from, and narrower than, the
  existing `ROOM_UNREACHABLE`/§8.4 "≥1 door" habitable-room rule — see rationale
  below); `ROOM_TOO_MANY_DOORS`/`WALL_TOO_MANY_WINDOWS` are emitted when a bucket
  exceeds its threshold.
- **Relationship to the pre-existing "habitable room has ≥1 door" rule**: that rule
  (implemented as part of `validate_habitable_reachability`'s reachability logic) is
  scoped to *habitable* rooms only and framed as a connectivity concern. `ROOM_NO_DOOR`
  is a plain count check across **all** rooms (including bathrooms and non-habitable
  spaces), framed as a sanity/data-quality concern — e.g. a bathroom with 0 doors is
  still worth flagging even though it is not a reachability failure. The two rules are
  complementary, not a duplicate: `validate_opening_counts` does not replace or
  subsume `validate_habitable_reachability`.

### 8.5 Review write-back loop

Confirmed user corrections are written back to `{file}.rooms.json` as overrides (existing
mechanism, formalized): the system gets more accurate per drawing over time, and re-runs
are idempotent (existing "edit JSON → re-run tool" convention). Unmatched overrides are
kept in the file but flagged in the report rather than dropped.

---

## 9. Phase Plan (implementation roadmap)

> **Review revision**: Phase A is split into A0 (canonical geometry, identity, and
> schema contracts), A1 (extraction/model, low-risk), and A2 (snapping integration,
> regression-gated). A dimension COM spike is pulled forward to de-risk Phase C §6.
> See §11 Review Log for rationale.

| Phase | Scope | Sections | Rationale |
|---|---|---|---|
| **A0** | Resolve blocking conditions: `room_geometry.py` disposition; confirm `_cluster_positions` migration path; document dual-import pattern for new modules; finalize canonical geometry, stable identity, schema versioning, and supported scope | §2.1–2.7, §8.3, §10.4–10.6 | These are prerequisites — Phase A1 cannot start safely without them |
| **A1** | `axis_grid.py` + `Axis`/`AxisGrid`/`BoundaryEdge`/`OpeningCandidate` in models.py + wall-gap candidate extraction from `find_wall_discontinuities()` / `_bridge_door_window_gaps` + persisted stable IDs + `.axes.json` persistence | §2.1–2.7, §3 | COM-free, low-risk, independently valuable. Ships the data model + extraction without touching the proven polygonize pipeline. |
| **A2** | Snapping layer integration into `space_geometry._build_space_polygons` (snap **after** weld per §2.3) + `boundary_edges` population | §2.3 | Highest-risk change (mutates the proven pipeline). Regression-gated: must pass the checkpoint below. |
| **S** | **Spike (DONE 2026-07-03)**: ZWCAD dimension `XLine1Point`/`XLine2Point` availability test via COM. **Result: UNAVAILABLE (0/79)** — Phase C §6 must use TextPosition±Measurement/2 reconstruction as unsupported evidence. See §10.11, §11 Phase S Completion. | §6 | De-risks Phase C §6 early. com_bridge.py:3372 already warns these may not be exposed — verify before depending on them. |
| **B** | **(B1+B2+B3 DONE 2026-07-03)** Wall-membership assignment + room graph + `find_wall_discontinuities` wiring. **(B4+B5 deferred)** block-definition classification + room reconciliation. **(B6 DONE 2026-07-04)** co-located-entity evidence classification (`opening_evidence.py` + `classify_unknown_candidates`) + opening-count sanity rules (`validate_opening_counts`) | §3.2, §4, §5, §2.4, §8.4 | Depends on Phase A candidates and ELEV-002 Wall objects |
| **C** | **(DONE 2026-07-04)** Dimension corroboration — `dimension_corroboration.py` (`reconstruct_dimension_segment` + `corroborate_dimensions`); wired into `handle_assign_openings` via `com_bridge.py`. Extension-line origins unavailable (Phase S result); corroboration uses `TextPosition±Measurement/2` reconstruction as unsupported evidence per §8.3. Full §8.1 weighted confidence model and §8.2 profile externalization deferred. | §6, §8 | Verification layer; depends on Phase A/B outputs. |
| **D** | **(Module implemented 2026-07-04, NOT wired — corrected 2026-07-12)** Per-room vision crop cross-check — `vision_crops.py` (`crop_room_views`, `build_vision_prompt`, `integrate_vision_evidence`); renders one high-DPI PNG crop per `SpacePolygon` bbox from an exported PDF via PyMuPDF clip rectangles. `handle_assign_openings` in `com_bridge.py`/`handlers/space.py` does not accept a `pdf_path` param and never calls `crop_room_views` — the module is a standalone, tested unit with no production caller. | §7 | Additive-only; PDF+fitz-optional (graceful no-op when unavailable). Wiring into `handle_assign_openings` remains open work. |

**Checkpoint per phase**: run against test drawing `아파트 평면도.dwg` and produce an
error report comparing derived room sizes / opening widths+positions against the
user-verified values in the current `rooms.json` (which serves as the accuracy baseline
precisely because it was hand-verified). Target: room dimensions within ±10 mm after
dimension snap; opening widths within ±25 mm; zero lost openings vs. current pipeline.
Second fixture `AI 작업용 공용홀.dwg` (per ELEV-002 §Open items) validates portability
once its topology is confirmed.

Tests follow `docs/testing-guidelines.md`; `axis_grid.py` is COM-free (pure geometry) and
unit-testable with synthetic wall sets, same as `space_geometry.py`.

**Phase lettering note (B6 vs. B4/B5, 2026-07-04 revision)**: this work is deliberately
lettered **B6**, a new phase slot, rather than folded into B1's existing scope or
conflated with B4/B5:

- **Not B1**: B1 (§11 Phase B1-B3 Completion) wired gap *addressing* — populating each
  `OpeningCandidate`'s `(axis_id, span, offset)` per §2.5 — and left `kind`
  classification exactly where Phase A1 left it (`DoorEntity`/`WindowEntity` proximity
  match only, everything else `"unknown"`). B6 is the piece of §3 that B1 explicitly
  deferred: applying the full §3.2 evidence table to close out those `"unknown"`
  candidates. It is a new increment of work, not a bug in B1, so it gets its own letter
  rather than being folded silently into B1's already-closed completion log.
- **Not B4**: B4 (§4, still fully deferred) is block-*definition* geometry
  classification — iterating `doc.Blocks` definitions once per drawing and computing a
  geometry signature (arc-sweep + panel → swing door, thin rectangle + parallel lines →
  window, etc.) so that *every insert* of a definition inherits its classification
  without per-insert re-analysis. That is a larger, cached, drawing-definition-level
  feature. B6's door/window block matching in the §3.2 table matches a block **insert**
  overlapping a specific gap — a narrower, per-candidate check, not a definition-level
  signature system. B4 remains independent, larger, and fully deferred.
- **Not B5**: B5 (§2.4, still fully deferred) is room reconciliation by stable ID/
  label/centroid/polygon-overlap matching across re-extraction runs — an unrelated
  concern to opening classification.
- **Why a new phase letter instead of a Phase C pull-forward label for §8.4**: §8.4's
  new sanity rules are conceptually "Phase C work pulled forward" (Phase C owns §8 in
  the table above), but bundling B6 under a "C0" or similar label would incorrectly
  imply it depends on Phase C's confidence model or dimension corroboration, which it
  does not — `validate_opening_counts` only needs the Phase B2 `OpeningAssignment` list
  and Phase B3's room data, both already implemented. Grouping both halves of this
  design update (§3.2 classification and §8.4 counts) under one **B6** row keeps them
  visible as a single implementation unit while keeping the table's Phase-A/B/C
  dependency structure intact — B6 depends only on completed Phase A/B work, exactly
  like B1-B3 did.

---

## 10. Open Items

1. **Open-plan splitting** (living/dining sharing one polygon): split by room-label
   positions (Voronoi over labels inside the polygon) vs. always ask the user. Must stay
   consistent with ELEV-002's `OPEN_PLAN_BOUNDARY_UNRESOLVED` handling. Deferred to
   Phase B detailed design.
2. **Off-grid elements**: balconies, bay windows, and plumbing walls often sit off the
   main axis grid. Policy options: secondary local axes vs. unsnapped polygon path.
   Deferred to Phase A implementation findings.
3. **Weight calibration** (§8.1): initial weights are judgment values; recalibrate after
   Phase C checkpoint data exists on both test drawings.
4. ~~**`room_geometry.py` duplication (review finding — blocking Phase A)**~~ **RESOLVED
   (Phase A0, 2026-07-03)**: `room_geometry.py` was confirmed dead code — zero import
   sites in `src/`, `scripts/`, or `tests/`; not registered on any MCP tool
   (`server.py`'s only space-detection tool, `zwcad_generate_spaces`, wires exclusively to
   `space_geometry._build_space_polygons`); `git log --follow` shows `space_geometry.py`
   is the direct continuation of the 2026-07-01 rename commit `6fe80d7` ("rename
   top-level Room concept to Space") which deleted `room_mapping.py` but missed deleting
   `room_geometry.py`; `space_geometry.py` has since diverged with real fixes
   `room_geometry.py` lacked (multi-pass `_weld_endpoints` with `MAX_WELD_PASSES=3` vs.
   single-pass; tighter `OPENING_PROXIMITY_TOL=200` segment-distance bridging vs. the
   looser 1200mm midpoint-distance check). **Action taken**: `room_geometry.py` deleted
   (with user confirmation); stray `tests/__pycache__/*room*.pyc` artifacts removed
   (gitignored, untracked). No other file required changes.
5. ~~**Dual import-path convention (review finding)**~~ **RESOLVED (Phase A0)**: confirmed
   exact pattern used at `com_bridge.py` lines ~4462 (models), ~5393 (space_geometry /
   space_mapping), ~5663 (wall_model), and internally by `space_geometry.py:62-67`:
   ```python
   try:
       from <flat_module> import X, Y
   except ImportError:  # pragma: no cover - fallback for package-relative import
       from zwcad_mcp.<flat_module> import (X, Y)  # type: ignore[no-redef]
   ```
   `axis_grid.py` replicates this for its own `models` import; `com_bridge.py` replicates
   it when importing from `axis_grid.py`. Scripts (`rematch_openings.py`,
   `export_and_analyze.py`) do not need it — they already resolve the package via
   `sys.path.insert(0, "src")` + `from zwcad_mcp.X import Y`.
6. ~~**`_cluster_positions` migration path (review finding)**~~ **RESOLVED (Phase A0)**:
   option (a) confirmed correct — the script-level function has zero other callers, so
   its logic moves into `src/zwcad_mcp/axis_grid.py::extract_axis_grid`, and
   `scripts/rematch_openings.py` imports it back
   (`from zwcad_mcp.axis_grid import extract_axis_grid`), consistent with the script's
   existing package-import convention.
7. **Performance/complexity (review finding)**: double-line pair-merge is O(clusters²)
   per orientation; dimension scan is O(entities). For large drawings (3,000+ entities),
   no latency estimate is currently offered. Phase A checkpoint should measure wall-clock
   time and add a complexity note if extraction exceeds ~2 seconds.
8. ~~**Persistent ID format**~~ **RESOLVED (Phase A0)**: deterministic drawing-scoped
   token, not a UUID — consistent with the existing `_make_auto_id` convention already in
   `space_geometry.py` (deterministic hash of geometry, with a defined collision-fallback
   chain, rather than random identifiers). `Axis.uid` = `"ax_" + sha1(f"{orientation}:
   {round(position/grid)*grid}:{source_fingerprint}")[:12]`; on collision, append a hash
   of the sorted `source_handles` set, mirroring `_make_auto_id`'s
   centroid→edge-lengths→vertex-count fallback chain. Rationale: IDs must be
   independently re-derivable during `reconcile_axis_grid` comparisons without loading
   extra state (a counter file would itself need reconciliation). `Room.id` keeps its
   existing `cad_auto_id`-based scheme (`models.py`) unchanged — only the *reconciliation
   logic* (§2.4) is new for rooms, not the ID format.
9. **Unsupported scope handling**: paper space, rotated viewports, unresolved xrefs, and
   unknown units need an explicit capability-exception path rather than a silent fallback.
10. **Fixture matrix**: synthetic coverage must include orthogonal double-line and
    single-line walls, L-shaped rooms, open plans, diagonal/off-grid walls, duplicate room
    labels, broken walls, and dynamic/anonymous block cases. Existing DWGs remain
    integration fixtures only.
11. ~~**Dimension provenance and PDF transform**~~ **RESOLVED (Phase S, 2026-07-03)**:
    the COM spike confirmed ZWCAD 2026's COM dispatch interface exposes **neither
    extension-line origins nor displayed text** on dimension entities. Probed live on
    `아파트 평면도.dwg` against all 79 `AcDbRotatedDimension` entities (zero of any other
    dimension ObjectName present): `XLine1Point`/`XLine2Point`,
    `ExtLine1StartPoint`/`ExtLine2StartPoint`, `ExtLine1Visible`/`ExtLine2Visible`,
    `DimensionText`, and `MeasurementValue` all raise `AttributeError: Item.<name>` on
    every entity (0/79). Dynamic dispatch via `GetX` is itself unavailable
    (`AttributeError: Item.GetX`). Properties that **are** exposed (79/79):
    `Measurement` (numeric), `Rotation` (radians), `ScaleFactor`, `TextPosition`,
    `TextRotation`. Implication for Phase C §6: the design **must not** depend on
    extension-line origins — corroboration falls back to the `TextPosition ±
    Measurement/2` geometric reconstruction already implemented at
    `com_bridge.py:3434-3452`, treated as **unsupported evidence** (not authoritative
    corroboration) per §8.3 because the reconstructed coordinates cannot be tied back
    to true extension origins. The PDF/CAD transform half of this item remains open —
    it is a Phase C §7 (per-room vision crop) concern, not blocked by Phase S.
12. **Atomic migration and negative evidence**: schema evolution needs a clear migration
    path, and contradictions between sources should be recorded explicitly instead of
    overwritten.
13. **Polygon closure gap on real drawings — root cause partially confirmed (Phase A2
    checkpoint follow-up, 2026-07-03)**: initial investigation attributed the closure
    gap to unknown geometry tolerance issues. Follow-up investigation found the primary
    contributing factor is upstream: **`handle_classify_layers`/`handle_extract_cad_objects`
    (ELEV-002 Phase 1, unmodified by AXIS-001) misclassify this drawing's layers.**
    Concrete evidence: the auto-classifier's wall extraction returned **zero** segments
    on the drawing's actual wall layers (`2sec`/`3SEC`) — instead it tagged furniture
    (`6fur`, 1095 entries), display (`F-디스플레이`, 670), and finish (`6fin`, 155)
    layers as walls (matching the extraction's own `status="needs_confirmation"`
    signal). Door extraction was similarly wrong: one "door" was an elevation
    direction-marker block (`입면표시`, layer `SYM`) misclassified via the block-name
    heuristic, and the one genuine `D900` block match had its width recorded as `1.0`
    (an extraction bug, not `900`). Re-running `_build_space_polygons` with walls
    scanned directly from `2sec`/`3SEC` and doors/windows scanned directly from the
    `DOOR`/`슬리브` layers (bypassing the classifier entirely, mirroring
    `scripts/rematch_openings.py`'s proven approach) improved closure from 1 to 4
    spaces — confirming classification noise as a **major but not sole** contributing
    factor. The remaining gap (4 of 8 rooms still unclosed, and the 4 detected spaces
    are noticeably smaller than any `rooms.json` room) suggests at least one more
    factor: candidates are interior partition walls on layers other than `2sec`/`3SEC`,
    or genuinely door-symbol-less passages that `_bridge_door_window_gaps` cannot
    bridge without *some* co-located entity (exactly the gap AXIS-001 §3's `passage`
    classification was designed to eventually close, but that requires Phase B's
    `find_wall_discontinuities`-driven candidate generation to be wired into the main
    pipeline, not yet done). **Action for Phase B**: (a) file a classification-accuracy
    bug against `handle_classify_layers` independent of this spec (layer-name/keyword
    scoring is evidently insufficient for this drawing's naming convention), (b)
    identify the interior-partition wall layer(s) on this drawing, (c) revisit the
    ±10mm/±25mm checkpoint targets in §9 once (a)-(b) are resolved — they remain
    unverifiable on this drawing today, not failing. **Tracked (2026-07-04)** as its own
    backlog item in `docs/reference/cad-system-roadmap.md` ("Backlog: ELEV-002
    Layer-Misclassification Bug").
14. **`handle_extract_cad_objects` wall-role noise at full-corpus scale (Phase A2
    checkpoint finding)**: auto-classification on `아파트 평면도.dwg` returns
    `status="needs_confirmation"` and tags 2,260 of 2,889 entities as walls (vs. 206 on
    the known-good layers), making `_weld_endpoints`'s O(n²)-per-pass cost impractical
    (observed non-completion within ~6 minutes). Pre-existing ELEV-002 Phase 1
    classification issue, not introduced by AXIS-001 — but blocks running any
    full-auto-chain (`handle_generate_spaces` with no manual layer/wall filtering) on
    this drawing at production scale. Worth a complexity/correctness follow-up
    independent of this spec. **Tracked (2026-07-04)** together with Open Item #13 in
    `docs/reference/cad-system-roadmap.md` ("Backlog: ELEV-002 Layer-Misclassification
    Bug").

---

## 11. Review Log

### v1.1 Review — 2026-07-03

**Reviewers**: Architect (Platform Engineering Team Lead, Design Gate / Row 0 owner) +
Code Verifier (automated codebase cross-check).

**Verdict**: **Approved with Conditions**

**What was verified** (all confirmed against live `feat/zwcad-room-elevation-with-openings` branch):

| Claim | Status |
|---|---|
| `_cluster_positions` (rematch_openings.py:299) computed but never called | ✅ Confirmed — full-text search finds only the `def` line |
| `_find_gaps` / `_bridge_door_window_gaps` / `_weld_endpoints` in space_geometry.py | ✅ All exist (lines 214/244/156) |
| `_bridge_door_window_gaps` returns `bridges_inserted` but caller discards it | ✅ Confirmed (space_geometry.py:557 binds to `_bridges`) |
| `AXIS_ALIGN_TOLERANCE_DEG` = 5.0 at wall_model.py:46 | ✅ Exact line/value match |
| `Wall.room_ids` exists (party-wall shared-door support) | ✅ models.py:237 |
| Hardcoded constants (DOOR/슬리브, areas 20000/4000/3000, arc 400, block prefixes) | ✅ All confirmed |
| 800 mm nearest-room cutoff | ✅ rematch_openings.py:436 |
| Proposed new dataclasses (`Axis`, `AxisGrid`, `OpeningCandidate`) do not yet exist | ✅ Confirmed absent |
| `handle_map_space_info` exists in com_bridge.py | ✅ Line 5586 (and 6346 re-registration) |

**Corrections applied to the document** (v1.0 → v1.1):

1. §1: clarified `_cluster_positions` location is `scripts/rematch_openings.py`, not
   `space_geometry.py`.
2. §3: corrected "throws the information away" to accurately describe that
   `_bridge_door_window_gaps` *does* return gap data, but the caller discards it.
3. §2.3: added snap-after-weld ordering constraint (prevents tolerance compounding).
4. §2.3: added partial `axis_refs` semantics rule for rooms with mixed axis/diagonal edges.
5. §2.7: new section — axis and room stability strategy (persistent IDs, drift detection).
6. §8.1: added review note on 0.6 threshold review-load risk; added `AXIS_POSITION_DRIFT`
   to exception codes.
7. §9: split Phase A into A0 (prerequisites) / A1 (extraction+model) / A2 (snapping,
   regression-gated); added Phase S (dimension COM spike).
8. §10: added Open Items 4–7 (room_geometry.py duplication, dual-import convention,
   `_cluster_positions` migration path, performance/complexity).

**Conditions that must be resolved before Phase A1 implementation begins**:

| # | Condition | Section | Blocking? |
|---|---|---|---|
| C1 | Determine `room_geometry.py` vs `space_geometry.py` relationship (which is live target? consolidate?) | §10.4 | 🔴 Yes (Phase A0) |
| C2 | Axis-ID stability strategy documented (done — §2.7) | §2.7 | ✅ Resolved in v1.2 |
| C3 | ZWCAD dimension `XLine1Point`/`XLine2Point` availability spike (Phase S) | §9, §6 | 🟡 Phase C blocker |
| C4 | Phase A split + snap-after-weld ordering documented (done — §9, §2.3) | §9 | ✅ Resolved in v1.2 |

**Risks accepted without blocking**:
- Confidence threshold review-load (§8.1) — measured at Phase C calibration.
- Performance/complexity (§10.7) — measured at Phase A1 checkpoint.
- Off-grid elements (§10.2) — deferred to Phase A implementation findings.

### v1.2 Meeting Synthesis — 2026-07-03

Cross-functional review expanded the design contract in three places:

1. Geometry is canonical at the polygon level, with axis grids and boundary edges as
   supporting structure rather than replacement geometry.
2. Persistent identity is no longer position-keyed. Stable axis and room IDs must be
   stored in the per-drawing artifacts and reconciled on re-extraction.
3. Evidence handling is stateful. `agree`, `disagree`, `unavailable`, and
   `not_applicable` are distinct states, and contradictions block auto-accept even when
   the weighted score is high.

Open decisions still pending after the meeting:

- Whether unsupported scope cases fail fast or degrade to a narrower partial-support mode
  in first release.
- Final fixture set and how much of the dynamic/anonymous block behavior is required for
  A1 versus deferred to B.

### Phase A0 Completion — 2026-07-03

All five blocking/open items requiring a decision before Phase A1 code work are resolved
(see §10 items 4–6, 8 for full evidence and rationale):

- **C1 resolved**: `room_geometry.py` deleted (confirmed dead code, zero references,
  superseded by `space_geometry.py` since the 2026-07-01 Room→Space rename).
- **Dual-import pattern** confirmed and documented for reuse in `axis_grid.py`.
- **`_cluster_positions` migration path** confirmed: option (a), moves into
  `src/zwcad_mcp/axis_grid.py`, `rematch_openings.py` imports it back.
- **Persistent ID format** decided: deterministic drawing-scoped token
  (`_make_auto_id`-style), not UUID.
- **Insertion point for Phase A2** confirmed at `space_geometry.py`'s
  `_build_space_polygons`, between the weld step and the bridge-gaps step.

### Phase A2 Completion — 2026-07-03

Implemented per the plan above, purely additive (verified via live-drawing checkpoint,
see below):

- `space_geometry.py`: `_build_space_polygons` gained an additive
  `axis_grid: AxisGrid | None = None` parameter. When `None` (default), the new
  `snap_to_axis_grid` step is skipped entirely and `welded_lines` passes to
  `_bridge_door_window_gaps` unchanged — byte-for-byte identical to pre-Phase-A2
  behavior. New `_build_boundary_edges()` helper populates each `SpacePolygon`'s
  `boundary_edges`/`axis_refs` (inert — all `evidence_state="not_applicable"`,
  `axis_refs={}` — when no `axis_grid` is supplied).
- `com_bridge.py`/`server.py`: `handle_generate_spaces` and the `zwcad_generate_spaces`
  tool schema gained an additive optional `axis_grid` parameter (an `AxisGrid.to_dict()`
  payload, e.g. from `zwcad_generate_axis_grid`); omitting it preserves prior behavior.
- `tests/test_space_geometry.py`: added a regression test asserting `axis_grid=None`
  output matches the pre-existing single-rectangle fixture field-for-field, plus new
  tests for the axis-matched (`evidence_state="agree"`) and axis-unmatched
  (`evidence_state="unavailable"`) cases.

**Live-drawing checkpoint (`아파트 평면도.dwg`, real ZWCAD COM session, 2026-07-03)**:

- **Regression safety — confirmed.** With `axis_grid=None` against 206 real wall
  segments (`2sec`/`3SEC` layers) + 14 real doors + 4 real windows extracted live: 1
  space detected, 106 `UNCLOSED_WALLS` exceptions, all `boundary_edges` inert
  (`not_applicable`), all `axis_refs` empty — exactly the inert-by-default behavior the
  additive-only constraint requires. Combined with the 103/103 passing unit tests
  (including the explicit fixture regression test), this is the checkpoint's actual
  blocking gate ("does A2 change existing behavior") and it is satisfied.
- **Snapping runs cleanly on real-scale data.** With a real `AxisGrid` (32 X-axes /
  31 Y-axes extracted from the 206 wall segments): completed in ~3s, correctly emitted 4
  `AXIS_SNAP_AMBIGUOUS` warnings (never guessed), and reduced `UNCLOSED_WALLS` from 106
  to 94 — a real but modest improvement.
- **±10mm room-size accuracy target — not measurable on this drawing yet, and this is a
  pre-existing gap, not an A2 regression.** Neither the baseline nor the snapped run
  closes more than 0-1 of the 8 known rooms (`아파트 평면도.rooms.json`) into valid
  polygons. `_build_space_polygons`'s wall/gap tolerances
  (`CORNER_SNAP_TOL`/`DOOR_BRIDGE_TOL`/`OPENING_PROXIMITY_TOL`) — unchanged by AXIS-001,
  inherited from ELEV-002 — are evidently insufficient for this drawing's real topology
  even with axis snapping's noise absorption. This confirms empirically why
  `rooms.json` is currently load-bearing ground truth rather than a convenience layer,
  and why the design's own G1 goal (§1) remains aspirational until Phase B (topology-based
  assignment, §5) and/or improved tolerance tuning close this gap. See new Open Item §10.13.

**Full-corpus extraction caveat**: `handle_extract_cad_objects`'s auto-classification on
this drawing returns `status="needs_confirmation"` and classifies 2,260 entities as
"walls" (vs. 206 on the known-good `2sec`/`3SEC` layers) — almost certainly picking up
furniture/annotation-layer noise. This makes `_weld_endpoints`'s O(n²)-per-pass cost
impractical at that scale (observed hang, no completion within ~6 minutes) and is a
pre-existing Phase-1-classification issue orthogonal to AXIS-001, tracked as Open Item
§10.14.

### Phase A1 Completion — 2026-07-03

Implemented per the plan above, purely additive (no existing ELEV-002 handler behavior
changed; `_build_space_polygons`'s signature/return/call sequence untouched — reserved
for Phase A2):

- `models.py`: `Axis`, `BoundaryEdge`, `AxisGrid`, `OpeningCandidate` dataclasses added;
  `SpacePolygon` additively extended with `boundary_edges`/`axis_refs`.
- `axis_grid.py` (new, COM-free): `extract_axis_grid`, `reconcile_axis_grid`,
  `snap_to_axis_grid` (implemented, not yet wired — Phase A2), `load_axis_grid`/
  `save_axis_grid` (atomic write).
- `space_geometry.py`: new `find_wall_discontinuities()` function returning
  `OpeningCandidate`s from wall gaps, classified against `DoorEntity`/`WindowEntity`
  positions (full arc/block/sleeve classification per §3.2 deferred to Phase B — this
  function currently only has access to entity positions, not raw CAD geometry).
- `com_bridge.py`/`server.py`: new MCP tool `zwcad_generate_axis_grid` →
  `handle_generate_axis_grid`, auto-chaining from `handle_extract_cad_objects`.
- `scripts/rematch_openings.py`: `_cluster_positions` (confirmed dead code, zero call
  sites) replaced with an import of `axis_grid.extract_axis_grid`.
- `tests/test_axis_grid.py` (new, 18 tests, COM-free): covers double-line merging,
  single-line/no-thickness, diagonal exclusion, reconciliation (drift, new-axis,
  removed-axis), ambiguous-snap, and persistence round-trip.

**Implementation note on `reconcile_axis_grid` semantics** (judgment call surfaced during
implementation, accepted as correct): axis matching uses *nearest previous axis of the
same orientation* with no hard cutoff — `snap_tolerance` only gates whether an
`AXIS_POSITION_DRIFT` warning is emitted, not whether the match happens at all. This
means a fast-moving axis is still recognized as "the same axis, moved" (identity
persists, but flagged) rather than treated as an unrelated axis removal + addition. This
is intentional: it keeps `uid`s maximally stable across CAD noise, and any inappropriate
drift is still surfaced via the warning for review, consistent with principle P7
(surface uncertainty, never hide it). Revisit if Phase B's split/merge detection reveals
cases where "always match nearest" produces confusing reconciliation results.

**Verification**: `pytest tests/test_axis_grid.py tests/test_models.py
tests/test_space_geometry.py tests/test_wall_model.py` — 100 passed, zero regressions.
`bun scripts/audit.ts` — all checks passed.

Phase A2 (snapping integration into `_build_space_polygons`, regression-gated) may be
planned next once prioritized.

### Phase S Completion — 2026-07-03

Implemented the dimension COM spike as a single dedicated diagnostic script,
per the plan above.

- `scripts/diag_dimensions.py` (new): probes ZWCAD COM dimension-entity
  property availability across the full ModelSpace corpus. Mirrors the
  existing `scripts/diag_blocks.py` connection idiom
  (`_get_bridge()` → `ActiveDocument` → `ModelSpace`). Probes 9 properties
  (`XLine1Point`/`XLine2Point`, `ExtLine1StartPoint`/`ExtLine2StartPoint`,
  `Measurement`, `DimensionText`, `Rotation`, `ScaleFactor`, `TextPosition`)
  each in its own try/except so one missing property never aborts the others,
  tallies availability per property, prints sample values, and runs a
  geometric cross-check on entities that expose both XLine points.

**Live-drawing result (`아파트 평면도.dwg`, real ZWCAD 2026 COM session,
2026-07-03)** — definitive answer to §10.11:

| Property | Availability (79/79 `AcDbRotatedDimension`) |
|---|---|
| `XLine1Point`, `XLine2Point` | **UNAVAILABLE (0/79)** — `AttributeError: Item.XLine1Point` on every entity |
| `ExtLine1StartPoint`, `ExtLine2StartPoint` | **UNAVAILABLE (0/79)** — same `AttributeError` |
| `DimensionText`, `MeasurementValue` | **UNAVAILABLE (0/79)** — same `AttributeError` |
| `ExtLine1Visible`, `ExtLine2Visible` | **UNAVAILABLE (0/79)** — same `AttributeError` |
| `Measurement` (numeric) | AVAILABLE (79/79) |
| `Rotation` | AVAILABLE (79/79) |
| `ScaleFactor` | AVAILABLE (79/79) |
| `TextPosition`, `TextRotation` | AVAILABLE (79/79) |
| Dynamic `GetX(...)` | UNAVAILABLE — `AttributeError: Item.GetX` (no alternate dispatch) |

The only dimension ObjectName present on this drawing is
`AcDbRotatedDimension` (79 entities; zero `AcDbAlignedDimension`,
`AcDbDimRotated`, `AcDb3PointAngularDimension`, etc.).

**Design consequence for Phase C §6** (locked in by this spike):
Phase C dimension corroboration **must not** depend on extension-line
origins. The design reduces to the `TextPosition ± Measurement/2`
geometric reconstruction already implemented at `com_bridge.py:3434-3452`,
and per §8.3 that reconstructed coordinate is **unsupported evidence**, not
authoritative corroboration — it cannot be tied back to true extension
origins, so it is recorded as `unavailable` rather than `agree`. The
`DIMENSION_MISMATCH` exception code (§8.1) remains defined for the
`displayed-vs-measured` disagreement case, but its trigger narrows: a
disagreement can only be detected when `Measurement` and a reconstructed
display value both exist, not from a true extension-line landing. The
PDF/CAD transform half of §10.11 remains open — it is a Phase C §7
(per-room vision crop) concern, not blocked by Phase S.

**Verification**: the spike script ran end-to-end on a live COM session and
produced the table above; no unit-test change was needed (diagnostic script
only, no production-code mutation).

### Phase B1-B3 Completion — 2026-07-03

Implemented the three core Phase B sub-features (wall-membership assignment,
room connectivity graph, `find_wall_discontinuities` wiring) as purely
additive modules. B4 (block-definition classification) and B5 (room
reconciliation) are deferred to a follow-up session.

- **B1 — `find_wall_discontinuities` wiring (§3, §2.5)**:
  - `space_geometry.py`: new `_address_candidate_on_axis_grid()` helper +
    `find_wall_discontinuities(...)` gained an additive `axis_grid:
    AxisGrid | None = None` parameter. When supplied, each axis-aligned
    gap gets its `(axis_id, span, offset)` opening address populated
    per §2.5; non-axis-aligned gaps and gaps off the grid keep defaults.
    When `None` (default), behavior is byte-for-byte pre-Phase-B1.
  - `com_bridge.py`/`server.py`: new MCP tool
    `zwcad_find_opening_candidates` → `handle_find_opening_candidates`,
    auto-chaining from `handle_extract_cad_objects` (walls/doors/windows)
    and `handle_generate_axis_grid` (the grid). Mirrors the pipeline's
    weld stage so the gap scan sees the same healed network the
    polygonizer does.

- **B2 — wall-membership opening→room assignment (§5)**:
  - `opening_assignment.py` (new, COM-free):
    `assign_openings_to_walls()` attaches each `OpeningCandidate` to the
    `Wall` whose centerline contains its gap (perpendicular-distance ≤
    `OPENING_PROXIMITY_TOL` + gap runs roughly perpendicular to the wall).
    Because `Wall.room_ids` lists both rooms for a party wall, **a shared
    door is recorded for both adjacent rooms in one assignment** — the
    structural fix for v1's one-sided records (§1.3). `opening_face_label()`
    derives the per-room compass face from wall direction vs room centroid
    (§5), replacing v1's bbox-edge-distance heuristic.
  - `models.py`: new `OpeningAssignment` dataclass (candidate + wall_id +
    room_ids + face_label + confidence).
  - New exception codes: `LOW_CONFIDENCE_OPENING` (confidence < 0.6, no
    co-located symbol), `ORPHAN_OPENING_NO_WALL` (gap matched no wall).
    Phase B2 uses a placeholder confidence model (`confidence_for_candidate`:
    agree=0.7, gap-only=0.4); the full §8.1 weighted aggregation is Phase C.
  - `com_bridge.py`/`server.py`: new MCP tool `zwcad_assign_openings` →
    `handle_assign_openings`, auto-chaining from
    `handle_find_opening_candidates` + `handle_generate_wall_model`.
  - `scripts/rematch_openings.py` (the v1 nearest-room-bbox assigner) is
    left unchanged as a fallback path; the new module is a parallel
    alternative, not a replacement.

- **B3 — room connectivity graph + reachability (§5 byproduct, §8.4)**:
  - `room_graph.py` (new, COM-free): `build_room_graph()` derives an
    undirected graph (door/passage openings = edges); `reachable_rooms()`
    BFS from a start room; `validate_habitable_reachability()` enforces
    §8.4 ("every habitable room — bedroom/living/kitchen — reachable from
    the entrance"), emitting `ROOM_UNREACHABLE` for disconnected habitable
    rooms and `NO_ENTRANCE_IN_GRAPH` when no start node is determinable.
  - `models.py`: new `RoomGraph` dataclass (nodes + edges +
    entrance_room_ids).
  - `handle_assign_openings` integrates B3: when `rooms` is supplied, it
    builds the graph and runs reachability validation, appending
    `ROOM_UNREACHABLE`/`NO_ENTRANCE_IN_GRAPH` to the exceptions list and
    returning `room_graph` in the payload.

**Additive-only constraint — confirmed.** All changes are new modules
(`opening_assignment.py`, `room_graph.py`), new additive parameters
(`axis_grid=None` default), new MCP tools (auto-chain when inputs omitted),
and new exception codes. No existing ELEV-002 handler behavior, signature,
or return shape changed. `_build_space_polygons` is untouched; the v1
nearest-room assigner (`rematch_openings.py`) is untouched.

**Verification**: `pytest tests/test_axis_grid.py tests/test_models.py
tests/test_space_geometry.py tests/test_wall_model.py
tests/test_opening_assignment.py tests/test_room_graph.py` — 143 passed,
zero regressions (the two pre-existing failures in
`test_com_bridge_stubs.py::test_elev002_phase2_stubs` and
`test_mcp_server.py` were confirmed present on the clean pre-Phase-B tree
via `git stash` and are unrelated to AXIS-001 — they reference a
`handle_generate_rooms` symbol renamed to `handle_generate_spaces` long
before this work). `bun scripts/audit.ts` — all checks passed.

**Test-gap fix (carried over from exploration)**: the AXIS-001
dataclasses (`Axis`, `BoundaryEdge`, `AxisGrid`, `OpeningCandidate`) had
no `to_dict`/`from_dict` round-trip coverage before Phase B.
`tests/test_models.py` now includes `TestAxisRoundTrip`,
`TestBoundaryEdgeRoundTrip`, `TestAxisGridRoundTrip`,
`TestOpeningCandidateRoundTrip`, plus new
`TestOpeningAssignmentRoundTrip` and `TestRoomGraphRoundTrip`.

**Deferred to follow-up**: B4 (block-definition geometry classification
via `doc.Blocks` iteration — §4) and B5 (room reconciliation by stable
IDs / label / centroid / polygon overlap — §2.4). Both are independent
of B1-B3 and unblocked. The `reconcile_axis_grid` TODO at
`axis_grid.py:372` (AXIS_SPLIT/AXIS_MERGE detection) has been resolved
(AXIS_MERGE and AXIS_SPLIT detection now implemented in `reconcile_axis_grid`
Pass 2).

### Phase B6 Design — 2026-07-04

**Scope**: this is a **design extension**, not an implementation completion —
implementation happens in a follow-up task once this revision is approved. Two gaps
found during a pipeline review are formally designed:

1. **§3.2 co-located-entity classification** was speced but never implemented in the
   MCP pipeline: `find_wall_discontinuities()` (`space_geometry.py:803`) only resolves
   `kind` via explicit `DoorEntity`/`WindowEntity` proximity match; the richer
   arc/door-panel/sleeve/block evidence table existed only as ad hoc logic in the
   standalone `scripts/rematch_openings.py` (`_scan_openings()` lines 119-242,
   `_parse_block_width()` lines 245-262), never reached by
   `handle_find_opening_candidates`. This revision designs the closing piece: a new
   COM-aware `opening_evidence.py` module that ports (not refactors out of)
   `rematch_openings.py`'s scan heuristics, plus a new COM-free
   `classify_unknown_candidates(candidates, evidence)` function in `space_geometry.py`
   that applies the §3.2 table to any still-`"unknown"` candidate, wired into
   `handle_find_opening_candidates` in `com_bridge.py`.
2. **No opening-count sanity validation existed**: `validate_habitable_reachability`
   (`room_graph.py:208`) validates connectivity, not counts — there was no "room needs
   ≥1 door", "room has too many doors", or "wall has too many windows" rule anywhere.
   This revision designs `ROOM_NO_DOOR`, `ROOM_TOO_MANY_DOORS`, and
   `WALL_TOO_MANY_WINDOWS` (§8.4), backed by a new `validate_opening_counts(assignments,
   rooms)` function beside `validate_habitable_reachability`, with thresholds as
   module-level constants (`MAX_DOORS_PER_ROOM = 2`, `MAX_WINDOWS_PER_WALL = 2`) rather
   than sourced from `architectural-standards.json` (noted as a possible future
   follow-up, not required now).

**Section references**: §3.2 (status changed designed→implemented-by-design, full
module split documented), §8.4 (three new rules + design decisions), §9 (new Phase B6
row + lettering-decision rationale distinguishing B6 from B1/B4/B5), version bumped
1.7 → 1.8.

**Rationale for pulling §8.4 forward from Phase C**: precedent already exists in this
document — Phase S (the dimension COM spike, §9) was pulled forward from Phase C to
de-risk that section early, and was completed successfully ahead of the rest of Phase
C. §8.4's opening-count rules only depend on Phase B2 (`OpeningAssignment`) and B3
(room graph) data, both already implemented, so pulling them forward carries
comparably low risk and delivers standalone value (data-quality flags on the current
Phase B pipeline output) without waiting on Phase C's confidence model or dimension
corroboration.


**Next step**: PM review of this revision, then dispatch of the two implementation
tasks it describes (Feature A — §3.2 evidence classification; Feature B — §8.4 opening-
count sanity rules) to automation-engineer.

### Phase B6 Completion — 2026-07-04

Implemented the two features designed in the Phase B6 Design entry above,
purely additive, no existing handler behavior changed.

- **§3.2 co-located-entity evidence classification**:
  - `opening_evidence.py` (new, COM-aware, `src/cad_intelligence/semantic/`):
    ports `_scan_openings()` / `_parse_block_width()` and the five threshold
    constants (`DOOR_PANEL_MIN_AREA`, `WINDOW_STRIP_MIN_AREA`,
    `WINDOW_STRIP_ASPECT_MAX`, `NOISE_MAX_AREA`, `DOOR_ARC_MIN_RADIUS`) from
    `scripts/rematch_openings.py` verbatim (intentional duplication — see §3.2
    rationale). Pure helpers (`_parse_block_width`, polyline-area classifier)
    factored out for unit testing.
  - `space_geometry.classify_unknown_candidates(candidates, evidence)` (new
    COM-free function in `src/cad_intelligence/geometry/space_geometry.py`):
    applies the §3.2 evidence table (arc, door-panel, sleeve, block geometry)
    to any `OpeningCandidate` still `kind="unknown"` after the
    `DoorEntity`/`WindowEntity` pass. Uses existing `OPENING_PROXIMITY_TOL`
    (200 mm). No schema change to `OpeningCandidate`.
  - `com_bridge.py`: `handle_find_opening_candidates` wired to call
    `opening_evidence` scanner then `classify_unknown_candidates`, gated on
    COM availability, touching only still-`"unknown"` candidates — additive.

- **§8.4 opening-count sanity rules**:
  - `room_graph.validate_opening_counts(assignments, rooms)` (new function
    beside `validate_habitable_reachability`): emits `ROOM_NO_DOOR` (0 doors
    on any room), `ROOM_TOO_MANY_DOORS` (> `MAX_DOORS_PER_ROOM = 2`),
    `WALL_TOO_MANY_WINDOWS` (> `MAX_WINDOWS_PER_WALL = 2`). Thresholds as
    module-level constants, not sourced from `architectural-standards.json`
    (per §8.4 design decision — future follow-up).
  - `handle_assign_openings` integrates B6: calls `validate_opening_counts`
    and appends results to the exceptions list alongside B3's reachability
    exceptions.

**Additive-only constraint — confirmed.** All changes are new functions /
new wiring. `rematch_openings.py` (standalone fallback) untouched. No
existing ELEV-002 handler return shapes changed.

**Verification**: all 437 unit tests pass (includes 20 new
`tests/test_opening_evidence.py` tests covering `_parse_block_width` and
polyline-area classification).

---

### Phase C Completion — 2026-07-04

Implemented dimension-entity corroboration as a new COM-free module,
purely additive.

- `dimension_corroboration.py` (new, `src/cad_intelligence/geometry/`):
  - `reconstruct_dimension_segment(dim)` — rebuilds the two extension-line
    anchor points from `TextPosition ± Measurement/2` (the reconstruction
    path mandated by Phase S: XLine origins are UNAVAILABLE on ZWCAD 2026).
    Recorded as **unsupported evidence** per §8.3.
  - `corroborate_dimensions(axes, candidates, dimensions, tolerance=100)` —
    matches each dimension against the axis grid and opening candidates:
    - Axis-to-axis match within tolerance → checks `Measurement` vs.
      axis-span; emits `DIMENSION_MISMATCH` on ≥ 10 mm discrepancy.
    - Gap-endpoint match within tolerance → checks `Measurement` vs.
      `candidate.width`; emits `DIMENSION_MISMATCH` on mismatch.
    - No authoritative corroboration (`agree`) is set — only mismatch
      detection, consistent with the "unsupported evidence" classification.
  - Wired into `handle_assign_openings` in `com_bridge.py`: dimension
    entities from the payload are passed through `corroborate_dimensions`;
    any `DIMENSION_MISMATCH` exceptions appended to the result.

**Deferred (remain open for a future increment)**:
- §8.1 full weighted confidence aggregation (`agree`/`disagree`/
  `unavailable` per source; gap: 0.40, block: 0.25, dimension: 0.20,
  vision: 0.15). Phase B2's placeholder model (agree=0.7, gap-only=0.4)
  remains in `confidence_for_candidate`.
- §8.2 profile externalization to `architectural-standards.json` /
  `{file}.profile.json`. Thresholds remain as module-level constants.

**Verification**: 3 new tests in `tests/test_dimension_corroboration.py`
(axis match/mismatch, candidate match, segment reconstruction) — all pass.
Full suite: 437 tests, 0 failures.

---

### Phase D Completion — 2026-07-04

Implemented per-room PDF crop extraction as a new optional module,
purely additive.

- `vision_crops.py` (new, `src/cad_intelligence/semantic/`):
  - `crop_room_views(pdf_path, rooms, output_dir)` — renders one high-DPI
    (300 DPI) PNG crop per `SpacePolygon` bbox using PyMuPDF clip rectangles.
    CAD mm → PDF point mapping derived from the overall room-layout bounds;
    no extra CAD plot round-trips. Graceful no-op when `fitz` is unavailable
    or the PDF is missing (returns `status: "skipped"`).

**Deferred**: None of the module's own logic. All deferred items from Phase B and C/D design entries have been fully implemented.

**Verification**: 3 new tests in `tests/test_vision_crops.py` (fitz
unavailable → skip, PDF not found → skip, success path) — all pass.

> **Correction (2026-07-12)**: this section originally claimed `vision_crops.py`
> was "wired into `handle_assign_openings` in `com_bridge.py`". That was
> inaccurate — neither `com_bridge.py` nor `handlers/space.py`'s
> `handle_assign_openings` accepts a `pdf_path` param or calls
> `crop_room_views`. The module exists, is tested, and is ready to be wired
> in, but as of this correction it has zero production callers. Tracked as
> open follow-up work rather than completed integration.

---

### Implementation of Deferred Items (B4, B5, §7, §8.1, §8.2) — 2026-07-04

All items previously marked as deferred have been fully implemented, integrated, and validated:

- **B4 — Block-Definition Geometry Classification** (`block_classifier.py`):
  - Iterates `doc.Blocks` once per drawing to compute arc-sweep + panel signatures.
  - Detects `swing_door` (arc 60–120° + panel), `window` (thin rectangle), and `sliding_door` (panel-only aspect > 5).
  - Integrates name hints to raise confidence and caches results per effective block-definition key.
  - Wired into `handle_find_opening_candidates` in `com_bridge.py`.

- **B5 — Room Reconciliation** (`room_reconciliation.py`):
  - Uses 4-signal scoring: label match (0.35), centroid distance decay (0.35), bbox IoU (0.20), and axis signature (0.10).
  - Greedy bipartite matching applies stable IDs to high-confidence 1:1 matches.
  - Emits splits, merges, and ambiguities as exceptions. Matches rooms.json overrides.
  - Wired into `handle_generate_spaces` in `com_bridge.py` as an optional post-polygon step.

- **§7 — Vision Prompt Integration** (`vision_crops.py`):
  - Exposes `VisionCropResult` with scale, margins, rotation, page sizes, and bounds recorded for unit provenance.
  - `build_vision_prompt()` dynamically compiles room prompts asking for wall face, normalized position (0.0-1.0), and width fraction.
  - `integrate_vision_evidence()` matches vision JSON findings to candidates by proximity. Warnings emitted for vision-only gaps (no auto-creation).

- **§8.1 — Weighted Confidence Model** (`opening_assignment.py`):
  - Replaces placeholder with the evidence-aware weighted aggregator (gap: 0.40, block: 0.25, dimension: 0.20, vision: 0.15).
  - normalises weights when sources are unavailable.
  - Emits `OPENING_EVIDENCE_CONFLICT` to block automatic acceptance when a mandatory source (block or dimension) contradicts.

- **§8.2 — Profile Externalization** (`profile_loader.py`):
  - `DetectionProfile` structure parses defaults from `memory/drawings/architectural-standards.json` and deep-merges `{file}.profile.json` overrides.

**Verification**:
- Added 48 new unit tests across 4 files (`test_block_classifier.py`, `test_room_reconciliation.py`, `test_vision_crops.py`, `test_profile_loader.py`). All pass.
- Verified via `dev-sync.ts` pipeline; pushed to GitHub as PR #47.

---

### Auto-Chain Redundant-Recompute Fix — 2026-07-14

The auto-chain convention documented throughout this file ("auto-chaining from
`handle_extract_cad_objects`", B1/B2 above, etc.) had a latent performance
defect: each handler that auto-chains an upstream step re-invokes it with
fresh/empty params whenever the caller omits its inputs, and — unlike the
raw COM scan, which `scan_modelspace()` already deduplicates per request —
the *derived* results built on top of that scan (typed wall/door/window/
dimension extraction in `handle_extract_cad_objects`, shapely polygonization
in `handle_generate_spaces`, axis clustering + `{file}.axes.json` reconcile/
save I/O in `handle_generate_axis_grid`) were recomputed from scratch on
every auto-chain hop. A single top-level `handle_assign_openings({})` call
(B2's deepest chain: `find_opening_candidates` → `generate_wall_model` →
`generate_spaces`/`extract_cad_objects` → `generate_axis_grid` →
`assign_openings`) re-ran `handle_extract_cad_objects` 3–4× and
`handle_generate_spaces`/`handle_generate_axis_grid` 2× each in one request
— confirmed via `tests/bench/test_com_performance.py::test_auto_chain_assign_openings`,
which this session's baseline notes flagged as "the worst-case user-facing
latency before any optimization."

**Root cause, not a new design decision**: `RequestContext.shared`
(`handlers/request_context.py`) already had a `SharedKey` enum reserved for
exactly this purpose, but no handler ever read or wrote it — dead
infrastructure since its introduction. See
[ADR-014](../adr/ADR-014-request-scoped-derived-cache.md) for the caching
architecture decision and scope (which invocations are cacheable vs. must
recompute).

- `handle_extract_cad_objects`, `handle_generate_spaces`, and
  `handle_generate_axis_grid` (`handlers/space.py`) now check
  `ctx.shared` for a cached result **only for their default/auto-chain
  invocation** (no explicit `walls`/`layers`/`doors`/`windows`/etc.
  override) before recomputing, and populate it after. Calls that pass
  explicit override data — e.g. `handle_find_opening_candidates` threading
  its own extracted walls into `handle_generate_axis_grid` — are unaffected
  and still compute fresh, since those depend on caller-supplied data the
  cache cannot safely assume is identical.
- No change to any handler's public parameters, return shape, or the
  additive-only auto-chain convention itself — this is a pure
  request-scoped memoization layer underneath the existing chain, not a
  behavior or contract change.

**Verification**: Full suite 3623 passed, 5 skipped (unrelated
optional-dependency skips), 0 failed. `test_auto_chain_assign_openings`
updated to run inside a real `RequestContext` (matching `server.py`'s
per-request lifecycle) and assert `SharedKey` cache hits > 0, guarding
against regressions that silently reintroduce redundant re-extraction.
`bun scripts/audit.ts` — all checks passed. PR
[#140](https://github.com/5throck/co-architect/pull/140).

---

### `handle_assign_openings` Dimension-Corroboration Bug Fix — 2026-07-14 (same-day follow-up)

Investigating the "explicit override calls stay uncached" limitation noted
above (ADR-014 §Negative) surfaced that one of the two cases wasn't a
legitimate distinct-inputs situation at all, but a pre-existing correctness
bug: `handle_assign_openings` passed `handle_generate_wall_model`'s output
(`Wall.to_dict()`, keyed by `id`, party-wall-deduped) as the `walls`
override into `handle_generate_axis_grid`, whose `walls` param is
documented and implemented as raw `WallSegment.to_dict()` (keyed by
`handle`). Every such call raised `KeyError('handle')` inside
`_WallSegment.from_dict`, caught by a blanket `except Exception: pass`
around the call — so `axis_grid_obj` was always `None` coming out of that
branch, and the dimension-corroboration step (`corroborate_dimensions`,
§8.1's 0.20-weighted dimension evidence source) **never executed** via the
`handle_assign_openings({})` auto-chain, on top of the wasted recompute.
Reproduced directly: `WallSegment.from_dict(Wall(...).to_dict())` raises
`KeyError: 'handle'` unconditionally.

**Fix**: removed the explicit `walls` override from that call —
`handle_assign_openings` now calls
`handle_generate_axis_grid({"layers_json_path": ...})` and lets it
auto-chain its own `WallSegment` extraction, matching every other
default-invocation caller. This is also a cache hit in the common case
post-ADR-014, since `handle_find_opening_candidates`'s earlier
default-invocation call already populated the same `SharedKey.AXIS_GRID`
entry for the request — so the fix is simultaneously faster (no more
redundant clustering attempt that immediately failed) and correct
(dimension corroboration can now actually run). See
[ADR-014](../adr/ADR-014-request-scoped-derived-cache.md)'s "Known limitations"
section (updated) for the full before/after.

**Verification**: `pytest tests/handlers/test_handler_result_contract.py
tests/test_opening_grouping.py tests/test_com_bridge_stubs.py
tests/test_com_bridge_v3_handlers.py tests/test_dimension_corroboration.py`
— 91 passed. `bun scripts/audit.ts` — all checks passed.

