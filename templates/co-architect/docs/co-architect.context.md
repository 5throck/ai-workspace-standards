# co-architect — co-architect Configuration

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE —all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md                 —immutable project identity (architecture, standards)
>   2. docs/co-architect.context.md    —THIS FILE —tool stack, agents, skills, workflow

---

## Tool Stack

| Purpose | Tool |
|---------|-------|
| **Research** | N/A — workspace-internal |
| **Documentation** | Markdown |
| **Coordination** | GitHub (Issues, PRs, Projects) |
| **Productivity Suite** | MS365 |
| **Version Control** | Git |

## MCP Servers

| Server Name | Configuration Key | Purpose | Status |
|-------------|-------------------|---------|--------|
| **building_skill** | `building_skill` | Korean Building Act and zoning regulations analyzer | active |
| **zwcad-mcp** | `zwcad-mcp` | 2D/3D ZWCAD file automation and drawing generation (56 tools) | active |
| **base-map** | `base-map` | Local LLM inference for code review, embeddings, and ensemble consultation | active |


---

## Design Stack

| Layer | Technology / Standard |
|-------|----------------------|
| **Design Tokens** | Figma Variables / CSS Custom Properties |
| **Component Library** | Custom / shadcn/ui |
| **Prototyping Tool** | Figma / Framer |
| **Handoff Format** | Figma Dev Mode / Storybook |
| **Research Tools** | Maze, UserTesting |

---

## Agents
<!-- VARIANT-INJECT: agents -->

