---
lang: ko
lang_reason: source-material
---

# Door Recognition Upgrade — PR 2: DoorStyle, DoorClassifier, DoorRecognizer

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring door recognition to window-recognition quality — add a `DoorStyle`
5-type classification with confidence to the live `handlers/space.py` door-extraction
path, mirroring exactly how `_build_windows_v3` already gives windows this capability via
`OpeningSymbolPipeline`. This is PR 2 of 4 in the door-recognition-upgrade rollout (spec:
`docs/superpowers/specs/2026-08-06-door-recognition-upgrade-design.md`, Components 1 and
3-6 — Components 2/2a were PR 1, already merged as `OpeningRecognizer`/
`BaseStyleClassifier`/`RuleEvaluator`, PR #241).

**Architecture:** `DoorStyle` (5-member enum) + `DoorClassifier(BaseStyleClassifier[DoorStyle])`
+ 5 new `door_*.yaml` rule patterns give door candidates a style + confidence, exactly
mirroring `WindowStyle`/`WindowClassifier`/`window_*.yaml`. `DoorRecognizer` implements
`OpeningRecognizer` (`recognize()`/`reclassify()`), composing
`OpeningSymbolDetector`→`OpeningEvidenceExtractor`→`OpeningFeatureExtractor`→`DoorClassifier`→
`ConfidenceFuser` — the same 5-stage shape `WindowRecognizer` already uses, just swapping
the classifier. `handlers/space.py`'s `handle_extract_cad_objects` gets a new
`_build_doors_v3` function, built by copying `_build_windows_v3`'s exact pattern (calls
`OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(scan_result,
search_layers=door_layers)` directly against the already-in-scope `scan_result` — no
adapter needed, since this handler already has a real `ModelSpaceScanResult`). `DoorEntity`
gains `door_style`/`style_confidence` fields (mirroring `WindowEntity`). Rendering gets a
`DoorStrategyRegistry` mirroring `WindowStrategyRegistry`, with a safe no-op fallback for
unclassified doors.

**Tech Stack:** Python 3.11+, pytest, existing `RuleEngine`/`RuleRegistry` (unchanged), the
`OpeningRecognizer`/`BaseStyleClassifier`/`RuleEvaluator` infrastructure from PR 1.

---

## Correction from the spec (read before starting)

The spec's Component 5 describes "an adapter analogous to
`_entries_by_layer_from_scanned_entities`" to convert `_group_door_entities`'s grouped
output into the shape `OpeningSymbolPipeline` needs. **This is unnecessary and more
complex than what's actually required.** Reading the current code:

- `_build_windows_v3` (the function this PR's door version mirrors,
  `handlers/space.py:2277-2359`) does NOT adapt `_group_window_entities`'s output at all —
  it calls `OpeningSymbolPipeline(recognizer=WindowRecognizer()).run(scan_result,
  search_layers=window_layers)` **directly against the handler's existing `scan_result`**
  (a real `ModelSpaceScanResult`, already in scope), completely independent of
  `_group_window_entities`.
- `door_layers` (the set of door-classified layer names) is already computed at
  `handlers/space.py:2559`, in the same scope as `window_layers` — both available to
  `handle_extract_cad_objects` before either `_build_windows_v3` or the new
  `_build_doors_v3` is called.
- Therefore `_build_doors_v3` can call `OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(scan_result,
  search_layers=door_layers)` exactly the same way, no adapter needed. `_group_door_entities`
  and `_classify_door_entity` (the anchor-clustering heuristic used by the *separate*
  `handle_group_openings` handler for AXIS-001 room-opening association) are **not touched
  by this PR** — they remain exactly as they are, per the spec's "kept as-is" decision. Do
  not build the adapter the spec describes; it doesn't correspond to anything the live
  `handle_extract_cad_objects` path actually needs.

---

## Scope boundary (read before starting)

**In scope:** `door_classifier.py` (new), `door_recognizer.py` (new), 5 `door_*.yaml`
files (new), `DoorEntity` model extension, `_build_doors_v3` in `handlers/space.py`
(new, mirrors `_build_windows_v3`), `DoorStrategyRegistry` + `door_renderer.py` wiring.

**Out of scope (do not touch in this PR):** `_classify_door_entity`, `_group_door_entities`,
Type 1/2/3 sidecar detectors (`_detect_arc_swing_doors`, `_detect_named_block_doors`,
`_detect_curved_cluster_doors`), `handle_group_openings`. All unchanged.

**Zero behavior change to existing window/door extraction paths.** The new
`_build_doors_v3` is additive — it changes what `handle_extract_cad_objects`'s `doors` list
contains (adds `door_style`/`style_confidence` fields, populated via the same
classification-with-confidence approach windows already get) but does not remove or alter
the existing block-reference/polygon-fallback door extraction currently in
`handle_extract_cad_objects` (lines ~2654-2739 as of this writing) until Task 6 wires it
in — see Task 6 for the exact integration point and what it replaces vs. keeps.

---

## File Map

- **Create:** `src/cad_intelligence/semantic/door_classifier.py` — `DoorStyle` enum (5
  members) + `DOOR_STYLE_MAP` module constant + `DoorClassifier(BaseStyleClassifier[DoorStyle])`.
- **Create:** `src/cad_intelligence/semantic/door_recognizer.py` — `DoorRecognizer`
  implementing `OpeningRecognizer`, mirroring `window_recognizer.py`'s structure exactly.
- **Create:** `src/cad_intelligence/patterns/opening/door_panel.yaml`,
  `door_material.yaml`, `door_mesh.yaml`, `door_sliding_light.yaml`,
  `door_sliding_heavy.yaml` — `domain: door_detection` rule patterns.
- **Modify:** `src/cad_intelligence/common/models.py` — `DoorEntity` gains
  `door_style: str | None = None` and `style_confidence: float | None = None` fields,
  plus `to_dict()`/`from_dict()` updates (mirrors `WindowEntity` exactly).
- **Modify:** `src/cad_intelligence/cad_io/handlers/space.py` — new `_build_doors_v3`
  function (mirrors `_build_windows_v3`); wired into `handle_extract_cad_objects` alongside
  the existing door-extraction block (Task 6 explains exactly how the two interact).
- **Modify:** `src/cad_intelligence/elevation/renderers/render_style.py` — add
  `DoorStrategyRegistry(StrategyRegistry[DoorSymbolStrategy])` (mirrors
  `WindowStrategyRegistry`) with a single no-op default factory (`"none"` or similar) — no
  new visual strategies are implemented in this PR, only the registry + resolution
  mechanism, per the spec's "falls back safely" requirement.
