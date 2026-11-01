---
lang: ko
lang_reason: source-material
---

# OpeningRecognizer SPI — PR 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce an `OpeningRecognizer` SPI (Protocol with `recognize()` + `reclassify()`)
so `OpeningSymbolPipeline` depends only on that interface — never on `WindowClassifier`,
`OpeningSymbolDetector`, or any other concrete stage type — with **zero behavior change**
for the existing window path. This is PR 1 of the door-recognition-upgrade rollout
(spec: `docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md`, which
supersedes an earlier, simpler PR1 plan that this document replaces).

**Architecture:** A `RuleEvaluator` Protocol (+ `RuleDomain` enum, + `YamlRuleEvaluator`
implementation) separates rule-evaluation mechanism from `BaseStyleClassifier` (new
generic base). `OpeningSymbolDetector._build_candidate` is promoted to a standalone
`build_candidate()` function so the pipeline's Pass-2 re-merge no longer needs a detector
instance. `OpeningRecognizer` (Protocol, 2 methods) wraps Pass-1 recognition;
`WindowRecognizer` is its first implementation. `OpeningSymbolPipeline` is rewritten to
depend on `recognizer: OpeningRecognizer` alone, keeping only the Pass-2 merge-eligibility
geometry (pure functions, unchanged) and routing merged-candidate reclassification through
`recognizer.reclassify()`.

**Tech Stack:** Python 3.11+ (`Protocol`, `Generic`/`TypeVar`, `from __future__ import
annotations`), pytest, existing `RuleEngine`/`RuleRegistry` (unchanged).

---

## Scope boundary (read before starting)

**In scope:** `rule_evaluator.py` (new), `style_classifier_base.py` (new),
`window_classifier.py` (refactor), `opening_candidate.py` (new), `opening_detector.py`
(refactor to use the promoted function), `opening_recognizer.py` (new),
`window_recognizer.py` (new), `opening_pipeline.py` (rewrite), the one production call
site in `handlers/space.py`, and the existing window/opening test suite (repointed
imports/constructor args only — see per-task instructions for exactly what changes).

**Out of scope (do not touch in this PR):** `DoorStyle`, `DoorRecognizer`,
`DoorClassifier`, any `door_*.yaml` file, any `handlers/space.py` door-extraction logic,
`DoorEntity` model changes, rendering. That is PR 2+ per the spec's rollout sequence.

**This is a REPLACEMENT plan.** A prior plan
(`docs/superpowers/plans/2026-08-06-door-recognition-pr1-classifier-genericization.md`)
implemented a simpler, single-method design that was superseded by an architecture review
before any of it was built. That prior plan document should be deleted as part of Task 0
below — it describes a design that no longer exists and would mislead anyone who opens it.

**The regression gate for this entire PR:** the full existing window test suite
(`tests/test_window_classifier.py`, `tests/test_window_pipeline.py`,
`tests/test_opening_pipeline_two_pass.py`, `tests/golden/windows/*`, and the broader
`tests/` suite) must pass **without any assertion content changes** — only import paths
and constructor arguments may change where a moved/renamed type or a changed constructor
signature requires it (each task below states exactly which). If a single assertion needs
to change to pass, that is a sign this refactor broke behavior — stop and re-examine.

---

## File Map

- **Delete:** `docs/superpowers/plans/2026-08-06-door-recognition-pr1-classifier-genericization.md`
  (superseded design, never implemented — see Task 0).
- **Create:** `src/cad_intelligence/rules/rule_evaluator.py` — wait, check placement: this
  belongs in `semantic/` per the spec (it's opening-recognition-specific, not a general
  rules-package concept). Correct path: `src/cad_intelligence/semantic/rule_evaluator.py`
  — `RuleDomain` enum, `RuleEvaluator` Protocol, `YamlRuleEvaluator` implementation.
- **Create:** `src/cad_intelligence/semantic/style_classifier_base.py` — `BaseStyleClassifier[TStyle]`
  generic base, plus `StyleMatch`/`SimpleEvaluation`/`Classification[TStyle]` dataclasses
  (moved here from `window_classifier.py` — not window-specific).
- **Modify:** `src/cad_intelligence/semantic/window_classifier.py` — `WindowClassifier`
  becomes `class WindowClassifier(BaseStyleClassifier[WindowStyle])` (it currently has no
  base class at all), keeping only `WindowStyle`, its hardcoded-fallback mode
  (`_classify_hardcoded`/`_check_*`/`_compute_score`, unchanged), and a `classify()`
  override that dispatches to hardcoded mode or the inherited RuleEngine mode.
