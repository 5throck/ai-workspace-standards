---
lang: ko
lang_reason: proper-noun
---

# Label-Anchored Voronoi Room Reconstruction (v1) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a `LABEL_VORONOI` room-detection mode that produces one room polygon per room-name text label via a Voronoi partition — the first path to reach the target 9 rooms on the reference drawing.

**Architecture:** A COM-free builder `_build_space_polygons_label_voronoi(room_labels, doors)` in `space_geometry.py` does the Voronoi partition. A new `WallProcessingMode.LABEL_VORONOI` dispatches to it from `handle_generate_spaces`, which fetches room-name text labels via the live-COM `handle_extract_text_labels` and filters them through a new `{stem}.room-labels.json` sidecar. Boundaries are Voronoi approximations (v1); wall-snapping refinement is deferred.

**Tech Stack:** Python 3, shapely 2.0+ (`shapely.voronoi_polygons`), `unittest`, existing `SpacePolygon`/`SpaceSource`/`WallProcessingMode`/`ExceptionReport`.

**Spec:** `docs/superpowers/specs/2026-08-01-label-voronoi-room-reconstruction-design.md`

---

## File Structure

- **Modify:** `src/cad_intelligence/common/models.py` — add `SpaceSource.LABEL_VORONOI`.
- **Modify:** `src/cad_intelligence/geometry/space_geometry.py` — add `WallProcessingMode.LABEL_VORONOI`, constant `LABEL_VORONOI_HULL_MARGIN_MM`, builder `_build_space_polygons_label_voronoi`.
- **Modify:** `src/cad_intelligence/cad_io/handlers/space.py` — dispatch branch + `_load_room_labels_sidecar` loader + unsupported-param guard.
- **Create:** `memory/drawings/아파트 평면도.room-labels.json` — the reference drawing's sidecar.
- **Modify:** `tests/test_space_geometry.py` — unit tests for the builder.
- **Modify:** `CHANGELOG.md` — `[Unreleased]` entry (English only).

---

## Task 1: Builder `_build_space_polygons_label_voronoi` + enums + unit tests (TDD, COM-free)

**Files:**
- Modify: `src/cad_intelligence/common/models.py:201` (SpaceSource enum)
- Modify: `src/cad_intelligence/geometry/space_geometry.py:348` (WallProcessingMode), constants block, new builder after `_build_space_polygons_solid_union`
- Test: `tests/test_space_geometry.py` (new class `TestBuildSpacePolygonsLabelVoronoi`)

- [ ] **Step 1: Add the two enum members**

In `models.py`, after `RECONSTRUCTED = "reconstructed"` (line 202), add:
```python
    LABEL_VORONOI = "label_voronoi"  # from label-anchored Voronoi partition (v1 approx)
```

In `space_geometry.py`, after `SOLID_UNION = 3` (line 359), add:
```python
    LABEL_VORONOI = 4
```
Also update the `WallProcessingMode` docstring to mention `LABEL_VORONOI` (label-seeded, not wall-based).

- [ ] **Step 2: Add the constant**

In `space_geometry.py` near `MIN_SPACE_AREA_MM2`, add:
```python
#: Margin (mm) by which the seed convex hull is expanded to form the v1
#: clip region for LABEL_VORONOI room partition. A tight apartment outline
#: (wall-derived) is deferred to a follow-up PR.
LABEL_VORONOI_HULL_MARGIN_MM: float = 2000.0
```

- [ ] **Step 3: Write the failing unit tests (TDD)**

In `tests/test_space_geometry.py`, add imports if not present (`SpaceSource` from common.models; `_build_space_polygons_label_voronoi`, `LABEL_VORONOI_HULL_MARGIN_MM`, `WallProcessingMode` from space_geometry) and a new test class:

```python
class TestBuildSpacePolygonsLabelVoronoi(unittest.TestCase):
    def _label(self, text, x, y):
        return {"text": text, "position": (float(x), float(y))}

    def test_three_seeds_produce_three_rooms_each_containing_its_seed(self):
        from shapely.geometry import Polygon
        labels = [self._label("A", 0, 0), self._label("B", 10000, 0), self._label("C", 5000, 8660)]
        spaces, exceptions = _build_space_polygons_label_voronoi(labels, doors=[])
        self.assertEqual(len(spaces), 3)
        for lbl, sp_poly in zip(labels, spaces):
            seed = ShapelyPoint(lbl["position"][0], lbl["position"][1])  # ShapelyPoint imported at file top
            ring = [(p[0], p[1]) for p in sp_poly.polygon_points]
            self.assertTrue(Polygon(ring).contains(seed),
                            f"room {lbl['text']} does not contain its seed")
        self.assertEqual(len(exceptions), 3)  # one LABEL_VORONOI_ROOM warning per room
        self.assertEqual(exceptions[0].code, "LABEL_VORONOI_ROOM")
        self.assertTrue(all(s.source == SpaceSource.LABEL_VORONOI for s in spaces))

    def test_two_labels_same_text_different_positions_are_two_rooms(self):
        labels = [self._label("욕실", 0, 0), self._label("욕실", 10000, 0)]
        spaces, _ = _build_space_polygons_label_voronoi(labels, doors=[])
        self.assertEqual(len(spaces), 2)

    def test_has_door_true_when_door_inside_cell(self):
        labels = [self._label("A", 0, 0), self._label("B", 20000, 0)]
        from src.cad_intelligence.common.models import DoorEntity
        doors = [DoorEntity(handle="D1", layer="A-DOOR", position=(2000.0, 0.0), width=900.0, rotation=0.0)]
        spaces, exceptions = _build_space_polygons_label_voronoi(labels, doors=doors)
        # find the room whose context has_door is True (the one containing the door)
        has_door_by_room = {e.context["room_name"]: e.context["has_door"] for e in exceptions if e.code == "LABEL_VORONOI_ROOM"}
        self.assertTrue(has_door_by_room.get("A"), "room A should have has_door True")
        self.assertFalse(has_door_by_room.get("B"), "room B should have has_door False")

    def test_empty_labels_returns_no_rooms_no_crash(self):
        spaces, exceptions = _build_space_polygons_label_voronoi([], doors=[])
        self.assertEqual(spaces, [])
        self.assertEqual(exceptions, [])

    def test_source_and_room_name_set(self):
        labels = [self._label("LIVING ROOM", 0, 0), self._label("DINING", 20000, 0)]
        spaces, _ = _build_space_polygons_label_voronoi(labels, doors=[])
        names = sorted(s.room_name for s in spaces)
        self.assertEqual(names, ["DINING", "LIVING ROOM"])
        self.assertTrue(all(s.source == SpaceSource.LABEL_VORONOI for s in spaces))
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `python -m pytest tests/test_space_geometry.py::TestBuildSpacePolygonsLabelVoronoi -v`
Expected: FAIL (`_build_space_polygons_label_voronoi` / `LABEL_VORONOI_HULL_MARGIN_MM` not defined).

- [ ] **Step 5: Implement the builder**

In `space_geometry.py`, after `_build_space_polygons_solid_union`, add (adapt imports to what the file already uses — `shapely`, `MultiPoint`/`Point` from shapely.geometry, `ExceptionReport`, `SpaceSource`, `_polygon_to_space_polygon`, `MIN_SPACE_AREA_MM2` are all already available or importable):

```python
def _build_space_polygons_label_voronoi(
    room_labels: list[dict],
    doors: list[Any],
    clip_hint: tuple[float, float, float, float] | None = None,
) -> tuple[list["SpacePolygon"], list["ExceptionReport"]]:
    """LABEL_VORONOI mode: one room polygon per room-name text label,
    via a Voronoi partition of the seed positions clipped to the seeds'
    convex hull (buffered). Boundaries are straight-line approximations
    (v1); wall-snapping refinement is deferred. Doors are used only for
    the informational ``has_door`` tag (NOT a gate in v1).

    ``room_labels``: list of ``{"text": str, "position": (x, y)}``.
    See docs/superpowers/specs/2026-08-01-label-voronoi-room-reconstruction-design.md.
    """
    import shapely
    from shapely.geometry import Point, MultiPoint

    exceptions: list[ExceptionReport] = []
    if not room_labels:
        return [], exceptions

    seeds = [(float(lbl["position"][0]), float(lbl["position"][1])) for lbl in room_labels]
    mp = MultiPoint(seeds)
    clip = mp.convex_hull.buffer(LABEL_VORONOI_HULL_MARGIN_MM)
    regions = shapely.voronoi_polygons(mp, extend_to=clip.buffer(LABEL_VORONOI_HULL_MARGIN_MM))
    cells = [c.intersection(clip) for c in regions.geoms]
    cells = [c for c in cells if c.is_valid and not c.is_empty and c.area >= MIN_SPACE_AREA_MM2]

    door_points = []
    for op in doors:
        pos = getattr(op, "position", None)
        if pos is not None:
            door_points.append(Point(float(pos[0]), float(pos[1])))

    used_ids: set[str] = set()
    spaces: list["SpacePolygon"] = []
    for lbl, (sx, sy) in zip(room_labels, seeds):
        seed_pt = Point(sx, sy)
        cell = next((c for c in cells if c.contains(seed_pt)), None)
        if cell is None:
            exceptions.append(ExceptionReport(
                code="LABEL_VORONOI_SEED_UNASSIGNED",
                severity="warning",
                message=(
                    f"Room label {lbl.get('text')!r} at ({sx:.0f},{sy:.0f}) was not "
                    "assigned a Voronoi cell (degenerate seed layout)."
                ),
                context={"text": lbl.get("text"), "position": [sx, sy]},
            ))
            continue
        has_door = any(cell.contains(dp) for dp in door_points)
        text = lbl.get("text")
        sp = _polygon_to_space_polygon(cell, used_ids)
        sp.source = SpaceSource.LABEL_VORONOI
        sp.room_name = text
        spaces.append(sp)
        exceptions.append(ExceptionReport(
            code="LABEL_VORONOI_ROOM",
            severity="warning",
            message=(
                f"Label-derived room {text!r}: area={cell.area / 1e6:.1f} m^2, "
                f"has_door={has_door} (Voronoi-approximated boundary, v1)."
            ),
            context={"room_name": text, "has_door": has_door, "area_mm2": round(cell.area, 1)},
        ))

    return spaces, exceptions