- **Modify:** `src/cad_intelligence/elevation/renderers/door_renderer.py` — resolve
  `og.door_style` through `DoorStrategyRegistry`, falling back to the current fixed
  rendering when unresolved (mirrors `window_renderer.py`'s `style_key` resolution).

---

## Task 1: `DoorStyle` enum + `DoorClassifier`

**Files:**
- Create: `src/cad_intelligence/semantic/door_classifier.py`
- Test: `tests/test_door_classifier.py`

Read `src/cad_intelligence/semantic/window_classifier.py` in full before starting — this
task's `DoorClassifier` mirrors `WindowClassifier`'s structure, minus the hardcoded-fallback
mode (per spec Component 2's decision: `DoorClassifier` is RuleEngine-only, no
`_classify_hardcoded`).

- [ ] **Step 1: Write the failing test**

```python
"""Tests for DoorStyle + DoorClassifier (RuleEngine mode only, no hardcoded fallback)."""

from __future__ import annotations

from pathlib import Path

from cad_intelligence.semantic.door_classifier import (
    DOOR_STYLE_MAP,
    DoorClassifier,
    DoorStyle,
)
from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.rule_evaluator import RuleDomain, YamlRuleEvaluator


class TestDoorStyle:
    def test_five_members(self) -> None:
        assert DoorStyle.PANEL == "panel"
        assert DoorStyle.MATERIAL == "material"
        assert DoorStyle.MESH == "mesh"
        assert DoorStyle.SLIDING_LIGHT == "sliding_light"
        assert DoorStyle.SLIDING_HEAVY == "sliding_heavy"


class TestDoorClassifierNoEvaluator:
    def test_classify_without_evaluator_raises(self) -> None:
        import pytest

        classifier = DoorClassifier()
        with pytest.raises(NotImplementedError):
            classifier.classify(OpeningFeatures())


class TestDoorClassifierRuleEngine:
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

    def test_panel_via_engine(self) -> None:
        classifier = self._make_engine_classifier()
        # PANEL: closed frame, no arc, no parallel rail lines -- see door_panel.yaml
        # for the exact requires/prefers, confirmed in Task 2's verification gate.
        feats = OpeningFeatures(frame_count=1, arc_count=0, parallel_count=0)
        cls = classifier.classify(feats)
        assert any(m.style == DoorStyle.PANEL for m in cls.matches)

    def test_sliding_light_via_engine(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(parallel_count=2, has_center_line=True, arc_count=0)
        cls = classifier.classify(feats)
        assert any(
            m.style in (DoorStyle.SLIDING_LIGHT, DoorStyle.SLIDING_HEAVY)
            for m in cls.matches
        )

    def test_unmatched_features_return_no_matches(self) -> None:
        classifier = self._make_engine_classifier()
        cls = classifier.classify(OpeningFeatures())  # all-zero features
        # May or may not be empty depending on exact YAML thresholds -- this test
        # just confirms classify() runs end-to-end without raising, since exact
        # zero-feature behavior depends on Task 2's verification-gate-derived YAML.
        assert isinstance(cls.matches, tuple)
```

**Note on Steps 1-2's tests referencing `door_*.yaml`:** these tests exercise the real
`RuleRegistry`/`RuleEngine` against Task 2's YAML files, so they cannot fully pass until
Task 2 is also done. Write this test file now; **defer running
`TestDoorClassifierRuleEngine`'s 3 tests until Task 2 completes** (Step 2 below only
verifies the `ModuleNotFoundError` / `DoorStyle`/no-evaluator tests, which don't need YAML).

- [ ] **Step 2: Run the no-YAML-dependent tests to verify they fail correctly first**

Run: `python -m pytest tests/test_door_classifier.py::TestDoorStyle tests/test_door_classifier.py::TestDoorClassifierNoEvaluator -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.semantic.door_classifier'`

- [ ] **Step 3: Write the implementation**

```python
"""DoorStyle + DoorClassifier -- door symbol recognition (Korean 5-type taxonomy).

Mirrors window_classifier.py's structure. Unlike WindowClassifier, DoorClassifier has
NO hardcoded-fallback mode -- it requires an injected RuleEvaluator (see
rule_evaluator.py) to function at all, since door classification is introduced fresh via
the RuleEngine path (see docs/superpowers/specs/2026-08-06-door-recognition-upgrade-design.md,
Component 2's decision).
"""

from __future__ import annotations

from enum import Enum

from cad_intelligence.semantic.style_classifier_base import BaseStyleClassifier

__all__ = [
    "DOOR_STYLE_MAP",
    "DoorClassifier",
    "DoorStyle",
]


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


# Rule name -> DoorStyle mapping, passed to YamlRuleEvaluator by callers that want
# RuleEngine-mode classification (see DoorRecognizer).
DOOR_STYLE_MAP: dict[str, DoorStyle] = {
    "panel_door": DoorStyle.PANEL,
    "material_door": DoorStyle.MATERIAL,
    "mesh_door": DoorStyle.MESH,
    "sliding_light_door": DoorStyle.SLIDING_LIGHT,
    "sliding_heavy_door": DoorStyle.SLIDING_HEAVY,
}


class DoorClassifier(BaseStyleClassifier[DoorStyle]):
    """OpeningFeatures -> Classification[DoorStyle], RuleEngine mode only.

    No hardcoded-fallback mode -- classify() raises NotImplementedError (inherited
    from BaseStyleClassifier) if constructed without an evaluator.
    """
```

- [ ] **Step 4: Run the no-YAML-dependent tests to verify they pass**

Run: `python -m pytest tests/test_door_classifier.py::TestDoorStyle tests/test_door_classifier.py::TestDoorClassifierNoEvaluator -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/semantic/door_classifier.py tests/test_door_classifier.py
git commit -m "feat(semantic): add DoorStyle + DoorClassifier (RuleEngine mode only)"
```

---

## Task 2: 5 `door_*.yaml` rule patterns + Pre-Implementation Verification Gate

**Files:**
- Create: `src/cad_intelligence/patterns/opening/door_panel.yaml`
- Create: `src/cad_intelligence/patterns/opening/door_material.yaml`
- Create: `src/cad_intelligence/patterns/opening/door_mesh.yaml`
- Create: `src/cad_intelligence/patterns/opening/door_sliding_light.yaml`
- Create: `src/cad_intelligence/patterns/opening/door_sliding_heavy.yaml`

**This task requires a Pre-Implementation Verification Gate**, per the spec's Component 3
and Rollout PR 2 requirement (mirroring the 2026-08-04/2026-08-05 window-pipeline
precedent: don't assume geometric thresholds, confirm them against synthetic fixtures
first). Read `src/cad_intelligence/patterns/opening/window_sliding.yaml`,
`window_casement.yaml`, `window_fixed.yaml`, `window_awning.yaml` (all 4) before writing
these — they establish the `requires`/`prefers`/`base_score`/`explanation` DSL shape
(`domain`, `requires` = hard boolean/comparison constraints, `prefers` = soft weighted
hints, `base_score`, `explanation.ko`/`explanation.en`).

### The Verification Gate (do this BEFORE finalizing the 5 YAML files below)

For each of the 5 door styles, before committing to specific `OpeningFeatures` thresholds:
1. Sketch (on paper or in a scratch file — not committed) what geometric evidence
   distinguishes it from the other 4, using ONLY the `EvidenceKind` vocabulary already
   available (`FRAME`, `PARALLEL`, `CENTER_LINE`, `ARC`, `DIAGONAL`, `SASH`, `RAIL` —
   confirmed in `geometry_signature.py:40-55`, unchanged by this PR) and the
   `OpeningFeatures` fields they aggregate into (`frame_count`, `parallel_count`,
   `has_center_line`, `arc_count`, `diagonal_count`, `sash_count`, `has_rail`, etc. —
   confirmed in `opening_features.py:29-60`).
2. Build the corresponding synthetic golden fixture FIRST (see Task 3) with geometry that
   should unambiguously produce that evidence.
3. Write the YAML `requires`/`prefers` against that sketch.
4. Task 3's golden end-to-end test is what actually confirms the thresholds work — if a
   fixture doesn't classify as expected, revise the YAML (not the fixture) unless the
   fixture itself doesn't represent the intended geometry.

**Suggested starting evidence mapping** (revise during the gate if your synthetic
fixtures don't confirm it — do not treat this as pre-verified):

| Style | Primary evidence | Rationale |
|---|---|---|
| PANEL (binjimun) | `FRAME` present, no `ARC`, no `PARALLEL` (a plain hinged panel has a closed frame outline and nothing else distinctive) | Simplest door type — frame only |
| MATERIAL (jajaemun) | `FRAME` present + `DIAGONAL` (material/board doors are often drawn with a diagonal brace or cross-hatch indicating solid material) | Distinguishes from PANEL via the diagonal marking |
| MESH (mangsamun) | `FRAME` present + `CENTER_LINE` or fine `PARALLEL` grid (mesh/screen doors show a grid or center-crossing pattern distinct from solid panel) | Distinguishes from PANEL via the mesh pattern representation |
| SLIDING_LIGHT (miseogimun) | `PARALLEL` (>=2) + `CENTER_LINE`, similar to window sliding but without `SASH`/`RAIL` (door sliding tracks look like window sliding tracks but doors don't have window sashes) | Mirrors `window_sliding.yaml`'s evidence shape, door-scoped |
| SLIDING_HEAVY (midajimun) | `PARALLEL` (>=2) + `CENTER_LINE` + wider `parallel_spacing` or an additional `FRAME` (heavy sliding doors are typically drawn with a more substantial frame/track than light sliding) | Distinguishes from SLIDING_LIGHT via `parallel_spacing` or `frame_count` — **this is the hardest pair to distinguish; expect to iterate during the gate** |

- [ ] **Step 1: Run the gate — build all 5 synthetic fixtures first (see Task 3), THEN
  write the YAMLs below informed by what actually classifies correctly**

Do not skip straight to Step 2's example YAML content without running the gate — the
table above is a starting hypothesis, not a verified answer, and PANEL vs the others is
the one pair explicitly flagged as needing empirical confirmation.

- [ ] **Step 2: Write the 5 YAML files**

`door_panel.yaml`:
```yaml
# Door panel pattern — Korean architectural standard (문 기호)
# 빈지문: simple closed frame, no rail/arc/diagonal markings
rules:
  - id: DOOR-PANEL-001
    name: panel_door
    domain: door_detection
    requires:
      frame_count: ">=1"
      arc_count: 0
      diagonal_count: 0
    prefers:
      wall_overlap: ">0.5"
    base_score: 0.80
    explanation:
      ko: "프레임만 감지되어 빈지문"
      en: "Frame only, no other markings — panel door"
```

`door_material.yaml`:
```yaml
# Door material pattern — Korean architectural standard (문 기호)
# 자재문: frame + diagonal brace/cross-hatch marking
rules:
  - id: DOOR-MATERIAL-001
    name: material_door
    domain: door_detection
    requires:
      frame_count: ">=1"
      diagonal_count: ">=1"
      arc_count: 0
    prefers:
      wall_overlap: ">0.5"
    base_score: 0.80
    explanation:
      ko: "프레임과 경사선이 감지되어 자재문"
      en: "Frame + diagonal marking — material door"
```

`door_mesh.yaml`:
```yaml
# Door mesh pattern — Korean architectural standard (문 기호)
# 망사문: frame + center line (mesh/screen grid indicator)
rules:
  - id: DOOR-MESH-001
    name: mesh_door
    domain: door_detection
    requires:
      frame_count: ">=1"
      has_center_line: true
      arc_count: 0
      parallel_count: 0
    prefers:
      wall_overlap: ">0.5"
    base_score: 0.75
    explanation:
      ko: "프레임과 중심선이 감지되어 망사문"
      en: "Frame + center line — mesh/screen door"
```

`door_sliding_light.yaml`:
```yaml
# Door sliding-light pattern — Korean architectural standard (문 기호)
# 미서기문: parallel lines + center line, no arc (mirrors window sliding evidence)
rules:
  - id: DOOR-SLIDING-LIGHT-001
    name: sliding_light_door
    domain: door_detection
    requires:
      parallel_count: ">=2"
      has_center_line: true
      arc_count: 0
    prefers:
      block_name_prefix: "D"
    base_score: 0.85
    explanation:
      ko: "중심선과 평행선이 감지되어 미서기문"
      en: "Center line + parallel lines — light sliding door"
```

`door_sliding_heavy.yaml`:
```yaml
# Door sliding-heavy pattern — Korean architectural standard (문 기호)
# 미닫이문: parallel lines + center line + frame (heavier track/frame than 미서기문)
rules:
  - id: DOOR-SLIDING-HEAVY-001
    name: sliding_heavy_door
    domain: door_detection
    requires:
      parallel_count: ">=2"
      has_center_line: true
      arc_count: 0
      frame_count: ">=1"
    prefers:
      block_name_prefix: "D"
    base_score: 0.85
    explanation:
      ko: "중심선, 평행선, 프레임이 감지되어 미닫이문"
      en: "Center line + parallel lines + frame — heavy sliding door"
```

**IMPORTANT — the `block_name_prefix` field referenced in the `prefers` sections above
does not exist yet on `OpeningFeatures`.** This is intentional per the spec's Architecture
section ("Classification evidence priority... block-name hint is carried through
`OpeningFeatures` as a new field `block_name_prefix`"). Task 4 adds it. **Until Task 4
lands, `door_sliding_light.yaml`/`door_sliding_heavy.yaml`'s `prefers.block_name_prefix`
entry will simply never match** — confirmed safe by reading `rules/rule_engine.py`'s
`evaluate_facts()` (its per-rule loop wraps every `rule.check_fn(facts, facts)` call in a
blanket `try: ... except Exception: passed, value, threshold = False, 0.0, 0.0`), so an
`AttributeError` from a `prefers`/`requires` check referencing a not-yet-existing
`OpeningFeatures` field is silently caught and that rule just fails to match — it does not
propagate or crash `evaluate_facts()`. This does not block Task 2's own tests, which don't
rely on `prefers` matching (only `requires` gates a match at all).

**CRITICAL — resolve the PANEL vs MATERIAL vs MESH ambiguity for the `frame_count>=1,
arc_count=0, diagonal_count=0/parallel_count=0` all-default case.** With
`OpeningFeatures()` (all defaults: `frame_count=0`), NONE of the 5 rules above have their
`requires` satisfied (all require `frame_count >= 1` except sliding variants which don't
require frame but do require `parallel_count>=2`), so an empty-features candidate matches
nothing — this is intentional and correct (no `door_style` assigned, matches the "unknown
geometry" case). But confirm during the gate (Step 1) that PANEL, MATERIAL, and MESH don't
accidentally ALL match simultaneously for some plausible fixture (e.g. a fixture with
`frame_count=1` and everything else default DOES only match PANEL, since MATERIAL requires
`diagonal_count>=1` and MESH requires `has_center_line=true` — verify this with Task 3's
fixtures, don't just trust this analysis).

- [ ] **Step 3: Register the domain with the rule registry loader (verify no code change
  needed)**

Run: `python -c "
from pathlib import Path
from cad_intelligence.rules.registry import RuleRegistry
registry = RuleRegistry()
registry.load_from_yaml(Path('src/cad_intelligence/patterns/opening'))
rules = registry.rules_for_domain('door_detection')
print(f'{len(rules)} door_detection rules loaded')
for r in rules:
    print(f'  {r.name}')
"`
Expected: `5 door_detection rules loaded` followed by the 5 rule names
(`panel_door`, `material_door`, `mesh_door`, `sliding_light_door`,
`sliding_heavy_door`). If this doesn't print 5, the YAML files have a parsing issue —
fix before proceeding (no code changes to `RuleRegistry`/`RuleEngine` should be needed;
the `domain="door_detection"` DSL is identical to the existing `window_detection` DSL).

- [ ] **Step 4: Run Task 1's deferred `TestDoorClassifierRuleEngine` tests**

Run: `python -m pytest tests/test_door_classifier.py -v`
Expected: PASS (5 tests total: 2 from Task 1 + 3 RuleEngine-mode tests deferred from
Task 1 Step 1).

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/patterns/opening/door_panel.yaml src/cad_intelligence/patterns/opening/door_material.yaml src/cad_intelligence/patterns/opening/door_mesh.yaml src/cad_intelligence/patterns/opening/door_sliding_light.yaml src/cad_intelligence/patterns/opening/door_sliding_heavy.yaml
git commit -m "feat(patterns): add 5 door_detection rule patterns (Pre-Implementation Verification Gate)"
```

---

## Task 3: Golden fixtures + end-to-end pipeline test

**Files:**
- Create: `tests/golden/doors/panel_01/geometry.json`
- Create: `tests/golden/doors/material_01/geometry.json`
- Create: `tests/golden/doors/mesh_01/geometry.json`
- Create: `tests/golden/doors/sliding_light_01/geometry.json`
- Create: `tests/golden/doors/sliding_heavy_01/geometry.json`
- Create: `tests/test_door_pipeline.py`

Read `tests/golden/windows/sliding_01/geometry.json` and the other 3 window golden
fixtures, plus `tests/test_opening_pipeline_two_pass.py`'s `_scan_from_geometry`/
`_golden_cases`/`TestGoldenEndToEnd` (lines 339-410 as of this writing) before starting —
this task's fixtures and test file mirror that exact structure, door-scoped. **This task
runs interleaved with Task 2's Verification Gate** — write the fixtures first (this task's
Step 1), then go back to Task 2 to write/tune the YAMLs against them, then return here to
confirm the end-to-end test passes (this task's Step 3+).

- [ ] **Step 1: Write the 5 synthetic golden fixtures**

`tests/golden/doors/panel_01/geometry.json` — a closed rectangular frame, nothing else:
```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Panel door (binjimun): closed frame only, no other markings",
  "style": "panel",
  "lines": [],
  "arcs": [],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, 0, 900, 0, 900, 40, 0, 40], "is_closed": true}
  ]
}
```

`tests/golden/doors/material_01/geometry.json` — a closed frame plus a diagonal brace:
```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Material door (jajaemun): frame + diagonal brace marking",
  "style": "material",
  "lines": [
    {"handle": "L1", "start": [0, 0], "end": [900, 40]}
  ],
  "arcs": [],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, 0, 900, 0, 900, 40, 0, 40], "is_closed": true}
  ]
}
```

`tests/golden/doors/mesh_01/geometry.json` — a closed frame plus a center line:
```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Mesh door (mangsamun): frame + center line (mesh grid indicator)",
  "style": "mesh",
  "lines": [
    {"handle": "L1", "start": [0, 20], "end": [900, 20]}
  ],
  "arcs": [],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, 0, 900, 0, 900, 40, 0, 40], "is_closed": true}
  ]
}
```

`tests/golden/doors/sliding_light_01/geometry.json` — mirrors `window_sliding.yaml`'s
evidence shape (2 parallel lines + center line), no frame:
```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Sliding-light door (miseogimun): 2 parallel lines + center line, no frame",
  "style": "sliding_light",
  "lines": [
    {"handle": "L1", "start": [0, 0], "end": [900, 0]},
    {"handle": "L2", "start": [0, 40], "end": [900, 40]},
    {"handle": "L3", "start": [0, 20], "end": [900, 20]}
  ],
  "arcs": [],
  "closed_polylines": []
}
```

`tests/golden/doors/sliding_heavy_01/geometry.json` — same evidence plus a frame (to
distinguish from sliding_light per the Task 2 evidence table):
```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Sliding-heavy door (midajimun): parallel lines + center line + frame",
  "style": "sliding_heavy",
  "lines": [
    {"handle": "L1", "start": [0, 0], "end": [1200, 0]},
    {"handle": "L2", "start": [0, 50], "end": [1200, 50]},
    {"handle": "L3", "start": [0, 25], "end": [1200, 25]}
  ],
  "arcs": [],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, -10, 1200, -10, 1200, 60, 0, 60], "is_closed": true}
  ]
}
```

**These are starting hypotheses per Task 2's Verification Gate — if a fixture doesn't
classify as its intended style once Task 2's YAMLs are written, revise the FIXTURE only if
it doesn't actually represent the intended door type; otherwise revise the YAML.** Do not
silently adjust both until the test passes without understanding why — that defeats the
Verification Gate's purpose.

- [ ] **Step 2: Write `tests/test_door_pipeline.py`**

```python
"""Door end-to-end golden regression -- mirrors test_opening_pipeline_two_pass.py's
TestGoldenEndToEnd, door-scoped. Each fixture must produce exactly 1 candidate through
the full pipeline (DoorRecognizer's detect+classify), classified as its expected style.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from cad_intelligence.semantic.door_classifier import DoorStyle
from cad_intelligence.semantic.door_recognizer import DoorRecognizer
from cad_intelligence.semantic.opening_pipeline import OpeningSymbolPipeline

GOLDEN_DIR = Path(__file__).resolve().parent / "golden" / "doors"


class _FakeEntry:
    """ModelSpaceScanResult Entry stub (mirrors test_opening_pipeline_two_pass.py)."""

    def __init__(self, layer, obj_name, **kwargs):
        self.layer = layer
        self.object_name = obj_name
        for k, v in kwargs.items():
            setattr(self, k, v)


class _FakeScanResult:
    def __init__(self, entries):
        self.entries_by_layer: dict[str, list] = {}
        for e in entries:
            self.entries_by_layer.setdefault(e.layer, []).append(e)


def _scan_from_geometry(geom):
    """golden geometry.json -> _FakeScanResult (full detector path), door-layer-scoped."""
    entries = []
    for ln in geom.get("lines", []):
        entries.append(_FakeEntry(
            "A-DOOR", "AcDbLine", handle=ln["handle"],
            start=tuple(ln["start"]), end=tuple(ln["end"]),
            length=float(ln.get("length", 900.0)),
        ))
    for a in geom.get("arcs", []):
        entries.append(_FakeEntry(
            "A-DOOR", "AcDbArc", handle=a["handle"],
            center=tuple(a["center"]), radius=float(a["radius"]),
            start_angle=float(a["start_angle"]), end_angle=float(a["end_angle"]),
        ))
    for p in geom.get("closed_polylines", []):
        entries.append(_FakeEntry(
            "A-DOOR", "AcDbPolyline", handle=p["handle"],
            coordinates=list(p["coordinates"]), is_closed=p.get("is_closed", True),
        ))
    return _FakeScanResult(entries)


def _golden_cases():
    if not GOLDEN_DIR.exists():
        return []
    out = []
    for case_dir in sorted(GOLDEN_DIR.iterdir()):
        geom_file = case_dir / "geometry.json"
        if geom_file.is_file():
            with open(geom_file, "r", encoding="utf-8") as f:
                geom = json.load(f)
            style = geom.get("style", "")
            if style:
                out.append(pytest.param(case_dir.name, geom, style, id=case_dir.name))
    return out


_STYLE_ENUM = {
    "panel": DoorStyle.PANEL,
    "material": DoorStyle.MATERIAL,
    "mesh": DoorStyle.MESH,
    "sliding_light": DoorStyle.SLIDING_LIGHT,
    "sliding_heavy": DoorStyle.SLIDING_HEAVY,
}


@pytest.mark.parametrize("name,geom,expected_style", _golden_cases())
class TestDoorGoldenEndToEnd:
    def test_one_candidate_correctly_classified(self, name, geom, expected_style):
        results = OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(
            _scan_from_geometry(geom), search_layers={"A-DOOR"},
        )
        assert len(results) == 1, (
            f"{name}: expected 1 candidate, got {len(results)}"
        )
        result = results[0]
        assert result.classification.matches, (
            f"{name}: no style matches at all"
        )
        best = result.classification.matches[0]
        expected = _STYLE_ENUM[expected_style]
        assert best.style == expected, (
            f"{name}: expected {expected}, got {best.style} "
            f"(all matches: {[m.style for m in result.classification.matches]})"
        )
```

- [ ] **Step 3: Run the test (expect failures until Task 2's YAMLs are tuned)**

Run: `python -m pytest tests/test_door_pipeline.py -v`
Expected: initially may FAIL for some fixtures — this is the Verification Gate in action.
For each failure, inspect which rule(s) matched instead (print
`result.classification.matches` in a scratch debug run if needed) and revise Task 2's
YAML `requires`/`prefers` (not this test, not the fixtures, unless a fixture's geometry
doesn't genuinely represent its intended style) until all 5 pass.

- [ ] **Step 4: Confirm all 5 pass**

Run: `python -m pytest tests/test_door_pipeline.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/golden/doors/ tests/test_door_pipeline.py
git commit -m "test(golden): add 5 door golden fixtures + end-to-end pipeline test"
```

(If Task 2's YAMLs needed revision during this task, that revision was already committed
as part of Task 2 — if you're doing these tasks in strict sequence with separate commits,
amend is not required; a later commit updating the YAML files is fine and keeps the
history honest about the gate's iterative nature.)

---

## Task 4: `DoorEntity` model extension

**Files:**
- Modify: `src/cad_intelligence/common/models.py`
- Modify: `src/cad_intelligence/semantic/opening_features.py` (adds `block_name_prefix`)
- Test: `tests/test_common_models_door_entity.py`

- [ ] **Step 1: Write the failing test**

```python
"""Tests for DoorEntity's door_style/style_confidence fields (mirrors WindowEntity)."""