- **Create:** `src/cad_intelligence/semantic/opening_candidate.py` — `build_candidate()`,
  `compute_bbox()`, `aspect_ratio()` as standalone module-level functions (promoted from
  `OpeningSymbolDetector`'s private methods, verified stateless).
- **Modify:** `src/cad_intelligence/semantic/opening_detector.py` — `OpeningCandidate`
  dataclass stays here (it's the detector's core output type); `_build_candidate`,
  `_compute_bbox`, `_aspect_ratio` are deleted and `detect()` calls the new
  `opening_candidate.build_candidate()` instead.
- **Create:** `src/cad_intelligence/semantic/opening_recognizer.py` — `OpeningRecognizer`
  Protocol (`recognize()`, `reclassify()`).
- **Create:** `src/cad_intelligence/semantic/window_recognizer.py` — `WindowRecognizer`,
  the first `OpeningRecognizer` implementation.
- **Modify:** `src/cad_intelligence/semantic/opening_pipeline.py` — constructor takes
  `recognizer: OpeningRecognizer` only; `run()` delegates Pass 1 to
  `recognizer.recognize(...)`; `_two_pass_merge`'s one call to `self._classify_once(...)`
  is replaced with `self._recognizer.reclassify(...)`; `_merge_candidates` calls
  `opening_candidate.build_candidate()` directly (no detector instance);
  `_classify_once`/`self._classifier`/`self._detector`/`self._evidence_extractor`/
  `self._feature_extractor`/`self._fuser` are all deleted from this class.
- **Modify:** `src/cad_intelligence/cad_io/handlers/space.py:2302` — the one production
  call site (`OpeningSymbolPipeline().run(...)`) becomes
  `OpeningSymbolPipeline(recognizer=WindowRecognizer()).run(...)`.
- **Modify (imports/constructor args only):** `tests/test_opening_pipeline_two_pass.py` —
  3 call sites (lines 250, 262, 409 as of this writing) updated to pass
  `recognizer=WindowRecognizer()`.
- **No changes needed:** `tests/test_window_classifier.py` — imports `WindowClassification`/
  `WindowClassifier`/`WindowStyle` from `window_classifier.py`, which still re-exports all
  three names after the refactor. `tests/test_window_pipeline.py` — confirmed (by reading
  it) to import only `WindowClassifier`/`WindowStyle`, never `OpeningSymbolPipeline`.

---

## Task 0: Remove the superseded prior plan

**Files:**
- Delete: `docs/superpowers/plans/2026-08-06-door-recognition-pr1-classifier-genericization.md`

This file describes the single-method SPI design that was superseded before
implementation — leaving it in place would mislead a future reader into implementing the
wrong design.

- [ ] **Step 1: Delete the file**

```bash
git rm docs/superpowers/plans/2026-08-06-door-recognition-pr1-classifier-genericization.md
```

- [ ] **Step 2: Commit**

```bash
git commit -m "docs: remove superseded PR1 plan (replaced by OpeningRecognizer SPI design)"
```

---

## Task 1: `RuleEvaluator` Protocol + `RuleDomain` enum + `YamlRuleEvaluator`

**Files:**
- Create: `src/cad_intelligence/semantic/rule_evaluator.py`
- Test: `tests/test_rule_evaluator.py`

This task creates the rule-evaluation abstraction in isolation, tested against a fake rule
engine — it does not yet touch `WindowClassifier` or anything else (that's Task 2). Read
`src/cad_intelligence/semantic/window_classifier.py`'s current `_classify_with_engine`
(lines 115-146) and `_convert_eval` (lines 148-159) before writing this — the
implementation below is that logic, moved and generalized.

- [ ] **Step 1: Write the failing test**

```python
"""Tests for RuleDomain, RuleEvaluator Protocol, and YamlRuleEvaluator."""

from __future__ import annotations

from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.rule_evaluator import RuleDomain, YamlRuleEvaluator
from cad_intelligence.semantic.style_classifier_base import StyleMatch


class _FakeRule:
    def __init__(self, name: str) -> None:
        self.name = name


class _FakeEvaluation:
    """Duck-types RuleEngine's Evaluation shape (.rule.name, .passed, .value)."""

    def __init__(self, rule_name: str, passed: bool, value: float) -> None:
        self.rule = _FakeRule(rule_name)
        self.passed = passed
        self.value = value


class _FakeEngine:
    """Duck-types RuleEngine.evaluate_facts(domain, facts, object_id) -> list[Evaluation]."""

    def __init__(self, evaluations: list[_FakeEvaluation]) -> None:
        self._evaluations = evaluations
        self.last_call: dict | None = None

    def evaluate_facts(self, domain: str, facts, object_id: str = ""):
        self.last_call = {"domain": domain, "facts": facts, "object_id": object_id}
        return self._evaluations


class TestRuleDomain:
    def test_window_and_door_values(self) -> None:
        assert RuleDomain.WINDOW_DETECTION == "window_detection"
        assert RuleDomain.DOOR_DETECTION == "door_detection"


class TestYamlRuleEvaluator:
    def _make(self, engine, style_map=None) -> YamlRuleEvaluator:
        return YamlRuleEvaluator(
            rule_engine=engine,
            domain=RuleDomain.WINDOW_DETECTION,
            style_map=style_map or {"sliding_window": "sliding"},
            object_id="window_candidate",
        )

    def test_matched_rule_produces_style_match(self) -> None:
        engine = _FakeEngine([_FakeEvaluation("sliding_window", passed=True, value=0.9)])
        evaluator = self._make(engine)
        matches = evaluator.evaluate(OpeningFeatures())
        assert len(matches) == 1
        assert matches[0].style == "sliding"
        assert matches[0].score == 0.9

    def test_unmapped_rule_name_is_skipped(self) -> None:
        engine = _FakeEngine([_FakeEvaluation("unknown_rule", passed=True, value=0.9)])
        evaluator = self._make(engine)
        assert evaluator.evaluate(OpeningFeatures()) == ()

    def test_failed_requires_is_not_a_match(self) -> None:
        engine = _FakeEngine([_FakeEvaluation("sliding_window", passed=False, value=0.0)])
        evaluator = self._make(engine)
        assert evaluator.evaluate(OpeningFeatures()) == ()

    def test_matches_sorted_by_score_descending(self) -> None:
        engine = _FakeEngine([
            _FakeEvaluation("sliding_window", passed=True, value=0.3),
            _FakeEvaluation("fixed_window", passed=True, value=0.8),
        ])
        evaluator = self._make(engine, style_map={
            "sliding_window": "sliding", "fixed_window": "fixed",
        })
        matches = evaluator.evaluate(OpeningFeatures())
        scores = [m.score for m in matches]
        assert scores == sorted(scores, reverse=True)

    def test_zero_value_defaults_to_half_score(self) -> None:
        """Mirrors the current _classify_with_engine's `ev.value if ev.value > 0 else 0.5`."""
        engine = _FakeEngine([_FakeEvaluation("sliding_window", passed=True, value=0.0)])
        evaluator = self._make(engine)
        assert evaluator.evaluate(OpeningFeatures())[0].score == 0.5

    def test_passes_domain_and_object_id_to_engine(self) -> None:
        engine = _FakeEngine([])
        evaluator = self._make(engine)
        evaluator.evaluate(OpeningFeatures())
        assert engine.last_call["domain"] == "window_detection"
        assert engine.last_call["object_id"] == "window_candidate"

    def test_match_result_type_is_style_match(self) -> None:
        engine = _FakeEngine([_FakeEvaluation("sliding_window", passed=True, value=0.9)])
        evaluator = self._make(engine)
        matches = evaluator.evaluate(OpeningFeatures())
        assert isinstance(matches[0], StyleMatch)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_rule_evaluator.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.semantic.rule_evaluator'`
(and also `style_classifier_base` — Task 1 needs `StyleMatch`, which lives in the file
Task 2 creates. **Do Task 2's `style_classifier_base.py` creation first if your tooling
requires resolvable imports to run this test in isolation** — the dataclasses have no
circular dependency on `rule_evaluator.py`, so creating `style_classifier_base.py` first
is safe and does not violate task ordering intent. If you prefer strict task order, skip
running this test until Step 4 of Task 2 and treat Steps 2-3 here as "write, don't run
yet.")

- [ ] **Step 3: Write the implementation**

```python
"""RuleEvaluator -- abstracts the rule-evaluation mechanism behind classification.

Separates *how* features get evaluated against a rule set (YAML/RuleEngine today; a
future LlmRuleEvaluator or MlRuleEvaluator could implement the same Protocol) from
BaseStyleClassifier, which only needs an evaluate(features) -> matches call.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Protocol

from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.style_classifier_base import SimpleEvaluation, StyleMatch

__all__ = [
    "RuleDomain",
    "RuleEvaluator",
    "YamlRuleEvaluator",
]


class RuleDomain(str, Enum):
    """Which rule domain a classifier evaluates against. An enum (not a bare string)
    catches a typo'd domain name at construction time instead of silently returning
    zero matches at runtime."""

    WINDOW_DETECTION = "window_detection"
    DOOR_DETECTION = "door_detection"


class RuleEvaluator(Protocol):
    def evaluate(self, features: OpeningFeatures) -> tuple[StyleMatch, ...]:
        """Evaluate features against this evaluator's rule set, returning matches
        sorted by score descending."""
        ...


class YamlRuleEvaluator:
    """Evaluates features via a YAML-defined RuleEngine (the current, only
    implementation of RuleEvaluator). Reusable across domains -- construct one per
    (rule_engine, domain, style_map, object_id) combination."""

    def __init__(
        self,
        rule_engine: Any,
        domain: RuleDomain,
        style_map: dict[str, Any],
        object_id: str,
    ) -> None:
        self._engine = rule_engine
        self._domain = domain
        self._style_map = style_map
        self._object_id = object_id

    def evaluate(self, features: OpeningFeatures) -> tuple[StyleMatch, ...]:
        results = self._engine.evaluate_facts(
            domain=self._domain.value,
            facts=features,
            object_id=self._object_id,
        )
        matches: list[StyleMatch] = []
        for result in results:
            style = self._style_map.get(result.rule.name)
            if style is None:
                continue
            if not result.passed:
                continue  # requires failed -- not a match
            matches.append(StyleMatch(
                style=style,
                score=result.value if result.value > 0 else 0.5,
                evaluations=(self._convert_result(result),),
                explanation_ko=f"{result.rule.name} matched",
                explanation_en=f"{result.rule.name} matched",
            ))
        matches.sort(key=lambda m: m.score, reverse=True)
        return tuple(matches)

    @staticmethod
    def _convert_result(result: Any) -> SimpleEvaluation:
        return SimpleEvaluation(
            rule_id=getattr(result.rule, "name", ""),
            rule_name=getattr(result.rule, "name", ""),
            matched=result.passed,
            score=result.value,
            passed_requires=(),
            matched_prefers=(),
            failed_requires=(),
        )
```

- [ ] **Step 4: Run test to verify it passes** (after Task 2's `style_classifier_base.py`
  exists — see note in Step 2)

Run: `python -m pytest tests/test_rule_evaluator.py -v`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/semantic/rule_evaluator.py tests/test_rule_evaluator.py
git commit -m "feat(semantic): add RuleEvaluator Protocol + RuleDomain + YamlRuleEvaluator"
```

---

## Task 2: `BaseStyleClassifier[TStyle]` generic base

**Files:**
- Create: `src/cad_intelligence/semantic/style_classifier_base.py`
- Test: `tests/test_style_classifier_base.py`

Do this task's file creation **before** running Task 1's test (see Task 1 Step 2 note) —
`rule_evaluator.py` imports `StyleMatch`/`SimpleEvaluation` from here. Commit order can
still follow the plan's numbering; only the file-creation order needs adjusting if your
test runner requires resolvable imports.

- [ ] **Step 1: Write the failing test**

```python
"""Tests for BaseStyleClassifier[TStyle] -- the generic classifier base."""

from __future__ import annotations

from enum import Enum

from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.style_classifier_base import (
    BaseStyleClassifier,
    Classification,
    StyleMatch,
)


class _FakeStyle(str, Enum):
    ALPHA = "alpha"


class _FakeEvaluator:
    """Duck-types RuleEvaluator.evaluate(features) -> tuple[StyleMatch, ...]."""

    def __init__(self, matches: tuple[StyleMatch, ...]) -> None:
        self._matches = matches

    def evaluate(self, features: OpeningFeatures) -> tuple[StyleMatch, ...]:
        return self._matches


class TestBaseStyleClassifier:
    def test_classify_delegates_to_evaluator(self) -> None:
        expected = (StyleMatch(style=_FakeStyle.ALPHA, score=0.9),)
        classifier = BaseStyleClassifier(evaluator=_FakeEvaluator(expected))
        result = classifier.classify(OpeningFeatures())
        assert isinstance(result, Classification)
        assert result.matches == expected

    def test_no_evaluator_raises_not_implemented(self) -> None:
        import pytest

        classifier = BaseStyleClassifier(evaluator=None)
        with pytest.raises(NotImplementedError):
            classifier.classify(OpeningFeatures())

    def test_classification_is_frozen(self) -> None:
        import pytest

        cls = Classification(matches=(), features=OpeningFeatures())
        with pytest.raises(Exception):
            cls.matches = ()  # type: ignore[misc]

    def test_style_match_is_frozen(self) -> None:
        import pytest

        m = StyleMatch(style=_FakeStyle.ALPHA, score=0.5)
        with pytest.raises(Exception):
            m.score = 0.9  # type: ignore[misc]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_style_classifier_base.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.semantic.style_classifier_base'`

- [ ] **Step 3: Write the implementation**

```python
"""BaseStyleClassifier[TStyle] -- generic opening-style classifier base.

Takes an injected RuleEvaluator (see rule_evaluator.py) rather than a raw rule engine,
so the evaluation mechanism (YAML rules today; LLM/ML later) is fully substitutable
without changing this class or any subclass.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, TypeVar

from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.rule_evaluator import RuleEvaluator

__all__ = [
    "BaseStyleClassifier",
    "Classification",
    "SimpleEvaluation",
    "StyleMatch",
]

TStyle = TypeVar("TStyle")


@dataclass(frozen=True)
class SimpleEvaluation:
    """Per-rule evaluation record."""

    rule_id: str
    rule_name: str
    matched: bool
    score: float
    passed_requires: tuple[str, ...]
    matched_prefers: tuple[str, ...]
    failed_requires: tuple[str, ...]


@dataclass(frozen=True)
class StyleMatch(Generic[TStyle]):
    """A single style match result.

    style: the concrete style enum member (e.g. WindowStyle.SLIDING).
    score: match score (0-1).
    evaluations: evidence trail for explainability.
    explanation_ko / explanation_en: human-readable explanation.
    """

    style: TStyle
    score: float
    evaluations: tuple[SimpleEvaluation, ...] = ()
    explanation_ko: str = ""
    explanation_en: str = ""


@dataclass(frozen=True)
class Classification(Generic[TStyle]):
    """Classification result -- keeps multiple StyleMatch entries. No single final
    selection is made here -- that is a downstream reasoning concern with full drawing
    context."""

    matches: tuple[StyleMatch[TStyle], ...]
    features: OpeningFeatures


class BaseStyleClassifier(Generic[TStyle]):
    """OpeningFeatures -> Classification[TStyle], via an injected RuleEvaluator."""

    def __init__(self, evaluator: RuleEvaluator | None = None) -> None:
        """Inject a RuleEvaluator to enable classification. Without one, classify()
        raises NotImplementedError."""
        self._evaluator = evaluator

    def classify(self, features: OpeningFeatures) -> Classification[TStyle]:
        """Evaluate features via the injected RuleEvaluator.

        Raises
        ------
        NotImplementedError
            If no evaluator was injected and the subclass provides no override.
        """
        if self._evaluator is None:
            raise NotImplementedError(
                f"{type(self).__name__} requires an injected RuleEvaluator "
                "(BaseStyleClassifier has no hardcoded-fallback mode)."
            )
        matches = self._evaluator.evaluate(features)
        return Classification(matches=matches, features=features)
```

Note: unlike an earlier draft of this refactor, this base has **no** `_domain()`/
`_object_id()` methods to override -- those concerns moved entirely into
`YamlRuleEvaluator`'s constructor (Task 1). `BaseStyleClassifier` only knows about
`RuleEvaluator.evaluate()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_style_classifier_base.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Now run Task 1's test (deferred from Task 1 Step 4)**

Run: `python -m pytest tests/test_rule_evaluator.py -v`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/semantic/style_classifier_base.py tests/test_style_classifier_base.py
git commit -m "feat(semantic): add generic BaseStyleClassifier[TStyle]"
```

---

## Task 3: Refactor `WindowClassifier` to subclass `BaseStyleClassifier[WindowStyle]`

**Files:**
- Modify: `src/cad_intelligence/semantic/window_classifier.py`
- Test: `tests/test_window_classifier.py` (must pass unchanged — no edits to this file)

`WindowClassifier` currently has no base class (`class WindowClassifier:`) and holds a raw
`rule_engine` directly. This task makes it a `BaseStyleClassifier[WindowStyle]` subclass
constructed with a `YamlRuleEvaluator`, while its hardcoded-fallback mode
(`_classify_hardcoded`/`_check_*`/`_compute_score`) stays completely unchanged.

- [ ] **Step 1: Run the existing test file to record the baseline**

Run: `python -m pytest tests/test_window_classifier.py -v`
Expected: PASS (9 tests) — this is the pre-refactor baseline; it must still read PASS
after Step 3.

- [ ] **Step 2: Rewrite `window_classifier.py`**

Replace the full file contents with:

```python
"""WindowClassifier -- OpeningFeatures -> WindowClassification (window symbol recognition).

RuleEngine-mode evaluation is delegated to an injected RuleEvaluator (see
rule_evaluator.py) via BaseStyleClassifier. This module keeps only what's window-specific:
the WindowStyle enum, the rule-name -> WindowStyle mapping, and the hardcoded-fallback
mode used when no RuleEvaluator is injected.

Pipeline:
    OpeningFeatures -> WindowClassifier -> WindowClassification

Design principles:
    * Multiple StyleMatch entries are kept -- no single final selection (that is the
      Reasoning Engine's job, with full drawing context).
    * StyleMatch.evaluations preserves the evidence trail (explainable).
    * No COMBINATION style -- a compound window is represented as multiple styles in
      WindowClassification.matches.
"""

from __future__ import annotations

from enum import Enum

from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.style_classifier_base import (
    BaseStyleClassifier,
    Classification,
    SimpleEvaluation,
    StyleMatch,
)

__all__ = [
    "StyleMatch",
    "WindowClassification",
    "WindowClassifier",
    "WindowStyle",
]


class WindowStyle(str, Enum):
    """Window operating mechanism (BIM Style). Type=WINDOW, Style=SLIDING, etc.

    No COMBINATION -- a compound window is represented via multiple
    WindowClassification.matches entries.
    """

    SLIDING = "sliding"
    CASEMENT = "casement"
    FIXED = "fixed"
    AWNING = "awning"


# Backward-compat alias -- existing code imports WindowClassification by name from this
# module. It is now a specialization of the generic Classification[TStyle].
WindowClassification = Classification[WindowStyle]

# Rule name -> WindowStyle mapping, passed to YamlRuleEvaluator by callers that want
# RuleEngine-mode classification (see WindowRecognizer, Task 5).
WINDOW_STYLE_MAP: dict[str, WindowStyle] = {
    "sliding_window": WindowStyle.SLIDING,
    "casement_window": WindowStyle.CASEMENT,
    "fixed_window": WindowStyle.FIXED,
    "awning_window": WindowStyle.AWNING,
}


class WindowClassifier(BaseStyleClassifier[WindowStyle]):
    """OpeningFeatures -> WindowClassification.

    Supports two modes:
    1. **RuleEngine mode** (inherited from BaseStyleClassifier): when a RuleEvaluator is
       injected, delegates to it.
    2. **Hardcoded mode** (fallback, this class only): without an evaluator, uses
       built-in rules.
    """

    def classify(self, features: OpeningFeatures) -> WindowClassification:
        """Evaluate features and return multiple StyleMatch entries."""
        if self._evaluator is not None:
            matches = self._evaluator.evaluate(features)
            return Classification(matches=matches, features=features)
        return self._classify_hardcoded(features)

    # ------------------------------------------------------------------
    # Hardcoded mode (fallback) -- unchanged from before this refactor
    # ------------------------------------------------------------------

    def _classify_hardcoded(self, features: OpeningFeatures) -> WindowClassification:
        """Evaluate using built-in rules (no RuleEvaluator)."""
        matches: list[StyleMatch] = []

        # --- SLIDING: 2+ parallel lines + center line ---
        sliding_check = self._check_sliding(features)
        if sliding_check.matched:
            matches.append(StyleMatch(
                style=WindowStyle.SLIDING,
                score=sliding_check.score,
                evaluations=(sliding_check,),
                explanation_ko="중심선과 평행선이 감지되어 미닫이창",
                explanation_en="Center line + parallel lines -- sliding window",
            ))

        # --- FIXED: frame + parallel lines, no center line, no arc ---
        fixed_check = self._check_fixed(features)
        if fixed_check.matched:
            matches.append(StyleMatch(
                style=WindowStyle.FIXED,
                score=fixed_check.score,
                evaluations=(fixed_check,),
                explanation_ko="프레임과 평행선만 감지되어 고정창",
                explanation_en="Frame + parallel lines, no opening mechanism -- fixed window",
            ))

        # --- CASEMENT: frame + arc, inside wall ---
        casement_check = self._check_casement(features)
        if casement_check.matched:
            matches.append(StyleMatch(
                style=WindowStyle.CASEMENT,
                score=casement_check.score,
                evaluations=(casement_check,),
                explanation_ko="프레임과 개방 호가 감지되어 여닫이창",
                explanation_en="Frame + open arc -- casement window",
            ))

        # --- AWNING: parallel lines + diagonal lines ---
        awning_check = self._check_awning(features)
        if awning_check.matched:
            matches.append(StyleMatch(
                style=WindowStyle.AWNING,
                score=awning_check.score,
                evaluations=(awning_check,),
                explanation_ko="경사선이 감지되어 들창/내리닫이창",
                explanation_en="Diagonal lines detected -- awning window",
            ))

        matches.sort(key=lambda m: m.score, reverse=True)

        return Classification(matches=tuple(matches), features=features)

    def _check_sliding(self, f: OpeningFeatures) -> SimpleEvaluation:
        """SLIDING: parallel_count >= 2, has_center_line, arc_count == 0."""
        requires_passed: list[str] = []
        requires_failed: list[str] = []
        prefers_matched: list[str] = []

        if f.parallel_count >= 2:
            requires_passed.append("parallel_count")
        else:
            requires_failed.append("parallel_count")
        if f.has_center_line:
            requires_passed.append("has_center_line")
        else:
            requires_failed.append("has_center_line")
        if f.arc_count == 0:
            requires_passed.append("arc_count")
        else:
            requires_failed.append("arc_count")

        if f.wall_overlap > 0.8:
            prefers_matched.append("wall_overlap")
        if f.sash_count >= 1:
            prefers_matched.append("sash_count")
        if f.has_rail:
            prefers_matched.append("has_rail")

        matched = len(requires_failed) == 0
        score = self._compute_score(matched, prefers_matched, base=0.95)

        return SimpleEvaluation(
            rule_id="WINDOW-SLIDING-001",
            rule_name="sliding_window",
            matched=matched,
            score=score,
            passed_requires=tuple(requires_passed),
            matched_prefers=tuple(prefers_matched),
            failed_requires=tuple(requires_failed),
        )

    def _check_fixed(self, f: OpeningFeatures) -> SimpleEvaluation:
        """FIXED: frame >= 1, parallel >= 2, no center line, arc 0, sash 0."""
        rp: list[str] = []
        rf: list[str] = []
        pm: list[str] = []

        checks = [
            ("frame_count", f.frame_count >= 1),
            ("parallel_count", f.parallel_count >= 2),
            ("has_center_line", not f.has_center_line),
            ("arc_count", f.arc_count == 0),
            ("sash_count", f.sash_count == 0),
        ]
        for name, passed in checks:
            (rp if passed else rf).append(name)

        if f.wall_overlap > 0.5:
            pm.append("wall_overlap")

        matched = len(rf) == 0
        score = self._compute_score(matched, pm, base=0.85)

        return SimpleEvaluation(
            rule_id="WINDOW-FIXED-001",
            rule_name="fixed_window",
            matched=matched,
            score=score,
            passed_requires=tuple(rp),
            matched_prefers=tuple(pm),
            failed_requires=tuple(rf),
        )

    def _check_casement(self, f: OpeningFeatures) -> SimpleEvaluation:
        """CASEMENT: frame >= 1, arc >= 1, inside_wall."""
        rp: list[str] = []
        rf: list[str] = []
        pm: list[str] = []

        checks = [
            ("frame_count", f.frame_count >= 1),
            ("arc_count", f.arc_count >= 1),
            ("inside_wall", f.inside_wall),
        ]
        for name, passed in checks:
            (rp if passed else rf).append(name)

        if f.arc_sweep_deg <= 90:
            pm.append("arc_sweep_deg")
        if f.wall_overlap > 0.8:
            pm.append("wall_overlap")

        matched = len(rf) == 0
        score = self._compute_score(matched, pm, base=0.90)

        return SimpleEvaluation(
            rule_id="WINDOW-CASEMENT-001",
            rule_name="casement_window",
            matched=matched,
            score=score,
            passed_requires=tuple(rp),
            matched_prefers=tuple(pm),
            failed_requires=tuple(rf),
        )

    def _check_awning(self, f: OpeningFeatures) -> SimpleEvaluation:
        """AWNING: parallel >= 2, diagonal >= 1, arc 0."""
        rp: list[str] = []
        rf: list[str] = []
        pm: list[str] = []

        checks = [
            ("parallel_count", f.parallel_count >= 2),
            ("diagonal_count", f.diagonal_count >= 1),
            ("arc_count", f.arc_count == 0),
        ]
        for name, passed in checks:
            (rp if passed else rf).append(name)

        if f.tilt_angle_deg >= 15.0:
            pm.append("tilt_angle_deg")

        matched = len(rf) == 0
        score = self._compute_score(matched, pm, base=0.85)

        return SimpleEvaluation(
            rule_id="WINDOW-AWNING-001",
            rule_name="awning_window",
            matched=matched,
            score=score,
            passed_requires=tuple(rp),
            matched_prefers=tuple(pm),
            failed_requires=tuple(rf),
        )

    @staticmethod
    def _compute_score(matched: bool, prefers_matched: list[str], base: float) -> float:
        """On match: base_score, plus a bonus proportional to matched prefers."""
        if not matched:
            return 0.0
        bonus = min(0.05, len(prefers_matched) * 0.01)
        return min(1.0, base + bonus)
```

**Behavioral note (must-check):** `tests/test_window_classifier.py`'s
`TestWindowClassifierRuleEngine` class (lines 71-96) constructs
`WindowClassifier(rule_engine=engine)` directly, passing a raw `RuleEngine` as a keyword
argument named `rule_engine`. After this refactor, `WindowClassifier.__init__` is
inherited from `BaseStyleClassifier`, whose parameter is named `evaluator`, not
`rule_engine`, and expects a `RuleEvaluator` (e.g. `YamlRuleEvaluator`), not a raw
`RuleEngine`. **This means `tests/test_window_classifier.py` DOES need one narrow update**
despite this plan's "no changes needed" File Map entry for it — re-read the File Map
statement as applying to imports only, not constructor calls. Fix
`_make_engine_classifier()` (lines 74-84) to wrap the `RuleEngine` in a
`YamlRuleEvaluator` before passing it:

```python
    def _make_engine_classifier(self):
        from pathlib import Path
        from cad_intelligence.rules import RuleEngine
        from cad_intelligence.rules.registry import RuleRegistry
        from cad_intelligence.semantic.rule_evaluator import RuleDomain, YamlRuleEvaluator
        from cad_intelligence.semantic.window_classifier import WINDOW_STYLE_MAP

        registry = RuleRegistry()
        registry.load_from_yaml(Path("src/cad_intelligence/patterns/opening"))
        engine = RuleEngine()
        for rule in registry.rules_for_domain("window_detection"):
            engine.register(rule)
        evaluator = YamlRuleEvaluator(
            rule_engine=engine,
            domain=RuleDomain.WINDOW_DETECTION,
            style_map=WINDOW_STYLE_MAP,
            object_id="window_candidate",
        )
        return WindowClassifier(evaluator=evaluator)
```

This is the ONE test-content change in this entire PR, and it is load-bearing: without it,
`TestWindowClassifierRuleEngine`'s 2 tests fail with a constructor `TypeError`. This does
not violate the "zero behavior change" gate — the test is adapting to a parameter rename
(`rule_engine` -> `evaluator`, with a wrapper type), not to a change in classification
behavior; both RuleEngine-mode tests must still pass with identical assertions.

- [ ] **Step 3: Apply the `_make_engine_classifier` fix above to `tests/test_window_classifier.py`**

- [ ] **Step 4: Run the test file to verify it still passes**

Run: `python -m pytest tests/test_window_classifier.py -v`
Expected: PASS (9 tests) -- same count and same test names as Step 1's baseline.

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/semantic/window_classifier.py tests/test_window_classifier.py
git commit -m "refactor(semantic): WindowClassifier subclasses BaseStyleClassifier[WindowStyle]"
```

---

## Task 4: Promote `build_candidate()` out of `OpeningSymbolDetector`

**Files:**
- Create: `src/cad_intelligence/semantic/opening_candidate.py`
- Modify: `src/cad_intelligence/semantic/opening_detector.py`
- Test: `tests/test_opening_candidate_builder.py`

`OpeningSymbolDetector._build_candidate` (and its `@staticmethod` helpers
`_compute_bbox`/`_aspect_ratio`) hold no instance state — verified by reading the current
`opening_detector.py:260-343`. This task promotes them to standalone functions so both
`OpeningSymbolDetector` and (later, Task 7) `OpeningSymbolPipeline` can call them without
either depending on the other.

- [ ] **Step 1: Run the existing detector-dependent test suite to record the baseline**

Run: `python -m pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: current PASS count (note it — must be unchanged after this task).

- [ ] **Step 2: Write the failing test for the new module**

```python
"""Tests for the standalone build_candidate()/compute_bbox()/aspect_ratio() functions."""

from __future__ import annotations

from cad_intelligence.semantic.opening_candidate import (
    aspect_ratio,
    build_candidate,
    compute_bbox,
)
from cad_intelligence.semantic.opening_detector import OpeningCandidate


def _line(handle: str, start: tuple, end: tuple, layer: str = "A-WIND") -> dict:
    return {
        "type": "line",
        "handle": handle,
        "object_name": "AcDbLine",
        "layer": layer,
        "start": start,
        "end": end,
        "length": ((end[0] - start[0]) ** 2 + (end[1] - start[1]) ** 2) ** 0.5,
    }


class TestBuildCandidate:
    def test_empty_cluster_returns_none(self) -> None:
        assert build_candidate([]) is None

    def test_cluster_with_only_blocks_returns_none(self) -> None:
        block = {"type": "block", "handle": "H1", "object_name": "AcDbBlockReference",
                  "layer": "A-WIND", "position": (0.0, 0.0), "block_name": "D900"}
        assert build_candidate([block]) is None

    def test_single_line_cluster_builds_candidate(self) -> None:
        cluster = [_line("H1", (0.0, 0.0), (1000.0, 0.0))]
        candidate = build_candidate(cluster)
        assert isinstance(candidate, OpeningCandidate)
        assert candidate.handle == "H1"
        assert candidate.layer == "A-WIND"
        assert len(candidate.lines) == 1

    def test_representative_handle_is_lexicographically_lowest(self) -> None:
        cluster = [_line("H9", (0.0, 0.0), (100.0, 0.0)), _line("H1", (0.0, 0.0), (0.0, 100.0))]
        candidate = build_candidate(cluster)
        assert candidate.handle == "H1"


class TestComputeBbox:
    def test_single_line_bbox(self) -> None:
        cluster = [_line("H1", (0.0, 0.0), (1000.0, 500.0))]
        assert compute_bbox(cluster) == (0.0, 0.0, 1000.0, 500.0)

    def test_empty_cluster_bbox_is_zero(self) -> None:
        assert compute_bbox([]) == (0.0, 0.0, 0.0, 0.0)


class TestAspectRatio:
    def test_square_bbox_is_one(self) -> None:
        assert aspect_ratio((0.0, 0.0, 100.0, 100.0)) == 1.0

    def test_degenerate_bbox_is_zero(self) -> None:
        assert aspect_ratio((0.0, 0.0, 100.0, 0.0)) == 0.0
```

- [ ] **Step 3: Run test to verify it fails**

Run: `python -m pytest tests/test_opening_candidate_builder.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.semantic.opening_candidate'`

- [ ] **Step 4: Write `opening_candidate.py`**

```python
"""Standalone OpeningCandidate construction -- promoted from
OpeningSymbolDetector's private _build_candidate/_compute_bbox/_aspect_ratio (verified
stateless: they only called their own @staticmethod helpers, no instance state).

Promoted so both OpeningSymbolDetector (Pass-1 detection) and OpeningSymbolPipeline
(Pass-2 candidate re-merge) can build an OpeningCandidate from raw entity dicts without
either depending on the other -- see
docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md, Section 3.
"""

from __future__ import annotations

from cad_intelligence.semantic.geometry_signature import (
    GeometrySignature,
    GeometrySummary,
    compute_geometry_hash,
)
from cad_intelligence.semantic.opening_detector import OpeningCandidate

__all__ = [
    "aspect_ratio",
    "build_candidate",
    "compute_bbox",
]


def build_candidate(cluster: list[dict]) -> OpeningCandidate | None:
    """Cluster of raw entity dicts -> OpeningCandidate, or None for an empty/
    block-only cluster."""
    lines = tuple(e for e in cluster if e["type"] == "line")
    arcs = tuple(e for e in cluster if e["type"] == "arc")
    polys = tuple(e for e in cluster if e["type"] == "polyline")
    blocks = [e for e in cluster if e["type"] == "block"]

    if not lines and not arcs and not polys:
        return None

    # Representative handle (lexicographically-lowest).
    all_handles = [e["handle"] for e in cluster if e.get("handle")]
    handle = min(all_handles) if all_handles else ""

    # Layer (from the first entity).
    layer = cluster[0].get("layer", "") if cluster else ""

    bbox = compute_bbox(cluster)

    entity_ids = tuple(sorted(all_handles))
    entity_types = tuple(sorted(set(e["object_name"] for e in cluster)))
    sig = GeometrySignature(
        content_hash=compute_geometry_hash(entity_ids, entity_types, bbox),
        entity_ids=entity_ids,
        entity_types=entity_types,
    )
    summary = GeometrySummary(
        line_count=len(lines),
        arc_count=len(arcs),
        polyline_count=len(polys),
        block_count=len(blocks),
        bbox=bbox,
        aspect_ratio=aspect_ratio(bbox),
    )

    block_name = blocks[0].get("block_name") if blocks else None

    return OpeningCandidate(
        handle=handle,
        layer=layer,
        bbox=bbox,
        lines=lines,
        arcs=arcs,
        closed_polylines=polys,
        block_name=block_name,
        signature=sig,
        summary=summary,
    )


def compute_bbox(cluster: list[dict]) -> tuple[float, float, float, float]:
    """Compute the overall bounding box of a cluster."""
    xs: list[float] = []
    ys: list[float] = []
    for e in cluster:
        if e["type"] == "line":
            xs += [e["start"][0], e["end"][0]]
            ys += [e["start"][1], e["end"][1]]
        elif e["type"] == "arc":
            r = e["radius"]
            cx, cy = e["center"]
            xs += [cx - r, cx + r]
            ys += [cy - r, cy + r]
        elif e["type"] == "polyline":
            coords = e["coordinates"]
            xs += coords[0::2]
            ys += coords[1::2]
        elif e["type"] == "block":
            pos = e["position"]
            xs.append(pos[0])
            ys.append(pos[1])
    if not xs:
        return (0.0, 0.0, 0.0, 0.0)
    return (min(xs), min(ys), max(xs), max(ys))


def aspect_ratio(bbox: tuple[float, float, float, float]) -> float:
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    if w <= 0 or h <= 0:
        return 0.0
    return max(w, h) / min(w, h)
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `python -m pytest tests/test_opening_candidate_builder.py -v`
Expected: PASS (8 tests)

- [ ] **Step 6: Update `opening_detector.py` to call the new function**

In `src/cad_intelligence/semantic/opening_detector.py`:
- Delete `_build_candidate` (lines 260-309), `_compute_bbox` (lines 311-335), and
  `_aspect_ratio` (lines 337-343).
- Add an import: `from cad_intelligence.semantic.opening_candidate import build_candidate`
  (place it near the top with the other `cad_intelligence.semantic` imports; note this
  creates `opening_detector.py` -> `opening_candidate.py` -> `opening_detector.py` (for
  `OpeningCandidate`) -- this is NOT circular in the problematic sense, since
  `opening_candidate.py` only imports the `OpeningCandidate` dataclass, and
  `opening_detector.py` imports the `build_candidate` function; Python resolves this fine
  as long as `opening_candidate.py` doesn't import anything from `opening_detector.py`
  that isn't fully defined by the time `opening_candidate.py` is loaded -- since
  `OpeningCandidate` is defined before `OpeningSymbolDetector.detect()` calls
  `build_candidate` at runtime (not at import time), this works. If you hit a
  `circular import` error, move `OpeningCandidate` itself into `opening_candidate.py`
  instead and have `opening_detector.py` import it from there -- flag this deviation in
  your task report if you take that path, since it changes the File Map's stated split.)
- Change `detect()`'s line `candidate = self._build_candidate(cluster)` to
  `candidate = build_candidate(cluster)`.

- [ ] **Step 7: Run the full two-pass suite to confirm zero behavior change**

Run: `python -m pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: PASS, same count as Step 1's baseline.

- [ ] **Step 8: Commit**

```bash
git add src/cad_intelligence/semantic/opening_candidate.py src/cad_intelligence/semantic/opening_detector.py tests/test_opening_candidate_builder.py
git commit -m "refactor(semantic): promote build_candidate() out of OpeningSymbolDetector"
```

---

## Task 5: `OpeningRecognizer` Protocol

**Files:**
- Create: `src/cad_intelligence/semantic/opening_recognizer.py`

- [ ] **Step 1: Write the file**

```python
"""OpeningRecognizer -- the SPI OpeningSymbolPipeline depends on exclusively.

See docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md for the full
rationale (why two methods, not one; why Pass-2 merge-eligibility geometry stays in the
pipeline while reclassification routes through this SPI).
"""

from __future__ import annotations

from typing import Any, Protocol

from cad_intelligence.semantic.opening_detector import OpeningCandidate
from cad_intelligence.semantic.opening_pipeline import OpeningPipelineResult

__all__ = ["OpeningRecognizer"]


class OpeningRecognizer(Protocol):
    def recognize(
        self,
        scan_result: Any,
        search_layers: set[str] | None = None,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> list[OpeningPipelineResult]:
        """Pass 1: detect and classify every candidate in a scan.

        Implementations decide their own internal composition -- this SPI makes no
        assumption about internal workflow shape, only about this input/output
        contract.
        """
        ...

    def reclassify(
        self,
        candidate: OpeningCandidate,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> OpeningPipelineResult:
        """Pass 2: classify one already-built candidate (e.g. a freshly merged one).

        Implementations may share internal logic between recognize() and
        reclassify() -- WindowRecognizer does -- but the SPI treats them as two
        operations because "scan a drawing" and "classify one candidate" are
        genuinely different inputs.
        """
        ...
```

**Note on the import from `opening_pipeline.py`:** `OpeningPipelineResult` currently lives
in `opening_pipeline.py`. As written, this task creates a one-directional
`opening_recognizer.py` -> `opening_pipeline.py` import, which imports and runs fine in
isolation at this point -- `opening_pipeline.py` has no dependency on `opening_recognizer.py`
yet. The cycle only becomes real once Task 7 adds the reverse import
(`opening_pipeline.py` -> `opening_recognizer.py`, for the `OpeningRecognizer` type hint on
its constructor parameter). **You don't need to work around anything in this task** — just
be aware that Task 7 resolves the eventual cycle by moving `OpeningPipelineResult` into
`opening_recognizer.py` (it's conceptually a Recognizer output type, not a
Pipeline-internal type) and having `opening_pipeline.py` import it from there instead. If
you want to smoke-test this file's imports in isolation before Task 7, that will work fine
right now; it's only after Task 7 begins that the import statement in this file becomes
stale and needs the Task 7 fix.

- [ ] **Step 2: Commit** (file created but not yet validated against the circular-import
  concern above -- that's resolved in Task 7)

```bash
git add src/cad_intelligence/semantic/opening_recognizer.py
git commit -m "feat(semantic): add OpeningRecognizer Protocol (recognize + reclassify)"
```

---

## Task 6: `WindowRecognizer`

**Files:**
- Create: `src/cad_intelligence/semantic/window_recognizer.py`
- Test: `tests/test_window_recognizer.py`

Read the CURRENT `opening_pipeline.py` in full before starting this task (it has not yet
been modified by this plan) — you are moving `run()`'s detection call and
`_classify_once()`'s body into this new class, unchanged in behavior.

- [ ] **Step 1: Write the failing test**

```python
"""Tests for WindowRecognizer -- the first OpeningRecognizer implementation."""

from __future__ import annotations

from cad_intelligence.semantic.opening_candidate import build_candidate
from cad_intelligence.semantic.window_recognizer import WindowRecognizer


def _scan_from_lines(lines: list[tuple]) -> object:
    """Minimal fake scan_result exposing entries_by_layer, mirroring the shape
    OpeningSymbolDetector._collect_entities expects."""
    class _Entry:
        def __init__(self, handle, start, end):
            self.object_name = "AcDbLine"
            self.handle = handle
            self.layer = "A-WIND"
            self.start = start
            self.end = end
            self.length = ((end[0]-start[0])**2 + (end[1]-start[1])**2) ** 0.5

    class _Scan:
        def __init__(self, entries):
            self.entries_by_layer = {"A-WIND": entries}

    return _Scan([_Entry(f"H{i}", s, e) for i, (s, e) in enumerate(lines)])


class TestWindowRecognizerRecognize:
    def test_empty_scan_returns_empty_list(self) -> None:
        recognizer = WindowRecognizer()
        scan = _scan_from_lines([])
        assert recognizer.recognize(scan, search_layers={"A-WIND"}) == []

    def test_detects_and_classifies_a_candidate(self) -> None:
        recognizer = WindowRecognizer()
        scan = _scan_from_lines([((0.0, 0.0), (1000.0, 0.0))])
        results = recognizer.recognize(scan, search_layers={"A-WIND"})
        assert len(results) == 1
        assert results[0].candidate is not None
        assert 0.0 <= results[0].final_confidence <= 1.0

    def test_confidence_params_are_forwarded(self) -> None:
        recognizer = WindowRecognizer()
        scan = _scan_from_lines([((0.0, 0.0), (1000.0, 0.0))])
        results = recognizer.recognize(
            scan, search_layers={"A-WIND"},
            layer_confidence=0.5, block_confidence=0.2, geometry_quality=0.3,
        )
        assert len(results) == 1


class TestWindowRecognizerReclassify:
    def test_reclassify_a_built_candidate(self) -> None:
        recognizer = WindowRecognizer()
        cluster = [{
            "type": "line", "handle": "H1", "object_name": "AcDbLine",
            "layer": "A-WIND", "start": (0.0, 0.0), "end": (1000.0, 0.0), "length": 1000.0,
        }]
        candidate = build_candidate(cluster)
        result = recognizer.reclassify(candidate)
        assert result.candidate is candidate
        assert 0.0 <= result.final_confidence <= 1.0

    def test_reclassify_matches_recognize_for_same_candidate(self) -> None:
        """recognize()'s per-candidate classification and reclassify() on the same
        candidate must agree -- they share the same underlying evaluation."""
        recognizer = WindowRecognizer()
        scan = _scan_from_lines([((0.0, 0.0), (1000.0, 0.0))])
        recognize_result = recognizer.recognize(scan, search_layers={"A-WIND"})[0]
        reclassify_result = recognizer.reclassify(recognize_result.candidate)
        assert recognize_result.classification.matches == reclassify_result.classification.matches
        assert recognize_result.final_confidence == reclassify_result.final_confidence
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_window_recognizer.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'cad_intelligence.semantic.window_recognizer'`

- [ ] **Step 3: Write the implementation**

Read `opening_pipeline.py`'s current `run()` (lines 257-301) and `_classify_once()`
(lines 303-337) side by side with this — the body below is those two methods' logic,
combined and relocated, not rewritten.

```python
"""WindowRecognizer -- the first OpeningRecognizer implementation.

Composes OpeningSymbolDetector -> OpeningEvidenceExtractor -> OpeningFeatureExtractor ->
WindowClassifier -> ConfidenceFuser internally. This composition is WindowRecognizer's
own concern -- OpeningSymbolPipeline never sees any of these types.
"""

from __future__ import annotations

from typing import Any

from cad_intelligence.semantic.confidence_fuser import ConfidenceFuser, ConfidenceInputs
from cad_intelligence.semantic.opening_detector import OpeningCandidate, OpeningSymbolDetector
from cad_intelligence.semantic.opening_features import OpeningFeatureExtractor
from cad_intelligence.semantic.opening_recognizer import OpeningPipelineResult
from cad_intelligence.semantic.opening_symbol_evidence import OpeningEvidenceExtractor
from cad_intelligence.semantic.window_classifier import WindowClassifier

__all__ = ["WindowRecognizer"]


class WindowRecognizer:
    """OpeningRecognizer implementation for windows.

    Usage::

        recognizer = WindowRecognizer()
        results = recognizer.recognize(scan_result, search_layers={"A-WIND"})
    """

    def __init__(
        self,
        classifier: WindowClassifier | None = None,
        fuser: ConfidenceFuser | None = None,
        detector: OpeningSymbolDetector | None = None,
    ) -> None:
        self._classifier = classifier or WindowClassifier()
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
        on a single OpeningCandidate."""
        evidence = self._evidence_extractor.extract(candidate)
        features = self._feature_extractor.extract(evidence, candidate)
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
```

Note this imports `OpeningPipelineResult` from `opening_recognizer.py`, not
`opening_pipeline.py` — this assumes Task 7's move of that dataclass has already happened.
**If you are executing tasks strictly in order, this import will fail until Task 7 runs.**
Either do Task 7's `OpeningPipelineResult` relocation first (out of numeric order, but
resolves the dependency cleanly), or write this file with a `# TODO(Task 7): fix import`
comment and defer running its tests until Task 7 completes. Report which approach you took.

- [ ] **Step 4: Expose a `.detector` accessor for the merge-candidate case (deferred to
  Task 7 -- do not implement in this task)**: skip -- resolved by Task 4/7's `build_candidate()`
  promotion, `OpeningSymbolPipeline` no longer needs any recognizer-internal accessor.

- [ ] **Step 5: Run test to verify it passes** (after Task 7's `OpeningPipelineResult`
  relocation)

Run: `python -m pytest tests/test_window_recognizer.py -v`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/semantic/window_recognizer.py tests/test_window_recognizer.py
git commit -m "feat(semantic): add WindowRecognizer (OpeningRecognizer implementation)"
```

---

## Task 7: Rewrite `OpeningSymbolPipeline`

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_pipeline.py`
- Modify: `src/cad_intelligence/semantic/opening_recognizer.py` (resolve the circular
  import flagged in Task 5)

This is the task that resolves Task 5's flagged circular-import concern and completes the
architectural change: the pipeline depends on `OpeningRecognizer` alone.

- [ ] **Step 1: Run the existing two-pass test suite to record the baseline**

Run: `python -m pytest tests/test_opening_pipeline_two_pass.py -v`
Expected: current PASS count (will FAIL after Step 2 until Task 8 fixes call sites —
expected, addressed next).

- [ ] **Step 2: Move `OpeningPipelineResult` into `opening_recognizer.py`**

In `src/cad_intelligence/semantic/opening_recognizer.py`, remove the
`from cad_intelligence.semantic.opening_pipeline import OpeningPipelineResult` import and
instead define `OpeningPipelineResult` directly in this file:

```python
"""OpeningRecognizer -- the SPI OpeningSymbolPipeline depends on exclusively.

See docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md for the full
rationale (why two methods, not one; why Pass-2 merge-eligibility geometry stays in the
pipeline while reclassification routes through this SPI).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from cad_intelligence.semantic.opening_detector import OpeningCandidate
from cad_intelligence.semantic.opening_features import OpeningFeatures
from cad_intelligence.semantic.style_classifier_base import Classification
from cad_intelligence.semantic.opening_symbol_evidence import OpeningEvidence

__all__ = ["OpeningPipelineResult", "OpeningRecognizer"]


@dataclass(frozen=True)
class OpeningPipelineResult:
    """One recognizer output, preserving every stage's product (explainable).

    Attributes
    ----------
    candidate:
        The OpeningCandidate this result classifies.
    evidence:
        Evidence-extraction output.
    features:
        Feature-extraction output.
    classification:
        Classification result (multiple StyleMatch entries).
    final_confidence:
        ConfidenceFuser output (0-1).
    """

    candidate: OpeningCandidate
    evidence: OpeningEvidence
    features: OpeningFeatures
    classification: Classification[Any]
    final_confidence: float


class OpeningRecognizer(Protocol):
    def recognize(
        self,
        scan_result: Any,
        search_layers: set[str] | None = None,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> list[OpeningPipelineResult]:
        """Pass 1: detect and classify every candidate in a scan.

        Implementations decide their own internal composition -- this SPI makes no
        assumption about internal workflow shape, only about this input/output
        contract.
        """
        ...

    def reclassify(
        self,
        candidate: OpeningCandidate,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> OpeningPipelineResult:
        """Pass 2: classify one already-built candidate (e.g. a freshly merged one).

        Implementations may share internal logic between recognize() and
        reclassify() -- WindowRecognizer does -- but the SPI treats them as two
        operations because "scan a drawing" and "classify one candidate" are
        genuinely different inputs.
        """
        ...
```

- [ ] **Step 3: Rewrite `opening_pipeline.py`**

Read the current file's two-pass merge helpers (`_candidate_points`, `_centroid`,
`_entity_count`, `_principal_axis`, `_point_to_bbox_distance`, `_standard_eligible`,
`_sparse_eligible`, `_merge_eligible`, and the module-level constants
`_SUBCLUSTER_COMPLETE_CONFIDENCE`/`_MERGE_RADIUS_MM`/`_MERGE_COLLINEARITY_DEG`/
`_MERGE_TOUCH_TOLERANCE_MM`) — these are ALL UNCHANGED, copy them verbatim. Only the
`OpeningPipelineResult` dataclass (removed — now imported from `opening_recognizer.py`)
and the `OpeningSymbolPipeline` class itself change.

Replace the file's import block (top of file) and the `OpeningSymbolPipeline` class with:

```python
"""OpeningSymbolPipeline -- Pass-2 confidence-guided two-pass merge orchestrator.

Depends only on OpeningRecognizer (see opening_recognizer.py) -- never on
OpeningSymbolDetector, WindowClassifier, or any other concrete recognition-stage type.
Pass 1 (candidate detection + classification) is entirely the recognizer's job via
recognize(). Pass 2 (confidence-guided merge-eligibility geometry, unchanged from before
this refactor) stays here as genuinely shared, recognizer-agnostic infrastructure; the
one place Pass 2 needs to classify something (a freshly merged candidate) is delegated to
recognizer.reclassify() rather than orchestrated directly.

See docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md.
"""

from __future__ import annotations

import math
from typing import Any

from cad_intelligence.semantic.opening_candidate import build_candidate
from cad_intelligence.semantic.opening_detector import OpeningCandidate
from cad_intelligence.semantic.opening_recognizer import (
    OpeningPipelineResult,
    OpeningRecognizer,
)

# ---------------------------------------------------------------------------
# Two-pass clustering constants (see spec:
# docs/superpowers/specs/2026-08-05-confidence-guided-two-pass-clustering-design.md).
# All five values were confirmed against 4 synthetic + 5 golden fixtures in the
# Pre-Implementation Verification Gate (2026-08-05). Do not re-tune blindly.
# ---------------------------------------------------------------------------
_SUBCLUSTER_COMPLETE_CONFIDENCE: float = 0.4   # < this -> eligible for Pass-2 re-merge
_MERGE_RADIUS_MM: float = 500.0                # Pass-2 outer centroid distance (standard rule)
_MERGE_COLLINEARITY_DEG: float = 15.0          # Pass-2 axis/centroid-direction agreement
_MERGE_TOUCH_TOLERANCE_MM: float = 75.0        # Pass-2 point-to-bbox touch (sparse rule)


# ---------------------------------------------------------------------------
# Two-pass geometry helpers (pure functions over OpeningCandidate) -- UNCHANGED,
# copy verbatim from the current file's _candidate_points/_centroid/_entity_count/
# _principal_axis/_point_to_bbox_distance/_standard_eligible/_sparse_eligible/
# _merge_eligible (currently lines 59-171).
# ---------------------------------------------------------------------------

# ... (paste unchanged) ...


__all__ = [
    "OpeningPipelineResult",
    "OpeningSymbolPipeline",
    "_SUBCLUSTER_COMPLETE_CONFIDENCE",
    "_MERGE_RADIUS_MM",
    "_MERGE_COLLINEARITY_DEG",
    "_MERGE_TOUCH_TOLERANCE_MM",
    "_candidate_points",
    "_centroid",
    "_entity_count",
    "_principal_axis",
    "_point_to_bbox_distance",
    "_standard_eligible",
    "_sparse_eligible",
    "_merge_eligible",
]


class OpeningSymbolPipeline:
    """Pass-2 orchestrator over an injected OpeningRecognizer.

    Usage::

        from cad_intelligence.semantic.window_recognizer import WindowRecognizer
        pipeline = OpeningSymbolPipeline(recognizer=WindowRecognizer())
        results = pipeline.run(scan_result, search_layers={"A-WIND", "sleeve"})

    ``recognizer`` must implement OpeningRecognizer (e.g. WindowRecognizer,
    DoorRecognizer) -- there is no default, since this orchestrator is
    opening-type agnostic and has no basis for picking one type over another.
    """

    def __init__(self, recognizer: OpeningRecognizer) -> None:
        self._recognizer = recognizer

    def run(
        self,
        scan_result: Any,
        search_layers: set[str] | None = None,
        *,
        layer_confidence: float = 1.0,
        block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> list[OpeningPipelineResult]:
        """Run recognition (Pass 1) then confidence-guided two-pass merge (Pass 2).

        Returns
        -------
        list[OpeningPipelineResult]
            One result per final candidate (post-merge; includes candidates with no
            classification matches).
        """
        per_candidate_results = self._recognizer.recognize(
            scan_result, search_layers,
            layer_confidence=layer_confidence,
            block_confidence=block_confidence,
            geometry_quality=geometry_quality,
        )
        if not per_candidate_results:
            return []

        return self._two_pass_merge(
            per_candidate_results, layer_confidence, block_confidence, geometry_quality
        )

    def _merge_candidates(self, parts: list[OpeningCandidate]) -> OpeningCandidate:
        """Combine several Pass-1 sub-clusters into one candidate (Pass-2 batch merge).

        Calls the standalone build_candidate() -- no recognizer/detector instance
        needed.
        """
        entities: list[dict] = []
        for c in parts:
            entities.extend(c.lines)
            entities.extend(c.arcs)
            entities.extend(c.closed_polylines)
        return build_candidate(entities)

    def _two_pass_merge(
        self,
        per_candidate_results: list[OpeningPipelineResult],
        layer_confidence: float,
        block_confidence: float,
        geometry_quality: float,
    ) -> list[OpeningPipelineResult]:
        """Pass 2: build a merge-eligibility graph over incomplete sub-clusters, take
        connected components (order-independent batch merge -- NOT pairwise greedy),
        reclassify each multi-member component's merged geometry via
        recognizer.reclassify(), and roll the merge back only when it would make
        confidence worse than the best original (a tie or improvement accepts the
        merge).

        Complete sub-clusters (final_confidence >= _SUBCLUSTER_COMPLETE_CONFIDENCE)
        are never merge-graph nodes -- they pass through unchanged regardless of
        proximity to a neighbor.
        """
        per_candidate = [(r.candidate, r) for r in per_candidate_results]
        n = len(per_candidate)
        complete = {i for i, (_, r) in enumerate(per_candidate)
                    if r.final_confidence >= _SUBCLUSTER_COMPLETE_CONFIDENCE}
        incomplete = [i for i in range(n) if i not in complete]

        parent = list(range(n))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: int, b: int) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb

        for ii in range(len(incomplete)):
            for jj in range(ii + 1, len(incomplete)):
                a, b = incomplete[ii], incomplete[jj]
                if _merge_eligible(per_candidate[a][0], per_candidate[b][0]):
                    union(a, b)

        components: dict[int, list[int]] = {}
        for i in incomplete:
            components.setdefault(find(i), []).append(i)

        results: list[OpeningPipelineResult] = []
        for i in sorted(complete):
            results.append(per_candidate[i][1])

        for members in components.values():
            if len(members) == 1:
                results.append(per_candidate[members[0]][1])
                continue
            merged_cand = self._merge_candidates([per_candidate[m][0] for m in members])
            merged_result = self._recognizer.reclassify(
                merged_cand,
                layer_confidence=layer_confidence,
                block_confidence=block_confidence,
                geometry_quality=geometry_quality,
            )
            best_original = max(per_candidate[m][1].final_confidence for m in members)
            if merged_result.final_confidence >= best_original:
                results.append(merged_result)
            else:
                for m in members:
                    results.append(per_candidate[m][1])
        return results
```

**Key changes to note while doing this:**
- `_two_pass_merge`'s signature changed from taking
  `per_candidate: list[tuple[OpeningCandidate, OpeningPipelineResult]]` to taking
  `per_candidate_results: list[OpeningPipelineResult]` directly (the candidate is already
  on `.candidate`) — the first line of the new body reconstructs the old tuple-pair shape
  internally (`per_candidate = [(r.candidate, r) for r in per_candidate_results]`) purely
  to keep the rest of the merge-graph logic identical to before, minimizing risk. This is
  a signature simplification at the call boundary, not a change to the merge algorithm.
- `self._classify_once(merged_cand, ...)` is replaced with
  `self._recognizer.reclassify(merged_cand, layer_confidence=..., block_confidence=...,
  geometry_quality=...)`.
- No `self._fuser`, `self._classifier`, `self._detector`, `self._evidence_extractor`,
  `self._feature_extractor` fields exist anymore — verify none are referenced anywhere
  else in your rewritten file.

- [ ] **Step 4: Run a syntax/import smoke check**

Run: `python -c "from cad_intelligence.semantic.opening_pipeline import OpeningSymbolPipeline; from cad_intelligence.semantic.opening_recognizer import OpeningRecognizer, OpeningPipelineResult; from cad_intelligence.semantic.window_recognizer import WindowRecognizer; print('ok')"`
Expected: `ok` — this also confirms Task 6's deferred import now resolves.

- [ ] **Step 5: Run Task 6's `WindowRecognizer` test (deferred from Task 6 Step 5)**

Run: `python -m pytest tests/test_window_recognizer.py -v`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/semantic/opening_pipeline.py src/cad_intelligence/semantic/opening_recognizer.py
git commit -m "refactor(semantic): OpeningSymbolPipeline depends only on OpeningRecognizer"
```

---

## Task 8: Update the 4 call sites that instantiate `OpeningSymbolPipeline()`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py:2302`
- Modify: `tests/test_opening_pipeline_two_pass.py` (lines 250, 262, 409 as of this
  writing)

- [ ] **Step 1: Confirm the call sites (re-verify before editing)**

Run: `grep -rn "OpeningSymbolPipeline(" src/ tests/`
If the count or locations differ from what's below, stop and re-scope this task rather
than guessing:
```
src/cad_intelligence/cad_io/handlers/space.py:2302:    pipeline_results = OpeningSymbolPipeline().run(
tests/test_opening_pipeline_two_pass.py:250:        merged = OpeningSymbolPipeline()._merge_candidates([a, b])
tests/test_opening_pipeline_two_pass.py:262:        return OpeningSymbolPipeline().run(scan, search_layers={"A-WIND"})
tests/test_opening_pipeline_two_pass.py:409:        results = OpeningSymbolPipeline().run(_scan_from_geometry(geom),
```

- [ ] **Step 2: Fix `handlers/space.py:2302`**

`OpeningSymbolPipeline` is imported at module level (line 68 as of this writing:
`from cad_intelligence.semantic.opening_pipeline import OpeningSymbolPipeline`) —
`WindowRecognizer` is not imported anywhere in this file. Add it as a new module-level
import alongside line 68:

```python
from cad_intelligence.semantic.window_recognizer import WindowRecognizer
```

Then change line 2302 from:

```python
pipeline_results = OpeningSymbolPipeline().run(
```

to:

```python
pipeline_results = OpeningSymbolPipeline(recognizer=WindowRecognizer()).run(
```

- [ ] **Step 3: Fix the 3 call sites in `tests/test_opening_pipeline_two_pass.py`**

Add near the top of the file (with the other imports):

```python
from cad_intelligence.semantic.window_recognizer import WindowRecognizer
```

Change all 3 occurrences of `OpeningSymbolPipeline()` to
`OpeningSymbolPipeline(recognizer=WindowRecognizer())`. The `_merge_candidates` call at
line 250 (`OpeningSymbolPipeline()._merge_candidates([a, b])`) also needs a recognizer
argument now — `_merge_candidates` itself doesn't use `self._recognizer` (it only calls
`build_candidate`), but the constructor requires one regardless, so pass
`WindowRecognizer()` there too for consistency; this is a mechanical constructor-argument
fix, no assertion logic changes.

- [ ] **Step 4: Run the full window/pipeline regression suite**

Run:
```bash
python -m pytest tests/test_window_classifier.py tests/test_window_pipeline.py tests/test_opening_pipeline_two_pass.py tests/test_rule_evaluator.py tests/test_style_classifier_base.py tests/test_opening_candidate_builder.py tests/test_window_recognizer.py tests/handlers/test_extract_cad_objects_window_pipeline_v3.py -v
```
Expected: PASS, with `test_window_classifier.py`/`test_window_pipeline.py`/
`test_opening_pipeline_two_pass.py` matching their pre-refactor baselines exactly (counts
recorded in Tasks 1, 3, 4, 7).

- [ ] **Step 5: Run the broader affected-module suite**

Run: `python -m pytest tests/ -k "window or opening" -q`
Expected: PASS, no failures.

- [ ] **Step 6: Commit**

```bash
git add src/cad_intelligence/cad_io/handlers/space.py tests/test_opening_pipeline_two_pass.py
git commit -m "refactor(cad_io,tests): pass WindowRecognizer explicitly to OpeningSymbolPipeline"
```

---

## Task 9: Boundary test + full-suite regression verification

**Files:**
- Create: `tests/test_opening_pipeline_boundary.py`

- [ ] **Step 1: Write and run the boundary test**

```python
"""Boundary test: OpeningSymbolPipeline must depend only on OpeningRecognizer, never
on a concrete recognition-stage type. Cheap regression guard against the coupling
docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md removed creeping
back in."""

from __future__ import annotations

import ast
from pathlib import Path


def test_opening_pipeline_has_no_concrete_stage_imports() -> None:
    source = Path(
        "src/cad_intelligence/semantic/opening_pipeline.py"
    ).read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            for alias in node.names:
                imported_names.add(alias.name)
        elif isinstance(node, ast.Import):
            # Defense-in-depth: `from X import Y` is this file's only style today,
            # but also catch a future `import X` that would slip past the check above.
            for alias in node.names:
                imported_names.add(alias.name)
                imported_names.add(alias.name.rsplit(".", 1)[-1])

    forbidden = {
        "OpeningSymbolDetector",
        "WindowClassifier",
        "OpeningEvidenceExtractor",
        "OpeningFeatureExtractor",
        "ConfidenceFuser",
    }
    leaked = imported_names & forbidden
    assert not leaked, f"opening_pipeline.py imports concrete stage types: {leaked}"
```

Run: `python -m pytest tests/test_opening_pipeline_boundary.py -v`
Expected: PASS (1 test)

- [ ] **Step 2: Run the full test suite**

Run: `python -m pytest tests/ -q`
Expected: same pass/skip/xfail counts as the pre-PR1 baseline. If you don't have that
number recorded, get the true baseline via `git stash && python -m pytest tests/ -q; git
stash pop` before trusting any number quoted elsewhere.

- [ ] **Step 3: Smoke-import every touched module**

Run:
```bash
python -c "
from cad_intelligence.semantic.rule_evaluator import RuleDomain, RuleEvaluator, YamlRuleEvaluator
from cad_intelligence.semantic.style_classifier_base import BaseStyleClassifier, Classification, StyleMatch, SimpleEvaluation
from cad_intelligence.semantic.window_classifier import WindowClassifier, WindowClassification, WindowStyle, WINDOW_STYLE_MAP
from cad_intelligence.semantic.opening_candidate import build_candidate, compute_bbox, aspect_ratio
from cad_intelligence.semantic.opening_detector import OpeningCandidate, OpeningSymbolDetector
from cad_intelligence.semantic.opening_recognizer import OpeningRecognizer, OpeningPipelineResult
from cad_intelligence.semantic.window_recognizer import WindowRecognizer
from cad_intelligence.semantic.opening_pipeline import OpeningSymbolPipeline
from cad_intelligence.cad_io.handlers import space
print('ok')
"
```
Expected: `ok`

- [ ] **Step 4: Run the workspace audit**

Run: `bun scripts/audit.ts`
Expected: exit 0, `✅ All checks passed.`

- [ ] **Step 5: Add a CHANGELOG entry**

Add to `CHANGELOG.md` under `[Unreleased]` -> `### Changed`:

```markdown
- **[<today's date>]**: PR 1 of the door recognition upgrade (Backlog #14,
  `docs/superpowers/specs/2026-08-06-opening-recognizer-spi-design.md`) — introduced an
  `OpeningRecognizer` SPI (`recognize()` + `reclassify()`) so `OpeningSymbolPipeline`
  depends only on that interface, never on `OpeningSymbolDetector`/`WindowClassifier`/etc.
  `WindowRecognizer` is the first implementation. `RuleEvaluator` (+ `RuleDomain` enum,
  `YamlRuleEvaluator`) separates rule-evaluation mechanism from the new generic
  `BaseStyleClassifier[TStyle]`. `OpeningSymbolDetector._build_candidate` promoted to a
  standalone `opening_candidate.build_candidate()` function so `OpeningSymbolPipeline`'s
  Pass-2 merge-eligibility geometry no longer needs a detector instance. Zero behavior
  change — full existing window test suite passes unchanged except one constructor-arg
  update in `tests/test_window_classifier.py`'s RuleEngine-mode fixture (`rule_engine=`
  wrapped in a `YamlRuleEvaluator`, not a behavior change). `handlers/space.py`'s
  production call site and 3 test call sites updated to pass `WindowRecognizer()`.
```

- [ ] **Step 6: Commit the CHANGELOG entry + boundary test**

```bash
git add CHANGELOG.md tests/test_opening_pipeline_boundary.py
git commit -m "docs(changelog): note PR1 of door recognition upgrade (OpeningRecognizer SPI)"
```

---

## Execution notes for the implementer

- **Do not touch anything door-specific.** No `DoorStyle`, no door YAML, no
  `DoorRecognizer` stub. That's PR 2, a separate plan.
- **Two tasks have flagged dependency-order subtleties** (Task 1/2's `style_classifier_base.py`-before-`rule_evaluator.py` test-running order, and Task 5/6/7's `OpeningPipelineResult` circular-import resolution). Both are called out explicitly at the point they matter — follow those notes rather than the numeric task order if they conflict.
- **If any baseline test count doesn't match its post-refactor count**, stop. Do not
  adjust assertions to make them pass — find and fix the actual behavior discrepancy.
  Task 3's one intentional test-content change (the `_make_engine_classifier` fixture
  fix) is the ONLY exception, and it's explicitly justified there.
- **Generic typing note:** `Classification[WindowStyle]`/`StyleMatch[WindowStyle]` use
  Python's built-in `Generic[TStyle]` — no new dependency introduced.

---

## Handoff

Once all 9 tasks are checked off and Task 9's full-suite run is green, this PR is ready
for `/sync`. PR title suggestion:
`refactor(semantic): introduce OpeningRecognizer SPI, decouple OpeningSymbolPipeline from concrete stages (door-recognition PR1)`.

The next plan (PR 2: `DoorStyle` + `DoorEntity` fields + 5 YAML patterns + `DoorClassifier`
+ `DoorRecognizer` + unit/golden tests) is written separately, after this PR merges, per
the Sequential Branch Dependency Rule (each PR merges before the next one's `/sync` runs).
