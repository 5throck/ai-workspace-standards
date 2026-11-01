# ADR-0037: CAD Agent Modularization

## Status

Accepted

## Date

2026-07-12

## Context

`src/agent/cad_agent.py` is a 1,322-line God class containing the entire CAD Agent HTTP server:
- `ZWCADAgentBridge` (486 lines, 32 methods — V3 proxy)
- `CADAgentHTTPRequestHandler` (561 lines — 430-line `do_POST` if/elif chain)
- Manual `.env` parser (replacing python-dotenv)
- 11 duplicated `pythoncom.CoInitialize()` calls with zero `CoUninitialize()`
- 6 `Access-Control-Allow-Origin: *` (no CORS policy)
- 2 `subprocess.check_output(..., shell=True)` calls
- Zero authentication on all 17 endpoints

## Decision

Split into 6 focused modules with clear responsibility boundaries.

### Module Structure

```
src/agent/
├── __init__.py          # Package marker, public API (__all__)
├── env.py               # Environment loading, logging, COM context, domain exceptions
├── bridge.py            # ZWCADAgentBridge (V3 proxy)
├── http_handler.py      # HTTP handler + dictionary-based routing
├── middleware.py         # Middleware chain (COM-agnostic)
├── auth.py              # API Key authentication + DEV_MODE
├── health.py            # ZWCAD health monitor and auto-recovery
├── server.py            # main() entry point
├── cad_agent.py         # Thin bootstrap (< 10 lines)
├── start_server.bat     # Relative-path launcher
└── .env.sample          # Configuration template
```

### Architecture Flow

```
Server → Dispatcher → [COM decoration] → Middleware chain → Handler → Bridge → COM
```

**Responsibility separation:**

| Layer | Owns | Does NOT own |
|-------|------|-------------|
| **Server** | Startup, shutdown, Fail Fast | Request routing, health |
| **Dispatcher** | Route lookup (O(1) dict), COM context decoration | Auth, CORS, logging |
| **Middleware** | Exception, logging, metrics, CORS, auth | COM, business logic |
| **Handler** | Business logic (draw, save, open, etc.) | COM init, auth |

**Dispatcher decoration chain:**
```python
def dispatch(method, path):
    route = ROUTES.get((method, path))
    if route is None:
        return None  # → 404
    handler = route.handler
    # COM wrapper is part of handler decoration
    if route.com_required:
        handler = com_initialized(handler)
    # Middleware wraps last (outermost)
    handler = middleware_chain(handler)
    return handler
```

### Domain Exceptions

| Exception | Purpose | Scope |
|-----------|---------|-------|
| `ConfigurationError(RuntimeError)` | Env var missing, bad config, server start failure (Fail Fast) | Startup, env |
| `COMInitializationError(RuntimeError)` | Runtime COM init failure (`pythoncom.CoInitialize` fails) | Per-request |

Future F2 (common exception hierarchy) will incorporate these into `AgentError → ConfigurationError, COMError, AuthError, ...`.

### Routing

Dictionary-based with `(method, path)` tuple keys — O(1) lookup:

```python
class Handler(Protocol):
    def __call__(self, handler: "CADAgentHTTPRequestHandler") -> Response: ...

@dataclass(frozen=True)
class Route:
    handler: Handler
    auth: bool = True
    com_required: bool = True

ROUTES: dict[tuple[str, str], Route] = {
    ("POST", "/draw"): Route(_handle_draw, auth=True, com_required=True),
    ...
}
```

`method` and `path` live only as dictionary keys — not duplicated inside `Route`.

### Middleware Chain

**Order:** exception → logging → metrics → cors → authorization → handler

MetricsMiddleware uses `finally` to record all status codes (200, 201, 401, 403, 500):
```python
status = 500  # default for exception case (NOT 200)
try:
    response = next_handler(request)
    status = response.status_code  # actual code from handler
    return response
except AuthError as e:
    status = e.status
    raise
finally:
    metrics.record(endpoint, method, status)
```

### API Key Authentication — Fail Fast

```python
# server.py — main()
if not _is_dev_mode() and not os.environ.get("CAD_AGENT_API_KEY"):
    raise ConfigurationError("Refusing to start: CAD_AGENT_API_KEY required in production mode")

# auth.py — runtime (key existence guaranteed by Fail Fast)
def verify_api_key(headers):
    if _is_dev_mode(): return True
    if headers.get("X-API-Key") != os.environ["CAD_AGENT_API_KEY"]:
        raise AuthError("Invalid API key", status=401)
```

Production without key = server never starts. Not "every request returns 500".

### CORS Policy

| Mode | Allowed Origins |
|------|----------------|
| `DEV_MODE=true` | localhost:3000, 3333, 127.0.0.1:3000, 3333, 5173, 4200, 8080 |
| `DEV_MODE=false` | localhost:3000, 3333, 127.0.0.1:3000, 3333 |
| Origin `"null"` | **403 Forbidden** (always) |

