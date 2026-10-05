# co-abap Variant Scripts

## Registry

| Script | Version | Purpose | Layer |
|--------|---------|---------|-------|
| `dispatch.ts` | 1.1.0 | Main CLI dispatcher with parallel/serial modes (now imports common) | L2 |
| `dispatch-parallel.ts` | 1.1.0 | Parallel agent dispatcher (refactored to import common, VSP defaults) | L2 |
| `dispatch-serial.ts` | 1.1.0 | Serial pipeline executor (refactored to import common, VSP defaults) | L2 |
| `retry-handler.ts` | 1.1.0 | 3-retry with exponential backoff + AbortSignal (variant-specific per ADR-0050) | L2 |
| `vsp-audit.ts` | 1.1.0 | ATC rule-pack audit: validates atc-rulepack.json, prints deterministic check selection per change type | L2 |
| `atc-rulepack.json` | 1.0.0 | ATC check-selection rule pack per change type (abapOpenChecks parity) | L2 |
| `vsp-task.ts` | 1.0.1 | Create task files from template | L2 |
| `vsp-publish.ts` | 1.1.0 | Package and publish core framework assets to the plugin repository (project-root source base; verified asset list; missing required asset aborts) | L2 |
| `new-requirement.ts` | 1.2.0 | Scaffold deliverables/REQ-NNN-<slug>/ stage docs (01_srs.md, 05_unit_test_plan.md, 06_release_report.md) and register the RTM row; exits non-zero when required templates are missing | L2 |
| `scratch-cleanup.ts` | 1.1.0 | Scratch workspace hygiene (temp purge, task archival, status; 30-day archive default, validated --days) | L2 |
| `setup.ts` | 1.1.0 | Project environment setup (uv pip install into .venv, exit-code honesty, opt-in --with-rtk) | L2 |
| `install-vsp.ts` | 1.1.0 | vsp binary installation from GitHub Releases (canonical repo oisee/vibing-steampunk, pinned version, fail-closed checksums.txt verification) | L2 |
| `install-bun.ts` | 1.0.1 | Bun runtime installation | L2 |

## Common-layer imports (dispatch / retry-handler)

`dispatch.ts`, `dispatch-parallel.ts`, `dispatch-serial.ts`, and `retry-handler.ts` are
thin L2 wrappers: they import their common-layer counterparts from `../` (e.g.
`dispatch.ts` has `import { showHelp } from '../dispatch.ts'`, `retry-handler.ts`
imports from `'../retry-handler.ts'`). In this template directory those `../`
targets are the `templates/common/scripts/` files; in a scaffolded project the
scaffold's flat common-scripts sync places the common scripts directly in the
project's `scripts/` directory, so the same relative import resolves there.
The variant's `variant.json` `script_manifest.external[]` declares these
common-layer dependencies (maintained by the contracts agent) so validation does
not flag the cross-layer relative imports.
