# TAKEOFF-001: Quantity Takeoff

> **Spec ID**: TAKEOFF-001
> **Version**: 1.1
> **Status**: Implemented (M4 scope — wall length, floor area, opening deduction)
> **Created**: 2026-07-05
> **Updated**: 2026-07-09 — M4 implementation landed under `src/cad_intelligence/takeoff/`; `zwcad_generate_takeoff` MCP tool registered.
> **Authors**: architect
> **Pattern**: Rule 2
> **Rationale**: deterministic Graph query, no policy engine, no LLM orchestration
> **Source**: V3 completion — feature specification for quantity takeoff
> **Related**: [`GRAPH-001`](GRAPH-001-design.md) (Data Sources), [`API-001`](API-001-design.md) (MCP Tool), [`SCHED-001`](SCHED-001-design.md) (Schedules), [`TEST-001`](TEST-001-design.md) (Verification), [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md) §13.2 (Rule 2 — `SupportsBuilder` Protocol)

---

## 0. Implementation Notes (2026-07-09)

M4 scope implemented under `src/cad_intelligence/takeoff/` (`takeoff_model.py`, `takeoff_builder.py`, `takeoff_exporter.py`, `errors.py`), following the file-split convention from `facade/` and the `SupportsBuilder`/`SupportsApplicationSpec` Protocol conformance of `graph/builder.py`'s `ElevationBuilder` (the Rule 2 reference implementation). MCP tool `zwcad_generate_takeoff` registered as a COM-free handler in `src/cad_intelligence/cad_io/handlers/takeoff.py`, following the same COM-free pattern already used by `handle_build_object_candidates`.

The actual `Wall`/`Room`/`Door`/`Window` Graph dataclasses (`common/models.py`) do not carry the `wall_type`/`layer` (Wall) or `Perimeter` (Room) fields this design originally sketched — those were illustrative, not present on the Graph schema. The implementation substitutes `Wall.direction` for the "Wall Type"/"Layer" columns and omits the Room perimeter column (no polygon data is stored on the `Room` node); the Structural/Partition/Exterior wall-type breakdown in §2.1 is likewise not implemented since no such classification field exists at M4 — the Summary Table instead reports a single Gross/Deduction/Net total across all walls. This is a scope adaptation to the real schema, not a deviation from the Rule 2 pattern itself.

---

## Scope

Automated quantity takeoff — computing material quantities (wall lengths, floor areas, opening deductions) from the Architecture Graph. Output formats: Excel, CSV, JSON.

---

## 1. Quantity Categories

### 1.1 Wall Length Takeoff

| Column | Type | Source |
|--------|------|--------|
| Wall Type | str | `Wall.wall_type` |
| Layer | str | `Wall.layer` |
| Length (m) | float | `Wall.length_mm / 1000` |
| Height (m) | float | `Wall.height_mm / 1000` |
| Area (m²) | float | length × height |
| Count | int | 1 per wall segment |
| Room | str | Adjacent room(s) via BOUNDED_BY |

### 1.2 Floor Area Takeoff

| Column | Type | Source |
|--------|------|--------|
| Room | str | `Room.name` |
| Area (m²) | float | `Room.area_mm2 / 1_000_000` |
| Floor Finish | str | From metadata |
| Perimeter (m) | float | Room polygon perimeter / 1000 |

### 1.3 Opening Deduction

| Column | Type | Source |
|--------|------|--------|
| Opening Type | str | `Opening.opening_type` |
| Wall | str | Hosting wall UID |
| Width (m) | float | `Opening.width_mm / 1000` |
| Height (m) | float | From Door/Window height_mm |
| Area (m²) | float | width × height |
| Deduct From | str | Wall type for deduction |

### 1.4 Net Wall Area

```
Gross Wall Area = sum(wall.length × wall.height) per wall_type
Opening Deduction = sum(opening.width × opening.height) per wall_type
Net Wall Area = Gross - Deduction
```

---

## 2. Report Structure

### 2.1 Summary Table

| Category | Gross | Deduction | Net |
|----------|-------|-----------|-----|
| Structural walls (m²) | ... | ... | ... |
| Partition walls (m²) | ... | ... | ... |
| Exterior walls (m²) | ... | ... | ... |
| Floor area (m²) | ... | — | ... |

### 2.2 Detail Tables

One worksheet per category (wall lengths, floor areas, openings, deductions).

---

## 3. Data Sources

Per [`GRAPH-001`](GRAPH-001-design.md):

| Quantity | Graph Nodes | Fields |
|----------|-------------|--------|
| Wall length | `Wall` | length_mm, height_mm, wall_type |
| Floor area | `Room` | area_mm2, name |
| Opening area | `Door`, `Window` | width_mm, height_mm |
| Wall-opening link | `Wall` → `Opening` | HOSTS / CONTAINS_OPENING edges |

---

## 4. MCP Tool

```
zwcad_generate_takeoff
  Input:
    - categories: ["walls", "floors", "openings", "all"] (default: "all")
    - format: "excel" | "csv" | "json" (default: "excel")
    - include_deduction: bool (default: true)
    - output_path: str (optional)
  Output:
    - status: "success"
    - file_path: str
    - summary: dict
    - exceptions: list
```

---

## 5. Implementation Notes

- **M4 scope**: Wall length, floor area, basic opening deduction
- **M5 scope**: Material-specific takeoff (concrete volume, steel reinforcement), unit cost integration
- **Dependencies**: `openpyxl` for Excel export

---

## 6. Test Strategy

Per [`TEST-001`](TEST-001-design.md):

- Unit: area calculation, deduction computation, net area formula
- Integration: full takeoff on reference DWG with known room areas
- Golden: expected takeoff CSV for test drawing
