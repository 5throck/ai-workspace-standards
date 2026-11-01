---
lang: ko
lang_reason: proper-noun
---

# Opening Evidence Scan Optimization — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `zwcad_find_opening_candidates` timing out (>300s) on real drawings by (1) gating the evidence scan on whether any candidate is still `kind == "unknown"`, and (2) rewriting `opening_evidence._scan_openings` to consume the already-scanned, request-cached `ModelSpaceScanResult` (ADR-014) instead of independently re-walking live COM entities.

**Architecture:** `_scan_openings(scan_result)` reads `Entry` objects from `ModelSpaceScanResult.entries_by_layer`/`.entities()` instead of calling `ms.Item(i)` in a loop. `handle_find_opening_candidates` calls `scan_modelspace(doc)` (already request-scoped-cached) instead of grabbing `doc.ModelSpace` directly, and only attempts the scan when at least one candidate is still unresolved.

**Tech Stack:** Python 3.11+, `unittest` (matching this test file's existing convention — NOT pytest-style bare functions), dataclasses.

**Spec:** `docs/superpowers/specs/2026-07-30-opening-evidence-scan-optimization-design.md` (reviewed twice — first pass found and fixed a real behavioral regression in the `Entry.area` fallback logic; second pass approved).

---

## Reference Conventions (read once, apply throughout)

- `tests/test_opening_evidence.py` uses `unittest.TestCase` classes, not bare
  `pytest`-style functions — match this convention for new tests in that file.
- `Point = tuple[float, float]` (`src/cad_intelligence/common/models.py:35`) — every
  `Entry` geometry field (`center`, `position`, `start`, `end`) is a flat 2-tuple,
  NOT an object with `.x`/`.y`. Unpack as `cx, cy = entry.center`, not
  `entry.center.x`.
- `Entry.area` is pre-baked to `0.0` (never `None`) by `_scan_modelspace_impl`
  (`space.py:792-793`) when the underlying COM `.Area` read fails. **Use a falsy
  check (`if entry.area else ...`), not `is not None`** — this was the exact bug
  the spec review caught and fixed. Do not "simplify" this back to `is not None`.
- Run tests from project root: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_opening_evidence.py -v` (the file is pytest-collectible even though it uses `unittest.TestCase`).
- **TDD is mandatory** for the new `_scan_openings` unit tests: write the test with a hand-built `ModelSpaceScanResult`/`Entry` fixture first, confirm it fails (since `_scan_openings` doesn't accept that signature yet), then rewrite the implementation.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/cad_intelligence/semantic/opening_evidence.py` | Modify | `_scan_openings`/`scan_opening_evidence` — new `ModelSpaceScanResult`-based signature |
| `src/cad_intelligence/cad_io/handlers/space.py` | Modify | `handle_find_opening_candidates` — gating condition + `scan_modelspace(doc)` call site |
| `tests/test_opening_evidence.py` | Modify | Add `Entry`/`ModelSpaceScanResult`-based unit tests for `_scan_openings` (new — this function was previously untestable without live COM) |
| `CHANGELOG.md` | Modify | Entry describing the fix |

---

### Task 1: Rewrite `_scan_openings` to consume `ModelSpaceScanResult`

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_evidence.py`
- Modify: `tests/test_opening_evidence.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_opening_evidence.py` (add necessary imports at the top —
`Entry`, `ModelSpaceScanResult`, `LayerMeta` from `cad_intelligence.common.models`;
`_scan_openings`, `scan_opening_evidence` from `src.cad_intelligence.semantic.opening_evidence`;
`from types import MappingProxyType`):

```python
def _make_scan_result(entries_by_layer: dict) -> "ModelSpaceScanResult":
    """Build a minimal ModelSpaceScanResult for _scan_openings tests — no
    live COM needed, since Entry is a plain frozen dataclass."""
    from cad_intelligence.common.models import LayerMeta, ModelSpaceScanResult
    return ModelSpaceScanResult(
        doc_name="test.dwg",
        entries_by_layer=MappingProxyType(
            {k: tuple(v) for k, v in entries_by_layer.items()}
        ),
        entity_type_counts=MappingProxyType({}),
        block_samples=MappingProxyType({}),
        layer_meta=MappingProxyType(
            {k: LayerMeta(color=0, linetype="ByLayer") for k in entries_by_layer}
        ),
    )


class TestScanOpeningsFromScanResult(unittest.TestCase):
    """Unit tests for the rewritten _scan_openings(scan_result) — previously
    untestable without live COM; now a pure function of Entry data."""

    def test_door_layer_large_polyline_is_door_panel(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="DOOR", handle="H1", object_name="AcDbPolyline",
            coordinates=(0.0, 0.0, 900.0, 0.0, 900.0, 36.0, 0.0, 36.0),
            area=32400.0,  # 900 * 36, well above DOOR_PANEL_MIN_AREA (20000)
        )
        scan_result = _make_scan_result({"DOOR": [entry]})
        door_panels, door_arcs, door_blocks, window_strips, window_blocks, sleeve_lines = (
            _scan_openings(scan_result)
        )
        self.assertEqual(len(door_panels), 1)
        self.assertEqual(door_panels[0]["area"], 32400.0)
        self.assertEqual(len(door_arcs), 0)
        self.assertEqual(len(window_strips), 0)

    def test_door_layer_thin_polyline_is_window_strip(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="DOOR", handle="H2", object_name="AcDbPolyline",
            coordinates=(0.0, 0.0, 200.0, 0.0, 200.0, 30.0, 0.0, 30.0),
            area=6000.0,  # 200*30, >= WINDOW_STRIP_MIN_AREA(4000), thin dim 30 < 60
        )
        scan_result = _make_scan_result({"DOOR": [entry]})
        _, _, _, window_strips, _, _ = _scan_openings(scan_result)
        self.assertEqual(len(window_strips), 1)

    def test_door_layer_polyline_zero_com_area_falls_back_to_bbox(self):
        """Regression test for the Entry.area==0.0-sentinel bug caught in
        spec review: a polyline whose live COM .Area read failed (pre-baked
        to 0.0 by scan_modelspace, per space.py) must still be classified
        using the bbox-derived area, not silently dropped as area=0 noise."""
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="DOOR", handle="H3", object_name="AcDbPolyline",
            coordinates=(0.0, 0.0, 900.0, 0.0, 900.0, 36.0, 0.0, 36.0),
            area=0.0,  # simulates a failed COM .Area read
        )
        scan_result = _make_scan_result({"DOOR": [entry]})
        door_panels, _, _, _, _, _ = _scan_openings(scan_result)
        self.assertEqual(len(door_panels), 1)
        self.assertAlmostEqual(door_panels[0]["area"], 900.0 * 36.0)

    def test_door_layer_arc_above_min_radius_is_door_arc(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="DOOR", handle="H4", object_name="AcDbArc",
            center=(100.0, 200.0), radius=800.0,
            start_angle=0.0, end_angle=1.5708,
        )
        scan_result = _make_scan_result({"DOOR": [entry]})
        _, door_arcs, _, _, _, _ = _scan_openings(scan_result)
        self.assertEqual(len(door_arcs), 1)
        self.assertEqual(door_arcs[0]["cx"], 100.0)
        self.assertEqual(door_arcs[0]["radius"], 800.0)

    def test_door_layer_arc_below_min_radius_is_excluded(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="DOOR", handle="H5", object_name="AcDbArc",
            center=(100.0, 200.0), radius=50.0,  # below DOOR_ARC_MIN_RADIUS (400)
            start_angle=0.0, end_angle=1.5708,
        )
        scan_result = _make_scan_result({"DOOR": [entry]})
        _, door_arcs, _, _, _, _ = _scan_openings(scan_result)
        self.assertEqual(len(door_arcs), 0)

    def test_sleeve_layer_line_is_sleeve_line(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="슬리브", handle="H6", object_name="AcDbLine",
            start=(0.0, 0.0), end=(150.0, 0.0), length=150.0,
        )
        scan_result = _make_scan_result({"슬리브": [entry]})
        _, _, _, _, _, sleeve_lines = _scan_openings(scan_result)
        self.assertEqual(len(sleeve_lines), 1)
        self.assertTrue(sleeve_lines[0]["is_horizontal"])
        self.assertEqual(sleeve_lines[0]["length"], 150.0)

    def test_block_reference_door_on_any_layer_is_door_block(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="252", handle="H7", object_name="AcDbBlockReference",
            position=(500.0, 600.0), block_name="D900",
        )
        scan_result = _make_scan_result({"252": [entry]})
        _, _, door_blocks, _, _, _ = _scan_openings(scan_result)
        self.assertEqual(len(door_blocks), 1)
        self.assertEqual(door_blocks[0]["width"], 900)
        self.assertEqual(door_blocks[0]["block_name"], "D900")

    def test_block_reference_window_on_any_layer_is_window_block(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="7dim", handle="H8", object_name="AcDbBlockReference",
            position=(700.0, 800.0), block_name="PW2400",
        )
        scan_result = _make_scan_result({"7dim": [entry]})
        _, _, _, _, window_blocks, _ = _scan_openings(scan_result)
        self.assertEqual(len(window_blocks), 1)
        self.assertEqual(window_blocks[0]["width"], 2400)

    def test_unrecognized_block_name_is_ignored(self):
        from cad_intelligence.common.models import Entry
        entry = Entry(
            layer="0", handle="H9", object_name="AcDbBlockReference",
            position=(0.0, 0.0), block_name="c405",  # furniture block, no D#/W# pattern
        )
        scan_result = _make_scan_result({"0": [entry]})
        _, _, door_blocks, _, window_blocks, _ = _scan_openings(scan_result)
        self.assertEqual(len(door_blocks), 0)
        self.assertEqual(len(window_blocks), 0)

    def test_scan_opening_evidence_returns_dict_with_six_keys(self):
        scan_result = _make_scan_result({})
        evidence = scan_opening_evidence(scan_result)
        self.assertEqual(
            set(evidence.keys()),
            {"door_panels", "door_arcs", "door_blocks",
             "window_strips", "window_blocks", "sleeve_lines"},
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_opening_evidence.py -v`
Expected: `TypeError` — `_scan_openings()` still takes `(doc, ms)`, not a single
`scan_result` positional arg (the new tests call it with one argument).

- [ ] **Step 3: Rewrite `_scan_openings` and `scan_opening_evidence`**

Replace the current `_scan_openings(doc, ms)` function body in
`src/cad_intelligence/semantic/opening_evidence.py` with the version specified in
the spec's §Design "2. Root-cause fix" section — copy verbatim, INCLUDING the
post-review-corrected `area = entry.area if entry.area else (width * height)` line
(falsy check, not `is not None` — this is the exact bug the spec review caught).

Update `scan_opening_evidence`'s signature from `scan_opening_evidence(doc, ms)` to
`scan_opening_evidence(scan_result)`, forwarding straight to `_scan_openings(scan_result)`.

Update the module docstring's "Why a port..." section to note it now also takes a
`ModelSpaceScanResult` instead of raw COM `(doc, ms)` — one sentence addition, not
a rewrite of the whole docstring.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_opening_evidence.py -v`
Expected: PASS (all existing pure-function tests + 9 new tests).

- [ ] **Step 5: Self-review**

Confirm: `entry.area if entry.area else ...` (falsy check) is used, NOT
`is not None`; the block-reference loop iterates `scan_result.entities()` (all
layers), NOT `scan_result.entries_by_layer.get(some_specific_layer, ())`; the
DOOR-layer and 슬리브-layer loops use `.entries_by_layer.get(LAYER, ())` (bucketed,
not full scan); `_parse_block_width`/`_classify_door_layer_polyline` are called
with identical arguments as before (untouched pure functions).

---

### Task 2: Gating fix + call-site update in `handle_find_opening_candidates`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py`

- [ ] **Step 1: Locate the exact block to replace**

Find in `handle_find_opening_candidates` (around line 3435-3452):
```python
    try:
        bridge = _get_bridge()
        doc = bridge.app.ActiveDocument
        ms = doc.ModelSpace
    except Exception:
        doc = None
        ms = None

    if doc is not None and ms is not None:
        try:
            evidence = _axis001_scan_opening_evidence(doc, ms)
            candidates = _axis001_classify_unknown_candidates(
                candidates, evidence
            )
        except Exception:
            # Evidence scan/classification is best-effort; a COM
            # failure here must not regress the already-computed
            # explicit-entity candidates.
            pass
```

- [ ] **Step 2: Replace with the gated, scan_modelspace-based version**

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
            candidates = _axis001_classify_unknown_candidates(
                candidates, evidence
            )
        except Exception:
            # Evidence scan/classification is best-effort; a COM
            # failure here must not regress the already-computed
            # explicit-entity candidates.
            pass
```

`scan_modelspace` is defined earlier in the same module (`space.py:897`) — no new
import needed.

- [ ] **Step 3: Update the explanatory comment above the block**

The existing comment (a few lines above, starting "AXIS-001 Phase B6 (§3.2):
classify any still-'unknown' candidate...") should gain one clause noting the scan
is now also gated on `any(... == "unknown" ...)` and reuses the request-scoped
`scan_modelspace` cache (ADR-014) rather than opening a fresh COM ModelSpace
reference — update the comment text to reflect both changes, don't leave it
describing the old ungated/direct-COM behavior.

- [ ] **Step 4: Run the gating regression test (see Task 3) and the full opening-evidence suite**

Covered by Task 3's test; also re-run:
```
python -m pytest tests/test_opening_evidence.py -v
```
to confirm Task 1's changes still pass after this call-site edit (no import
breakage).

---

### Task 3: Gating test — evidence scan skipped when no unknown candidates

**Files:**
- Create or modify: a test file exercising `handle_find_opening_candidates` — check
  whether `tests/test_space_handlers.py` or similar already exists and has COM-free
  test patterns for this handler (search for existing tests of
  `handle_find_opening_candidates` or `handle_assign_openings` first — reuse their
  mocking pattern for `_get_bridge`/`bridge.app.ActiveDocument` rather than
  inventing a new one).

- [ ] **Step 1: Find the existing test pattern for this handler**

Run: `grep -rln "handle_find_opening_candidates\|find_opening_candidates" tests/ --include=*.py`
Read whatever file(s) are found to see how `_get_bridge`/COM is mocked for this
handler today (likely `unittest.mock.patch` on `_get_bridge` or module-level
`bridge` fixture). If no test file exists for this handler yet, model the mock
setup on a neighboring handler's test in the same file family (e.g.
`handle_assign_openings`'s tests, since it's described as extending the same
auto-chain convention).

- [ ] **Step 2: Write the failing test**

Using whatever mocking convention Step 1 found, construct inputs
(`walls`/`doors`/`windows`) such that every wall-gap candidate resolves to a
non-`"unknown"` `kind` via the existing explicit-entity match in
`find_wall_discontinuities` (e.g. a door positioned exactly at a wall gap within
`OPENING_PROXIMITY_TOL`). Patch `_axis001_scan_opening_evidence` (or
`scan_opening_evidence` at its import site in `space.py`) with a `MagicMock`, call
`handle_find_opening_candidates` with an explicit (non-empty, resolvable) `axis_grid`
override to avoid triggering unrelated auto-chains, and assert the mock's
`call_count == 0`.

- [ ] **Step 3: Run to verify it fails for the right reason**

Run the new test — expected failure: mock WAS called (`call_count == 1`), proving
the gate doesn't exist yet (this step should be run against the pre-Task-2 code;
if Task 2 is already done by the time this task starts, skip straight to Step 4's
real run and treat a first-try pass as confirmation, noting in the task that the
red step was implicitly covered by Task 2's TDD-style implementation).

- [ ] **Step 4: Run to verify it passes**

After Task 2's gating fix lands, run the test again — expected: mock's
`call_count == 0` (evidence scan never attempted since no candidate needed it).

- [ ] **Step 5: Self-review**

Confirm the test doesn't accidentally trigger the `walls`/`doors`/`windows` /
`axis_grid` auto-chain in a way that requires live COM (all extraction inputs and
the axis grid must be passed explicitly, matching this session's earlier finding
that `axis_grid={"x_axes": [], "y_axes": []}` disables that particular auto-chain).

---

### Task 4: Full regression + CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the full opening-evidence + space-handler test suites**

Run:
```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_opening_evidence.py -v
```
plus whatever test file Task 3 added to/created — all must PASS.

- [ ] **Step 2: Run the workspace audit**

Run: `bun scripts/audit.ts` — must exit clean.

- [ ] **Step 3: Add the CHANGELOG entry**

Add under `[Unreleased]` → `### Fixed`:

```
- **[2026-07-30]**: **Fixed `zwcad_find_opening_candidates` timing out (>300s) on large drawings** — Root-caused to two compounding issues in `handle_find_opening_candidates` (`src/cad_intelligence/cad_io/handlers/space.py`): (1) the AXIS-001 §3.2 co-located-entity evidence scan ran unconditionally whenever a live COM session was available, even when every wall-gap candidate had already been resolved by the explicit DoorEntity/WindowEntity pass — contradicting the evidence scan's own documented "purely additive, only for still-unknown candidates" design; now gated on `any(c.kind == "unknown" for c in candidates)`. (2) `opening_evidence._scan_openings` independently re-walked all of `doc.ModelSpace` via slow per-property COM round-trips (`ms.Item(i)` + individual `.Layer`/`.Coordinates`/`.Area` reads) instead of reusing the request-scoped `ModelSpaceScanResult` cache ADR-014 already provides — rewritten to consume `Entry` objects from `scan_modelspace(doc)` instead, making it free on a cache hit (e.g. after `extract_cad_objects` already ran in the same request) and a single already-optimized pass on a cache miss, with zero classification-output changes (same six evidence buckets, same thresholds). `_scan_openings` is now unit-testable without a live ZWCAD session for the first time (previously "only smoke-testable against a real ZWCAD session" per its own docstring) — 9 new tests in `tests/test_opening_evidence.py`, including a regression test for a real edge case caught during design review (a polyline whose live COM `.Area` read fails is pre-baked to `0.0` by `scan_modelspace`, not `None` — the rewritten fallback logic correctly treats `0.0` as "unavailable" via a falsy check rather than `is not None`, restoring the original bbox-area-fallback behavior). `scripts/rematch_openings.py`'s own independent `_scan_openings` (the standalone fallback script) is intentionally untouched, per AXIS-001-design.md §3.2's existing "accepted duplication" policy.
```

- [ ] **Step 4: Self-review**

Confirm the CHANGELOG entry accurately describes both fixes (gating + root-cause
rewrite), doesn't overclaim (e.g. doesn't say "eliminates all COM scans," only
"reuses the cache / avoids a redundant re-scan"), and correctly notes
`rematch_openings.py` was NOT touched.

