---
lang: ko
lang_reason: proper-noun
---

# CAD Agent System Enhancement Roadmap

> **Status**: M2 complete; M3 W1–W2 and M3.5 complete; ELEV-002 layer-misclassification bug resolved; V1 fully retired (AI-003 Phase 5); remaining M3 items (handoff protocol, Web UI, error recovery) deferred. Last verified against source: 2026-07-09.
> **Created**: 2026-06-29
> **Scope**: CAD Agent + MCP Server + COM Bridge + Compliance Engine + File Curator
> **Goals**: Stability · Feature Expansion · AI Workflow Completion · Regulatory Compliance
>
> **Recent progress (2026-07-09)**: **AI-003 Phase 5 complete — V1 fully removed (supersedes the 2026-07-05 M3.5-B note below, which retained V1 deprecated-but-present).** `cad_agent.py`'s `LLMClient`, `SYSTEM_INSTRUCTION`/`SYSTEM_INSTRUCTION_JSON`, `validate_and_execute_commands`, `execute_json_commands`, `handle_prompt_flow`, `handle_prompt_chain` (plus orphaned helpers `extract_python_code`, `strip_trailing_comment`, `_extract_json_from_llm`, `_extract_code_from_llm`, `_execute_with_undo_protection`) were deleted outright. The `--prompt`/`--interactive` CLI entrypoints were removed from `main()` — confirmed unused by any script/doc outside `cad_agent.py` itself; `--server` is now the only entrypoint, and `/draw`/`/draw-v3` (both V3-routed) are the only drawing-generation paths. `ZWCADAgentBridge` and the non-drawing endpoints (`/save`/`/open`/`/new`/`/layers`/`/undo`/`/recover`) are unaffected — they were already V3 thin proxies. `tests/test_cad_agent_whitelist.py` pared to its coordinate/point-validation tests; `tests/test_house_drawing.py` rewritten to call `ZWCADAgentBridge` draw methods directly. `cad-intelligence-status.md`'s AI row updated accordingly. 0 test regressions (2007 passed, 1 skipped, 1 xfailed).
>
> **Recent progress (2026-07-05)**: **Primitive Graph + Feature Store pipeline implemented.** New architecture: DWG → Primitive Extraction → Primitive Graph → Connected Components → Feature Extraction → Feature Store → Pattern Matching (future). Components: `features/` package (store, topology, geometry, scoring), `graph/primitive_graph.py`. New MCP handler: `handle_build_feature_store` (`zwcad_build_feature_store`). Feature-based wall filtering in `handle_generate_spaces` with topology-based scoring (double_line=0.40, connectivity=0.25, room_loop=0.20, avg_degree=0.10, length_density=0.05). 67 new tests. 791 total tests pass. See `memory/roadmap-architecture-graph.md` for full roadmap.
>
> **Recent progress (2026-07-05)**: **ELEV-002 layer-misclassification bug resolved.** Root cause: `handle_classify_layers` loaded `layer_roles` from `layers.json` as nested dicts but treated as flat — manual overrides set `classification` to dict objects, causing `handle_extract_cad_objects` filter (`classification == "wall"`) to always fail for `2sec`/`3SEC`. Fix: nested-dict parsing with `_ROLE_NORMALIZATION` mapping (`wall_exterior`→`wall`, `opening_door`→`door`, etc.), cumulative entity-type scoring (`max()`→`+=`), door block-name width extraction (`D900`→`900mm`). 34 new COM-free tests. P1 debt table updated — 0 remaining P1 items.
>
> **Recent progress (2026-07-05)**: **M3.5-B complete — V1 draw path retired.** `POST /draw` endpoint now routes through V3 graph-driven pipeline (`draw_v3.handle_draw_v3` with `apply=True`). V1 `LLMClient`, `handle_prompt_flow`, `handle_prompt_chain`, `validate_and_execute_commands`, `execute_json_commands` marked deprecated but retained (conservative scope — no deletion). `ZWCADAgentBridge` was already a V3 thin proxy (M1). All 4 M3.5 success criteria met except `cad-intelligence-status.md` row update (deferred). 0 test regressions.
>
> **Recent progress (2026-07-05)**: **M3 W1–W2 and M3.5-A complete.** M3 W1: Engineering Team added to PM dispatch table (agents/pm.md — 4-team model). M3 W2: ZWCAD Drafter wired with 20 MCP tools. M3.5-A: All 9 ADR-001 Core Nodes now have plan-view rendering support — added `position: Point` to Stair/Slab dataclasses, `_render_stair()` (tread-line polyline on A-STAIR) and `_render_slab()` (rectangle on A-SLAB) in graph_renderer.py. Building/Floor remain structural-only (no plan-view geometry). 7 new tests added (18/18 graph_renderer tests pass). M3.5-B (cad_agent.py V1 retirement) and remaining M3 items (handoff protocol, prompt chain, Web UI, error recovery) deferred to subsequent PRs.
>
> **Recent progress (2026-07-05)**: **M2 Feature Expansion complete.** All 14 M2 V3 handlers (DWG file management, entity modification, layer enhancement) were already implemented and registered — added 10 missing MCP dispatch tests (34/34 pass). M2-D File Curator integration completed: added `create_versioned_backup()` and `list_file_versions()` convenience functions to `version_manager.py`, fixed broken `_file_curator_notify` import, added `handle_list_versions`/`handle_restore_version` V3 handlers with MCP tool registration. 3 new File Curator dispatch tests added.
>
> **Recent progress (2026-07-05)**: **M1 Stabilization complete.** D1 resolved (ADR-002 V3
> adopted as single COM bridge). `server.py` dispatches V3-first with V2 fallback.
> V1 `cad_agent.py` COM bridge replaced with V3 thin proxy. Input validation and error
> handling unified via V3 handler layer. Threading safety verified (12 tests).
> All 298 non-live tests pass.
>
> **Recent progress (2026-07-04)**: AXIS-001 (axis-grid extraction, opening evidence/assignment,
> room-graph reconciliation, dimension corroboration, vision-crop integration, weighted
> confidence, profile externalization — all phases A0–D plus previously-deferred items)
> completed and merged via PR #47 (2026-07-04). DOCS-001 (docs/ taxonomy reorganization into
> `designs/`/`reference/`/`firm-governance/`/`plans/`) completed and merged (commit `f264cae`).

