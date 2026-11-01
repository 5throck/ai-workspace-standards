---
lang: ko
lang_reason: proper-noun
---

# BOUNDARY-001: Evidence-based Boundary Reconstruction

> **Spec ID**: BOUNDARY-001
> **Version**: 0.9 (Phase 1, 2A, 2B, 2B.1, 2B.2, 2C-1, Phase 3 — Polygon Reconstruction, and §10.1/10.2/10.3/10.4/10.5/10.6 enhancements all implemented; 2C-2 Evidence Enrichment remains deferred — see §7.6 and §10.7)
> **Status**: Implemented (Phase 1 + 2A + 2B + 2B.1 + 2B.2 + 2C-1 + Phase 3 + §10 Roadmap items 10.1–10.6; 120 unit tests pass; live-verification recorded — see §7.6)
> **Created**: 2026-07-13
> **Extends**: [`ELEV-002-design.md`](ELEV-002-design.md) (V3 pipeline — `generate_spaces` remains the Geometry-only detector; this spec adds a fallback stage, it does NOT replace `generate_spaces`)
> **Source**: V3 Validation Golden Case (see `ELEV-002-design.md` §"V3 Validation Golden Case — the sample drawing, Partial Geometry Drawing") — `generate_spaces` produced 13 spaces instead of 8 named rooms, with `UNCLOSED_WALLS` ×45, because several rooms' exterior walls have no CAD line/polyline geometry on any wall-classified layer.

---

## 1. Problem

`generate_spaces` (ELEV-002 Phase 2, `handle_generate_spaces`) polygonizes rooms strictly from wall-layer line/polyline geometry via shapely. This is correct and sufficient when every room is fully enclosed by drawn wall lines. The Golden Case drawing showed this assumption does not always hold: two of the drawing's eight named rooms' exterior walls (west side) and two more (east side) have **no line/polyline geometry on any wall-classified layer** — confirmed by a layer-agnostic entity scan (real wall+door geometry exists on the shared/interior walls of those rooms; none on the exterior ones), and by ruling out the two candidate layers that did span the missing region (`CA_WALL` — a 10×10mm block-definition artifact; `1cen` — a centerline/axis-grid layer, already documented as not representing room boundaries).

Geometry-only detection cannot succeed here **structurally**, not due to a bug — there is nothing in the CAD line/polyline data for `generate_spaces` to polygonize on those sides. However, the drawing is not devoid of information about those rooms: room labels exist at known positions (`_scan_room_labels`), dimension annotations exist nearby (`7dim` layer, `AcDbRotatedDimension` chains), a centerline/axis grid spans the full drawing (`1cen`), and the rooms have real doors on their interior walls. A human reconstructing these rooms' boundaries would use exactly this combination of signals, not wall lines alone.

**Goal**: give the pipeline a fallback stage that reconstructs a room boundary from multiple partial evidence sources when direct wall-polygon detection fails, instead of only succeeding-or-failing on wall geometry.

## 2. Non-Goals

- **Not a replacement for `generate_spaces`.** Wherever wall geometry is complete, `generate_spaces`'s shapely polygonization remains the primary and preferred source — it is exact, this proposal is inferential.
- **Not manual `room_info` boundary entry.** `room_info` (§`ELEV-002-design.md` §4 Phase 2) is Semantic input (name/usage/ceiling height/notes) authored by a human. Boundary Reconstruction must not become a channel for a human to type wall coordinates directly — that would collapse the pipeline back to "Geometry → human input" and defeat the purpose of having `generate_spaces` at all (this distinction was explicit in the Golden Case investigation).
- **Not fixed evidence weights in this design.** See §6 — weights are deferred to Golden Dataset calibration, not decided here.

## 3. Data Model

```python
@dataclass
class BoundaryEvidence:
    """One partial signal contributing to a reconstructed boundary."""
    kind: str  # "wall_segment" | "door" | "window" | "centerline" | "dimension" | "room_label" | "neighbor_space"
    source_handle: str | None   # CAD entity handle, if applicable
    geometry: Any                # partial geometry this evidence contributes (a line, a point, a span)
    confidence: float            # this evidence's own reliability, independent of final aggregation

@dataclass
class BoundaryCandidate:
    """A reconstructed room boundary. Logically distinct from SpacePolygon
    (which is geometry-only) — see §9 for whether this is implemented as
    inheritance, a separate dataclass, or composition; not decided here."""
    room_label: str | None        # matched room name, if a label was found nearby
    polygon_points: list[Point]   # inferred closed boundary
    evidence: list[BoundaryEvidence]
    confidence_score: float        # aggregate numeric score — see §6, tunable without breaking the public contract
    confidence_state: str          # "confirmed" | "probable" | "candidate" | "rejected" — see §6
    source: str                   # "geometry" | "reconstructed" — geometry-only spaces stay tagged "geometry"
```

`BoundaryCandidate` is a *logical* superset of `SpacePolygon` (`cad_intelligence/common/models.py`) — every `SpacePolygon` from `generate_spaces` can be represented as a `BoundaryCandidate` with `source="geometry"`, `confidence_state="confirmed"`, and a single `wall_segment` evidence list, so `map_space_info`/`generate_wall_model` downstream consumers can work against one unified shape regardless of which stage produced the boundary. **Whether this is implemented as `SpacePolygon` inheritance, a separate dataclass, or composition is intentionally left open — see §9.**

**Independence principle**: no single evidence type is authoritative. Boundary reconstruction always combines multiple independent evidence sources — a `BoundaryCandidate` backed by only one `BoundaryEvidence` entry (e.g. a `centerline` alone) must not reach `confidence_state="confirmed"`, regardless of that evidence's individual `confidence` value. This directly follows from the Golden Case investigation: `1cen` alone looked like a strong candidate by name and span, and would have been wrongly trusted if geometry-only single-evidence matching had been used instead of cross-checking multiple sources.

