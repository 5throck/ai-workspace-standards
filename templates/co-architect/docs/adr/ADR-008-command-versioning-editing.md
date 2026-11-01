---
lang: ko
lang_reason: source-material
---

# ADR-008: Command / Versioning / Editing Model

> **Spec ID**: ADR-008
> **Version**: 1.0 (design)
> **Status**: Design approved
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: Extracted from ADR-004 §8.5, 8.8 (EventBus, Command Pattern, Versioning) + Phase E design decisions D23–D29. User-approved ADR split: "ADR-004에 더 많은 기능을 넣기보다 역할을 분리하는 것을 권합니다."
> **Supersedes**: ADR-004 §8.5 (Command Pattern), §8.8 partial (EventBus, Versioning, Diagnostics, Metrics)
> **Related**: [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) (Pipeline — artifact versioning and immutability rules), [`ADR-005`](ADR-005-architecture-graph-schema.md) (Graph — the mutable entity that Commands modify), [`ADR-007`](ADR-007-appspec-rendering-architecture.md) (Rendering — re-triggered after mutations)

---

## 1. Overview

This ADR defines how the CAD Intelligence platform handles **mutations, versioning, and editing**. The Command Pattern ensures all changes flow through a single channel with full undo/redo capability and audit trail. EventBus decouples mutation from downstream effects. Versioning provides immutable snapshots of the ArchitectureGraph and all pipeline artifacts.

---

## 2. Command Pattern

**Core principle**: AI and users generate Commands — never direct mutations. All changes to the ArchitectureGraph flow through `CommandHistory`.

### Command ABC

```python
from abc import ABC, abstractmethod

class Command(ABC):
    """Abstract base for all graph mutations."""

    command_id: str          # sequential ID
    command_type: str       # "resize_door" | "move_window" | etc.
    timestamp: float

    @abstractmethod
    def execute(self, graph: ArchitectureGraph) -> None:
        """Apply the mutation to the graph."""

    @abstractmethod
    def undo(self, graph: ArchitectureGraph) -> None:
        """Reverse the mutation."""

    def describe(self) -> str:
        """Human-readable description for audit trail."""
```

### Concrete Commands

```python
class ResizeDoor(Command):
    object_id: str      # "Door:0056"
    old_width: float     # 900.0
    new_width: float     # 1000.0

    def execute(self, graph): ...
    def undo(self, graph): ...

class MoveWindow(Command):
    object_id: str
    old_offset: float
    new_offset: float

class DeleteOpening(Command):
    object_id: str
    snapshot: dict       # full node snapshot for undo

class RotateWindow(Command):
    object_id: str
    old_rotation: float
    new_rotation: float
```

### Command Flow

```
AI Prompt: "Change Door:0056 width from 900 to 1000"
       │
       ▼
  ResizeDoor command created (old_width=900, new_width=1000)
       │
       ▼
  CommandHistory.execute(command)
       │
       ├── Command.execute(graph)  → graph updated
       │
       ▼
  EventBus.publish(DoorResizedEvent)
       │
       ├── GraphVersioning.commit()    → snapshot saved
       ├── SpatialIndex.rebuild()      → derived data updated
       ├── Cache.invalidate()          → pipeline cache invalidated
       └── Diagnostics.record()        → audit trail updated
```

---

## 3. CommandHistory

```python
class CommandHistory:
    """Ordered history of executed commands with undo/redo support."""

    _history: list[Command]
    _undo_stack: list[Command]
    _current_index: int

    def execute(self, command: Command, graph: ArchitectureGraph) -> None:
        """Execute a command, push to history, clear redo stack."""

    def undo(self, graph: ArchitectureGraph) -> Command | None:
        """Undo the last executed command. Returns the undone command."""

    def redo(self, graph: ArchitectureGraph) -> Command | None:
        """Redo the last undone command."""

    def can_undo(self) -> bool: ...
    def can_redo(self) -> bool: ...

    def get_history(self) -> list[Command]:
        """Return full history for audit trail."""

    def get_snapshot(self) -> list[dict]:
        """Serialize history for persistence."""
```

### Audit Trail

Every executed command is recorded with:
- `command_id`: sequential ID
- `command_type`: what kind of mutation
- `timestamp`: when it happened
- `description`: human-readable ("Resize Door:0056 width 900→1000")
- `before` / `after`: serialized node state (for compliance audit)

---

## 4. EventBus

Decouples Command execution from downstream side effects. Modules don't call each other directly.

### Event Types

