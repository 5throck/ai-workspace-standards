---
lang: ko
lang_reason: source-material
---

# Door MESH/SWING Arc-Radius Disambiguation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `OpeningFeatures.arc_radius` and a 300mm threshold split so `door_mesh.yaml` and the two `door_swing_*.yaml` rules become structurally disjoint again, restoring golden-fixture coverage for MESH doors that PR 3 (merged as PR #246) accidentally broke.

**Architecture:** Purely additive at the feature-aggregation layer: `ARC` evidence already carries a `radius` attribute (`opening_symbol_evidence.py:128`), so this only adds one `OpeningFeatures` field computed as the max radius across a candidate's arc evidence, plus one `requires` clause on each of the three affected YAML rules. No `EvidenceKind`, detector, or evidence-extraction changes.

**Tech Stack:** Python, the existing `RuleEngine`/`YamlRuleEvaluator` YAML-rule DSL, pytest.

Reference spec: `docs/superpowers/specs/2026-08-06-door-mesh-swing-arc-radius-disambiguation-design.md` (approved, on open PR #246).

---

### Task 1: `OpeningFeatures.arc_radius` field + aggregation

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_features.py`
- Modify: `tests/test_opening_features.py` (already exists -- do NOT overwrite it, append to
  it; it currently has 3 classes: `TestOpeningEvidenceExtractor`, `TestOpeningFeatureExtractor`,
  and module-level helper `_sliding_candidate()`. `EvidenceKind`, `OpeningFeatureExtractor`,
  `OpeningFeatures`, `EvidenceItem`, `OpeningEvidence` are all already imported at the top of
  the file -- the new class below needs no new imports.)

- [ ] **Step 1: Write the failing test**

Append this new class to the END of `tests/test_opening_features.py` (after the existing
`TestOpeningFeatureExtractor` class) -- do not touch anything above it:

```python
class TestArcRadiusAggregation:
    def test_no_arc_evidence_defaults_to_zero(self) -> None:
        evidence = OpeningEvidence(candidate_handle="H1", evidence_items=())
        feats = OpeningFeatureExtractor().extract(evidence)
        assert feats.arc_radius == 0.0

    def test_single_arc_uses_its_radius(self) -> None:
        evidence = OpeningEvidence(
            candidate_handle="H1",
            evidence_items=(
                EvidenceItem(
                    kind=EvidenceKind.ARC, entity_ids=("A1",), confidence=1.0,
                    attributes={"radius": 800.0, "sweep_deg": 90.0},
                ),
            ),
        )
        feats = OpeningFeatureExtractor().extract(evidence)
        assert feats.arc_radius == 800.0

    def test_multiple_arcs_uses_max_not_average(self) -> None:
        """A large functional arc alongside a small companion arc must not be
        diluted by averaging -- the presence of the large arc is what should
        drive classification."""
        evidence = OpeningEvidence(
            candidate_handle="H1",
            evidence_items=(
                EvidenceItem(
                    kind=EvidenceKind.ARC, entity_ids=("A1",), confidence=1.0,
                    attributes={"radius": 15.0, "sweep_deg": 180.0},
                ),
                EvidenceItem(
                    kind=EvidenceKind.ARC, entity_ids=("A2",), confidence=1.0,
                    attributes={"radius": 800.0, "sweep_deg": 90.0},
                ),
            ),
        )
        feats = OpeningFeatureExtractor().extract(evidence)
        assert feats.arc_radius == 800.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_opening_features.py::TestArcRadiusAggregation -v`
Expected: FAIL -- `test_no_arc_evidence_defaults_to_zero` fails with
`AttributeError: 'OpeningFeatures' object has no attribute 'arc_radius'` (or similar), the
other two fail the same way once the first assertion is reached.

- [ ] **Step 3: Add the field to `OpeningFeatures`**

In `src/cad_intelligence/semantic/opening_features.py`, in the `OpeningFeatures` dataclass,
add a new field after `arc_sweep_deg`:

```python
    # Arc
    arc_count: int = 0
    arc_sweep_deg: float = 0.0
    arc_radius: float = 0.0
```

- [ ] **Step 4: Add the aggregation in `OpeningFeatureExtractor.extract()`**

Find the existing `arc_sweep_deg` computation:

```python
        # Arc
        arc_count = len(arc_items)
        arc_sweep_deg = (
            arc_items[0].attributes.get("sweep_deg", 0.0)
            if arc_items else 0.0
        )
```

Add directly below it:

```python
        arc_radius = (
            max(it.attributes.get("radius", 0.0) for it in arc_items)
            if arc_items else 0.0
        )
```

Then add `arc_radius=arc_radius,` to the `OpeningFeatures(...)` constructor call at the
bottom of `extract()`, alongside the existing `arc_sweep_deg=arc_sweep_deg,` line.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_opening_features.py -v`
Expected: PASS (all tests in the file, including the 3 pre-existing classes)

- [ ] **Step 6: Stage (do not commit -- this workspace's pre-commit hook forbids direct
  `git commit`; only `/sync`, run at the end, may commit)**

```bash
git add src/cad_intelligence/semantic/opening_features.py tests/test_opening_features.py
```

---

### Task 2: 300mm threshold in the three affected rules

**Files:**
- Modify: `src/cad_intelligence/patterns/opening/door_mesh.yaml`
- Modify: `src/cad_intelligence/patterns/opening/door_swing_single.yaml`
- Modify: `src/cad_intelligence/patterns/opening/door_swing_double.yaml`
- Modify: `tests/test_door_classifier.py`

- [ ] **Step 1: Write the failing tests**

In `tests/test_door_classifier.py`, remove `TestSwingRules.test_one_arc_with_frame_still_wins_over_mesh`
entirely -- its premise (both rules structurally match, score breaks the tie) no longer
holds once this task lands. In its place, add two new tests to the `TestSwingRules` class:

```python
    def test_small_arc_radius_excludes_swing_rules(self) -> None:
        """A decorative small arc (radius < 300mm) must not match either swing rule,
        even with arc_count/diagonal_count otherwise satisfying their requires."""
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(
            arc_count=1, diagonal_count=0, frame_count=1, arc_radius=15.0,
        )
        cls = classifier.classify(feats)
        assert not any(
            m.style in (DoorStyle.SWING_SINGLE, DoorStyle.SWING_DOUBLE)
            for m in cls.matches
        )
        assert any(m.style == DoorStyle.MESH for m in cls.matches)

    def test_large_arc_radius_excludes_mesh_rule(self) -> None:
        """A functional door-leaf-sized arc (radius >= 300mm) must not match
        door_mesh.yaml, even with frame_count/arc_count/diagonal_count otherwise
        satisfying its requires."""
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(
            arc_count=1, diagonal_count=0, frame_count=1, arc_radius=800.0,
        )
        cls = classifier.classify(feats)
        assert not any(m.style == DoorStyle.MESH for m in cls.matches)
        assert any(m.style == DoorStyle.SWING_SINGLE for m in cls.matches)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_door_classifier.py::TestSwingRules -v`
Expected: `test_small_arc_radius_excludes_swing_rules` FAILS on
`assert not any(...)` (since `door_swing_single.yaml` doesn't yet check `arc_radius`, it
still matches a `radius=15.0` candidate). `test_large_arc_radius_excludes_mesh_rule` FAILS on
`assert not any(m.style == DoorStyle.MESH ...)` (since `door_mesh.yaml` doesn't yet exclude
large-radius arcs).

- [ ] **Step 3: Add the `arc_radius` requires clause to all three rule files**

In `src/cad_intelligence/patterns/opening/door_mesh.yaml`, add `arc_radius: "<300"` to
`requires`:

```yaml
rules:
  - id: DOOR-MESH-001
    name: mesh_door
    domain: door_detection
    requires:
      frame_count: ">=1"
      arc_count: ">=1"
      diagonal_count: 0
      arc_radius: "<300"
    prefers:
      wall_overlap: ">0.5"
    base_score: 0.75
    explanation:
      ko: "프레임과 호가 감지되어 망사문"
      en: "Frame + arc — mesh/screen door"
```

In `src/cad_intelligence/patterns/opening/door_swing_single.yaml`, add
`arc_radius: ">=300"` to `requires`:

```yaml
rules:
  - id: DOOR-SWING-SINGLE-001
    name: swing_single_door
    domain: door_detection
    requires:
      arc_count: "==1"
      diagonal_count: 0
      arc_radius: ">=300"
    prefers:
      frame_count: ">=1"
    base_score: 0.85
    explanation:
      ko: "스윙 호 1개가 감지되어 여닫이문"
      en: "One swing arc detected -- standard hinged door"
```

In `src/cad_intelligence/patterns/opening/door_swing_double.yaml`, add
`arc_radius: ">=300"` to `requires`:

```yaml
rules:
  - id: DOOR-SWING-DOUBLE-001
    name: swing_double_door
    domain: door_detection
    requires:
      arc_count: ">=2"
      diagonal_count: 0
      arc_radius: ">=300"
    prefers:
      frame_count: ">=1"
    base_score: 0.85
    explanation:
      ko: "스윙 호 2개가 감지되어 쌍여닫이문"
      en: "Two swing arcs detected -- double hinged door"
```

Also add a one-line comment near the top of `door_swing_single.yaml` (the file already has a
multi-line comment block explaining the `frame_count`-as-`prefers` rationale) noting the new
`arc_radius` threshold:

```yaml
# arc_radius: ">=300" excludes decorative small arcs (e.g. mesh/screen door indicators,
# ~15mm) from matching a functional door-leaf-sized swing arc (measured 528-959mm on real
# drawings) -- see
# docs/superpowers/specs/2026-08-06-door-mesh-swing-arc-radius-disambiguation-design.md.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_door_classifier.py -v`
Expected: PASS -- all classes, including the two new `TestSwingRules` tests and every
pre-existing class in the file.

- [ ] **Step 5: Stage**

```bash
git add src/cad_intelligence/patterns/opening/door_mesh.yaml src/cad_intelligence/patterns/opening/door_swing_single.yaml src/cad_intelligence/patterns/opening/door_swing_double.yaml tests/test_door_classifier.py
```

---

### Task 3: Revert `mesh_01` fixture + add negative fixture

**Files:**
- Modify: `tests/golden/doors/mesh_01/geometry.json`
- Create: `tests/golden/doors/mesh_arc_too_large_01/geometry.json`

- [ ] **Step 1: Revert `mesh_01` to its original PR2 state**

`mesh_01`'s current `geometry.json` (from PR3) has `"style": "swing_single"` and a long
description documenting the PR3-era collision. Since Task 2 now makes `arc_radius: 15`
correctly exclusive to MESH again, revert it to its original PR2 content:

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Mesh door (mangsamun): frame + small decorative arc (mesh/screen indicator)",
  "style": "mesh",
  "lines": [],
  "arcs": [
    {"handle": "A1", "center": [450, 20], "radius": 15, "start_angle": 0, "end_angle": 180}
  ],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, 0, 900, 0, 900, 40, 0, 40], "is_closed": true}
  ]
}
```

- [ ] **Step 2: Run to verify it now classifies as mesh**

Run: `python -m pytest "tests/test_door_pipeline.py::TestDoorGoldenEndToEnd::test_one_candidate_correctly_classified[mesh_01]" -v`
Expected: FAIL until Task 2's rule changes are in place (if Task 2 hasn't landed yet in this
session, this is expected -- both tasks are part of the same PR and get committed together
at the end); PASS once Task 2's `arc_radius` clauses exist. If this test still fails after
Task 2 has landed, stop and investigate before continuing -- do not force a pass.

- [ ] **Step 3: Add the negative fixture**

Create `tests/golden/doors/mesh_arc_too_large_01/geometry.json` -- frame + a single arc at
exactly the boundary-crossing radius (400mm, above the 300mm threshold, same radius already
used by `swing_double_01`'s arcs for consistency), expected to classify as `swing_single`,
not `mesh`. This is the regression guard: if the `<300`/`>=300` split were ever loosened back
into overlapping ranges, this fixture would start floating between styles and the test would
catch it.

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Frame + single arc at radius 400mm (above the 300mm mesh/swing threshold) -- regression guard for the arc_radius disambiguation: must classify as swing_single, not mesh, even with a frame present.",
  "style": "swing_single",
  "lines": [],
  "arcs": [
    {"handle": "A1", "center": [450, 20], "radius": 400, "start_angle": 0, "end_angle": 90}
  ],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, 0, 900, 0, 900, 40, 0, 40], "is_closed": true}
  ]
}
```

