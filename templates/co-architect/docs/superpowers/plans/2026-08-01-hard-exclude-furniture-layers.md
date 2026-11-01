---
lang: ko
lang_reason: proper-noun
---

# Hard-Exclude Furniture/Display Layers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen the just-shipped HATCH-layer fix from a soft 0.3x penalty to a hard 0.0x exclusion, and extend it to catch furniture (`6fur`) and display-fixture (`F-디스플레이`) layers — together 78% of everything currently extracted as "walls" on the live drawing — while preserving the pre-existing manual-override escape hatch (`layer_roles` in `{file}.layers.json`).

**Architecture:** Two-line change to existing constants in `space.py` (`_NEGATIVE_LAYER_NAME_KEYWORDS["wall"]` list extended, `_NEGATIVE_KEYWORD_PENALTY_FACTOR` changed from `0.3` to `0.0`) — no new mechanism, reusing the exact application site from the HATCH fix.

**Tech Stack:** Python, existing layer-classification pipeline in `src/cad_intelligence/cad_io/handlers/space.py`.

---

## Reference

Spec (approved, 1 review round): `docs/superpowers/specs/2026-08-01-hard-exclude-furniture-layers-design.md`

Key verified facts (from spec review):
- `_NEGATIVE_LAYER_NAME_KEYWORDS`/`_NEGATIVE_KEYWORD_PENALTY_FACTOR` currently at `space.py:206-209`: `{"wall": ["hatch", "fill", "fin", "finish"]}` / `0.3`.
- Manual-override escape hatch (`space.py:1865-1869`, `# Manual override always wins.`) runs AFTER auto-classification and unconditionally overwrites `classification`/`classification_confidence` — confirmed unaffected by changing the auto-classification penalty from soft to hard.
- Existing test `test_hatch_layer_wall_confidence_drops_below_threshold` (`tests/test_classify_layers.py:712-730`) currently asserts `assertLess(wall_confidence, 0.25)` — this plan strengthens it to `assertEqual(wall_confidence, 0.0)`.
- Existing collision-regression tests: `test_2sec_wall_layer_unaffected_by_penalty` (line 732), `test_penalty_only_applies_to_wall_role_not_others` (line 747, uses layer `"hatch_fin"`) — neither collides with the new keywords.
- `combined[role]` is always non-negative (sum of non-negative weighted sub-scores) — no NaN/negative edge case to worry about with `*= 0.0`.

---

### Task 1: Extend keywords, change penalty to hard exclusion, update/add tests

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` (`_NEGATIVE_LAYER_NAME_KEYWORDS`, `_NEGATIVE_KEYWORD_PENALTY_FACTOR`, ~line 206-209).
- Modify: `tests/test_classify_layers.py` (`TestNegativeKeywordPenalty` class — read it first for exact style/helper usage before editing).

- [ ] **Step 1: Read the current `TestNegativeKeywordPenalty` class in full** (`tests/test_classify_layers.py`, search for the class) to confirm exact helper usage (`_make_signals`/`_make_fake_analysis`/`_classify`) and the exact current assertion text for the HATCH test, before writing new tests or modifying the existing one.

- [ ] **Step 2: Write the failing tests**

Add to `TestNegativeKeywordPenalty` (or a new class in the same file, matching whatever the existing class's style suggests):

```python
def test_furniture_layer_wall_confidence_is_zero(self) -> None:
    """A layer named '6fur' (furniture) must be hard-excluded from
    wall classification -- not just discounted."""
    analysis = _make_fake_analysis([{
        "name": "6fur",
        "entity_type_counts": {
            "AcDbLine": 390, "AcDbArc": 340, "AcDbPolyline": 103,
            "AcDbBlockReference": 4, "AcDbCircle": 28, "AcDbFace": 34,
            "AcDbPoint": 25,
        },
        "signals": _make_signals(lw_wall=0.5, sp_wall=0.8, lw_reliable=True),
    }])
    result = _classify(analysis, "6fur")
    self.assertEqual(result["classification_signals"]["wall"], 0.0)

def test_display_layer_wall_confidence_is_zero(self) -> None:
    """A layer named 'F-디스플레이' (display fixture) must be
    hard-excluded from wall classification."""
    analysis = _make_fake_analysis([{
        "name": "F-디스플레이",
        "entity_type_counts": {
            "AcDbPolyline": 24, "AcDbCircle": 9, "AcDbLine": 619,
            "AcDbArc": 63, "AcDbBlockReference": 1,
        },
        "signals": _make_signals(lw_wall=0.5, sp_wall=0.8, lw_reliable=True),
    }])
    result = _classify(analysis, "F-디스플레이")
    self.assertEqual(result["classification_signals"]["wall"], 0.0)

