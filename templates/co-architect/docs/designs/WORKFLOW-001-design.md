# WORKFLOW-001: End-to-End Workflow Orchestration

> **Status**: Implementation in progress
> **Created**: 2026-07-09
> **Category**: Production Readiness Program §2.5
> **Predecessor**: PIPELINE-001 (pipeline execution framework), CLOSED-LOOP-001 (closed loop automation)

---

## 1. Problem Statement

Today each Application Layer module (section, elevation, facade, schedule, takeoff, review, ceiling) is independently correct and independently invoked. A user producing a full drawing set must sequence 5–7 MCP tool calls themselves, managing input serialization, error handling, and output collection across each call. There is no cross-tool workflow orchestrator — each tool is invoked independently via the ToolRegistry (ADR-010).

This spec defines and builds that orchestration layer — the natural complement to Closed Loop Automation (§2.2), which orchestrates *correction*, while this orchestrates *generation*.

### Scope

- Define pipeline step contracts (input/output per step)
- Failure policy (continue vs. fail-fast per step)
- Cache policy (content-addressed, version-aware)
- Re-execution policy (resume from partial completion)
- Output management (file collection, manifest)
- Concurrency control (configurable parallelism)

### Out of Scope

- Internal module implementation changes — orchestrator delegates to existing handlers/builders
- MCP handler registration (`zwcad_run_workflow`) — deferred until Python layer is validated
- COM automation within steps — existing handlers handle COM; orchestrator only detects capability

---

## 2. Pipeline DAG

```
                    ┌─────────────────────────────┐
                    │   1. Build ArchitectureGraph   │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │   2. Review (optional)          │
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │   3. Closed Loop (optional)     │
                    └──────────┬────────────────────┘
                               │
          ┌────────────────────┼──────────────────────────┐
          │                    │                          │
┌─────────▼────────┐ ┌──────────▼──────────┐ ┌──────────────▼───────────┐
│ 4. Section      │ │ 5. Wall Elevations │ │ 6. Facade                │
│ (COM-free data) │ │ (COM — draws)      │ │ (COM-free, exports OBJ) │
└────────┬────────┘ └──────────┬──────────┘ └──────────────┬───────────┘
          │                    │                          │
          └────────────────────┼──────────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │   7a. Schedule  │  7b. Takeoff  │  (parallel)
                    └──────────┬────────────────────┘
                               │
                    ┌──────────▼────────────────────┐
                    │   8. Collect Results           │
                    └───────────────────────────────┘
```

### Dependency Rules

| Step | Depends On | Parallelizable With |
|------|-----------|---------------------|
| 1. build_graph | — | — |
| 2. review | 1 | — |
| 3. closed_loop | 2 (needs ReviewReport) | — |
| 4. section | 1 | 5, 6, 7a, 7b |
| 5. elevation | 1 | 4, 6, 7a, 7b |
| 6. facade | 1 | 4, 5, 7a, 7b |
| 7a. schedule | 1 | 4, 5, 6, 7b |
| 7b. takeoff | 1 | 4, 5, 6, 7a |
| 8. collect | all above | — |

---

## 3. Step Definitions

| Step | Name | Input | Output | Blocking | Existing Module |
|------|------|-------|--------|:--------:|-----------------|
| 1 | `build_graph` | `walls, rooms, doors, windows` dicts | `ArchitectureGraph` | Yes | `graph/arch_graph.py:build_architecture_graph()` |
| 2 | `review` | `ArchitectureGraph` | `ReviewReport` dict | No | `review/handler:handle_review_drawing()` |
| 3 | `closed_loop` | `ArchitectureGraph + ReviewReport` | Updated `ArchitectureGraph` | No | `closed_loop/handler:handle_apply_fixes()` |
| 4 | `section` | `ArchitectureGraph` | `SectionResult` dict | No | `section/handler:handle_generate_section()` |
| 5 | `elevation` | `ArchitectureGraph` | Elevation entity data | No | `space/handler:handle_generate_wall_elevations()` |
| 6 | `facade` | `ArchitectureGraph` | `FacadeResult` dict | No | `facade/facade_pipeline.py` |
| 7a | `schedule` | `ArchitectureGraph` | Schedule file path | No | `schedule/handler:handle_generate_schedule()` |
| 7b | `takeoff` | `ArchitectureGraph` | Takeoff file path | No | `takeoff/handler:handle_generate_takeoff()` |
| 8 | `collect` | All step outputs | `WorkflowResult` | No | New (in orchestrator) |