- [ ] **Step 4: Run full door pipeline tests**

Run: `python -m pytest tests/test_door_pipeline.py -v`
Expected: PASS -- all golden cases (`panel_01`, `material_01`, `mesh_01` now correctly
classifying as `mesh`, `sliding_light_01`, `sliding_heavy_01`, `sliding_frameless_01`,
`swing_single_01`, `swing_double_01`, and the new `mesh_arc_too_large_01`), plus the existing
negative test from PR #245.

- [ ] **Step 5: Run full regression**

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions. Record the count for the CHANGELOG entry (baseline after
Taxonomy PR 3: 4642 passed).

- [ ] **Step 6: Stage**

```bash
git add tests/golden/doors/mesh_01 tests/golden/doors/mesh_arc_too_large_01
```

---

### Task 4: Real-drawing re-measurement

**Files:** none committed -- measurement-only task, same discipline as prior PRs' real-drawing
re-measurement steps.

- [ ] **Step 1: Re-run the pipeline against real DOOR-layer data**

Reconstruct entities from `memory/drawings/diag_openings_dump.json`'s `door_entities` list
into `OpeningSymbolDetector`-shaped fake entries (same reconstruction approach used in the
prior two PRs' re-measurement steps -- `AcDbLine`/`AcDbPolyline`/`AcDbArc` records,
synthesized handles, all on layer `"A-DOOR"`). Run
`OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(...)` against the full
reconstruction.

