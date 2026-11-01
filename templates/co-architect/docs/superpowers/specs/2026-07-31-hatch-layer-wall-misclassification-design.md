# Fix HATCH-Layer Misclassified-as-Wall Giant Outlier Room — Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-07-31
> **Related**: room-detection quality investigation (this session, live-drawing verification of `zwcad_generate_spaces`)

## Problem

Both `ENDPOINT_CLUSTER` and `SOLID_UNION` room-detection modes report one giant outlier "room" (~800-850 m², matching the drawing's near-full extent). Root-caused via live investigation: a rectangular boundary loop on layer `HATCH` (4 line entities, handles `2735-0`..`2735-3`, forming a perfect axis-aligned rectangle spanning nearly the whole drawing) is misclassified as `wall` by `handle_classify_layers` — confidence `0.309` (above the 0.25 "candidate" threshold, so it passes geometry validation and gets included in wall extraction). 124 of the `HATCH` layer's 136 entities end up in the `walls` list. This rectangle then polygonizes into its own giant closed face, reported as a room.

Root cause of the misclassification: `_score_name_keywords` (`space.py:1012-1021`, signal 1, weight 0.25) only adds *positive* signal when a keyword matches — a layer literally named `HATCH` gets `0.0` contribution to every role (no match against any role's keyword list), so it contributes nothing to *suppress* the wall score, even though "hatch" is about as strong an anti-wall-layer name signal as a layer name can carry (hatch layers are almost universally fill/finish patterns, not structural geometry). The entity-type signal (85% `AcDbLine`) and other signals compensate enough to push the layer past the 0.25 candidate threshold.

## Goal

Add a **negative name-keyword** mechanism to the layer classification scoring, generalizable across drawings (not hardcoded to this one drawing's `HATCH` layer specifically — `"hatch"` is a common, conventional CAD layer-naming term, not a one-off).

## Non-Goals

- Not touching the entity-type/block-name/lineweight/spatial scoring signals — this is scoped to the name-keyword signal only.
- Not adding a room-polygon-level "exclude the biggest polygon" heuristic as an alternative/additional fix — the spec's chosen fix is at the root (classification), not a downstream patch; a downstream giant-polygon filter would only mask future instances of the same misclassification class (e.g. a differently-named non-wall layer with wall-like geometry) rather than preventing them.
- Not resolving the remaining `UNCLOSED_WALLS` exceptions (180 in `ENDPOINT_CLUSTER` mode) — that's the session's next planned investigation step, separate from this specific outlier-room defect.

## Design

**Revision note (post spec-review):** the first draft proposed zeroing `_score_name_keywords`'s per-role dict entry on a negative-keyword match. This was numerically a no-op for the actual `HATCH` case: `_score_name_keywords` only ever sets a role's score to `1.0` on a positive keyword match and leaves everything else at its `0.0` default — `HATCH` never matched any positive keyword, so its `wall` name-signal was *already* `0.0` before this fix. Zeroing an already-zero value changes nothing; `HATCH`'s combined confidence would have stayed at `0.309`, still above the `0.25` candidate threshold, and the bug would NOT be fixed. Confirmed via reading the actual weighted-sum combination code (`space.py:1701-1710`, the function that blends all 5 signals into `combined[role]`) — this is where a real fix must apply a genuine penalty, not inside `_score_name_keywords` alone. Revised design below.

### `_NEGATIVE_LAYER_NAME_KEYWORDS` + penalty factor

New module-level constants in `space.py`, next to `_LAYER_NAME_KEYWORDS`:

```python
# Negative name-keyword hints: layer names containing these substrings
# are strongly *unlikely* to be the named role, regardless of other
# signals (entity-type mix, block samples, etc.) — e.g. a "HATCH"
# layer is overwhelmingly likely to be fill/finish pattern geometry,
# not structural walls, even if it happens to contain many straight
# AcDbLine entities (a hatch boundary loop looks geometrically wall-like).
# Applied as a multiplicative penalty on the FINAL combined confidence
# (see _combine_classification_scores / the classification-combining
# function), not on any single signal — a per-signal zero-out is not
# enough when other signals (entity-type, spatial) already carry the
# role past the classification thresholds on their own.
_NEGATIVE_LAYER_NAME_KEYWORDS: dict[str, list[str]] = {
    "wall": ["hatch", "fill", "fin", "finish"],
}
_NEGATIVE_KEYWORD_PENALTY_FACTOR = 0.3  # combined[role] *= this on a match
```

### Applied at the combination step

In the function that builds `combined` (`space.py:1701-1710`, immediately after the weighted-sum loop, before `ranked = sorted(...)`):

```python
    name_lower = name.lower()
    for role, neg_keywords in _NEGATIVE_LAYER_NAME_KEYWORDS.items():
        if any(kw in name_lower for kw in neg_keywords):
            combined[role] *= _NEGATIVE_KEYWORD_PENALTY_FACTOR
```

This multiplies the *final*, already-blended confidence for a role, not any individual signal — so it works regardless of which signal(s) are actually driving the score up (in `HATCH`'s case, `_score_entity_type`'s 85%-`AcDbLine` contribution). Arithmetic check against the real drawing's known value: `0.309 * 0.3 = 0.0927`, comfortably below the `0.25` candidate-reject threshold — a real, verifiable change, not a no-op.

A legitimate wall layer name should never also contain a `_NEGATIVE_LAYER_NAME_KEYWORDS["wall"]` substring (`"hatch"`/`"fill"`/`"fin"`/`"finish"` are not wall-naming conventions in this codebase's existing keyword lists or observed drawings), so this shouldn't collide with real walls — verified empirically in Testing item 2 below against this drawing's actual wall layers (`2sec`, `3SEC`, `1cen`, `A-WALL*`, etc.).

**Scope note**: `com_bridge.py` has an independent, older duplicate of `_score_name_keywords`/`_LAYER_NAME_KEYWORDS`/the combination logic (confirmed during spec review — not delegating to `space.py`). Per this session's established finding that `com_bridge.py`'s duplicate handlers are legacy/not the live MCP dispatch path (the same conclusion reached for its duplicate `handle_extract_cad_objects` during the text-labels-tool work), this fix is scoped to `space.py` only — `com_bridge.py` is intentionally not touched.

## Testing

1. `handle_classify_layers`-level (or the internal combining function directly, whichever is more directly testable — check existing test style in `tests/test_classify_layers.py`, which already has `test_score_name_keywords_unchanged` exercising `space._score_name_keywords`): a layer named `"HATCH"` with an entity-type mix that would otherwise combine to `wall` confidence `>= 0.25` → after the penalty, combined `wall` confidence drops below `0.25`.
2. A real wall layer name from this drawing (e.g. `"2sec"`, `"A-WALL"`) with realistic wall-like entity-type mix → combined `wall` confidence is **unaffected** by the new penalty (no accidental substring collision with `_NEGATIVE_LAYER_NAME_KEYWORDS`).
3. A layer name containing a negative keyword but whose top role is NOT `wall` (e.g. hypothetically a `"door_fin"` layer that's actually mostly door blocks) → the penalty only ever applies to the `wall` role specifically (per `_NEGATIVE_LAYER_NAME_KEYWORDS`'s per-role keys), other roles' scores are untouched.
4. **Live-drawing verification (required, not optional)**: after the fix, re-run `zwcad_classify_layers` against the live drawing and confirm `HATCH`'s `classification_confidence` for `wall` is now below `0.25`. Then re-run `zwcad_generate_spaces` (both `ENDPOINT_CLUSTER` and `SOLID_UNION` modes) and confirm the ~800m² giant outlier room is gone in both, with no new regressions to the previously-detected legitimate rooms' count/areas.
5. Full regression: `python -m pytest tests/ -q` — no regressions, especially `tests/test_classify_layers.py`'s existing tests.

## Files Touched

- `src/cad_intelligence/cad_io/handlers/space.py`: new `_NEGATIVE_LAYER_NAME_KEYWORDS`/`_NEGATIVE_KEYWORD_PENALTY_FACTOR` constants, penalty applied inside the score-combining function (`space.py:1701-1710` region).
- `tests/test_classify_layers.py` (confirmed correct file during spec review — not `test_layer_classification.py`, which tests the out-of-scope `com_bridge.py` duplicate).
- `CHANGELOG.md`.
