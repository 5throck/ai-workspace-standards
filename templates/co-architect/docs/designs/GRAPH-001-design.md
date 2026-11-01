---
lang: ko
lang_reason: proper-noun
---

# GRAPH-001: Architecture Graph Data Model

> **Spec ID**: GRAPH-001
> **Version**: 1.0
> **Status**: Design (partial implementation — models.py, evidence.py, query_service.py)
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: V3 completion — authoritative "data model" document for the Architecture Graph
> **Related**: [`ADR-005`](../adr/ADR-005-architecture-graph-schema.md) (Schema Owner), [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md) (Architecture), [`API-001`](API-001-design.md) (Interface), [`TEST-001`](TEST-001-design.md) (Verification)

---

## Scope

This document describes **what the Architecture Graph contains** — node types, edge types, identity resolution, persistence, query API, and spatial indexing.

**Explicitly NOT in scope**: Pipeline execution flow — see [`PIPELINE-001`](PIPELINE-001-design.md). MCP tool interface — see [`API-001`](API-001-design.md). Application spec rendering — see [`ADR-007`](../adr/ADR-007-appspec-rendering-architecture.md).

---

## 1. Node Types

All nodes share a common base structure and are typed via a `node_type` discriminator field.

### 1.1 Base Node Fields

| Field | Type | Description |
|-------|------|-------------|
| `uid` | `str` | Persistent unique identifier (format: `Type:NNNN`) |
| `node_type` | `str` | Node type discriminator (e.g., `"room"`, `"wall"`) |
| `schema_version` | `str` | Schema version for migration (currently `"1.0"`) |
| `confidence` | `float` | 0.0–1.0, inherited from the recognition phase that created this node |
| `evidence` | `list[RecognitionEvidence]` | Chain of evidence supporting identification |
| `properties` | `dict` | Type-specific attributes |

### 1.2 Core Node Types

#### Room (`node_type: "room"`)

| Property | Type | Description |
|----------|------|-------------|
| `name` | `str` | Room label (e.g., "Living Room", "거실") |
| `polygon` | `Polygon` | Room boundary polygon (shapely) |
| `area_mm2` | `float` | Calculated area in mm² |
| `floor_level` | `float | None` | Floor height (C.H / F.L annotation) |
| `room_type` | `str | None` | Classification (bedroom, bathroom, kitchen, etc.) |
| `is_open_plan` | `bool` | Whether this is an open-plan space without full wall enclosure |

#### Wall (`node_type: "wall"`)

| Property | Type | Description |
|----------|------|-------------|
| `start` | `tuple[float, float]` | Wall centerline start point (mm) |
| `end` | `tuple[float, float]` | Wall centerline end point (mm) |
| `length_mm` | `float` | Wall length in mm |
| `thickness_mm` | `float | None` | Wall thickness from double-line detection |
| `orientation` | `str` | `"horizontal"` / `"vertical"` / `"diagonal"` |
| `wall_type` | `str | None` | Structural / partition / exterior |
| `layer` | `str` | Source DWG layer name |
| `height_mm` | `float | None` | Wall height (from wall model) |
| `axis_uid` | `str | None` | Associated axis grid axis (AXIS-001) |

#### Door (`node_type: "door"`)

| Property | Type | Description |
|----------|------|-------------|
| `position` | `tuple[float, float]` | Door center position (mm) |
| `width_mm` | `float` | Door width (from gap measurement) |
| `height_mm` | `float | None` | Door height (from annotation or default) |
| `door_type` | `str | None` | Swing / sliding / pocket / etc. |
| `face_label` | `str | None` | Which direction the door faces (N/S/E/W) |
| `swing_arc` | `LineString | None` | Door swing arc geometry |

#### Window (`node_type: "window"`)

| Property | Type | Description |
|----------|------|-------------|
| `position` | `tuple[float, float]` | Window center position (mm) |
| `width_mm` | `float` | Window width |
| `height_mm` | `float | None` | Window height (sill to head) |
| `sill_height_mm` | `float | None` | Sill height from floor |
| `window_type` | `str | None` | Sliding / casement / fixed / etc. |

