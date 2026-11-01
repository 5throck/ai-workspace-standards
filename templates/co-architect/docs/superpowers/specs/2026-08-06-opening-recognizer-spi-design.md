# OpeningRecognizer SPI Design (Door Recognition Upgrade — PR 1 Redesign)

> **Supersedes:** Component 2 (`BaseStyleClassifier` extraction) and Component 2a
> (`OpeningSymbolPipeline` genericization) of
> [`2026-08-06-door-recognition-upgrade-design.md`](2026-08-06-door-recognition-upgrade-design.md).
> That document's overall goal, taxonomy, and PR 2-4 scope are unchanged — only PR 1's
> internal architecture is redesigned here, based on an architecture review that found the
> original plan (a shared generic base class the pipeline constructs directly) violated
> the Dependency Inversion Principle and would not scale cleanly to future non-YAML
> classifiers (LLM/ML) or a `DoorRecognizer` with a different internal composition than
> `WindowRecognizer`.

## 1. Motivation

The original PR 1 plan extracted `BaseStyleClassifier[TStyle]` from `WindowClassifier` and
had `OpeningSymbolPipeline` take a `classifier: BaseStyleClassifier[Any]` directly. Three
problems surfaced under review:

1. **The pipeline still hardcodes a workflow shape.** Even after genericizing the
   classifier argument, `OpeningSymbolPipeline` still directly orchestrates this fixed
   sequence in two places: `run()` calls `self._detector.detect(...)` directly, and
   `_classify_once()` (called both from `run()` for each freshly detected candidate, and
   again from `_two_pass_merge()` to re-classify a merged candidate) directly chains
   `OpeningEvidenceExtractor` → `OpeningFeatureExtractor` → classifier → `ConfidenceFuser`.
   A future `DoorRecognizer` that needs a different internal composition (e.g. no separate
   feature-extraction stage, or an ML model that skips explicit evidence extraction) would
   require changing the pipeline itself, not just swapping a classifier.
2. **The rule-evaluation mechanism is baked into the classifier.** `BaseStyleClassifier`
   was to hold a raw rule engine reference directly. Introducing a future non-YAML
   classification mechanism (LLM-based, ML-model-based) would require either subclassing
   `BaseStyleClassifier` awkwardly or bypassing it — the classifier and its evaluation
   mechanism were not separately substitutable.
3. **String-based domain dispatch invites typos.** `_domain()`/`_object_id()` returned
   plain strings (`"window_detection"`), with no compile-time check that a subclass
   returns a value the rule registry actually recognizes.

**Goal of this redesign:** introduce a narrow `OpeningRecognizer` SPI so
`OpeningSymbolPipeline` depends only on that interface — never on `WindowClassifier`,
`OpeningSymbolDetector`, or any other concrete stage type. Recognizer implementations
(`WindowRecognizer` today, `DoorRecognizer` in PR 2+) are free to compose their internal
stages however they need, without ever touching the pipeline. Separately, classification's
rule-evaluation mechanism is abstracted behind a `RuleEvaluator` interface so a future
LLM/ML evaluator can be added without changing `BaseStyleClassifier` or the SPI.

**Non-goal:** this document does not redesign or touch anything door-specific
(`DoorStyle`, `DoorClassifier`, YAML patterns, `DoorEntity`, rendering) — that is still
`2026-08-06-door-recognition-upgrade-design.md`'s Components 1, 3-6, unchanged. This
document only redesigns Components 2/2a (PR 1) of that plan.

## 2. Architecture

```
OpeningSymbolPipeline
    run(scan_result, search_layers, **confidence_params):
        per_candidate_results = self._recognizer.recognize(scan_result, search_layers, **confidence_params)
        return self._two_pass_merge(per_candidate_results, **confidence_params)
        |
        v  (self._recognizer: OpeningRecognizer -- pipeline knows nothing else about it)
OpeningRecognizer (Protocol)
    recognize(scan_result, search_layers, **confidence_params) -> list[OpeningPipelineResult]
        |
        +-- WindowRecognizer (implementation)   -- e.g. composes a detector, evidence
        |                                           extraction, feature extraction, a
        |                                           classifier, and confidence fusion
        |                                           internally; exact composition is this
        |                                           class's own concern, not the SPI's
        `-- DoorRecognizer (PR 2+, implementation) -- free to compose its own stages