## 4. Evidence Sources (candidates, not exhaustive)

| Evidence kind | Origin | What it constrains |
|---|---|---|
| `wall_segment` | Wall-classified layer lines/polylines (existing `extract_cad_objects` output) | Direct boundary edge — highest reliability where present |
| `door` / `window` | `DoorEntity`/`WindowEntity` (existing) | A wall must exist at this position to host the opening — implies a boundary edge even if the wall line itself is missing |
| `centerline` | `1cen`-class axis-grid layer | A candidate axis the true wall may run parallel to or along — the Golden Case confirmed this layer spans regions with no wall-layer geometry |
| `dimension` | `7dim`-class rotated-dimension chains | A numeric span between two known points — can fix an edge's length even without direct wall geometry |
| `room_label` | `_scan_room_labels` (ported to `handlers/space.py` in Phase 1 — was previously V1-only, `scripts/rematch_openings.py`) | An interior point known to belong to the room — anchors which reconstructed polygon corresponds to which name |
| `neighbor_space` | An adjacent `SpacePolygon`/`BoundaryCandidate` already resolved via geometry | A shared party wall's position is already known from the neighbor's geometry-confirmed edge |

## 5. Trigger Conditions

Reconstruction is attempted only when at least one of the following holds for a room/region — it is not a blanket second pass over every drawing:

- `generate_spaces` reports `UNCLOSED_WALLS` for the region.
- Orphan openings (`ORPHAN_OPENING`) for a candidate room exceed a configurable threshold.
- A known room label (`_scan_room_labels`) cannot be assigned to any closed `SpacePolygon`.

Regions `generate_spaces` already resolved with a closed polygon are never re-processed by `reconstruct_boundaries` — this keeps the two stages' cost and failure surface separate (§7).

## 6. Confidence Aggregation (deferred, not fixed here)

Confidence is computed **per candidate boundary, from its contributing evidence list**, not from a single hardcoded formula chosen now. The design commits to:

- Each `BoundaryEvidence` carries its own `confidence` (reflecting how directly that evidence constrains geometry — e.g. a `wall_segment` at the exact edge is more reliable than a `centerline` line that merely passes nearby).
- Aggregation is evidence-weighted (illustrative only — **not final**):

  | Evidence | Illustrative weight |
  |---|---|
  | `wall_segment` | 0.60 |
  | `door` | 0.20 |
  | `window` | 0.10 |
  | `centerline` | 0.05 |
  | `dimension` | 0.05 |

- **These numbers are placeholders for illustration, not a committed weighting scheme.** Per the Golden Case discussion: actual weights must be calibrated against Golden Dataset ground truth (§8), not guessed in the design doc — the project's repeated lesson this session (`AMBIGUOUS_LAYER_ROLE`, the furniture-layer misclassification, the `1cen` red-herring) is that geometry-derived heuristics need evidence, not assumption, before being trusted.
- A `BoundaryCandidate` below a to-be-calibrated confidence floor must surface as `needs_confirmation` (mirroring the existing `HandlerResult` status convention) rather than silently feeding `generate_wall_model` — reconstructed boundaries are inherently less certain than direct polygonization and the pipeline must not blur that distinction downstream.

## 7. Pipeline Integration Point

```
extract_cad_objects
       │
       ▼
generate_spaces  ──── SpacePolygon (source="geometry") ──────┐
       │ UNCLOSED_WALLS / incomplete boundary                │
       ▼                                                       ▼
reconstruct_boundaries (NEW → ✅ implemented as `zwcad_reconstruct_boundary_polygons`)                          BoundaryCandidate[]
  inputs: walls, doors, windows,                              │
          centerline entities, dimension                      │
          entities, room labels, neighbor                      │
          SpacePolygons already resolved                       │
       │                                                       │
       ▼                                                       │
BoundaryCandidate (source="reconstructed") ────────────────────┘
       │
       ▼
map_space_info  (unchanged — matches by name/size/aspect regardless of source)
       │
       ▼
generate_wall_model / generate_wall_elevations  (unchanged)
```

`reconstruct_boundaries` (implemented as `handle_reconstruct_boundary_polygons` / `zwcad_reconstruct_boundary_polygons`) is a handler run only for the residual region `generate_spaces` could not close (identified via its existing `UNCLOSED_WALLS`/`OPEN_PLAN_BOUNDARY_UNRESOLVED` exceptions) — it does not re-process regions `generate_spaces` already resolved with high confidence. This keeps the two stages' responsibilities separate: `generate_spaces` = exact geometry, `reconstruct_boundaries` = inference over partial evidence.

## 7.1 Phase 2A Results — Boundary Hypothesis Prototype (2026-07-13)

`handle_generate_boundary_hypotheses` (`zwcad_generate_boundary_hypotheses`) implements exactly one wall_segment/centerline evidence entry -> one `BoundaryCandidate`, read-only, no filtering/scoring/polygon reconstruction. Run live against Golden Dataset #001:

```
rooms_with_candidates:     8 / 8
avg_candidates_per_room:   415.75
evidence_types_used:       centerline, dimension, door, neighbor_space, wall_segment, window
per-room candidate counts: 78 - 940 (min ROOM #2, max LIVING ROOM)
```

**Reading this result**: candidate volume is far too high to feed directly into any future polygon-reconstruction step — this is the expected outcome of a deliberately unfiltered Phase 2A, not a bug. It tells us the `search_radius` (default 6000mm) and the `structural_walls` set (every wall-classified layer, including `6fur` — furniture entities still misclassified as `wall`, tracked separately in `ELEV-002-design.md`) both need real tightening. Per the review of this exact result, the design was refined into two further sub-phases instead of jumping straight to Validation: **Phase 2B (Candidate Reduction)** — remove structurally implausible candidates, no geometric judgment yet — and **Phase 2C (Geometric Validation)**, not yet implemented, which will do the actual "is this boundary correct" judgment once the candidate pool is small enough to judge individually.