#### Opening (`node_type: "opening"`)

| Property | Type | Description |
|----------|------|-------------|
| `void_id` | `str` | Reference to Void node |
| `opening_type` | `str` | `"door"` / `"window"` / `"unknown"` |
| `width_mm` | `float` | Opening width |

#### Void (`node_type: "void"`)

| Property | Type | Description |
|----------|------|-------------|
| `position` | `tuple[float, float]` | Void center position |

#### SemanticObject (`node_type: "semantic_object"`)

| Property | Type | Description |
|----------|------|-------------|
| `label` | `str` | Semantic label |
| `category` | `str` | Category (fixture, furniture, equipment, etc.) |
| `geometry` | `Geometry | None` | Associated geometry |

#### Unknown (`node_type: "unknown"`)

| Property | Type | Description |
|----------|------|-------------|
| `candidate_id` | `str` | Original candidate reference |
| `component_id` | `str` | Component reference |
| `reason` | `str` | Why it remains unclassified |

### 1.3 Structural Node Types

#### Building (`node_type: "building"`)

| Property | Type | Description |
|----------|------|-------------|
| `name` | `str` | Building name |
| `address` | `str | None` | Address |

#### Floor (`node_type: "floor"`)

| Property | Type | Description |
|----------|------|-------------|
| `level` | `int` | Floor number (0 = ground) |
| `elevation_mm` | `float` | Absolute elevation |

#### Column (`node_type: "column"`)

| Property | Type | Description |
|----------|------|-------------|
| `position` | `tuple[float, float]` | Column center |
| `section` | `str | None` | Cross-section type |

#### Stair (`node_type: "stair"`)

| Property | Type | Description |
|----------|------|-------------|
| `position` | `tuple[float, float]` | Stair center |
| `width_mm` | `float` | Stair width |
| `rise_count` | `int | None` | Number of risers |

#### Slab (`node_type: "slab"`)

| Property | Type | Description |
|----------|------|-------------|
| `polygon` | `Polygon` | Slab boundary |
| `thickness_mm` | `float | None` | Slab thickness |

---

## 2. Edge Types

Edges represent relationships between nodes. Each edge has a type, source, target, and optional properties.

| Edge Type | Source → Target | Description |
|-----------|----------------|-------------|
| `CONTAINS` | Building → Floor, Floor → Room, Room → Void | Spatial containment hierarchy |
| `CONNECTED_TO` | Wall → Wall | Walls sharing an endpoint (T-junction or corner) |
| `FILLED_BY` | Void → Door, Void → Window | An opening fills a void in a wall |
| `ADJACENT_TO` | Room ↔ Room | Rooms sharing a wall |
| `HOSTS` | Wall → Void | A wall contains a void (opening) |
| `BOUNDED_BY` | Room → Wall | A room's boundary includes this wall |
| `ACCESSED_BY` | Room → Door | A room is accessed via this door |
| `OPENS_TO` | Door → Room | A door opens into this room |
| `ALIGNS_WITH` | Wall → Axis | A wall is aligned with an axis grid line |
| `CONTAINS_OPENING` | Wall → Opening | A wall has this opening |
| `INTERSECTS` | Wall → Wall | Walls that cross (typically an error condition) |
| `VISIBLE_FROM` | Wall → Direction | A wall face is visible from this direction |
| `BELONGS_TO` | SemanticObject → Room | An object belongs to a room |

---

## 3. Identity Resolution

### 3.1 Persistent ID Format

All nodes use the format `Type:NNNN` where:
- `Type` is the uppercase node type (e.g., `ROOM`, `WALL`, `DOOR`)
- `NNNN` is a deterministic hash (SHA-1 truncated to 12 hex chars)

Examples:
- `ROOM:a3f7b2c1d4e5`
- `WALL:f1e2d3c4b5a6`
- `DOOR:9c8b7a6f5e4d`

