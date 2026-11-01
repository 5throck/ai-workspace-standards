# MCP Tool Registry — Implementation Plan (v5 final)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the 4-point edit tax (handler import + autodiscovery + `_TOOLS_LIST` + `_TOOL_DISPATCH`) for every new MCP tool, by introducing a `@register_tool` decorator with a direct-handler `ToolRegistry`. Adding a new tool requires editing only one file — the handler module.

**Architecture:** `ToolDefinition` holds everything: name, description, schema, capabilities, status, and the handler callable. The registry stores `ToolDefinition` instances. Server.py iterates `registry.tools` directly — no separate `_V3_HANDLER_MAP`, no `_TOOL_DISPATCH`, no `handler_name` string indirection. The `deserialize_entities` helper accepts a `models=[Wall, Room, Door]` list for extensibility. Tests verify behavior (call → expected result), not implementation internals (dict shape).

**Tech Stack:** Python 3.11+, dataclasses, pytest

---

## Dispatch Flow: Before → After

**Before (3-hop indirection):**
```
tool_name (string)
  → _TOOL_DISPATCH[tool_name]        # str → str   ("zwcad_draw_line" → "handle_draw_line")
  → _V3_HANDLER_MAP[handler_name]    # str → callable
  → handler(arguments)
```

**After (1-hop direct lookup):**
```
tool_name (string)
  → registry.get_handler(tool_name)  # str → callable directly
  → handler(arguments)
```

**End state:** `_V3_HANDLER_MAP`, the introspection loop (`dir(module)` scan), and the string-based `_TOOL_DISPATCH` are all eliminated. `_TOOLS_LIST` is replaced by `registry.tools` iteration in `_handle_tools_list`.

---

## Implementation Priority

| # | Phase | Value |
|---|-------|-------|
| 1 | **Registry** (core) | High — foundation |
| 2 | **Migration** (port handlers) | High — eliminates the edit tax |
| 3 | **Cleanup** (remove `_TOOLS_LIST` + `_TOOL_DISPATCH` + merge code) | High — removes redundancy |
| 4 | **`deserialize_entities`** | Medium — reduces per-handler boilerplate |
| 5 | **Schema Drift Test** | Low — grows in value as tools multiply |
| 6 | **Docs + ADR** | Low — always last |

---

## ADR: Future-Proofing Decisions

This section records architectural decisions with known future migration paths. These are **not** implemented now but inform the current API design.

### Import-Time Registration → Plugin Discovery

**Current:** Handlers register themselves via `@register_tool` at module import time. Server.py imports handler modules, triggering registration as a side effect.

**Known limitation:** When the project grows to `plugins/` or `extensions/` directories, import-time registration can cause circular imports, ordering issues, and silent missed registrations.

**Migration path:** The `@register_tool` decorator + `default_registry` pattern is compatible with a future plugin discovery mechanism (e.g., `importlib.metadata.entry_points` or filesystem scanning). The decorator API stays the same; only the import mechanism changes. No handler code needs modification.

### `requires_com: bool` → `capabilities: dict`

**Current:** `ToolDefinition.requires_com` is a single boolean.

**Known limitation:** Future tools may need additional capability declarations: `requires_document`, `requires_selection`, `requires_graph`, `thread_safe`.

**Migration path:** `requires_com` can be promoted to a `capabilities: dict[str, bool]` field without breaking the decorator API. The current `requires_com=True` is equivalent to `capabilities={"com": True}`. Server-side capability checks would iterate the dict instead of checking a single key. All handler registrations remain unchanged.

### Key Inference (`Wall` → `"walls"`) → Model-Declared Key

**Current:** `deserialize_entities` infers the params key from the class name via `name.lower() + "s"`.

**Known limitation:** Irregular plurals (`Category` → `"categories"`, `Person` → `"people"`) break this inference.

**Migration path:** Domain models can declare their own param key:
```python
class Wall:
    PARAM_KEY = "walls"
```
`deserialize_entities` would check for `PARAM_KEY` first, falling back to the current inference. All existing models work unchanged; only irregular-plural models need the attribute.

### Tool Lifecycle (`status` field)

**Current:** `ToolDefinition.status` defaults to `"stable"`.

**Behavior:** `status` is not purely informational — it has real runtime effects:
- `"deprecated"`: Emits `DeprecationWarning` (via `warnings.warn`) and `logger.warning` at registration time. MCP clients can filter `tools/list` by status to suppress deprecated tools.
- `"experimental"`: No enforcement, purely informational for client-side filtering.
- `"stable"`: Default, no special behavior.

**Standard MCP note:** The `status` field is **project extension metadata**, NOT part of the standard MCP `tools/list` response. Standard MCP clients will ignore this field. It is for internal tooling only (filtering, audit, lifecycle tracking).

**Use:** Internal tooling can filter `tools/list` by status. The field enables staged rollout: new tools start as `"experimental"`, graduate to `"stable"`, and eventually get `"deprecated"`.

---

## Phase 1: Registry Core

### Task 1: Create `ToolDefinition` and `ToolRegistry`

