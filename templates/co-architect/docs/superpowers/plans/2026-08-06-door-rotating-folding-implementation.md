---
lang: ko
lang_reason: source-material
---

# Door ROTATING/FOLDING Implementation Plan (Taxonomy PR 4)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `DoorStyle.ROTATING`/`FOLDING` and the detector/evidence-layer changes needed to support them (new `CIRCLE` and `FOLD_JOINT` evidence kinds), per PR 4 of the approved `docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md`.

**Architecture:** Unlike PR3 and the arc-radius fix (pure YAML-rule additions), this PR touches the detector/evidence layer: `OpeningSymbolDetector` gains `AcDbCircle` scanning, `OpeningCandidate` gains a `circles` field, and `OpeningEvidenceExtractor` gains `CIRCLE` extraction (mirrors the existing `ARC` pattern closely) and `FOLD_JOINT` extraction (genuinely new geometry-pattern-matching logic with no precedent in this codebase -- the fold-angle threshold is explicitly flagged in the spec as unproven and expected to need iteration during the Verification Gate). `OpeningSymbolPipeline` itself is untouched.

**Tech Stack:** Python, the existing `RuleEngine`/`YamlRuleEvaluator` YAML-rule DSL, pytest.

Reference spec: `docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md`, section "PR 4 -- `ROTATING` / `FOLDING`" (approved, merged as PR #244).

---

### Task 1: `EvidenceKind.CIRCLE` / `EvidenceKind.FOLD_JOINT`

**Files:**
- Modify: `src/cad_intelligence/semantic/geometry_signature.py`
- Test: `tests/test_geometry_signature.py` if it exists, otherwise add inline assertions to
  Task 4's tests (this enum has no dedicated test file today per a `grep` check -- if that's
  still true, skip a standalone test for the enum members alone and let Task 4/5's tests
  exercise them through actual usage).

- [ ] **Step 1: Check for an existing dedicated test file**

Run: `ls tests/test_geometry_signature.py 2>/dev/null || echo "does not exist"`

- [ ] **Step 2: Add the two new members**

In `src/cad_intelligence/semantic/geometry_signature.py`, change:

```python
class EvidenceKind(str, Enum):
    FRAME = "frame"                    # 닫힌 polyline 프레임
    PARALLEL = "parallel"              # 평행선 쌍
    CENTER_LINE = "center_line"        # 중심선
    ARC = "arc"                        # 호 (개방 방향)
    DIAGONAL = "diagonal"              # 경사선
    SASH = "sash"                      # 샷(이동 패널)
    RAIL = "rail"                      # 레일(홈)
```

to:

```python
class EvidenceKind(str, Enum):
    FRAME = "frame"                    # 닫힌 polyline 프레임
    PARALLEL = "parallel"              # 평행선 쌍
    CENTER_LINE = "center_line"        # 중심선
    ARC = "arc"                        # 호 (개방 방향)
    DIAGONAL = "diagonal"              # 경사선
    SASH = "sash"                      # 샷(이동 패널)
    RAIL = "rail"                      # 레일(홈)
    CIRCLE = "circle"                  # 원 (회전문)
    FOLD_JOINT = "fold_joint"          # 접힘 관절 (접이문)
```

- [ ] **Step 3: Verify no exhaustive-match on EvidenceKind exists**

Run: `grep -rn "EvidenceKind\." --include=*.py src/ | grep -v "geometry_signature.py"`

Look through the output for any `match`/`case` or if/elif chain enumerating every
`EvidenceKind` member by name (as opposed to filtering with `it.kind == EvidenceKind.X`,
which is safe and the existing pattern everywhere in this codebase). If none found (expected,
mirroring the same check done for `DoorStyle` in prior PRs), proceed. If one is found, stop
and investigate that call site before continuing.

- [ ] **Step 4: Stage (do not commit -- this workspace's pre-commit hook forbids direct
  `git commit`; only `/sync`, run at the end, may commit)**

```bash
git add src/cad_intelligence/semantic/geometry_signature.py
```

---

### Task 2: `OpeningSymbolDetector` — `AcDbCircle` scanning

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_detector.py`
- Test: `tests/test_opening_detector.py` (check it exists first; if not, note its absence and
  add tests to the nearest equivalent file used for detector unit tests)

- [ ] **Step 1: Check for an existing detector test file and its conventions**

Run: `ls tests/test_opening_detector.py 2>/dev/null && head -30 tests/test_opening_detector.py`

Use whatever `_collect_entities`/`_entity_center` testing pattern already exists there (likely
via a fake `scan_result` object, mirroring the `_FakeEntry`/`_FakeScanResult` pattern used
throughout `tests/test_door_pipeline.py` and `tests/test_door_classifier.py`) for the new
test below.

- [ ] **Step 2: Write the failing test**

Add a test asserting that an `AcDbCircle`-typed entry produces a `"circle"`-typed record:

```python
def test_collect_entities_handles_acdbcircle() -> None:
    class _FakeEntry:
        object_name = "AcDbCircle"
        handle = "C1"
        center = (100.0, 200.0)
        radius = 450.0
        layer = "A-DOOR"

    class _FakeScanResult:
        entries_by_layer = {"A-DOOR": [_FakeEntry()]}

    entities = OpeningSymbolDetector._collect_entities(_FakeScanResult(), {"A-DOOR"})
    circle_entities = [e for e in entities if e["type"] == "circle"]
    assert len(circle_entities) == 1
    assert circle_entities[0]["center"] == (100.0, 200.0)
    assert circle_entities[0]["radius"] == 450.0
