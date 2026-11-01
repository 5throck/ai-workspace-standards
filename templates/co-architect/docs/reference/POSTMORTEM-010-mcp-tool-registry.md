# Postmortem: MCP Tool Registry Refactoring (ADR-010)

**Date**: 2026-07-12
**Scope**: `src/cad_intelligence/cad_io/registry.py`, 9 handler modules, `server.py`
**Status**: Complete — all 3 phases merged to main via [PR #99](https://github.com/5throck/co-architect/pull/99)

---

## 1. Why

Adding a new MCP tool to the ZWCAD MCP server required editing **4 locations** in `server.py`:

1. Handler module import
2. `_TOOLS_LIST` — tool definition dict (name, description, schema)
3. `_TOOL_DISPATCH` — string→string name mapping (tool_name → handler_name)
4. Auto-discovery introspection — `dir(module)` scan building `_V3_HANDLER_MAP`

Dispatch was **3-hop indirection**: `tool_name → _TOOL_DISPATCH[str→str] → _V3_HANDLER_MAP[str→callable] → handler()`.

This created:
- **Edit tax**: Every new tool = 4 edits across 2 files, error-prone
- **Drift risk**: Schema in `_TOOLS_LIST` could diverge from actual handler parameters
- **No single source of truth**: Tool metadata scattered across 3 separate data structures
- **Silent failures**: Typos in `_TOOL_DISPATCH` values only surfaced at runtime

## 2. Technical Debt Removed

| Debt | Before | After |
|------|--------|-------|
| 4-point edit tax | 4 edits in 2 files per new tool | 1 edit in 1 file |
| 3-hop dispatch | `_TOOL_DISPATCH → _V3_HANDLER_MAP → callable` | `registry.get_handler(name) → callable` |
| Schema drift | Manual sync between `_TOOLS_LIST` and handler code | Schema declared once at `@register_tool` site |
| No validation | Typos detected only at runtime | Name prefix, callable, schema type, status, duplicate — all validated at registration |
| No lifecycle tracking | No concept of tool status | `status` field: stable / experimental / deprecated |
| Defensive copy missing | `_TOOLS_LIST` dicts were mutable references | `copy.deepcopy` at registration AND at `tools_list()` |
| Deserialization boilerplate | 4× `[Model.from_dict(m) for m in (params.get("key") or [])]` per handler | 1× `deserialize_entities(params, models=[...])` |

## 3. How Much Simpler

| Metric | Before | After |
|--------|--------|-------|
| Files to edit (new COM-free tool) | 2 (handler.py + server.py) | 1 (handler.py only) |
| Edit points per tool | 4 | 1 |
| Dispatch hops | 3 | 1 |
| Data structures for tool metadata | 3 (`_TOOLS_LIST`, `_TOOL_DISPATCH`, `_V3_HANDLER_MAP`) | 1 (`ToolRegistry`) |
| Lines per handler (deserialization) | 4 | 1 |
| Test coverage for registration | 0 | 40 tests (24 registry + 8 helper + 8 drift) |
| `_TOOL_CAPABILITIES` entries | 9 | 0 (owned by registry) |

**Net lines**: +3,143 / -1,422 across 25 files. Test suite: 3,021 passed, 0 failed.

## 4. Surprises & Lessons Learned

### Positive surprises
- **Clean migration path**: Registry-first dispatch + fallback to existing `_TOOL_DISPATCH` worked seamlessly. Zero downtime during migration — handlers could be ported one at a time.
- **`deserialize_entities` adoption was straightforward**: All 6 handlers that used `.from_dict()` followed the exact same pattern. The irregular plural case (`SemanticObject` → `semantic_objects`) was handled cleanly by the tuple-key API.
- **3 parallel agents editing server.py simultaneously**: No merge conflicts — agents edited different line ranges.

### Challenges
- **Context loss across sessions**: The plan spanned 3 sessions (context window exhaustion). State had to be reconstructed from git diff each time. Lesson: keep a running summary file, not just rely on session context.
- **`default_registry` appeared empty when imported directly**: Importing `default_registry` without first importing handler modules showed 0 tools. The `@register_tool` side effects only trigger on import. Lesson: always import via `server.py` (which imports all handlers) for testing.
- **Room.from_dict() requires `cad_auto_id`**: Test fixture for `deserialize_entities` initially failed because `Room` model needs `cad_auto_id` in its dict. Lesson: always check `from_dict()` field requirements when writing test fixtures.
- **Sync pipeline commit rejection**: Direct `git commit` blocked by pre-commit hook requiring `/sync` skill. Lesson: always use `bun scripts/dev-sync.ts` for commits in this workspace.

### Design decisions that held up
- **`tools_list()` NOT cached**: Initially considered caching, but decided against it. At ~56 tools the cost is negligible, and fresh copies are safer by default. This was the right call.
- **`status` as project extension metadata (not standard MCP)**: Correctly scoped. Standard MCP clients ignore unknown fields, so no breakage. Internal tooling gets lifecycle tracking.
- **`DEFAULT_SCHEMA` as `Final` constant**: Read-only by convention (no runtime enforcement). Simple and Pythonic — over-engineering (e.g., deep-freezing) would have been unnecessary.

## 5. Remaining Work

| Priority | Item | Condition |
|----------|------|-----------|
| **High** | HandlerResult (response standardization) | Requires independent ADR — all 9 handlers have different response key sets |
| **Medium** | Validation Layer (server-side input validation) | Independent of registry — can be applied separately |
| **Low** | BaseHandler (common handler logic) | Defer until patterns accumulate — `deserialize_entities` already covers the main boilerplate |
| **Future** | COM-dependent tool migration to `@register_tool` | 47 remaining tools — blocked on COM bridge architecture decisions |
| **Future** | Import-time → plugin discovery (entry_points) | ADR-010 migration path documented — not needed until `plugins/` directory introduced |

## 6. Key Files

| File | Purpose |
|------|---------|
| `src/cad_intelligence/cad_io/registry.py` | `ToolRegistry`, `ToolDefinition`, `register_tool`, `DEFAULT_SCHEMA` |
| `src/cad_intelligence/cad_io/handlers/common.py` | `deserialize_entities` helper |
| `src/cad_intelligence/cad_io/server.py` | Registry-first dispatch, simplified `_handle_tools_list` |
| `tests/test_registry.py` | 24 behavior-oriented registry tests |
| `tests/test_handler_common.py` | 8 `deserialize_entities` tests |
| `tests/test_schema_drift.py` | 8 drift detection tests |
| `docs/adr/ADR-010-mcp-tool-registry.md` | Architecture decision record |
| `docs/superpowers/plans/2026-07-12-mcp-tool-registry.md` | Full implementation plan (v5 final) |
