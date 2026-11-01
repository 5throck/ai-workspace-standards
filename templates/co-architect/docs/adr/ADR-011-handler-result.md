# ADR-011: HandlerResult — Standardized Response Envelope

**Status**: Accepted
**Date**: 2026-07-12
**Supersedes**: MCP-000 § Response Format (partial)
**Related**: ADR-010 (ToolRegistry), ADR-012 (Validation Layer)

---

## Context

After the ToolRegistry migration (ADR-010), the 9 registered COM-free handlers each return a `dict` with different key sets:

| Handler | Success keys | Status values |
|---------|-------------|---------------|
| facade | `status`, `export_path`, `warnings` | `success`, `error` |
| section | `status`, `section_entities`, `cut_intersections`, `exceptions` | `success`, `error` |
| schedule | `status`, `file_path`, `summary`, `row_count`, `exceptions` | `success`, `needs_confirmation`, `error` |
| takeoff | `status`, `file_path`, `summary`, `exceptions` | `success`, `needs_confirmation`, `error` |
| ceiling | `status`, `ceiling_zones`, `ceiling_entities`, `fixture_count`, `exceptions` | `success`, `error` |
| closed_loop | `status`, `proposals`, `results`, `summary` | `proposed`, `completed`, `partial` |
| review | `status`, `report` | `success` |
| telemetry | *(no status key)* | *(uses `"error": "..."` key instead)* |
| workflow | *(delegated to `WorkflowResult.to_dict()`)* | *(varies)* |

Problems:

1. **Error handling inconsistency**: 3 different `_error_result()` implementations, 4 handlers with no try/except, some use `{"error": "..."}` instead of `{"status": "error"}`.
2. **No shared response contract**: Consumers must know each handler's key layout.
3. **Status values are untyped strings**: Typos like `"succes"` would silently propagate.
4. **Error vs. warning unclear**: Some handlers use `exceptions` for non-fatal issues, others don't.

## Decision

Introduce `HandlerResult` — a frozen dataclass that serves as the standardized response envelope for all registered handlers.

### Design

```python
@dataclass(frozen=True)
class HandlerResult:
    status: HandlerStatus          # StrEnum: SUCCESS | ERROR | NEEDS_CONFIRMATION | ...
    data: Mapping[str, Any]        # Flat dict → public interface; MappingProxyType inside
    exceptions: tuple[str, ...]    # Non-fatal warnings / issues
```

### Key Properties

**1. Flat envelope via `as_dict()`**

`HandlerResult` produces a flat dict on `as_dict()`: `{"status": ..., <data keys...>, "exceptions": [...]}`. Domain payload keys are merged at the top level. This preserves backward compatibility — existing client parsers that expect `result["export_path"]` continue to work.

**2. Shallow immutability**

`HandlerResult` guarantees **shallow immutability** of the response envelope. `data` is wrapped in `MappingProxyType` and `exceptions` is a `tuple`. Nested payload objects (e.g., `report: {"issues": [...]}`) remain mutable by design — deep freeze is intentionally omitted because:
- MCP payloads are JSON-serialized immediately after construction
- Deep freeze requires recursive copying, adding complexity for no runtime benefit
- The primary goal is preventing accidental mutation of the envelope structure

**3. `HandlerStatus` as `StrEnum`**

```python
class HandlerStatus(StrEnum):
    SUCCESS = "success"
    ERROR = "error"
    NEEDS_CONFIRMATION = "needs_confirmation"
    PROPOSED = "proposed"
    COMPLETED = "completed"
    PARTIAL = "partial"
```

Benefits: IDE autocomplete, typo prevention, centralized management. Backward compatible: `HandlerStatus.SUCCESS == "success"` evaluates to `True`.

**4. Factory methods with explicit `exceptions` parameter**

All factories accept `exceptions: Sequence[str] = ()` as an explicit keyword argument:

```python
HandlerResult.success(file_path=..., exceptions=["warning"])
HandlerResult.error("msg", export_path="", warnings=[])
```

The `exceptions` parameter is never part of `**payload` — this prevents collision with `as_dict()`'s `"exceptions"` key guard.

**5. `safe_status()` — removed**

~~`safe_status()` was a transitional helper for converting raw status strings to `HandlerStatus`.~~

**Removed** in PR #111. All orchestrators (`CeilingExporter`, `WorkflowResult`) now return `HandlerStatus`-compliant values directly. Handlers use `HandlerStatus(result.status)` instead.

This was the last remaining transitional helper from the migration period.

**6. `_normalize_handler_result()` — single extension point**

In `server.py`, a dedicated function normalizes handler return values:

```python
def _normalize_handler_result(result: Any) -> dict[str, Any]:
    if isinstance(result, HandlerResult):
        return result.as_dict()
    if isinstance(result, dict):
        return result
    raise TypeError(f"Handler returned {type(result).__name__}, ...")
```

This is the single point where future result types (`WorkflowResult`, `TelemetryResult`) can be added.

### Pipeline Position

```
Registry → Dispatch → Validation → Deserialization → Handler → HandlerResult → Normalization → MCP Response
```

`HandlerResult` is internal to the server. The MCP wire format remains unchanged — `server.py` calls `as_dict()` then `json.dumps()`.

## Migration Scope

**Migrated (7 handlers)**: facade, section, schedule, takeoff, ceiling, closed_loop, review

**Not migrated (2 handlers)** — intentional deferral with documented reason:
- `telemetry.py`: Returns 3 different shapes depending on `mode` parameter. No single response contract. Requires response type redesign.
- `workflow.py`: Delegates to `WorkflowResult.to_dict()`. Requires WorkflowResult refactoring.

Both marked with:
```python
# TODO(ADR-011): migrate to HandlerResult.
# Reason: No single response contract today — returns 3 different shapes
# depending on `mode` parameter. Requires response type redesign.
```

## Consequences

### Positive
- Standardized error handling across all migrated handlers
- Type-safe status values via `HandlerStatus` enum
- Immutability prevents accidental response mutation
- `_normalize_handler_result()` provides a clean extension point
- Backward compatible: `as_dict()` produces identical flat dict structure

### Negative
- Handlers returning `HandlerResult` cannot be called directly without `as_dict()` by code expecting plain dicts (mitigated by updating tests)
- Shallow immutability means nested payload objects are technically mutable (accepted trade-off — see above)

### Risks
- Shallow immutability means nested payload objects are technically mutable (accepted trade-off — see above)

## Future Work

- Consider `Mapping[str, Any]` → typed `data` per handler (e.g., `FacadePayload` dataclass) for stronger contracts
- Move reserved key check (`"status"`, `"exceptions"`) from `as_dict()` to `__post_init__`/factory for earlier failure detection
- ~~COM-dependent handler migration (52 handlers in drawing.py, space.py, compliance.py) — blocked on COM bridge architecture~~ → **Completed via ADR-013** (2026-07-12): all 57 handlers across 12 modules migrated to `@register_tool` + `HandlerResult`
