---
lang: ko
lang_reason: source-material
---

# ADR-005: Architecture Graph Schema

> **Spec ID**: ADR-005
> **Version**: 1.0 (design)
> **Status**: Design approved
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: Extracted from ADR-004 §7–8 (Architecture Graph Extensions + Platform Architecture). User-approved ADR split: "ADR-004에 더 많은 기능을 넣기보다 역할을 분리하는 것을 권합니다."
> **Supersedes**: ADR-004 §7 (Architecture Graph Extensions), ADR-004 §8.5–8.8 (Relationship Builder, SpatialIndex, Versioning)
> **Related**: [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) (Pipeline & Artifact Architecture — this ADR's content was originally §7–8 of ADR-004), [`ADR-001`](ADR-001-architecture-graph.md) (Architecture Graph IR principle), [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) (Pattern DSL — feeds Semantic Objects into Graph), [`ADR-007`](ADR-007-appspec-rendering-architecture.md) (ApplicationSpec — consumes Graph), [`ADR-008`](ADR-008-command-versioning-editing.md) (Versioning — mutates Graph snapshots)

---

## 1. Overview

The ArchitectureGraph is the **single source of truth** for the CAD Intelligence platform. All downstream consumers — elevation generation, section cuts, BIM export, AI reasoning, code compliance — read from the Graph. No separate WallModel, FeatureStore view, or ad-hoc data structure competes with it.

This ADR defines the Graph's node schema, edge schema, persistent ID system, query API, recognition evidence linking, unknown object handling, coordinate system, spatial index integration, and the long-term Ontology Layer concept.

**Architecture Principles Applied**:

| # | Principle | Implementation |
|---|-----------|----------------|
| AP5 | Graph Query API | §4 — `find_rooms()`, `neighbors()`, `shortest_path()` |
| AP6 | Recognition evidence linked to nodes | §5 — `RecognitionEvidence` bidirectionally traceable |
| AP7 | Unknown objects preserved as nodes | §6 — AI-resolvable later |
| AP9 | Global coordinates canonical | §2.3 — LCS is derived projection |
| AP10 | Ontology Layer above semantic objects | §7 — Wall → BearingWall → FireWall |

---

## 2. Node Schema

### 2.1 Core Node Types

| Node Type | ID Format | Description |
|-----------|-----------|-------------|
| `Room` | `Room:R101` | Enclosed space polygon (habitability boundary) |
| `Wall` | `Wall:0012` | Structural or partition boundary (double-line pair) |
| `Opening` | `Opening:0034` | Gap in a Wall (before Door/Window assignment) |
| `SemanticObject` | `Door:0056`, `Window:0078`, `Furniture:0090` | Typed object classified by Pattern + Inference |
| `Unknown` | `Unknown:0011` | Unresolved candidate — AI may classify later |
| `Building` | `Building:0001` | Root container (single-floor initially) |
| `Floor` | `Floor:0001` | Floor level (multi-floor future) |
| `Column` | `Column:0001` | Vertical structural member |
| `Stair` | `Stair:0001` | Vertical circulation |
| `Slab` | `Slab:0001` | Horizontal structural member |

### 2.2 Persistent ID Format

All IDs follow the pattern `{Type}:{NNNN}`:

```
Room:R101       — human-readable room label
Wall:0012       — sequential semantic ID
Door:0056       — sequential semantic ID
Unknown:0011    — unclassified candidate
```

**Why persistent IDs matter:**
- **Targeted AI mutations**: "change Door:0056 width from 900 to 1000" — AI operates on a specific object by ID
- **BIM cross-reference**: IFC export maps `Door:0056` → `IfcDoor` with stable GUID
- **Change tracking**: "Door:0056 width modified 900→1000" — per-object audit trail
- **Elevation reference**: elevation sheet references the same object in plan, 3D, and BIM

### 2.3 Coordinate System

**Global coordinates are canonical.** All geometry in the Graph is stored in the drawing's original world coordinate system (WCS). Local coordinate systems (Wall LCS, Room LCS) are **derived projections** — computed on demand, never stored as source data.

```
Wall LCS:
  origin: (x, y)          — one endpoint in global coordinates
  direction: 0°/90°/etc.  — angle along wall axis (global)
  normal: perpendicular    — outward-facing side (global)

Opening offset = projection of global position onto wall centerline
```

LCS exists for **rendering convenience** (elevation projection, section cuts), not for data storage. Any consumer that needs LCS computes it from global coordinates + wall definition.

---

## 3. Edge Schema

### 3.1 Core Edge Types

| Edge Type | Source → Target | Example |
|-----------|----------------|---------|
| `CONTAINS` | Room → Wall, Room → Furniture | Room contains Wall |
| `CONNECTED_TO` | Wall → Opening | Wall has Opening |
| `FILLED_BY` | Opening → Door/Window | Opening filled by Door |
| `ADJACENT_TO` | Room ↔ Room | Rooms share a wall+opening |
| `OPENS_TO` | Door → Room | Door opens to Room |
| `BELONGS_TO` | Wall → Room | Party wall belongs to two rooms |

### 3.2 Semantic Edge Types (added by RelationshipBuilder)

| Edge Type | Source → Target | Use Case |
|-----------|----------------|----------|
| `HOSTS` | Wall → Door/Window/Void | Elevation: find all windows on south wall |
| `BOUNDED_BY` | Room → Wall | Elevation: find all walls bounding a room |
| `ACCESSED_BY` | Room → Door | RuleCheck: is every room accessible? |
| `VISIBLE_FROM` | Object → Direction | Elevation: south-facing objects |
| `ALIGNS_WITH` | Wall → Wall | Alignment checks |
| `CONTAINS_OPENING` | Wall → Opening | Explicit wall-opening containment |
| `INTERSECTS` | Object → Object | Clash detection |

### 3.3 Graph Hierarchy Example

```
Building:0001
 └── [CONTAINS] Floor:0001
      └── [CONTAINS] Room:R101
           ├── [BOUNDED_BY] Wall:0012 (length 4200, thickness 200)
           │    └── [HOSTS] Opening:0034 (width 900, offset 2100)
           │         └── [FILLED_BY] Door:0056 (width 900, swing left, hinge left)
           ├── [BOUNDED_BY] Wall:0013
           │    └── [HOSTS] Opening:0035 (width 1800, offset 3200)
           │         └── [FILLED_BY] Window:0078 (sill 900, glass 2)
           └── [ADJACENT_TO] Room:R102 (via Wall:0012 → Opening:0034 → Door:0056)
```

---

## 4. Graph Query API

The ArchitectureGraph exposes a **query API** used by all consumers — AI prompts, ApplicationBuilders, validation engines, and the renderer.

```python
class ArchitectureGraph:
    nodes: dict[str, GraphNode]
    edges: list[GraphEdge]

    # --- Query API (ADR-005 §4) ---

    def find_rooms(self) -> list[Room]:
        """Return all Room nodes."""

    def find_walls(self, room_id: str | None = None) -> list[Wall]:
        """Return all Walls, optionally filtered by containing room."""

    def find_openings(self, wall_id: str | None = None) -> list[Opening]:
        """Return all Openings, optionally filtered by host wall."""

    def find_by_type(self, type_name: str) -> list:
        """Return all nodes matching a type name (e.g., 'Door', 'Window')."""

    def get_node(self, node_id: str) -> GraphNode | None:
        """Return a single node by persistent ID."""

    def neighbors(self, node_id: str, edge_type: str | None = None) -> list[GraphNode]:
        """Return adjacent nodes, optionally filtered by edge type."""

    def shortest_path(self, from_id: str, to_id: str) -> list[str]:
        """BFS shortest path between two nodes (for accessibility checks)."""

    def get_evidence(self, node_id: str) -> RecognitionEvidence | None:
        """Return recognition evidence for a SemanticObject node (§5)."""

    def subgraph(self, node_ids: set[str]) -> 'ArchitectureGraph':
        """Extract a minimal sub-graph containing the specified nodes."""
```

### View Graph for AI

AI receives a **View Graph** — the minimal sub-graph for one specific task:

```
TaskQuery: "Generate south elevation of Room R101"

View Graph:
  Room:R101
   └── Wall:0012 (south-facing, length 4200)
        └── Opening:0034 (offset 2100, width 900)
             └── Door:0056 (swing left, hinge left)
        └── Opening:0035 (offset 3200, width 1800)
             └── Window:0078 (sill 900, glass 2)
```

Benefits: minimal token usage, focused context, no irrelevant rooms/objects.

---

## 5. Recognition Evidence

Every SemanticObject in the Graph carries **bidirectionally traceable evidence** answering "why was this classified as X?"

### Evidence Structure

```python
@dataclass
class RecognitionEvidence:
    evidence_id: str                     # sequential ID
    object_id: str                       # "Door:0056"
    candidate_id: str                     # "candidate:0045"
    features_used: dict[str, float]       # { "host_wall": 1.0, "arc": 0.8, "width": 0.95 }
    pattern_scores: dict[str, float]      # { "door": 0.91, "window": 0.23 }
    inference_reason: str                 # "score_gap=0.68, specificity=door"
    confidence: float                     # 0.91
    created_at: float                    # timestamp
```

### Bidirectional Linking

```python
# From Graph node → Evidence
graph.get_node("Door:0056").evidence_id  # → "evidence:0091"

# From Evidence → Graph node
evidence.object_id  # → "Door:0056"

# From Evidence → source Candidate
evidence.candidate_id  # → "candidate:0045"
```

Any consumer (AI, diagnostics, audit) can traverse: `Node → Evidence → Candidate → Component → Primitives`.

---

## 6. Unknown Objects

Candidates that fail all pattern thresholds are **preserved as Unknown nodes** in the Graph, not discarded.

```python
@dataclass
class UnknownNode(GraphNode):
    node_id: str           # "Unknown:0011"
    candidate_id: str      # "candidate:0072"
    best_score: float      # 0.34 (below threshold)
    best_pattern: str      # "curtain_wall"
    features_used: dict    # raw feature snapshot
```

**Why preserve:**
- AI may classify them later with additional context
- Audit trail shows *what was not classified*, not just *what was*
- Future pattern additions can retroactively resolve Unknowns without re-running the pipeline

---

## 7. Ontology Layer (Long-term Concept)

The current semantic taxonomy is **flat**: all objects share the same parent level (Wall, Door, Window, Room, etc.). Category grouping (Opening, Structural, Vertical, Furniture, MEP) is organizational, not hierarchical.

The **Ontology Layer** sits above this flat taxonomy as an ISA hierarchy, enabling AI reasoning at multiple abstraction levels.

### Conceptual Hierarchy

```
Semantic Object Layer (flat taxonomy — current)
  ├── Door, Window, SlidingDoor, Furniture, Column, Beam
  │
  ▼ Ontology Layer (ISA hierarchy — long-term)
  ├── Wall
  │    ├── BearingWall
  │    │    ├── FireWall
  │    │    └── ShearWall
  │    └── PartitionWall
  ├── Door
  │    ├── FireDoor
  │    ├── AccessibilityDoor
  │    └── SecurityDoor
  ├── Window
  │    ├── FireRatedWindow
  │    └── SafetyGlassWindow
  └── Room
       ├── HabitableRoom
       ├── EscapeRoute
       └── SanitaryRoom
```

### Design Rules

1. **Semantic Object Layer is the source of truth.** Ontology Layer is a *classification overlay*, not a replacement.
2. **ISA relationships are bidirectional queries**, not data mutations. `Wall` can be queried as "find all BearingWalls" without changing the node type.
3. **Ontology rules are declarative** — defined in YAML, loaded at runtime (same principle as Pattern DSL in ADR-006).
4. **Not implemented now.** The Ontology Layer requires a stable semantic taxonomy (Phase C complete) and regulatory use cases (code compliance checking). Deferred to M2–M3.

---

## 8. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D16 | ArchitectureGraph as platform center | Graph is the Single Source of Truth. FeatureStore is immutable snapshot upstream. All Applications read from Graph. *(from ADR-004)* |
| D20 | Relationship Builder before Axis | Axis references Graph objects; relationships must exist first. |
| D21 | ArchitectureGraph replaces WallModel | No separate WallModel. Graph nodes + edges are the only domain model. |
| D22 | Persistent IDs (`Type:NNNN`) | Stable IDs enable targeted AI mutations, BIM cross-reference, change tracking. |
| D26 | BIM/IFC as projection, not source | Graph is truth; IFC/BIM are exports. IFC GUIDs derive from persistent IDs. |
| D27 | Recognition evidence traceability | Every classified node links to evidence. "Why Door?" is always answerable. |
| D28 | Unknown objects preserved | Unclassified candidates become Graph nodes. AI resolves later. |
| D30 | Geometry Layer independent of Semantic | Semantic objects are derived from geometry, never embedded into geometry artifacts. |
| D33 | Bidirectional evidence links | Node ↔ Evidence ↔ Candidate ↔ Component ↔ Primitives. Full provenance chain. |
| D34 | Global coordinates canonical | Wall LCS, Room LCS are derived projections. Original geometry always in global coordinates. |

---

## 9. Spatial Index

STRtree-backed spatial queries are integrated into the ArchitectureGraph API. Uses the existing `shapely.STRtree` project dependency.

```python
class SpatialIndex:
    """STRtree-backed spatial queries, built from Graph geometry."""

    def __init__(self, graph: ArchitectureGraph): ...

    def find_wall(self, point: tuple) -> Wall | None:
        """O(log N) nearest wall to a point."""

    def find_room(self, point: tuple) -> Room | None:
        """O(log N) point-in-room test."""

    def find_objects(self, bbox: tuple) -> list[GraphNode]:
        """O(log N + k) bounding box query."""

    def find_walls_for_face(self, direction: str) -> list[Wall]:
        """Return walls facing a compass direction (±22.5° tolerance)."""
```

**Key principle**: SpatialIndex is **derived data**, recomputed on graph mutation. Users don't manage it separately — the Graph owns it.

---

## 10. Acceptance Criteria

- [ ] ArchitectureGraph with typed nodes (Room, Wall, Opening, SemanticObject, Unknown) and persistent IDs
- [ ] Full edge type coverage: CONTAINS, CONNECTED_TO, FILLED_BY, HOSTS, BOUNDED_BY, ACCESSED_BY, ADJACENT_TO, OPENS_TO, ALIGNS_WITH, CONTAINS_OPENING, INTERSECTS, VISIBLE_FROM
- [ ] Graph Query API: `find_rooms()`, `find_walls()`, `find_openings()`, `find_by_type()`, `neighbors()`, `shortest_path()`, `get_evidence()`, `subgraph()`
- [ ] RecognitionEvidence linked bidirectionally from SemanticObject nodes
- [ ] Unknown nodes preserved for unclassified candidates
- [ ] All geometry stored in global coordinates; LCS computed on demand
- [ ] SpatialIndex provides O(log N) spatial queries integrated into Graph API
- [ ] `subgraph()` extracts minimal View Graph for AI task queries

---

## 11. Out of Scope

1. **Ontology Layer implementation** — conceptual design only (§7). Requires stable taxonomy + regulatory use cases. Deferred to M2–M3.
2. **Multi-floor Graph** — currently single-floor. Floor/Building nodes exist but multi-story topology is future work.
3. **Delta Versioning** — snapshot-based versioning only (see ADR-008). Delta computation deferred.

---

## 12. Related

- [`ADR-001`](ADR-001-architecture-graph.md) — Architecture Graph as mandatory IR (principle this ADR concretizes)
- [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) — Pipeline & Artifact Architecture (Phase 4 "Domain Model" produces this Graph)
- [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) — Pattern DSL & Recognition Engine (produces SemanticObjects that populate the Graph)
- [`ADR-007`](ADR-007-appspec-rendering-architecture.md) — ApplicationSpec & Rendering (consumes the Graph via ApplicationBuilder)
- [`ADR-008`](ADR-008-command-versioning-editing.md) — Command / Versioning / Editing (manages Graph mutations and version history)
- [`ADR-009`](ADR-009-pipeline-execution-framework.md) — Pipeline Execution Framework (implements GraphQueryService §4 read-only API, RecognitionStore §5 evidence storage, RecognitionIndex)