```

(Adapt the exact fake-entry shape to whatever convention the existing test file at Step 1
uses -- the important assertions are the `"circle"` type tag and the `center`/`radius`
fields being copied through.)

- [ ] **Step 3: Run to verify it fails**

Run: `python -m pytest tests/test_opening_detector.py -k acdbcircle -v`
Expected: FAIL (no `AcDbCircle` case in `_collect_entities` yet -- `circle_entities` will
be empty)

- [ ] **Step 4: Add the `AcDbCircle` case to `_collect_entities`**

In `src/cad_intelligence/semantic/opening_detector.py`, find:

```python
                elif obj_name == "AcDbArc" and getattr(entry, "center", None):
                    rec["type"] = "arc"
                    rec["center"] = entry.center
                    rec["radius"] = getattr(entry, "radius", 0.0) or 0.0
                    rec["start_angle"] = getattr(entry, "start_angle", 0.0) or 0.0
                    rec["end_angle"] = getattr(entry, "end_angle", 0.0) or 0.0
                    entities.append(rec)
```

Add directly below it:

```python
                elif obj_name == "AcDbCircle" and getattr(entry, "center", None):
                    rec["type"] = "circle"
                    rec["center"] = entry.center
                    rec["radius"] = getattr(entry, "radius", 0.0) or 0.0
                    entities.append(rec)
```

- [ ] **Step 5: Add the `"circle"` branch to `_entity_center`**

Find:

```python
    @staticmethod
    def _entity_center(rec: dict) -> tuple[float, float]:
        """entity의 대표 중심점을 반환."""
        if rec["type"] == "line":
            s, e = rec["start"], rec["end"]
            return ((s[0] + e[0]) / 2, (s[1] + e[1]) / 2)
        if rec["type"] == "arc":
            c = rec["center"]
            return (c[0], c[1])
```

Add directly after the `"arc"` branch:

```python
        if rec["type"] == "circle":
            c = rec["center"]
            return (c[0], c[1])
```

- [ ] **Step 6: Run to verify it passes**

Run: `python -m pytest tests/test_opening_detector.py -v`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 7: Stage**

```bash
git add src/cad_intelligence/semantic/opening_detector.py tests/test_opening_detector.py
```

---

### Task 3: `OpeningCandidate.circles` + `GeometrySummary.circle_count`

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_candidate.py`
- Modify: `src/cad_intelligence/semantic/geometry_signature.py` (`GeometrySummary`)
- Test: `tests/test_opening_candidate_builder.py` (created in PR1 per the CHANGELOG history --
  confirm it exists and follow its existing test conventions)

- [ ] **Step 1: Write the failing test**

Add to `tests/test_opening_candidate_builder.py` (mirroring however that file currently tests
`arcs`/`lines` population from a cluster):

```python
def test_build_candidate_populates_circles() -> None:
    cluster = [
        {
            "type": "circle", "handle": "C1", "layer": "A-DOOR",
            "object_name": "AcDbCircle", "center": (100.0, 200.0), "radius": 450.0,
        },
    ]
    candidate = build_candidate(cluster)
    assert candidate is not None
    assert len(candidate.circles) == 1
    assert candidate.circles[0]["radius"] == 450.0
    assert candidate.summary.circle_count == 1
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_opening_candidate_builder.py -k circles -v`
Expected: FAIL -- `OpeningCandidate` has no `circles` attribute yet
(`AttributeError`), and a circle-only cluster currently returns `None` from
`build_candidate` (the `if not lines and not arcs and not polys: return None` guard doesn't
know about circles yet, so it would incorrectly treat this cluster as empty).

- [ ] **Step 3: Add the `circles` field to `OpeningCandidate`**

In `src/cad_intelligence/semantic/opening_candidate.py`, add to the dataclass:

```python
    lines: tuple[dict, ...] = ()
    arcs: tuple[dict, ...] = ()
    circles: tuple[dict, ...] = ()
    closed_polylines: tuple[dict, ...] = ()
```

(insert `circles` between `arcs` and `closed_polylines`)

- [ ] **Step 4: Add the `circle_count` field to `GeometrySummary`**

