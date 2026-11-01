# ADR-0036: TypeScript-Only Operational Scripts

## Status
Accepted

## Context
The workspace needs a consistent scripting layer for operational tasks (audit, sync, benchmarking, security scanning). Mixing shell languages (.sh, .ps1, .bat) creates platform fragmentation and maintenance burden.

## Decision
All `scripts/` operational scripts must be TypeScript (`.ts`), executed via `bun scripts/<name>.ts`. No `.sh` or `.ps1` counterparts are permitted.

### Rationale
- Cross-platform: `bun` runs identically on Windows, macOS, and Linux
- Single language: TypeScript for both application code and operational scripts
- No shell scripting: eliminates platform-specific `.sh`/`.ps1` divergence
- Existing toolchain: `bun` is already a project dependency

### Allowed Exceptions
- `start_server.bat`: Windows-only launcher for ZWCAD integration (not an operational script)
- `scripts/*.py`: CAD-pipeline diagnostic, benchmarking, and geometry-analysis scripts (e.g. `gen_elevations.py`, `rematch_openings.py`, `diag_*.py`, `check_zoning.py`) that call directly into `src/cad_intelligence` and `pyproject.toml` dependencies (ezdxf, shapely, pywin32). These are CAD-domain tooling, not workspace lifecycle/audit scripts, and depend on the Python COM/geometry stack rather than `bun`. They must still be registered in `scripts/SCRIPTS.md`.

## Consequences
- All new scripts must be `.ts` files in `scripts/`
- Script metadata tracked in `scripts/SCRIPTS.md`
- `CLAUDE.md` and `GEMINI.md` enforce this rule in coding guidelines
