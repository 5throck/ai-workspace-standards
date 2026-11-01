# V3 Completion Roadmap

> **Status**: Complete — archived (Stages A/B/C0/C1/C2/D executed; Stage E explicitly deferred out of scope)
> **Created**: 2026-07-09 (executed and archived same day)
> **Scope**: Close out the V3 Application-layer module wave, retire the last V1 legacy code path, and formalize the Application-layer pattern-selection standard (ADR-007 §13) the module wave was built against.
> **Reference**: `docs/adr/ADR-007-appspec-rendering-architecture.md` §13, `CHANGELOG.md` (2026-07-09 entries), `memory/2026-07-09.md`
> **Follow-on**: `docs/firm-governance/production-readiness-program.md` — picks up Stage E's deferred closed-loop item and everything beyond "can we build it"

---

## 1. Provenance

This roadmap originated as an ephemeral Claude Code plan-mode document (ad hoc, not checked into this repository) approved mid-session on 2026-07-09 after Stage A + Stage C0 were scoped and executed. The full backlog (Stage B, C1, C2, D, plus a Stage E backlog) was approved in that plan file and executed across the same session. This document is the durable, in-repo archive of that plan and what actually shipped against it — the plan-mode file itself is not a project artifact and is not linked here beyond this provenance note.

## 2. Executive Summary

The roadmap's guiding question was **"can we build it?"** — could the Application layer (the layer above the Architecture Graph that turns recognized building data into deliverables: takeoffs, sections, schedules, reviews, renders) be extended with new modules under a *durable, criteria-based standard*, rather than each module inventing its own shape ad hoc. Six stages executed this session (A, B, C0, C1, C2, D); a seventh (E) was scoped and explicitly deferred as backlog, not executed.

**What shipped**: a formal pattern-selection standard (ADR-007 §13, five rules), one validation spike that found and closed a real specification gap in that standard before it was relied on further, four new Application-layer modules built to the validated standard (takeoff, section, schedule, review agent), three renderer format adapters, one production-grade transaction/undo executor, and full retirement of the dead V1 direct-LLM-to-COM code path.

**What was deferred**: Stage E — `MCP-001` closed-loop completion (wiring compliance-review output into an actual auto-correction loop), ThreeJS/IFC renderer adapters, and the Ontology Layer (Wall → BearingWall → FireWall typing). None of these were started. The closed-loop item in particular resurfaces as the anchor use case for the new `docs/firm-governance/production-readiness-program.md`'s "Closed Loop Automation" sub-area — see §6 below.

---

## 3. ADR-007 §13 — Architecture Decision Rules

Before this roadmap, only `graph/builder.py`'s `ElevationBuilder` followed the `SupportsBuilder`/`SupportsApplicationSpec` Protocol that ADR-007 specifies; two already-shipped pipelines (`facade/`, `elevation/`) had never adopted it, and four new Application-layer modules (`TAKEOFF-001`, `SECT-001`, `SCHED-001`, `REVIEW-AGENT-001`) were about to be designed into code with no fixed standard for which pattern each should use. Stage A closed that gap by adding **§13: Architecture Decision Rules** to `docs/adr/ADR-007-appspec-rendering-architecture.md` — five MUST-level rules, classified by **module responsibility / orchestration complexity, not output format** (a module that "looks like" drawing output can still be Rule 1 or Rule 2 depending on whether its defining complexity is geometry computation or a flat Graph query; a module that "looks like" report output is Rule 3 specifically because its defining complexity is rule-engine + LLM policy branching, not because it emits text).

| Rule | Name | Applies when | Examples |
|---|---|---|---|
| **Rule 1** | Self-Contained Orchestrator | Core complexity is deterministic geometry computation and drawing/view generation | `facade/`, `elevation/`, `section/` (`SECT-001`), `ceiling/` (`CEIL-001`) |
| **Rule 2** | `SupportsBuilder` Protocol | Core complexity is a deterministic Graph query producing a tabular/structured export — no rule engine, no LLM branching | `graph/builder.py`'s `ElevationBuilder` (reference implementation), `takeoff/` (`TAKEOFF-001`), `schedule/` (`SCHED-001`) |
| **Rule 3** | Composite Orchestrator | Core complexity is rule-engine and/or LLM-driven policy decisions over Graph data (`Graph → Rule Engine → LLM → Merge → Report`) | `review_agent/` (`REVIEW-AGENT-001`) |
| **Rule 4** | `RendererAdapter` | Module only transforms already-rendered drawing entities between output formats, never touches the Graph | `DWGAdapter` (existing), `SVGAdapter`, `DXFAdapter`, `PDFAdapter` |
| **Rule 5** | Adapter (external platform/tool integration) | Reserved placeholder — no concrete module matched this shape yet | *(none — deliberately left unforced)* |