In `src/cad_intelligence/semantic/geometry_signature.py`, in the `GeometrySummary`
dataclass, add after `arc_count`:

```python
    line_count: int = 0
    arc_count: int = 0
    circle_count: int = 0
    polyline_count: int = 0
```

- [ ] **Step 5: Populate both in `build_candidate()`**

In `src/cad_intelligence/semantic/opening_candidate.py`'s `build_candidate()`, find:

```python
    lines = tuple(e for e in cluster if e["type"] == "line")
    arcs = tuple(e for e in cluster if e["type"] == "arc")
    polys = tuple(e for e in cluster if e["type"] == "polyline")
    blocks = [e for e in cluster if e["type"] == "block"]

    if not lines and not arcs and not polys:
        return None
```

Change to:

```python
    lines = tuple(e for e in cluster if e["type"] == "line")
    arcs = tuple(e for e in cluster if e["type"] == "arc")
    circles = tuple(e for e in cluster if e["type"] == "circle")
    polys = tuple(e for e in cluster if e["type"] == "polyline")
    blocks = [e for e in cluster if e["type"] == "block"]

    if not lines and not arcs and not circles and not polys:
        return None
```

Find the `GeometrySummary(...)` construction:

```python
    summary = GeometrySummary(
        line_count=len(lines),
        arc_count=len(arcs),
        polyline_count=len(polys),
        block_count=len(blocks),
        bbox=bbox,
        aspect_ratio=aspect_ratio(bbox),
    )
```

Add `circle_count=len(circles),` after `arc_count=len(arcs),`.

Find the `OpeningCandidate(...)` construction at the bottom and add `circles=circles,` after
`arcs=arcs,`:

```python
    return OpeningCandidate(
        handle=handle,
        layer=layer,
        bbox=bbox,
        lines=lines,
        arcs=arcs,
        circles=circles,
        closed_polylines=polys,
        block_name=block_name,
        signature=sig,
        summary=summary,
    )
```

- [ ] **Step 6: Extend `compute_bbox()` to include circles**

Find `compute_bbox()`'s `elif e["type"] == "arc":` branch:

```python
        elif e["type"] == "arc":
            r = e["radius"]
            cx, cy = e["center"]
            xs += [cx - r, cx + r]
            ys += [cy - r, cy + r]
```

Add directly after it (circles use the same bbox math as arcs -- a full circle's bbox is the
same formula as an arc's):

```python
        elif e["type"] == "circle":
            r = e["radius"]
            cx, cy = e["center"]
            xs += [cx - r, cx + r]
            ys += [cy - r, cy + r]
```

- [ ] **Step 7: Run to verify it passes**

Run: `python -m pytest tests/test_opening_candidate_builder.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 8: Run the detector's own tests once more (they consume `OpeningCandidate` too)**

Run: `python -m pytest tests/test_opening_detector.py -v`
Expected: PASS, unaffected by this task's dataclass field addition (defaults keep every
existing caller compatible).

- [ ] **Step 9: Stage**

```bash
git add src/cad_intelligence/semantic/opening_candidate.py src/cad_intelligence/semantic/geometry_signature.py tests/test_opening_candidate_builder.py
```

---

### Task 4: `CIRCLE` evidence extraction

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_symbol_evidence.py`
- Test: `tests/test_opening_features.py` or a dedicated evidence-extractor test file --
  check which file currently tests `OpeningEvidenceExtractor.extract()`'s `ARC` branch (it's
  likely `tests/test_opening_features.py`'s `TestOpeningEvidenceExtractor` class per Task 1
  of the arc-radius PR) and mirror it there.

- [ ] **Step 1: Write the failing test**

