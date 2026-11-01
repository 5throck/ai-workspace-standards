# API-001: MCP Interface Standard

> **Spec ID**: API-001
> **Version**: 1.0
> **Status**: Design (implementation partial — server.py operational)
> **Created**: 2026-07-05
> **Authors**: architect
> **Source**: V3 completion — authoritative interface standard for MCP tool handlers
> **Related**: [`PIPELINE-001`](PIPELINE-001-design.md) (Flow), [`GRAPH-001`](GRAPH-001-design.md) (Data Model), [`TRANSACTION-001`](TRANSACTION-001-design.md) (Transactions), [`TEST-001`](TEST-001-design.md) (Verification)

---

## Scope

This document defines the **MCP tool interface conventions** — handler registration, versioning, error codes, async job model, and streaming. It applies to all tools exposed through `server.py`'s `tools/list` and `tools/call`.

---

## 1. Handler Registration Convention

### 1.1 Tool Naming

All MCP tools follow the pattern: `zwcad_{domain}_{action}`

| Component | Rule | Examples |
|-----------|------|---------|
| `domain` | Functional area | `layer`, `entity`, `drawing`, `axis`, `opening`, `space` |
| `action` | Verb describing operation | `analyze`, `classify`, `extract`, `generate`, `draw`, `find` |

Examples:
- `zwcad_analyze_layers` — layer domain, analyze action
- `zwcad_generate_spaces` — space domain, generate action
- `zwcad_find_opening_candidates` — opening domain, find action

### 1.2 Handler Function Signature

All handlers follow a uniform signature:

```python
def handle_{tool_name}(params: dict) -> dict:
    """Handler docstring.

    Parameters
    ----------
    params : dict
        Input parameters matching the tool's inputSchema.

    Returns
    -------
    dict
        Result dictionary with at minimum a "status" key.
    """
```

### 1.3 Registration Flow

```
Handler function defined in handlers/*.py
  → Auto-discovered by dir(module) scan (server.py:112-114)
  → Registered in _V3_HANDLER_MAP: handler_name → callable
  → Tool schema in _TOOLS_LIST: name, description, inputSchema
  → Dispatch entry in _TOOL_DISPATCH: tool_name → handler_name
```

### 1.4 Response Format

All handlers return a dict with at minimum:

```python
{
    "status": "success" | "needs_confirmation" | "error",
    # ... domain-specific fields
}
```

Error responses are wrapped by the server layer via `make_error()`.

---

## 2. API Versioning

### 2.1 Version Negotiation

The server advertises its protocol version in the `initialize` response:

```json
{
  "protocolVersion": "2024-11-05",
  "serverInfo": {
    "name": "zwcad-mcp",
    "version": "0.1.0"
  }
}
```

### 2.2 Capability Discovery

Tool metadata in `tools/list` provides capability hints:

```json
{
  "name": "zwcad_generate_wall_elevations",
  "description": "...",
  "inputSchema": { ... },
  "_metadata": {
    "phase": "elev-002-p3",
    "minVersion": "0.1.0",
    "deprecated": false
  }
}
```

### 2.3 Backward Compatibility

- Deprecated tools remain in `tools/list` for **3 versions** with `"deprecated": true`
- Clients are warned via metadata
- Sunset: tool removed from `tools/list` and `_TOOL_DISPATCH` after 3 versions

---

## 3. Error Codes

### 3.1 Standard JSON-RPC Errors

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON was received |
| -32600 | Invalid Request | JSON is not a valid request object |
| -32601 | Method not found | Tool does not exist |
| -32602 | Invalid params | Invalid tool parameters |
| -32603 | Internal error | Internal JSON-RPC error |

### 3.2 Application-Specific Errors

| Code | Constant | Description |
|------|----------|-------------|
| -32000 | — | Unexpected server error |
| -32001 | `_ERR_ZWCAD_CONNECTION` | ZWCAD not running / COM connection failed |
| -32002 | `_ERR_ZWCAD_COM` | ZWCAD COM bridge exception (ActiveX error) |
| -32003 | `_ERR_ZWCAD_BOUNDARY` | Parameter exceeded defined bounds |
| -32005 | `_ERR_ZWCAD_LAYER` | Layer operation failed (not found or protected) |

### 3.3 Error Response Format

```python
def make_error(req_id, code: int, message: str, details: str | None = None) -> dict:
    return {
        "jsonrpc": "2.0",
        "id": req_id,
        "error": {
            "code": code,
            "message": message,
            "data": {"details": details} if details else None,
        },
    }
```

---

## 4. Async Job Model

### 4.1 Motivation

Some operations exceed the MCP protocol's implicit timeout (tools/call is synchronous). The async job model allows long-running tools to return immediately with a job ID, then be polled for results.

### 4.2 When to Use