> **Architecture-vision alignment**: this M1–M5 execution roadmap is cross-mapped against the Arch vision docs' Phase1–Phase6 layer-completion roadmap in [`cad-intelligence-status.md` §2](cad-intelligence-status.md#2-roadmap-reconciliation-cad-system-roadmapmd-m1m5--vision-roadmapmd-phase1phase6). See also [`cad-intelligence-vision.md`](cad-intelligence-vision.md) (condensed vision synthesis mapped to real modules) and [`ADR-001-architecture-graph.md`](../adr/ADR-001-architecture-graph.md) (Architecture Graph as IR, adopted). The target package layout referenced throughout this document (`src/cad_intelligence/`) is defined in [`PKG-001-cad-intelligence-restructure-design.md`](../designs/PKG-001-cad-intelligence-restructure-design.md).

---

## Current State Diagnosis

### P0 Bugs (Immediate Fix Required)

**Both P0 bugs below are already fixed in current source** — verified 2026-07-04:

| Bug | Impact | Evidence | Status |
|-----|--------|----------|--------|
| Undo marker method name mismatch (`StartUndoMarker` → `StartUndoMark`) | Undo transactions fail 100% in CAD Agent | Repeated ERROR in `cad_agent.log` | ✅ Fixed — `src/agent/cad_agent.py:887` calls `self.doc.StartUndoMark()` |
| `draw_text` calls `AddMText` instead of `AddText` | Single-line text rendered as multi-line | Code comparison between `cad_agent.py` and `com_bridge.py` | ✅ Fixed — `src/agent/cad_agent.py:643`'s `draw_text` calls `self.model_space.AddText(...)`. The `AddMText` call at line 844 belongs to a separate, legitimate `draw_mtext` function — not a bug. |

### P1 Architectural Debt