Add to whichever test class already covers `OpeningEvidenceExtractor.extract()`'s `ARC`
extraction (mirror `test_extracts_parallel_and_center_line`'s structure):

```python
def test_extracts_circle_evidence() -> None:
    candidate = OpeningCandidate(
        handle="h1", layer="A-DOOR", bbox=(0.0, 0.0, 900.0, 900.0),
        circles=({"handle": "C1", "center": (450.0, 450.0), "radius": 450.0},),
    )
    evidence = OpeningEvidenceExtractor().extract(candidate)
    circle_items = [it for it in evidence.evidence_items if it.kind == EvidenceKind.CIRCLE]
    assert len(circle_items) == 1
    assert circle_items[0].entity_ids == ("C1",)
    assert circle_items[0].attributes["radius"] == 450.0
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_opening_features.py -k circle_evidence -v`
Expected: FAIL -- `circle_items` is empty (no `CIRCLE` extraction logic exists yet)

- [ ] **Step 3: Add the `CIRCLE` extraction block**

In `src/cad_intelligence/semantic/opening_symbol_evidence.py`, find the `# 4. ARC` block in
`extract()`:

```python
        # 4. ARC — 호
        for arc in getattr(candidate, "arcs", ()):
            sweep = self._arc_sweep_deg(arc)
            items.append(EvidenceItem(
                kind=EvidenceKind.ARC,
                entity_ids=(arc.get("handle", ""),),
                attributes={
                    "radius": arc.get("radius", 0.0),
                    "sweep_deg": sweep,
                },
            ))
```

Add directly after it:

```python
        # 4b. CIRCLE — 원 (회전문)
        for circle in getattr(candidate, "circles", ()):
            items.append(EvidenceItem(
                kind=EvidenceKind.CIRCLE,
                entity_ids=(circle.get("handle", ""),),
                attributes={"radius": circle.get("radius", 0.0)},
            ))
```

- [ ] **Step 4: Run to verify it passes**

Run: `python -m pytest tests/test_opening_features.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Stage**

```bash
git add src/cad_intelligence/semantic/opening_symbol_evidence.py tests/test_opening_features.py
```

---

### Task 5: `FOLD_JOINT` evidence extraction (highest-risk task -- expect iteration)

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_symbol_evidence.py`
- Test: same file as Task 4

**Read this before starting:** the spec explicitly flags this as the riskiest part of PR 4 --
there is no existing precedent for fold-angle detection in this codebase, and the "60-150
degrees" band is a starting hypothesis, not a proven threshold. Expect to run the test in
Step 2 multiple times while tuning the angle band in Step 4, exactly as the Pre-Implementation
Verification Gate is designed to surface. Do not skip Step 2's failure-mode inspection if the
first attempt doesn't produce the expected joint count.

- [ ] **Step 1: Write the failing test**

A folding/bifold door's V-joint: three points where the middle point creates a sharp
direction change. Use a synthetic open polyline shaped like a shallow "V" (not a straight
line, not a right angle) as the test case:

```python
def test_extracts_fold_joint_evidence() -> None:
    # Open polyline: (0,0) -> (450,200) -> (900,0) -- a shallow V-fold, roughly
    # 130 degrees between the two segment vectors (not straight=180, not a sharp
    # right-angle corner=90).
    candidate = OpeningCandidate(
        handle="h1", layer="A-DOOR", bbox=(0.0, 0.0, 900.0, 200.0),
        closed_polylines=(
            {
                "handle": "P1", "is_closed": False,
                "coordinates": [0.0, 0.0, 450.0, 200.0, 900.0, 0.0],
            },
        ),
    )
    evidence = OpeningEvidenceExtractor().extract(candidate)
    fold_items = [it for it in evidence.evidence_items if it.kind == EvidenceKind.FOLD_JOINT]
    assert len(fold_items) == 1
    assert fold_items[0].entity_ids == ("P1",)

def test_closed_polyline_is_not_scanned_for_fold_joints() -> None:
    """closed_polylines is not pre-filtered to actually-closed entries -- a closed
    frame polyline (a rectangle, is_closed=True) must NOT be scanned for fold
    joints even though its corners are also direction changes."""
    candidate = OpeningCandidate(
        handle="h1", layer="A-DOOR", bbox=(0.0, 0.0, 900.0, 40.0),
        closed_polylines=(
            {
                "handle": "P1", "is_closed": True,
                "coordinates": [0.0, 0.0, 900.0, 0.0, 900.0, 40.0, 0.0, 40.0],
            },
        ),
    )
    evidence = OpeningEvidenceExtractor().extract(candidate)
    fold_items = [it for it in evidence.evidence_items if it.kind == EvidenceKind.FOLD_JOINT]
    assert len(fold_items) == 0

def test_straight_polyline_has_no_fold_joint(self=None) -> None:
    """A straight (collinear) open polyline must not be flagged as a fold."""
    candidate = OpeningCandidate(
        handle="h1", layer="A-DOOR", bbox=(0.0, 0.0, 900.0, 0.0),
        closed_polylines=(
            {
                "handle": "P1", "is_closed": False,
                "coordinates": [0.0, 0.0, 450.0, 0.0, 900.0, 0.0],
            },
        ),
    )
    evidence = OpeningEvidenceExtractor().extract(candidate)
    fold_items = [it for it in evidence.evidence_items if it.kind == EvidenceKind.FOLD_JOINT]
    assert len(fold_items) == 0
```

(Remove the stray `self=None` parameter from `test_straight_polyline_has_no_fold_joint` if
your test framework/linter flags it -- it's a plain module-level function, not a method; it
was included in this snippet only to make copy-paste-into-a-class also work without edits.)

- [ ] **Step 2: Run to verify the fold-joint test fails, and the negative tests already pass**

Run: `python -m pytest tests/test_opening_features.py -k fold_joint -v`
Expected: `test_extracts_fold_joint_evidence` FAILS (no `_find_fold_joints` helper exists
yet); `test_closed_polyline_is_not_scanned_for_fold_joints` and
`test_straight_polyline_has_no_fold_joint` trivially PASS at this stage (nothing produces
`FOLD_JOINT` evidence yet, so both correctly assert zero matches) -- this is expected and
becomes a meaningful regression guard once Step 3 lands.

- [ ] **Step 3: Implement `_find_fold_joints` and wire it into `extract()`**

Add this new static method to `OpeningEvidenceExtractor` (near `_arc_sweep_deg`):

```python
    @staticmethod
    def _find_fold_joints(coords: list[float]) -> list[dict]:
        """Walk consecutive vertex triples in an OPEN polyline's coordinate list,
        flagging a joint where the direction change between consecutive segments
        falls in the 60-150 degree "sharp fold" band (neither a gentle curve nor a
        straight line). Caller must ensure `coords` comes from an open polyline --
        this function does not check `is_closed` itself."""
        points = list(zip(coords[0::2], coords[1::2]))
        if len(points) < 3:
            return []

        joints: list[dict] = []
        for i in range(1, len(points) - 1):
            p_prev, p_mid, p_next = points[i - 1], points[i], points[i + 1]
            v1 = (p_mid[0] - p_prev[0], p_mid[1] - p_prev[1])
            v2 = (p_next[0] - p_mid[0], p_next[1] - p_mid[1])
            len1 = math.hypot(*v1)
            len2 = math.hypot(*v2)
            if len1 < 1e-6 or len2 < 1e-6:
                continue
            dot = (v1[0] * v2[0] + v1[1] * v2[1]) / (len1 * len2)
            dot = max(-1.0, min(1.0, dot))  # clamp for float precision
            angle_between = math.degrees(math.acos(dot))
            direction_change = 180.0 - angle_between
            if 60.0 <= direction_change <= 150.0:
                joints.append({"vertex_index": i, "angle_deg": direction_change})
        return joints
```

Then find the `extract()` method's `# 1. FRAME` block:

```python
        # 1. FRAME — 닫힌 polyline
        for poly in getattr(candidate, "closed_polylines", ()):
            if poly.get("is_closed"):
                items.append(EvidenceItem(
                    kind=EvidenceKind.FRAME,
                    entity_ids=(poly.get("handle", ""),),
                    attributes={"vertex_count": len(poly.get("coordinates", [])) // 2},
                ))
```

Add directly after it:

```python
        # 1b. FOLD_JOINT — 접힘 관절 (접이문). closed_polylines is a misnomer --
        # it holds every polyline regardless of is_closed, so this filters
        # explicitly rather than assuming.
        for poly in getattr(candidate, "closed_polylines", ()):
            if poly.get("is_closed"):
                continue
            joints = self._find_fold_joints(poly.get("coordinates", []))
            for joint in joints:
                items.append(EvidenceItem(
                    kind=EvidenceKind.FOLD_JOINT,
                    entity_ids=(poly.get("handle", ""),),
                    attributes={"angle_deg": joint["angle_deg"]},
                ))
```

- [ ] **Step 4: Run to verify it passes -- tune the angle band if the first attempt fails**

Run: `python -m pytest tests/test_opening_features.py -k fold_joint -v`
Expected: PASS for all three tests. If `test_extracts_fold_joint_evidence` still fails,
compute the actual direction-change angle for the test fixture's V-shape by hand (segment 1:
`(0,0)->(450,200)`, segment 2: `(450,200)->(900,0)` -- symmetric, so the interior angle at
the vertex and the resulting direction-change value can be checked with a quick Python
one-liner) and adjust either the fixture's vertex position or the `60.0`/`150.0` band bounds
so the test fixture's actual angle falls inside the band with margin. This is the expected
Verification Gate iteration the spec warned about -- do not force the test to pass by
weakening the assertion instead of getting the geometry/threshold actually right.