**Files:**
- Create: `src/cad_intelligence/cad_io/registry.py`
- Test: `tests/test_registry.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_registry.py
"""Tests for MCP Tool Registry — behavior-oriented, not implementation-oriented."""

from __future__ import annotations

import copy
import pytest
import warnings

from cad_intelligence.cad_io.registry import (
    ToolRegistry,
    register_tool,
    DEFAULT_SCHEMA,
)


class TestToolRegistry:

    def test_get_handler_returns_callable(self):
        """Registered handler is directly callable and returns expected result."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_echo_tool", description="Echoes input.")
        def handle_echo(params: dict) -> dict:
            return {"echoed": params.get("value")}

        handler = reg.get_handler("zwcad_echo_tool")
        assert callable(handler)
        result = handler({"value": "hello"})
        assert result == {"echoed": "hello"}

    def test_get_handler_returns_none_for_unknown(self):
        reg = ToolRegistry()
        assert reg.get_handler("nonexistent") is None

    def test_get_definition_returns_full_metadata(self):
        """ToolDefinition holds all metadata in one object."""
        reg = ToolRegistry()

        schema = {
            "type": "object",
            "properties": {"x": {"type": "number"}},
            "required": ["x"],
        }

        @register_tool(reg, name="zwcad_typed_tool", description="A typed tool.",
                        input_schema=schema, requires_com=False)
        def handle_typed(params: dict) -> dict:
            return {"status": "ok"}

        defn = reg.get_definition("zwcad_typed_tool")
        assert defn is not None
        assert defn.name == "zwcad_typed_tool"
        assert defn.description == "A typed tool."
        assert defn.input_schema == schema
        assert defn.requires_com is False
        assert defn.handler is handle_typed

    def test_tools_returns_immutable_tuple_view(self):
        """registry.tools returns a cached tuple view, not a list."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_tool_a", description="A")
        def handle_a(params: dict) -> dict:
            return {"status": "ok"}

        @register_tool(reg, name="zwcad_tool_b", description="B")
        def handle_b(params: dict) -> dict:
            return {"status": "ok"}

        tools = reg.tools
        names = {t.name for t in tools}
        assert names == {"zwcad_tool_a", "zwcad_tool_b"}

        # Verify it's the same tuple view on subsequent calls (cached)
        assert reg.tools is tools

        # Verify it's a tuple (immutable)
        assert isinstance(tools, tuple)

    def test_tools_view_invalidated_on_new_registration(self):
        """Registering a new tool invalidates the cached tuple view."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_first", description="First")
        def handle_first(params: dict) -> dict:
            return {}

        view1 = reg.tools
        assert len(view1) == 1

        @register_tool(reg, name="zwcad_second", description="Second")
        def handle_second(params: dict) -> dict:
            return {}

        view2 = reg.tools
        assert len(view2) == 2
        assert view2 is not view1  # cache was invalidated

    def test_tools_list_returns_mcp_format(self):
        """tools_list() returns list of dicts in MCP tools/list format."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_list_tool", description="A tool.",
                        status="experimental")
        def handle_list(params: dict) -> dict:
            return {}

        result = reg.tools_list()
        assert len(result) == 1
        assert result[0]["name"] == "zwcad_list_tool"
        assert result[0]["description"] == "A tool."
        assert "inputSchema" in result[0]
        assert result[0]["status"] == "experimental"

    def test_tools_list_deepcopies_schema(self):
        """tools_list() deep-copies input_schema to protect internal state."""
        reg = ToolRegistry()

        schema = {"type": "object", "properties": {"x": {"type": "number"}}}
        @register_tool(reg, name="zwcad_copy_test", description="x",
                        input_schema=schema)
        def handle(params: dict) -> dict:
            return {}

        tools_list = reg.tools_list()
        tools_list[0]["inputSchema"]["properties"]["y"] = {"type": "string"}

        # Internal schema must not be affected by external mutation
        internal = reg.get_definition("zwcad_copy_test").input_schema
        assert "y" not in internal["properties"]

    def test_com_free_tools_filterable(self):
        """Can query which tools don't require COM."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_com_tool", description="Needs COM.",
                        requires_com=True)
        def handle_com(params: dict) -> dict:
            return {}

        @register_tool(reg, name="zwcad_free_tool", description="COM-free.",
                        requires_com=False)
        def handle_free(params: dict) -> dict:
            return {}

        com_free_names = {t.name for t in reg.tools if not t.requires_com}
        assert com_free_names == {"zwcad_free_tool"}

    def test_duplicate_name_raises(self):
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_dup", description="First")
        def handle_dup1(params: dict) -> dict:
            return {}

        with pytest.raises(ValueError, match="already registered"):
            @register_tool(reg, name="zwcad_dup", description="Second")
            def handle_dup2(params: dict) -> dict:
                return {}

    def test_default_registry_is_module_singleton(self):
        from cad_intelligence.cad_io.registry import default_registry
        from cad_intelligence.cad_io.registry import default_registry as dr2
        assert default_registry is dr2

    # ── Validation tests ──────────────────────────────────────────────

    def test_name_must_start_with_zwcad_(self):
        reg = ToolRegistry()
        with pytest.raises(ValueError, match="must start with"):
            reg.register(name="bad_tool", description="x",
                         handler=lambda p: {})

    def test_handler_must_be_callable(self):
        reg = ToolRegistry()
        with pytest.raises(TypeError, match="must be callable"):
            reg.register(name="zwcad_bad", description="x",
                         handler="not_callable")

    def test_schema_must_have_type_object(self):
        reg = ToolRegistry()
        with pytest.raises(ValueError, match="must have type"):
            reg.register(name="zwcad_bad_schema", description="x",
                         handler=lambda p: {},
                         input_schema={"type": "array"})

    def test_status_must_be_valid(self):
        reg = ToolRegistry()
        with pytest.raises(ValueError, match="Invalid status"):
            reg.register(name="zwcad_bad_status", description="x",
                         handler=lambda p: {},
                         status="invalid")

    # ── Status behavior tests ─────────────────────────────────────────

    def test_tool_status_defaults_to_stable(self):
        """Newly registered tools default to 'stable' status."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_stable_tool", description="A stable tool.")
        def handle_stable(params: dict) -> dict:
            return {}

        assert reg.get_definition("zwcad_stable_tool").status == "stable"

    def test_tool_status_can_be_experimental(self):
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_exp_tool", description="An experimental tool.",
                        status="experimental")
        def handle_exp(params: dict) -> dict:
            return {}

        assert reg.get_definition("zwcad_exp_tool").status == "experimental"

    def test_deprecated_tool_emits_warning(self):
        """Registering a deprecated tool emits DeprecationWarning."""
        reg = ToolRegistry()

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            reg.register(name="zwcad_deprecated", description="Old tool.",
                          handler=lambda p: {}, status="deprecated")

        assert any(issubclass(x.category, DeprecationWarning) for x in w)

    # ── Collection protocol tests ─────────────────────────────────────

    def test_registry_len(self):
        reg = ToolRegistry()
        assert len(reg) == 0

        @register_tool(reg, name="zwcad_a", description="A")
        def a(params: dict) -> dict:
            return {}
        assert len(reg) == 1

        @register_tool(reg, name="zwcad_b", description="B")
        def b(params: dict) -> dict:
            return {}
        assert len(reg) == 2

    def test_registry_contains(self):
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_exists", description="x")
        def exists(params: dict) -> dict:
            return {}

        assert "zwcad_exists" in reg
        assert "zwcad_nonexistent" not in reg

    def test_registry_iter(self):
        """for tool in registry iterates over all ToolDefinitions."""
        reg = ToolRegistry()

        @register_tool(reg, name="zwcad_x", description="x")
        def x(params: dict) -> dict:
            return {}
        @register_tool(reg, name="zwcad_y", description="y")
        def y(params: dict) -> dict:
            return {}

        names = {t.name for t in reg}
        assert names == {"zwcad_x", "zwcad_y"}

    # ── Defensive copy tests ─────────────────────────────────────────

    def test_input_schema_deepcopied_at_registration(self):
        """Registry should not be affected by external schema mutation after register()."""
        reg = ToolRegistry()

        schema = {"type": "object", "properties": {"x": {"type": "number"}}}
        reg.register(name="zwcad_deep_test", description="x",
                     handler=lambda p: {}, input_schema=schema)
        schema["properties"]["y"] = {"type": "string"}  # mutate original

        assert "y" not in reg.get_definition("zwcad_deep_test").input_schema["properties"]

    def test_default_schema_isolated_between_registrations(self):
        """Default schema should not leak between registrations."""
        reg = ToolRegistry()
        reg.register(name="zwcad_isol_a", description="x",
                     handler=lambda p: {})
        reg.register(name="zwcad_isol_b", description="x",
                     handler=lambda p: {})
        assert (reg.get_definition("zwcad_isol_a").input_schema
                is not reg.get_definition("zwcad_isol_b").input_schema)

    # ── register() flat args test ────────────────────────────────────

    def test_register_method_creates_definition_from_args(self):
        """registry.register() accepts flat args, not a ToolDefinition."""
        reg = ToolRegistry()

        def my_handler(params: dict) -> dict:
            return {"ok": True}

        reg.register(
            name="zwcad_flat_tool",
            description="Registered via flat args",
            handler=my_handler,
            requires_com=False,
        )

        defn = reg.get_definition("zwcad_flat_tool")
        assert defn.handler is my_handler
        assert defn.requires_com is False

    # ── DEFAULT_SCHEMA constant test ──────────────────────────────────

    def test_default_schema_constant(self):
        """DEFAULT_SCHEMA is the canonical empty schema."""
        assert DEFAULT_SCHEMA == {"type": "object", "properties": {}}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_registry.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# src/cad_intelligence/cad_io/registry.py
"""MCP Tool Registry — single source of truth for tool metadata and dispatch.

Each tool is represented by a ToolDefinition that holds:
  - name, description, input_schema (for tools/list)
  - requires_com (for capability checking)
  - status (stable / experimental / deprecated)
  - handler (callable, for direct dispatch — no string indirection)

Server.py iterates registry.tools to build the tools/list response
and calls registry.get_handler(name) for dispatch.

API usage:
    for tool in registry:         — iterate all definitions
    registry.tools                — cached immutable tuple view
    registry.tools_list()         — MCP tools/list format (deep-copied schemas)
    len(registry)                 — tool count
    "tool_name" in registry       — existence check
    registry.get_handler(name)    — dispatch

NOTE: DEFAULT_SCHEMA is a read-only constant. Never mutate it directly.
      register() always uses DEFAULT_SCHEMA.copy() when no schema is provided.

Migration path (see ADR):
  - Import-time registration → plugin discovery (entry_points / fs scan)
  - requires_com: bool → capabilities: dict[str, bool]
  - Key inference → Model-declared PARAM_KEY
"""

from __future__ import annotations

import copy
import logging
import warnings
from collections.abc import Iterator, Sequence
from dataclasses import dataclass, field
from typing import Any, Callable, Final, Literal

logger = logging.getLogger(__name__)

HandlerFunc = Callable[[dict[str, Any]], dict[str, Any]]
ToolStatus = Literal["stable", "experimental", "deprecated"]

VALID_STATUS: Final[frozenset[str]] = frozenset({
    "stable", "experimental", "deprecated",
})

# Read-only constant: the canonical empty JSON Schema for tools with no parameters.
# Never mutate DEFAULT_SCHEMA directly — always use .copy() when needed.
DEFAULT_SCHEMA: Final[dict[str, Any]] = {
    "type": "object",
    "properties": {},
}


@dataclass(frozen=True)
class ToolDefinition:
    """Complete definition of a single MCP tool (immutable)."""

    name: str
    description: str
    handler: HandlerFunc
    input_schema: dict[str, Any] = field(
        default_factory=lambda: DEFAULT_SCHEMA.copy(),
    )
    requires_com: bool = True
    status: ToolStatus = "stable"


class ToolRegistry:
    """Central registry for MCP tools.

    Usage:
        registry = ToolRegistry()

        # Decorator form:
        @register_tool(registry, name="zwcad_my_tool", description="...")
        def handle_my_tool(params: dict) -> dict:
            return {"status": "ok"}

        # Direct register() with flat args:
        registry.register(
            name="zwcad_my_tool", description="...",
            handler=handle_my_tool,
        )

        # Iterate definitions:
        for tool in registry:
            ...

        # Cached immutable tuple view:
        tools = registry.tools

        # MCP tools/list format (defensive copy of schemas):
        tools_list = registry.tools_list()

        # Dispatch:
        handler = registry.get_handler("zwcad_my_tool")
        result = handler(params)
    """

    def __init__(self) -> None:
        self._entries: dict[str, ToolDefinition] = {}
        self._tools_view: tuple[ToolDefinition, ...] | None = None

    def register(
        self,
        *,
        name: str,
        description: str,
        handler: HandlerFunc,
        input_schema: dict[str, Any] | None = None,
        requires_com: bool = True,
        status: ToolStatus = "stable",
    ) -> None:
        """Register a tool with full validation.

        Raises:
            ValueError: name doesn't start with 'zwcad_', already registered,
                        schema type != 'object', or invalid status.
            TypeError: handler is not callable.
        """
        # Name validation
        if not name.startswith("zwcad_"):
            raise ValueError(
                f"Tool name '{name}' must start with 'zwcad_'"
            )

        # Handler validation
        if not callable(handler):
            raise TypeError(
                f"Handler for '{name}' must be callable"
            )

        # Duplicate check
        if name in self._entries:
            raise ValueError(
                f"Tool '{name}' already registered"
            )

        # Schema: deep copy + validate
        schema = copy.deepcopy(input_schema) if input_schema else DEFAULT_SCHEMA.copy()
        if schema.get("type") != "object":
            raise ValueError(
                f"Input schema for '{name}' must have type='object'"
            )

        # Status validation + deprecation warning
        if status not in VALID_STATUS:
            raise ValueError(
                f"Invalid status '{status}', must be one of {sorted(VALID_STATUS)}"
            )
        if status == "deprecated":
            warnings.warn(
                f"Registering deprecated tool '{name}'.",
                DeprecationWarning,
                stacklevel=3,
            )
            logger.warning("Deprecated tool registered: '%s'", name)

        self._entries[name] = ToolDefinition(
            name=name,
            description=description,
            handler=handler,
            input_schema=schema,
            requires_com=requires_com,
            status=status,
        )
        self._tools_view = None  # invalidate cached view

    def get_handler(self, tool_name: str) -> HandlerFunc | None:
        """Return handler callable, or None if not found."""
        entry = self._entries.get(tool_name)
        return entry.handler if entry else None

    def get_definition(self, tool_name: str) -> ToolDefinition | None:
        """Return ToolDefinition, or None if not found."""
        return self._entries.get(tool_name)

    # ── Collection protocol ──────────────────────────────────────────

    def __iter__(self) -> Iterator[ToolDefinition]:
        """Iterate over all registered ToolDefinitions.

        Use for general iteration: ``for tool in registry: ...``
        """
        return iter(self._entries.values())

    def __len__(self) -> int:
        """Return number of registered tools."""
        return len(self._entries)

    def __contains__(self, name: str) -> bool:
        """Check if a tool name is registered.

        Use for existence checks: ``"zwcad_draw_line" in registry``
        """
        return name in self._entries

    @property
    def tools(self) -> Sequence[ToolDefinition]:
        """Cached immutable tuple view of all definitions.

        Use for read-only collection access: ``registry.tools``
        Returns the same tuple on repeated calls until a new registration
        invalidates the cache.
        """
        if self._tools_view is None:
            self._tools_view = tuple(self._entries.values())
        return self._tools_view

    def tools_list(self) -> list[dict[str, Any]]:
        """Return tools in MCP tools/list format.

        Each dict contains: name, description, inputSchema, status.

        NOTE: The ``status`` field is project extension metadata, NOT part
        of the standard MCP tools/list response. Standard MCP clients will
        ignore this field. It is for internal tooling only (filtering, audit,
        lifecycle tracking).

        Schemas are deep-copied to protect internal state from external
        mutation via the returned list. This list is NOT cached — a fresh
        list is created on each call (negligible cost at ~80 tools).
        """
        return [
            {
                "name": e.name,
                "description": e.description,
                "inputSchema": copy.deepcopy(e.input_schema),
                "status": e.status,
            }
            for e in self._entries.values()
        ]


def register_tool(
    registry: ToolRegistry,
    name: str,
    description: str,
    input_schema: dict[str, Any] | None = None,
    requires_com: bool = True,
    status: ToolStatus = "stable",
) -> Callable[[HandlerFunc], HandlerFunc]:
    """Decorator that registers a handler function as an MCP tool.

    Args:
        registry: The ToolRegistry to register into.
        name: MCP tool name (e.g. "zwcad_generate_facade").
        description: Tool description for tools/list response.
        input_schema: JSON Schema for tool inputs.
        requires_com: Whether this tool needs a live ZWCAD COM connection.
        status: Tool lifecycle status ("stable", "experimental", "deprecated").
    """
    def decorator(func: HandlerFunc) -> HandlerFunc:
        registry.register(
            name=name,
            description=description,
            handler=func,
            input_schema=input_schema,
            requires_com=requires_com,
            status=status,
        )
        return func
    return decorator


# Module-level default registry instance.
# Handler modules import this and register themselves at import time.
# Server.py reads from it during startup.
default_registry = ToolRegistry()
```