```python
@dataclass
class GraphMutatedEvent:
    """Published after any graph mutation."""
    command: Command
    affected_nodes: list[str]
    affected_edges: list[str]

@dataclass
class DoorResizedEvent(GraphMutatedEvent):
    door_id: str
    old_width: float
    new_width: float

@dataclass
class WindowMovedEvent(GraphMutatedEvent):
    window_id: str
    old_offset: float
    new_offset: float

@dataclass
class OpeningDeletedEvent(GraphMutatedEvent):
    opening_id: str
    deleted_snapshot: dict
```

### EventBus Interface

```python
class EventBus:
    """Publish/subscribe event bus for decoupled side effects."""

    def publish(self, event: Event) -> None:
        """Publish an event to all subscribers."""

    def subscribe(self, event_type: type, handler: Callable) -> None:
        """Register a handler for an event type."""

    def unsubscribe(self, event_type: type, handler: Callable) -> None: ...
```

### Subscribers (Side Effects)

| Subscriber | Triggered By | Action |
|-----------|-------------|--------|
| GraphVersioning | `GraphMutatedEvent` | Commit new snapshot |
| SpatialIndex | `GraphMutatedEvent` | Rebuild STRtree |
| PipelineCache | `GraphMutatedEvent` | Invalidate affected caches |
| Diagnostics | `GraphMutatedEvent` | Record provenance |
| Metrics | Any event | Increment counters, update histograms |

---

## 5. Graph Versioning

Immutable snapshots of the ArchitectureGraph with commit/rollback/diff capability.

```python
class GraphVersion:
    """Immutable snapshot of an ArchitectureGraph."""

    version_id: int
    parent_id: int | None
    timestamp: float
    graph_snapshot: dict          # serialized ArchitectureGraph
    command_id: str | None        # command that produced this version
    description: str

class GraphVersionHistory:
    """Manages immutable graph snapshots."""

    _versions: list[GraphVersion]
    _current: GraphVersion

    def commit(self, graph: ArchitectureGraph, command: Command | None = None, description: str = "") -> GraphVersion:
        """Create an immutable snapshot of the current graph state."""

    def rollback(self, version_id: int) -> ArchitectureGraph:
        """Restore graph to a specific version."""

    def diff(self, version_a: int, version_b: int) -> GraphDiff:
        """Compute differences between two versions."""

    def current(self) -> GraphVersion:
        """Return the current version."""

    def history(self) -> list[GraphVersion]:
        """Return full version history."""
```

### Versioning Strategy

- **Snapshot-based** (not delta) — simpler, sufficient for current scale
- **Each Command creates a Version** — full audit trail
- **Rollback creates a new Version** — history is append-only, never deleted
- **Delta computation** deferred to M2–M3 (when memory becomes a concern)

---

## 6. Pipeline Artifact Versioning

### Immutable Artifacts

Every pipeline artifact is **immutable once created**. A Phase never mutates its input — it creates a new output artifact.

```
Phase 2 reads DrawingMetadata → creates GeometryModel (new object, never mutates DrawingMetadata)
Phase 3 reads GeometryModel → creates SemanticModel (new object, never mutates GeometryModel)
Phase 4 reads SemanticModel → creates ArchitectureGraph (new object, never mutates SemanticModel)
```

### Artifact Version Metadata

Every artifact carries version metadata:

```python
@dataclass
class ArtifactVersion:
    schema_version: str       # "1.0" — allows schema evolution
    created_at: float         # creation timestamp
    source_phases: list[int]  # which phases produced this artifact
    pipeline_run_id: str      # unique pipeline execution identifier
```

### Schema Evolution

Artifacts include `schema_version` to support forward-compatible deserialization:

```python
# Reading an artifact:
def load_artifact(path: Path) -> Artifact:
    data = json.loads(path.read_text())
    version = data["schema_version"]
    if version == "1.0":
        return ArtifactV1.from_dict(data)
    elif version == "1.1":
        return ArtifactV1.from_dict_v11(data)  # backward-compatible migration
    else:
        raise UnsupportedSchemaVersion(version)
```

---

## 7. Pipeline Metadata + Pipeline Cache

### Separation of Concerns

**Pipeline Metadata** (execution tracking) and **Pipeline Cache** (artifact storage) are **separate systems** with different lifecycles.

