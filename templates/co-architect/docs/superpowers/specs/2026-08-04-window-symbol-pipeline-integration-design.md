---
lang: ko
lang_reason: source-material
---

# Window Symbol Recognition — Live Extraction Wiring Design

**Status:** Approved — Pre-Implementation Verification Gate fully passed (2026-08-04).
Both tunable constants finalized: `_PIPELINE_MIN_CONFIDENCE=0.5` (data-driven),
`_CLUSTER_PROXIMITY_MM=500mm` (default, unchanged — the large-span candidates flagged during
the gate were confirmed genuine balcony sliding-assembly openings, not a merge artifact; see
`memory/meeting-2026-08-04-window-symbol-pipeline-clustering-radius-resolution.md`). No amendment
needed for clustering. Ready for `docs/superpowers/plans/` implementation plan.
**Related:**
- `memory/meeting-2026-08-04-window-symbol-pipeline-integration-review.md` — design review
  meeting; source of the amendments below (scan-reuse fix, verification gate).
- `CHANGELOG.md` [2026-08-04] — Window Symbol Recognition Platform
  (`semantic/opening_detector.py`, `opening_symbol_evidence.py`,
  `opening_features.py`, `window_classifier.py`, `confidence_fuser.py`,
  `opening_pipeline.py`) — implemented, unit/golden-tested, **not wired to
  any live extraction path**.
- ADR-017 (Accepted) — declares Milestones A–D complete; does not cover
  MCP-tool integration.
- `docs/superpowers/specs/2026-08-02-opening-anchor-wall-span-design.md` —
  downstream consumer of raw `windows` output (`space_geometry.py`
  `_openings_to_wall_segments`); unaffected by this change (input shape
  preserved, see Out of scope).

## Problem

`zwcad_extract_cad_objects` (MCP tool) is implemented by
`ZWCADBridge.extract_cad_objects` in
`src/cad_intelligence/cad_io/com_bridge.py:5100-5458`. Its window pass
(`com_bridge.py:5386-5458`) is **1 raw CAD entity → 1 `_WindowEntity`**:

- `AcDbBlockReference` on a window layer → 1 window (block name + `x_scale`
  as width).
- `AcDbLine` on a window layer (no block on that layer) → 1 window **per
  line**, width = line length, `MISSING_BLOCK_DEF` warning emitted.

On the reference drawing (`32평형아파트.dwg`, `WID` layer, no block
definitions), this produces **660 "windows"** — one per raw line fragment —
with width median 50mm (real window widths are 600–2400mm). No clustering,
no symbol recognition, no style classification happens.

The Window Symbol Recognition Platform added 2026-08-04
(`src/cad_intelligence/semantic/opening_pipeline.py` →
`OpeningSymbolPipeline`) already solves exactly this: it clusters raw
line/arc/polyline entities by spatial proximity
(`OpeningSymbolDetector`, 500mm threshold, Union-Find), extracts evidence
(FRAME/PARALLEL/CENTER_LINE/ARC/DIAGONAL/SASH/RAIL — matching the KS
architectural symbol legend), computes features, and classifies into
SLIDING/CASEMENT/FIXED/AWNING with a fused confidence score. It is fully
unit- and golden-tested (31 tests) but **no caller in the codebase invokes
it outside its own test suite** — confirmed by grep: `opening_pipeline` /
`opening_detector` / `window_classifier` / `geometry_signature` appear only
in `semantic/`, `tests/`, and `CHANGELOG.md`. `com_bridge.py` imports
`opening_evidence`, `space_mapping`, `opening_assignment`,
`block_classifier`, `room_reconciliation` — a *different* set of semantic
modules, for a *different* stage (opening→wall assignment, not symbol
detection).

Root cause: **the feature was built and tested in isolation but never
wired into the extraction handler that the MCP tool / live drawing
workflow actually calls.**

## Canonical Principles (spec-level)

1. **Additive, not destructive.** `OpeningSymbolPipeline`'s own docstring
   states it runs *parallel to* `space.py`'s existing window heuristics and
   must not modify them. This design extends that principle to
   `com_bridge.py`: the legacy per-line fallback path stays as the ultimate
   fallback; the new pipeline is inserted *before* it, not instead of it
   wholesale, so no existing caller of `extract_cad_objects` silently loses
   support for drawings the new pipeline fails to cluster.
2. **Output shape (`windows: list[dict]`) is preserved.** Downstream
   consumers (`_openings_to_wall_segments`,
   `zwcad_generate_spaces`, `zwcad_map_space_info`, MCP clients) all read
   `{"handle", "layer", "position", "width", "block_name"}`. This design
   adds fields (`window_style`, `style_confidence`, `evidence_kinds`)
   without removing or renaming existing keys.
