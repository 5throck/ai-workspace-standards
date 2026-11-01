---
lang: ko
lang_reason: proper-noun
---

# AI-003: V1 `/draw` → V3 Graph Pipeline Migration Design

> **Spec ID**: AI-003
> **Version**: 1.2 (design, fully implemented — Phase 5 removal complete)
> **Status**: Complete — Phases 1–5 all done; V1's LLM/execution code removed from `cad_agent.py`, `/draw` and `/draw-v3` are the only drawing-generation paths
> **Created**: 2026-07-04
> **Updated**: 2026-07-09 — Phase 5 (V1 removal) executed; see Phase 5 section for what was removed and how the CLI-entrypoint blocker was resolved
> **Authors**: architect
> **Source**: User request for a design (not implementation) of the V1→V3 cutover path, following the same versioning philosophy as `ADR-002` and `AI-002`
> **Supersedes**: none (this document does not modify V1 or V3 code; it plans a future cutover)
> **Related**: [`ADR-002-com-bridge-v3-versioning-design.md`](../adr/ADR-002-com-bridge-v3-versioning-design.md) (V3 handler decomposition this migration builds on), [`AI-002-graph-driven-rendering-design.md`](AI-002-graph-driven-rendering-design.md) (V3 graph pipeline + `/draw-v3` this migration cuts over to), [`docs/adr/ADR-001-architecture-graph.md`](../adr/ADR-001-architecture-graph.md) (the compliance gap this migration closes), [`docs/designs/ELEV-002-design.md`](ELEV-002-design.md) §1/§10 (the v1→v2 "validate before deprecate before delete" precedent this design applies one layer up), [`docs/reference/cad-system-roadmap.md`](../reference/cad-system-roadmap.md) (pre-existing P0/P1 debt on `ZWCADAgentBridge`), [`docs/adr/ADR-004-cad-intelligence-pipeline-design.md`](../adr/ADR-004-cad-intelligence-pipeline-design.md) (pipeline architecture for Gap A closure: Object Candidate → Pattern Library → Semantic Objects → Architecture Graph)

---

## 1. Overview

ADR-001 establishes the Architecture Graph as this project's mandatory intermediate representation: AI must only use the Architecture Graph, never touch DWG/COM directly. `AI-002` §1 already documents that V1's `/draw` endpoint violates this principle directly — its `LLMClient` drives `ZWCADAgentBridge` with no Graph involved at any point — and built `/draw-v3` as the additive, parallel, ADR-001-compliant replacement path. But `AI-002` explicitly deferred the actual cutover (§6, out of scope): `/draw` remains untouched and is still the **only** production drawing-generation path today. ADR-001 compliance is therefore only partially achieved workspace-wide — the compliant pipeline exists, but nothing routes real traffic through it.

This document does not re-litigate the versioning strategy already approved in `ADR-002` §1 and `AI-002` §1. It applies the same, already-established **ELEV-001/ELEV-002 precedent** one layer further: `ELEV-002-design.md` §1 kept ELEV-001 (`handle_detect_spaces`/`handle_generate_room_elevations`, room-centric) fully intact as a fallback while ELEV-002 (wall-centric) was built alongside it, and only marked ELEV-001 deprecated (not deleted) after v2 passed an explicit, concretely-defined Phase 3 checkpoint on two named test drawings (`ELEV-002-design.md` §10: `아파트 평면도.dwg` and `AI 작업용 공용홀.dwg`, 6 pass/fail conditions, ground-truth fixture files, reproducible on a single commit). This design defines the equivalent checkpoint machinery for V1 → V3: what "safe to route production traffic to V3" concretely means, what must be built first, and the phased path from today's parallel-but-idle V3 to eventual V1 removal — without performing any of that work here.

