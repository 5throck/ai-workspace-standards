---
lang: ko
lang_reason: source-material
---

# Door SLIDING_FRAMELESS Style Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 6th `DoorStyle` member (`SLIDING_FRAMELESS`) and one new rule so the door-recognition pipeline classifies the "two parallel lines, no frame, no center line" shape that accounted for 65% of the 31% real-drawing no-match rate found in prior verification.

**Architecture:** Purely additive: one new enum member, one new YAML rule file (`patterns/opening/door_sliding_frameless.yaml`, `domain: door_detection`), positive + negative golden fixtures, and detector-independent `OpeningFeatures`-level unit tests including an explicit rule-exclusivity guard. No `EvidenceKind`, `OpeningSymbolDetector`, `OpeningEvidenceExtractor`, or `OpeningSymbolPipeline` changes -- the new rule only consumes evidence (`parallel_count`, `frame_count`, `has_center_line`) the pipeline already extracts.

**Tech Stack:** Python, the existing `RuleEngine`/`YamlRuleEvaluator` YAML-rule DSL (`src/cad_intelligence/rules/`), pytest.

Reference spec: `docs/superpowers/specs/2026-08-06-door-sliding-frameless-design.md` (approved, PR #245).

---

### Task 1: `DoorStyle.SLIDING_FRAMELESS` enum member

**Files:**
- Modify: `src/cad_intelligence/semantic/door_classifier.py:23-46`
- Test: `tests/test_door_classifier.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_door_classifier.py`'s `TestDoorStyle` class (after the existing `test_five_members`):

```python
class TestDoorStyle:
    def test_five_members(self) -> None:
        assert DoorStyle.PANEL == "panel"
        assert DoorStyle.MATERIAL == "material"
        assert DoorStyle.MESH == "mesh"
        assert DoorStyle.SLIDING_LIGHT == "sliding_light"
        assert DoorStyle.SLIDING_HEAVY == "sliding_heavy"

    def test_sliding_frameless_member(self) -> None:
        assert DoorStyle.SLIDING_FRAMELESS == "sliding_frameless"
        assert "sliding_frameless_door" in DOOR_STYLE_MAP
        assert DOOR_STYLE_MAP["sliding_frameless_door"] == DoorStyle.SLIDING_FRAMELESS
```

(This adds a new test method to the existing `TestDoorStyle` class -- don't duplicate the class, just add the method alongside `test_five_members`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_door_classifier.py::TestDoorStyle::test_sliding_frameless_member -v`
Expected: FAIL with `AttributeError: SLIDING_FRAMELESS` (enum member doesn't exist yet)

- [ ] **Step 3: Add the enum member and map entry**

In `src/cad_intelligence/semantic/door_classifier.py`, change:

```python
class DoorStyle(str, Enum):
    """Door type (Korean residential-drawing 5-type taxonomy).

    PANEL (binjimun), MATERIAL (jajaemun), MESH (mangsamun), SLIDING_LIGHT
    (miseogimun), SLIDING_HEAVY (midajimun) -- the two sliding variants are kept
    distinct as different physical mechanisms, not synonyms.
    """

    PANEL = "panel"
    MATERIAL = "material"
    MESH = "mesh"
    SLIDING_LIGHT = "sliding_light"
    SLIDING_HEAVY = "sliding_heavy"
```

to:

```python
class DoorStyle(str, Enum):
    """Door type (Korean residential-drawing 6-type taxonomy).

    PANEL (binjimun), MATERIAL (jajaemun), MESH (mangsamun), SLIDING_LIGHT
    (miseogimun), SLIDING_HEAVY (midajimun), SLIDING_FRAMELESS -- the sliding
    variants are kept distinct as different physical mechanisms, not synonyms.
    SLIDING_FRAMELESS is a sliding door drawn without a frame polyline because the
    wall itself acts as the frame (a recurring Korean apartment DOOR-layer
    convention -- see docs/superpowers/specs/2026-08-06-door-sliding-frameless-design.md).
    """

    PANEL = "panel"
    MATERIAL = "material"
    MESH = "mesh"
    SLIDING_LIGHT = "sliding_light"
    SLIDING_HEAVY = "sliding_heavy"
    SLIDING_FRAMELESS = "sliding_frameless"
```

And change:

```python
DOOR_STYLE_MAP: dict[str, DoorStyle] = {
    "panel_door": DoorStyle.PANEL,
    "material_door": DoorStyle.MATERIAL,
    "mesh_door": DoorStyle.MESH,
    "sliding_light_door": DoorStyle.SLIDING_LIGHT,
    "sliding_heavy_door": DoorStyle.SLIDING_HEAVY,
}
```

to:

```python
DOOR_STYLE_MAP: dict[str, DoorStyle] = {
    "panel_door": DoorStyle.PANEL,
    "material_door": DoorStyle.MATERIAL,
    "mesh_door": DoorStyle.MESH,
    "sliding_light_door": DoorStyle.SLIDING_LIGHT,
    "sliding_heavy_door": DoorStyle.SLIDING_HEAVY,
    "sliding_frameless_door": DoorStyle.SLIDING_FRAMELESS,
}
```

(`sliding_frameless_door` is the rule `name` Task 2's YAML file will define -- `DOOR_STYLE_MAP` keys must match rule `name` fields exactly, this is how `YamlRuleEvaluator` maps a matched rule to a `DoorStyle`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_door_classifier.py::TestDoorStyle -v`
Expected: PASS (both `test_five_members` and `test_sliding_frameless_member`)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/semantic/door_classifier.py tests/test_door_classifier.py
git commit -m "feat(semantic): add DoorStyle.SLIDING_FRAMELESS enum member"
```

---

### Task 2: `door_sliding_frameless.yaml` rule

**Files:**
- Create: `src/cad_intelligence/patterns/opening/door_sliding_frameless.yaml`
- Test: `tests/test_door_classifier.py`

- [ ] **Step 1: Write the failing tests**

Add a new test class to `tests/test_door_classifier.py` (after `TestDoorClassifierRuleEngine`):

```python
class TestSlidingFramelessRule:
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

    def test_two_parallel_lines_no_frame_no_center_matches(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(parallel_count=2, frame_count=0, has_center_line=False)
        cls = classifier.classify(feats)
        assert any(m.style == DoorStyle.SLIDING_FRAMELESS for m in cls.matches)

    def test_single_line_does_not_match(self) -> None:
        """Regression guard: parallel_count=1 must NOT match -- if `>=2` were ever
        accidentally loosened to `>=1`, this test catches it."""
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(parallel_count=1, frame_count=0, has_center_line=False)
        cls = classifier.classify(feats)
        assert not any(m.style == DoorStyle.SLIDING_FRAMELESS for m in cls.matches)

    def test_exclusive_with_sliding_light_and_heavy(self) -> None:
        """Rule exclusivity guard (spec Section 2/3a): has_center_line is the shared
        exclusivity field between SLIDING_FRAMELESS (requires false) and both
        SLIDING_LIGHT/SLIDING_HEAVY (both require true) -- a candidate satisfying one
        side can never also satisfy the other."""
        classifier = self._make_engine_classifier()

        # Satisfies sliding_light/sliding_heavy's shared has_center_line=True --
        # must NOT also match sliding_frameless.
        center_line_feats = OpeningFeatures(
            parallel_count=2, has_center_line=True, arc_count=0, frame_count=1,
        )
        cls = classifier.classify(center_line_feats)
        assert not any(m.style == DoorStyle.SLIDING_FRAMELESS for m in cls.matches)

        # Satisfies sliding_frameless's has_center_line=False -- must NOT also match
        # sliding_light or sliding_heavy.
        frameless_feats = OpeningFeatures(
            parallel_count=2, frame_count=0, has_center_line=False,
        )
        cls = classifier.classify(frameless_feats)
        assert not any(
            m.style in (DoorStyle.SLIDING_LIGHT, DoorStyle.SLIDING_HEAVY)
            for m in cls.matches
        )
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_door_classifier.py::TestSlidingFramelessRule -v`
Expected: FAIL on `test_two_parallel_lines_no_frame_no_center_matches` and
`test_exclusive_with_sliding_light_and_heavy`'s second half (no rule exists yet to match
`sliding_frameless`, so `cls.matches` never contains it). `test_single_line_does_not_match`
will trivially pass already (nothing matches yet) -- that's expected at this stage; it
becomes a meaningful regression guard once Step 3 adds the rule.

- [ ] **Step 3: Write the rule file**

Create `src/cad_intelligence/patterns/opening/door_sliding_frameless.yaml`:

```yaml
# Door sliding-frameless pattern — Korean architectural drafting convention (door symbol)
# Two parallel lines with no enclosing frame polyline and no center line: a sliding
# door drawn without a jamb/frame indicator because the wall itself acts as the frame.
# See docs/superpowers/specs/2026-08-06-door-sliding-frameless-design.md for the
# real-drawing verification that identified this gap.
rules:
  - id: DOOR-SLIDING-FRAMELESS-001
    name: sliding_frameless_door
    domain: door_detection
    requires:
      parallel_count: ">=2"
      has_center_line: false
      frame_count: 0
    base_score: 0.80
    explanation:
      ko: "프레임 없는 평행선 2개 감지 -- 벽체가 프레임 역할을 하는 미서기문"
      en: "Two parallel lines with no frame -- sliding door where the wall serves as the frame"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_door_classifier.py -v`
Expected: PASS (all tests in the file, including the pre-existing `TestDoorStyle`,
`TestDoorClassifierNoEvaluator`, `TestDoorClassifierRuleEngine` classes -- confirms the new
rule doesn't disturb the existing 5 rules)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/patterns/opening/door_sliding_frameless.yaml tests/test_door_classifier.py
git commit -m "feat(patterns): add door_sliding_frameless rule + exclusivity tests"
```

---

### Task 3: Exhaustive-match verification

**Files:** none modified -- this is a verification-only step per the spec's Section 1.

- [ ] **Step 1: Re-run the exhaustive-match grep**

Run: `grep -rn "DoorStyle\." --include=*.py src/ | grep -v "test_" | grep -v "door_classifier.py" | grep -v "door_recognizer.py"`

Expected: no output (same result as when the spec was written) -- confirms no code path
outside `door_classifier.py`/`door_recognizer.py` does per-member dispatch on `DoorStyle`
that could silently omit the new `SLIDING_FRAMELESS` member. Rendering (Task 4 below)
resolves by string key via `DoorStrategyRegistry.resolve()`, not by enumerating members.

If this grep now returns a hit (e.g. someone added a match/switch since the spec was
written), stop and investigate that call site before proceeding -- it may need explicit
`SLIDING_FRAMELESS` handling.

- [ ] **Step 2: No commit needed** (verification-only, no file changes)

---

### Task 4: Rendering TODO comment

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/render_style.py:670-681`

- [ ] **Step 1: Add the TODO comment**

In `src/cad_intelligence/elevation/renderers/render_style.py`, find the `DoorStrategyRegistry`
class docstring (currently reads "Only a 'none' no-op strategy is registered in this PR
(Backlog #14 PR 2)..."). Add directly below it, still inside the class or as a comment above
`__init__`:

```python
class DoorStrategyRegistry(StrategyRegistry[DoorSymbolStrategy]):
    """Factory-based registry for door symbol strategies.

    Only a "none" no-op strategy is registered in this PR (Backlog #14 PR 2) -- style-
    differentiated door symbol drawing (5 visual variants matching DoorStyle) is a
    future extension, not required for this PR's goal of getting door_style/
    style_confidence populated end-to-end with a safe rendering fallback.
    """

    # TODO: render "sliding_frameless" using the same glyph as sliding_light/
    # sliding_heavy but without drawing a frame polyline (SLIDING_FRAMELESS falls
    # back to NoOpDoorStrategy today -- see
    # docs/superpowers/specs/2026-08-06-door-sliding-frameless-design.md Section 5).

    def __init__(self) -> None:
        super().__init__()
        self._factories["none"] = NoOpDoorStrategy
```

- [ ] **Step 2: Confirm no behavior change**

Run: `python -m pytest tests/test_render_style.py -v`
Expected: PASS, unchanged (comment-only edit)

- [ ] **Step 3: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/render_style.py
git commit -m "docs(elevation): add TODO for sliding_frameless render strategy"
```

---

### Task 5: Golden fixtures (positive + negative) + end-to-end wiring

**Files:**
- Create: `tests/golden/doors/sliding_frameless_01/geometry.json`
- Create: `tests/golden/doors/sliding_frameless_negative_01/geometry.json`
- Modify: `tests/test_door_pipeline.py`

- [ ] **Step 1: Write the failing test (positive fixture, wired into existing loop)**

Create `tests/golden/doors/sliding_frameless_01/geometry.json`:

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Sliding-frameless door: two parallel lines, no frame, no center line -- wall itself acts as the frame",
  "style": "sliding_frameless",
  "lines": [
    {"handle": "L1", "start": [0, 0], "end": [900, 0]},
    {"handle": "L2", "start": [0, 40], "end": [900, 40]}
  ],
  "arcs": [],
  "closed_polylines": []
}
```

In `tests/test_door_pipeline.py`, change:

```python
_STYLE_ENUM = {
    "panel": DoorStyle.PANEL,
    "material": DoorStyle.MATERIAL,
    "mesh": DoorStyle.MESH,
    "sliding_light": DoorStyle.SLIDING_LIGHT,
    "sliding_heavy": DoorStyle.SLIDING_HEAVY,
}
```

to:

```python
_STYLE_ENUM = {
    "panel": DoorStyle.PANEL,
    "material": DoorStyle.MATERIAL,
    "mesh": DoorStyle.MESH,
    "sliding_light": DoorStyle.SLIDING_LIGHT,
    "sliding_heavy": DoorStyle.SLIDING_HEAVY,
    "sliding_frameless": DoorStyle.SLIDING_FRAMELESS,
}
```

(Import `DoorStyle` is already present in this file's header -- no new import needed.)

The existing parametrized `TestDoorGoldenEndToEnd.test_one_candidate_correctly_classified`
picks up `sliding_frameless_01` automatically via `_golden_cases()`'s directory scan -- no
new test function needed for the positive case.

- [ ] **Step 2: Run to verify it fails, then write the negative fixture + dedicated test**

Run: `python -m pytest tests/test_door_pipeline.py -k sliding_frameless_01 -v`
Expected: FAIL (rule doesn't classify yet at this point if Task 2 hasn't landed first in
this same session -- if Task 2 already landed, this should already PASS; either order is
fine since Tasks 1/2 and Task 5 are independent-but-additive. If it unexpectedly fails after
Task 2 has landed, treat that as a real bug and stop to investigate before continuing.)

Create `tests/golden/doors/sliding_frameless_negative_01/geometry.json`:

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Negative case: single line only (parallel_count=1) -- must NOT classify as sliding_frameless. Regression guard for the >=2 threshold.",
  "lines": [
    {"handle": "L1", "start": [0, 0], "end": [900, 0]}
  ],
  "arcs": [],
  "closed_polylines": []
}
```

(No `"style"` field -- `_golden_cases()` only collects fixtures where `style` is truthy, so
this fixture is deliberately excluded from the existing parametrized loop and needs its own
test function.)

Add to `tests/test_door_pipeline.py`, at module level (outside the `TestDoorGoldenEndToEnd`
class, alongside `_golden_cases`):

```python
def test_sliding_frameless_negative_fixture_does_not_classify() -> None:
    """A single line (parallel_count=1) must not classify as sliding_frameless --
    guards the `parallel_count: ">=2"` threshold in door_sliding_frameless.yaml against
    an accidental future loosening to `">=1"`."""
    geom_file = GOLDEN_DIR / "sliding_frameless_negative_01" / "geometry.json"
    with open(geom_file, "r", encoding="utf-8") as f:
        geom = json.load(f)
    results = OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(
        _scan_from_geometry(geom), search_layers={"A-DOOR"},
    )
    assert len(results) == 1
    result = results[0]
    matched_styles = [m.style for m in result.classification.matches]
    assert DoorStyle.SLIDING_FRAMELESS not in matched_styles
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `python -m pytest tests/test_door_pipeline.py -v`
Expected: PASS -- all existing golden cases (`panel_01`, `material_01`, `mesh_01`,
`sliding_light_01`, `sliding_heavy_01`, and now `sliding_frameless_01`) plus the new
negative test.

- [ ] **Step 4: Run full regression suite**

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions. Record the before/after passed-test count for the CHANGELOG
entry in Task 7 (compare against the count from PR #243's CHANGELOG entry, 4629 passed).

- [ ] **Step 5: Commit**

```bash
git add tests/golden/doors/sliding_frameless_01 tests/golden/doors/sliding_frameless_negative_01 tests/test_door_pipeline.py
git commit -m "test(doors): add sliding_frameless positive + negative golden fixtures"
```

---

### Task 6: Real-drawing re-measurement

**Files:** none committed -- this task produces measurement results to record in Task 7's
CHANGELOG entry, per the spec's Section 4 and the 2026-08-06 feature-review meeting's
Action Item 2. No production or test files change in this task.

- [ ] **Step 1: Locate the original diagnostic data and methodology**

Read `memory/door-recognition-real-drawing-gap-frameless-parallel.md` for the exact source
data path (`memory/drawings/diag_openings_dump.json`, 182 raw DOOR-layer entities from
32-pyeong-apartment) and the reconstruction approach used in the original diagnostic
(building `OpeningSymbolDetector`-shaped entities from the raw dump, running the full
pipeline). If a throwaway script from that prior session still exists locally, reuse its
approach; if not, write a new one following the same shape as
`tests/test_door_pipeline.py`'s `_scan_from_geometry`/`_FakeScanResult`/`_FakeEntry` helpers,
but fed from the real dump instead of a golden fixture.

- [ ] **Step 2: Run `DoorRecognizer` against the real DOOR-layer data**

Execute the reconstruction + `OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(...)`
against the 32-pyeong-apartment DOOR-layer entities. Record:
- Total candidate count (expect ~54, per the original diagnostic).
- Count with `door_style=None` (no match) -- this is the new "after" no-match count.
- Of the candidates that previously had `door_style=None` and match the
  `parallel_count=2, has_center_line=False, frame_count=0` pattern (expect ~11, per the
  original diagnostic), how many now classify as `SLIDING_FRAMELESS`.

- [ ] **Step 3: Check against the spec's quantified acceptance criteria**

From `docs/superpowers/specs/2026-08-06-door-sliding-frameless-design.md` Section 4:
- Overall no-match rate: 31% -> target **<=15%**.
- Frameless-pattern-specific recall: 0% -> target **>90%**.

If either target is missed, stop and investigate before proceeding to Task 7 -- per the
spec, this is a signal to dig into why (e.g. real-drawing `parallel_count` might not
cluster to exactly 2 lines the way the synthetic fixture assumes), not a reason to lower the
target after the fact. Do not silently accept a worse-than-targeted result.

- [ ] **Step 4: No commit for this task** -- results feed directly into Task 7's CHANGELOG
  entry and the implementation's final PR description.

---

### Task 7: CHANGELOG + final regression

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

Add to `CHANGELOG.md`'s `## [Unreleased]` / `### Added` section (English only, per the
project's language policy -- see CLAUDE.md), following the style of the existing PR2 entry.
Include:
- The new `DoorStyle.SLIDING_FRAMELESS` member + `door_sliding_frameless.yaml` rule.
- The exclusivity mechanism (`has_center_line`, corrected during spec review from an initial
  incorrect `frame_count` framing -- worth keeping in the historical record since it was a
  real, caught mistake).
- Positive + negative golden fixture counts and the new detector-independent unit tests.
- The full-suite before/after passed-test count from Task 5 Step 4.
- The real-drawing re-measurement numbers from Task 6 (actual overall no-match rate and
  frameless-pattern recall achieved, compared against the 31%/0% baseline and the
  <=15%/>90% targets).

- [ ] **Step 2: Run full regression one more time**

Run: `python -m pytest tests/ -q`
Expected: PASS, same count as Task 5 Step 4 (CHANGELOG.md is a docs-only change, shouldn't
affect test results).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG entry for door SLIDING_FRAMELESS style"
```

---

### Task 8: `/sync`

Run `/sync "feat(semantic,cad_io): add DoorStyle.SLIDING_FRAMELESS via door_sliding_frameless rule (8th taxonomy gap)"` per this project's standard pipeline (lifecycle + audit + commit + push + PR). This is the final step -- see CLAUDE.md's Execution Plan Boilerplate for why no separate N-1/N rows are needed.

**Before running `/sync`:** confirm you are on an up-to-date `main` (not a stale merged
branch) -- check `git branch --show-current` and `git log --oneline -3` against
`origin/main`. If PR #245 (the spec PR) merged since this plan started, switch to `main`,
`git pull --ff-only`, and carry any uncommitted work forward before syncing.
