# GOLDEN-001 — Golden Dataset for Application-Layer Modules

> **Status**: Implemented (2026-07-10)
> **Category**: `docs/designs/` — Production Readiness Program §2.4
> **Decision count**: 28 (D1–D28)
> **Pattern**: Rule 2 (SupportsBuilder Protocol) — per ADR-007 §13, golden tests are deterministic Graph→export validation consumers

---

## Problem

Today's golden dataset covers only **recognition-phase** outputs (boundary/faces and entity counts). The 6 Application-layer modules — Takeoff, Section, Schedule, Review Agent, Ceiling, Facade — have **zero golden dataset coverage**. Without reference fixtures, regressions in output correctness have no tripwire.

## Design Decisions (28 items)

### Core Principles

| ID | Decision |
|----|----------|
| D1 | **Snapshot = Public Contract Only**. Snapshots capture only the **public API contract** — fields external consumers depend on. Internal fields (cache, temporary IDs, builder state, config) are never included. A whitelist per module defines exactly which top-level keys and nested fields belong to the contract. Adding an optional field does NOT break the snapshot. |
| D2 | **Graph Factory: Assembly Only, No Geometry**. Converts fixture dicts → model instances + edges. Area comes from fixture metadata, NOT computed. **Maintenance rule**: fixture geometry changes MUST update `expected_room_areas` in the same commit. Enforced by `TestFixtureMetadataConsistency` gateway test (D11b). |
| D3 | **Domain Precision Map**. Float normalization uses domain-specific precision: `length → 2`, `area → 2`, `confidence → 3`, `position → 2`, `default → 2`. Defined in `SNAPSHOT_PRECISION` dict keyed by field name suffix. **Implementation note**: relies on naming conventions; if a future contract field breaks convention, add explicit entry. Path-based precision deferred unless collisions occur. |
| D4 | **Snapshot Location**: `tests/snapshots/golden/{module}/{fixture}.json` — subdirectory per module. |
| D5 | **Snapshot Format**: `{ schema_version: 1, module: str, fixture: str, data: <contract whitelist> }`. Non-deterministic fields excluded (timestamp, created_at, generated_at). |
| D6 | **Comparison: `assert_snapshot_match()`** with explicit support scope. Recursively handles `dict`, `list`, `tuple`, `int`, `str`, `bool`, `None`, `float`. **Unsupported (raises TypeError)**: `set`, `frozenset`, `numpy`, `datetime`, `Decimal`, custom objects. Floats use `pytest.approx(abs=SNAPSHOT_PRECISION[key])` with key-path tracking. |
| D7 | **Fixture Coverage — 5 fixtures with justification**: rectangle (convex, baseline), l_shape (geometrically a Γ-shape — simple concave with 1 re-entrant corner), corridor (extreme aspect ratio 6.7:1), shared_opening (multi-room adjacency, shared opening orientation), concave (geometrically a Γ-shape — complex polygon with notch). |
| D8 | **Update Policy**: `--update-snapshots` for local developer use. CI blocks on mismatch (no auto-update). PR review must include snapshot diff. |
| D9 | **Deterministic List Ordering**. All serialized lists MUST have deterministic ordering. Unless ordering is semantically meaningful (documented as such in the contract whitelist), collections SHALL be sorted by stable identifier (e.g., `wall_id`, `room_id`) before serialization. Semantically-ordered lists (e.g., section entity_ids in draw order) are explicitly marked in the whitelist. |

### Fixture Metadata

| ID | Decision |
|----|----------|
| D10 | **Room Area Metadata in Fixtures**. Each fixture module adds `expected_room_areas: Dict[str, float]` with pre-computed area in mm². Graph factory reads this field. **Future**: if fixture metadata grows beyond area, migrate to `tests/fixtures/expected/{fixture}.py`. For v1, the single additional field avoids premature abstraction. |

### Gateway Tests

| ID | Decision |
|----|----------|
| D11 | **Gateway Structural Invariants (Graph Contract)**. Every graph from graph_factory must satisfy: unique IDs, no dangling edges, all edges reference existing nodes, room→wall containment, wall↔room bidirectional consistency, area > 0 for all rooms, no self-loops. |
| D11b | **Fixture Metadata Consistency (Fixture Contract)**. For every fixture with `expected_room_areas`: the fixture boundary polygon area must equal `expected_room_areas[room_id]` within **1 mm² absolute tolerance** (`abs(shapely_area - metadata_area) < 1.01`). Uses raw values (not SNAPSHOT_PRECISION-rounded) since this validates fixture integrity, not snapshot comparison. **Implementation constraint**: MUST derive the boundary polygon directly from raw fixture coordinate arrays using standalone shapely code (e.g., `Polygon(wall_coordinates)`). MUST NOT call `BoundaryBuilder.build()` or any production pipeline component. This prevents BoundaryBuilder regressions from causing false-positive fixture validation failures — the test validates fixture assets, not production algorithms. |
| D12 | **Snapshot Contract Tests**: Per-module tests validate: (1) only whitelisted keys present, (2) all required keys present, (3) no null values for required keys, (4) enum values within allowed set, (5) value types match contract (int vs float vs str). |