**Design notes:**
- `ToolDefinition` is `frozen=True` — immutable after creation.
- `registry.register()` takes flat keyword args, not a `ToolDefinition`. The dataclass is created internally — callers don't need to know about it.
- `register()` validates: name prefix (`zwcad_`), handler callable, schema type (`object`), status enum, duplicate name.
- `input_schema` is deep-copied at registration time — prevents external mutation of the original.
- `tools_list()` also deep-copies schemas — prevents mutation of internal state via the returned list (defensive copy pattern).
- `tools_list()` is NOT cached — creates a fresh list each call. Safe by default, negligible perf cost at ~80 tools.
- `tools` property returns a cached `tuple` (immutable, created once, invalidated on new registration). No per-call allocation.
- `__iter__`, `__len__`, `__contains__` complete the Collection Protocol.
- `status` field has real runtime behavior: `"deprecated"` emits `DeprecationWarning` + `logger.warning`.
- `HandlerFunc` is a type alias only — no runtime Protocol check.
- `DEFAULT_SCHEMA` is a `Final` constant — read-only by convention, never mutate directly. `register()` always uses `DEFAULT_SCHEMA.copy()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_registry.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/cad_io/registry.py tests/test_registry.py
git commit -m "feat(cad_io): add ToolRegistry with direct-handler ToolDefinition"
```

