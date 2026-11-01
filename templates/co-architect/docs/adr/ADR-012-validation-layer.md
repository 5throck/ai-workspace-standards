# ADR-012: Validation Layer — Server-Side Input Validation

**Status**: Accepted
**Date**: 2026-07-12
**Related**: ADR-010 (ToolRegistry), ADR-011 (HandlerResult), ADR-013 (COM Handler Migration)

---

## Context

After the ToolRegistry migration (ADR-010), 9 registered COM-free handlers declare JSON Schema `inputSchema` via `@register_tool`, but **no runtime validation** occurs against these schemas. The schemas are purely informational — sent to MCP clients via `tools/list` for IDE/UX support.

**Note**: ADR-013 (completed 2026-07-12) migrated all 57 handlers to the registry, so validation now applies to all handlers — not just the original 9 COM-free ones.

Current state:

- `_ERR_INVALID_PARAMS = -32602` is defined in `server.py` but **never used** (dead code)
- `deserialize_entities()` in `handlers/common.py` calls `model.from_dict()` without wrapping errors — raw `KeyError`/`TypeError`/`ValueError` propagate as generic `-32000` errors
- No type checking, no required-field validation at the dispatch level
- `jsonschema` library is NOT a dependency — and should not be added for this scope

## Decision

### Design: Minimal hand-rolled validator

Validate only 3 JSON Schema features actually used by the 9 registered handlers:

1. **`required`** — missing required fields
2. **`type`** (primitives only) — wrong type for known fields
3. **`enum`** — value not in allowed set

### `ValidationIssue` — frozen dataclass

```python
@dataclass(frozen=True)
class ValidationIssue:
    code: str       # "missing_required" | "wrong_type" | "invalid_enum" | "deserialization_error"
    path: str       # e.g. "walls", "walls[3]", "num_floors"
    message: str    # human-readable description
```

**String codes are intentionally used to keep transport payload simple.** A future `ValidationCode` StrEnum is possible but not warranted for 4 codes.

### `ValidationError` — exception for transport

Wraps a list of `ValidationIssue` objects. Used by both `validate_params()` and hardened `deserialize_entities()`.

### Open Schema by design

Unknown properties in `params` are silently ignored. `additionalProperties: false` is **intentionally NOT enforced**. Rationale:

- MCP clients may send extra properties for forward compatibility
- Adding validation for unknown properties would break forward-compatible clients
- The `tools/list` response already declares the expected schema — clients that care will follow it

### Why hand-rolled instead of `jsonschema`

The 9 registered schemas use only 3 features (`required`, `type`, `enum`). Adding `jsonschema` (+transitive deps, ~2MB) for 3 checks is over-engineering.

### Pipeline position

```
Registry → Dispatch → Validation → Deserialization → Handler → HandlerResult → Normalization → MCP Response
```

Validation runs BEFORE handler invocation and BEFORE deserialization. This catches bad input before any processing.

### Deserialization errors

`deserialize_entities()` errors are surfaced through `ValidationError` for **transport consistency**, although they occur **after schema validation**. This ensures all input errors reach the MCP client through the same `-32602` error channel, regardless of whether they're schema violations or deserialization failures.

### Server dispatch

`_ERR_INVALID_PARAMS` (-32602) — previously dead code — is now activated in the registry-first dispatch path.

## Future Extensions

Not supported in this iteration (each would require an ADR update):

- `items` — array item schema validation
- `minimum` / `maximum` — numeric range validation
- `oneOf` / `allOf` / `anyOf` — complex composition
- `additionalProperties` — strict schema mode
- Nested `type: "object"` — recursive validation
- `$ref`, `pattern`, `format`

## Consequences

### Positive

- Invalid input caught early with structured error messages
- `_ERR_INVALID_PARAMS` finally activated (JSON-RPC spec compliance)
- Deserialization errors get structured context (entity path, field name)
- Zero new dependencies

### Negative

- Hand-rolled validator may need extension if schema complexity grows
- ~~Only registry-first dispatch path is validated; fallback path unchanged~~ → After ADR-013, only the registry dispatch path exists (PATH B removed)

### Risks

- Validators too strict could reject valid client input — mitigated by limiting to `required` + `type` + `enum` only
- `additionalProperties:false` not enforced — mitigated by explicit ADR documentation