from __future__ import annotations

from cad_intelligence.common.models import DoorEntity


class TestDoorEntityStyleFields:
    def test_defaults_are_none(self) -> None:
        d = DoorEntity(handle="H1", layer="A-DOOR", position=(0.0, 0.0), width=900.0)
        assert d.door_style is None
        assert d.style_confidence is None

    def test_to_dict_includes_style_fields(self) -> None:
        d = DoorEntity(
            handle="H1", layer="A-DOOR", position=(0.0, 0.0), width=900.0,
            door_style="panel", style_confidence=0.8,
        )
        data = d.to_dict()
        assert data["door_style"] == "panel"
        assert data["style_confidence"] == 0.8

    def test_to_dict_omits_nothing_when_style_is_none(self) -> None:
        d = DoorEntity(handle="H1", layer="A-DOOR", position=(0.0, 0.0), width=900.0)
        data = d.to_dict()
        assert data["door_style"] is None
        assert data["style_confidence"] is None

    def test_from_dict_round_trip(self) -> None:
        d = DoorEntity(
            handle="H1", layer="A-DOOR", position=(0.0, 0.0), width=900.0,
            door_style="sliding_light", style_confidence=0.65,
        )
        restored = DoorEntity.from_dict(d.to_dict())
        assert restored.door_style == "sliding_light"
        assert restored.style_confidence == 0.65

    def test_from_dict_defaults_when_keys_missing(self) -> None:
        """Backward-compat: existing serialized DoorEntity dicts (pre-this-PR) have no
        door_style/style_confidence keys at all -- from_dict must not KeyError."""
        legacy_dict = {
            "handle": "H1", "layer": "A-DOOR", "position": [0.0, 0.0], "width": 900.0,
        }
        restored = DoorEntity.from_dict(legacy_dict)
        assert restored.door_style is None
        assert restored.style_confidence is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_common_models_door_entity.py -v`
Expected: FAIL (`AttributeError: 'DoorEntity' object has no attribute 'door_style'` or
similar, since the field doesn't exist yet).

- [ ] **Step 3: Modify `DoorEntity` in `common/models.py`**

Read the current `DoorEntity` class (lines 134-167 as of this writing) and `WindowEntity`
(lines 170-203) side by side — this change makes `DoorEntity` structurally match
`WindowEntity`'s style-field handling exactly. Change:

```python
@dataclass
class DoorEntity:
    """A raw door entity (block reference or polygon/sleeve heuristic)."""

    handle: str
    layer: str
    position: Point
    width: float
    rotation: float = 0.0
    block_name: str | None = None
    swing_direction: str | None = None

    def to_dict(self) -> dict:
        return {
            "handle": self.handle,
            "layer": self.layer,
            "position": list(self.position),
            "width": self.width,
            "rotation": self.rotation,
            "block_name": self.block_name,
            "swing_direction": self.swing_direction,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DoorEntity":
        return cls(
            handle=data["handle"],
            layer=data["layer"],
            position=_tuple2(data["position"]),
            width=float(data["width"]),
            rotation=float(data.get("rotation", 0.0)),
            block_name=data.get("block_name"),
            swing_direction=data.get("swing_direction"),
        )
```

to:

```python
@dataclass
class DoorEntity:
    """A raw door entity (block reference or polygon/sleeve heuristic)."""

    handle: str
    layer: str
    position: Point
    width: float
    rotation: float = 0.0
    block_name: str | None = None
    swing_direction: str | None = None
    door_style: str | None = None
    style_confidence: float | None = None

    def to_dict(self) -> dict:
        return {
            "handle": self.handle,
            "layer": self.layer,
            "position": list(self.position),
            "width": self.width,
            "rotation": self.rotation,
            "block_name": self.block_name,
            "swing_direction": self.swing_direction,
            "door_style": self.door_style,
            "style_confidence": self.style_confidence,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DoorEntity":
        return cls(
            handle=data["handle"],
            layer=data["layer"],
            position=_tuple2(data["position"]),
            width=float(data["width"]),
            rotation=float(data.get("rotation", 0.0)),
            block_name=data.get("block_name"),
            swing_direction=data.get("swing_direction"),
            door_style=data.get("door_style"),
            style_confidence=data.get("style_confidence"),
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_common_models_door_entity.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Run the broader models test suite to confirm no regression**

Run: `python -m pytest tests/ -k "models or DoorEntity or WindowEntity" -q`
Expected: PASS, no failures.

- [ ] **Step 6: Add `block_name_prefix` to `OpeningFeatures`**

Per the spec's Architecture section, this field carries the soft block-name hint (e.g.
`"D"` from `"D900"`) that Task 2's `door_sliding_light.yaml`/`door_sliding_heavy.yaml`
`prefers` sections reference. In `src/cad_intelligence/semantic/opening_features.py`, add
one field to the `OpeningFeatures` dataclass (after the `# Context` fields, around line
59-60):

```python
    # Context
    wall_overlap: float = 0.0
    inside_wall: bool = False
    block_name_prefix: str | None = None
```

This field is populated by `DoorRecognizer` (Task 5), not by the shared
`OpeningFeatureExtractor.extract()` — leave `OpeningFeatureExtractor` itself unchanged in
this step; adding a defaulted field to the dataclass is purely additive and doesn't affect
`OpeningFeatureExtractor.extract()`'s existing construction call (it doesn't pass
`block_name_prefix`, so it stays `None` for windows, which is correct — windows don't use
this hint).

- [ ] **Step 7: Run the full window/opening regression suite to confirm the additive field
  change breaks nothing**

Run: `python -m pytest tests/test_window_classifier.py tests/test_window_pipeline.py tests/test_opening_pipeline_two_pass.py tests/test_window_recognizer.py -q`
Expected: PASS, same counts as before this task.

- [ ] **Step 8: Commit**

```bash
git add src/cad_intelligence/common/models.py src/cad_intelligence/semantic/opening_features.py tests/test_common_models_door_entity.py
git commit -m "feat(common,semantic): add DoorEntity.door_style/style_confidence + OpeningFeatures.block_name_prefix"
```

---

## Task 5: `DoorRecognizer`

**Files:**
- Create: `src/cad_intelligence/semantic/door_recognizer.py`
- Test: `tests/test_door_recognizer.py`

Read `src/cad_intelligence/semantic/window_recognizer.py` in full before starting — this
task's `DoorRecognizer` mirrors it exactly, swapping `WindowClassifier`→`DoorClassifier`.
**Unlike `WindowClassifier()`, `DoorClassifier()` has no working default** (no hardcoded
fallback mode — Task 1's `TestDoorClassifierNoEvaluator` proved it raises without an
evaluator) — `DoorRecognizer`'s constructor must therefore always construct a
`DoorClassifier` with a real `YamlRuleEvaluator` by default, not just
`classifier or DoorClassifier()` the way `WindowRecognizer` does with
`classifier or WindowClassifier()`. This is the one structural difference from
`WindowRecognizer` — read carefully.

- [ ] **Step 1: Write the failing test**

```python
"""Tests for DoorRecognizer -- the second OpeningRecognizer implementation."""

from __future__ import annotations

from cad_intelligence.semantic.opening_candidate import build_candidate
from cad_intelligence.semantic.door_recognizer import DoorRecognizer


def _scan_from_lines(lines: list[tuple]) -> object:
    """Minimal fake scan_result exposing entries_by_layer (mirrors
    test_window_recognizer.py's _scan_from_lines, door-layer-scoped)."""
    class _Entry:
        def __init__(self, handle, start, end):
            self.object_name = "AcDbLine"
            self.handle = handle
            self.layer = "A-DOOR"
            self.start = start
            self.end = end
            self.length = ((end[0]-start[0])**2 + (end[1]-start[1])**2) ** 0.5

    class _Scan:
        def __init__(self, entries):
            self.entries_by_layer = {"A-DOOR": entries}

    return _Scan([_Entry(f"H{i}", s, e) for i, (s, e) in enumerate(lines)])


class TestDoorRecognizerRecognize:
    def test_empty_scan_returns_empty_list(self) -> None:
        recognizer = DoorRecognizer()
        scan = _scan_from_lines([])
        assert recognizer.recognize(scan, search_layers={"A-DOOR"}) == []

    def test_detects_and_classifies_a_candidate(self) -> None:
        recognizer = DoorRecognizer()
        # 2 parallel lines -- may or may not match a door style depending on Task 2's
        # exact thresholds, but must produce exactly one candidate with a
        # classification attempt (matches may be empty -- that's a valid outcome).
        scan = _scan_from_lines([((0.0, 0.0), (900.0, 0.0)), ((0.0, 40.0), (900.0, 40.0))])
        results = recognizer.recognize(scan, search_layers={"A-DOOR"})
        assert len(results) == 1
        assert results[0].candidate is not None
        assert 0.0 <= results[0].final_confidence <= 1.0

    def test_confidence_params_are_forwarded(self) -> None:
        recognizer = DoorRecognizer()
        scan = _scan_from_lines([((0.0, 0.0), (900.0, 0.0))])
        results = recognizer.recognize(
            scan, search_layers={"A-DOOR"},
            layer_confidence=0.5, block_confidence=0.2, geometry_quality=0.3,
        )
        assert len(results) == 1


class TestDoorRecognizerReclassify:
    def test_reclassify_a_built_candidate(self) -> None:
        recognizer = DoorRecognizer()
        cluster = [{
            "type": "line", "handle": "H1", "object_name": "AcDbLine",
            "layer": "A-DOOR", "start": (0.0, 0.0), "end": (900.0, 0.0), "length": 900.0,
        }]
        candidate = build_candidate(cluster)
        result = recognizer.reclassify(candidate)
        assert result.candidate is candidate
        assert 0.0 <= result.final_confidence <= 1.0

    def test_reclassify_matches_recognize_for_same_candidate(self) -> None:
        recognizer = DoorRecognizer()
        scan = _scan_from_lines([((0.0, 0.0), (900.0, 0.0))])
        recognize_result = recognizer.recognize(scan, search_layers={"A-DOOR"})[0]
        reclassify_result = recognizer.reclassify(recognize_result.candidate)
        assert (
            recognize_result.classification.matches
            == reclassify_result.classification.matches
        )
        assert recognize_result.final_confidence == reclassify_result.final_confidence
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_door_recognizer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.semantic.door_recognizer'`

- [ ] **Step 3: Write the implementation**

```python
"""DoorRecognizer -- the second OpeningRecognizer implementation (doors).

Composes OpeningSymbolDetector -> OpeningEvidenceExtractor -> OpeningFeatureExtractor ->
DoorClassifier -> ConfidenceFuser internally -- the same shape WindowRecognizer uses,
swapping only the classifier. This composition is DoorRecognizer's own concern --
OpeningSymbolPipeline never sees any of these types.

Unlike WindowClassifier, DoorClassifier has no hardcoded-fallback mode -- it requires a
real RuleEvaluator to function. This class's constructor therefore always builds a
working default DoorClassifier (with a YamlRuleEvaluator loaded from the door_detection
domain), rather than falling back to a classifier with no evaluator the way
WindowRecognizer's `classifier or WindowClassifier()` pattern would.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from cad_intelligence.rules import RuleEngine
from cad_intelligence.rules.registry import RuleRegistry
from cad_intelligence.semantic.confidence_fuser import ConfidenceFuser, ConfidenceInputs
from cad_intelligence.semantic.door_classifier import DOOR_STYLE_MAP, DoorClassifier
from cad_intelligence.semantic.opening_detector import OpeningCandidate, OpeningSymbolDetector
from cad_intelligence.semantic.opening_features import OpeningFeatureExtractor
from cad_intelligence.semantic.opening_recognizer import OpeningPipelineResult
from cad_intelligence.semantic.opening_symbol_evidence import OpeningEvidenceExtractor
from cad_intelligence.semantic.rule_evaluator import RuleDomain, YamlRuleEvaluator

__all__ = ["DoorRecognizer"]

_PATTERNS_DIR = Path(__file__).resolve().parent.parent / "patterns" / "opening"


def _default_door_classifier() -> DoorClassifier:
    """Build a working DoorClassifier with a real YamlRuleEvaluator loaded from the
    door_detection domain YAML patterns. DoorClassifier has no hardcoded fallback, so
    (unlike WindowClassifier()) a bare DoorClassifier() is non-functional -- this
    helper is what DoorRecognizer's constructor uses as its actual default."""
    registry = RuleRegistry()
    registry.load_from_yaml(_PATTERNS_DIR)
    engine = RuleEngine()
    for rule in registry.rules_for_domain(RuleDomain.DOOR_DETECTION.value):
        engine.register(rule)
    evaluator = YamlRuleEvaluator(
        rule_engine=engine,
        domain=RuleDomain.DOOR_DETECTION,
        style_map=DOOR_STYLE_MAP,
        object_id="door_candidate",
    )
    return DoorClassifier(evaluator=evaluator)


class DoorRecognizer:
    """OpeningRecognizer implementation for doors.

    Usage::

        recognizer = DoorRecognizer()
        results = recognizer.recognize(scan_result, search_layers={"A-DOOR"})
    """

    def __init__(
        self,
        classifier: DoorClassifier | None = None,
        fuser: ConfidenceFuser | None = None,
        detector: OpeningSymbolDetector | None = None,
    ) -> None:
        self._classifier = classifier or _default_door_classifier()
        self._fuser = fuser or ConfidenceFuser()
        self._detector = detector or OpeningSymbolDetector()
        self._evidence_extractor = OpeningEvidenceExtractor()
        self._feature_extractor = OpeningFeatureExtractor()

    def recognize(
        self,
        scan_result: Any,
        search_layers: set[str] | None = None,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> list[OpeningPipelineResult]:
        candidates = self._detector.detect(scan_result, search_layers)
        return [
            self._classify(cand, layer_confidence, block_confidence, geometry_quality)
            for cand in candidates
        ]

    def reclassify(
        self,
        candidate: OpeningCandidate,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> OpeningPipelineResult:
        return self._classify(candidate, layer_confidence, block_confidence, geometry_quality)

    def _classify(
        self,
        candidate: OpeningCandidate,
        layer_confidence: float,
        block_confidence: float,
        geometry_quality: float,
    ) -> OpeningPipelineResult:
        """Shared by recognize() (per detected candidate) and reclassify() (one given
        candidate) -- both just need Evidence -> Features -> Classify -> Confidence
        on a single OpeningCandidate.

        Populates features.block_name_prefix from candidate.block_name (e.g. "D" from
        "D900") so the door_sliding_light/door_sliding_heavy YAML `prefers` sections
        can reference it -- see docs/superpowers/specs/2026-08-06-door-recognition-upgrade-design.md,
        Architecture section.
        """
        evidence = self._evidence_extractor.extract(candidate)
        features = self._feature_extractor.extract(evidence, candidate)
        block_name_prefix = _extract_block_prefix(candidate.block_name)
        if block_name_prefix is not None:
            features = _replace_block_name_prefix(features, block_name_prefix)
        classification = self._classifier.classify(features)

        rule_score = (
            classification.matches[0].score
            if classification.matches else 0.0
        )
        final_confidence = self._fuser.fuse(ConfidenceInputs(
            rule_score=rule_score,
            geometry_quality=geometry_quality,
            layer_confidence=layer_confidence,
            block_confidence=block_confidence,
        ))

        return OpeningPipelineResult(
            candidate=candidate,
            evidence=evidence,
            features=features,
            classification=classification,
            final_confidence=final_confidence,
        )


def _extract_block_prefix(block_name: str | None) -> str | None:
    """"D900" -> "D". None if block_name is None or has no leading letter run."""
    if not block_name:
        return None
    prefix = "".join(ch for ch in block_name if ch.isalpha())
    return prefix or None


def _replace_block_name_prefix(features: Any, prefix: str) -> Any:
    """OpeningFeatures is frozen -- return a copy with block_name_prefix set."""
    from dataclasses import replace
    return replace(features, block_name_prefix=prefix)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_door_recognizer.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/semantic/door_recognizer.py tests/test_door_recognizer.py
git commit -m "feat(semantic): add DoorRecognizer (second OpeningRecognizer implementation)"
```

---

## Task 6: Wire `_build_doors_v3` into `handlers/space.py`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py`
- Test: `tests/handlers/test_extract_cad_objects_door_pipeline_v3.py`

Read `_build_windows_v3` (lines 2277-2359 as of this writing) and its call site inside
`handle_extract_cad_objects` (line ~2753) in full before starting. This task's
`_build_doors_v3` mirrors `_build_windows_v3` exactly, door-scoped, with one behavioral
decision to make explicit: **how the new pipeline-classified doors interact with the
existing block-reference/polygon-fallback door extraction already in
`handle_extract_cad_objects` (lines ~2654-2739).**

### Integration approach: additive `door_style` enrichment, not replacement

Per the spec's Error Handling section ("Model field additions are purely additive... zero
migration needed") and the overall PR sequencing (this is about adding classification
*on top of* existing extraction, not replacing extraction), the correct integration is:
run `_build_doors_v3` to get classification results, then **enrich** the existing
`doors` list (built by the current block/polygon extraction loop) with `door_style`/
`style_confidence` by matching on `handle`, rather than replacing the existing door list
wholesale. This preserves 100% of the existing door extraction behavior (positions,
widths, rotations, `MISSING_BLOCK_DEF` exceptions) and purely adds the 2 new fields where
a pipeline classification is available.