### Module-Specific Decisions

| ID | Decision |
|----|----------|
| D13 | **Review Golden: Scenario = Rule Family + Registry Gate**. 7 canonical scenarios covering all 6 rules. Gateway test asserts **`set(covered_rules) == set(_CHECK_NAMES)`** — exact set equality, not length comparison. Missing rules block CI. Scenarios: (1) clean → pass, (2) open room → wall_closure CRITICAL, (3) dimension mismatch → dimension_match HIGH, (4) wrong layer → layer_compliance MEDIUM, (5) low confidence → confidence_threshold MEDIUM, (6) bad count → object_count CRITICAL, (7) self-intersecting → topology CRITICAL. |
| D14 | **Facade Snapshot: Merge Groups**. Snapshot includes `merged_groups: list[list[str]]` — each group lists source wall IDs that merged into one FacadeWall. Gateway verifies `merged_groups` matches expected structure. No count assertions — counts are derived from `merged_groups` and input. |
| D15 | **Section: Fixture-Canonical Cut Lines**. Each fixture defines its own canonical cut in the test file (not centroid-derived). Safe y-value within the main polygon body. Snapshot includes ordered entity IDs per layer group (semantically ordered — draw order, marked in whitelist). |
| D16 | **Ceiling: Fixture Coordinates + Zone BBox**. Snapshot includes per-fixture `[x, y]` position list and per-zone `[min_x, min_y, max_x, max_y]` bounding box. Catches grid placement drift even if fixture count stays stable. |
| D17 | **Takeoff Contract Whitelist**: `wall_lines` (wall_id, direction, length_m, height_m, area_m2, room), `opening_lines` (opening_id, wall_id, kind, width_m, height_m, area_m2), `room_lines` (room_id, name, area_m2), `summary` (gross_wall_area_m2, deduction_area_m2, net_wall_area_m2, floor_area_m2). |
| D18 | **Schedule Contract Whitelist**: `door_lines` (door_id, room, door_type, width_mm, height_mm, direction, host_wall_id), `window_lines` (window_id, room, width_mm, height_mm, sill_height_mm, direction, host_wall_id), `summary` (door_count, window_count). |
| D19 | **Section Contract Whitelist**: `cut_intersections` (wall_id, position [x,y], thickness, height, opening {opening_type, treatment, width, sill_height, head_height}), `entities_by_layer` (layer_name → { entity_count, entity_ids: [ordered, draw-order] }). |
| D20 | **Ceiling Contract Whitelist**: `ceiling_zones` (uid, room_name, ceiling_height_mm, fixture_count, fixture_positions [[x,y],...], bbox [min_x,min_y,max_x,max_y]), `total_fixture_count`. |
| D21 | **Facade Contract Whitelist**: `merged_groups` [[wall_id,...],...], `walls` (wall_id, compass, length, height, opening_count), `total_height`, `footprint_area`. **Note**: `merged_face_count` and `input_wall_count` excluded — not part of FacadeModel/FacadeResult public API (verified: zero occurrences in codebase). Count values are trivially derived (`len(merged_groups)`, `len(input_walls)`). |
| D22 | **Review Contract Whitelist**: `pass_fail`, `total_issues`, `issues_by_severity` {severity: count}, `issues` [{severity, category, description, evidence, confidence}]. Excludes `timestamp`, `drawing_path`, `suggested_fix`. |

### Schema & Maintenance

| ID | Decision |
|----|----------|
| D23 | **`extract_contract()` Responsibility**. Performs **whitelist filtering only** — selects a subset of keys from the source dict. Must NOT rename fields, reorder values, normalize data, or otherwise transform the contract. All transformations happen elsewhere: `normalize_snapshot()` handles float rounding, `builder.build()` handles unit conversion. |
| D24 | **Schema Version + Migration Policy**: `schema_version: 1`. When contract changes: (1) bump `schema_version`, (2) add migration note to design doc, (3) bulk-rebuild all **affected** module snapshots via `pytest --update-snapshots tests/golden/test_golden_*.py`, (4) commit new snapshots in same PR. Graph Factory-level changes typically affect all 6 modules; module-specific contract changes affect only that module's snapshots. |
| D25 | **Snapshot Generation = Comparison Pipeline**: Both paths share the same pipeline: `builder.build()` → `extract_contract()` → `normalize_snapshot()` → `write_snapshot()` / `compare`. |
| D26 | **Coverage Matrix** (below): per-module fixture coverage (5/5 = 100%), per-rule review coverage (6/6 = 100%), overall KPI. Updated per release. |

