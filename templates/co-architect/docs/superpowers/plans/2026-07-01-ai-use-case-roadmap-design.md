# AI Use Case Implementation Roadmap for Domestic CAD-Centric Architecture Market

> **Status**: Approved
> **Created**: 2026-07-01
> **Scope**: 5 AI use cases mapped to existing M1–M5 milestones (16 weeks)
> **Reference**: `docs/reference/cad-system-roadmap.md`, `docs/firm-governance/agent-team-implementation-roadmap.md`

---

## Executive Summary

This roadmap maps the 5 most promising AI use cases for the domestic CAD-centric architecture market to the existing M1–M5 milestone framework (16 weeks). It identifies current implementation gaps, prioritizes work by value and dependency, and defines new design documents needed for features not covered in the original roadmap.

### Current Implementation Status (Baseline)

| # | AI Use Case | Current Level | Core Gap |
|---|------------|---------------|----------|
| 1 | Drawing Semantic Analysis | ★★★★☆ (85%) | Open-plan boundary detection (Phase 2 placeholder) |
| 2 | Repetitive Drawing Generation | ★★★★☆ (implemented) | Section (`zwcad_generate_section`, `src/cad_intelligence/cad_io/handlers/section.py:109`) and ceiling/RCP (`zwcad_generate_rcp`, `src/cad_intelligence/cad_io/handlers/ceiling.py:104`) plans are implemented — see `src/cad_intelligence/section/` and `src/cad_intelligence/ceiling/{model,builder,exporter}.py`, with golden tests in `tests/golden/ceiling/` |
| 3 | Drawing Review | ★★★★☆ (75%) | Review/QA Agent at design stage only |
| 4 | Design Support (NL→CAD) | ★★★★☆ (80%) | P0 bugs, COM bridge duplication |
| 5 | Document Automation | ★☆☆☆☆ (15%) | Output/export layer entirely missing |

---

## Short-Term (Weeks 1–4) — M1 Stabilization + M2 Early

**Objective**: Stabilize existing features for reliability; complete near-complete features.

### 1. Drawing Semantic Analysis — Completion (85% → 95%)

| Item | Work | Milestone |
|------|------|-----------|
| Open-plan boundary detection | Implement `_detect_open_plan_boundaries` (currently placeholder) | M1 |
| Layer mapping expansion | Add general architecture / commercial Layer rules beyond apartment standard | M1 |
| Classification accuracy tests | Integration test suite using real DWG files | M1 |

### 2. Design Support (NL→CAD) — Reliability (80% → 95%)

| Item | Work | Milestone |
|------|------|-----------|
| P0 bug fixes | Undo marker (`StartUndoMark`), `AddText`/`AddMText` mismatch | M1 |
| COM Bridge consolidation | `cad_agent.py` ↔ `com_bridge.py` dual implementation → `zwcad_com.py` unified module | M1 |
| Prompt Chain improvement | Add step-by-step examples, document missing params (layer, color, rotation) | M1–M2 |
| Input validation unification | MCP-level coordinate bounds / type checks applied to Agent path | M1 |

### 3. Drawing Review — Engine Stabilization

| Item | Work | Milestone |
|------|------|-----------|
| 9-check compliance tests | Unit / integration test expansion for `compliance.py` | M1 |
| Correction vector validation | Verify setback auto-correction Undo guard | M1 |
| Error handling | Agent methods return `None` → raise explicit exceptions | M1 |

### Short-Term Success Criteria

- [ ] Zero P0 bugs in production
- [ ] Single shared COM bridge module used by both MCP and Agent
- [ ] Consistent behavior across MCP and HTTP paths
- [ ] Test coverage ≥ 80% for bridge module
- [ ] All LLM-generated code examples execute without errors

---

## Mid-Term (Weeks 5–8) — M2 Completion + M3 AI Pipeline

**Objective**: Complete the practical drawing production cycle with auto-generation; operationalize the PM → ZWCAD Drafter workflow.

### 2. Repetitive Drawing Generation — Section Plan v1 (50% → 70%)

| Item | Work | Milestone |
|------|------|-----------|
| DWG file management | Save / SaveAs / Open / New / Template MCP tools | M2 |
| 6 Modify Tools | Move, Copy, Rotate, Delete, Offset, Mirror MCP tools | M2 |
| **Section plan auto-generation v1** | Floor plan Wall model → Section Cut Line based section drawing (new design doc required) | M2–M3 |
| Elevation v2 stabilization | ELEV-002 wall-centric pipeline bug fixes and testing | M2 |
| File Curator integration | DWG save triggers auto-backup / version management | M2 |