- [ ] **Step 5: Stage**

```bash
git add src/cad_intelligence/semantic/opening_symbol_evidence.py tests/test_opening_features.py
```

---

### Task 6: `OpeningFeatures.circle_count`/`fold_joint_count`

**Files:**
- Modify: `src/cad_intelligence/semantic/opening_features.py`
- Test: `tests/test_opening_features.py`

- [ ] **Step 1: Write the failing test**

```python
def test_circle_and_fold_joint_counts_aggregate() -> None:
    evidence = OpeningEvidence(
        candidate_handle="h1",
        evidence_items=(
            EvidenceItem(kind=EvidenceKind.CIRCLE, entity_ids=("C1",), attributes={"radius": 450.0}),
            EvidenceItem(kind=EvidenceKind.FOLD_JOINT, entity_ids=("P1",), attributes={"angle_deg": 130.0}),
            EvidenceItem(kind=EvidenceKind.FOLD_JOINT, entity_ids=("P1",), attributes={"angle_deg": 125.0}),
        ),
    )
    feats = OpeningFeatureExtractor().extract(evidence)
    assert feats.circle_count == 1
    assert feats.fold_joint_count == 2
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_opening_features.py -k circle_and_fold -v`
Expected: FAIL -- `OpeningFeatures` has no `circle_count`/`fold_joint_count` attributes yet