**Why this matters beyond ADR-001 hygiene**: V1's `ZWCADAgentBridge` and its sandboxed-execution command validation (`validate_and_execute_commands`, a regex-whitelist over free-form LLM-generated Python fed to Python's dynamic-code-execution builtin with empty builtins) is real, live-tested attack surface that a Graph-mediated pipeline eliminates by construction — V3's LLM never emits CAD commands, only `GraphAction` JSON consumed by a fixed, non-dynamic-execution interpreter (`DefaultGraphUpdater.apply()`). Retiring V1 is a security posture improvement, not just an architectural one. It also collapses duplicate maintenance: `docs/reference/cad-system-roadmap.md` §"P1 Architectural Debt" already flags `ZWCADAgentBridge` for duplicating ~24 of `com_bridge.py`'s methods 1:1-by-name with independent bugs (e.g. a documented `StartUndoMarker`/`StartUndoMark` mismatch claim — see §7 note below on a discrepancy found during this investigation). None of that duplicated surface is fixed by this design; it is retired instead, per the existing precedent's "deprecate the old thing once the new thing is proven" logic rather than a line-by-line bugfix effort on code slated for removal.

---

## 2. Capability Gap Analysis

This section is grounded in direct reading of `src/agent/cad_agent.py` (2775 lines, in full), `src/cad_intelligence/ai/draw_v3.py`, `graph_renderer.py`, `pipeline.py`, `graph_updater.py`, and `common/models.py`'s node dataclasses, as of this document's creation. It is intentionally blunt about what is missing — no gap is papered over.

### 2.1 What V1's `/draw` can do today

`/draw` (`cad_agent.py` `do_POST`, `self.path == "/draw"` branch) supports three request modes, each ending in real COM calls via `ZWCADAgentBridge`:

| Mode | Flow | Command surface |
|---|---|---|
| `mode=python` (default) | LLM emits a python code block → `validate_and_execute_commands()` regex-whitelists each line against ~15 patterns → runs the whitelisted code with builtins stripped out | `bridge.draw_line`, `draw_text`, `draw_polyline`, `draw_circle`, `draw_arc`, `apply_hatch`, `draw_aligned_dimension`, `draw_mtext`, `insert_block`, `start_undo_marker`, `end_undo_marker`, `extract_drawing_model`, plus arbitrary intermediate variable/arithmetic assignment lines |
| `mode=json` | LLM emits a JSON array → `execute_json_commands()` dispatches via an explicit `action → bound-method` dict, no dynamic code execution | Same draw primitives as above, plus M2-B modify tools (`move_entity`, `rotate_entity`, `delete_entity`, `copy_entity`, `mirror_entity`, `offset_entity`) and M2-C layer tools (`create_layer`, `set_entity_layer`, `apply_layer_standards`) |
| `mode=chain` | 4-step LLM chain (`handle_prompt_chain`): INTERPRET (structured intent JSON) → GENERATE (same JSON command set as `mode=json`) → VALIDATE (LLM self-critiques against intent, scores 0.0–1.0) → up to `MAX_CHAIN_REVISIONS=2` REVISE passes → EXECUTE | Same as `mode=json`, wrapped in `_execute_with_undo_protection` (auto `UNDO` rollback on failure) |

Every mode is wrapped in `_execute_with_undo_protection`: `start_undo_marker()` → execute → on failure, `doc.SendCommand("UNDO ")` + `end_undo_marker()` rollback.

`ZWCADAgentBridge` is **not** `/draw`-exclusive. Besides `/draw`, the following endpoints depend on the same bridge instance and would need a migration decision of their own: `/clear` (deletes all model-space entities), `/save`, `/open`, `/new`, `/layers` (read), `/undo` (raw `SendCommand("UNDO ")`), `/recover` (health-monitor reconnect), and the background `_health_monitor_thread`. `/check-compliance` and `/generate-elevation`/`/detect-spaces`/`/generate-room-elevations`/`/generate-wall-model`/`/generate-wall-elevations` also use `self.bridge.connect()` for connection bootstrapping but delegate their actual work to V2's `com_bridge.py` handlers, not to `ZWCADAgentBridge`'s own drawing methods — those are a separate, smaller migration concern noted in §5.

### 2.2 What V3's `/draw-v3` can do today

`/draw-v3` (`draw_v3.py::handle_draw_v3`) is dry-run-capable and its non-COM logic (prompt render → LLM call → `GraphAction` parse → `AIPlan`) is fully implemented per `AI-002`. But three concrete gaps make it **not yet safe to receive production traffic**, regardless of dry-run/apply mode:

**Gap A — no live-drawing extraction (blocks every real use of `apply=true`).** `_build_graph()` in `draw_v3.py` (lines 54–79) only builds a real graph when the caller supplies `payload["graph"]` pre-built JSON. Otherwise it returns `ArchitectureGraph()` — empty, unconditionally — even when a live ZWCAD session with an open, populated drawing is available. The function's own docstring states this plainly: mapping V2's raw extraction (`handle_extract_cad_objects`, returning `WallSegment`/`DoorEntity`/`WindowEntity` raw dataclasses) into the `Wall`/`Door`/`Window`/`Room` domain objects `build_architecture_graph()` expects "requires the same ELEV-002 classification/matching pipeline V2 already implements internally," and that mapping does not exist. Practically: **today, `/draw-v3` cannot reason about an existing drawing's actual geometry at all.** Every plan it produces is either graph-context-free (empty graph) or dependent on a caller manually constructing and submitting graph JSON — neither is viable for a real user typing a prompt against their open drawing. This is the single largest blocker and is addressed in §3.

> **Update (2026-07-05)**: The Feature Store pipeline (`features/`, `graph/primitive_graph.py`, `handle_build_feature_store`) now provides a path from raw CAD extraction through Primitive Graph → Connected Components → Feature Extraction → Feature Store. This partially addresses Gap A by establishing the extraction→primitive→feature mapping infrastructure, but the final Feature Store → Architecture Graph translation step (Object Candidate → Pattern Library → Semantic Objects → Architecture Graph) remains future work. [`ADR-004`](../adr/ADR-004-cad-intelligence-pipeline-design.md) formalizes this remaining pipeline as an 11-stage architecture with Object Candidate Layer, DSL-based Pattern Library, Persistent Object Identity, Wall Local Coordinate System, and View Graph for AI. The `_build_graph()` function in `draw_v3.py` has not yet been wired to use the Feature Store.

**Gap B — `GraphAction` vocabulary cannot express everything V1's command set can.** `GraphAction.action_type` (`common/models.py`) is one of `add_node`, `remove_node`, `add_edge`, `remove_edge`, `update_property` — a CRUD vocabulary over domain objects (`Building`/`Floor`/`Room`/`Wall`/`Door`/`Window`/`Column`/`Stair`/`Slab`) and their relationships. V1's command set is a CAD-drawing-primitive vocabulary: arbitrary hatch patterns on arbitrary boundaries (`apply_hatch`), free-standing dimension lines not tied to any domain object (`draw_aligned_dimension`), arbitrary multiline annotation text (`draw_mtext`), block references with dynamic scale/rotation/layer (`insert_block`), and direct entity-modify operations by COM handle (`move_entity`/`rotate_entity`/`copy_entity`/`mirror_entity`/`offset_entity`, `create_layer`/`set_entity_layer`/`apply_layer_standards`). None of these have a `GraphAction` equivalent — they are not "add/remove a domain object," they are "issue a specific drawing primitive independent of the Graph's node/edge model." A user prompt like "add a hatch pattern to this room's floor with 45-degree brick pattern" or "insert a standard toilet block at this position, rotated 90 degrees" has no path through `GraphAction`s today; `graph_renderer.py`'s node-type mapping (§2.3 below) only fires from Graph node mutations, not from direct primitive requests.