### Step Capabilities

Each step declares its capabilities via `StepCapabilities`:

```python
@dataclass(frozen=True)
class StepCapabilities:
    supports_cache: bool = False      # Output can be cached
    requires_com: bool = False        # Requires live ZWCAD COM connection
    produces_files: bool = False      # Writes output files to disk
    step_version: str = "1.0"         # Algorithm version (for cache key)
```

| Step | supports_cache | requires_com | produces_files | step_version |
|------|:---:|:---:|:---:|---|
| build_graph | — | — | — | — |
| review | ✓ | — | — | "1.0" |
| closed_loop | — | — | — | — |
| section | ✓ | — | — | "1.0" |
| elevation | — | ✓ | — | — |
| facade | ✓ | — | ✓ | "1.0" |
| schedule | ✓ | — | ✓ | "1.0" |
| takeoff | ✓ | — | ✓ | "1.0" |
| collect | — | — | — | — |

---

## 4. Input/Output Contracts

### Universal Input

```python
{
    "walls": list[dict],       # Wall.to_dict() dicts
    "rooms": list[dict],       # Room.to_dict() dicts
    "doors": list[dict],       # Door.to_dict() dicts
    "windows": list[dict],     # Window.to_dict() dicts
    "columns": list[dict],     # Column.to_dict() dicts (optional)
    "output_dir": str,         # default: "./workflow_output/"
    "config": {
        "max_parallel_steps": 4,
        "steps": {
            "review": {"enabled": True},
            "closed_loop": {"enabled": True, "auto_approve": False},
            "section": {"enabled": True, "cut_start": [...], "cut_end": [...]},
            "elevation": {"enabled": True, "placement_margin": 5000},
            "facade": {"enabled": False},
            "schedule": {"enabled": True, "format": "excel"},
            "takeoff": {"enabled": True, "format": "excel"},
        }
    }
}
```

### Universal Output (`WorkflowResult`)

```python
@dataclass
class WorkflowResult:
    run_id: str
    status: Literal["success", "partial", "error"]
    graph_hash: str
    step_results: dict[str, StepResult]
    output_manifest: OutputManifest
    duration_ms: float
    exceptions: list[str]

@dataclass
class StepResult:
    step_name: str
    status: Literal["success", "skipped", "error"]
    duration_ms: float
    output: dict[str, Any] | None
    artifact_hash: str | None
    exceptions: list[str]

@dataclass
class OutputManifest:
    manifest_version: int = 1
    files: dict[str, str]        # label → file path
    entities: dict[str, int]     # label → entity count
    reports: dict[str, dict]     # label → report dict
```

---

## 5. Failure Policy

### Per-Step Classification

| Classification | Steps | Policy |
|---|---|---|
| **Blocking** | `build_graph` | `fail-fast` — nothing downstream can run |
| **Optional** | `review`, `closed_loop` | `continue` — log warning, proceed with unreviewed graph |
| **Optional** | `section`, `elevation`, `facade`, `schedule`, `takeoff` | `continue` — skip failed step, others proceed |
| **Aggregation** | `collect` | `continue` — aggregates whatever succeeded |

### Aggregate Status

- `success`: all enabled steps succeeded
- `partial`: `build_graph` succeeded but ≥1 optional step failed
- `error`: `build_graph` failed (nothing produced)

---

## 6. Cache Policy

### Cache Key Construction

```
cache_key = sha256(graph_hash + ":" + step_name + ":" + step_version)
```

When a step's algorithm changes (e.g., `step_version` "1.0" → "1.1"), the cache key changes automatically — no manual invalidation.

