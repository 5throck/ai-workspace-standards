# Door Recognition Upgrade Design

> **Superseded (partial):** This design's Component 2 (`BaseStyleClassifier` extraction)
> and Component 2a (`OpeningSymbolPipeline` genericization) have been superseded by
> [`2026-08-06-opening-recognizer-spi-design.md`](2026-08-06-opening-recognizer-spi-design.md),
> which redesigns PR 1 around an `OpeningRecognizer` SPI (Dependency Inversion) instead of
> a shared generic base class directly wired into the pipeline. The overall goal (bring
> door recognition to window-recognition quality, 5-type taxonomy, PR 2-4 scope) remains
> valid and unchanged — only PR 1's internal architecture changed. Read the SPI design doc
> for the current PR 1 plan; the rest of this document (Target Taxonomy, Components 1 and
> 3-6, Error Handling, Testing Strategy, Rollout PRs 2-4) still applies as written.

## Context

The window-symbol recognition pipeline (`OpeningSymbolPipeline`: Detector → Evidence →
Features → Classifier → Confidence, `src/cad_intelligence/semantic/`) classifies windows
into styles (SLIDING/CASEMENT/FIXED/AWNING) with per-candidate confidence, driving both
downstream room-opening association and per-style elevation rendering
(`WindowStrategyRegistry`). Doors have no equivalent: they are extracted and grouped into
composite entities (`handlers/space.py`'s `_classify_door_entity` / `_group_door_entities` /
Type 1-3 sidecar detectors), but **no style/type classification exists at all** — no
`DoorStyle` enum, no `DoorEntity.door_style` field, no classifier, no rule patterns, no
confidence scoring, no style-driven rendering, no golden tests. This gap was explicitly
named out of scope during the 2026-08-04 window-symbol-pipeline integration
(`docs/superpowers/specs/2026-08-04-window-symbol-pipeline-integration-design.md`, lines
298-306) and tracked as Backlog #14.

**Goal:** bring door recognition to the same quality as window recognition — style
classification with confidence, matching the 5-type Korean-residential-drawing door
taxonomy the earlier design doc already flagged (transliterated: binjimun/jajaemun/
mangsamun/miseogimun/midajimun) — while reusing as much of the existing window-pipeline
architecture as possible and touching the live `handlers/space.py` door-extraction path
only at its output boundary (grouped door candidates), not its internals.

## Target Taxonomy

5 styles, matching the legend terms from the reference drawing legend 1:1 (kept distinct
per user decision — miseogimun and midajimun are visually/functionally different sliding
mechanisms in Korean residential drawings, not synonyms, despite both translating loosely
to "sliding"):

| `DoorStyle` member | Transliteration | Notes |
|---|---|---|
| `PANEL` | binjimun | Panel/board door |
| `MATERIAL` | jajaemun | Material door |
| `MESH` | mangsamun | Mesh/screen door |
| `SLIDING_LIGHT` | miseogimun | Light sliding door |
| `SLIDING_HEAVY` | midajimun | Heavy sliding door |

## Architecture

Reuse the window pipeline's Detector/Evidence/Features stages as-is (already
window/door-agnostic by design — `OpeningSymbolDetector.detect()` takes a `search_layers`
parameter with no window-specific logic, confirmed in `opening_detector.py`). The Classifier
stage and the pipeline orchestrator that wires it in are currently hardcoded to
`WindowClassifier`/`WindowClassification` and both need to become generic — this is a
correction from an earlier draft of this spec, which only planned to swap the Classifier
and missed that `OpeningSymbolPipeline` itself imports and type-hints `WindowClassifier`
directly (`opening_pipeline.py:37-40`, constructor default `self._classifier = classifier or
WindowClassifier()`, and `OpeningPipelineResult.classification: WindowClassification`).

```
OpeningSymbolDetector (unchanged, already agnostic)
        v
OpeningEvidenceExtractor (unchanged, already agnostic)
        v
OpeningFeatureExtractor (unchanged, already agnostic)
        v
BaseStyleClassifier[TStyle]  (NEW generic base, extracted from WindowClassifier)
   |-- WindowClassifier(BaseStyleClassifier[WindowStyle])  (refactored, behavior-identical)
   `-- DoorClassifier(BaseStyleClassifier[DoorStyle])       (NEW)
        v
OpeningSymbolPipeline[TStyle]  (generic-ized orchestrator — see Component 2a)
        v