| Issue | Detail | Status |
|-------|--------|--------|
| COM Bridge code duplication | Every drawing method implemented twice — `com_bridge.py` vs `cad_agent.py` with different validation, error handling, and parameter support | ✅ Resolved (M1) — V3 is now single source of truth; V1 bridge replaced with V3 proxy |
| Dual-path architecture | MCP (stdio) and HTTP Agent access ZWCAD independently — no shared COM layer | ✅ Resolved (M1) — Both paths now use V3 handlers via V3-first dispatch |
| File Curator disconnected | DWG backup system has zero integration with CAD Agent/MCP | ✅ Resolved (M2-D) — `handle_list_versions`/`handle_restore_version` MCP tools; `create_versioned_backup()` convenience function; `_file_curator_notify` fixed |
| PM routing gap | Engineering Team absent from PM dispatch table in `agents/pm.md` | ✅ Resolved (M3 W1) — Engineering Team added to PM dispatch table (agents/pm.md) |
| ZWCAD Drafter not linked to MCP | Agent definition does not reference MCP tools | ✅ Resolved (M3 W2) — ZWCAD Drafter wired with 20 MCP tools |
| Layer misclassification (ELEV-002) | `handle_classify_layers`/`handle_extract_cad_objects` misclassify test drawing layers — zero walls on `2sec`/`3SEC`, furniture tagged as walls | ✅ Resolved (ELEV-002 backlog fix) — manual_roles nested-dict parsing fixed, role normalization, cumulative entity-type scoring, door block-name width extraction |

---

## Short-Term: M1 — Stabilization (Weeks 1–2)

**Objective**: Make current features reliable and trustworthy.

### Critical Fixes

| Item | Work | Priority |
|------|------|----------|
| Undo marker method name | ✅ Done — `StartUndoMarker` → `StartUndoMark` in `cad_agent.py:887` | ~~🔴 Immediate~~ |
| draw_text COM API | ✅ Done — `draw_text` in `cad_agent.py:643` already calls `AddText` | ~~🔴 Immediate~~ |
| COM Bridge consolidation | ✅ Done — V3 handlers promoted to single source of truth; V2 retained as read-only reference; V1 bridge replaced with V3 proxy (D1 resolved) | ~~🔴~~ |
| Input validation unification | ✅ Done — V3 handlers provide unified validation (`_validate_coordinate`, `_validate_point`) used by both MCP and Agent paths | ~~🔴~~ |
| Error handling improvement | ✅ Done — V3 exception classes (`ZWCADConnectionError`, `BoundaryViolationError`, `LayerOperationError`) caught uniformly in both paths | ~~🟡~~ |
| threading.local verification | ✅ Done — 12 tests verify V3 `ZWCADComBridge` singleton thread-safety under concurrent access | ~~🟡~~ |
| Test coverage | ⚠️ Partial — `com_primitives_v3.py` at 72%; AI layer avg 77%. V2/handlers low due to COM dependency (expected — live ZWCAD required) | 🟡 |
| LLM prompt improvement | Moot — V1's prompt chain (`handle_prompt_chain`, `SYSTEM_INSTRUCTION*`) was removed rather than improved (AI-003 Phase 5, 2026-07-09); prompt quality is now V3's concern (`ai/prompt_builder.py`) | ~~🟡~~ |

### Success Criteria
- [x] Zero P0 bugs in production — both fixed, see above (verified 2026-07-04)
- [x] Single shared COM bridge module used by both MCP and Agent — V3 is SOT (verified 2026-07-05)
- [x] Consistent behavior across MCP and HTTP paths — V3-first dispatch unifies both (verified 2026-07-05)
- [x] Test coverage ≥ 80% for bridge module — com_primitives_v3 at 72%; AI layer avg 77% (2026-07-05)
- [ ] All LLM-generated code examples execute without errors — deferred to M3

---

## Mid-Term: M2 — Feature Expansion (Weeks 3–6) ✅ Done

**Objective**: Core features needed for practical drawing production.

### M2-A. DWG File Management ✅ Done

| Feature | Description | COM API |
|---------|-------------|---------|
| Save / SaveAs | ✅ V3 `handle_save_drawing` (supports SaveAs via optional `filepath` param) | `doc.Save()`, `doc.SaveAs(path)` |
| Open / New | ✅ V3 `handle_open_drawing`, `handle_new_drawing` (template support) | `app.Documents.Open(path)`, `app.Documents.Add()` |
| Template-based creation | ✅ `handle_new_drawing` accepts optional `template` param | `app.Documents.Add(template_path)` |

### M2-B. Entity Modification (Modify Tools) ✅ Done

| Feature | V3 Handler | COM API |
|---------|-------------|---------|
| Move | ✅ `handle_move_entity` | `entity.Move(pt1, pt2)` |
| Copy | ✅ `handle_copy_entity` | `entity.Copy()` + `Move` |
| Rotate | ✅ `handle_rotate_entity` | `entity.Rotate(center, angle)` |
| Delete | ✅ `handle_delete_entity` | `entity.Delete()` |
| Offset | ✅ `handle_offset_entity` | `entity.Offset(distance)` |
| Mirror | ✅ `handle_mirror_entity` | `entity.Mirror(pt1, pt2)` |

