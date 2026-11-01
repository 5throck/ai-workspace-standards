# `_find_gaps` Duplicate-Endpoint Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `_find_gaps` reporting the same real gap K1×K2 times when K1 wall-segment endpoints on one side and K2 on the other legitimately share one welded coordinate (confirmed: 462 raw endpoints collapse to 152 unique coordinates after welding, and duplication up to 82x was observed on the real drawing).

**Architecture:** Deduplicate `_find_gaps`'s internal `endpoints` list by exact coordinate (a `dict[tuple[float,float], ShapelyPoint]`) before the existing O(N²) all-pairs comparison — safe because `_weld_endpoints`/`_cluster_endpoints` already normalize coincident points to bit-identical float coordinates (confirmed via code read: the same `rep` tuple is assigned to every member of a cluster, never independently recomputed).

**Tech Stack:** Python 3.11+, `shapely.geometry.LineString`/`Point`, `unittest`.

**Spec:** `docs/superpowers/specs/2026-07-30-find-gaps-dedup-design.md` (reviewed and approved).

---

## Reference Conventions

- `tests/test_space_geometry.py`'s `TestFindGaps` class (line 57) already exists with
  `unittest.TestCase`-style tests (`test_empty_lines`, `test_two_lines_with_gap`,
  `test_coincident_endpoints_excluded`, `test_no_duplicate_gaps`, etc.) — add the new
  test as a new method on this SAME class, matching its style (plain `LineString`
  construction, `self.assertEqual`/`assertAlmostEqual`).
- Run tests: `cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_space_geometry.py -v`

---

### Task 1: Fix `_find_gaps` + add regression test

**Files:**
- Modify: `src/cad_intelligence/geometry/space_geometry.py` (`_find_gaps` only)
- Modify: `tests/test_space_geometry.py` (`TestFindGaps` class)

- [ ] **Step 1: Write the failing test**

Add to `TestFindGaps` in `tests/test_space_geometry.py`:

```python
    def test_shared_endpoint_cluster_reports_gap_once(self):
        """Multiple wall segments legitimately sharing one welded endpoint
        (e.g. several segments meeting at a T-junction) must not cause the
        single real gap between two such clusters to be reported multiple
        times. Regression test for the K1xK2 duplication bug: 3 lines
        converging on point A=(1000,0) (a 3-way junction) and 2 lines
        converging on point B=(1300,0) (a 2-way junction), with
        dist(A,B)=300 <= tol=500, must produce exactly ONE gap tuple, not
        3*2=6.

        The non-junction endpoints are deliberately placed far away (5000+
        units) and spread apart from each other so ONLY the two junction
        points are mutually within tol — otherwise spoke-to-spoke or
        spoke-to-opposite-junction distances could register spurious extra
        gaps unrelated to what this test is checking. These exact
        coordinates were verified by running BOTH the current (unfixed)
        and the fixed _find_gaps against them directly: unfixed produces
        exactly 6 duplicate (1000,0)-(1300,0) tuples and nothing else;
        fixed produces exactly 1.
        """
        lines = [
            # 3 lines converging on (1000, 0) — e.g. a 3-way T-junction
            LineString([(-5000, 8000), (1000, 0)]),
            LineString([(6000, 9000), (1000, 0)]),
            LineString([(1000, -6000), (1000, 0)]),
            # 2 lines converging on (1300, 0) — a 2-way junction, 300 units
            # away from the cluster above (within tol=500)
            LineString([(-3000, -7000), (1300, 0)]),
            LineString([(8000, -8000), (1300, 0)]),
        ]
        gaps = _find_gaps(lines, tol=500.0)
        self.assertEqual(len(gaps), 1)
        self.assertAlmostEqual(gaps[0][2], 300.0)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_space_geometry.py::TestFindGaps::test_shared_endpoint_cluster_reports_gap_once -v`
Expected: `AssertionError` — `len(gaps)` is 6 (3×2 duplicate `(1000,0)-(1300,0)` tuples),
not 1, against the current undeduplicated implementation. This exact count (6, not
some other number) was verified by directly running the current unfixed `_find_gaps`
against these coordinates before writing this plan — if a different count appears,
STOP and re-verify the coordinates before proceeding, don't assume the plan is still
correct.

- [ ] **Step 3: Apply the fix**