- [ ] **Step 1: Run the existing extract_cad_objects test suite to record the baseline**

Run: `python -m pytest tests/handlers/ -k "extract_cad_objects" -v`
Expected: current PASS count (note it — must be unchanged after this task except for the
new test file this task adds).

- [ ] **Step 2: Write the failing test**

```python
"""Tests for _build_doors_v3 -- enriches handle_extract_cad_objects's doors with
door_style/style_confidence, mirroring _build_windows_v3's window enrichment."""

from __future__ import annotations

from cad_intelligence.cad_io.handlers.space import _build_doors_v3


class _FakeEntry:
    def __init__(self, layer, obj_name, **kwargs):
        self.layer = layer
        self.object_name = obj_name
        for k, v in kwargs.items():
            setattr(self, k, v)


class _FakeScanResult:
    def __init__(self, entries):
        self.entries_by_layer: dict[str, list] = {}
        for e in entries:
            self.entries_by_layer.setdefault(e.layer, []).append(e)


def test_build_doors_v3_returns_classified_candidates() -> None:
    scan = _FakeScanResult([
        _FakeEntry(
            "A-DOOR", "AcDbLine", handle="L1",
            start=(0.0, 0.0), end=(900.0, 0.0), length=900.0,
        ),
    ])
    doors, exceptions = _build_doors_v3(scan, [], {"A-DOOR"})
    assert isinstance(doors, list)
    assert isinstance(exceptions, list)
    # A single unmatched line may or may not classify -- this test only confirms the
    # function runs end-to-end and returns the expected shape.
    if doors:
        assert "door_style" in doors[0]
        assert "style_confidence" in doors[0]


def test_build_doors_v3_empty_scan_returns_empty() -> None:
    scan = _FakeScanResult([])
    doors, exceptions = _build_doors_v3(scan, [], {"A-DOOR"})
    assert doors == []
    assert exceptions == []


def test_build_doors_v3_multi_entity_cluster_reports_all_entity_ids() -> None:
    """Proves the fix for the handle-vs-entity_ids matching gap: when multiple raw
    entities cluster into one candidate, entity_ids must list every absorbed handle,
    not just the lexicographically-lowest representative (candidate.handle)."""
    scan = _FakeScanResult([
        # Two close lines that OpeningSymbolDetector's proximity clustering absorbs
        # into a single candidate (mirrors a frame + companion line symbol).
        _FakeEntry(
            "A-DOOR", "AcDbLine", handle="Z9",
            start=(0.0, 0.0), end=(900.0, 0.0), length=900.0,
        ),
        _FakeEntry(
            "A-DOOR", "AcDbLine", handle="A1",
            start=(0.0, 5.0), end=(900.0, 5.0), length=900.0,
        ),
    ])
    doors, _ = _build_doors_v3(scan, [], {"A-DOOR"})
    assert len(doors) == 1
    # candidate.handle is lexicographically-lowest ("A1"), but entity_ids must
    # contain BOTH raw handles ("A1" and "Z9") so Task 6 Step 5's enrichment can
    # match against either one, not just the representative.
    assert set(doors[0]["entity_ids"]) == {"A1", "Z9"}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_pipeline_v3.py -v`