```python
@dataclass
class PipelineMetadata:
    run_id: str
    started_at: float
    completed_at: float | None
    phases_completed: list[int]
    phases_failed: list[int]
    artifact_versions: dict[int, str]  # phase → artifact path
    error_log: list[str]

class PipelineCache:
    """Stores and retrieves pipeline artifacts by phase."""

    def store(self, phase: int, artifact: Any, metadata: ArtifactVersion) -> None: ...
    def retrieve(self, phase: int) -> tuple[Any, ArtifactVersion] | None: ...
    def invalidate(self, phase: int | None = None) -> None:
        """Invalidate cache for a specific phase (or all if None)."""
    def is_cached(self, phase: int) -> bool: ...
```

### Cache Invalidation

| Trigger | Scope |
|---------|-------|
| Graph mutation (Command) | Invalidate Phase 4+ artifacts (Graph, Spec, Render) |
| Input DWG change | Invalidate all phases |
| Manual invalidation | Per-phase or full |

### Cacheable vs Non-cacheable Phases

| Phase | Cacheable | Reason |
|-------|-----------|--------|
| 1 — Drawing Analysis | ✗ | Depends on live DWG file |
| 2 — Geometry Foundation | ✓ | Pure computation on metadata |
| 3 — Semantic Reconstruction | ✓ | Pure computation on geometry |
| 4 — Domain Model | ✓ | Pure computation on semantics |
| 5 — Application Pipeline | ✓ | Pure computation on graph |
| 6 — Rendering | ✗ | Output format dependent |

---

## 8. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D12 | EventBus for decoupling | Command → Event → Handlers (Versioning, Cache, Diagnostics). Modules don't call each other directly. |
| D15 | Command Pattern (not direct mutation) | AI generates Commands. All mutations flow through CommandHistory for Undo/Redo and audit trail. |
| D23 | Pipeline Metadata + Pipeline Cache separated | Different lifecycles, different invalidation triggers. One tracks execution, one stores results. |
| D24 | Immutable Pipeline Artifacts | Each Phase creates new output, never mutates input. Enables safe caching and parallel execution. |
| D25 | Artifact Contracts | Phase-to-phase connections defined by contracts (input/output types), not by class dependencies. |
| D29 | Every Artifact versioned | `schema_version`, `created_at` on every artifact. Schema evolution supported without breaking existing pipelines. |

---

## 9. Package Structure

```
src/cad_intelligence/
├── platform/                  (Platform Layer)
│   ├── event_bus.py           EventBus pub/sub + event dataclasses
│   ├── diagnostics.py         DiagnosticRecord + provenance tracking
│   └── metrics.py             MetricsCollector (counters, histograms, gauges)
├── graph/                      (Knowledge Layer)
│   ├── versioning.py          GraphVersion + GraphVersionHistory
│   └── spatial_index.py       STRtree-backed queries
└── commands/                  (Interaction Layer)
    ├── command.py             Command ABC + CommandHistory
    └── mutations.py            ResizeDoor, MoveWindow, DeleteOpening, RotateWindow
```

---

## 10. Acceptance Criteria

- [ ] `Command` ABC with `execute()` and `undo()` methods
- [ ] `CommandHistory` with undo/redo, serialization, and audit trail
- [ ] Concrete commands: `ResizeDoor`, `MoveWindow`, `DeleteOpening`, `RotateWindow`
- [ ] `EventBus` decouples Command → downstream handlers (Versioning, Cache, Diagnostics)
- [ ] `GraphVersionHistory` provides immutable snapshots (commit/rollback/diff)
- [ ] All pipeline artifacts carry `schema_version` and `created_at` metadata
- [ ] Pipeline artifacts are immutable — phases never mutate input artifacts
- [ ] `PipelineCache` stores/retrieves/invalidate artifacts per phase
- [ ] `PipelineMetadata` tracks execution status independent of cache
- [ ] Cache invalidation triggered by graph mutations (Command execution)

---

## 11. Out of Scope

1. **Delta Versioning** — snapshot-based first; delta computation deferred to M2–M3 when memory is a concern.
2. **Workflow Engine** — linear pipeline flow sufficient; parallel execution deferred.
3. **Persistent Command History** — in-memory history; disk persistence deferred.
4. **Collaborative Editing** — multi-user conflict resolution deferred (single-user editing model assumed).

---

## 12. Related

- [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) — Pipeline & Artifact Architecture (artifact contracts, caching, immutability rules)
- [`ADR-005`](ADR-005-architecture-graph-schema.md) — Architecture Graph Schema (the mutable entity that Commands modify)
- [`ADR-007`](ADR-007-appspec-rendering-architecture.md) — ApplicationSpec & Rendering (re-rendering triggered after mutations)
