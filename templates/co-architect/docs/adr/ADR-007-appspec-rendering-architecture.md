---
lang: ko
lang_reason: source-material
---

# ADR-007: ApplicationSpec & Rendering Architecture

> **Spec ID**: ADR-007
> **Version**: 1.1 (design)
> **Status**: Design approved — §13 frozen (amended 2026-07-09 per Stage C0 Retrospective; Rule Retrospective Gate: Go)
> **Created**: 2026-07-05
> **Updated**: 2026-07-09 — §13.3 amended (added the Orchestrator component and the shared-context-object requirement) per Stage C0 Retrospective; Rule Retrospective Gate: Go; previous: 2026-07-08 added §13 Architecture Decision Rules (Rule 1–5 pattern selection for future Application-layer modules; classifies by responsibility/orchestration complexity, not output format); Architecture Review Gate returned GO, §13 frozen (§13.12)
> **Authors**: architect
> **Source**: Extracted from ADR-004 §8.1–8.4, 8.6 (Application Layer, ApplicationBuilder, ElevationSpec, TaskQuery, ConstraintEngine). User-approved ADR split: "ADR-004에 더 많은 기능을 넣기보다 역할을 분리하는 것을 권합니다." §13 added per PM/user decision to fix a durable, criteria-based standard ahead of TAKEOFF-001/SECT-001/SCHED-001/REVIEW-AGENT-001.
> **Supersedes**: ADR-004 §8.2 (ApplicationBuilder), §8.3 (ElevationSpec), §8.4 (TaskQuery), §8.6 (ConstraintEngine), §8.8 partial (Renderer)
> **Related**: [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) (Pipeline — Phase 5/6 contain this architecture), [`ADR-005`](ADR-005-architecture-graph-schema.md) (Graph Schema — source of truth for all Applications), [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) (Recognition — produces Graph), [`ADR-008`](ADR-008-command-versioning-editing.md) (Commands — mutations that trigger re-render)

---

## 1. Overview

The Application Layer transforms the ArchitectureGraph into **task-specific output specifications**. Each Application is a Graph consumer that produces a typed `ApplicationSpec` — a platform-independent data model describing what to render, export, or validate.

**Core principle**: The ApplicationBuilder produces a Spec, not drawing entities. The Renderer converts Spec → format-specific output. This separation enables multiple output formats (DWG, SVG, DXF, PDF, IFC, Three.js) from the same pipeline.

**Architecture Principles Applied**:

| # | Principle | Implementation |
|---|-----------|----------------|
| AP2 | ApplicationSpec is an abstract contract (ABC/Protocol) | §2 — New spec types can be added without modifying the Renderer |
| AP8 | Renderer is read-only | §7 — Never mutates ApplicationSpec or ArchitectureGraph |

---

## 2. ApplicationSpec ABC

ApplicationSpec is the abstract base class for all task-specific output specifications. Builders may introduce new spec types without modifying the Renderer.

```python
from abc import ABC, abstractmethod

class ApplicationSpec(ABC):
    """Abstract contract for all application output specifications.

    New spec types (e.g., IFCSpec, ThreeDSpec) can be added by
    subclassing ApplicationSpec and registering a corresponding
    Renderer adapter — no existing code needs modification.
    """

    spec_type: str       # "elevation" | "section" | "ifc" | "validation" | "three_d"
    version: str         # spec schema version for evolution
    created_at: float    # timestamp
    metadata: dict       # application-specific metadata
```

---

## 3. Spec Hierarchy

```python
class ElevationSpec(ApplicationSpec):
    """Platform-independent elevation drawing specification."""
    faces: list[ElevationFace]
    floor_height: float = 2800.0
    metadata: dict = field(default_factory=dict)

class SectionSpec(ApplicationSpec):
    """Platform-independent section cut specification."""
    sections: list[Section]

class IFCSpec(ApplicationSpec):
    """IFC/BIM export specification."""
    entities: list[IFCEntity]
    project: IFCProject

class ValidationSpec(ApplicationSpec):
    """Code compliance validation specification."""
    violations: list[Violation]
    warnings: list[Violation]

class ThreeDSpec(ApplicationSpec):
    """3D mesh/export specification."""
    meshes: list[Mesh]
    materials: list[Material]
```

