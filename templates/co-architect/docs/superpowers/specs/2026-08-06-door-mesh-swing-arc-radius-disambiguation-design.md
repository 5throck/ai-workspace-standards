# Door MESH/SWING_SINGLE Arc-Radius Disambiguation — Design

## Context

PR3 (`door_swing_single.yaml`/`door_swing_double.yaml`, merged as PR #246) added swing-door
rules whose `requires` (`arc_count==1` or `>=2`, `diagonal_count==0`) turned out to be a
strict subset of `door_mesh.yaml`'s `requires` (`frame_count>=1, arc_count>=1,
diagonal_count==0`). Any single-arc-plus-frame candidate now satisfies both rules, and
swing's `base_score=0.85` always outscores mesh's capped `0.77` ceiling
(`rules/registry.py`'s `prefers` bonus is capped at +0.02). This was anticipated in PR3's
spec as "the rarer case" but concretely means:

- The pre-existing PR2 golden fixture `tests/golden/doors/mesh_01` (frame + a small
  decorative arc, radius 15mm) now classifies as `swing_single`, not `mesh` -- its expected
  style was updated in place during PR3, per explicit user decision at the time.
- **MESH has had no golden-fixture coverage for any arc-bearing candidate since PR3.**
- Real-drawing re-measurement against `32-pyeong-apartment`'s DOOR-layer data confirmed this
  at scale: MESH's matched count dropped from 4 to 0, all reclassified as `SWING_SINGLE`.

**New finding from this session's re-measurement:** all 5 real `AcDbArc` entities on that
drawing's DOOR layer have radii between **528mm and 959mm** -- i.e. every real arc measured
so far is swing-door-leaf-sized. There is no confirmed real-world example of a genuinely
decorative small arc (like `mesh_01`'s synthetic radius=15) in this dataset. This means the
4 candidates that reclassified from MESH to SWING_SINGLE during PR3 were very likely
mis-tagged as MESH all along (radius 528-959mm is not decorative) -- PR3 incidentally
*fixed* those 4 real cases, and the actual coverage gap is narrower than it first appeared:
it's specifically about whether a *genuinely* decorative small arc (like `mesh_01`'s
synthetic fixture) is correctly distinguished from a functional swing-door arc, not about
real MESH doors being broken today.

## Design

### 1. `OpeningFeatures.arc_radius: float = 0.0`

New field: the **maximum** radius among all `ARC` evidence items in a candidate (not the
average) -- if a candidate has any large functional arc alongside smaller ones, the presence
of the large arc is what should drive "this is a functional swing leaf" classification, not
be diluted by averaging with smaller companions.

### 2. `OpeningFeatureExtractor.extract()` aggregation

`ARC` evidence items already carry a `radius` attribute (`opening_symbol_evidence.py:128`,
`"radius": arc.get("radius", 0.0)`) -- no `EvidenceKind` or evidence-extraction changes are
needed. Add to the existing `arc_items` aggregation block (mirroring how `arc_sweep_deg` is
already computed from `arc_items[0]`):

```python
arc_radius = (
    max(it.attributes.get("radius", 0.0) for it in arc_items)
    if arc_items else 0.0
)
```

and pass `arc_radius=arc_radius` into the returned `OpeningFeatures(...)`.

### 3. Threshold: 300mm, applied to both rules

Chosen with wide margin on both sides of the measured real-world gap (synthetic decorative
15mm vs. real functional 528-959mm) -- not equidistant-by-formula, just comfortably clear of
both known clusters:

- `door_mesh.yaml` gains `arc_radius: "<300"` to its `requires` -- only matches a
  genuinely small/decorative arc.
- `door_swing_single.yaml` and `door_swing_double.yaml` each gain `arc_radius: ">=300"` to
  their `requires` -- only matches a functional door-leaf-sized arc.

This makes the two rule families **structurally disjoint again** (like every other pair of
door rules) -- score ordering is no longer load-bearing for correctness between them, it's
only a tie-breaker of last resort the way it is everywhere else in the rule set.

### 4. Golden fixtures

- `tests/golden/doors/mesh_01/geometry.json`: revert to `"style": "mesh"` (its radius=15
  already sits well under the new 300mm threshold) -- restore its original description,
  removing the PR3-era note about reclassification, since this fixture is meshed again on
  its own genuine merits, not by score tie-break.
- `tests/golden/doors/swing_single_01`/`swing_double_01`: unchanged -- their radii (800mm,
  400mm) already clear the 300mm threshold with room to spare.
- New negative fixture `tests/golden/doors/mesh_arc_too_large_01`: frame + a single
  400mm-radius arc (below `door_mesh.yaml`'s old implicit assumption, above the new
  threshold) -- expected style `swing_single`, not `mesh`. This is the regression guard: if
  the `<300`/`>=300` split were ever loosened back to overlapping ranges, this fixture would
  start floating between the two styles again and the test would catch it.

### 5. Test changes

- `tests/test_door_classifier.py`'s `TestSwingRules.test_one_arc_with_frame_still_wins_over_mesh`
  is removed -- its premise (both rules structurally match the same candidate, score breaks
  the tie) no longer holds. Replace with `test_small_arc_radius_excludes_swing_rules` and
  `test_large_arc_radius_excludes_mesh_rule`, asserting `arc_radius` alone is now the
  discriminator (constructing `OpeningFeatures` directly with `arc_radius=15` /
  `arc_radius=400`, no detector needed).
- `TestSlidingFramelessRule`/other existing classes: unaffected, `arc_radius` defaults to
  `0.0` and none of their `requires` blocks reference it.

## Error Handling

No new error paths. `arc_radius` defaults to `0.0` for any candidate with no `ARC` evidence
(same pattern as `arc_sweep_deg`), which is `<300`, so a candidate with zero arcs trivially
satisfies `door_mesh.yaml`'s new `arc_radius: "<300"` clause -- harmless, since `door_mesh`
also `requires: arc_count>=1`, so a zero-arc candidate still can't match it regardless of the
new field.

## Testing Strategy

- Detector-independent `OpeningFeatures`-level unit tests (Section 5) prove the
  discrimination directly, without needing the full pipeline.
- Golden end-to-end fixtures (Section 4) prove it through the real detector/evidence path,
  including the new negative fixture guarding against a future threshold regression.
- Full regression suite must stay green: this only adds one `OpeningFeatures` field + two
  `requires` clauses, doesn't touch `OpeningSymbolDetector`, `EvidenceKind`, or
  `OpeningSymbolPipeline`.
- **Re-run the real-drawing re-measurement** (same methodology as PR3's Task 5) against
  `32-pyeong-apartment`'s DOOR-layer data to confirm the previously-reclassified candidates
  (radius 528-959mm) still correctly classify as `SWING_SINGLE` under the new `>=300`
  `requires` clause -- they should, with large margin, but this is worth confirming rather
  than assuming, per this project's established Verification Gate discipline.

## Out of Scope

- Any change to `door_panel.yaml`, `door_material.yaml`, `door_sliding_light.yaml`,
  `door_sliding_heavy.yaml`, or `door_sliding_frameless.yaml` -- none of them match on
  `arc_count`/`ARC` evidence in a way that creates a similar collision.
- A radius-based split for `door_swing_single.yaml` vs `door_swing_double.yaml` themselves --
  they're already disjoint via `arc_count` (`==1` vs `>=2`), unaffected by this change.