---

### Task 5: Final whole-implementation review

**Files:** Read-only across Tasks 1-4.

- [ ] **Step 1: Full regression run**

```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_opening_evidence.py -v
```
plus Task 3's test file. All PASS.

- [ ] **Step 2: Verify only intended files changed**

`git status --short` should show exactly: `src/cad_intelligence/semantic/opening_evidence.py`,
`src/cad_intelligence/cad_io/handlers/space.py`, `tests/test_opening_evidence.py`,
whatever file Task 3 added/modified, `CHANGELOG.md`, plus the two new spec/plan
docs already written this session. **No changes to `scripts/rematch_openings.py`**
(the standalone script — confirm via `git status` that it does not appear).

- [ ] **Step 3: Grep-confirm the old direct-COM call pattern is gone**

Run:
```
grep -n "_axis001_scan_opening_evidence(doc, ms)" src/cad_intelligence/cad_io/handlers/space.py
```
Expected: no matches (the call site now passes `scan_result`, not `doc, ms`).

- [ ] **Step 4: Adversarial re-read for the exact regression the spec review caught**

Re-open `opening_evidence.py` and confirm the DOOR-layer polyline area fallback
reads `if entry.area else (width * height)` — NOT `if entry.area is not None else
...`. This is the single line most likely to get "corrected" back to the more
obvious-looking `is not None` form by a future editor unaware of the
`Entry.area`-defaults-to-`0.0` gotcha; the comment placed above it (per the spec)
must still be present to prevent that regression from recurring.

