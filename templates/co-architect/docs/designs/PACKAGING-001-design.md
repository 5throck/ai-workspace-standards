# PACKAGING-001 — CAD Intelligence Platform Packaging

> **Status**: Implemented (2026-07-11)
> **Created**: 2026-07-11
> **Supersedes**: None (new)
> **Depends on**: PKG-001 (src/ package layout)
> **Category**: docs/firm-governance/production-readiness-program.md §2.6

---

## Problem

The CAD Intelligence platform has no repeatable install path. The current state exhibits multiple packaging defects:

| # | Problem | Evidence |
|---|---------|----------|
| P1 | Package name mismatch | `pyproject.toml` declares `file-curator 0.1.0`; main package is `cad_intelligence 0.2.0` |
| P2 | No console entry points | Server started via `python server.py` directly, not via installed CLI command |
| P3 | No `__main__.py` | `python -m cad_intelligence` does not work |
| P4 | Version inconsistency | Three different versions across pyproject.toml, `__init__.py`, and server.py |
| P5 | Duplicate dev deps | Defined in both `[project.optional-dependencies].dev` and `[dependency-groups].dev` |
| P6 | Stale egg-info | `file_curator.egg-info/` has outdated dependency list |
| P7 | Setup scripts reference missing `requirements.txt` | Warns and skips Python deps |
| P8 | Unmanaged server entry points | No unified CLI for MCP server and HTTP agent |
| P9 | Unused dependency | `manifold3d` declared but never imported (dead dep) |

Without a standard install path, nobody except the development machine can run the system.

---

## Design Decisions

### Project Identity

**D1 — Project rename to `cad-intelligence`**

`pyproject.toml` name changes from `file-curator` to `cad-intelligence`. Package discovery uses `[tool.setuptools.packages.find]` with `where = ["src"]`. No explicit `packages = []` is set (default auto-discovery from `where` is sufficient).

---

### Console Entry Points

**D2 — Two entry points registered**

| Entry point | Function | Purpose |
|---|---|---|
| `zwcad-mcp` | `cad_intelligence.__main__:cli_main` | MCP stdio server CLI dispatcher |
| `zwcad-agent` | `agent.cad_agent:main` | HTTP agent (already uses argparse) |

Note: If the system expands to support multiple CAD vendors in the future, these can be renamed to vendor-neutral names (`cad-mcp`, `cad-agent`).

---

### CLI Dispatcher

**D3 — `__main__.py` as CLI dispatcher with contract**

| Invocation | Behavior |
|---|---|
| `python -m cad_intelligence` | `serve` (default) |
| `python -m cad_intelligence serve` | `serve` |
| `zwcad-mcp` | `serve` |
| `zwcad-mcp serve` | `serve` |
| `zwcad-mcp version` | Print `cad-intelligence {version}` |
| `zwcad-mcp doctor` | Environment validation |

Version output format: `cad-intelligence {version}` (e.g. `cad-intelligence 0.2.0`). This format is a stable contract — do not change in future releases.

Exit code contract:
| Code | Meaning |
|---|---|
| 0 | All required checks passed |
| 1 | Required check failed |
| 2 | Invalid CLI arguments |

---

### Version Management

**D4 — Single source of truth version via PEP 621 dynamic versioning**

```toml
[project]
dynamic = ["version"]

[tool.setuptools.dynamic]
version = {attr = "cad_intelligence.__version__"}
```

`server.py`'s hardcoded `_SERVER_VERSION = "0.1.0"` is replaced with `from cad_intelligence import __version__`.

**Constraint**: `__version__` must be importable without importing optional dependencies. `cad_intelligence/__init__.py` must not perform runtime initialization or environment detection. The file should remain lightweight — only docstring, `__version__`, and `__all__`.

---

### Dependency Management

**D5 — Consolidate dev dependencies**

Remove `[dependency-groups]` section entirely. Keep only `[project.optional-dependencies] dev` with updated minimum versions (pytest>=9.1.1, pytest-cov>=7.1.0).

**D9 — Remove dead dependency `manifold3d`**

`manifold3d>=3.0.0` is removed from `pyproject.toml`. Evidence:
- FACADE-001 design doc deviation table: "Not directly imported"
- Memory log (2026-07-08): "manifold3d installed but not directly imported (trimesh handles CSG internally)"
- No `import manifold` anywhere in `src/`
- `trimesh` does not depend on `manifold3d` (requires only `numpy`)
- `facade_mesh_builder.py` docstring mention updated to remove `manifold3d`

Rollback criterion: If Boolean mesh support requiring `manifold3d` is reintroduced, add it back as an optional dependency under `[project.optional-dependencies].mesh`.

**D10 — Platform markers for Windows-only dependencies**

```toml
"pywin32>=311; sys_platform == 'win32'"
```

---

### Stale Artifacts

**D6 — `.gitignore` additions**