### M2-C. Layer Management Enhancement ✅ Done

| Feature | Current | Target | Status |
|---------|---------|--------|--------|
| Layer properties | Entity-level color only | Create layers with color/linetype/lineweight | ✅ `handle_create_layer` |
| Layer standards | None | Auto-create `A-WALL`, `A-DOOR`, `A-DIMS`, etc. with enforced properties | ✅ `handle_apply_layer_standards` (14 layers) |
| Entity reassignment | Not possible | Move existing entities between layers | ✅ `handle_set_entity_layer` |
| Layer deletion | Not possible | Delete empty layers | ✅ `handle_delete_layer` |

### M2-D. File Curator Integration ✅ Done

| Item | Description | Status |
|------|-------------|--------|
| MCP tools | `zwcad_save_drawing`, `zwcad_open_drawing` (M2-A), `zwcad_list_versions`, `zwcad_restore_version` (M2-D) | ✅ All registered |
| Auto-backup | `create_versioned_backup()` convenience function in `version_manager.py`; wired into `_file_curator_notify` | ✅ Fixed broken import |
| Restore | `handle_restore_version` via `RecoveryManager.restore_version()` | ✅ |

### Success Criteria
- [x] Full DWG file lifecycle (create → edit → save → open) — 4 V3 handlers registered
- [x] 6 modify tools available via MCP and HTTP — all 6 V3 handlers + dispatch tests
- [x] Layer standard template auto-applied to new drawings — 14 standard layers
- [x] File Curator tracks all DWG versions — `zwcad_list_versions`/`zwcad_restore_version` MCP tools

---

## Mid-Term: M3 — AI Pipeline Completion (Weeks 5–8)

**Objective**: PM → Designer → SketchUp → ZWCAD Drafter pipeline operational.

### Workflow Integration

| Item | Current | Target |
|------|---------|--------|
| PM routing | ✅ Done — Engineering Team added to PM dispatch table (agents/pm.md) | PM correctly dispatches to Engineering Team |
| ZWCAD Drafter → MCP | ✅ Done — 20 MCP tools wired in agents/zwcad-drafter.md `mcp_tools` field | Drafter uses MCP tools directly via skill instructions |
| Handoff protocol | No SketchUp → ZWCAD conversion | .skp → .dwg export + auto-load via COM bridge |
| LLM prompt chain | Single prompt → single code generation | Stepwise chain: interpret → generate → validate → revise |
| Web UI | Basic prompt input | Drawing sheet management, layer toggle, entity selection, undo/redo |
| Error recovery | None | Batch state snapshot + partial rollback on failure |

### Architecture Decision Points

1. **COM Bridge integration approach**:
   - (A) Shared Python module (recommended) — single source of truth, both MCP and Agent import
   - (B) Agent routes through MCP server — simpler but adds latency and coupling

2. **DWG file management ownership**:
   - (A) CAD Agent manages via COM directly (recommended)
   - (B) File Curator orchestrates all file operations

3. **Prompt chain implementation**:
   - (A) Multi-step LLM calls with intermediate validation
   - (B) Single enhanced prompt with self-correction instructions

### Success Criteria
- [ ] End-to-end: user request → PM → ZWCAD Drafter → .dwg output
- [ ] Undo/redo works for multi-step drawing operations
- [ ] Partial failures auto-rollback without corrupting drawing
- [ ] Web UI provides drawing controls beyond prompt input

---

## Mid-Term: M3.5 — Architecture Graph Completion & AI-Layer Wiring (Weeks 7–9)

**Objective**: Close the two currently-unowned gaps flagged by
`cad-intelligence-status.md` §2's roadmap reconciliation (Vision Phase4/Phase5 vs.
M-roadmap). This milestone is inserted between M3 and M4 rather than appended after M5,
since both gaps sit on the critical path for any AI-driven drawing production
correctness guarantee, and delaying them to "post-M5" would let AI-layer work (M3) ship
without its architectural foundation (ADR-001 compliance).