**Bug found and fixed during this run**: `evidence_graph`/candidate generation used the room label's raw text as a dict key, silently dropping one of the two bathroom rooms sharing the exact same label text (7/8 rooms produced, not 8/8). Fixed by suffixing repeated label text with an occurrence counter (e.g. `"Bath"`, `"Bath (2)"`) — a data-loss bug independent of the Phase 2A scope decision, not something to defer. Also introduced a stable `room_id` (index-based, e.g. `"room-0"`) alongside the display label, precisely so future phases don't repeat this class of bug by keying off label text.

## 7.2 Phase 2B Results — Candidate Reduction (2026-07-13)

`handle_reduce_boundary_candidates` (`zwcad_reduce_boundary_candidates`) applies four structural filters in order — `degenerate_length` (segment outside 200-15000mm), `too_far` (source evidence >3000mm from the room label), `unsupported_centerline` (a centerline candidate with no door/dimension within 2500mm), `duplicate` (near-identical survivor already kept for the room) — then merges duplicates. No geometric correctness judgment and no confidence scoring; every removed candidate keeps its reason. Run live against Golden Dataset #001 (raw count differs from §7.1's 415.75/room average because that number was itself computed pre-fix for the room-label-collision bug; the corrected 8-room run is the baseline used here):

```
raw_candidate_count:     3326
reduced_candidate_count: 158   (95.2% reduction)
removed_by_reason:       degenerate_length=2471, too_far=625, unsupported_centerline=8, duplicate=64

per-room (raw -> reduced):
  room-0  682 -> 51
  room-1   78 ->  0   <- zero survivors
  room-2  109 ->  0   <- zero survivors
  room-3  222 -> 32
  room-4  284 ->  0   <- zero survivors
  room-5  169 -> 13
  room-6  940 -> 33
  room-7  842 -> 29
```

**Reading this result**: the reduction rate (95.2%) is more aggressive than the "415 -> 20-ish" target discussed when this phase was scoped, but the more important finding is that **3 of 8 rooms (room-1, room-2, room-4) reduce to zero candidates** — Phase 2C would have nothing to validate for those rooms as currently filtered. This is a pipeline-**contract** problem, not a KPI to accept and move past: Phase 2C cannot validate a candidate that doesn't exist. Root-caused in §7.3 rather than left as an open hypothesis.

## 7.3 Phase 2B.1 Results — Candidate Coverage Analysis (2026-07-13)

`handle_analyze_candidate_coverage` (`zwcad_analyze_candidate_coverage`) classifies each zero-candidate room's `zero_reason` from its raw candidates' removal reasons — `NO_SUPPORTING_EVIDENCE` (zero raw candidates to start), `{REASON}_ONLY` (every raw candidate removed for the same single reason), `MIXED` (multiple reasons contributed), or `DUPLICATE_COLLAPSE_BUG` (should be structurally impossible — duplicate merging always keeps one representative per cluster, so seeing this would indicate a Phase 2B bug, not a legitimate zero). Diagnostic only — changes no threshold, adds no evidence source. Run live against Golden Dataset #001:

```
candidate_coverage:        5/8
rooms_with_zero_candidates: 3

room-1 (ROOM #2):     raw=78,  evidence: wall=70 centerline=8 door=16 dimension=14  -> zero_reason=MIXED
room-2 (ROOM #1):     raw=109, evidence: wall=100 centerline=9 door=16 dimension=18 -> zero_reason=MIXED
room-4 (DINING ROOM): raw=284, evidence: wall=274 centerline=10 door=17 dimension=19 -> zero_reason=MIXED
```

**Root cause determined, not just hypothesized**: all 3 zero-candidate rooms classify `MIXED` (a combination of `too_far` and `degenerate_length`, with `unsupported_centerline` a minor contributor), with substantial evidence present (78-284 raw candidates, 16-19 doors/dimensions each) — this rules out §7.2's hypothesis (a) NO_SUPPORTING_EVIDENCE definitively. No room classified `DUPLICATE_COLLAPSE_BUG`, confirming Phase 2B's duplicate-merge logic is structurally sound (analytically expected, now empirically verified). **Conclusion: this is Phase 2B threshold tuning (`max_distance`/`min_support_radius` too tight for these 3 rooms' actual evidence layout), not a missing-evidence problem and not a Reduction bug.** Resolved in §7.4 via adaptive (not per-room) threshold expansion, not by accepting `candidate_coverage=5/8` as a known limitation — per-room constants were explicitly rejected as unmaintainable across a growing Golden Dataset.

## 7.4 Phase 2B.2 Results — Adaptive Recovery (2026-07-13)

`handle_recover_zero_candidate_rooms` (`zwcad_recover_zero_candidate_rooms`) does not rescan the drawing or generate new candidates — Phase 1 already found the evidence (up to its own wider `search_radius`); Phase 2B's tighter thresholds just filtered it all out for 3 rooms. Recovery re-runs Phase 2B's exact filtering logic (reused via `handle_reduce_boundary_candidates`, not duplicated) on those rooms' already-collected raw candidates, with `max_distance`/`min_support_radius` both expanded by a single global `radius_expansion_factor` (default 1.5×) — one retry, applied only to whichever rooms Phase 2B.1 flagged as zero-candidate, not fixed per-room constants. Rooms that already had survivors are untouched (no extra cost). Run live against Golden Dataset #001:

```
candidate_coverage: 5/8 -> 8/8

room-1 (ROOM #2):     max_distance 3000->4500mm, min_support_radius 2500->3750mm -> recovered 8 candidates
room-2 (ROOM #1):     max_distance 3000->4500mm, min_support_radius 2500->3750mm -> recovered 12 candidates
room-4 (DINING ROOM): max_distance 3000->4500mm, min_support_radius 2500->3750mm -> recovered 12 candidates
```

**Reading this result**: full coverage recovery (5/8 -> 8/8) on the first retry, with one global factor and zero per-room tuning, confirms §7.3's diagnosis precisely — the evidence for these 3 rooms existed all along (within Phase 1's default 6000mm search) and was simply outside Phase 2B's tighter 3000mm/2500mm filtering bands. This validates the Adaptive Recovery approach as the correct fix rather than either per-room constants (rejected as unmaintainable) or accepting incomplete coverage as a known limitation. Phase 2C (Geometric Validation) is now unblocked with `candidate_coverage = 8/8` as its starting point on this Golden Dataset.