`file://` not supported in this phase. Long-term: `CAD_AGENT_ALLOWED_ORIGINS` env var (comma-separated).

### COM Initialization Policy

**Single responsibility**: COM init happens at the HTTP request entry point only (dispatcher), never inside Bridge methods.

- `com_initialized()` context manager with `threading.local()` depth counter
- Supports nested calls (depth > 0 skips `CoInitialize`)
- `finally` block always decrements depth; `CoUninitialize` only at depth==0
- `pythoncom.CoInitialize()` failure → `COMInitializationError` → 500

```python
_com_depth = threading.local()

@contextmanager
def com_initialized():
    if not PYWIN32_AVAILABLE:
        yield; return
    depth = getattr(_com_depth, 'depth', 0)
    if depth == 0:
        try:
            pythoncom.CoInitialize()
        except pythoncom.error as e:
            raise COMInitializationError(f"COM init failed: {e}") from e
    _com_depth.depth = depth + 1
    try:
        yield
    finally:
        _com_depth.depth = getattr(_com_depth, 'depth', 0) - 1
        if _com_depth.depth == 0:
            pythoncom.CoUninitialize()
```

### Bootstrap

```python
# cad_agent.py — thin bootstrap
# TODO: Remove try/except fallback once package installation is finalized
try:
    from .server import main
except ImportError:
    from server import main

if __name__ == "__main__":
    main()
```

Both `python src/agent/cad_agent.py --server` and `python -m agent.cad_agent --server` supported.

## Type Aliases

```python
# env.py — for future HTTP framework portability (FastAPI/Flask/HTTPServer)
RequestContext = dict
Response = dict  # Minimal for now; evolves with F1 (dict → dataclass → Pydantic)
```

## Commit Strategy

**Commit A — Mechanical extraction (zero behavior change):**
- Relocate code to `env.py`, `bridge.py`, `http_handler.py`, `server.py` verbatim
- Bootstrap `cad_agent.py` + fix `start_server.bat`
- No functional changes whatsoever

**Commit B — Functional changes:**
- Domain exceptions, COM context manager, middleware chain, dict routing, auth, Fail Fast
- Remove bare `CoInitialize`, CORS `*`, `shell=True`
- Add new tests

## Definition of Done

- [ ] All 16 existing API endpoints preserved (same paths, same request/response shapes)
- [ ] All existing tests pass
- [ ] All new tests pass
- [ ] `cad_agent.py` is thin bootstrap (< 10 lines)
- [ ] Route Integrity: `set(ROUTES.keys()) == EXPECTED_ENDPOINTS`, all handler callable, metadata present
- [ ] Import Safety: `import agent.server`, `import agent.http_handler`, `import agent.bridge`, `import agent.env` — none trigger server start or COM init
- [ ] Bootstrap: both execution modes work
- [ ] Zero `Access-Control-Allow-Origin: *` (including OPTIONS preflight)
- [ ] Zero bare `pythoncom.CoInitialize()` and zero bare `pythoncom.CoUninitialize()`
- [ ] Security hygiene: zero `shell=True`, zero `eval()`, zero `exec()`
- [ ] Middleware is COM-agnostic; COM decoration happens in dispatcher only

## Verification Order

1. `pytest tests/` — functional regression
2. `bun scripts/audit.ts` — static analysis
3. Security scan — banned patterns
4. `git diff --stat` + `git log --oneline` — change sanity
5. `python -m agent.server --help` — smoke test

## Future Work

| # | Work | Depends On | Notes |
|---|------|-----------|-------|
| F2 | Common exception hierarchy (`AgentError → AuthError, COMError, ...`) | PR1 | Foundation for F3 |
| F3 | Structured logging (request ID, timing) | F2 | Builds on exception hierarchy |
| F1 | Request/Response models (dict → dataclass → Pydantic) | F3 | Uses structured error/logging |
| F4 | Declarative routing (decorator-based) | F1 | Final evolution |

**Order rationale**: Exception hierarchy (F2) and logging (F3) stabilize first so Request models (F1) and routing (F4) can build on that foundation.

## Consequences

**Positive:**
- Each module has single responsibility, testable in isolation
- Dispatcher routing is O(1) instead of O(n) if/elif chain
- COM init/uninit guaranteed paired via context manager
- Production servers cannot start without API key (Fail Fast)
- CORS policy is explicit, not wildcard
- Middleware chain is extensible (add new middleware by appending to list)

**Negative:**
- 6 files instead of 1 — slightly more navigation overhead for trivial changes
- Bootstrap import fallback adds minor complexity (removed when package installation finalizes)
- `shell=True` removal requires confirming `tasklist` works with list-form arguments on Windows

**Risks:**
- Import path changes may break external scripts that `from src.agent.cad_agent import ZWCADAgentBridge` — mitigated by `__init__.py` re-exports
- Threading local depth counter assumes HTTP server reuses threads (true for `ThreadingHTTPServer`), but untested on `ThreadPoolExecutor`
