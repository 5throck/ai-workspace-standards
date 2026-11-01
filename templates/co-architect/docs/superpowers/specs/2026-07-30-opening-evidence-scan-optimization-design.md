---
lang: ko
lang_reason: proper-noun
---

# Opening Evidence Scan Optimization — Design Spec

**Status:** Approved (user, 2026-07-30)
**Related ADRs:** ADR-014 (Request-Scoped Derived-Result Cache), AXIS-001-design.md §3.2

## Problem

`zwcad_find_opening_candidates` (MCP tool, handled by
`handle_find_opening_candidates` in `src/cad_intelligence/cad_io/handlers/space.py`)
timed out (>300s) against a real 2,918-entity drawing, even when `walls`/`doors`/
`windows` were passed in explicitly to skip the extraction auto-chain.

**Root cause, confirmed by direct investigation of this session:**

1. **Gating bug**: `handle_find_opening_candidates` (space.py:3450) invokes
   `_axis001_scan_opening_evidence(doc, ms)` unconditionally whenever a live COM
   `doc`/`ms` is available — regardless of whether any candidate is still
   `kind == "unknown"`. AXIS-001-design.md §3.2 and `classify_unknown_candidates`'s
   own docstring (`space_geometry.py:2119`) both state this evidence pass is
   "purely additive" and should only matter when unknown candidates exist. The
   implementation never checks this, so the scan runs even when it has nothing to do.
2. **The scan itself re-walks all of ModelSpace via slow COM property access**:
   `opening_evidence.py:_scan_openings(doc, ms)` does
   `for i in range(ms.Count): ent = ms.Item(i)` and then reads `.Layer`,
   `.ObjectName`, `.Coordinates`, `.Area`, `.Center`, `.Radius`, etc. directly off
   each live COM entity — one COM round-trip per property per entity. This is the
   exact anti-pattern `com_bridge.py:4747`'s `_scan_modelspace_by_layer` docstring
   already identifies as "prohibitively slow" and was written specifically to avoid,
   and which ADR-014 generalized into a request-scoped cache
   (`RequestContext.scan_result` / `scan_modelspace(doc)`) precisely so no handler
   needs to re-walk `doc.ModelSpace` more than once per request.