Expected: FAIL with `ImportError: cannot import name '_build_doors_v3'`

- [ ] **Step 4: Add `_build_doors_v3` to `handlers/space.py`**

Add the import near the existing `OpeningSymbolPipeline`/`WindowRecognizer` imports
(line ~68-69):

```python
from cad_intelligence.semantic.door_recognizer import DoorRecognizer
```

Add the new function immediately after `_build_windows_v3` (after line 2359, before
`_build_windows_v3_legacy_fallback`):

```python
def _build_doors_v3(
    scan_result: "ModelSpaceScanResult",
    scanned_entities: list[dict],
    door_layers: set[str],
) -> tuple[list[dict], list[dict]]:
    """Build door style-classification results for handle_extract_cad_objects (V3).

    Mirrors _build_windows_v3 exactly: clusters door-layer geometry with
    OpeningSymbolPipeline(recognizer=DoorRecognizer()), reusing the already-scanned
    scan_result directly -- no adapter needed (see this plan's "Correction from the
    spec" section for why the spec's originally-proposed adapter is unnecessary).

    Returns (doors, exceptions) where each door dict has the same shape as
    _build_windows_v3's window dicts (handle/layer/position/width/block_name/
    door_style/style_confidence/evidence_kinds), for the caller to merge into the
    existing block/polygon-extracted doors list by handle.

    scanned_entities is currently unused (kept for signature symmetry with
    _build_windows_v3, which also does not consume it directly -- both take it only
    because their legacy-fallback siblings need it; _build_doors_v3 has no legacy
    fallback in this PR, since door extraction's non-pipeline path already exists
    separately in handle_extract_cad_objects's block/polygon loop).
    """
    del scanned_entities  # unused -- see docstring
    doors: list[dict] = []
    exceptions: list[dict] = []

    pipeline_results = OpeningSymbolPipeline(recognizer=DoorRecognizer()).run(
        scan_result, search_layers=door_layers
    )

    for result in pipeline_results:
        candidate = result.candidate
        best_match = (
            result.classification.matches[0]
            if result.classification.matches else None
        )
        cx = (candidate.bbox[0] + candidate.bbox[2]) / 2
        cy = (candidate.bbox[1] + candidate.bbox[3]) / 2
        width = max(
            candidate.bbox[2] - candidate.bbox[0],
            candidate.bbox[3] - candidate.bbox[1],
        )

        # entity_ids is the FULL set of raw entity handles this candidate's cluster
        # absorbed (mirrors _build_windows_v3's clustered_handles bookkeeping at
        # handlers/space.py:2309-2312). candidate.handle alone is only the
        # lexicographically-lowest representative -- for a multi-entity door symbol
        # (e.g. frame polyline + swing arc clustered together), candidate.handle will
        # NOT equal the handle the existing single-entity block/polygon extraction
        # loop used for that same physical door. Step 5's enrichment MUST match on
        # entity_ids, not candidate.handle, or multi-entity doors silently never get
        # door_style populated.
        entity_ids = (
            list(candidate.signature.entity_ids)
            if candidate.signature is not None
            else [candidate.handle]
        )

        doors.append({
            "handle": candidate.handle,
            "entity_ids": entity_ids,
            "layer": candidate.layer,
            "position": [cx, cy],
            "width": width,
            "block_name": candidate.block_name,
            "door_style": best_match.style.value if best_match else None,
            "style_confidence": result.final_confidence,
            "evidence_kinds": [e.kind.name for e in result.evidence.evidence_items],
        })
        if result.final_confidence < _PIPELINE_MIN_CONFIDENCE:
            exceptions.append(
                _ExceptionReport(
                    code="LOW_CONFIDENCE_DOOR_SYMBOL",
                    severity="info",
                    message=(
                        f"Door candidate on layer '{candidate.layer}' "
                        f"(handle {candidate.handle}) classified with low "
                        f"confidence ({result.final_confidence:.2f})."
                    ),
                    context={"handle": candidate.handle, "layer": candidate.layer},
                    suggested_action=(
                        "Review this door symbol visually; classification "
                        "may be unreliable."
                    ),
                ).to_dict()
            )

    return doors, exceptions
```