**Gap C — `graph_renderer.py`'s node-type coverage is real but narrow**, per `AI-002` §3.1 and confirmed by reading `graph_renderer.py` directly:
- `Wall` → 2-point polyline on `A-WALL`. Adequate for straight single-segment walls; no curved/multi-segment wall support (matches `Wall.start`/`Wall.end`'s own 2-point-only shape, so this is a data-model limit, not just a renderer gap).
- `Door`/`Window` → a single marker **line** (`handle_draw_line`), not a block insert — because neither dataclass carries a block-name field. This is a visibly degraded rendering compared to V1's `insert_block`, which can place a real door/window block symbol with rotation and scale.
- `Column` → circle (radius from `section_width/2` or a 150mm placeholder) — again no block-name field, so no real column symbol.
- `Room` → text label only, derived from a computed average of connected walls' midpoints (no centroid field exists on `Room`); silently no-ops if no walls resolve. No room boundary is drawn (intentional — walls already draw it), but also no hatch/fill, which V1 can produce via `apply_hatch`.
- `Stair`, `Slab` → **entirely unsupported**, returns `ExceptionReport(code="RENDER_UNSUPPORTED_NODE_TYPE")`. Both dataclasses genuinely lack any position/placement/boundary field in `common/models.py` — this is not a renderer oversight, there is nothing to render from without a data-model change.

**Is closing Gap B in scope for a future phase, or is V1's flexibility intentionally being narrowed?** This design's judgment: **narrowing is the right call, not a gap to close.** V1's arbitrary-primitive flexibility is exactly the surface that makes it ADR-001-incompatible and requires a code-execution sandbox in the first place — a Graph-mediated pipeline that can only propose structured domain-object mutations is a deliberate, security-motivated constraint, not an accidental limitation. Extending `GraphAction` to cover free-form hatch/dimension/mtext/block-with-arbitrary-params would reintroduce the same "LLM can request arbitrary CAD side effects" surface ADR-001 exists to prevent. Where V1's flexibility encoded genuine domain intent (e.g., "this wall has a door" — a `Door` node with a `wall_id` edge), V3 already covers it. Where it encoded arbitrary drawing decoration (a specific hatch pattern name, a specific dimension line placement) with no domain-object backing, that capability is being deliberately dropped, not deferred. If future usage data shows real demand for structured-but-currently-unsupported operations (e.g., a `Door`/`Window` block-name field, so renders use real block symbols instead of marker lines — Gap C, not Gap B), those are additive data-model changes to pursue on their own merits, tracked as a distinct future increment, not a precondition for this migration's Phase 4.

### 2.3 Net assessment

V3 is architecturally correct and further along than "just a stub" — GRPH-002/RENDER-001/Part 4/Part 5 dry-run are all implemented and tested per `AI-002`'s acceptance criteria. But it cannot yet touch a real drawing (Gap A) and, once it can, will only ever support a narrower, domain-object-centric command surface than V1 by design (Gap B, accepted). No validation checkpoint against a live drawing is possible until Gap A is closed — this is why §3 is a hard prerequisite, not a parallel-track nice-to-have.

---

## 3. Prerequisite Work: Live-Drawing → `ArchitectureGraph` Extraction Mapping

This is the one piece of work that must exist before Phase 2's validation checkpoint (§4) can even be attempted. Described here at design level only — no implementation.

**Goal**: give `_build_graph()` a real path that, when no `payload["graph"]` is supplied, extracts the current live ZWCAD drawing's actual walls/doors/windows/rooms and builds a populated `ArchitectureGraph` from them, instead of unconditionally falling back to `ArchitectureGraph()`.

**What it needs to do, at a design level**:
1. **Reuse V2's read-path handlers, not V1's.** `handle_extract_cad_objects` (V2, `com_bridge.py`, already covers `AcDbLine`- and `AcDbPolyline`-based walls per `ELEV-002` §3 Phase 1) produces raw `WallSegment`/`DoorEntity`/`WindowEntity` dataclasses (`common/models.py` lines ~84–175) — layer/handle/geometry only, no domain semantics yet. This is a **read-only** call; per `ADR-002` §5 precedent (V3's `RENDER-001` already calls V2's read-only `handle_extract_cad_objects` for input, per `AI-002` §5.1), reading V2 does not violate `ADR-002`'s zero-line-diff requirement on `com_bridge.py` — no V2 file is modified by adding a new caller.
2. **Feed the raw extraction through the same classification/matching pipeline V2 already runs internally** to reach domain-object shape: `handle_generate_spaces` (room polygon detection from wall segments), `handle_map_space_info` (room-info.json matching, if available), `handle_generate_wall_model` (the room-centric → wall-centric conversion that produces genuine `Wall`/`Door`/`Window`/`Room` dataclasses with `wall_ids`, `position_on_wall`, etc. — `ELEV-002` §"Phase 3 구현 확정"). This is the same pipeline ELEV-002 already validated on two real test drawings; this prerequisite does not invent new classification logic, it wires an existing, already-checkpointed pipeline into a new caller.
3. **Translate the resulting `Wall`/`Door`/`Window`/`Room`/(`Building`/`Floor`/`Column` where available) objects into `build_architecture_graph()`'s expected input collections** (`rooms, walls, doors, windows, buildings, floors, columns, stairs, slabs, opening_assignments`), then call it to populate both `edges` and the `nodes` registry (GRPH-002, already implemented). `Stair`/`Slab` collections will typically be empty inputs today, since V2 has no extraction path for them either (matches `ADR-002` §5's explicit non-goal of adding Stair/Slab capability) — this is a pre-existing, orthogonal gap, not something this prerequisite must solve.
4. **Failure handling**: if extraction/classification produces `ExceptionReport`s (e.g. `UNCLOSED_WALLS`, `ORPHAN_OPENING`, `AMBIGUOUS_SPACE_SIZE_MATCH` — all pre-existing ELEV-002 exception codes), the mapping should surface them in `/draw-v3`'s response rather than silently degrading to an empty/partial graph, so a caller can distinguish "the drawing genuinely has no walls" from "extraction hit a known ambiguity." The exact response shape is an implementation decision, not fixed by this design.
5. **Explicitly not required for this prerequisite**: no new classification heuristics, no new exception codes, no Stair/Slab support, no change to any V2 handler. This is a translation/orchestration layer sitting in the V3 package (e.g. a new function in or near `draw_v3.py`, calling existing V2 read handlers and existing `build_architecture_graph()`), not new domain logic.