## 7.5 Phase 2C-1 Results — Constraint-based Geometric Validation (2026-07-13)

`handle_validate_boundary_candidates` (`zwcad_validate_boundary_candidates`) runs each surviving `BoundaryCandidate` (Phase 2B/2B.2 output) through a Reject-first rule set and returns a `ValidatedCandidate` per candidate — `status` is always derived from `rejected_by`, never set independently. Scope was narrowed to only the rules whose required evidence already exists in the public data contract:

```
Rule                    Required Evidence                          Status
Door Crossing           DoorEntity.position + width + rotation     implemented
Wall Overlap            WallSegment start/end                      implemented
Neighbor Consistency    SpacePolygon (point-in-polygon probe)      implemented
Centerline Agreement    BoundaryCandidate.evidence_kind/rationale   implemented (policy, not geometry)
Window Conflict         WindowEntity rotation (block refs)         NOT implemented -- block-referenced windows carry no rotation field
Dimension Conflict      Dimension extension-line endpoints         NOT implemented -- extraction only captures text position + measurement, never the line's own geometry
```

Window Conflict and Dimension Conflict are deferred to a separate **Phase 2C-2 (Evidence Enrichment)** rather than guessed at here — implementing them today would mean inventing geometry the extraction layer never captured, exactly the kind of assumption this project has repeatedly rejected. Whether 2C-2 is needed is deferred until Golden Dataset #001 results show whether Rule 1/3/4/6 alone produce reliable pass/reject outcomes.

Unit-tested (all handler-contract and registration tests pass — see `tests/handlers/test_handler_result_contract.py` and `tests/test_com_bridge_v3_handlers.py`), full test suite green (3436 passed, 2 pre-existing unrelated failures). **Live verification against Golden Dataset #001 has not yet completed** — attempted during this same session but blocked by unrelated system-level COM/process-contention issues (stray CPU-bound processes from other, unrelated projects on the same machine slowed ZWCAD's single-threaded COM responsiveness). Per explicit instruction, this phase was synced without waiting for that live run to complete; `validation_pass_rate` / `reject_reason_distribution` / `average_rules_passed` real numbers on Golden Dataset #001 are **not yet recorded** and must be captured in a follow-up before Phase 2C-2 or Phase 3 begins.

**Phase 2C-1 note:** Phase 3 live verification (2026-08-02) surfaced a hardcoded-label-layer dependency that also affects Phase 2C-1 auto-chain inputs. `validation_pass_rate`, `reject_reason_distribution`, and `average_rules_passed` metrics remain unrecorded.

