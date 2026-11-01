---
lang: ko
lang_reason: proper-noun
---

# Fix HATCH-Layer Wall Misclassification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the root cause of a ~800m² false "room" appearing in both `ENDPOINT_CLUSTER` and `SOLID_UNION` room-detection modes on the live drawing — a rectangular boundary loop on layer `HATCH` misclassified as `wall` (confidence 0.309, above the 0.25 candidate threshold).

**Architecture:** Add a negative-keyword multiplicative penalty (`combined[role] *= 0.3` when the layer name matches a negative keyword for that role) applied at the score-combining step in `handle_classify_layers`'s internal combining function (`space.py`, around lines 1701-1712) — NOT inside `_score_name_keywords` (a first design draft did that and was caught as a numeric no-op during spec review, since `_score_name_keywords` never gave `HATCH` a positive score to begin with).

**Tech Stack:** Python, existing layer-classification pipeline in `src/cad_intelligence/cad_io/handlers/space.py`.

---

## Reference

Spec (approved after 1 revision round — first draft was a no-op, caught by review): `docs/superpowers/specs/2026-07-31-hatch-layer-wall-misclassification-design.md`

Key verified facts (from spec review, both rounds):
- `handle_classify_layers`'s internal combining function builds `combined: dict[str,float]` via a weighted-sum loop (`space.py:1701-1710`), then does `ranked = sorted(combined.items(), ...)` (line 1712) → `top_role`/`top_score`/`second_score`/`is_ambiguous`/`final_role`/`final_confidence` all derive from `combined` post-sort.
- `name = li.name` is in scope throughout this function (line 1672) — no new parameter needed.
- Inserting the penalty loop between line 1710 (end of the weighted-sum loop) and line 1712 (`ranked = sorted(...)`) is the single correct insertion point — `combined` is fully built, nothing has consumed it yet.
- Arithmetic: `0.309 * 0.3 = 0.0927`, comfortably below the `0.25` reject/candidate threshold — this is a real, verifiable change (unlike the first draft).
- `com_bridge.py` has an independent, legacy, out-of-scope duplicate of this classification logic — confirmed not the live MCP dispatch path, not touched by this plan.
- Correct test file: `tests/test_classify_layers.py` (NOT `tests/test_layer_classification.py`, which tests the out-of-scope `com_bridge.py` copy) — already has `test_score_name_keywords_unchanged` exercising `space._score_name_keywords`, confirming this file imports `space` as `_mod` or similar; read it first to match its exact style.

---

### Task 1: Add negative-keyword penalty to the classification combining step

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — new constants near `_LAYER_NAME_KEYWORDS` (search for it, ~line 185), penalty application inside the combining function between lines 1710 and 1712 (read the current file first to get exact line numbers, since earlier work this session may have shifted them slightly).
- Test: `tests/test_classify_layers.py` (existing file — read it first for exact style/imports before appending).

- [ ] **Step 1: Read `tests/test_classify_layers.py` in full** to confirm: how it imports/references `space` (e.g. `from cad_intelligence.cad_io.handlers import space as _mod`, or similar — match whatever alias it actually uses), what helper functions it has for constructing test `LayerInfo`/entity-type-count fixtures, and its general `unittest.TestCase` vs. plain-function test style. Do not guess — read the real file.

- [ ] **Step 2: Write the failing tests**

Using the confirmed helpers `_make_signals`/`_make_fake_analysis`/`_classify` and `unittest.TestCase` style already established in this file, add tests proving:

1. **Critical — the pre-fix fixture must genuinely score >= 0.25, or the RED step is meaningless** (a first draft of this plan got this wrong and was caught in review: using only the real `entity_type_counts` for `HATCH` — 85% `AcDbLine` — computes to just entity_type-weighted ~0.156, already below 0.25 with no fix at all). Use explicit lineweight/spatial signal values so the combined pre-fix score approximates the real live value of 0.309:
   ```python
   analysis = _make_fake_analysis([{
       "name": "HATCH",
       "entity_type_counts": {
           "AcDbHatch": 15, "AcDbArc": 1, "AcDbLine": 116,
           "AcDbPoint": 1, "AcDbBlockReference": 1, "AcDbPolyline": 2,
       },
       "block_samples": ["A$C7D1753B9"],
       "signals": _make_signals(lw_wall=0.5, sp_wall=0.8, lw_reliable=True),
   }])
   result = _classify(analysis, "HATCH")
   ```
   Arithmetic check (verify this holds against the actual weights before writing): entity_type contributes ~0.1557 (0.30 weight × ~0.519 blended AcDbLine/AcDbPolyline wall-hint), lineweight contributes 0.5×0.10=0.05, spatial contributes 0.8×0.15=0.12 → combined wall ≈ 0.326 pre-fix (comfortably >= 0.25, close to the real 0.309). Confirm this fixture's PRE-FIX result is `>= 0.25` before relying on it (run it against the current unpatched code first if unsure), then confirm POST-FIX it drops to `< 0.25` (0.326 × 0.3 ≈ 0.098).