### 3. Drawing Review — LLM Validation Chain + Review Agent Design

| Item | Work | Milestone |
|------|------|-----------|
| 4-Step Prompt Chain production | INTERPRET → GENERATE → VALIDATE → EXECUTE productionized | M3 |
| PM → ZWCAD Drafter routing | Engineering Team formally registered in PM dispatch table | M3 |
| Web UI enhancement | Drawing sheet management, Layer toggle, entity selection, Undo/Redo | M3 |
| **Review Agent design spec** | Agent spec for drawing omission / conflict / inconsistency review (design only) | M3 |
| SketchUp → ZWCAD handoff | .skp → .dwg export + COM bridge auto-load | M3 |

### 4. Design Support — Workflow Completion

| Item | Work | Milestone |
|------|------|-----------|
| Auto error recovery | Batch state snapshot + partial rollback on failure | M3 |
| Multi-step Undo/Redo | Atomic transactions for multi-step drawing operations | M3 |

### Mid-Term Success Criteria

- [ ] Floor plan → elevation → section auto-generation chain operational
- [ ] Full DWG file lifecycle (create → edit → save → open)
- [ ] 6 modify tools available via MCP and HTTP
- [ ] End-to-end: user request → PM → ZWCAD Drafter → .dwg output
- [ ] Undo/redo works for multi-step drawing operations

---

## Long-Term (Weeks 9–16) — M4 Compliance v2 + M5 Production

**Objective**: Production-ready drawing review automation; first document automation features.

### 3. Drawing Review — Review Agent + QA Agent (75% → 95%)

| Item | Work | Milestone |
|------|------|-----------|
| **Review Agent implementation** | Drawing omission / inconsistency / design coherence review (within 5-Agent pipeline) | M4 |
| **QA Agent implementation** | Automated compliance checklist + traceability matrix (requirements → regulations → design elements) | M4 |
| **Regulation freshness gate** | `law.go.kr` change-history API vs local store — mandatory before every QA verdict | M4 |
| Law DB bulk sync | Public Data Portal Open API → local indexed store periodic sync | M4 |
| Compliance UI | Non-compliant area highlighting on drawing, regulation article links, dashboard | M4 |
| Compliance expansion | BCR / FAR all-region API, 3D floor-area-based calculation | M4 |

### 5. Document Automation — New Implementation (15% → 60%)

| Item | Work | Milestone |
|------|------|-----------|
| **Finish Schedule generator** | Wall.finish + Room.ceiling → table output (Excel/CSV) | M4–M5 |
| **Door/Window Schedule generator** | Door.type/frame_spec + Window.sill/head → table output | M4–M5 |
| **Quantity takeoff v1** | Wall length summation, floor area summation, opening area deduction | M5 |
| MCP tool exposure | `zwcad_export_schedule`, `zwcad_export_takeoff` | M5 |
| excel_sync.py expansion | Current room area → wall/door/window schedule data | M5 |

### 2. Repetitive Drawing Generation — Ceiling Plan + Elevation Enhancement

| Item | Work | Milestone |
|------|------|-----------|
| **Ceiling plan auto-generation** | Room.ceiling + lighting / HVAC layout basic generation | M5 |
| Elevation material hatch enhancement | wall_model finish data → actual finish pattern application | M5 |

### Production Readiness

| Item | Work | Milestone |
|------|------|-----------|
| Monitoring dashboard | Real-time ZWCAD connection health, operation queue, error rates | M5 |
| Deployment automation | One-command setup for new workstations | M5 |
| Audit trail enhancement | Persistent log of all drawing operations + query interface | M5 |

### Long-Term Success Criteria

- [ ] Review Agent + QA Agent automated drawing review operational
- [ ] Finish schedule / Door-Window schedule auto-generation from drawing data
- [ ] 9 compliance checks operational across all regions (Seoul/Gyeonggi minimum)
- [ ] Regulation source cited for every compliance issue
- [ ] Compliance results visualized on drawing

---

## Milestone Summary

| Milestone | Timeline | Key Deliverables |
|-----------|----------|------------------|
| **M1: Stabilization** | Weeks 1–2 | P0 bugs fixed, shared COM bridge v1, test coverage ≥ 80% |
| **M2: Feature Expansion** | Weeks 3–6 | DWG file management, 6 modify tools, layer standards, File Curator integration, Section plan v1 design |
| **M3: AI Pipeline** | Weeks 5–8 | PM → ZWCAD Drafter operational, handoff protocol, prompt chain, Web UI, Review Agent design |
| **M4: Compliance v2** | Weeks 8–12 | Review/QA Agent implementation, law DB sync, regulation visualization, Schedule generators |
| **M5: Production** | Weeks 12–16 | Ceiling plan, quantity takeoff, error recovery, monitoring dashboard, deployment automation |