3. **Reuse the existing single-scan snapshot — no additional COM traversal.**
   `com_bridge.py` already scans ModelSpace once per `extract_cad_objects`
   call (`ms.Count` loop, `com_bridge.py:5157-5194`) building a flat
   `scanned_entities` list; each `ms.Item(i)` is its own COM round-trip
   (the code's own comment at `com_bridge.py:5150-5153` calls repeated full
   scans "prohibitively slow"). **Amendment (2026-08-04 review):** the
   initial draft proposed calling `scan_modelspace(doc)`
   (`space.py:1372`) to obtain the `ModelSpaceScanResult`/`Entry` shape
   `OpeningSymbolDetector.detect()` expects — but `handle_extract_cad_objects`
   does not receive or forward a pre-computed scan, so that call would be a
   **fresh third full COM traversal** (after `handle_classify_layers` and
   the `ms.Count` loop), not a reuse. Corrected approach: build a
   lightweight `entries_by_layer` adapter (`dict[str, list[Entry]]`, using
   the existing `common.models.Entry` dataclass) directly from the
   already-collected `scanned_entities` list — zero additional COM calls.
   Adding an optional `_scan_result` pass-through parameter to
   `handle_extract_cad_objects` (matching the PR5B pattern already used by
   several `space.py` handlers) is tracked as a separate, non-blocking
   follow-up for caller-side composability — see Out of scope.

## Algorithm

Replace the window pass at `com_bridge.py:5386-5458` with:

```
# Adapter built from the already-collected scanned_entities list —
# NOT a new scan_modelspace(doc) call (see Principle 3 amendment).
scan = _entries_by_layer_from_scanned_entities(scanned_entities)  # new helper, this handler
pipeline_results = OpeningSymbolPipeline().run(
    scan, search_layers=window_layers,
)

windows: list[dict] = []
clustered_handles: set[str] = set()

for result in pipeline_results:
    candidate = result.candidate
    clustered_handles |= {h for h in candidate.signature.entity_ids}

    best_match = (
        result.classification.matches[0] if result.classification.matches
        else None
    )
    cx = (candidate.bbox[0] + candidate.bbox[2]) / 2
    cy = (candidate.bbox[1] + candidate.bbox[3]) / 2
    width = max(candidate.bbox[2] - candidate.bbox[0],
                candidate.bbox[3] - candidate.bbox[1])

    windows.append({
        "handle": candidate.handle,
        "layer": candidate.layer,
        "position": (cx, cy),
        "width": width,
        "block_name": candidate.block_name,
        # new, additive fields:
        "window_style": best_match.style.name if best_match else None,
        "style_confidence": result.final_confidence,
        "evidence_kinds": [e.kind.name for e in result.evidence.items],
    })
    if result.final_confidence < _PIPELINE_MIN_CONFIDENCE:      # new const, see below
        exceptions.append(_ExceptionReport(
            code="LOW_CONFIDENCE_WINDOW_SYMBOL", severity="info", ...
        ).to_dict())

# --- Legacy fallback: only for window-layer lines the pipeline's own
#     clustering did not consume (e.g. search_layers entities that formed
#     no valid candidate — detector still emits 1 candidate per singleton
#     line when nothing clusters, so this branch fires rarely; kept as a
#     safety net per Principle 1) ---
for rec in scanned_entities:
    layer_name = rec["layer"]
    if layer_name not in window_layers:
        continue
    if rec["handle"] in clustered_handles:
        continue
    ... existing AcDbBlockReference / AcDbLine fallback logic unchanged ...
```

Key behavior change: **660 raw lines → N clustered window symbols**
(N ≈ actual window count on the drawing), each carrying a style
classification instead of a bare `width=line_length` guess.

### New helper

`_entries_by_layer_from_scanned_entities(scanned_entities: list[dict]) -> dict[str, list[Entry]]`
— maps the existing raw COM record shape (`{"layer", "handle", "type": "AcDbLine"|...,
"start", "end", "length", ...}`) onto `common.models.Entry` (`object_name`, `start`, `end`,
`length`, ...), grouped by layer. Pure Python, no COM access — this is the fix for the
Principle 3 amendment above.

### New constant

| Constant | Value | Meaning |
|---|---|---|
| `_PIPELINE_MIN_CONFIDENCE` | **TBD — set from live-drawing histogram, see Pre-Implementation Verification Gate** | Below this fused confidence, still emit the window (principle: never silently drop geometry) but flag it via `LOW_CONFIDENCE_WINDOW_SYMBOL` so downstream tooling / the review report can surface it. Draft value 0.5 was an unmeasured guess, rejected in review per the 2026-07-31 weld-endpoints precedent (constants must come from measured distributions, not assumption). |

