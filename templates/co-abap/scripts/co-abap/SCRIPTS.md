# co-abap Variant Scripts

## Registry

| Script | Version | Purpose | Layer |
|--------|---------|---------|-------|
| `dispatch.ts` | 1.0.1 | Main CLI dispatcher with parallel/serial modes (now imports common) | L2 |
| `dispatch-parallel.ts` | 1.0.1 | Parallel agent dispatcher (refactored to import common, VSP defaults) | L2 |
| `dispatch-serial.ts` | 1.0.1 | Serial pipeline executor (refactored to import common, VSP defaults) | L2 |
| `retry-handler.ts` | 1.0.2 | 3-retry with exponential backoff + AbortSignal (variant-specific per ADR-0050) | L2 |
| `vsp-audit.ts` | 1.1.0 | ATC rule-pack audit: validates atc-rulepack.json, prints deterministic check selection per change type | L2 |
| `atc-rulepack.json` | 1.0.0 | ATC check-selection rule pack per change type (abapOpenChecks parity) | L2 |
| `vsp-task.ts` | 1.0.1 | Create task files from template | L2 |
| `vsp-publish.ts` | 1.0.0 | Package and publish core framework assets to the plugin repository | L2 |
| `new-requirement.ts` | 1.0.1 | Scaffold deliverables/REQ-NNN-slug/01_srs.md and register RTM row | L2 |
| `scratch-cleanup.ts` | 1.0.1 | Scratch workspace hygiene (temp purge, task archival, status) | L2 |
| `setup.ts` | 1.0.2 | Project environment setup | L2 |
| `install-vsp.ts` | 1.0.1 | VSP (VS Code extension) installation | L2 |
| `install-bun.ts` | 1.0.1 | Bun runtime installation | L2 |