**Confirmed: this is an implementation defect, not a design flaw.** The design
(AXIS-001 §3.2, ADR-014) is internally consistent and already solved this exact
category of problem for every other handler in `space.py`. `opening_evidence.py`
is the one module that was ported in (per its own docstring, "ported ... from
`scripts/rematch_openings.py`, left byte-for-byte untouched there") without being
adapted to the `ModelSpaceScanResult`/`Entry` infrastructure that already existed
by the time it was written.

## Scope Decision

Fix both layers:

1. **Gating fix** (cheap, always-correct safety net): only attempt the evidence
   scan when `any(c.kind == "unknown" for c in candidates)`.
2. **Root-cause fix**: rewrite `opening_evidence._scan_openings` to consume a
   `ModelSpaceScanResult` (from `scan_modelspace(doc)`, already
   request-scoped-cached by ADR-014) instead of walking live COM entities
   directly. This makes the scan (a) free when the cache is already warm from an
   earlier `extract_cad_objects` call in the same request, and (b) at worst one
   already-optimized single-pass scan when the cache is cold — never a second
   independent `ms.Item(i)` walk.

## Non-Goals

- `scripts/rematch_openings.py`'s own `_scan_openings` (the standalone script) is
  NOT touched — AXIS-001-design.md §3.2 explicitly accepts this duplication
  ("Intentional duplication vs. `rematch_openings.py` — accepted... The proven
  standalone script must keep working unmodified"). Only the COM-aware port in
  `opening_evidence.py` (used by the MCP handler pipeline) is rewritten.
- No change to `classify_unknown_candidates`'s evidence-dict *shape* — the six
  bucket keys (`door_panels`/`door_arcs`/`door_blocks`/`window_strips`/
  `window_blocks`/`sleeve_lines`) and each record's fields (`cx`/`cy`/`x_min`/
  `x_max`/`y_min`/`y_max`/`area`/`width`/`height`/`radius`/etc., matching what
  `_evidence_record_point` and the confidence-key maps already expect) are
  preserved exactly — only the *source* of the underlying data changes (`Entry`
  objects instead of live COM property reads), not what gets returned.
- No change to the six threshold constants (`DOOR_PANEL_MIN_AREA`, etc.) or the
  classification logic in `_classify_door_layer_polyline`/`_parse_block_width` —
  both already pure functions, already unit-tested, untouched.
- No change to `ModelSpaceScanResult`/`Entry`/`scan_modelspace()` themselves —
  this fix is purely a *consumer* of that existing infrastructure.

## Design

### 1. Gating fix — `handle_find_opening_candidates` (space.py)

Change:
```python
if doc is not None and ms is not None:
    try:
        evidence = _axis001_scan_opening_evidence(doc, ms)
        ...
```
to:
```python
if (
    doc is not None
    and ms is not None
    and any(c.kind == "unknown" for c in candidates)
):
    try:
        evidence = _axis001_scan_opening_evidence(doc, ms)
        ...
```

### 2. Root-cause fix — `opening_evidence._scan_openings`

**New signature**: `_scan_openings(scan_result: "ModelSpaceScanResult")` — takes the
already-scanned, request-cached snapshot instead of `(doc, ms)`.

**Rewritten body**, preserving the exact same output shape (six lists of plain
dicts):

```python
def _scan_openings(scan_result):
    """Scan DOOR + 슬리브 + block-reference entries from an already-scanned
    ModelSpaceScanResult and classify into the same six buckets as before.

    Reads from Entry objects (scan_modelspace()'s request-cached snapshot,
    ADR-014) instead of walking live COM entities — the original
    ``for i in range(ms.Count): ms.Item(i)`` loop this function used to run
    duplicated a scan `extract_cad_objects`/other handlers may have already
    paid for in the same request, and was independently slow on large
    drawings regardless of caching (COM round-trip per property per entity).
    """
    door_panels, door_arcs, door_blocks = [], [], []
    window_strips, window_blocks, sleeve_lines = [], [], []

    # -- DOOR layer: polylines + arcs (bucketed lookup, not full scan) ----
    for entry in scan_result.entries_by_layer.get(DOOR_LAYER, ()):
        if "Polyline" in entry.object_name and entry.coordinates:
            coords = entry.coordinates
            xs = coords[0::2]
            ys = coords[1::2]
            if not xs:
                continue
            width = max(xs) - min(xs)
            height = max(ys) - min(ys)
            # NOTE (post-review correction): scan_modelspace() (space.py's
            # _scan_modelspace_impl) pre-bakes a failed COM `.Area` read into
            # 0.0, never None — so `entry.area is not None` is always true and
            # would make the original's bbox-area fallback unreachable dead
            # code. Treat 0.0 the same as "unavailable" here instead: a
            # genuinely zero-area polyline's bbox estimate is also ~0, so this
            # loses no real information while restoring the original
            # behavior (compute bbox area whenever the COM-reported area
            # wasn't usable).
            area = entry.area if entry.area else (width * height)
            rec = {
                "area": area,
                "cx": (min(xs) + max(xs)) / 2, "cy": (min(ys) + max(ys)) / 2,
                "x_min": min(xs), "x_max": max(xs),
                "y_min": min(ys), "y_max": max(ys),
                "width": width, "height": height,
            }
            kind = _classify_door_layer_polyline(area, width, height)
            if kind == "door_panel":
                door_panels.append(rec)
            elif kind == "window_strip":
                window_strips.append(rec)

        elif entry.object_name == "AcDbArc" and entry.center is not None:
            radius = entry.radius or 0.0
            if radius >= DOOR_ARC_MIN_RADIUS:
                cx, cy = entry.center
                door_arcs.append({
                    "cx": cx, "cy": cy, "radius": radius,
                    "start_angle": entry.start_angle or 0.0,
                    "end_angle": entry.end_angle or 0.0,
                    "x_min": cx - radius, "x_max": cx + radius,
                    "y_min": cy - radius, "y_max": cy + radius,
                })

    # -- 슬리브 layer: explicit window sleeve lines ------------------------
    for entry in scan_result.entries_by_layer.get(SLEEVE_LAYER, ()):
        if entry.object_name == "AcDbLine" and entry.start and entry.end:
            sp, ep = entry.start, entry.end
            sleeve_lines.append({
                "cx": (sp[0] + ep[0]) / 2, "cy": (sp[1] + ep[1]) / 2,
                "x_min": min(sp[0], ep[0]), "x_max": max(sp[0], ep[0]),
                "y_min": min(sp[1], ep[1]), "y_max": max(sp[1], ep[1]),
                "length": entry.length,
                "is_horizontal": abs(ep[1] - sp[1]) < abs(ep[0] - sp[0]),
            })

    # -- Block references: doors/windows on ANY layer ---------------------
    for entry in scan_result.entities():
        if entry.object_name != "AcDbBlockReference" or not entry.block_name:
            continue
        parsed = _parse_block_width(entry.block_name.upper())
        if parsed is None:
            continue
        kind, width = parsed
        cx, cy = entry.position if entry.position else (0.0, 0.0)
        rec = {
            "cx": cx, "cy": cy, "width": width, "height": width,
            "area": width * width, "block_name": entry.block_name.upper(),
        }
        (door_blocks if kind == "door" else window_blocks).append(rec)

    return door_panels, door_arcs, door_blocks, window_strips, window_blocks, sleeve_lines
```

**`scan_opening_evidence`'s new signature**: `scan_opening_evidence(scan_result)` —
drops the `(doc, ms)` params entirely, forwards straight to `_scan_openings`.

### 3. Call-site update — `handle_find_opening_candidates`

Replace:
```python
try:
    bridge = _get_bridge()
    doc = bridge.app.ActiveDocument
    ms = doc.ModelSpace
except Exception:
    doc = None
    ms = None

if doc is not None and ms is not None and any(c.kind == "unknown" for c in candidates):
    try:
        evidence = _axis001_scan_opening_evidence(doc, ms)
        ...
```
with:
```python
scan_result = None
try:
    bridge = _get_bridge()
    doc = bridge.app.ActiveDocument
    scan_result = scan_modelspace(doc)
except Exception:
    scan_result = None

if scan_result is not None and any(c.kind == "unknown" for c in candidates):
    try:
        evidence = _axis001_scan_opening_evidence(scan_result)
        ...
```

`scan_modelspace(doc)` is already imported/available in `space.py` (it's defined in
the same module, line 897) — no new import needed. This is also what makes the
ADR-014 cache reuse automatic: if `extract_cad_objects` already ran earlier in the
same MCP request (the common auto-chain case), `scan_modelspace(doc)` here is a
cache hit and costs nothing.

## Testing

1. **Unit tests for `_scan_openings` against a hand-built `ModelSpaceScanResult`**
   (no live COM needed — this is the point): construct `Entry` instances directly
   (frozen dataclass, no COM object needed) representing a DOOR-layer polyline
   (large area → door_panel), a DOOR-layer polyline (thin, mid area → window_strip),
   a DOOR-layer arc (radius ≥ 400 → door_arc), a 슬리브-layer line (→ sleeve_line),
   and block references named `D900`/`PW2400` on arbitrary layers (→ door_block/
   window_block). Assert each lands in the correct output bucket with the correct
   fields — this directly ports the existing informal verification `_scan_openings`
   never had (it was "only smoke-testable against a real ZWCAD session" before;
   now it's a plain unit test).
2. **Gating test**: call `handle_find_opening_candidates` with `walls`/`doors`/
   `windows` such that `find_wall_discontinuities` resolves every candidate to a
   non-`"unknown"` kind (e.g. every gap matches an explicit door/window position
   within tolerance) and assert `scan_opening_evidence`/`_scan_openings` is never
   invoked (patch/mock and assert `call_count == 0`) — this proves the gating fix.
3. **Regression**: existing `tests/test_opening_evidence.py` (the pure-function
   tests for `_parse_block_width`/`_classify_door_layer_polyline`) must still pass
   unmodified — those functions are untouched.
4. **No live-ZWCAD test required for the rewritten `_scan_openings`** — this is
   the direct payoff of the refactor: it's now a pure function of a
   `ModelSpaceScanResult`, fully unit-testable without a COM session, unlike the
   original.

## Files Touched

- Modify: `src/cad_intelligence/semantic/opening_evidence.py` (`_scan_openings`,
  `scan_opening_evidence` signatures + bodies)
- Modify: `src/cad_intelligence/cad_io/handlers/space.py`
  (`handle_find_opening_candidates`'s evidence-scan call site + gating condition)
- Modify: `tests/test_opening_evidence.py` (add the new `Entry`-based unit tests
  for `_scan_openings`; keep existing pure-function tests)
- Modify: `CHANGELOG.md`