Tools exceeding **5 seconds** wall-clock time must use the job model. Current candidates:
- `zwcad_generate_wall_elevations` (multi-wall, multi-direction)
- Future: `zwcad_review_drawing` (REVIEW-AGENT-001)

### 4.3 Job State Machine

```
SUBMITTED → PENDING → RUNNING → COMPLETED
                              → FAILED
                              → CANCELLED
```

| State | Description | Transitions |
|-------|-------------|-------------|
| `SUBMITTED` | Job created, not yet started | → PENDING |
| `PENDING` | Waiting for execution slot | → RUNNING, CANCELLED |
| `RUNNING` | Currently executing | → COMPLETED, FAILED, CANCELLED |
| `COMPLETED` | Finished successfully, result available | Terminal |
| `FAILED` | Execution failed, error in result | Terminal |
| `CANCELLED` | Cancelled by client or timeout | Terminal |

### 4.4 Job API

| Tool | Description |
|------|-------------|
| `zwcad_submit_job(tool, params)` | Submit a tool call as a job, returns `job_id` |
| `zwcad_poll_job(job_id)` | Get job status and result (if completed) |
| `zwcad_cancel_job(job_id)` | Cancel a pending/running job |
| `zwcad_list_jobs()` | List all jobs with their status |

### 4.5 Job Result Format

```python
{
    "job_id": "job_abc123",
    "status": "completed",
    "result": { ... },  # tool-specific result
    "duration_ms": 3420,
    "started_at": "2026-07-05T10:00:00Z",
    "completed_at": "2026-07-05T10:00:03Z"
}
```

---

## 5. Job Persistence Strategy

Job state and results must survive the duration of the operation. The backend is configurable.

### 5.1 Backend Options

| Backend | Persistence | Latency | Dependencies | Use Case |
|---------|-------------|---------|--------------|----------|
| **Memory** (current) | Lost on restart | ~0ms | None | CLI/MCP, single-process |
| **Redis** (future) | Durable, TTL-based | ~1ms | redis-py | Multi-process, Web UI, pub/sub for progress |
| **SQLite** (optional) | File-based, durable | ~5ms | sqlite3 (stdlib) | Single-instance, no external services |

### 5.2 Configuration

```python
# In pipeline config
job_backend: "memory" | "redis" | "sqlite" = "memory"

# Redis-specific
job_redis_url: str = "redis://localhost:6379/0"
job_ttl_seconds: int = 3600  # 1 hour default

# SQLite-specific
job_db_path: str = ".cache/jobs.db"
```

### 5.3 Backend Protocol

```python
class SupportsJobBackend(Protocol):
    def create(job_id: str, tool_name: str, params: dict) -> None: ...
    def update(job_id: str, status: str, result: dict | None = None) -> None: ...
    def get(job_id: str) -> JobState | None: ...
    def list_jobs() -> list[JobState]: ...
    def delete(job_id: str) -> None: ...
    def cleanup(ttl_seconds: int) -> int: ...  # returns deleted count
```

---

## 6. Streaming (Optional)

For real-time progress updates during long-running operations:

- Uses MCP `notifications` (server-initiated messages to client)
- Progress notification format:

```json
{
    "method": "notifications/job_progress",
    "params": {
        "job_id": "job_abc123",
        "progress": 0.65,
        "message": "Processing wall 3 of 5..."
    }
}
```

- Streaming is **optional** — clients that don't support notifications simply poll via `zwcad_poll_job`

---

## 7. Batch Execution

`zwcad_execute_batch` supports executing multiple commands atomically:

```json
{
    "name": "zwcad_execute_batch",
    "inputSchema": {
        "type": "object",
        "properties": {
            "commands": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tool": {"type": "string"},
                        "params": {"type": "object"}
                    },
                    "required": ["tool", "params"]
                }
            },
            "atomic": {
                "type": "boolean",
                "description": "Wrap in undo marks for atomic rollback on failure (default: true)."
            }
        },
        "required": ["commands"]
    }
}
```

---

## 8. Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D59 | `zwcad_` prefix for all tools | Clear namespace, avoids collision with generic MCP tools |
| D60 | Uniform handler signature | Enables auto-discovery and consistent error wrapping |
| D61 | JSON-RPC 2.0 standard | Widely supported, well-specified protocol |
| D62 | Async job model with configurable backend | Supports CLI (memory), Web UI (Redis/SQLite) without code changes |
| D63 | 3-version deprecation window | Balances backward compatibility with cleanup |
| D64 | Optional streaming | Not all clients support notifications; polling is the universal fallback |

---

## Document Dependencies

```
PIPELINE-001
      ↓
GRAPH-001           ← Node/edge types inform handler DTOs
      ↓
API-001 (this doc)  ← Handler conventions reference graph data model
      ↓
TRANSACTION-001     ← Transactions use handler convention for commands
      ↓
TEST-001            ← Tests verify API contracts
```