### ElevationSpec Detail

```python
@dataclass
class ElevationSpec(ApplicationSpec):
    spec_type: str = "elevation"
    faces: list[ElevationFace]           # one per compass direction
    floor_height: float = 2800.0
    metadata: dict = field(default_factory=dict)

@dataclass
class ElevationFace:
    direction: str                       # "south" | "north" | "east" | "west"
    walls: list[ElevationWall]
    openings: list[ElevationOpening]
    level_marks: list[LevelMark]
    total_span: float                    # cumulative X-span after wall concatenation

@dataclass
class ElevationWall:
    wall_id: str                          # "Wall:0012"
    length: float                        # wall length in mm
    thickness: float                     # wall thickness in mm
    start_x: float                       # X position in concatenated elevation
    openings: list[ElevationOpening]      # openings on this wall segment

@dataclass
class ElevationOpening:
    opening_id: str                       # "Door:0056" or "Window:0078"
    offset: float                         # distance along wall from wall start
    width: float
    sill_height: float                     # from floor
    head_height: float                    # from floor
    opening_type: str                     # "door" | "window" | "sliding_door" | etc.

@dataclass
class LevelMark:
    label: str                            # "FL", "CH", "GL"
    height: float                         # from floor in mm
```

This enables DWG, SVG, DXF, PDF, Three.js from the same Spec.

---

## 4. ApplicationBuilder

ApplicationBuilder is the abstract base for all Graph-to-Spec transformers. Elevation is one Application among many.

```python
class ApplicationBuilder(ABC):
    """Abstract builder contract. All applications share build(graph, query)."""

    @abstractmethod
    def build(self, graph: ArchitectureGraph, query: TaskQuery) -> ApplicationSpec: ...
```

### Current and Future Implementations

```python
# Implemented
class ElevationBuilder(ApplicationBuilder):
    def build(self, graph, query) -> ElevationSpec: ...

# Future
class SectionBuilder(ApplicationBuilder):
    def build(self, graph, query) -> SectionSpec: ...

class RuleCheckBuilder(ApplicationBuilder):
    def build(self, graph, query) -> ValidationSpec: ...

class QuantityBuilder(ApplicationBuilder):
    def build(self, graph, query) -> BOQ: ...

class BIMExportBuilder(ApplicationBuilder):
    def build(self, graph, query) -> IFCSpec: ...

class AIContextBuilder(ApplicationBuilder):
    def build(self, graph, query) -> AIContext: ...
```

All builders share `build(graph, query)` — `TaskQuery` is the universal input (§5).

---

## 5. TaskQuery

TaskQuery is a **generalized query**, not elevation-specific. Reusable across all applications.

```python
@dataclass
class TaskQuery:
    task: str              # "elevation" | "section" | "rule_check" | "3d_export" | "ai_edit"
    room_id: str | None    # specific room filter
    face: str | None       # compass direction ("south", "north", etc.)
    object_id: str | None  # specific object filter
    metadata: dict          # application-specific parameters

def extract_task_graph(graph: ArchitectureGraph, query: TaskQuery) -> ArchitectureGraph:
    """Extract minimal sub-graph matching the query parameters."""
```

The TaskQuery → sub-graph extraction enables focused downstream processing. AI receives the sub-graph, not the full ArchitectureGraph.

---

## 6. ConstraintEngine

Validates ArchitectureGraph before or after application use. Produces `ValidationReport` with optional `FixSuggestion`.

```python
@dataclass
class Violation:
    object_id: str
    constraint: str
    severity: str             # "error" | "warning"
    message: str
    value: float
    threshold: float
    fix_suggestion: str | None = None   # "Increase width to 900mm"

@dataclass
class ValidationReport:
    violations: list[Violation]
    warnings: list[Violation]
    passed: bool

class ConstraintEngine:
    def register_constraint(self, constraint: Constraint): ...
    def validate(self, graph: ArchitectureGraph) -> ValidationReport: ...
    def validate_for_app(self, spec: ApplicationSpec) -> ValidationReport: ...
```

### Built-in Constraints (Korean Residential)

| Constraint | Rule | Severity |
|-----------|------|----------|
| Min door width | ≥ 800mm | error |
| Min door height | ≥ 2000mm | error |
| Min window sill | ≥ 900mm | warning |
| Max window head | ≤ ceiling height | warning |
| Min room area | ≥ 6.0㎡ (habitable) | error |

