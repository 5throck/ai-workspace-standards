# ADR-017 Architecture Knowledge Graph Platform Constitution

> **Status**: Accepted — all 4 milestones implemented (2026-08-04)
> **Date**: 2026-08-04
> **Deciders**: Co-Architect PM, Architect, Automation Engineer

---

## Context

The CAD Intelligence pipeline originally operated as a pipeline-centric parser. To evolve into an **Explainable CAD Reasoning Operating System**, the architecture required formal layer boundaries, immutability contracts, stateless views, DI provider decomposition, business capability isolation, evidence traceability, and automated CI fitness functions.

> **Implementation history**: This ADR was initially marked "Accepted" prematurely (an earlier session claimed all milestones were done without verification). After a thorough code audit, the status was corrected to "Proposed" and Milestones A–D were implemented incrementally across multiple sessions. As of 2026-08-04, all 4 milestones are complete: 37 new files, 4,212 tests passing, 8 CI fitness functions enforcing the 9 Kernel Invariants. The status is now **Accepted**.

---

## Decision

Adopt the **Architecture Knowledge Graph Platform Constitution (v5.1 Frozen)** consisting of 11 Architectural Decision Records (ADRs), strict layer dependency rules, 4 strategic milestones, and 8 automated Architecture Fitness Functions in CI.

```
Applications
    ↓
Capabilities (User-facing business functions; NO cross-capability dependencies)
    ↓
Services (Domain Query Services, GeometryService cache owner with revision binding)
    ↓ (Selective: projection/composition ONLY; no domain entity getters!)
Views (Stateless projection/composition wrappers)
    ↓
ArchitectureGraph (+ GraphIdentity & GraphMetadata OS Kernel + Provenance)
```

### Kernel Invariants

The ArchitectureGraph is the OS Kernel of the platform. The following **9 invariants** are the governing rules that every implementation and code review MUST satisfy. Violations are blocking.

1. **Every mutation creates a new ArchitectureGraph.** The input graph is never modified in place — `dataclasses.replace` + `copy.deepcopy` produce a new instance.
2. **`GraphIdentity.graph_id` never changes.** Once assigned at creation, the id is immutable for the lifetime of that graph object.
3. **Revision is monotonically increasing.** `GraphIdentity.revision` is the sole revision field (GraphMetadata does NOT carry revision). Each mutation increments it.
4. **Content hash uniquely identifies graph contents.** `GraphIdentity.content_hash` (SHA-256) is a deterministic fingerprint of nodes and edges — identical inputs produce identical hashes (fitness function: `test_deterministic_reconstruction`).
5. **Views never own state.** `GeometryView`, `TopologyView`, `SemanticView` store no instance state, clone no graph, own no cache. Projections are computed lazily on every call.
6. **Services never mutate the graph.** Query services, `GeometryService`, `DiffService`, `HistoryService` treat the graph as read-only.
7. **Capabilities never bypass Commands.** All graph mutations flow through `Command.execute()` → `GraphMutationExecutor`. Capabilities compose services, never write to the graph directly.
8. **Events always reference GraphDelta.** Coarse-grained events (`graph_mutated`, `geometry_changed`) carry a `GraphDelta` payload — never per-field notifications (prevents Subscriber Explosion).
9. **History stores immutable snapshots only.** `GraphVersionHistory` deep-copies on every `commit()`; snapshots are never aliased to live graph state.

### The 11 Constitution ADRs

