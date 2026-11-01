---
lang: ko
lang_reason: proper-noun
---

# Hard-Exclude Furniture/Display Layers from Wall Classification — Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-08-01
> **Related**: `docs/superpowers/specs/2026-07-31-hatch-layer-wall-misclassification-design.md` (the mechanism this extends)

## Problem

The just-shipped HATCH fix (PR #179) added a *soft* multiplicative penalty (`_NEGATIVE_KEYWORD_PENALTY_FACTOR = 0.3`) for name-matched negative keywords. Live investigation of the remaining 119 `UNCLOSED_WALLS` exceptions found the real dominant cause is much larger than HATCH alone: layers `6fur` (furniture, 1095 line segments) and `F-디스플레이` (display fixtures, 670 segments) together make up 78% of all entities currently extracted as `walls`, scattered across the whole drawing, producing widespread dangling wall-segment noise. Both layer names carry an unambiguous "this is furniture, not a wall" signal, but the current 0.3x *soft* penalty isn't strong enough by itself to push every such layer below the classification's reject threshold in all cases — a *hard* (zero) exclusion is more reliable and matches the user's explicit request.

## Goal

Change the negative-keyword mechanism from a soft multiplicative penalty to a **hard exclusion** (the matched role's combined score is forced to `0.0`, not just discounted), and extend the keyword list to cover furniture/display layer names, while preserving the **already-existing** manual-override escape hatch (`{file}.layers.json`'s `layer_roles`) for a user who wants to force-include such a layer as a wall anyway.

## Non-Goals

- Not changing the manual-override mechanism itself (`space.py:1865-1869`, `if name in manual_roles: result["classification"] = manual_roles[name]; result["classification_confidence"] = 1.0`) — confirmed during this design's investigation that it already runs *after* auto-classification and unconditionally overwrites the result, so a hard `0.0` exclusion at the auto-classification stage cannot break it. This is the user's requested "if I explicitly ask for it, include it" escape hatch, and it already exists.
- Not touching the `HATCH`/`fill`/`fin`/`finish` keywords already added for the previous fix — kept as-is, just re-scoped from "soft penalty" to "hard exclusion" (same mechanism, stronger effect).
- Not attempting to enumerate every possible non-wall layer-naming convention across all drawings — scoped to the keywords with concrete evidence from this drawing's investigation (`fur`, `가구`, `disp`, `디스플레이`) plus the already-shipped hatch-related ones. Further keywords can be added later if a new drawing surfaces a new false-positive pattern, following the same mechanism.

## Design

### Change `_NEGATIVE_KEYWORD_PENALTY_FACTOR` from soft to hard

```python
_NEGATIVE_LAYER_NAME_KEYWORDS: dict[str, list[str]] = {
    "wall": ["hatch", "fill", "fin", "finish", "fur", "가구", "disp", "디스플레이"],
}
_NEGATIVE_KEYWORD_PENALTY_FACTOR = 0.0  # combined[role] *= this on a match (hard exclusion)
```

The application site (`space.py`, between the `combined` weighted-sum loop and `ranked = sorted(...)`) is unchanged — same multiplication, just `0.0` instead of `0.3`. `combined[role] * 0.0 == 0.0` regardless of how high entity-type/spatial signals push it, which is exactly the "hard exclude" behavior requested — the role can never win as `top_role` (unless every other role also scores `0.0`, in which case `final_role` is `None` per the existing `final_role = top_role if top_score > 0.0 else None` logic, also an acceptable/safe outcome, not a new failure mode).

### New keywords: `"fur"`, `"가구"`, `"disp"`, `"디스플레이"`

- `"fur"` matches `6fur` (this drawing) and the generic `furniture` convention.
- `"가구"` (Korean for "furniture") is a belt-and-suspenders match for Korean-named furniture layers that don't use the `fur` abbreviation.
- `"disp"`/`"디스플레이"` matches `F-디스플레이` (display fixture layer) and the generic `display` convention.

### Collision check (must-not-false-positive-on-real-walls)

None of `2sec`, `3SEC`, `1cen`, `HATCH` (already handled), `A-WALL*`, `CA_WALL`, `DOOR`, or any other layer this drawing classifies as `wall`/`door`/`window` contains `"fur"`, `"가구"`, `"disp"`, or `"디스플레이"` as a substring (verified against this session's live layer list). No existing test fixture layer name collides either (`tests/test_classify_layers.py`'s `"2sec"` fixture, used as the "must not regress" test in the HATCH fix, doesn't contain any of the new keywords).

## Testing

1. `_classify_one_layer` (or the module-level entry point used by the existing `TestNegativeKeywordPenalty` tests) for a layer named `"6fur"` (or any name containing `"fur"`) with a wall-leaning entity-type/signal mix → combined `wall` score is exactly `0.0` (not just reduced), confirming hard exclusion.
2. Same for a layer named `"F-디스플레이"` (or containing `"disp"`/`"디스플레이"`).
3. Regression: `"2sec"` (real wall layer) is unaffected — same test as the HATCH fix, re-run to confirm no new collision from the expanded keyword list.
4. Regression: `"HATCH"` — now hard-excluded (`0.0`) instead of soft-discounted (`~0.093`) — update the existing HATCH test's assertion from `< 0.25` to `== 0.0` if that's a stronger, still-true claim (verify against the actual test file before assuming; this is a pre-existing test being strengthened, not a new one).
5. **Manual-override regression (critical, since this changes from soft to hard)**: a layer named `"6fur"` with a manual `layer_roles` override of `"wall"` in `{file}.layers.json` → the override still wins, `classification == "wall"`, `classification_confidence == 1.0`, unaffected by the hard exclusion. This proves the escape hatch survives the change from soft to hard.
6. Full regression: `python -m pytest tests/ -q` — no regressions.
7. **Live-drawing verification (required, not optional)**: after the fix, re-run `zwcad_classify_layers` and confirm `6fur`/`F-디스플레이` no longer score `wall` at all (their `wall` signal is `0.0`), then re-run `zwcad_generate_spaces` (both modes) and confirm a meaningfully lower `UNCLOSED_WALLS` count than the current 119 (report the actual before/after numbers honestly, not a guessed target).

## Files Touched

- `src/cad_intelligence/cad_io/handlers/space.py`: extend `_NEGATIVE_LAYER_NAME_KEYWORDS["wall"]`, change `_NEGATIVE_KEYWORD_PENALTY_FACTOR` from `0.3` to `0.0`.
- `tests/test_classify_layers.py`: extend `TestNegativeKeywordPenalty` with the new furniture/display tests + the manual-override regression test; update the existing HATCH test's assertion if strengthening it to `== 0.0`.
- `CHANGELOG.md`.