<!-- context-proximity: agent roles summarized here for AI context window efficiency; authoritative definitions in agents/*.md -->

<!-- Add/remove rows as agents are introduced or retired via lifecycle management. -->
<!-- Status: active | deprecated | experimental -->

### Design Team (Lead: design-lead)

| Agent | File | Role | Status |
|-------|------|------|--------|
| Co-Architect PM (Orchestrator) | `agents/pm.md` | Cross-team orchestration, dispatch, quality gates | active |
| Design Lead | `agents/design-lead.md` | Team lead; design system, visual direction | active |
| UX Researcher | `agents/ux-researcher.md` | User research and usability insights | active |
| Visual Designer | `agents/visual-designer.md` | Visual designs and component specs | active |
| Prototype Engineer | `agents/prototype-engineer.md` | Interactive prototypes and handoff | active |
| Service Designer | `agents/service-designer.md` | End-to-end service experience | active |
| Typography Expert | `agents/typography-expert.md` | Type hierarchy and font systems | active |
| Design Storyteller | `agents/design-storyteller.md` | Design philosophy and narrative foundation | active |
| Visualization Expert | `agents/visualization-expert.md` | Photorealistic 3D rendering and bird's-eye view visualization | active |
| Interior Designer | `agents/interior-designer.md` | Interior space planning, furniture layout, material finishes | active |

### Research Team (Lead: analyst)

| Agent | File | Role | Status |
|-------|------|------|--------|
| Analyst | `agents/analyst.md` | Team lead; research, data synthesis, evidence gathering | active |
| Content Writer | `agents/content-writer.md` | Documentation and written communications | active |
| Storyteller | `agents/storyteller.md` | Organizational culture and change narratives | active |
| Bylaw Expert | `agents/bylaw-expert.md` | Building code, zoning regulations (BCR/FAR), municipal bylaws | active |

### Project Team (Lead: project-coordinator)

| Agent | File | Role | Status |
|-------|------|------|--------|
| Project Coordinator | `agents/project-coordinator.md` | Team lead; schedule, stakeholder management, RFP tracking, proposal coordination | active |
| Technical Writer | `agents/technical-writer.md` | Technical documentation and specifications | active |
| MS365 Expert | `agents/ms365-expert.md` | MS365 / SharePoint automation and publishing | active |

### Engineering Team (Lead: sketchup-modeler)

| Agent | File | Role | Status |
|-------|------|------|--------|
| SketchUp Modeler | `agents/sketchup-modeler.md` | Team lead; 3D architectural modeling from Design Team handoff packages | active |
| ZWCAD Drafter | `agents/zwcad-drafter.md` | 2D technical drawings (floor plans, elevations, sections); DWG file management via file_curator | active |
| Drafting Architect | `agents/drafting-architect.md` | Architectural drafting standards lead, section details, DWG set audit | active |
| Structural Engineer | `agents/structural-engineer.md` | Structural feasibility, load path analysis, bearing wall classification | active |
| MEP Engineer | `agents/mep-engineer.md` | Building services (HVAC/electrical/plumbing), shaft routing, RCP integration | active |

**Engineering Team Activation Condition**: Engineering Team is dispatched in `workflow: design-delivery` (Phase 3–4), `workflow: permit-compliance` (Phase 1–4), `workflow: interior-execution` (Phase 3–4), and `workflow: project-acquisition` (Phase 3). May also contribute optionally to `workflow: design-exploration` (Phase 4, 3D sketch/render only). Never activated in `workflow: market-research`.

**Engineering Team Handoff Protocol**: Design Team must deliver the handoff package to sketchup-modeler **after design-lead Phase 2 gate approval only**:
1. Concept Sheet (design intent, spatial hierarchy, tone-and-manner)
2. Floor Plan Diagram (schematic functional layout)
3. Design Token Spec (color, materials, lighting direction)
4. Reference Moodboard (volume interpretation images)

**Revision Decision Tree**:
- Technical drawing correction → Engineering Team self-resolves
- Spatial interpretation question → sketchup-modeler confirms with design-lead
- Design intent change → stop work → PM → Phase 2 gate return

### Platform Engineering Team (Lead: architect)

| Agent | File | Role | Status |
|-------|------|------|--------|
| Architect | `agents/architect.md` | Team lead; implementation plans, design docs, ADRs for MCP server / CAD-automation backend (Phase 1-2) | active |
| Automation Engineer | `agents/automation-engineer.md` | Implements approved plans — MCP tools, Python data models, COM handlers, unit tests (Phase 3-4) | active |

**Platform Engineering Team Scope**: This team owns the *software* layer (`src/cad_intelligence/`, `src/agent/`, `src/file_curator/`, `src/lisp/`, `src/mcp_connector/`, `src/parser/`) — MCP tool implementation, data models, geometry/COM automation logic. It is distinct from Engineering Team, which owns *CAD drawing production* (SketchUp models, ZWCAD drawings) using the tools this team builds. A feature that needs both (e.g. a new elevation-generation capability) is planned by architect, implemented by automation-engineer, and only then produced as drawings by zwcad-drafter. Also distinct from Design Team (visual/design-system architecture).

**Activation Condition**: Dispatched whenever a request requires a design doc (`docs/designs/<spec-id>-design.md`) and/or non-trivial code changes to the MCP server or CAD-automation backend — independent of the six named workflows (`market-research`/`design-exploration`/`project-acquisition`/`design-delivery`/`permit-compliance`/`interior-execution`), since backend/tooling work can be needed by any of them.

> Lifecycle management: `bun scripts/agent-lifecycle-audit.ts`
> After any agent change, update AGENTS.md and this table.
<!-- END VARIANT-INJECT -->

---

## Skills

<!-- context-proximity: variant-specific workflow skills summarized here for AI context window efficiency; authoritative definitions in skills/<name>/SKILL.md -->

- `cad-server-manager` — manages the lifecycle of the local CAD Agent web server (start, stop, restart, connection status)
- `cad-space-recognition` — recognizes rooms, non-room zones, doors, and windows in a ZWCAD floor plan (vision-first workflow, ADR-018); builds/corrects room ground truth and scores detection against it
- `cad-svg-preview` — previews floor plans and room elevations as SVG rendered from DWG entities before anything is drawn in ZWCAD
- `generate-room-elevation` — generates 4-direction unfolded wall elevations (North → East → South → West) for rooms in ZWCAD
- `zwcad-ai-drawing` — draws geometry in ZWCAD 2026 via MCP tools (primary) or the Python CAD Agent (fallback for ambiguous natural-language prompts)
- `standup-synthesizer` — automated daily standup digest aggregating git commits, issue updates, PR reviews, and ticket events over a 24-hour window

Also uses the L1 common skills inherited from `templates/common/skills/` (e.g. `decision-record`, `design-foundation`, `evidence-ledger`, `explain-me`, `i18n-*`) — see templates/common/skills/.

> Lifecycle management: `bun scripts/skill-lifecycle-audit.ts`
> After any skill change, update AGENTS.md §6 and this list.

---

## Development Workflow
<!-- VARIANT-INJECT: development-workflow -->

```
Brief / task received
  —
/sync "feat: description"
  —
  1. audit.ts —abort on failure
  2. memory/YYYY-MM-DD.md —session log (4-section format)
  3. MEMORY.md index update
  4. git add -A —commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order

```
Co-Architect PM
  — [workflow: market-research]
      analyst → ux-researcher, storyteller, bylaw-expert (parallel research)
              → content-writer, storyteller (report production)
              → project-coordinator (publication)

  — [workflow: design-exploration]
      design-lead → ux-researcher, analyst, design-storyteller, interior-designer (trend research)
                  → visual-designer, typography-expert, design-storyteller, interior-designer (execution)
                  → prototype-engineer, sketchup-modeler, visualization-expert (artifacts, optional)

  — [workflow: project-acquisition]
      project-coordinator, analyst, bylaw-expert (feasibility — parallel)
      → design-lead, visual-designer, sketchup-modeler, visualization-expert, content-writer (proposal — parallel)
      → project-coordinator (assembly + submission)

  — [workflow: design-delivery]
      ux-researcher, service-designer, analyst, bylaw-expert (discovery — parallel)
      → design-lead + bylaw-expert, structural-engineer (Phase 2 gate + handoff package)
      → visual-designer, typography-expert, design-storyteller, sketchup-modeler, structural-engineer, mep-engineer, interior-designer, drafting-architect (execution — parallel)
      → zwcad-drafter, drafting-architect, visualization-expert, prototype-engineer (drawing + presentation — parallel)

  — [workflow: permit-compliance]
      bylaw-expert, structural-engineer, mep-engineer (regulatory & structural discovery)
      → bylaw-expert (compliance audit gate)
      → drafting-architect, mep-engineer, structural-engineer (permit drawing specs & detail setup)
      → zwcad-drafter, drafting-architect (permit DWG production & audit)

  — [workflow: interior-execution]
      ux-researcher, interior-designer (interior spatial discovery)
      → interior-designer (interior concept & material gate)
      → interior-designer, mep-engineer, visual-designer (space planning & service coordination)
      → zwcad-drafter, visualization-expert, interior-designer (room elevation & render production)
```

### Workflow Phases

| Phase | Name | What Happens | Primary Owner |
|-------|------|--------------|---------------|
| 0 | Team Assembly | PM classifies request, selects one of 6 workflows, assembles team | PM |
| 1 | Research / Discovery | Team lead gathers data, evidence, and context | Team Lead |
| 2 | Review & Alignment | PM + team lead approve direction; Engineering Team gate for design-delivery | PM + Team Lead |
| 3 | Creation / Execution | Specialists produce deliverables in parallel; Engineering Team starts after Phase 2 gate | Specialists |
| 4 | Delivery / Integration | Handoff, drawing production, publication, stakeholder review | Team Lead |
| 5 | Quality Assurance | PM runs audit scripts | PM |
| 6 | PR & Handoff | PM runs /sync, creates PR | PM |
<!-- END VARIANT-INJECT -->

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Writing Guidelines
<!-- canonical: this project's coding/PR guidelines, maintained locally -->

### Core Principles

1. **Audience-first** — write for the reader; tailor tone, depth, and format to their context.
2. **Clarity over cleverness** — plain language preferred; no jargon without definition.
3. **Evidence-based** — all claims supported by sources or data; cite inline.
4. **Consistent voice** — follow the established style guide for tone and terminology.
5. **PR required** — all content changes via `/sync`; never direct push to main.

### Content Review Process

All content must pass a peer review before publication. Use the content review checklist in `docs/content-review-checklist.md`.

### Hybrid Scripting

All scripts are TypeScript (`.ts`) executed via Bun — no `.sh`/`.ps1` counterparts (ADR-0036).
<!-- END VARIANT-INJECT -->

### Translation Zone Convention

Root-level `*_ko.md` files (e.g. `README_ko.md`) are the declared Korean translation zone for this workspace. They are exempt from the English-only documentation rule **without** requiring `lang:`/`lang_reason:` frontmatter.

---

## File Organization Policy
<!-- VARIANT-INJECT: file-organization -->

### Recommended Folder Structure
| Folder | Purpose |
|--------|---------|
| `docs/reports/` | Final deliverables, client-ready reports |
| `docs/drafts/` | Work-in-progress documents and drafts |
| `docs/research/` | Research notes, reference materials |
| `memory/` | Session logs, meeting transcripts |
<!-- END VARIANT-INJECT -->

---

## CAD Intelligence Platform Architecture (v5.1 Frozen Constitution)

> **Implementation status (2026-08-04)**: All 4 milestones of the v5.1 Frozen Constitution are implemented per ADR-017 (docs/adr/). Milestone A (Foundation: `GraphIdentity`, `GraphMetadata`, `GraphDelta`, `EdgeDelta`, immutability fixes), Milestone B (Platform Core: `GeometryService`, 3 Views, EntityQuery package, `DiffService`, `HistoryService`, EventBus GraphDelta), Milestone C (Platform Runtime: 5 DI Providers, `PlatformContext`, `RuleEngine`+`RuleRegistry`, 5 Capabilities, `QueryBundle`), and Milestone D (Hardening: `ToleranceProfile` with `.derive()`, traceability helpers, `constraint_engine.py` deprecation, 8 Architecture Fitness Functions). Total: 37 new files, 4,212 tests passing.

The `src/cad_intelligence/` backend operates as an **Explainable CAD Reasoning Operating System** governed by 20 Architectural Decision Records (ADR-001…ADR-020) and 8 CI-automated Architecture Fitness Functions. The platform constitution is ADR-017 in docs/adr/ (status: **Accepted**). The recognition chain is governed by [ADR-018](adr/ADR-018-vision-first-space-recognition.md) (vision-first space recognition, adopted review-augmented), [ADR-019](adr/ADR-019-deprecate-geometry-first-room-detection.md) (geometry-first room detection demoted to a candidate generator; exit review by 2026-12-31) and [ADR-020](adr/ADR-020-plan-reading-ontology.md) (plan-reading ontology behind the reading rules).

### Platform Layer Stack

```
Applications     (Workflow Runner, Exporters, MCP Handlers)
    ↓
Capabilities     (Business Functions: Navigation, Takeoff, Review, CodeCheck, Scheduling; ADR-003/008)
    ↓
Services         (Domain Query Services, GeometryService cache owner, DiffService, HistoryService)
    ↓
Views            (Stateless Projection Wrappers: GeometryView, TopologyView, SemanticView; ADR-002/007)
    ↓
ArchitectureGraph (+ GraphIdentity lineage & GraphMetadata OS Kernel; ADR-001/009)
```

### Core Architecture Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **OS Kernel** | `common/models.py`, `common/graph_identity.py` ✅, `common/graph_metadata.py` ✅ | Immutable `ArchitectureGraph` with `GraphIdentity` (sha256 lineage tree: `graph_id`, `parent_id`, `revision`, `content_hash`) and `GraphMetadata` (`schema_version` vs `graph_revision`). **Milestone A — implemented.** |
| **Command Engine** | `graph/commands/` (planned) | CQRS mutation engine executing `GraphCommand` protocol with `CommandMetadata` (`actor`, `reason`, `evidence_ids`). Guarantees 100% mutation safety. (Existing `commands/command.py` + `commands/mutations.py` provide the foundation Command pattern; the CQRS `GraphCommand`/`CommandMetadata` wrapper is pending.) |
| **GeometryService** | `graph/services/geometry_service.py` (planned) | Single owner of `SpatialIndex` STRtree cache with explicit `graph_revision` binding. Rebuilds automatically upon revision changes. |
| **Query Services** | `graph/services/query/` (planned) | 5 domain query services (`RoomQuery`, `WallQuery`, `DoorQuery`, `SpaceQuery`, `AnnotationQuery`) composed behind `GraphQueryService` facade. |
| **Stateless Views** | `graph/views/` ✅ | Read-only projection wrappers (`GeometryView`, `TopologyView`, `SemanticView`). Zero instance cache state. Domain getters prohibited (ADR-007). |
| **Streaming Events** | `platform/event_bus.py` ✅, `graph/services/diff_service.py` ✅ | `DiffService` produces `GraphDelta` (shared by Executor, History, EventBus). Events carry `graph_delta` payload (Kernel Invariant 8). |
| **Layered DI** | `platform/providers/` ✅, `platform/context.py` ✅ | `PlatformContext` accessing 5 providers: `CoreProvider`, `GraphProvider`, `QueryProvider`, `HistoryProvider`, `CapabilityProvider` (SRP-split per user feedback item 8). |
| **Rule Engine** | `rules/` ✅ | `RuleEngine`, `RuleRegistry` (YAML loader), declarative Rule DSL, and `rules/residential.py` plugin (4 Korean residential rules). Strict Rule→Evaluation→Violation→Resolution terminology. |
| **Capabilities** | `platform/capabilities/` ✅ | 5 user-facing business functions (`Navigation`, `Takeoff`, `Review`, `CodeCheck`, `Scheduling`) with `QueryBundle` typed aggregate (user feedback item 9). Zero cross-capability dependencies (ADR-003). |
| **Tolerance System**| `common/tolerance.py` ✅ | Hierarchical `ToleranceProfile` with `GeometryTolerance`, `TopologyTolerance`, `SemanticTolerance`, `InferenceTolerance` + `.derive()` method + 3 presets (RESIDENTIAL, OFFICE, FACTORY). |
| **Evidence Repository** | `features/store.py` (partial), `common/traceability.py` ✅ | `TraceableNode` Protocol + `attach_evidence()`/`attach_derivation()` immutable helpers (ADR-010/011). Graph-level `evidence_ids`/`derivation_ids` on `ArchitectureGraph`; per-node field migration is incremental. |
| **Fitness Suite** | `tests/test_architecture_fitness.py` ✅ | 8 CI fitness functions enforcing layer imports, immutability, cyclic deps, LOC limits, memory leaks, deterministic reconstruction, traceability, replay consistency. |

---

## Python Package: `src/cad_intelligence/facade`

The `src/cad_intelligence/facade/` package implements the **Facade Mesh Pipeline** (FACADE-001 + FACADE-002) — a Phase 5 parallel path that generates 3D exterior wall meshes from the ArchitectureGraph, with optional multi-floor assembly.

### Purpose

Produces exportable mesh geometry (OBJ, DAE) from 2D floor plan data, enabling SketchUp (or any 3D tool) to import pre-built facade geometry directly — replacing manual 3D modeling workflows. Supports single-floor (FACADE-001) and multi-floor with parapet (FACADE-002) output.

### Key Modules

| Module | File | Responsibility |
|--------|------|----------------|
| **Data Models** | `facade_model.py` | Enums (ExportFormat, FacadeMaterial, FloorUsage, etc.), GeometryMesh Protocol, FacadeWall/FacadeModel/FacadeResult dataclasses, FacadePipelineConfig. FACADE-002 types: FacadePattern, FloorFacade, FloorTemplate, FloorMetadata, BuildingConfig (geometry + appearance split). Trimesh-free. |
| **Builder** | `facade_builder.py` | ArchitectureGraph → FacadeModel: footprint via BoundaryBuilder, two-stage exterior classification (BoundaryResult + AdjacencyResult), 5-condition merge, opening projection. Trimesh-free. |
| **Assembler** | `facade_assembler.py` | FACADE-002: Single-floor FacadeModel → multi-floor FacadeModel. Clone+Z-translate per floor, parapet from footprint exterior ring (C3). Deterministic assembly order 1F→top→parapet (C4). Trimesh-free. |
| **Pattern Applier** | `facade_pattern.py` | FACADE-002: FacadePattern → FloorFacade expression. Entrance opening injection, height overrides. Immutable (dataclasses.replace). Trimesh-free. |
| **Mesh Builder** | `facade_mesh_builder.py` | FacadeModel → 3D mesh: wall extrusion, boolean opening cutout (fail-soft), normal fix, validation, scene assembly. Uses trimesh (lazy import). |
| **Exporter** | `facade_exporter.py` | GeometryMesh → OBJ/DAE file. Geometry-free — never modifies mesh. |
| **Pipeline** | `facade_pipeline.py` | Orchestrator: FacadeBuilder → [BuildingAssembler] → FacadeMeshBuilder → FacadeExporter. Consumes ArchitectureGraph as Aggregate Root. Optional `building_config` for multi-floor. Trimesh-free. |
| **Errors** | `errors.py` | FacadeError hierarchy: base, validation, export, mesh. |

### Design Reference

- `docs/designs/FACADE-001-facade-mesh-pipeline.md` — 18-section design document (single-floor pipeline)
- `docs/designs/FACADE-002-multi-floor-facade.md` — 11-section design document (multi-floor assembly, FloorFacade, BuildingConfig)

---

## Python Package: `src/file_curator`

The `src/file_curator/` package provides file monitoring, versioning, and backup capabilities for co-architect projects.

### Purpose

Automates file lifecycle management: watches designated directories for changes, maintains versioned snapshots, and provides recovery utilities for accidental overwrites or deletions.

### Key Modules

| Module | File | Responsibility |
|--------|------|----------------|
| **Entry Point** | `main.py` | CLI entry point; starts the monitoring loop |
| **Monitor** | `monitor.py` | Watches directories for create/modify/delete events using filesystem events |
| **Version Manager** | `version_manager.py` | Manages snapshot creation, version numbering, and storage |
| **Recovery** | `recovery.py` | Restores files from versioned snapshots on demand |
| **Config** | `config.py` | Loads and validates configuration (watch paths, retention policy, backup dir) |

### How to Run

```bash
# Start the file curator monitor
python -m src.file_curator

# Or via bun (if a script wrapper exists)
bun scripts/audit.ts  # includes file_curator health check
```

### How to Test

```bash
# Run tests from the project root
python -m pytest src/file_curator/ -v
```

### Configuration

Configuration is loaded from `config.py` and can be overridden via environment variables or `.env`. Key settings:
- **Watch paths**: directories to monitor for changes
- **Backup directory**: where versioned snapshots are stored
- **Retention policy**: how many versions to keep per file

---

## Domain Rules
<!-- VARIANT-INJECT: domain-rules -->

<!-- co-architect variant specific rules —edit after project creation -->
1. All research findings must be logged to memory/ with source citations.
2. Stakeholder review comments must be tracked in the project coordination log.
3. Design deliverables must be reviewed by design-lead before handoff.
4. Publication artifacts must be version-controlled before distribution.
5. ZWCAD Path Standards: Never hardcode ZWCAD, ArchiOffice, or Windows Support directories in Python, Bun, or LISP scripts. Always read path configurations dynamically from the project root `.env` file (see `.env.sample` for available variables: `ZWCAD_PATH`, `ZWCAD_VERSION`).
6. LISP Security Compliance: Custom LISP scripts must comply with the scripts/audit-security.ts linter. For verified dynamic path operations (like open, load), include the ; @allow-dynamic-path comment on the exact line to bypass false-positive security blockages.
7. Legal Compliance: Live lookup, structure parsing, and building code checks for residential (Apartments) and semi-residential (Officetels) compliance (e.g., corridor widths, fireproofing boundary walls) using `mcp-connector.ts` and the closed-loop design in [MCP-001-cad-compliance-integration-design.md](designs/MCP-001-cad-compliance-integration-design.md) are integrated. The PM gateway and execution rules apply to all legal-related dispatches.
8. Testing Standards: All test code, mock assets, and temporary files must follow the [testing-guidelines.md](testing-guidelines.md) standards. Keep the workspace root clean, use exception-safe tempfile contexts, and isolate static test data inside `tests/test_data/`.
<!-- END VARIANT-INJECT -->

---

*co-architect.context.md version: 2.1 — updated to current 6-team structure (Design, Research, Project, Engineering, Platform Engineering + PM Orchestration)*

## Template Provenance

- **Template-Version**: 0.5.3
- **Template-Variant**: co-architect

---

<!-- COMMON-CONTEXT:START -->
### Instruction Standard (LLM Interaction Standard, ADR-0098)

Human-to-LLM instructions and LLM-to-human answers follow the project-local standard `docs/standards/llm-interaction-standard.md` (ADR-0098, extending ADR-0079) — "Precision In, Intuition Out".

- **Input (§2)**: one primary action per instruction; explicit verbs; defined terms; structural rules in §2.8 — one instruction per sentence (≤ 20 words procedural / ≤ 25 descriptive), active voice with imperative steps, present tense, no idioms, positive phrasing preferred, minimal pronouns. Applies to requirement statements, task briefs, execution-plan task descriptions, agent dispatch prompts, design-doc requirement sections, API endpoint documentation, and how-to steps.
- **Output (§4–§9)**: conclusion and intuition before implementation detail; mental models before mechanics; facts, inferences, assumptions, and unknowns kept separate.
- **Enforcement**: advisory — PM conforms task briefs at triage; architect checks requirement sections at Design Gate review. Decisions: ADR-0079 and ADR-0098 (workspace root `docs/adr/`).

### PM Team-Management Authority (ADR-0080)

PM owns the composition of this project's agent team and rules on skill changes.

- **Hiring/firing (top-down, PM-decided)**: PM judges timing and target from workflow signals — recurring unmatched work types, role overload, absorbed roles, the periodic roster review — without a blocking user approval. Every decision emits a gate-moment decision record (ADR-0061) before dispatch. Default exit is `status: deprecated`; hard delete requires an explicit user request. Procedure: `agent-lifecycle-manager` skill.
- **Skill requests (bottom-up, agent-initiated, PM-approved)**: agents file structured request blocks (`create|attach|remove` + evidence) in their task reports and memory logs; PM triages and only approved requests are executed — agents never create, attach, or remove skills unilaterally. Procedure: `skill-lifecycle-manager` skill.
- **Enforcement**: governance, not code — decision records capture the judgment trail, and the change audits catch structural drift. Full decision: ADR-0080 in the workspace root `docs/adr/`.
<!-- COMMON-CONTEXT:END -->

---

<!-- COMMON-CONTEXT:START -->
This project follows the coding standards in the key-rules list below.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->

---

*co-architect.context.md version 2.2 — COMMON-CONTEXT zones added and variant registered in propagation-map.json variant-context domain (2026-11-01, hub-spoke Phase 1 Batch E5 promotion; previous: 2.1 six-team structure update)*