---

## Completion

After Task 5 passes, run:

```
/sync "fix(cad-io): stop find_opening_candidates timing out — gate evidence scan on unknown candidates + reuse cached ModelSpace scan"
```

## Risk Notes

- **The `Entry.area` falsy-vs-`is not None` distinction (Task 1) is the highest-risk
  single line in this plan** — it looks like an unnecessary complication to a
  reviewer unfamiliar with the investigation, and is the most likely thing to get
  "simplified" back to the wrong form later. The comment explaining it must ship
  with the code, not just live in the spec.
- **Task 3's test setup is the most likely place to stall** — constructing wall
  gaps that resolve to non-"unknown" via `find_wall_discontinuities` requires
  matching this project's existing `OPENING_PROXIMITY_TOL`-based matching logic.
  If no existing test file for `handle_find_opening_candidates` is found in Step 1,
  budget extra time to understand `find_wall_discontinuities`'s matching
  criteria from `space_geometry.py` directly rather than guessing at coordinates.
- **This fix does not address `_scan_openings`'s underlying detection accuracy**
  (the earlier finding in this session that grouped door widths of 40mm/50mm/60mm
  and a `-1.0`-width window look wrong) — that's a data-quality/heuristic-tuning
  problem, explicitly out of scope for this performance fix.