```

NOTE for the implementer: verify `_polygon_to_space_polygon`'s exact signature (it takes `(shapely_polygon, used_ids_set, axis_grid=None)` — read its definition) and that `SpaceSource` is imported in `space_geometry.py` (it produces `SpacePolygon`; if not imported, add `from .common.models import SpaceSource` or the existing relative import).

- [ ] **Step 6: Run tests to verify they pass**

Run: `python -m pytest tests/test_space_geometry.py::TestBuildSpacePolygonsLabelVoronoi -v`
Expected: 5 passed.

- [ ] **Step 7: Run full file — confirm no regressions**

Run: `python -m pytest tests/test_space_geometry.py -q`
Expected: all pass.

- [ ] **Step 8: Commit (or stage if policy-blocked)**

```bash
git add src/cad_intelligence/common/models.py src/cad_intelligence/geometry/space_geometry.py tests/test_space_geometry.py
git commit -m "feat(geometry): add _build_space_polygons_label_voronoi (LABEL_VORONOI mode)"
```
If the pre-commit hook rejects direct commits (mandates `/sync`), leave staged — do NOT use `--no-verify`.

---

## Task 2: Sidecar loader + dispatch branch in `handle_generate_spaces`

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/space.py` — new `_load_room_labels_sidecar`, new `_elev002_room_labels_path`, dispatch branch (~line 3760).

- [ ] **Step 1: Add the sidecar path + loader helpers**

Mirror the existing `_elev002_layers_json_path` / `_load_door_window_patterns` pattern (read those first). Add:
```python
def _elev002_room_labels_path(doc_name: str, path_override: str | None = None):
    if path_override:
        return Path(path_override)
    if not doc_name:
        return None
    stem = Path(doc_name).stem
    return memory_path("drawings", f"{stem}.room-labels.json")

def _load_room_labels_sidecar(doc_name: str, path_override: str | None = None):
    """Load ``{stem}.room-labels.json`` (text_layers + room_name_includes/
    excludes). Returns None if missing — the caller raises
    LABEL_VORONOI_NO_SIDECAR. Mirrors _load_door_window_patterns."""
    path = _elev002_room_labels_path(doc_name, path_override)
    if not path or not Path(path).exists():
        return None
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except Exception:
        return None
```

- [ ] **Step 2: Add the dispatch branch**

In `handle_generate_spaces` (the `resolved_mode` block ~line 3760), after the `if resolved_mode == _WPM.SOLID_UNION:` block and before the `else:`, insert an `elif resolved_mode == _WPM.LABEL_VORONOI:` branch:
```python
    elif resolved_mode == _WPM.LABEL_VORONOI:
        # LABEL_VORONOI doesn't use axis_grid/divider_lines.
        if parsed_axis_grid is not None or params.get("divider_lines"):
            space_polygons = []
            exceptions = [_ExceptionReport(
                code="LABEL_VORONOI_UNSUPPORTED_PARAM",
                severity="blocking",
                context={"reason": "axis_grid/divider_lines not supported with LABEL_VORONOI"},
            )]
        else:
            doc_name = params.get("doc_name") or ""
            sidecar = _load_room_labels_sidecar(doc_name, params.get("room_labels_path"))
            if not sidecar:
                space_polygons = []
                exceptions = [_ExceptionReport(
                    code="LABEL_VORONOI_NO_SIDECAR",
                    severity="blocking",
                    context={"reason": f"no room-labels sidecar for {doc_name!r}; cannot identify room-name labels"},
                )]
            else:
                # Fetch text labels via the live-COM handler path.
                label_result = handle_extract_text_labels({"search_layers": sidecar.get("text_layers", [])})
                raw_labels = label_result.data.get("text_labels", [])  # HandlerResult envelope: status/data/exceptions (NO .payload / .get)
                # Filter by includes/excludes
                includes = [s.lower() for s in sidecar.get("room_name_includes", [])]
                excludes = [s.lower() for s in sidecar.get("room_name_excludes", [])]
                def _qualifies(text):
                    t = " ".join(str(text).lower().split())
                    if includes:
                        return any(inc in t for inc in includes)
                    return not any(exc in t for exc in excludes)
                room_labels = [{"text": l["text"], "position": tuple(l["position"])} for l in raw_labels if _qualifies(l.get("text", ""))]
                space_polygons, exceptions = _elev002_build_space_polygons_label_voronoi(room_labels, doors=openings)
```
NOTE for the implementer — TWO required wiring steps, both easy to miss:
1. **Import alias**: `space.py` imports the solid-union builder as `_elev002_build_space_polygons_solid_union` (see the import blocks ~line 3329/3349). Add `_build_space_polygons_label_voronoi as _elev002_build_space_polygons_label_voronoi` to BOTH import blocks (the primary and the fallback), and use that alias in the dispatch call above.
2. **HandlerResult access**: `handle_extract_text_labels` returns a `HandlerResult` with `.data` (NOT `.payload`, and it has no `.get()`). The single correct form is `label_result.data.get("text_labels", [])` as shown.
Read the existing imports and `handle_extract_text_labels` in `space.py` to confirm exact names before editing.