---

## Phase 2: Server Integration

### Task 2: Wire registry into server.py dispatch

Wire the registry into `_handle_tools_call` and `_handle_tools_list` as a **registry-first** path. During migration, unmigrated tools fall through to the existing explicit path. After migration, the explicit path becomes dead code and is removed in Phase 3 Cleanup.

**Files:**
- Modify: `src/cad_intelligence/cad_io/server.py`

- [ ] **Step 1: Add registry import to server.py**

After the existing handler imports (around line 101), inside the same `try` block:

```python
    from cad_intelligence.cad_io.registry import default_registry as _tool_registry
```

And in the `except ImportError` block, add:

```python
    _tool_registry = None
```

- [ ] **Step 2: Replace `_handle_tools_list` to iterate registry**

In `_handle_tools_list`, build the response from both sources:

```python
def _handle_tools_list(req_id, params):
    tools = list(_TOOLS_LIST)  # start with explicit list

    # Merge registered tools
    if _tool_registry is not None:
        existing_names = {t["name"] for t in tools}
        for tool in _tool_registry.tools:
            if tool.name not in existing_names:
                tools.append({
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.input_schema,
                })

    return make_result(req_id, {"tools": tools})
```

- [ ] **Step 3: Add registry-first dispatch in `_handle_tools_call`**

Add registry lookup **before** the existing `_TOOL_DISPATCH` path:

```python
    # ── Registry-first dispatch ─────────────────────────────────
    if _tool_registry is not None:
        handler = _tool_registry.get_handler(tool_name)
        if handler is not None:
            definition = _tool_registry.get_definition(tool_name)
            # COM pre-flight check
            if definition and definition.requires_com:
                if not _COM_BRIDGE_AVAILABLE:
                    return make_error(req_id, _ERR_COM_UNAVAILABLE, ...)
                if not _ensure_zwcad_running():
                    return make_error(req_id, _ERR_COM_NOT_RUNNING, ...)
            try:
                result = handler(arguments)
                return make_result(
                    req_id,
                    {"content": [{"type": "text", "text": json.dumps(result)}], "isError": False},
                )
            except Exception as exc:
                return make_error(req_id, _ERR_INTERNAL, str(exc))

    # ── Fallback: existing explicit _TOOL_DISPATCH path ─────────
    if tool_name not in _TOOL_DISPATCH:
        return make_error(req_id, _ERR_METHOD_NOT_FOUND, ...)
    # ... existing dispatch code continues unchanged ...
```

- [ ] **Step 4: Run server tests for regression**

Run: `python -m pytest tests/test_mcp_server.py -v`
Expected: ALL PASS — registry is empty, all tools still go through the existing path.

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/cad_io/server.py
git commit -m "feat(cad_io): wire registry into server dispatch as primary path"
```

---

## Phase 3: Handler Migration

Each handler gets `@register_tool` and is removed from the explicit lists. Handler module imports stay (needed for the `@register_tool` side effect).

### Task 3: Port facade handler (reference implementation)

**Files:**
- Modify: `src/cad_intelligence/cad_io/handlers/facade.py`
- Modify: `src/cad_intelligence/cad_io/server.py` (remove facade from `_TOOLS_LIST` + `_TOOL_DISPATCH`)
- Test: `tests/test_registry.py`

- [ ] **Step 1: Add `@register_tool` to facade.py**

```python
from cad_intelligence.cad_io.registry import default_registry, register_tool

_SCHEMA = {
    "type": "object",
    "properties": {
        "walls": {
            "type": "array",
            "items": {"type": "object"},
            "description": "Wall.to_dict() list from zwcad_generate_wall_model (required).",
        },
        "rooms": {
            "type": "array",
            "items": {"type": "object"},
            "description": "Room.to_dict() list (for room labels and height).",
        },
        "doors": {
            "type": "array",
            "items": {"type": "object"},
            "description": "Door.to_dict() list with wall_id, width, height.",
        },
        "windows": {
            "type": "array",
            "items": {"type": "object"},
            "description": "Window.to_dict() list with wall_id, width, height, sill_height.",
        },
        "export_format": {
            "type": "string",
            "enum": ["obj", "dae"],
            "description": "Export format (default 'obj').",
        },
        "num_floors": {
            "type": "integer",
            "minimum": 1,
            "description": "Number of floors (default 1). Must be >= 1.",
        },
        "output_path": {
            "type": "string",
            "description": "Output file path stem, without extension (default './output/facade').",
        },
    },
    "required": ["walls"],
}

