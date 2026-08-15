# co-abap Variant Scripts

| Script | Purpose | Layer |
|--------|---------|-------|
| `dispatch.ts` | Main CLI dispatcher with parallel/serial modes | L2 |
| `dispatch-parallel.ts` | Parallel agent dispatcher for read-only tasks | L2 |
| `dispatch-serial.ts` | Serial pipeline executor for write operations | L2 |
| `retry-handler.ts` | 3-retry with exponential backoff + error classification | L2 |
| `vsp-audit.ts` | VSP configuration audit | L2 |
| `vsp-task.ts` | Create task files from template | L2 |
| `vsp-publish.ts` | Package and publish core framework assets to the plugin repository | L2 |
| `new-requirement.ts` | Scaffold deliverables/REQ-NNN-slug/01_srs.md and register RTM row | L2 |
| `scratch-cleanup.ts` | Scratch workspace hygiene (temp purge, task archival, status) | L2 |
| `setup.ts` | Project environment setup | L2 |
| `install-vsp.ts` | VSP (VS Code extension) installation | L2 |
| `install-bun.ts` | Bun runtime installation | L2 |