### Round 8 Clarifications

| ID | Decision |
|----|----------|
| D27 | **Facade Count Fields Excluded (per D21)**. `merged_face_count` and `input_wall_count` are NOT part of the snapshot whitelist because: (a) they do not exist in `FacadeModel` or `FacadeResult` (verified zero occurrences in codebase), (b) they are trivially derived from `merged_groups` and input wall list length, (c) D1 (Public Contract Only) excludes non-API derived values. Consumers who need counts derive them from the snapshot's `merged_groups` and `walls` lists. |
| D28 | **D11b Tolerance = 1 mm² Absolute (per D11b)**. Uses `abs(shapely_area - metadata_area) < 1.01` — raw values, not SNAPSHOT_PRECISION-rounded. Distinct from D3's `normalize_snapshot()` which applies `round(value, N)` before comparison. D11b validates fixture source-data integrity (coordinates ↔ declared area), not snapshot output comparison. |

---

## Fixture `expected_room_areas` Values

| Fixture | Room | Area (mm²) | Derivation |
|---------|------|-----------|------------|
| rectangle | room1 | 80,000,000 | 10,000 × 8,000 |
| l_shape | room1 | 16,000,000 | Γ-shape: 5,000×2,000 base + 3,000×2,000 stem |
| corridor | room1 | 15,000,000 | 10,000 × 1,500 |
| shared_opening | room_a | 48,000,000 | 8,000 × 6,000 |
| shared_opening | room_b | 36,000,000 | 6,000 × 6,000 |
| concave | room1 | 28,000,000 | Γ-shape: 6,000×4,000 base + 2,000×2,000 notch |

---

## Implementation

### File Structure

```
tests/
├── golden/
│   ├── __init__.py
│   ├── conftest.py                          # Shared infrastructure (D2-D6, D8, D23, D25)
│   ├── test_gateway.py                      # D11, D11b, D12 gateway tests (65 tests)
│   ├── takeoff/
│   │   └── test_golden_takeoff.py          # D12, D5, D9, D17 (55 tests)
│   ├── schedule/
│   │   └── test_golden_schedule.py          # D12, D5, D9, D18 (55 tests)
│   ├── section/
│   │   └── test_golden_section.py           # D12, D5, D9, D15, D19 (45 tests)
│   ├── ceiling/
│   │   └── test_golden_ceiling.py           # D12, D5, D9, D16, D20 (50 tests)
│   ├── review/
│   │   └── test_golden_review.py           # D12, D5, D9, D13, D22 (23 tests)
│   └── facade/
│       └── test_golden_facade.py            # D12, D5, D9, D14, D21 (50 tests)
├── snapshots/
│   └── golden/
│       ├── takeoff/{rectangle,l_shape,corridor,shared_opening,concave}.json
│       ├── schedule/{rectangle,l_shape,corridor,shared_opening,concave}.json
│       ├── section/{rectangle,l_shape,corridor,shared_opening,concave}.json
│       ├── ceiling/{rectangle,l_shape,corridor,shared_opening,concave}.json
│       ├── review/{clean,open_room,dimension_mismatch,wrong_layer,low_confidence,bad_count,self_intersecting}.json
│       └── facade/{rectangle,l_shape,corridor,shared_opening,concave}.json
└── fixtures/rooms/
    ├── __init__.py                          # Updated with expected_room_areas docs (D10)
    ├── rectangle.py                         # +expected_room_areas
    ├── l_shape.py                           # +expected_room_areas
    ├── corridor.py                          # +expected_room_areas
    ├── shared_opening.py                    # +expected_room_areas
    └── concave.py                           # +expected_room_areas
```

### Implementation Phases

#### Phase 1: Infrastructure — Graph Factory + Helpers + Gateway (~65 tests)

- `tests/golden/conftest.py` — shared graph_factory, extract_contract, normalize_snapshot, assert_snapshot_match, SNAPSHOT_PRECISION
- `tests/fixtures/rooms/{rectangle,l_shape,corridor,shared_opening,concave}.py` — add `expected_room_areas`
- `tests/golden/test_gateway.py` — D11 graph invariants, D11b fixture metadata consistency (standalone shapely, no BoundaryBuilder), D12 contract structure tests

