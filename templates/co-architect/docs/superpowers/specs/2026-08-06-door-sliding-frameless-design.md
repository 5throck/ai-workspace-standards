---
lang: ko
lang_reason: source-material
---

# Door Recognition: SLIDING_FRAMELESS Style (8th Taxonomy Gap) — Design

## Context

Real-drawing verification of the merged `DoorRecognizer`/`DoorClassifier` (PR #241-243)
against `32-pyeong-apartment`'s DOOR layer found a 31% no-match rate. 65% of the misses
share one geometric pattern: `parallel_count=2, has_center_line=False, frame_count=0` —
two parallel lines with no enclosing frame polyline and no center line. None of the 5
shipped `door_*.yaml` rules cover this shape:

- `door_panel.yaml` / `door_material.yaml` / `door_mesh.yaml` all `require: frame_count >= 1`
- `door_sliding_light.yaml` / `door_sliding_heavy.yaml` both `require: has_center_line: true`

This mirrors the existing window `FIXED` style (`frame_count>=1, parallel_count>=2,
has_center_line=false`), but door has no equivalent rule. Per drafting convention
(confirmed by zwcad-drafter in the 2026-08-06 feature-review meeting), this shape is a
recurring Korean apartment DOOR-layer convention: a sliding door drawn without a jamb/frame
indicator because the wall itself acts as the frame.

A separate spec (`2026-08-06-door-taxonomy-expansion-design.md`, merged as PR #244) covers
7 other taxonomy gaps (SWING_SINGLE/DOUBLE, ROTATING, FOLDING, DASHED_FRAME_MARK, and 2
explicitly out-of-scope). This gap was identified as a distinct 8th item in the
2026-08-06 door/window feature-review meeting — it is not covered by PR #244's scope, and
unlike ROTATING/FOLDING it needs no new `EvidenceKind` or detector changes, only a new
rule against evidence the pipeline already extracts.

See memory `door-recognition-real-drawing-gap-frameless-parallel.md` and
`meeting-2026-08-06-door-window-feature-review.md` for full background.

## Design

### 1. New `DoorStyle` member

`src/cad_intelligence/semantic/door_classifier.py`: add `SLIDING_FRAMELESS = "sliding_frameless"`
as a 6th `DoorStyle` member, registered in `DOOR_STYLE_MAP`. `DoorClassifier` has no
hardcoded fallback logic (confirmed during PR2), so no other code path needs updating for
the new member to be usable.

**Exhaustive-match check:** grepped `src/` for any `match`/`case` or `if/elif` chain that
enumerates `DoorStyle` members by name outside `door_classifier.py`/`door_recognizer.py` --
none found. Rendering dispatch (`door_renderer.py:69-73`, `DoorStrategyRegistry.resolve()`)
is a string-keyed registry lookup on `door_style.lower()`, not an exhaustive match, so an
unregistered `SLIDING_FRAMELESS` value falls through to `NoOpDoorStrategy` by construction
rather than raising or warning. No other consumer (serialization, export) does per-member
dispatch either -- `DoorEntity.to_dict`/`from_dict` round-trip the enum's `.value` string
generically. The implementation plan should still include a verification step re-running
this grep after the enum member is added, as cheap insurance against a future exhaustive
match being introduced without noticing the new member.

### 2. New rule: `patterns/opening/door_sliding_frameless.yaml`

```yaml
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

**Score-ordering check (no conflict with existing rules):** `door_panel`/`door_material`/
`door_mesh` all `require: frame_count >= 1` -- structurally excluded from ever matching a
`frame_count==0` candidate, so there is no overlap to arbitrate. `door_sliding_light`/
`door_sliding_heavy` both `require: has_center_line: true` -- also structurally excluded.
`base_score: 0.80` is chosen for confidence calibration, not tie-breaking -- since the rule
is structurally disjoint from all 5 existing door rules (verified above), no candidate can
ever compete for this rule's slot, so the exact value only affects downstream confidence
consumers (e.g. `_PIPELINE_MIN_CONFIDENCE` gating), not classification correctness.

**Rule exclusivity (regression-test-backed, not just a design claim):** `door_sliding_light`
and `door_sliding_heavy` both require `has_center_line: true`; this rule requires
`has_center_line: false` -- these are mutually exclusive by construction on that field alone,
so no candidate can ever match both `door_sliding_frameless` and either sliding rule
simultaneously (this also holds independently via `frame_count` against `door_sliding_heavy`
specifically, which additionally requires `frame_count: ">=1"` -- `door_sliding_light` has no
`frame_count` requirement at all, so `has_center_line` is the exclusivity field that covers
both). Section 3a below adds a unit test asserting this directly, to guard against a future
edit (e.g. someone loosening `has_center_line: false` or the `door_sliding_*` rules'
`has_center_line: true`) silently reintroducing an overlap.

### 3. Golden fixtures + Verification Gate

**Positive fixture** `tests/golden/doors/sliding_frameless_01/geometry.json`: two parallel
lines (`lines`), no `closed_polylines`, no center line. Mirrors the existing golden fixture
shape used by `sliding_heavy_01` minus the frame polyline and the center line. Expected:
classifies as `sliding_frameless`.

**Negative fixture** `tests/golden/doors/sliding_frameless_negative_01/geometry.json`: a
single line only (`parallel_count=1`), no frame, no center line. Expected: no rule matches
(`door_style=None`). This exists specifically to catch a threshold regression -- if
`parallel_count: ">=2"` were ever accidentally loosened to `">=1"`, this fixture is the only
thing that would fail and surface it; the positive fixture alone cannot detect that class of
bug. `TestDoorGoldenEndToEnd`'s per-case assertion (`len(results) == 1` and a style match) is
written for candidates that classify -- a negative-expectation fixture needs its own small
test function (`test_sliding_frameless_negative_yields_no_match`) in `test_door_pipeline.py`
rather than fitting the existing parametrized loop, since `_golden_cases()` only collects
fixtures that have a non-empty `style` field.

`tests/test_door_pipeline.py`'s `_STYLE_ENUM` dict gains
`"sliding_frameless": DoorStyle.SLIDING_FRAMELESS` -- the existing parametrized
`TestDoorGoldenEndToEnd` test picks the positive fixture up automatically via
`_golden_cases()`'s directory scan; no new test function needed for it specifically.

This is the same Pre-Implementation Verification Gate discipline used in PR2: the rule's
exact thresholds are proven against synthetic fixtures before being trusted, not assumed.

### 3a. Rule-evaluator unit tests (detector-independent, fast)

In addition to the golden end-to-end fixtures (which exercise the full
`OpeningSymbolDetector` → evaluator path), add direct `YamlRuleEvaluator`-level unit tests
that construct an `OpeningFeatures` instance by hand (no detector, no geometry) and assert:

- `parallel_count=2, frame_count=0, has_center_line=False` → matches `DOOR-SLIDING-FRAMELESS-001`.
- `parallel_count=1, frame_count=0, has_center_line=False` → does not match it.
- **Exclusivity test:** a hand-built `OpeningFeatures` with `has_center_line=True` (satisfying
  `door_sliding_light`'s and `door_sliding_heavy`'s shared requirement) is asserted to never
  simultaneously match `DOOR-SLIDING-FRAMELESS-001` (whose `has_center_line: false`
  requirement it structurally fails), and vice versa -- turning the "Rule exclusivity" design
  claim in Section 2 into an executable regression guard, not just documentation.

These are cheaper to run and debug than the golden end-to-end tests since they skip
detector/evidence-extraction entirely and isolate the rule-matching logic itself.

### 4. Real-drawing re-measurement (from the 2026-08-06 feature-review meeting)

Golden-fixture passing is not sufficient on its own -- per the feature-review meeting's
Action Item 2, re-run the same measurement methodology used in the original diagnostic
(reconstructing entities from `memory/drawings/diag_openings_dump.json`'s DOOR-layer data
into the `OpeningSymbolDetector`'s expected shape, running `DoorRecognizer` against it) and
record the before/after no-match rate in the implementation plan's acceptance results and
in `CHANGELOG.md`. This confirms the fix's real-world impact rather than assuming the
golden fixture generalizes.

**Quantified acceptance criteria** (not just "measure it and see"): the original diagnostic
found 17/54 candidates unmatched (31%), of which 11 (65% of misses, ~20 points of the overall
rate) shared the exact `parallel_count=2, has_center_line=False, frame_count=0` pattern this
rule targets. Acceptance:
- Overall no-match rate: 31% → **≤15%** (roughly accounts for the 11 frameless misses closing,
  leaving the previously-unexplored 6 single-entity misses as the residual, out-of-scope per
  Section "Out of Scope" below).
- Frameless-pattern-specific recall (of the 11 candidates matching this exact evidence
  signature): 0% → **>90%** classified as `sliding_frameless`.
If the measured numbers fall short of these targets, that is a signal to investigate before
merging (e.g. the real-drawing candidates' `parallel_count` might not cluster to exactly 2
the way the synthetic fixture assumes) -- not a reason to lower the target after the fact.

### 5. Rendering

`DoorStrategyRegistry` (from PR2) already has a `NoOpDoorStrategy` fallback for any
unregistered `DoorStyle` value, so `SLIDING_FRAMELESS` needs no dedicated render strategy
in this scope -- it renders via the no-op fallback until a follow-up task adds one, exactly
as any other unregistered style would.

Leave a `# TODO:` comment at the `DoorStrategyRegistry` registration site (or in
`door_renderer.py` near the `style_key` resolution) noting the intended follow-up direction:
render `sliding_frameless` using the same glyph as `sliding_light`/`sliding_heavy` but
without drawing a frame polyline -- so a future implementer doesn't have to re-derive this
from scratch.

## Error Handling

No new error paths -- the new rule participates in the same `RuleEngine`/`YamlRuleEvaluator`
scoring flow as the existing 5 door rules. If a candidate matches no rule (including this
new one), `door_style` remains `None`, unchanged behavior.

## Testing Strategy

- Positive + negative golden fixtures, with automatic parametrized coverage for the positive
  case and a dedicated small test for the negative case (Section 3).
- Detector-independent `YamlRuleEvaluator` unit tests, including the rule-exclusivity guard
  (Section 3a).
- Full regression suite must stay green -- this change only adds a new rule file and an enum
  member; it does not touch `OpeningSymbolDetector`, `OpeningEvidenceExtractor`, or
  `OpeningSymbolPipeline`, so `test_opening_pipeline_boundary.py` and the window-side tests
  are unaffected.
- Real-drawing re-measurement against quantified acceptance criteria per Section 4, recorded
  in the implementation plan and CHANGELOG, not just asserted.
- Implementation-plan verification step: re-run the exhaustive-match grep from Section 1
  after the enum member is added, confirming no exhaustive dispatch was missed.

## Out of Scope

- A dedicated `DoorStrategyRegistry` render strategy for `SLIDING_FRAMELESS` (falls back to
  `NoOpDoorStrategy` with a `# TODO:` pointer left in place; follow-up if visual rendering
  fidelity is needed).
- The 6 remaining single-entity real-drawing misses noted in
  `door-recognition-real-drawing-gap-frameless-parallel.md` (likely threshold/hinge-mark
  noise, not a taxonomy gap; not investigated further in that memory and not re-opened here).
- **Per-field match explainability** (e.g. surfacing `parallel_count=2, frame_count=0,
  has_center_line=false` alongside the matched rule name, not just the rule name itself).
  Checked `rule_evaluator.py:73-74`: `YamlRuleEvaluator` currently only surfaces
  `f"{rule.name} matched"` as the explanation string, for every rule across every domain --
  this is an evaluator-wide limitation, not something specific to this one rule, so adding
  per-field evidence output is out of scope here and should be scoped as its own
  cross-cutting improvement if pursued.
