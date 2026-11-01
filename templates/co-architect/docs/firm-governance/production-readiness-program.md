# Production Readiness Program

> **Status**: Active — living document
> **Created**: 2026-07-09
> **Category**: `docs/firm-governance/` (held alongside other persistent strategic material; the `docs/programs/` category was dissolved 2026-08-02 — see `docs/designs/DOCS-001-design.md` Addendum)
> **Predecessor**: `docs/plans/2026-07-09-v3-completion-roadmap.md`

---

## 1. Framing

The V3 Completion Roadmap (archived at `docs/plans/2026-07-09-v3-completion-roadmap.md`) answered one question: **can we build it?** Across six executed stages it stood up a formal Application-layer pattern-selection standard (ADR-007 §13), validated that standard against real code, and shipped four new Application-layer modules (takeoff, section, schedule, review agent), three renderer format adapters, and a production-grade undo/rollback executor — while retiring the last dead V1 code path.

This program picks up where that roadmap left off. Its question is different: **can people depend on it?** Not "does the feature exist," but "does it keep working, does it fail loudly and recoverably instead of silently, does it stay fast and correct as the system grows, can someone install and run it without hand-holding, and does the pipeline actually chain end to end instead of stopping at each module's own boundary."

Unlike the roadmap it succeeds, this program has **no fixed end date and no terminal "done" state**. It is a living program document (held in `docs/firm-governance/`) rather than a dated `docs/plans/` document precisely because of that: it will be updated in place as each sub-area below is scoped in detail, executed, and re-scoped — the same way `docs/reference/` documents are kept current rather than superseded. This document establishes the program's existence and its seven sub-areas at a legible, one-paragraph-each level of detail. **Detailed execution plans for any individual sub-area are out of scope here** and belong in their own future design/planning docs, each linked back from the relevant section below once written.

---

## 2. Sub-areas

### 2.1 Benchmark

Establish repeatable performance and quality benchmarks across the pipeline — not just the existing KPI-threshold precision/recall/F1 evaluation ADR-009's Ground Truth framework already covers for recognition phases, but end-to-end timing and resource-usage baselines for the newer Application-layer modules (takeoff, section, schedule, review, ceiling) and the renderer adapters. Without a benchmark baseline, regressions in speed or output quality have no tripwire until a user notices.

**Status update (2026-07-11)**: Stage A (performance/timing/memory benchmarking) shipped 2026-07-09. **Design spec**: [`BENCHMARK-002`](../designs/BENCHMARK-002-design.md) — Stage C+D quality and performance benchmarks for all 6 Application-layer modules. 24 design decisions (B1–B22): GT Generator + validation chain with approval workflow (B3), multi-dimensional metrics (Output/Structural/Diagnostic, B4), dual tolerance (B6), ScoreAggregator pipeline with recorded identity (B12), CI Gate criticality via YAML config (B22), Review Agent KPI with Confusion Matrix (B11), budget lifecycle with P95 gating (B13), mutation validation with explicit drop-type contracts (B19), regression reports with confidence+source (B17), schema versioning (B20). Status: **Implemented** — All 5 phases complete: Phase 1 GT Generator (37 tests), Phase 2 Quality Bench Engine (52+ tests), Phase 3 Performance Extension (22 tests), Phase 4 Mutation Validation (21 tests), Phase 5 CLI (6 subcommands) + Real DWG runner + Regression detector + Schema migration (22 tests) + CI integration (quality bench + regression steps in ci.yml) + Review Agent KPI (ClassificationEvaluator) + Structural metrics (Containment/SetMembership/NumericRange). ~190+ tests, 30 GT JSONs, 5 fixture metadata/graph pairs, all COM-free. Deferred: full B17 regression report with confidence_source, B19 formal Mutation dataclass, B21 history persistence, B16 real DWG app-layer GT.

### 2.2 Closed Loop Automation

The most directly connected sub-area to the predecessor roadmap: Stage E's deferred `MCP-001` closed-loop completion (`docs/designs/MCP-001-cad-compliance-integration-design.md`) resurfaces here as the anchor use case. `REVIEW-AGENT-001`'s output — `ReviewReport`, a collection of `ReviewIssue`s from `src/cad_intelligence/review_agent/model.py` — is the natural input to a **Suggestion → Fix → Verify** loop: today the review agent can find and report problems, but nothing consumes that report to propose a correction, apply it, and re-verify the drawing against the same checks. This sub-area scopes and builds that loop, most likely as a Rule 3-adjacent orchestration sitting on top of the existing `review_agent/` package rather than a rewrite of it.

