# co-abap Variant Scripts

| Script | Purpose | Layer |
|--------|---------|-------|
| `dispatch.ts` | Main CLI dispatcher with parallel/serial modes | L1 |
| `dispatch-parallel.ts` | Parallel agent dispatcher for read-only tasks | L1 |
| `dispatch-serial.ts` | Serial pipeline executor for write operations | L1 |
| `retry-handler.ts` | 3-retry with exponential backoff + error classification | L1 |
| `vsp-audit.ts` | VSP configuration audit | L1 |
| `vsp-task.ts` | Create task files from template | L1 |
| `vsp-publish.sh` | Publish VSP binary (Unix) | L1 |
| `vsp-publish.ps1` | Publish VSP binary (Windows) | L1 |
| `new-requirement.ts` | Scaffold deliverables/REQ-NNN-slug/01_srs.md and register RTM row | L1 |
| `scratch-cleanup.ts` | Scratch workspace hygiene (temp purge, task archival, status) | L1 |
| `setup.ts` | Project environment setup | L1 |
| `install-vsp.ts` | VSP (VS Code extension) installation | L1 |
| `install-bun.ts` | Bun runtime installation | L1 |