_DESCRIPTION = (
    "Generate facade mesh from Wall/Room/Door/Window data and export to OBJ/DAE "
    "(FACADE-001, ADR-007 Rule 1 -- self-contained geometry orchestrator). "
    "Single-floor by default; multi-floor when num_floors > 1 (FACADE-002). "
    "COM-free -- operates on already-extracted Graph data, not a live drawing."
)

@register_tool(default_registry, name="zwcad_generate_facade",
              description=_DESCRIPTION, input_schema=_SCHEMA, requires_com=False)
def handle_generate_facade(params: dict) -> dict:
    ...
```

- [ ] **Step 2: Add behavior test for facade registration**

```python
# Add to tests/test_registry.py

class TestFacadeRegistration:
    """Facade handler is callable through the registry."""

    def test_facade_handler_callable(self):
        from cad_intelligence.cad_io.handlers import facade
        from cad_intelligence.cad_io.registry import default_registry

        handler = default_registry.get_handler("zwcad_generate_facade")
        assert handler is not None
        assert callable(handler)

    def test_facade_handler_produces_expected_result(self, tmp_path):
        """End-to-end: call the registered handler, verify output shape."""
        from cad_intelligence.cad_io.handlers.facade import handle_generate_facade

        params = {
            "walls": [
                {"id": "W1", "length": 5000, "height": 2800,
                 "start": [0, 0], "end": [5000, 0], "direction": "south"},
                {"id": "W2", "length": 8000, "height": 2800,
                 "start": [5000, 0], "end": [5000, 8000], "direction": "east"},
                {"id": "W3", "length": 5000, "height": 2800,
                 "start": [5000, 8000], "end": [0, 8000], "direction": "north"},
                {"id": "W4", "length": 8000, "height": 2800,
                 "start": [0, 8000], "end": [0, 0], "direction": "west"},
            ],
            "rooms": [
                {"id": "R1", "name": "Living", "area": 40.0, "height": 2800,
                 "wall_ids": ["W1", "W2", "W3", "W4"]},
            ],
            "output_path": str(tmp_path / "test_facade"),
        }
        result = handle_generate_facade(params)
        assert result["status"] == "success"
        assert result["export_path"].endswith(".obj")
```

- [ ] **Step 3: Remove facade from explicit lists in server.py**

Remove the facade tool dict from `_TOOLS_LIST` and the `"zwcad_generate_facade": "handle_generate_facade"` entry from `_TOOL_DISPATCH`. Keep the `facade as _handlers_facade` import.

- [ ] **Step 4: Run all related tests**

Run: `python -m pytest tests/test_registry.py tests/handlers/test_facade_handler.py tests/test_mcp_server.py -v`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/cad_io/handlers/facade.py src/cad_intelligence/cad_io/server.py tests/test_registry.py
git commit -m "refactor(cad_io): migrate facade handler to @register_tool"
```

---

### Task 4: Port remaining COM-free handlers

Each migration follows the exact same pattern as Task 3. One commit per handler.

**Migration template:**
1. Add schema constant + description constant at module top
2. Add `@register_tool(default_registry, ...)` decorator
3. Remove from `_TOOLS_LIST` and `_TOOL_DISPATCH` in server.py
4. Add one behavior test in `test_registry.py`
5. Run tests, commit

**Order:** takeoff → schedule → section → ceiling → review → workflow → closed_loop → telemetry

**Per-handler schema extraction notes:**

- **takeoff**: Schema from existing `_TOOLS_LIST` entry. `requires_com=False`.
- **schedule**: Schema from existing `_TOOLS_LIST` entry. `requires_com=False`.
- **section**: Schema includes `CutInputMethod`/`ViewDirection` enum values. `requires_com=False`.
- **ceiling**: Schema from existing entry. `requires_com=False`.
- **review**: Most complex schema (includes `checks`, `severity_min`, `include_llm`, etc.). `requires_com=False`.
- **workflow**: Schema from existing entry. `requires_com=False`.
- **closed_loop**: Schema from existing entry. `requires_com=False`.
- **telemetry**: Schema from existing entry. `requires_com=False`.

- [ ] **Step 1–8: Port each handler (one at a time)**

For each handler, apply the migration template above. Run tests after each:
```bash
python -m pytest tests/ -v --ignore=tests/bench -k "test_registry or test_<handler>"
```

- [ ] **Step 9: Run full test suite**

Run: `python -m pytest tests/ -v --ignore=tests/bench`
Expected: ALL PASS

- [ ] **Step 10: Commit each separately**

```bash
git commit -m "refactor(cad_io): migrate takeoff handler to @register_tool"
git commit -m "refactor(cad_io): migrate schedule handler to @register_tool"
git commit -m "refactor(cad_io): migrate section handler to @register_tool"
git commit -m "refactor(cad_io): migrate ceiling handler to @register_tool"
git commit -m "refactor(cad_io): migrate review handler to @register_tool"
git commit -m "refactor(cad_io): migrate workflow handler to @register_tool"
git commit -m "refactor(cad_io): migrate closed_loop handler to @register_tool"
git commit -m "refactor(cad_io): migrate telemetry handler to @register_tool"
```

---

## Phase 4: Cleanup — Eliminate `_TOOLS_LIST`, `_TOOL_DISPATCH`, `_V3_HANDLER_MAP`

This phase removes the legacy explicit lists entirely. After all COM-free handlers are in the registry, the explicit paths become dead code.

**End state of dispatch flow:**
```
tools/list call
  → iterate registry.tools directly (no _TOOLS_LIST)

tools/call dispatch
  → registry.get_handler(tool_name) (no _TOOL_DISPATCH, no _V3_HANDLER_MAP)
```

### Task 5: Replace `_handle_tools_list` with registry iteration

**Files:**
- Modify: `src/cad_intelligence/cad_io/server.py`

- [ ] **Step 1: Rewrite `_handle_tools_list` to use registry only**

```python
def _handle_tools_list(req_id, params):
    tools = []
    # COM-dependent tools (still using explicit _TOOLS_LIST)
    tools.extend(_TOOLS_LIST)
    # COM-free tools from registry (via tools_list() with defensive copy)
    if _tool_registry is not None:
        tools.extend(_tool_registry.tools_list())
    return make_result(req_id, {"tools": tools})
```