1. **ADR-001 Canonical Immutable OS Kernel**: `ArchitectureGraph` is the single canonical, immutable OS Kernel model.
2. **ADR-002 Stateless Views & GeometryService Cache Ownership**: Views (`GeometryView`, `TopologyView`, `SemanticView`) are stateless projection wrappers and NEVER cache; caching is strictly owned by `GeometryService`. Cache key is **`(graph_id, revision)` or `content_hash`** — never `revision` alone, so that `rollback` to a prior revision does not produce stale cache hits (user feedback 2026-08-04 item 5).
3. **ADR-003 Capability Independence**: Capabilities MUST ONLY depend on Services; direct Capability-to-Capability dependencies are strictly forbidden (`Capability A → Capability B` is illegal).
4. **ADR-004 CQRS Immutability & Mutation Commands**: All graph mutations are executed via immutable `GraphCommand` objects bearing `CommandMetadata` yielding a new graph instance; in-place mutations are strictly forbidden.
5. **ADR-005 Strict Layer Dependency Rule**: Allowed imports flow down strictly: `Applications → Capabilities → Services → Views → ArchitectureGraph`. Upward, reverse, or illegal skip-layer imports are forbidden.
6. **ADR-006 FeatureStore Evidence Repository Boundary**: `FeatureStore` serves strictly as an **Evidence Repository** (`Primitive Feature → Recognition Feature → Evidence`). Graph nodes and edges represent "judgments" and are exclusively owned by `ArchitectureGraph`.
7. **ADR-007 Selective View Layer & Scope**: Views exist ONLY when they provide real projection, adaptation, or composition value (`visible_geometry()`, `boundary_projection()`). Simple pass-through wrappers or domain entity getters (`get_room()`, `get_wall()`) are strictly prohibited.
8. **ADR-008 Capability Granularity Boundary**: Capabilities MUST represent high-level **User-facing Business Functions** (`Navigation`, `Takeoff`, `Review`, `CodeCheck`, `Scheduling`). Low-level reusable domain logic MUST be placed in **Services**. Fine-grained entity capabilities (`DoorCapability`) are forbidden.
9. **ADR-009 Graph Identity & Version Lineage**: Every graph instance possesses a `GraphIdentity` containing `graph_id`, `parent_id`, `revision`, `hash_algorithm="sha256"`, and `content_hash` to support immutable branching (AI proposal vs. human review vs. auto-correction).
10. **ADR-010 Evidence Traceability**: Every `GraphNode` MUST contain `evidence_ids: tuple[str, ...]` linking directly to the `FeatureStore` Evidence Repository to ensure AI explainability and prevent hallucination.
11. **ADR-011 Derived Knowledge & Provenance**: Derived graph entities must preserve derivation lineage via `derivation_ids: tuple[str, ...]` alongside `evidence_ids` to maintain an unbroken AI reasoning chain.

---

## 4 Strategic Milestones

- **Milestone A (Foundation)**: `GraphIdentity` (sole owner of `revision`), `GraphMetadata` (`schema_version` only — no revision duplication), `GraphDelta` + `EdgeDelta`, `CommandMetadata`, `GraphCommand` framework (`graph/commands/`), mutation-site refactors, `RelationshipBuilder` deep-copy fix, `SharedKey` enum update. *(Status: implemented 2026-08-04.)*
- **Milestone B (Platform Core)**: `GeometryService` (cache key = `(graph_id, revision)` or `content_hash`), Selective Views (`GeometryView`, `TopologyView`, `SemanticView`), `EntityQuery` package (extensible beyond Room/Wall/Door/Space/Annotation to Window/Column/SemanticObject), `GraphQueryService` Facade, `DiffService` (shared by Executor + History + EventBus), `HistoryService`, Typed `GraphEvent` (`*Changed` payloads).
- **Milestone C (Platform Runtime)**: Layered DI Providers (`CoreProvider`, `GraphProvider`, `CapabilityProvider`, `ApplicationProvider`), `PlatformContext`, `RuleEngine` + `RuleRegistry` + Declarative Rule DSL, User-Facing Business Capabilities (`Navigation`, `Takeoff`, `Review`, `CodeCheck`, `Scheduling`).
- **Milestone D (Hardening & Invariants)**: Hierarchical `ToleranceProfile`, Evidence Repository (`ADR-006`), Node Traceability (`evidence_ids`, `derivation_ids`), 8 Automated CI Architecture Fitness Functions.

---

## 8 Automated Architecture Fitness Functions (`tests/test_architecture_fitness.py`)

1. `test_layer_violation_import_linter`: AST scan enforcing `Applications → Capabilities → Services → Views → ArchitectureGraph`.
2. `test_mutation_safety`: Asserts `id(old_graph) != id(new_graph)` and `old_graph` 100% immutability.
3. `test_cyclic_dependency_check`: AST check verifying 0 circular package imports.
4. `test_god_service_and_capability_limits`: Enforces <500 LOC and <15 public methods per class.
5. `test_cache_and_event_leak_verifier`: Verifies cache and listener teardown on reset.
6. `test_deterministic_reconstruction`: Identical DWG input produces identical node/edge IDs and content hash.
7. `test_evidence_and_derivation_traceability`: Asserts every node possesses `evidence_ids` or `derivation_ids`.
8. `test_command_replay_consistency`: Command replay sequence produces identical final content hash.

---

## Consequences

- **Maintainability**: Layer boundaries, DI decomposition, and AST import linter prevent architectural degradation and God Object accumulation over time.
- **Explainability**: Unbroken traceability from DWG CAD primitives to FeatureStore evidence to ArchitectureGraph nodes and Business Capabilities.
- **Reliability & Auditability**: CQRS command logging, immutable graph lineage trees, and 100% deterministic command replay consistency.