- [ ] **Step 2: Confirm the 5 real arcs (528-959mm radius) still classify SWING_SINGLE**

Record the matched-style breakdown. Specifically confirm all 5 real `AcDbArc`-bearing
candidates (radii 528, 959, 959, 762, 673mm per this session's measurement) still classify
as `SWING_SINGLE` under the new `arc_radius>=300` requires clause -- they should, with large
margin (300mm threshold vs. 528mm+ actual), but this is worth confirming rather than
assuming. Also record the overall no-match rate (expect it to remain 0.0%, same as the
post-Taxonomy-PR-3 baseline, since this change only adds a new `requires` field that all 5
real arcs already satisfy).

- [ ] **Step 3: No commit for this task** -- results feed into Task 5's CHANGELOG entry.

---

### Task 5: CHANGELOG + final regression

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

English only, per project language policy. Include: the new `OpeningFeatures.arc_radius`
field, the 300mm threshold split across the three rule files, the reverted `mesh_01` fixture
+ new `mesh_arc_too_large_01` negative fixture, the removed/replaced `TestSwingRules` test,
the full-suite before/after count from Task 3 Step 5, and the real-drawing re-measurement
confirmation from Task 4.

- [ ] **Step 2: Run full regression one more time**

Run: `python -m pytest tests/ -q`
Expected: PASS, same count as Task 3 Step 5.

- [ ] **Step 3: Stage**

```bash
git add CHANGELOG.md
```

---

### Task 6: `/sync`

Run `/sync "fix(semantic,cad_io): disambiguate door MESH/SWING via arc_radius threshold (Backlog #14)"` -- this is the final step, per CLAUDE.md's Execution Plan Boilerplate. It handles lifecycle + audit + commit + push + PR in one pipeline.

**Before running `/sync`:** confirm `git branch --show-current` and `git log --oneline -3`
against `origin/main` -- if PR #246 (which this plan's spec/plan docs were committed to) is
still open, stay on that branch; if it merged since this plan started, switch to `main`,
`git pull --ff-only`, and carry any uncommitted work forward first.