> **Note:** `_TOOLS_LIST` still holds COM-dependent tool definitions (drawing, entity modification, etc.) that are NOT in the registry. Those will be migrated in a future PR. At this point, `_TOOLS_LIST` only contains COM-dependent tools, and the merge duplication check is no longer needed.

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/test_mcp_server.py -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/cad_intelligence/cad_io/server.py
git commit -m "refactor(cad_io): simplify _handle_tools_list with registry iteration"
```

---

### Task 6: Remove COM-free entries from `_TOOL_DISPATCH` and merge code

**Files:**
- Modify: `src/cad_intelligence/cad_io/server.py`

- [ ] **Step 1: Remove dead entries from `_TOOL_DISPATCH`**

All COM-free tool entries were removed per-handler in Phase 3. Verify none remain:

```python
# These should NOT be in _TOOL_DISPATCH anymore:
# zwcad_generate_takeoff, zwcad_generate_schedule, zwcad_generate_section,
# zwcad_generate_rcp, zwcad_generate_facade, zwcad_review_drawing,
# zwcad_run_workflow, zwcad_apply_fixes, zwcad_get_telemetry
```

If any remain, remove them now.

- [ ] **Step 2: Remove dead entries from `_TOOL_CAPABILITIES`**

Remove explicit COM-free entries (workflow, apply_fixes, telemetry) — the registry provides these.

- [ ] **Step 3: Remove the merge code block**

Remove the "Registry merge" block that was added in Phase 2 Task 2. The registry-first dispatch in `_handle_tools_call` and the registry iteration in `_handle_tools_list` already handle everything. The merge is dead code.

- [ ] **Step 4: Run full test suite**

Run: `python -m pytest tests/ -v --ignore=tests/bench`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add src/cad_intelligence/cad_io/server.py
git commit -m "refactor(cad_io): remove dead merge code and redundant _TOOL_DISPATCH entries"
```

---

### Task 7: Remove `_V3_HANDLER_MAP` introspection loop for registered tools

**Files:**
- Modify: `src/cad_intelligence/cad_io/server.py`

- [ ] **Step 1: Verify registered handlers bypass `_V3_HANDLER_MAP`**

The registry-first dispatch (Phase 2, Task 2, Step 3) already calls `registry.get_handler()` directly. Registered tools never reach the `_V3_HANDLER_MAP` lookup. Verify by adding a test:

```python
# In tests/test_registry.py
def test_registered_handler_bypasses_v3_map(self):
    """Registered handlers don't need _V3_HANDLER_MAP to be callable."""
    from cad_intelligence.cad_io.registry import default_registry
    handler = default_registry.get_handler("zwcad_generate_facade")
    assert handler is not None
    assert callable(handler)
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/test_registry.py tests/test_mcp_server.py -v`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add tests/test_registry.py
git commit -m "test(cad_io): verify registered handlers bypass _V3_HANDLER_MAP"
```

> **Note:** The `_V3_HANDLER_MAP` introspection loop and the COM-dependent `_TOOL_DISPATCH` remain for COM-dependent tools (drawing, entity modification, etc.). Those will be migrated to `@register_tool` in a follow-up PR. The current cleanup removes only the COM-free dead code paths.

---

## Phase 5: `deserialize_entities` Helper

### Task 8: Create `deserialize_entities` with `models=` list API

**Files:**
- Create: `src/cad_intelligence/cad_io/handlers/common.py`
- Test: `tests/test_handler_common.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_handler_common.py
"""Tests for handler common utilities."""

from __future__ import annotations

import pytest
from cad_intelligence.cad_io.handlers.common import deserialize_entities
from cad_intelligence.common.models import Wall, Room, Door, Window, Column


class TestDeserializeEntities:

    def test_deserialize_with_model_list(self):
        params = {
            "walls": [{"id": "W1", "length": 5000, "start": [0, 0], "end": [5000, 0]}],
            "rooms": [{"id": "R1", "name": "Living", "area": 25.0}],
            "doors": [{"id": "D1", "wall_id": "W1", "width": 900}],
        }
        result = deserialize_entities(params, models=[Wall, Room, Door])
        assert result["walls"][0].id == "W1"
        assert result["rooms"][0].id == "R1"
        assert result["doors"][0].id == "D1"

    def test_key_derived_from_model_class_name(self):
        """Key defaults to lowercase class name (Wall → 'walls')."""
        params = {"columns": [{"id": "C1", "position": [100, 200]}]}
        result = deserialize_entities(params, models=[Column])
        assert len(result["columns"]) == 1
        assert result["columns"][0].id == "C1"

    def test_custom_key_overrides_default(self):
        """Explicit key overrides the class-name default."""
        params = {"my_walls": [{"id": "W1", "length": 5000, "start": [0, 0], "end": [5000, 0]}]}
        result = deserialize_entities(params, models=[("my_walls", Wall)])
        assert len(result["my_walls"]) == 1

    def test_missing_key_returns_empty_list(self):
        result = deserialize_entities({}, models=[Wall, Room])
        assert result["walls"] == []
        assert result["rooms"] == []

    def test_none_value_returns_empty_list(self):
        result = deserialize_entities({"walls": None}, models=[Wall])
        assert result["walls"] == []

    def test_empty_models_returns_empty_dict(self):
        result = deserialize_entities({"walls": [{"id": "W1"}]}, models=[])
        assert result == {}

    def test_unexpected_type_raises(self):
        """Non-dict items propagate from_dict errors."""
        with pytest.raises((KeyError, TypeError, ValueError)):
            deserialize_entities({"walls": ["not a dict"]}, models=[Wall])

    def test_duplicate_models_raise(self):
        """Two models resolving to the same key should raise."""
        with pytest.raises(ValueError, match="duplicate key"):
            deserialize_entities({}, models=[Wall, Wall])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_handler_common.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Write the implementation**

```python
# src/cad_intelligence/cad_io/handlers/common.py
"""Common utilities for COM-free MCP handlers.

Migration path (see ADR):
  Key inference (Wall → "walls") can be replaced by Model-declared PARAM_KEY
  when irregular plurals are introduced to the domain.
"""

from __future__ import annotations

from typing import Any, TypeVar, Union

T = TypeVar("T")

ModelSpec = Union[tuple[str, type[T]], type[T]]


def _resolve_key(spec: ModelSpec) -> tuple[str, type]:
    """Resolve a model spec into (key, model_class).

    Priority:
      1. Explicit key from tuple: ("my_walls", Wall) → ("my_walls", Wall)
      2. PARAM_KEY class attribute: Wall.PARAM_KEY → Wall.PARAM_KEY
      3. Inferred from class name: Wall → "walls"

    """
    if isinstance(spec, tuple):
        return spec
    # Check for model-declared key (future migration path)
    if hasattr(spec, "PARAM_KEY"):
        return spec.PARAM_KEY, spec
    # Infer: Wall → "walls", Column → "columns"
    name = spec.__name__
    key = name.lower() + "s"
    return key, spec


def deserialize_entities(
    params: dict[str, Any],
    models: list[ModelSpec],
) -> dict[str, list]:
    """Deserialize domain entity lists from a raw params dict.

    Replaces the repeated pattern:
        walls = [Wall.from_dict(w) for w in (params.get("walls") or [])]
        rooms = [Room.from_dict(r) for r in (params.get("rooms") or [])]

    Usage:
        ents = deserialize_entities(params, models=[Wall, Room, Door, Window])
        walls, rooms, doors, windows = ents["walls"], ents["rooms"], ...

        # With custom key:
        ents = deserialize_entities(params, models=[("my_walls", Wall), Room])

    Args:
        params: Raw MCP tool parameters dict.
        models: List of model classes or (key, class) tuples.

    Returns:
        Dict mapping key → list of deserialized model instances.
    """
    resolved = [_resolve_key(m) for m in models]

    # Check for duplicate keys
    keys = [k for k, _ in resolved]
    if len(keys) != len(set(keys)):
        dupes = [k for k in keys if keys.count(k) > 1]
        raise ValueError(f"Duplicate deserialization keys: {dupes}")

    result: dict[str, list] = {}
    for key, model_class in resolved:
        raw = params.get(key)
        if not raw:
            result[key] = []
        else:
            result[key] = [model_class.from_dict(item) for item in raw]
    return result
```