Extensible via `register_constraint()` for jurisdiction-specific codes.

---

## 7. Renderer (Read-Only)

**Core principle**: The Renderer never mutates ApplicationSpec or ArchitectureGraph. It is a pure function: `Spec → DrawingEntity[]`.

```python
class Renderer:
    """Traverses an ApplicationSpec and produces format-independent drawing entities."""

    def render(self, spec: ApplicationSpec) -> list[DrawingEntity]:
        """Pure rendering — no mutations to spec or graph."""

class DWGAdapter:
    """Converts DrawingEntity[] to ZWCAD-compatible DWG format."""

    def export(self, entities: list[DrawingEntity]) -> bytes: ...

class SVGAdapter:
    """Converts DrawingEntity[] to a standalone SVG document (implemented)."""

    def adapt(self, entities: list[DrawingEntity]) -> str: ...

class DXFAdapter:
    """Converts DrawingEntity[] to a DXF document via ezdxf (implemented)."""

    def adapt(self, entities: list[DrawingEntity]) -> str: ...

class PDFAdapter:
    """Converts DrawingEntity[] to a paginated, scale-to-fit A3-landscape PDF (implemented)."""

    def adapt(self, entities: list[DrawingEntity]) -> bytes: ...

# Future adapters:
class ThreeJSAdapter: ...
class IFCAdapter: ...
```

### Rendering Pipeline

```
ArchitectureGraph
       │
       ▼
TaskQuery → ApplicationBuilder → ApplicationSpec
                                    │
                                    ▼
                              ConstraintEngine (validate)
                                    │
                                    ▼
                              Renderer → DrawingEntity[]
                                    │
                                    ▼
                              DWGAdapter → .dwg file
                              SVGAdapter → .svg file
                              DXFAdapter → .dxf file
                              PDFAdapter → .pdf file
```

### Read-Only Guarantee

The Renderer and all adapters:
- Never call `graph.add_node()`, `graph.add_edge()`, or any mutation method
- Never modify `spec.faces`, `spec.walls`, or any spec field
- Receive spec and graph as read-only inputs
- Produce output as new objects (no shared mutable state)

If mutation is needed (e.g., AI edit → re-render), the Command Pattern (ADR-008) handles it through the proper mutation channel.

---

## 8. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D9 | ApplicationBuilder abstraction | Elevation is one Application among many (Section, RuleCheck, 3D, BIM). Shared `build(graph, query)` interface. |
| D10 | ElevationSpec, not Drawing Entities | Builder produces platform-independent Spec; Renderer converts to format. Enables DWG/SVG/DXF/PDF from same pipeline. |
| D11 | TaskQuery as generalized query | Reusable across all applications (Elevation, Section, RuleCheck, AI). Not elevation-specific. |
| D14 | ConstraintEngine with FixSuggestion | Violations carry suggested fixes for AI auto-correction. Extensible per jurisdiction. |
| D31 | ApplicationSpec is ABC/Protocol | New spec types added without modifying Renderer or existing builders. |
| AP2 | Renderer is read-only | Renderer never mutates ApplicationSpec or ArchitectureGraph. Pure function: Spec → DrawingEntity[]. |

---

## 9. Package Structure

```
src/cad_intelligence/
├── graph/                    (Knowledge Layer — ADR-005)
│   ├── elevation_spec.py      ElevationSpec, ElevationFace, ElevationWall, ElevationOpening, LevelMark
│   ├── task_query.py         TaskQuery + extract_task_graph()
│   ├── builder.py             ApplicationBuilder ABC + ElevationBuilder
│   ├── constraint_engine.py  Constraint + Violation + ValidationReport + FixSuggestion
│   └── ...
├── renderer/                  (Rendering Layer)
│   ├── base.py                DrawingEntity + Renderer (read-only)
│   ├── dwg_adapter.py         DWGAdapter → ZWCAD-compatible format
│   ├── svg_adapter.py         SVGAdapter → standalone .svg document (implemented)
│   ├── dxf_adapter.py         DXFAdapter → .dxf document via ezdxf (implemented)
│   └── pdf_adapter.py         PDFAdapter → scale-to-fit A3-landscape .pdf via pymupdf (implemented)
└── ...
```