### New exception code

`LOW_CONFIDENCE_WINDOW_SYMBOL` (severity `info`) — parallels the existing
`MISSING_BLOCK_DEF` pattern (`_ExceptionReport`, `com_bridge.py:~5438`).

## Data model

`windows[i]` dict gains 3 optional keys (all `None`/absent-safe for
existing consumers doing `.get("width")`-style reads):

```python
{
    "handle": str,
    "layer": str,
    "position": (float, float),
    "width": float,
    "block_name": str | None,
    "window_style": str | None,       # NEW: "SLIDING"|"CASEMENT"|"FIXED"|"AWNING"|None
    "style_confidence": float | None, # NEW: 0.0-1.0, ConfidenceFuser output
    "evidence_kinds": list[str],      # NEW: e.g. ["FRAME", "SASH", "RAIL"]
}
```

## Pipeline placement

Inside `ZWCADBridge.extract_cad_objects`, after `wall_layers`/`door_layers`/
`window_layers` are resolved (`com_bridge.py:5137-5145`) and after the
existing single-scan `scanned_entities` loop (needed unchanged for walls
and doors — out of scope here). The window pass specifically
(`com_bridge.py:5386` onward) is what gets replaced. Walls and doors are
untouched.

`scan_modelspace(doc)` is called once, scoped to this function — it is
already COM-scan-equivalent to the existing loop but returns the typed
`Entry`/`ModelSpaceScanResult` shape the detector needs; it is not a
duplicate of the untyped `scanned_entities` list used by the wall/door
passes, which stays as-is.

## Pre-Implementation Verification Gate (blocking — added 2026-08-04 review)

Before `docs/superpowers/plans/` is written, run `OpeningSymbolDetector.detect()` +
`OpeningSymbolPipeline.run()` **unmodified** against a `scanned_entities`-derived scan of
`32평형아파트.dwg`'s `WID` layer (no `com_bridge.py` changes yet — this is a standalone script
against already-extracted data) and record:

1. **Candidate count** vs. visually-countable window count on the drawing (sanity check).
2. **Per-candidate line count** — flags two failure modes in one pass:
   - too few lines per candidate (< expected FRAME/SASH/RAIL evidence count) → under-clustering,
     `_CLUSTER_PROXIMITY_MM` (500mm) too tight.
   - a candidate bbox spanning multiple meters → **over-merging two adjacent physical windows**
     into one candidate (zwcad-drafter's flagged risk: Korean apartment plans commonly place
     paired windows with mullions/piers under 500mm apart — the opposite failure from the
     original 660-fragment problem, undercounting instead of overcounting).
3. **Confidence score histogram** — used to set `_PIPELINE_MIN_CONFIDENCE` from data.

Only after this gate passes does the implementation plan get written; if over-merging is
observed, `_CLUSTER_PROXIMITY_MM` tuning (or a wall-run-aware split, deferred per Out of scope)
becomes a blocking part of the plan rather than a follow-up.

### Result (executed 2026-08-04, see `memory/meeting-2026-08-04-window-symbol-pipeline-integration-review.md` Post-Meeting Update)

- **`_PIPELINE_MIN_CONFIDENCE` — resolved, final value 0.5.** Confidence distribution is bimodal
  (unclassified candidates 0.36–0.4, classified 0.8–0.835); 0.5 cleanly separates them.
- **Clustering radius — NOT resolved by tuning; escalated to a domain/user decision.**
  Default 500mm produces 27 candidates but 8/27 have implausible bbox span (>2500mm, up to
  3915mm). A sweep (250/150/100/60mm) shows this is **not a clustering artifact** — the same
  8 (or more, at tighter radii) large spans persist at every tested threshold, traced to 24
  individually long raw lines (3 distinct groups of 4, each duplicated once elsewhere in the
  drawing). These may be genuine large sliding balcony window/door assemblies (physically
  plausible width for Korean apartments) or a duplication artifact already on record for this
  drawing (see `memory/apartment-floorplan-9-rooms-ground-truth.md`) — code alone cannot
  disambiguate; needs visual confirmation against `32평형아파트.dwg`.
