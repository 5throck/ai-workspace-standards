---
lang: ko
lang_reason: proper-noun
---

# Hard-Exclude "HAT"-Named Layers from Wall Classification — Design Spec

> **Status**: Draft, pending spec review
> **Created**: 2026-08-01
> **Related**: `docs/superpowers/specs/2026-08-01-hard-exclude-furniture-layers-design.md` (the mechanism this extends, 3rd iteration of the same pattern)

## Problem

After the furniture/display hard-exclusion fix (PR #180), live-drawing re-investigation of the remaining `UNCLOSED_WALLS` exceptions found `9HAT` (a layer whose name is a numbered variant of "hat", distinct from the already-excluded `"hatch"` keyword — `"9hat"` does not contain the substring `"hatch"`) still scores `wall: 0.33` and is included in wall extraction, contributing dangling wall-segment noise with no real structural wall geometry nearby.

`4ELE` also appeared near several dangle clusters with no real wall geometry nearby, and was initially suspected as a similar false positive (its name suggests "electric," not "wall"). **The user has explicitly clarified `4ELE` genuinely carries wall-relevant information in this drawing and must remain wall-eligible** — the dangle exceptions near `4ELE` are therefore a separate, genuine data-completeness issue (real gaps in this layer's own geometry), not a misclassification to fix here. Per this session's user-override principle, this domain knowledge takes precedence over the generic name-pattern heuristic.

## Goal

Add `"hat"` to `_NEGATIVE_LAYER_NAME_KEYWORDS["wall"]` (hard-excluding `9HAT`/`6hat`-style layers), and explicitly do **NOT** add `"ele"` as a keyword — `4ELE` (and any other `*ELE`-named layer) must remain unaffected by this or any future negative-keyword addition, per explicit user instruction.

## Non-Goals

- Not touching `4ELE`/`5ELE`/`7ele` or adding any `"ele"`-based exclusion — explicitly out of scope per user instruction. These layers keep their current auto-classification behavior unchanged.
- Not attempting to fix the remaining genuine wall-geometry gaps (Type A: real missing/disconnected structural wall data, e.g. near `4ELE`'s own incomplete geometry) — that's a data-completeness issue in the source drawing, not a classification bug, and is out of scope for this fix.
- Not re-litigating the HATCH/furniture fixes already shipped (PRs #179/#180) — this is purely an additive keyword extension using the exact same mechanism.

## Design

### Extend the keyword list only

```python
_NEGATIVE_LAYER_NAME_KEYWORDS: dict[str, list[str]] = {
    "wall": ["hatch", "fill", "fin", "finish", "fur", "가구", "disp", "디스플레이", "hat"],
}
# _NEGATIVE_KEYWORD_PENALTY_FACTOR stays 0.0 (hard exclusion, unchanged from PR #180)
```

No other code changes — same application site (`space.py`'s `_classify_one_layer` combining step, unchanged since PR #179/#180).

### Collision check

- `"hat"` as a substring does not appear in any of this drawing's confirmed wall layers (`2sec`, `3SEC`, `1cen`, `CA_WALL`, `A-WALL`, `A-WALL-BRICK`, `A-WALL-CONC`, `A-WALL-GLASS`, `A-WALL-OTHER`) or door/window layers (`DOOR`, `A-DOOR`, `A-WIND`).
- `"hat"` is now a strict substring of the already-present `"hatch"` keyword — adding it separately means `"hatch"`-named layers match twice (both keywords), which is harmless (the loop breaks on first match per role, per `_score_name_keywords`'s existing `break` logic — no double-penalty risk since this is a hard 0.0 multiply, not additive).
- **`4ELE` explicitly does NOT contain `"hat"`** — confirmed unaffected by this change, satisfying the user's explicit requirement to keep it wall-eligible.

## Testing

1. A layer named `"9HAT"` (or any name containing `"hat"`) with a wall-leaning entity-type/signal mix → combined `wall` score is `0.0`.
2. **Explicit regression proving user's requirement is honored**: a layer named `"4ELE"` with the same wall-leaning signal mix → combined `wall` score is **unaffected** (still nonzero, same as before this fix) — this is the single most important test in this plan, since it's the user's explicit correction.
3. Regression: `"2sec"` unaffected (re-run of existing test, same as prior two rounds).
4. Full regression: `python -m pytest tests/ -q` — no regressions.
5. **Live-drawing verification (required)**: re-run `zwcad_classify_layers` and confirm `9HAT` scores `wall: 0.0` while `4ELE` still scores `wall: 0.32` (unchanged) or whatever its current live value is — report the actual observed numbers.

## Files Touched

- `src/cad_intelligence/cad_io/handlers/space.py`: one-line addition to `_NEGATIVE_LAYER_NAME_KEYWORDS["wall"]`.
- `tests/test_classify_layers.py`: 2 new tests (hat-exclusion + 4ELE-must-remain-unaffected).
- `CHANGELOG.md`.