Until this exists, `apply=true` against a real drawing is meaningless — the graph V3 would mutate and render from is always empty, so any render would only ever draw whatever the LLM's `add_node` actions fabricated from scratch, with zero awareness of what's already in the drawing. Phase 2 cannot start without this.

---

## 4. Phased Migration Plan

### Phase 1 — Close the prerequisite gap (§3)

**Scope**: implement the live-extraction → `ArchitectureGraph` mapping described in §3.
**Done condition**: `/draw-v3` called with no `payload["graph"]` against a live ZWCAD session with `아파트 평면도.dwg` open returns a non-empty `ArchitectureGraph` (verified via the dry-run response's `plan.metadata` or a debug-only graph-dump, whichever the implementer wires up) whose node/edge counts are sane against that drawing's known wall/room count (reuse `ELEV-002`'s existing `{file}.expected_walls.json`/`{file}.expected_rooms.json` ground-truth fixtures — do not invent new ground truth). No apply-mode COM calls are required to pass Phase 1; this is purely "the graph gets populated," independent of rendering.

### Phase 2 — Live-ZWCAD validation of `/draw-v3`'s apply=true path

**Scope**: with Phase 1 done, exercise `/draw-v3` with `apply: true` against real test drawings and a live ZWCAD session.

**Test drawings** (reusing the exact fixtures already established and ground-truthed by `ELEV-002` §10 — no new fixtures invented here): `아파트 평면도.dwg` and `AI 작업용 공용홀.dwg`.

**Concrete "passes" criteria** (mirroring `ELEV-002` §10's 6-condition structure, adapted to V3's scope):
1. For each of the two test drawings, at least 3 distinct natural-language prompts exercising different `GraphAction` types (e.g. one `add_node` Wall/Room-creation prompt, one `update_property` prompt modifying an existing extracted node, one prompt with no valid interpretation to confirm graceful `ExceptionReport` behavior rather than a crash) are run with `apply: true` end-to-end.
2. Every run completes without an unhandled exception reaching the HTTP layer — `render_graph()`'s existing "never raises, collects `ExceptionReport`s" contract (`AI-002` §3.3) is confirmed to hold under real COM conditions, not just the unit-test stubs it was validated against in `AI-002`.
3. For prompts producing `Wall`/`Door`/`Window`/`Column`/`Room` node mutations, a human reviewer visually confirms in ZWCAD that the rendered geometry matches the prompt's intent — "renders something" is not sufficient; "renders the right thing at the right place" is the bar, consistent with `ELEV-002` §10 condition 3's manual visual confirmation standard for shared-wall dedup.
4. `Stair`/`Slab`-targeting prompts (if attempted) produce the expected `RENDER_UNSUPPORTED_NODE_TYPE` `ExceptionReport` rather than a silent no-op or crash — confirming the known-gap behavior is correctly surfaced, not accidentally masked.
5. No test run leaves the live drawing in a state requiring manual cleanup beyond a standard `UNDO` — i.e., failed/partial applies must be recoverable the same way V1's undo-marker wrapping makes `/draw` recoverable today (§2.1). If V3's apply path has no equivalent undo-wrapping at this point, that gap must be either fixed before Phase 2 can pass, or explicitly accepted and documented as a known risk with a mitigation (e.g. "always test against a throwaway copy of the drawing").
6. All of 1–5 reproducible against the **same commit** — consistent with `ELEV-002` §10 condition 6's requirement that a partial pass followed by further code changes restarts the checkpoint from scratch.

**Done condition**: all 6 conditions satisfied on both test drawings, recorded in a checkpoint note (mirroring `ELEV-002`'s pattern of committing ground-truth/checkpoint results) referencing this design.

### Phase 3 — Parallel-run period

**Scope**: both `/draw` (V1) and `/draw-v3` (V3) remain available and callable. No default routing changes. Real usage (by whichever caller(s) currently hit `/draw` — this design does not know or assume who that is, see §5) is compared between the two paths, ideally by having the same prompts run through both and comparing outputs/behavior where feasible.

**Done condition**: a defined observation window (length is an implementation/PM decision, not fixed here — `ELEV-002` did not use a time-boxed parallel-run because its v1/v2 fallback was single-request-scoped, not endpoint-scoped like this case) elapses with V3 handling a representative sample of real prompts with no regressions relative to V1's historical success rate, and no new categories of failure specific to the Graph-mediated path (e.g. Gap B-class "prompt requests something V3 structurally cannot express" cases) that weren't anticipated in §2.2.

### Phase 4 — Cutover

**Scope and recommendation**: this design recommends **`/draw` internally routes to the V3 pipeline**, rather than deprecating `/draw` in favor of callers switching to `/draw-v3` directly.

**Justification**: `/draw`'s request/response shape (`{"prompt", "mode"}` → `{"success", "code", "logs"}`) is different from `/draw-v3`'s (`{"prompt", "apply", "graph"?, "provider"?}` → `{"success", "dry_run", "plan", ...}`). Requiring every caller of `/draw` to migrate to a new request/response contract is a client-facing breaking change this design is explicitly out of scope for imposing (§5) — the whole point of the additive-endpoint strategy in `AI-002` §1 was to avoid coupling this migration's pace to client-side changes. Internally routing `/draw` to V3 (translating V1's request shape to a `/draw-v3`-equivalent call, and V3's plan/apply result back to V1's `{"success", "code", "logs"}` shape) lets the migration complete without requiring any caller-side change, consistent with `ELEV-002`'s own precedent of the *new* implementation taking over *without* changing the calling convention client code depends on. The `mode` parameter (`python`/`json`/`chain`) has no direct V3 equivalent post-cutover; this design recommends treating any `mode` value as accepted-but-ignored once V3 is the executor, since the underlying distinction (how commands are generated/validated) is superseded by the Graph-action pipeline entirely — but the exact compatibility-shim behavior is an implementation decision for Phase 4, not fixed here.

**What gets marked deprecated (not removed)**: `ZWCADAgentBridge`, `validate_and_execute_commands` (the sandboxed-execution path), `execute_json_commands`, `handle_prompt_flow`, `handle_prompt_chain`, and the `LLMClient` class in `cad_agent.py` — all get a "DEPRECATED (AI-003 Phase 4)" comment header pointing at this design, but remain in the file, callable, and untouched otherwise. This mirrors `ELEV-002` §1's deprecated-not-deleted treatment of ELEV-001 exactly.

**Non-`/draw` endpoints depending on `ZWCADAgentBridge`** (§2.1: `/clear`, `/save`, `/open`, `/new`, `/layers`, `/undo`, `/recover`, the health-monitor thread): this design explicitly does **not** resolve their migration in Phase 4. They are orthogonal to the drawing-generation cutover this document plans — `/save`/`/open`/`/new`/`/layers` are file/session management, not AI-driven drawing generation, and have no V3 equivalent to route to (V3's scope per `AI-002` was drawing generation, not file I/O). Retiring `ZWCADAgentBridge` outright in a later cleanup phase (Phase 5) would break these endpoints unless they are separately given a non-`ZWCADAgentBridge` implementation (most plausibly, thin wrappers over V3's `com_primitives_v3.ZWCADComBridge` connection object, which already exists per `ADR-002`). This is flagged as a **dependency Phase 5 must resolve before actual V1 removal**, not something Phase 4 needs to solve — Phase 4 only deprecates the drawing-generation code path.

**Done condition**: `/draw` requests are served by the V3 pipeline internally; the pre-Phase-4 `/draw` code path is marked deprecated with a comment but present; a smoke test confirms at least one real historical `/draw` prompt (from `/audit` log history, if available, or a representative synthetic prompt) produces a comparable result through the now-rerouted `/draw`.

### Phase 5 — Removal (COMPLETE, 2026-07-09)

**Status update**: contrary to this section's original framing ("future, explicitly out of scope for implementation now"), Phase 5 was executed on 2026-07-09 as a scoped "Stage B — V1 legacy closeout" task. The non-`/draw` endpoint dependency this section flagged as a precondition was already resolved by the time of removal: `ZWCADAgentBridge` had been a V3 thin proxy since M1, so `/clear`, `/save`, `/open`, `/new`, `/layers`, `/undo`, `/recover`, and the health-monitor thread all continued to work unmodified — they were never coupled to the LLM/sandboxed-command-validation code being removed here.

**What was actually removed from `src/agent/cad_agent.py`**:
- The `LLMClient` class (V1's provider-detection/self-healing HTTP client for Gemini/OpenAI/Anthropic).
- `SYSTEM_INSTRUCTION` and `SYSTEM_INSTRUCTION_JSON` (V1's python/JSON prompt templates).
- `validate_and_execute_commands` (the regex-whitelist sandboxed-code-execution path) and `execute_json_commands` (the JSON action-dispatch path).
- `handle_prompt_flow` (single-shot translate→execute) and `handle_prompt_chain` (the 4-step INTERPRET→GENERATE→VALIDATE→EXECUTE chain), plus the chain's supporting `CHAIN_SYSTEM_INTERPRET`/`CHAIN_SYSTEM_VALIDATE`/`CHAIN_SYSTEM_REVISE` prompts and `MAX_CHAIN_REVISIONS` constant.
- Orphaned helpers that existed only to support the above and had no other callers once they were removed: `extract_python_code`, `strip_trailing_comment`, `_extract_json_from_llm`, `_extract_code_from_llm`, `_execute_with_undo_protection`.

**How the CLI-entrypoint blocker was resolved**: `main()`'s `--prompt`/`--interactive` argparse flags (which instantiated `LLMClient` and called `handle_prompt_flow` directly, bypassing the HTTP layer entirely) were removed along with their handler branches. A repo-wide grep confirmed these flags were not referenced by any script, doc, or CI job outside `cad_agent.py` itself — `--server` (still supported) is now the only way to run the agent, and drawing generation goes exclusively through `/draw`/`/draw-v3` (V3 graph-driven pipeline).

**Test fallout**: `tests/test_cad_agent_whitelist.py` was pared down to only its `_validate_coordinate`/`_validate_point`/`BoundaryViolationError` tests (those helpers are still shared with `com_bridge.py` and V3 handlers); its whitelist/JSON-dispatch/chain-helper tests were removed along with the code they covered. `tests/test_house_drawing.py` (a manual live-ZWCAD smoke script) was rewritten to call `ZWCADAgentBridge`'s `draw_*` methods directly instead of going through the deleted `validate_and_execute_commands`. Full suite: 2007 passed, 1 skipped, 1 xfailed — no regressions.

**What was *not* touched**: `ZWCADAgentBridge` itself (still the V3 thin proxy from M1), `CADAgentHTTPRequestHandler` and all its endpoints, and the non-`/draw` endpoints listed above.

---

## 5. Out of Scope

1. **Implementing any of Phases 1–5** — this document is a design only. No code in `src/agent/cad_agent.py`, `src/cad_intelligence/ai/*`, or `src/cad_intelligence/cad_io/*` is modified by this work.
2. **Closing the `GraphAction` vocabulary gap (Gap B, §2.2)** — judged not trivial (it would require new action types and new renderer logic for hatch/dimension/mtext/arbitrary-block-insert, none of which map onto the Graph's domain-object model) and, more importantly, judged as an intentional narrowing rather than a gap to close (§2.2's reasoning). Not scheduled in any phase above.
3. **Any UI/client-facing changes for existing `/draw` callers** — Phase 4's internal-routing recommendation (§4) is specifically designed to avoid requiring this, but if a client-visible change ever becomes necessary (e.g. the `mode` parameter's post-cutover semantics), designing that change is not covered here.
4. **Resolving the non-`/draw` `ZWCADAgentBridge`-dependent endpoints** (`/clear`, `/save`, `/open`, `/new`, `/layers`, `/undo`, `/recover`, health-monitor) beyond flagging them as a Phase 5 precondition in §4. Their own migration path (if any) is a separate future design.
5. **Stair/Slab data-model or rendering support** — remains out of scope per `ADR-002` §5 and `AI-002` §6, unaffected by this migration.
6. **Fixing the P0 bugs cad-system-roadmap.md attributes to `ZWCADAgentBridge`** (undo-marker method mismatch, `draw_text`/`AddMText` mismatch) — since this code is being deprecated-then-removed rather than maintained, this design does not recommend fixing bugs in it. See §7 note on a discrepancy found regarding the undo-marker claim specifically.

---

## 6. Acceptance Criteria (for this design document)

- [ ] The capability gap analysis (§2) is grounded in actual reading of `cad_agent.py` (in full), `draw_v3.py`, `graph_renderer.py`, `pipeline.py`, `graph_updater.py`, and `common/models.py`'s node dataclasses — not assumption. (Confirmed: all six files were read in full or via targeted search during this document's preparation; §2's line/function references are drawn directly from that reading.)
- [ ] Every capability gap identified is stated plainly, with an explicit judgment on whether closing it is in scope for a future phase or an intentional narrowing — no gap is glossed over or left ambiguous (§2.2's Gap B treatment; §2.2 Gap C's per-node-type breakdown).
- [ ] The prerequisite work (§3) is described at a design level sufficient for an implementer to scope it, without containing actual implementation code.
- [ ] Every phase (§4) has a concrete, checkable "done" condition — none are vague "looks good" criteria. Phase 2 in particular reuses the existing `ELEV-002` checkpoint pattern (named test drawings, numbered pass conditions, single-commit reproducibility) rather than inventing a weaker one.
- [ ] The out-of-scope section (§5) is consistent with the phased plan — nothing listed as a future phase is also claimed as delivered by this document.
- [ ] This document does not modify any file outside `docs/designs/`, and recommends no changes to `src/agent/cad_agent.py` or any other implementation file (flagging observations instead, per §7).

---

## 7. Notes

- **Discrepancy found during investigation, flagged rather than fixed (per constraint: this design must not touch implementation files)**: `docs/reference/cad-system-roadmap.md` states the P0 bug as an undo-marker method name mismatch, describing the buggy call as using the wrong method name. Direct reading of `cad_agent.py`'s `ZWCADAgentBridge.start_undo_marker()` (current source, this investigation) shows it already calls the corrected method name (`doc.StartUndoMark()`), not the mismatched one the roadmap describes. Either this bug was already fixed since the roadmap doc was last updated, or the roadmap's bug description refers to a different call site not found during this investigation (e.g. a different function, or code that existed at a prior commit). This is flagged for the user/PM to confirm and correct the roadmap doc separately — it does not change this design's conclusions, since Phase 4 deprecates this code regardless of whether the specific bug is live.
- Implementation of any phase in this document should follow the same process as `ADR-002`/`AI-002`: a design-approved PR per phase, `CHANGELOG.md [Unreleased]` entry, then `/sync`.
- This design deliberately does not attempt to fix, extend, or improve V1 code in any way, per the explicit constraint that this is a retirement plan, not a maintenance plan.