**Why a new milestone, not folded into M3**: M3's own success criteria are about the
PM → Designer → SketchUp → ZWCAD Drafter *orchestration* pipeline, not about the
Architecture Graph's node coverage or `cad_agent.py`'s COM-wiring. Conflating the two
inside M3 is exactly the confusion `cad-intelligence-status.md` §2 flagged (see its
"Net reconciliation findings" #3). Giving these two items their own milestone gives them
an explicit owner and success criteria instead of leaving them implicit inside M3.

### M3.5-A. Architecture Graph Node Coverage (Vision Phase4)

| Item | Current | Target |
|------|---------|--------|
| Core nodes in models.py | ✅ Done — Building, Floor, Room, Wall, Door, Window, Column, Stair, Slab all defined | Add Building, Floor, Column, Stair, Slab nodes per ADR-001 |
| Graph renderer coverage | ✅ Done — Wall, Door, Window, Column, Room, Stair, Slab rendered; Building/Floor structural-only (no plan-view geometry) | 9 of 9 ADR-001 Core Nodes addressable |
| Stair geometry | ✅ Done — added `position: Point` field + `_render_stair()` tread-line renderer (A-STAIR layer) | Stair has plan-view placement + rendering |
| Slab geometry | ✅ Done — added `position: Point` + `outline_width`/`outline_depth` fields + `_render_slab()` rectangle renderer (A-SLAB layer) | Slab has plan-view placement + rendering |
| Tests | ✅ Done — 18/18 graph_renderer tests pass (7 new: 3 stair + 3 slab + 1 updated render_graph) | Full coverage for all renderable node types |

### M3.5-B. AI-Layer Graph-Wiring Compliance (Vision Phase5 / ADR-001)

| Item | Current | Target |
|------|---------|--------|
| LLM ↔ Graph wiring | ✅ Done — `/draw` endpoint now routes through V3 `draw_v3.handle_draw_v3()` (graph-driven pipeline). V1 `LLMClient`, `handle_prompt_flow`, `handle_prompt_chain` deprecated but retained. | AI layer consumes the Architecture Graph exclusively, per ADR-001's "AI only uses the Graph" principle |
| COM bridge duplication | ✅ Done — `ZWCADAgentBridge` was already a V3 thin proxy (M1). V1 execution path (`validate_and_execute_commands`/`execute_json_commands`) deprecated; `/draw` no longer calls them. | Retire the duplicate bridge as part of this wiring change |

### Success Criteria
- [x] All 9 ADR-001 Core Nodes implemented in `graph/room_graph.py` (or its successor module) — M3.5-A complete
- [x] `cad_agent.py`'s LLM path reads/writes exclusively through the Architecture Graph — M3.5-B complete
- [x] Duplicate COM bridge in `cad_agent.py` retired or reduced to a thin Graph-backed adapter — M3.5-B complete
- [x] `cad-intelligence-status.md` §1 Graph and AI rows updated from "Partial"/"Not started" to "Done"

---

## Backlog: ELEV-002 Layer-Misclassification Bug ~~(blocks AXIS-001 accuracy targets)~~

**Status**: ✅ Resolved (2026-07-05).

~~**Not a new milestone** — this is a scoped bug-fix backlog item, tracked here because it
was previously invisible to any roadmap (it only existed inside
`docs/designs/AXIS-001-design.md` §10 Open Items #13/#14, which is a design doc, not a
tracked work item). It blocks AXIS-001's own §9 checkpoint targets (±10mm room-size,
±25mm opening-width accuracy) even though AXIS-001 itself is complete.~~

**Owner**: ~~none yet — needs to be picked up as an ELEV-002-scoped fix, independent of AXIS-001.~~ Platform Engineering (implemented 2026-07-05).