ConfidenceFuser (unchanged, already generic)
```

`handlers/space.py`'s existing door extraction/grouping (`_classify_door_entity`,
`_group_door_entities`, Type 1/2/3 sidecar detectors) is **kept as-is**. This pipeline
attaches style classification on top of its output (one grouped door candidate), the same
way `_build_windows_v3` attaches `OpeningSymbolPipeline` on top of raw window-layer
geometry. This keeps the higher-risk, well-tested door grouping logic untouched.

**A second, unrelated door-pattern system already exists and is explicitly out of scope.**
`src/cad_intelligence/patterns/opening/` already contains `door.yaml`, `sliding_door.yaml`,
`folding_door.yaml`, and `double_door.yaml` — but these belong to the separate
`PatternEngine`/`PatternRegistry` system (`patterns/engine.py`, weighted
`features: {weight, required, constraints}` DSL, ADR-004 §4), consumed by
`handle_build_object_candidates` (`handlers/space.py:4994`) as part of a different
FeatureStore → ObjectCandidates → PatternEngine → InferenceEngine pipeline. This is
unrelated to `OpeningSymbolPipeline`/`RuleEngine`'s `requires`/`prefers`/`base_score` DSL
(`rules/rule_engine.py`, `domain="window_detection"`-style evaluation) that this design
builds on. The two systems are not reconciled by this design — the new
`door_{panel,material,mesh,sliding_light,sliding_heavy}.yaml` files live in the same
directory but are loaded exclusively by the new `DoorClassifier`/`RuleEngine` path, under
a `domain="door_detection"` namespace distinct from `PatternEngine`'s `pattern: door` /
`pattern: sliding_door` entries, so there is no name collision at the rule-engine level.
Whether the pre-existing `PatternEngine` door patterns are still exercised by any live
caller is a pre-existing condition unrelated to this design and is not investigated or
changed here.

**Classification evidence priority:** geometric evidence first (ARC for swing radius,
PARALLEL for panel/rail edges, DIAGONAL for mesh/diagonal bracing, CENTER_LINE for
sliding-track centerlines — the same `EvidenceKind` vocabulary windows use), block-name
patterns (`_detect_named_block_doors`'s existing `D<width>` block-naming convention,
`handlers/space.py:467`) as a *soft* `prefers` hint in the rule YAML, not the primary
signal. The block-name hint is carried through `OpeningFeatures` as a new field
(`block_name_prefix: str | None`, populated by the door-scoped adapter in Component 5 from
the grouped candidate's block name, e.g. `"D"` for `"D900"`) so each door YAML's `prefers`
section can reference it by name, mirroring how existing window `prefers` entries reference
fields like `wall_overlap`/`sash_count`. This keeps classification consistent across
drawings with inconsistent block-naming conventions.

## Components

### 1. `DoorStyle` enum
New file `src/cad_intelligence/semantic/door_classifier.py`:
```python
class DoorStyle(str, Enum):
    PANEL = "panel"
    MATERIAL = "material"
    MESH = "mesh"
    SLIDING_LIGHT = "sliding_light"
    SLIDING_HEAVY = "sliding_heavy"