**Note on `best_match.style.value` vs `best_match.style.name`:** `_build_windows_v3`
uses `best_match.style.name` (e.g. `"SLIDING"`, the enum member name, uppercase). This
plan uses `.value` (e.g. `"panel"`, matching `DoorStyle.PANEL.value`) instead, to match
the lowercase string values the spec's `DoorStyle` enum defines and that
`DoorEntity.door_style` is documented to hold. **This is an intentional deviation from
`_build_windows_v3`'s exact pattern — verify which convention `WindowEntity.window_style`
actually stores** (check a live window golden-test assertion or the existing
`WindowEntity.window_style` docstring/usage) before finalizing; if `window_style` also
turns out to store the uppercase `.name` form for consistency, switch `_build_doors_v3`
to `.name` too for symmetry, and update Task 3's `test_door_pipeline.py` assertions
accordingly (they currently compare against the `DoorStyle` enum member directly via
`_STYLE_ENUM`, which works with either convention since `DoorStyle` is a `str, Enum` and
`best.style == expected` — the `door_style` dict field is what needs the naming-convention
decision, not the enum comparison in tests).

- [ ] **Step 5: Wire `_build_doors_v3`'s output into `handle_extract_cad_objects`**

Find the existing door-extraction block inside `handle_extract_cad_objects` (the loop
building `doors: list[dict]` via `_DoorEntity(...).to_dict()`, lines ~2654-2739). Read the
full surrounding function to find where `door_layers` is defined (should be very close to
where `window_layers` is defined, used by the neighboring `_build_windows_v3` call) and
where the `doors` list is finalized/returned. Immediately after the existing
block/polygon-fallback door loop finishes populating `doors`, add the pipeline
classification pass.