- [ ] **Step 3: Run handler-level tests (if any exist for mode dispatch)**

Run: `python -m pytest tests/handlers/test_wall_processing_mode_dispatch.py -q`
Expected: pass (LABEL_VORONOI dispatch is COM-bound — covered by manual verification, not a unit test). Add a small unit test that `wall_processing_mode="label_voronoi"` resolves to the new enum member via `_resolve_wall_processing_mode` (mirroring the existing dispatch tests).

- [ ] **Step 4: Stage**

```bash
git add src/cad_intelligence/cad_io/handlers/space.py tests/handlers/test_wall_processing_mode_dispatch.py
```

---

## Task 3: Reference-drawing sidecar

**Files:**
- Create: `memory/drawings/아파트 평면도.room-labels.json`

- [ ] **Step 1: Create the sidecar**

```json
{
  "text_layers": ["7TXT", "4TXT"],
  "room_name_includes": ["LIVING ROOM", "DINING ROOM", "MAIN ROOM", "ROOM #1", "ROOM #2", "욕실", "파우더 & 드레스룸", "ENTRANCE"],
  "room_name_excludes": ["WET ZONE"]
}
```

- [ ] **Step 2: Stage**

```bash
git add "memory/drawings/아파트 평면도.room-labels.json"
```

---

## Task 4: CHANGELOG + `/sync` + manual verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add CHANGELOG entry** (English only — no Korean drawing names or label text; describe them in English)

Under `[Unreleased]` → `### Added`:
```markdown
- **[2026-08-01]**: **Added `LABEL_VORONOI` room-detection mode** (`src/cad_intelligence/geometry/space_geometry.py`, `space.py`, `common/models.py`) — the first path to reach the target room count on the reference drawing, where every geometry-only mode (ENDPOINT_CLUSTER, SOLID_UNION, plus the prior opening-pair and per-opening wall-synthesis attempts) plateaued at 4-5 rooms. Verified by live+prototype diagnostics that the drawing's wall data is too over-fragmented and context-polluted to enclose the labeled rooms (543 raw polygon fragments, zero containing any room label). The new mode takes room-name text labels as seeds (read via `zwcad_extract_text_labels`, identified by a new per-drawing `{stem}.room-labels.json` sidecar) and produces one room polygon per label via a `shapely.voronoi_polygons` partition clipped to the seeds' convex hull. Boundaries are straight-line Voronoi approximations (v1, over-estimated ~2.5x; wall-snapping refinement deferred). Each room carries `source=SpaceSource.LABEL_VORONOI`, `room_name`, and an informational `has_door` flag (in the `LABEL_VORONOI_ROOM` exception context) — the door-presence validation GATE is deferred to a future enclosed-room path. 5 new COM-free unit tests for `_build_space_polygons_label_voronoi`. See `docs/superpowers/specs/2026-08-01-label-voronoi-room-reconstruction-design.md` and `docs/superpowers/plans/2026-08-01-label-voronoi-room-reconstruction.md`.
```

- [ ] **Step 2: Manual verification checklist (post-merge, MCP restart)**

After the PR merges and the user restarts the MCP connection:
- `zwcad_classify_layers` (any mode) is NOT needed for LABEL_VORONOI, but confirm the sidecar loads.
- Call `zwcad_generate_spaces` with `wall_processing_mode="label_voronoi"`.
- Confirm: **9 rooms** (the target — first time reached), each with `source="label_voronoi"` and a `room_name`. Record the `LABEL_VORONOI_ROOM` exception list and `has_door` distribution.
- Report honestly. Compare to the prior ceiling of 4-5.

- [ ] **Step 3: Run `/sync`** — the final step (lifecycle + audit + commit + push + PR). No manual `git commit`.