**Design spec**: [`CLOSED-LOOP-001`](../designs/CLOSED-LOOP-001-design.md) — four-contract pipeline (`ReviewIssue → FixIntent → FixProposal → ApplyResult`), five components (SuggestionEngine, Planner, FixExecutor, VerificationLoop, Orchestrator), rule-based v1 with extension points for LLM/ConstraintSolver providers. Status: **Implemented** — `src/cad_intelligence/closed_loop/` (model, suggestion, planner, executor, verification, orchestrator), 179 tests across 7 phases, all COM-free.

### 2.3 Monitoring

Runtime observability for a system that is now handling live COM automation, MCP tool dispatch, and multi-stage pipelines: structured logging, error/exception surfacing beyond test-time assertions, and a monitoring dashboard (the same M5 "Production Readiness" scope named in `docs/reference/cad-system-roadmap.md`, but broadened here to cover the modules shipped since that roadmap was written). Distinct from Benchmark (2.1) in that Benchmark is about known metrics measured on demand; Monitoring is about live signal during real usage.

**Design spec**: [`MONITORING-001`](../designs/MONITORING-001-design.md) — 25 formalized design decisions (D1–D25), `TelemetryStage`/`SpanStatus` StrEnums, frozen `TelemetrySpan` records, `SpanBuilder` context manager, thread-safe `TelemetryStore` ring buffer (deque maxlen=10000), `PipelineTelemetry` singleton with `begin_run()`/`end_run()` lifecycle, `sanitize_for_mcp()` security layer, `JSONWriter`/`MetricsReporter`/`TelemetryRecorder` fan-out consumers. Status: **Implemented (2026-07-10)** — `src/cad_intelligence/platform/telemetry.py`, `src/cad_intelligence/platform/telemetry_writers.py`, `src/cad_intelligence/cad_io/handlers/telemetry.py` (MCP handler), orchestrator wiring, EventBus D21 subscriber exception logging. **184 tests** (101 core + 46 writers + 13 orchestrator + 24 MCP handler), all COM-free, full suite 2601 passed.

### 2.4 Golden Dataset

A curated, versioned set of reference drawings with known-correct outputs (ground truth) spanning the newer Application-layer modules — today's Golden Snapshot infrastructure and Ground Truth fixtures cover recognition-phase outputs (walls, doors, windows, rooms) but not takeoff quantities, section geometry, schedule contents, or review findings. Expanding golden-dataset coverage to these modules is a prerequisite for both Benchmark (2.1) and any future regression-detection work on the Closed Loop (2.2).

**Design spec**: [`GOLDEN-001`](../designs/GOLDEN-001-design.md) — 28 formalized design decisions (D1–D28), fixture-based snapshot testing for 6 Application-layer modules (Takeoff, Section, Schedule, Review Agent, Ceiling, Facade). 5 room fixtures (rectangle, l_shape, corridor, shared_opening, concave), `graph_factory` assembly-only builder, per-module contract whitelists (D17–D22), domain-specific float precision map (D3), `assert_snapshot_match()` recursive comparison (D6), `--update-snapshots` CLI flag (D8). Status: **Implemented (2026-07-10)** — `tests/golden/` (conftest, test_gateway, takeoff, schedule, section, ceiling, review, facade test files), `tests/snapshots/golden/` (32 snapshot JSON files across 6 modules + 7 review scenarios), `tests/fixtures/rooms/` updated with `expected_room_areas` metadata. **343 tests** (65 gateway + 110 takeoff/schedule + 95 section/ceiling + 73 review/facade), all COM-free.

### 2.5 End-to-End Workflow

Chain Section, Elevation, Facade, Schedule, and Takeoff generation into one command instead of five independent MCP tool calls each requiring their own setup. Today each module is independently correct and independently invoked; a user producing a full drawing set still has to sequence the calls themselves. This sub-area defines and builds that orchestration layer — the natural complement to Closed Loop Automation (2.2), which orchestrates *correction*, while this orchestrates *generation*.

