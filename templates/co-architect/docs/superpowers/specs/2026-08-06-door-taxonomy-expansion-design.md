---
lang: ko
lang_reason: source-material
---

# Door Taxonomy Expansion Design

## Context

`DoorClassifier`/`DoorRecognizer` (PR #241-243, merged) gave doors a 5-type Korean
taxonomy (PANEL/MATERIAL/MESH/SLIDING_LIGHT/SLIDING_HEAVY) with confidence-scored
classification, mirroring the window pipeline. Real-drawing verification against
32-pyeong-apartment's `DOOR` layer (see memory
`door-recognition-real-drawing-gap-frameless-parallel.md`) found a **31% no-match rate**
on real geometry. User subsequently supplied two symbol-legend reference images (memory
`door-taxonomy-legend-reference-korean-11-types.md`) confirming a concrete taxonomy gap:
**yeodadimun (standard single-arc swing door) — the single most common Korean residential
door type — has no corresponding rule in any of the 5 existing `door_*.yaml` patterns.**
This is a distinct, separately-confirmed gap from the "frame-less parallel lines" pattern
found in the real-drawing verification, and is very likely a second contributor to the
measured 31%.

Cross-referencing both legend images against the current `EvidenceKind` (7 members:
`FRAME`, `PARALLEL`, `CENTER_LINE`, `ARC`, `DIAGONAL`, `SASH`, `RAIL`) and the 5 existing
rules surfaced **7 total gaps**, of varying implementation difficulty:

| Symbol | Korean | Geometric signature | Implementation difficulty |
|---|---|---|---|
| Standard swing door | yeodadimun | Single swing arc | Low — existing `ARC` evidence suffices |
| Double swing door | ssang-yeodadimun | Two opposing swing arcs | Low — existing `ARC` evidence suffices |
| Revolving door | hoejeonmun | Circle + X-cross | Medium — needs new `CIRCLE` evidence + Detector change |
| Folding/bifold door | jeomnun-mun | Zigzag/V-joint polyline | Medium — needs new `FOLD_JOINT` evidence + Detector change |
| Dashed-frame door | beonjimun | Dashed/hidden linetype frame | Medium — needs entity-level linetype scanning (untested against live ZWCAD) |
| Accordion/curtain door | jureummun | Freehand wavy line (material annotation) | Out of scope — needs spline detection, not designed here |
| Bare threshold opening | chulipgu-ipban | No door leaf at all | Not a taxonomy gap — already correctly represented as `door_style=None` |

**Goal:** extend `DoorStyle` to close the two Low-difficulty gaps (swing doors) and design
(with partial implementation detail) the two Medium-difficulty gaps (rotating, folding)
plus one Medium-difficulty gap contingent on a live-ZWCAD linetype probe (dashed-frame).
Explicitly exclude the two non-gaps (accordion door, bare threshold) from this design.

## Rollout (3 separate PRs, mirroring the PR2 precedent)

Each PR follows the same Pre-Implementation Verification Gate discipline PR2 established:
synthetic golden fixtures confirm exact rule thresholds before trusting them, not assumed.

### PR 3 — `SWING_SINGLE` / `SWING_DOUBLE` (Low difficulty, highest value)

**Rationale for going first:** requires zero changes to `OpeningSymbolDetector`,
`OpeningEvidenceExtractor`, or `OpeningFeatures` — the existing `ARC`
evidence/`arc_count` feature already fully expresses both symbols. Pure YAML-rule
addition, the same shape as PR2's 5 rules. Also the highest-value fix: yeodadimun is both
the most common real-world Korean door type and a directly-measured contributor to the
31% real-drawing gap.

**Components:**

