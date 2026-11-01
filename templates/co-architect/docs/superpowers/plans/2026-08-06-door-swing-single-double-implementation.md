---
lang: ko
lang_reason: source-material
---

# Door SWING_SINGLE / SWING_DOUBLE Implementation Plan (Taxonomy PR 3)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two `DoorStyle` members (`SWING_SINGLE`, `SWING_DOUBLE`) and their YAML rules so the door pipeline classifies standard single- and double-swing doors (yeodadimun/ssang-yeodadimun) -- the single most common Korean residential door type, and a directly-measured contributor to the original 31% real-drawing no-match rate.

**Architecture:** Purely additive, same shape as the SLIDING_FRAMELESS PR (merged #245): two new `DoorStyle` members, two new YAML rule files consuming the existing `arc_count`/`diagonal_count`/`frame_count` features -- no `EvidenceKind`, detector, or evidence-extractor changes. The one design subtlety (already resolved during spec review) is that `door_swing_single.yaml` uses `frame_count` as a `prefers`, not a `requires`, because real-drawing verification found arc-swing candidates do not cluster with frame lines (nearest lines were 700-1000mm away, outside the 200mm clustering radius) -- a `requires` would silently exclude the real-world target case.

**Tech Stack:** Python, the existing `RuleEngine`/`YamlRuleEvaluator` YAML-rule DSL, pytest.

Reference spec: `docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md`, section "PR 3 -- `SWING_SINGLE` / `SWING_DOUBLE`" (approved, merged as PR #244).

---

### Task 1: `DoorStyle.SWING_SINGLE` / `SWING_DOUBLE` enum members

**Files:**
- Modify: `src/cad_intelligence/semantic/door_classifier.py`
- Test: `tests/test_door_classifier.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_door_classifier.py`'s `TestDoorStyle` class:

```python
    def test_swing_members(self) -> None:
        assert DoorStyle.SWING_SINGLE == "swing_single"
        assert DoorStyle.SWING_DOUBLE == "swing_double"
        assert DOOR_STYLE_MAP["swing_single_door"] == DoorStyle.SWING_SINGLE
        assert DOOR_STYLE_MAP["swing_double_door"] == DoorStyle.SWING_DOUBLE
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_door_classifier.py::TestDoorStyle::test_swing_members -v`
Expected: FAIL with `AttributeError: SWING_SINGLE`

- [ ] **Step 3: Add the enum members and map entries**

In `src/cad_intelligence/semantic/door_classifier.py`, add `SWING_SINGLE = "swing_single"`
and `SWING_DOUBLE = "swing_double"` as the 7th/8th `DoorStyle` members (update the class
docstring's "6-type" to "8-type" and mention the two new members), and add
`"swing_single_door": DoorStyle.SWING_SINGLE` and `"swing_double_door": DoorStyle.SWING_DOUBLE`
to `DOOR_STYLE_MAP`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_door_classifier.py::TestDoorStyle -v`
Expected: PASS (all `TestDoorStyle` methods)

- [ ] **Step 5: Stage (do not commit -- this workspace's pre-commit hook forbids direct
  `git commit`; only `/sync`, run at the end, may commit)**

```bash
git add src/cad_intelligence/semantic/door_classifier.py tests/test_door_classifier.py
```

---

### Task 2: `door_swing_single.yaml` + `door_swing_double.yaml` rules

**Files:**
- Create: `src/cad_intelligence/patterns/opening/door_swing_single.yaml`
- Create: `src/cad_intelligence/patterns/opening/door_swing_double.yaml`
- Test: `tests/test_door_classifier.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_door_classifier.py` (after `TestSlidingFramelessRule`), reusing the
existing `_make_engine_classifier()` pattern:

```python
class TestSwingRules:
    def _make_engine_classifier(self) -> DoorClassifier:
        from cad_intelligence.rules import RuleEngine
        from cad_intelligence.rules.registry import RuleRegistry

        registry = RuleRegistry()
        registry.load_from_yaml(Path("src/cad_intelligence/patterns/opening"))
        engine = RuleEngine()
        for rule in registry.rules_for_domain("door_detection"):
            engine.register(rule)
        evaluator = YamlRuleEvaluator(
            rule_engine=engine,
            domain=RuleDomain.DOOR_DETECTION,
            style_map=DOOR_STYLE_MAP,
            object_id="door_candidate",
        )
        return DoorClassifier(evaluator=evaluator)

    def test_one_arc_no_frame_matches_swing_single(self) -> None:
        """Real-drawing-realistic case: arc-swing candidate with no frame line
        (frame_count=0) must still match -- frame_count is a `prefers`, not a
        `requires`, in door_swing_single.yaml specifically to cover this case."""
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(arc_count=1, diagonal_count=0, frame_count=0)
        cls = classifier.classify(feats)
        assert any(m.style == DoorStyle.SWING_SINGLE for m in cls.matches)
        # Must win top-match slot over door_mesh (base_score 0.75, capped 0.77) even
        # when a frame IS present -- see the second assertion below.

    def test_one_arc_with_frame_still_wins_over_mesh(self) -> None:
        """When a frame line IS present alongside a single arc, both door_mesh.yaml
        (requires frame_count>=1, arc_count>=1, diagonal_count=0) and
        door_swing_single.yaml can match -- swing's base_score=0.85 must sort above
        mesh's capped 0.77 ceiling as the top match."""
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(arc_count=1, diagonal_count=0, frame_count=1)
        cls = classifier.classify(feats)
        assert cls.matches[0].style == DoorStyle.SWING_SINGLE

    def test_two_arcs_matches_swing_double_not_single(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(arc_count=2, diagonal_count=0, frame_count=0)
        cls = classifier.classify(feats)
        assert any(m.style == DoorStyle.SWING_DOUBLE for m in cls.matches)
        assert not any(m.style == DoorStyle.SWING_SINGLE for m in cls.matches)

    def test_diagonal_present_excludes_both_swing_rules(self) -> None:
        """Both swing rules require diagonal_count: 0 -- a candidate with a
        diagonal (e.g. a different symbol's brace) must not match either."""
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(arc_count=1, diagonal_count=1, frame_count=0)
        cls = classifier.classify(feats)
        assert not any(
            m.style in (DoorStyle.SWING_SINGLE, DoorStyle.SWING_DOUBLE)
            for m in cls.matches
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_door_classifier.py::TestSwingRules -v`
Expected: FAIL on the tests asserting a swing match exists (no rule yet);
`test_diagonal_present_excludes_both_swing_rules` will trivially pass at this stage.

- [ ] **Step 3: Write the rule files**

Create `src/cad_intelligence/patterns/opening/door_swing_single.yaml`:

```yaml
# Door swing-single pattern — Korean architectural standard (door symbol)
# yeodadimun: one swing arc, no diagonal. frame_count is `prefers` not `requires` --
# real-drawing verification found arc-swing candidates do not cluster with the long
# straight AcDbLine entities that form a door's frame edges (nearest such lines were
# 700-1000mm+ away, outside the 200mm clustering radius); requiring frame_count>=1
# would silently exclude the real-world target case. (Note: closed polylines --
# regardless of size -- always produce FRAME evidence per
# opening_symbol_evidence.py, so this is specifically about long frame LINES, not
# about any closed-polyline threshold marks that may also be nearby.) See
# docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md PR 3.
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

Create `src/cad_intelligence/patterns/opening/door_swing_double.yaml`:

```yaml
# Door swing-double pattern — Korean architectural standard (door symbol)
# ssang-yeodadimun: two opposing swing arcs. Same frame_count-as-prefers rationale as
# door_swing_single.yaml. arc_count>=2 (not ==2) so 2+ arcs match double, and since
# door_swing_single.yaml requires arc_count==1 exactly, a 2-arc candidate matches
# ONLY swing_double, never both.
rules:
  - id: DOOR-SWING-DOUBLE-001
    name: swing_double_door
    domain: door_detection
    requires:
      arc_count: ">=2"
      diagonal_count: 0
    prefers:
      frame_count: ">=1"
    base_score: 0.85
    explanation:
      ko: "스윙 호 2개가 감지되어 쌍여닫이문"
      en: "Two swing arcs detected -- double hinged door"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_door_classifier.py -v`
Expected: PASS -- all classes including the new `TestSwingRules`, and all pre-existing
classes (`TestDoorStyle`, `TestDoorClassifierNoEvaluator`, `TestDoorClassifierRuleEngine`,
`TestSlidingFramelessRule`) confirming no interference with the 6 existing rules.

- [ ] **Step 5: Stage**

```bash
git add src/cad_intelligence/patterns/opening/door_swing_single.yaml src/cad_intelligence/patterns/opening/door_swing_double.yaml tests/test_door_classifier.py
```

---

### Task 3: Exhaustive-match + rendering TODO verification

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/render_style.py` (comment only)

- [ ] **Step 1: Re-run the exhaustive-match grep**

Run: `grep -rn "DoorStyle\." --include=*.py src/ | grep -v "test_" | grep -v "door_classifier.py" | grep -v "door_recognizer.py"`
Expected: no output, same as the SLIDING_FRAMELESS PR's verification. If this now returns a
hit, stop and investigate that call site before continuing.

- [ ] **Step 2: Extend the rendering TODO comment**

`DoorStrategyRegistry` in `src/cad_intelligence/elevation/renderers/render_style.py` already
has a TODO comment for `sliding_frameless` (added in PR #245). Extend it to also note
`swing_single`/`swing_double` fall back to `NoOpDoorStrategy` today:

```python
    # TODO: render "sliding_frameless" using the same glyph as sliding_light/
    # sliding_heavy but without drawing a frame polyline (SLIDING_FRAMELESS falls
    # back to NoOpDoorStrategy today -- see
    # docs/superpowers/specs/2026-08-06-door-sliding-frameless-design.md Section 5).
    # TODO: render "swing_single"/"swing_double" with an arc-swing glyph (both also
    # fall back to NoOpDoorStrategy today -- see
    # docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md PR 3).
```

- [ ] **Step 3: Confirm no behavior change**

Run: `python -m pytest tests/test_render_style.py -v`
Expected: PASS, unchanged (comment-only edit)

- [ ] **Step 4: Stage**

```bash
git add src/cad_intelligence/elevation/renderers/render_style.py
```

---

### Task 4: Golden fixtures (swing_single_01, swing_double_01)

**Files:**
- Create: `tests/golden/doors/swing_single_01/geometry.json`
- Create: `tests/golden/doors/swing_double_01/geometry.json`
- Modify: `tests/test_door_pipeline.py`

- [ ] **Step 1: Write the fixtures**

**Correction from plan review:** `opening_symbol_evidence.py`'s FRAME extraction
(`# 1. FRAME — 닫힌 polyline`) treats *every* closed polyline as `FRAME` evidence regardless
of size or proximity -- there is no size/distance threshold that would let a "small nearby
closed-polyline" avoid producing `frame_count>=1`. (`mesh_01`'s polyline is not a "small"
exception either -- it's a full 900x40mm rectangle that IS `door_mesh.yaml`'s required
frame; it is not a precedent for a frame-less fixture.) So these fixtures are **arc-only, no
`closed_polylines`**, which genuinely produces `frame_count=0` end-to-end -- directly
exercising the real-world frameless case `door_swing_single.yaml`'s `prefers`-not-`requires`
design targets, rather than only testing it via Task 2's manually-constructed
`OpeningFeatures` unit test.

Create `tests/golden/doors/swing_single_01/geometry.json`:

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Swing-single door (yeodadimun): one swing arc, no frame -- matches real-drawing clustering behavior (arc-swing candidates were found not to cluster with frame lines)",
  "style": "swing_single",
  "lines": [],
  "arcs": [
    {"handle": "A1", "center": [450, 20], "radius": 800, "start_angle": 0, "end_angle": 90}
  ],
  "closed_polylines": []
}
```

Create `tests/golden/doors/swing_double_01/geometry.json`:

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Swing-double door (ssang-yeodadimun): two opposing swing arcs, no frame",
  "style": "swing_double",
  "lines": [],
  "arcs": [
    {"handle": "A1", "center": [225, 20], "radius": 400, "start_angle": 0, "end_angle": 90},
    {"handle": "A2", "center": [675, 20], "radius": 400, "start_angle": 90, "end_angle": 180}
  ],
  "closed_polylines": []
}
```

- [ ] **Step 2: Wire into `_STYLE_ENUM`**

In `tests/test_door_pipeline.py`, add to `_STYLE_ENUM`:
`"swing_single": DoorStyle.SWING_SINGLE, "swing_double": DoorStyle.SWING_DOUBLE,`

- [ ] **Step 3: Run and verify**

Run: `python -m pytest tests/test_door_pipeline.py -v`
Expected: PASS -- all 8 golden cases now (the original 5, `sliding_frameless_01`, and the
new `swing_single_01`/`swing_double_01`), plus the negative test from PR #245.

If either new fixture doesn't classify as expected (e.g. `swing_double_01`'s two arcs don't
cluster into a single candidate within the detector's proximity radius, or an arc's
sweep/radius isn't picked up as `ARC` evidence at all), that's a real signal to adjust the
fixture's geometry -- this is the Pre-Implementation Verification Gate doing its job.
Investigate before forcing a pass.

- [ ] **Step 4: Run full regression**

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions. Record the count for the CHANGELOG entry (baseline after
PR #245: 4635 passed).

- [ ] **Step 5: Stage**

```bash
git add tests/golden/doors/swing_single_01 tests/golden/doors/swing_double_01 tests/test_door_pipeline.py
```

---

### Task 5: Real-drawing re-measurement

**Files:** none committed -- measurement-only task, same discipline as the SLIDING_FRAMELESS
PR's Task 6 and the 2026-08-06 feature-review meeting's Action Item.

- [ ] **Step 1: Re-run the pipeline against real DOOR-layer data**

Reconstruct entities from `memory/drawings/diag_openings_dump.json`'s `door_entities` list
(182 raw entries from 32-pyeong-apartment) into `OpeningSymbolDetector`-shaped fake entries
(mirror the reconstruction approach used for the SLIDING_FRAMELESS PR's re-measurement --
`AcDbLine`/`AcDbPolyline`/`AcDbArc` records, synthesized handles, all on layer `"A-DOOR"`).
Run `OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(...)` against the full
reconstruction (now including the two new swing rules alongside all previously-shipped
rules).

- [ ] **Step 2: Record and compare**

Record the new overall no-match rate and, specifically, how many previously-unmatched
candidates now classify as `SWING_SINGLE` or `SWING_DOUBLE`. Compare against the
post-SLIDING_FRAMELESS baseline (2.0% overall no-match, measured in PR #245). The spec
doesn't set a fresh numeric target for PR 3 specifically (the taxonomy design's acceptance
criteria was written before PR #245's frameless fix landed) -- record the actual delta and
note it in the CHANGELOG; a further reduction in the no-match rate, or confirmation that the
remaining misses are unrelated to swing doors, are both acceptable outcomes as long as the
number is reported, not assumed.

- [ ] **Step 3: No commit for this task** -- results feed into Task 6's CHANGELOG entry.

---

### Task 6: CHANGELOG + final regression

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

English only, per project language policy. Include: the two new `DoorStyle` members, the
`frame_count`-as-`prefers` design rationale, the score-ordering-vs-`door_mesh` verification,
new golden fixtures + unit tests, the full-suite before/after count from Task 4 Step 4, and
the real-drawing re-measurement numbers from Task 5.

- [ ] **Step 2: Run full regression one more time**

Run: `python -m pytest tests/ -q`
Expected: PASS, same count as Task 4 Step 4.

- [ ] **Step 3: Stage**

```bash
git add CHANGELOG.md
```

---

### Task 7: `/sync`

Run `/sync "feat(semantic,cad_io): add DoorStyle.SWING_SINGLE/SWING_DOUBLE via swing door rules (Taxonomy PR 3, Backlog #14)"` -- this is the final step, per CLAUDE.md's Execution Plan Boilerplate. It handles lifecycle + audit + commit + push + PR in one pipeline.

**Before running `/sync`:** confirm `git branch --show-current` and `git log --oneline -3`
against `origin/main` -- if this plan's own docs commit (from the plan-writing step) already
opened a PR and it's still open, stay on that branch; if it merged since this plan started,
switch to `main`, `git pull --ff-only`, and carry any uncommitted work forward first.