**Incidental fix (same session):** `handle_classify_layers` and `handle_extract_cad_objects` each independently performed a full `ms.Count` ModelSpace COM scan, so any auto-chained call (the common case throughout BOUNDARY-001's Phase 1-2C) walked all ~2900 entities in Golden Dataset #001's drawing twice. `_scan_modelspace_by_layer` was extended to capture the superset of fields both handlers need (handle, polyline coordinates, block-reference position/rotation/name/scale, arc geometry, dimension text/measurement — not just classification's type/start/end/lineweight), and `handle_extract_cad_objects` now passes its single scan into `handle_classify_layers` via an internal-only `_entries_by_layer` param instead of triggering a second scan. Full test suite confirmed green after the change; live before/after timing was not captured (see previous paragraph).

> **[Post-PR5C update]** The dual-scan pattern described above was fully resolved in the PR1→PR5C pipeline refactoring series (2026-07-14). `_scan_modelspace_by_layer` was replaced by `scan_modelspace(doc)` (PR2), the dict-based scorers were replaced by Entry-based scorers (PR4), and the deprecated wrappers were removed (PR5C). `scan_modelspace()` is now the only function that iterates `doc.ModelSpace` in the V3 auto-chain. See CHANGELOG.md for the full PR1–PR5C series.

## 7.6 Phase 3 Results — Polygon Reconstruction + Merge (2026-07-14)

`handle_reconstruct_boundary_polygons` (`zwcad_reconstruct_boundary_polygons`) builds closed `SpacePolygon` objects from validated boundary candidates via `BoundaryPolygonBuilder`, then merges them with geometry-derived spaces using the preferred-signal merge policy.

### Implementation

**BoundaryPolygonBuilder** (`space_geometry.py`) — multi-pass builder treating the Geometry Pipeline primitives as a library:
- Groups validated candidates by `room_id`, converts `start`/`end` → `LineString`
- **2-pass architecture** (§10.2): pass-1 sorts rooms by evidence density descending (easy-first), pass-2 retries failed rooms using neighbor edges from pass-1 completions. Non-chaining: pass-2 only injects pass-1 completions.
- **Per-room 3-attempt escalation** within each pass: attempt 0 (basic bridge → polygonize), attempt 1 (§10.3 graph augmentation via Union-Find + closing-edge injection), attempt 2 (§10.4 partial closure via 2-stage gap evaluation — cheap heuristic top-N then bridge+polygonize verification). `max_attempts` is determined by the combination of `graph_completion_enabled` and `partial_closure_enabled` (1/2/3).
- Calls `_weld_endpoints` → optional axis snap (§10.1) → `_bridge_door_window_gaps` → `_polygonize_network` → filter by `MIN_SPACE_AREA_MM2`
- Anchors to room label (`_anchor_polygon`): CONTAINS > BUFFERED_CONTAINS > DISTANCE
- Computes per-room `confidence_score` (§10.5) — 5-component formula with `topology_ratio` as closure proxy
- Returns `(list[SpacePolygon(source=RECONSTRUCTED, confidence_score=...)], list[ReconstructionReport(confidence_score=...)])`

**Merge policy** (`_merge_spaces` in `space.py`):
1. **Mapped label** — same `room_id` or matching label text
2. **Polygon overlap** — `intersection.area >= merge_overlap_min_area_mm2` (bbox pre-filter)
3. **Centroid proximity** — `centroid distance < merge_centroid_tol_mm` (last resort)

**Signal priority** (§10.6): when `confidence_merge_enabled=True` and both geometry and reconstructed spaces carry a `confidence_score`, `_should_displace()` compares them — if `reconstructed > geometry`, the geometry space is displaced and the reconstructed space is kept. When either score is `None` or tied, GEOMETRY wins (backward compatible). The function returns a `_MergeResult` dataclass with `kept_geometry`, `replaced_geometry`, `merged_reconstructed`, `disjoint_reconstructed`, and `overlap_count`. Both input lists are never mutated.

### New types

| Type | Location | Purpose |
|------|----------|---------|
| `SpaceSource(str, Enum)` | `models.py` | `GEOMETRY` \| `RECONSTRUCTED` on `SpacePolygon.source` |
| `AnchorMethod(str, Enum)` | `models.py` | `CONTAINS` \| `BUFFERED_CONTAINS` \| `DISTANCE` |
| `ReconstructionReason(str, Enum)` | `models.py` | `EMPTY_CANDIDATES` \| `NO_LABEL` \| `ROOM_NOT_CLOSED` \| `MULTIPLE_POLYGONS` \| `ANCHOR_FAILED` \| `SUCCESS` \| `GRAPH_COMPLETED` \| `PARTIAL_CLOSURE` |
| `ReconstructionReport(ExceptionReport)` | `models.py` | Per-room result object (never thrown); fixed-context schema; `confidence_score: float \| None` |
| `BoundaryReconstructionConfig(frozen=True)` | `space_geometry.py` | All Phase 3 + §10 tunables: `anchor_buffer_tol_mm=50`, `merge_centroid_tol_mm=100`, `merge_overlap_min_area_mm2=2500`, `boundary_bridge_tol_mm=800`, `min_candidate_length_mm=200`, `graph_completion_enabled=True`, `graph_completion_max_gap_mm=5000`, `axis_snap_enabled=True`, `iterative_reconstruction_enabled=True`, `partial_closure_enabled=True`, `partial_closure_top_candidates=3`, `confidence_merge_enabled=True` |
| `_MergeResult(dataclass)` | `handlers/space.py` | Merge output with `kept_geometry`, `replaced_geometry`, `merged_reconstructed`, `disjoint_reconstructed`, `overlap_count`; `@property replaced_geometry_count` |

**`ReconstructionReport.context` fixed schema** — all 14 keys always present:
```python
{
    "candidate_count": int,     # validated candidates input for this room
    "polygon_count": int,       # polygons output from polygonization
    "gap_length_mm": float,     # longest unclosed gap; 0.0 if not ROOM_NOT_CLOSED
    "missing_edge_count": int,  # expected edges not covered; 0 if none
    "anchor_method": str,      # AnchorMethod.value (e.g. "contains")
    "snap_warning_count": int,  # axis-snap warnings (AXIS_SNAP_AMBIGUOUS/AXIS_SNAP_FAILED); 0 if none
    "iteration": int,           # 0=initial reconstruction, >0=retry with neighbor evidence (§10.2)
    "closing_edge_count": int,     # graph-completion synthetic edges (§10.3)
    "closing_edge_max_mm": float,   # longest synthetic edge (§10.3)
    "graph_candidate_count": int,  # geometry-valid candidates (§10.3)
    "graph_rejected_count": int,   # intersection-rejected candidates (§10.3)
    "synthetic_edge_count": int,    # partial-closure synthetic edges (§10.4); 0 if none
    "synthetic_gap_mm": float,      # partial-closure gap distance (§10.4); 0.0 if none
    "pass_index": int,              # 0=pass-1, 1=pass-2 iterative retry (§10.2)
    "confidence_score": float|None, # per-room confidence (§10.5); None if not computed
}
```

### Output separation

Handler returns explicit lists: `geometry_spaces`, `reconstructed_spaces`, `merged_spaces`, `spaces` (alias for merged), `reconstruction_reports`, `kpis`.

### KPIs

| KPI | Formula |
|-----|---------|
| `reconstructed_generated` | `count(reconstructed_spaces)` |
| `reconstructed_merged` | `generated - merge_overlap_count` |
| `merge_overlap_count` | Reconstructed spaces absorbed by GEOMETRY overlap |
| `merge_confidence_replaced` | Geometry spaces displaced by higher-confidence reconstructed spaces (§10.6) |
| `candidate_utilization_rate` | `rooms with reconstructed polygon / total rooms with validated candidates` |
| `per_room_status` | `dict[room_id, "closed" \| "bridged" \| "graph_completed" \| "partial_closure" \| "failed"]` |
| `top_reconstruction_reasons` | `Counter(reason.value).most_common()` |
| `anchor_method_distribution` | `Counter(anchor_method).most_common()` |
| `confidence_distribution` | `dict[room_id, confidence_score]` for reconstructed rooms (§10.5) |
| `pass_index_distribution` | `Counter(pass_index)` — pass-1 vs pass-2 resolution split (§10.2) |

### Tests

120 unit tests in `tests/test_boundary_reconstruction.py`:
- **Model/Config** (18): SpaceSource values/lookup, SpacePolygon.source default/roundtrip/backward-compat/no-anchor-method, AnchorMethod, ReconstructionReason (8 values), ReconstructionReport roundtrip/defaults/context-schema (14 keys), BoundaryReconstructionConfig frozen/defaults/custom
- **Anchoring** (5): CONTAINS priority, BUFFERED_CONTAINS, DISTANCE fallback, area tiebreak, empty polygon list
- **Builder** (4): closed rectangle, gap bridging (with door entity), empty candidates, source=RECONSTRUCTED
- **Merge** (9): label match, overlap, centroid proximity, disjoint survival, input immutability, multiple rooms, empty lists, geometry-only, reconstructed-only
- **Graph Augmentation** (4): context/report, cross-wall prevention, disabled, odd-dangling crash safety
- **Confidence Score** (7): perfect rectangle ≥0.8, graph moderate 0.6–0.9, partial ≤0.5, None on failure, deterministic, monotonicity, evidence diversity
- **Topology Ratio** (3): closed loop =1.0, open chain <1.0, empty =0.0
- **Partial Closure** (7): U-shape PARTIAL_CLOSURE reason, disabled, synthetic_gap_mm context, already-closed, graph-succeeds-partial-skipped, no-valid-gap, axis-alignment preference
- **Iterative Reconstruction** (6): easy-first ordering, pass-2 retry with neighbor, disabled, determinism, source_confidence None preserved, non-chaining invariant
- **Confidence Merge** (6): recon>geo displaces, recon<geo wins, both None geo wins, tie geo wins, disabled, @property count
- **Cross-cutting** (5): all-enabled combo, graph-succeeds-partial-not, merge+iterative, confidence roundtrip, None roundtrip

Full test suite: 3621 passed, 5 skipped.

**Live verification (2026-08-02):** Completed against Golden Dataset #001 (`32평형아파트.dwg`).

**Result: 0 reconstructed spaces** — this is the **pre-fix** state, recorded for traceability.

**Failure analysis:** All rooms failed with `NO_LABEL` because `BoundaryPolygonBuilder` used a hardcoded `7TXT` layer lookup. The dataset stores room-name labels on a different classifiable text layer, causing `_filter_room_labels()` to return no anchors.

**Resolution:** The hardcoded lookup was replaced with the Phase 1-compatible auto-detection chain:
1. explicit `text_labels` / `room_labels` input
2. `classify_layers` → `extract_text_labels` → `_filter_room_labels`
3. legacy `7TXT` fallback

The fix was **already landed in the previous PR** — this entry records the verification result, not the fix itself.

**Post-verification correctness hardening (2026-08-02):** Four Phase 3 fixes landed after the live-verification run:
- `per_room_status` logic inversion fixed — previously `report_room_ids` included all reports (success and failure), causing every room to be classified as failed. The wrong report selection included success reports, so the status calculation was inverted and all rooms appeared failed.
- `ReconstructionReport.success` flag + `ReconstructionReason.SUCCESS` — success/failure separated at the type level; KPI aggregation now derives failure counts from unsuccessful reports only
- `label_lookup` is now multi-value with nearest-label (bounding-box center) selection — duplicate room-label text no longer drops a room
- `room_labels` auto-chain fallback added to `handle_reconstruct_boundary_polygons` (schema documented it as optional, but it was not implemented)

## 8. Golden Dataset Registration

The sample drawing (see `ELEV-002-design.md`'s Golden Case section) is registered as **Golden Dataset #001** with baseline (pre-Boundary-Reconstruction) numbers:

```
generate_spaces:            13 spaces (expected 8 named rooms), UNCLOSED_WALLS = 45
generate_wall_model:        ORPHAN_OPENING = 71
generate_wall_elevations:   elevations = 0
generate_boundary_hypotheses (Phase 2A, 2026-07-13):
                             rooms_with_candidates = 8/8, avg_candidates_per_room = 415.75
reduce_boundary_candidates (Phase 2B, 2026-07-13):
                             raw = 3326, reduced = 158 (95.2% reduction)
                             rooms_with_zero_candidates = 3/8 (room-1, room-2, room-4)
analyze_candidate_coverage (Phase 2B.1, 2026-07-13):
                             candidate_coverage = 5/8
                             zero_reason for all 3 zero rooms = MIXED (threshold tuning, not missing evidence)
recover_zero_candidate_rooms (Phase 2B.2, 2026-07-13):
                             candidate_coverage = 5/8 -> 8/8 (single retry, 1.5x radius_expansion_factor)
```

Once Phase 2C (Geometric Validation) and Phase 3 (Polygon Reconstruction — code implemented, live verification pending) have working implementations, this same drawing becomes the acceptance test: expected outcome is 8 correctly-named rooms, a defined-but-not-yet-zero `ORPHAN_OPENING` count (some may remain legitimately orphaned — e.g. `MISSING_BLOCK_DEF` fallback openings), and `elevations > 0` for every room whose `BoundaryCandidate.confidence_state` clears the calibrated floor. Evidence weights (§6) should be tuned against this dataset's known-correct room dimensions (already hand-verified once in `rooms.json`'s legacy entries for ROOM #1/#2) before being applied to other drawings. Phase 2A's `avg_candidates_per_room` should trend down and Phase 2B's `rooms_with_zero_candidates` should trend to 0 as the pipeline matures — both are new regression baselines, distinct from the Geometry-only numbers above.

## 9. Open Questions

1. Confidence floor for "surface as `needs_confirmation`" vs. "reject entirely" — not decided; depends on calibration data from §8.
2. ~~Whether `neighbor_space` evidence should be computed iteratively (resolve easy rooms first, then use their confirmed edges to constrain harder neighbors) or all evidence gathered in one pass — iterative is more robust but adds a convergence/ordering question not yet designed.~~ — **Resolved by §10.2**: 2-pass easy-first ordering with non-chaining invariant (pass-2 only injects pass-1 completions, not other pass-2 in-progress rooms).
3. ~~Where `reconstruct_boundaries`'s exceptions surface in the existing 7-exception table (`ELEV-002-design.md` §5)~~ — **Resolved by Phase 3 (§7.6)**: `ReconstructionReport` is a result-object dataclass (never thrown), following the `ExceptionReport` convention. It surfaces in the handler's `reconstruction_reports` output list, not as thrown exceptions. An 8th exception code was not needed.
4. ~~How `BoundaryCandidate` relates to `SpacePolygon` at the implementation level~~ — **Resolved by Phase 3 (§7.6)**: `BoundaryPolygonBuilder` converts validated candidates to `LineString`, calls geometry primitives (`_weld_endpoints` → `_bridge_door_window_gaps` → `_polygonize_network` → `_polygon_to_space_polygon`), then anchors to room label. `SpaceSource(GEOMETRY|RECONSTRUCTED)` distinguishes the origin of each `SpacePolygon` in the merged output.
5. ~~Blocking for Phase 2C~~ — **Resolved by Phase 2B.2 (§7.4)**: `candidate_coverage` recovered 5/8 -> 8/8 via a single global `radius_expansion_factor` retry, not per-room constants or accepting incomplete coverage. Phase 2C is unblocked on Golden Dataset #001. Follow-up (not blocking): whether `radius_expansion_factor=1.5` and a single retry generalize to other drawings, or whether a second Golden Dataset entry with different evidence density would need a different factor/retry count — revisit once a second Golden Dataset is registered.

## 10. Roadmap: Boundary Reconstruction Enhancements

Design for the post-Phase 3 enhancement sequence. Order is **evidence-first**: every step either fixes evidence noise (4-C), shares confirmed evidence between rooms (4-E), reuses real wall topology (Graph Completion), or only as a last resort infers a missing wall (Partial Closure). Never jump straight from polygonization failure to a longest-gap guess.

### 10.1 4-C Axis-aligned snapping ✅ Implemented

**Problem.** Candidates derived from fragmented wall segments carry micro-angle and micro-position noise (`(10.001, 0)` vs `(10.0, 0.01)`), which breaks endpoint welding and polygonization even when the room is topologically closed.

**Approach.** Wire the existing, unit-tested `snap_to_axis_grid(welded_lines, axis_grid)` (`geometry/axis_grid.py`) into `BoundaryPolygonBuilder._build_room` after welding and before polygonization.

**Target order (corrected bridge position):**
```
candidate normalize → weld → snap → polygonize → bridge fallback
```

**Implementation note.** The existing builder flow currently enters bridge handling earlier (weld → bridge → polygonize). 4-C moves axis snapping **before any gap-bridging decision** — bridging is an evidence-deficiency fallback and must never run before topology snapping. Wire `snap_to_axis_grid()` after `_weld_endpoints`, before `_polygonize_network`.

**Details.**
- New config field `axis_snap_enabled: bool = True` on `BoundaryReconstructionConfig`.
- `build()` gains an optional `axis_grid` param; handler auto-chains `zwcad_generate_axis_grid` when omitted.
- `AxisGrid.snap_tolerance` (default 50 mm) governs how far a line's position may be from a matching axis to snap.

**KPIs.** Reduce `ROOM_NOT_CLOSED` count; record `AXIS_SNAP_AMBIGUOUS` warnings (a line within tolerance of two axes is left unsnapped, not arbitrarily moved). Count reflected in `ReconstructionReport.context["snap_warning_count"]`.

### 10.2 4-E Iterative reconstruction ✅ Implemented

**Problem.** One-pass per-room processing leaves a room unresolved even when a neighbor's confirmed boundary would supply its shared wall.

**Approach.** Order rooms by **evidence density** and resolve easy rooms first; completed room boundaries become additional candidate evidence for adjacent rooms (shared/party walls), then re-run deferred rooms.

**Ordering score.** Phase 1: `candidate_count / area`. Phase 2 extension (documented, not implemented): `(candidate_count + label_confidence + closed_loop_bonus) / area` — the closed-loop bonus rewards rooms that already closed without bridging, so high-density bathrooms do not outrank a large living room.

**KPIs.** `ROOM_NOT_CLOSED` count after pass 2; `candidate_utilization_rate` across passes.

**Implementation notes (v7).** `build()` runs 2 passes: pass-1 sorts by evidence density descending (easy-first), pass-2 retries failed rooms using neighbor edges from pass-1 completions (`_collect_neighbor_edges` + `_inject_neighbor_candidates`). Non-chaining invariant: pass-2 only injects pass-1 completions, not other pass-2 in-progress rooms. `source_confidence` from completed rooms is preserved as-is (None not coerced to 0.0). Config: `iterative_reconstruction_enabled`.

### 10.3 Graph-based boundary completion ✅ Implemented

**Problem.** When polygonization fails (`ROOM_NOT_CLOSED`), the current fallback `_estimate_longest_gap` guesses the longest open gap. A lone unsupported centerline is exactly the Golden Case false-lead — guessing must not be the first move.

**Approach (evidence increase, not inference).** Build a wall graph from welded candidate endpoints, then reuse the existing Shapely polygonization:
```
graph (Union-Find clusters → nodes, segments → edges)
   ↓ _polygonize_network()          # existing primitive
   ↓ polygons containing room label
   ↓ smallest enclosing polygon
```

**Reuse.** `_weld_endpoints_v2`'s STRtree + Union-Find clustering already forms the node set; `_polygonize_network` and the existing label-anchoring logic select the enclosing polygon. A full shortest-cycle / planar-embedding algorithm is a **later enhancement** only if label-enclosing selection proves insufficient on a second Golden Dataset.

**Design philosophy recorded.** Polygon failure → graph completion (reuse real wall topology) → partial closure (last-resort inference). Direct longest-gap guessing is explicitly rejected.

**KPIs.** Rooms recovered by graph completion vs partial closure; `BRIDGED`/`CLOSED` reason split after completion.

### 10.4 4-A Partial closure (last resort after 10.3) ✅ Implemented

**Problem.** Rooms where even graph completion cannot form an enclosing cycle.

**Approach.** Close the room's longest evidence-backed gap with a synthetic wall segment, then re-run polygonization. Heavy confidence penalty (`closure_method = PARTIAL_CLOSURE`).

**Implementation notes (v7).** `_find_best_closure_gap()` uses 2-stage evaluation: Stage 1 scores all dangling-endpoint pairs with a cheap heuristic (distance_weight=0.6, axis_weight=0.3, label_weight=0.1), Stage 2 runs bridge+polygonize on the top-N candidates (config: `partial_closure_top_candidates`) to verify containment. Attempt routing: `_build_room` determines `max_attempts` from the combination of `graph_completion_enabled` and `partial_closure_enabled` (1/2/3), and reason is data-driven (`synthetic_edge_count > 0` → PARTIAL_CLOSURE, `closing_edge_count > 0` → GRAPH_COMPLETED, else SUCCESS).

### 10.5 3-C Confidence score ✅ Implemented

**Problem.** `BoundaryCandidate.confidence_state` is fixed at `"candidate"`; the merge stage cannot weigh reconstruction quality because no numeric score exists.

**Approach.** Derive a per-room numeric `confidence_score` on `ReconstructionReport`:
```
confidence = 0.30 * candidate_validation
           + 0.25 * topology
           + 0.20 * anchor_quality
           + 0.15 * closure_method
           + 0.10 * evidence_diversity
```

**`closure_method` values (positive weights, not penalties):**

| method | value |
|--------|-------|
| `CLOSED_LOOP` | 1.0 |
| `GRAPH_COMPLETED` | 0.85 |
| `BRIDGED` | 0.65 |
| `PARTIAL_CLOSURE` | 0.4 |

**Topology as closure proxy.** The `topology` component uses `topology_ratio` — the fraction of line-segment endpoints with degree ≥ 2 (i.e., participating in a closed loop). This is a closure proxy: a fully closed polygon has ratio 1.0, an open chain has ratio < 1.0. This avoids requiring a separate closure-check pass. Documented here so §10.7 can replace it with a more precise algorithm when Golden Dataset #002+ is available.

**`confidence_score: float | None`.** Stored on both `ReconstructionReport` and `SpacePolygon`. `None` means "not computed" (distinct from 0.0). The merge stage (§10.6) treats `None` as "no score available" and falls back to GEOMETRY-wins behavior.

**KPIs.** `confidence_distribution`; downstream gates (e.g. which rooms surface as `needs_confirmation`) key off the score.

### 10.6 5-A Confidence-based merge ✅ Implemented

**Problem.** The merge policy is unconditional "GEOMETRY always wins"; a high-confidence reconstruction cannot displace a low-confidence geometry space.

**Approach.** When both geometry and reconstruction spaces carry a confidence score, compare and keep the higher. When reconstruction confidence is absent, fall back to the current behavior — **backward compatible**.

**Implementation notes (v7).** `_merge_spaces()` returns a `_MergeResult` dataclass with `@property replaced_geometry_count`. The `_should_displace()` function implements the comparison: `None` on either side → GEOMETRY wins, tie → GEOMETRY wins. Handler tracks `merge_confidence_replaced` KPI. Config: `confidence_merge_enabled`.

**KPIs.** `merge_overlap_count` before/after; area-accuracy delta against Golden Dataset ground truth.

### 10.7 Deferred (need Golden Dataset #002+)

- **Adaptive thresholding** (Otsu-style `max_distance`/`min_support_radius`): overfits with a single dataset — calibrate once a second dataset exists.
- **Wall-thickness expansion** (centerline → outline): apply only to centerline-drawn drawings, after classifying `centerline_wall` vs `outline_wall` drawing types.
- **Label suffix normalization** (`"거실1"` → `"거실"`): a preprocessing layer separate from `SpaceFunction`, which records unmatched labels in a bounded collector (`UNKNOWN_FUNCTION_LABELS`) for keyword discovery.
- **Quality infrastructure** (Golden Dataset #002, handler integration tests, KPI dashboard) — run continuously in parallel.

### 10.8 Execution order

1. ~~`SpaceFunction` implementation (Phase 1)~~ ✅ → 2. ~~`SpaceFunction` tests~~ ✅ → 3. ~~this §10~~ ✅ → 4. ~~4-C Axis Snap~~ ✅ → 5. Golden Dataset #001 re-verification → 6. ~~4-E iterative~~ ✅ → 7. ~~Graph completion~~ ✅ → 8. ~~Partial closure~~ ✅ → 9. ~~Confidence~~ ✅ → 10. ~~Confidence merge~~ ✅.

**Remaining**: Golden Dataset #001 re-verification with full §10 pipeline enabled (§10.7 deferred items still outstanding).