1. **`DoorStyle` enum extension** (`semantic/door_classifier.py`):
   ```python
   class DoorStyle(str, Enum):
       PANEL = "panel"
       MATERIAL = "material"
       MESH = "mesh"
       SLIDING_LIGHT = "sliding_light"
       SLIDING_HEAVY = "sliding_heavy"
       SWING_SINGLE = "swing_single"   # NEW
       SWING_DOUBLE = "swing_double"   # NEW
   ```
   `DOOR_STYLE_MAP` gains `"swing_single_door": DoorStyle.SWING_SINGLE` and
   `"swing_double_door": DoorStyle.SWING_DOUBLE`.

2. **`door_swing_single.yaml`** (new, `patterns/opening/`):
   ```yaml
   rules:
     - id: DOOR-SWING-SINGLE-001
       name: swing_single_door
       domain: door_detection
       requires:
         arc_count: "==1"
         diagonal_count: 0
       prefers:
         frame_count: ">=1"
       base_score: 0.85
       explanation:
         ko: "스윙 호 1개가 감지되어 여닫이문"
         en: "One swing arc detected -- standard hinged door"
   ```
   **`frame_count` is a `prefers`, not a `requires`.** Real-drawing verification found
   arc-swing candidates cluster with small nearby closed-polylines (threshold marks) but
   NOT with frame lines (nearest `AcDbLine` entities were 700-1000mm+ away, well outside
   the 200mm clustering radius) — requiring a frame would silently exclude the exact
   real-world case this PR targets.