- [ ] **Step 3: Add the fields to `OpeningFeatures`**

```python
    # Arc
    arc_count: int = 0
    arc_sweep_deg: float = 0.0
    arc_radius: float = 0.0
    # Circle / fold joint
    circle_count: int = 0
    fold_joint_count: int = 0
```

- [ ] **Step 4: Add the aggregation in `OpeningFeatureExtractor.extract()`**

Find where `arc_items`/`diagonal_items` are computed near the top of `extract()`:

```python
        arc_items = [it for it in items if it.kind == EvidenceKind.ARC]
        diagonal_items = [it for it in items if it.kind == EvidenceKind.DIAGONAL]
```

Add directly after:

```python
        circle_items = [it for it in items if it.kind == EvidenceKind.CIRCLE]
        fold_joint_items = [it for it in items if it.kind == EvidenceKind.FOLD_JOINT]
```

Then, near where `arc_count`/`diagonal_count` are computed:

```python
        circle_count = len(circle_items)
        fold_joint_count = len(fold_joint_items)
```

Add `circle_count=circle_count,` and `fold_joint_count=fold_joint_count,` to the returned
`OpeningFeatures(...)` constructor call.

- [ ] **Step 5: Run to verify it passes**

Run: `python -m pytest tests/test_opening_features.py -v`
Expected: PASS (all tests in the file)

- [ ] **Step 6: Stage**

```bash
git add src/cad_intelligence/semantic/opening_features.py tests/test_opening_features.py
```

---

### Task 7: `DoorStyle.ROTATING`/`FOLDING` + rule files

**Files:**
- Modify: `src/cad_intelligence/semantic/door_classifier.py`
- Create: `src/cad_intelligence/patterns/opening/door_rotating.yaml`
- Create: `src/cad_intelligence/patterns/opening/door_folding.yaml`
- Test: `tests/test_door_classifier.py`

- [ ] **Step 1: Write the failing tests**

Add to `tests/test_door_classifier.py`'s `TestDoorStyle` class:

```python
    def test_rotating_folding_members(self) -> None:
        assert DoorStyle.ROTATING == "rotating"
        assert DoorStyle.FOLDING == "folding"
        assert DOOR_STYLE_MAP["rotating_door"] == DoorStyle.ROTATING
        assert DOOR_STYLE_MAP["folding_door"] == DoorStyle.FOLDING
```

Add a new test class after `TestSwingRules`:

```python
class TestRotatingFoldingRules:
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

    def test_circle_with_x_cross_matches_rotating(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(circle_count=1, diagonal_count=2)
        cls = classifier.classify(feats)
        assert any(m.style == DoorStyle.ROTATING for m in cls.matches)

    def test_circle_without_diagonals_does_not_match_rotating(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(circle_count=1, diagonal_count=0)
        cls = classifier.classify(feats)
        assert not any(m.style == DoorStyle.ROTATING for m in cls.matches)

    def test_fold_joint_matches_folding(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(fold_joint_count=1)
        cls = classifier.classify(feats)
        assert any(m.style == DoorStyle.FOLDING for m in cls.matches)

    def test_no_fold_joint_does_not_match_folding(self) -> None:
        classifier = self._make_engine_classifier()
        feats = OpeningFeatures(fold_joint_count=0)
        cls = classifier.classify(feats)
        assert not any(m.style == DoorStyle.FOLDING for m in cls.matches)
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest tests/test_door_classifier.py::TestRotatingFoldingRules tests/test_door_classifier.py::TestDoorStyle::test_rotating_folding_members -v`
Expected: FAIL (no enum members, no rule files yet)

- [ ] **Step 3: Add the enum members**

In `src/cad_intelligence/semantic/door_classifier.py`, add `ROTATING = "rotating"` and
`FOLDING = "folding"` as the 9th/10th `DoorStyle` members (update the docstring's "8-type" to
"10-type"), and add `"rotating_door": DoorStyle.ROTATING`,
`"folding_door": DoorStyle.FOLDING` to `DOOR_STYLE_MAP`.

- [ ] **Step 4: Write the rule files**

Create `src/cad_intelligence/patterns/opening/door_rotating.yaml`:

```yaml
# Door rotating pattern — revolving door (hoejeonmun)
# A circle (the door's swept envelope) with an X-cross inside it (the door panels,
# approximated via 2+ diagonal lines -- see
# docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md PR 4).
rules:
  - id: DOOR-ROTATING-001
    name: rotating_door
    domain: door_detection
    requires:
      circle_count: ">=1"
      diagonal_count: ">=2"
    base_score: 0.80
    explanation:
      ko: "원과 대각선 2개 이상이 감지되어 회전문"
      en: "Circle with 2+ diagonal lines detected -- revolving door"
```