### Cache Behavior

| Step | Cacheable | Rationale |
|---|---|---|
| build_graph | Content-addressed | Graph hash IS the key |
| review | Yes | graph_hash + step_version |
| closed_loop | **No** (side-effect) | Mutates graph — never cache |
| section | Yes | graph_hash + step_version |
| elevation | **No** (requires_com) | COM state is ephemeral |
| facade | Yes | graph_hash + step_version |
| schedule | Yes | graph_hash + step_version |
| takeoff | Yes | graph_hash + step_version |

### Backend

Reuses existing `SupportsCacheBackend` Protocol from `pipeline/run.py`:
- `get(key) -> Any | None`
- `set(key, value, ttl=None) -> None`
- `invalidate(key) -> None`

---

## 7. Re-execution (Resume) Policy

### Resume from Partial Completion

Each step writes its `StepResult` immediately upon completion. On re-execution:

- **Re-use** if: `status="success"` AND `artifact_hash` matches current cache key
- **Re-run** if: skipped/error OR graph_hash changed OR step_version changed OR config changed

### API

```python
# Fresh run
result = orchestrator.run(input_params)

# Resume (re-runs only failed/changed steps)
result = orchestrator.run(input_params, previous_result=previous_result)

# Force re-run specific steps
result = orchestrator.run(input_params, force_steps=["review", "section"])
```

---

## 8. Concurrency Control

`WorkflowConfig.max_parallel_steps: int = 4`

- Controls how many independent steps run concurrently
- Default 4 matches the parallelizable group (section, elevation, facade, schedule/takeoff)
- In CI: set to 1 for serial execution (debugging)
- On local server: set to available core count
- Orchestrator respects this cap when scheduling parallel steps

---

## 9. Output Management

- `output_dir` in input params (default: `./workflow_output/`)
- Schedule/Takeoff/Facade exporters receive `output_path` prefixed with this directory
- Output naming: `{step_name}_{timestamp}.{ext}`
- `OutputManifest.manifest_version: int = 1` for forward-compatible migration

---

## 10. Architecture

### New Module: `src/cad_intelligence/workflow/`

| File | Purpose |
|---|---|
| `model.py` | `WorkflowResult`, `StepResult`, `OutputManifest`, `WorkflowConfig`, `StepConfig`, `StepStatus`, `StepCapabilities` |
| `steps.py` | `WorkflowStep` Protocol + 8 concrete step implementations |
| `orchestrator.py` | `WorkflowOrchestrator` — DAG executor with cache, resume, failure policy, concurrency |
| `__init__.py` | Re-exports |

### Design Decisions

1. **MCP handler available** — ``zwcad_run_workflow`` via ``cad_io.handlers.workflow`` (since 2026-07-09)
2. **Constructor injection** — mirrors ClosedLoopOrchestrator pattern from CLOSED-LOOP-001
3. **COM-free by default** — capability-driven COM detection, no isinstance checks
4. **Reuses PIPELINE-001 infrastructure** — `stable_hash()`, `SupportsCacheBackend`, PipelineRun-style metadata

---

## 11. Implementation Plan

4 phases, 4 PRs, ~120 tests total.

| Phase | PR | Files | Tests |
|-------|----|-------|-------|
| 1 | Data Model + Design Spec | `model.py`, `__init__.py`, `WORKFLOW-001-design.md`, `test_model.py` | ~30 |
| 2 | Step Implementations | `steps.py`, `test_steps.py` | ~35 |
| 3 | Orchestrator | `orchestrator.py`, `test_orchestrator.py` | ~40 |
| 4 | Integration + Status Update | `test_integration.py`, program doc, CHANGELOG | ~15 |

---

## 12. Deferred (Non-blocking)

1. MCP handler (`zwcad_run_workflow`) — after Python layer validated
2. Workflow YAML manifest — step configuration via YAML
3. Progress callbacks / EventBus — real-time progress reporting
4. Automatic retry on transient failures
5. Configurable output naming templates