The rule set also carries governance clauses that make it durable rather than a one-time exercise: an **Exception Clause** (any module that fits no rule, or must deviate, requires an explicit ADR amendment before implementation — no undocumented one-offs), an **Approval Clause** (the architect owns sign-off; every module's design doc header must record `Pattern: Rule N` / `Rationale: ...`), a **PR Traceability Clause** (every implementation PR carries an "Architecture Rule" block mirroring the design-doc header), a living **Rule Coverage Table** (§13.9, updated as each module ships), and an **Anti-Drift Clause** (a repeated exception that starts forming a recognizable shape must trigger a rule revision or a new Rule 6+, judged by "has a new repeatable shape emerged," not by counting exceptions against a threshold).

§13 also gave an explicit, criteria-bound **disposition of the existing non-conforming modules** rather than leaving them unaddressed: `facade/` and `elevation/` both stay as-is, mapped retroactively to Rule 1 — both were already shipped and tested, and migrating either to a `SupportsBuilder`-wrapped shim would be pure churn with no functional benefit. `graph/builder.py` already conforms (it's the reference implementation Rule 2 was built from), with one latent gap flagged for later cleanup: `ElevationBuilder.build()` omits the `context: Any = None` parameter present in the `SupportsBuilder` Protocol signature — non-blocking (Python's `Protocol` only checks member presence, not signatures), tracked as a future conformance PR, not a rule problem.

**Architecture Review Result (§13.12): GO.** Rules 1-4 were defined from real, already-shipped implementations with clear boundaries; Rule 5 was deliberately left reserved rather than forcing a premature generalization.

### 3.1 The Rule 3 gap-and-fix story

Stage A's rule set was frozen pending one more check: a **Stage C0 Rule Validation Spike**, which built `TAKEOFF-001` fully (a real Rule 2 implementation) and sanity-checked skeletons of `SECT-001` (Rule 1) and `REVIEW-AGENT-001` (Rule 3) against the frozen rules, specifically to see whether the rules held up against real code before four more modules were built on top of them.

Rules 1 and 2 validated cleanly, with a positive surprise: `TAKEOFF-001`'s `build()` included the `context` parameter that §13.11 had just flagged as *missing* from the reference `ElevationBuilder` — the spike module ended up more Protocol-compliant than the module it was modeled on, rather than needing a workaround itself.

Rule 3 did not validate cleanly. The four-part Builder/Policy/LLM/Aggregator split held with no forced structural exception, but the spike surfaced a genuine specification gap: **no component in Rule 3 owned the Builder→Policy→LLM→Aggregator sequencing**, including the design doc's CRITICAL/HIGH short-circuit logic — the `REVIEW-AGENT-001` skeleton had left it implicitly to the MCP tool handler layer, which Rule 3's original text never assigned that responsibility to. Separately, Policy and LLM had no defined shared intermediate representation — the design doc describes both querying Graph/GeometryModel/SemanticModel directly rather than through a common Builder-produced object.

This was treated as **Stage C0 succeeding at its job, not as an architecture failure**: the spike didn't show Rule 3 was wrong, it showed Rule 3 was ~90% complete and found exactly the missing 10%. The **Rule Retrospective Gate** resolved it as **No-Go (temporary) → scoped ADR-007 §13.3 amendment → Go**, applied the same day (2026-07-09): §13.3 now names a fifth component, **Orchestrator** — owns execution sequencing, owns the `ReviewContext`-shaped lifecycle, returns the final `ReviewReport`, and explicitly MUST NOT be left to a calling layer like the MCP tool handler — and now requires a shared context-object *shape* (not a fixed class name) flowing Builder → Policy → LLM → Aggregator. The `review_agent/` skeleton was updated to match (`ReviewContext` relocated to `model.py`, new `orchestrator.py` added), and `REVIEW-AGENT-001` was later built out fully against the amended rule in Stage C2 with no further amendment needed. **Final Gate status: GO.** ADR-007 §13 is frozen as amended, Status header: "Design approved — §13 frozen (amended 2026-07-09 per Stage C0 Retrospective; Rule Retrospective Gate: Go)".

---

## 4. Modules shipped

Seven modules/packages shipped this roadmap, each mapped to its ADR-007 §13 rule:

| Module | Rule | What it does | Stage |
|---|---|---|---|
| `src/cad_intelligence/takeoff/` | Rule 2 | `TakeoffBuilder`/`TakeoffSpec`/`TakeoffExporter` — wall/room/door/window quantity takeoff, Excel/CSV/JSON export, `zwcad_generate_takeoff` MCP tool. Built fully during the Stage C0 spike as the Rule 2 reference validation. 19 tests. | C0 |
| `src/cad_intelligence/section/` | Rule 1 | `SectionBuilder` — cut-line resolution, shapely wall-intersection, opening classification, section-view drawing generation, `zwcad_generate_section`. Sketched as a Rule 1 skeleton in C0, built out fully in C2. 30 tests. | C0 (skeleton) → C2 (full) |
| `src/cad_intelligence/schedule/` | Rule 2 | Door/Window schedule builder + exporter, Excel/CSV UTF-8-BOM export, `zwcad_generate_schedule`. Finish Schedule sub-feature explicitly deferred pending `CEIL-001`. 20 tests. | C2 |
| `src/cad_intelligence/review_agent/` | Rule 3 | `builder.py`/`policy.py`/`llm.py`/`aggregator.py`/`orchestrator.py`/`model.py` (`ReviewContext`, `ReviewIssue`, `ReviewReport`) — 6 rule-based checks + 4 LLM checks + `SEVERITY_POLICY` + CRITICAL/HIGH short-circuit orchestration, `zwcad_review_drawing`. Sketched as a Rule 3 skeleton in C0 (surfacing the orchestration gap in §3.1 above), rebuilt against the amended rule and built out fully in C2. 74 tests. | C0 (skeleton) → C2 (full) |
| `src/cad_intelligence/ceiling/` | Rule 1 | `CeilingZone`/`HVACZone` models, downlight fixture-grid placement with column-obstruction avoidance, RCP (Reflected Ceiling Plan) drawing generation, `zwcad_generate_rcp` — CEIL-001, M5 basic scope (no HVAC zones or sloped ceilings yet). 29 tests. | D |
| `src/cad_intelligence/renderer/svg_adapter.py`, `dxf_adapter.py`, `pdf_adapter.py` | Rule 4 | Three format-only `RendererAdapter`s alongside the existing `DWGAdapter`: `SVGAdapter`/`DXFAdapter` (via `ezdxf`, C1), `PDFAdapter` (via `pymupdf`, A3-landscape default page with scale-to-fit + center transform, D). 18 tests (svg/dxf) + 10 tests (pdf). | C1 (svg/dxf) → D (pdf) |
| `src/cad_intelligence/platform/undo_rollback.py` | — (platform layer, not an Application-layer §13 module) | `UndoRollbackExecutor` — wraps ZWCAD COM `StartUndoMark`/`EndUndoMark`/`SendCommand("UNDO ")`, satisfies the existing `RollbackExecutor` Protocol, replaces the no-op `NullRollbackExecutor`. `docs/designs/TRANSACTION-001-design.md` exit criteria now met. Verified against a mocked COM bridge only — real COM undo behavior not yet verified against a live ZWCAD instance. 12 tests. | D |

142 new tests across the four Application-layer modules and the SVG/DXF adapters (Stage C1/C2), 111 more across CEIL-001/undo-rollback/PDF adapter plus incidental test-suite pruning (Stage B/D). Full suite after all Stage D changes: **2036 passed, 1 skipped, 1 xpassed, zero regressions** (independently re-verified, not just agent self-report).

---

## 5. Stage B — V1 legacy removal

`src/agent/cad_agent.py` shrunk from 2233 to 1321 lines: deleted the fully dead V1 direct-LLM-to-COM path (`LLMClient`, `SYSTEM_INSTRUCTION`/`SYSTEM_INSTRUCTION_JSON`, `validate_and_execute_commands`, `execute_json_commands`, `handle_prompt_flow`, `handle_prompt_chain`, plus now-orphaned helpers `extract_python_code`/`strip_trailing_comment`/`_extract_json_from_llm`/`_extract_code_from_llm`/`_execute_with_undo_protection`) and the `--prompt`/`--interactive` CLI flags that were its only remaining live callers — confirmed repo-wide via grep that nothing else depended on them before removing; `--server` is now the sole entrypoint. `ZWCADAgentBridge` and its `/save /open /new /layers /undo /recover` HTTP endpoints were confirmed untouched and already V3-backed.

Updated to drop stale "V1 still active/deferred" language: `docs/designs/AI-003-v1-to-v3-migration-design.md` (Phase 5 → COMPLETE), `docs/reference/cad-intelligence-status.md`, `docs/adr/ADR-001-architecture-graph.md`, `docs/reference/cad-system-roadmap.md`.

---

## 6. Explicitly deferred — Stage E

Stage E was scoped in the original plan-mode roadmap but **not executed** this session, by design. It remains backlog:

1. **`MCP-001` closed-loop completion** — `docs/designs/MCP-001-cad-compliance-integration-design.md` describes a four-layer closed-loop compliance and editing pipeline; only the extraction/query layers exist today. Wiring `REVIEW-AGENT-001`'s output (`ReviewReport`/`ReviewIssue`) into an actual auto-correction loop was never started.
2. **ThreeJS/IFC renderer adapters** — Rule 4 modules for web-viewer and BIM interoperability formats. Not started.
3. **Ontology Layer** (Wall → BearingWall → FireWall typing, referenced in ADR-005's Architecture Graph Schema concept). Not started.

These do not block this roadmap's closure — the roadmap's scope was "can we build it," and all six executed stages answer that question for the modules in scope. **Stage E's closed-loop item is picked up as the anchor use case for the "Closed Loop Automation" sub-area of `docs/firm-governance/production-readiness-program.md`**, the living program document that succeeds this roadmap.

---

## 7. Outcome

**All of Stage A/B/C0/C1/C2/D are done.** Stage E remains deferred backlog, tracked forward via the new Program document rather than as an open item on this now-closed roadmap. This document is archived as of 2026-07-09; no further updates are expected here — see `docs/firm-governance/production-readiness-program.md` for what comes next.