**Design spec**: [`WORKFLOW-001`](../designs/WORKFLOW-001-design.md) — 8-step DAG (build_graph → review → closed_loop → section/elevation/facade/schedule/takeoff in parallel → collect), `StepCapabilities` system, version-aware cache keys, failure policy (blocking vs. continue), resume from partial results, `max_parallel_steps` concurrency control. Status: **Implemented** — `src/cad_intelligence/workflow/` (model, steps, orchestrator), `src/cad_intelligence/cad_io/handlers/workflow.py` (MCP handler), `src/cad_intelligence/cad_io/handlers/closed_loop.py` (MCP handler, wired). Tool Capability System (`_TOOL_CAPABILITIES` in server.py) enables COM-free dispatch for both `zwcad_run_workflow` and `zwcad_apply_fixes`. `ExecutionEnvironment` replaces `ExecutionOptions` (with `cache_available` field for future environments). Structured `skip_reason` on `StepResult` for monitoring (`requires_com | disabled | not_registered | prerequisite_not_met`). **203 tests** across 5 test files (62 model + 67 steps + 30 orchestrator + 17 integration + 27 MCP handler), all COM-free.

### 2.6 Packaging

Installation, distribution, and deployment of the CAD Intelligence platform itself — dependency management, versioned releases, and a repeatable install path for a new environment, as opposed to the current development-machine-only setup. Scope includes evaluating what "install" should mean for an MCP server + COM-bridge system that inherently depends on a licensed, locally-installed ZWCAD instance.

**Design spec**: [`PACKAGING-001`](../designs/PACKAGING-001-design.md) — 13 design decisions (D1–D13): project rename to `cad-intelligence` (D1), console entry points `zwcad-mcp`/`zwcad-agent` (D2), CLI dispatcher with `serve`/`doctor`/`version` subcommands (D3), PEP 621 dynamic versioning (D4), dev dependency consolidation (D5), stale artifact cleanup (D6), setup script modernization (D7), agent package regularization (D8), dead dependency removal `manifold3d` (D9), platform markers for `pywin32` (D10), environment diagnostic `doctor` command (D11), CI packaging verification job (D12), completion criteria (D13). Status: **Implemented (2026-07-11)** — `pyproject.toml` rewritten (PEP 621 dynamic version, entry points, package discovery), `src/agent/__init__.py` + `src/cad_intelligence/__main__.py` (CLI dispatcher) + `src/cad_intelligence/cli/doctor.py` (3-tier environment diagnostic) created, setup scripts modernized (3 platforms), `manifold3d` removed, CI packaging job added (fresh venv wheel build→install→verify).

### 2.7 CI hardening

Extends the CI groundwork already landed (2026-07-08: `test-python` job enabled on `windows-latest`, path-filtered to skip on docs-only changes, `conftest.py` tracking fixed, dependency gaps closed). **Shipped (2026-07-09)**: `pytest-cov` coverage gate activated (`fail_under = 55`, baseline 57% — omit policy excludes only 6 `semantic/*` files that require trained ML models + live ZWCAD COM, documented raising schedule 55 → 60 → 70); `--strict-markers` enforced in `pyproject.toml addopts` (dry-run verified zero unregistered markers); `test_cache_hit_skips_check` flaky test fixed (root cause: `@patch` baking `time.time()` at collection time → replaced with direct module global assignment); `coverage.xml` uploaded as CI artifact (30-day retention) for PR reviewer inspection. **Updated (2026-07-10)**: coverage gate raised to `fail_under = 60` (actual: 62.70%, 3193 tests). Remaining work: raising the coverage gate to 70 as new tests are added, expanding strict marker coverage, and further flaky-test triage if additional intermittent failures surface.

---

## 3. How this document is maintained

This is a living document, not a checklist. As each sub-area above moves from "named" to "scoped," its section should grow a link to the design/planning doc that scopes it in detail (a `docs/designs/<SPEC-ID>-design.md` for a concrete build, or a `docs/plans/YYYY-MM-DD-<slug>.md` for a time-boxed execution effort within the sub-area). Sub-areas may be added, split, or retired over time as the program's understanding of "can people depend on it" evolves — there is no fixed roadmap end date to reach, and no expectation that all seven sub-areas execute in the order listed here.
