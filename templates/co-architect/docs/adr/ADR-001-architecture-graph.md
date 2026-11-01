# ADR-001 Architecture Graph

> **Source**: Adopted from `C:\git\ai_workspace\Projects\Arch\CAD_Intelligence_Documentation_RFC\ADR-001-Architecture-Graph.md`, formalized for co-architect using the RFC's ADR template (`Status/Context/Decision/Alternatives/Consequences`).

## Status

Accepted

## Context

If AI processes DWG directly, it becomes tightly coupled to the CAD file format, requiring implementation changes every time the underlying model changes.

co-architect currently has a concrete instance of this exact problem: `src/agent/cad_agent.py` connects an LLM directly to a duplicate COM bridge (`ZWCADAgentBridge`), bypassing any intermediate representation. This creates format lock-in and duplicated COM logic (see Consequences below).

## Decision

The Architecture Graph is defined as the project's Intermediate Representation (IR).

```
DWG
→ CAD Objects
→ Geometry
→ Semantic
→ Architecture Graph
→ AI/BIM/Export
```

AI components must never touch DWG or raw CAD objects directly — they consume and update the Architecture Graph only.

**Current concrete implementation**: [`src/cad_intelligence/graph/room_graph.py`](../../src/cad_intelligence/graph/room_graph.py) (post-`PKG-001` migration path; currently at `src/zwcad_mcp/room_graph.py`, 422 lines). Implements `build_room_graph`, `reachable_rooms`, `validate_habitable_reachability`, and `validate_opening_counts`, covering **Room, Wall, Door, Window** nodes with adjacency/opening relationships derived from the geometry and semantic layers.

**Lower-level graph (2026-07-05)**: [`src/cad_intelligence/graph/primitive_graph.py`](../../src/cad_intelligence/graph/primitive_graph.py) provides a Primitive Graph that operates at the CAD primitive level (before domain-object construction). It builds an undirected graph from ALL extracted entities where nodes are CAD primitives and edges represent spatial relationships (endpoint coincidence, containment, proximity). Connected components extracted from this graph are the primary unit for feature computation in the Feature Store (`features/store.py`). The Primitive Graph feeds into the Architecture Graph via: Primitive Graph → Connected Components → Feature Extraction → Feature Store → Pattern Matching (future) → Semantic Objects (future) → Architecture Graph.

## Alternatives

1. **AI processes DWG directly** — rejected: couples AI logic to CAD file-format specifics; any DWG schema or COM API change requires AI-side rework. This is the failure mode already observed in `cad_agent.py`.
2. **Use IFC as the internal model** — rejected: IFC is a heavyweight, BIM-specific interchange format; adopting it as the internal IR would import external schema constraints and complexity not needed for co-architect's DWG-first, Korean-market CAD workflow. IFC remains a valid **export target** from the Graph, not the Graph itself.

## Consequences

### Advantages
- **AI independence** — AI logic depends only on the Graph schema, not on ZWCAD COM or DWG internals.
- **CAD independence** — swapping or upgrading the CAD backend does not require AI-layer changes.
- **Reusability** — the Graph can feed multiple downstream consumers (AI, BIM export, SketchUp, IFC) from one canonical model.
- **Easier plugin architecture** — plugins (§ `PluginSDK.md`) can implement `import()/export()/synchronize()/validate()` against a single stable Graph contract instead of against CAD internals.

### Disadvantages
- **Increased initial development difficulty** — an extra translation layer (Semantic → Graph) must be designed and maintained.
- **Increased Graph design cost** — node/relationship schema decisions have long-term compatibility implications.

### Pipeline Architecture (2026-07-05)

The full pipeline from DWG primitives to AI/BIM output is formalized in [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md), which defines an 11-stage pipeline: Primitive Extraction → Connected Components → Feature Extraction → Object Candidate Layer → Pattern Library → Semantic Objects → Parameter Extraction → Architecture Graph → Elevation Generator → AI → BIM/3D/IFC. ADR-001 defines the IR principle (this Architecture Graph); ADR-004 defines the pipeline that *populates* it.

### Follow-up / Known Gaps (co-architect-specific, recorded at adoption time)

1. **Incomplete node coverage** — ~~ADR's Core Nodes are Building, Floor, Room, Wall, Door, Window, Column, Stair, Slab. Only **Room, Wall, Door, Window** are implemented in `room_graph.py` today. **Building, Floor, Column, Stair, Slab nodes are not implemented.** This is a real, unresolved gap — tracked in `docs/reference/cad-intelligence-status.md`, not a future hypothetical.~~ **Resolved (M3.5-A)**: Building, Floor, Column, Stair, Slab nodes are now implemented in `src/cad_intelligence/common/models.py` (`Building`:909, `Floor`:931, `Column`:955, `Stair`:988, `Slab`:1014), completing ADR-001's Core Node set. See `docs/reference/cad-system-roadmap.md:191-207` for milestone completion detail.
2. **AI layer does not yet honor this ADR** — ~~`src/agent/cad_agent.py` currently violates this decision by connecting an LLM directly to a COM bridge, bypassing the Graph entirely.~~ **Resolved (M3.5-B, 2026-07-05; fully removed AI-003 Phase 5, 2026-07-09)**: `/draw` endpoint routes through V3 graph-driven pipeline (`draw_v3.handle_draw_v3`). V1's execution path (`LLMClient`, `validate_and_execute_commands`, `execute_json_commands`, `handle_prompt_flow`, `handle_prompt_chain`) is no longer just deprecated — it was deleted outright from `cad_agent.py`. AI layer now consumes Architecture Graph exclusively per this ADR's principle.
3. **Relationships partially implicit** — the vision's five relationship types (`contains`, `adjacent_to`, `connected_to`, `opens_to`, `belongs_to`) are not all named as explicit first-class edges in `room_graph.py`; some (e.g., `adjacent_to`) are represented via internal adjacency-set computation (`_adjacency`) rather than a queryable typed edge. A future ADR may formalize the edge-type schema once Building/Floor/Column/Stair/Slab nodes are added.