```

**Responsibility split** (this is the core decision from the review discussion):

- **`OpeningRecognizer.recognize()` (Pass 1)**: candidate generation and per-candidate
  classification. Returns one `OpeningPipelineResult` per detected candidate, each
  carrying its own `OpeningCandidate` (existing field, unchanged).
- **`OpeningSymbolPipeline` (Pass 2)**: confidence-guided two-pass re-merge across
  candidates. The **eligibility geometry** (`_standard_eligible`/`_sparse_eligible`/
  `_merge_eligible` and their helpers — centroid distance, PCA-axis collinearity,
  touch-distance) is genuinely common, pure-function orchestration with no window- or
  door-specific logic, and stays in the pipeline unchanged. The **reclassification** of a
  merged candidate, however, is a second recognition operation, not geometry — see below,
  this is why the SPI has two methods, not one.

**Why the SPI has two methods, not one.** An earlier draft of this design claimed a single
`recognize()` method was sufficient and that Pass 2 was entirely pipeline-owned, generic
infrastructure. That claim doesn't survive contact with the current code: `_two_pass_merge`
doesn't just decide *which* candidates to merge (pure geometry, genuinely generic) — for
every merged group, it must also **reclassify** the newly merged candidate to get its
`OpeningPipelineResult` (today via `_classify_once`, which chains evidence → features →
classifier → confidence). Reclassification is exactly the kind of stage-composition
decision this design says belongs to the recognizer, not the pipeline. Hiding it inside a
single `recognize()` method would force one of two bad outcomes: either the pipeline keeps
directly orchestrating evidence/feature/classifier stages for the merge case (reintroducing
the exact coupling this redesign removes), or `recognize()` is redefined to somehow accept
a single pre-built `OpeningCandidate` as an alternate input shape (conflating "scan a whole
drawing" and "reclassify one candidate" into one signature, which is worse than two
distinct methods).

The SPI therefore has exactly two methods — both narrow, both stating only an
input/output contract:

```python
class OpeningRecognizer(Protocol):
    def recognize(
        self, scan_result: Any, search_layers: set[str] | None = None, *,
        layer_confidence: float = 1.0, block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> list[OpeningPipelineResult]:
        """Pass 1: detect and classify every candidate in a scan."""
        ...

    def reclassify(
        self, candidate: OpeningCandidate, *,
        layer_confidence: float = 1.0, block_confidence: float = 0.0,
        geometry_quality: float = 0.8,
    ) -> OpeningPipelineResult:
        """Pass 2: classify one already-built candidate (e.g. a freshly merged one).
        Implementations may share internal logic between recognize() and reclassify()
        (WindowRecognizer does), but the SPI treats them as two operations because
        "scan a drawing" and "classify one candidate" are genuinely different inputs."""
        ...
```

This still fully satisfies the redesign's goal: the pipeline calls `recognize()` once and
`reclassify()` per merge group, and knows nothing about *how* either is implemented —
`DoorRecognizer` is free to share code between the two methods or not, exactly as
`WindowRecognizer` does.

**Why `OpeningPipelineResult.candidate` (not a new `merge()` SPI method) is what makes
Pass 2 possible without violating the boundary.** Pass 2 needs each candidate's raw
geometry to re-cluster and rebuild merged candidates. Two options were considered:
1. Add `merge(parts: list[OpeningCandidate]) -> OpeningCandidate` to the `OpeningRecognizer`
   SPI, so the pipeline delegates merging back to the recognizer.
2. Keep `OpeningCandidate` in `OpeningPipelineResult` (already true today) and have the
   pipeline call a **standalone, recognizer-independent** candidate-building function
   directly.

Option 1 was rejected: it would add merge-graph geometry to the SPI surface, but every
recognizer's `merge()` would end up as a one-line delegate to the same underlying
candidate-building logic anyway — pure boilerplate, not a place where a door- or
window-specific decision could ever live, since "combine several candidates' raw geometry
into one" has no opening-type-specific meaning. Option 2 is the design: `OpeningSymbolDetector`'s
private `_build_candidate()` method — verified to hold no instance state (it only calls
its own `@staticmethod` helpers `_compute_bbox`/`_aspect_ratio`) — is promoted to a
standalone module-level function in a new `opening_candidate.py` module. Both
`OpeningSymbolDetector` (used internally by `WindowRecognizer`) and `OpeningSymbolPipeline`
(used directly for Pass-2 remerging) call this same function; the pipeline no longer needs
a detector instance at all.

## 3. SPI Definitions

### `OpeningRecognizer` (new file: `semantic/opening_recognizer.py`)

Defined in full in Section 2 above (two methods: `recognize()`, `reclassify()`).
`recognize()`'s signature matches `OpeningSymbolPipeline.run()`'s current parameters
exactly, so the pipeline can forward them without translation.

### `WindowRecognizer` (new file: `semantic/window_recognizer.py`)

Implements `OpeningRecognizer` structurally (Python `Protocol` — no explicit inheritance
required). Internally:
- `recognize()` moves the composition currently split across `OpeningSymbolPipeline.run()`
  (the `self._detector.detect(...)` call) and `_classify_once()` (evidence extractor →
  feature extractor → classifier → confidence fuser) into one method here, unchanged in
  behavior — a pure relocation, not a rewrite.
- `reclassify(candidate, ...)` runs the same evidence → features → classifier → confidence
  chain `_classify_once()` runs today, but starting from an already-built `OpeningCandidate`
  instead of raw detector output. In practice `WindowRecognizer` implements this by
  extracting `_classify_once()`'s current body (minus the detection step) into a private
  helper both `recognize()` and `reclassify()` call — the two public methods share
  everything except how they obtain their input `OpeningCandidate`(s).

### `RuleEvaluator` (new file: `semantic/rule_evaluator.py`)

```python
class RuleDomain(str, Enum):
    WINDOW_DETECTION = "window_detection"
    DOOR_DETECTION = "door_detection"


class RuleEvaluator(Protocol):
    def evaluate(self, features: OpeningFeatures) -> tuple[StyleMatch, ...]:
        """Evaluate features against this evaluator's rule set, returning matches
        sorted by score descending."""
        ...


class YamlRuleEvaluator:
    """Evaluates features via a YAML-defined rule engine (the current, only
    implementation). A future LlmRuleEvaluator / MlRuleEvaluator can be added later
    without changing BaseStyleClassifier or this Protocol."""

    def __init__(
        self,
        rule_engine: Any,
        domain: RuleDomain,
        style_map: dict[str, Any],
        object_id: str,
    ) -> None:
        ...

    def evaluate(self, features: OpeningFeatures) -> tuple[StyleMatch, ...]:
        ...  # current _classify_with_engine/_convert_eval logic, moved here verbatim,
        #     calling self._engine.evaluate_facts(domain=self._domain, facts=features,
        #     object_id=self._object_id)
```

`object_id` (the free-text label `evaluate_facts()` receives, currently hardcoded as
`"window_candidate"` inside `_classify_with_engine`) is a required constructor argument on
`YamlRuleEvaluator`, not a hardcoded literal inside `evaluate()` — since this class is
reused for both `RuleDomain.WINDOW_DETECTION` (`object_id="window_candidate"`) and
`RuleDomain.DOOR_DETECTION` (`object_id="door_candidate"`) in PR 2+, it can't be baked into
the class body. It stays a plain string, not an enum: it is a logging/debugging label, not
a dispatch key, so there is no type-safety benefit to an enum for it (this mirrors the
review's own conclusion: only the *domain* string, which actually drives which rule set
gets loaded, gets the enum treatment). `WindowClassifier` constructs its
`YamlRuleEvaluator` with `object_id="window_candidate"`, preserving today's exact value.

### `BaseStyleClassifier[TStyle]` (new file: `semantic/style_classifier_base.py`)

This class does not exist today — the predecessor spec's Component 2 (which would have
created it) was superseded before being implemented. `WindowClassifier` currently has no
base class (`class WindowClassifier:`) and will additionally need to become
`class WindowClassifier(BaseStyleClassifier[WindowStyle])` as part of Migration step 1, not
just gain a new constructor. It takes an `evaluator: RuleEvaluator` (not a raw rule engine):

```python
class BaseStyleClassifier(Generic[TStyle]):
    def __init__(self, evaluator: RuleEvaluator | None = None) -> None:
        self._evaluator = evaluator

    def classify(self, features: OpeningFeatures) -> Classification[TStyle]:
        if self._evaluator is None:
            raise NotImplementedError(
                f"{type(self).__name__} requires an injected RuleEvaluator "
                "(no hardcoded-fallback mode is provided by BaseStyleClassifier)."
            )
        matches = self._evaluator.evaluate(features)
        return Classification(matches=matches, features=features)
```

`WindowClassifier(BaseStyleClassifier[WindowStyle])` keeps its own hardcoded-fallback mode
(`_classify_hardcoded`/`_check_*`, unchanged, window-specific, not extracted — same
decision as the original PR 1 plan) and is constructed with a `YamlRuleEvaluator` pointed
at `RuleDomain.WINDOW_DETECTION` and windows' `_style_map`.

### `OpeningCandidate` builder (new file: `semantic/opening_candidate.py`)

```python
def build_candidate(cluster: list[dict]) -> OpeningCandidate | None:
    """Cluster of raw entity dicts -> OpeningCandidate, or None for an empty/invalid
    cluster. Promoted from OpeningSymbolDetector._build_candidate (verified to hold no
    instance state) so both OpeningSymbolDetector and OpeningSymbolPipeline's Pass-2
    remerge can call it without either depending on the other."""
    ...  # current _build_candidate body, moved verbatim (still calls the existing
    #     _compute_bbox/_aspect_ratio staticmethods, relocated alongside it or kept
    #     as free functions in the same new module)
```

`OpeningSymbolDetector.detect()` calls this function instead of `self._build_candidate(...)`.
`OpeningSymbolPipeline._merge_candidates()` calls it directly, with no detector instance
involved at all.

### `OpeningSymbolPipeline` (updated: `semantic/opening_pipeline.py`)

```python
class OpeningSymbolPipeline:
    def __init__(self, recognizer: OpeningRecognizer) -> None:
        self._recognizer = recognizer
        # No fuser, no classifier, no detector, no evidence/feature extractor fields --
        # every stage-level concern now lives behind the recognizer.

    def run(self, scan_result, search_layers=None, **confidence_params) -> list[OpeningPipelineResult]:
        per_candidate_results = self._recognizer.recognize(
            scan_result, search_layers, **confidence_params
        )
        if not per_candidate_results:
            return []
        return self._two_pass_merge(per_candidate_results, **confidence_params)

    def _merge_candidates(self, parts: list[OpeningCandidate]) -> OpeningCandidate:
        entities: list[dict] = []
        for c in parts:
            entities.extend(c.lines)
            entities.extend(c.arcs)
            entities.extend(c.closed_polylines)
        return build_candidate(entities)  # standalone function, no detector needed

    def _reclassify_merged(
        self, merged_cand: OpeningCandidate, **confidence_params
    ) -> OpeningPipelineResult:
        """Replaces today's call to self._classify_once(merged_cand, ...) inside
        _two_pass_merge -- delegates to the recognizer instead of orchestrating
        evidence/feature/classifier stages directly."""
        return self._recognizer.reclassify(merged_cand, **confidence_params)

    # _two_pass_merge's eligibility-graph logic, _standard_eligible, _sparse_eligible,
    # _merge_eligible, and the geometry helpers (_centroid, _principal_axis,
    # _point_to_bbox_distance, etc.) are UNCHANGED -- pure functions over OpeningCandidate,
    # no dependency on detector/classifier/recognizer types. Only the one call site that
    # used to invoke self._classify_once(merged_cand, ...) is replaced with
    # self._reclassify_merged(merged_cand, ...) above.
```

This resolves what an earlier draft of this design left as an open question: Pass 2's
merge-eligibility graph (deciding *which* candidates to merge) is pure geometry and stays
in the pipeline unchanged; the *reclassification* of each merged candidate is recognized as
a second recognition operation and routed through `OpeningRecognizer.reclassify()` instead
of the pipeline orchestrating evidence/feature/classifier stages itself.

## 4. Migration Plan (order matters — see rationale below)

The original draft ordered "candidate builder last." This is reordered because
`WindowRecognizer` (step 3) needs `build_candidate()` to exist first — building the
foundation before the consumer keeps each commit's regression scope narrow and its
dependency direction natural.

1. **`RuleEvaluator` + `RuleDomain` + `YamlRuleEvaluator`** (`rule_evaluator.py`, new) +
   **`BaseStyleClassifier` update** (`style_classifier_base.py`) to take an `evaluator`
   instead of a raw rule engine. `WindowClassifier` updated to construct/accept a
   `YamlRuleEvaluator`. Regression gate: `tests/test_window_classifier.py` unchanged.
2. **`OpeningCandidate` builder promotion** (`opening_candidate.py`, new): move
   `_build_candidate`/`_compute_bbox`/`_aspect_ratio` out of `OpeningSymbolDetector` into
   module-level functions; `OpeningSymbolDetector.detect()` calls the new function.
   Regression gate: `tests/test_opening_pipeline_two_pass.py` (detector behavior must be
   byte-for-byte identical).
3. **`OpeningRecognizer` Protocol** (`opening_recognizer.py`, new, both `recognize()` and
   `reclassify()`) + **`WindowRecognizer`** (`window_recognizer.py`, new): extract
   `_classify_once()`'s current body (evidence → features → classifier → confidence, minus
   the detection step) into a private helper; `recognize()` calls
   `self._detector.detect(...)` (moved here from `OpeningSymbolPipeline.run()`) then the
   helper per candidate; `reclassify()` calls the helper directly on its given candidate.
   Uses the new `build_candidate()` from step 2. Regression gate: a new isolated test
   exercising `WindowRecognizer` directly, plus confirming both methods produce identical
   `OpeningPipelineResult`s to the pre-change pipeline's `run()`/`_classify_once()` output
   on the same fixtures.
4. **`OpeningSymbolPipeline` rewrite**: constructor takes `recognizer: OpeningRecognizer`
   only (no more `classifier`/`detector`/`fuser` parameters); `run()` delegates Pass 1 to
   `recognizer.recognize(...)`; `_two_pass_merge`'s one call to the old
   `self._classify_once(merged_cand, ...)` is replaced with
   `self._recognizer.reclassify(merged_cand, ...)`. Regression gate: full
   `tests/test_opening_pipeline_two_pass.py` suite.
5. **`handlers/space.py` call site update**: `OpeningSymbolPipeline(recognizer=WindowRecognizer())`
   at the current `OpeningSymbolPipeline()` call site (line 2302 as of this writing).
   Regression gate: full window/opening test suite + smoke imports.

## 5. Compatibility

- `WindowClassification`, `WindowStyle`, `StyleMatch`, `Classification[TStyle]` names and
  shapes are unaffected by this redesign (unchanged from the original PR 1 plan).
- Every existing test file's imports and assertions remain valid except the 4
  `OpeningSymbolPipeline(...)` call sites, which change their constructor argument from
  `classifier=WindowClassifier()` to `recognizer=WindowRecognizer()`.
- Zero behavior change is still the only success criterion for this PR — no new door
  code, no YAML changes, no rendering changes.

## 6. Testing Strategy

- **Full existing regression gate** (unchanged from the original PR 1 plan): the entire
  window/opening test suite must pass with zero assertion changes.
- **New unit tests**:
  - `tests/test_rule_evaluator.py` — `YamlRuleEvaluator` tested standalone (moved
    assertions from the old `_classify_with_engine` tests); `BaseStyleClassifier` tested
    against a fake `RuleEvaluator` double (no rule engine involved).
  - `tests/test_opening_candidate_builder.py` — `build_candidate()` tested as a pure
    function (cluster dict list in, `OpeningCandidate | None` out), independent of
    `OpeningSymbolDetector`.
  - `tests/test_window_recognizer.py` — both `WindowRecognizer.recognize()` (tested
    against fixtures, confirming it reproduces the old `OpeningSymbolPipeline.run()` +
    `_classify_once()` Pass-1 output exactly) and `WindowRecognizer.reclassify()` (given a
    pre-built `OpeningCandidate`, confirming it reproduces the old `_classify_once()`'s
    output for that same candidate — i.e. `reclassify(c)` and the single-candidate slice
    of `recognize()`'s output for `c` must agree).
  - `tests/test_opening_recognizer_protocol.py` (or folded into the above) — confirms
    `WindowRecognizer` structurally satisfies `OpeningRecognizer` (e.g. via
    `typing.runtime_checkable` + `isinstance`, or simply calling both methods through a
    variable typed as `OpeningRecognizer` in a type-checked test).
- **Boundary test**: assert `opening_pipeline.py`'s import list contains no reference to
  `OpeningSymbolDetector`, `WindowClassifier`, `OpeningEvidenceExtractor`,
  `OpeningFeatureExtractor`, or `ConfidenceFuser` — a cheap regression guard against the coupling this redesign
  removes creeping back in.

## 7. Future Extensions (not built now, enabled by this design)

- **`DoorRecognizer`** (PR 2+): implements `OpeningRecognizer` with its own internal
  composition. Whether it reuses `OpeningSymbolDetector`/evidence/feature stages or
  something else entirely is that PR's decision alone — `OpeningSymbolPipeline` requires
  no changes either way.
- **Non-YAML `RuleEvaluator` implementations** (e.g. `LlmRuleEvaluator`, `MlRuleEvaluator`):
  addable without touching `BaseStyleClassifier`, `WindowClassifier`, or the SPI.
- **`OpeningCandidateBuilder` as a class** (explicitly deferred, not part of this PR):
  if candidate construction ever needs shared mutable state or configuration, promoting
  the module-level `build_candidate()` function into a class is a purely additive future
  step — not needed today per YAGNI.