Replace `_find_gaps`'s endpoint-collection section in
`src/cad_intelligence/geometry/space_geometry.py` (the function starting at line 746)
exactly as specified in the spec's §Design "Modified `_find_gaps`" code block — copy
verbatim. Only the endpoint-collection loop changes (dict-based dedup by exact
coordinate); the O(N²) comparison loop, the `seen: set[tuple[int,int]]` index guard,
the `1e-6 < dist <= tol` filter, and the return shape are all unchanged.

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_space_geometry.py::TestFindGaps::test_shared_endpoint_cluster_reports_gap_once -v`
Expected: PASS.

- [ ] **Step 5: Run the full `TestFindGaps` class + full file for regressions**

Run: `python -m pytest tests/test_space_geometry.py -v`
Expected: ALL PASS — the 5 pre-existing `TestFindGaps` tests
(`test_empty_lines`/`test_single_line_no_gap`/`test_two_lines_with_gap`/
`test_gap_larger_than_tol_excluded`/`test_coincident_endpoints_excluded`/
`test_no_duplicate_gaps`) plus every other test class in the file (e.g.
`TestBridgeDoorWindowGaps`, which depends on `_find_gaps` internally) must be unaffected.

- [ ] **Step 6: Self-review**

Confirm: the dedup dict uses exact float-tuple keys (no rounding — welding already
guarantees bit-identical coincident coordinates, so rounding would be an unnecessary
and potentially lossy addition); `endpoints = list(seen_coords.values())` replaces the
old flat-append list entirely; the O(N²) loop's `i`/`j` indices are freshly enumerated
over this deduplicated list (no stale index references to the old list).

---

### Task 2: Real-drawing verification (manual, informs CHANGELOG wording — not a unit test)

**Files:** none (verification only)

- [ ] **Step 1: Re-run against the real extracted wall/door/window data from this session**

If the scratch files from this session's investigation still exist
(`memory/drawings/opening_input2.json`), re-run the same manual verification script
used during investigation:
```python
import json, time
with open(r'C:/git/ai_workspace/Projects/co-architect/memory/drawings/opening_input2.json', encoding='utf-8') as f:
    d = json.load(f)
walls_f = [w for w in d['walls'] if w['layer'] in ('2sec','3SEC') and w.get('length',0) > 1]
doors_f = d['doors']
windows_f = d['windows']

from cad_intelligence.cad_io.handlers import space
t0 = time.time()
result = space.handle_find_opening_candidates({
    'walls': walls_f, 'doors': doors_f, 'windows': windows_f,
    'axis_grid': {'x_axes': [], 'y_axes': []},
})
print('elapsed:', time.time()-t0)
candidates = result.data.get('candidates', [])
print('n candidates:', len(candidates))
from collections import Counter
seen = Counter()
for c in candidates:
    key = tuple(tuple(p) for p in c['gap_endpoints'])
    seen[key] += 1
print('unique gaps:', len(seen), 'max dup:', max(seen.values()) if seen else 0)
```
Expected: candidate count drops substantially from the pre-fix 3,943, and max
duplication of any single gap drops to 1 (each unique gap reported exactly once) —
NOTE: some duplication may persist if it originates from the SEPARATE issue already
identified this session (literally-overlapping wall CAD entities in the source
drawing, e.g. handles `1603`/`1F5D`/`1FDD`/`1FDE`) — that is explicitly out of scope
for this fix (see spec's Non-Goals). If duplication remains, confirm it's now
proportional to genuine overlapping input segments, not the O(N²) endpoint-index
artifact this task fixes.

- [ ] **Step 2: Record the actual before/after numbers for the CHANGELOG entry**

Note the exact candidate count and max-duplication values observed — Task 3's
CHANGELOG entry must report real measured numbers, not the estimates from the design
spec's investigation notes (which used a different walls_f `>1` length filter that may
not exactly match this task's re-run).

---

### Task 3: CHANGELOG entry

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add entry under `[Unreleased]` → `### Fixed`**

Using Task 2's actual measured numbers, add an entry describing: the root cause
(multiple wall-segment endpoints legitimately sharing one welded coordinate after
`_weld_endpoints`, but `_find_gaps` comparing them as distinct list entries, producing
K1×K2 duplicate gap reports for a single real gap between two coincident-endpoint
clusters); the fix (dedup by exact coordinate before the O(N²) comparison, lossless
since welding already produces bit-identical coincident coordinates); the measured
before/after candidate counts from Task 2; and an explicit note that a separate,
already-documented overlapping-wall-CAD-entity issue in the source drawing is NOT
addressed by this fix (out of scope, per the spec's Non-Goals).

- [ ] **Step 2: Self-review**

Confirm the entry uses Task 2's REAL measured numbers (not spec-estimate numbers),
and does not overclaim — this fix addresses the endpoint-duplication mechanism, not
every possible source of duplicate candidates.

---

### Task 4: Final review

**Files:** Read-only across Tasks 1-3.

- [ ] **Step 1: Full regression run**

```
cd C:/git/ai_workspace/Projects/co-architect && python -m pytest tests/test_space_geometry.py -v
```
All PASS.

- [ ] **Step 2: Run the workspace audit**

Run: `bun scripts/audit.ts` — must exit clean.

- [ ] **Step 3: Verify only intended files changed**

`git status --short` should show exactly: `src/cad_intelligence/geometry/space_geometry.py`,
`tests/test_space_geometry.py`, `CHANGELOG.md`, plus this session's spec/plan docs.

---

## Completion

After Task 4 passes, run:

```
/sync "fix(geometry): dedupe shared endpoint coordinates in _find_gaps to stop combinatorial gap duplication"
```

## Risk Notes

- **The dedup must use EXACT float equality, not a rounding/snapping tolerance** — since
  `_weld_endpoints` already guarantees bit-identical coordinates for coincident points,
  introducing a second tolerance-based dedup here would be redundant complexity and
  could subtly interact with `tol` (the gap-search tolerance) in confusing ways. Keep
  it simple: dict keyed on the exact `(x, y)` tuple.
- **Task 2's manual verification is not automated** and requires either the live ZWCAD
  session or the scratch JSON files from this session's investigation — if neither is
  available when this plan is executed, this step can be skipped, but the CHANGELOG
  entry (Task 3) must then say so explicitly rather than inventing numbers.