2. A layer named `"2sec"` (this drawing's real, confirmed wall layer) with a realistic wall-heavy entity-type mix and `_make_signals(lw_wall=0.5, sp_wall=0.8, lw_reliable=True)` (same signal strength as test 1, to isolate that the difference is the name, not the signals) → `wall` classification/confidence is **unaffected** by the new penalty (no accidental collision — `"2sec"` doesn't contain `"hatch"`/`"fill"`/`"fin"`/`"finish"`).
3. A layer named containing a negative keyword (e.g. `"hatch_fin"`) whose `entity_type_counts` mix would make some OTHER role (not `wall`) top-ranked (e.g. 100% `AcDbBlockReference`, door/window-leaning per the existing `test_signal2_from_statistics_entity_type_counts` precedent) → confirm the penalty only ever multiplies the `wall` entry in `combined`, not other roles (per `_NEGATIVE_LAYER_NAME_KEYWORDS`'s per-role structure — even though only `"wall"` has entries today, the mechanism itself must be role-scoped, not global) — i.e. the top-ranked role/classification is unaffected by this fix.

Match the exact test naming/class-organization convention already used in this file (read Step 1's findings) — likely a new `TestNegativeKeywordPenalty(unittest.TestCase)` class alongside the existing `TestSignalConsumption` etc.

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_classify_layers.py -v -k "hatch or Hatch or HATCH or negative"` (adjust the `-k` filter to match whatever names you actually gave the new tests)
Expected: FAIL — the penalty mechanism doesn't exist yet, so `HATCH`'s confidence is still `0.309` (or whatever the test fixture computes pre-fix), not `< 0.25`.

- [ ] **Step 4: Implement the fix**

Add near `_LAYER_NAME_KEYWORDS` (~space.py:185):

```python
# Negative name-keyword hints: layer names containing these substrings
# are strongly *unlikely* to be the named role, regardless of other
# signals (entity-type mix, block samples, etc.) — e.g. a "HATCH"
# layer is overwhelmingly likely to be fill/finish pattern geometry,
# not structural walls, even if it happens to contain many straight
# AcDbLine entities (a hatch boundary loop looks geometrically wall-like,
# root-caused this session: a HATCH-layer rectangle spanning the whole
# drawing was misclassified as a wall, confidence 0.309, and polygonized
# into a false ~800m2 "room"). Applied as a multiplicative penalty on
# the FINAL combined confidence (see the classification-combining
# function below), not on any single signal -- a per-signal zero-out
# is insufficient when other signals (entity-type, spatial) already
# carry the role past classification thresholds on their own.
_NEGATIVE_LAYER_NAME_KEYWORDS: dict[str, list[str]] = {
    "wall": ["hatch", "fill", "fin", "finish"],
}
_NEGATIVE_KEYWORD_PENALTY_FACTOR = 0.3  # combined[role] *= this on a match
```

In the score-combining function, immediately after the `combined[role] = (...)` weighted-sum loop ends (currently ~line 1710) and before `ranked = sorted(combined.items(), key=lambda kv: kv[1], reverse=True)` (currently ~line 1712), insert:

```python
    name_lower = name.lower()
    for role, neg_keywords in _NEGATIVE_LAYER_NAME_KEYWORDS.items():
        if any(kw in name_lower for kw in neg_keywords):
            combined[role] *= _NEGATIVE_KEYWORD_PENALTY_FACTOR
```

Verify `name` is indeed the correct in-scope variable holding the layer name at this point (confirmed as `name = li.name` at line 1672 during spec review, but re-confirm against the current file state before writing, in case line numbers shifted).

- [ ] **Step 5: Run tests to verify they pass**

Run the same filtered command from Step 3.
Expected: PASS (3 new tests).

- [ ] **Step 6: Run the full classification test file + broader regression**

Run: `python -m pytest tests/test_classify_layers.py -v`
Expected: PASS, no regressions to existing tests (especially `test_score_name_keywords_unchanged` and any other existing wall-classification tests for this drawing's real layers).

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions elsewhere (expect ~3830+ passed, same pre-existing skips as this session's prior full-suite runs: psutil, collada×4, ZWCAD-instance-required).

- [ ] **Step 7: Do NOT commit.**

---

### Task 2: CHANGELOG entry

- [ ] Add an `[Unreleased]` → `### Fixed` entry describing: the root cause (a `HATCH`-layer rectangle spanning the whole drawing, misclassified as `wall` at confidence 0.309, polygonizing into a false ~800m² "room" in both `ENDPOINT_CLUSTER` and `SOLID_UNION` modes), the fix (negative-keyword multiplicative penalty at the classification-combining step, NOT a per-signal zero-out — reference that the first design draft was caught as a numeric no-op during spec review, a useful detail for future readers debugging similar classification issues), and reference the spec/plan. No commit — `/sync` handles it.

---

### Task 3: Manual real-drawing verification (REQUIRED, not optional)

- [ ] Call `zwcad_classify_layers` against the live "아파트 평면도.dwg" drawing (once the MCP connection has been restarted to pick up this change) and confirm `HATCH`'s `classification_confidence` for `wall` is now below `0.25`.
- [ ] Call `zwcad_generate_spaces` with the default mode (`ENDPOINT_CLUSTER`) and confirm the ~800-850m² giant outlier room is gone, and no previously-legitimate room's count/area regressed.
- [ ] Call `zwcad_generate_spaces` with `wall_processing_mode="solid_union"` and confirm the ~806m² giant outlier room is gone there too.
- [ ] Report the resulting room counts/areas for both modes honestly — do not assume success without checking actual numbers.

No code change in this task — verification only.

---

## Post-Plan Note

This fixes the giant-outlier-room defect specifically. The session's next planned step (per the user's own stated priority) is investigating the remaining `UNCLOSED_WALLS` exceptions (180 in `ENDPOINT_CLUSTER` mode) using the newly-extracted room-name label positions (from `zwcad_extract_text_labels`) as concrete investigation anchors — a separate, not-yet-scoped piece of work.