**Match by entity-id-set intersection, NOT exact handle equality.** A pipeline candidate's
`candidate.handle` is only the lexicographically-lowest handle among the (possibly many)
raw entities its cluster absorbed (see Step 4's `build_candidate()` docstring reference).
The existing single-entity extraction loop's `door_dict["handle"]` is the handle of ONE
specific raw entity (a block reference or a polygon). For a single-entity door symbol
these coincide; for a multi-entity door symbol (e.g. a frame polyline clustered with a
swing arc) they generally do NOT, and exact-equality matching silently drops the
enrichment with no error. Build the enrichment index keyed by every entity id in each
pipeline candidate's cluster instead:

```python
        # --- Door style classification (V3): enrich doors with door_style/confidence ---
        pipeline_doors, pipeline_door_exceptions = _build_doors_v3(
            scan_result, scanned_entities, door_layers,
        )
        # Index by EVERY entity id each pipeline candidate's cluster absorbed (not just
        # candidate.handle) -- a multi-entity door symbol's existing single-entity
        # extraction-loop handle may match any one of those ids, not necessarily the
        # cluster's lexicographically-lowest representative handle.
        pipeline_doors_by_entity_id: dict[str, dict] = {}
        for pd in pipeline_doors:
            for eid in pd["entity_ids"]:
                pipeline_doors_by_entity_id[eid] = pd
        for door_dict in doors:
            match = pipeline_doors_by_entity_id.get(door_dict["handle"])
            if match is not None:
                door_dict["door_style"] = match["door_style"]
                door_dict["style_confidence"] = match["style_confidence"]
        exceptions.extend(pipeline_door_exceptions)
```

Place this block after the existing door-extraction loop and before the
`# --- Windows: ... ---` comment that precedes the `_build_windows_v3` call (i.e.
immediately adjacent to where windows already get their pipeline enrichment, for
readability/symmetry). Confirm `scan_result` (the `ModelSpaceScanResult` instance) is the
same variable `_build_windows_v3` is called with a few lines later — reuse it, don't
re-scan.

- [ ] **Step 6: Run this task's new tests**

Run: `python -m pytest tests/handlers/test_extract_cad_objects_door_pipeline_v3.py -v`
Expected: PASS (3 tests — including
`test_build_doors_v3_multi_entity_cluster_reports_all_entity_ids`, which is the direct
regression proof for the entity-id-set matching fix in Step 5; do not skip or weaken this
test).

- [ ] **Step 7: Run the broader extract_cad_objects regression suite**

Run: `python -m pytest tests/handlers/ -k "extract_cad_objects" -v`
Expected: PASS, same count as Step 1's baseline plus this task's 3 new tests.

- [ ] **Step 8: Commit**

```bash
git add src/cad_intelligence/cad_io/handlers/space.py tests/handlers/test_extract_cad_objects_door_pipeline_v3.py
git commit -m "feat(cad_io): wire door_style classification into handle_extract_cad_objects"
```

---

## Task 7: `DoorStrategyRegistry` + rendering fallback

**Files:**
- Modify: `src/cad_intelligence/elevation/renderers/render_style.py`
- Modify: `src/cad_intelligence/elevation/renderers/door_renderer.py`
- Test: `tests/elevation/test_door_renderer_style_registry.py` (check the exact existing
  test file path/naming for `door_renderer.py` first — mirror whatever convention
  `window_renderer.py`'s test file uses)

Read `WindowStrategyRegistry` (render_style.py, lines ~631-641), `WindowSymbolStrategy`
Protocol (lines 256-265), and `RectangleWindowStrategy` (lines 388-398, the no-op default)
in full before starting. Also read `window_renderer.py`'s `style_key` resolution (lines
~74-83) and `door_renderer.py`'s `render()` method in full (already read during planning
-- it currently has NO style-key resolution at all, unlike `window_renderer.py`).

- [ ] **Step 1: Find and read the existing renderer test file(s)**

Run: `grep -rln "WindowStrategyRegistry\|WindowRenderer" tests/` to find the existing
test file(s) covering `window_renderer.py`'s style resolution. Read it/them to match
its exact test style/fixture conventions for this task's new door test.

- [ ] **Step 2: Write the failing test**

Adapt to match whatever conventions Step 1 revealed; the core assertions should be:

```python
"""Tests for DoorStrategyRegistry + DoorRenderer's style-key resolution fallback."""

from __future__ import annotations

import pytest

from cad_intelligence.elevation.renderers.render_style import DoorStrategyRegistry


class TestDoorStrategyRegistry:
    def test_unregistered_style_raises_key_error(self) -> None:
        with pytest.raises(KeyError):
            DoorStrategyRegistry.resolve("nonexistent_style")

    def test_default_none_strategy_is_registered(self) -> None:
        strategy = DoorStrategyRegistry.resolve("none")
        assert strategy is not None
        # No-op strategy must not raise when draw() is called with no-op args.
        strategy.draw(None, None)
```

(A more thorough `DoorRenderer.render()`-level test confirming the fallback-when-`door_style`-is-`None`
behavior belongs alongside whatever existing `door_renderer.py` test infrastructure Step
1 found — add it there, matching that file's existing `RenderContext`/`SymbolPlacement`
mocking conventions, rather than inventing new test scaffolding here.)

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/elevation/test_door_renderer_style_registry.py -v` (adjust
path per Step 1's findings)
Expected: FAIL with `ImportError: cannot import name 'DoorStrategyRegistry'`

- [ ] **Step 4: Add `DoorStrategyRegistry` to `render_style.py`**

Add a `DoorSymbolStrategy` Protocol (mirrors `WindowSymbolStrategy`, lines 256-265) and a
no-op default strategy (mirrors `RectangleWindowStrategy`, lines 388-398), then the
registry itself (mirrors `WindowStrategyRegistry`, lines 631-641):

```python
class DoorSymbolStrategy(Protocol):
    """Draws a door's frame-interior symbol onto the drawing context."""

    def draw(
        self,
        render_ctx: RenderContext,
        placement: SymbolPlacement,
        *args: Any,
        **kwargs: Any,
    ) -> None: ...