3. **`door_swing_double.yaml`** (new): identical shape, `arc_count: ">=2"`,
   `base_score: 0.85` (tie-broken from `swing_single` by requiring strictly more arcs, so
   a 2-arc candidate matches `swing_double` and NOT also `swing_single`'s `==1` gate).

4. **Score-ordering check against existing rules:** `door_mesh.yaml`'s `requires` also
   allows `arc_count: ">=1"`, but additionally requires `frame_count: ">=1"` and
   `diagonal_count: 0` (base_score 0.75, capped at 0.77 after its one `prefers` bonus per
   `rules/registry.py`'s scoring). This means mesh already structurally excludes the
   frame-less arc candidates PR3 targets (real-drawing arc-swing symbols cluster with
   small polylines, not frame lines -- see the `prefers`-not-`requires` decision above) --
   the frame requirement, not just score ordering, is why swing and mesh don't collide.
   Both new swing rules use `base_score: 0.85` regardless, which sorts above mesh's 0.77
   ceiling in `DoorClassifier.classify()`'s `matches[0]` selection with comfortable
   margin for the rarer case where a candidate does satisfy both rules' `requires`.

**Golden fixtures:** `tests/golden/doors/swing_single_01`, `swing_double_01` — mirror the
existing 5 fixtures' JSON shape (see PR2's Verification Gate precedent). Each fixture
should specifically include a small nearby closed-polyline (not a frame line) alongside
the arc, replicating the real-drawing clustering behavior this PR is designed around --
NOT a frame-adjacent arc, which would fail to exercise the `prefers`-not-`requires`
decision above.

### PR 4 — `ROTATING` / `FOLDING` (Medium difficulty, Detector/Evidence layer changes)

**New `EvidenceKind` members** (`semantic/geometry_signature.py`):
```python
class EvidenceKind(str, Enum):
    FRAME = "frame"
    PARALLEL = "parallel"
    CENTER_LINE = "center_line"
    ARC = "arc"
    DIAGONAL = "diagonal"
    SASH = "sash"
    RAIL = "rail"
    CIRCLE = "circle"           # NEW -- revolving door
    FOLD_JOINT = "fold_joint"   # NEW -- folding/bifold door
```

**`OpeningSymbolDetector` extension** (`semantic/opening_detector.py`):
- `_collect_entities`: add an `AcDbCircle` case, producing
  `{"type": "circle", "handle": ..., "center": (cx, cy), "radius": r}` (parallels the
  existing `AcDbArc` case).
- `_entity_center`: add a `"circle"` branch returning `rec["center"]` directly (parallels
  the existing `"arc"` branch).
- `OpeningCandidate` dataclass (`semantic/opening_candidate.py`): add
  `circles: tuple[dict, ...] = ()`, alongside `lines`/`arcs`/`closed_polylines`.
  `build_candidate()` must populate it from the cluster the same way `arcs` is populated,
  and `GeometrySummary` gains a `circle_count` field for signature/summary parity with
  `arc_count`/`line_count`/etc.

**`OpeningEvidenceExtractor` extension** (`semantic/opening_symbol_evidence.py`):
- `CIRCLE` evidence: one `EvidenceItem(kind=EvidenceKind.CIRCLE, ...)` per entry in
  `candidate.circles`, mirroring the existing `ARC` extraction loop.
- `FOLD_JOINT` evidence: new helper `_find_fold_joints(polyline_coords) -> list[dict]`
  that walks consecutive vertex triples in an *open* polyline (`is_closed=False`) and
  flags a joint where the direction change between consecutive segments falls in an
  empirically-determined "sharp fold" angle band (a bifold's V-joint is neither a gentle
  curve nor a straight line -- expect roughly 60-150 degrees between segment vectors, to
  be confirmed/tuned during this PR's Verification Gate, not assumed). One
  `EvidenceItem(kind=EvidenceKind.FOLD_JOINT, ...)` per detected joint.

  **Gotcha for the implementer:** despite its name, `OpeningCandidate.closed_polylines`
  is not pre-filtered to only closed polylines -- `build_candidate()` puts every
  `AcDbPolyline`/`AcDb2dPolyline` entity there regardless of its `is_closed` value (the
  field name is a slight misnomer inherited from the existing code). `_find_fold_joints`
  must filter to `is_closed=False` entries itself before scanning for fold joints, rather
  than assuming the field already excludes closed frames.

**`OpeningFeatures` extension** (`semantic/opening_features.py`):
```python
    circle_count: int = 0
    fold_joint_count: int = 0
```
`OpeningFeatureExtractor.extract()` aggregates these the same way `arc_count`/
`diagonal_count` are aggregated today (count of matching `EvidenceItem`s).

**New rule files:**
```yaml
# door_rotating.yaml
requires:
  circle_count: ">=1"
  diagonal_count: ">=2"   # approximates the X-cross inside the circle
base_score: 0.80

# door_folding.yaml
requires:
  fold_joint_count: ">=1"
base_score: 0.80
```

**Risk flagged explicitly:** the fold-joint angle threshold is a genuine unknown --
unlike PR3's swing-door rules (which reuse an evidence kind with years of production
tuning behind it), `FOLD_JOINT` is brand new geometry-pattern-matching logic with no
existing precedent in this codebase. Expect this PR's Verification Gate to require more
fixture-YAML iteration cycles than PR2 or PR3 needed.

**Golden fixtures:** `tests/golden/doors/rotating_01`, `folding_01`.

**Boundary test note:** `tests/test_opening_pipeline_boundary.py` (added in PR1) must
continue passing unmodified -- this PR does not touch `OpeningSymbolPipeline`.

### PR 5 — `DASHED_FRAME_MARK` (Medium difficulty, contingent on a live-ZWCAD probe)

**This PR's first task is diagnostic, not implementation.** Unlike PR3/PR4, this gap
depends on ZWCAD's actual linetype naming (e.g. is a dashed line's `Linetype` COM
property literally `"DASHED"`, `"HIDDEN2"`, a locale-specific name, or a
drawing-specific custom linetype?) -- there is no existing precedent in this codebase for
reading entity-level (as opposed to layer-level) linetype. `handlers/space.py` already
reads **layer**-level linetype (`LayerMeta.linetype`, via `lyr.Linetype` -- confirmed at
`handlers/space.py:1200`) for wall-classification scoring, but no code path reads
**entity**-level `Linetype` today.

**Step 1 (diagnostic, before any code changes):** write a small standalone script that
opens a live ZWCAD session against a real drawing with known dashed-frame doors (or the
32-pyeong-apartment/apartment-floorplan reference drawings if either contains one), scans `DOOR`-layer
entities, and prints each entity's `.Linetype` COM property value. Confirm the actual
string(s) returned before writing any matching logic against them. This step cannot be
completed without live ZWCAD access -- if unavailable, this PR is blocked until it is.