- [ ] **Step 4: Run tests**

Run: `python -m pytest tests/test_handler_common.py -v`
Expected: ALL PASS

- [ ] **Step 5: Refactor facade handler to use it**

In `facade.py`, replace:
```python
# Before:
walls = [Wall.from_dict(w) for w in (params.get("walls") or [])]
rooms = [Room.from_dict(r) for r in (params.get("rooms") or [])]
doors = [Door.from_dict(d) for d in (params.get("doors") or [])]
windows = [Window.from_dict(w) for w in (params.get("windows") or [])]

# After:
from cad_intelligence.cad_io.handlers.common import deserialize_entities
ents = deserialize_entities(params, models=[Wall, Room, Door, Window])
walls, rooms, doors, windows = ents["walls"], ents["rooms"], ents["doors"], ents["windows"]
```

- [ ] **Step 6: Run facade tests**

Run: `python -m pytest tests/handlers/test_facade_handler.py -v`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/cad_intelligence/cad_io/handlers/common.py tests/test_handler_common.py src/cad_intelligence/cad_io/handlers/facade.py
git commit -m "feat(cad_io): add deserialize_entities helper with models= API"
```

---

### Task 9: Refactor remaining handlers to use `deserialize_entities`

- [ ] **Step 1: Refactor each handler**

Each handler replaces its 4-line deserialization with:
```python
from cad_intelligence.cad_io.handlers.common import deserialize_entities
ents = deserialize_entities(params, models=[Wall, Room, Door, Window])
```

For ceiling: `models=[Wall, Room, Column]`
For review: `models=[Wall, Room, Door, Window, SemanticObject]`

- [ ] **Step 2: Run full test suite**

Run: `python -m pytest tests/ -v --ignore=tests/bench`
Expected: ALL PASS

- [ ] **Step 3: Commit per handler**

```bash
git commit -m "refactor(cad_io): use deserialize_entities in takeoff handler"
git commit -m "refactor(cad_io): use deserialize_entities in schedule handler"
git commit -m "refactor(cad_io): use deserialize_entities in section handler"
git commit -m "refactor(cad_io): use deserialize_entities in ceiling handler"
git commit -m "refactor(cad_io): use deserialize_entities in review handler"
```

---

## Phase 6: Schema Drift Detection

### Task 10: Add drift detection tests

**Files:**
- Create: `tests/test_schema_drift.py`

- [ ] **Step 1: Write drift detection tests**

```python
# tests/test_schema_drift.py
"""Schema-Handler drift detection — behavior-oriented checks."""

from __future__ import annotations

import pytest
from cad_intelligence.cad_io.registry import default_registry


class TestSchemaDrift:

    def test_all_tools_have_zwcad_prefix(self):
        for tool in default_registry.tools:
            assert tool.name.startswith("zwcad_"), (
                f"Tool '{tool.name}' violates naming convention"
            )

    def test_all_tools_have_valid_schema(self):
        for tool in default_registry.tools:
            assert tool.input_schema.get("type") == "object"
            assert "properties" in tool.input_schema

    def test_all_required_fields_exist_in_properties(self):
        """Every field in 'required' must exist in 'properties'."""
        for tool in default_registry.tools:
            required = set(tool.input_schema.get("required", []))
            properties = set(tool.input_schema.get("properties", {}).keys())
            missing = required - properties
            assert not missing, (
                f"Tool '{tool.name}': required fields not in properties: {missing}"
            )

    def test_all_tools_have_nonempty_description(self):
        for tool in default_registry.tools:
            assert tool.description.strip(), (
                f"Tool '{tool.name}' has empty description"
            )

    def test_no_duplicate_registrations(self):
        names = [t.name for t in default_registry.tools]
        assert len(names) == len(set(names)), "Duplicate tool names in registry"

    def test_all_handlers_are_callable(self):
        """Every registered handler must be callable."""
        for tool in default_registry.tools:
            assert callable(tool.handler), (
                f"Tool '{tool.name}' handler is not callable"
            )

    def test_com_free_tools_declared(self):
        """Known COM-free tools must have requires_com=False."""
        com_free = {
            "zwcad_generate_takeoff", "zwcad_generate_schedule",
            "zwcad_generate_section", "zwcad_generate_rcp",
            "zwcad_generate_facade", "zwcad_review_drawing",
            "zwcad_run_workflow", "zwcad_apply_fixes", "zwcad_get_telemetry",
        }
        registered_com_free = {t.name for t in default_registry.tools if not t.requires_com}
        missing = com_free - registered_com_free
        assert not missing, f"COM-free tools not declared: {missing}"

    def test_no_deprecated_tools_without_comment(self):
        """Deprecated tools should have 'deprecated' in description."""
        for tool in default_registry.tools:
            if tool.status == "deprecated":
                assert "deprecated" in tool.description.lower(), (
                    f"Tool '{tool.name}' is marked deprecated but description doesn't mention it"
                )
```

- [ ] **Step 2: Run tests**

Run: `python -m pytest tests/test_schema_drift.py -v`
Expected: PASS (after Phase 3 complete)

- [ ] **Step 3: Commit**

```bash
git add tests/test_schema_drift.py
git commit -m "test(cad_io): add schema drift detection tests"
```

---

## Phase 7: Documentation + ADR

### Task 11: Create ADR-010 and update related docs

**Files:**
- Create: `docs/designs/ADR-010-mcp-tool-registry.md`
- Modify: `docs/designs/MCP-000-zwcad-mcp-server-plan.md` (add supersede note)
- Modify: `docs/designs/WORKFLOW-001-design.md` (add ADR-010 reference)

- [ ] **Step 1: Create ADR-010**

```markdown
# ADR-010: MCP Tool Registry

## Status
Accepted

## Context
Adding a new MCP tool required editing 4 locations in server.py:
1. Handler module import
2. Auto-discovery introspection (dir() scan)
3. _TOOLS_LIST (tool definition dict)
4. _TOOL_DISPATCH (str→str name mapping)

Dispatch was 3-hop: _TOOL_DISPATCH → _V3_HANDLER_MAP → callable.