```

### 2. `BaseStyleClassifier[TStyle]` generic base — scoped to the RuleEngine mode only
New file `src/cad_intelligence/semantic/style_classifier_base.py`.

**Correction from an earlier draft:** `WindowClassifier`'s two modes are not equally
generalizable. Verified in `window_classifier.py`:
- **RuleEngine mode** (`_classify_with_engine`, lines 115-146) genuinely generalizes: it
  calls `self._engine.evaluate_facts(domain=..., facts=features, object_id=...)` and builds
  `StyleMatch`/`WindowClassification` from the results. The one window-specific piece here
  is the `style_map` dict (lines 123-128, e.g. `"sliding_window": WindowStyle.SLIDING`)
  mapping rule names to `WindowStyle` members — this becomes a subclass-provided
  `_style_map: dict[str, TStyle]` property/class attribute in the base.
- **Hardcoded fallback mode** (`_classify_hardcoded` + `_check_sliding`/`_check_fixed`/
  `_check_casement`/`_check_awning`, lines 165-358) is NOT generic — each `_check_*` method
  hand-codes window-specific `OpeningFeatures` field thresholds and a hardcoded
  `WindowStyle` member with inline `explanation_ko`/`explanation_en` strings. This mode does
  not extract cleanly and is **not** part of `BaseStyleClassifier`.

**Decision:** `BaseStyleClassifier[TStyle]` extracts only the RuleEngine-mode logic (rule
evaluation loop, `StyleMatch`/`Classification[TStyle]` dataclass assembly, sorting) plus the
`_style_map` injection point. `WindowClassifier` keeps its own `_classify_hardcoded` fallback
methods as window-specific overrides (unchanged, still available when no `RuleEngine` is
injected) alongside the new inherited RuleEngine-mode base. **`DoorClassifier` ships with no
hardcoded fallback mode** — it requires a `RuleEngine` injected with the door YAML patterns
from Component 3 to function at all. This is an accepted scope reduction (not a parity gap
with windows) since door classification is being introduced fresh via the RuleEngine path;
a hardcoded fallback can be added later if ever needed.

`WindowClassifier` becomes: `class WindowClassifier(BaseStyleClassifier[WindowStyle])`,
retaining its own `_classify_hardcoded` and `_check_*` methods, with `_style_map` supplying
the RuleEngine-mode mapping. **This refactor must be behavior-identical** for both modes —
the full existing window test suite (`test_window_classifier.py`, `test_window_pipeline.py`,
golden windows tests) is the regression gate; no test content changes, only the production
code moves.

`DoorClassifier(BaseStyleClassifier[DoorStyle])` is new, providing its own `_style_map`
(door YAML rule names → `DoorStyle` members) and pointed at the door pattern directory —
RuleEngine-mode only, per the decision above.

### 2a. `OpeningSymbolPipeline` generic-ization
`opening_pipeline.py` must change, not just its classifier argument's default. Concretely:
- The direct import `from cad_intelligence.semantic.window_classifier import
  WindowClassification, WindowClassifier` (lines 37-40) is replaced with an import of the
  new base types (`BaseStyleClassifier`, a generic `Classification[TStyle]` dataclass moved
  into `style_classifier_base.py` alongside `StyleMatch`).
- The constructor parameter `classifier: WindowClassifier | None = None` becomes
  `classifier: BaseStyleClassifier[Any] | None = None` — callers now MUST pass a classifier
  instance explicitly (window call sites pass `WindowClassifier()`, the new door call site
  passes `DoorClassifier()`); the implicit `WindowClassifier()` default is removed rather
  than kept as a silently-wrong fallback for door use.
- `OpeningPipelineResult.classification: WindowClassification` becomes
  `OpeningPipelineResult.classification: Classification[Any]` (or left generic via a
  `TStyle` type parameter on `OpeningPipelineResult`/`OpeningSymbolPipeline` itself, at the
  implementer's discretion — either is acceptable as long as door call sites don't need to
  import `WindowClassification`).
- All existing call sites of `OpeningSymbolPipeline()` (window path, e.g.
  `handlers/space.py`'s `_build_windows_v3`) are updated to pass `WindowClassifier()`
  explicitly, since the implicit default is removed. This is a mechanical, behavior-identical
  change verified by the same window regression suite as Component 2.

### 3. Rule pattern files
New: `src/cad_intelligence/patterns/opening/door_{panel,material,mesh,sliding_light,sliding_heavy}.yaml`,
same `requires`/`prefers`/`base_score`/`explanation` (ko/en) DSL as the existing
`window_*.yaml` files (`rules/rule_engine.py`'s `RuleEngine`/`evaluate_facts` schema — no
rule-engine changes needed), registered under a `domain="door_detection"` namespace (see
Architecture section for why this is unrelated to the pre-existing `PatternEngine`-based
`door.yaml`/`sliding_door.yaml`/`folding_door.yaml`/`double_door.yaml` files already in the
same directory). Exact geometric thresholds (evidence kinds a la PARALLEL/ARC/DIAGONAL/
CENTER_LINE counts and distances) are derived from the synthetic golden fixtures during
implementation via a **Pre-Implementation Verification Gate** — see Rollout Sequence PR 2 —
the same way the window YAMLs were data-derived rather than assumed.

### 4. `DoorEntity` model extension
`src/cad_intelligence/common/models.py`: add `door_style: str | None = None` and
`style_confidence: float | None = None` to `DoorEntity`, mirroring `WindowEntity`'s
`window_style`/`style_confidence` fields exactly (`WindowEntity` at lines 171-203). This
requires updating three places, not just the dataclass fields — confirmed by reading
`DoorEntity`'s current `to_dict`/`from_dict` (lines 146-167), which do NOT yet serialize
these fields the way `WindowEntity.to_dict`/`from_dict` do (lines 182-203):
1. Add the two dataclass fields.
2. Add both keys to `DoorEntity.to_dict()`'s returned dict.
3. Add both keys (via `.get()`, defaulting to `None`) to `DoorEntity.from_dict()`.

Without step 2/3, the fields would silently fail to round-trip through JSON
serialization — Error Handling's "purely additive, zero migration needed" claim depends on
this round-trip actually working, since `DoorEntity` instances are serialized/deserialized
across handler boundaries the same way `WindowEntity` is.

### 5. Pipeline wiring in `handlers/space.py`
Adapt `_group_door_entities`'s grouped-door output into the `ModelSpaceScanResult`/`Entry`
shape `OpeningSymbolPipeline` expects (an adapter analogous to
`_entries_by_layer_from_scanned_entities`, but door-scoped), run it through the now-generic
pipeline with `DoorClassifier`, and populate `door_style`/`style_confidence` on the
resulting `DoorEntity`. Classification failure (no rule matches, or the pipeline can't run)
leaves both fields `None` and emits a `LOW_CONFIDENCE_DOOR_SYMBOL` exception (mirroring
`LOW_CONFIDENCE_WINDOW_SYMBOL`) rather than raising.

### 6. Rendering
`src/cad_intelligence/elevation/renderers/door_renderer.py`: add a `DoorStrategyRegistry`
mirroring `WindowStrategyRegistry`, resolved via `(og.door_style or "").lower()` the same
way `window_renderer.py` resolves `style_key`. When no strategy is registered for a style
(including `door_style is None`), fall back to the current fixed rendering — safe,
backward-compatible default.

## Error Handling

- Classification failure or low confidence: `door_style=None`, `style_confidence=None`,
  `LOW_CONFIDENCE_DOOR_SYMBOL` exception recorded — never raises, matching the window
  path's `LOW_CONFIDENCE_WINDOW_SYMBOL` convention.
- No YAML rule matches: same `None` + fallback-render behavior.
- Upstream `_group_door_entities` grouping failures/ambiguity: unchanged, out of scope —
  this pipeline only runs on top of successfully grouped door candidates, so upstream
  failures simply propagate as before (no new failure mode introduced).
- Model field additions are purely additive (`| None = None` defaults) — zero migration
  needed for existing `DoorEntity` serialization/consumers.

## Testing Strategy

- **Refactor regression gate**: after extracting `BaseStyleClassifier`, the full existing
  window test suite (`test_window_classifier.py`, `test_window_pipeline.py`,
  `tests/golden/windows/*`) must pass unchanged — proves the refactor is behavior-preserving
  before any door-specific code is added.
- **Unit tests**: new `tests/test_door_classifier.py`, structured like
  `test_window_classifier.py` — per-style rule matching, multi-match, confidence cases.
- **Golden tests**: new `tests/golden/doors/{panel_01,material_01,mesh_01,sliding_light_01,sliding_heavy_01}/geometry.json`
  (synthetic, authored the same way the window goldens were — not sourced from real
  drawings) + `tests/test_door_pipeline.py` end-to-end golden regression, mirroring
  `test_window_pipeline.py`.
- **Integration**: 1-2 tests in `handlers/space.py`'s existing test coverage confirming a
  grouped door candidate comes out of the full path with `door_style` populated.
- **Rendering**: style-branching tests in `door_renderer.py`'s test file, mirroring
  `window_renderer.py`'s `WindowStrategyRegistry` resolution tests.

## Rollout Sequence (4 separate PRs)

1. **`BaseStyleClassifier` extraction + `WindowClassifier` refactor + `OpeningSymbolPipeline`
   generic-ization (Components 2 + 2a)** — pure refactor, zero behavior change, verified by
   the full existing window test suite passing unchanged (including all existing
   `OpeningSymbolPipeline()` call sites updated to pass `WindowClassifier()` explicitly).
   Ships as one PR because the two components are coupled — `BaseStyleClassifier` isn't
   usable by a second classifier type until the pipeline stops hardcoding
   `WindowClassifier`/`WindowClassification` (see Architecture, Component 2a) — but is still
   independently reviewed/verified in isolation from any new door behavior, since nothing
   door-specific is introduced yet.
2. **`DoorStyle` + `DoorEntity` fields (+ `to_dict`/`from_dict` updates) + 5 YAML patterns +
   `DoorClassifier` + unit/golden tests** — the new classification capability, fully
   unit-tested, not yet wired into any live path (`handlers/space.py` unchanged in this PR).
   Includes a **Pre-Implementation Verification Gate** (mirroring the 2026-08-04/2026-08-05
   window-pipeline precedent): before finalizing the 5 YAML files' exact geometric
   thresholds, confirm each against the synthetic golden fixtures created for this PR, not
   assumed from the window values.
3. **`handlers/space.py` pipeline wiring** — connects the grouped-door output to the new
   classifier (via the door-scoped adapter and `block_name_prefix` feature from Component 5);
   `door_style`/`style_confidence` start populating in production.
4. **`DoorStrategyRegistry` + `door_renderer.py` style branching** — rendering starts
   varying by classified style; falls back safely for unclassified doors.

Each PR is independently revertable and independently test-verified, following the same
incremental pattern used for the recent `com_bridge` V2 cluster removal (PRs #236-#238).