**Once the diagnostic confirms a usable linetype value**, the design is:

**`OpeningSymbolDetector._collect_entities` extension:** add
`rec["linetype"] = getattr(entry, "linetype", "ByLayer")` when scanning line/polyline
entities (a `getattr` default keeps this safe against COM properties that don't exist on
older ZWCAD versions or non-line entity types).

**New `EvidenceKind` member:** `DASHED_FRAME = "dashed_frame"`.

**`OpeningEvidenceExtractor` extension:** when building `FRAME` evidence from a closed
polyline, additionally check whether the polyline's constituent line segments carry a
non-solid linetype (the exact string(s) confirmed by Step 1's diagnostic -- do not
hardcode `"DASHED"` speculatively); if so, also emit a `DASHED_FRAME` evidence item.

**`OpeningFeatures` extension:** `has_dashed_frame: bool = False`.

**New rule file:**
```yaml
# door_dashed_frame.yaml
requires:
  frame_count: ">=1"
  has_dashed_frame: true
base_score: 0.80
```

**Golden fixture:** `tests/golden/doors/dashed_frame_01` -- must encode whatever
linetype string Step 1's diagnostic confirms, not a placeholder.

## Explicitly out of scope

- **jureummun (accordion/curtain door):** the wavy freehand line this symbol uses is
  typically drawn as an `AcDbSpline` or a dense chain of short polyline segments --
  `OpeningSymbolDetector._collect_entities` does not scan `AcDbSpline` entities at all
  today (confirmed: only `AcDbLine`/`AcDbPolyline`/`AcDbArc`/`AcDbBlockReference` are
  handled). Adding spline support is a larger, separate scope than this design covers
  and is not designed here.
- **chulipgu-ipban (bare threshold opening):** not a taxonomy gap. An opening with no door
  leaf drawn should continue to classify as `door_style=None` (no matching rule fires,
  which is already the correct/expected behavior for a candidate with no distinguishing
  evidence) -- no code change needed.

## Error Handling

- Every new `DoorStyle` member follows the existing fallback convention: no match ->
  `door_style=None` + `LOW_CONFIDENCE_DOOR_SYMBOL` exception (unchanged, reused as-is).
- `CIRCLE`/`FOLD_JOINT`/`DASHED_FRAME` evidence extraction returns an empty result (not
  an exception) when the corresponding geometry/property is absent -- matches every
  existing evidence-kind extraction's behavior.
- PR5's `getattr(entry, "linetype", "ByLayer")` defaults safely if the COM property is
  unavailable (older ZWCAD versions, or entity types that don't expose it) -- the
  dashed-frame feature silently no-ops rather than crashing entity collection.

## Testing Strategy

- **PR3:** `tests/golden/doors/swing_single_01`, `swing_double_01` + extend
  `tests/test_door_pipeline.py`'s existing golden end-to-end parametrization (same file,
  same pattern PR2 established -- no new test file needed, `_golden_cases()` already
  auto-discovers new fixture directories).
- **PR4:** unit tests for the new `AcDbCircle` scanning path in
  `tests/test_opening_detector.py` (mirrors existing `AcDbArc` scan tests); new golden
  fixtures `rotating_01`, `folding_01`.
- **PR5:** the diagnostic script's findings should be captured in the PR description /
  a memory note before the golden fixture is written, since the fixture's exact linetype
  value is unknown until then.
- **Regression gate (every PR):** full suite must show zero regressions against the
  pre-PR baseline (4629 passed as of PR2's merge); `test_opening_pipeline_boundary.py`
  and `test_window_classifier.py`/`test_window_pipeline.py` must be unaffected, since none
  of these 3 PRs touch `WindowClassifier`/`WindowRecognizer`/`OpeningSymbolPipeline`.
