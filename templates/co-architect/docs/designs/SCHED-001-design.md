# SCHED-001: Finish / Door / Window Schedule Generation

> **Spec ID**: SCHED-001
> **Version**: 1.1
> **Status**: Implemented (Door/Window schedule only — Finish Schedule deferred, needs CEIL-001)
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: V3 completion — feature specification for schedule generation
> **Related**: [`GRAPH-001`](GRAPH-001-design.md) (Data Sources), [`API-001`](API-001-design.md) (MCP Tool), [`TEST-001`](TEST-001-design.md) (Verification)
> **Pattern**: Rule 2
> **Rationale**: deterministic Graph query, no policy engine, no LLM orchestration (ADR-007 §13.7)

---

## Scope

Automated generation of architectural schedules (door schedule, window schedule, finish schedule) from the Architecture Graph. Output formats: Excel (.xlsx), CSV.

---

## 1. Data Sources

Per [`GRAPH-001`](GRAPH-001-design.md):

| Schedule | Graph Nodes | Key Fields |
|----------|-------------|------------|
| Door Schedule | `Door` nodes + `Wall` (hosting) | width, height, type, face_label, room, wall_type |
| Window Schedule | `Window` nodes + `Wall` (hosting) | width, height, sill_height, type, room, wall_type |
| Finish Schedule | `Room` nodes + `Wall` nodes | room name, area, wall type, floor finish, wall finish |

---

## 2. Door Schedule

### 2.1 Table Schema

| Column | Type | Source |
|--------|------|--------|
| No. | int | Sequential |
| Room | str | `Room.name` (via ACCESSED_BY edge) |
| Type | str | `Door.door_type` (swing/sliding/pocket) |
| Width | float | `Door.width_mm` |
| Height | float | `Door.height_mm` |
| Frame Material | str | Inferred from wall layer or annotation |
| Face Direction | str | `Door.face_label` (N/S/E/W) |
| Opening Type | str | `Opening.opening_type` |
| Wall Type | str | `Wall.wall_type` (structural/partition/exterior) |
| Host Wall | str | `Wall.uid` |

### 2.2 Export Format

- Excel: `openpyxl` — one worksheet per schedule type
- CSV: one file per schedule type, UTF-8 with BOM for Korean text

---

## 3. Window Schedule

### 3.1 Table Schema

| Column | Type | Source |
|--------|------|--------|
| No. | int | Sequential |
| Room | str | Adjacent room(s) via BOUNDED_BY edge |
| Type | str | `Window.window_type` (sliding/casement/fixed) |
| Width | float | `Window.width_mm` |
| Height | float | `Window.height_mm` |
| Sill Height | float | `Window.sill_height_mm` |
| Wall Type | str | `Wall.wall_type` |
| Face Direction | str | Inferred from wall orientation |

---

## 4. Finish Schedule

### 4.1 Table Schema

| Column | Type | Source |
|--------|------|--------|
| Room | str | `Room.name` |
| Area (m²) | float | `Room.area_mm2 / 1_000_000` |
| Floor Finish | str | From room metadata or inference |
| Wall Finish | str | From wall layer classification |
| Ceiling Finish | str | From ceiling zone model (CEIL-001) |
| Base Finish | str | From wall layer annotation |

---

## 5. MCP Tool

```
zwcad_generate_schedule
  Input:
    - schedule_type: "door" | "window" | "finish" | "all"
    - format: "excel" | "csv" (default: "excel")
    - output_path: str (optional — auto-generated if omitted)
  Output:
    - status: "success"
    - file_path: str
    - row_count: int
    - exceptions: list
```

Tool naming follows [`API-001`](API-001-design.md) convention: `zwcad_{domain}_{action}`.

---

## 6. Implementation Notes

- **M4 scope (Implemented)**: Door and Window schedules, built as `src/cad_intelligence/schedule/` (`ScheduleBuilder`, `ScheduleSpec`, `ScheduleExporter`), mirroring `takeoff/`'s Rule 2 reference-implementation file split. MCP tool `zwcad_generate_schedule` registered in `cad_io/server.py`; handler at `cad_io/handlers/schedule.py`.
- **M5 scope — remains open**: Finish schedule (requires CEIL-001's ceiling-finish data model, which does not exist yet). `ScheduleBuilder.build()` raises `ScheduleValidationError` if `schedule_type="finish"` is requested, so callers get an explicit, actionable error rather than a silently empty result. Revisit once CEIL-001 ships.
- **Dependencies**: `openpyxl` for Excel export (already in project dependencies).
- **Known deviations from this design doc** (documented in `schedule_model.py`/`schedule_exporter.py` docstrings):
  - §2.1's "Face Direction" and "Wall Type" columns collapse into one `direction` field (`Wall.direction`) — the actual `Wall` dataclass has no `wall_type` classification field. Same convention `TakeoffBuilder`/`WallQuantityLine` already use.
  - §2.1's "Opening Type" (`Opening.opening_type`) and §3.1's "Type" (`Window.window_type`) columns are omitted — no equivalent Graph node/field exists in the actual `ArchitectureGraph` model (`common/models.py`).
  - §3.1's "Room via BOUNDED_BY edge" resolves via `Wall.room_ids` instead, matching how the Graph is actually wired (`graph/arch_graph.py`) and how `TakeoffBuilder` resolves room labels.
  - §2.2's "one CSV file per schedule type" is implemented as one CSV file with "# Doors" / "# Windows" sections, mirroring `TakeoffExporter`'s section convention, to keep a single `file_path` return value matching §5's MCP output contract.
  - Width/Height/Sill Height columns stay in millimeters (no meter conversion), matching this doc's own `Door.width_mm`/`Window.sill_height_mm` source-field naming.

---

## 7. Test Strategy

Per [`TEST-001`](TEST-001-design.md):

- Unit: table schema generation from graph nodes
- Integration: full pipeline → schedule generation with reference DWG
- Golden: expected schedule CSV/Excel for test drawing
