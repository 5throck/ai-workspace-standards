---
lang: ko
lang_reason: source-material
---

# CAD Intelligence Platform — Vision Synthesis

> **Status**: Living reference — condensed from the architecture-vision source set
> **Source**: `C:\git\ai_workspace\Projects\Arch\CAD_Intelligence_Documentation_Set\` (Vision.md, Architecture.md, Roadmap.md, AIIntegration.md, PluginSDK.md, PackageDesign.md, CodingGuidelines.md)
> **Companion docs**: [`ADR-001-architecture-graph.md`](../adr/ADR-001-architecture-graph.md) · [`cad-intelligence-status.md`](cad-intelligence-status.md) · [`PKG-001-cad-intelligence-restructure-design.md`](../designs/PKG-001-cad-intelligence-restructure-design.md)

This document rewrites the short vision-set source files in co-architect's own terms — every layer below is mapped to its **real, concrete module** in `src/cad_intelligence/` (post-`PKG-001` migration path) wherever an implementation already exists, instead of using generic placeholder names.

---

## 1. Mission (from `Vision.md`)

> "국내 DWG 중심 설계 환경을 유지하면서 AI가 이해할 수 있는 Architecture Graph를 구축한다."
> (Keep a DWG-first Korean CAD design environment while building an AI-readable Architecture Graph.)

**Core values**: DWG First · AI Ready · Graph Driven · Plugin Oriented.

**Goal pipeline**: `DWG → Geometry → Feature Store → Object Candidate → Pattern Library → Semantic → Architecture Graph → AI → CAD/BIM output`.

co-architect's concrete realization of this pipeline today: ZWCAD 2026 (COM automation via `pywin32`) → `cad_intelligence.features` (Primitive Graph, connected components, component-based feature extraction, topology-based wall scoring) → `cad_intelligence.semantic` (opening/room semantics) → `cad_intelligence.graph` (Primitive Graph + RoomGraph) → **AI layer wired** (AIPipeline + graph_renderer) → drawing output back into ZWCAD, plus a partial Code Check plugin.

The full 11-stage pipeline is formalized in [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md).

---

## 2. System Architecture (from `Architecture.md`)

**Six layers** and co-architect's real modules:

| # | Layer (vision) | Real module (`src/cad_intelligence/`) | Status |
|---|---|---|---|
| 1 | CAD IO | `cad_io/server.py` (MCP JSON-RPC entrypoint), `cad_io/com_bridge.py` (V2 legacy), `cad_io/handlers/` (V3 decomposed handlers) | Done (M1) |
| 2 | Geometry Engine | `geometry/space_geometry.py`, `geometry/wall_model.py`, `geometry/axis_grid.py` | Done |
| 2.5 | Feature Store | `features/store.py`, `features/topology.py`, `features/geometry.py`, `features/scoring.py`; `graph/primitive_graph.py` | Done (2026-07-05) |
| 3 | Semantic Engine | `semantic/opening_evidence.py`, `semantic/opening_assignment.py`, `semantic/room_mapping.py`, `semantic/space_mapping.py` | Done |
| 4 | Architecture Graph | `graph/primitive_graph.py` (CAD primitives), `graph/room_graph.py` (Room/Wall/Door/Window), `graph/arch_graph.py` (9-node Architecture Graph) | Partial — node types incomplete |
| 5 | AI Layer | `ai/pipeline.py`, `ai/graph_renderer.py`, `ai/draw_v3.py` | Done (ADR-001 wired) |
| 6 | Plugins | `plugins/compliance.py` + non-Python TS servers under `mcp/` | Partial |

**Data flow** (vision): `DWG → CAD Objects → Geometry Model → Feature Store → Object Candidate → Pattern Library → Semantic Model → Architecture Graph → AI / BIM / SketchUp / IFC`.

**Data flow** (co-architect, current): `DWG (ZWCAD COM) → WallSegment/DoorEntity/WindowEntity (com_bridge handlers) → Primitive Graph (graph/primitive_graph.py) → Connected Components → Feature Store (features/store.py) → topology-based wall scoring → SpacePolygon (geometry) → Room/opening assignment (semantic) → RoomGraph (graph.room_graph) → Architecture Graph → AI pipeline (graph_renderer) → drawing output`. Future stages (④–⑪) defined in [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md).

---

## 3. Package Design (from `PackageDesign.md`)

> "각 모듈은 독립 테스트 가능해야 하며 순환 의존성을 허용하지 않는다."
> (Each module must be independently testable; no circular dependencies allowed.)

Target tree (adopted verbatim, see `PKG-001-cad-intelligence-restructure-design.md` for the full migration plan):

```
src/cad_intelligence/
├── common/      # models.py — shared dataclasses
├── cad_io/      # server.py, com_bridge.py, handlers/
├── geometry/    # space_geometry.py, wall_model.py, axis_grid.py
├── features/    # store.py, topology.py, geometry.py, scoring.py, patterns.py (future)
├── semantic/    # opening_evidence.py, opening_assignment.py, room_mapping.py, space_mapping.py
├── graph/       # primitive_graph.py, room_graph.py, arch_graph.py
├── patterns/    # DSL pattern definitions — opening/, structural/, vertical/ (future, ADR-004)
├── ai/          # pipeline.py, graph_renderer.py, draw_v3.py
└── plugins/     # compliance.py
```

Current-state note: no circular imports exist in `src/cad_intelligence/` today. Only `room_mapping.py`, `space_mapping.py`, `wall_model.py` use static intra-package imports (`from ..common.models import ...`); everything else uses dynamic/runtime absolute imports. This satisfies the "no circular deps" principle already; PKG-001 preserved it across the move.

---

## 4. Geometry Engine (from `GeometryEngine.md`)

Vision's 9-step pipeline (Normalize → Merge → Detect Parallel → Detect Closed Region → Build Topology → Detect Walls → Detect Doors → Detect Windows → Detect Rooms) maps onto co-architect's real implementation as:

- **Detect Walls / Detect Closed Region / Build Topology** → `geometry/space_geometry.py`'s `_build_space_polygons` (wall-centerline welding via `shapely`, polygonization, hole/multi-network handling — see `ELEV-002-design.md` §2 for the detailed algorithm).
- **Detect Doors / Detect Windows** → opening extraction in `cad_io/com_bridge.py`'s `handle_extract_cad_objects`, refined by `semantic/opening_evidence.py` and `semantic/opening_assignment.py`.
- **Detect Rooms** → `geometry/wall_model.py`'s wall-centric `Room`/`Wall` model (v2, supersedes the room-centric v1 model — see ELEV-002).
- **Output: Geometry Model** → the `SpacePolygon`/`Wall`/`Door`/`Window` dataclasses in `common/models.py`.

Axis/grid detection (`geometry/axis_grid.py`) is an co-architect-specific extension not named in the generic vision pipeline but fits squarely in the Geometry Engine layer (structural axis grid is a geometry concern, feeding downstream opening/room classification — see AXIS-001 design docs).

---

## 5. Architecture Graph (from `ArchitectureGraph.md`, formalized in ADR-001)

**Core Nodes (vision)**: Building, Floor, Room, Wall, Door, Window, Column, Stair, Slab.
**Relationships (vision)**: contains, adjacent_to, connected_to, opens_to, belongs_to.
**Design principle**: preserve both Geometry and Semantic data; the Graph is the Single Source of Truth.

**Real implementation** (`graph/room_graph.py`, 422 lines): `build_room_graph`, `reachable_rooms`, `validate_habitable_reachability`, `validate_opening_counts`. Implements **Room, Wall, Door, Window** nodes and `adjacent_to`/`opens_to`-equivalent relationships (via wall-adjacency and opening-assignment data carried over from the semantic layer). **Building, Floor, Column, Stair, Slab nodes do not exist yet** — see ADR-001 Consequences and the status doc for this gap tracked as a concrete follow-up.

---

## 6. AI Integration (from `AIIntegration.md`)

> "AI는 Graph만 사용한다. LLM은 DWG를 직접 처리하지 않는다."
> (AI uses only the Graph. The LLM never processes DWG directly.)

**Vision pipeline**: `Architecture Graph → Prompt Builder → LLM → Action → Graph Update`. Planned LLM backends: OpenAI, Claude, Gemma, local LLM, MCP.

**Reality**: `src/agent/cad_agent.py` connects an LLM **directly to a duplicate COM bridge** (`ZWCADAgentBridge`), completely bypassing `graph/room_graph.py` and the Architecture Graph concept. This is the single largest deviation from the vision documents in the current codebase. It also duplicates COM logic already in `cad_io/com_bridge.py`, with known concrete bugs (e.g., `StartUndoMarker` vs `StartUndoMark` method-name mismatch, tracked in `cad-system-roadmap.md` P0/P1). PKG-001 explicitly does not fix this — it is deferred to a separate Graph-wiring redesign plan (see PKG-001 §5, out-of-scope item 2).

---

## 7. Plugin SDK (from `PluginSDK.md`)

**Vision's standard interface**: `import()` / `export()` / `synchronize()` / `validate()`. **Initial planned plugins**: SketchUp, Revit, IFC, Cost, Code Check.

**Reality**: only the **Code Check** category has a partial implementation — `plugins/compliance.py` (790 lines), covering BCR/FAR/setback/height/parking checks against Korean building code. It does **not** implement the `import/export/synchronize/validate` interface; it's a standalone rules engine invoked directly, not through a plugin contract. No SketchUp/Revit/IFC/Cost plugin exists.

One TypeScript MCP server exists under `mcp/` (`building-skill`) providing Korean building-law lookups; Korean statute/precedent research is handled by the `k-law` skill (MOLEG Open API). These are **not** Python and are **not** part of the `cad_intelligence` package boundary — the server is a separate Node/Bun runtime service consumed over MCP, analogous in spirit to "Plugins" but outside this package's restructuring scope. (`legalize-kr` and `kr-legislation` servers were removed on 2026-09-08 and replaced by the `k-law` skill.)

---

## 8. Roadmap (from `Roadmap.md`)

Vision's phase sequence (Phase1 CAD IO → Phase2 Geometry Engine → Phase3 Semantic Engine → Phase4 Architecture Graph → Phase5 AI Layer → Phase6 Plugin Ecosystem, with "API 안정화와 테스트" at the end of each phase) is cross-mapped against co-architect's own M1–M5 milestone roadmap (`docs/reference/cad-system-roadmap.md`) in `cad-intelligence-status.md` §2 — the two roadmaps are reconciled there rather than left as competing plans.

---

## 9. Coding Guidelines (from `CodingGuidelines.md`)

- Python 3.12+, type hints required, docstrings required, pytest-based tests, Black + Ruff formatting/linting.
- SOLID design, small modules, prefer immutable data, clear interfaces.

co-architect's existing `common/models.py` already uses `@dataclass` (introduced in the ELEV-002 v2 data model, see `ELEV-002-design.md` §2) — this aligns with the "immutable data first" principle, though dataclasses are mutable by default; the ELEV-002 design does not currently enforce `frozen=True`. This is noted here as a potential future hardening item, not a blocking gap for PKG-001.