class NoOpDoorStrategy:
    """No-op door symbol strategy (default/fallback -- draws nothing beyond what
    DoorRenderer.render() already draws unconditionally)."""

    def draw(
        self,
        render_ctx: RenderContext | Any,
        placement: SymbolPlacement | Any = None,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        pass


class DoorStrategyRegistry(StrategyRegistry[DoorSymbolStrategy]):
    """Factory-based registry for door symbol strategies.

    Only a "none" no-op strategy is registered in this PR (Backlog #14 PR 2) -- style-
    differentiated door symbol drawing (5 visual variants matching DoorStyle) is a
    future extension, not required for this PR's goal of getting door_style/
    style_confidence populated end-to-end with a safe rendering fallback.
    """

    def __init__(self) -> None:
        super().__init__()
        self._factories["none"] = NoOpDoorStrategy
```

Place these definitions near the existing `WindowSymbolStrategy`/`WindowStrategyRegistry`
definitions (after `WindowStrategyRegistry`, around line 641, before
`MaterialStrategyRegistry`).

- [ ] **Step 5: Wire the registry into `door_renderer.py`**

In `DoorRenderer.render()`, mirror `window_renderer.py`'s style-key resolution pattern
(lines ~74-83). The current `door_renderer.py` doesn't resolve any style-specific symbol
strategy at all — this step adds that resolution as a new capability, but since only the
`"none"` no-op strategy exists in this PR, the practical rendering output is unchanged
(the no-op strategy draws nothing extra, matching current behavior). Find the point in
`DoorRenderer.render()` right after the plain rectangle outline is drawn (after the 4
`self._ctx.draw_line(...)` calls for the outline) and before the `leaf_offset`/frame
logic, and add:

```python
        # Per-opening style selection: if this opening carries a classified
        # door_style (from OpeningSymbolPipeline via DoorRecognizer) that matches a
        # registered strategy, use that strategy. Unclassified/unrecognized styles
        # fall back to the "none" no-op strategy -- purely additive, current fixed
        # rendering (outline/frame/handle/swing below) is unaffected either way.
        style_key = (og.door_style or "").lower()
        try:
            door_symbol_strategy = DoorStrategyRegistry.resolve(style_key or "none")
        except KeyError:
            door_symbol_strategy = DoorStrategyRegistry.resolve("none")
        door_symbol_strategy.draw(self._ctx, og)
```

Add the import: `from .render_style import DoorStrategyRegistry` near the top of
`door_renderer.py`, alongside wherever `RenderStyle`/other render_style imports already
are (check the `TYPE_CHECKING` block at the top of the file — `DoorStrategyRegistry` must
be a REAL (non-`TYPE_CHECKING`) import since it's called at runtime, unlike the
`TYPE_CHECKING`-only imports already there for type hints).

**`OpeningRenderGeometry` does NOT yet have a `door_style` field** (verified during plan
review — confirmed only `window_style` exists on it today, in `render_geometry.py:29-61`).
This gap must be closed as part of this task. The `window_style` propagation chain it
must mirror (confirmed during plan review, the 2026-08-05 "window_style-propagation" work
referenced in the CHANGELOG) spans exactly these 4 files:

1. `src/cad_intelligence/elevation/opening_projector.py` — `window_style` threaded through
   a builder function and dataclass field at (approximately) lines 77, 98, 128, 171, 295.
2. `src/cad_intelligence/elevation/room_face_builder.py` — around line 296.
3. `src/cad_intelligence/elevation/render_geometry.py` — `OpeningRenderGeometry`'s
   dataclass fields, around lines 29, 47, 61, 306.
4. `src/cad_intelligence/elevation/renderers/window_renderer.py` — the style-key
   resolution consuming it, lines ~66-83 (already read; `door_renderer.py`'s Step 5 change
   above is this file's door counterpart).

Add a `door_style: str | None = None` field at each of these 4 points, mirroring
`window_style`'s exact field position/threading pattern at each one — this is a same-shape
repetition, not a redesign, confirmed by review. **If, while doing this, any of the 4
files' `window_style` threading turns out to be more involved than a straightforward
field-mirror (e.g. `window_style` participates in logic beyond simple pass-through), STOP
and report back rather than guessing — this plan's Task 7
scope assumes the threading already exists or is a small mechanical addition, not a
redesign.**

- [ ] **Step 6: Run this task's tests**

Run: `python -m pytest tests/elevation/test_door_renderer_style_registry.py -v` (adjust
path per Step 1)
Expected: PASS

- [ ] **Step 7: Run the broader elevation/rendering regression suite**

Run: `python -m pytest tests/elevation/ tests/facade/ -q` (adjust to whatever directories
actually contain renderer tests, per Step 1's findings)
Expected: PASS, no regressions — the no-op strategy must produce pixel/geometry-identical
output to the pre-this-task `DoorRenderer.render()`.

- [ ] **Step 8: Commit**

```bash
git add src/cad_intelligence/elevation/renderers/render_style.py src/cad_intelligence/elevation/renderers/door_renderer.py tests/elevation/test_door_renderer_style_registry.py
git commit -m "feat(elevation): add DoorStrategyRegistry + door_style resolution (no-op default)"
```

---

## Task 8: Full regression + CHANGELOG

**Files:** none (verification-only task, plus CHANGELOG.md)

- [ ] **Step 1: Run the full test suite**

Run: `python -m pytest tests/ -q`
Expected: no regressions relative to the pre-PR2 baseline (confirm the exact baseline via
`git log`/CHANGELOG if not freshly known — PR 1 left the suite at 4609 passed, 6 skipped,
1 xfailed; this PR should add roughly 5 (door_classifier) + 5 (door_pipeline golden) + 5
(common_models_door_entity) + 5 (door_recognizer) + 2 (extract_cad_objects_door_pipeline)
+ 2+ (door_renderer_style_registry) = ~24+ new tests, exact count depends on Task 7's
final scope).

- [ ] **Step 2: Smoke-import every touched/created module**

Run:
```bash
python -c "
from cad_intelligence.semantic.door_classifier import DoorStyle, DoorClassifier, DOOR_STYLE_MAP
from cad_intelligence.semantic.door_recognizer import DoorRecognizer
from cad_intelligence.common.models import DoorEntity
from cad_intelligence.cad_io.handlers.space import _build_doors_v3
from cad_intelligence.elevation.renderers.render_style import DoorStrategyRegistry
from cad_intelligence.elevation.renderers.door_renderer import DoorRenderer
print('ok')
"
```
Expected: `ok`

- [ ] **Step 3: Run the workspace audit**

Run: `bun scripts/audit.ts`
Expected: exit 0, `✅ All checks passed.`

- [ ] **Step 4: Add a CHANGELOG entry**

Add to `CHANGELOG.md` under `[Unreleased]` -> `### Added` (this is new capability, not a
refactor, unlike PR 1):

```markdown
- **[<today's date>]**: PR 2 of the door recognition upgrade (Backlog #14,
  `docs/superpowers/specs/2026-08-06-door-recognition-upgrade-design.md`) — doors now get
  style classification with confidence, matching the 5-type Korean taxonomy (PANEL,
  MATERIAL, MESH, SLIDING_LIGHT, SLIDING_HEAVY). New `DoorStyle` enum + `DoorClassifier`
  (`semantic/door_classifier.py`, RuleEngine-mode only, no hardcoded fallback) + 5
  `door_*.yaml` rule patterns (`patterns/opening/`, `domain=door_detection`, thresholds
  confirmed via a Pre-Implementation Verification Gate against 5 new synthetic golden
  fixtures in `tests/golden/doors/`). `DoorRecognizer` (`semantic/door_recognizer.py`)
  implements the `OpeningRecognizer` SPI from PR 1, mirroring `WindowRecognizer`'s
  Detector→Evidence→Features→Classify→Confidence composition. `DoorEntity` gained
  `door_style`/`style_confidence` fields (mirroring `WindowEntity`, with `to_dict`/
  `from_dict` round-trip support and backward-compatible defaults for pre-existing
  serialized data). `handlers/space.py`'s `handle_extract_cad_objects` gained
  `_build_doors_v3` (mirrors `_build_windows_v3`) which enriches the existing
  block-reference/polygon-extracted `doors` list with `door_style`/`style_confidence` by
  handle match — the existing door extraction/grouping (`_classify_door_entity`,
  `_group_door_entities`, Type 1-3 sidecar detectors, `handle_group_openings`) is
  untouched. `OpeningFeatures` gained a `block_name_prefix` field (populated by
  `DoorRecognizer` from the candidate's block name, e.g. `"D"` from `"D900"`) so the
  sliding-door YAML patterns' `prefers` sections can use block-naming conventions as a
  soft hint. `DoorStrategyRegistry` added to `elevation/renderers/render_style.py`
  (mirrors `WindowStrategyRegistry`) with only a `"none"` no-op strategy registered in
  this PR — rendering output is unchanged; style-differentiated door symbol drawing is a
  future extension. `LOW_CONFIDENCE_DOOR_SYMBOL` exception code added, mirroring
  `LOW_CONFIDENCE_WINDOW_SYMBOL`.
```

- [ ] **Step 5: Commit the CHANGELOG entry**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): note PR2 of door recognition upgrade (DoorClassifier + DoorRecognizer)"
```

---

## Execution notes for the implementer

- **The Pre-Implementation Verification Gate (Tasks 2-3) is not optional and is not a
  formality.** The suggested evidence mapping in Task 2 is a hypothesis. Do not commit
  YAML thresholds without confirming them against Task 3's golden fixtures first, and
  expect to revise both the YAMLs and possibly the fixtures during this process — this
  mirrors exactly how the window YAML thresholds were derived (not assumed) per the
  2026-08-04/2026-08-05 precedent this PR explicitly follows.
- **Task 7's rendering-chain scope is the one open risk flagged in this plan.** If tracing
  `window_style`'s propagation chain to `OpeningRenderGeometry` reveals `door_style`
  threading is a substantial, multi-file addition (not a small mirror), stop and report
  back rather than expanding scope silently — this may warrant its own follow-up task or
  even splitting Task 7 into "registry + no-op fallback" (safe, in-scope) vs. "actually
  thread door_style through the render geometry chain" (potentially larger).
- **Do not touch anything render-strategy-visual.** This PR adds the `DoorStrategyRegistry`
  mechanism and a safe no-op default only — it does NOT implement 5 visually distinct door
  symbol strategies (that would be PR 3/4 territory per the original spec's rollout, or a
  follow-up not currently scoped). Confirm test assertions in Task 7 only check the
  registry/fallback mechanism, not visual output differences.
- **If any regression-gate count doesn't match its expected baseline**, stop. Do not
  adjust assertions to force a pass — find and fix the actual issue.

---

## Handoff

Once all 8 tasks are checked off and Task 8's full-suite run is green, this PR is ready
for `/sync`. PR title suggestion:
`feat(semantic,cad_io,elevation): add DoorStyle classification via DoorRecognizer (door-recognition PR2)`.

The next plan (PR 3/4 per the spec's original rollout, if still relevant after PR 2 lands
— door rendering style differentiation, or any further scope) is written separately after
this PR merges.