def test_manual_override_survives_hard_exclusion(self) -> None:
    """A manual layer_roles override for a furniture-named layer must
    still win, even though its auto-classification wall score is
    hard-excluded to 0.0 -- proves the escape hatch survives the
    soft-to-hard penalty change. Follows the exact inline-simulation
    style already established by TestManualOverride.test_manual_override_wins
    (tests/test_classify_layers.py:360-383) -- handle_classify_layers
    itself is never unit-tested directly anywhere in this codebase (it
    needs a live COM doc), so this simulates the handler's override
    logic inline, same as that existing precedent."""
    analysis = _make_fake_analysis([{
        "name": "6fur",
        "entity_type_counts": {"AcDbLine": 390, "AcDbPolyline": 103},
        "signals": _make_signals(lw_wall=0.5, sp_wall=0.8, lw_reliable=True),
    }])
    result = _classify(analysis, "6fur")
    # Before override: wall is hard-excluded (0.0), so top role won't be wall.
    self.assertEqual(result["classification_signals"]["wall"], 0.0)

    # After override (simulating handler logic, same as
    # test_manual_override_wins):
    manual_roles = {"6fur": "wall"}
    if result["name"] in manual_roles:
        result["classification"] = manual_roles[result["name"]]
        result["classification_confidence"] = 1.0
        is_ambiguous = False
    else:
        is_ambiguous = result.pop("_ambiguous", False)

    self.assertEqual(result["classification"], "wall")
    self.assertEqual(result["classification_confidence"], 1.0)
    self.assertFalse(is_ambiguous)
```

Update the existing HATCH test's assertion:

```python
def test_hatch_layer_wall_confidence_drops_below_threshold(self) -> None:
    ...
    self.assertEqual(wall_confidence, 0.0)  # was: assertLess(wall_confidence, 0.25)
```

(Rename the test method too if `test_hatch_layer_wall_confidence_drops_below_threshold` no longer accurately describes `== 0.0` behavior — e.g. `test_hatch_layer_wall_confidence_is_zero` — check Step 1's findings on whether renaming existing tests is acceptable per this file's conventions, or whether to keep the name and just update the assertion/docstring.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `python -m pytest tests/test_classify_layers.py -v -k "furniture or display or manual_override or hatch_layer"`
Expected: FAIL — furniture/display tests fail because the keywords don't exist yet (wall score won't be `0.0`); the updated HATCH test fails because current penalty only gets it to `~0.093`, not `0.0`; the manual-override test may or may not fail depending on whether it's actually exercising the new keyword logic yet (confirm it's testing the right thing before assuming red is meaningful, same discipline as the HATCH plan's earlier fixture-arithmetic catch).

- [ ] **Step 4: Implement the fix**

In `space.py`, change:

```python
_NEGATIVE_LAYER_NAME_KEYWORDS: dict[str, list[str]] = {
    "wall": ["hatch", "fill", "fin", "finish"],
}
_NEGATIVE_KEYWORD_PENALTY_FACTOR = 0.3  # combined[role] *= this on a match
```

to:

```python
_NEGATIVE_LAYER_NAME_KEYWORDS: dict[str, list[str]] = {
    "wall": ["hatch", "fill", "fin", "finish", "fur", "가구", "disp", "디스플레이"],
}
_NEGATIVE_KEYWORD_PENALTY_FACTOR = 0.0  # combined[role] *= this on a match (hard exclusion)
```

Update the constant's docstring/comment to reflect the change from soft penalty to hard exclusion and the furniture/display root cause (root-caused via live-drawing investigation: `6fur`/`F-디스플레이` together were 78% of all extracted "walls").

- [ ] **Step 5: Run tests to verify they pass**

Run the same filtered command from Step 3.
Expected: PASS (all new + updated tests).

- [ ] **Step 6: Run the full classify-layers test file + full regression**

Run: `python -m pytest tests/test_classify_layers.py -v`
Expected: PASS, no regressions (including the pre-existing `test_2sec_wall_layer_unaffected_by_penalty` and `test_penalty_only_applies_to_wall_role_not_others`).

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions elsewhere.

- [ ] **Step 7: Do NOT commit.**

---

### Task 2: CHANGELOG entry

- [ ] Add an `[Unreleased]` → `### Fixed` entry: describe the root cause (furniture/display layers `6fur`/`F-디스플레이`, 78% of extracted walls on the live drawing), the fix (extending the HATCH mechanism's keyword list + changing the penalty from soft 0.3x to hard 0.0x exclusion), and explicitly note the pre-existing manual `layer_roles` override in `{file}.layers.json` remains the escape hatch for a user who wants to force-include such a layer as a wall. Reference the spec/plan. No commit — `/sync` handles it.

---

### Task 3: Manual real-drawing verification (REQUIRED, not optional)

- [ ] Call `zwcad_classify_layers` against the live drawing (once the MCP connection has been restarted to pick up this change) and confirm `6fur`/`F-디스플레이` both score `wall: 0.0` (not just a reduced value).
- [ ] Call `zwcad_extract_cad_objects` and confirm the `walls` list no longer includes any `6fur`/`F-디스플레이` entities.
- [ ] Call `zwcad_generate_spaces` (both `ENDPOINT_CLUSTER` default and `wall_processing_mode="solid_union"`) and report the actual before/after `UNCLOSED_WALLS` exception count and room count/areas — honestly, without assuming a specific target number in advance.
- [ ] Report any discrepancy or unexpected side effect (e.g. a room that previously existed disappearing because it depended on furniture-layer geometry to close a boundary — flag this if observed, don't silently ignore it).

No code change in this task — verification only.