### 3.2 ID Generation Rules

- IDs are **deterministic**: same input → same ID across pipeline runs
- Generation uses canonical JSON of identifying attributes → SHA-1 → truncated hash
- Collision resolution: 3-tier fallback (primary hash → handles hash → numeric suffix)
- See `space_geometry._make_auto_id()` and `axis_grid._axis_uid()` for implementation

### 3.3 Stability Guarantees

IDs are stable when:
- The same DWG file is processed (same entity handles, same geometry)
- Minor position drift is within snap tolerance (identity persists via reconciliation)

IDs may change when:
- Major structural changes to the DWG (walls moved significantly)
- Entity handles change (DWG was manually edited and re-saved)

---

## 4. Confidence Propagation

### 4.1 Source Phase Inheritance

Each node's `confidence` is **inherited from the phase that created it**, not re-computed downstream:

| Phase | Created Nodes | Confidence Source |
|-------|--------------|-------------------|
| Phase 2 (Geometry) | Wall, Opening (raw) | Wall layer confidence, opening gap measurement |
| Phase 3 (Semantic) | Room, Door, Window (classified) | Weighted aggregation (gap 0.40 + block 0.25 + dim 0.20 + vision 0.15) |
| Phase 3 (Pattern) | SemanticObject | Pattern match score |

### 4.2 Propagation Rules

- **No upward propagation**: downstream confidence does not affect upstream nodes
- **No re-computation**: once set, confidence is frozen for that pipeline run
- **Threshold filtering**: `CONFIDENCE_ACCEPT_THRESHOLD = 0.6` — below this, assignments are flagged as `LOW_CONFIDENCE_OPENING`

---

## 5. Versioning

### 5.1 Snapshot-Based Versioning (Current)

- Each pipeline run produces a complete graph snapshot
- No incremental diffs — full rebuild per run
- Previous snapshots are not retained in memory (only in serialized form if saved)

### 5.2 Merge Policy

- **Last-write-wins**: if the same node UID exists in both previous and new graph, the new graph's version replaces it
- No conflict detection — the reconciliation pass (e.g., `reconcile_axis_grid`) handles drift/split/merge before graph construction

### 5.3 Future: Incremental Diff (M4+)

- `add_node`, `remove_node`, `modify_node` operations without full rebuild
- Requires graph persistence (SQLite) and version history
- Deferred until M4 when performance demands it

---

## 6. Persistence

### 6.1 Current: In-Memory + JSON Serialization

| Aspect | Implementation |
|--------|----------------|
| **Primary storage** | In-memory `dict[str, Node]` keyed by UID |
| **Serialization** | `to_dict() / from_dict()` — canonical JSON |
| **File format** | JSON files (e.g., `{file}.graph.json`) |
| **Stability** | `stable_hash()` — SHA-256 of canonical JSON for cache keys |

### 6.2 Future: SQLite (M4+)

- Persistent graph storage in SQLite for cross-session queries
- Enables incremental updates without full rebuild
- Backward-compatible with JSON via `from_dict()` migration

---

## 7. Query API

The `GraphQueryService` provides read-only query operations. Defined in `graph/query_service.py`.

### 7.1 Core Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `find_rooms()` | `list[Room]` | All room nodes |
| `find_walls()` | `list[Wall]` | All wall nodes |
| `find_openings()` | `list[Opening]` | All opening nodes |
| `find_nodes_by_type(type)` | `list[Node]` | Nodes filtered by type |
| `get_node(uid)` | `Node | None` | Single node lookup |
| `neighbors(uid)` | `list[Node]` | All nodes connected to this node |
| `neighbors_by_edge(uid, edge_type)` | `list[Node]` | Neighbors filtered by edge type |
| `shortest_path(src, dst)` | `list[Node] | None` | BFS shortest path |
| `subgraph(center, depth)` | `list[Node]` | Nodes within N hops |

