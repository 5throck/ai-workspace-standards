---
lang: ko
lang_reason: source-material
---

# ADR-002: `com_bridge.py` V3 Decomposition — Parallel-Copy Versioning Design

> **Spec ID**: ADR-002
> **Version**: 1.1 (design, V3 promoted — V2 fallback removed)
> **Status**: Implemented — V3 is now the sole dispatch path; V2 fallback retired
> **Created**: 2026-07-04
> **Updated**: 2026-07-05
> **Authors**: architect
> **Source**: User-approved V1/V2/V3 parallel-versioning strategy, following the ELEV-001/ELEV-002 precedent in this codebase
> **Supersedes**: none (additive only — see §1)
> **Related**: [`PKG-001-cad-intelligence-restructure-design.md`](../designs/PKG-001-cad-intelligence-restructure-design.md) (§4-1 flagged this decomposition as future ADR-002 work), [`docs/adr/ADR-001-architecture-graph.md`](ADR-001-architecture-graph.md), [`AI-002-graph-driven-rendering-design.md`](../designs/AI-002-graph-driven-rendering-design.md) (consumes the V3 handlers this ADR produces)

---

## 1. Overview

`src/cad_intelligence/cad_io/com_bridge.py` (6923 lines) is currently a monolith mixing COM primitives (bridge class, entity bbox helpers, validation, exceptions) with ~49 `handle_*` domain-orchestration functions spanning drawing I/O, layer/entity classification, space/room generation, elevation projection, and Korean building-code compliance. `PKG-001` (already implemented) explicitly deferred this internal decomposition, flagging it as future ADR-002 work.

**Why a pure-copy parallel structure instead of decomposing V2 in place**: this is an explicit user decision, not the architect's first-choice recommendation. In isolation, refactoring `com_bridge.py` in place (splitting handlers into files, keeping `server.py`'s dispatch working throughout) is the conventional approach. The user instead chose to follow the **V1/V2/V3 parallel-versioning pattern already established in this codebase** for exactly this kind of high-risk change:

- **ELEV-001 (v1, room-centric detection)** was kept fully intact and callable as a fallback path when **ELEV-002 (v2, wall-centric detection)** was introduced — see `ELEV-002-design.md` §1, "v1과의 통합 전략": *"v1(`handle_detect_spaces`/`handle_generate_room_elevations`)은 fallback 경로로 유지한다... v2가 두 테스트 도면 모두에서 Phase 3 체크포인트를 통과하면, v1 도구는 `deprecated`로 표시(삭제 아님)."* The old version was never deleted until the new version was proven, and even then it was deprecated, not removed, pending a separate cleanup decision.
- This ADR applies the identical pattern one layer down: **V1** = `src/agent/cad_agent.py`'s self-contained `ZWCADAgentBridge`, **V2** = `com_bridge.py`'s current monolithic `handle_*` dispatch (both untouched, do-not-touch per the user's brief), **V3** = a new decomposed file layout that is a byte-for-byte-equivalent copy of V2's handler logic, reorganized into layered files.

**Why this avoids risk**: `com_bridge.py` is depended on by ~54 tests (`test_mcp_server.py` mocking individual handlers; `test_com_bridge_stubs.py` and `test_live_zwcad_closed_loop.py` patching `_get_bridge` and calling real handler functions) and by the live-production `server.py`, which dispatches every MCP tool call via `getattr(com_bridge_module, name)`. An in-place refactor risks:
- Breaking `getattr(com_bridge_module, name)` dispatch if any handler is moved out of the module namespace `server.py` expects.
- Silently changing behavior for any of the 49 handlers during the mechanical "split into files" pass, undetectable until a specific test or production call path exercises it.
- Blocking on resolving handler-to-handler auto-chaining call sites (e.g., `handle_assign_openings` → `handle_generate_wall_model` → `handle_generate_axis_grid` → `handle_extract_cad_objects` → `handle_generate_spaces`) *before* any file can be safely split, since a wrong split order creates real Python import cycles, not just organizational debt.

A pure-copy parallel structure sidesteps all three: V2 is never edited, so the 54 existing tests and `server.py`'s dispatch table have zero-line-diff exposure to this work. V3 can be validated independently (own tests, own dependency-direction checks) before any future decision to promote it and retire V2.

---

## 2. Function-to-New-File Mapping

All new files live under `src/cad_intelligence/cad_io/`. `com_primitives_v3.py` is a sibling of the existing `handlers/` package (new); `handlers/` is new and contains the 5 domain files.

```
src/cad_intelligence/cad_io/
├── com_bridge.py                 # V2 — UNCHANGED, zero-line diff (hard requirement, §4)
├── com_primitives_v3.py          # NEW — COM primitives, copied from com_bridge.py
└── handlers/                     # NEW package
    ├── __init__.py               # NEW — empty or re-export docstring only
    ├── drawing.py                 # NEW — leaf domain-handler file
    ├── classification.py          # NEW
    ├── space.py                   # NEW
    ├── elevation.py                # NEW
    └── compliance.py               # NEW
```

### 2.1 `com_primitives_v3.py`

Copy (not move) from `com_bridge.py`, verified line numbers as of this design:

| Symbol | V2 source location | Kind |
|---|---|---|
| `ZWCADConnectionError` | `com_bridge.py:36` | exception class |
| `BoundaryViolationError` | `com_bridge.py:40` | exception class |
| `LayerOperationError` | `com_bridge.py:44` | exception class |
| `ZWCADComBridge` | `com_bridge.py:162` | class (COM connection wrapper) |
| `_get_bridge()` | `com_bridge.py:272` | function (bridge singleton accessor) |
| `_get_entity_bbox()` | `com_bridge.py:303` | function (entity bounding-box helper) |
| any other module-level validation helper referenced by 2+ handler groups below (e.g. shared coordinate/layer-name validators) | scattered in `com_bridge.py` between primitives and first `handle_*` def at line 333 | function |

Implementers must scan lines 1–332 of `com_bridge.py` in full during Part 1 implementation to catch any additional shared helper not enumerated above (this table is derived from the investigation facts in the brief, not an exhaustive line-by-line audit) and add it to `com_primitives_v3.py` alongside the confirmed symbols.

### 2.2 `handlers/drawing.py` — pure CAD-IO handlers (leaf layer)

Copy from `com_bridge.py`, no cross-module (geometry/semantic/graph/plugins) imports in the originals:

`handle_draw_line`, `handle_draw_polyline`, `handle_draw_text`, `handle_get_active_document_info`, `handle_get_selected_geometry`, `handle_list_layers`, `handle_set_layer_state`, `handle_draw_circle`, `handle_draw_arc`, `handle_apply_hatch`, `handle_draw_aligned_dimension`, `handle_draw_mtext`, `handle_insert_block`, `handle_start_undo_marker`, `handle_end_undo_marker`, `handle_extract_drawing_model`, `handle_save_drawing`, `handle_open_drawing`, `handle_new_drawing`, `handle_close_drawing`, `handle_move_entity`, `handle_rotate_entity`, `handle_delete_entity`, `handle_mirror_entity`, `handle_offset_entity`, `handle_copy_entity`, `handle_create_layer`, `handle_set_entity_layer`, `handle_delete_layer`, `handle_apply_layer_standards`, `handle_execute_batch`

(30 handlers, matching the "~30 pure CAD-IO handlers" investigation figure.)

### 2.3 `handlers/classification.py` — domain-orchestration + borderline elevation-adjacent handlers with no cross-module import

`handle_analyze_layers`, `handle_classify_layers`, `handle_extract_cad_objects`, `handle_classify_entities`

(4 handlers. `handle_classify_entities` is grouped here rather than in `elevation.py` because it classifies entities generically, independent of elevation projection — implementers must verify this against actual call sites per §3 and relocate if the call graph disagrees.)

### 2.4 `handlers/space.py` — geometry/semantic/graph-dependent domain-orchestration handlers

`handle_generate_spaces`, `handle_generate_axis_grid`, `handle_find_opening_candidates`, `handle_assign_openings`, `handle_map_space_info`, `handle_generate_wall_model`, `handle_detect_spaces`

(7 handlers. `handle_detect_spaces` — the v1/ELEV-001 room-centric detection fallback — is grouped here rather than in `elevation.py` because it produces space/room data, not elevation drawings; verify against §3.)

### 2.5 `handlers/elevation.py` — elevation projection/drawing handlers

`handle_generate_wall_elevations`, `handle_classify_entities`'s elevation-adjacent siblings — actually: `handle_project_to_elevation`, `handle_draw_elevation`, `handle_draw_title_block`, `handle_apply_material_hatch`, `handle_generate_all_elevations`, `handle_generate_room_elevations`

(6 handlers, matching the "borderline elevation handlers" investigation group minus `handle_classify_entities`/`handle_detect_spaces`, which are reassigned to §2.3/§2.4 above by function, not by the original informal grouping. This reassignment is an explicit design decision the implementer must honor — see §3 for the escalation path if dependency analysis disagrees.)

### 2.6 `handlers/compliance.py` — Korean building-code compliance orchestration

`handle_check_compliance`

(1 handler, depends on `plugins/compliance.py` — that dependency is unaffected by this ADR; `plugins/compliance.py` is not copied or modified.)

### 2.7 Coverage check

30 (drawing) + 4 (classification) + 7 (space) + 6 (elevation) + 1 (compliance) = 48. The investigation facts total ~49 handlers (30 + 12 + 8 with the two-handler overlap resolved as in §2.3/§2.4 above minus the 1 double-counted `handle_classify_entities` in the original informal grouping). Implementer must produce the exact final count during Part 1 by grepping `^def handle_` in `com_bridge.py` and diffing against the 5 files' combined symbol list — **zero handlers dropped, zero duplicated** is a hard acceptance criterion (§6).

---

## 3. Dependency Direction Rule

Enforced import direction between `handlers/*.py` files (a file may import from files listed after the arrow, never before):

```
compliance.py ──────┐
                     ▼
drawing.py  →  classification.py  →  space.py  →  elevation.py
```

Precisely:
- **`drawing.py`** is the leaf — depends only on `com_primitives_v3.py` (and `common/models.py` for dataclasses). No handler in `drawing.py` may import from `classification.py`, `space.py`, `elevation.py`, or `compliance.py`.
- **`classification.py`** may depend on `drawing.py` and `com_primitives_v3.py`.
- **`space.py`** may depend on `classification.py`, `drawing.py`, and `com_primitives_v3.py`.
- **`elevation.py`** may depend on `space.py`, `drawing.py`, and `com_primitives_v3.py`.
- **`compliance.py`** depends only on `drawing.py` and `com_primitives_v3.py` (plus `plugins/compliance.py`, external to this layering).

**Verification obligation**: this ordering is derived from the investigation facts' informal handler groupings, not from a line-by-line trace of every one of the ~49 handlers' internal call sites. Implementers **must** verify this against the actual handler-to-handler call sites during Part 1 implementation — the brief already documents extensive auto-chaining (e.g. `handle_assign_openings` calls `handle_generate_wall_model` → `handle_generate_axis_grid` → `handle_extract_cad_objects` → `handle_generate_spaces`), and any such chain that runs in the *wrong* direction relative to the table above (e.g. a `drawing.py` handler calling into `space.py`) is a real problem.

**Resolution rule when a dependency runs the wrong direction**: do not force a cross-import that would create a cycle. Instead, promote the shared function to the lower-layer file (e.g., if a nominal `drawing.py` handler is found to call a `classification.py` function, either (a) move that specific shared helper down into `drawing.py` or `com_primitives_v3.py` if it has no real classification-specific logic, or (b) reclassify the calling handler up into `classification.py` if the call is intrinsic to its purpose). Record any such reclassification as a deviation note in the PR description referencing this ADR section — do not silently move a handler between the file groups listed in §2 without a note.

---

## 4. V2/`server.py` Non-Modification Guarantee

**V2 (`com_bridge.py`) and `server.py` must not be modified by this work AT ALL — zero-line diff is a hard acceptance criterion.**

- The V3 handlers in `handlers/*.py` and `com_primitives_v3.py` are **copies**, not moves. `com_bridge.py` keeps every one of its ~49 `handle_*` functions and its `ZWCADComBridge`/`_get_bridge`/`_get_entity_bbox`/exception classes exactly as they are today.
- Each new V3 file carries a header comment noting it is a copy of the corresponding V2 function(s), e.g.:
  ```python
  """
  handlers/drawing.py — V3 copy of com_bridge.py's pure CAD-IO handlers
  (ADR-002). V2 (cad_io/com_bridge.py) remains the source of truth until
  V3 is separately validated and promoted (out of scope for this ADR).
  Do not edit V2 to keep this file in sync — port changes here manually
  if V2 changes before V3 promotion.
  """
  ```
- V2 remains the **source of truth** until V3 is separately validated and promoted to replace it in a future, distinct piece of work (explicitly out of scope here — see §5).
- `server.py`'s MCP tool registry (`TOOL_SCHEMAS`/`TOOL_HANDLER_MAP`/`_handle_tools_call`, dispatching via `getattr(com_bridge_module, name)`) is not touched — it continues to dispatch to V2 exclusively. V3 handlers are not registered anywhere in this ADR's scope.

---

## 5. Out of Scope

1. ~~**Retiring V2**~~ — **COMPLETED (2026-07-05)**. V2 fallback removed from `server.py` dispatch. All MCP tools now route exclusively through V3 handlers. ELEV-001 handlers (`handlers/elevation.py`) fully deleted. See §8 Retirement Record below.
2. ~~**Wiring V3 handlers into `server.py`'s MCP tool registry**~~ — **COMPLETED (2026-07-05)**. V3 handlers are now the sole dispatch path via `_V3_HANDLER_MAP`. ELEV-001 tool entries removed from `_TOOL_DISPATCH`.
3. **Stair/Slab support** — neither `com_bridge.py` nor the V3 copies gain any new Stair/Slab handling capability. This ADR is a structural copy-and-reorganize pass; it does not add functionality absent from V2. (Stair/Slab rendering is separately tracked as out of scope in `AI-002-graph-driven-rendering-design.md` §RENDER-001, for the same underlying reason — see that document's geometry-field gap discussion.)

---

## 8. Retirement Record (2026-07-05)

V3 has been promoted to sole dispatch path. The following changes were made:

| Action | Details |
|---------|---------|
| **V2 fallback removed** | `server.py` dispatch no longer falls back to `getattr(_com_bridge, handler_name)`. V3 is mandatory. |
| **ELEV-001 handlers deleted** | `handlers/elevation.py` (~2511 lines) removed — 8 handlers: `classify_entities`, `project_to_elevation`, `draw_elevation`, `draw_title_block`, `apply_material_hatch`, `generate_all_elevations`, `detect_spaces`, `generate_room_elevations`. |
| **8 tool entries removed** | `_TOOL_DISPATCH` no longer registers ELEV-001 tools. Elevation generation uses ELEV-002 pipeline only: `zwcad_generate_wall_model` → `zwcad_generate_wall_elevations`. |
| **4 HTTP endpoints removed** | `cad_agent.py` endpoints removed: `/classify-preview`, `/generate-elevation`, `/detect-spaces`, `/generate-room-elevations`. |
| **V2 code preserved** | `com_bridge.py` handler methods remain in file but are unreachable from server dispatch. Future cleanup (deletion) is a separate decision. |

---

## 6. Acceptance Criteria

- [ ] `src/cad_intelligence/cad_io/com_primitives_v3.py` exists, containing `ZWCADConnectionError`, `BoundaryViolationError`, `LayerOperationError`, `ZWCADComBridge`, `_get_bridge()`, `_get_entity_bbox()`, and any additional shared validation helper found during the §2.1 full-scan.
- [ ] `src/cad_intelligence/cad_io/handlers/__init__.py`, `drawing.py`, `classification.py`, `space.py`, `elevation.py`, `compliance.py` all exist.
- [ ] Every one of the ~49 `handle_*` functions in `com_bridge.py` has exactly one corresponding copy in exactly one of the 5 `handlers/*.py` files — zero dropped, zero duplicated (verified by a grep-and-diff pass, not by eye).
- [ ] Each `handlers/*.py` file and `com_primitives_v3.py` carries the header comment specified in §4 noting it is a copy of V2, with V2 as source of truth.
- [ ] The import graph among `drawing.py → classification.py → space.py → elevation.py` and `compliance.py → drawing.py` matches §3's declared direction, OR any deviation is documented as a reclassification note per §3's resolution rule.
- [ ] `git diff` against `main` for `src/cad_intelligence/cad_io/com_bridge.py` and `src/cad_intelligence/cad_io/server.py` is empty (zero-line diff, hard requirement).
- [ ] The existing 54 tests referencing `com_bridge.py` (`test_mcp_server.py`, `test_com_bridge_stubs.py`, `test_live_zwcad_closed_loop.py`) all still pass unmodified, confirming V2 was untouched.
- [ ] A new V3-specific test suite (e.g. `tests/test_com_bridge_v3_handlers.py`) exists exercising each copied handler at minimum via the same `_get_bridge`/COM-stub patching convention used by `test_com_bridge_stubs.py`, confirming the copies are behaviorally equivalent to V2 at time of copy.
- [ ] `python -m pytest tests/ -k "not live_zwcad" -q` shows zero new failures compared to the pre-ADR-002 baseline.

---

## 7. Notes

- This design intentionally does not attempt to resolve the exact final per-file handler count in advance of implementation (§2.7) — the ~49 figure carries a documented +/-1 uncertainty from the investigation phase, and the grep-and-diff verification in the acceptance criteria is the actual source of truth, not this table.
- Implementation completion should be recorded in `CHANGELOG.md [Unreleased]` (`/changelog` skill), followed by the `/sync` pipeline for commit/PR.