Future adapter additions (`threejs_adapter.py`, `ifc_adapter.py`, etc.) require only new files — no existing code changes.

---

## 10. Acceptance Criteria

- [ ] `ApplicationBuilder` ABC with `build(graph, query)` interface
- [ ] `ElevationBuilder` produces `ElevationSpec` (not drawing entities) from Architecture Graph
- [ ] `ElevationSpec` uses `ElevationFace` (not `WallSection`) — face is the upper concept
- [ ] `TaskQuery` extracts task-specific sub-graph (reusable across all applications)
- [ ] `ConstraintEngine` validates graph with `FixSuggestion` on violations
- [ ] `Renderer` traverses `ElevationSpec` → `DrawingEntity`; `DWGAdapter` converts to ZWCAD format
- [ ] Renderer and adapters never mutate ApplicationSpec or ArchitectureGraph (read-only guarantee)
- [ ] Built-in Korean residential constraints (min door width 800mm, min door height 2000mm, etc.)
- [ ] `register_constraint()` enables jurisdiction-specific constraint extension

---

## 11. Out of Scope

1. **Three.js Adapter** — interface ready, implement when needed. Deferred to M2–M3. (`SVGAdapter`, `DXFAdapter`, and `PDFAdapter` are implemented — see `renderer/svg_adapter.py`, `renderer/dxf_adapter.py`, and `renderer/pdf_adapter.py`.)
2. **Quantity Takeoff (BOQ)** — separate ApplicationBuilder, designed when needed.
3. **IFC Export** — IFCSpec defined, but export logic is future work.
4. **Material / Style System** — when BIM/IFC export needs it.

---

## 12. Related

- [`ADR-004`](ADR-004-cad-intelligence-pipeline-design.md) — Pipeline & Artifact Architecture (Phase 5 "Application Pipeline" and Phase 6 "Rendering")
- [`ADR-005`](ADR-005-architecture-graph-schema.md) — Architecture Graph Schema (source of truth for all ApplicationBuilders)
- [`ADR-006`](ADR-006-pattern-dsl-recognition-engine.md) — Pattern DSL (produces the Graph that Applications consume)
- [`ADR-008`](ADR-008-command-versioning-editing.md) — Command / Versioning / Editing (handles mutations that trigger re-render)
- [`ADR-009`](ADR-009-pipeline-execution-framework.md) — Pipeline Execution Framework (implements SupportsApplicationSpec Protocol, SupportsBuilder Protocol, ElevationSpec Protocol compliance, SupportsGraphMutation M6+ stub)
- [`ELEV-002`](../designs/ELEV-002-design.md) — Existing wall-centric model and elevation generation (Phase D extends this)

---

## 13. Architecture Decision Rules (Application-Layer Pattern Selection)

> **Added**: 2026-07-08. **Why now**: two shipped, tested pipelines — `facade/` (FacadePipeline) and `elevation/` (Face-Centered Four-Domain pipeline, its own `Renderer(ABC)` in `elevation/renderer_base.py`) — never adopted the `SupportsApplicationSpec`/`SupportsBuilder` Protocol this ADR specifies (§2, §4, `application/__init__.py`). Only `graph/builder.py`'s `ApplicationBuilder`/`ElevationBuilder` follows it. Four new Application-layer modules (`TAKEOFF-001`, `SECT-001`, `SCHED-001`, `REVIEW-AGENT-001`) are about to be designed into code, so this ADR now fixes a durable, criteria-based standard for **which pattern a new module must use**, before ad hoc precedent compounds.
>
> **Classification axis**: rules classify by **module responsibility / orchestration complexity**, not by output format. A module that looks like "drawing output" (e.g. `SECT-001`) can still be Rule-1 or Rule-2 depending on whether its defining complexity is geometry computation or a flat Graph query; a module that looks like "report output" (e.g. `REVIEW-AGENT-001`) is Rule-3 specifically because its defining complexity is rule-engine + LLM policy branching, not because it emits text.

### 13.1 Rule 1 — Self-Contained Orchestrator (Geometry / Drawing Generation)