### 7.2 Evidence Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `get_evidence(uid)` | `list[RecognitionEvidence]` | All evidence for a node |
| `count_by_type()` | `dict[str, int]` | Node count per type |
| `edges_between(src, dst)` | `list[Edge]` | Edges between two nodes |

### 7.3 Separation Principle

`GraphQueryService` is separated from the `ArchitectureGraph` itself:
- Graph = mutable data structure (add/remove/modify nodes)
- QueryService = read-only view with optimized query methods
- This allows the query API to evolve independently of the graph storage

---

## 8. Spatial Index

### 8.1 Implementation: STRtree (shapely)

The spatial index uses `shapely.STRtree` — already a project dependency — for efficient spatial queries.

### 8.2 Index Construction

- **Lazy build**: index is built on first spatial query, not on every mutation
- **Invalidation**: any graph mutation (add/remove/modify node) invalidates the index; next query triggers rebuild
- **Bulk loading**: when building from a full graph snapshot, construct the index once from all spatial nodes

### 8.3 Spatial Queries

| Method | Complexity | Description |
|--------|------------|-------------|
| `find_wall(point, tolerance)` | O(log N) | Find the nearest wall to a point |
| `find_room(point)` | O(log N) | Find the room containing a point |
| `find_walls_for_face(direction, bounds)` | O(log N) | Find walls facing a direction within bounds |
| `find_objects(bbox)` | O(log N) | Find all objects within a bounding box |
| `nearest_neighbor(point, node_type)` | O(log N) | Nearest node of a given type |

### 8.4 Cache Strategy

- Index is cached as a module-level variable (not per-query)
- Cache is invalidated via a generation counter — increment on any graph mutation
- If `index_generation != graph_generation`, rebuild before query

---

## 9. Schema Ownership and Migration

### 9.1 Schema Owner

**[`ADR-005`](../adr/ADR-005-architecture-graph-schema.md) is the canonical schema owner.** All schema changes must:
1. Propose the change (issue/ADR)
2. Update ADR-005 with the new schema definition
3. Update `schema_version` in the affected node/edge types
4. Add migration function(s)
5. Update this document (GRAPH-001)
6. Update tests

### 9.2 Schema Version

- Embedded in each node/edge as `schema_version: str` (currently `"1.0"`)
- Incremented only via ADR-005 amendment
- Used by `from_dict()` to select the correct deserialization path

### 9.3 Migration Policy

When `schema_version` changes:
1. `from_dict()` **must** handle both old and new versions (backward-compatible deserialization)
2. Migration is **explicit**: a `_migrate_v1_to_v2(data: dict) -> dict` function is required
3. Deprecated fields are removed after **2 minor versions**
4. No automatic migration on load — migration is an opt-in operation

### 9.4 Change Process

```
Propose change → Update ADR-005 → Bump schema_version → Add migration function → Update tests → Update GRAPH-001
```

---

## 10. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D52 | Graph document scope = "data model" only | Separates data concerns from flow (PIPELINE-001) and interface (API-001) |
| D53 | Deterministic IDs via SHA-1 hash | Reproducibility across pipeline runs — same DWG → same graph |
| D54 | Confidence inherited from source phase | Prevents confidence drift; each phase owns its quality signal |
| D55 | Snapshot-based versioning (current) | Simplicity; incremental diff deferred to M4+ |
| D56 | STRtree for spatial index | Already a project dependency; good performance for 2D point/line queries |
| D57 | ADR-005 as schema owner | Single source of truth for graph schema changes |
| D58 | Explicit migration functions | Prevents silent data corruption during deserialization |

---

## Document Dependencies

```
PIPELINE-001          ← Phase context (this doc depends on)
      ↓
GRAPH-001 (this doc)  ← Data model definitions
      ↓
API-001               ← Handler DTOs reference node/edge types
      ↓
TRANSACTION-001       ← Transaction operates on graph mutations
      ↓
TEST-001              ← Tests verify graph model integrity
      ↓
REVIEW-AGENT-001      ← Review checks query graph model
      ↓
SPACE-001             ← Space reconstruction uses graph query API
```
