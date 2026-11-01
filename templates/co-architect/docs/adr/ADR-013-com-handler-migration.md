# ADR-013: COM-Dependent Handler Migration Architecture

**Status**: Accepted — Implemented
**Date**: 2026-07-12
**Completed**: 2026-07-12
**Supersedes**: POSTMORTEM-010 § Remaining Work (Future: COM-dependent tool migration)
**Related**: ADR-010 (ToolRegistry), ADR-011 (HandlerResult), ADR-012 (Validation Layer)

---

## Context

After ADR-010 (ToolRegistry) and ADR-011 (HandlerResult) established a standardized handler contract for all 11 COM-free handlers, 52 COM-dependent handlers remained on a legacy dispatch path with inconsistent response formats.

### Before Migration

| Component | COM-free (11 handlers) | COM-dependent (52 handlers) |
|-----------|------------------------|-----------------------------|
| Registration | `@register_tool` in `ToolRegistry` | `_V3_HANDLER_MAP` via `dir()` introspection |
| Dispatch | PATH A: registry-first | PATH B: `_TOOL_DISPATCH` fallback |
| Response type | `HandlerResult` (frozen dataclass) | Raw `dict` (3 inconsistent patterns) |
| `_normalize_handler_result()` | Called | **Not called** |
| Input validation | ADR-012 server-side | None |

### After Migration (Current State)

All 57 handlers (11 COM-free + 46 COM-dependent across 12 handler modules) are registered in the ToolRegistry and return `HandlerResult`. PATH B has been eliminated.

| Component | All 57 handlers |
|-----------|-----------------|
| Registration | `@register_tool` in `ToolRegistry` |
| Dispatch | PATH A only: `registry.get_handler(name)` → callable |
| Response type | `HandlerResult` (frozen dataclass) |
| `_normalize_handler_result()` | Called for all |
| Input validation | ADR-012 server-side (for all registered tools) |

### Problems (All Resolved)

1. ~~**Two dispatch paths**: PATH B bypasses `_normalize_handler_result()`~~ → **Resolved**: PATH B removed; single registry dispatch.
2. ~~**Response inconsistency**: COM handlers use 3 different return patterns~~ → **Resolved**: All handlers return `HandlerResult`.
3. ~~**~1100 lines of dead metadata**: `_TOOLS_LIST` in `server.py` duplicates tool definitions~~ → **Resolved**: `_TOOLS_LIST` (14 entries, ~370 lines), `_TOOL_DISPATCH` (14 entries), `_V3_HANDLER_MAP`, and `_V3_HANDLERS_AVAILABLE` deleted.
4. ~~**No validation**: COM handler parameters are not validated~~ → **Resolved**: ADR-012 validation applies to all registered tools automatically.

---

## Architecture Principles

### P1: Import Independence

Handler registration shall not require a COM runtime. Modules containing COM handlers must remain importable when pywin32 is unavailable. COM availability is checked only immediately before handler execution.

### P2: Exception vs. HandlerResult Boundary

`HandlerResult.error()` represents expected business-level failures that should be returned to the client as normal JSON results (e.g., missing required parameter, invalid file path). Unexpected infrastructure failures (COM disconnection, RPC failure, COM exceptions, programming errors) continue to propagate as exceptions — caught by the server dispatch layer and mapped to JSON-RPC error codes.

`HandlerResult.error()` shall be used only when the handler intentionally returns a recoverable tool result. Any condition that previously propagated as an exception shall continue to propagate as an exception.

### P3: Single Handler Contract

Every public MCP tool, regardless of whether it depends on COM, shall:

- Be registered in the Tool Registry;
- Return `HandlerResult` for successful execution and business-level failures;
- Produce a normalized JSON response consistent with the HandlerResult contract;
- Rely on exception propagation for infrastructure failures;
- Be dispatched exclusively through the registry pipeline.

This principle connects ADR-010 (Registry), ADR-011 (HandlerResult), and ADR-013 (COM migration) into a unified contract.

---

## Decision

Migrate all 57 COM-dependent handlers to the registry + HandlerResult pattern, then eliminate the legacy dispatch path. **All phases complete.**

### 1. Unified Dispatch — Eliminate PATH B ✅

**Was**: Two parallel dispatch paths in `server.py`:

- **PATH A** (registry-first): `_tool_registry.get_handler(name)` → `_normalize_handler_result()`. Used by 11 COM-free handlers.
- **PATH B** (`_TOOL_DISPATCH` fallback): `_TOOL_DISPATCH[name]` → `_V3_HANDLER_MAP[handler_name]`. Used by 52 COM handlers. `_normalize_handler_result()` was **not called**.

**Now**: All 57 handlers go through PATH A. Registry is the single source of truth.

**Removal criteria for PATH B** (all met ✅):

1. ✅ Every public handler is registered in the registry with `requires_com` set appropriately.
2. ✅ `tools/list` is generated entirely from `_tool_registry.tools_list()`.
3. ✅ No production code or test references `_TOOL_DISPATCH`, `_V3_HANDLER_MAP`, or `_TOOLS_LIST`.

### 2. Handler Registration Pattern

COM handlers register with `@register_tool(requires_com=True)`:

```python
from cad_intelligence.cad_io.handlers.common import HandlerResult
from cad_intelligence.cad_io.registry import default_registry, register_tool

@register_tool(default_registry, name="zwcad_draw_line",
               description="...", input_schema=_SCHEMA, requires_com=True)
def handle_draw_line(params: dict) -> HandlerResult:
    # ... validation raises BoundaryViolationError ...
    # ... COM operations raise ZWCADConnectionError on failure ...
    bridge = _get_bridge()
    doc = bridge.app.ActiveDocument
    # ...
    return HandlerResult.success(
        handle=str(line.Handle),
        entity_type="LINE",
        layer=layer_name,
    )
```

Factory methods accept arbitrary `**payload`; domain-specific keys are merged into the top-level result via `HandlerResult.as_dict()`.

### 3. HandlerResult Migration — Return Pattern Mapping

| Current Pattern | Example (code-verified) | Target |
|-----------------|------------------------|--------|
| Status dict: `{"status": "success", "handle": "..."}` | `handle_draw_line` | `HandlerResult.success(handle=...)` |
| No status: `{"layers": [...]}` | `handle_list_layers` | `HandlerResult.success(layers=[...])` |
| Error dict: `{"error": "..."}` | `handle_execute_batch` validation | `HandlerResult.error("...", error="...")` |
| Minimal success: `{"status": "success"}` | `handle_start_undo_marker` (line 1015), `handle_end_undo_marker` (line 1025), `handle_close_drawing` (line 1223) | `HandlerResult.success()` |
| Exception: `raise ZWCADConnectionError(...)` | All COM failures | **Unchanged** — exception propagation |

### 4. `_TOOLS_LIST` Deletion ✅

The static tool definition table in `server.py` (14 entries remaining after P1, ~370 lines) has been removed. `tools/list` is now generated entirely from `_tool_registry.tools_list()`.

### 5. Phased Migration

| Phase | Scope | Handlers | Status |
|-------|-------|----------|--------|
| P1 | `drawing.py` | 33 (draw primitives + entity ops + file ops + batch) | **✅ COMPLETE** — All 33 registered; `handle_draw_line` reference migration validated; tests green (3397 passed); `TestDrawingToolRegistration` completeness test added |
| P2 | `space.py` | 13 (analysis + extraction pipeline) | **✅ COMPLETE** — All 13 registered with `@register_tool` + stub guards + schema/description constants; 14 return statements → `HandlerResult`; 26 auto-chain `.get()` → `.data.get()`; `TestSpaceToolRegistration` added; tests green (3398 passed) |
| P3 | `compliance.py` | 1 (compliance check) | **✅ COMPLETE** — Registered with `@register_tool` + `HandlerResult`; `TestComplianceToolRegistration` added; tests green |
| P4 | Cleanup | `server.py` | **✅ COMPLETE** — `_TOOLS_LIST` (14 entries, ~370 lines) + `_TOOL_DISPATCH` (14 entries) + `_V3_HANDLER_MAP` + `_V3_HANDLERS_AVAILABLE` deleted; `_handle_tools_list` registry-only; PATH B fallback removed from `_handle_tools_call` (~90 lines); `_mock_v3_handler` removed; `test_not_in_tool_dispatch` removed; `TestRegistryCompleteness` gate added; tests green (3398 passed) |

### 6. Risks

| Risk | Mitigation |
|------|-----------|
| pywin32 import failure at module load breaks registration | **Principle P1**: registration must not require COM runtime. Guard pattern: `try: import pywin32; ... except ImportError: _PYWIN32_AVAILABLE = False`. Registration at module level (unconditional); handler body (conditional on `_PYWIN32_AVAILABLE`). |
| Behavior drift caused by normalization | Existing COM handlers return raw dicts. After migration: `HandlerResult` → `as_dict()` → `json.dumps()`. **Mitigation**: Golden JSON snapshot tests before and after migration for each handler. Compare wire-level output. |
| COM error semantics change | **Principle P2**: exception-based flow unchanged. Server catches same exceptions, maps to same JSON-RPC codes. `HandlerResult.error()` used only for intentionally recoverable results. |
| Missing registry registration leaves tool unreachable | Registry completeness test verifying every public tool name is registered exactly once. |
| `_TOOLS_LIST` premature deletion | **Decision 4**: Deletion only after registry completeness verified. |

---

## Consequences

### Positive

- Single dispatch path (PATH A only) — simpler, more maintainable server.py.
- All 57 handlers share the same contract (Registry + HandlerResult).
- ADR-012 validation applies to COM handlers automatically once registered.
- ~470 lines of static tool metadata deleted from server.py (`_TOOLS_LIST` + `_TOOL_DISPATCH` + `_V3_HANDLER_MAP` builder).
- `_normalize_handler_result()` called for all handlers — no asymmetry.

### Negative

- COM handlers must be imported unconditionally (registration at module level), even on non-Windows platforms — handler body stays guarded.
- Migration touched 57 handlers across 12 files — risk of behavior drift (mitigated by 3398-pass test suite).
- `handle_execute_batch` calls sibling handlers directly (not through MCP dispatch) — must return `HandlerResult` and be unwrapped via `.as_dict()` at the batch call site.

---

## Future Work

- Consider `Mapping[str, Any]` → typed `data` per handler for stronger contracts (ADR-011 Future Work).
- Move reserved key check from `as_dict()` to `__post_init__`/factory for earlier failure detection (ADR-011 Future Work).
- Import-time → plugin discovery via `entry_points` (ADR-010 migration path) — not needed until `plugins/` directory introduced.