---

## Per-Use-Case Milestone Mapping

| AI Use Case | Short-Term (W1–4) | Mid-Term (W5–8) | Long-Term (W9–16) | Final Target |
|------------|-------------------|-----------------|-------------------|-------------|
| 1. Drawing Semantic Analysis | Open-plan detection, Layer expansion | — | — | **95%** |
| 2. Repetitive Drawing Generation | — | Section plan v1, Modify Tools | Ceiling plan, Elevation enhancement | **80%** |
| 3. Drawing Review | Compliance stabilization | Prompt Chain, Review design | Review/QA Agent, Law DB | **95%** |
| 4. Design Support (NL→CAD) | P0 fix, Bridge consolidation | PM→Drafter workflow | Error recovery enhancement | **95%** |
| 5. Document Automation | — | — | Finish schedule, Door/Window schedule, Takeoff v1 | **60%** |

---

## New Design Documents Required

Items not covered in the existing M1–M5 roadmap require separate design specifications before implementation:

| New Item | Design Document | Due By |
|----------|----------------|--------|
| Section plan auto-generation | `docs/designs/SECT-001-design.md` | Before M2 |
| Ceiling plan auto-generation | `docs/designs/CEIL-001-design.md` | Before M5 |
| Finish / Door-Window schedule generation | `docs/designs/SCHED-001-design.md` | Before M4 |
| Quantity takeoff | `docs/designs/TAKEOFF-001-design.md` | Before M5 |
| Review Agent | `docs/designs/REVIEW-AGENT-001-design.md` | Before M3 |

---

## Priority Rationale

### Why Document Automation Last?

The data foundation (Wall.finish, Door.frame_spec, Room.ceiling) already exists via ELEV-002 models. However, schedule generation is a **presentation/export** problem — it requires format decisions (Excel layout, column order, summary rows) that are best defined after the drawing generation pipeline is stable. Building on a solid foundation reduces rework.

### Why Section Plan Before Ceiling Plan?

Section plans derive directly from the existing Wall-centric data model (cut through walls → section view). Ceiling plans require additional data (lighting layouts, HVAC rough-in, reflected ceiling patterns) that doesn't yet exist in the model. Section plans are therefore a lower-risk first step.

### Why Review Agent Before QA Agent?

The Review Agent identifies *what* is wrong (omissions, conflicts, inconsistencies). The QA Agent verifies *compliance* against regulatory requirements. Review outputs feed into QA inputs — the dependency is unidirectional and must be respected.

---

## Decision Log

| # | Decision | Options | Status |
|---|----------|---------|--------|
| R1 | Timeline framework | (A) M1–M5 16-week | ✅ Selected |
| R2 | Document automation scope | (A) Finish schedule + Door/Window only vs (B) Full BOM | ✅ (A) — expand in post-M5 |
| R3 | Section plan approach | ~~TBD — requires SECT-001 design doc~~ | ✅ Resolved — `docs/designs/SECT-001-design.md` exists; handler live (`zwcad_generate_section`) |
| R4 | Schedule output format | (A) Excel only vs (B) Excel + CSV vs (C) Multi-format | 📌 Pending design |
| R5 | Review Agent implementation | ~~TBD — requires REVIEW-AGENT-001 design doc~~ | ✅ Implemented at handler level — `zwcad_review_drawing` registered in `src/cad_intelligence/cad_io/handlers/review.py:152` with `_resolve_llm_reviewer` |

---

## References

- `docs/reference/cad-system-roadmap.md` — M1–M5 milestone definitions
- `docs/firm-governance/agent-team-implementation-roadmap.md` — 6-month 5-Agent pipeline roadmap
- `docs/designs/MCP-001-cad-compliance-integration-design.md` — Compliance engine architecture
- `docs/firm-governance/regulatory-db-integration-research.md` — Law DB integration research
- `docs/designs/ELEV-002-design.md` — Wall-centric elevation v2 design
- `src/cad_intelligence/common/models.py` — ELEV-002 data model (Wall, Door, Window, Room)
- `src/cad_intelligence/geometry/wall_model.py` — Room-extra merge logic
- `src/cad_intelligence/plugins/compliance.py` — 9-check compliance engine
- `src/cad_intelligence/geometry/space_geometry.py` — Room polygon detection
- `src/cad_intelligence/semantic/space_mapping.py` — Room info matching
- `src/agent/cad_agent.py` — NL→CAD prompt chain engine
- `src/parser/excel_sync.py` — Room area SQLite parser
