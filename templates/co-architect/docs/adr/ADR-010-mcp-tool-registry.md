# ADR-010: MCP Tool Registry

## Status
Accepted

## Context

**Before ADR-013**: Adding a new MCP tool required editing 4 locations in server.py:
1. Handler module import
2. Auto-discovery introspection (dir() scan)
3. _TOOLS_LIST (tool definition dict)
4. _TOOL_DISPATCH (str→str name mapping)

Dispatch was 3-hop: _TOOL_DISPATCH → _V3_HANDLER_MAP → callable.

**After ADR-013** (completed 2026-07-12): All 57 handlers are registered via `@register_tool`. `_TOOLS_LIST`, `_TOOL_DISPATCH`, and `_V3_HANDLER_MAP` have been deleted. Dispatch is 1-hop: `registry.get_handler(name)` → callable.

## Decision
Introduce `ToolRegistry` with `@register_tool` decorator:
- Handlers declare their own metadata (name, description, schema, status)
- Registry stores ToolDefinition (frozen dataclass) with handler callable
- Direct 1-hop dispatch: registry.get_handler(name) → callable
- Validation at registration: name prefix, callable, schema type, status enum
- Status field with real behavior: "deprecated" emits DeprecationWarning
- Defensive copy: deep copy at register() AND at tools_list()

### Status field: Project extension metadata
The `status` field in `tools_list()` output is **NOT part of the standard MCP
tools/list response**. It is project extension metadata for internal tooling
(filtering, audit, lifecycle tracking). Standard MCP clients will ignore this
field.

## Consequences
- Adding a new tool: 1 file, 1 edit (down from 4-point edit tax)
- Internal state protected: deep copy at register() AND at tools_list()
- Collection Protocol: __iter__, __len__, __contains__, tools (tuple view)
- **ADR-013 (2026-07-12)**: All 57 handlers migrated to registry dispatch. `_TOOLS_LIST`, `_TOOL_DISPATCH`, `_V3_HANDLER_MAP` deleted from server.py. Registry is now the sole source of truth for MCP tool discovery and dispatch.
- Future migration paths documented:
  - Import-time registration → plugin discovery (entry_points / fs scan)
  - requires_com: bool → capabilities: dict[str, bool]
  - Key inference → Model-declared PARAM_KEY