**Applies when**: the module's core complexity is deterministic geometry computation and drawing/view generation (projection, layout, mesh-building, unfolding, boolean cuts) — the hard part is geometric, not the Graph query or a policy decision.

**Pattern**: a self-contained pipeline package with its own orchestrator and its own `Renderer(ABC)` (or equivalent), independent of `SupportsApplicationSpec`/`SupportsBuilder`. Internal stages (builder → layout → render) may be structured however the geometry problem demands; the package boundary is the contract, not this ADR's Protocol.

**Examples**: `facade/` (FacadePipeline), `elevation/` (Face-Centered Four-Domain pipeline), future `SECT-001` (section-cut geometry generation).

### 13.2 Rule 2 — `SupportsBuilder` Protocol (Deterministic Graph Query → Structured Export)

**Applies when**: the module's core complexity is a deterministic Graph query producing a tabular/structured export — no rule engine, no LLM branching, no drawing generation.

**Pattern**: implement `SupportsBuilder` (`build(graph, query, context=None) -> SupportsApplicationSpec`) as specified in §2/§4 of this ADR, registering a new `ApplicationSpec` subtype (or Protocol-conformant spec) consumed by a downstream exporter/renderer.

**Examples**: `graph/builder.py`'s `ElevationBuilder` (existing, reference implementation — see ADR-009 §7 for M1–M5 Protocol-compliance status), future `TAKEOFF-001` (quantity takeoff / BOQ), future `SCHED-001` (schedule table export).

### 13.3 Rule 3 — Composite Orchestrator (Rule Engine + LLM Policy) — explicitly NOT a Builder rule

**Applies when**: the module's core complexity is rule-engine and/or LLM-driven policy decisions over Graph data — shape: `Graph → Rule Engine → LLM → Merge → Report`.

**Pattern**: this is **not** satisfied by `SupportsBuilder` alone (a single `build()` call cannot represent branching policy logic without hiding it). MUST split into five separate components:

| Component | Responsibility |
|---|---|
| **Builder** | Assembles input from Graph (may itself be a `SupportsBuilder`, feeding the other three) |
| **Policy** | Rule-based checks + severity policy (deterministic, no LLM) |
| **LLM** | Model-driven checks (judgment calls the rule engine can't express) |
| **Aggregator** | Merges deterministic + LLM findings, deduplicates, normalizes severity, generates the final report |
| **Orchestrator** | Coordinates execution order across Builder → Policy → LLM → Aggregator, owns the `ReviewContext` lifecycle, returns the final `ReviewReport` |

> **Amendment (2026-07-09, Stage C0 Retrospective)**: the Orchestrator component is REQUIRED. Its sequencing responsibility MUST NOT be left implicit in a calling layer (e.g. an MCP tool handler) — the Stage C0 spike found that `REVIEW-AGENT-001`'s skeleton had pushed Builder → Policy → LLM → Aggregator sequencing implicitly into the MCP tool layer, which Rule 3's original four-part text didn't assign anywhere. A Rule 3 module's own package — not its MCP-facing caller — owns orchestration.

**Shared intermediate representation**: Policy, LLM, and Aggregator MUST NOT each query the Graph/GeometryModel/SemanticModel independently. A Rule 3 module MUST define a shared context object — analogous to `ReviewContext` (`REVIEW-AGENT-001`'s instance of this shape) — that the Builder produces and that Policy and LLM both consume, with Aggregator's inputs (the issue lists it merges) deriving from checks run against that same object. This is a required *shape* — a context object flowing Builder → Policy → LLM → Aggregator → Report — not a mandate that every future Rule 3 module name its type `ReviewContext`; each module names its own.

**Example**: future `REVIEW-AGENT-001` (code-compliance review agent — rule-engine checks + LLM judgment calls, merged into one report).

### 13.4 Rule 4 — `RendererAdapter` (Format Transformation Only, No Graph Access)

**Applies when**: the module only transforms already-rendered drawing entities between output formats and never touches the ArchitectureGraph.

**Pattern**: follow the existing `renderer/dwg_adapter.py` convention — a stateless adapter class converting `DrawingEntity[]` (or equivalent format-agnostic primitives) to the target format, with no Graph read access.

**Examples**: `DWGAdapter`, `SVGAdapter`, `DXFAdapter`, `PDFAdapter` (existing), future `ThreeJSAdapter`/`IFCAdapter` (per §7, §11).

### 13.5 Rule 5 — Adapter (External Platform / Tool Integration) — placeholder

**Applies when**: a module's primary job is integrating an external platform or tool (COM automation, MCP server, third-party API) rather than producing an ApplicationSpec or report from the Graph.

**Pattern**: placeholder — no concrete Application-layer module currently matches this shape purely (COM bridge / MCP server code exists but predates this ADR and sits outside the Application layer proper). Refine this rule with concrete criteria the first time a genuine case arises; until then, treat it as reserved so Rule 1–4 aren't stretched to cover integration-only modules.

### 13.6 Exception Clause

A module that fits no rule above, or that must deviate from its matching rule, requires an **explicit ADR amendment to this section** before implementation begins. No undocumented one-offs — "this one case is different" is not a substitute for writing down why.

### 13.7 Approval Clause

The **architect** owns sign-off on which rule a new module maps to. The mapping MUST be recorded in that module's own design doc header as:

```
Pattern: Rule N
Rationale: <one line explaining why this rule fits — responsibility/complexity, not output format>
```

### 13.8 PR Traceability Clause

Every implementation PR for a Rule 1–5 module MUST include an "Architecture Rule" block in its description, mirroring the design-doc header, so `ADR → Design Doc → PR` traceability holds end to end:

```
Architecture Rule
Rule: <N>
Rationale: <...>
Exceptions: <none, or link to the ADR amendment under §13.6>
```

### 13.9 Rule Coverage Table (living — update as each module ships)

| Rule | Modules |
|---|---|
| Rule 1 (Self-Contained Orchestrator) | `facade/` (FacadePipeline — FACADE-001/002, Implemented), `elevation/` (Face-Centered Four-Domain pipeline — ADR-face-elevation-architecture, Active/Design Freeze), `section/` (SectionBuilder — SECT-001, Implemented — M4 scope: cut-line spec, shapely wall-intersection, section-view drawing generation), `ceiling/` (CeilingBuilder — CEIL-001, Implemented — M5 basic scope: per-room ceiling zone derivation, downlight fixture grid placement, RCP drawing generation; no HVAC zones or sloped ceilings) |
| Rule 2 (`SupportsBuilder` Protocol) | `graph/builder.py`'s `ElevationBuilder` (existing, reference implementation), future `TAKEOFF-001`, `SCHED-001` (Implemented — Door/Window schedule only; Finish Schedule deferred, needs `CEIL-001`) |
| Rule 3 (Composite Orchestrator) | `review_agent/` (`ReviewOrchestrator` — REVIEW-AGENT-001, Implemented) |
| Rule 4 (`RendererAdapter`) | `renderer/dwg_adapter.py`'s `DWGAdapter`, `renderer/svg_adapter.py`'s `SVGAdapter`, `renderer/dxf_adapter.py`'s `DXFAdapter` (existing), `renderer/pdf_adapter.py`'s `PDFAdapter` (Implemented — Stage D, scale-to-fit A3-landscape page via `pymupdf`) |
| Rule 5 (Adapter — placeholder) | *(none yet — reserved)* |

### 13.10 Anti-Drift Clause

If a repeated exception (§13.6) starts forming a recognizable, repeatable shape — not a one-off but a pattern that would apply to multiple future modules — this ADR MUST be amended: either revise an existing rule's criteria or add a new numbered rule (Rule 6+). Judge by **"has a new repeatable shape emerged,"** not by counting exceptions against a fixed threshold. A single well-justified exception is not drift; a third module independently reinventing the same deviation is.

### 13.11 Disposition of Existing Non-Conforming Modules

Per §13's premise, `facade/`, `elevation/`, and `graph/builder.py` do not uniformly follow one pattern today. Their disposition, confirmed against each module's current design-doc status header:

| Module | Current status | Disposition |
|---|---|---|
| `facade/` (FacadePipeline) | FACADE-001 v1.1: **Implemented** (Steps 1–5, 8; Steps 6–7 deferred). FACADE-002 v1.1: **Implemented**. | **Stays as-is, mapped retroactively to Rule 1** (no migration). Both are shipped and tested; the self-contained-orchestrator shape is exactly what Rule 1 now formalizes. Migrating to a `SupportsBuilder`-wrapped shim would be pure churn — no new spec type, no new renderer, no functional benefit. Revisit only if a cross-cutting concern that must reach all Application-layer modules uniformly (e.g. versioning/undo integration per ADR-008, or a shared telemetry/audit hook) needs `facade/` to expose a `SupportsBuilder`-compatible entry point. |
| `elevation/` (Face-Centered Four-Domain pipeline) | `ADR-016-face-elevation-architecture.md`: **Active (v14 — Design Freeze)**. Its own `Renderer(ABC)` (`elevation/renderer_base.py`) is explicitly documented as read-only/draw-only, mirroring this ADR's AP8 principle independently. Note: `elevation/` also retains a `legacy/` subpackage (ELEV-003, **Superseded** 2026-07-07) kept only for backward-compatible re-exports and feature-frozen. | **Stays as-is, mapped retroactively to Rule 1** (no migration). Design Freeze status means no further structural change is planned short of a new design gate; the package already independently converged on the same read-only-renderer principle this ADR specifies for its own Protocol path. Migration would require reopening a frozen design for no behavioral change. Revisit only if `elevation/` needs to interoperate with a Rule-2/3 module's Protocol-based spec (e.g. a future `SECT-001` sharing geometry primitives with `elevation/`) — at that point evaluate whether a thin `SupportsApplicationSpec`-conformant wrapper is warranted, without touching the internal pipeline. |
| `graph/builder.py` (`ApplicationBuilder`/`ElevationBuilder`) | ADR-009 §7: **M1–M5 implemented**, `ElevationSpec` confirmed satisfying `SupportsApplicationSpec` (structural, duck-typed). | **Already conforms — no action.** This is the reference implementation Rule 2 is built from. Note for future maintainers: `ElevationBuilder.build(self, graph, query)` omits the `context: Any = None` parameter present in the `SupportsBuilder` Protocol signature (`application/__init__.py` line ~81); this doesn't break `runtime_checkable` `isinstance` checks (Python's `Protocol` only checks member presence, not signatures) but is a latent inconsistency worth tightening — not urgent enough to block this ADR revision, flagged here so a future PR against `graph/builder.py` closes the gap. |

### 13.12 Architecture Review Result

**Decision**: GO

**Rationale**:
- Rules 1–4 are defined from real, already-shipped implementations, with clear responsibility/complexity boundaries.
- Rule 5 was deliberately left as a reserved placeholder rather than forcing a premature generalization — consistent with this ADR's own anti-drift principle.
- Exception, Approval, PR Traceability, Rule Coverage, and Anti-drift clauses are all present, giving this rule set the governance needed to operate for 6+ months without requiring perfection on day one.
- Existing core pipelines (`facade/`, `elevation/`, `graph/builder.py`) each have an explicit, criteria-bound disposition (§13.11) rather than being left unaddressed.

**Accepted follow-ups (non-blocking)**:
1. Rule 5 remains reserved until a concrete external-platform-integration module actually needs it — do not generalize ahead of a real case.
2. `ElevationBuilder.build()`'s missing `context` parameter (noted in §13.11) is tracked as an ADR-007 Protocol conformance cleanup item for a future small PR — an implementation-conformance gap, not a rule-design question, and does not block Stage C0.

**Status**: ADR-007 is now **FROZEN** as of this decision. No further edits to §13 until the Stage C0 Retrospective is complete and the Rule Retrospective Gate is evaluated.

**Stage C0 Retrospective Update (2026-07-09)**: the Rule Validation Spike (Stage C0) found a real, scoped gap in Rule 3 (§13.3) — the four-part Builder/Policy/LLM/Aggregator split held with no forced exception, but nothing in the rule assigned ownership of Builder→Policy→LLM→Aggregator sequencing (it had drifted implicitly to the MCP tool layer in the `REVIEW-AGENT-001` skeleton), and Policy/LLM lacked a defined shared intermediate representation. This was closed by a small, scoped §13.3 amendment on 2026-07-09 (added the Orchestrator component and the shared-context-object requirement) — not a rule redesign; the four-part split itself is confirmed correct by the spike. **Rule Retrospective Gate: GO.** ADR-007 §13 remains frozen as amended.

---