Create `src/cad_intelligence/patterns/opening/door_folding.yaml`:

```yaml
# Door folding pattern — bifold/folding door (jeomnun-mun)
# An open polyline with a sharp V-joint (60-150 degree direction change between
# consecutive segments) -- see
# docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md PR 4.
rules:
  - id: DOOR-FOLDING-001
    name: folding_door
    domain: door_detection
    requires:
      fold_joint_count: ">=1"
    base_score: 0.80
    explanation:
      ko: "접힘 관절이 감지되어 접는문"
      en: "Fold joint detected -- folding/bifold door"
```

- [ ] **Step 5: Score-ordering check against existing rules**

Confirm no existing rule's `requires` overlaps with `circle_count`/`fold_joint_count` --
grep to be sure: `grep -rn "circle_count\|fold_joint_count" src/cad_intelligence/patterns/opening/`
(expect only the two new files to reference these fields, since no prior rule used them).
Also confirm `door_rotating.yaml`'s `diagonal_count: ">=2"` doesn't collide with any existing
rule -- no other door rule requires `diagonal_count` at all (grep:
`grep -rn "diagonal_count" src/cad_intelligence/patterns/opening/` should show only
`door_rotating.yaml` requiring it as `">=2"`, and the swing/mesh rules requiring it as `0`,
which is the opposite condition -- no overlap).

- [ ] **Step 6: Run to verify tests pass**

Run: `python -m pytest tests/test_door_classifier.py -v`
Expected: PASS -- all classes in the file.

- [ ] **Step 7: Stage**

```bash
git add src/cad_intelligence/semantic/door_classifier.py src/cad_intelligence/patterns/opening/door_rotating.yaml src/cad_intelligence/patterns/opening/door_folding.yaml tests/test_door_classifier.py
```

---

### Task 8: Golden fixtures (rotating_01, folding_01) + exhaustive-match/rendering TODO

**Files:**
- Create: `tests/golden/doors/rotating_01/geometry.json`
- Create: `tests/golden/doors/folding_01/geometry.json`
- Modify: `tests/test_door_pipeline.py`
- Modify: `src/cad_intelligence/elevation/renderers/render_style.py` (comment only)

**Note on golden fixture schema:** the existing `_scan_from_geometry()` helper in
`tests/test_door_pipeline.py` only builds `lines`/`arcs`/`closed_polylines` entries from a
geometry.json today -- it has no `circles` handling yet, since no prior fixture needed one.
This task must extend that helper (Step 1 below) before the `rotating_01` fixture can be
exercised end-to-end.

- [ ] **Step 1: Extend `_scan_from_geometry()` to support circles**

In `tests/test_door_pipeline.py`, find `_scan_from_geometry()`'s loop over `geom.get("arcs", [])`:

```python
    for a in geom.get("arcs", []):
        entries.append(_FakeEntry(
            "A-DOOR", "AcDbArc", handle=a["handle"],
            center=tuple(a["center"]), radius=float(a["radius"]),
            start_angle=float(a["start_angle"]), end_angle=float(a["end_angle"]),
        ))
```

Add directly after it:

```python
    for c in geom.get("circles", []):
        entries.append(_FakeEntry(
            "A-DOOR", "AcDbCircle", handle=c["handle"],
            center=tuple(c["center"]), radius=float(c["radius"]),
        ))
```

- [ ] **Step 2: Extend `_STYLE_ENUM`**

Add `"rotating": DoorStyle.ROTATING, "folding": DoorStyle.FOLDING,` to `_STYLE_ENUM`.

- [ ] **Step 3: Write the fixtures**