## Decision
Introduce `ToolRegistry` with `@register_tool` decorator:
- Handlers declare their own metadata (name, description, schema, status)
- Registry stores ToolDefinition (frozen dataclass) with handler callable
- Direct 1-hop dispatch: registry.get_handler(name) → callable
- Validation at registration: name prefix, callable, schema type, status enum
- Status field with real behavior: "deprecated" emits DeprecationWarning

### Status field: Project extension metadata
The `status` field in `tools_list()` output is **NOT part of the standard MCP
tools/list response**. It is project extension metadata for internal tooling
(filtering, audit, lifecycle tracking). Standard MCP clients will ignore this
field.

## Consequences
- Adding a new tool: 1 file, 1 edit (down from 4-point edit tax)
- Internal state protected: deep copy at register() AND at tools_list()
- Collection Protocol: __iter__, __len__, __contains__, tools (tuple view)
- Future migration paths documented:
  - Import-time registration → plugin discovery
  - requires_com: bool → capabilities: dict[str, bool]
  - Key inference → Model-declared PARAM_KEY
```

- [ ] **Step 2: Add supersede note to MCP-000**

At the top of `docs/designs/MCP-000-zwcad-mcp-server-plan.md`, add:
```markdown
> **Superseded by ADR-010** for tool registration architecture.
> This document remains the authoritative reference for MCP JSON-RPC 2.0 protocol implementation.
```

- [ ] **Step 3: Add ADR-010 reference to WORKFLOW-001**

Where WORKFLOW-001 references `_TOOL_DISPATCH`, add a note:
```markdown
> **Note:** `_TOOL_DISPATCH` is being replaced by ToolRegistry (ADR-010).
```

- [ ] **Step 4: Write "Adding a New Tool" developer guide**

```markdown
## Adding a New COM-free MCP Tool

1. Create a handler in `src/cad_intelligence/cad_io/handlers/<module>.py`:

   from cad_intelligence.cad_io.registry import default_registry, register_tool
   from cad_intelligence.cad_io.handlers.common import deserialize_entities

   _SCHEMA = {
       "type": "object",
       "properties": {
           "walls": {"type": "array", "items": {"type": "object"}},
       },
       "required": ["walls"],
   }

   @register_tool(default_registry, name="zwcad_my_tool",
                   description="...", input_schema=_SCHEMA, requires_com=False)
   def handle_my_tool(params: dict) -> dict:
       ents = deserialize_entities(params, models=[Wall, Room, Door, Window])
       # ... pipeline logic ...
       return {"status": "success", ...}

2. Ensure the handler module is imported in server.py's handler imports.

No _TOOLS_LIST, _TOOL_DISPATCH, or _V3_HANDLER_MAP edits needed.

### Experimental tools

Use `status="experimental"` for new tools under development:
   @register_tool(..., status="experimental")

NOTE: The `status` field is project extension metadata, not standard MCP.
Standard MCP clients will ignore it. See ADR-010.
```

- [ ] **Step 5: Commit**

```bash
git add docs/designs/ADR-010-mcp-tool-registry.md docs/designs/MCP-000-zwcad-mcp-server-plan.md docs/designs/WORKFLOW-001-design.md
git commit -m "docs: add ADR-010 tool registry, update MCP-000 and WORKFLOW-001"
```

---

## Summary

| Phase | What | Files | Value |
|-------|------|-------|-------|
| **1** | `ToolDefinition` + `ToolRegistry` + `@register_tool` | 2 new | Foundation |
| **2** | Server dispatch wiring (registry-first) | server.py | Zero-breakage |
| **3** | Port 9 COM-free handlers | ~9 files | **Core goal achieved** |
| **4** | Cleanup: remove `_TOOLS_LIST` merge, `_TOOL_DISPATCH` dead entries, verify `_V3_HANDLER_MAP` bypass | server.py | Removes redundancy |
| **5** | `deserialize_entities(models=[...])` | 2 new + handlers | Boilerplate reduction |
| **6** | Schema drift test (incl. required ⊆ properties) | 1 new | Prevents future drift |
| **7** | ADR-010 + doc updates | docs | Onboarding |

**Net effect — adding a new COM-free tool:**

| Before | After |
|--------|-------|
| Edit handler.py (create handler) | Edit handler.py (create handler + `@register_tool`) |
| Edit server.py (add import) | — (already imported) |
| Edit server.py (add to `_TOOLS_LIST`) | — (auto from registry) |
| Edit server.py (add to `_TOOL_DISPATCH`) | — (auto from registry) |
| **4 edits in 2 files** | **1 edit in 1 file** |

**Eventual end state** (after COM-dependent tools also migrated in future PR):

```
_TOOLS_LIST          → eliminated (registry.tools)
_TOOL_DISPATCH       → eliminated (registry.get_handler)
_V3_HANDLER_MAP      → eliminated (registry stores callables)
introspection loop   → eliminated (@register_tool at import time)
```

## Self-Review (v5 final)

- [x] **Spec coverage:** Registry (items 1, 5) ✅, Deserialize (item 3) ✅, Schema Drift (item 8) ✅, Capabilities (item 5) ✅
- [x] **Deferred items:** HandlerResult (item 2), Validation Layer (item 4), BaseHandler (item 7) — independent PRs
- [x] **Future-proofing ADR:** Import→plugin, requires_com→capabilities, key inference→PARAM_KEY, status field — all documented with migration paths
- [x] **Placeholder scan:** No TBD, no TODO, no "implement later"
- [x] **Type consistency:** `ToolDefinition`, `ToolRegistry`, `register_tool`, `default_registry`, `deserialize_entities`, `ModelSpec`, `ToolStatus` — all consistent
- [x] **Test design:** All tests verify behavior (callable → expected result), not implementation internals
- [x] **required ⊆ properties:** Schema drift test catches typos where required fields don't exist in properties
- [x] **ToolDefinition frozen:** `@dataclass(frozen=True)` — immutable after creation
- [x] **register() validation:** name prefix (`zwcad_`), handler callable, schema type, status enum, duplicate name
- [x] **input_schema deep copy at registration:** `copy.deepcopy()` prevents external mutation of original
- [x] **tools_list() defensive copy:** `copy.deepcopy(e.input_schema)` prevents mutation via returned list
- [x] **tools_list() NOT cached:** fresh list each call — safe by default, negligible perf at ~80 tools
- [x] **tools returns tuple:** cached immutable view, invalidated on register()
- [x] **DEFAULT_SCHEMA constant:** `Final[dict[str, Any]]` — read-only by convention, never mutate directly
- [x] **Collection Protocol:** `__iter__`, `__len__`, `__contains__` — complete
- [x] **API usage docs:** `__iter__` vs `tools` vs `tools_list()` clearly distinguished
- [x] **Status real behavior:** `DeprecationWarning` + `logger.warning` on deprecated registration
- [x] **Status as project extension:** documented in ADR-010 and dev guide as NOT standard MCP
- [x] **HandlerFunc:** type alias only, no runtime Protocol check
- [x] **Drift test callable check:** `callable(tool.handler)` in schema drift tests
- [x] **PR1 Acceptance Criteria:** 100% existing tests pass, zero functional change