- **Resolved (2026-08-04, follow-up meeting) — no live-drawing check needed.** Positional
  analysis of the 24 long lines (exact `(x, y)` from the saved raw extraction) showed the two
  "duplicate-length" copies in every group sit at **different x-coordinates** (3,205–19,340mm
  apart) sharing one y-band (13047–13287) — the signature of the same 4-line symbol template
  repeated along one facade wall run, not the same entity re-inserted at identical coordinates
  (which is what the WET-ZONE duplication precedent actually looks like). zwcad-drafter confirmed
  2,608–3,915mm widths match ordinary 발코니 확장형 슬라이딩 창/도어 assemblies for a 32-pyeong
  unit, and the recurring pattern across 6 groups is consistent with a mirrored/symmetric unit
  layout. **`_CLUSTER_PROXIMITY_MM` ships at the 500mm default, unchanged. No pre-clustering
  filter or wall-run split is added.** Full reasoning:
  `memory/meeting-2026-08-04-window-symbol-pipeline-clustering-radius-resolution.md`.
- **Residual, non-blocking, carried into the plan**: add one large-span (>2500mm) balcony-assembly
  fixture to `tests/golden/windows/` alongside the existing sliding/casement/fixed/awning singles,
  so this now-confirmed-legitimate window class has regression coverage.

## Testing

- **Unit** (`tests/test_com_bridge_window_extraction.py`, new): mock
  `doc`/`ms` COM objects with a synthetic cluster of `AcDbLine` entities
  representing a sliding-window symbol (2 parallel long lines + 1 center
  line) on a `WID`-classified layer → assert `extract_cad_objects` returns
  **1** window (not N lines), `window_style == "SLIDING"`,
  `style_confidence > 0`.
- **Regression**: existing `AcDbBlockReference`-path tests
  (block-defined windows) must still produce identical `width`/`position`
  output — block path is unchanged.
- **Fallback safety net**: a synthetic line that the detector's clustering
  drops (e.g. `_MIN_CLUSTER_ENTITIES` edge case) must still appear in
  `windows` via the legacy fallback branch — assert no geometry is silently
  lost versus current behavior.
- **Golden**: re-run `tests/golden/windows/` fixtures through the new
  `extract_cad_objects` path (not just `OpeningSymbolPipeline.run()`
  directly) to confirm end-to-end wiring, not just the already-tested
  pipeline internals.

## Live-drawing verification

Re-run `zwcad_extract_cad_objects` on `32평형아파트.dwg`. KPI:

| Priority | Metric | Current | Target |
|---|---|---|---|
| P0 | window count | 660 (raw fragments) | close to true window count (visually countable from drawing, expect low tens) |
| P0 | median window width | 50mm | 600–2400mm range |
| P1 | `window_style` populated (non-null) rate | 0% (field doesn't exist) | majority of detected windows |
| P2 | `LOW_CONFIDENCE_WINDOW_SYMBOL` count | n/a | reviewed manually, used to tune `_CLUSTER_PROXIMITY_MM` / confidence weights if excessive |

Also re-run `zwcad_generate_spaces` afterward — downstream room-polygon
count should not regress (windows feed `_openings_to_wall_segments`
indirectly via width; fewer, correctly-sized windows should if anything
*improve* wall-gap bridging per the
`2026-08-02-opening-anchor-wall-span-design.md` `OPENING_GAP_SPAN_MIN/MAX`
guards — worth checking but not this design's success criterion).

## Out of scope

- Modifying `space.py`'s own parallel window heuristics
  (`_detect_parallel_line_windows`, `_detect_framed_windows`) — explicitly
  preserved per `opening_pipeline.py`'s own docstring contract.
- Door symbol recognition (the legend image also shows door types —
  빈지문/자재문/망사문/미서기문/미닫이문 — but `OpeningSymbolPipeline` /
  `WindowClassifier` is windows-only today; door styling is a separate
  follow-up).
- Retuning confidence-fusion weights (as opposed to the threshold constant,
  which the verification gate above does set from data) — use live-drawing
  KPI results to decide if deeper tuning is needed, in a follow-up.
- `_openings_to_wall_segments` / room-polygon generation changes — this
  design only changes what `extract_cad_objects` returns, not how
  downstream consumers use `width`.
- bbox-derived `width` for rotated/diagonal window symbols — accepted
  simplification for the axis-aligned Korean apartment plan corpus this
  pipeline targets (architect, 2026-08-04 review); revisit only if a
  non-orthogonal drawing enters the golden test set.
- Optional `_scan_result` pass-through parameter on
  `handle_extract_cad_objects` (PR5B-pattern consistency with other
  `space.py` handlers) — useful but not required for this design's own
  scan-reuse fix (which uses a `scanned_entities`-derived adapter instead);
  tracked as a separate small follow-up.
- Wall-run-aware cluster splitting for the inter-window over-merge risk —
  only enters scope if the Pre-Implementation Verification Gate above
  actually observes over-merging; not designed speculatively.
