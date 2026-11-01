# AI-002: Graph-Driven Rendering — GRPH-002 Node Storage + RENDER-001 Renderer + V3 `/draw-v3`

> **Spec ID**: AI-002
> **Version**: 1.0 (design, unimplemented)
> **Status**: Design approved — implementation pending
> **Created**: 2026-07-04
> **Authors**: architect
> **Source**: User-approved V1/V2/V3 parallel-versioning strategy (same rationale as `ADR-002-com-bridge-v3-versioning-design.md`)
> **Supersedes**: none (additive only)
> **Related**: [`ADR-002-com-bridge-v3-versioning-design.md`](../adr/ADR-002-com-bridge-v3-versioning-design.md) (produces the V3 handlers this design's renderer calls), [`docs/adr/ADR-001-architecture-graph.md`](../adr/ADR-001-architecture-graph.md) (the gap this design closes), `src/cad_intelligence/graph/arch_graph.py` (GRPH-001, existing edge-only graph), `src/cad_intelligence/ai/*.py` (AI-001, existing pipeline scaffolding)

---

## 1. Overview

ADR-001 established the Architecture Graph as the project's Intermediate Representation, with the explicit principle that "AI must only use the Architecture Graph, never touch DWG/COM directly." Today, V1 (`src/agent/cad_agent.py`'s `/draw` endpoint) violates this principle directly: its LLM client drives its own `ZWCADAgentBridge` COM class, emitting drawing commands with no Graph involved at any point. Meanwhile, the `ai/` package added under a prior "AI-001" commit (`prompt_builder.py`, `action_executor.py`, `graph_updater.py`, `pipeline.py`) is real, working logic that nothing in the repo currently calls — it is completely unwired. And the Architecture Graph itself (`arch_graph.py` + `common/models.py`'s `ArchitectureGraph`) only stores `edges: list[GraphEdge]`; it has no node storage, so even a wired-up AI pipeline would have nowhere to keep the actual Wall/Door/Window/etc. objects it reasons about.

**Why a new, parallel V3 AI pipeline rather than modifying V1's `/draw` endpoint**: same versioning rationale as `ADR-002-com-bridge-v3-versioning-design.md` §1 — the ELEV-001/ELEV-002 precedent (old version kept alongside new until proven, then deprecated not deleted) applies here as well, and this was again an explicit user decision, not the architect's first-choice recommendation. `cad_agent.py`'s `/draw` endpoint is live production code with its own provider-detecting LLM client (Gemini/OpenAI/Anthropic auto-detection via raw `urllib.request`, with a self-healing gemini-to-anthropic fallback — the region around `cad_agent.py:157-182`) and its own `ZWCADAgentBridge`, already flagged as P1 architectural debt (`docs/reference/cad-system-roadmap.md`) for duplicating roughly two dozen of `com_bridge.py`'s methods 1:1-by-name, including concrete bugs like a mismatched undo-marker method name. Rewriting `/draw` in place to go through the Graph would mean debugging Graph-integration issues in the same code path real users depend on today, with no live-ZWCAD validation available in the current planning/implementation environment (§5, dry-run requirement). Instead, this design adds a **new, additive `/draw-v3` endpoint** alongside the untouched `/draw`, exactly mirroring ADR-002's "copy, don't modify" approach one layer up the stack.

This design has five parts, each independently testable:

- **GRPH-002** — give `ArchitectureGraph` real node storage.
- **RENDER-001** — a new deterministic Graph-to-Drawing renderer, consuming ADR-002's V3 handlers (not V1/V2).
- **Part 4 (LLM clients)** — concrete provider implementations for the currently-empty `ai/llm_client.py` registry.
- **Part 5 (`/draw-v3`)** — the new additive endpoint wiring Parts 1-4 together, dry-run by default.

---

## 2. GRPH-002: Architecture Graph Node Storage

### 2.1 `ArchitectureGraph.nodes` field

`src/cad_intelligence/common/models.py`'s `ArchitectureGraph` dataclass (currently `common/models.py:832-843`, only `edges: list[GraphEdge]`) gains:

```python
@dataclass
class ArchitectureGraph:
    edges: list[GraphEdge] = field(default_factory=list)
    nodes: dict[str, object] = field(default_factory=dict)  # id -> Wall|Door|Window|Room|Building|Floor|Column|Stair|Slab instance
```

`nodes` maps a node id (string) to the actual dataclass instance -- `Wall`, `Door`, `Window`, `Room`, `Building`, `Floor`, `Column`, `Stair`, or `Slab` (all defined in `common/models.py`, all already have `to_dict()`/`from_dict()`). This is additive to the existing dataclass; no existing field or method signature changes.

### 2.2 `build_architecture_graph()` must populate the registry

`build_architecture_graph()` in `src/cad_intelligence/graph/arch_graph.py:33-209` currently accepts `rooms, walls, doors, windows, buildings, floors, columns, stairs, slabs, opening_assignments` as parameters, computes `edges` from them via `_node_id(obj)` lookups, and **discards the domain objects themselves** after edge computation -- they are never stored anywhere. This is the gap GRPH-002 closes.

**Change**: after the existing edge-computation loops (unchanged -- do not alter the edge logic itself), populate `nodes` from every non-empty input collection:

```python
nodes: dict[str, object] = {}
for collection in (rooms, walls, doors, windows, buildings, floors, columns, stairs, slabs):
    for obj in collection:
        nodes[_node_id(obj)] = obj

return ArchitectureGraph(edges=edges, nodes=nodes)
```

This reuses the existing `_node_id()` helper (`arch_graph.py:212-218`, already used throughout the edge-computation loops for exactly this id-extraction purpose -- `id` attribute preferred, `uid` fallback) so id computation is guaranteed consistent between edges and nodes for the same object. No new helper function is needed.

### 2.3 `to_dict()`/`from_dict()` serialization

`ArchitectureGraph` does not currently define `to_dict()`/`from_dict()` (only `to_room_graph()` for AXIS-001 backward compat). This design adds both, and they must handle the node registry's mixed-type values precisely:

**`to_dict()`** -- since `nodes` holds a mix of 9 possible dataclass types, each entry must be serialized with an explicit type tag alongside its own `to_dict()` output:

```python
_NODE_TYPE_MAP = {
    "Building": Building, "Floor": Floor, "Room": Room, "Wall": Wall,
    "Door": Door, "Window": Window, "Column": Column, "Stair": Stair, "Slab": Slab,
}

def to_dict(self) -> dict:
    return {
        "edges": [e.to_dict() for e in self.edges],
        "nodes": {
            node_id: {"node_type": type(obj).__name__, "data": obj.to_dict()}
            for node_id, obj in self.nodes.items()
        },
    }
```

**`from_dict()`** -- dispatches on the stored `node_type` tag to call the correct class's `from_dict()`:

```python
@classmethod
def from_dict(cls, data: dict) -> "ArchitectureGraph":
    nodes: dict[str, object] = {}
    for node_id, entry in data.get("nodes", {}).items():
        node_type = entry["node_type"]
        klass = _NODE_TYPE_MAP.get(node_type)
        if klass is None:
            continue  # Unknown node_type -- skip rather than raise, forward-compat with future node types.
        nodes[node_id] = klass.from_dict(entry["data"])
    return cls(
        edges=[GraphEdge.from_dict(e) for e in data.get("edges", [])],
        nodes=nodes,
    )
```

`_NODE_TYPE_MAP` should live at module level in `common/models.py`, defined after all 9 node dataclasses (i.e., near the bottom of the node-dataclass section, before `EdgeType`/`GraphEdge`/`ArchitectureGraph`). Unknown `node_type` values are skipped rather than raising, matching the codebase's general "log/skip and continue" tolerance pattern (e.g. `ExceptionReport` non-blocking warnings) rather than hard-failing deserialization on a forward-compatibility mismatch.

### 2.4 `GraphUpdater.add_node` reimplementation

`DefaultGraphUpdater.apply()` in `src/cad_intelligence/ai/graph_updater.py:62-76` currently handles `add_node` as a no-op: `return True  # Nodes are implicit; always succeeds.` (line 66, with a docstring at lines 49-50 explicitly stating "nodes are implicit in `ArchitectureGraph`; they exist when referenced by an edge"). This assumption is now false -- nodes must be constructed and stored.

**New behavior**: `action.properties` must include a `node_type` key naming which of the 9 dataclasses to construct, plus that dataclass's field values (matching the shape produced by `to_dict()` minus the type tag, i.e. the same shape passed to `from_dict()`):

```python
def _add_node(self, graph: ArchitectureGraph, action: GraphAction) -> bool:
    """Construct a node dataclass from action.properties and store it
    in graph.nodes[action.target_id]."""
    props = action.properties
    node_type = props.get("node_type")
    klass = _NODE_TYPE_MAP.get(node_type)
    if klass is None:
        return False  # Unknown or missing node_type.
    field_data = {k: v for k, v in props.items() if k != "node_type"}
    field_data.setdefault("id", action.target_id)
    try:
        node = klass.from_dict(field_data)
    except (KeyError, TypeError, ValueError):
        return False
    graph.nodes[action.target_id] = node
    return True
```

And in `apply()` (`graph_updater.py:65-66`):
```python
if atype == "add_node":
    return self._add_node(graph, action)
```

`field_data.setdefault("id", action.target_id)` ensures `action.target_id` is authoritative for the node id even if `properties` omits `"id"` -- the action's own `target_id` is the single source of truth for which key the node is stored under in `graph.nodes`, avoiding a class of bug where `properties["id"]` and `action.target_id` disagree.

### 2.5 `GraphUpdater.update_property` extension

`DefaultGraphUpdater._update_property()` (`graph_updater.py:137-151`) currently only updates edge metadata: it scans `graph.edges` for the first edge matching `source_id`/`target_id` in `properties` and calls `edge.metadata.update(updates)`. This behavior must be preserved unchanged for edge-matching targets -- this is an **additive branch**, not a replacement.

**New behavior**: when `action.target_id` matches a key in `graph.nodes` (checked first, since node lookup is O(1) vs. the edge scan's O(n)), update the node object's fields from `action.properties["updates"]` instead:

```python
def _update_property(self, graph: ArchitectureGraph, action: GraphAction) -> bool:
    """Update metadata on a matching edge, OR fields on a matching node
    (additive: node-path added, existing edge-path behavior unchanged)."""
    props = action.properties
    updates = props.get("updates", {})
    if not updates:
        return False

    # New: node-targeted update_property (checked first -- O(1) dict lookup).
    if action.target_id in graph.nodes:
        node = graph.nodes[action.target_id]
        for field_name, value in updates.items():
            if hasattr(node, field_name):
                setattr(node, field_name, value)
        return True

    # Existing: edge-targeted update_property (unchanged from current implementation).
    source_id = props.get("source_id")
    target_id = props.get("target_id")
    if not source_id or not target_id:
        return False
    for edge in graph.edges:
        if edge.source_id == source_id and edge.target_id == target_id:
            edge.metadata.update(updates)
            return True
    return False
```

Note the parameter shape difference this preserves: edge updates key off `properties["source_id"]`/`properties["target_id"]` (a *pair* identifying the edge), while the new node-update path keys off `action.target_id` directly (a single node id) -- these are genuinely different addressing schemes and the dispatch above must check the node-id path first since `action.target_id` is always present on every `GraphAction`, whereas `properties["source_id"]`/`properties["target_id"]` are edge-specific.

`setattr` with a `hasattr` guard silently ignores unknown field names rather than raising -- consistent with `ActionParser`'s existing "malformed elements are silently skipped" tolerance (`action_executor.py:46`).

---

## 3. RENDER-001: Graph-to-Drawing Renderer

New file: `src/cad_intelligence/ai/graph_renderer.py`. Calls ADR-002's V3 handlers (`cad_io.handlers.drawing`, imported from the new `handlers/` package -- **not** V1's `ZWCADAgentBridge` and **not** V2's `com_bridge.py` handlers directly, keeping the renderer entirely within the V3 dependency graph established by `ADR-002-com-bridge-v3-versioning-design.md`).

### 3.1 Node-type -> V3-handler-call mapping

| Node type | V3 handler called | Details |
|---|---|---|
| `Wall` | `handlers.drawing.handle_draw_polyline` | Uses `wall.start`, `wall.end` as the two polyline points, layer `"A-WALL"` (fixed layer name -- matches the `A-*` layer-prefix convention already used elsewhere in the codebase, e.g. `A-ELEV-*` in ELEV-002). |
| `Door` | resolve absolute point, then `handlers.drawing.handle_draw_line` or `handlers.drawing.handle_insert_block` | See §3.2 for position resolution. Prefer `handle_insert_block` when a block name is available in the node's data (none of the 9 node dataclasses currently carry a block-name field, so in practice this falls back to `handle_draw_line` today -- implementers should not invent a new field on `Door`/`Window` as part of this work; that is a separate future data-model change). |
| `Window` | same resolution as `Door` | Same handler choice logic as `Door`. |
| `Column` | `handlers.drawing.handle_insert_block` or `handlers.drawing.handle_draw_circle` | At `column.position`. Prefer `handle_draw_circle` (radius derived from `column.section_width`/2 if set, else a fixed default placeholder radius) since `Column` has no block-name field either -- same rationale as Door/Window above. |
| `Room` | `handlers.drawing.handle_draw_text` (label only) | No polygon rendering -- walls already draw the boundary; rendering a duplicate room outline would double-draw geometry the connected `Wall` nodes already produce. Label text is `room.name` (or `room.id` if `name` is `None`), positioned at... there is no room centroid field on `Room` in `common/models.py` (`area`, `height`, `ceiling`, `wall_ids` only) -- implementer must compute a placeholder position (e.g. average of the connected walls' midpoints via `graph.nodes` + the `CONTAINS` edges from Room to Wall) or accept a `position` override parameter on `render_node()`; document whichever choice is made inline in the renderer's docstring since this is a real gap not covered by existing data. |
| `Stair` | **unsupported** | Returns `ExceptionReport(code="RENDER_UNSUPPORTED_NODE_TYPE", severity="warning", ...)` instead of raising. `Stair` has no position/placement field (`common/models.py:737-757`: `width`, `run_length`, `num_risers`, `floor_id` only) -- there is nothing to render from. |
| `Slab` | **unsupported** | Same treatment as `Stair`. `Slab` has no boundary polygon field (`common/models.py:761-781`: `thickness`, `material`, `area`, `floor_id` only). |

### 3.2 Door/Window position resolution

`Door`/`Window` carry `wall_id` and `position_on_wall` (`common/models.py:518-522` for `Door`, `554-560` for `Window`) -- both typed `float | None`. **This design specifies `position_on_wall` as a 0.0-1.0 fraction along the wall** (not an absolute distance in drawing units), matching the more common convention for "position along a parametrized line" in this codebase's geometry helpers (e.g. shapely's own fraction-based line interpolation API, which ELEV-002's `space_geometry.py` already depends on via shapely). If the actual value observed at implementation time in existing fixture JSON files turns out to store absolute distances instead, the renderer's resolution helper must convert consistently but this design's default assumption is **fraction**.

Resolution algorithm (`_resolve_opening_point(graph, door_or_window) -> tuple[float, float] | None`):
1. Look up `wall_id` in `graph.nodes`. If absent or not present in the registry, return `None` (caller emits an `ExceptionReport`, does not raise).
2. If `position_on_wall` is `None`, return `None` (no position data -- cannot render this opening; this is expected for openings not yet assigned a wall, per ELEV-002's `ORPHAN_OPENING` exception code precedent).
3. Otherwise compute the point at fraction `position_on_wall` along the segment from `wall.start` to `wall.end`:
   ```python
   t = door_or_window.position_on_wall
   x = wall.start[0] + t * (wall.end[0] - wall.start[0])
   y = wall.start[1] + t * (wall.end[1] - wall.start[1])
   ```

### 3.3 Function signatures

```python
def render_node(graph: ArchitectureGraph, node_id: str) -> ExceptionReport | None:
    """Render a single graph node via the appropriate V3 drawing handler.

    Returns None on successful render (or a no-op render, e.g. a Room
    label with no resolvable position that is silently skipped --
    document the exact no-op-vs-exception boundary chosen at
    implementation time). Returns an ExceptionReport (not raised) on
    any unsupported node type or unresolvable position, so that
    render_graph() can continue rendering other nodes.
    """

def render_graph(graph: ArchitectureGraph) -> list[ExceptionReport]:
    """Render every node in graph.nodes, in graph.nodes iteration order.
    Never raises on a per-node failure -- collects each render_node()
    non-None result and returns the full list at the end, allowing a
    partial render to proceed even if some nodes (e.g. all Stairs/Slabs)
    are unsupported.
    """
```

### 3.4 Test convention

Reuses the existing COM-stub test convention: patch `_get_bridge` from the **new** `com_primitives_v3.py` (not V2's `com_bridge.py`) -- mirroring the existing pattern of patching `_get_bridge` and calling real handler functions, applied to the V3 handler modules instead. No live ZWCAD session or COM environment required.

---

## 4. Part 4: Concrete LLM Client Implementations

`src/cad_intelligence/ai/llm_client.py` currently defines only the `LLMClient` ABC (`call()`, `provider_name` property) and `LLMClientRegistry` (register/get/list_providers/unregister) -- no concrete provider implementation exists anywhere in the `ai/` package today.

Add three new classes implementing the `LLMClient` ABC: `GeminiClient`, `AnthropicClient`, `OpenAIClient`. These **re-implement** (do not import from `cad_agent.py` -- V1 stays completely untouched, per the versioning rationale in §1) V1's provider-detection and self-healing-fallback behavior:

- **Provider auto-detection** (mirroring the region around `cad_agent.py:157-182`): check `GEMINI_API_KEY`, then `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`, then `OPENAI_API_KEY`, in that priority order, to pick a default provider when the caller doesn't specify one explicitly.
- **Self-healing fallback**: if `provider == "gemini"` but `GEMINI_API_KEY` is absent while Anthropic credentials are present, log and switch to the Anthropic client (same behavior as the existing `cad_agent.py` logic around lines 178-182).
- Each concrete class's `call(request: LLMRequest) -> LLMResponse` performs the actual HTTP call to its provider's API (raw `urllib.request`, matching V1's dependency-free approach -- no new third-party HTTP client dependency), using `request.model`/`request.prompt`/`request.temperature`/`request.max_tokens` and returning an `LLMResponse` with `content`/`model`/`usage`/`metadata` populated from the provider's JSON response shape.
- `provider_name` returns `"gemini"`, `"anthropic"`, or `"openai"` respectively -- the exact strings V1 uses internally, so any future comparison/logging code that expects these literal strings stays consistent across V1 and V3.

Registration: a module-level convenience function (e.g. `register_default_clients(registry: LLMClientRegistry) -> None`) that instantiates and registers all three, callable by `pipeline.py`/`/draw-v3` setup code without each caller re-wiring the registry by hand.

**Explicit scope note**: this is a re-implementation, not a shared abstraction extracted from `cad_agent.py`. Duplicating the provider-detection logic is an accepted, deliberate cost of the V1/V2/V3 parallel-versioning strategy (same trade-off ADR-002 accepts for the handler copies) -- a shared helper module would create exactly the kind of V1-V3 coupling this design is structured to avoid.

---

## 5. Part 5: `/draw-v3` Endpoint

New endpoint added to `src/agent/cad_agent.py` -- additive only. **V1's existing `/draw` handler code (the `do_POST` branch starting around `cad_agent.py:1931`) must not be touched by a single character.** `/draw-v3` is a new branch alongside it in the same `do_POST` dispatch (the request handler class is `CADAgentHTTPRequestHandler`, defined around `cad_agent.py:1780`), adding a new `elif self.path == "/draw-v3":` alongside the existing `if self.path == "/draw":` check.

### 5.1 Flow

1. **Build an `ArchitectureGraph`** from the current drawing's domain objects. May reuse V2's **read-only** `handle_extract_cad_objects` (and similar V2 read-path handlers) for input -- reading V2 doesn't modify it, so this does not violate ADR-002's zero-line-diff requirement on `com_bridge.py` itself (calling a function is not modifying its file). Domain objects extracted this way are passed into `build_architecture_graph()` (§2.2) to populate both `edges` and the new `nodes` registry.
2. **`AIPipeline.run()`** (`ai/pipeline.py:58-98`, unchanged, already implemented under AI-001): prompt -> LLM via a Part 4 client -> `ActionParser.parse()` -> returns an `AIPlan`.
3. **Return the `AIPlan` as JSON** -- **dry-run by default**, meaning `AIPipeline.run()` is called (which per its own docstring "does NOT mutate the graph"), but `apply_plan()` and `graph_renderer.render_graph()` are **not** called unless a separate explicit flag/param is set.
4. **A separate explicit flag/param** (e.g. request payload key `"apply": true`, mirroring `/draw`'s existing `mode` payload key pattern around `cad_agent.py:1938-1939`) triggers, only when set: `AIPipeline.apply_plan(graph, plan)` (mutates the in-memory graph) followed by `graph_renderer.render_graph(graph)` (actually issues V3 COM drawing calls) for callers who want to execute the plan against a live ZWCAD session.

### 5.2 Dry-run-by-default is a hard requirement

No live ZWCAD instance is available in the current planning/implementation environment to validate that COM calls actually draw correctly. Defaulting to dry-run (JSON plan returned, nothing drawn) means:
- The endpoint, pipeline, and renderer's non-COM logic (prompt building, LLM call, action parsing, graph node/edge construction and mutation) can be fully implemented and tested without any live ZWCAD dependency.
- Any bug in the COM-calling path (`graph_renderer.render_graph()` -> V3 drawing handlers -> `com_primitives_v3.ZWCADComBridge`) is isolated to the opt-in apply-flag path, which a human with an actual ZWCAD session must explicitly exercise and verify visually before trusting it -- consistent with ELEV-002's existing "requires live ZWCAD (manual/integration)" test-strategy category for anything requiring real COM interaction.

---

## 6. Out of Scope

1. **Replacing V1's `/draw` endpoint** -- `/draw` is not deprecated, modified, or scheduled for removal by this design. Same ELEV-001/ELEV-002-style deferred-retirement posture as ADR-002 §5.
2. **Removing `ZWCADAgentBridge` or V1's exec-based validation path** -- V1's `cad_agent.py` internals outside the new additive `/draw-v3` branch are entirely untouched.
3. **Stair/Slab rendering support** -- ties directly back to the geometry-field gap in §3.1: `Stair` has no position/placement field, `Slab` has no boundary polygon field, in the current `common/models.py`. Adding those fields (and then rendering support) is a distinct future data-model change, not part of this design.

---

## 7. Test Strategy

- **Parts 1-4 (GRPH-002 node storage, RENDER-001 renderer's non-COM logic, Part 4 LLM clients)**: fully unit-testable COM-free, or with `_get_bridge` stubs per the existing convention (§3.4). No live ZWCAD, no live API keys -- LLM client HTTP calls are tested with mocked HTTP responses (matching whatever mocking pattern, if any, V1's existing LLM-client tests use, if such tests exist; otherwise a straightforward mock patch on the request-sending call).
- **Part 5's dry-run mode**: testable with a mocked `LLMClient` (e.g. a test double returning a fixed `LLMResponse`) -- no live ZWCAD or API keys needed, since dry-run mode by construction never reaches the COM-calling code path.
- **Part 5's apply-flag path**: requires live ZWCAD (manual/integration only, same category as ELEV-002's wall-model/elevation visual-verification checkpoints) -- not exercised in the automated suite in this design's initial scope; a human with a live ZWCAD session must verify visually before this path is trusted.

---

## 8. Acceptance Criteria

- [ ] `ArchitectureGraph` in `common/models.py` has a `nodes: dict[str, object]` field, plus `to_dict()`/`from_dict()` implementing the type-tag dispatch scheme in §2.3.
- [ ] `build_architecture_graph()` in `graph/arch_graph.py` populates `nodes` from all 9 possible input collections without altering existing edge-computation logic.
- [ ] `DefaultGraphUpdater.add_node` constructs the correct dataclass from `action.properties["node_type"]` + remaining properties and stores it in `graph.nodes[action.target_id]`, returning `False` on unknown/missing `node_type` or construction failure.
- [ ] `DefaultGraphUpdater.update_property` has an additive node-matching branch (checked before the edge-matching branch) that updates node fields from `action.properties["updates"]` when `action.target_id` is a key in `graph.nodes`; existing edge-metadata-update behavior is unchanged for edge-matching targets (verified by the existing `graph_updater.py` tests, if any, continuing to pass unmodified).
- [ ] `src/cad_intelligence/ai/graph_renderer.py` exists with `render_node()` and `render_graph()` matching the signatures in §3.3, implementing the node-type mapping table in §3.1, returning `ExceptionReport(code="RENDER_UNSUPPORTED_NODE_TYPE")` for `Stair`/`Slab` rather than raising.
- [ ] `render_graph()` never raises due to a single unsupported/unresolvable node -- a mix of renderable and unrenderable nodes produces a partial render plus a non-empty `ExceptionReport` list.
- [ ] `GeminiClient`, `AnthropicClient`, `OpenAIClient` exist in `ai/llm_client.py`, implement the `LLMClient` ABC, and are registrable via `LLMClientRegistry`; provider auto-detection and self-healing fallback behavior matches V1's documented logic without importing from `cad_agent.py`.
- [ ] `/draw-v3` exists in `src/agent/cad_agent.py` as a new additive branch; `git diff` against `main` shows the existing `/draw` handling code (`do_POST`'s `if self.path == "/draw":` block) with zero line changes.
- [ ] `/draw-v3` defaults to dry-run (returns `AIPlan` JSON, no COM calls) and only calls `apply_plan()` + `render_graph()` when an explicit request flag is set.
- [ ] All Parts 1-4 and Part 5's dry-run path are covered by unit tests requiring no live ZWCAD session and no live LLM API keys.
- [ ] `python -m pytest tests/ -k "not live_zwcad" -q` shows zero new failures compared to the pre-AI-002 baseline.

---

## 9. Notes

- Implementation completion should be recorded in `CHANGELOG.md [Unreleased]` (`/changelog` skill), followed by the `/sync` pipeline for commit/PR.
- This design depends on `ADR-002-com-bridge-v3-versioning-design.md` having produced `handlers/drawing.py` (and `com_primitives_v3.py`) before RENDER-001 (§3) can be implemented -- sequence Part 1 (ADR-002) ahead of Part 3 (RENDER-001) in the execution plan.