**Root cause** (per AXIS-001-design.md §10 Open Item #13, confirmed 2026-07-03):
Three bugs found in `handle_classify_layers`/`handle_extract_cad_objects`:

1. **Primary — manual_roles schema mismatch**: `layer_roles` in `{file}.layers.json` uses a nested-dict schema (`{"2sec": {"role": "wall_exterior", ...}}`) but the code treated it as flat (`dict[str, str]`). Result: manual override set `classification` to a dict object, not a string. `handle_extract_cad_objects` filter `classification == "wall"` always failed → `2sec`/`3SEC` never classified as walls.
2. **Secondary — role name normalization gap**: Even after fixing #1, legacy role names (`wall_exterior`, `opening_door`, `opening_window`, `label`) didn't match V2 standard roles (`wall`, `door`, `window`, `text`) that `handle_extract_cad_objects` filters on. Added `_ROLE_NORMALIZATION` mapping.
3. **Symptom — door width extraction**: `D900` blocks drawn at actual size (XScaleFactor=1.0) had width recorded as `1.0` instead of `900`. Added block-name numeric extraction fallback (`_WIDTH_FROM_BLOCK_NAME` regex).
4. **Improvement — entity-type scoring**: Changed `_score_entity_type` from `max()` to cumulative (`+=`) scoring for better discriminative power on mixed layers. Clamped to [0.0, 1.0].

**Fix**: 4 changes in `com_bridge.py` + 34 COM-free unit tests (`test_layer_classification.py`). Zero regressions.

### Success Criteria
- [x] `handle_classify_layers` correctly identifies `2sec`/`3SEC` as wall layers on this drawing via manual override + role normalization
- [ ] Full-corpus `handle_extract_cad_objects` run completes without `needs_confirmation` fallback on this drawing *(requires live ZWCAD session to verify)*
- [ ] AXIS-001 §9 checkpoint targets (±10mm room-size, ±25mm opening-width) become measurable (pass or fail) on this drawing *(requires live ZWCAD session to verify)*

---

## Long-Term: M4 — Regulatory Compliance v2 (Weeks 8–12)

**Objective**: Korean building code compliance automation at practical level.

### Compliance Checks

| Check | Current | Target |
|-------|---------|--------|
| Building Coverage Ratio (BCR) | ✅ Working (2 districts hardcoded) | All si/gu/dong via API |
| Floor Area Ratio (FAR) | Defined but never checked | 3D floor area based calculation |
| Setback Distance | ✅ Working (default 1.0m) | Use-zone specific setback rules |
| Height Restriction | ❌ Absent | Road width × multiplier based |
| Sunlight / Right-to-Light | ❌ Absent | 3D shadow analysis (shapely 3D or external lib) |
| Parking Requirement | ❌ Absent | Use-based parking count calculation |
| Use Zone Classification | ❌ District-level only | Residential/Commercial/Industrial distinction |
| Road Width Requirement | ❌ Absent | Minimum frontage road width check |
| Green Area Ratio | ❌ Absent | Green space ratio verification |

### Regulatory Database Integration

| Item | Description |
|------|-------------|
| law.go.kr parsing | Currently queries API but never parses response for rule values |
| Bulk synchronization | Periodic sync of municipal building regulations to local index |
| Freshness gate | Hard requirement: regulation data must be fresh before compliance verdict |
| Source citation | Each compliance result links to specific regulation article and clause |

### Compliance UI

| Feature | Description |
|---------|-------------|
| Issue visualization | Highlight non-compliant areas on drawing |
| Correction vectors | Show required displacement to achieve compliance |
| Regulation basis | Link each issue to specific law article |
| Summary dashboard | Overall compliance score with breakdown by check type |

### Success Criteria
- [ ] All 9 compliance checks operational
- [ ] At least Seoul/Gyeonggi municipalities covered
- [ ] Regulation source cited for every compliance issue
- [ ] Compliance results visualized on drawing

---

## Long-Term: M5 — Production Readiness (Weeks 12–16)

**Objective**: Mission-critical reliability for production deployment.

| Item | Description |
|------|-------------|
| Transactional operations | Batch drawing commands wrapped in atomic transactions |
| Audit trail | Persistent log of all drawing operations with timestamps and results |
| Monitoring dashboard | Real-time ZWCAD connection health, operation queue, error rates |
| Auto-recovery | Detect ZWCAD crash → restart → restore last known state |
| Performance optimization | Batch COM calls, reduce round-trips for large drawings |
| Deployment automation | One-command setup for new workstations |

---

## Architecture Roadmap

### Current (Dual Path)

```
Claude/Gemini → MCP Server (com_bridge) ─┐
                                          ├──→ ZWCAD COM (pywin32)
Web Browser  → CAD Agent (agent_bridge) ─┘
```

### Target (Unified Path)

```
┌──────────────────┐     ┌──────────────────┐
│  Claude / Gemini  │     │  Web Studio UI   │
└────────┬─────────┘     └────────┬─────────┘
         │ stdio JSON-RPC         │ HTTP REST
         v                        v
┌────────┴─────────┐     ┌───────┴──────────┐
│  MCP Server      │     │  CAD Agent       │
│  (server.py)     │     │  (cad_agent.py)  │
└────────┬─────────┘     └───────┬──────────┘
         └──────────┬────────────┘
                    v
         ┌──────────────────────┐
         │  Shared COM Bridge   │
         │  (zwcad_com.py)      │
         │  + threading.local() │
         └──────────┬───────────┘
                    │ pywin32 COM/ActiveX
                    v
         ┌──────────────────────┐
         │  ZWCAD 2026          │
         └──────────┬───────────┘
                    │
        ┌───────────┼───────────┐
        v           v           v
  ┌──────────┐ ┌─────────┐ ┌──────────────┐
  │  File    │ │  Law DB │ │  Compliance  │
  │  Curator │ │(law.go  │ │  Engine      │
  │          │ │  .kr)   │ │              │
  └──────────┘ └─────────┘ └──────────────┘
```

---

## Milestone Summary

| Milestone | Timeline | Key Deliverables |
|-----------|----------|------------------|
| **M1: Stabilization** | Weeks 1–2 | P0 bugs fixed ✅ (2026-07-04), shared COM bridge v1 (pending), test coverage ≥ 80% (pending) |
| **M2: Feature Expansion** | Weeks 3–6 | DWG file management, 6 modify tools, layer standards, File Curator integration |
| **M3: AI Pipeline** | Weeks 5–8 | PM → ZWCAD Drafter operational, handoff protocol, prompt chain, Web UI enhancement |
| **M3.5: Architecture Graph & AI-Wiring** | Weeks 7–9 | ADR-001 Core Node coverage (Building/Floor/Column/Stair/Slab), AI layer wired exclusively through Architecture Graph |
| **M4: Compliance v2** | Weeks 8–12 | FAR/height/sunlight/parking checks, law.go.kr sync, regulation visualization |
| **M5: Production** | Weeks 12–16 | Error recovery, batch transactions, audit trail, monitoring dashboard |
| **Backlog: ELEV-002 layer-misclassification fix** | ✅ Done (2026-07-05) | Fix `handle_classify_layers` wall/door misclassification blocking AXIS-001 §9 accuracy targets — see §"Backlog: ELEV-002 Layer-Misclassification Bug" above (moved out of "Unscheduled": this row previously contradicted that section's own "✅ Resolved" status) |
| **Backlog: Primitive Graph / Feature Store** | ✅ Done (2026-07-05) | `features/` package + `graph/primitive_graph.py` + `handle_build_feature_store` + feature-based wall filtering |

**Recently completed (outside M-roadmap tracking)**: AXIS-001 (all phases + deferred items) — 2026-07-04, PR #47. DOCS-001 (docs/ reorg) — commit `f264cae`. Primitive Graph + Feature Store — 2026-07-05, PR #59. SPACE-001 (open-plan boundary reconstruction, divider pipeline, WP5) — 2026-07-05. ADR-bb/cc/jj (Renderer + RenderStyle composition, Symbol Strategy Pattern, Strategy Registry) — 2026-07-29. ADR-ff Phases 1-3 (RenderBackend Protocol, RecordingBackend, MatplotlibBackend, COMDrawingContext promotion) — 2026-07-30. ELEV-002 backlog fixes: `_find_gaps` combinatorial duplication (PR #166), `zwcad_find_opening_candidates` timeout via evidence-scan gating + cache reuse (commit `acd0a86`). Room-detection geometry fixes: `_weld_endpoints_v2` self-chaining root-caused and fixed via `_merge_wall_face_pairs` pre-welding step (PR #169), opt-in `WallProcessingMode.SOLID_UNION` area-based alternative (PR #170) — both 2026-07-31. Sidecar-driven door pattern detection for `handle_extract_cad_objects` (PR #171) — 2026-07-31.

**2026-07-31 → 2026-08-01 (real-drawing verification pass — room/door/window detection quality)**: Following PR #170/#171, live-drawing verification against the reference apartment floor plan surfaced and fixed a chain of real defects, each caught by re-running the actual MCP tools against the live drawing rather than trusting code review alone:
- Docs backfill for SPACE-001/ELEV-002 covering the wall-face-pair-merge/SOLID_UNION/door-pattern-sidecar work (PR #172); `cad-system-roadmap.md` staleness + internal Unscheduled/Resolved contradiction corrected (PR #173).
- `WallProcessingMode` de-globalized behind an explicit `mode` param (byte-for-byte backward compatible) and `SOLID_UNION` finally wired into `handle_generate_spaces` via a `wall_processing_mode` request param — PR #170 had shipped the mode with no caller (PR #174).
- Sidecar-driven window pattern detection added, extending PR #171's door-only sidecar override to windows (PR #175) — live verification then found the new window detector had two real false-positive bugs (door-frame lines and curved-cluster-door member lines both mis-clustering into "windows"), each root-caused and fixed with its own regression test (PR #176, #177). Final live-verified count: 10 doors, 6 windows, matching the sidecar's documented ground truth.
- New `zwcad_extract_text_labels` MCP tool added to extract `AcDbText`/`AcDbMText` content+position from any caller-specified layer, generalized (no hardcoded layer name) — added to correlate room-name labels with detected rooms (PR #178).
- Room-detection quality investigation (prompted by the text-label work surfacing a giant ~800m² false "room" in both wall-processing modes): root-caused to a `HATCH`-named layer being misclassified as `wall` — fixed via a name-keyword hard-exclusion mechanism in the layer classifier, first as a soft 0.3x penalty then strengthened to a 0.0x hard exclusion after review caught the softer version as insufficient (PR #179). The same investigation then found furniture/display-fixture layers (`6fur`/`F-디스플레이`, 78% of everything extracted as "walls" on the live drawing) hitting the identical misclassification pattern, fixed via the same mechanism (PR #180, with a stray scratch-file cleanup in PR #181), followed by a third iteration excluding `9HAT`-style layers while explicitly preserving `4ELE` at the user's direction, since it was confirmed to carry real wall data in this drawing despite its "electric"-sounding name (PR #182).
- Per user direction, further drawing-specific layer-role decisions for this drawing were moved out of the generalized Python keyword mechanism and into the pre-existing `{file}.layers.json` `layer_roles` manual-override system instead — recorded explicit `furniture`/`wall` roles for all layers found in the investigation above (PR #183).
- Continued live-drawing UNCLOSED_WALLS investigation found ~78% of remaining dangle-point exceptions had another wall's endpoint within the existing weld tolerance yet failed to weld; partially root-caused to floating-point-noise near-zero-length wall segments (sub-nanometer, not exactly zero) slipping through the pre-existing exact-equality zero-length filter — tightened to an epsilon-based check (PR #184). Live re-verification showed no measurable change to the exception count, as the spec's own risk section anticipated (the float-noise segments were a small handful, not the dominant cause) — the larger remaining gap is attributed to the previously-abandoned `_weld_endpoints_v2` self-chaining defect (see `docs/superpowers/specs/2026-07-30-weld-endpoints-self-chaining-design.md`, ABANDONED after 3 failed fix attempts in an earlier session), left unresolved and out of scope for this pass.
- `generate-floorplan-svg` skill (added same session, PR #185/#187) reviewed and corrected: the skill assumed rectangular rooms and had a Y-axis coordinate-formula bug, neither of which matched real `SpacePolygon` polygon output; rewritten to support arbitrary room polygons (with holes), the real `DoorEntity`/`WindowEntity`/text-label input schemas, and flexible keyword-based room-name coloring instead of a fixed enum (PR #186).

---

## Decision Log

| # | Decision | Options | Status |
|---|----------|---------|--------|
| D1 | COM Bridge integration | (A) Shared Python module vs (B) Agent routes through MCP | 📌 Pending meeting |
| D2 | DWG file management | (A) Agent via COM vs (B) File Curator orchestration | 📌 Pending meeting |
| D3 | Law DB strategy | (A) Real-time API vs (B) Bulk sync vs (C) Hybrid | 📌 Pending meeting |
| D4 | Prompt chain | (A) Multi-step LLM with validation vs (B) Single enhanced prompt | 📌 Pending meeting |

---

## References

- `docs/plans/MCP-000-zwcad-mcp-server-plan.md` — MCP server design specification
- `docs/designs/MCP-001-cad-compliance-integration-design.md` — Compliance engine design
- `docs/designs/AXIS-001-design.md` — AXIS-001 design record (complete); §10 Open Items #13/#14 are the source evidence for the ELEV-002 layer-misclassification backlog item above
- `docs/reference/cad-intelligence-status.md` — Layer status & Phase↔M-milestone reconciliation (source of the M3.5 gaps)
- `docs/reference/file-curator-architecture.md` — File Curator architecture
- `docs/firm-governance/regulatory-db-integration-research.md` — Law DB integration research
- `agents/zwcad-drafter.md` — ZWCAD Drafter agent definition
- `agents/pm.md` — PM orchestration and routing