```
build/
dist/
*.egg-info/
```

Existing `src/file_curator.egg-info/` directory is deleted.

---

### Setup Scripts

**D7 — Modernize setup scripts**

All three setup scripts (`setup.sh`, `setup.ps1`, `setup.bat`):
- Remove `requirements.txt` reference (file does not exist)
- Use `python -m pip install -e ".[dev]"` instead of `pip install`
- `python -m pip` is preferred over bare `pip` for environment consistency

---

### Agent Package

**D8 — Agent package regularization**

Create `src/agent/__init__.py` (empty) so setuptools recognizes `agent/` as a package. The HTTP agent remains a top-level package (`src/agent/`) because it is an independent entry point with its own static assets (`index.html`) and modules (`audit_log.py`, `metrics.py`). Consolidation into `cad_intelligence.agent` may be considered in the future but is out of scope for this spec.

---

### Doctor Command

**D11 — Environment validation command**

Location: `src/cad_intelligence/cli/doctor.py`

Three-tier validation:

| Tier | Checks | On failure |
|---|---|---|
| **Required** | Python ≥ 3.11, isolated Python environment (venv/virtualenv), core dependency imports | Exit 1 |
| **Optional-Windows** | pywin32, ZWCAD COM registration, ZWCAD process running | Warning only (skip on non-Windows) |
| **Informational** | `.env` file exists, API keys configured | Display only (never fails) |

**CI rule**: When `CI` environment variable is `true`, the isolated environment check is skipped (CI environments use their own isolation mechanisms).

**Dependency check mechanism**: The doctor checks import availability of the project's runtime dependencies using an explicit import-name mapping. Only packages where the distribution name differs from the import name are listed in the mapping table:

```python
_IMPORT_NAME_MAP = {
    "python-dotenv": "dotenv",
    "PyYAML": "yaml",
}
# All other dependencies have identical distribution and import names.
```

`importlib.import_module()` is used to verify each import. The doctor does not check installation metadata or file existence — it verifies that modules are actually importable at runtime.

**Role boundary**: `zwcad-mcp doctor` is a **runtime environment diagnostic tool**. It reports what the current environment can and cannot support. Package installation and distribution verification is the responsibility of the CI packaging job (D12), not the doctor.

---

### CI Packaging Verification

**D12 — Separate CI job with fresh virtual environment**

A new `packaging` CI job runs independently from the existing `test-python` job. It creates a fresh virtual environment to avoid interference from editable installs:

```yaml
packaging:
  name: Packaging Verification
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: "3.13"
    - name: Build wheel
      run: |
        python -m pip install build
        python -m build --wheel
    - name: Install wheel in fresh venv
      run: |
        python -m venv .venv-test
        .venv-test\Scripts\activate  # or: source .venv-test/bin/activate (POSIX)
        python -m pip install dist/*.whl
    - name: Verify entry points
      run: |
        .venv-test\Scripts\activate
        zwcad-mcp version
        zwcad-mcp --help
        zwcad-agent --help
        zwcad-mcp doctor
```

The packaging job verifies: wheel builds successfully, installs cleanly in a fresh environment, all entry points are functional, and doctor passes in the installed context.

---

### Completion Criteria

**D13 — §2.6 "Implemented" requires all five conditions**

1. `pip install -e ".[dev]"` succeeds without errors
2. `zwcad-mcp --help` and `zwcad-agent --help` both produce valid output
3. `python -m build --wheel` produces a valid wheel
4. Fresh venv wheel install: `zwcad-mcp version` outputs `cad-intelligence {version}`
5. CI packaging job passes
6. All existing tests pass with zero regressions after the packaging changes

---

## Implementation

| File | Action | Decision(s) |
|------|--------|-------------|
| `docs/designs/PACKAGING-001-design.md` | CREATE | All |
| `pyproject.toml` | MODIFY (targeted update) | D1, D4, D5, D9, D10 |
| `src/agent/__init__.py` | CREATE (empty) | D8 |
| `src/cad_intelligence/__main__.py` | CREATE | D3 |
| `src/cad_intelligence/cli/__init__.py` | CREATE (empty) | D11 |
| `src/cad_intelligence/cli/doctor.py` | CREATE | D11 |
| `src/cad_intelligence/cad_io/server.py` | MODIFY | D4 |
| `src/cad_intelligence/facade/facade_mesh_builder.py` | MODIFY | D9 |
| `scripts/setup.sh` | MODIFY | D7 |
| `scripts/setup.ps1` | MODIFY | D7 |
| `scripts/setup.bat` | MODIFY | D7 |
| `.gitignore` | MODIFY | D6 |
| `.github/workflows/ci.yml` | MODIFY | D12 |
| `docs/firm-governance/production-readiness-program.md` | MODIFY §2.6 | D13 |
| `CHANGELOG.md` | MODIFY | All |