#### Phase 2: Takeoff + Schedule (~110 tests)

- `tests/golden/takeoff/test_golden_takeoff.py` — 5 fixtures × 8 contract tests + snapshot comparison
- `tests/golden/schedule/test_golden_schedule.py` — 5 fixtures × 8 contract tests + snapshot comparison
- Snapshots: `tests/snapshots/golden/takeoff/{fixture}.json`, `tests/snapshots/golden/schedule/{fixture}.json`

#### Phase 3: Section + Ceiling (~95 tests)

- `tests/golden/section/test_golden_section.py` — 5 fixtures × canonical cut lines + snapshot comparison
- `tests/golden/ceiling/test_golden_ceiling.py` — 5 fixtures × fixture positions + zone bbox + snapshot comparison
- Snapshots: `tests/snapshots/golden/section/{fixture}.json`, `tests/snapshots/golden/ceiling/{fixture}.json`

#### Phase 4: Review Agent + Facade (~73 tests)

- `tests/golden/review/test_golden_review.py` — 7 scenarios × rule coverage + registry gate (`set == set`)
- `tests/golden/facade/test_golden_facade.py` — 5 fixtures × merged_groups structural verification + snapshot comparison
- Snapshots: `tests/snapshots/golden/review/{scenario}.json`, `tests/snapshots/golden/facade/{fixture}.json`

**Total: 343 tests, 32 snapshot JSON files, all COM-free.**

---

## Coverage Matrix (D26)

### Module × Fixture Coverage

| Module | rectangle | l_shape | corridor | shared_opening | concave | Coverage |
|--------|-----------|---------|----------|----------------|---------|----------|
| Takeoff | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 (100%) |
| Schedule | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 (100%) |
| Section | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 (100%) |
| Ceiling | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 (100%) |
| Facade | ✅ | ✅ | ✅ | ✅ | ✅ | 5/5 (100%) |

### Review Rule Coverage

| Rule | Scenario | Severity | Coverage |
|------|----------|----------|----------|
| topology | self_intersecting | CRITICAL | ✅ |
| dimension_match | dimension_mismatch | HIGH | ✅ |
| layer_compliance | wrong_layer | MEDIUM | ✅ |
| confidence_threshold | low_confidence | MEDIUM | ✅ |
| object_count | bad_count | CRITICAL | ✅ |
| wall_closure | open_room | CRITICAL | ✅ |
| **Total** | **6 rules** | | **6/6 (100%)** |

---

## Review Agent Scenario Details (D13)

ReviewContext setup follows patterns from `tests/review_agent/test_policy.py`:

| Scenario | Graph | Context Key Setup | Expected Issues |
|----------|-------|-------------------|-----------------|
| clean | closed room | `geometry_index={"R1": valid_polygon}` | 0 issues, pass |
| open_room | 2 walls (missing N+W) | `geometry_index=None` (default) | 1 CRITICAL (wall_closure) |
| dimension_mismatch | closed room | `dimension_annotations={"W_S": 5000}` (actual=6000) | 1 HIGH (dimension_match) |
| wrong_layer | closed room | `layer_standard={"Wall": {"A-WALL"}}`, `entity_layers={"W_S": "A-FURN"}` | 1 MEDIUM (layer_compliance) |
| low_confidence | closed room + SemanticObject | `confidence=0.3`, `threshold=0.6` | 1 MEDIUM (confidence_threshold) |
| bad_count | empty graph | `object_count_expectations={"Wall": (1, None)}` | 1 CRITICAL (object_count) |
| self_intersecting | closed room | `geometry_index={"R1": bowtie_polygon}` | 1 CRITICAL (topology) |

**Import alignment**: Review tests import from `cad_intelligence.common.models` (matching `policy.py`) rather than `src.cad_intelligence.common.models`. The two import paths resolve to **different classes** on this platform — `isinstance` checks in policy would fail if node objects use the `src.` variant.

---

## Schema Version Migration (D24)

When bumping `schema_version`:

1. Update `schema_version` in all affected snapshot files
2. Add a migration note here
3. Run `pytest --update-snapshots tests/golden/` to regenerate
4. Commit snapshots in the same PR as the code change

**Current**: `schema_version: 1` — initial release.

---

## Future Work

- **Benchmark Integration (§2.1)**: Golden dataset provides ground truth for quality benchmarks beyond the current precision/recall/F1 metrics
- **Larger Fixtures**: Real DWG-derived fixtures once §2.6 Packaging enables repeatable install
- **Review LLM Checks**: Currently only rule-based checks have golden coverage; LLM-driven checks (ReviewContext.llm_provider) are non-deterministic and excluded