Create `tests/golden/doors/rotating_01/geometry.json` -- a circle plus 2 diagonal lines
crossing inside it (approximating an X):

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Revolving door (hoejeonmun): circle with 2 crossing diagonal lines (X-cross approximation of door panels)",
  "style": "rotating",
  "lines": [
    {"handle": "L1", "start": [50, 50], "end": [850, 850]},
    {"handle": "L2", "start": [50, 850], "end": [850, 50]}
  ],
  "arcs": [],
  "circles": [
    {"handle": "CR1", "center": [450, 450], "radius": 450}
  ],
  "closed_polylines": []
}
```

Create `tests/golden/doors/folding_01/geometry.json` -- an open polyline with a fold-joint
vertex matching Task 5's tuned geometry (use whatever exact vertex position Task 5's
Verification Gate iteration confirmed works, likely the same `(0,0)->(450,200)->(900,0)`
shape or a tuned variant):

```json
{
  "schema_version": "1.0",
  "generator": "manual",
  "description": "Folding/bifold door (jeomnun-mun): open polyline with a sharp V-fold joint",
  "style": "folding",
  "lines": [],
  "arcs": [],
  "closed_polylines": [
    {"handle": "P1", "coordinates": [0, 0, 450, 200, 900, 0], "is_closed": false}
  ]
}
```

**Important:** `_scan_from_geometry()`'s existing `closed_polylines` loop
(`tests/test_door_pipeline.py`) reads `is_closed` from the fixture JSON via
`p.get("is_closed", True)` -- confirm this fixture's explicit `"is_closed": false` is
correctly passed through as an open polyline, not defaulted to closed. If the golden test
fails with the polyline being treated as a frame instead of a fold-joint source, this default
is the first place to check.

- [ ] **Step 4: Run to verify**

Run: `python -m pytest tests/test_door_pipeline.py -v`
Expected: PASS -- all prior golden cases plus `rotating_01`/`folding_01`. If either new
fixture doesn't classify as expected, investigate the geometry (per Task 5's warning, the
fold-joint threshold may need another tuning pass reflected back into both the rule file and
this fixture) rather than forcing a pass.

- [ ] **Step 5: Exhaustive-match + rendering TODO**

Run: `grep -rn "DoorStyle\." --include=*.py src/ | grep -v "test_" | grep -v "door_classifier.py" | grep -v "door_recognizer.py"`
Expected: no output (same pattern as every prior PR's verification).

Extend the `DoorStrategyRegistry` TODO comment in
`src/cad_intelligence/elevation/renderers/render_style.py` (already has TODOs for
`sliding_frameless` and `swing_single`/`swing_double`) with one more line:

```python
    # TODO: render "rotating"/"folding" with their respective glyphs (both also
    # fall back to NoOpDoorStrategy today -- see
    # docs/superpowers/specs/2026-08-06-door-taxonomy-expansion-design.md PR 4).
```

- [ ] **Step 6: Run full regression**

Run: `python -m pytest tests/ -q`
Expected: PASS, no regressions. Record the count for the CHANGELOG entry (baseline after
the arc-radius fix: 4647 passed).

- [ ] **Step 7: Stage**

```bash
git add tests/golden/doors/rotating_01 tests/golden/doors/folding_01 tests/test_door_pipeline.py src/cad_intelligence/elevation/renderers/render_style.py
```

---

### Task 9: Real-drawing re-measurement

**Files:** none committed -- measurement-only task.

- [ ] **Step 1: Re-run the pipeline against real DOOR-layer data**

Same reconstruction approach used in every prior PR's re-measurement
(`memory/drawings/diag_openings_dump.json`'s `door_entities`, `_FakeEntry`/`_FakeScanResult`
pattern) -- but this time also handle `AcDbCircle` records if any exist in the dump (check
first: `python3 -c "import json; d=json.load(open('memory/drawings/diag_openings_dump.json', encoding='utf-8')); print([e['ObjectName'] for e in d['door_entities']])" | grep -o AcDbCircle`).

- [ ] **Step 2: Record the result honestly, including a null result**

If no `AcDbCircle` entities exist in this drawing's DOOR layer (plausible -- revolving doors
are rare in residential apartment plans, which is what this reference drawing is), record
that explicitly: "0 real rotating-door candidates found in this dataset; ROTATING/FOLDING
classification is validated only via golden fixtures, not real-drawing measurement, because
this drawing type doesn't contain revolving/folding doors." This is a legitimate, honest
outcome -- do not force a fabricated measurement. Also report the overall no-match rate
(expect it unchanged from the arc-radius fix's 0.0%, since this PR only adds new
classification pathways, it doesn't change any existing candidate's evidence).

- [ ] **Step 3: No commit for this task** -- results feed into Task 10's CHANGELOG entry.

---

### Task 10: CHANGELOG + final regression

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the CHANGELOG entry**

English only, per project language policy. Include: the two new `EvidenceKind` members, the
detector/candidate/evidence-layer changes, the two new `DoorStyle` members + rules, the
fold-joint angle-band tuning outcome (report the actual final band, not just "60-150" if it
was adjusted during Task 5's Verification Gate), golden fixtures, the full-suite before/after
count, and the real-drawing re-measurement result from Task 9 (including an honest "no real
examples in this dataset" note if that's what was found).

- [ ] **Step 2: Run full regression one more time**

Run: `python -m pytest tests/ -q`
Expected: PASS, same count as Task 8 Step 6.

- [ ] **Step 3: Stage**

```bash
git add CHANGELOG.md
```

---

### Task 11: `/sync`

Run `/sync "feat(semantic,cad_io): add DoorStyle.ROTATING/FOLDING via CIRCLE/FOLD_JOINT evidence (Taxonomy PR 4, Backlog #14)"` -- final step per CLAUDE.md's Execution Plan Boilerplate.

**Before running `/sync`:** confirm `git branch --show-current` and `git log --oneline -3`
against `origin/main` -- if PR #246 is still open, this plan's own docs commit may land there;
if it merged since this plan started, switch to `main`, `git pull --ff-only`, and carry any
uncommitted work forward first.
